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
 * What the programme needs of a grid at a load factor: the PTDF, the flows of the shifts alone (`offset`), the
 * demand, the units, the injection without them (`base`), and a row for each finite limit of a branch in service.
 * The grid must be in one piece (the PTDF throws otherwise).
 */
export function createDispatchModel(/** @type {Grid} */ grid, { loadFactor = 1 } = {}) {
  const transfer = ptdf(grid);
  const offset = solveFlows(grid, new Float64Array(grid.busCount)).flow;
  const demand = demandOf(grid, loadFactor);
  const { units, fixed } = unitsOf(grid);
  const model = { grid, loadFactor, transfer, offset, demand, units, base: Float64Array.from(demand, (d, n) => fixed[n] - d), limits: flowLimits(grid), rows: /** @type {LimitRow[]} */ ([]) };
  for (let k = 0; k < grid.branchCount; k += 1) {
    if (!grid.inService[k]) continue;
    if (Number.isFinite(model.limits.upper[k])) model.rows.push(flowRow(grid, model, k, 1));
    if (Number.isFinite(model.limits.lower[k])) model.rows.push(flowRow(grid, model, k, -1));
  }
  return model;
}

/** @typedef {ReturnType<typeof createDispatchModel>} DispatchModel */

const dot = (/** @type {Float64Array} */ a, /** @type {Float64Array} */ b) => a.reduce((sum, v, i) => sum + v * b[i], 0);

/** The rows of the limits over the units: Σ_u bus[genBus(u)] · p[u] ≤ limit − offset − bus · base. */
function limitRows(/** @type {DispatchModel} */ model) {
  const { units, rows, grid } = model;
  const n = units.length;
  const A = new Float64Array(rows.length * n);
  const b = new Float64Array(rows.length);
  rows.forEach((row, r) => {
    for (let u = 0; u < n; u += 1) A[r * n + u] = row.bus[grid.genBus[units[u]]];
    b[r] = row.limit - row.offset - dot(row.bus, model.base);
  });
  return { A, b };
}

/** The programme for `qp`, over the outputs of the units, in MW; their costs c2 and c1 ($/h). */
export function programOf(/** @type {DispatchModel} */ model) {
  const { grid, units } = model;
  const n = units.length;
  const c = Float64Array.from(units, (g) => grid.cost[3 * g + 1]);
  const program = {
    c,
    eq: { A: new Float64Array(n).fill(1), b: [-model.base.reduce((sum, v) => sum + v, 0)] },
    le: limitRows(model),
    lower: Float64Array.from(units, (g) => grid.pmin[g]),
    upper: Float64Array.from(units, (g) => grid.pmax[g]),
  };
  if (units.every((g) => grid.cost[3 * g] === 0)) return program;
  const Q = new Float64Array(n * n);
  units.forEach((g, u) => (Q[u * n + u] = 2 * grid.cost[3 * g]));
  return { ...program, Q };
}
