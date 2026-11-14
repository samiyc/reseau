import { readFileSync, writeFileSync } from "node:fs";
import { createGrid } from "../src/grid/case.js";
import { solveDispatch } from "../src/opf/dispatch.js";
import { maxLoad } from "../src/opf/loadability.js";

/**
 * `node scripts/opf-measure.js`: the measures of J3 (P4, P5) on PGLib's IEEE 14, 30 and 118. The dispatch against
 * BASELINE.md's DC costs (PowerModels' convention), and under the model's (MATPOWER's); how far the load grows without
 * and with the N-1 rule, beside J2's proportional sharing (docs/mesures/cascade-j2.json); the price of security, load
 * factor by load factor; the time of a solve. Writes docs/mesures/opf-j3.json, prints the tables of
 * docs/mesures/opf-j3.md.
 */
const BASELINE = { 14: [2051.5, 4797.6], 30: [7472.8, 16145], 118: [93101, 231290] };
const SIZES = [14, 30, 118];
const read = (/** @type {number} */ size, variant = "") =>
  JSON.parse(readFileSync(new URL(`../data/pglib_opf_case${size}_ieee` + (variant ? `__${variant}` : "") + ".json", import.meta.url), "utf8"));
const french = (/** @type {number} */ value, digits = 1) => value.toFixed(digits).replace(".", ",");
const median = (/** @type {number[]} */ values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

function validation() {
  return SIZES.flatMap((size) => ["", "api", "sad"].map((variant, i) => {
    const data = read(size, variant);
    const pm = solveDispatch(createGrid(data, { convention: "powermodels" }));
    const mp = solveDispatch(createGrid(data));
    return { size, variant: variant || "typ", baseline: BASELINE[size][i] ?? null, powermodels: pm.status === "optimal" ? pm.cost : pm.status, matpower: mp.status === "optimal" ? mp.cost : mp.status };
  }));
}

/** The time of a solve, in ms, the median of `runs`. */
function timeOf(/** @type {() => unknown} */ solve, runs = 15) {
  return median(Array.from({ length: runs }, () => {
    const started = performance.now();
    solve();
    return performance.now() - started;
  }));
}

/** The dispatch without and with the N-1 rule at one load factor. */
function securityAt(grid, /** @type {number} */ loadFactor) {
  const plain = solveDispatch(grid, { loadFactor });
  const secure = solveDispatch(grid, { loadFactor, security: true });
  const spread = (/** @type {Float64Array} */ prices) => [Math.min(...prices), Math.max(...prices)];
  return { loadFactor, plain: plain.cost, secure: secure.cost ?? null, binding: plain.binding.length, secureBinding: secure.binding?.length ?? null, prices: spread(plain.prices), securePrices: secure.prices ? spread(secure.prices) : null, passes: secure.passes, rows: secure.rows };
}

function measureGrid(/** @type {number} */ size, j2) {
  const grid = createGrid(read(size));
  const n0 = maxLoad(grid, { step: 1e-4 }).factor;
  const n1 = maxLoad(grid, { security: true, step: 1e-4 }).factor;
  const factors = Array.from({ length: 20 }, (_, i) => Math.round((0.4 + 0.05 * i) * 100) / 100).filter((f) => f <= n0);
  const proportional = j2.results.find((r) => r.size === size);
  return {
    size,
    capacity: grid.pmax.reduce((a, b) => a + b, 0) / grid.load.reduce((a, b) => a + b, 0),
    n0,
    n1,
    proportional: { n0: proportional.n0, n1: proportional.n1.factor },
    rows: factors.map((f) => securityAt(grid, f)),
    ms: { plain: timeOf(() => solveDispatch(grid, { loadFactor: 0.6 })), secure: timeOf(() => solveDispatch(grid, { loadFactor: 0.6, security: true })) },
  };
}

function printValidation(rows) {
  console.log("| Réseau | Cas | BASELINE.md | Nous, convention PowerModels | Écart | Nous, convention MATPOWER |");
  console.log("|---|---|---|---|---|---|");
  for (const r of rows) {
    const ours = typeof r.powermodels === "number" ? french(r.powermodels, 3) : r.powermodels;
    const gap = typeof r.powermodels === "number" && r.baseline ? `${french(r.powermodels - r.baseline, 3)} $/h` : "–";
    const mp = typeof r.matpower === "number" ? french(r.matpower, 1) : r.matpower;
    console.log(`| IEEE ${r.size} | ${r.variant} | ${r.baseline === null ? "infaisable" : french(r.baseline, 1)} | ${ours} | ${gap} | ${mp} |`);
  }
}

function printGrid(result) {
  const { size, n0, n1, proportional, capacity, ms } = result;
  console.log(`\n### IEEE ${size}\n`);
  console.log(`Capacité : ${french(capacity, 3)} fois la charge. N-0 : ${french(n0, 3)} (J2 : ${proportional.n0 ?? "> 1,6"}) ; N-1 : ${french(n1, 3)} (J2 : ${proportional.n1}). Une répartition : ${french(ms.plain, 2)} ms, N-1 : ${french(ms.secure, 2)} ms.\n`);
  console.log("| Facteur | Coût ($/h) | Coût N-1 | Prix de la sécurité | Prix nodaux | Prix nodaux N-1 | Lignes qui lient (N-1) |");
  console.log("|---|---|---|---|---|---|---|");
  const range = (p) => (p ? `${french(p[0], 2)} à ${french(p[1], 2)}` : "–");
  for (const r of result.rows) {
    const price = r.secure === null ? "infaisable" : `+${french(100 * (r.secure / r.plain - 1), 1)} %`;
    console.log(`| ${french(r.loadFactor, 2)} | ${french(r.plain, 1)} | ${r.secure === null ? "–" : french(r.secure, 1)} | ${price} | ${range(r.prices)} | ${range(r.securePrices)} | ${r.binding} (${r.secureBinding ?? "–"}) |`);
  }
}

const j2 = JSON.parse(readFileSync(new URL("../docs/mesures/cascade-j2.json", import.meta.url), "utf8"));
const checks = validation();
printValidation(checks);
const results = SIZES.map((size) => measureGrid(size, j2));
results.forEach(printGrid);
writeFileSync(new URL("../docs/mesures/opf-j3.json", import.meta.url), `${JSON.stringify({ validation: checks, results }, null, 1)}\n`);
