import { writeFileSync } from "node:fs";
import { runCascade } from "../src/cascade/cascade.js";
import { allPairs, tailOf } from "../src/cascade/tail.js";
import { planDay } from "../src/day/beam.js";
import { playDay } from "../src/day/day.js";
import { loadRts, settingsOf } from "./rts-data.js";

/**
 * `node scripts/rts-cascades.js [count] [variant] [out]`: the cascades on RTS-GMLC (docs/mesures/rts-cascades.md), the
 * question of P3 on the main grid. `count` hours (120 by default) spread over the year's loads, from the least to the
 * most loaded (one at each quantile); at each, the state the variant's day leaves (the tuned list, "v0.3-h12"), then
 * every single loss of a branch and every pair, each run to the end of its cascade under Grid2Op's rule. A blackout's
 * size is the share of the demand shed beyond what the dispatch already sheds. Writes docs/mesures/<out>
 * (rts-cascades.json by default).
 */
const count = Number(process.argv[2] ?? 120);
const variant = process.argv[3] ?? "v0.3-h12";
const out = process.argv[4] ?? "rts-cascades.json";
const settings = settingsOf(variant);
const rts = loadRts();
const total = (/** @type {number} */ h) => ["1", "2", "3"].reduce((sum, a) => sum + rts.series.realTime.load[a][h], 0);
const ranked = Array.from({ length: rts.series.hours }, (_, h) => h).sort((a, b) => total(a) - total(b));
const chosen = Array.from({ length: count }, (_, i) => ranked[Math.round((i * (ranked.length - 1)) / (count - 1))]);
const singles = Array.from({ length: rts.grid.branchCount }, (_, k) => [k]);
const events = { single: singles, pair: allPairs(rts.grid) };
const started = performance.now();

/** Every event at one hour of the year: the sizes of its cascades, and the lines each one trips; null without a dispatch. */
function measureHour(/** @type {number} */ yearHour) {
  const day = rts.day(Math.floor(yearHour / 24));
  const hour = playDay(day, planDay(day, settings), settings).hours[yearHour % 24];
  if (hour.status !== "optimal") return null;
  const { grid, dispatch } = hour;
  const margin = "margin" in dispatch ? Number(dispatch.margin) : null;
  const setpoints = { generation: dispatch.generation, shed: dispatch.shed ?? new Float64Array(grid.busCount), cost: dispatch.cost, prices: null, secure: margin !== null && margin <= 1 + 1e-6, margin };
  const base = (dispatch.shedTotal ?? 0) / hour.load;
  const run = (/** @type {number[][]} */ list) => {
    const sizes = list.map((event) => runCascade(grid, { setpoints, dispatch: "cost", inService: Uint8Array.from(grid.inService, (on, k) => (event.includes(k) ? 0 : on)) }));
    const shares = sizes.map((r) => Math.max(0, r.shedShare - base));
    const lost = sizes.map((r) => r.lost);
    return { mean: shares.reduce((a, b) => a + b, 0) / shares.length, unsettled: sizes.filter((r) => !r.settled).length, ...tailOf(shares, lost) };
  };
  return { yearHour, load: hour.load, margin, single: run(events.single), pair: run(events.pair) };
}

const measured = chosen.map(measureHour);
const results = measured.filter((r) => r !== null);
const percent = (/** @type {number} */ v) => `${(100 * v).toFixed(1).replace(".", ",")} %`;
const slope = (/** @type {number | null} */ v) => (v === null ? "—" : v.toFixed(2).replace(".", ","));
console.log(`${count} heures, ${events.single.length} pertes simples et ${events.pair.length} paires chacune, ${((performance.now() - started) / 1000).toFixed(0)} s\n`);
console.log("| Charge (MW) | Pertes simples : moyenne, > 10 % | Paires : moyenne, > 1 %, > 10 % | Pente des paires |\n|---|---|---|---|");
for (const r of results.filter((_, i) => i % 10 === 9 || i === 0)) {
  const over = (part, edge) => part.share.bins.filter((b) => b.low >= edge - 1e-12).reduce((s, b) => s + b.count, 0) / part.share.n;
  console.log(`| ${r.load.toFixed(0)} | ${percent(r.single.mean)}, ${percent(over(r.single, 0.1))} | ${percent(r.pair.mean)}, ${percent(over(r.pair, 0.01))}, ${percent(over(r.pair, 0.1))} | ${slope(r.pair.shareSlope)} |`);
}
console.log(`\nHeures sans répartition : ${measured.length - results.length}`);
console.log(`Cascades non stabilisées : ${results.reduce((s, r) => s + r.single.unsettled + r.pair.unsettled, 0)}`);
writeFileSync(new URL(`../docs/mesures/${out}`, import.meta.url), `${JSON.stringify({ variant, settings, count, results })}\n`);
