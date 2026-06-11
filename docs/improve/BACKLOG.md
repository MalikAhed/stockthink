# Improvement Backlog

Prioritized queue for the daily `/improve-analysis` loop. Each item is small,
testable, and self-contained. The loop takes items top-down, P0 first.
**Rules**: one commit per item · gate must pass before moving on · flip the
matching row in `docs/knowledge/concept-taxonomy.md` in the same commit ·
move finished items to the Done section with the date.

Item format:
`ID · [type: infra|detector|composer|data|calibration] · title — acceptance criteria`

## P0 — Infrastructure (do these first; everything else depends on them)

- [ ] **I1 · infra · Puzzle fixture pipeline** — `scripts/puzzles/fetch-fixtures.mjs`
  downloads/filters lichess puzzles into `test/fixtures/puzzles/<theme>.csv`
  (≤200 rows/theme, deterministic: sorted by NbPlays desc, Popularity ≥ 90,
  RatingDeviation ≤ 80). Themes to start: fork, pin, skewer, discoveredAttack,
  hangingPiece, trappedPiece, mateIn1, mateIn2, backRankMate, sacrifice.
  AC: fixtures committed, each ≥100 rows.
- [ ] **I2 · infra · Recall harness** — `test/recall.test.ts` plays each puzzle's
  solution move and asserts the mapped detector fires; reports per-theme recall;
  writes `docs/improve/metrics.json` (`{date, theme, recall, n}` appended).
  Thresholds start soft (report-only); each theme gets a hard floor once ≥80%.
  AC: harness runs offline from fixtures, no engine needed (detectors are pure).

## P1 — High-frequency gaps (chess.com comments on these constantly)

- [ ] **D1 · detector+composer · Recapture** — capture on the square just
  captured on. Templates: "A straightforward recapture." / "A clear recapture." /
  "Takes back." AC: unit tests + fires in gate game recaptures.
- [ ] **D2 · detector · Escapes attack** — attacked piece moves to a safe square
  (SEE-safe destination). Template: "This steps the {piece} out of danger…"
  AC: unit tests incl. not-firing when destination still attacked.
- [ ] **D3 · composer · Purpose-phrased better-move** — when suggesting the best
  move, run `annotateMove` on it and phrase by top purpose: "The best option was
  to recapture the {piece}." / "…to put a pawn in the center." / "…to develop the
  {piece}." Fall back to `{san} was the better way.` AC: compose tests cover ≥4 purposes.
- [ ] **D4 · detector · Skewer (wire existing primitive)** — wire `isSkewer` into
  `annotate.ts` + `creates_skewer`/`missed_skewer` facts + templates.
  AC: recall ≥70% on skewer fixtures.
- [ ] **D5 · detector · Discovered attack winning material** — extend
  `givesDiscoveredCheck` to discovered attacks on queen/rook with SEE win.
  AC: recall ≥60% on discoveredAttack fixtures.
- [ ] **D6 · detector · Pressure stacking** — adds attacker to already-attacked
  target ("A new attacker joins the pressure on the {piece}.") + reinforce-threat
  variant. AC: unit tests; fires on 6...Ng4 position from the reference game.

## P2 — Opening principles & safety

- [ ] **D7 · detector · Early queen** — queen developed before minor pieces in
  opening, classified ≤ inaccuracy: "Usually other pieces are developed before
  the queen for safety."
- [ ] **D8 · detector · Same piece twice in opening** — non-forced repeat move of
  the same piece, fullmove ≤ 10, classification ≤ inaccuracy.
- [ ] **D9 · detector · Luft** — h3/h6/g3/g6 pawn move creating king escape square
  when back-rank-vulnerable: "This creates space for the king."
- [ ] **D10 · detector · Opens line for own piece** — pawn move opening a diagonal/
  file for own bishop/rook ("opens the diagonal for the bishop, increasing its activity").
- [ ] **D11 · detector · Trade offer** — non-capture move offering an equal trade.
- [ ] **D12 · detector · Plain check** — check with no mate/tempo payoff gets at
  least "…with check." merged into another fact or a standalone line.

## P3 — Composer polish & breadth

- [ ] **C1 · composer · Widen praise pools** — ≥6 rotating variants per praise
  tier (Best/Excellent/Good), seeded from template library §9; deterministic
  rotation (position hash), no repeats within a game when avoidable.
- [ ] **C2 · composer · Recapture/trade phrasing variety** — rotate §5 variants.
- [ ] **C3 · composer · Pawn-chain + doubled-rooks phrasing** — detectors for
  chain completion and rook-rook battery phrasing ("powerfully doubled").
- [ ] **C4 · data · Opening idea lines** — one-sentence "idea" for top ~50 openings
  keyed off the EPD book (e.g. Sicilian: "fights for the center without copying
  White's first move"), shown with the opening name on book moves.
- [ ] **D13 · detector · Back-rank pattern naming** — use existing primitive to say
  "back-rank" in mate/mate-threat templates when it applies.
- [ ] **D14 · detector · Double check** — "double check — the king must move."

## P4 — Later / research

- [ ] X-ray, deflection, attraction, clearance detectors (lichess themes exist).
- [ ] Deep-line material win phrasing ("wins material at the end of the line").
- [ ] Volatility flag to suppress positional facts in sharp positions (spec'd).
- [ ] Endgame concepts: pawn races, king activity, fortress.
- [ ] "Enables plan" model (doubling rooks is now possible).
- [ ] Calibration: sample lichess [%eval] games to tune classification ladder.

## Done

_(move items here: `- [x] ID · title — YYYY-MM-DD · commit <hash>`)_
