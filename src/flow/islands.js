/**
 * The islands of a grid: the connected parts under the branches in service, each with its reference bus (the file's
 * if it is there, else the bus with the most capacity installed, else the island's first bus; docs/modele.md § 2).
 */

/** @typedef {import("../types.js").Grid} Grid */
/** @typedef {import("../types.js").Islands} Islands */

function root(/** @type {Int32Array} */ parent, /** @type {number} */ i) {
  let r = i;
  while (parent[r] !== r) r = parent[r];
  while (parent[i] !== r) [i, parent[i]] = [parent[i], r];
  return r;
}

/** The capacity installed at each bus, generators in service only. */
export function capacityByBus(/** @type {Grid} */ grid) {
  const capacity = new Float64Array(grid.busCount);
  for (let g = 0; g < grid.genCount; g += 1) if (grid.genOn[g]) capacity[grid.genBus[g]] += grid.pmax[g];
  return capacity;
}

function numbered(/** @type {Int32Array} */ parent) {
  const of = new Int32Array(parent.length);
  const numberOf = new Map();
  for (let i = 0; i < parent.length; i += 1) {
    const r = root(parent, i);
    if (!numberOf.has(r)) numberOf.set(r, numberOf.size);
    of[i] = numberOf.get(r);
  }
  return { count: numberOf.size, of };
}

function references(/** @type {Grid} */ grid, /** @type {{ count: number, of: Int32Array }} */ parts) {
  const capacity = capacityByBus(grid);
  const reference = new Int32Array(parts.count).fill(-1);
  for (let i = 0; i < grid.busCount; i += 1) {
    const island = parts.of[i];
    const held = reference[island];
    if (held === -1 || (held !== grid.reference && (i === grid.reference || capacity[i] > capacity[held]))) reference[island] = i;
  }
  return reference;
}

/** The islands under `inService` (one flag a branch). */
export function findIslands(/** @type {Grid} */ grid, /** @type {Uint8Array} */ inService) {
  const parent = Int32Array.from({ length: grid.busCount }, (_, i) => i);
  for (let k = 0; k < grid.branchCount; k += 1) {
    if (inService[k]) parent[root(parent, grid.from[k])] = root(parent, grid.to[k]);
  }
  const parts = numbered(parent);
  return { ...parts, reference: references(grid, parts) };
}
