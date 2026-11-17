import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { areaShares, createDay, hourGrid, hourOf, reserveOf } from "../src/day/rts.js";
import { meritOrder, needsOf, priorityCommit, startCost } from "../src/day/commit.js";
import { playDay } from "../src/day/day.js";
import { lodf } from "../src/flow/sensitivity.js";
import { n1Overloads, worstAfterLoss } from "../src/opf/security.js";
import { rts } from "./cases.js";

const sum = (/** @type {ArrayLike<number>} */ values) => Array.prototype.reduce.call(values, (a, b) => a + b, 0);

describe("RTS-GMLC, read from data/ (docs/recherche/bancs.md § 3)", () => {
  it("has 73 buses in 3 areas of 2 850 MW, 120 branches, 158 generators, 73 of them thermal, bus 113 the reference", () => {
    const { data, grid } = rts();
    assert.deepEqual([grid.busCount, grid.branchCount, grid.genCount], [73, 120, 158]);
    assert.equal(grid.busId[grid.reference], 113);
    assert.equal(createDay(grid, data, rts().series, 0).thermal.length, 73);
    const day = createDay(grid, data, rts().series, 0);
    for (const area of [1, 2, 3]) {
      assert.equal(sum(grid.load.filter((_, n) => day.areaOfBus[n] === area)), 2850);
      assert.ok(Math.abs(sum(day.shares.filter((_, n) => day.areaOfBus[n] === area)) - 1) < 1e-12);
    }
  });

  it("has the 8 784 hours of 2020, a day-ahead peak of 8 192 MW, and a real-time load that is the forecast times a constant by area", () => {
    const { series } = rts();
    assert.equal(series.hours, 8784);
    const total = (part, h) => sum(["1", "2", "3"].map((a) => series[part].load[a][h]));
    const peak = Math.max(...Array.from({ length: series.hours }, (_, h) => total("dayAhead", h)));
    assert.ok(Math.abs(peak - 8191.8) < 0.5);
    for (const [area, ratio] of [["1", 0.9198], ["2", 0.9981], ["3", 0.9943]]) {
      const ratios = series.realTime.load[area].map((v, h) => v / series.dayAhead.load[area][h]);
      assert.ok(Math.max(...ratios.map((r) => Math.abs(r - ratio))) < 3e-4, `zone ${area}`);
    }
  });
});

describe("an hour of the day", () => {
  it("spreads each area's load on its buses, and caps the series at Pmax", () => {
    const { data, grid, series } = rts();
    const day = createDay(grid, data, series, 200);
    const hour = hourOf(day, "dayAhead", 5);
    const area1 = sum(hour.load.filter((_, n) => day.areaOfBus[n] === 1));
    assert.ok(Math.abs(area1 - series.dayAhead.load["1"][24 * 200 + 5]) < 1e-6);
    assert.ok(hour.available.every((mw, g) => mw <= grid.pmax[g] + 1e-9));
    assert.equal(reserveOf(day, 5).regUp, series.dayAhead.reserve.Reg_Up[24 * 200 + 5]);
  });

  it("gives each unit on its first point, fixed, and its segments; nothing of a unit off", () => {
    const { data, grid, series } = rts();
    const day = createDay(grid, data, series, 0);
    const hour = hourOf(day, "realTime", 0);
    const none = hourGrid(day, hour, new Uint8Array(day.thermal.length));
    assert.equal(sum(none.pmin), 0);
    assert.ok(Math.abs(sum(none.pmax) - sum(hour.available)) < 1e-6);
    const all = hourGrid(day, hour, new Uint8Array(day.thermal.length).fill(1));
    assert.ok(Math.abs(sum(all.pmin) - sum(day.thermal.map((u) => u.first))) < 1e-6);
    assert.ok(Math.abs(sum(all.pmax) - sum(day.thermal.map((u) => u.pmax)) - sum(hour.available)) < 1e-6);
    assert.ok(all.genCount < 4 * day.thermal.length, "les groupes d'un nœud au même coût sont fondus");
  });
});

describe("the priority list with a reserve (src/day/commit.js)", () => {
  it("ranks the nuclear first, and prices a start cold, warm or hot by the hours off", () => {
    const { data, grid, series } = rts();
    const day = createDay(grid, data, series, 0);
    assert.equal(day.thermal[meritOrder(day.thermal)[0]].uid, "121_NUCLEAR_1");
    const cc = day.thermal.find((u) => u.uid.includes("_CC_"));
    assert.deepEqual([Infinity, 1.5, 0.2].map((off) => startCost(cc, off)), cc.start.cost);
  });

  it("covers each hour's need, and holds each unit's minimum up and down times", () => {
    const { data, grid, series } = rts();
    const day = createDay(grid, data, series, 238);
    const { committed, needs } = priorityCommit(day, { reserve: 1, renewable: 0.25, hold: 6 });
    committed.forEach((on, h) => assert.ok(sum(day.thermal.map((u, i) => (on[i] ? u.pmax : 0))) >= needs[h].need));
    day.thermal.forEach((unit, u) => {
      const runs = committed.map((on) => on[u]).join("").match(/(1+|0+)/g);
      runs.forEach((run, i) => {
        const inner = i > 0 && i < runs.length - 1;
        if (inner && run[0] === "1") assert.ok(run.length >= unit.minUp, `${unit.uid} en marche ${run.length} h`);
        if (inner && run[0] === "0") assert.ok(run.length >= unit.minDown, `${unit.uid} à l'arrêt ${run.length} h`);
      });
    });
  });

  it("needs more with a margin on the wind and sun, and starts fewer units when it holds them on", () => {
    const { data, grid, series } = rts();
    const day = createDay(grid, data, series, 0);
    const [plain, margin] = [needsOf(day), needsOf(day, { renewable: 0.5 })];
    assert.ok(margin.every((m, h) => m.need >= plain[h].need));
    assert.ok(priorityCommit(day, { hold: 24 }).starts < priorityCommit(day, { hold: 0 }).starts);
  });
});

describe("a day played", () => {
  it("serves the load of day 100 with a margin, its cost the hours' dispatches and the starts", () => {
    const { data, grid, series } = rts();
    const day = createDay(grid, data, series, 100);
    const commitment = priorityCommit(day, { reserve: 1, renewable: 0.5, hold: 6 });
    const result = playDay(day, commitment);
    assert.equal(result.failed, 0);
    assert.equal(result.unserved, 0);
    assert.ok(Math.abs(result.cost - sum(result.hours.map((h) => h.cost)) - result.startCosts) < 1e-6);
    assert.equal(result.fastStarts, 0);
    assert.ok(result.curtailed >= 0);
  });

  it("sheds load at the first hour of day 200, when the wind falls 614 MW under its forecast, unless turbines start", () => {
    const { data, grid, series } = rts();
    const day = createDay(grid, data, series, 200);
    const commitment = priorityCommit(day, { reserve: 1 });
    assert.ok(playDay(day, commitment, { fastStart: false }).hours[0].shed > 100);
    const fast = playDay(day, commitment);
    assert.ok(fast.hours[0].shed < 1e-6);
    assert.ok(fast.fastStarts > 0);
    const turbines = fast.hours[0].on.reduce((count, on, u) => count + (on && !commitment.committed[0][u] ? 1 : 0), 0);
    assert.ok(turbines > 0 && day.thermal.every((unit, u) => !fast.hours[0].on[u] || commitment.committed[0][u] || unit.fast));
    const [forecast, real] = ["dayAhead", "realTime"].map((part) => sum(hourOf(day, part, 0).available.filter((_, g) => data.units[g].type === "WIND")));
    assert.ok(Math.abs(forecast - real - 614) < 1);
  });
});

describe("the N-1 list (src/day/day.js, security)", () => {
  it("holds the rule when it can on day 117, keeps the worst loading after a loss least when it cannot, and pays for it", () => {
    const { data, grid, series } = rts();
    const factors = lodf(grid);
    const day = createDay(grid, data, series, 117);
    const commitment = priorityCommit(day, { reserve: 1, renewable: 0.3, hold: 12 });
    const [plain, secure] = [false, true].map((security) => playDay(day, commitment, { security }));
    assert.equal(secure.unserved, 0);
    secure.hours.forEach((hour, h) => {
      const { margin, flows } = hour.dispatch;
      const worst = worstAfterLoss(hour.grid, flows.flow, factors);
      assert.ok(margin >= 1 && worst <= margin + 1e-5, `heure ${h}`);
      assert.equal(n1Overloads(hour.grid, flows.flow, factors, { tolerance: 1e-5 }).length === 0, margin <= 1 + 1e-6, `heure ${h}`);
      assert.ok(hour.cost >= plain.hours[h].cost - 1e-3 * Math.abs(plain.hours[h].cost), `heure ${h}`);
    });
    assert.ok(secure.hours.filter((hour) => hour.dispatch.margin <= 1 + 1e-6).length >= 8);
    assert.ok(secure.hours[17].dispatch.margin > 1.5);
    assert.ok(worstAfterLoss(plain.hours[17].grid, plain.hours[17].dispatch.flows.flow, factors) > secure.hours[17].dispatch.margin);
  });
});

describe("the shares of a grid's areas", () => {
  it("are each bus's load over its area's", () => {
    const shares = areaShares({ load: Float64Array.from([10, 30, 5, 0]) }, [1, 1, 2, 2]);
    assert.deepEqual(Array.from(shares), [0.25, 0.75, 1, 0]);
  });
});

describe("the names of the rule's variants (scripts/rts-data.js)", () => {
  it("read the reserve, the margin, the hold, the fast start and the N-1 rule", async () => {
    const { settingsOf } = await import("../scripts/rts-data.js");
    assert.deepEqual(settingsOf("v0.3-h12"), { reserve: 1, renewable: 0.3, hold: 12, fastStart: true, security: false });
    assert.deepEqual(settingsOf("r2-v0-h0-nofast"), { reserve: 2, renewable: 0, hold: 0, fastStart: false, security: false });
    assert.deepEqual(settingsOf("v0.3-h12-n1"), { reserve: 1, renewable: 0.3, hold: 12, fastStart: true, security: true });
    assert.throws(() => settingsOf("v0.3"));
  });
});
