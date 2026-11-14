/**
 * The state of the grid (docs/modele.md § 4): the file's consumption times a load factor, the generators of each
 * island sharing it in proportion to their Pmax, the rest shed (src/grid/supply.js); then its flows and the loading
 * of each branch. What the page draws, what a cut line changes, and what the cascade steps through.
 */

import { solveFlows } from "../flow/dcflow.js";
import { islandSupply } from "./supply.js";

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

/** The branches in service past their limit. */
export function overloadedOf(/** @type {Float64Array} */ loading, /** @type {Uint8Array} */ inService) {
  const overloaded = [];
  for (let k = 0; k < loading.length; k += 1) if (inService[k] && loading[k] > 1) overloaded.push(k);
  return overloaded;
}

/**
 * The state under a load factor and a set of branches in service: each generator's output, the flows, the loadings,
 * the overloaded branches, the MW shed, and for each island its reference bus, demand, production, capacity, shed.
 */
export function describeState(/** @type {Grid} */ grid, { loadFactor = 1, inService = grid.inService } = {}) {
  const supply = islandSupply(grid, inService, loadFactor);
  const flows = solveFlows(grid, supply.injection, inService);
  const loading = loadingOf(grid, flows.flow);
  return { injection: supply.injection, generation: supply.generation, flows, loading, overloaded: overloadedOf(loading, inService), islands: supply.parts, shed: supply.shed };
}
