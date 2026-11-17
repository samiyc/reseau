/**
 * The beam on the commitment (J5, docs/recherche/pistes.md P7): which units run at each hour of the day, decided the
 * day before on the forecast like the rule (src/day/commit.js), but searched rather than listed.
 *
 * - **The beam** (`createBeam` of mcts-commun) keeps the `beam` best partial plans, hour after hour. A plan's step is
 *   one hour: the units on, from the units of the hour before.
 * - **The successors are the rule's** (de Mars, 2022: a policy prunes the units to start, a search looks ahead): the
 *   rule's own hour from the plan's state (its reserve, its hold); or that hour with one more unit, the k-th free one
 *   off in merit order (k from 1 to `SPREAD`: the cheapest, or one farther down the list, maybe better placed on the
 *   grid); or with its one or two dearest units stopped; or with every unit of the hour before kept on. Each keeps the
 *   minimum up and down times, and the capacity the rule asks (its reserve: the beam searches which units, not how
 *   many MW are held back). The first hour is the rule's: the day starts from the same units.
 * - **The note** is each hour's dispatch on the forecast, with the fast start (src/day/day.js; past the N-1 limit with
 *   `security`) plus the starts, in Sami's order (docs/recherche/questions.md, question 4): the load shed, then the
 *   overloads (the worst loading after a loss past 1, with `security`), then the cost. One number carries the order:
 *   the shed weighs 10¹⁰ $ a MW, the overload 10⁹ $ a unit of loading (to 10⁻⁴), so that neither trades for a cost.
 * - **Never worse than the rule on the forecast**: the rule's plan is noted the same way, and kept if the beam found
 *   nothing better. The plan is then played on the real time (`playDay`), as the rule's is.
 *
 * An hour's dispatch depends only on its units on: each is solved once a day (`evaluated` counts them).
 */

import { createBeam } from "mcts-commun/beam.js";
import { commitHour, meritOrder, needsOf, priorityCommit, startCost, wantedAt } from "./commit.js";
import { withFastStarts } from "./day.js";
import { hourOf } from "./rts.js";

const HOURS = 24;
/** How far down the merit order a successor may start a unit: the k-th free unit off, k up to this. */
export const SPREAD = 8;
/** The rule's hour, one more unit (`SPREAD` ways), one or two fewer, all kept on. */
const ACTIONS = SPREAD + 4;
const SHED_WEIGHT = 1e10;
const OVER_WEIGHT = 1e9;

/** What a day's search reads, and the dispatches it has solved. */
function contextOf(day, params) {
  const { thermal } = day;
  const order = meritOrder(thermal);
  const needs = needsOf(day, params);
  const n = thermal.length;
  return {
    day, thermal, order, needs, n,
    wanted: needs.map(({ need }) => wantedAt(thermal, order, need)),
    hours: Array.from({ length: HOURS }, (_, h) => hourOf(day, "dayAhead", h)),
    hold: params.hold ?? 0,
    security: Boolean(params.security),
    fast: params.fastStart === false ? [] : order.filter((u) => thermal[u].fast),
    cache: new Map(),
    best: /** @type {Float64Array | null} */ (null),
    bestTotal: Infinity,
    scratch: [new Float64Array(2 * n + HOURS + 4), new Float64Array(2 * n + HOURS + 4)],
    at: { since: n, plan: 2 * n, total: 2 * n + HOURS, shed: 2 * n + HOURS + 1, over: 2 * n + HOURS + 2, cost: 2 * n + HOURS + 3 },
  };
}

/** A plan's state as the rule reads it: each unit on or off, and since how many hours. */
const viewOf = (ctx, /** @type {Float64Array} */ state) => ({ on: state.subarray(0, ctx.n), since: state.subarray(ctx.n, 2 * ctx.n) });

const capacityOf = (ctx, /** @type {Uint8Array} */ on) => on.reduce((sum, v, u) => sum + (v ? ctx.thermal[u].pmax : 0), 0);

/** The rule's hour with the k-th unit off it may start, in merit order (kept on, or off its minimum down time). */
function started(ctx, view, /** @type {Uint8Array} */ rule, /** @type {number} */ k) {
  let seen = 0;
  for (const u of ctx.order) {
    if (rule[u] || (!view.on[u] && view.since[u] < ctx.thermal[u].minDown)) continue;
    seen += 1;
    if (seen === k) return Uint8Array.from(rule, (v, j) => (j === u ? 1 : v));
  }
  return null;
}

/** The rule's hour with its `k` dearest units stopped, of those it may stop (past their minimum up time). */
function stopped(ctx, view, /** @type {Uint8Array} */ rule, /** @type {number} */ k) {
  const on = Uint8Array.from(rule);
  let left = k;
  for (let i = ctx.order.length - 1; i >= 0 && left > 0; i -= 1) {
    const u = ctx.order[i];
    if (!on[u] || (view.on[u] && view.since[u] < ctx.thermal[u].minUp)) continue;
    on[u] = 0;
    left -= 1;
  }
  return left === 0 ? on : null;
}

/** The rule's hour with every unit of the hour before still on; none if that is the rule's hour. */
function kept(view, /** @type {Uint8Array} */ rule) {
  const on = Uint8Array.from(rule, (v, u) => (v || view.on[u] ? 1 : 0));
  return on.some((v, u) => v !== rule[u]) ? on : null;
}

/** The units on at hour `h` after action `a` from a plan's state; null if the action cannot be played. */
export function childOn(ctx, /** @type {Float64Array} */ parent, /** @type {number} */ a, /** @type {number} */ h) {
  const view = viewOf(ctx, parent);
  const rule = commitHour(ctx, view, ctx.needs[h].need, ctx.wanted.slice(h + 1, h + 1 + ctx.hold));
  if (a === 0) return rule;
  if (h === 0) return null;
  let on = kept(view, rule);
  if (a <= SPREAD) on = started(ctx, view, rule, a);
  else if (a <= SPREAD + 2) on = stopped(ctx, view, rule, a - SPREAD);
  return on && capacityOf(ctx, on) >= Math.min(ctx.needs[h].need, capacityOf(ctx, rule)) ? on : null;
}

/**
 * An hour's dispatch on the forecast under the units on, solved once: its cost, shed and overload; null if none. With
 * the fast start, as the day will play it (src/day/day.js): the combustion turbines off start while it sheds, each at
 * its cold start's cost (**hypothesis**: the note does not know since when they are off, nor holds them on after).
 */
function scoreHour(ctx, /** @type {number} */ h, /** @type {Uint8Array} */ on) {
  const key = `${h}:${on.join("")}`;
  if (ctx.cache.has(key)) return ctx.cache.get(key);
  const units = Uint8Array.from(on);
  const r = withFastStarts(ctx.day, ctx.hours[h], units, { free: ctx.fast.filter((u) => !on[u]), security: ctx.security });
  const fast = ctx.fast.reduce((sum, u) => sum + (units[u] && !on[u] ? startCost(ctx.thermal[u], Infinity) : 0), 0);
  const margin = "margin" in r.dispatch ? Math.round(Number(r.dispatch.margin) * 1e4) / 1e4 : 1;
  const score = r.status === "optimal" && !Number.isNaN(margin) ? { cost: r.cost + fast, shed: r.shed, over: Math.max(0, margin - 1) } : null;
  ctx.cache.set(key, score);
  return score;
}

/** Moves `child` (a copy of `parent`) to the units `on` at hour `h`: on, since, the action; the starts' cost. */
function advance(ctx, /** @type {Float64Array} */ parent, /** @type {Float64Array} */ child, { on, h, a }) {
  const { n, at } = ctx;
  let starts = 0;
  for (let u = 0; u < n; u += 1) {
    if (on[u] && !parent[u] && h > 0) starts += startCost(ctx.thermal[u], parent[at.since + u]);
    child[u] = on[u];
    child[at.since + u] = on[u] === parent[u] ? parent[at.since + u] + 1 : 1;
  }
  child[at.plan + h] = a;
  return starts;
}

/** Plays action `a` at hour `h` into `child`: the hour's note, added to the plan's; NaN if it cannot be played. */
function step(ctx, /** @type {Float64Array} */ parent, /** @type {Float64Array} */ child, { a, h }) {
  const on = childOn(ctx, parent, a, h);
  const score = on && scoreHour(ctx, h, on);
  if (!score) return NaN;
  const starts = advance(ctx, parent, child, { on, h, a });
  const { at } = ctx;
  const total = score.shed * SHED_WEIGHT + score.over * OVER_WEIGHT + score.cost + starts;
  child[at.total] += total;
  child[at.shed] += score.shed;
  child[at.over] += score.over;
  child[at.cost] += score.cost + starts;
  return total;
}

/** The state of the day before the first hour: every unit off, for long. */
function rootOf(ctx) {
  const root = new Float64Array(ctx.at.cost + 1);
  root.fill(Infinity, ctx.n, 2 * ctx.n);
  return root;
}

/** A plan's state, as a key: the units on, and since when (past 255 hours, the same). */
function hashOf(ctx, /** @type {Float64Array} */ state) {
  let hash = 2166136261;
  for (let i = 0; i < 2 * ctx.n; i += 1) hash = Math.imul(hash ^ Math.min(state[i], 255), 16777619);
  return hash | 0;
}

/** The plan of a list of actions from the root: its units on by hour, and its note; null if an hour cannot be played. */
function walk(ctx, /** @type {number[]} */ actions) {
  let state = rootOf(ctx);
  const committed = [];
  for (let h = 0; h < HOURS; h += 1) {
    const child = Float64Array.from(state);
    if (Number.isNaN(step(ctx, state, child, { a: actions[h], h }))) return null;
    committed.push(Uint8Array.from(child.subarray(0, ctx.n)));
    state = child;
  }
  const { at } = ctx;
  return { committed, total: state[at.total], forecast: { shed: state[at.shed], over: state[at.over], cost: state[at.cost] } };
}

/**
 * The note of the hours left after `depth`, the rule playing them from `state` (Infinity if one cannot be played);
 * the plan so completed is kept if it is the best seen. Its later actions are the rule's, 0: as the state holds them.
 */
function rollout(ctx, /** @type {Float64Array} */ state, /** @type {number} */ depth) {
  let [from, to] = ctx.scratch;
  from.set(state);
  for (let h = depth; h < HOURS; h += 1) {
    to.set(from);
    if (Number.isNaN(step(ctx, from, to, { a: 0, h }))) return Infinity;
    [from, to] = [to, from];
  }
  const left = from[ctx.at.total] - state[ctx.at.total];
  if (from[ctx.at.total] < ctx.bestTotal) [ctx.best, ctx.bestTotal] = [Float64Array.from(state), from[ctx.at.total]];
  return left;
}

/**
 * The beam's problem: each hour's step; a plan's value, the rule's note on the hours left (the pilot method: each
 * partial plan is judged on its day completed by the rule, so the rule's own plan is always among them); a plan's
 * state as its key.
 */
function problemOf(ctx) {
  return {
    play: (/** @type {Float64Array} */ parent, /** @type {Float64Array} */ child, /** @type {number} */ a, /** @type {number} */ depth) => -step(ctx, parent, child, { a, h: depth - 1 }),
    value: (/** @type {Float64Array} */ state, /** @type {number} */ depth) => -rollout(ctx, state, depth),
    hash: (/** @type {Float64Array} */ state) => hashOf(ctx, state),
  };
}

/** The beam's best full plan, if better than the rule's on the forecast. */
function foundOf(ctx, rule) {
  const best = ctx.best;
  if (!best || (rule && ctx.bestTotal >= rule.total - 1e-6)) return null;
  return walk(ctx, Array.from(best.subarray(ctx.at.plan, ctx.at.plan + HOURS)));
}

/**
 * The commitment of a day by the beam of `params.beam` plans (the rule's other settings: `reserve`, `renewable`,
 * `hold`; `security` to note each hour under the N-1 rule): as priorityCommit's, with `forecast` (the plan's note on
 * the forecast: shed, overload, cost), `rule` (the rule's), `fromRule` (the beam found nothing better), `evaluated`.
 */
export function beamCommit(day, params = {}) {
  const ctx = contextOf(day, params);
  const rule = walk(ctx, Array.from({ length: HOURS }, () => 0));
  const beam = createBeam({ size: ctx.at.cost + 1, width: params.beam ?? 8, actions: ACTIONS, Type: Float64Array });
  beam.run(rootOf(ctx), problemOf(ctx), { depth: HOURS });
  const found = foundOf(ctx, rule);
  const plan = found ?? rule ?? { ...priorityCommit(day, params), forecast: null };
  const { starts, startCosts } = countStarts(ctx, plan.committed);
  return { committed: plan.committed, starts, startCosts, needs: ctx.needs, forecast: plan.forecast, rule: rule?.forecast ?? null, fromRule: !found, evaluated: ctx.cache.size };
}

/** The starts of a plan and their cost, the first hour's units on already (src/day/commit.js). */
function countStarts(ctx, /** @type {Uint8Array[]} */ committed) {
  let [starts, startCosts] = [0, 0];
  committed.forEach((on, h) => {
    if (h === 0) return;
    on.forEach((v, u) => {
      if (!v || committed[h - 1][u]) return;
      let off = 1;
      while (h - off - 1 >= 0 && !committed[h - off - 1][u]) off += 1;
      [starts, startCosts] = [starts + 1, startCosts + startCost(ctx.thermal[u], h - off - 1 < 0 ? Infinity : off)];
    });
  });
  return { starts, startCosts };
}

/** A day's commitment under a variant's settings (scripts/rts-data.js): the beam's with `beam`, else the rule's. */
export const planDay = (day, settings) => (settings.beam ? beamCommit(day, settings) : priorityCommit(day, settings));
