/**
 * The base state of J1 (docs/modele.md § 4): the file's productions, its consumption times a load factor, the
 * reference bus of each island taking on the difference; then its flows, the loading of each branch, and what each
 * island asks of its reference bus. What the page draws, and what a cut line changes.
 */

import { solveFlows } from "../flow/dcflow.js";
import { capacityByBus } from "../flow/islands.js";

/** @typedef {import("../types.js").Grid} Grid */

/** The net injection at each bus, in MW: the generators' Pg, less the load times `loadFactor`, less the shunts. */
export function baseInjection(/** @type {Grid} */ grid, loadFactor = 1) {
  const injection = Float64Array.from(grid.load, (load, i) => -(loadFactor * load + grid.shunt[i]));
  for (let g = 0; g < grid.genCount; g += 1) if (grid.genOn[g]) injection[grid.genBus[g]] += grid.pg[g];
  return injection;
}

/** |flow| / limit for each branch (0 without a limit). */
export function loadingOf(/** @type {Grid} */ grid, /** @type {Float64Array} */ flow) {
  return Float64Array.from(flow, (f, k) => (grid.rate[k] > 0 ? Math.abs(f) / grid.rate[k] : 0));
}

/** What the generators at a bus produce in the file. */
function producedAt(/** @type {Grid} */ grid, /** @type {number} */ bus) {
  let total = 0;
  for (let g = 0; g < grid.genCount; g += 1) if (grid.genOn[g] && grid.genBus[g] === bus) total += grid.pg[g];
  return total;
}

/**
 * The state under a load factor and a set of branches in service: flows, loadings, the overloaded branches, and for
 * each island its reference bus, what its generators must produce, and the capacity they have.
 */
export function describeState(/** @type {Grid} */ grid, { loadFactor = 1, inService = grid.inService } = {}) {
  const injection = baseInjection(grid, loadFactor);
  const flows = solveFlows(grid, injection, inService);
  const loading = loadingOf(grid, flows.flow);
  const capacity = capacityByBus(grid);
  const islands = Array.from(flows.islands.reference, (bus, island) => {
    const production = producedAt(grid, bus) + flows.balance[island];
    return { bus, production, capacity: capacity[bus], short: production > capacity[bus] + 1e-9 || production < -1e-9 };
  });
  const overloaded = [];
  for (let k = 0; k < grid.branchCount; k += 1) if (loading[k] > 1) overloaded.push(k);
  return { injection, flows, loading, overloaded, islands };
}
