/**
 * The dispatch (docs/modele.md § 5): the DC-OPF of src/opf/problem.js, solved by mcts-commun's `qp`, and what comes
 * out of it: each generator's output, the flows, the cost, the branches whose limit binds, and the nodal prices.
 * With `security`, the N-1 rule is enforced (src/opf/security.js): the limits after a loss are added as the last
 * dispatch breaks them, and the programme is solved again from the constraints that bound (`warm`).
 *
 * The nodal price of a bus is what one more MW consumed there would cost, in $/MWh: with `qp`'s multipliers,
 * −eq − Σ_r le[r] · bus_r[n], since a MW consumed at n raises the balance's right side by 1 and each limit row's by
 * bus_r[n] (src/opf/problem.js).
 */

import { createQp } from "mcts-commun/qp.js";
import { solveFlows } from "../flow/dcflow.js";
import { lodf } from "../flow/sensitivity.js";
import { createDispatchModel, programOf } from "./problem.js";
import { n1Overloads, securityRow } from "./security.js";

/** @typedef {import("../types.js").Grid} Grid */
/** @typedef {import("./problem.js").DispatchModel} DispatchModel */

/**
 * A dispatch: without `cost` and what follows it unless `status` is "optimal".
 * @typedef {object} Dispatch
 * @property {string} status qp's: "optimal", "infeasible", "unbounded", "unconverged", "numerical"
 * @property {{ kind: string, index: number, branch?: number, outage?: number } | null} [culprit] for "infeasible"
 * @property {number} [cost] in $/h
 * @property {Float64Array} [generation] each generator's output, in MW
 * @property {Float64Array} [injection] each bus's net injection, in MW
 * @property {import("../types.js").Flows} [flows]
 * @property {Float64Array} [prices] each bus's nodal price, in $/MWh
 * @property {{ branch: number, outage: number, side: number, multiplier: number }[]} [binding]
 * @property {number} rows the limit rows of the programme
 * @property {number} passes the solves
 * @property {number | null} left with the N-1 rule, the overloads after a loss the last solve leaves
 * @property {number} rounds
 * @property {number} iterations
 */

/** Below this, a limit's multiplier is zero: the limit does not bind. */
const BINDING = 1e-7;

/** Each generator's output, in MW: the units from the solution, the others at Pmax. */
function generationOf(/** @type {DispatchModel} */ model, /** @type {Float64Array} */ x) {
  const { grid, units } = model;
  const out = Float64Array.from(grid.pmax, (pmax, g) => (grid.genOn[g] ? pmax : 0));
  units.forEach((g, u) => (out[g] = x[u]));
  return out;
}

/** The net injection of each bus, in MW. */
function injectionOf(/** @type {DispatchModel} */ model, /** @type {Float64Array} */ x) {
  const out = Float64Array.from(model.base);
  model.units.forEach((g, u) => (out[model.grid.genBus[g]] += x[u]));
  return out;
}

/** The cost of the outputs, in $/h: c2 · p² + c1 · p + c0 of every generator in service. */
export function costOf(/** @type {Grid} */ grid, /** @type {Float64Array} */ generation) {
  let sum = 0;
  for (let g = 0; g < grid.genCount; g += 1) {
    if (grid.genOn[g]) sum += (grid.cost[3 * g] * generation[g] + grid.cost[3 * g + 1]) * generation[g] + grid.cost[3 * g + 2];
  }
  return sum;
}

/** The nodal prices, in $/MWh. */
function pricesOf(/** @type {DispatchModel} */ model, /** @type {Float64Array} */ eq, /** @type {Float64Array} */ le) {
  const prices = new Float64Array(model.grid.busCount).fill(-eq[0]);
  model.rows.forEach((row, r) => {
    if (le[r] !== 0) for (let n = 0; n < prices.length; n += 1) prices[n] -= le[r] * row.bus[n];
  });
  return prices;
}

/** The limits that bind, with their multiplier ($/MWh per MW of limit). */
function bindingOf(/** @type {DispatchModel} */ model, /** @type {Float64Array} */ le) {
  return model.rows.flatMap((row, r) => (le[r] > BINDING ? [{ branch: row.branch, outage: row.outage, side: row.side, multiplier: le[r] }] : []));
}

/** The constraint `qp` could not satisfy, with its branch when it is a limit. */
function culpritOf(/** @type {DispatchModel} */ model, /** @type {{ kind: string, index: number } | null} */ culprit) {
  if (culprit?.kind !== "le") return culprit;
  const row = model.rows[culprit.index];
  return { ...culprit, branch: row.branch, outage: row.outage };
}

/** @returns {Dispatch} */
function outcomeOf(/** @type {DispatchModel} */ model, result, /** @type {{ passes: number, left: number | null }} */ security) {
  const work = { rows: model.rows.length, ...security, rounds: result.rounds, iterations: result.iterations };
  if (result.status !== "optimal") return { status: result.status, culprit: culpritOf(model, result.culprit), ...work };
  const generation = generationOf(model, result.x);
  const injection = injectionOf(model, result.x);
  return {
    status: result.status,
    cost: costOf(model.grid, generation),
    generation,
    injection,
    flows: solveFlows(model.grid, injection),
    prices: pricesOf(model, result.multipliers.eq, result.multipliers.le),
    binding: bindingOf(model, result.multipliers.le),
    ...work,
  };
}

/** F = PTDF · P + offset, for the units' outputs x. */
function flowsOf(/** @type {DispatchModel} */ model, /** @type {Float64Array} */ x) {
  const injection = injectionOf(model, x);
  const n = model.grid.busCount;
  return Float64Array.from(model.offset, (offset, k) => {
    let sum = offset;
    for (let i = 0; i < n; i += 1) sum += model.transfer[k * n + i] * injection[i];
    return sum;
  });
}

/**
 * The cheapest dispatch of a grid in one piece at a load factor; with `security`, N-1 secure. `status` is qp's:
 * "optimal", or "infeasible" with the `culprit`, the constraint no dispatch can meet. `passes` counts the solves;
 * with `security`, `left` counts the overloads after a loss that the last one leaves (0: secure; more only when
 * `maxPasses` ran out), and is null without it.
 */
export function solveDispatch(/** @type {Grid} */ grid, { loadFactor = 1, security = false, maxPasses = 50 } = {}) {
  const model = createDispatchModel(grid, { loadFactor });
  const qp = createQp(model.units.length);
  const result = qp.solve(programOf(model));
  if (!security) return outcomeOf(model, result, { passes: 1, left: null });
  return secure(model, qp, result, maxPasses);
}

/** The N-1 passes: add the limits after a loss that the last dispatch breaks, solve again from its active set. */
function secure(/** @type {DispatchModel} */ model, qp, first, /** @type {number} */ maxPasses) {
  const factors = lodf(model.grid, model.transfer);
  let [result, passes, left] = [first, 1, 0];
  while (result.status === "optimal") {
    const overloads = n1Overloads(model.grid, flowsOf(model, result.x), factors);
    left = overloads.length;
    if (left === 0 || passes >= maxPasses) break;
    model.rows.push(...overloads.map((overload) => securityRow(model, factors, overload)));
    result = qp.solve(programOf(model), { warm: result.active });
    passes += 1;
  }
  return outcomeOf(model, result, { passes, left });
}
