# BACKLOG — master ranked queue

Rules: the TOP item is what /work does next. Coarse-grained only — [T1] items
are umbrellas; their fine-grained order lives in `improve/TODO.md` +
`improve/SOURCES.md` (never duplicate items here). Re-rank in /work step 7.
Tags: [T1] chess content (runs via improve/ protocol) · [T2] explanation
brain / eval · [SYS] system & tooling. Severity: S1 blocks quality · S2
visible flaw · S3 hygiene.

| # | Tag | Item | Sev | Payoff / evidence |
|---|---|---|---|---|
| 1 | [T2] | **Fix the worst eval-v1 failures** — three measured gaps: (a) bad moves lead with regression platitudes instead of the concrete punishment (`opera-09-b5` C0: says "falls behind in development", real cause is Nxb5!; converges with TODO U2); (b) praise stacking on good moves (`pz-trap-009FP`, `trap-rook-file-kick` E0: only_move + fact + quiet_strength = 3–4 sentences); (c) secondary positional platitudes ride along when a concrete reason already carries the comment (`trap-rook-file-kick` G0: "open f-file, natural highway" after the mate threat) | S1 | Directly moves CAUSAL 80→90+, ECONOMY 82→95+; the numbers ARE the definition of better |
| 2 | [T2] | Lead-fact priority for huge missed tactics — `pz-fork-miss-000Pw` C1: abandons_square (prio 3.5) outranks missed_fork (prio 7), so a minor walks-away story buries a missed royal fork worth ~8 win-tiers | S2 | GROUNDED; one PRIORITY-map decision in facts.ts + fixture |
| 3 | [T1] | U2 deeper why-bad explanations (improve/TODO.md TONIGHT block) — PV-based punishment narration | S1 | Feeds gap (a); the why-bad side is measurably weaker than why-good |
| 4 | [T1] | D4 skewer wiring — `isSkewer` primitive already proves 100% line-recall (TODO R19); needs fact kind + template + annotate hookup | S2 | Cheap coverage win, recall table completeness |
| 5 | [T1] | GM-10 strike-now pawn break + GM-11 guarded-target PATTERN units (SOURCES.md, backlog 2/6) | S2 | Two mined book patterns to proven; GM-11 ties into R17/R18/DS1 deflection family |
| 6 | [T1] | U5 geometry & wrong-trigger audit — facts firing on coincidental (non-causal) cases | S2 | Feeds GROUNDED; precision fixtures per fix |
| 7 | [T2] | Eval M3: floor ratchet as a vitest suite + expand to 25+ cases (STS positional traps, DS2) | S2 | Red eval blocks commits like a red gate |
| 8 | [SYS] | recall.test.ts metrics dedupe — appends a near-identical snapshot to improve/metrics.json on EVERY `vitest run` (verified: ~20 duplicate entries) — skip write when identical to last | S3 | Stops state-file bloat |
| 9 | [T2] | Explorer book-depth: verify lichess masters endpoint in a real browser (sandbox proxy blocked it, 2026-06-12i) | S3 | One manual check; book accuracy vs chess.com |
| 10 | [T1] | C5 residual + C-phrasing items (improve/TODO.md) | S3 | Phrasing variety |

## Blocked / questions for the user
_(none — items land here with the open question attached)_
