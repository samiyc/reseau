/**
 * A day played (docs/modele.md § 10): the commitment decided the day before on the forecast, then each hour the
 * cheapest dispatch of the units on, with the wind and sun of the real time, the lines within their limits, and the
 * least load shed when the units on cannot serve it all (src/opf/dispatch.js, in Sami's order: the least load shed,
 * then the least cost).
 *
 * **The fast start** (Sami, 15/11): when an hour's dispatch would shed load, the combustion turbines off may start in
 * that hour, the cheapest at full load first, until the dispatch sheds nothing or none is left; each started stays on
 * its minimum up time. **Hypothesis**: a combustion turbine starts within the hour (RTS-GMLC gives no start duration;
 * its reserves.csv admits them to the 10-minute spinning reserve). After that, the units follow the plan again.
 *
 * What a day measures, apart and never blended (CLAUDE.md): its **cost** ($: the dispatch of each hour, the units'
 * first points at their average cost included, plus every start, planned or fast), its **energy not served** (MWh),
 * the **energy curtailed** (MWh: wind, sun and hydro). The dispatch holds every line within its limit: the overloads
 * of the intact grid are none by construction, and the N-1 rule is not asked of it here.
 */

import { solveDispatch } from "../opf/dispatch.js";
import { meritOrder, startCost } from "./commit.js";
import { hourGrid, hourOf } from "./rts.js";

/** @typedef {{ committed: Uint8Array[], startCosts: number, starts: number }} Commitment */

/** Load shed under this, in MW, is none. */
const SHED_TOLERANCE = 1e-6;

/** One hour's dispatch under the units on: its cost, the load it sheds, the energy it curtails. */
export function dispatchHour(day, hour, /** @type {Uint8Array} */ on) {
  const grid = hourGrid(day, hour, on);
  const dispatch = solveDispatch(grid, { shedding: true });
  if (dispatch.status !== "optimal") return { status: dispatch.status, cost: NaN, shed: NaN, curtailed: NaN };
  const used = grid.renewable.reduce((sum, renewable, g) => sum + (renewable ? dispatch.generation[g] : 0), 0);
  return { status: "optimal", cost: dispatch.cost, shed: dispatch.shedTotal ?? 0, curtailed: hour.available.reduce((a, b) => a + b, 0) - used };
}

/** The fast units free to start at an hour, in merit order: off, and off for their minimum down time. */
const fastFree = (day, /** @type {number[]} */ order, /** @type {Uint8Array} */ on, state) => order.filter((u) => day.thermal[u].fast && !on[u] && state.since[u] >= day.thermal[u].minDown);

/** One hour: the plan's units and those a fast start holds on, then fast starts while the dispatch sheds load. */
function playHour(play, /** @type {Uint8Array} */ planned, /** @type {number} */ h) {
  const { day, order, state } = play;
  const hour = hourOf(day, "realTime", h);
  const on = Uint8Array.from(planned, (p, u) => (p || (state.on[u] && state.fast[u] && state.since[u] < day.thermal[u].minUp) ? 1 : 0));
  let result = dispatchHour(day, hour, on);
  const free = fastFree(day, order, on, state);
  while (result.status === "optimal" && result.shed > SHED_TOLERANCE && free.length > 0) {
    let added = 0;
    while (free.length > 0 && added < result.shed) {
      const u = free.shift();
      [on[u], added] = [1, added + day.thermal[u].pmax];
    }
    result = dispatchHour(day, hour, on);
  }
  return { ...result, on, load: hour.load.reduce((a, b) => a + b, 0) };
}

/**
 * Counts a unit's start, planned or fast, and whether a fast start holds it from now. The plan's units of the first
 * hour were on already (src/day/commit.js); a fast start in that hour is a start.
 */
function countStart(play, started, /** @type {number} */ u, /** @type {boolean} */ planned) {
  const { day, state } = play;
  if (play.hour > 0 || !planned) {
    started.cost += startCost(day.thermal[u], state.since[u]);
    started.starts += 1;
    started.fast += planned ? 0 : 1;
  }
  state.fast[u] = planned ? 0 : 1;
}

/** The state after an hour: each unit on or off, and for how long; and the starts of the hour. */
function advance(play, /** @type {Uint8Array} */ on, /** @type {Uint8Array} */ planned) {
  const { state } = play;
  const started = { cost: 0, starts: 0, fast: 0 };
  on.forEach((now, u) => {
    if (now && !state.on[u]) countStart(play, started, u, planned[u] === 1);
    state.since[u] = now === state.on[u] ? state.since[u] + 1 : 1;
  });
  state.on = on;
  return started;
}

/**
 * A day under a commitment (src/day/commit.js), with the fast start unless `fastStart` is false: each hour played,
 * and the day's totals. `failed` counts the hours no dispatch could solve, even shedding (none expected).
 */
export function playDay(day, /** @type {Commitment} */ commitment, { fastStart = true } = {}) {
  const n = day.thermal.length;
  const state = { on: new Uint8Array(n), since: new Float64Array(n).fill(Infinity), fast: new Uint8Array(n) };
  const play = { day, order: fastStart ? meritOrder(day.thermal) : [], state, hour: 0 };
  const totals = { startCosts: 0, starts: 0, fastStarts: 0 };
  const hours = commitment.committed.map((planned, h) => {
    play.hour = h;
    const hour = playHour(play, planned, h);
    const started = advance(play, hour.on, planned);
    totals.startCosts += started.cost;
    totals.starts += started.starts;
    totals.fastStarts += started.fast;
    return hour;
  });
  const sum = (/** @type {(hour: any) => number} */ f) => hours.reduce((total, hour) => total + (hour.status === "optimal" ? f(hour) : 0), 0);
  return {
    day: day.index,
    cost: sum((hour) => hour.cost) + totals.startCosts,
    ...totals,
    unserved: sum((hour) => hour.shed),
    curtailed: sum((hour) => hour.curtailed),
    load: sum((hour) => hour.load),
    failed: hours.filter((hour) => hour.status !== "optimal").length,
    hours,
  };
}
