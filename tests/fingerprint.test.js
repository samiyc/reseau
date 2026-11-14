import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { solveFlows } from "../src/flow/dcflow.js";
import { runCascade } from "../src/cascade/cascade.js";
import { baseInjection, describeState, setpointsFor } from "../src/grid/state.js";
import { solveDispatch } from "../src/opf/dispatch.js";
import { grid } from "./cases.js";

/**
 * What the model does, held in a hash (as in the other clients of mcts-commun): a refactor must leave it unchanged.
 * A change meant to alter the model updates it here, and its commit says so, with the measures before and after.
 * Flows are rounded to the micro-megawatt, so that a reordered sum does not move a hash.
 */
const EXPECTED = {
  // 14/11/2026, J1: the DC power flow of the base state (the file's Pg, the reference bus balancing).
  base14: "3ac3feafa7c1134a",
  base30: "5a8dadf9ae7b0712",
  base118: "9ba8fc3335e9fb81",
  // 14/11/2026, J1: the IEEE 14 after the loss of each branch in turn, islands included.
  outages14: "c471c0939cbea295",
  // 14/11/2026, J2: the state of each grid at 1.2 times its load, its generators sharing it in proportion to Pmax.
  state: "86853e89baa8bba0",
  // 14/11/2026, J2: the cascade after each single loss on the IEEE 30 at 1.2 times its load, Grid2Op's rule.
  cascades30: "ffc502f43f41ed16",
  // 14/11/2026, J3: the DC-OPF of the three grids at 0.7 times their load, without and with the N-1 rule.
  dispatch: "ebe5c8e2f419ef19",
  // 14/11/2026, J3: the state of each grid at 1.2 times its load under the cheapest dispatch, shedding included.
  stateCost: "d9b1b18b2eece3a6",
  // 14/11/2026, J3: the IEEE 30's cascades after each single loss at its base load, under the cheapest dispatch.
  cascades30Cost: "abf238133ff7e7ca",
  // 14/11/2026, J3: the IEEE 30's cascades after each pair of losses among its first 12 branches at 0.8 times its load,
  // under the N-1 secure dispatch (single losses trip nothing there).
  cascades30Secure: "1a76287cc0e910c1",
};

const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
const rounded = (values) => Array.from(values, (v) => Math.round(v * 1e6) / 1e6 + 0);

function base(size) {
  const g = grid(size);
  const { flow, balance } = solveFlows(g, baseInjection(g));
  return digest([rounded(flow), rounded(balance)]);
}

function outages() {
  const g = grid(14);
  const injection = baseInjection(g);
  return digest(
    Array.from({ length: g.branchCount }, (_, k) => {
      const { flow, balance, islands } = solveFlows(g, injection, Uint8Array.from(g.inService, (on, b) => (b === k ? 0 : on)));
      return [rounded(flow), rounded(balance), [...islands.of]];
    }),
  );
}

function states(dispatch = "pmax") {
  return digest([14, 30, 118].map((size) => {
    const s = describeState(grid(size), { loadFactor: 1.2, dispatch });
    return [rounded(s.generation), rounded(s.flows.flow), rounded([s.shed])];
  }));
}

function cascades(dispatch = "pmax", loadFactor = 1.2) {
  const g = grid(30);
  const setpoints = setpointsFor(g, { loadFactor, dispatch });
  return digest(
    Array.from({ length: g.branchCount }, (_, k) => {
      const r = runCascade(g, { loadFactor, dispatch, setpoints, inService: Uint8Array.from(g.inService, (on, b) => (b === k ? 0 : on)) });
      return [r.steps.map((s) => s.tripped.map((t) => [t.branch, t.why, t.round])), rounded([r.shed])];
    }),
  );
}

function securePairs() {
  const g = grid(30);
  const loadFactor = 0.8;
  const setpoints = setpointsFor(g, { loadFactor });
  const pairs = Array.from({ length: 12 }, (_, a) => Array.from({ length: a }, (_, b) => [b, a])).flat();
  return digest(pairs.map((pair) => {
    const r = runCascade(g, { loadFactor, setpoints, inService: Uint8Array.from(g.inService, (on, k) => (pair.includes(k) ? 0 : on)) });
    return [r.steps.map((s) => s.tripped.map((t) => [t.branch, t.why, t.round])), rounded([r.shed])];
  }));
}

function dispatches() {
  return digest([14, 30, 118].flatMap((size) => [false, true].map((security) => {
    const r = solveDispatch(grid(size), { loadFactor: 0.7, security });
    return [rounded(r.generation), rounded(r.prices), rounded([r.cost])];
  })));
}

describe("the fingerprints of the model", () => {
  it("keeps the base flows of the three PGLib grids", () => {
    assert.deepEqual({ base14: base(14), base30: base(30), base118: base(118) }, { base14: EXPECTED.base14, base30: EXPECTED.base30, base118: EXPECTED.base118 });
  });

  it("keeps the IEEE 14's flows after each single loss", () => {
    assert.equal(outages(), EXPECTED.outages14);
  });

  it("keeps the dispatch in proportion to Pmax", () => {
    assert.equal(states(), EXPECTED.state);
  });

  it("keeps the IEEE 30's cascades", () => {
    assert.equal(cascades(), EXPECTED.cascades30);
  });

  it("keeps the state and the IEEE 30's cascades under the cheapest dispatch", () => {
    assert.deepEqual({ stateCost: states("cost"), cascades30Cost: cascades("cost", 1) }, { stateCost: EXPECTED.stateCost, cascades30Cost: EXPECTED.cascades30Cost });
  });

  it("keeps the IEEE 30's cascades after pairs of losses under the N-1 dispatch", () => {
    assert.equal(securePairs(), EXPECTED.cascades30Secure);
  });

  it("keeps the dispatch of the three grids, without and with the N-1 rule", () => {
    assert.equal(dispatches(), EXPECTED.dispatch);
  });
});
