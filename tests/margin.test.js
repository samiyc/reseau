import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lodf } from "../src/flow/sensitivity.js";
import { solveDispatch } from "../src/opf/dispatch.js";
import { solveMargin } from "../src/opf/margin.js";
import { n1Overloads } from "../src/opf/security.js";
import { grid } from "./cases.js";

const gap = (actual, expected) => Math.max(0, ...Array.from(actual, (a, i) => Math.abs(a - expected[i])));

/** The worst loading after a single loss, for a dispatch's flows: the overloads past it are none, just under it some. */
function worstAfterLoss(g, flow, margin) {
  const factors = lodf(g);
  return { above: n1Overloads(g, flow, factors, { tolerance: margin - 1 + 1e-6 }).length, below: n1Overloads(g, flow, factors, { tolerance: margin - 1 - 1e-4 }).length };
}

describe("the dispatch past the N-1 limit", () => {
  it("keeps the IEEE 14's worst loading after a loss at 200/128, by hand: bus 2 at its 59 MW, 1-5 alone carries bus 1's 200", () => {
    const g = grid(14);
    const r = solveMargin(g);
    assert.ok(Math.abs(r.margin - 200 / 128) < 1e-9);
    assert.ok(gap(r.generation, [200, 59, 0, 0, 0]) < 1e-6);
    const worst = worstAfterLoss(g, r.flows.flow, r.margin);
    assert.equal(worst.above, 0);
    assert.ok(worst.below > 0);
  });

  it("meets the N-1 rule at its limit (187/259 on the IEEE 14), and grows past it (the IEEE 30 from 0.85)", () => {
    const g = grid(14);
    assert.ok(Math.abs(solveMargin(g, { loadFactor: 187 / 259 }).margin - 1) < 1e-9);
    const margins = [0.85, 0.9, 1, 1.2].map((loadFactor) => solveMargin(grid(30), { loadFactor }).margin);
    assert.ok(margins.every((m, i) => m > 1 && (i === 0 || m > margins[i - 1])), margins.join(" "));
  });

  it("sheds first, then lowers the worst loading: the IEEE 14 at 1.6 sheds 1.6 × 259 − 399 MW, 1-5 then at 340/128", () => {
    const r = solveMargin(grid(14), { loadFactor: 1.6 });
    assert.ok(Math.abs(r.shedTotal - (1.6 * 259 - 399)) < 1e-6);
    assert.ok(Math.abs(r.margin - 340 / 128) < 1e-6);
  });

  it("costs more than the cheapest dispatch, and keeps the intact grid within its limits, on the three grids", () => {
    for (const size of [14, 30, 118]) {
      const g = grid(size);
      const r = solveMargin(g);
      assert.ok(r.cost >= solveDispatch(g).cost - 1e-6, `IEEE ${size}`);
      assert.ok(r.flows.flow.every((f, k) => g.rate[k] === 0 || Math.abs(f) <= g.rate[k] * (1 + 1e-6)), `IEEE ${size}`);
      assert.equal(worstAfterLoss(g, r.flows.flow, r.margin).above, 0, `IEEE ${size}`);
    }
  });
});
