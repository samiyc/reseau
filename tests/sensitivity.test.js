import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { solveFlows } from "../src/flow/dcflow.js";
import { afterOutage, isBridge, lodf, ptdf } from "../src/flow/sensitivity.js";
import { baseInjection } from "../src/grid/state.js";
import { grid, triangle } from "./cases.js";

/** The largest gap between two lists of numbers. */
const gap = (actual, expected) => Math.max(0, ...Array.from(actual, (a, i) => Math.abs(a - expected[i])));

describe("the PTDF", () => {
  it("gives the flows as PTDF · P, on the three PGLib grids", () => {
    for (const size of [14, 30, 118]) {
      const g = grid(size);
      const injection = baseInjection(g);
      const { flow } = solveFlows(g, injection);
      const h = ptdf(g);
      const product = flow.map((_, k) => injection.reduce((sum, p, n) => sum + h[k * g.busCount + n] * p, 0));
      assert.ok(gap(product, flow) < 1e-7, `IEEE ${size}`);
    }
  });

  it("is zero at the reference bus, and 2/3 on the triangle's direct line", () => {
    const g = triangle();
    const h = ptdf(g);
    assert.ok(gap([h[0], h[1]], [0, -2 / 3]) < 1e-12);
  });

  it("refuses a grid in pieces", () => {
    const g = grid(14);
    g.inService = Uint8Array.from(g.inService, (on, k) => (g.busId[g.to[k]] === 8 ? 0 : on));
    assert.throws(() => ptdf(g), /îlots/);
  });
});

describe("the LODF", () => {
  it("moves each lost branch's flow as a new power flow would, on the three PGLib grids", () => {
    for (const size of [14, 30, 118]) {
      const g = grid(size);
      const injection = baseInjection(g);
      const before = solveFlows(g, injection).flow;
      const factors = lodf(g);
      for (let k = 0; k < g.branchCount; k += 1) {
        if (isBridge(factors, g.branchCount, k)) continue;
        const inService = Uint8Array.from(g.inService, (on, b) => (b === k ? 0 : on));
        const solved = solveFlows(g, injection, inService).flow;
        const moved = afterOutage(before, factors, k);
        assert.ok(gap(moved, solved) < 1e-7, `IEEE ${size}, branche ${k}`);
      }
    }
  });

  it("marks the bridges: 7-8 on the IEEE 14, and the 118's radial branches", () => {
    const g14 = grid(14);
    const bridges = (g) => {
      const factors = lodf(g);
      return [...g.from.keys()].filter((k) => isBridge(factors, g.branchCount, k)).map((k) => `${g.busId[g.from[k]]}-${g.busId[g.to[k]]}`);
    };
    assert.deepEqual(bridges(g14), ["7-8"]);
    assert.ok(bridges(grid(118)).length > 0);
  });

  it("is −1 on the diagonal: a lost branch carries nothing", () => {
    const g = triangle();
    const factors = lodf(g);
    assert.ok(gap([factors[0], factors[1 * 3 + 0]], [-1, 1]) < 1e-12);
  });
});
