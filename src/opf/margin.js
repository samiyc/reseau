/**
 * The dispatch past the N-1 limit (Sami, 14/11; docs/modele.md § 5): when no dispatch holds the rule, the one that
 * keeps the worst loading after a single loss as low as it can, in Sami's lexicographic order: the least load shed
 * first, then the least worst loading after a loss, then the least cost at that loading.
 *
 * The worst loading is one more variable, α ≥ 1: every limit after a loss reads F(l) + LODF(l, c) · F(c) ≤ α · rate,
 * and the rows enter as the last dispatch breaks them, as for the N-1 rule (src/opf/security.js). Its bounds are the
 * rule's: a bridge is no contingency, and after a loss a branch keeps its rating and loses its angle limits. With
 * α = 1 the dispatch holds the rule; the limits of the intact grid stay hard.
 */

import { createQp } from "mcts-commun/qp.js";
import { lodf } from "../flow/sensitivity.js";
import { SHED_SLACK, flowsOf, outcomeOf } from "./dispatch.js";
import { createDispatchModel, programOf } from "./problem.js";
import { n1Overloads, securityRow } from "./security.js";

/** @typedef {import("../types.js").Grid} Grid */
/** @typedef {import("./problem.js").DispatchModel} DispatchModel */

/** A loading after a loss counts past α beyond this. */
const TOLERANCE = 1e-6;

/** The grid's model, served whole when it can be; otherwise with shedding, and the least load it must shed. */
function startOf(/** @type {Grid} */ grid, /** @type {number} */ loadFactor) {
  const whole = createDispatchModel(grid, { loadFactor });
  if (createQp(whole.columns.bus.length).solve(programOf(whole)).status === "optimal") return { model: whole, cap: null, failed: null };
  const model = createDispatchModel(grid, { loadFactor, shedding: true });
  const least = createQp(model.columns.bus.length).solve(programOf(model, { objective: "shed" }));
  if (least.status !== "optimal") return { model, cap: null, failed: least };
  return { model, cap: least.value * (1 + SHED_SLACK) + SHED_SLACK, failed: null };
}

/** A square matrix of size n, grown to m by zeros. */
function grown(/** @type {ArrayLike<number>} */ Q, /** @type {number} */ n, /** @type {number} */ m) {
  const out = new Float64Array(m * m);
  for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) out[i * m + j] = Q[i * n + j];
  return out;
}

/**
 * The programme with α as its last variable, between 1 and `alphaCap`: each row after a loss gives up α times its
 * limit. `objective` "margin" minimises α alone; "cost", the costs of the units.
 */
function marginProgram(/** @type {DispatchModel} */ model, /** @type {{ objective: string, cap: number | null, alphaCap: number }} */ stage) {
  const program = programOf(model, { cap: stage.cap });
  const n = model.columns.bus.length;
  const m = n + 1;
  const count = program.le.b.length;
  const A = new Float64Array(count * m);
  const b = Float64Array.from(program.le.b);
  for (let r = 0; r < count; r += 1) {
    A.set(program.le.A.subarray(r * n, (r + 1) * n), r * m);
    const row = model.rows[r];
    if (row && row.outage >= 0) [A[r * m + n], b[r]] = [-row.limit, b[r] - row.limit];
  }
  const c = stage.objective === "margin" ? Float64Array.from({ length: m }, (_, j) => (j === n ? 1 : 0)) : Float64Array.from([...program.c, 0]);
  const Q = stage.objective === "cost" && program.Q ? grown(program.Q, n, m) : undefined;
  return {
    c,
    ...(Q ? { Q } : {}),
    eq: { A: Float64Array.from([...program.eq.A, 0]), b: program.eq.b },
    le: { A, b },
    lower: Float64Array.from([...program.lower, 1]),
    upper: Float64Array.from([...program.upper, stage.alphaCap]),
  };
}

/** The last solve's active set, its rows past `from` moved down by the `added` rows inserted there. */
const shifted = (active, /** @type {number} */ from, /** @type {number} */ added) => ({ ...active, le: active.le.map((/** @type {number} */ r) => (r >= from ? r + added : r)) });

/** One stage: solve, add the limits after a loss the dispatch breaks past α, solve again, until none. */
function tighten(context, stage, warm) {
  const { model, qp, factors, maxPasses, maxRounds } = context;
  const n = model.columns.bus.length;
  let [result, passes, left] = [qp.solve(marginProgram(model, stage), { warm, maxRounds }), 1, 0];
  while (result.status === "optimal") {
    const overloads = n1Overloads(model.grid, flowsOf(model, result.x), factors, { tolerance: result.x[n] - 1 + TOLERANCE });
    left = overloads.length;
    if (left === 0 || passes >= maxPasses) break;
    const before = model.rows.length;
    model.rows.push(...overloads.map((overload) => securityRow(model, factors, overload)));
    result = qp.solve(marginProgram(model, stage), { warm: shifted(result.active, before, overloads.length), maxRounds });
    passes += 1;
  }
  return { result, passes, left };
}

/**
 * The dispatch past the N-1 limit, at a load factor: a `Dispatch` (src/opf/dispatch.js) and its `margin`, the worst
 * loading after a single loss (1: the rule holds). Its prices are those of the last stage, α held. The first stage is
 * a linear programme, which `qp` solves by proximal rounds: 200, its default, left 8 hours of RTS-GMLC's year
 * unconverged under the N-1 list (17/11), 1 000 none.
 */
export function solveMargin(/** @type {Grid} */ grid, { loadFactor = 1, maxPasses = 50, maxRounds = 1000 } = {}) {
  const { model, cap, failed } = startOf(grid, loadFactor);
  if (failed) return { ...outcomeOf(model, failed, { passes: 1, left: null }), margin: NaN };
  const context = { model, qp: createQp(model.columns.bus.length + 1), factors: lodf(grid, model.transfer), maxPasses, maxRounds };
  const least = tighten(context, { objective: "margin", cap, alphaCap: Infinity }, undefined);
  if (least.result.status !== "optimal") return { ...outcomeOf(model, least.result, least), margin: NaN };
  const margin = least.result.x[model.columns.bus.length];
  const alphaCap = margin * (1 + SHED_SLACK) + SHED_SLACK;
  const cheapest = tighten(context, { objective: "cost", cap, alphaCap }, least.result.active);
  return { ...outcomeOf(model, cheapest.result, { passes: least.passes + cheapest.passes, left: cheapest.left }), margin };
}
