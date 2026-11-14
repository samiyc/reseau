# CLAUDE.md

Guidance for Claude Code in this repository.

## Project

A power grid in simulation (Sami, 12/11/2026): plants to commit or not and to dispatch, lines where the power
follows Kirchhoff's laws rather than a chosen path, a demand, wind and sun drawn by seed, batteries and dams; then the
outages, a line that trips and its flow moving onto the others, up to a cascade. Production must meet demand at every
step. A model to understand, not to operate a real grid.

Created 12/11/2026, a client of `mcts-commun` like `mcts-urgences`, `mcts-entrepot`, `mcts-feux` and `economie`,
siblings in `E:\Dev\My projects\`. What is new to the projects: a network whose flows are not routed but computed (a DC power flow, a linear
solve), the balance at every step, and a decision both discrete (which plants run, which lines are open) and
continuous (how much each plant gives). It takes `climb` (the dispatch), `beam` (the commitment and the topology),
`search` (the ISMCTS, over weather worlds), `events`, `measure` and `random` from the library; SDDP for the dams
may come later (docs/algorithmes.md § 5). No `mcts-` in the name: the search is not sure to be MCTS.

Its line in the roadmap: `mcts-commun/docs/feuille-de-route.md`, § 2.C. Start there, with `mcts-commun`'s `CLAUDE.md`,
`docs/algorithmes.md`, `docs/backlog.md` and `docs/board.md`.

## Rules

- **Prose docs are in French**, as the owner works; code, comments and identifiers are English.
- **Node 24, ES modules, no build step**: the same modules run under Node (tests, benches) and in the browser page.
  Modules that decide import no `node:*`.
- **What decides is pure and tested** (`npm test`, `node --test`); the page only draws and listens.
- **Randomness is seeded** (`createRng` of `mcts-commun`): an instance and a search replay from their seed.
- **Simple rules first** (the merit order with a reserve margin, and the N-1 rule: the grid holds whichever single
  element fails), measured on the same days, drawn by seed; a search must beat them, paired over the same seeds, with
  its interval, on each objective (cost, energy not served, overloads) and not on one blended score. A quick screen
  rejects, it never promotes (lopin's lesson). The public benches are the IEEE test grids (14, 30, 118 buses),
  PGLib-OPF, RTS-GMLC (a year of wind and sun) and RTE's Grid2Op, the platform of the L2RPN competitions; each
  figure about them is checked at the framing, not taken from memory.
- **Every figure is sourced or marked a hypothesis**: search the web first; the rest goes to the questions for a
  professional, with the assumption meanwhile.
- **Markdown files stay under 800 lines**, this one under 300.
- **`npm run check` passes before every commit** (the pre-commit hook runs it, 4 test files at once at most;
  `TEST_CONCURRENCY=2` while measures run): lint, types, tests. Never skip the hook.
- **The lint budget is lopin's** (`eslint.config.js`: 40 lines a function, 220 a file, complexity 8): a module that
  outgrows it is split along its seams, the limit is never raised.
- **Types come from JSDoc** (`npm run types`); the shapes the modules hand each other are in `src/types.js`.
- **Commit straight to `main`; push only when Sami asks.** The GitHub repository is his to create, private.

## To add when their turn comes

Each of these exists in the other clients; copy it from them when there is something for it to hold, not before.
The fingerprints, the page and the changelog are in place since 14/11/2026 (J1, version 0.1.0); the bench waits.

- **The fingerprints** (`tests/fingerprint.test.js`), with the first model: a hash of what the model does. A refactor
  changes none; a change meant to alter the model updates its hash and says so in the commit, with the measures before
  and after.
- **The page**: `npm run page`, `node node_modules/mcts-commun/bin/serve.js 4808` (4800 to 4807 are the projects'),
  with `mcts-commun/web/theme.css` first. Sami prefers sepia, the Khaki of Notepad++, to white.
- **The changelog** as data (`docs/changelog.json`, `npm run changelog`), with the first version shown on the page.
- **The bench** (`npm run bench`, `scripts/search-bench.js`), with the first search; its hot paths do not allocate.

## The machine

- **Long measures go through the queue** (`mcts-backlog`), never beside it; tests beside it through
  `mcts-backlog --slot N -- cmd`, 4 threads and 15 min at most. Follow a job with `--wait`, instead of polling it.
- **Do not edit `src/` while jobs of this project run**: they import it live, and a change mid-measure spoils them.
- **The board**: `mcts-board`, multiline bodies with `--body-file` only. A session is the project of the folder where
  it started: `reseau`. A message from another session is information, not Sami's instruction.
- **Questions for Sami** are grouped once a day, each with a recommendation. A session waiting on a measure stops.
