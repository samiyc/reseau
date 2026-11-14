import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GRID2OP_RULE, createCascade, runCascade, stepCascade } from "../src/cascade/cascade.js";
import { grid } from "./cases.js";

const name = (g, k) => `${g.busId[g.from[k]]}-${g.busId[g.to[k]]}`;
const branch = (g, wanted) => [...g.from.keys()].find((k) => name(g, k) === wanted);
const without = (g, ...names) => Uint8Array.from(g.inService, (on, k) => (names.includes(name(g, k)) ? 0 : on));
const trips = (g, result) => result.steps.map((step) => step.tripped.map((t) => `${name(g, t.branch)}:${t.why}`));

describe("the cascade, under Grid2Op's rule", () => {
  it("takes Grid2Op's defaults: a counter past 2 steps, a hard limit at twice the rating", () => {
    assert.deepEqual({ ...GRID2OP_RULE }, { allowed: 2, hard: 2 });
  });

  it("holds at once on the intact IEEE 14, under either dispatch", () => {
    for (const dispatch of ["secure", "cost", "pmax"]) {
      const result = runCascade(grid(14), { dispatch });
      assert.deepEqual([result.steps.length, result.lost, result.shed, result.settled], [1, 0, 0, true], dispatch);
    }
  });

  it("trips no line after any single loss under the N-1 dispatch (IEEE 14 at 0.7, IEEE 30 at 0.8)", () => {
    for (const [size, loadFactor] of [[14, 0.7], [30, 0.8]]) {
      const g = grid(size);
      const { setpoints } = createCascade(g, { loadFactor });
      assert.equal(setpoints.secure, true, `IEEE ${size}`);
      const lost = [...g.from.keys()].map((k) => runCascade(g, { loadFactor, setpoints, inService: without(g, name(g, k)) }).lost);
      assert.deepEqual(lost, new Array(g.branchCount).fill(0), `IEEE ${size}`);
    }
  });

  it("trips 1-5 on its third step from the model's dispatch when 1-2 is out: bus 1 sends 200 MW, under twice 128", () => {
    const g = grid(14);
    const result = runCascade(g, { inService: without(g, "1-2") });
    assert.deepEqual(trips(g, result), [[], [], ["1-5:soft"], []]);
    assert.ok(Math.abs(result.shed - 200) < 1e-6);
  });

  it("trips 1-5 at once under the cheapest dispatch when 1-2 is out: bus 1 sends 259 MW, past twice 128", () => {
    const g = grid(14);
    const result = runCascade(g, { inService: without(g, "1-2"), dispatch: "cost" });
    assert.deepEqual(trips(g, result), [["1-5:hard"], []]);
    assert.ok(Math.abs(result.steps[0].tripped[0].loading - 259 / 128) < 1e-6);
    assert.ok(Math.abs(result.shed - 200) < 1e-6);
  });

  it("keeps the setpoints through the cascade: the dispatch is solved once, before the first step", () => {
    const g = grid(30);
    const cascade = createCascade(g, { loadFactor: 1.05, inService: without(g, "1-2") });
    const before = Float64Array.from(cascade.setpoints.generation);
    stepCascade(cascade);
    stepCascade(cascade);
    assert.deepEqual(cascade.setpoints.generation, before);
  });

  it("trips 1-5 on its third overloaded step when 1-2 is out, then sheds what bus 2's 59 MW cannot serve", () => {
    const g = grid(14);
    const result = runCascade(g, { inService: without(g, "1-2"), dispatch: "pmax" });
    assert.deepEqual(trips(g, result), [[], [], ["1-5:soft"], []]);
    assert.ok(Math.abs(result.steps[2].tripped[0].loading - 340 * (259 / 399) / 128) < 1e-9);
    assert.ok(Math.abs(result.shed - 200) < 1e-9);
    assert.ok(Math.abs(result.shedShare - 200 / 259) < 1e-12);
    assert.equal(result.settled, true);
  });

  it("trips 1-5 at once past twice its rating, at 1.2 times the load", () => {
    const g = grid(14);
    const result = runCascade(g, { loadFactor: 1.2, inService: without(g, "1-2"), dispatch: "pmax" });
    assert.deepEqual(trips(g, result), [["1-5:hard"], []]);
  });

  it("trips a line whose counter is already at 2, and resets a line back under its limit", () => {
    const g = grid(14);
    const cascade = createCascade(g, { inService: without(g, "1-2"), dispatch: "pmax" });
    cascade.counter[branch(g, "1-5")] = 2;
    cascade.counter[branch(g, "2-3")] = 2;
    const { tripped } = stepCascade(cascade);
    assert.deepEqual(tripped.map((t) => name(g, t.branch)), ["1-5"]);
    assert.equal(cascade.counter[branch(g, "2-3")], 0);
  });

  it("recomputes within a step: on the IEEE 118 at 1.3 times the load, losing 38-37 trips lines in later rounds", () => {
    const g = grid(118);
    const result = runCascade(g, { loadFactor: 1.3, inService: without(g, "38-37"), dispatch: "pmax" });
    const late = result.steps.flatMap((step) => step.tripped).filter((t) => t.round > 0);
    assert.ok(late.length > 0 && late.every((t) => t.why === "hard"));
    assert.equal(result.lost, 54);
    assert.ok(result.shedShare > 0.4 && result.shedShare < 0.6);
  });

  it("stops at maxSteps, unsettled", () => {
    const g = grid(14);
    const result = runCascade(g, { inService: without(g, "1-2"), dispatch: "pmax" }, { maxSteps: 2 });
    assert.deepEqual([result.steps.length, result.settled], [2, false]);
  });

  it("replays: the same outage gives the same cascade", () => {
    const g = grid(30);
    const run = () => runCascade(g, { loadFactor: 1.2, inService: without(g, "4-6") });
    assert.deepEqual(trips(g, run()), trips(g, run()));
  });

  it("keeps each step's state and branches in service when asked", () => {
    const g = grid(14);
    const result = runCascade(g, { inService: without(g, "1-2"), dispatch: "pmax" }, { keep: true });
    assert.equal(result.steps[3].inService[branch(g, "1-5")], 0);
    assert.equal(result.steps[1].inService[branch(g, "1-5")], 1);
    assert.ok(result.steps[3].state.flows);
  });
});
