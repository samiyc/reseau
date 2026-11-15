import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { priorityCommit } from "../src/day/commit.js";
import { playDay } from "../src/day/day.js";
import { dayOfSeed, loadRts, settingsOf } from "./rts-data.js";

/**
 * The command of the race races/j4-regle.json (mcts-commun's docs/course.md): plays the rule's variant on the
 * training days of the seeds `from` to `from + count − 1`, and writes one JSON line a seed to `out`: the score is the
 * day's cost in $ (lower is better), with its energy not served beside it, which the race does not read and the
 * measure checks (Sami's order: the energy not served first).
 */
const { values } = parseArgs({ options: { variant: { type: "string" }, from: { type: "string" }, count: { type: "string" }, out: { type: "string" } } });
const settings = settingsOf(values.variant);
const rts = loadRts();
const out = resolve(values.out);
mkdirSync(dirname(out), { recursive: true });
for (let seed = Number(values.from); seed < Number(values.from) + Number(values.count); seed += 1) {
  const day = rts.day(dayOfSeed("train", seed));
  const result = playDay(day, priorityCommit(day, settings));
  appendFileSync(out, `${JSON.stringify({ seed, score: result.cost, unserved: result.unserved, day: day.index })}\n`);
}
