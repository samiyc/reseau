/**
 * The DC-OPF as a programme for mcts-commun's `qp` (docs/modele.md § 5): the cheapest outputs of the generators that
 * meet the demand, within their bounds, with every branch within its limit. MATPOWER's manual § 6.2, the angles
 * eliminated by the PTDF: one equality (the sum produced is the sum consumed) and, for each limit, a row over the
 * buses, Σ a[n] · P[n] + s ≤ limit, where P is the net injection. A row over the buses rather than over the
 * generators: the nodal prices come out of the same vector (src/opf/dispatch.js).
 *
 * The limit of a branch is its rating RATE_A and, when the file has them, its limits on θf − θt: in DC,
 * θf − θt = F / (baseMVA · b) + φ, so they bound the flow too, and the tighter wins.
 */

import { solveFlows } from "../flow/dcflow.js";
import { ptdf } from "../flow/sensitivity.js";

/** @typedef {import("../types.js").Grid} Grid */

/**
 * A limit as the programme reads it: Σ bus[n] · P[n] + offset ≤ limit. `outage` is the branch lost first (−1: none),
 * `side` +1 for the flow's upper limit, −1 for its lower one.
 * @typedef {{ branch: number, outage: number, side: number, bus: Float64Array, offset: number, limit: number }} LimitRow
 */

/** The consumption of each bus at a load factor: the load times the factor, plus the shunt, in MW. */
export const demandOf = (/** @type {Grid} */ grid, loadFactor = 1) => Float64Array.from(grid.load, (load, n) => loadFactor * load + grid.shunt[n]);

/** The generators the programme moves (in service, Pmax above Pmin), and the injection of the others (at Pmax). */
export function unitsOf(/** @type {Grid} */ grid) {
  const units = [];
  const fixed = new Float64Array(grid.busCount);
  for (let g = 0; g < grid.genCount; g += 1) {
    if (!grid.genOn[g]) continue;
    if (grid.pmax[g] > grid.pmin[g]) units.push(g);
    else fixed[grid.genBus[g]] += grid.pmax[g];
  }
  return { units: Int32Array.from(units), fixed };
}

/** The bounds on each branch's flow, in MW: its rating and its angle limits, the tighter of each side. */
export function flowLimits(/** @type {Grid} */ grid) {
  const upper = new Float64Array(grid.branchCount);
  const lower = new Float64Array(grid.branchCount);
  for (let k = 0; k < grid.branchCount; k += 1) {
    const rate = grid.rate[k] > 0 ? grid.rate[k] : Infinity;
    const scale = grid.baseMVA * grid.susceptance[k];
    const ends = [grid.angleMin[k], grid.angleMax[k]].map((angle) => (Number.isFinite(angle) ? scale * (angle - grid.shift[k]) : angle * Math.sign(scale || 1)));
    upper[k] = Math.min(rate, Math.max(...ends));
    lower[k] = Math.max(-rate, Math.min(...ends));
  }
  return { upper, lower };
}

/** The row of a branch's flow, F = PTDF(k, ·) · P + offset, on one side. */
function flowRow(/** @type {Grid} */ grid, model, /** @type {number} */ k, /** @type {number} */ side) {
  const n = grid.busCount;
  const bus = Float64Array.from({ length: n }, (_, i) => side * model.transfer[k * n + i]);
  const limit = side > 0 ? model.limits.upper[k] : -model.limits.lower[k];
  return { branch: k, outage: -1, side, bus, offset: side * model.offset[k], limit };
}

/**
 * The programme's variables, in MW: the units' outputs, then, with `shedding`, the load shed at each bus that has
 * some (between 0 and its demand; shedding a MW injects one at its bus).
 */
function columnsOf(/** @type {Grid} */ grid, /** @type {Int32Array} */ units, /** @type {Float64Array} */ demand, /** @type {boolean} */ shedding) {
  const shed = shedding ? [...demand.keys()].filter((n) => demand[n] > 0) : [];
  const ofUnits = (/** @type {(g: number) => number} */ value) => Array.from(units, value);
  return {
    unitCount: units.length,
    shedBus: Int32Array.from(shed),
    bus: Int32Array.from([...ofUnits((g) => grid.genBus[g]), ...shed]),
    c1: Float64Array.from([...ofUnits((g) => grid.cost[3 * g + 1]), ...shed.map(() => 0)]),
    c2: Float64Array.from([...ofUnits((g) => grid.cost[3 * g]), ...shed.map(() => 0)]),
    lower: Float64Array.from([...ofUnits((g) => grid.pmin[g]), ...shed.map(() => 0)]),
    upper: Float64Array.from([...ofUnits((g) => grid.pmax[g]), ...shed.map((n) => demand[n])]),
  };
}

/**
 * What the programme needs of a grid at a load factor: the PTDF, the flows of the shifts alone (`offset`), the
 * demand, the units, the injection without them (`base`), the variables, and a row for each finite limit of a branch
 * in service. The grid must be in one piece (the PTDF throws otherwise).
 */
export function createDispatchModel(/** @type {Grid} */ grid, { loadFactor = 1, shedding = false } = {}) {
  const transfer = ptdf(grid);
  const offset = solveFlows(grid, new Float64Array(grid.busCount)).flow;
  const demand = demandOf(grid, loadFactor);
  const { units, fixed } = unitsOf(grid);
  const base = Float64Array.from(demand, (d, n) => fixed[n] - d);
  const model = { grid, loadFactor, transfer, offset, demand, units, base, columns: columnsOf(grid, units, demand, shedding), limits: flowLimits(grid), rows: /** @type {LimitRow[]} */ ([]) };
  for (let k = 0; k < grid.branchCount; k += 1) {
    if (!grid.inService[k]) continue;
    if (Number.isFinite(model.limits.upper[k])) model.rows.push(flowRow(grid, model, k, 1));
    if (Number.isFinite(model.limits.lower[k])) model.rows.push(flowRow(grid, model, k, -1));
  }
  return model;
}

/** @typedef {ReturnType<typeof createDispatchModel>} DispatchModel */

const dot = (/** @type {Float64Array} */ a, /** @type {Float64Array} */ b) => a.reduce((sum, v, i) => sum + v * b[i], 0);

/**
 * The rows of the limits over the variables, Σ_j bus[bus(j)] · x[j] ≤ limit − offset − bus · base; and, given a
 * `cap`, one more: the load shed at most `cap`.
 */
function limitRows(/** @type {DispatchModel} */ model, /** @type {number | null} */ cap) {
  const { rows, columns } = model;
  const n = columns.bus.length;
  const count = rows.length + (cap === null ? 0 : 1);
  const A = new Float64Array(count * n);
  const b = new Float64Array(count);
  rows.forEach((row, r) => {
    for (let j = 0; j < n; j += 1) A[r * n + j] = row.bus[columns.bus[j]];
    b[r] = row.limit - row.offset - dot(row.bus, model.base);
  });
  if (cap === null) return { A, b };
  A.fill(1, rows.length * n + columns.unitCount, count * n);
  b[rows.length] = cap;
  return { A, b };
}

/**
 * The programme for `qp`. `objective` "cost": the units' costs c2 and c1 ($/h), the load shed free but held under
 * `cap` when one is given; "shed": the load shed, in MW, alone (the first of Sami's lexicographic order).
 */
export function programOf(/** @type {DispatchModel} */ model, { objective = "cost", cap = null } = {}) {
  const { columns } = model;
  const n = columns.bus.length;
  const c = objective === "shed" ? Float64Array.from(columns.bus, (_, j) => (j < columns.unitCount ? 0 : 1)) : columns.c1;
  const program = {
    c,
    eq: { A: new Float64Array(n).fill(1), b: [-model.base.reduce((sum, v) => sum + v, 0)] },
    le: limitRows(model, cap),
    lower: columns.lower,
    upper: columns.upper,
  };
  if (objective === "shed" || columns.c2.every((v) => v === 0)) return program;
  const Q = new Float64Array(n * n);
  columns.c2.forEach((v, j) => (Q[j * n + j] = 2 * v));
  return { ...program, Q };
}
