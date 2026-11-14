/**
 * The cascade (docs/modele.md § 6), Grid2Op's rule read in its code (grid2op 1.12.6, `Backend.next_grid_state` and
 * `BaseEnv`): within a step, a branch past `hard` times its limit trips at once, the flows are recomputed, and again
 * until nothing trips; a branch past its limit has its counter raised once a step, and trips when the counter goes
 * past `allowed`, so on its third overloaded step in a row. A branch back under its limit at the end of a step has
 * its counter reset. The generators keep the setpoints of the dispatch (by default N-1 secure while it can be, the
 * cheapest past that: src/grid/state.js), solved once before the first step; each island
 * is balanced around them (src/grid/balance.js), or, under J2's "pmax" dispatch, by src/grid/supply.js.
 */

import { OVERLOAD, describeState, setpointsFor } from "../grid/state.js";

/** @typedef {import("../types.js").Grid} Grid */

/** Grid2Op's defaults (grid2op/Parameters.py): NB_TIMESTEP_OVERFLOW_ALLOWED = 2, HARD_OVERFLOW_THRESHOLD = 2.0. */
export const GRID2OP_RULE = Object.freeze({ allowed: 2, hard: 2 });

/**
 * A cascade ready to step: the branches in service, the load factor, the dispatch and its setpoints (solved here
 * unless given), the rule, and each branch's counter.
 */
export function createCascade(/** @type {Grid} */ grid, options = {}) {
  const { loadFactor = 1, inService = grid.inService, rule = GRID2OP_RULE, dispatch = "secure" } = options;
  const setpoints = setpointsFor(grid, options);
  return { grid, loadFactor, dispatch, setpoints, rule, inService: Uint8Array.from(inService), counter: new Int32Array(grid.branchCount), step: 0 };
}

/** The state of a cascade's grid now. */
const stateOf = (cascade) => describeState(cascade.grid, { loadFactor: cascade.loadFactor, inService: cascade.inService, dispatch: cascade.dispatch, setpoints: cascade.setpoints });

/** The branches to trip now, each with its reason; raises the step's counters on the way. */
function toTrip(cascade, /** @type {Float64Array} */ loading, /** @type {Int32Array} */ local, /** @type {Uint8Array} */ raised) {
  const { inService, rule } = cascade;
  const trips = [];
  for (let k = 0; k < loading.length; k += 1) {
    if (!inService[k]) continue;
    if (loading[k] > OVERLOAD && !raised[k]) {
      local[k] += 1;
      raised[k] = 1;
    }
    if (loading[k] > rule.hard) trips.push({ branch: k, why: "hard" });
    else if (local[k] > rule.allowed) trips.push({ branch: k, why: "soft" });
  }
  return trips;
}

/**
 * One step: trips until the grid holds, then the counters. Returns the branches tripped (with the loading that
 * tripped them) and the state the step ends in.
 */
export function stepCascade(cascade) {
  const { grid, inService, counter } = cascade;
  const local = Int32Array.from(counter);
  const raised = new Uint8Array(grid.branchCount);
  const tripped = [];
  let state = stateOf(cascade);
  for (let round = 0; round <= grid.branchCount; round += 1) {
    const trips = toTrip(cascade, state.loading, local, raised);
    if (trips.length === 0) break;
    for (const trip of trips) {
      inService[trip.branch] = 0;
      tripped.push({ ...trip, loading: state.loading[trip.branch], round });
    }
    state = stateOf(cascade);
  }
  for (let k = 0; k < grid.branchCount; k += 1) counter[k] = inService[k] && state.loading[k] > OVERLOAD ? counter[k] + 1 : 0;
  cascade.step += 1;
  return { step: cascade.step, tripped, state };
}

/**
 * Steps until the grid holds (a step without a trip and without an overload) or `maxSteps`. Returns the steps (with
 * their states when `keep`), the branches lost, and the load shed at the end, in MW and as a share of the demand.
 */
export function runCascade(/** @type {Grid} */ grid, options = {}, { maxSteps = 50, keep = false } = {}) {
  const cascade = createCascade(grid, options);
  const steps = [];
  let last;
  do {
    last = stepCascade(cascade);
    steps.push(keep ? { ...last, inService: Uint8Array.from(cascade.inService) } : { step: last.step, tripped: last.tripped, shed: last.state.shed });
  } while (!holds(last) && cascade.step < maxSteps);
  return outcome(steps, last, cascade.inService);
}

/** Whether a step leaves the grid holding: nothing tripped, nothing overloaded. */
const holds = (last) => last.tripped.length === 0 && last.state.overloaded.length === 0;

function outcome(steps, last, /** @type {Uint8Array} */ inService) {
  const demand = last.state.islands.reduce((sum, island) => sum + island.demand, 0);
  return {
    steps,
    lost: steps.reduce((sum, step) => sum + step.tripped.length, 0),
    shed: last.state.shed,
    shedShare: demand > 0 ? last.state.shed / demand : 0,
    settled: holds(last),
    final: last.state,
    inService,
  };
}
