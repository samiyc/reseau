/**
 * The tail of the blackout sizes (docs/recherche/pistes.md, P3): their probability density on logarithmic classes,
 * and the slope of that density on a log-log plot, the exponent Dobson, Carreras and Newman compare with the North
 * American blackouts (about −1.1 for the load shed, 2002) and with their branching model at its critical loading
 * (−1.5, 2004). A straight line is a power law; a density that falls faster and faster is not.
 */

import { createRng } from "mcts-commun/random.js";

/** @typedef {import("../types.js").Grid} Grid */

/** The share of the demand shed, by half decades from 0.1 %: a smaller loss counts as none. */
export const SHARE_EDGES = Object.freeze([1e-3, 10 ** -2.5, 1e-2, 10 ** -1.5, 0.1, 10 ** -0.5, 1 + 1e-9]);

/** The lines tripped by the cascade, by powers of two from one. */
export const LINE_EDGES = Object.freeze([1, 2, 4, 8, 16, 32, 64, 128, 256]);

const liveOf = (/** @type {Grid} */ grid) => [...grid.inService.keys()].filter((k) => grid.inService[k]);

/** Every pair of branches in service, each once, the smaller index first. */
export function allPairs(/** @type {Grid} */ grid) {
  const live = liveOf(grid);
  return live.flatMap((a, i) => live.slice(i + 1).map((b) => [a, b]));
}

/** `count` distinct triples of branches in service, drawn from `seed`, each sorted. */
export function drawTriples(/** @type {Grid} */ grid, { count = 1000, seed = 1 } = {}) {
  const live = liveOf(grid);
  const rng = createRng(seed);
  const seen = new Map();
  for (let tries = 0; seen.size < count && tries < 100 * count; tries += 1) {
    const triple = [0, 1, 2].map(() => live[rng.int(live.length)]).sort((a, b) => a - b);
    if (triple[0] === triple[1] || triple[1] === triple[2]) continue;
    seen.set(triple.join("-"), triple);
  }
  return [...seen.values()];
}

/**
 * The values on classes [edges[i], edges[i + 1]): the count of each and its density, the share of all the values per
 * unit of size. `below` counts the values under the first edge.
 */
export function logHistogram(/** @type {number[]} */ values, /** @type {readonly number[]} */ edges) {
  const n = values.length;
  const bins = edges.slice(0, -1).map((low, i) => {
    const high = edges[i + 1];
    const count = values.filter((v) => v >= low && v < high).length;
    return { low, high, count, density: n > 0 ? count / (n * (high - low)) : 0 };
  });
  return { n, below: values.filter((v) => v < edges[0]).length, bins };
}

/**
 * The least-squares slope of log10(density) against log10 of each class's geometric middle, on the classes that hold
 * a value; null under three such classes.
 */
export function slopeOf(/** @type {{ low: number, high: number, count: number, density: number }[]} */ bins) {
  const points = bins.filter((bin) => bin.count > 0).map((bin) => [Math.log10(Math.sqrt(bin.low * bin.high)), Math.log10(bin.density)]);
  if (points.length < 3) return null;
  const mx = points.reduce((sum, [x]) => sum + x, 0) / points.length;
  const my = points.reduce((sum, [, y]) => sum + y, 0) / points.length;
  const sxy = points.reduce((sum, [x, y]) => sum + (x - mx) * (y - my), 0);
  const sxx = points.reduce((sum, [x]) => sum + (x - mx) ** 2, 0);
  return sxy / sxx;
}

/** The tail of a set of cascades: the density of their shed shares and of their lines lost, and both slopes. */
export function tailOf(/** @type {number[]} */ shares, /** @type {number[]} */ lost) {
  const share = logHistogram(shares, SHARE_EDGES);
  const lines = logHistogram(lost, LINE_EDGES);
  return { share, lines, shareSlope: slopeOf(share.bins), lineSlope: slopeOf(lines.bins) };
}
