/**
 * The DC power flow (docs/modele.md § 2): from the net injections at each bus and the branches in service, the angles,
 * the flows, and what each island's reference bus takes on to balance its island. MATPOWER's `makeBdc` relations:
 * P = Bbus·θ + Pshift, F = b·(θf − θt − φ).
 */

import { findIslands } from "./islands.js";
import { factor, solveInto } from "./lu.js";

/** @typedef {import("../types.js").Grid} Grid */
/** @typedef {import("../types.js").Flows} Flows */
/** @typedef {import("../types.js").Islands} Islands */

/** The position of each bus among the unknowns, −1 for the islands' reference buses. */
export function unknowns(/** @type {Grid} */ grid, /** @type {Islands} */ islands) {
  const index = new Int32Array(grid.busCount).fill(-1);
  const isReference = new Uint8Array(grid.busCount);
  for (const r of islands.reference) isReference[r] = 1;
  let size = 0;
  for (let i = 0; i < grid.busCount; i += 1) if (!isReference[i]) index[i] = size++;
  return { index, size };
}

function addEntry(/** @type {Float64Array} */ matrix, /** @type {number} */ size, /** @type {[number, number]} */ [r, c], /** @type {number} */ value) {
  if (r >= 0 && c >= 0) matrix[r * size + c] += value;
}

/** Bbus restricted to the unknowns, and the right-hand side P − Pshift, both in p.u. */
export function system(/** @type {Grid} */ grid, /** @type {Float64Array} */ injection, /** @type {Uint8Array} */ inService, /** @type {{ index: Int32Array, size: number }} */ { index, size }) {
  const matrix = new Float64Array(size * size);
  const rhs = new Float64Array(size);
  for (let i = 0; i < grid.busCount; i += 1) if (index[i] >= 0) rhs[index[i]] = injection[i] / grid.baseMVA;
  for (let k = 0; k < grid.branchCount; k += 1) {
    if (!inService[k]) continue;
    const [f, t, b] = [index[grid.from[k]], index[grid.to[k]], grid.susceptance[k]];
    addEntry(matrix, size, [f, f], b);
    addEntry(matrix, size, [t, t], b);
    addEntry(matrix, size, [f, t], -b);
    addEntry(matrix, size, [t, f], -b);
    if (f >= 0) rhs[f] += b * grid.shift[k];
    if (t >= 0) rhs[t] -= b * grid.shift[k];
  }
  return { matrix, rhs };
}

/** Each branch's flow, in MW, from the angles. */
export function branchFlows(/** @type {Grid} */ grid, /** @type {Float64Array} */ theta, /** @type {Uint8Array} */ inService, /** @type {Float64Array} */ out = new Float64Array(grid.branchCount)) {
  for (let k = 0; k < grid.branchCount; k += 1) {
    const angle = theta[grid.from[k]] - theta[grid.to[k]] - grid.shift[k];
    out[k] = inService[k] ? grid.baseMVA * grid.susceptance[k] * angle : 0;
  }
  return out;
}

/** What each bus sends out on its branches, in MW: its actual net injection. */
export function netOutflow(/** @type {Grid} */ grid, /** @type {Float64Array} */ flow) {
  const out = new Float64Array(grid.busCount);
  for (let k = 0; k < grid.branchCount; k += 1) {
    out[grid.from[k]] += flow[k];
    out[grid.to[k]] -= flow[k];
  }
  return out;
}

/** The DC power flow of `injection` (MW a bus, production minus consumption) under `inService` (a flag a branch). */
export function solveFlows(/** @type {Grid} */ grid, /** @type {Float64Array} */ injection, /** @type {Uint8Array} */ inService = grid.inService) {
  const islands = findIslands(grid, inService);
  const places = unknowns(grid, islands);
  const { matrix, rhs } = system(grid, injection, inService, places);
  if (places.size > 0) solveInto(factor(matrix, places.size), rhs, rhs);
  const theta = new Float64Array(grid.busCount);
  for (let i = 0; i < grid.busCount; i += 1) if (places.index[i] >= 0) theta[i] = rhs[places.index[i]];
  const flow = branchFlows(grid, theta, inService);
  const outflow = netOutflow(grid, flow);
  const balance = Float64Array.from(islands.reference, (r) => outflow[r] - injection[r]);
  return { islands, theta, flow, balance };
}
