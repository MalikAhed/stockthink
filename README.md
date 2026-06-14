# StockThink ♟️

**Free chess game review — entirely in your browser.** Paste a PGN, get a
chess.com-style analysis: eval bar, move classifications (Brilliant‼ → Blunder⁇),
accuracy scores, and commentary that explains **why** each move is good or bad.

No server. No account. No API keys. No cost. Powered by **Stockfish 18 (NNUE)**
running as WebAssembly on your machine.

**Live: https://malikahed.github.io/stockthink/**

## How it works (V2 analysis system)

```
PGN → 1. Stockfish 18 Lite WASM (fixed nodes per tier, MultiPV 3)
    → 2. Concept annotator — deterministic board logic produces TYPED FACTS
         (hangs piece, allows mate, fork created/allowed/missed, pins, traps,
          sacrifices, development, king safety, pawn structure, …)
    → 3. Classification — win%-drop ladder + Book/Forced/Brilliant/Great/Miss
    → 4. Explanation composer — sentences rendered ONLY from the typed facts
    → 5. UI — badges, eval bar/graph, clickable variation chips, "explain more"
```

Hard rules the commentary can never break (`self-improvement/docs/specs/ANALYSIS-SYSTEM-V2.md`):

- **R1 — no eval numbers in prose.** Win% and centipawns live in the bar, the
  graph and the chips — never in a sentence.
- **R2 — no engine-line dumps in prose.** Lines are clickable chips you can
  play through on the board; prose names at most a move or two, each with its
  stated purpose.
- **R3 — no empty-handed fallback.** When nothing concrete is known, the
  comment says less, never pads with eval-speak.
- **R4 — every claim machine-verified.** Sentences are slot-filled from facts
  produced by board logic + engine lines; nothing is invented.
- **R5 — cause before verdict.** Bad moves read as
  *cause → consequence → what was better and why*.

## Deep review (Mode B)

The "Deep review" panel exports a per-move factsheet prompt (position, piece
list, legal moves, verified facts, verdicts). Paste it into Claude, paste the
JSON reply back, and every sentence is checked against a whitelist of real
squares/pieces/moves — hallucinated analysis is rejected per-move and falls
back to the built-in explanation. The prompt design follows the CCC paper
(arXiv:2410.20811) and C1/Master Distillation (arXiv:2603.20510); notes in
`self-improvement/docs/research/LAST-RESEARCH-NOTES.md`.

## Develop

```
npm install
npm run dev                              # vite dev server
npm test                                 # 142 tests incl. real-engine integration
npx vitest run self-improvement/test/gate.e2e.test.ts     # quality gate: full games, zero eval-speak
npm run build                            # production build (Pages deploys on push)
```

Stack: Vite 5 + TypeScript, chessops, chessground, Stockfish 18 Lite WASM
(single-thread, 7.3 MB, committed in `frontend/public/engine/`). Project map in
`CLAUDE.md`; docs index in `self-improvement/docs/README.md`.

License: GPL-3.0 (Stockfish is GPL). Opening book CC0 (lichess). Badge images
and Neo pieces © Chess.com, used for a free fan project.
