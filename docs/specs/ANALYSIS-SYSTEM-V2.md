# StockThink Analysis System V2 — Design

*2026-06-11. Research-first redesign after the V1 commentary was rejected for
eval-narration ("this cost 13% in winning chances" + raw PV dumps).*

## What went wrong in V1 (the disease to design against)

V1 had the right philosophy (detectors → facts → templates) but two fatal flaws:

1. **Thin concept coverage + eager fallback.** When no tactical detector fired,
   a fallback template emitted eval-speak and a raw PV dump. That fallback fired
   constantly because coverage was thin.
2. **Numbers and engine lines in prose.** "Cost 13.0%", "For example: Nd4 Qe3
   Ne6 Qxh6 gxh6…" — these are eval-bar narration, not explanations.

## V2 hard rules (non-negotiable)

- **R1 — No numbers in prose.** Win%, centipawns, accuracy never appear in a
  sentence. Eval magnitude maps to words ("slightly better", "winning").
- **R2 — No PV dumps in prose.** Engine lines are shown as *clickable variation
  chips* the user can play through on the board; prose may reference at most
  the first 1–2 moves of a line, each with a stated purpose ("after **Bxf7+**
  forking king and queen…").
- **R3 — No empty-handed fallback.** If no concept fires, say one short factual
  sentence (or nothing) — never pad with eval-speak. Coverage must make this
  rare (target: a concept fires on >90% of non-book moves).
- **R4 — Every claim is machine-verified.** Prose is generated only from typed
  facts produced by board logic + engine lines. Any AI-reworded sentence is
  checked against the fact sheet (squares/pieces/moves whitelist) and rejected
  to the deterministic wording on mismatch.
- **R5 — Cause before verdict.** Explanations read as *reason → consequence*:
  "This leaves the knight on c3 undefended — after **Qxc3** White is just a
  piece down." Not "This is a mistake. The opponent can play Qxc3."

## Evidence base (docs/research/)

| Claim | Source |
|---|---|
| LLMs cannot analyze positions (chance-level eval, 0.46 hallucination rate free-commenting) | ChessQA 2510.23948, Geometric Stability 2512.15033, CCC 2410.20811 |
| Concepts-in-prompt fixes it: correctness 0.36→0.60 (human=0.62), hallucination 0.46→0.20 | CCC 2410.20811 |
| +30–45pts judgment with expert facts in prompt | MATE 2411.06655 |
| Concept detectors are pure board logic — production code exists | lichess-puzzler cook.py (MIT), OpenChess-Insights chess_review.py (MIT) |
| Fixed nodes + MultiPV≥3, win% space, ≥3 win% noise floor, volatility gate | MoM 2602.04447, Consistency 2306.09983, NNUE 2412.17948 |

## Pipeline (the shape the user asked for)

```
PGN
 └─ 1. ENGINE PASS (client, Stockfish 18 WASM)
      fixed nodes per tier, MultiPV 3, shallow+deep eval (volatility flag)
      → per-position: top-3 lines, evals
 └─ 2. CONCEPT ANNOTATOR (deterministic board logic — the "python step", in TS)
      runs on: position before, position after, played-move PV, best-move PV
      → typed facts per move, e.g.
        { kind: "hangs_piece",  piece: "N", square: "c3", capturer: "Qxc3" }
        { kind: "missed_fork",  move: "Nd4", forked: ["K","Q"] }
        { kind: "develops",     piece: "B" }
        { kind: "allows_mate",  in: 3, firstMove: "Qh4+" }
        { kind: "wins_tempo" } { kind: "pins", piece:"N", to:"K" } …
 └─ 3. CLASSIFICATION (win%-drop ladder + Book/Forced/Brilliant/Great/Miss)
      pure math over engine pass + facts; unchanged formulas from research
 └─ 4. EXPLANATION COMPOSER
      facts (typed, prioritized) → 1–3 sentence explanation per move
      Mode A (client, default): template composer over the fact types,
        cause→consequence ordering, R1–R3 enforced structurally
      Mode B ("deep review" — Claude session / paste exchange):
        export factsheet JSON → Claude words rich coaching prose with full
        game context → import → R4 verifier gates every sentence
 └─ 5. UI: badges, accuracy, eval bar/graph (numbers live HERE, not in prose),
      variation chips for engine lines, "explain more" expands the same facts
```

### Stage 2 is the heart — concept inventory (build coverage FIRST)

Port from MIT-licensed production code, in this order:

**Tactical (from lichess cook.py + chess_review.py, both MIT):**
hanging piece (x-ray-aware `is_defended`), hangs/leaves-hanging, capturable by
lower piece, fork created/allowed/missed, pin created/missed (vs king & vs
queen/rook), skewer, discovered check (+with attack), trapped piece
created/allowed/missed, sacrifice (material-diff walk), free capture
taken/missed, mate threat created/missed, allows mate-in-N, loses/continues
mate sequence, blocks check, capture of higher piece, trade/offers trade,
wins tempo, attacks piece.

**Positional (chess_review.py + V1 survivors worth re-porting):**
develops piece, fianchetto, castles/king safety move, king off back rank in
endgame, rook to open file, rook on 7th, knight outpost, passed pawn
created/pushed, pawn-shield damage, center control gain/loss, doubled/isolated
pawns, mobility swing, simplify-when-ahead.

**Move-quality context (engine-derived):**
only-move (top-2 gap ≥10 win%), volatile position (shallow/deep divergence
>65cp → suppress positional facts), forced, book (ECO match).

Primitives both inventories need: piece values, `materialDiff`, x-ray
`isDefended`/`isHanging`, `isInBadSpot`, `isTrapped`, attackers/rays/between,
one pin-aware SEE. (V1's `src/explain/detectors.ts` at git `cee389b` already
had tested chessops ports of most primitives — recover selectively, with its
21 acceptance tests.)

### Stage 4 composer — how prose gets built (Mode A)

1. Facts are **prioritized** (mate > material > tactic > positional > generic).
2. Take the top 1–2 facts only; "explain more" reveals the rest.
3. Each fact type has sentence renderers with slots filled from the fact —
   never from the eval. Bad moves: *cause → consequence → what was better and
   WHY* (the best move's own facts, e.g. "**Nd4** was the move — it forks king
   and queen"). Good moves: *purpose* (the move's facts).
4. If zero facts: one neutral sentence max ("A solid move; the position stays
   balanced.") — R3.

### Mode B — "run it here" (the path the user remembers working)

In a Claude Code session: a script exports the per-move factsheet JSON
(stage 1–3 output); Claude reads the whole game + facts and writes the
commentary JSON (same schema the trial prototype used); the app imports it.
In the browser the same exchange works as copy-prompt → paste into
Claude/ChatGPT → import JSON. Either way the R4 verifier checks every
sentence's squares/pieces/moves against the facts before accepting it.

**Mode B prompt contract** (ablation-validated by C1 2603.20510 + CCC
2410.20811 + ChessQA — see `docs/research/LAST-RESEARCH-NOTES.md`):
- Per position include: FEN **plus explicit piece list plus legal-move list**
  (FEN alone fails from tokenization), the opponent's last move, and the
  detector facts as theme hints.
- **One PV per claim**, not MultiPV — extra lines are noise to the wordsmith.
- Facts prioritized by before/after impact; the verdict + classification are
  stated as ground truth the LLM must not contradict (LLMs reach "sound
  analysis, wrong conclusion" — the verdict is never theirs to make).
- **Feigned discovery**: instruct the model to explain the move as if
  discovering it through analysis; never reveal an engine supplied it, never
  mention scores/centipawns (single biggest quality lever in C1's ablation).
- Output style: 4–10 sentences scaled to move complexity, moves annotated in
  words ("Qxh7+ — queen takes h7 with check"), every claim grounded in
  explicit coordinates, objective voice.
- R4 verification on import: every square/piece/move mentioned must appear in
  the factsheet whitelist; mismatch → fall back to Mode A template.

## Milestones

1. **M1 — primitives + tactical detectors** with the cook.py/chess_review.py
   test cases ported (acceptance: each detector has positive+negative FEN tests).
2. **M2 — annotator over PVs** (facts for played move, refutation, missed best).
3. **M3 — classification** rewired on top (formulas unchanged from research).
4. **M4 — composer Mode A** + UI restored (badges, coach card, variation chips).
5. **M5 — Mode B** factsheet export/import + verifier.
6. **Gate at each milestone:** run the Opera Game + one modern flawed game;
   read every comment; zero eval-speak sentences allowed through.
