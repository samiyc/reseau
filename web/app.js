/**
 * The page (`npm run page`, port 4808): PGLib's IEEE 14 on a map, its DC power flow, the lines coloured by their
 * loading. A click on a line opens or closes it, the slider scales the load, a button runs the cascade from there
 * and plays it step by step; the model (src/) computes, the page only draws and listens.
 */

import { createGrid } from "../src/grid/case.js";
import { describeState } from "../src/grid/state.js";
import { RAMP_GRADIENT } from "./color.js";
import { LAYOUT_14 } from "./layout.js";
import { createMap, paintMap } from "./map.js";
import { renderSummary, renderTable, showTip } from "./panel.js";
import { buildFrames, frameText } from "./player.js";
import { branchName, buildView, tableRows } from "./view.js";

const byId = (/** @type {string} */ id) => document.getElementById(id);
const input = (/** @type {string} */ id) => /** @type {HTMLInputElement} */ (byId(id));
const readJson = async (/** @type {string} */ path) => (await fetch(path)).json();
/** The pause between two steps of a cascade being played, in ms. */
const STEP_MS = 1100;

const [data, changelog] = await Promise.all([readJson("../data/pglib_opf_case14_ieee.json"), readJson("../docs/changelog.json")]);
const grid = createGrid(data);
const page = { inService: Uint8Array.from(grid.inService), loadFactor: 1, state: null, cascade: null, timer: 0 };

const map = createMap(/** @type {SVGSVGElement} */ (/** @type {unknown} */ (byId("map"))), grid, LAYOUT_14, {
  branch(/** @type {number} */ k) {
    stopCascade();
    page.inService[k] = page.inService[k] ? 0 : 1;
    refresh();
  },
  hover(target, event) {
    showTip(byId("tip"), target, event, { grid, state: page.state, inService: page.cascade ? page.cascade.frames[page.cascade.index].inService : page.inService });
  },
});

/** The state in the address, to share it: `#ouvertes=1-2&conso=1.3&pas=3` (with `pas`, the cascade runs). */
function readAddress() {
  const params = new URLSearchParams(location.hash.slice(1));
  const open = new Set((params.get("ouvertes") ?? "").split(",").filter(Boolean));
  for (let k = 0; k < grid.branchCount; k += 1) if (open.has(branchName(grid, k))) page.inService[k] = 0;
  const load = Number(params.get("conso"));
  if (load >= 0.5 && load <= 1.6) page.loadFactor = load;
  input("load").value = String(page.loadFactor);
  if (params.has("pas")) startCascade(Number(params.get("pas")) || 0, false);
}

function writeAddress() {
  const open = [...page.inService.keys()].filter((k) => !page.inService[k] && grid.inService[k]).map((k) => branchName(grid, k));
  const params = new URLSearchParams();
  if (open.length > 0) params.set("ouvertes", open.join(","));
  if (page.loadFactor !== 1) params.set("conso", String(page.loadFactor));
  if (page.cascade) params.set("pas", String(page.cascade.index));
  history.replaceState(null, "", params.size > 0 ? `#${params.toString().replaceAll("%2C", ",")}` : location.pathname);
}

function startCascade(/** @type {number} */ index = 0, play = true) {
  const frames = buildFrames(grid, page.loadFactor, page.inService);
  page.cascade = { frames, index: Math.min(Math.max(0, index), frames.length - 1) };
  input("frame").max = String(frames.length - 1);
  if (play) playCascade();
}

function playCascade() {
  clearInterval(page.timer);
  if (page.cascade.index === page.cascade.frames.length - 1) page.cascade.index = 0;
  page.timer = window.setInterval(() => {
    page.cascade.index += 1;
    if (page.cascade.index >= page.cascade.frames.length - 1) clearInterval(page.timer);
    refresh();
  }, STEP_MS);
}

function stopCascade() {
  clearInterval(page.timer);
  page.cascade = null;
}

/** What the page shows: the live state, or a frame of the cascade being played. */
function shown() {
  if (!page.cascade) return { state: { ...describeState(grid, page), loadFactor: page.loadFactor }, inService: page.inService, context: {} };
  const { frames, index } = page.cascade;
  const frame = frames[index];
  return { state: frame.state, inService: frame.inService, context: { tripped: frame.trippedSet, start: frames[0].inService } };
}

function refresh() {
  writeAddress();
  const { state, inService, context } = shown();
  page.state = state;
  const intact = describeState(grid, { loadFactor: page.loadFactor }).flows.flow;
  paintMap(map, buildView(grid, state, inService, context));
  renderSummary(byId("summary"), grid, state, page.loadFactor);
  renderTable(byId("rows"), tableRows(grid, state, inService, intact));
  byId("load-label").textContent = `× ${page.loadFactor.toFixed(2).replace(".", ",")}`;
  byId("reset").toggleAttribute("disabled", page.inService.every((on, k) => on === grid.inService[k]));
  byId("player").hidden = !page.cascade;
  if (page.cascade) {
    input("frame").value = String(page.cascade.index);
    byId("frame-label").textContent = `pas ${page.cascade.index} / ${page.cascade.frames.length - 1}`;
    byId("cascade-text").textContent = frameText(grid, page.cascade.frames, page.cascade.index);
  }
}

input("load").addEventListener("input", () => {
  stopCascade();
  page.loadFactor = Number(input("load").value);
  refresh();
});
byId("reset").addEventListener("click", () => {
  stopCascade();
  page.inService.set(grid.inService);
  refresh();
});
byId("run").addEventListener("click", () => {
  startCascade();
  refresh();
});
byId("play").addEventListener("click", playCascade);
byId("stop").addEventListener("click", () => {
  stopCascade();
  refresh();
});
input("frame").addEventListener("input", () => {
  clearInterval(page.timer);
  page.cascade.index = Number(input("frame").value);
  refresh();
});
byId("legend-ramp").style.background = RAMP_GRADIENT;
byId("version").textContent = `version ${changelog.versions[0].version}`;
byId("source").textContent = `${data.name}, PGLib-OPF ${data.version} (${data.license})`;
readAddress();
refresh();
