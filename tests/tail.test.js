import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { allPairs, drawTriples, logHistogram, slopeOf, tailOf } from "../src/cascade/tail.js";
import { cascadeSizes } from "../src/cascade/sweep.js";
import { grid } from "./cases.js";

describe("the events of the tail", () => {
  it("takes every pair once: 190 on the IEEE 14's 20 branches, 820 on the 30's 41", () => {
    const pairs = allPairs(grid(14));
    assert.equal(pairs.length, 190);
    assert.equal(new Set(pairs.map((p) => p.join("-"))).size, 190);
    assert.ok(pairs.every(([a, b]) => a < b));
    assert.equal(allPairs(grid(30)).length, 820);
  });

  it("draws distinct sorted triples, and replays from its seed", () => {
    const g = grid(30);
    const triples = drawTriples(g, { count: 200, seed: 5 });
    assert.equal(triples.length, 200);
    assert.equal(new Set(triples.map((t) => t.join("-"))).size, 200);
    assert.ok(triples.every(([a, b, c]) => a < b && b < c));
    assert.deepEqual(drawTriples(g, { count: 50, seed: 5 }), drawTriples(g, { count: 50, seed: 5 }));
  });
});

describe("the density on logarithmic classes", () => {
  it("counts each value in its class, and those below the first edge apart", () => {
    const h = logHistogram([0, 0.5, 1, 1.5, 3, 9], [1, 2, 4, 8]);
    assert.equal(h.below, 2);
    assert.deepEqual(h.bins.map((b) => b.count), [2, 1, 0]);
    assert.deepEqual(h.bins.map((b) => b.density), [2 / 6, 1 / 12, 0]);
  });

  it("finds the slope of an exact power law, and none under three classes", () => {
    const edges = [1, 2, 4, 8, 16];
    const bins = edges.slice(0, -1).map((low, i) => ({ low, high: edges[i + 1], count: 1, density: Math.sqrt(low * edges[i + 1]) ** -1.5 }));
    assert.ok(Math.abs(slopeOf(bins) + 1.5) < 1e-12);
    assert.equal(slopeOf(bins.slice(0, 2)), null);
  });
});

describe("the tail of the IEEE 14's cascades", () => {
  it("sheds 200 of 259 MW on the loss of 1-2 alone at its base load, the J2 rule, and nothing else", () => {
    const g = grid(14);
    const { shares, lost } = cascadeSizes(g, 1, Array.from({ length: g.branchCount }, (_, k) => [k]), { dispatch: "pmax" });
    const tail = tailOf(shares, lost);
    assert.equal(tail.share.n, 20);
    assert.equal(tail.share.below, 19);
    assert.deepEqual(tail.share.bins.map((b) => b.count), [0, 0, 0, 0, 0, 1]);
    assert.equal(tail.shareSlope, null);
  });
});
