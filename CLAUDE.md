# StockThink — Session Context for Claude

## What this project is
Zero-budget client-side chess Game Review app (chess.com clone) deployed at https://malikahed.github.io/stockthink/. No API keys, no server, no payment methods ever. Runs fully in the browser via Stockfish 18 WASM + chessops + chessground. Stack: Vite 5 + TypeScript, vitest, `~/bin/gh` (NOT on PATH) for deploys.

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
- Research rationale: `docs/LLM-COMMENTARY-RESEARCH.md`

## Key constraint
$0 budget, no API keys. Commentary must never hallucinate — every sentence must be slot-filled from engine-verified facts. When no fact fires → fewer words, not invented words.
