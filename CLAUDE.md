# StockThink — Session Context for Claude

## What this project is
Zero-budget client-side chess Game Review app deployed at https://malikahed.github.io/stockthink/. No API keys, no server, no payment methods ever. Runs fully in the browser via Stockfish 18 WASM + chessops + chessground. Stack: Vite 5 + **TypeScript** (the engine is TS — the only Python in the repo is a research reference), vitest, `~/bin/gh` (NOT on PATH) for deploys.

## The five hard rules (never regress these)
R1 no eval numbers in prose · R2 no PV dumps in prose (chips instead) ·
R3 no empty-handed fallback (say less) · R4 every claim machine-verified ·
R5 cause before verdict. The V1 disease was an eval-speak fallback template —
there is structurally no such path in V2; keep it that way.

## How the system works (V2, shipped 2026-06-11)

Pipeline: PGN → engine pool → per-move **facts** (deterministic detectors) →
**classification** (win%-drop ladder + facts) → **composed prose** (templates).

```
analyze.ts → analysis/report.ts:buildReport()
               ├─ concepts/annotate.ts:annotateMove()   ← THE HEART: all facts
               │    ├─ concepts/detectors.ts            ← tactical (hangs/fork/trap/…)
               │    ├─ concepts/positional.ts           ← 14 purposes + 7 regressions
               │    └─ concepts/primitives.ts, board.ts ← pin rays, pin-aware SEE, x-ray
               ├─ analysis/classify.ts                  ← brilliant…blunder ladder
               └─ compose/compose.ts + templates.ts     ← facts → sentences (Mode A)
```

- `concepts/facts.ts` — typed `Fact` union (56 kinds) + priority sort. Adding a
  concept = detector + fact kind + priority + template + wiring in annotate.ts.
- `src/llm/` — Mode B: factsheet/verify/exchange (paste-a-prompt Claude flow).
- `src/ui/` — badges, coach bubble + variation chips, summary, movelist, graph.
- **Quality gate**: `npx vitest run test/gate.e2e.test.ts` — real WASM engine
  over Opera Game + Blackburne Shilling; prints every comment; asserts zero
  eval-speak, no PV dumps, 93–100% fact coverage. Full suite: `npx vitest run`.

## The improvement loop (how this project gets better)

The engine improves through **small bounded daily sessions**, not big rewrites.
The UI/UX is considered done — daily work touches explanations only.
User says "improve analysis" → run the `/improve-analysis` skill, which simply
executes **`improve/README.md`** — the self-contained workshop protocol
(hard limits: default 3 / max 5 work units, gate must pass, one commit per
item, TRACKER updated, push = deploy, stop).

The workshop (`improve/`) is the daily working set — keep it to 3 files:

| File | Role |
|---|---|
| `improve/README.md` | the session protocol (start here every day) |
| `improve/TODO.md` | prioritized queue, executed top-down; `[hard]` items = strongest model only |
| `improve/TRACKER.md` | concept coverage snapshot + recall table + 1–3-line daily log |

Reference shelf (consulted only when an item needs it, never read wholesale):
`docs/knowledge/concept-taxonomy.md` (full concept matrix) ·
`docs/knowledge/chesscom-templates.md` (verbatim target phrasing, append-only) ·
`docs/knowledge/sources.md` (lichess puzzle DB = ground truth).

Ground truth = lichess puzzle fixtures (`scripts/puzzles/fetch-fixtures.mjs` →
`test/fixtures/puzzles/<theme>.csv` → `test/recall.test.ts`). Puzzle CSV
semantics: `Moves[0]` is the opponent's setup move; the tactic to detect is
`Moves[1]` from the position after `Moves[0]`.

## Project map

```
stockthink/
├── CLAUDE.md                ← you are here
├── improve/                 ← DAILY WORKSHOP: README (protocol) + TODO + TRACKER
├── .claude/skills/improve-analysis/  ← thin pointer to improve/README.md
├── index.html               ← summary/coach/deep-review divs
├── src/
│   ├── main.ts              ← app shell + chip playback + badge overlay
│   ├── analyze.ts           ← PGN → engine pool → report (TIER_NODES 75k/200k/500k)
│   ├── engine/              ← UCI wrapper + worker pool (white-POV at parse time)
│   ├── analysis/            ← pgn, winprob (lichess formulas), report, classify, openings
│   ├── concepts/            ← deterministic facts (board/primitives/detectors/
│   │                          positional/facts/annotate) — THE HEART
│   ├── compose/             ← templates + compose (Mode A prose)
│   ├── llm/                 ← Mode B: factsheet/verify/exchange
│   └── ui/                  ← badges, coach, summary, movelist, graph, deepreview
├── test/                    ← vitest; helpers/transport.ts = real-engine harness;
│   │                          gate.e2e.test.ts = THE quality gate
│   └── fixtures/puzzles/    ← lichess-derived per-theme recall fixtures
├── scripts/                 ← build-openings.mjs, puzzles/fetch-fixtures.mjs
├── public/engine/           ← Stockfish 18 Lite WASM (7.3 MB, committed)
├── public/badges/           ← chess.com classification badges
└── docs/                    ← REFERENCE SHELF (not read daily)
    ├── knowledge/           ← taxonomy, template library, sources (see table above)
    ├── specs/               ← ANALYSIS-SYSTEM-V2.md, WHY-EXPLANATION-ENGINE-SPEC.md
    ├── research/            ← digested papers + openchess-insights reference (.py)
    └── prototype/           ← stockthink-trial.html (design reference)
```

## Key constraints
- $0 budget, no API keys, fully client-side on GitHub Pages (Mode B = paste
  exchange with a Claude chat, still free).
- Commentary must never hallucinate and never degrade into eval-bar narration.
- User is token-anxious: improvement happens in BOUNDED sessions (the skill's
  limits are contractual); outside the loop work inline, commit often, report
  concretely. Background agent fan-outs only when the user asks for them.
- Deploy: `git add -A && git commit && git push` — Pages auto-deploys main.
- 142+ tests, gate ~20s. Never commit with a red gate.
