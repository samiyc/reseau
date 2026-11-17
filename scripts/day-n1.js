import { writeFileSync } from "node:fs";
import { progress } from "mcts-commun/trace.js";
import { planDay } from "../src/day/beam.js";
import { playDay } from "../src/day/day.js";
import { lodf } from "../src/flow/sensitivity.js";
import { n1Overloads } from "../src/opf/security.js";
import { loadRts, settingsOf } from "./rts-data.js";

/**
 * `node scripts/day-n1.js [variant] [out]`: the third objective of J4's rule, the overloads (docs/mesures/journee-n1.md).
 * Plays the variant (the tuned list, "v0.3-h12", by default) on the 366 days of 2020, and checks each hour's dispatch
 * against the N-1 rule (src/opf/security.js): which single loss of a branch would put which other past its rating.
 * The dispatch holds the intact grid's limits, not these (unless the variant is an N-1 list, "-n1"). Writes
 * docs/mesures/<out> (journee-n1.json by default), prints the tables.
 */
const variant = process.argv[2] ?? "v0.3-h12";
const out = process.argv[3] ?? "journee-n1.json";
const settings = settingsOf(variant);
const rts = loadRts();
const factors = lodf(rts.grid);
const name = (/** @type {number} */ k) => `${rts.grid.busId[rts.grid.from[k]]}-${rts.grid.busId[rts.grid.to[k]]}`;
const started = performance.now();
const hours = [];
const pairs = new Map();
for (let index = 0; index < 366; index += 1) {
  const day = rts.day(index);
  const played = playDay(day, planDay(day, settings), settings);
  progress("day-n1", index + 1, 366, { unit: "jour" });
  played.hours.forEach((hour, h) => {
    const overloads = hour.status === "optimal" ? n1Overloads(hour.grid, hour.dispatch.flows.flow, factors) : [];
    const worst = overloads.reduce((max, o) => Math.max(max, o.loading), 0);
    hours.push({ day: index, hour: h, load: hour.load, count: overloads.length, worst });
    for (const o of overloads) {
      const key = `${name(o.outage)} → ${name(o.branch)}`;
      const entry = pairs.get(key) ?? { key, hours: 0, worst: 0 };
      pairs.set(key, { key, hours: entry.hours + 1, worst: Math.max(entry.worst, o.loading) });
    }
  });
}
const insecure = hours.filter((h) => h.count > 0);
const worst = insecure.map((h) => h.worst).sort((a, b) => a - b);
const at = (/** @type {number} */ q) => worst[Math.min(worst.length - 1, Math.floor(q * worst.length))];
const percent = (/** @type {number} */ v) => `${(100 * v).toFixed(1).replace(".", ",")} %`;
console.log(`${variant}, ${hours.length} heures, ${((performance.now() - started) / 1000).toFixed(0)} s\n`);
console.log(`Heures non N-1 : ${insecure.length} (${percent(insecure.length / hours.length)}) ; couples (perte, ligne) par heure : ${(hours.reduce((s, h) => s + h.count, 0) / hours.length).toFixed(1).replace(".", ",")} en moyenne`);
console.log(`Pire charge après une perte, sur les heures non N-1 : médiane ${percent(at(0.5))}, 9e décile ${percent(at(0.9))}, maximum ${percent(at(1))}\n`);
const byHour = Array.from({ length: 24 }, (_, h) => hours.filter((x) => x.hour === h));
console.log("| Heure | " + byHour.map((_, h) => h + 1).join(" | ") + " |");
console.log("|---|" + byHour.map(() => "---").join("|") + "|");
console.log("| Non N-1 | " + byHour.map((list) => Math.round((100 * list.filter((x) => x.count > 0).length) / list.length)).join(" | ") + " |\n");
const top = [...pairs.values()].sort((a, b) => b.hours - a.hours).slice(0, 12);
console.log("| Perte → ligne surchargée | Heures | Pire charge |\n|---|---|---|");
for (const p of top) console.log(`| ${p.key} | ${p.hours} | ${percent(p.worst)} |`);
writeFileSync(new URL(`../docs/mesures/${out}`, import.meta.url), `${JSON.stringify({ variant, settings, hours, pairs: [...pairs.values()].sort((a, b) => b.hours - a.hours) })}\n`);
