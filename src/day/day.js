/**
 * A day played (docs/modele.md § 10): the commitment decided the day before on the forecast, then each hour the
 * cheapest dispatch of the units on, with the wind and sun of the real time, the lines within their limits, and the
 * least load shed when the units on cannot serve it all (src/opf/dispatch.js, in Sami's order: the least load shed,
 * then the least cost).
 *
 * What a day measures, apart and never blended (CLAUDE.md): its **cost** ($: the dispatch of each hour, the units'
 * first points at their average cost included, plus the starts), its **energy not served** (MWh), the **wind and sun
 * curtailed** (MWh). The dispatch holds every line within its limit: the overloads of the intact grid are none by
 * construction, and the N-1 rule is not asked of it here.
 */

import { solveDispatch } from "../opf/dispatch.js";
import { hourGrid, hourOf } from "./rts.js";

/** @typedef {{ committed: Uint8Array[], startCosts: number, starts: number }} Commitment */

/** One hour in real time under a commitment: its dispatch's cost, the load it sheds, the wind and sun it curtails. */
export function playHour(day, /** @type {Uint8Array} */ committed, /** @type {number} */ h) {
  const hour = hourOf(day, "realTime", h);
  const grid = hourGrid(day, hour, committed);
  const dispatch = solveDispatch(grid, { shedding: true });
  if (dispatch.status !== "optimal") return { status: dispatch.status, cost: NaN, shed: NaN, curtailed: NaN, load: NaN };
  const available = hour.available.reduce((a, b) => a + b, 0);
  const used = grid.renewable.reduce((sum, on, g) => sum + (on ? dispatch.generation[g] : 0), 0);
  const load = hour.load.reduce((a, b) => a + b, 0);
  return { status: "optimal", cost: dispatch.cost, shed: dispatch.shedTotal ?? 0, curtailed: available - used, load };
}

/**
 * A day under a commitment (src/day/commit.js): each hour played, and the day's totals. `failed` counts the hours no
 * dispatch could solve, even shedding (none expected; their cost and energy are then unknown).
 */
export function playDay(day, /** @type {Commitment} */ commitment) {
  const hours = commitment.committed.map((on, h) => playHour(day, on, h));
  const sum = (/** @type {(hour: any) => number} */ f) => hours.reduce((total, hour) => total + (hour.status === "optimal" ? f(hour) : 0), 0);
  return {
    day: day.index,
    cost: sum((hour) => hour.cost) + commitment.startCosts,
    startCosts: commitment.startCosts,
    starts: commitment.starts,
    unserved: sum((hour) => hour.shed),
    curtailed: sum((hour) => hour.curtailed),
    load: sum((hour) => hour.load),
    failed: hours.filter((hour) => hour.status !== "optimal").length,
    hours,
  };
}
