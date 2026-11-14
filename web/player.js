/**
 * The cascade on the page: its frames (the state before it, then the state at the end of each step), and the text that
 * says what happens at a frame. The model (src/cascade/cascade.js) runs it; this only lays it out.
 */

import { runCascade } from "../src/cascade/cascade.js";
import { describeState } from "../src/grid/state.js";
import { branchName, mw, pct } from "./view.js";

/** The frames of the cascade that starts from `inService` at `loadFactor`, around the dispatch's `setpoints`. */
export function buildFrames(grid, /** @type {number} */ loadFactor, /** @type {Uint8Array} */ inService, setpoints) {
  const start = Uint8Array.from(inService);
  const result = runCascade(grid, { loadFactor, inService: start, setpoints }, { keep: true });
  const first = { state: describeState(grid, { loadFactor, inService: start, setpoints }), inService: start, tripped: [] };
  const frames = [first, ...result.steps.map((step) => ({ state: step.state, inService: step.inService, tripped: step.tripped }))];
  return frames.map((frame) => ({ ...frame, state: { ...frame.state, loadFactor }, trippedSet: new Set(frame.tripped.map((t) => t.branch)) }));
}

const reason = (t) => (t.why === "hard" ? `${pct(t.loading)}, plus de deux fois sa limite` : `${pct(t.loading)}, 3e pas de surcharge`);

/** What happens at frame `index`, in a sentence or two. */
export function frameText(grid, frames, /** @type {number} */ index) {
  const frame = frames[index];
  if (index === 0) {
    const overloaded = frame.state.overloaded.map((k) => branchName(grid, k)).join(", ");
    return overloaded ? `Avant la cascade : en surcharge, ${overloaded}.` : "Avant la cascade : aucune ligne en surcharge, le réseau tient.";
  }
  const fell = frame.tripped.map((t) => `${branchName(grid, t.branch)} (${reason(t)})`).join(" ; ");
  const lost = frames.slice(1, index + 1).reduce((sum, f) => sum + f.tripped.length, 0);
  const demand = frame.state.islands.reduce((sum, island) => sum + island.demand, 0);
  const shed = frame.state.shed > 0.05 ? `, ${mw(frame.state.shed)} délestés (${pct(frame.state.shed / demand)})` : "";
  const now = fell ? `Tombent : ${fell}.` : "Rien ne tombe à ce pas.";
  const end = index === frames.length - 1 ? " Le réseau tient : fin de la cascade." : "";
  return `Pas ${index} : ${now} En tout, ${lost} ligne(s) perdue(s)${shed}.${end}`;
}
