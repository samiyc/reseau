/**
 * The page (`npm run page`, port 4808): PGLib's IEEE 14 on a map, its DC power flow, the lines coloured by their
 * loading. A click on a line opens or closes it, the slider scales the load; the model (src/) recomputes, the page
 * only draws and listens.
 */

import { createGrid } from "../src/grid/case.js";
import { describeState } from "../src/grid/state.js";
import { RAMP_GRADIENT } from "./color.js";
import { LAYOUT_14 } from "./layout.js";
import { createMap, paintMap } from "./map.js";
import { renderSummary, renderTable, showTip } from "./panel.js";
import { branchName, buildView, tableRows } from "./view.js";

const byId = (/** @type {string} */ id) => document.getElementById(id);
const readJson = async (/** @type {string} */ path) => (await fetch(path)).json();

const [data, changelog] = await Promise.all([readJson("../data/pglib_opf_case14_ieee.json"), readJson("../docs/changelog.json")]);
const grid = createGrid(data);
const page = { inService: Uint8Array.from(grid.inService), loadFactor: 1, state: null };

const map = createMap(/** @type {SVGSVGElement} */ (/** @type {unknown} */ (byId("map"))), grid, LAYOUT_14, {
  branch(/** @type {number} */ k) {
    page.inService[k] = page.inService[k] ? 0 : 1;
    refresh();
  },
  hover(target, event) {
    showTip(byId("tip"), target, event, { grid, state: page.state, inService: page.inService });
  },
});

/** The state in the address, to share it: `#ouvertes=1-5,4-9&conso=1.3`. */
function readAddress() {
  const params = new URLSearchParams(location.hash.slice(1));
  const open = new Set((params.get("ouvertes") ?? "").split(",").filter(Boolean));
  for (let k = 0; k < grid.branchCount; k += 1) if (open.has(branchName(grid, k))) page.inService[k] = 0;
  const load = Number(params.get("conso"));
  if (load >= 0.5 && load <= 1.6) page.loadFactor = load;
  const slider = /** @type {HTMLInputElement} */ (byId("load"));
  slider.value = String(page.loadFactor);
}

function writeAddress() {
  const open = [...page.inService.keys()].filter((k) => !page.inService[k] && grid.inService[k]).map((k) => branchName(grid, k));
  const params = new URLSearchParams();
  if (open.length > 0) params.set("ouvertes", open.join(","));
  if (page.loadFactor !== 1) params.set("conso", String(page.loadFactor));
  history.replaceState(null, "", params.size > 0 ? `#${params.toString().replaceAll("%2C", ",")}` : location.pathname);
}

function refresh() {
  writeAddress();
  const { loadFactor, inService } = page;
  page.state = { ...describeState(grid, { loadFactor, inService }), loadFactor };
  const intact = describeState(grid, { loadFactor }).flows.flow;
  paintMap(map, buildView(grid, page.state, inService));
  renderSummary(byId("summary"), grid, page.state, loadFactor);
  renderTable(byId("rows"), tableRows(grid, page.state, inService, intact));
  byId("load-label").textContent = `× ${loadFactor.toFixed(2).replace(".", ",")}`;
  byId("reset").toggleAttribute("disabled", inService.every((on, k) => on === grid.inService[k]));
}

byId("load").addEventListener("input", (event) => {
  page.loadFactor = Number(/** @type {HTMLInputElement} */ (event.target).value);
  refresh();
});
byId("reset").addEventListener("click", () => {
  page.inService.set(grid.inService);
  refresh();
});
byId("legend-ramp").style.background = RAMP_GRADIENT;
byId("version").textContent = `version ${changelog.versions[0].version}`;
byId("source").textContent = `${data.name}, PGLib-OPF ${data.version} (${data.license})`;
readAddress();
refresh();
