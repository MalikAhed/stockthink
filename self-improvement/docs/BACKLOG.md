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
**◄ RESUME HERE (next /chess session):** pick ONE —
  **(a) Phase 3.3/3.4** — consume `confidence`: add a first-class badge-only `Comment` and route
  Gate-2 failures (high volatilityCp / lateFlip / small topSpreadCp / high drawPermille + no grounded
  cause) to it, replacing the position-blind NEUTRAL pool. RISKY behaviour change with NO current eval
  case to prove a gain (coinc-pin-be5 already solved, blk-04b already silent) → use conservative
  thresholds and re-read EVERY gate.e2e comment (must not mute delivers_mate / Qb8+ sac).
  **(b) BACKLOG #2 fork-priority** — but pz-fork-miss-000Pw is hash-borderline (clean isolated, C1/G0 in
  the full run); needs a non-borderline crafted case first (LESSONS: crafted FENs burn).
  **(c) BACKLOG #1 content** — name the Nxb5 sac (opera-09-b5) — this is [T1], runs via the improve workshop.
§5a everywhere; re-run gate.e2e after every block. 0.4's 2–3 fake-reason cases stay open — deferred.

| # | Tag | Item | Sev | Payoff / evidence |
|---|---|---|---|---|
| 1 | [T1] | **U2 deeper why-bad explanations** (self-improvement/improve/TODO.md TONIGHT block) — PV-based punishment narration; absorbs the last eval-v1 cluster: bad moves lead with regression platitudes instead of the concrete punishment (`opera-09-b5` C0/G1: says "falls behind in development", real cause Nxb5!; `blk-04-nxe5` C1/G1: regression lead buries the missed Nxd4) | S1 | CAUSAL 80.0% is now the weakest dimension by 11+ pts (G 91.2 · E 100.0, 2026-06-12r) |
| 2 | [T2] | Lead-fact priority for huge missed tactics — `pz-fork-miss-000Pw` C1: abandons_square (prio 3.5) outranks missed_fork (prio 7), so a minor walks-away story buries a missed royal fork worth ~8 win-tiers | S2 | GROUNDED; one PRIORITY-map decision in facts.ts + fixture |
| 3 | [T2] | Eval M3: floor ratchet as a vitest suite + expand to 25+ cases (STS positional traps, DS2) — promoted: M2 exit met at 90.8%, lock the gains before further churn | S2 | Red eval blocks commits like a red gate |
| 4 | [T1] | D4 skewer wiring — `isSkewer` primitive already proves 100% line-recall (TODO R19); needs fact kind + template + annotate hookup | S2 | Cheap coverage win, recall table completeness |
| 5 | [T1] | Next SOURCES patterns: GM-11 guarded-target/deflection (ties R17/R18/DS1) · GM-13 calibrated eval-vocabulary audit (SOURCES.md, backlog 2/6; GM-10 proven 2026-06-12q) | S2 | Two mined book patterns to proven |
| 6 | [T1] | U5 geometry & wrong-trigger audit — facts firing on coincidental (non-causal) cases | S2 | Feeds GROUNDED; precision fixtures per fix |
| 7 | [SYS] | recall.test.ts metrics dedupe — appends a near-identical snapshot to self-improvement/improve/metrics.json on EVERY `vitest run` (bit again 2026-06-12r: reverted by hand during PROVE) — skip write when identical to last | S3 | Stops state-file bloat |
| 8 | [T2] | Explorer book-depth: verify lichess masters endpoint in a real browser (sandbox proxy blocked it, 2026-06-12i; re-confirmed 2026-06-12s — headless-chromium smoke saw explorer.lichess.ovh 401 while api.chess.com worked fine, so the proxy blocks lichess.ovh specifically; needs a check on a real user machine) | S3 | One manual check; book accuracy vs chess.com |
| 9 | [T1] | C5 residual + C-phrasing items (self-improvement/improve/TODO.md) | S3 | Phrasing variety |

## Blocked / questions for the user
_(none — items land here with the open question attached)_
