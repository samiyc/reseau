import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { paired } from "mcts-commun/measure.js";
import { priorityCommit } from "../src/day/commit.js";
import { playDay } from "../src/day/day.js";
import { lodf } from "../src/flow/sensitivity.js";
import { worstAfterLoss } from "../src/opf/security.js";
import { dayOfSeed, loadRts, settingsOf } from "./rts-data.js";

/**
 * `node scripts/day-measure.js [--days test|all] [--out name.json] <variant> <variant>…`: J4's measure
 * (docs/mesures/journee-j4.md). Plays each variant of the rule (scripts/rts-data.js, settingsOf: "v0.25-h24",
 * "r2-v0.3-h12", "v0.3-h12-nofast", "v0.3-h12-n1"; "v0-h0", the plain list) on the 183 odd days of 2020, which the
 * race did not see (or on all 366 days), and compares each with the first, day by day: the energy not served first,
 * then the cost (Sami's order), never blended; and, third, the overloads: each hour's worst loading after a single
 * loss (src/opf/security.js), and the hours past the N-1 rule. Writes docs/mesures/<name> (journee-j4.json by default) and prints the tables.
 */
const { values: options, positionals: variants } = parseArgs({ allowPositionals: true, options: { days: { type: "string", default: "test" }, out: { type: "string", default: "journee-j4.json" } } });
if (variants.length < 2) throw new Error("au moins deux variantes : la référence, puis les autres");
const rts = loadRts();
const factors = lodf(rts.grid);
/** A loading after a loss past the rating by more than this breaks the N-1 rule. */
const N1_TOLERANCE = 1e-5;
const broken = (/** @type {number} */ w) => Number.isNaN(w) || w > 1 + N1_TOLERANCE;
const days = options.days === "all" ? Array.from({ length: 366 }, (_, i) => i) : Array.from({ length: 183 }, (_, i) => dayOfSeed("test", i + 1));
const started = performance.now();
const results = Object.fromEntries(variants.map((variant) => [variant, []]));
for (const index of days) {
  const day = rts.day(index);
  for (const variant of variants) {
    const settings = settingsOf(variant);
    const r = playDay(day, priorityCommit(day, settings), settings);
    const worst = r.hours.map((hour) => (hour.status === "optimal" ? Number(worstAfterLoss(hour.grid, hour.dispatch.flows.flow, factors).toFixed(4)) : NaN));
    results[variant].push({ day: index, insecure: worst.filter(broken).length, worst, cost: r.cost, unserved: r.unserved, curtailed: r.curtailed, starts: r.starts, fastStarts: r.fastStarts, startCosts: r.startCosts, load: r.load, failed: r.failed });
  }
}
const mean = (/** @type {number[]} */ values) => values.reduce((a, b) => a + b, 0) / values.length;
const of = (/** @type {string} */ variant, /** @type {string} */ key) => results[variant].map((r) => r[key]);
/** The worst loadings after a loss of the hours past the N-1 rule: their median, 9th decile and maximum. */
function overloadsOf(/** @type {string} */ variant) {
  const worst = results[variant].flatMap((r) => r.worst).filter(broken).sort((a, b) => a - b);
  const at = (/** @type {number} */ q) => worst[Math.min(worst.length - 1, Math.floor(q * worst.length))] ?? 1;
  return { hours: worst.length, share: worst.length / (24 * days.length), median: at(0.5), decile9: at(0.9), max: at(1) };
}
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
  overloads: overloadsOf(variant),
  vsFirst: { cost: paired(of(variant, "cost"), of(variants[0], "cost")), unserved: paired(of(variant, "unserved"), of(variants[0], "unserved")), insecure: paired(of(variant, "insecure"), of(variants[0], "insecure")) },
}));
const k = (/** @type {number} */ value) => `${(value / 1000).toFixed(1).replace(".", ",")} k$`;
console.log(`${days.length} jours (${options.days === "all" ? "toute l'année" : "les impairs"}), ${((performance.now() - started) / 1000).toFixed(0)} s\n`);
console.log("| Variante | Coût par jour | $/MWh | Écart à la référence, IC 95 % | Jours gagnés | Énergie non distribuée | Démarrages (dont dans l'heure) | Écrêté par jour |");
console.log("|---|---|---|---|---|---|---|---|");
for (const s of summary) {
  const gap = s.vsFirst.cost;
  console.log(`| ${s.variant} | ${k(s.cost)} | ${s.perMWh.toFixed(2).replace(".", ",")} | ${k(gap.mean)} [${k(gap.low)} ; ${k(gap.high)}] | ${gap.losses} sur ${gap.n} | ${s.unserved.toFixed(2).replace(".", ",")} MWh, ${s.unservedDays} jours | ${s.starts.toFixed(1).replace(".", ",")} (${s.fastStarts.toFixed(1).replace(".", ",")}) | ${(s.curtailed / 1000).toFixed(2).replace(".", ",")} GWh |`);
}
const percent = (/** @type {number} */ v) => `${(100 * v).toFixed(1).replace(".", ",")} %`;
console.log("\n| Variante | Heures hors N-1 | Écart par jour, IC 95 % | Pire charge après une perte : médiane, 9e décile, maximum |\n|---|---|---|---|");
for (const s of summary) {
  const { hours, share, median, decile9, max } = s.overloads;
  const gap = s.vsFirst.insecure;
  const h = (/** @type {number} */ v) => v.toFixed(1).replace(".", ",");
  console.log(`| ${s.variant} | ${hours} (${percent(share)}) | ${h(gap.mean)} h [${h(gap.low)} ; ${h(gap.high)}] | ${percent(median)}, ${percent(decile9)}, ${percent(max)} |`);
}
writeFileSync(new URL(`../docs/mesures/${options.out}`, import.meta.url), `${JSON.stringify({ days, summary, results }, null, 1)}\n`);
