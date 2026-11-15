import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `node scripts/rts-fetch.js`: downloads RTS-GMLC (GridMod/RTS-GMLC, pinned to one commit) into data/rts-gmlc/brut/,
 * which git ignores: the grid's source files and the 2020 series, day-ahead (hourly) and real-time (5 minutes),
 * about 50 MB. A file already there is kept. scripts/rts-convert.js then writes what the repository keeps.
 */
import { COMMIT } from "./rts-source.js";
const BASE = `https://raw.githubusercontent.com/GridMod/RTS-GMLC/${COMMIT}/RTS_Data/`;
const SOURCE = ["README.md", "bus.csv", "branch.csv", "dc_branch.csv", "gen.csv", "reserves.csv", "storage.csv", "simulation_objects.csv", "timeseries_pointers.csv"];
const SERIES = {
  Load: ["DAY_AHEAD_regional_Load.csv", "REAL_TIME_regional_Load.csv"],
  WIND: ["DAY_AHEAD_wind.csv", "REAL_TIME_wind.csv"],
  PV: ["DAY_AHEAD_pv.csv", "REAL_TIME_pv.csv"],
  RTPV: ["DAY_AHEAD_rtpv.csv", "REAL_TIME_rtpv.csv"],
  Hydro: ["DAY_AHEAD_hydro.csv", "REAL_TIME_hydro.csv"],
  CSP: ["DAY_AHEAD_Natural_Inflow.csv", "REAL_TIME_Natural_Inflow.csv"],
  Reserves: ["DAY_AHEAD_regional_Spin_Up_R1.csv", "DAY_AHEAD_regional_Spin_Up_R2.csv", "DAY_AHEAD_regional_Spin_Up_R3.csv", "DAY_AHEAD_regional_Reg_Up.csv", "DAY_AHEAD_regional_Reg_Down.csv", "DAY_AHEAD_regional_Flex_Up.csv", "DAY_AHEAD_regional_Flex_Down.csv"],
};
const OUT = new URL("../data/rts-gmlc/brut/", import.meta.url);

const files = [
  ...SOURCE.map((name) => [`SourceData/${name}`, `SourceData/${name}`]),
  ["timeseries_data_files/README.md", "timeseries/README.md"],
  ...Object.entries(SERIES).flatMap(([dir, names]) => names.map((name) => [`timeseries_data_files/${dir}/${name}`, `timeseries/${dir}/${name}`])),
];
let bytes = 0;
for (const [remote, local] of files) {
  const target = new URL(local, OUT);
  if (existsSync(target)) continue;
  const response = await fetch(BASE + remote, { headers: { "User-Agent": "reseau-data-fetch" } });
  if (!response.ok) throw new Error(`${remote}: HTTP ${response.status}`);
  const body = Buffer.from(await response.arrayBuffer());
  mkdirSync(dirname(fileURLToPath(target)), { recursive: true });
  writeFileSync(target, body);
  bytes += body.length;
  console.log(`${(body.length / 1e6).toFixed(2)} Mo  ${local}`);
}
console.log(`${files.length} fichiers, ${(bytes / 1e6).toFixed(1)} Mo téléchargés (commit ${COMMIT.slice(0, 7)})`);
