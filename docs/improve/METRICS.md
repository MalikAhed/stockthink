# Metrics — detector recall & coverage over time

Machine-written by `test/recall.test.ts` into `metrics.json`; this file is the
human-readable summary, updated at the end of each `/improve-analysis` session.

## How to read
- **Recall** = % of lichess puzzles tagged with a theme where our mapped
  detector fires on the solution move. Positives-only data → measures recall,
  not precision. Precision is guarded by the gate (`test/gate.e2e.test.ts`:
  no false/eval-speak comments on real games).
- **Coverage** = % of non-book moves carrying ≥1 fact at the gate (target 93–100%).

## Theme → detector map
| lichess theme | detector / fact |
|---|---|
| fork | creates_fork |
| pin | creates_pin |
| skewer | creates_skewer (D4 — pending) |
| discoveredAttack | discovered_check / discovered attack (D5 — pending) |
| hangingPiece | wins_free_piece |
| trappedPiece | traps_piece |
| mateIn1 | delivers_mate / mate_threat |
| mateIn2 | delivers_mate chain |
| backRankMate | delivers_mate (+D13 naming — pending) |
| sacrifice | sacrifice |

## History

| Date | Coverage (gate) | fork | pin | skewer | discAtk | hanging | trapped | mateIn1 | sacrifice | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 2026-06-11 | 93–100% | — | — | — | — | — | — | — | — | baseline; fixtures not yet built (I1/I2) |
