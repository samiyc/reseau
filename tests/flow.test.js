import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { netOutflow, solveFlows } from "../src/flow/dcflow.js";
import { findIslands } from "../src/flow/islands.js";
import { factor, solveInto } from "../src/flow/lu.js";
import { baseInjection, describeState } from "../src/grid/state.js";
import { grid, triangle } from "./cases.js";

/** The largest gap between two lists of numbers. */
const gap = (actual, expected) => Math.max(0, ...Array.from(actual, (a, i) => Math.abs(a - expected[i])));
const cut = (g, ...branches) => Uint8Array.from(g.inService, (on, k) => (branches.includes(k) ? 0 : on));

describe("the LU factorisation", () => {
  it("solves a system that needs a pivot", () => {
    const lu = factor(Float64Array.from([0, 2, 1, 1, 1, 0, 3, 0, 1]), 3);
    const x = solveInto(lu, Float64Array.from([5, 3, 4]), new Float64Array(3));
    assert.ok(gap(x, [1, 2, 1]) < 1e-12);
  });

  it("refuses a singular matrix", () => {
    assert.throws(() => factor(Float64Array.from([1, 2, 2, 4]), 2), /singulière/);
  });
});

describe("the DC power flow", () => {
  it("splits 100 MW two thirds direct, one third round, on a triangle (by hand)", () => {
    const g = triangle();
    const { flow, balance } = solveFlows(g, baseInjection(g));
    assert.ok(gap([...flow, balance[0]], [200 / 3, 100 / 3, 100 / 3, 100]) < 1e-9);
  });

  it("keeps Kirchhoff at every bus, on the three PGLib grids", () => {
    for (const size of [14, 30, 118]) {
      const g = grid(size);
      const injection = baseInjection(g);
      const { flow, balance, islands } = solveFlows(g, injection);
      const out = netOutflow(g, flow);
      const expected = Float64Array.from(injection, (p, i) => (i === g.reference ? p + balance[0] : p));
      assert.ok(gap(out, expected) < 1e-7, `IEEE ${size}`);
      assert.equal(islands.count, 1);
    }
  });

  it("makes the reference bus produce what the others do not: 259 − 29.5 MW on the IEEE 14", () => {
    const state = describeState(grid(14));
    assert.ok(gap([state.islands[0].production], [229.5]) < 1e-9);
    assert.equal(state.islands[0].short, false);
    assert.deepEqual(state.overloaded, []);
  });

  it("carries nothing on a branch out of service", () => {
    const g = grid(14);
    const { flow } = solveFlows(g, baseInjection(g), cut(g, 3));
    assert.equal(flow[3], 0);
  });

  it("turns a bridge's loss into two islands, the cut-off one with its own reference (bus 8, behind 7-8)", () => {
    const g = grid(14);
    const branch = [...g.from].findIndex((f, k) => g.busId[f] === 7 && g.busId[g.to[k]] === 8);
    const islands = findIslands(g, cut(g, branch));
    assert.equal(islands.count, 2);
    const alone = islands.of[g.busIndex.get(8)];
    assert.equal(g.busId[islands.reference[alone]], 8);
    const state = describeState(g, { inService: cut(g, branch) });
    assert.ok(gap([state.islands[alone].production], [0]) < 1e-9);
  });

  it("says when an island has load and no production", () => {
    const g = grid(14);
    const branch = [...g.from].findIndex((f, k) => g.busId[f] === 13 && g.busId[g.to[k]] === 14);
    const other = [...g.from].findIndex((f, k) => g.busId[f] === 9 && g.busId[g.to[k]] === 14);
    const state = describeState(g, { inService: cut(g, branch, other) });
    const island = state.flows.islands.of[g.busIndex.get(14)];
    assert.ok(gap([state.islands[island].production], [14.9]) < 1e-9);
    assert.equal(state.islands[island].short, true);
  });

  it("scales the load: at 1.6 times, the reference bus runs past its 340 MW", () => {
    const state = describeState(grid(14), { loadFactor: 1.6 });
    assert.ok(gap([state.islands[0].production], [1.6 * 259 - 29.5]) < 1e-9);
    assert.equal(state.islands[0].short, true);
  });
});
