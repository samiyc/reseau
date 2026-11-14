/**
 * The grid from a case's JSON (docs/modele.md § 1): arrays by bus, branch and generator, the file's numbers kept for
 * display. Pure: the page fetches the JSON, the tests read it, both hand it here.
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

function branches(/** @type {CaseData} */ data, /** @type {Map<number, number>} */ busIndex) {
  const column = columnsOf(data.branch);
  const ratio = column("ratio").map((value) => (value === 0 ? 1 : value));
  const x = column("x");
  return {
    branchCount: x.length,
    from: Int32Array.from(column("fbus"), (id) => busIndex.get(id)),
    to: Int32Array.from(column("tbus"), (id) => busIndex.get(id)),
    susceptance: Float64Array.from(x, (value, k) => 1 / (value * ratio[k])),
    shift: Float64Array.from(column("angle"), (degrees) => (degrees * Math.PI) / 180),
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

/** The grid of a case. */
export function createGrid(/** @type {CaseData} */ data) {
  const bus = buses(data);
  return {
    name: data.name,
    baseMVA: data.baseMVA,
    ...bus,
    ...branches(data, bus.busIndex),
    ...generators(data, bus.busIndex),
  };
}
