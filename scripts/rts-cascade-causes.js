import { readFileSync } from "node:fs";
import { runCascade } from "../src/cascade/cascade.js";
import { priorityCommit } from "../src/day/commit.js";
import { playDay } from "../src/day/day.js";
import { loadRts, settingsOf } from "./rts-data.js";

/**
 * `node scripts/rts-cascade-causes.js [file] [variant]`: what the large cascades of the fragile hours have in common
 * (docs/mesures/journee-liste-n1.md § 3). Reads the hours of a run of scripts/rts-cascades.js (docs/mesures/<file>,
 * rts-cascades.json by default), keeps the fragile ones (a single loss costs more than 1 % of the demand on average),
 * plays each again under the variant, and counts, over the single losses that shed more than 10 %: the loss that
 * starts the cascade, the first branch to trip, and the islands the grid ends in.
 */
const file = process.argv[2] ?? "rts-cascades.json";
const variant = process.argv[3] ?? "v0.3-h12";
const settings = settingsOf(variant);
const rts = loadRts();
const name = (/** @type {number} */ k) => `${rts.grid.busId[rts.grid.from[k]]}-${rts.grid.busId[rts.grid.to[k]]}`;
const fragile = JSON.parse(readFileSync(new URL(`../docs/mesures/${file}`, import.meta.url), "utf8")).results.filter((r) => r.single.mean > 0.01);
const tally = { starts: new Map(), first: new Map(), islands: new Map() };
const count = (/** @type {Map<string, number>} */ map, /** @type {string} */ key) => map.set(key, (map.get(key) ?? 0) + 1);
let large = 0;
for (const { yearHour } of fragile) {
  const day = rts.day(Math.floor(yearHour / 24));
  const { grid, dispatch } = playDay(day, priorityCommit(day, settings), settings).hours[yearHour % 24];
  const setpoints = { generation: dispatch.generation, shed: dispatch.shed, cost: dispatch.cost, prices: null, secure: false, margin: null };
  for (let k = 0; k < grid.branchCount; k += 1) {
    const cascade = runCascade(grid, { setpoints, dispatch: "cost", inService: Uint8Array.from(grid.inService, (on, j) => (j === k ? 0 : on)) });
    if (cascade.shedShare < 0.1) continue;
    large += 1;
    count(tally.starts, name(k));
    count(tally.first, cascade.steps.flatMap((step) => step.tripped).map((trip) => name(trip.branch))[0] ?? "aucune");
    count(tally.islands, String(cascade.final.islands.length));
  }
}
const top = (/** @type {Map<string, number>} */ map) => [...map].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([key, n]) => `${key} (${n})`).join(", ");
console.log(`${variant}, ${fragile.length} heures fragiles, ${large} pertes simples qui emportent plus de 10 %`);
console.log(`Première branche tombée : ${top(tally.first)}`);
console.log(`Perte de départ : ${top(tally.starts)}`);
console.log(`Îlots à la fin : ${top(tally.islands)}`);
