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
**Phase 0.1 ✅ 2026-06-30:** paired COVERAGE/PRECISION metric in the eval (baseline
100% / 82.4% — the 82.4% is exactly the 3 fake-reason cases, now measurable).
**Phase 0.2 ✅ 2026-06-30:** first-class `expectSilence` badge-only outcome on EvalCase;
the neutral filler no longer scores ECONOMY 2/2 when silence is the honest call
(`blk-04b-qg5` E2→E1; ECONOMY 100→95.5%, TOTAL 92.1→90.8% on purpose — the aspiration
gap Phase 3's badge state closes; coverage/precision unchanged). **Next block: Phase 0.3**
— make GROUNDED a real signal (kill the free 1/2), then 0.4 author fake-reason cases.

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
