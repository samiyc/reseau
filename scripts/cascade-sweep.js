import { readFileSync, writeFileSync } from "node:fs";
import { createGrid } from "../src/grid/case.js";
import { initialEvents, securityLimits, sweepFactor } from "../src/cascade/sweep.js";
import { maxLoad } from "../src/opf/loadability.js";

/**
 * `node scripts/cascade-sweep.js [pairs] [seed] [dispatch]`: the experiment of P3 on PGLib's IEEE 14, 30 and 118. For
 * each load factor from 0.6 to 1.5, every single loss of a branch, and `pairs` pairs drawn from `seed`, each run to
 * the end of its cascade under Grid2Op's rule. `dispatch` "secure" (the default: N-1 secure while it can be, the
 * cheapest past that) writes docs/mesures/cascade-n1.json; "cost" (J3: the cheapest) cascade-j3.json, both with their
 * limits by src/opf/loadability.js; "pmax" (J2: in proportion to Pmax, its N-0 and N-1 limits) cascade-j2.json.
 * Prints the tables of the matching .md.
 */
const [pairs = 300, seed = 1] = process.argv.slice(2, 4).map(Number);
const dispatch = process.argv[4] ?? "secure";
const FILES = { secure: "cascade-n1.json", cost: "cascade-j3.json", pmax: "cascade-j2.json" };
const FACTORS = Array.from({ length: 19 }, (_, i) => Math.round((0.6 + 0.05 * i) * 100) / 100);
const percent = (/** @type {number} */ value) => `${(100 * value).toFixed(1).replace(".", ",")} %`;
const rate = (/** @type {{ rate: number, low: number, high: number }} */ r) => `${percent(r.rate)} [${percent(r.low)} ; ${percent(r.high)}]`;
const cell = (s) => `${percent(s.mean)} ± ${percent(s.margin)}, ${rate(s.over10)}, ${s.lost.toFixed(1).replace(".", ",")}`;

/** The grid's limits: J2's by steps of 0.01 under "pmax"; otherwise those of the cheapest dispatch, N-0 and N-1. */
function limitsOf(grid, name) {
  const limit = (/** @type {boolean} */ security) => Math.round(maxLoad(grid, { security, step: 1e-4 }).factor * 1000) / 1000;
  if (dispatch !== "pmax") return { n0: limit(false), n1: { factor: limit(true), branch: null } };
  const limits = securityLimits(grid);
  return { n0: limits.n0, n1: limits.n1 && { factor: limits.n1.factor, branch: limits.n1.branch >= 0 ? name(limits.n1.branch) : null } };
}

/** The N-1 limit, with the branch whose loss sets it when known. */
function n1Text(/** @type {{ factor: number, branch: string | null } | null} */ n1) {
  if (!n1) return "";
  const lost = n1.branch ? " (perte de " + n1.branch + ")" : "";
  return ` ; N-1 : ${n1.factor}${lost}`;
}

function measureGrid(/** @type {number} */ size) {
  const data = JSON.parse(readFileSync(new URL(`../data/pglib_opf_case${size}_ieee.json`, import.meta.url), "utf8"));
  const grid = createGrid(data);
  const events = initialEvents(grid, { pairs, seed });
  const singles = events.filter((event) => event.length === 1);
  const doubles = events.filter((event) => event.length === 2);
  const name = (k) => `${grid.busId[grid.from[k]]}-${grid.busId[grid.to[k]]}`;
  const rows = FACTORS.map((factor) => ({ factor, single: sweepFactor(grid, factor, singles, { dispatch }), pair: sweepFactor(grid, factor, doubles, { dispatch }) }));
  return { size, singles: singles.length, pairs: doubles.length, ...limitsOf(grid, name), rows };
}

const results = [14, 30, 118].map((size) => {
  const started = performance.now();
  const result = measureGrid(size);
  console.log(`\n### IEEE ${size} (${((performance.now() - started) / 1000).toFixed(1)} s)\n`);
  console.log(`N-0 : ${result.n0 ?? "> 1,6"}${n1Text(result.n1)}. ${result.singles} pertes simples, ${result.pairs} paires.\n`);
  console.log("| Facteur | Délesté par la répartition, N-1 tenue | Pertes simples : perte moyenne, part > 10 %, lignes perdues | Paires : perte moyenne, part > 10 %, lignes perdues |");
  console.log("|---|---|---|---|");
  for (const row of result.rows) console.log(`| ${row.factor.toFixed(2).replace(".", ",")} | ${row.single.dispatched.toFixed(1).replace(".", ",")} MW${row.single.secure ? ", oui" : ""} | ${cell(row.single)} | ${cell(row.pair)} |`);
  return result;
});
const unsettled = results.flatMap((r) => r.rows).reduce((sum, row) => sum + row.single.unsettled + row.pair.unsettled, 0);
console.log(`\nCascades non stabilisées en 50 pas : ${unsettled}`);
writeFileSync(new URL(`../docs/mesures/${FILES[dispatch]}`, import.meta.url), `${JSON.stringify({ pairs, seed, dispatch, factors: FACTORS, results }, null, 1)}\n`);
