import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { paired } from "mcts-commun/measure.js";
import { priorityCommit } from "../src/day/commit.js";
import { playDay } from "../src/day/day.js";
import { dayOfSeed, loadRts, settingsOf } from "./rts-data.js";

/**
 * `node scripts/day-measure.js [--days test|all] [--out name.json] <variant> <variant>…`: J4's measure
 * (docs/mesures/journee-j4.md). Plays each variant of the rule (scripts/rts-data.js, settingsOf: "v0.25-h24",
 * "r2-v0.3-h12", "v0.3-h12-nofast"; "v0-h0", the plain list) on the 183 odd days of 2020, which the race did not see
 * (or on all 366 days), and compares each with the first, day by day: the energy not served first, then the cost
 * (Sami's order), never blended. Writes docs/mesures/<name> (journee-j4.json by default) and prints the tables.
 */
const { values: options, positionals: variants } = parseArgs({ allowPositionals: true, options: { days: { type: "string", default: "test" }, out: { type: "string", default: "journee-j4.json" } } });
if (variants.length < 2) throw new Error("au moins deux variantes : la référence, puis les autres");
const rts = loadRts();
const days = options.days === "all" ? Array.from({ length: 366 }, (_, i) => i) : Array.from({ length: 183 }, (_, i) => dayOfSeed("test", i + 1));
const started = performance.now();
const results = Object.fromEntries(variants.map((variant) => [variant, []]));
for (const index of days) {
  const day = rts.day(index);
  for (const variant of variants) {
    const settings = settingsOf(variant);
    const r = playDay(day, priorityCommit(day, settings), settings);
    results[variant].push({ day: index, cost: r.cost, unserved: r.unserved, curtailed: r.curtailed, starts: r.starts, fastStarts: r.fastStarts, startCosts: r.startCosts, load: r.load, failed: r.failed });
  }
}
const mean = (/** @type {number[]} */ values) => values.reduce((a, b) => a + b, 0) / values.length;
const of = (/** @type {string} */ variant, /** @type {string} */ key) => results[variant].map((r) => r[key]);
const summary = variants.map((variant) => ({
  variant,
  settings: settingsOf(variant),
  cost: mean(of(variant, "cost")),
  perMWh: of(variant, "cost").reduce((a, b) => a + b, 0) / of(variant, "load").reduce((a, b) => a + b, 0),
  unserved: mean(of(variant, "unserved")),
  unservedDays: of(variant, "unserved").filter((v) => v > 1e-6).length,
  curtailed: mean(of(variant, "curtailed")),
  starts: mean(of(variant, "starts")),
  fastStarts: mean(of(variant, "fastStarts")),
  startCosts: mean(of(variant, "startCosts")),
  failed: of(variant, "failed").reduce((a, b) => a + b, 0),
  vsFirst: { cost: paired(of(variant, "cost"), of(variants[0], "cost")), unserved: paired(of(variant, "unserved"), of(variants[0], "unserved")) },
}));
const k = (/** @type {number} */ value) => `${(value / 1000).toFixed(1).replace(".", ",")} k$`;
console.log(`${days.length} jours (${options.days === "all" ? "toute l'année" : "les impairs"}), ${((performance.now() - started) / 1000).toFixed(0)} s\n`);
console.log("| Variante | Coût par jour | $/MWh | Écart à la référence, IC 95 % | Jours gagnés | Énergie non distribuée | Démarrages (dont dans l'heure) | Écrêté par jour |");
console.log("|---|---|---|---|---|---|---|---|");
for (const s of summary) {
  const gap = s.vsFirst.cost;
  console.log(`| ${s.variant} | ${k(s.cost)} | ${s.perMWh.toFixed(2).replace(".", ",")} | ${k(gap.mean)} [${k(gap.low)} ; ${k(gap.high)}] | ${gap.losses} sur ${gap.n} | ${s.unserved.toFixed(2).replace(".", ",")} MWh, ${s.unservedDays} jours | ${s.starts.toFixed(1).replace(".", ",")} (${s.fastStarts.toFixed(1).replace(".", ",")}) | ${(s.curtailed / 1000).toFixed(2).replace(".", ",")} GWh |`);
}
writeFileSync(new URL(`../docs/mesures/${options.out}`, import.meta.url), `${JSON.stringify({ days, summary, results }, null, 1)}\n`);
