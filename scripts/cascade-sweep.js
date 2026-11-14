import { readFileSync, writeFileSync } from "node:fs";
import { createGrid } from "../src/grid/case.js";
import { initialEvents, securityLimits, sweepFactor } from "../src/cascade/sweep.js";
import { maxLoad } from "../src/opf/loadability.js";

/**
 * `node scripts/cascade-sweep.js [pairs] [seed] [dispatch]`: the experiment of P3 on PGLib's IEEE 14, 30 and 118. For
 * each load factor from 0.6 to 1.5, every single loss of a branch, and `pairs` pairs drawn from `seed`, each run to
 * the end of its cascade under Grid2Op's rule. `dispatch` "cost" (the default, J3: the cheapest dispatch, its N-0 limit
 * by src/opf/loadability.js) writes docs/mesures/cascade-j3.json; "pmax" (J2: in proportion to Pmax, its N-0 and N-1
 * limits) writes docs/mesures/cascade-j2.json. Prints the tables of the matching .md.
 */
const [pairs = 300, seed = 1] = process.argv.slice(2, 4).map(Number);
const dispatch = process.argv[4] ?? "cost";
const FACTORS = Array.from({ length: 19 }, (_, i) => Math.round((0.6 + 0.05 * i) * 100) / 100);
const percent = (/** @type {number} */ value) => `${(100 * value).toFixed(1).replace(".", ",")} %`;
const rate = (/** @type {{ rate: number, low: number, high: number }} */ r) => `${percent(r.rate)} [${percent(r.low)} ; ${percent(r.high)}]`;
const cell = (s) => `${percent(s.mean)} ± ${percent(s.margin)}, ${rate(s.over10)}, ${s.lost.toFixed(1).replace(".", ",")}`;

/** The grid's limits: J2's by steps of 0.01 under "pmax"; under "cost", the N-0 limit of the cheapest dispatch. */
function limitsOf(grid, name) {
  if (dispatch === "cost") return { n0: Math.round(maxLoad(grid, { step: 1e-4 }).factor * 1000) / 1000, n1: null };
  const limits = securityLimits(grid);
  return { n0: limits.n0, n1: limits.n1 && { factor: limits.n1.factor, branch: limits.n1.branch >= 0 ? name(limits.n1.branch) : null } };
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
  const n1 = result.n1 ? ` ; N-1 : ${result.n1.factor} (perte de ${result.n1.branch})` : "";
  console.log(`N-0 : ${result.n0 ?? "> 1,6"}${n1}. ${result.singles} pertes simples, ${result.pairs} paires.\n`);
  console.log("| Facteur | Délesté par la répartition | Pertes simples : perte moyenne, part > 10 %, lignes perdues | Paires : perte moyenne, part > 10 %, lignes perdues |");
  console.log("|---|---|---|---|");
  for (const row of result.rows) console.log(`| ${row.factor.toFixed(2).replace(".", ",")} | ${row.single.dispatched.toFixed(1).replace(".", ",")} MW | ${cell(row.single)} | ${cell(row.pair)} |`);
  return result;
});
const unsettled = results.flatMap((r) => r.rows).reduce((sum, row) => sum + row.single.unsettled + row.pair.unsettled, 0);
console.log(`\nCascades non stabilisées en 50 pas : ${unsettled}`);
const file = dispatch === "cost" ? "cascade-j3.json" : "cascade-j2.json";
writeFileSync(new URL(`../docs/mesures/${file}`, import.meta.url), `${JSON.stringify({ pairs, seed, dispatch, factors: FACTORS, results }, null, 1)}\n`);
