/**
 * The grid from a case's JSON (docs/modele.md § 1): arrays by bus, branch and generator, the file's numbers kept for
 * display. Pure: the page fetches the JSON, the tests read it, both hand it here.
 *
 * Two conventions for a branch's susceptance: MATPOWER's (the model's), b = 1 / (x · ratio) with the phase shift; and
 * PowerModels' DC (`DCPPowerModel`, the one that gives PGLib-OPF's BASELINE costs, read in its v0.19.9 code),
 * b = x / (r² + x²), the imaginary part of 1 / (r + jx), without the ratio or the shift. The second only serves to
 * check the dispatch against those costs (docs/mesures/opf-j3.md).
 */

/** @typedef {import("../types.js").CaseData} CaseData */
/** @typedef {import("../types.js").Grid} Grid */
/** @typedef {import("../types.js").Matrix} Matrix */

/** A reader of a matrix's column by name. */
function columnsOf(/** @type {Matrix} */ matrix) {
  return (/** @type {string} */ name) => {
    const at = matrix.columns.indexOf(name);
    if (at < 0) throw new Error(`colonne ${name} absente`);
    return matrix.rows.map((row) => row[at]);
  };
}

function buses(/** @type {CaseData} */ data) {
  const column = columnsOf(data.bus);
  const ids = column("bus_i");
  const reference = column("type").indexOf(3);
  if (reference < 0) throw new Error("aucun nœud de référence (type 3)");
  return {
    busCount: ids.length,
    busId: Int32Array.from(ids),
    busIndex: new Map(ids.map((id, index) => [id, index])),
    load: Float64Array.from(column("Pd")),
    shunt: Float64Array.from(column("Gs")),
    reference,
  };
}

const radians = (/** @type {number} */ degrees) => (degrees * Math.PI) / 180;

/** The susceptances and shifts of a convention, "matpower" or "powermodels". */
function electrical(/** @type {(name: string) => number[]} */ column, /** @type {string} */ convention) {
  const x = column("x");
  if (convention === "powermodels") {
    const r = column("r");
    return { susceptance: Float64Array.from(x, (value, k) => value / (r[k] ** 2 + value ** 2)), shift: new Float64Array(x.length) };
  }
  if (convention !== "matpower") throw new Error(`convention inconnue : ${convention}`);
  const ratio = column("ratio").map((value) => (value === 0 ? 1 : value));
  return { susceptance: Float64Array.from(x, (value, k) => 1 / (value * ratio[k])), shift: Float64Array.from(column("angle"), radians) };
}

/** The limits on θf − θt, in radians; none (±Infinity) at ±360° or more, or both 0, as MATPOWER reads them. */
function angleLimits(/** @type {(name: string) => number[]} */ column) {
  const [low, high] = [column("angmin"), column("angmax")];
  const none = (/** @type {number} */ k) => (low[k] === 0 && high[k] === 0) || low[k] <= -360 || high[k] >= 360;
  return {
    angleMin: Float64Array.from(low, (value, k) => (none(k) ? -Infinity : radians(value))),
    angleMax: Float64Array.from(high, (value, k) => (none(k) ? Infinity : radians(value))),
  };
}

function branches(/** @type {CaseData} */ data, /** @type {Map<number, number>} */ busIndex, /** @type {string} */ convention) {
  const column = columnsOf(data.branch);
  return {
    branchCount: data.branch.rows.length,
    from: Int32Array.from(column("fbus"), (id) => busIndex.get(id)),
    to: Int32Array.from(column("tbus"), (id) => busIndex.get(id)),
    ...electrical(column, convention),
    ...angleLimits(column),
    rate: Float64Array.from(column("rateA")),
    inService: Uint8Array.from(column("status")),
  };
}

function generators(/** @type {CaseData} */ data, /** @type {Map<number, number>} */ busIndex) {
  const column = columnsOf(data.gen);
  const costs = columnsOf(data.gencost);
  const [c2, c1, c0] = ["c2", "c1", "c0"].map(costs);
  return {
    genCount: data.gen.rows.length,
    genBus: Int32Array.from(column("bus"), (id) => busIndex.get(id)),
    genOn: Uint8Array.from(column("status")),
    pmin: Float64Array.from(column("Pmin")),
    pmax: Float64Array.from(column("Pmax")),
    pg: Float64Array.from(column("Pg")),
    cost: Float64Array.from(c2.flatMap((value, g) => [value, c1[g], c0[g]])),
  };
}

/** The grid of a case, under MATPOWER's convention unless `convention` is "powermodels". */
export function createGrid(/** @type {CaseData} */ data, { convention = "matpower" } = {}) {
  const bus = buses(data);
  return {
    name: data.name,
    baseMVA: data.baseMVA,
    convention,
    ...bus,
    ...branches(data, bus.busIndex, convention),
    ...generators(data, bus.busIndex),
  };
}
