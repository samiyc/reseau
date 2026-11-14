import { readFileSync } from "node:fs";
import { createGrid } from "../src/grid/case.js";

/** The cases of data/, for the tests: `grid(14)` is PGLib's IEEE 14. */
export const caseData = (/** @type {number} */ size) =>
  JSON.parse(readFileSync(new URL(`../data/pglib_opf_case${size}_ieee.json`, import.meta.url), "utf8"));

export const grid = (/** @type {number} */ size) => createGrid(caseData(size));

/** A three-bus triangle solved by hand: every line x = 0.1, 100 MW drawn at bus 2, bus 1 the reference. */
export function triangle() {
  const row = (from, to) => [from, to, 0, 0.1, 0, 100, 100, 100, 0, 0, 1, -30, 30];
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
    gen: { columns: ["bus", "Pg", "status", "Pmax", "Pmin"], rows: [[1, 0, 1, 200, 0]] },
    branch: {
      columns: ["fbus", "tbus", "r", "x", "b", "rateA", "rateB", "rateC", "ratio", "angle", "status", "angmin", "angmax"],
      rows: [row(1, 2), row(1, 3), row(3, 2)],
    },
    gencost: { columns: ["c2", "c1", "c0"], rows: [[0, 10, 0]] },
  });
}
