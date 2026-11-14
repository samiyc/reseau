import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { caseFromMatpower, matrixOf } from "../scripts/matpower-to-json.js";
import { caseData, grid } from "./cases.js";

const source = (size) => readFileSync(new URL(`../data/pglib/pglib_opf_case${size}_ieee.m`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const sum = (values) => values.reduce((a, b) => a + b, 0);

describe("the conversion of a MATPOWER case", () => {
  it("gives back the committed JSON, for each case", () => {
    for (const size of [14, 30, 118]) {
      assert.deepEqual(caseFromMatpower(source(size), `pglib_opf_case${size}_ieee`), caseData(size));
    }
  });

  it("reads a matrix's rows, comments and semicolons left out", () => {
    const text = "mpc.gen = [\n\t1\t 2.5\t 3; % NG\n\t4\t 5\t 6;\n];\n";
    assert.deepEqual(matrixOf(text, "gen"), [
      [1, 2.5, 3],
      [4, 5, 6],
    ]);
  });

  it("keeps the provenance: PGLib v23.07, CC BY 4.0", () => {
    const data = caseData(14);
    assert.equal(data.version, "v23.07");
    assert.equal(data.license, "CC BY 4.0");
    assert.equal(data.baseMVA, 100);
  });
});

describe("the grid of PGLib's IEEE 14 (docs/recherche/bancs.md § 2)", () => {
  const g = grid(14);

  it("has 14 buses, 20 branches, 5 generators, 259 MW of load", () => {
    assert.equal(g.busCount, 14);
    assert.equal(g.branchCount, 20);
    assert.equal(g.genCount, 5);
    assert.ok(Math.abs(sum(g.load) - 259) < 1e-9);
  });

  it("has two generators that produce, three synchronous condensers, and linear costs", () => {
    assert.deepEqual([...g.pmax], [340, 59, 0, 0, 0]);
    for (let gen = 0; gen < g.genCount; gen += 1) assert.equal(g.cost[3 * gen], 0);
    assert.ok(Math.abs(g.cost[1] - 7.920951) < 1e-12);
  });

  it("has a limit on every branch, from 53 MW (4-9) to 664 MW (4-5)", () => {
    assert.equal(Math.min(...g.rate), 53);
    assert.equal(Math.max(...g.rate), 664);
    assert.equal(g.busId[g.from[8]], 4);
    assert.equal(g.busId[g.to[8]], 9);
  });

  it("takes a transformer's ratio into its susceptance: 1 / (x · ratio)", () => {
    assert.ok(Math.abs(g.susceptance[8] - 1 / (0.55618 * 0.969)) < 1e-12);
    assert.ok(Math.abs(g.susceptance[0] - 1 / 0.05917) < 1e-12);
  });

  it("has bus 1 as its reference", () => {
    assert.equal(g.busId[g.reference], 1);
  });
});

describe("the grids of PGLib's IEEE 30 and 118", () => {
  it("have the sizes of MATPOWER's cases", () => {
    const [g30, g118] = [grid(30), grid(118)];
    assert.deepEqual([g30.busCount, g30.branchCount, g30.genCount], [30, 41, 6]);
    assert.deepEqual([g118.busCount, g118.branchCount, g118.genCount], [118, 186, 54]);
    assert.ok(Math.abs(sum(g118.load) - 4242) < 1e-6);
  });
});
