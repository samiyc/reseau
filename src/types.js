/**
 * The shapes the modules hand each other, in JSDoc (`npm run types`). A module points here with
 * `@typedef {import("./types.js").Name} Name`. The model is docs/modele.md.
 */

/**
 * A case as scripts/matpower-to-json.js writes it: MATPOWER's matrices with the names of their columns.
 * @typedef {{ columns: string[], rows: number[][] }} Matrix
 * @typedef {{ name: string, source: string, version: string, license: string, baseMVA: number,
 *   bus: Matrix, gen: Matrix, branch: Matrix, gencost: Matrix }} CaseData
 */

/**
 * The grid, in arrays indexed by bus, branch and generator (docs/modele.md § 1). Powers in MW, susceptances in p.u. on
 * `baseMVA`, angles in radians.
 * @typedef {object} Grid
 * @property {string} name
 * @property {number} baseMVA
 * @property {string} convention "matpower" (the model's) or "powermodels" (to check against PGLib's costs)
 * @property {number} busCount
 * @property {Int32Array} busId the bus's number in the file, for display
 * @property {Map<number, number>} busIndex from the file's number to the index
 * @property {Float64Array} load Pd, in MW
 * @property {Float64Array} shunt Gs, in MW consumed at 1 p.u.
 * @property {number} reference the index of the reference bus (type 3)
 * @property {number} branchCount
 * @property {Int32Array} from
 * @property {Int32Array} to
 * @property {Float64Array} susceptance 1 / (x · ratio), in p.u. (PowerModels': x / (r² + x²))
 * @property {Float64Array} shift the phase shift, in radians (PowerModels': 0)
 * @property {Float64Array} angleMin the least θf − θt, in radians (−Infinity: none)
 * @property {Float64Array} angleMax the most θf − θt, in radians (Infinity: none)
 * @property {Float64Array} rate the thermal limit RATE_A, in MW
 * @property {Uint8Array} inService the branch's status in the file
 * @property {number} genCount
 * @property {Int32Array} genBus
 * @property {Uint8Array} genOn
 * @property {Float64Array} pmin
 * @property {Float64Array} pmax
 * @property {Float64Array} pg the file's production, in MW
 * @property {Float64Array} cost c2, c1, c0 for each generator, in $/h (three numbers a generator)
 */

/**
 * The connected parts of a grid under a set of branches in service.
 * @typedef {object} Islands
 * @property {number} count
 * @property {Int32Array} of the island of each bus
 * @property {Int32Array} reference the reference bus of each island
 */

/**
 * A DC power flow (docs/modele.md § 2).
 * @typedef {object} Flows
 * @property {Islands} islands
 * @property {Float64Array} theta the angle of each bus, in radians
 * @property {Float64Array} flow each branch's flow from `from` to `to`, in MW (0 out of service)
 * @property {Float64Array} balance what each island's reference bus takes on above its own injection, in MW
 */

export {};
