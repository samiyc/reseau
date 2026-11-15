/**
 * The rule to beat at J4 (docs/recherche/pistes.md, P6): the priority list with a reserve margin, decided the day
 * before on the forecast (de Mars, 2022, § 2; docs/recherche/methodes.md § 1).
 *
 * The thermal units are ranked by their average cost at full load. Each hour, from the first, the rule keeps on the
 * units its minimum up time holds, keeps off those its minimum down time holds, and then walks the list: a unit free
 * to run is on while the capacity on is under the forecast net load plus the reserve. The reserve is
 * `reserve` times the published requirements (spinning and regulation up, RTS-GMLC's day-ahead files) plus
 * `renewable` times the wind and sun forecast, against its error. A unit on stays on while the list will want it
 * again within `hold` hours (on the forecast of the day), rather than stop and start again. The lines are not seen:
 * the dispatch of each hour will (src/day/day.js).
 *
 * **Hypotheses**: the day starts without history, its first hour's units already on (no start cost; their minimum up
 * time counts from that hour); a unit off since the day began starts cold. A start's cost is cold, warm or hot by the hours the unit has been off
 * (RTS-GMLC's start times and heats, at its fuel price).
 */

import { hourOf, reserveOf } from "./rts.js";

/** @typedef {import("./rts.js").Thermal} Thermal */

/** The units' order: the cheapest at full load first, then by index. */
export const meritOrder = (/** @type {Thermal[]} */ thermal) => [...thermal.keys()].sort((a, b) => thermal[a].fullLoad - thermal[b].fullLoad || a - b);

/** The forecast net load (load less the wind, sun and hydro forecast) and the capacity needed, at each hour. */
export function needsOf(day, { reserve = 1, renewable = 0 } = {}) {
  return Array.from({ length: 24 }, (_, h) => {
    const hour = hourOf(day, "dayAhead", h);
    const load = hour.load.reduce((a, b) => a + b, 0);
    const supply = hour.available.reduce((a, b) => a + b, 0);
    const variable = hour.available.reduce((sum, mw, g) => sum + (["WIND", "PV", "CSP", "RTPV"].includes(day.units[g].type) ? mw : 0), 0);
    const r = reserveOf(day, h);
    return { load, net: load - supply, need: load - supply + reserve * (r.spin + r.regUp) + renewable * variable };
  });
}

/** The cost of starting a unit off for `off` hours: cold, warm or hot. */
export function startCost(/** @type {Thermal} */ unit, /** @type {number} */ off) {
  const [cold, warm, hot] = unit.start.cost;
  if (off >= unit.start.coldAfter) return cold;
  return off >= unit.start.warmAfter ? warm : hot;
}

/** The units the list alone wants at a need: the shortest head of the list whose capacity reaches it. */
function wantedAt(/** @type {Thermal[]} */ thermal, /** @type {number[]} */ order, /** @type {number} */ need) {
  const wanted = new Uint8Array(thermal.length);
  let capacity = 0;
  for (const u of order) {
    if (capacity >= need) break;
    [wanted[u], capacity] = [1, capacity + thermal[u].pmax];
  }
  return wanted;
}

/** Whether a unit on is held on at an hour: by its minimum up time, or because the list wants it again soon. */
const heldOn = (state, /** @type {Thermal} */ unit, /** @type {number} */ u, /** @type {Uint8Array[]} */ soon) => state.on[u] && (state.since[u] < unit.minUp || soon.some((wanted) => wanted[u]));

/** One hour of the rule: the units on, from the state of the hour before and what the list wants in the next hours. */
function commitHour({ thermal, order }, state, /** @type {number} */ need, /** @type {Uint8Array[]} */ soon) {
  const on = new Uint8Array(thermal.length);
  let capacity = 0;
  thermal.forEach((unit, u) => {
    if (heldOn(state, unit, u, soon)) [on[u], capacity] = [1, capacity + unit.pmax];
  });
  for (const u of order) {
    if (capacity >= need) break;
    if (on[u] || (!state.on[u] && state.since[u] < thermal[u].minDown)) continue;
    [on[u], capacity] = [1, capacity + thermal[u].pmax];
  }
  return on;
}

/**
 * The commitment of a day under the rule: the units on at each hour (a Uint8Array by hour, over `day.thermal`), the
 * cost of the starts, and what each hour needed.
 */
export function priorityCommit(day, params = {}) {
  const { thermal } = day;
  const order = meritOrder(thermal);
  const needs = needsOf(day, params);
  const wanted = needs.map(({ need }) => wantedAt(thermal, order, need));
  const hold = params.hold ?? 0;
  const state = { on: new Uint8Array(thermal.length), since: new Float64Array(thermal.length).fill(Infinity) };
  const committed = [];
  let starts = 0;
  let startCosts = 0;
  needs.forEach(({ need }, h) => {
    const on = commitHour({ thermal, order }, state, need, wanted.slice(h + 1, h + 1 + hold));
    thermal.forEach((unit, u) => {
      if (on[u] && !state.on[u] && h > 0) [starts, startCosts] = [starts + 1, startCosts + startCost(unit, state.since[u])];
      state.since[u] = on[u] === state.on[u] ? state.since[u] + 1 : 1;
    });
    state.on = on;
    committed.push(on);
  });
  return { committed, starts, startCosts, needs };
}
