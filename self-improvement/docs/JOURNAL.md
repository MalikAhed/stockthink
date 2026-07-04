# JOURNAL — one entry per session, newest on top

Entry format: `- **YYYY-MM-DD[x]** · what was done · evidence it worked ·
what failed · what surprised you` (1–3 lines for improve sessions; up to ~10
for /work sessions). Past ~300 lines, /reflect compresses the oldest half into
LESSONS.md. Entries below 2026-06-12p were migrated verbatim from
self-improvement/improve/TRACKER.md's daily log (2026-06-12) — history is not rewritten.

- **2026-07-04b** · /ui · Landing smoothness pass — 6 fixes, one commit each (rollback-friendly):
  perf watchdog made TWO-WAY (one-way demotion was silently killing hero/coach/gears until refresh —
  the root of 3 reported "3D vanishes" bugs); ghost hero rook fixed (generation tokens on the async
  piece builds — ui.js's saved-theme re-apply raced the initial build); all video-like demos now LOOP
  with an end-hold (also fixed Reel's never-exercised loop path which died after one pass); coach board
  GLBs preload ~1.5 screens early + powerPreference on every renderer; finale CTA/cut-veil fade driven
  from the scroll handler (was rAF-loop-only → froze/popped on fast scroll-up); coach→finale transition
  rebuilt as a LIGHT-UP entry (bulb sputters alight, pool grows table→board→viewport; page-coloured
  in-section hole overlay, two clocks, bakes untouched). Evidence: probe-lightup staged frames read
  correctly, probe-sweep clean, build + 249 vitest green. Surprise: Reel loop:true had NEVER worked.
- **2026-06-30a** · /ui (autonomous; ultracode) · Landing FINALE — the Réti–Tartakower queen sacrifice
  now PLAYS OUT as a live WebGL move cinematic ("The Queen's Grave"). Built the move-beat timeline in
  `landing/ender-scene.js` on top of the existing intro (rain + dolly): a keyframed cinematic camera
  (`CAM_KEYS`/`setCam` — monotonic push, ONE motivated widen+orbit on the double-check, true held-still
  brackets), per-move eased glides + capture topple-and-fade (`MOVES`/`setMoves`/`toppleCaptured`), two
  converging double-check attack-line beams (rook d-file cool-teal + bishop diagonal gold via `aimBeam`),
  a room-DRAIN to chiaroscuro (ambient/exposure/fog + a camera-child vignette) with the spotlight
  continuously HUNTING the king's live position, the king resign-topple, and a rating lower-third HUD
  (🔴 Blunder · ✨ Brilliant · 🟢 Double check · 👑 Checkmate) as live HTML (`ender.js` + `styles/ender.css`,
  icons from publicDir `/badges/`). Everything is a pure function of one clock `frame(t)` → scrubs + bakes.
  EVIDENCE: line engine-verified (chessops + Stockfish 18 d24 — 8…Nxe4 9.Qd8+ Kxd8 10.Bg5+ Kc7 11.Bd8# is
  forced mate; Qd8+ the unique #1, mate-in-3); headless GL=sw probes confirm every beat renders and the
  final mated position is numerically EXACT (knight→e4 · queen→d8 captured/gone · king→c7 · bishop→d8) incl.
  the reduced-motion still; `frame(99)` throws no page errors; `npm run build` green; gate.e2e 2/2.
  PROCESS (ultracode): a 4-director judge-panel workflow chose the direction (push-reveal spine, queen's-
  grave through-line); a 4-dimension adversarial review (17+15 agents) came back CLEAN — chess 0 findings,
  animation 7-raised/0-confirmed, 1 low perf nit fixed (vignette sized on resize, not per-frame).
  OPEN for the user: it's a ~30s AUTOPLAY-on-arrival cinematic — long for a scroll page; duration, the
  220vh section height, and autoplay-vs-scroll-scrub are easy dials (it's all `frame(t)`). Bakes to a
  `<video>` on approval (studio.js recorder now drives `frame(t)`; render `FRAMES ≈ DURATION*24`).
- **2026-06-17b** · /ui · Landing "How it works" Beat 1 (data-step 7) — built + approved the
  right-side **"engine in your browser" demo**: scan → board shrinks/fades → **square-node neural net
  "thinking"** (matches `user provides/neural-net`, teal→green, edges draw in 2 ramped stages,
  Calculating→Processing loader, stat-style depth/nodes) → **Nxf7 result pops** on a white panel →
  board returns with an **L-shaped knight arrow** + chip → short **typewriter explanation**. Also: gears
  now scroll-coupled (`SPIN` in `gears.js`). EVIDENCE: all phases verified via new `editor/probe.mjs`
  screenshots; move engine-verified (Fried Liver #1 = Nxf7). FAILED/SLOW: rebuilt the "transition" twice
  (guessed "dim" vs his "board→net→result→board") + scan color — lesson logged: restate motion as a
  numbered sequence & check `user provides/` first. Brain updated: `frontend/landing/CLAUDE.md` got the
  probe.mjs harness note, the ENGINE VISUAL LANGUAGE, the Beat-1 spec, and speed rules. Next = Beat 2.
- **2026-06-16b** · /ui · Landing health + org pass (for fast future sessions) +
  resilience. (1) RESILIENCE: a WebGL failure used to kill the WHOLE page — `scene.js`
  throwing halted `sections.js`/`ui.js` (awaited after it in `main.js`), so any
  WebGL-less visitor got a blank page. Wrapped the hero import in try/catch → `body.no-hero`,
  clears `pre-intro`; steps/nav/demos now survive. (2) ORG: `index.html` 89 KB→24 KB
  (72%↓, 22k→6k tokens — was over the Read limit) by externalizing 10 badge SVGs
  (was 64 KB inline base64) → `icons/*.svg`; split `styles.css` (733 lines) → 4 partials
  under `styles/` via an @import manifest (cascade order preserved); extracted the
  scroll-scrub framework (hero outro + hook morph) → `scroll-engine.js`. EVIDENCE: build
  green (multi-page, icons+@imports bundle), vitest 249/1-skip, page loads with only the
  (now-caught) WebGL warning; functionally verified live — section reveal fires, hook
  morph scrubs 0.65→1.0 across scroll, all 21 icons load, styles apply from partials.
  Decided steps redesign = "scroll-scrubbed scenes"; left a ready-to-run plan in
  `frontend/landing/README.md` (per-step JS split + scrubbed-steps) for a user-watching
  session — deferred the per-step `sections.js` decomposition as too visual to verify headless.
  SURPRISE: prod build re-inlines the small SVGs (<4 KB) as base64 again — fine, that's a
  perf win; the source stays clean. Branch `ux/landing-page`, not merged.

- **2026-06-16a** · /ui · De-bloated + split the sandbox landing page. One 5.4 MB
  HTML (44% inlined base64: 24 piece assets in `window.PIECES` = 6 GLB + 18 PBR
  textures) → 7 readable files under `frontend/landing/` (~197 KB source) + 24 real
  assets in `frontend/public/landing/`. Wired as a 2nd Vite entry
  (`rollupOptions.input.landing`); three/gsap now npm deps (were CDN), loaded URL-by
  `import.meta.env.BASE_URL`. EVIDENCE: build green (tsc + multi-page: app & landing
  emit; three.js isolated to a 583 KB `scene` chunk, NOT in the 620 KB app bundle),
  vitest 249/1-skip, every asset HTTP 200, no code errors. Could NOT screenshot the
  3D hero — headless Chrome has no GPU (WebGL fails, software llvmpipe); renders on a
  real GPU. SURPRISE: the inlined GLBs are byte-identical (md5) to the raw source
  models. 3D source (board + parametric render HTMLs, for a future endgame cinematic)
  archived OUT of the repo at `~/stockthink-3d-source/`; sandbox + duplicate folder
  removed. Branch `ux/landing-page`, not yet merged. Next: user reviews on their GPU
  machine; later decide if landing becomes the public `/`.

- **2026-06-14d** · /chess · 1 unit (U2) · New `invites_capture` fact: when a
  move walks a piece/pawn onto an empty square the engine reply takes right there
  (9...b5? 10.Nxb5!), name the punishing reply WITHOUT a material claim — honest
  when the cost is positional (SEE sees the pawn defended, so it never read as
  hanging). Closed opera-09-b5 C0→C1; eval CAUSAL 80.0→85.0, TOTAL 90.8→92.1, no
  regressions; gate comments read true; +3 fixtures (249 pass). SURPRISE: blk-04
  stayed partial — its refutation is a non-capture double attack (...Qg5!), not a
  capture, so it needs a separate "reply double-attacks" fact (filed U2b). Next:
  U2b, then U7 ("The problem is…" leaking onto sound best moves).

- **2026-06-14c** · Root cleanup: folded `public/` → `frontend/public/` (Vite
  `publicDir`; runtime URLs unchanged, WASM still copied to `dist/engine/`) and
  `scripts/` → `self-improvement/scripts/` (path math `..` → `../..`/`../../..` fixed).
  Root is now just the 3 zones + required config/docs. Verified: build green +
  WASM in dist, vitest 246/1-skip, eval TOTAL 90.8% unchanged.

- **2026-06-14b** · Added 4 intent-scoped session modes (`.claude/commands/`):
  `/ui` · `/chess` · `/research` · `/rethink`, plus a "Session modes" menu in
  CLAUDE.md. Each mode tells a fresh session its purpose, the exact slice to read,
  its loop, and its gates — so a session knows what it's for without re-explaining,
  and stays scoped (only `/rethink` reads broadly). Pure workflow files; no app
  code, no build/eval impact. Goal: every future session = one clear intent.

- **2026-06-14** · USER ARC: reorganized the flat repo into 3 zones — `frontend/`
  (UI/UX), `backend/` (engine+analysis), `self-improvement/` (docs+improve+eval+
  test) — and stood up a live UI/UX design workflow. Mechanics: `@frontend`/
  `@backend` aliases (vite+tsconfig); only cross-zone & test/eval imports use them.
  `score.ts` ROOT now = the self-improvement dir (data paths self-corrected), LOC
  walk → frontend/src+backend/src; `transport.ts` WASM anchored to `process.cwd()`.
  Tooling: `.mcp.json` (Chrome DevTools primary + Playwright MCPs), `vite-plugin-checker`
  dev overlay (enableBuild:false → build stays ~4s), `release.yml`+CHANGELOG; archived
  the WIP homepage sandbox to `~/stockthink-design-archive/`. Opened the UX arc —
  retired "UI is frozen", added "The UX loop" to CLAUDE.md + ROADMAP UX-M1/M2.
  EVIDENCE: build green (byte-identical bundle every step) · vitest 246/1-skip ·
  eval TOTAL 90.8% (69/76) UNCHANGED · dev serves /frontend/src/main.ts 200 +
  checker "0 errors". SURPRISE: nearly everything self-corrected — only `src` (LOC
  walk) and `public/engine` (transport) broke, the two targets that stayed at repo
  root while their referrers moved. On branch `reorg/three-zones`; NOT merged —
  awaiting user go (main auto-deploys).

- **2026-06-13b** · USER FEATURE: site-wide visual facelift (index.html +
  style.css ONLY — zero TS). chess.com signature raised 3D buttons (hard
  `--green-edge` bottom edge, press-down :active) on every `.primary`; brand
  identity: pawn-on-green logo tile in topbar + same mark as SVG favicon
  (tab had NO icon before) + og: tags; nav links got house/magnifier icons,
  active pill brightened; custom select chevron (appearance:none); global
  :focus-visible green ring (none existed); home hero ambient glow + gradient
  "explained" + green icon tiles + ✓ feature chips (max-width fixes 4+1 orphan
  wrap); loader board green aura; quiet ghost Cancel; sidebar border; cc-row
  hover inset accent; btn-new + icon. Hygiene: merged duplicate `.controls`
  rule, normalized 2 stray `var(--green,…)` refs to `--green-500`, wordmark
  text collapses ≤560px. ROLLBACK: tag `pre-facelift` = 23af32b; single commit
  → one `git revert` undoes the whole pass. EVIDENCE: tsc clean · 246/247
  green · build clean · smoke2 ALL PASSED (centered 690/1380 held) · 5
  before/after screenshots compared per screen. SURPRISED: the two stray
  `--green` vars only ever worked via their fallbacks.
- **2026-06-13a** · USER FEATURE: home screen + topbar navigation + loading
  revamp. New `#screen-home` (hero, entry cards → each input tab, feature
  chips, resume card when a report is open); topnav Home / Game Review /
  Current Game (hidden until a report exists; wordmark → home); progress
  screen centered (was left-aligned) with `frontend/src/ui/loader.ts`: knight rides
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
  chess.com game import + background pre-analysis. New `backend/src/chesscom/`
  (api/queue/store) + `frontend/src/ui/chesscom.ts` + input tabs; ALL analysis now runs
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
  NEXT: U2 punishment narration via self-improvement/improve/ ([T1] top).
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
  self-improvement/eval/score.ts (real WASM, pool 1, deterministic — two runs byte-identical).
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
  backend/src/analysis/explorer.ts: lichess masters explorer (keyless, CORS) walks the
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
  doc maps refreshed. Built v3: self-improvement/improve/SOURCES.md (pattern-mining queue,
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
  Next: U3/U4 LLM rephrase toggles (needs backend/src/llm+ui override), U2/U6 PV-plan narration.
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
