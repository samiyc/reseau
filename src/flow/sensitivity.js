/**
 * The sensitivities of the DC model (docs/modele.md § 3), for the grid as its file has it (one island, the file's
 * reference bus): the PTDF, a branch's flow per MW injected at a bus, and the LODF, the share of a lost branch's flow
 * that each other branch takes on. MATPOWER's `makePTDF` and `makeLODF`.
 */

import { system, unknowns } from "./dcflow.js";
import { findIslands } from "./islands.js";
import { factor, solveInto } from "./lu.js";

/** @typedef {import("../types.js").Grid} Grid */

/** Below this, 1 − h(k) is zero: the branch is a bridge, and its loss splits the grid. */
const BRIDGE = 1e-9;

/** The angles of every bus, in p.u., for 1 p.u. injected at bus `n` and taken at the reference. */
function anglesFor(/** @type {import("./lu.js").Factor} */ lu, /** @type {Int32Array} */ index, /** @type {number} */ n) {
  const column = new Float64Array(lu.n);
  column[index[n]] = 1;
  solveInto(lu, column, column);
  return Float64Array.from(index, (at) => (at >= 0 ? column[at] : 0));
}

/** The PTDF, branches × buses, row-major: `ptdf[k * busCount + n]`. Throws if the grid is not in one piece. */
export function ptdf(/** @type {Grid} */ grid) {
  const { inService, busCount, branchCount } = grid;
  const islands = findIslands(grid, inService);
  if (islands.count !== 1) throw new Error(`le réseau a ${islands.count} îlots : la PTDF en demande un`);
  const places = unknowns(grid, islands);
  const lu = factor(system(grid, new Float64Array(busCount), inService, places).matrix, places.size);
  const out = new Float64Array(branchCount * busCount);
  for (let n = 0; n < busCount; n += 1) {
    if (places.index[n] < 0) continue;
    const theta = anglesFor(lu, places.index, n);
    for (let k = 0; k < branchCount; k += 1) {
      out[k * busCount + n] = inService[k] ? grid.susceptance[k] * (theta[grid.from[k]] - theta[grid.to[k]]) : 0;
    }
  }
  return out;
}

/** The LODF, branches × branches, row-major: `lodf[l * branchCount + k]`; a bridge's column is NaN. */
export function lodf(/** @type {Grid} */ grid, /** @type {Float64Array} */ transfer = ptdf(grid)) {
  const { busCount, branchCount: m } = grid;
  const out = new Float64Array(m * m);
  for (let k = 0; k < m; k += 1) {
    if (!grid.inService[k]) continue;
    const [f, t] = [grid.from[k], grid.to[k]];
    const denominator = 1 - (transfer[k * busCount + f] - transfer[k * busCount + t]);
    const bridge = Math.abs(denominator) < BRIDGE;
    for (let l = 0; l < m; l += 1) {
      const h = transfer[l * busCount + f] - transfer[l * busCount + t];
      out[l * m + k] = bridge ? Number.NaN : h / denominator;
    }
    if (!bridge) out[k * m + k] = -1;
  }
  return out;
}

/** The flows after branch `k` is lost, from those before it, into `out`: F + LODF(·, k)·F(k). */
export function afterOutage(/** @type {Float64Array} */ flow, /** @type {Float64Array} */ factors, /** @type {number} */ k, /** @type {Float64Array} */ out = new Float64Array(flow.length)) {
  const m = flow.length;
  for (let l = 0; l < m; l += 1) out[l] = flow[l] + factors[l * m + k] * flow[k];
  return out;
}

/** Whether branch `k` is a bridge, by its LODF column. */
export const isBridge = (/** @type {Float64Array} */ factors, /** @type {number} */ m, /** @type {number} */ k) => Number.isNaN(factors[k]) || Number.isNaN(factors[k * m + k]);
