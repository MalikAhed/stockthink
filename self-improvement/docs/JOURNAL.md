# JOURNAL — one entry per session, newest on top

Entry format: `- **YYYY-MM-DD[x]** · what was done · evidence it worked ·
what failed · what surprised you` (1–3 lines for improve sessions; up to ~10
for /work sessions). Past ~300 lines, /reflect compresses the oldest half into
LESSONS.md. Entries below 2026-06-12p were migrated verbatim from
self-improvement/improve/TRACKER.md's daily log (2026-06-12) — history is not rewritten.

- **2026-07-01h** · /chess · **BACKLOG #1 (blk-04) — a lone `regression` platitude yields the lead to
  the capture the engine preferred (arc win #3)** — extended the 07-01g demotion: when a bad move's only
  fault is a bare `cedes_center`-style `regression` (no concrete bad fact behind it) AND it missed a
  CONCRETE winner (a fork/free-piece/mate, or a `missed_idea` whose idea is captures/wins_material), the
  concrete miss LEADS and the platitude drops to "explain more" (it reads as an ambiguous "It …" after a
  different-move lead). §5a — compose lead-selection only. KEY FINDING (probe, then FULL-run verified):
  the improve-TODO's U2b plan — voice "4…Qg5 forks g2 + the e5 knight" — is a FAKE reason here; the
  engine's own line `Qg5 5.Bxf7+ Kd8 6.Ng4` SAVES both (knight escapes to g4, g2 untaken), winDrop only
  6.4 → nothing wins by force. The honest grounded lead is the capture the engine chose, 4.Nxd4
  (missed_idea) — which the case realCause already blessed; added missed_idea to blk-04's leadFactIn
  (spec ← its own realCause). blk-04 C1/G0→C2/G2. **CAUSAL 90.0→95.0 · GROUNDED 88.2→94.1 · PRECISION
  88.2→94.1 · TOTAL 92.3→96.2** (ECONOMY/COVERAGE held; only blk-04 moved). gate.e2e 2/2 — READ every
  comment: 4.Nxe5 now leads Nxd4 (regression → "more"); opera 10…cxb5's missed_idea is a `prepares`-pin
  (excluded by the captures/wins_material filter) → untouched; sacs/mates structurally safe (good-move
  branch). suite 279/280 (+2 compose units: the fire + a positional-idea no-fire guard), tsc clean.
  Recorded the U2b finding in improve/TODO.md so no future session rebuilds the ungrounded detector.
  SOLE remaining wrong-lead: opera-09-b5 (name the Nxb5! sac — invites_capture undersells a knight sac;
  genuine [T1] content, needs the give-and-regain detector). Session arc: TOTAL 84.6→96.2 (two blocks).
- **2026-07-01g** · /chess · **BACKLOG #2 fork-priority — a missed HUGE tactic now LEADS over a soft
  `abandons_square` (arc win #2)** — in compose's bad-move branch, when the only named fault is an
  `abandons_square` walk-away AND the move missed a concrete winner (missed_fork / missed_free_piece /
  missed_mate), the missed tactic is promoted to the lead and the walk-away follows. Scoped to
  abandons_square ON PURPOSE — a hangs_piece / ignores_threat / allows_mate fault is the concrete story
  and still leads (R5); §5a honoured (compose lead-selection, never the recall-tested detectors).
  EVIDENCE — **the hash-borderline landmine cleared**: reproduced C1/G0 AND confirmed the fix in the
  FULL `npm run eval` (not `--explain`). pz-fork-miss-000Pw C1/G0→**C2/G2**, now leads "Ne2+ would have
  forked the king and the queen on c3." **CAUSAL 85.0→90.0 · GROUNDED 82.4→88.2 · TOTAL 88.5→92.3 ·
  PRECISION 82.4→88.2** (ECONOMY/COVERAGE held); exactly ONE case moved, every other byte-identical.
  gate.e2e 2/2 — READ every comment: NO Opera/Blackburne move leads with abandons_square, so all
  landmarks (Rxd7/Qb8+ sacs, Rd8#/Nf3# mates, blk-05 Qxg2, blk-07 Nf3#) byte-identical. suite 277/278
  (+2 compose units: fork-leads-over-walkaway + the hangs_piece-still-leads guard), tsc clean. SURPRISE:
  none — the isolated-vs-full gap WAS exactly abandons_square burying the fork only under hash carryover,
  so the compose reorder makes the full run match the honest isolated read with no crafted case needed.
  Two of the Phase-0.3 wrong-lead trio remain: opera-09-b5 (BACKLOG #1 [T1] name-the-sac) + blk-04-nxe5
  (regression lead; its `missed_idea` isn't in that case's leadFactIn — a truth-set call, not this fix).
- **2026-07-01f** · /chess · **Phase 3.4 partial (close the empty-text R3 path) → Phase 3 core COMPLETE**
  — the good-move badge fallback could emit EMPTY text for a fact-less great/brilliant move (`NEUTRAL` has
  only best/excellent/good); now falls back to the excellent-tier line (`?? NEUTRAL.excellent`). Defensive
  R3 correctness — the path is unreached by the eval/gate (eval HELD 88.5%, suite 275/276, +1 unit test),
  so no visible change, just a closed latent hole. DEFERRED (needs review): the fuller 3.4 — replace the
  position-blind ply-parity rotation with confidence-informed "too deep / equal" §6 markers — changes
  badge TEXT and carries gate-regression risk, best with the user watching. **Phase 3 core (silence layer)
  DONE:** 3.1–3.2 signals · 3.3 badge state (ECONOMY→100%) · 3.4 empty-path closed. Arc TOTAL 84.6→88.5
  this session. Remaining arc = Phase 4 (ablation — determinism-risky, scalpel-only) + Phase 5 (WebLLM —
  deferred/optional); eval-MOVING gains now need CONTENT (BACKLOG #1 [T1] name-the-sac / #2 hash-borderline).
- **2026-07-01e** · /chess · **Phase 3.3 (first-class badge state — economy WIN)** — shipped the badge
  the rubric had been holding open. `Comment.badge` is set when a good move produces no groundable
  concrete cause and falls to a bare classification line (honest silence, not an invented reason);
  `score.ts` now credits `expectSilence` + badge → economy 2 (was capped at 1: "impossible until compose
  gains a badge state"). Both silence cases earn it: coinc-pin-be5 + blk-04b-qg5 → E1→E2. **ECONOMY
  91.7→100.0%, TOTAL 85.9→88.5%** (CAUSAL/GROUNDED/COVERAGE/PRECISION byte-identical — cleanly isolated
  to economy). ZERO prose churn: badge is a FLAG, text unchanged → gate.e2e landmarks all intact (Rxd7
  sac, Qb8+ sac, Rd8#/Nf3# mates read true), suite 274/275. Not gaming the metric — the badge is a real
  signal ("no concrete cause to voice"), and crediting honest silence 2 is exactly the ceiling Phase 0.2
  designed. Next: **Phase 3.4** — replace the position-blind NEUTRAL ply-parity rotation + close the
  great/brilliant empty-text path with the two honest §6 outputs (refines badge TEXT; no new eval case,
  keep gate.e2e byte-identical or better).
- **2026-07-01d** · /chess · **Phase 3.2 (silence signals: "no dominant idea" + "equal")** — extended
  `MoveReport.confidence` with `topSpreadCp` (|PV1−PV2| eval gap — small ⇒ many equal moves, no dominant
  idea) and `drawPermille` (best-line WDL draw share — high + cp≈0 ⇒ genuinely equal). DATA ONLY, eval
  HELD at 85.9%, suite 271/272 (+3 units). **The silence-layer SIGNAL FOUNDATION is now complete:**
  volatility · trajectory-flip · multiPV-spread · WDL-draw, all on `confidence`, R1-safe, nothing consumes
  yet. STOPPED here deliberately: 3.3/3.4 (route Gate-2 failures to a first-class badge state) is the risky
  BEHAVIOUR change AND has no current eval evidence (coinc-pin-be5 solved, blk-04b already silent) — it
  needs threshold calibration + per-comment gate.e2e verification (must not mute delivers_mate / Qb8+
  sac), best done with the user in the loop. Also surfaced: pz-fork-miss-000Pw (BACKLOG #2) is
  hash-borderline like coinc-pin — clean C2/G2 isolated, C1/G0 in the full run (a hash-dependent
  abandons_square buries the missed fork); a safe fix needs a non-borderline crafted case (LESSONS:
  crafted FENs burn). RESUME OPTIONS next session: (a) 3.3/3.4 badge state w/ thresholds; (b) BACKLOG
  #1/#2 content (name the Nxb5 sac / fork-priority); (c) author non-borderline fake-reason cases for 2.1.
- **2026-07-01c** · /chess · **Phase 3.1 (confidence field — silence-layer foundation)** — added
  `MoveReport.confidence` { volatilityCp, lateFlip, depth } from the now-plumbed signals: volatilityCp =
  |shallowEval − deepEval| (before-position), lateFlip = white-POV advantage changed sign in the 2nd half
  of the per-depth trajectory, depth = deepest reached. DATA ONLY — nothing consumes it yet (Phase 3.3
  gates silence on it), so eval HELD at 85.9% (every dim byte-identical), suite 268/269 (+4 units:
  volatility math, late-flip detect, monotone no-flip, graceful undefined). R1-safe (never prose).
  Exported `moveConfidence` for direct unit testing (like annotateContext). Next: Phase 3.2 (multiPV-spread
  "no dominant idea" + high-draw-WDL "equal" signals), then 3.3/3.4 (route Gate-2 failures to a first-class
  badge state — the risky behaviour change; must verify gate.e2e landmarks aren't muted).
- **2026-07-01b** · /chess · **coinc-pin-be5 → honest silence (FIRST measurable arc WIN)** — completed
  what 2.2 set up. A best-tier move (best/great/brilliant) is never framed as a `second_candidate` —
  "only Qa6 promised more" CONTRADICTS a [best] verdict; it now falls to the honest neutral line. This
  closes the hash-borderline gap 2.2 exposed: with the decorative pin cut AND the contradictory candidate
  framing suppressed, coinc-pin-be5 reads "Exactly the right move." → leadKind null → E0→E1, STABLE across
  2 runs. NUMBERS MOVED UP: ECONOMY 87.5→91.7%, PRECISION 77.8→82.4%, TOTAL 84.6→85.9% (every other dim
  byte-identical; the only case that moved). Safe by scope: a [good]/[excellent] move CAN be a second
  candidate (gate's "14…Qe6 [good]" framing preserved) — only the top-tier contradiction is cut, and zero
  eval case ever wanted second_candidate as a lead (grep-verified). suite 264/265. Next: Phase 2.3
  (refutation-PV grounding) / 2.1 (positional+fork grounding) both lack clean aspiration cases (the
  positional/fork fake-reason cases are 0.4's deferred ones); opera-09-b5's wrong lead is a CONTENT gap
  (BACKLOG #1: name the Nxb5 sac), not a grounding one. Phase 3 (silence layer) signals are all plumbed.
- **2026-07-01a** · /chess · **Phase 2.2 (PV-grounding: demote decorative pins)** — first BEHAVIOUR
  change of the arc. A `creates_pin` may be voiced only if the engine's line FROM THE PLAYED MOVE
  (`[uci, ...replyPv]`) actually acts on the pinned square; an untouched pin is geometry, not cause,
  and is now cut from prose (lead AND "explain more"). Threaded `replyPv` (after-position best line)
  onto `MoveReport`. Gate lives in compose (§5a — detectors/recall untouched: recall 263/264 incl.
  skip). KEY BUG caught mid-build: grounding against `lines[0]` is doubly wrong — under hash carryover
  `lines[0]` is often a DIFFERENT move's line (coinc-pin-be5 full-run #1 = Qa6, not the played Be5)
  whose play (knight escaping f6→d5) FAKES a touch on f6. `[uci, ...replyPv]` is the played move's
  OWN line and is stable (pin suppressed identically across 2 full runs). DISCRIMINATES correctly:
  the gate's REAL pin (dxe5 pins d6, engine plays exd6 → d6 on the continuation → KEPT) vs the
  decorative one (coinc-pin-be5 f6 absent → CUT). Unit-tested (grounded / ungrounded / no-continuation).
  EVAL FLAT at 84.6% ON PURPOSE: the fake pin IS gone (comment went FALSE→true), but coinc-pin-be5 is
  hash-borderline — when Be5 isn't the literal #1 a TRUE `second_candidate` framing fills the gap, so
  economy stays 0 (emitted). That residual is Phase 3's badge-state job (the case's realCause always
  said it needs 2+3). LESSON: never ground a move-fact against `lines[0]` — under hash carryover it
  isn't the played move's line; use `[uci, ...replyPv]`. Next: Phase 2.3 (refutation-PV grounding for
  bad-move causes) or 2.1 (general positional/fork grounding).
- **2026-06-30h** · /chess · **Phase 1.4 → Phase 1 COMPLETE** — `analyze()` now accumulates the
  multipv-1 white-POV eval at each new depth (same "first exact per depth" semantics as the existing
  `onDepth`/`shallowEval`) and returns it on `PositionAnalysis.trajectory` — a late sign-flip / large
  late swing is the silence layer's instability signal (Phase 3). Captured INSIDE analyze (not via an
  onDepth side-channel through the pool), so it flows through the pool + live with ZERO new plumbing;
  `onDepth` firing unchanged. The "pass the full before best-PV" clause was already met —
  `AnnotateContext.lines[0].pvUci` carries the untruncated PV (sanifyLine's 10-ply cut only hits
  MoveReport.lines). DATA ONLY: trajectory unread ⇒ eval HELD at 84.6%/77.8%, suite 260/261 (+3:
  2 synthetic-transport units incl. a sign-flip + same-depth-refine de-dup, 1 real-engine
  ascending/unique ratchet), tsc clean. Added a reusable `ScriptedTransport` double (canned UCI lines
  on `go`) — first way to unit-test `analyze()` without the real engine. Reverted the no-change tool
  appends. **Phase 1 (free engine signals) DONE: WDL (1.1) · shallowEval+replyLines (1.2/1.3) ·
  trajectory (1.4).** Next: Phase 2 — the first BEHAVIOUR change (ground every spoken fact on the
  engine's own PV; §5a: at compose/lead-selection, never the recall-tested detector predicates).
- **2026-06-30g** · /chess · **Phase 1.1** — enabled `UCI_ShowWDL` and parsed the `wdl` triple
  onto `EngineLine` (white-POV `{win,draw,loss}` permille; win/loss swapped for black-to-move),
  graceful when absent. PROBED the §5a unknown first against the real lite WASM: it advertises the
  option AND emits `wdl W D L` (startpos `wdl 84 911 5`, sums to 1000) — kept as a capability-ratchet
  test. The option is reporting-only: eval HELD byte-identical at TOTAL 84.6% / PRECISION 77.8%
  (proof it doesn't perturb search), gate.e2e comments unchanged, full suite 257/258 (+4: 3 parseInfo
  POV/absence units + 1 real-engine emission), tsc clean. Scope held to `EngineLine` — threading wdl
  into AnnotateContext/MoveReport is Phase 3.2's job (the consumer), not jumped early. Reverted the
  no-change METRICS.md/metrics.json tool appends. Next: Phase 1.4 (per-depth trajectory via the
  existing `onDepth` hook) closes Phase 1, then Phase 2 (ground every spoken fact on the engine PV).
- **2026-06-30f** · /chess · **Phase 1.2+1.3** — plumbed the two signals `report.ts` dropped at
  the door into `AnnotateContext`: `before.shallowEval` (1.2 — volatility margin for the Phase-3
  silence layer) and the full after-position `replyLines[]` with evals (1.3 — `[0]` is the
  refutation `replyPv` heads, `[1..]` the alternatives Phase 2.3 needs to prove a punishment is
  "only this"). Extracted `annotateContext(before, after, derived)` — the seam that makes the
  plumbing observable (no `vi.mock`, not idiomatic here) + the home for Phase 2's grounding gate;
  it reuses buildMoveReport's already-computed eval/winDrop/bestUci (single source, no drift).
  DATA ONLY: no detector reads the new fields ⇒ facts/classifications/comments byte-identical, eval
  HELD at TOTAL 84.6% / PRECISION 77.8% (vs 0.4), gate.e2e comments unchanged, full suite 253/254
  (+4 new `report.test.ts`), tsc clean. Per §5a the gate stays OUT of the detector predicates the
  recall harness calls ⇒ recall structurally safe. Reverted the no-quality-change tool appends to
  METRICS.md + metrics.json (BACKLOG #7) — a held number is not a new dated measurement. Next:
  Phase 1.1 (`UCI_ShowWDL` + runtime-probe) or finish 0.4's 2–3 full-run-verified cases.
- **2026-06-30e** · /chess · **Phase 0.4 (begun)** — started populating the fake-reason class the
  arc exists to kill. SYSTEM UPGRADE: `eval/probe.ts` runs the real pipeline on candidate FEN+move
  pairs BEFORE positions.json (class, winDrop, facts, lead, comment, PVs) → crafted cases verified,
  not assumed. Added one probe-verified case `coinc-pin-be5`: a [best] move whose DECORATIVE
  absolute pin (no exploit; engine PV never touches it) the composer voices as a win ("losing
  everything behind it"). expectSilence aspiration → ECONOMY 0 + precision-miss today; TOTAL
  86.8→84.6%, PRECISION 82.4→77.8% on purpose; existing 18 byte-identical, suite 249/250, dry==real.
  BURN (caught pre-commit): a 2nd case `coinc-pin-re1` read [good]+fake-pin under the standalone
  probe but [inaccuracy]+"Qf3 was better" in the FULL run — hash-carry flipped its borderline class.
  This re-violated the 2026-06-12 hash-carryover lesson; strengthened that LESSONS.md entry (ALWAYS
  re-verify a kept candidate in the full --dry run; pick positions far from a class boundary — the
  kept case was +1.4). DECIDED opera-09-b5: do NOT bless invites_capture — "runs into Nxb5" undersells
  the knight SAC as a pawn-grab; the honest fix names the attack (future U2b/Phase 2), not a looser
  spec. The metric methodology (0.1–0.3) is DONE; ~84.6% is the honest baseline. Next: finish 0.4
  (2–3 more full-run-verified cases) and/or Phase 1 (plumb the free engine signals).
- **2026-06-30d** · /chess · **Phase 0.3** — made GROUNDED a real signal. A comment that
  LEADS with the wrong fact now scores GROUNDED 0, not a free 1: added `!leadOk` to the
  zero-condition (`forbiddenHits || !classOk || !leadOk ? 0 : factsOk ? 2 : 1`), killing the
  "free 1/2" the rubric handed out for merely dodging the mustNotMention blocklist with the
  right class. EVIDENCE: perfectly isolated — exactly the 3 wrong-lead cases dropped G1→G0
  (opera-09-b5 invites_capture/regression, blk-04-nxe5 "gives up the center" platitude,
  pz-fork-miss-000Pw abandons_square burying the missed Ne2+); every G2 case unchanged.
  GROUNDED 91.2→82.4%, TOTAL 90.8→86.8% ON PURPOSE; CAUSAL/ECONOMY/COVERAGE/PRECISION
  byte-identical; full suite 249/250. This ALIGNS the GROUNDED dim with Phase 0.1's `correct`
  signal (which already required a right lead — hence precision was untouched). The Phase-0
  metric-honesty descent is now essentially done: 92.1→90.8→86.8% across 0.1→0.3, all three
  same-day drops documented in METRICS.md so they're never read as regressions. **~86.8% is
  the honest baseline** — the 92.1% was inflated by free points. Two clear-cut disease leads
  (blk-04 regression, pz-fork-miss abandons) are obviously G0; opera-09-b5 is borderline (it
  DOES name Nxb5, but undersells it as a pawn-grab and its spec may be stale) — logged as a
  Phase 0.4 call: decide whether to bless `invites_capture` in its leadFactIn. Next: Phase 0.4
  (author fake-reason aspiration cases + the opera-09-b5 spec decision), then Phase 1.
- **2026-06-30c** · /chess · **Phase 0.2** — first-class badge-only / honest-silence
  outcome in the eval. New `expectSilence` field on EvalCase; ECONOMY now scores a silence
  case by honesty (voiced cause = 0 invented reason · neutral filler = 1 over-speak · real
  badge-only = 2, impossible until Phase 3 → aspiration cap). Re-marked `blk-04b-qg5` (the
  "no clean fact to voice" case) as the first badge-only case. EVIDENCE: perfectly isolated
  — only blk-04b-qg5 moved (E2→E1); CAUSAL/GROUNDED/COVERAGE/PRECISION byte-identical;
  ECONOMY 100→95.5%, TOTAL 92.1→90.8% ON PURPOSE (the metric learning to see over-speak,
  not a regression — documented in METRICS.md "How to read"); full suite 249/250; --explain
  confirms selective {needsExpl:false, emitted:false, correct:false} + economy 1. Coverage/
  precision unchanged BY DESIGN — a non-emitting filler was already honest abstention in
  0.1's accounting, so 0.2 only sharpens ECONOMY. Also wired silence-aware overrides for
  future cases (an expectSilence case that VOICES a cause → precision failure; needsExpl
  forced false) — logic in place, first exercised when Phase 0.4 authors a real-drop/
  no-nameable-cause case. Next: Phase 0.3 (kill the free GROUNDED 1/2).
- **2026-06-30b** · /chess (max effort) · Opened the **explain-the-why arc** on branch
  `chess/explain-engine` (off main) and landed **Phase 0.1** — a paired COVERAGE/PRECISION
  metric in the eval, the honesty axis the 3 per-case dims are structurally blind to.
  Derived purely from existing per-case checks (no compose/scoreCase behaviour change):
  COVERAGE = above-inaccuracy moves voicing a concrete cause / above-inaccuracy moves;
  PRECISION = right-&-grounded voiced causes / voiced causes. EVIDENCE: the 3 old dims
  reproduce byte-identical (C 85.0 · G 91.2 · E 100.0 · TOTAL 92.1) → zero regression;
  full suite 249/250 green; baseline COVERAGE 100% (no silence layer yet) · PRECISION
  82.4% (14/17). CONFIRMATION (not surprise — it validates the research): the 3 precision
  misses are EXACTLY the disease cases the doc named — opera-09-b5 (invites_capture "runs
  into Nxb5"), blk-04-nxe5 (regression "gives up the center"), pz-fork-miss-000Pw
  (abandons_square buries the missed Ne2+). The metric pinpoints them unprompted. SYSTEM
  UPGRADE = the metric itself (Phase 0 = make the eval able to see honesty). Brain: arc
  wired into BACKLOG (subsumes #1/#2/#6) + ROADMAP M4 + a MEMORY bridge; research doc now
  tracked. Logged-not-fixed: opera-09-b5's `leadFactIn` arguably needs `invites_capture`
  (it now names Nxb5 honestly) — a Phase 0.4 spec-sharpening call. Next: Phase 0.2
  (first-class badge-only expected outcome; stop crediting the neutral filler 2/2).
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
