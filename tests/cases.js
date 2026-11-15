import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createGrid } from "../src/grid/case.js";

/**
 * The cases of data/, for the tests: `grid(14)` is PGLib's IEEE 14; `variant` "api" or "sad" the congested ones and
 * those with small angle limits; `convention` "powermodels" to compare with PGLib's costs.
 */
export const caseName = (/** @type {number} */ size, variant = "") => `pglib_opf_case${size}_ieee` + (variant ? `__${variant}` : "");

export const caseData = (/** @type {number} */ size, variant = "") =>
  JSON.parse(readFileSync(new URL(`../data/${caseName(size, variant)}.json`, import.meta.url), "utf8"));

export const grid = (/** @type {number} */ size, { variant = "", convention = "matpower" } = {}) => createGrid(caseData(size, variant), { convention });

/**
 * A three-bus triangle solved by hand: every line x = 0.1, 100 MW drawn at bus 2, bus 1 the reference. One generator
 * at bus 1, 10 $/MWh; `congested` adds one at bus 3, 30 $/MWh, and limits line 1-2 to 50 MW.
 */
export function triangle({ congested = false } = {}) {
  const row = (from, to) => [from, to, 0, 0.1, 0, congested && to === 2 && from === 1 ? 50 : 100, 100, 100, 0, 0, 1, -30, 30];
  const gens = congested ? [[1, 0, 1, 200, 0], [3, 0, 1, 200, 0]] : [[1, 0, 1, 200, 0]];
  const costs = congested ? [[0, 10, 0], [0, 30, 0]] : [[0, 10, 0]];
  return createGrid({
    name: "triangle",
    source: "à la main",
    version: "-",
    license: "-",
    baseMVA: 100,
    bus: {
      columns: ["bus_i", "type", "Pd", "Gs"],
      rows: [
        [1, 3, 0, 0],
        [2, 1, 100, 0],
        [3, 1, 0, 0],
      ],
    },
    gen: { columns: ["bus", "Pg", "status", "Pmax", "Pmin"], rows: gens },
    branch: {
      columns: ["fbus", "tbus", "r", "x", "b", "rateA", "rateB", "rateC", "ratio", "angle", "status", "angmin", "angmax"],
      rows: [row(1, 2), row(1, 3), row(3, 2)],
    },
    gencost: { columns: ["c2", "c1", "c0"], rows: costs },
  });
}

/** RTS-GMLC (data/rts_gmlc.json, scripts/rts-convert.js): its JSON, its grid, and its 2020 series by hour, read once. */
let rtsCache = null;
export function rts() {
  if (rtsCache) return rtsCache;
  const data = JSON.parse(readFileSync(new URL("../data/rts_gmlc.json", import.meta.url), "utf8"));
  const series = JSON.parse(gunzipSync(readFileSync(new URL("../data/rts_gmlc_series.json.gz", import.meta.url))).toString("utf8"));
  rtsCache = { data, series, grid: createGrid(data) };
  return rtsCache;
}
