/**
 * What the page shows of a state (src/grid/state.js): the colour, width and label of each branch, the production at
 * each bus, the summary and the table. Numbers formatted in French.
 */

import { capacityByBus } from "../src/flow/islands.js";
import { loadingColor } from "./color.js";

const number = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const percent = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
export const mw = (/** @type {number} */ value) => `${number.format(Math.abs(value) < 0.05 ? 0 : value)} MW`;
export const pct = (/** @type {number} */ value) => `${percent.format(100 * value)} %`;

/** A line is labelled from this loading on: only the ones that matter carry a figure. */
const LABELLED = 0.7;

export const branchName = (grid, /** @type {number} */ k) => `${grid.busId[grid.from[k]]}-${grid.busId[grid.to[k]]}`;

function branchLabel(/** @type {boolean} */ open, /** @type {number} */ loading) {
  if (open) return "ouverte";
  if (loading > 1) return `⚠ ${pct(loading)}`;
  return loading >= LABELLED ? pct(loading) : "";
}

function branchView(grid, state, /** @type {Uint8Array} */ inService, /** @type {number} */ k) {
  const flow = state.flows.flow[k];
  const loading = state.loading[k];
  const open = !inService[k];
  return {
    open,
    overloaded: loading > 1,
    color: loadingColor(loading),
    width: 3 + 11 * Math.min(1, Math.abs(flow) / 250),
    arrow: !open && Math.abs(flow) > 0.05,
    reversed: flow < 0,
    label: branchLabel(open, loading),
  };
}

/** What the generators at each bus produce: the file's Pg, the reference bus's balance on top. */
export function productionByBus(grid, state) {
  const production = new Float64Array(grid.busCount);
  for (let g = 0; g < grid.genCount; g += 1) if (grid.genOn[g]) production[grid.genBus[g]] += grid.pg[g];
  state.islands.forEach((island) => (production[island.bus] = island.production));
  return production;
}

function busViews(grid, state) {
  const capacity = capacityByBus(grid);
  const production = productionByBus(grid, state);
  const islandOf = state.flows.islands.of;
  return Array.from({ length: grid.busCount }, (_, i) => {
    const island = state.islands[islandOf[i]];
    const stranded = island.short && island.capacity === 0;
    return {
      production: capacity[i] > 0 ? `G ${mw(production[i])}` : "",
      short: (island.short && island.bus === i) || stranded,
    };
  });
}

/** The view of a state: a branch view per branch, a bus view per bus. */
export function buildView(grid, state, /** @type {Uint8Array} */ inService) {
  return {
    branches: Array.from({ length: grid.branchCount }, (_, k) => branchView(grid, state, inService, k)),
    buses: busViews(grid, state),
  };
}

function direction(grid, /** @type {number} */ k, /** @type {number} */ flow) {
  if (Math.abs(flow) < 0.05) return "–";
  const [from, to] = [grid.busId[grid.from[k]], grid.busId[grid.to[k]]];
  return flow > 0 ? `${from} → ${to}` : `${to} → ${from}`;
}

/** The rows of the table: every branch, the most loaded first, with its change from the intact grid's flow. */
export function tableRows(grid, state, /** @type {Uint8Array} */ inService, /** @type {Float64Array} */ intact) {
  return Array.from({ length: grid.branchCount }, (_, k) => {
    const flow = state.flows.flow[k];
    return {
      k,
      name: branchName(grid, k),
      direction: direction(grid, k, flow),
      flow: Math.abs(flow),
      limit: grid.rate[k],
      loading: state.loading[k],
      change: Math.abs(flow) - Math.abs(intact[k]),
      open: !inService[k],
    };
  }).sort((a, b) => b.loading - a.loading || a.k - b.k);
}
