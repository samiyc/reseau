/**
 * The N-1 rule (docs/modele.md § 5): the grid holds whichever single branch is lost. Checked by the LODF, all the
 * losses at once; enforced in the dispatch by adding, pass after pass, the limits after a loss that the last dispatch
 * broke (a preventive SCOPF, its constraints added as they are violated).
 *
 * A bridge is not a contingency here: its loss splits the grid, and no dispatch keeps the far side supplied by it.
 * After a loss, a branch keeps its rating RATE_A (PGLib's RATE_B and RATE_C are the same) and loses its angle limits:
 * a hypothesis, the usual practice of a DC SCOPF.
 */

import { isBridge } from "../flow/sensitivity.js";

/** @typedef {import("../types.js").Grid} Grid */
/** @typedef {import("./problem.js").LimitRow} LimitRow */

/**
 * A branch past its rating after a loss.
 * @typedef {{ outage: number, branch: number, flow: number, loading: number }} Overload
 */

/** The contingencies of the rule: the branches in service whose loss does not split the grid. */
export function contingencies(/** @type {Grid} */ grid, /** @type {Float64Array} */ factors) {
  const out = [];
  for (let k = 0; k < grid.branchCount; k += 1) if (grid.inService[k] && !isBridge(factors, grid.branchCount, k)) out.push(k);
  return Int32Array.from(out);
}

/** The branches past their rating once `outage` is lost, into `out`. */
function overloadsAfter(/** @type {{ grid: Grid, flow: Float64Array, factors: Float64Array, tolerance: number }} */ state, /** @type {number} */ outage, /** @type {Overload[]} */ out) {
  const { grid, flow, factors, tolerance } = state;
  const m = grid.branchCount;
  for (let l = 0; l < m; l += 1) {
    if (l === outage || !grid.inService[l] || grid.rate[l] <= 0) continue;
    const after = flow[l] + factors[l * m + outage] * flow[outage];
    const loading = Math.abs(after) / grid.rate[l];
    if (loading > 1 + tolerance) out.push({ outage, branch: l, flow: after, loading });
  }
}

/** Every overload after a single loss, for the flows of a state; none: the state is N-1 secure. */
export function n1Overloads(/** @type {Grid} */ grid, /** @type {Float64Array} */ flow, /** @type {Float64Array} */ factors, { tolerance = 1e-6 } = {}) {
  /** @type {Overload[]} */
  const out = [];
  for (const outage of contingencies(grid, factors)) overloadsAfter({ grid, flow, factors, tolerance }, outage, out);
  return out;
}

/**
 * The row that keeps an overloaded branch within its rating after its outage, on the side it broke:
 * F(l) + LODF(l, c) · F(c), with F = PTDF · P + offset.
 */
export function securityRow(/** @type {import("./problem.js").DispatchModel} */ model, /** @type {Float64Array} */ factors, /** @type {Overload} */ overload) {
  const { grid, transfer, offset } = model;
  const { branch: l, outage: c } = overload;
  const n = grid.busCount;
  const share = factors[l * grid.branchCount + c];
  const side = overload.flow > 0 ? 1 : -1;
  const bus = Float64Array.from({ length: n }, (_, i) => side * (transfer[l * n + i] + share * transfer[c * n + i]));
  return /** @type {LimitRow} */ ({ branch: l, outage: c, side, bus, offset: side * (offset[l] + share * offset[c]), limit: grid.rate[l] });
}

/**
 * The worst loading after a single loss, for the flows of a state: the highest |F(l) + LODF(l, c) · F(c)| / rate over
 * the contingencies c and the branches l in service (0 without any). At most 1: the state is N-1 secure.
 */
export function worstAfterLoss(/** @type {Grid} */ grid, /** @type {Float64Array} */ flow, /** @type {Float64Array} */ factors) {
  const m = grid.branchCount;
  let worst = 0;
  for (const c of contingencies(grid, factors)) {
    for (let l = 0; l < m; l += 1) {
      if (l !== c && grid.inService[l] && grid.rate[l] > 0) worst = Math.max(worst, Math.abs(flow[l] + factors[l * m + c] * flow[c]) / grid.rate[l]);
    }
  }
  return worst;
}
