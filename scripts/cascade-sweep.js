import { readFileSync, writeFileSync } from "node:fs";
import { createGrid } from "../src/grid/case.js";
import { initialEvents, securityLimits, sweepFactor } from "../src/cascade/sweep.js";

/**
 * `node scripts/cascade-sweep.js [pairs] [seed]`: the experiment of J2 (P3) on PGLib's IEEE 14, 30 and 118. For each
 * load factor from 0.6 to 1.5, every single loss of a branch, and `pairs` pairs drawn from `seed`, each run to the end
 * of its cascade under Grid2Op's rule; and the grid's N-0 and N-1 limits. Writes docs/mesures/cascade-j2.json and
 * prints the tables of docs/mesures/cascade-j2.md.
 */
const [pairs = 300, seed = 1] = process.argv.slice(2).map(Number);
const FACTORS = Array.from({ length: 19 }, (_, i) => Math.round((0.6 + 0.05 * i) * 100) / 100);
const percent = (/** @type {number} */ value) => `${(100 * value).toFixed(1).replace(".", ",")} %`;
const rate = (/** @type {{ rate: number, low: number, high: number }} */ r) => `${percent(r.rate)} [${percent(r.low)} ; ${percent(r.high)}]`;
const cell = (s) => `${percent(s.mean)} ± ${percent(s.margin)}, ${rate(s.over10)}, ${s.lost.toFixed(1).replace(".", ",")}`;

function measureGrid(/** @type {number} */ size) {
  const data = JSON.parse(readFileSync(new URL(`../data/pglib_opf_case${size}_ieee.json`, import.meta.url), "utf8"));
  const grid = createGrid(data);
  const events = initialEvents(grid, { pairs, seed });
  const singles = events.filter((event) => event.length === 1);
  const doubles = events.filter((event) => event.length === 2);
  const limits = securityLimits(grid);
  const rows = FACTORS.map((factor) => ({ factor, single: sweepFactor(grid, factor, singles), pair: sweepFactor(grid, factor, doubles) }));
  const name = (k) => `${grid.busId[grid.from[k]]}-${grid.busId[grid.to[k]]}`;
  return { size, singles: singles.length, pairs: doubles.length, n0: limits.n0, n1: limits.n1 && { factor: limits.n1.factor, branch: limits.n1.branch >= 0 ? name(limits.n1.branch) : null }, rows };
}

const results = [14, 30, 118].map((size) => {
  const started = performance.now();
  const result = measureGrid(size);
  console.log(`\n### IEEE ${size} (${((performance.now() - started) / 1000).toFixed(1)} s)\n`);
  console.log(`N-0 : ${result.n0 ?? "> 1,6"} ; N-1 : ${result.n1?.factor} (perte de ${result.n1?.branch}). ${result.singles} pertes simples, ${result.pairs} paires.\n`);
  console.log("| Facteur | Pertes simples : perte moyenne, part > 10 %, lignes perdues | Paires : perte moyenne, part > 10 %, lignes perdues |");
  console.log("|---|---|---|");
  for (const row of result.rows) console.log(`| ${row.factor.toFixed(2).replace(".", ",")} | ${cell(row.single)} | ${cell(row.pair)} |`);
  return result;
});
const unsettled = results.flatMap((r) => r.rows).reduce((sum, row) => sum + row.single.unsettled + row.pair.unsettled, 0);
console.log(`\nCascades non stabilisées en 50 pas : ${unsettled}`);
writeFileSync(new URL("../docs/mesures/cascade-j2.json", import.meta.url), `${JSON.stringify({ pairs, seed, factors: FACTORS, results }, null, 1)}\n`);
