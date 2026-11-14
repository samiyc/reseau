/**
 * The colour of a branch's loading: one hue, light to dark, from empty to its limit (the dataviz skill's sequential
 * blue, steps 250 to 700); past its limit, the critical red, which the page never shows without a "⚠" and a figure.
 */

import { OVERLOAD } from "../src/grid/state.js";
const RAMP = ["#86b6ef", "#5598e7", "#256abf", "#184f95", "#0d366b"].map((hex) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)));

export const CRITICAL = "#d03b3b";

/** The CSS gradient of the legend, from 0 to 100 %. */
const rgb = (/** @type {number[]} */ [r, g, b]) => `rgb(${r} ${g} ${b})`;
export const RAMP_GRADIENT = `linear-gradient(to right, ${RAMP.map(rgb).join(", ")})`;

/** The colour of a loading (flow / limit). */
export function loadingColor(/** @type {number} */ loading) {
  if (loading > OVERLOAD) return CRITICAL;
  const position = Math.max(0, loading) * (RAMP.length - 1);
  const low = Math.min(Math.floor(position), RAMP.length - 2);
  const t = position - low;
  return rgb(RAMP[low].map((value, i) => Math.round(value + t * (RAMP[low + 1][i] - value))));
}
