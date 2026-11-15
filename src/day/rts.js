/**
 * The RTS-GMLC day, hour by hour (docs/modele.md § 10): from the grid of data/rts_gmlc.json (createGrid) and its 2020
 * series by hour (scripts/rts-convert.js), what an hour asks and what it offers.
 *
 * - **The load** of each bus is its area's load at that hour times the bus's share of the area's load in bus.csv (the
 *   README of RTS-GMLC's series).
 * - **The thermal units** (73: combustion turbines, combined cycles, steam, the nuclear) are decided by the
 *   commitment. A unit on gives its first output point (`curve.points[0]`) and up to three segments above it, each at
 *   its marginal cost: their incremental heat rates rise, so the cheapest segment fills first (convex).
 * - **The wind, the sun, the hydro** give at most their series at that hour, at no cost; an **hypothesis**: all may be
 *   curtailed, the hydro and the rooftop sun too (RTS-GMLC fixes them). The CSP plant is a sun plant without its
 *   storage (**hypothesis**), at most its Pmax.
 * - **Out of the model**: the storage (J7), the synchronous condensers, and the DC link 113-316 (**hypothesis**: 0 MW).
 *
 * The ramps do not bind at the hour: the slowest unit (an oil steam turbine) ramps 60 MW in an hour, more than its
 * 7 MW between Pmin and Pmax, and every unit reaches its first point in an hour (checked on gen.csv, 15/11).
 */

/** @typedef {import("../types.js").Grid} Grid */

/** The thermal units of a case, in its generators' order: their index, their curve, their times and start costs. */
export function thermalUnits(/** @type {Grid} */ grid, /** @type {any[]} */ units) {
  return units.flatMap((unit, g) => {
    if (!unit.curve) return [];
    const { points, base, marginal } = unit.curve;
    const full = base + marginal.reduce((sum, m, i) => sum + m * (points[i + 1] - points[i]), 0);
    return [{ g, uid: unit.uid, area: unit.area, bus: grid.genBus[g], pmax: grid.pmax[g], first: points[0], points, base, marginal, fullLoad: full / grid.pmax[g], minUp: unit.minUp, minDown: unit.minDown, start: unit.start }];
  });
}

/** @typedef {ReturnType<typeof thermalUnits>[number]} Thermal */

/** Each bus's share of its area's load, and the area of each bus (1 to 3). */
export function areaShares(/** @type {Grid} */ grid, /** @type {number[]} */ areaOfBus) {
  const total = new Map();
  areaOfBus.forEach((area, n) => total.set(area, (total.get(area) ?? 0) + grid.load[n]));
  return Float64Array.from(grid.load, (load, n) => (total.get(areaOfBus[n]) > 0 ? load / total.get(areaOfBus[n]) : 0));
}

/**
 * What an hour of a series part ("dayAhead" or "realTime") gives: the load of each bus, and the most each generator
 * with a series may give, in MW (0 for the others). The hydro's real time is its forecast (RTS-GMLC's README).
 */
export function hourOf(day, /** @type {"dayAhead" | "realTime"} */ part, /** @type {number} */ hour) {
  const { grid, units, series, shares, areaOfBus } = day;
  const h = day.first + hour;
  const load = Float64Array.from(shares, (share, n) => share * series[part].load[String(areaOfBus[n])][h]);
  const available = Float64Array.from(units, (unit, g) => {
    if (!unit.series) return 0;
    const values = series[part].gen[unit.uid] ?? series.dayAhead.gen[unit.uid];
    return Math.min(values[h], grid.pmax[g]);
  });
  return { load, available };
}

/** The reserve requirements of an hour, from the day-ahead files, in MW: spinning (the three areas) and regulation up. */
export function reserveOf(day, /** @type {number} */ hour) {
  const h = day.first + hour;
  const { reserve } = day.series.dayAhead;
  return { spin: reserve.Spin_Up_R1[h] + reserve.Spin_Up_R2[h] + reserve.Spin_Up_R3[h], regUp: reserve.Reg_Up[h], flexUp: reserve.Flex_Up[h] };
}

/**
 * The day `index` (0 for 1 January 2020) of a case and its series: everything an hour needs. `data` is the JSON of
 * data/rts_gmlc.json, `grid` its createGrid.
 */
export function createDay(/** @type {Grid} */ grid, data, series, /** @type {number} */ index) {
  if (index < 0 || 24 * (index + 1) > series.hours) throw new Error(`jour ${index} hors de l'année`);
  const area = data.bus.columns.indexOf("area");
  const areaOfBus = data.bus.rows.map((row) => row[area]);
  return { index, first: 24 * index, grid, units: data.units, thermal: thermalUnits(grid, data.units), series, areaOfBus, shares: areaShares(grid, areaOfBus) };
}

/**
 * The grid of an hour, for the dispatch: its loads, and as generators, each committed unit's first point (fixed, at
 * its average cost) and its three segments (each at its marginal cost), then each series generator up to what it may
 * give. Generators at one bus with one cost are merged: the programme stays small.
 * @returns {Grid & { renewable: Uint8Array }}
 */
export function hourGrid(day, hour, /** @type {Uint8Array} */ committed) {
  const merged = new Map();
  const add = (/** @type {number} */ bus, /** @type {number} */ cost, /** @type {[number, number]} */ [pmin, pmax], renewable = 0) => {
    const key = `${bus}:${cost}:${pmin === pmax ? "f" : "v"}:${renewable}`;
    const entry = merged.get(key) ?? { bus, cost, pmin: 0, pmax: 0, renewable };
    merged.set(key, { ...entry, pmin: entry.pmin + pmin, pmax: entry.pmax + pmax });
  };
  day.thermal.forEach((unit, u) => {
    if (!committed[u]) return;
    add(unit.bus, unit.base / unit.first, [unit.first, unit.first]);
    unit.marginal.forEach((m, i) => add(unit.bus, m, [0, unit.points[i + 1] - unit.points[i]]));
  });
  hour.available.forEach((mw, g) => mw > 0 && add(day.grid.genBus[g], 0, [0, mw], 1));
  const gens = [...merged.values()];
  const of = (/** @type {(e: any) => number} */ f) => Float64Array.from(gens, f);
  const cost = Float64Array.from(gens.flatMap((e) => [0, e.cost, 0]));
  return { ...day.grid, load: hour.load, genCount: gens.length, genBus: Int32Array.from(gens, (e) => e.bus), genOn: new Uint8Array(gens.length).fill(1), pmin: of((e) => e.pmin), pmax: of((e) => e.pmax), pg: of((e) => e.pmin), cost, renewable: Uint8Array.from(gens, (e) => e.renewable) };
}
