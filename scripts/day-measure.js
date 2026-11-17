import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { paired } from "mcts-commun/measure.js";
import { planDay } from "../src/day/beam.js";
import { playDay } from "../src/day/day.js";
import { lodf } from "../src/flow/sensitivity.js";
import { worstAfterLoss } from "../src/opf/security.js";
import { dayOfSeed, loadRts, settingsOf } from "./rts-data.js";

/**
 * `node scripts/day-measure.js [--days test|all] [--out name.json] [--part k/n] <variant> <variant>…`: J4's measure
 * (docs/mesures/journee-j4.md). Plays each variant of the rule (scripts/rts-data.js, settingsOf: "v0.25-h24",
 * "r2-v0.3-h12", "v0.3-h12-nofast", "v0.3-h12-n1", "b8-v0.3-h12"; "v0-h0", the plain list) on the 183 odd days of
 * 2020, which the race did not see (or on all 366 days), and compares each with the first, day by day: the energy not
 * served first, then the cost (Sami's order), never blended; and, third, the overloads: each hour's worst loading
 * after a single loss (src/opf/security.js), and the hours past the N-1 rule. A beam ("b8-…") is compared with its
 * own rule too, when that is measured. Writes docs/mesures/<name> (journee-j4.json by default), prints the tables.
 *
 * The beams are slow (J5: 7 to 60 s a day): `--part k/n` plays the k-th of n slices of the days, and
 * `node scripts/day-measure.js --merge a.json,b.json… --out name.json` joins the slices (docs/mesures/) and summarizes.
 */
const { values: options, positionals } = parseArgs({ allowPositionals: true, options: { days: { type: "string", default: "test" }, out: { type: "string", default: "journee-j4.json" }, part: { type: "string" }, merge: { type: "string" } } });
/** A loading after a loss past the rating by more than this breaks the N-1 rule. */
const N1_TOLERANCE = 1e-5;
const broken = (/** @type {number} */ w) => Number.isNaN(w) || w > 1 + N1_TOLERANCE;
const started = performance.now();
const mesures = (/** @type {string} */ name) => new URL(`../docs/mesures/${name}`, import.meta.url);

/** The days of the measure, or of its slice: every n-th from the k-th. */
function daysOf() {
  const days = options.days === "all" ? Array.from({ length: 366 }, (_, i) => i) : Array.from({ length: 183 }, (_, i) => dayOfSeed("test", i + 1));
  if (!options.part) return days;
  const [k, n] = options.part.split("/").map(Number);
  return days.filter((_, i) => i % n === k - 1);
}

/** Each variant played on each day: its totals, the hours past the N-1 rule, each hour's worst loading after a loss. */
function play(/** @type {string[]} */ variants, /** @type {number[]} */ days) {
  const rts = loadRts();
  const factors = lodf(rts.grid);
  const results = Object.fromEntries(variants.map((variant) => [variant, []]));
  for (const index of days) {
    const day = rts.day(index);
    for (const variant of variants) {
      const settings = settingsOf(variant);
      const commitment = planDay(day, settings);
      const r = playDay(day, commitment, settings);
      const worst = r.hours.map((hour) => (hour.status === "optimal" ? Number(worstAfterLoss(hour.grid, hour.dispatch.flows.flow, factors).toFixed(4)) : NaN));
      results[variant].push({ day: index, insecure: worst.filter(broken).length, worst, cost: r.cost, unserved: r.unserved, curtailed: r.curtailed, starts: r.starts, fastStarts: r.fastStarts, startCosts: r.startCosts, load: r.load, failed: r.failed, fromRule: "fromRule" in commitment ? commitment.fromRule : null, forecast: "forecast" in commitment ? commitment.forecast : null });
    }
  }
  return results;
}

/** The slices of a measure joined: their days and results, in the order given. */
function merged(/** @type {string[]} */ files) {
  const parts = files.map((file) => JSON.parse(readFileSync(mesures(file), "utf8")));
  const variants = Object.keys(parts[0].results);
  return { variants, days: parts.flatMap((p) => p.days), results: Object.fromEntries(variants.map((v) => [v, parts.flatMap((p) => p.results[v])])) };
}

const mean = (/** @type {number[]} */ values) => values.reduce((a, b) => a + b, 0) / values.length;

/** The worst loadings after a loss of the hours past the N-1 rule: their median, 9th decile and maximum. */
function overloadsOf(/** @type {any[]} */ rows) {
  const worst = rows.flatMap((r) => r.worst).filter(broken).sort((a, b) => a - b);
  const at = (/** @type {number} */ q) => worst[Math.min(worst.length - 1, Math.floor(q * worst.length))] ?? 1;
  return { hours: worst.length, share: worst.length / (24 * rows.length), median: at(0.5), decile9: at(0.9), max: at(1) };
}

/** Two variants day by day: the gaps of the energy not served, the cost and the hours past the N-1 rule. */
function versus(/** @type {any[]} */ rows, /** @type {any[]} */ base) {
  const of = (/** @type {any[]} */ r, /** @type {string} */ key) => r.map((row) => row[key]);
  return { cost: paired(of(rows, "cost"), of(base, "cost")), unserved: paired(of(rows, "unserved"), of(base, "unserved")), insecure: paired(of(rows, "insecure"), of(base, "insecure")) };
}

/** A variant's summary over the days: its means, its overloads, its gaps to the first variant and to its rule. */
function summaryOf(results, /** @type {string} */ variant, /** @type {string} */ first) {
  const rows = results[variant];
  const of = (/** @type {string} */ key) => rows.map((r) => r[key]);
  const rule = variant.replace(/^b\d+-/, "");
  return {
    variant,
    settings: settingsOf(variant),
    cost: mean(of("cost")),
    perMWh: of("cost").reduce((a, b) => a + b, 0) / of("load").reduce((a, b) => a + b, 0),
    unserved: mean(of("unserved")),
    unservedDays: of("unserved").filter((v) => v > 1e-6).length,
    curtailed: mean(of("curtailed")),
    starts: mean(of("starts")),
    fastStarts: mean(of("fastStarts")),
    startCosts: mean(of("startCosts")),
    failed: of("failed").reduce((a, b) => a + b, 0),
    fromRule: of("fromRule").filter((v) => v === true).length,
    overloads: overloadsOf(rows),
    vsFirst: versus(rows, results[first]),
    vsRule: rule !== variant && results[rule] ? { rule, ...versus(rows, results[rule]) } : null,
  };
}

const k = (/** @type {number} */ value) => `${(value / 1000).toFixed(1).replace(".", ",")} k$`;
const h1 = (/** @type {number} */ v) => v.toFixed(1).replace(".", ",");
const percent = (/** @type {number} */ v) => `${(100 * v).toFixed(1).replace(".", ",")} %`;

/** The tables: cost and energy not served, overloads, then each beam against its rule. */
function print(/** @type {any[]} */ summary) {
  console.log("| Variante | Coût par jour | $/MWh | Écart à la référence, IC 95 % | Jours gagnés | Énergie non distribuée | Démarrages (dont dans l'heure) | Écrêté par jour |\n|---|---|---|---|---|---|---|---|");
  for (const s of summary) {
    const gap = s.vsFirst.cost;
    console.log(`| ${s.variant} | ${k(s.cost)} | ${s.perMWh.toFixed(2).replace(".", ",")} | ${k(gap.mean)} [${k(gap.low)} ; ${k(gap.high)}] | ${gap.losses} sur ${gap.n} | ${s.unserved.toFixed(2).replace(".", ",")} MWh, ${s.unservedDays} jours | ${h1(s.starts)} (${h1(s.fastStarts)}) | ${(s.curtailed / 1000).toFixed(2).replace(".", ",")} GWh |`);
  }
  console.log("\n| Variante | Heures hors N-1 | Écart par jour, IC 95 % | Pire charge après une perte : médiane, 9e décile, maximum |\n|---|---|---|---|");
  for (const s of summary) {
    const { hours, share, median, decile9, max } = s.overloads;
    const gap = s.vsFirst.insecure;
    console.log(`| ${s.variant} | ${hours} (${percent(share)}) | ${h1(gap.mean)} h [${h1(gap.low)} ; ${h1(gap.high)}] | ${percent(median)}, ${percent(decile9)}, ${percent(max)} |`);
  }
  const beams = summary.filter((s) => s.vsRule);
  if (beams.length === 0) return;
  console.log("\n| Faisceau | Contre | Énergie non distribuée, IC 95 % | Coût par jour, IC 95 % | Heures hors N-1 par jour, IC 95 % | Jours où la règle reste |\n|---|---|---|---|---|---|");
  for (const s of beams) {
    const { rule, unserved, cost, insecure } = s.vsRule;
    console.log(`| ${s.variant} | ${rule} | ${h1(unserved.mean)} MWh [${h1(unserved.low)} ; ${h1(unserved.high)}] | ${k(cost.mean)} [${k(cost.low)} ; ${k(cost.high)}] | ${h1(insecure.mean)} h [${h1(insecure.low)} ; ${h1(insecure.high)}] | ${s.fromRule} |`);
  }
}

const measured = options.merge ? merged(options.merge.split(",")) : { variants: positionals, days: daysOf(), results: null };
if (measured.variants.length < 2) throw new Error("au moins deux variantes : la référence, puis les autres");
const results = measured.results ?? play(measured.variants, measured.days);
const summary = measured.variants.map((variant) => summaryOf(results, variant, measured.variants[0]));
const slice = options.part ? `, part ${options.part}` : "";
console.log(`${measured.days.length} jours (${options.days === "all" ? "toute l'année" : "les impairs"}${slice}), ${((performance.now() - started) / 1000).toFixed(0)} s\n`);
print(summary);
writeFileSync(mesures(options.out), `${JSON.stringify({ days: measured.days, summary, results }, null, 1)}\n`);
