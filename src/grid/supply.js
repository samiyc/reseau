/**
 * How each island is supplied (docs/modele.md § 4), until the dispatch of J3: every generator in service produces the
 * same share of its Pmax, the share that meets the island's demand (load times the load factor, plus the shunts).
 * An island whose demand passes its capacity runs every generator at Pmax and sheds the rest of its load, in
 * proportion; an island without a generator sheds all of it. A hypothesis of the model: neutral, it ignores costs,
 * and it puts no line past its limit on the three PGLib grids at their base load (docs/mesures/cascade-j2.md).
 */

import { findIslands } from "../flow/islands.js";

/** @typedef {import("../types.js").Grid} Grid */

/** What each island asks for, and what its generators can give. */
function islandTotals(/** @type {Grid} */ grid, islands, /** @type {number} */ factor) {
  const demand = new Float64Array(islands.count);
  const capacity = new Float64Array(islands.count);
  for (let i = 0; i < grid.busCount; i += 1) demand[islands.of[i]] += factor * grid.load[i] + grid.shunt[i];
  for (let g = 0; g < grid.genCount; g += 1) if (grid.genOn[g]) capacity[islands.of[grid.genBus[g]]] += grid.pmax[g];
  return { demand, capacity };
}

/**
 * The injections of a grid under `inService` at load factor `factor`, every island balanced; each generator's
 * output; and for each island its reference bus, its demand, production, capacity and the load it sheds.
 */
export function islandSupply(/** @type {Grid} */ grid, /** @type {Uint8Array} */ inService, factor = 1) {
  const islands = findIslands(grid, inService);
  const { demand, capacity } = islandTotals(grid, islands, factor);
  const share = Float64Array.from(demand, (d, n) => (capacity[n] > 0 ? Math.min(1, d / capacity[n]) : 0));
  const served = Float64Array.from(demand, (d, n) => (d > 0 ? Math.min(1, capacity[n] / d) : 1));
  const injection = Float64Array.from(grid.load, (load, i) => -(factor * load + grid.shunt[i]) * served[islands.of[i]]);
  const generation = new Float64Array(grid.genCount);
  for (let g = 0; g < grid.genCount; g += 1) {
    if (!grid.genOn[g]) continue;
    generation[g] = grid.pmax[g] * share[islands.of[grid.genBus[g]]];
    injection[grid.genBus[g]] += generation[g];
  }
  const parts = Array.from(islands.reference, (bus, n) => ({
    bus,
    demand: demand[n],
    production: Math.min(demand[n], capacity[n]),
    capacity: capacity[n],
    shed: Math.max(0, demand[n] - capacity[n]),
  }));
  return { islands, injection, generation, parts, shed: parts.reduce((sum, part) => sum + part.shed, 0) };
}
