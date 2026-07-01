# BACKLOG — master ranked queue

Rules: the TOP item is what /work does next. Coarse-grained only — [T1] items
are umbrellas; their fine-grained order lives in `self-improvement/improve/TODO.md` +
`self-improvement/improve/SOURCES.md` (never duplicate items here). Re-rank in /work step 7.
Tags: [T1] chess content (runs via self-improvement/improve/ protocol) · [T2] explanation
brain / eval · [UX] interface/design (runs via the UX loop) · [SYS] system &
tooling. Severity: S1 blocks quality · S2 visible flaw · S3 hygiene.

## Active arc — UX redesign (opened 2026-06-14)
Foundation shipped (3-zone reorg + live MCP design loop — ROADMAP UX-M1).
**Next UX block:** first redesign pass in the new loop — pick ONE surface (home
hero is the likely first, heading toward the AI-video direction), branch, iterate
live via the browser MCP, and get the user's screenshot approval before
committing. Run all UI work through CLAUDE.md → "The UX loop". The chess-quality
queue below (self-aware arc) continues in parallel via /work and "improve analysis".

## Active arc — Explain the *why* (chess, opened 2026-06-30, branch `chess/explain-engine`)
The systematic fix for the "fake reason / can't stay silent" cluster. Full plan +
6-phase backlog: `docs/RESEARCH-explaining-the-why.md` (deep-research, hand-verified).
Two diseases: facts are born from board geometry and never grounded against the
engine's own PV (a coincidental pin headlines a quiet good move), and abstention
fires only on fact *absence*, never on irrelevance. Cure A (PV-grounding) + Cure C
(dual-gate silence/badge layer), both $0/client-side. **This arc subsumes table items
#1, #2, #6** — they are its facets, not independent work.
**Phase 0.1–0.3 ✅:** the eval can now see honesty — paired COVERAGE/PRECISION (0.1), a
first-class `expectSilence` badge-only tier (0.2), and GROUNDED requiring a right LEAD (0.3).
The same-day TOTAL descent (92.1→86.8%) is intentional metric-honesty, documented in METRICS.md.
**Phase 0.4 ⏳ (begun 2026-06-30):** built `eval/probe.ts` (safe case-vetting) and added the
first fake-reason aspiration case `coinc-pin-be5` — a decorative pin the composer voices as a
win though the engine never exploits it (TOTAL→84.6%, PRECISION→77.8%). A 2nd crafted case
broke on hash-carry (full run flipped its borderline class — LESSONS.md) and was dropped.
DECIDED on `opera-09-b5`: do NOT bless `invites_capture` — "runs into Nxb5" undersells the
knight SAC as a pawn-grab; the real fix is a fact that names the attack (future U2b / Phase 2),
not relaxing the spec. **Phase 1.2–1.3 ✅ (2026-06-30):** threaded the two signals `report.ts` dropped at the door into
`AnnotateContext` via a new `annotateContext()` seam — `before.shallowEval` (1.2, the volatility
margin) + the full after-position `replyLines[]` with evals (1.3, the Phase-2.3 uniqueness input).
DATA ONLY — no detector reads them yet, so eval HELD at 84.6%/77.8%, suite 253/254, §5a honoured
(gate stays OUT of the recall-tested predicates). **Phase 1.1 ✅ (2026-06-30):** enabled `UCI_ShowWDL` + parsed `wdl` onto `EngineLine` (white-POV
permille, graceful when absent). PROBED the real lite WASM first — it emits `wdl` (startpos
`84 911 5`); eval HELD byte-identical (reporting-only, doesn't perturb search). **Phase 1.4 ✅ → Phase 1 COMPLETE (2026-06-30):** `analyze()` now captures a per-depth eval
trajectory onto `PositionAnalysis.trajectory` (internal accumulation → flows through pool + live,
no new plumbing); the "full before best-PV" clause was already met by `AnnotateContext.lines[0].pvUci`.
DATA ONLY — eval HELD at 84.6%/77.8%, suite 260/261. **All four free signals are now plumbed: WDL ·
shallowEval · replyLines · trajectory.**
**Phase 2.2 ✅ (2026-07-01) — first BEHAVIOUR change:** a `creates_pin` is voiced only if the engine's
line FROM THE PLAYED MOVE (`[uci, ...replyPv]`, threaded onto `MoveReport`) acts on the pinned square;
an untouched pin is cut from prose. Gate in compose (§5a — recall untouched). DISCRIMINATES: gate's
real pin (dxe5/d6, engine plays exd6) KEPT, decorative coinc-pin-be5 (f6 absent) CUT — unit-tested,
stable across runs. LESSON baked in: ground against `[uci,...replyPv]`, NEVER `lines[0]` (hash carryover
makes it a different move's line). Eval flat at 84.6% on purpose (fake pin gone = FALSE→true, but the
case is hash-borderline so a true `second_candidate` fills the gap → economy 0; full silence is Phase 3).
**coinc-pin-be5 SOLVED ✅ (2026-07-01) — FIRST measurable arc win:** a best-tier move (best/great/
brilliant) is never framed as a `second_candidate` (it contradicts the verdict) → falls to its honest
neutral line. With the pin cut AND that framing suppressed it reads "Exactly the right move." → E0→E1,
**ECONOMY 87.5→91.7 · PRECISION 77.8→82.4 · TOTAL 84.6→85.9** (only that case moved; stable across runs;
[good]/[excellent] second-candidate framing preserved). **Next — honest read:** 2.3/2.1/2.4 all lack a
clean aspiration case to PROVE a gain (the positional/fork fake-reason cases are 0.4's deferred ones;
opera-09-b5's wrong lead is a CONTENT gap → BACKLOG #1, name the Nxb5 sac). Highest-leverage now is
**Phase 3 (silence/confidence layer)** — all four signals are plumbed and it generalizes today's
hand-built silence into a principled badge state. §5a everywhere; re-run gate.e2e after each.
**Phase 3.1 + 3.2 ✅ (2026-07-01) — silence SIGNAL FOUNDATION complete:** `MoveReport.confidence`
now carries { volatilityCp = |shallow−deep|, lateFlip = trajectory advantage-flip 2nd-half, depth,
topSpreadCp = |PV1−PV2| ("no dominant idea"), drawPermille = WDL draw share ("equal") } — all DATA
ONLY, R1-safe, nothing consumes yet (eval held 85.9%, suite 271/272, 7 unit tests).
**Phase 3.3 ✅ (2026-07-01) — badge state shipped, economy WIN:** `Comment.badge` = true when a good
move has no groundable concrete cause (falls to a bare classification line); `score.ts` credits
`expectSilence` + badge → economy 2 (was capped at 1). coinc-pin-be5 + blk-04b → E1→E2, **ECONOMY
91.7→100.0 · TOTAL 85.9→88.5** (text UNCHANGED — badge is a flag; gate landmarks intact, suite 274/275).
The earlier "no eval evidence" worry was wrong — the rubric held the ceiling open for exactly this.
**Phase 3.4 (empty-text path) ✅ + Phase 3 CORE COMPLETE (2026-07-01):** the good-move badge fallback
now always carries text (`?? NEUTRAL.excellent`, closing the fact-less great/brilliant empty-string hole);
eval held 88.5%, suite 275/276. **Silence layer done:** signals (3.1–3.2) · badge state (3.3, ECONOMY→100%)
· empty-path (3.4). **Arc scoreboard (through 3.x): TOTAL 84.6→88.5, ECONOMY→100%, PRECISION 77.8→82.4.**
**BACKLOG #2 fork-priority ✅ (2026-07-01g) — arc win #2:** a bad move that missed a concrete winner
(missed_fork / missed_free_piece / missed_mate) now LEADS with the missed tactic, not a soft
`abandons_square` walk-away (compose lead-selection, §5a; scoped to abandons_square so a hangs_piece /
allows_mate fault still leads — R5). pz-fork-miss-000Pw C1/G0→C2/G2 — the hash-borderline case, reproduced
AND fixed in the FULL run (not `--explain`). **CAUSAL 85.0→90.0 · GROUNDED 82.4→88.2 · PRECISION 82.4→88.2
· TOTAL 88.5→92.3** (one case moved, rest byte-identical; gate landmarks intact; suite 277/278).
**BACKLOG #1 (blk-04) ✅ (2026-07-01h) — arc win #3:** extended the demotion — a bare `regression`
platitude (`cedes_center`, no concrete bad fact behind it) yields the lead to the CONCRETE winner the
engine preferred (a fork/free-piece/mate, or a captures/wins_material `missed_idea`); the platitude drops
to "explain more". FINDING (probe + full run): U2b's "name the 4…Qg5 double-attack" would be a FAKE reason
— the engine line `Qg5 5.Bxf7+ Kd8 6.Ng4` SAVES g2 AND the knight (winDrop only 6.4), so nothing wins by
force; the honest lead is the capture the engine chose, 4.Nxd4 (missed_idea, realCause-blessed). blk-04
C1/G0→C2/G2. **CAUSAL 90.0→95.0 · GROUNDED 88.2→94.1 · PRECISION 88.2→94.1 · TOTAL 92.3→96.2** (only blk-04
moved; suite 279/280). **Arc scoreboard this session: TOTAL 84.6→96.2, ECONOMY→100%, GROUNDED 82.4→94.1.**
**◄ RESUME HERE (next /chess session):** the silence + lead-priority wins are captured; what's left:
  **(a) Phase 3.4 polish (deferred)** — confidence-informed "too deep / equal" §6 badge TEXT (uses
  volatilityCp/lateFlip/topSpreadCp/drawPermille). Changes badge wording → gate-regression risk, NO eval
  movement → do it WITH the user (calibrate + re-read every gate comment).
  **(b) BACKLOG #1 — the SOLE remaining wrong-lead: opera-09-b5** (C1/G0) — name the Nxb5! sac: the reply
  10.Nxb5! cxb5 11.Bxb5+ is a knight SACRIFICE (regained via the bishop check + attack), but `invites_capture`
  voices it as a pawn-grab ("runs into Nxb5, taking the pawn on b5"). Genuine [T1] content — needs the
  refutation/sac detector to see the give-and-regain; via the improve workshop.
  **(c) Phase 4** (ablation, true causal proof) — determinism-risky (hash carryover), scalpel-only; **Phase
  5** (WebLLM) — deferred/optional, never load-bearing.
§5a everywhere; re-run gate.e2e after every block. 0.4's 2–3 fake-reason cases stay open — deferred.

| # | Tag | Item | Sev | Payoff / evidence |
|---|---|---|---|---|
| 1 | [T1] | **U2 name the Nxb5! sac** (self-improvement/improve/TODO.md TONIGHT block) — the SOLE remaining wrong-lead: `opera-09-b5` (C1/G0) leads `invites_capture` "runs into Nxb5, taking the pawn on b5", but 10.Nxb5! cxb5 11.Bxb5+ is a knight SACRIFICE regained with interest. Needs the refutation/sac detector to see the give-and-regain from the reply PV | S1 | GROUNDED 94.1% / PRECISION 94.1% — the LAST wrong-lead case in the set (2026-07-01h) |
| 2 | [T2] | Eval M3: floor ratchet as a vitest suite + expand to 25+ cases (STS positional traps, DS2) — promoted: M2 exit met at 90.8%, lock the gains before further churn | S2 | Red eval blocks commits like a red gate |
| 3 | [T1] | D4 skewer wiring — `isSkewer` primitive already proves 100% line-recall (TODO R19); needs fact kind + template + annotate hookup | S2 | Cheap coverage win, recall table completeness |
| 4 | [T1] | Next SOURCES patterns: GM-11 guarded-target/deflection (ties R17/R18/DS1) · GM-13 calibrated eval-vocabulary audit (SOURCES.md, backlog 2/6; GM-10 proven 2026-06-12q) | S2 | Two mined book patterns to proven |
| 5 | [T1] | U5 geometry & wrong-trigger audit — facts firing on coincidental (non-causal) cases (e.g. pz-fork-miss's `abandons_square` whose Qe3 wins nothing — now demoted from the lead, but should it fire at all?) | S2 | Feeds GROUNDED; precision fixtures per fix |
| 6 | [SYS] | recall.test.ts metrics dedupe — appends a near-identical snapshot to self-improvement/improve/metrics.json on EVERY `vitest run` (bit again 2026-06-12r: reverted by hand during PROVE) — skip write when identical to last | S3 | Stops state-file bloat |
| 7 | [T2] | Explorer book-depth: verify lichess masters endpoint in a real browser (sandbox proxy blocked it, 2026-06-12i; re-confirmed 2026-06-12s — headless-chromium smoke saw explorer.lichess.ovh 401 while api.chess.com worked fine, so the proxy blocks lichess.ovh specifically; needs a check on a real user machine) | S3 | One manual check; book accuracy vs chess.com |
| 8 | [T1] | C5 residual + C-phrasing items (self-improvement/improve/TODO.md) | S3 | Phrasing variety |

## Blocked / questions for the user
_(none — items land here with the open question attached)_
