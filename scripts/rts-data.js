import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createGrid } from "../src/grid/case.js";
import { createDay } from "../src/day/rts.js";

/** RTS-GMLC as the scripts read it (data/, scripts/rts-convert.js): its JSON, its grid, its series by hour. */
export function loadRts() {
  const data = JSON.parse(readFileSync(new URL("../data/rts_gmlc.json", import.meta.url), "utf8"));
  const series = JSON.parse(gunzipSync(readFileSync(new URL("../data/rts_gmlc_series.json.gz", import.meta.url))).toString("utf8"));
  const grid = createGrid(data);
  return { data, series, grid, day: (/** @type {number} */ index) => createDay(grid, data, series, index) };
}

/**
 * The days of J4's measure (docs/mesures/journee-j4.md): the even days of 2020 train the rule (183, seed s is day
 * 2(s − 1)), the odd days measure it (183, seed s is day 2s − 1). Seeds count from 1, as mcts-race's.
 */
export const dayOfSeed = (/** @type {"train" | "test"} */ set, /** @type {number} */ seed) => (set === "train" ? 2 * (seed - 1) : 2 * seed - 1);

/**
 * A variant's name as the rule's settings: "v0.25-h24" is the published reserve once, a margin of 25 % on the wind
 * and sun forecast, units held on 24 hours; "r2-" before it sets the reserve to twice the published one, "-nofast"
 * after it forbids the fast start (src/day/day.js).
 */
export function settingsOf(/** @type {string} */ variant) {
  const match = /^(?:r([\d.]+)-)?v([\d.]+)-h(\d+)(-nofast)?$/.exec(variant);
  if (!match) throw new Error(`variante illisible : ${variant}`);
  return { reserve: match[1] === undefined ? 1 : Number(match[1]), renewable: Number(match[2]), hold: Number(match[3]), fastStart: !match[4] };
}
