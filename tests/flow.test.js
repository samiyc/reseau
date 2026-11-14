import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { netOutflow, solveFlows } from "../src/flow/dcflow.js";
import { findIslands } from "../src/flow/islands.js";
import { factor, solveInto } from "../src/flow/lu.js";
import { baseInjection, describeState } from "../src/grid/state.js";
import { lodf } from "../src/flow/sensitivity.js";
import { n1Overloads } from "../src/opf/security.js";
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

  it("shares the IEEE 14's 259 MW in proportion to Pmax: 340 and 59 MW at 259/399 of their capacity", () => {
    const state = describeState(grid(14), { dispatch: "pmax" });
    const share = 259 / 399;
    assert.ok(gap(state.generation, [340 * share, 59 * share, 0, 0, 0]) < 1e-9);
    assert.equal(state.shed, 0);
    assert.ok(Math.abs(state.flows.balance[0]) < 1e-9);
    assert.deepEqual(state.overloaded, []);
  });

  it("puts no line past its limit at base load, on the three PGLib grids, under either dispatch", () => {
    for (const size of [14, 30, 118]) {
      for (const dispatch of ["secure", "cost", "pmax"]) assert.deepEqual(describeState(grid(size), { dispatch }).overloaded, [], `IEEE ${size}, ${dispatch}`);
    }
  });

  it("holds the N-1 rule by default while it can: on the IEEE 14 at 0.7, bus 1 at 128 MW, what 1-5 carries if 1-2 is lost", () => {
    const g = grid(14);
    const state = describeState(g, { loadFactor: 0.7 });
    assert.equal(state.setpoints.secure, true);
    assert.ok(gap(state.generation, [128, 0.7 * 259 - 128, 0, 0, 0]) < 1e-6);
    assert.deepEqual(n1Overloads(g, state.flows.flow, lodf(g)), []);
  });

  it("lowers the worst loading after a loss past the N-1 limit: on the IEEE 14, bus 1 at 200 MW, bus 2 at its 59", () => {
    const state = describeState(grid(14));
    assert.equal(state.setpoints.secure, false);
    assert.ok(Math.abs(state.setpoints.margin - 200 / 128) < 1e-9);
    assert.ok(gap(state.generation, [200, 59, 0, 0, 0]) < 1e-6);
  });

  it("runs the cheapest dispatch under \"cost\": on the IEEE 14, all 259 MW from bus 1, at 7.92 $/MWh", () => {
    const state = describeState(grid(14), { dispatch: "cost" });
    assert.equal(state.setpoints.margin, null);
    assert.ok(gap(state.generation, [259, 0, 0, 0, 0]) < 1e-6);
    assert.ok(Math.abs(state.setpoints.cost - 2051.526) < 1e-3);
    assert.ok(gap(state.setpoints.prices, new Array(14).fill(7.920951)) < 1e-6);
  });

  it("balances an island around the setpoints: bus 2's 59 MW rise to serve what bus 1 no longer reaches", () => {
    const g = grid(14);
    const out = [...g.from.keys()].filter((k) => g.busId[g.from[k]] === 1);
    const state = describeState(g, { inService: cut(g, ...out) });
    const main = state.flows.islands.of[g.busIndex.get(2)];
    assert.ok(gap([state.generation[0], state.generation[1], state.islands[main].shed], [0, 59, 200]) < 1e-6);
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

  it("sheds the load of an island without production (bus 14, cut from 9 and 13)", () => {
    const g = grid(14);
    const branch = [...g.from].findIndex((f, k) => g.busId[f] === 13 && g.busId[g.to[k]] === 14);
    const other = [...g.from].findIndex((f, k) => g.busId[f] === 9 && g.busId[g.to[k]] === 14);
    const state = describeState(g, { inService: cut(g, branch, other) });
    const island = state.flows.islands.of[g.busIndex.get(14)];
    assert.ok(gap([state.islands[island].production, state.islands[island].shed, state.shed], [0, 14.9, 14.9]) < 1e-9);
    assert.ok(Math.abs(state.injection[g.busIndex.get(14)]) < 1e-12);
  });

  it("runs every generator at Pmax past the capacity, and sheds the rest: 1.6 × 259 − 399 MW", () => {
    for (const dispatch of ["secure", "cost", "pmax"]) {
      const state = describeState(grid(14), { loadFactor: 1.6, dispatch });
      assert.ok(gap([state.islands[0].production, state.shed, state.generation[0]], [399, 1.6 * 259 - 399, 340]) < 1e-6, dispatch);
      assert.ok(Math.abs(state.flows.balance[0]) < 1e-6, dispatch);
    }
  });
});
