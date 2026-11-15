/**
 * The experiment of J2 (docs/recherche/pistes.md, P3): at each load factor, every single loss of a branch and pairs
 * of losses drawn by seed, each run to the end of its cascade; the size of the blackouts, in share of the demand
 * shed, as Dobson, Carreras and Newman measure it (2005).
 */

import { createRng } from "mcts-commun/random.js";
import { wilson } from "mcts-commun/measure.js";
import { describeState, setpointsFor } from "../grid/state.js";
import { runCascade } from "./cascade.js";

/** @typedef {import("../types.js").Grid} Grid */

/** The initial events: each branch in service alone, then `pairs` distinct pairs drawn from `seed`. */
export function initialEvents(/** @type {Grid} */ grid, { pairs = 0, seed = 1 } = {}) {
  const live = [...grid.inService.keys()].filter((k) => grid.inService[k]);
  const events = live.map((k) => [k]);
  const rng = createRng(seed);
  const seen = new Set();
  for (let tries = 0; seen.size < pairs && tries < 100 * pairs; tries += 1) {
    const [a, b] = [live[rng.int(live.length)], live[rng.int(live.length)]];
    const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
    if (a === b || seen.has(key)) continue;
    seen.add(key);
    events.push([Math.min(a, b), Math.max(a, b)]);
  }
  return events;
}

/** The value at quantile `q` of sorted values. */
const quantile = (/** @type {number[]} */ sorted, /** @type {number} */ q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

/** The summary of a set of cascades' shed shares and lines lost. */
export function summarize(/** @type {number[]} */ shares, /** @type {number[]} */ lost) {
  const n = shares.length;
  const mean = shares.reduce((a, b) => a + b, 0) / n;
  const spread = Math.sqrt(shares.reduce((sum, s) => sum + (s - mean) ** 2, 0) / Math.max(1, n - 1));
  const sorted = [...shares].sort((a, b) => a - b);
  const over = (/** @type {number} */ level) => wilson(shares.filter((s) => s > level).length, n);
  return {
    n,
    mean,
    margin: (1.96 * spread) / Math.sqrt(n),
    p50: quantile(sorted, 0.5),
    p90: quantile(sorted, 0.9),
    max: sorted[n - 1],
    anyLoss: over(1e-9),
    over10: over(0.1),
    over50: over(0.5),
    lost: lost.reduce((a, b) => a + b, 0) / n,
  };
}

/** Whether some branch is past its limit with `out` lost (none lost for an empty list), under J2's dispatch. */
function overloadedWithout(/** @type {Grid} */ grid, /** @type {number} */ loadFactor, /** @type {number[]} */ out) {
  const inService = Uint8Array.from(grid.inService, (on, k) => (out.includes(k) ? 0 : on));
  return describeState(grid, { loadFactor, inService, dispatch: "pmax" }).overloaded.length > 0;
}

/**
 * The security limits of the grid under J2's dispatch (src/grid/supply.js; J3's are src/opf/loadability.js), by steps of `step` from `from`: the first
 * load factor at which the intact grid has a branch past its limit (N-0), and the first at which the loss of one
 * branch puts another past its limit (N-1), with that branch. Null when not reached by `to`.
 */
export function securityLimits(/** @type {Grid} */ grid, { from = 0.5, to = 1.6, step = 0.01 } = {}) {
  const live = [...grid.inService.keys()].filter((k) => grid.inService[k]);
  const factors = Array.from({ length: Math.floor((to - from) / step + 1e-9) + 1 }, (_, i) => Math.round((from + i * step) * 1e6) / 1e6);
  const n0 = factors.find((factor) => overloadedWithout(grid, factor, [])) ?? null;
  const n1Factor = factors.find((factor) => (n0 !== null && factor >= n0) || live.some((k) => overloadedWithout(grid, factor, [k])));
  if (n1Factor === undefined) return { n0, n1: null };
  return { n0, n1: { factor: n1Factor, branch: live.find((k) => overloadedWithout(grid, n1Factor, [k])) ?? -1 } };
}

/** What the dispatch itself sheds, in MW, before any loss, and whether it holds the N-1 rule. */
function dispatchOf(/** @type {import("../grid/balance.js").Setpoints | null} */ setpoints) {
  if (!setpoints) return { dispatched: 0, secure: false };
  return { dispatched: setpoints.shed.reduce((sum, v) => sum + v, 0), secure: setpoints.secure };
}

/**
 * Every event at one load factor, each run to the end of its cascade, under `dispatch` ("secure" or "cost", solved
 * once for all the events, or J2's "pmax"): the share of the demand each one sheds, the lines each one trips, how
 * many did not settle within `maxSteps`, and the dispatch.
 */
export function cascadeSizes(/** @type {Grid} */ grid, /** @type {number} */ loadFactor, /** @type {number[][]} */ events, { dispatch = "secure", maxSteps = 50 } = {}) {
  const setpoints = setpointsFor(grid, { loadFactor, dispatch });
  const shares = [];
  const lost = [];
  let unsettled = 0;
  for (const event of events) {
    const inService = Uint8Array.from(grid.inService, (on, k) => (event.includes(k) ? 0 : on));
    const result = runCascade(grid, { loadFactor, inService, dispatch, setpoints }, { maxSteps });
    shares.push(result.shedShare);
    lost.push(result.lost);
    if (!result.settled) unsettled += 1;
  }
  return { shares, lost, unsettled, setpoints };
}

/**
 * Every event at one load factor (`cascadeSizes`): the summary, how many cascades did not settle, the MW the dispatch
 * itself sheds before any loss, and whether it holds the N-1 rule.
 */
export function sweepFactor(/** @type {Grid} */ grid, /** @type {number} */ loadFactor, /** @type {number[][]} */ events, options = {}) {
  const { shares, lost, unsettled, setpoints } = cascadeSizes(grid, loadFactor, events, options);
  return { loadFactor, ...summarize(shares, lost), unsettled, ...dispatchOf(setpoints) };
}
