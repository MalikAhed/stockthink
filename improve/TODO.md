# TODO — improvement queue

We treat the engine as having NO trusted concepts yet. Every concept below gets
the same treatment, top-down, one item per session unit:

1. **WebFetch the link** — extract the real definition, the edge cases, and the
   exceptions (not the engine eval code).
2. **Audit** whatever StockThink currently does for this concept against that
   definition — assume it is wrong or shallow until proven otherwise.
3. **Improve or implement** the detector (`src/concepts/`) + fact + priority +
   template(s) (`src/compose/templates.ts`) + wiring (`annotate.ts`).
4. **Prove it**: hand-built FEN unit tests for the edge cases found in step 1;
   puzzle-fixture recall where a lichess theme exists; gate must stay green.
5. Check the item off with one commit: `improve(<id>): <concept>`.

Take items top-down. Move finished items to Done (bottom) with date + commit.

## Concepts — from zero (chessprogramming.org reading list)

- [ ] **R1 · Hanging piece** — https://www.chessprogramming.org/Hanging_Piece
- [ ] **R2 · Piece mobility** — https://www.chessprogramming.org/Mobility
- [ ] **R3 · King safety** — https://www.chessprogramming.org/King_Safety
- [ ] **R4 · Outpost squares** — https://www.chessprogramming.org/Outposts
- [ ] **R5 · Passed pawn** — https://www.chessprogramming.org/Passed_Pawn
- [ ] **R6 · Isolated pawn** — https://www.chessprogramming.org/Isolated_Pawn
- [ ] **R7 · Doubled pawn** — https://www.chessprogramming.org/Doubled_Pawn
- [ ] **R8 · Backward pawn** — https://www.chessprogramming.org/Backward_Pawn
- [ ] **R9 · Rook on open file** — https://www.chessprogramming.org/Rook_on_Open_File
- [ ] **R10 · Bishop pair** — https://www.chessprogramming.org/Bishop_Pair
- [ ] **R11 · Space advantage** — https://www.chessprogramming.org/Space
- [ ] **R12 · Threats / forks** — https://www.chessprogramming.org/Threats_(Stockfish)
- [ ] **R13 · Pawn structure** — https://www.chessprogramming.org/Pawn_Structure
- [ ] **R14 · Piece square tables** — https://www.chessprogramming.org/Piece-Square_Tables
- [ ] **R15 · Pin detection** — https://www.chessprogramming.org/Pin
- [ ] **R16 · Discovered attack** — https://www.chessprogramming.org/Discovered_Attack
- [ ] **R17 · Overloaded piece** — https://www.chessprogramming.org/Overloading
- [ ] **R18 · Deflection** — https://www.chessprogramming.org/Deflection
- [ ] **R19 · Skewer** — https://www.chessprogramming.org/Skewer

## Phrasing & composer (after a concept's detector is solid, make it SPEAK well)

- [ ] **C1 · Recapture phrasing** — "A straightforward recapture." / "Takes back."
- [ ] **C2 · Escapes-attack** — "This steps the {piece} out of danger."
- [ ] **C3 · Purpose-phrased better-move** — "The best option was to recapture
  the {piece} / put a pawn in the center / develop the {piece}" (SAN fallback).
- [ ] **C4 · Pressure stacking** — "A new attacker joins the pressure on the {piece}."
- [ ] **C5 · Opening principles** — early queen · same piece twice · luft ·
  opens line for own piece · trade offer · plain check.
- [ ] **C6 · Widen praise pools** — ≥6 rotating variants per tier (see
  `../docs/knowledge/chesscom-templates.md` §9), deterministic rotation.
- [ ] **C7 · Opening idea lines** — one-sentence idea for top ~50 book openings.

## Later / research
- [ ] X-ray, attraction, clearance, back-rank naming, double check.
- [ ] Volatility flag to suppress positional facts in sharp positions (spec'd).
- [ ] Endgame: pawn races, king activity, fortress.
- [ ] Calibration: lichess [%eval] games to tune the classification ladder.

## Blocked / questions for the user
_(items land here with the open question attached)_

## Done
- [x] I1 · Puzzle fixtures — 2026-06-11 (HF /filter FTS index never builds → use /rows scan; Themes arrives as an array)
- [x] I2 · Recall harness — 2026-06-11 (test/recall.test.ts; metrics → improve/metrics.json; floors ratchet up)
