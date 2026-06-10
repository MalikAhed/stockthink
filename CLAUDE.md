# StockThink — Session Context for Claude

## What this project is
Zero-budget client-side chess Game Review app (chess.com clone) deployed at https://malikahed.github.io/stockthink/. No API keys, no server, no payment methods ever. Runs fully in the browser via Stockfish 18 WASM + chessops + chessground. Stack: Vite 5 + TypeScript, vitest, `~/bin/gh` (NOT on PATH) for deploys.

## Current state (as of 2026-06-10)
- **109 tests passing**, TypeScript clean, build working
- All changes from the last two sessions are **unstaged/uncommitted** — need `git add -A && git commit` before pushing
- Live site (GitHub Pages) is behind — hasn't been updated yet

## The unsolved problem (why user stopped this session)

### What's implemented
The **WHY explanation engine** is fully built:
- `src/explain/detectors.ts` — SEE, pins, forks, skewers, discovered attacks, traps, hanging pieces
- `src/explain/explain.ts` — `explainGoodMove()` + refutation walk `explainBadMove()`
- `src/explain/positional.ts` — positional fragments (passed pawn, development, pawn shield, center)
- `src/explain/templates.ts` — slot-filled sentence renderers

All facts flow into `commentary.ts → commentFor()` correctly. For **bad moves** (blunders/mistakes/inaccuracies), the commentary IS specific and good:
> "This loses your pawn on f7 — it is attacked more times than it is defended (Qb3 Bc5 Bxf7+). Qd7 was best."

### What still looks generic (the real problem)
For **good moves** (best/excellent/good), `explainGoodMove()` runs through a priority ladder (mate → wins material → fork → pin → discovered → mate threat → saves piece → traps enemy → positional). If NONE fire, it returns `null` and commentary falls back to:
> "The strongest move, keeping the position roughly equal."

The `positionalPurpose()` detector (`src/explain/positional.ts`) only covers 4 cases:
1. Creates a passed pawn
2. Develops a minor piece (opening ≤ move 12)
3. Shores up king pawn shield (+2 pawns)
4. Increases center control (+2 squares)

**Most middlegame "good" moves have no detectable positional purpose → generic fallback.**

## What to do next session

### Priority 1: Expand positional detectors
Add more cases to `positionalPurpose()` in `src/explain/positional.ts`:
- **Piece activity / mobility**: if a minor piece gains ≥3 more legal squares after the move, "improves your knight/bishop's activity"
- **Open file for rook**: if the destination file has no pawns of either color, "places your rook on an open file"
- **Rook on 7th**: if rook moves to rank 7 (from mover's POV), "seizes the 7th rank"
- **Outpost knight**: knight on d5/e5/c5/f5 (centralized, no enemy pawns can attack it), "plants your knight on a strong outpost"
- **Battery**: two rooks or queen+rook on same file/rank, "doubles your rooks" or "creates a battery"
- **King safety / trades into endgame**: if mover ahead in material and move simplifies, "simplifies into a winning endgame"
- **Releases pin**: if a mover piece was pinned before and is now free, "breaks the pin"

Similarly expand `positionalRegression()` for bad moves (already has: exposes king, isolates pawn, creates backwards pawn, gives up bishop pair, lets enemy centralize).

### Priority 2: Show more in "Explain more"
The `long` section in `commentary.ts` already adds engine line + eval sentence. Could also add:
- When `volatile = true`: mention "This is a sharp position — small errors are punished quickly."
- When `winDrop > 10` but not blunder: "This cost X win% points."

### Priority 3: Commit + deploy
All the research-based changes (fixed nodes, volatility gate, MultiPV 3, 3-tier AI commentary, AI panel) are unstaged. Once positional detectors are improved:
```bash
cd ~/stockthink
git add -A
git commit -m "Research-based commentary: expand positional detectors, fixed nodes, volatility gate, 3-tier LLM panel"
~/bin/gh push
```

## Architecture reminders
- `src/explain/detectors.ts` — the toolbox (SEE, pins, forks). **Use its SEE for explanation math, NOT the SEE in `analysis/board.ts`** (that one is not pin-aware)
- `src/analysis/classify.ts` — calls `explainMove()`, sets `judgment.explain`, suppresses positional facts when `volatile=true`
- `src/analysis/commentary.ts` — `commentFor()` is the only commentary path (legacy `tacticClause()` was deleted). Uses `move.explain.primary` for the sentence
- `src/llm/` — Tier 2 (WebLLM on-device) + Tier 3 (Claude/ChatGPT copy-paste exchange). The AI panel UI is in `src/ui/aipanel.ts`, rendered into `#ai-tools` div. WebLLM import is lazy — `webGpuAvailable` is duplicated in `aipanel.ts` on purpose (keeps 6MB bundle out of main chunk)
- Research rationale: `docs/LLM-COMMENTARY-RESEARCH.md`

## Key constraint
$0 budget, no API keys. Commentary must never hallucinate — every sentence must be slot-filled from engine-verified facts. When no fact fires → fewer words, not invented words.
