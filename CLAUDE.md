# StockThink — Session Context for Claude

## What this project is
Zero-budget client-side chess Game Review app (chess.com clone) deployed at https://malikahed.github.io/stockthink/. No API keys, no server, no payment methods ever. Runs fully in the browser via Stockfish 18 WASM + chessops + chessground. Stack: Vite 5 + TypeScript, vitest, `~/bin/gh` (NOT on PATH) for deploys.

## Project map — where everything lives

```
stockthink/
├── CLAUDE.md            ← you are here: project context + architecture rules
├── README.md            ← public-facing: how it works, attributions, license
├── index.html           ← single page; all UI containers
├── src/
│   ├── main.ts          ← app entry: wires UI, runs the analysis pipeline
│   ├── analyze.ts       ← orchestrates per-game analysis (engine → classify → commentary)
│   ├── style.css        ← all styling (design tokens from the trial prototype)
│   ├── engine/          ← Stockfish UCI wrapper (engine.ts) + worker pool (pool.ts)
│   ├── analysis/        ← pgn parse, win-prob/accuracy (winprob.ts), classify.ts,
│   │                      openings, board.ts (swap-SEE — NOT for explanation math),
│   │                      commentary.ts (commentFor = the only commentary path), report.ts
│   ├── explain/         ← the WHY engine: detectors.ts (pin-aware SEE, forks, pins…),
│   │                      explain.ts (refutation walk + purpose), positional.ts, templates.ts
│   ├── llm/             ← Tier 2 (webllm.ts) + Tier 3 paste exchange (exchange.ts),
│   │                      factsheet.ts, verify.ts (hallucination gate)
│   └── ui/              ← one file per widget: movelist, graph, coach, summary, badges, aipanel
├── test/                ← vitest; mirrors src names; helpers/transport.ts = real-engine harness
├── public/
│   ├── engine/          ← Stockfish 18 Lite WASM (committed, 7.3 MB)
│   └── badges/          ← chess.com classification badge PNGs
├── docs/                ← specs, research, prototype — see docs/README.md for the index
└── scripts/             ← build-openings.mjs (regenerates src/analysis/openings.json)
```

**Before touching commentary/explain code:** read `docs/specs/WHY-EXPLANATION-ENGINE-SPEC.md`.
**Before touching classification/accuracy:** read `docs/research/RESEARCH-DIGEST.txt`.
**Before UI/design work:** the look is pinned to `docs/prototype/stockthink-trial.html`.

## Current state (as of 2026-06-10, late session)
- **119 tests passing**, TypeScript clean, build working
- Everything committed & pushed through `9dd97aa` — live site has the research-based system + 3-tier AI commentary + expanded positional detectors

## Commentary system status

The **WHY explanation engine** is fully built and deployed:
- `src/explain/detectors.ts` — SEE, pins, forks, skewers, discovered attacks, traps, hanging pieces
- `src/explain/explain.ts` — `explainGoodMove()` + refutation walk `explainBadMove()`
- `src/explain/positional.ts` — positional fragments. `positionalPurpose()` now covers 11 cases: passed pawn, equal-trade-while-ahead, pin release, rook to open file, rook on 7th, knight outpost, rook/queen file battery, development, pawn shield, center control, minor-piece mobility gain ≥3 (tests in `test/positional.test.ts`)
- `src/explain/templates.ts` — slot-filled sentence renderers
- "Explain more" mentions sharp positions when `volatile = true`

Bad moves get refutation-walk explanations; good moves get a verified purpose when any detector fires, otherwise the deliberate quiet fallback ("keeping the position …" — no invented words).

## Possible next steps
- Expand `positionalRegression()` for bad moves the same way (currently: pawn shield, opened king file, doubled/isolated pawns, rim knight, development lag, center loss)
- v1.1: play-vs-engine mode; polish WebLLM Tier-2 path
- Deploy: `git add -A && git commit && git push` — Pages auto-deploys from main

## Architecture reminders
- `src/explain/detectors.ts` — the toolbox (SEE, pins, forks). **Use its SEE for explanation math, NOT the SEE in `analysis/board.ts`** (that one is not pin-aware)
- `src/analysis/classify.ts` — calls `explainMove()`, sets `judgment.explain`, suppresses positional facts when `volatile=true`
- `src/analysis/commentary.ts` — `commentFor()` is the only commentary path (legacy `tacticClause()` was deleted). Uses `move.explain.primary` for the sentence
- `src/llm/` — Tier 2 (WebLLM on-device) + Tier 3 (Claude/ChatGPT copy-paste exchange). The AI panel UI is in `src/ui/aipanel.ts`, rendered into `#ai-tools` div. WebLLM import is lazy — `webGpuAvailable` is duplicated in `aipanel.ts` on purpose (keeps 6MB bundle out of main chunk)
- Research rationale: `docs/research/LLM-COMMENTARY-RESEARCH.md`

## Key constraint
$0 budget, no API keys. Commentary must never hallucinate — every sentence must be slot-filled from engine-verified facts. When no fact fires → fewer words, not invented words.
