import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { initialEvents, securityLimits, summarize, sweepFactor } from "../src/cascade/sweep.js";
import { grid } from "./cases.js";

describe("the initial events of J2", () => {
  it("takes every branch alone, then distinct pairs drawn by seed", () => {
    const g = grid(30);
    const events = initialEvents(g, { pairs: 50, seed: 3 });
    assert.equal(events.filter((e) => e.length === 1).length, 41);
    const pairs = events.filter((e) => e.length === 2);
    assert.equal(pairs.length, 50);
    assert.equal(new Set(pairs.map((p) => p.join("-"))).size, 50);
    assert.ok(pairs.every(([a, b]) => a < b));
  });

  it("replays from its seed, and changes with it", () => {
    const g = grid(30);
    assert.deepEqual(initialEvents(g, { pairs: 20, seed: 3 }), initialEvents(g, { pairs: 20, seed: 3 }));
    assert.notDeepEqual(initialEvents(g, { pairs: 20, seed: 3 }), initialEvents(g, { pairs: 20, seed: 4 }));
  });

  it("stops at every pair there is: 190 on the IEEE 14's 20 branches", () => {
    assert.equal(initialEvents(grid(14), { pairs: 300 }).length, 20 + 190);
  });
});

describe("the summary of a sweep", () => {
  it("gives the mean, the quantiles and the shares past 10 % and 50 %", () => {
    const s = summarize([0, 0, 0.2, 0.6], [0, 1, 2, 5]);
    assert.ok(Math.abs(s.mean - 0.2) < 1e-12);
    assert.deepEqual([s.p50, s.max, s.lost], [0.2, 0.6, 2]);
    assert.deepEqual([s.anyLoss.rate, s.over10.rate, s.over50.rate], [0.5, 0.5, 0.25]);
  });
});

describe("the security limits (docs/mesures/cascade-j2.md)", () => {
  it("finds the IEEE 14 N-1 at 0.58, by the loss of 1-2, and no N-0 limit up to 1.6", () => {
    const g = grid(14);
    const { n0, n1 } = securityLimits(g);
    assert.equal(n0, null);
    assert.equal(n1.factor, 0.58);
    assert.equal(`${g.busId[g.from[n1.branch]]}-${g.busId[g.to[n1.branch]]}`, "1-2");
  });

  it("finds the IEEE 30 N-0 at 1.03", () => {
    assert.equal(securityLimits(grid(30), { from: 1, to: 1.1 }).n0, 1.03);
  });
});

describe("a sweep at one load factor", () => {
  it("loses 200 of 259 MW on the IEEE 14's single loss of 1-2, one event in 20", () => {
    const g = grid(14);
    const events = initialEvents(g);
    const result = sweepFactor(g, 1, events, { dispatch: "pmax" });
    assert.equal(result.n, 20);
    assert.ok(Math.abs(result.mean - 200 / 259 / 20) < 1e-12);
    assert.equal(result.unsettled, 0);
  });
});
