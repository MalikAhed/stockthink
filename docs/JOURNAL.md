# JOURNAL — one entry per session, newest on top

Entry format: `- **YYYY-MM-DD[x]** · what was done · evidence it worked ·
what failed · what surprised you` (1–3 lines for improve sessions; up to ~10
for /work sessions). Past ~300 lines, /reflect compresses the oldest half into
LESSONS.md. Entries below 2026-06-12p were migrated verbatim from
improve/TRACKER.md's daily log (2026-06-12) — history is not rewritten.

- **2026-06-13a** · USER FEATURE: home screen + topbar navigation + loading
  revamp. New `#screen-home` (hero, entry cards → each input tab, feature
  chips, resume card when a report is open); topnav Home / Game Review /
  Current Game (hidden until a report exists; wordmark → home); progress
  screen centered (was left-aligned) with `src/ui/loader.ts`: knight rides
  the 3×3 ring — the classic closed knight's tour, all 8 hops legal — plus
  big live %, rotating quips; same knight animates the home hero. Foreground
  runs got a supersede guard (fgSeq): navigating away mid-analysis and
  starting another can't let the old job's completion/failure yank the UI.
  Spotlight now dissolves on any nav (focus-mode used to bleed onto home).
  EVIDENCE: tsc clean · 246/247 green · build clean · headless-chromium
  smoke: boot lands home, cards deep-link tabs, progress track centered at
  exactly viewport-mid (690/1380px), knight position changes between samples,
  resume card round-trips, "New" hides nav entry. FAILED first: header-less
  PGNs showed "? vs ?" in the resume card (PGN placeholder headers) — name
  filter added. SURPRISED: nothing structural — the queue absorbed nav-away
  semantics with one integer guard. NEXT: BACKLOG #1 (U2) still top.
- **2026-06-12s** · USER FEATURE (overrides "UI is done" for one session):
  chess.com game import + background pre-analysis. New `src/chesscom/`
  (api/queue/store) + `src/ui/chesscom.ts` + input tabs; ALL analysis now runs
  through one `AnalysisQueue` (single pool invariant) — batch in background,
  `runNow` preempts via new AbortSignal in pool/analyze, reports cached in
  IndexedDB keyed `uuid:tier` (LRU 60). EVIDENCE: tsc clean · 246/247 tests
  (13 new: normalization, outcome map, queue preempt/cancel/fail) · gate green
  · build clean · headless-chromium E2E walked the real flow against live
  api.chess.com: hikaru → 50 rows → fast review (acc box 96.2) → "Analyzed ✓"
  chip → cached reopen 153ms → batch chips + topbar pill across tabs.
  FAILED first: custom-checkbox click bubbled into the row handler and opened
  the review (caught by E2E, not unit tests) — stopPropagation belongs on the
  label, the input never receives the click. SURPRISED: api.chess.com is fully
  CORS-open with per-game CAPS accuracies in archives (shown in rows);
  explorer.lichess.ovh 401s in the same browser (BACKLOG #8 annotated).
  Eval untouched (no pipeline change). NEXT: BACKLOG #1 (U2) unchanged on top.
- **2026-06-12r** · /work T2 · BACKLOG #1 gaps (b)+(c): good-move praise
  stacking + positional ride-alongs. `compose.ts`: concrete purposes outrank
  `positional` (which waits in "explain more"); `quiet_strength` garnish only
  when the text is otherwise one line; its template loses "Well spotted."
  EVIDENCE: eval 82.9→**90.8%** (ECONOMY 81.8→100.0 · GROUNDED 85.3→91.2 ·
  CAUSAL 80.0 flat) — pz-trap-009FP E0→2 · trap-rook-file-kick G0→2 E0→2 ·
  opera-13 now "sacrifice — and stop" · zero regressions · gate green ·
  tests 233/234. **M2 exit met** (TOTAL ≥90, no regressions) → arrow to M3.
  FAILED: nothing on-block. SURPRISED: BACKLOG #8 bit during PROVE
  (metrics.json dup append — reverted by hand, item annotated); M2 fell in one
  loop because the economy cluster alone was worth 6/76 pts.
  UPGRADE: ROADMAP joins /work BOOT (ORIENT asks for an arc it never read).
  NEXT: U2 punishment narration via improve/ ([T1] top).
- **2026-06-12q** · 3 units · MINE B6 (§1.6 pp. 27–30: mostly logistics; 1
  candidate → GM-13 calibrated eval-vocabulary audit, backlog 2/6) · PATTERN
  GM-10 proven: MissedIdea `open_lines` — dev-lead pawn lever + PV-walk
  king-zone slider-pressure gate; f4-f5 fires/no-lead silent fixtures. Tests
  231→233, gate green. Gap spotted in gate read-through → U7 ("The problem
  is…" framing on a BEST move, Opera 15.Bxd7+). Next: PATTERN GM-11
  (guarded-target/deflection, ties R17/R18/DS1) or GM-13; chunk B7.
- **2026-06-12p** · BOOTSTRAP: the self-aware arc. Built the brain (CLAUDE.md
  constitution + PROJECT_MAP/ROADMAP/BACKLOG/JOURNAL/LESSONS/METRICS), the
  rituals (/work /audit /reflect), and eval v1: 18 engine-verified cases +
  eval/score.ts (real WASM, pool 1, deterministic — two runs byte-identical).
  BASELINE: CAUSAL 80.0 · GROUNDED 85.3 · ECONOMY 81.8 · TOTAL 82.9% ·
  tests 231/232 · recall avg 94.8% · src 5561 LOC. Evidence of real teeth:
  the crafted rook case reproduced the remembered failure verbatim ("The rook
  takes the open f-file, the natural highway…" stacked after the true
  mate-threat lead → G0/E0); b5 aspiration case confirmed why-bad weakness
  (C0: development platitude instead of Nxb5). FAILED first: my Légal FEN
  omitted the f8-bishop — engine verification caught it (→ LESSONS), and the
  first poisoned-capture craft (Nxa1) was unsound material math — replaced.
  SURPRISED: engine hash carryover makes borderline classifications
  context-dependent across different case SETS (deterministic within one) —
  documented in METRICS.md; dropped one mis-specified case (Bg4). Next /work:
  BACKLOG #1 (eval-driven fixes: why-bad causality, praise stacking,
  positional platitude ride-alongs).
- **2026-06-12o** · 3 units · MINE B5 (§4.6 pp. 401–416, Puzzle 34 bayonet
  attack) → GM-10 strike-now pawn break + GM-11 guarded-target/remove-the-
  defender (both `mined`, backlog 2/6) · PATTERN GM-12 proven: `hard_to_find`
  reason gains 'pawn_break' (book: novices never suspect a pawn move bites this
  hard) — softens a missed quiet pawn advance like quiet/retreat misses; fixture
  f6→Qxg7# fires. Tests 226→227. Next: PATTERN GM-10 (open-lines missed_idea)
  or GM-11 (deflection family, ties to R17/R18/DS1); chunk B6 (pp. 27–29).
- **2026-06-12n** · UX batch · san-tag pills (Neo piece SVG replaces N/B/R in all
  prose; hover enlarges + plays the move on the board) · board coords fixed
  (inside-square chess.com style; dangling-selector bug squashed) · nav buttons
  restyled · Spotlight try-mode: user moves get live ratings + blue "Your move"
  card + undo/back-to-line; eval bar live in focus mode. 226 tests green.
- **2026-06-12m** · 8 units · Long run (user away): W3 voice pass (print-through
  audit) · PATTERN GM-4 falsify-coaching · GM-5 Lasker miss frame · GM-3
  only_move voice audit · MINE B3→GM-6/7 + B4→GM-8/9 · PATTERN GM-6
  removes-checks · GM-7 abandons_square · GM-8 retreat softener · GM-9
  counterattack lead · GM-2b quiet_strength praise (residual closed).
  All GM-1..9 fully proven. Tests 208→222. Next: MINE B5 (§4.6 pp. 401–416 —
  over the 15pp cap, split into two chunks), then B6 / puzzle chunks B7+.
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
