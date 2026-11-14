/**
 * The text around the map: the summary of a state, the table of branches (the map's figures, readable without
 * colour), and the tooltip of the branch or bus under the pointer.
 */

import { branchName, mw, pct, productionByBus } from "./view.js";

function item(/** @type {HTMLElement} */ list, /** @type {string} */ term, /** @type {string} */ value) {
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");
  dt.textContent = term;
  dd.textContent = value;
  list.append(dt, dd);
}

function islandsText(grid, state) {
  if (state.islands.length === 1) return "1, le réseau est d'un seul tenant";
  const stranded = state.islands.filter((island) => island.capacity === 0 && island.production > 0.05);
  const loss = stranded.reduce((sum, island) => sum + island.production, 0);
  return stranded.length === 0 ? `${state.islands.length}` : `⚠ ${state.islands.length}, dont ${stranded.length} sans production : ${mw(loss)} à délester`;
}

/** The summary of a state, in the definition list `list`. */
export function renderSummary(list, grid, state, /** @type {number} */ loadFactor) {
  list.replaceChildren();
  const load = grid.load.reduce((sum, value) => sum + value, 0) * loadFactor;
  item(list, "Consommation", `${mw(load)} (× ${loadFactor.toFixed(2).replace(".", ",")})`);
  const main = state.islands[state.flows.islands.of[grid.reference]];
  const over = main.production > main.capacity ? " ⚠ au-delà de sa Pmax : il faudra répartir (J3)" : "";
  item(list, `Référence (nœud ${grid.busId[main.bus]})`, `${mw(main.production)} sur ${mw(main.capacity)}${over}`);
  let top = 0;
  for (let k = 1; k < grid.branchCount; k += 1) if (state.loading[k] > state.loading[top]) top = k;
  item(list, "Ligne la plus chargée", `${branchName(grid, top)}, ${pct(state.loading[top])}`);
  const names = state.overloaded.map((k) => branchName(grid, k)).join(", ");
  item(list, "Surcharges", state.overloaded.length === 0 ? "aucune" : `⚠ ${state.overloaded.length} : ${names}`);
  item(list, "Îlots", islandsText(grid, state));
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
      row.classList.toggle("overloaded", r.loading > 1);
      const sign = r.change > 0 ? "+" : "−";
      const change = Math.abs(r.change) < 0.05 ? "–" : sign + mw(Math.abs(r.change));
      [r.name, r.open ? "ouverte" : r.direction, mw(r.flow), mw(r.limit), (r.loading > 1 ? "⚠ " : "") + pct(r.loading), change].forEach((text) => cell(row, text));
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
