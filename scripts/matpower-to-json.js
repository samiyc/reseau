import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

/**
 * `node scripts/matpower-to-json.js data/pglib/<case>.m data/<case>.json`: a MATPOWER case file (as PGLib-OPF ships
 * them) to the JSON that src/grid/case.js reads. The matrices are kept as they are, with the names of their columns
 * (MATPOWER's manual, appendix B); the header's provenance lines are kept too. Run once per case; the JSON is
 * committed, the conversion tested (tests/case.test.js).
 */
const COLUMNS = {
  bus: ["bus_i", "type", "Pd", "Qd", "Gs", "Bs", "area", "Vm", "Va", "baseKV", "zone", "Vmax", "Vmin"],
  gen: ["bus", "Pg", "Qg", "Qmax", "Qmin", "Vg", "mBase", "status", "Pmax", "Pmin"],
  branch: ["fbus", "tbus", "r", "x", "b", "rateA", "rateB", "rateC", "ratio", "angle", "status", "angmin", "angmax"],
  gencost: ["model", "startup", "shutdown", "n", "c2", "c1", "c0"],
};

/** The rows of `mpc.<name> = [ ... ];`, each a list of numbers, comments left out. */
export function matrixOf(text, name) {
  const start = text.indexOf(`mpc.${name} = [`);
  if (start < 0) throw new Error(`mpc.${name} absent`);
  const end = text.indexOf("];", start);
  return text
    .slice(text.indexOf("\n", start) + 1, end)
    .split("\n")
    .map((line) => (line.includes("%") ? line.slice(0, line.indexOf("%")) : line).replace(/;/g, " ").trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(/\s+/).map(Number));
}

/** The case as JSON: provenance, base, and the four matrices with their columns. */
export function caseFromMatpower(text, name) {
  const header = text.split("\n").filter((line) => line.startsWith("%"));
  const version = header.map((line) => /v(\d\d\.\d\d)/.exec(line)).find(Boolean);
  const license = header.some((line) => line.includes("Creative Commons Attribution 4.0")) ? "CC BY 4.0" : "?";
  const matrices = Object.fromEntries(
    Object.entries(COLUMNS).map(([key, columns]) => {
      const rows = matrixOf(text, key);
      if (rows.some((row) => row.length > columns.length)) throw new Error(`mpc.${key} : colonnes inattendues`);
      return [key, { columns: columns.slice(0, rows[0].length), rows }];
    }),
  );
  return {
    name,
    source: `https://github.com/power-grid-lib/pglib-opf (${name}.m)`,
    version: version ? `v${version[1]}` : "?",
    license,
    baseMVA: Number(/mpc\.baseMVA = ([\d.]+)/.exec(text)[1]),
    ...matrices,
  };
}

if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  const [input, output] = process.argv.slice(2);
  const data = /** @type {import("../src/types.js").CaseData} */ (caseFromMatpower(readFileSync(input, "utf8").replace(/\r\n/g, "\n"), basename(input, ".m")));
  writeFileSync(output, `${JSON.stringify(data)}\n`);
  console.log(`${output} : ${data.bus.rows.length} nœuds, ${data.branch.rows.length} branches, ${data.gen.rows.length} groupes`);
}
