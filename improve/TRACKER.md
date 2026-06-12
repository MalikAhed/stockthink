# TRACKER — coverage snapshot + daily log

## Coverage snapshot (edit rows in place when status changes)

✅ code exists — but **UNAUDITED**: treat as unproven until its R-item in
TODO.md is done (read source → audit → fix → tests), then mark it 🔒 audited.
🟡 partial · ❌ missing · 🔒 audited & proven.
Full detail: `../docs/knowledge/concept-taxonomy.md`.

| Concept | Status | Concept | Status |
|---|---|---|---|
| Hanging piece (wins/hangs) | ✅ | Recapture | ❌ D1 |
| Fork (+missed/allowed) | ✅ | Escapes attack | ❌ D2 |
| Pin (+missed) | ✅ | Purpose-phrased suggestion | ❌ D3 |
| Trapped piece | ✅ | Skewer | 🟡 D4 |
| Mate / mate threat / allows mate | ✅ | Discovered attack (material) | ❌ D5 |
| Discovered check | ✅ | Pressure stacking | ❌ D6 |
| Sacrifice / trade / captures-higher | ✅ | Early queen | ❌ D7 |
| Wins tempo | ✅ | Same piece twice | ❌ D8 |
| Defends piece | ✅ | Luft | ❌ D9 |
| Castling / fianchetto | ✅ | Opens line for piece | ❌ D10 |
| Develops / lags development | ✅ | Trade offer | ❌ D11 |
| Outpost / open file / 7th rank | ✅ | Plain check | ❌ D12 |
| Passed pawn | ✅ | King-safety synthesis | 🟡 D15 |
| Isolated / doubled pawns | ✅ | Backward pawn | ❌ D16 |
| Mobility / center | ✅ | Bishop pair | ❌ D17 |
| Shield weaken / king file | ✅ | Space advantage | 🟡 D18 |
| Rim knight | ✅ | Pawn-structure phrasing | ❌ D19 |
| Battery / doubling | 🟡 C-phrasing | Overload / deflection | ❌ D20/D21 |
| Only move / forced | ✅ | Good-square phrasing | 🟡 D22 |

## Recall (from puzzle fixtures — pending I1/I2)

Theme→detector map: fork→creates_fork · pin→creates_pin · skewer→creates_skewer ·
discoveredAttack→discovered attack · hangingPiece→wins_free_piece ·
trappedPiece→traps_piece · mateIn1→delivers_mate/mate_threat · sacrifice→sacrifice.

| Date | gate coverage | fork | pin | skewer | discAtk | hanging | trapped | mateIn1 | sac |
|---|---|---|---|---|---|---|---|---|---|
| 2026-06-11 | 93–100% | 62% | 21% | 0% | 63% | 100% | 72% | 100% | 75% |
| 2026-06-11b | 93–100% | 100% | 80% | 100% | 95% | 100% | 100% | 100% | 86% |

## Daily log (append ONE entry per session, 1–3 lines, newest on top)

- **2026-06-12m** · 8 units · Long run (user away): W3 voice pass (print-through
  audit) · PATTERN GM-4 falsify-coaching · GM-5 Lasker miss frame · GM-3
  only_move voice audit · MINE B3→GM-6/7 + B4→GM-8/9 · PATTERN GM-6
  removes-checks · GM-7 abandons_square · GM-8 retreat softener · GM-9
  counterattack lead. All GM-1..9 proven. Tests 208→220. Next: GM-2 residual
  (praise side), MINE B5 (§4.6 pp. 401–416, mind 15pp cap), B6.
- **2026-06-12l** · 3 units · Spotlight (user directive): focus-mode walkthrough
  replaces autoplay chips (user-paced, friendly CTAs, theme shift) + W1
  lineOutcome WHY-proof intros + W2 step captions (fork/pin/trap/tempo/mate-
  threat, board-proven). Tests 200→208. Next: W3 voice pass, PATTERN GM-4.
- **2026-06-12k** · 2 units · chess.com alignment (user request): game accuracy
  → CAPS2-style classification-score average (book/forced=1, blunder=0; was
  lichess harmonic — read too low) + decided-position leniency in classify
  (afterPov≥80 or beforePov≤20 softens one step, never into forced mate).
  Tests 194→196. Next: user re-compares vs chess.com; then PATTERN GM-4.
- **2026-06-12j** · 3 units · v3 session 2: MINE B2 (§4.2 Falsifying → GM-4
  falsify-coaching, GM-5 Lasker-frame-for-miss audit) + PATTERN GM-2 proven
  (hard_to_find: quiet missed tactic softens the verdict; gate: Blackburne
  7.Be2 "Qe2 is a quiet move — the hardest kind to spot"). Tests 190→193.
  Next: PATTERN GM-4 or GM-3/GM-5 audits; backlog 4/6.
- **2026-06-12i** · 1 unit (user-reported) · BOOK DEPTH FIX: chess.com marks
  ~6 more book moves than us — the EPD map only knows *named* positions. New
  src/analysis/explorer.ts: lichess masters explorer (keyless, CORS) walks the
  game prefix, ≥10 master games = book, cap 30 plies, runs alongside engine,
  silent EPD fallback offline. NOTE: endpoint unreachable from dev sandbox
  (proxy) — verify in browser. Tests 186→190.
- **2026-06-12h** · 3 units · FIRST V3 SESSION: MINE B1 (§4.1 Candidate Move →
  GM-1/2/3 mined, GM-3 is an only_move audit) + PATTERN GM-1 second_candidate
  proven (fact + candidate framing: replaces neutral praise on near-best moves,
  softens inaccuracy verdicts; gate shows it on Opera 8.Nc3). Tests 183→186.
  Next: PATTERN GM-2 (hard-to-find best move) or MINE B2 (falsifying).
- **2026-06-12g** · cleanup + workflow v3 · Pruned consumed research (12MB
  arXiv PDFs, raw JSON, external .py — all distilled already), 4 dead exports;
  doc maps refreshed. Built v3: improve/SOURCES.md (pattern-mining queue,
  source registry, confirm-gate contract, book chunk queue B1–B19) + README
  unit types BUILD/MINE/PATTERN. Book located at ~/think-like-a-super-gm-*.pdf.
  Next: first v3 session — MINE B1 (§4.1 Candidate Move) + PATTERN it.
- **2026-06-12f** (loop iter 6/6 — OVERNIGHT LOOP COMPLETE) · 2 units · C6
  praise rotation (6/tier by ply) · C5 early_queen regression.
  NIGHT TOTAL: 18 units / 6 sessions — U1 praise-on-bad-moves bug fixed ·
  ignores_threat + missed_idea facts (suggestions & threats now carry WHYs at
  winDrop≥5) · U3 API-key + U4 WebLLM one-click commentary · P3 lost-position
  framing · C1/C3/C6 phrasing · tests 173→183. NEXT ERA: project cleanup, then
  workflow v3 (book-driven: think-like-a-super-gm patterns verified by engine).
- **2026-06-12e** (loop iter 5/6) · 4 units · C8: missed_idea now fires for
  inaccuracies too (idea gate 5, accusatory missed-tactics keep gate 10) + new
  wins_material (mirrored refutation walk) and plain-captures ideas — nearly all
  "better way" suggestions now carry a WHY · P3: good-move allowed-mate framed
  as unavoidable. Next: iter 6 = C5/C6 phrasing variety + final summary.
- **2026-06-12d** (loop iter 4/6) · 3 units · U6 deeper: missed_idea now walks
  the best PV one move in ("Nb2 was the better way — it would have prepared Qd4,
  forking…") · U5 audit: logged P3 (lost-position phrasing) + C8 (bare
  better-way). Next: C8, P3, C5/C6 phrasing, R-list.
- **2026-06-12c** (loop iter 3/6) · 3 units · U3+U4: Deep Review panel now has
  one-click commentary via user's own Anthropic key AND a fully local WebLLM
  option (Llama-3.2-1B, ~700 MB, WebGPU-gated, CDN dynamic import — zero bundle
  cost); both reuse factsheet→verify→fallback. providers.test.ts mocks fetch.
  Next: U2/U6 PV-plan narration, U5 detector audit, C5/C6 phrasing.
- **2026-06-12b** (loop iter 2/6) · 3 units · U6/C3 missed_idea: quiet best-move
  suggestions now carry a WHY ("Bxf6 was the better way — it would have defended
  the pawn on e4"); ideas: escapes/defends/trades/tempo/positional, max 2.
  Next: U3/U4 LLM rephrase toggles (needs src/llm+ui override), U2/U6 PV-plan narration.
- **2026-06-12** (loop iter 1/6) · 3 units · U1 explain-more no longer praises bad
  moves (intent frame) · U2 ignores_threat fact (already-attacked piece, move
  ignores it — fires on Blackburne 5.Nxf7) · U5 slice: dash-soup + decap polish.
  Next: U2 remaining (PV punishment narration), U6 best-move intention, U3/U4 LLM toggles.
- **2026-06-11c** · 3 units · DS1–DS4 dataset items queued (STS, WAC/ECM EPDs,
  [%eval] games, more puzzle themes) · R15 relative pins + exploit-pin mapping ·
  recall harness now line-wide (themes are line-level): pin 21→80, skewer 0→100,
  fork→100; floors ratcheted. Next: R-list top-down; D4 skewer wiring; sac 86%.
- **2026-06-11b** · 2 units · I1 fixtures (HF /rows scan, 10×200 puzzles) + I2
  recall harness. Baseline: hanging/mateIn1 100%, sac 75%, trapped 72%, discAtk
  63%, fork 62%, pin 21%, skewer 0%. Next: R-list; pin+skewer are the gaps.
- **2026-06-11** · setup · Built the workshop (README/TODO/TRACKER), audited
  reading list vs V2 (9 concepts already done), merged backlogs, wrote puzzle
  fetch script. Next: I1 fixtures → I2 recall harness.
