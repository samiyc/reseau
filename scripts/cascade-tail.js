import { readFileSync, writeFileSync } from "node:fs";
import { createGrid } from "../src/grid/case.js";
import { cascadeSizes } from "../src/cascade/sweep.js";
import { allPairs, drawTriples, tailOf } from "../src/cascade/tail.js";

/**
 * `node scripts/cascade-tail.js [dispatch] [triples] [seed]`: the tail of the blackout sizes on PGLib's IEEE 14, 30 and
 * 118 (P3). At each load factor, every single loss, every pair, and `triples` triples drawn from `seed`, each run to
 * the end of its cascade under Grid2Op's rule (its size: the demand shed beyond the dispatch's own shedding), from the
 * dispatch `dispatch` ("secure", the model's, by default; "cost", the cheapest). Writes docs/mesures/cascade-queue.json ("secure") or cascade-queue-j3.json ("cost"), and prints the
 * tables of cascade-queue.md.
 */
const dispatch = process.argv[2] ?? "secure";
const [triples = 3000, seed = 1] = process.argv.slice(3, 5).map(Number);
const FILES = { secure: "cascade-queue.json", cost: "cascade-queue-j3.json" };
const FACTORS = [0.7, 0.8, 0.9, 1, 1.1, 1.15, 1.2, 1.3];
const comma = (/** @type {string} */ text) => text.replace(".", ",");
const percent = (/** @type {number} */ value) => comma(`${(100 * value).toFixed(1)} %`);
const slope = (/** @type {number | null} */ value) => (value === null ? "—" : comma(value.toFixed(2)));

/**
 * One set of events at one factor: its mean loss, its tail, the cascades unsettled, and the time it took. A blackout's
 * size is the share of the demand shed beyond what the dispatch sheds before any loss (`base`, past the N-0 limit).
 */
function measure(grid, /** @type {number} */ factor, /** @type {number[][]} */ events, /** @type {number} */ base) {
  const started = performance.now();
  const sizes = cascadeSizes(grid, factor, events, { dispatch });
  const { lost, unsettled } = sizes;
  const shares = sizes.shares.map((share) => Math.max(0, share - base));
  const mean = shares.reduce((a, b) => a + b, 0) / shares.length;
  const { share, lines, shareSlope, lineSlope } = tailOf(shares, lost);
  const counts = (/** @type {{ bins: { count: number }[] }} */ h) => h.bins.map((bin) => bin.count);
  const out = { base, n: shares.length, mean, max: Math.max(...shares), none: share.below, shares: counts(share), lines: counts(lines), shareSlope, lineSlope, unsettled };
  return { ...out, seconds: (performance.now() - started) / 1000 };
}

function measureGrid(/** @type {number} */ size) {
  const grid = createGrid(JSON.parse(readFileSync(new URL(`../data/pglib_opf_case${size}_ieee.json`, import.meta.url), "utf8")));
  const singles = Array.from({ length: grid.branchCount }, (_, k) => [k]).filter(([k]) => grid.inService[k]);
  const kinds = { single: singles, pair: allPairs(grid), triple: drawTriples(grid, { count: triples, seed }) };
  const rows = FACTORS.map((factor) => {
    const base = cascadeSizes(grid, factor, [[]], { dispatch }).shares[0];
    const of = (/** @type {number[][]} */ events) => measure(grid, factor, events, base);
    return { factor, base, single: of(kinds.single), pair: of(kinds.pair), triple: of(kinds.triple) };
  });
  return { size, singles: singles.length, pairs: kinds.pair.length, triples: kinds.triple.length, rows };
}

const NAMES = { single: "simples", pair: "paires", triple: "triplets" };
const results = [14, 30, 118].map((size) => {
  const result = measureGrid(size);
  const seconds = result.rows.reduce((sum, row) => sum + row.single.seconds + row.pair.seconds + row.triple.seconds, 0);
  console.log(`\n### IEEE ${size} (${seconds.toFixed(0)} s) : ${result.singles} pertes simples, ${result.pairs} paires, ${result.triples} triplets\n`);
  console.log("| Facteur | Pertes | Moyenne | < 0,1 % | 0,1-0,3 % | 0,3-1 % | 1-3 % | 3-10 % | 10-32 % | 32-100 % | Pente, perte | Pente, lignes |");
  console.log("|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const row of result.rows) {
    for (const kind of ["single", "pair", "triple"]) {
      const m = row[kind];
      const shares = [m.none, ...m.shares].map((count) => percent(count / m.n)).join(" | ");
      console.log(`| ${comma(row.factor.toFixed(2))} | ${NAMES[kind]} | ${percent(m.mean)} | ${shares} | ${slope(m.shareSlope)} | ${slope(m.lineSlope)} |`);
    }
  }
  return result;
});
const unsettled = results.flatMap((r) => r.rows).reduce((sum, row) => sum + row.single.unsettled + row.pair.unsettled + row.triple.unsettled, 0);
console.log(`\nCascades non stabilisées en 50 pas : ${unsettled}`);
writeFileSync(new URL(`../docs/mesures/${FILES[dispatch]}`, import.meta.url), `${JSON.stringify({ dispatch, triples, seed, factors: FACTORS, results }, null, 1)}\n`);
