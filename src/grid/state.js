/**
 * The state of the grid (docs/modele.md § 4): the file's consumption times a load factor, the generators set by a
 * dispatch, each island balanced around it; then its flows and the loading of each branch. What the page draws, what
 * a cut line changes, and what the cascade steps through.
 *
 * Three dispatches. "secure", the model's (Sami, 14/11): the cheapest that holds the N-1 rule while one exists, the
 * cheapest past that. "cost": the cheapest on the grid as the file has it (the DC-OPF, shedding the least load when it
 * must: src/opf/dispatch.js). Under both, each island is then balanced around it (src/grid/balance.js). "pmax", J2's:
 * every generator of an island at the same share of its Pmax (src/grid/supply.js).
 */

import { solveFlows } from "../flow/dcflow.js";
import { solveDispatch } from "../opf/dispatch.js";
import { balanceIslands } from "./balance.js";
import { islandSupply } from "./supply.js";

/** @typedef {import("./balance.js").Setpoints} Setpoints */

/** @typedef {import("../types.js").Grid} Grid */

/**
 * The file's own injection at each bus, in MW, for the tests of the power flow: the generators' f · Pg (within Pmax),
 * less the load times f, less the shunts; the reference bus of the DC power flow takes on the difference, without
 * limit. Not a state of the model: PGLib's Pg are a flat start, not a dispatch.
 */
export function baseInjection(/** @type {Grid} */ grid, loadFactor = 1) {
  const injection = Float64Array.from(grid.load, (load, i) => -(loadFactor * load + grid.shunt[i]));
  for (let g = 0; g < grid.genCount; g += 1) {
    if (grid.genOn[g]) injection[grid.genBus[g]] += Math.min(grid.pmax[g], loadFactor * grid.pg[g]);
  }
  return injection;
}

/** |flow| / limit for each branch (0 without a limit). */
export function loadingOf(/** @type {Grid} */ grid, /** @type {Float64Array} */ flow) {
  return Float64Array.from(flow, (f, k) => (grid.rate[k] > 0 ? Math.abs(f) / grid.rate[k] : 0));
}

/**
 * Past this loading, a branch is overloaded. Grid2Op compares strictly with 1; the margin keeps a branch the dispatch
 * holds exactly at its limit (1 + 10⁻¹², by rounding) from counting as overloaded.
 */
export const OVERLOAD = 1 + 1e-6;

/** The branches in service past their limit. */
export function overloadedOf(/** @type {Float64Array} */ loading, /** @type {Uint8Array} */ inService) {
  const overloaded = [];
  for (let k = 0; k < loading.length; k += 1) if (inService[k] && loading[k] > OVERLOAD) overloaded.push(k);
  return overloaded;
}

/** The setpoints of a dispatch, and whether it holds the N-1 rule. */
function setpointsFrom(/** @type {import("../opf/dispatch.js").Dispatch} */ dispatch, /** @type {boolean} */ secure) {
  return /** @type {Setpoints} */ ({ generation: dispatch.generation, shed: dispatch.shed, cost: dispatch.cost, prices: dispatch.prices, secure });
}

/**
 * The setpoints of the grid as its file has it, at a load factor: with `security`, the cheapest dispatch that holds
 * the N-1 rule, if one does; otherwise the cheapest, shedding the least load when it must.
 */
export function setpointsOf(/** @type {Grid} */ grid, loadFactor = 1, { security = true } = {}) {
  if (security) {
    const secure = solveDispatch(grid, { loadFactor, security: true });
    if (secure.status === "optimal" && secure.left === 0) return setpointsFrom(secure, true);
  }
  const dispatch = solveDispatch(grid, { loadFactor, shedding: true });
  if (dispatch.status !== "optimal") throw new Error(`aucune répartition à ${loadFactor} fois la charge : ${dispatch.status}`);
  return setpointsFrom(dispatch, false);
}

/**
 * The setpoints a state or a cascade runs on: none under J2's "pmax" dispatch; under "secure" or "cost", those given,
 * or the dispatch solved now.
 * @param {Grid} grid
 * @param {{ loadFactor?: number, dispatch?: string, setpoints?: Setpoints | null }} options
 */
export function setpointsFor(grid, { loadFactor = 1, dispatch = "secure", setpoints = null }) {
  if (dispatch === "pmax") return null;
  return setpoints ?? setpointsOf(grid, loadFactor, { security: dispatch === "secure" });
}

/**
 * The state under a load factor and a set of branches in service: each generator's output, the flows, the loadings,
 * the overloaded branches, the MW shed, and for each island its reference bus, demand, production, capacity, shed.
 * Under the "secure" or "cost" dispatch, `setpoints` spares solving it again (a cascade solves it once), and the state keeps them.
 */
export function describeState(/** @type {Grid} */ grid, options = {}) {
  const { loadFactor = 1, inService = grid.inService } = options;
  const set = setpointsFor(grid, options);
  const supply = set ? balanceIslands(grid, inService, loadFactor, set) : islandSupply(grid, inService, loadFactor);
  const flows = solveFlows(grid, supply.injection, inService);
  const loading = loadingOf(grid, flows.flow);
  return { injection: supply.injection, generation: supply.generation, flows, loading, overloaded: overloadedOf(loading, inService), islands: supply.parts, shed: supply.shed, setpoints: set };
}
