# TODO — engineering queue

> Workflow v3: pattern work (book/CPW mining → engine-confirm-gated detectors)
> lives in `SOURCES.md`. This file keeps pure engineering items. Sessions mix
> BUILD/MINE/PATTERN units per `README.md`.

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

## SPOTLIGHT DEPTH — user directive 2026-06-12 (take these FIRST, top-down)

> The Spotlight (src/ui/walkthrough.ts, focus-mode walkthrough of the best
> line, 3 confident moves max) shipped 2026-06-12 with basic board-verified
> captions (capture/check/mate/castle/promo). The mission now: explain WHY
> Stockfish's move is right by READING the 3-move PV — real proof, never
> vibes. All claims must stay board/engine-verified (R4). These items MAY
> touch src/ui/walkthrough.ts (exception to the no-UI rule — captions only,
> never layout).



## TONIGHT — user directive 2026-06-12 (take these FIRST, top-down)

- [ ] **U2 · Deeper why-bad explanations** — _(partial: `ignores_threat` fact
  shipped 2026-06-12 — already-attacked piece + move ignores it.)_ Remaining: the why-a-move-is-bad side is much
  weaker than why-good. Use the engine PV after the bad move to narrate the
  punishment/intention ("this drops the bishop to …", "ignores the threat of …",
  "weakens the king after …"). Symmetric depth with the good-move side.
- [ ] **U5 · Geometry & wrong-trigger audit** — sweep detectors for geometric
  bugs and facts firing on coincidental (non-causal) cases; add precision
  fixtures for each fix found.
- [ ] **U6 · Stockfish intention narration** — _(partial: `missed_idea` fact
  shipped 2026-06-12 — best move's own purposes: escape/defend/trade/tempo/
  positional; also covers C3.)_ Remaining: narrate the PV's PLAN (multi-move
  intention), and ideas for capture-best-moves with tactical follow-ups.

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
- [ ] **R16 · Discovered attack** — https://www.chessprogramming.org/Discovered_Attack
- [ ] **R17 · Overloaded piece** — https://www.chessprogramming.org/Overloading
- [ ] **R18 · Deflection** — https://www.chessprogramming.org/Deflection
- [ ] **R19 · Skewer** — https://www.chessprogramming.org/Skewer — `isSkewer`
  primitive proves 100% line-recall; remaining work is D4 wiring: fact kind +
  template + annotate hookup.

## Precision (stop over-triggering — facts must be the REASON, not coincidence)

- [ ] **C8 · Bare better-way cases (residual)** — remaining: quiet defensive
  moves (Qd7) and deep sacrifice ideas (Opera 10…Qb4+); consider broader
  defends + check-then-win narration.

## Phrasing & composer (after a concept's detector is solid, make it SPEAK well)

- [ ] **C2 · Escapes-attack** — "This steps the {piece} out of danger."
- [ ] **C4 · Pressure stacking** — "A new attacker joins the pressure on the {piece}."
- [ ] **C5 · Opening principles (residual)** — _(early_queen shipped 2026-06-12.)_
  Remaining: same piece twice + luft + opens-line + trade offer + plain check —
  same-piece-twice needs `ctx.lastMove` plumbed into AnnotateContext first.
- [ ] **C7 · Opening idea lines** — one-sentence idea for top ~50 book openings.

## Datasets (ground-truth expansion — wire each into a harness before relying on it)

- [ ] **DS1 · More lichess puzzle themes** — extend fetch-fixtures themes list:
  deflection, attraction, xRayAttack, doubleCheck, exposedKing, quietMove,
  capturingDefender (supports D20/D21 + Later items). Same script, zero cost.
- [ ] **DS2 · STS (Strategic Test Suite)** — 15 positional themes × 100 EPD
  (open files, outposts, pawn play, space, activity, king safety…); ideal
  precision check for `positional.ts` detectors: best move should trigger the
  theme's fact. https://github.com/fsmosca/STS-Rating (STS1-STS15_LAN_v6.epd)
- [ ] **DS3 · Tactics EPD suites (WAC/ECM)** — classic best-move suites for
  "missed tactic" precision. https://github.com/ChrisWhittington/Chess-EPDs
- [ ] **DS4 · Lichess [%eval] games** — sample evaluated games from
  https://database.lichess.org/ to calibrate the classification ladder
  (win%-drop thresholds vs real game distributions; absorbs the Later item).

## Later / research
- [ ] X-ray, attraction, clearance, back-rank naming, double check.
- [ ] Volatility flag to suppress positional facts in sharp positions (spec'd).
- [ ] Endgame: pawn races, king activity, fortress.

## Blocked / questions for the user
_(items land here with the open question attached)_

## Done
- [x] W3 · Spotlight voice pass — 2026-06-12 (gate print-through review: pawn-pins muted, honesty note shows once, fine-move intros read as curiosity not correction)
- [x] W2 · Step-level WHY captions — 2026-06-12 (whyClause: mate-threat > fork > pin > trap > tempo via existing board-only detectors, one clause per step; precision fixtures)
- [x] W1 · Best-line outcome proof — 2026-06-12 (lineOutcome(): PV walk → forced mate / material win banked at quiet points; Spotlight intros now carry the verified WHY; residual: surface as a prose fact later)
- [x] C6 · Praise pools — 2026-06-12 (6 variants × best/excellent/good, rotated by ply, deterministic)
- [x] P3 · Lost-position mate framing — 2026-06-12 ("The game could not be saved either way — …")
- [x] C1 · Recapture/capture suggestion phrasing — 2026-06-12 (subsumed by C8 'captures' idea)
- [x] U3 · API-key LLM commentary — 2026-06-12 (src/llm/providers.ts generateViaApi: direct browser call to api.anthropic.com with user's own key in localStorage; haiku; R4 verify + silent fallback)
- [x] U4 · WebLLM local commentary — 2026-06-12 (generateViaWebLLM: Llama-3.2-1B q4f16_1 via esm.run CDN dynamic import, WebGPU-gated, engine cached; same verify pipeline)
- [x] C3 · Purpose-phrased better-move — 2026-06-12 (subsumed by U6 missed_idea)
- [x] U1 · explain-more positive-bias bug — 2026-06-12 (compose.ts classification-aware: bad moves' purpose facts render only inside "The idea — … — doesn't make up for what this concedes" frame; regression tests)
- [x] P1 · PV intent-confirmation everywhere — 2026-06-11 (forkConfirmed/tempoConfirmed vs engine best defense; newly-trapped only; pinned attackers threaten nothing off-ray)
- [x] P2 · Two-move pairing ('prepares' fact) — 2026-06-11 (quiet move + engine follow-up told as one plan; Opera 7…Qe7 → 'prepares Qb4+, forking…'; coverage 93%→96%)
- [x] R15 · Pin — 2026-06-11 (relative pins in pinsHeld/pinsCreatedEx; exploit-a-pin recall mapping; line-wide harness fix lifted pin 21%→79.5%, skewer 0%→100%, fork→100%)
- [x] I1 · Puzzle fixtures — 2026-06-11 (HF /filter FTS index never builds → use /rows scan; Themes arrives as an array)
- [x] I2 · Recall harness — 2026-06-11 (test/recall.test.ts; metrics → improve/metrics.json; floors ratchet up)
