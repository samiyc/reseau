import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createDay } from "../src/day/rts.js";
import { priorityCommit } from "../src/day/commit.js";
import { beamCommit, planDay } from "../src/day/beam.js";
import { rts } from "./cases.js";

const TUNED = { reserve: 1, renewable: 0.3, hold: 12 };

/** A unit's runs over a plan: on or off, from which hour, for how long. */
function runsOf(/** @type {Uint8Array[]} */ committed, /** @type {number} */ u) {
  const runs = [];
  committed.forEach((on, h) => {
    const last = runs.at(-1);
    if (last && last.on === on[u]) last.length += 1;
    else runs.push({ on: on[u], from: h, length: 1 });
  });
  return runs;
}

/** Whether a plan keeps every unit's minimum up and down times: each run but the last (the day ends) and an off first. */
const keepsTimes = (day, /** @type {Uint8Array[]} */ committed) =>
  day.thermal.every((unit, u) => runsOf(committed, u).slice(0, -1).every((run) => (run.on ? run.length >= unit.minUp : run.from === 0 || run.length >= unit.minDown)));

/** Whether note `a` (shed, overload, cost) is at most `b`, in Sami's order. */
const atMost = (a, b) => a.shed < b.shed - 1e-6 || (Math.abs(a.shed - b.shed) <= 1e-6 && (a.over < b.over - 1e-6 || (Math.abs(a.over - b.over) <= 1e-6 && a.cost <= b.cost + 1e-6)));

describe("the beam on the commitment (src/day/beam.js)", () => {
  const { data, grid, series } = rts();
  const day = createDay(grid, data, series, 1);

  it("starts from the rule's first hour, keeps the units' times and the rule's capacity, and beats the rule on the forecast of day 1", () => {
    const plan = beamCommit(day, { ...TUNED, beam: 2 });
    const rule = priorityCommit(day, TUNED);
    assert.equal(plan.committed.length, 24);
    assert.deepEqual(plan.committed[0], rule.committed[0]);
    assert.ok(keepsTimes(day, plan.committed));
    const capacity = (/** @type {Uint8Array} */ on) => day.thermal.reduce((sum, unit, u) => sum + (on[u] ? unit.pmax : 0), 0);
    plan.committed.forEach((on, h) => assert.ok(capacity(on) >= Math.min(rule.needs[h].need, capacity(rule.committed[h])) - 1e-9));
    assert.equal(plan.fromRule, false);
    assert.ok(plan.forecast.cost < plan.rule.cost);
    assert.ok(plan.evaluated > 24);
  });

  it("replays: the same day gives the same plan", () => {
    assert.deepEqual(beamCommit(day, { ...TUNED, beam: 2 }).committed, beamCommit(day, { ...TUNED, beam: 2 }).committed);
  });

  it("is never worse than the rule on the forecast, in Sami's order, under the N-1 rule too", () => {
    const plan = beamCommit(day, { ...TUNED, beam: 1, security: true });
    assert.ok(atMost(plan.forecast, plan.rule));
    assert.ok(plan.forecast.over < plan.rule.over);
  });

  it("is the rule without a beam", () => {
    assert.deepEqual(planDay(day, { ...TUNED, beam: 0 }).committed, priorityCommit(day, TUNED).committed);
  });
});
