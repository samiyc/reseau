import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lodf } from "../src/flow/sensitivity.js";
import { solveDispatch } from "../src/opf/dispatch.js";
import { maxLoad } from "../src/opf/loadability.js";
import { n1Overloads } from "../src/opf/security.js";
import { grid, triangle } from "./cases.js";

const gap = (actual, expected) => Math.max(0, ...Array.from(actual, (a, i) => Math.abs(a - expected[i])));

/**
 * PGLib-OPF v23.07's BASELINE.md, the DC column (PowerModels v0.19.9, IPOPT), in $/h, with half a unit of the last
 * digit it gives: the dispatch must land within it (docs/recherche/bancs.md § 2).
 */
const BASELINE = [
  [14, "", 2051.5, 0.05],
  [14, "api", 4797.6, 0.05],
  [30, "", 7472.8, 0.05],
  [30, "api", 16145, 0.5],
  [118, "", 93101, 0.5],
  [118, "api", 231290, 5],
];

describe("the dispatch of a triangle, by hand", () => {
  it("puts all the load on the one generator, at its cost everywhere", () => {
    const r = solveDispatch(triangle());
    assert.equal(r.status, "optimal");
    assert.ok(Math.abs(r.cost - 1000) < 1e-6);
    assert.ok(gap(r.prices, [10, 10, 10]) < 1e-6);
    assert.deepEqual(r.binding, []);
  });

  it("splits it 50-50 when line 1-2 is held to 50 MW, and prices bus 2 above both generators", () => {
    // F(1-2) = (p1 + 100) / 3 with p1 + p3 = 100: p1 = 50; one more MW at bus 2 takes p1 to 49 and p3 to 52, 50 $/MWh.
    const r = solveDispatch(triangle({ congested: true }));
    assert.ok(gap(r.generation, [50, 50]) < 1e-6);
    assert.ok(Math.abs(r.cost - 2000) < 1e-6);
    assert.ok(gap(r.prices, [10, 50, 30]) < 1e-6);
    assert.equal(r.binding.length, 1);
    assert.equal(r.binding[0].branch, 0);
    assert.ok(Math.abs(r.binding[0].multiplier - 60) < 1e-6);
    assert.ok(Math.abs(r.flows.flow[0] - 50) < 1e-6);
  });
});

describe("the dispatch against PGLib-OPF's DC costs", () => {
  it("finds the six costs of BASELINE.md, under PowerModels' convention", () => {
    for (const [size, variant, cost, within] of BASELINE) {
      const r = solveDispatch(grid(size, { variant, convention: "powermodels" }));
      assert.equal(r.status, "optimal", `IEEE ${size} ${variant}`);
      assert.ok(Math.abs(r.cost - cost) <= within, `IEEE ${size} ${variant} : ${r.cost} au lieu de ${cost}`);
    }
  });

  it("finds the small-angle cases infeasible, as BASELINE.md does", () => {
    for (const size of [14, 30, 118]) assert.equal(solveDispatch(grid(size, { variant: "sad", convention: "powermodels" })).status, "infeasible", `IEEE ${size}`);
  });

  it("keeps every branch within its limit, and the generators within their bounds", () => {
    for (const size of [14, 30, 118]) {
      const g = grid(size, { variant: "api" });
      const r = solveDispatch(g);
      for (let k = 0; k < g.branchCount; k += 1) assert.ok(Math.abs(r.flows.flow[k]) <= g.rate[k] * (1 + 1e-9) + 1e-9, `IEEE ${size}, branche ${k}`);
      for (let gen = 0; gen < g.genCount; gen += 1) assert.ok(r.generation[gen] >= g.pmin[gen] - 1e-9 && r.generation[gen] <= g.pmax[gen] + 1e-9);
      assert.ok(Math.abs(r.flows.balance[0]) < 1e-6, `IEEE ${size} : le bilan`);
    }
  });
});

describe("the nodal prices", () => {
  it("are what one more MW consumed costs, bus by bus, on the congested IEEE 30", () => {
    const g = grid(30, { variant: "api" });
    const r = solveDispatch(g);
    assert.ok(Math.max(...r.prices) - Math.min(...r.prices) > 1, "des prix différents : une ligne lie");
    const step = 1e-3;
    for (let n = 0; n < g.busCount; n += 1) {
      const load = Float64Array.from(g.load);
      load[n] += step;
      const more = solveDispatch({ ...g, load });
      assert.ok(Math.abs((more.cost - r.cost) / step - r.prices[n]) < 1e-3 * Math.max(1, Math.abs(r.prices[n])), `nœud ${g.busId[n]}`);
    }
  });
});

describe("the N-1 rule", () => {
  it("cannot hold on the IEEE 14 past 187 MW of 259: lost 1-2, bus 1 has only 1-5 (128 MW), bus 2 gives 59", () => {
    const g = grid(14);
    const { factor } = maxLoad(g, { security: true, step: 1e-4 });
    assert.ok(Math.abs(factor - 187 / 259) < 2e-4, `${factor}`);
    assert.equal(solveDispatch(g, { security: true }).status, "infeasible");
  });

  it("leaves no overload after a single loss, and costs more than the dispatch without it", () => {
    for (const size of [14, 30, 118]) {
      const g = grid(size);
      const plain = solveDispatch(g, { loadFactor: 0.6 });
      const secure = solveDispatch(g, { loadFactor: 0.6, security: true });
      assert.equal(secure.left, 0, `IEEE ${size}`);
      assert.deepEqual(n1Overloads(g, secure.flows.flow, lodf(g)), [], `IEEE ${size}`);
      assert.ok(n1Overloads(g, plain.flows.flow, lodf(g)).length > 0, `IEEE ${size} : sans la règle, une perte surcharge`);
      assert.ok(secure.cost > plain.cost, `IEEE ${size}`);
    }
  });
});
