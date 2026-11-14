/**
 * The text around the map: the summary of a state, the table of branches (the map's figures, readable without
 * colour), and the tooltip of the branch or bus under the pointer.
 */

import { OVERLOAD } from "../src/grid/state.js";
import { branchName, mw, pct, productionByBus } from "./view.js";

function item(/** @type {HTMLElement} */ list, /** @type {string} */ term, /** @type {string} */ value) {
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");
  dt.textContent = term;
  dd.textContent = value;
  list.append(dt, dd);
}

const total = (/** @type {object[]} */ parts, /** @type {string} */ key) => parts.reduce((sum, part) => sum + part[key], 0);

function islandsText(state) {
  if (state.islands.length === 1) return "1, le réseau est d'un seul tenant";
  const short = state.islands.filter((island) => island.shed > 0.05).length;
  return short === 0 ? `${state.islands.length}` : `⚠ ${state.islands.length}, dont ${short} sans assez de production`;
}

/** The summary of a state, in the definition list `list`. */
export function renderSummary(list, grid, state, /** @type {number} */ loadFactor) {
  list.replaceChildren();
  const demand = total(state.islands, "demand");
  item(list, "Consommation", `${mw(demand)} (× ${loadFactor.toFixed(2).replace(".", ",")})`);
  const installed = grid.pmax.reduce((sum, value) => sum + value, 0);
  const production = total(state.islands, "production");
  item(list, "Production", `${mw(production)}, ${pct(production / installed)} de la capacité installée (${mw(installed)})`);
  item(list, "Délestage", state.shed > 0.05 ? `⚠ ${mw(state.shed)}, ${pct(state.shed / demand)} de la consommation` : "aucun");
  let top = 0;
  for (let k = 1; k < grid.branchCount; k += 1) if (state.loading[k] > state.loading[top]) top = k;
  item(list, "Ligne la plus chargée", `${branchName(grid, top)}, ${pct(state.loading[top])}`);
  const names = state.overloaded.map((k) => branchName(grid, k)).join(", ");
  item(list, "Surcharges", state.overloaded.length === 0 ? "aucune" : `⚠ ${state.overloaded.length} : ${names}`);
  item(list, "Îlots", islandsText(state));
  if (state.setpoints) dispatchItems(list, state.setpoints);
}

const dollars = (/** @type {number} */ value, digits = 0) => `${value.toLocaleString("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: digits })} $`;

/** Whether the dispatch holds the N-1 rule, and how far past it the worst loss puts a line. */
function n1Text(setpoints) {
  if (setpoints.secure) return "tenue : la perte d'une ligne n'en surcharge aucune autre";
  if (setpoints.margin === null) return "non vérifiée : la répartition est la moins chère";
  return `intenable : après la pire perte, une ligne à ${pct(setpoints.margin)} de sa limite, au plus`;
}

/** The cost of the dispatch and the spread of its nodal prices. */
function dispatchItems(list, setpoints) {
  item(list, "Coût de la répartition", `${dollars(setpoints.cost)}/h`);
  item(list, "Règle N-1", n1Text(setpoints));
  if (!setpoints.prices) {
    item(list, "Prix nodaux", "sans objet : la répartition déleste");
    return;
  }
  const [low, high] = [Math.min(...setpoints.prices), Math.max(...setpoints.prices)];
  const spread = high - low < 0.005 ? `${dollars(low, 2)}/MWh partout, aucune ligne ne lie` : `de ${dollars(low, 2)} à ${dollars(high, 2)}/MWh`;
  item(list, "Prix nodaux", spread);
}

function cell(/** @type {HTMLTableRowElement} */ row, /** @type {string} */ text) {
  const td = document.createElement("td");
  td.textContent = text;
  row.append(td);
}

/** The table of branches, in `body`. */
export function renderTable(/** @type {HTMLElement} */ body, rows) {
  body.replaceChildren(
    ...rows.map((r) => {
      const row = document.createElement("tr");
      row.classList.toggle("open", r.open);
      row.classList.toggle("overloaded", r.loading > OVERLOAD);
      const sign = r.change > 0 ? "+" : "−";
      const change = Math.abs(r.change) < 0.05 ? "–" : sign + mw(Math.abs(r.change));
      [r.name, r.open ? "hors service" : r.direction, mw(r.flow), mw(r.limit), (r.loading > OVERLOAD ? "⚠ " : "") + pct(r.loading), change].forEach((text) => cell(row, text));
      return row;
    }),
  );
}

function branchTip(grid, state, /** @type {number} */ k, /** @type {Uint8Array} */ inService) {
  const flow = state.flows.flow[k];
  const head = `Ligne ${branchName(grid, k)}`;
  if (!inService[k]) return `${head} : ouverte. Un clic la remet en service.`;
  const [from, to] = flow >= 0 ? [grid.from[k], grid.to[k]] : [grid.to[k], grid.from[k]];
  const way = `de ${grid.busId[from]} vers ${grid.busId[to]}`;
  return `${head} : ${mw(Math.abs(flow))} ${way}, limite ${mw(grid.rate[k])}, ${pct(state.loading[k])}. Un clic l'ouvre.`;
}

function busTip(grid, state, /** @type {number} */ i) {
  const production = productionByBus(grid, state)[i];
  const reference = state.islands.some((island) => island.bus === i) ? ", référence de son îlot" : "";
  return `Nœud ${grid.busId[i]}${reference} : consommation ${mw(grid.load[i] * state.loadFactor)}, production ${mw(production)}.`;
}

/** Shows (or hides, `target` null) the tooltip of a branch or a bus near the pointer. */
export function showTip(/** @type {HTMLElement} */ tip, target, event, context) {
  tip.hidden = !target;
  if (!target) return;
  const { grid, state, inService } = context;
  tip.textContent = target.kind === "branch" ? branchTip(grid, state, target.index, inService) : busTip(grid, state, target.index);
  tip.style.left = `${event.clientX + 14}px`;
  tip.style.top = `${event.clientY + 14}px`;
}
