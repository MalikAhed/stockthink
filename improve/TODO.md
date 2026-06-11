# TODO — improvement queue

Take items top-down within the current phase. One commit per item. Move
finished items to Done (bottom) with the date. `[hard]` = strongest-model item;
others skip it for free. Reading links: WebFetch the chessprogramming.org page
before implementing — extract the DEFINITION and edge cases, not engine eval code.

## P0 — Infrastructure (blocks everything below)

- [ ] **I1 · Puzzle fixtures** — run + debug `scripts/puzzles/fetch-fixtures.mjs`
  → commit `test/fixtures/puzzles/<theme>.csv` (themes: fork, pin, skewer,
  discoveredAttack, hangingPiece, trappedPiece, mateIn1, mateIn2, backRankMate,
  sacrifice; ≥100 rows each). Remember: `Moves[0]` is the opponent's setup move;
  the tactic is `Moves[1]`.
- [ ] **I2 · Recall harness** — `test/recall.test.ts`: for each fixture, apply
  setup move, play solution move, assert mapped detector fires (map in
  TRACKER.md). Report-only at first; append results to `improve/metrics.json`
  and update TRACKER snapshot.

## P1 — High-frequency explanation gaps (chess.com says these constantly)

- [ ] **D1 · Recapture** — detector + 3 rotating templates ("A straightforward
  recapture." / "A clear recapture." / "Takes back.")
- [ ] **D2 · Escapes attack** — attacked piece moves to SEE-safe square →
  "This steps the {piece} out of danger."
- [ ] **D3 · Purpose-phrased better-move** — phrase the suggested best move by
  its purpose ("The best option was to recapture the {piece} / put a pawn in
  the center / develop the {piece}"), SAN fallback.
- [ ] **D4 · Skewer** — wire existing `isSkewer` primitive into annotate.ts
  (+ `creates_skewer`, `missed_skewer`, templates). AC: ≥70% recall on skewer
  fixtures. — https://www.chessprogramming.org/Skewer
- [ ] **D5 · [hard] Discovered attack winning material** — extend discovered-check
  detection to material-winning discovered attacks. AC: ≥60% recall on
  discoveredAttack fixtures. — https://www.chessprogramming.org/Discovered_Attack
- [ ] **D6 · Pressure stacking** — new attacker joins attacked target /
  reinforces existing threat. — https://www.chessprogramming.org/Threats_(Stockfish)

## P2 — Opening principles & safety

- [ ] **D7 · Early queen** — queen out before minors, ≤inaccuracy: "Usually
  other pieces are developed before the queen for safety."
- [ ] **D8 · Same piece twice in opening** — non-forced, fullmove ≤10, ≤inaccuracy.
- [ ] **D9 · Luft** — king escape-square pawn move when back-rank vulnerable.
- [ ] **D10 · Opens line for own piece** — pawn move freeing own bishop/rook.
- [ ] **D11 · Trade offer** — non-capture move offering an equal trade.
- [ ] **D12 · Plain check** — check with no other payoff at least gets "…with check."
- [ ] **D15 · [hard] King safety synthesis** — composite "the king is exposed /
  under pressure" from shield + open-file + attacker facts.
  — https://www.chessprogramming.org/King_Safety

## P3 — New positional concepts (from reading list; not yet detected at all)

- [ ] **D16 · Backward pawn** — regression fact + template.
  — https://www.chessprogramming.org/Backward_Pawn
- [ ] **D17 · Bishop pair** — gained/lost the pair on a trade.
  — https://www.chessprogramming.org/Bishop_Pair
- [ ] **D18 · Space advantage** — extend center_gain to general space.
  — https://www.chessprogramming.org/Space
- [ ] **D19 · Pawn-structure phrasing** — pawn chain formed; structure damaged.
  — https://www.chessprogramming.org/Pawn_Structure
- [ ] **D20 · [hard] Overloaded piece** — defender with too many duties.
  — https://www.chessprogramming.org/Overloading
- [ ] **D21 · [hard] Deflection** — forcing a defender away from its duty.
  — https://www.chessprogramming.org/Deflection
- [ ] **D22 · Piece-square "good square" phrasing** — PST-style judgment for
  "finds a new, active square" / rim-knight generalization.
  — https://www.chessprogramming.org/Piece-Square_Tables

## P4 — Composer polish

- [ ] **C1 · Widen praise pools** — ≥6 rotating variants per tier (see template
  library §9); deterministic rotation, no near-repeats in one game.
- [ ] **C2 · Back-rank naming** — say "back-rank" in mate/mate-threat templates
  (primitive exists). Also: double check template.
- [ ] **C3 · Opening idea lines** — one-sentence idea for top ~50 book openings.
- [ ] **C4 · Deep-line material win phrasing** — "Taking that pawn will win
  material at the end of the line."

## P5 — Later / research
- [ ] X-ray, attraction, clearance detectors (lichess themes exist as fixtures).
- [ ] Volatility flag to suppress positional facts in sharp positions (spec'd).
- [ ] Endgame: pawn races, king activity, fortress.
- [ ] Calibration: lichess [%eval] games to tune the classification ladder.

## Blocked / questions for the user
_(items land here with the open question attached)_

## Done
- [x] Reading-list audit — outposts, passed/isolated/doubled pawns, open file,
  mobility, pins, forks, hanging pieces, material, classification were already
  implemented in V2; merged the rest above — 2026-06-11
