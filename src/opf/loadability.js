/**
 * How far the load can grow (docs/mesures/opf-j3.md): the largest load factor at which a dispatch exists, without and
 * with the N-1 rule, by bisection. Feasibility shrinks as the load grows when every Pmin is 0, as on PGLib's IEEE
 * grids: a dispatch for a load scales down with it, and so do its flows, all limits being symmetric (the shunts,
 * which the factor does not scale, are the one exception; they are small).
 */

import { solveDispatch } from "./dispatch.js";

/** @typedef {import("../types.js").Grid} Grid */

/**
 * The largest load factor in [from, to] at which `solveDispatch` finds a dispatch, to `step` (0 when none at `from`,
 * `to` when one exists there), and the number of solves.
 */
export function maxLoad(/** @type {Grid} */ grid, { security = false, from = 0.05, to = 3, step = 1e-3 } = {}) {
  const feasible = (/** @type {number} */ loadFactor) => solveDispatch(grid, { loadFactor, security }).status === "optimal";
  if (!feasible(from)) return { factor: 0, solves: 1 };
  if (feasible(to)) return { factor: to, solves: 2 };
  return bisect(feasible, [from, to], step);
}

/** The last feasible point of [low, high], feasible at low and not at high, to `step`. */
function bisect(/** @type {(x: number) => boolean} */ feasible, /** @type {number[]} */ [low, high], /** @type {number} */ step) {
  let solves = 2;
  while (high - low > step) {
    const middle = (low + high) / 2;
    if (feasible(middle)) low = middle;
    else high = middle;
    solves += 1;
  }
  return { factor: low, solves };
}
