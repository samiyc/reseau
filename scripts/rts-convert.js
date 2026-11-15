import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { COMMIT } from "./rts-source.js";

/**
 * `node scripts/rts-convert.js`: from data/rts-gmlc/brut/ (scripts/rts-fetch.js), writes what the repository keeps.
 * - data/rts_gmlc.json: the grid in the matrices of scripts/matpower-to-json.js, so that createGrid reads it, plus
 *   `units`, what the commitment needs of each generator (docs/modele.md § 10).
 * - data/rts_gmlc_series.json.gz: the 2020 series by hour, the day-ahead forecast and the real time (the mean of each
 *   hour's twelve 5-minute values), in MW to 0.1: the load of each area, the output of each renewable or hydro unit,
 *   and the day-ahead reserve requirements.
 */
const RAW = new URL("../data/rts-gmlc/brut/", import.meta.url);
const read = (/** @type {string} */ path) => readFileSync(new URL(path, RAW), "utf8").trim().split(/\r?\n/);

/** A CSV as its header and rows of strings (no quoted commas in the files read here, but reserves.csv). */
function csv(/** @type {string} */ path) {
  const [head, ...lines] = read(path);
  const header = head.split(",");
  return lines.map((line) => Object.fromEntries(line.split(",").map((value, i) => [header[i], value])));
}

const BUS_TYPE = { PQ: 1, PV: 2, Ref: 3 };
const THERMAL = new Set(["CT", "CC", "STEAM", "NUCLEAR"]);
const SERIES_KIND = { WIND: "available", PV: "available", CSP: "available", HYDRO: "fixed", ROR: "fixed", RTPV: "fixed" };

function busMatrix(/** @type {Record<string, string>[]} */ rows) {
  const columns = ["bus_i", "type", "Pd", "Qd", "Gs", "Bs", "area", "Vm", "Va", "baseKV", "zone", "Vmax", "Vmin", "lat", "lng"];
  const row = (b) => [+b["Bus ID"], BUS_TYPE[b["Bus Type"]], +b["MW Load"], +b["MVAR Load"], +b["MW Shunt G"], +b["MVAR Shunt B"], +b.Area, +b["V Mag"], +b["V Angle"], +b.BaseKV, +b.Zone, 1.05, 0.95, +b.lat, +b.lng];
  return { columns, rows: rows.map(row) };
}

function branchMatrix(/** @type {Record<string, string>[]} */ rows) {
  const columns = ["fbus", "tbus", "r", "x", "b", "rateA", "rateB", "rateC", "ratio", "angle", "status", "angmin", "angmax"];
  const row = (l) => [+l["From Bus"], +l["To Bus"], +l.R, +l.X, +l.B, +l["Cont Rating"], +l["LTE Rating"], +l["STE Rating"], +l["Tr Ratio"], 0, 1, -360, 360];
  return { columns, rows: rows.map(row), uid: rows.map((l) => l.UID) };
}

/** A thermal unit's cost: the cost at its first output point, then the marginal cost of each segment up to Pmax. */
function curveOf(/** @type {Record<string, string>} */ g) {
  const pmax = +g["PMax MW"];
  const price = +g["Fuel Price $/MMBTU"];
  const vom = +g.VOM || 0;
  const points = [0, 1, 2, 3].map((i) => Math.round(+g[`Output_pct_${i}`] * pmax * 1000) / 1000);
  const marginal = [1, 2, 3].map((i) => (+g[`HR_incr_${i}`] * price) / 1000 + vom);
  return { points, base: (points[0] * +g.HR_avg_0 * price) / 1000 + vom * points[0], marginal };
}

/** What the commitment needs of a generator; for a thermal unit, its curve, its times and its start costs. */
function unitOf(/** @type {Record<string, string>} */ g, /** @type {Map<number, number>} */ areaOf) {
  const unit = { uid: g["GEN UID"], type: g["Unit Type"], category: g.Category, area: areaOf.get(+g["Bus ID"]), series: SERIES_KIND[g["Unit Type"]] ?? null };
  if (!THERMAL.has(unit.type)) return unit;
  const price = +g["Fuel Price $/MMBTU"];
  const startCost = ["Cold", "Warm", "Hot"].map((state) => +g[`Start Heat ${state} MBTU`] * price + (+g["Non Fuel Start Cost $"] || 0));
  const times = { minUp: +g["Min Up Time Hr"], minDown: +g["Min Down Time Hr"], ramp: 60 * +g["Ramp Rate MW/Min"] };
  const start = { coldAfter: +g["Start Time Cold Hr"], warmAfter: +g["Start Time Warm Hr"], cost: startCost };
  return { ...unit, ...times, start, curve: curveOf(g), outage: { rate: +g.FOR, mttf: +g["MTTF Hr"], mttr: +g["MTTR Hr"] } };
}

/** The generators, with a linear cost at the full-load average (the commitment uses `units`), and their units. */
function genMatrices(/** @type {Record<string, string>[]} */ rows, /** @type {Map<number, number>} */ areaOf) {
  const units = rows.map((g) => unitOf(g, areaOf));
  const fullLoad = (unit, pmax) => (unit.curve ? (unit.curve.base + unit.curve.marginal.reduce((sum, m, i) => sum + m * (unit.curve.points[i + 1] - unit.curve.points[i]), 0)) / pmax : 0);
  const on = (unit) => (unit.type === "SYNC_COND" || unit.type === "STORAGE" ? 0 : 1);
  const gen = { columns: ["bus", "Pg", "Qg", "Qmax", "Qmin", "Vg", "mBase", "status", "Pmax", "Pmin"], rows: rows.map((g, i) => [+g["Bus ID"], +g["MW Inj"], +g["MVAR Inj"], +g["QMax MVAR"], +g["QMin MVAR"], +g["V Setpoint p.u."], 100, on(units[i]), +g["PMax MW"], +g["PMin MW"]]) };
  const gencost = { columns: ["model", "startup", "shutdown", "n", "c2", "c1", "c0"], rows: rows.map((g, i) => [2, 0, 0, 3, 0, Math.round(fullLoad(units[i], +g["PMax MW"]) * 1e4) / 1e4, 0]) };
  return { gen, gencost, units };
}

function writeGrid() {
  const buses = csv("SourceData/bus.csv");
  const areaOf = new Map(buses.map((b) => [+b["Bus ID"], +b.Area]));
  const branch = branchMatrix(csv("SourceData/branch.csv"));
  const source = `GridMod/RTS-GMLC, commit ${COMMIT}, RTS_Data/SourceData`;
  const data = { name: "RTS-GMLC", source, version: COMMIT.slice(0, 7), license: "NREL/DOE: free use, citing DOE/NREL/Alliance", baseMVA: 100, bus: busMatrix(buses), branch: { columns: branch.columns, rows: branch.rows }, branchUid: branch.uid, ...genMatrices(csv("SourceData/gen.csv"), areaOf) };
  writeFileSync(new URL("../data/rts_gmlc.json", import.meta.url), `${JSON.stringify(data)}\n`);
  return data;
}

const round = (/** @type {number} */ value) => Math.round(value * 10) / 10;

/** A series file's columns by hour: hourly files as they are, 5-minute files averaged by hour. */
function hourly(/** @type {string} */ path, /** @type {number} */ perHour) {
  const [head, ...lines] = read(path);
  const names = head.split(",").slice(4);
  const values = names.map(() => new Float64Array(lines.length / perHour));
  lines.forEach((line, i) => line.split(",").slice(4).forEach((v, c) => (values[c][Math.floor(i / perHour)] += +v / perHour)));
  return Object.fromEntries(names.map((name, c) => [name, Array.from(values[c], round)]));
}

/** A daily table of 24 hourly columns (Reg, Flex), as one column by hour. */
function daily(/** @type {string} */ path) {
  const [, ...lines] = read(path);
  return lines.flatMap((line) => line.split(",").slice(3).map((v) => round(+v)));
}

function writeSeries() {
  const files = (/** @type {string} */ prefix, /** @type {number} */ perHour) => {
    const of = (/** @type {string} */ dir, /** @type {string} */ name) => hourly(`timeseries/${dir}/${prefix}_${name}.csv`, perHour);
    return { load: of("Load", "regional_Load"), gen: { ...of("WIND", "wind"), ...of("PV", "pv"), ...of("RTPV", "rtpv"), ...of("CSP", "Natural_Inflow"), ...(prefix === "DAY_AHEAD" ? of("Hydro", "hydro") : {}) } };
  };
  const dayAhead = files("DAY_AHEAD", 1);
  const realTime = files("REAL_TIME", 12);
  const reserve = { ...["R1", "R2", "R3"].reduce((all, r) => ({ ...all, ...hourly(`timeseries/Reserves/DAY_AHEAD_regional_Spin_Up_${r}.csv`, 1) }), {}) };
  for (const name of ["Reg_Up", "Reg_Down", "Flex_Up", "Flex_Down"]) reserve[name] = daily(`timeseries/Reserves/DAY_AHEAD_regional_${name}.csv`);
  const hours = dayAhead.load["1"].length;
  const series = { source: `GridMod/RTS-GMLC, commit ${COMMIT}, RTS_Data/timeseries_data_files`, start: "2020-01-01", hours, note: "hydro: the real time is the day-ahead (README of the series)", dayAhead: { ...dayAhead, reserve }, realTime };
  const body = gzipSync(JSON.stringify(series), { level: 9 });
  writeFileSync(new URL("../data/rts_gmlc_series.json.gz", import.meta.url), body);
  return { hours, bytes: body.length };
}

const grid = writeGrid();
const series = writeSeries();
console.log(`data/rts_gmlc.json : ${grid.bus.rows.length} nœuds, ${grid.branch.rows.length} branches, ${grid.gen.rows.length} groupes`);
console.log(`data/rts_gmlc_series.json.gz : ${series.hours} heures, ${(series.bytes / 1e6).toFixed(2)} Mo`);
