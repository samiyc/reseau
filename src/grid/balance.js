/**
 * How each island balances around the setpoints of the dispatch (docs/modele.md § 4). The dispatch sets each
 * generator's output and the load shed on the grid as the file has it. When branches are lost, each island closes its
 * own gap: short of power, its generators rise by the same share of their headroom (up to Pmax) and it sheds the
 * rest, in proportion to its loads; with power to spare, they fall by the same share of their output. A hypothesis,
 * like droop control shared by headroom, and the J2 rule exactly when the setpoints are in proportion to Pmax
 * (src/grid/supply.js): each generator then ends at the island's demand over its capacity, times its Pmax.
 */

import { findIslands } from "../flow/islands.js";

/** @typedef {import("../types.js").Grid} Grid */

/**
 * The setpoints of a dispatch: each generator's output and the load shed at each bus, in MW, and what the page shows
 * of it: its cost, its nodal prices (null when load is shed), whether it holds the N-1 rule, and its worst loading
 * after a single loss (1 when it holds the rule; null when not computed, under the "cost" dispatch).
 * @typedef {{ generation: Float64Array, shed: Float64Array, cost: number, prices: Float64Array | null, secure: boolean, margin: number | null }} Setpoints
 */

/** Each island's demand (served by the dispatch), production, capacity, and its whole demand (shed included). */
function islandTotals(/** @type {Grid} */ grid, islands, /** @type {number} */ factor, /** @type {Setpoints} */ setpoints) {
  const totals = ["served", "whole", "production", "capacity"].map(() => new Float64Array(islands.count));
  const [served, whole, production, capacity] = totals;
  for (let i = 0; i < grid.busCount; i += 1) {
    const demand = factor * grid.load[i] + grid.shunt[i];
    whole[islands.of[i]] += demand;
    served[islands.of[i]] += demand - setpoints.shed[i];
  }
  for (let g = 0; g < grid.genCount; g += 1) {
    if (!grid.genOn[g]) continue;
    production[islands.of[grid.genBus[g]]] += setpoints.generation[g];
    capacity[islands.of[grid.genBus[g]]] += grid.pmax[g];
  }
  return { served, whole, production, capacity };
}

/** How an island moves: the share of headroom its generators take up, of output they give back, of load it serves. */
function movesOf(/** @type {number} */ served, /** @type {number} */ production, /** @type {number} */ capacity) {
  if (served >= production) {
    const headroom = capacity - production;
    return { up: headroom > 0 ? Math.min(1, (served - production) / headroom) : 0, down: 0, kept: served > capacity ? capacity / served : 1 };
  }
  return { up: 0, down: (production - served) / production, kept: 1 };
}

/**
 * The injections of a grid under `inService` at load factor `factor`, around `setpoints`, every island balanced;
 * each generator's output; and for each island its reference bus, demand, production, capacity and the load it sheds
 * (the dispatch's and its own). The shape of src/grid/supply.js's `islandSupply`.
 */
export function balanceIslands(/** @type {Grid} */ grid, /** @type {Uint8Array} */ inService, /** @type {number} */ factor, /** @type {Setpoints} */ setpoints) {
  const islands = findIslands(grid, inService);
  const totals = islandTotals(grid, islands, factor, setpoints);
  const moves = Array.from(totals.served, (served, n) => movesOf(served, totals.production[n], totals.capacity[n]));
  const injection = Float64Array.from(grid.load, (load, i) => -(factor * load + grid.shunt[i] - setpoints.shed[i]) * moves[islands.of[i]].kept);
  const generation = new Float64Array(grid.genCount);
  for (let g = 0; g < grid.genCount; g += 1) {
    if (!grid.genOn[g]) continue;
    const { up, down } = moves[islands.of[grid.genBus[g]]];
    const p = setpoints.generation[g];
    generation[g] = p + up * (grid.pmax[g] - p) - down * p;
    injection[grid.genBus[g]] += generation[g];
  }
  const parts = Array.from(islands.reference, (bus, n) => {
    const served = totals.served[n] * moves[n].kept;
    return { bus, demand: totals.whole[n], production: served, capacity: totals.capacity[n], shed: totals.whole[n] - served };
  });
  return { islands, injection, generation, parts, shed: parts.reduce((sum, part) => sum + part.shed, 0) };
}
