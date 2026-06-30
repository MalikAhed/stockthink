# METRICS — the numbers that define "better"

No number here may be hand-edited except the Notes column. "Improved" without
a moved number below is a feeling, not a fact (Laws of the Loop).

## Definitions

| Metric | What it measures | Regenerate with |
|---|---|---|
| **Eval CAUSAL** | Comments name the concrete consequence, not just a verdict (0–2/case) | `npm run eval` |
| **Eval GROUNDED** | The stated reason is the engine's reason — never a banned true-but-wrong one (0–2/case) | `npm run eval` |
| **Eval ECONOMY** | Quiet when there's nothing to teach: sentence caps + no complaints on good moves (0–2/case). On an `expectSilence` (badge-only) case the honest output is the badge alone — a neutral filler caps at 1, a voiced cause scores 0, until the badge state ships (Phase 3) | `npm run eval` |
| **Eval COVERAGE** | Of moves above the inaccuracy floor, the share given a concrete causal explanation rather than a soft "X was stronger"/neutral abstention (set-level) | `npm run eval` |
| **Eval PRECISION** | Of comments that voice a concrete cause, the share whose lead reason is the right, grounded, non-forbidden one (set-level — the honesty axis) | `npm run eval` |
| **Tests** | vitest pass count (`231/232` = 231 pass, 1 intentionally skipped: explorer needs network) | `npx vitest run` |
| **Recall avg** | Mean tactical recall across the 8 lichess-puzzle themes (last entry of `self-improvement/improve/metrics.json`; per-theme detail in `self-improvement/improve/TRACKER.md`) | `npx vitest run self-improvement/test/recall.test.ts` |
| **src LOC** | Code-health proxy: total lines in `src/**/*.ts`. The premise of this project is a small deterministic pipeline — eval-score-per-LOC is leverage; unexplained growth is suspect | computed by `npm run eval` |

## How to read the eval

- The truth set is `self-improvement/eval/positions.json` (18 cases: bad moves needing causal
  explanations · good moves deserving ≤1–2 quiet lines · trap cases where a
  true-but-wrong reason is tempting). Per-case detail: `self-improvement/eval/results/latest.json`.
- **Silence is a feature, emptiness is not**: `composeComment` never returns
  empty text by design (R3). ECONOMY scores one-short-line behavior. Never
  "improve" ECONOMY by emitting empty comments — that violates R3 and the gate.
- Aspiration cases (e.g. `opera-09-b5`, and `blk-04b-qg5` since Phase 0.2) are
  EXPECTED to fail at baseline — they encode where we want to go (see each case's
  `realCause`). A falling score caused by a CODE change is a regression; treat it
  like a red gate. A falling score caused by a DELIBERATE rubric-tightening — the
  metric learning to see a flaw it was blind to — is the opposite, and must be
  recorded in the JOURNAL for that session so the two are never confused.
- `expectSilence` cases are the badge-only tier (§6 of the research doc): the honest
  output is the badge alone, so today's neutral filler over-speaks and caps ECONOMY at
  1. Phase 0.2 re-marked `blk-04b-qg5`, dropping ECONOMY 100.0→95.5% and TOTAL
  92.1→90.8% on purpose — the gap Phase 3's badge state closes. (Coverage/precision
  are unchanged: a non-emitting filler was already honest abstention.)
- Determinism: pool size 1, fixed nodes, sequential cases → identical
  `latest.json` on every run. Changing the CASE LIST can shift borderline
  classifications of OTHER cases (engine hash carries across positions within
  a run) — when adding cases, re-check the whole set, and spec `expectClass`
  tolerantly (the eval judges comments, not verdict tiers).
- Score script: `self-improvement/eval/score.ts`. Flags: `-- --dry` (no writes),
  `-- --explain <id>` (full facts/lines/checks for one case),
  `-- --tests N/M` (record suite pass rate in the history row).

## History (newest on top — the eval row is script-written)

| Date | Causal | Grounded | Economy | Total | Cases | Tests | Recall avg | src LOC |
|---|---|---|---|---|---|---|---|---|
<!-- eval-history -->
| 2026-06-30 | 85.0% | 91.2% | 95.5% | 90.8% | 18 | 249/250 | 94.8% | 6831 |
| 2026-06-30 | 85.0% | 91.2% | 100.0% | 92.1% | 18 | 249/250 | 94.8% | 6831 |
| 2026-06-14 | 85.0% | 91.2% | 100.0% | 92.1% | 18 | — | 94.8% | 6831 |
| 2026-06-12 | 80.0% | 91.2% | 100.0% | 90.8% | 18 | 233/234 | 94.8% | 5624 |
| 2026-06-12 | 80.0% | 85.3% | 81.8% | 82.9% | 18 | 231/232 | 94.8% | 5561 |

## Selective prediction — coverage vs precision (the honesty axis)

Opened 2026-06-30 with the explain-the-why arc (`docs/RESEARCH-explaining-the-why.md`).
That arc optimizes a **reject-option** tradeoff, NOT raw coverage: speak only when a
cause is grounded ∧ dominant ∧ stable, else fall to a badge. So the target is
**PRECISION → 1.0, accepting whatever COVERAGE that implies** — a *falling* coverage
paired with a *rising* precision is the intended direction here, not a regression.

There is no badge/silence state yet (Phases 2–3 build it), so at baseline coverage is
near-total and precision is the number that exposes the fake reasons the arc exists to kill.

- **COVERAGE** = (above-inaccuracy moves that voice a concrete cause) / (above-inaccuracy moves)
- **PRECISION** = (voiced causes that are right & grounded) / (voiced causes)

Exact, from `score.ts` (derived from the same per-case checks — no new behaviour):
- *above-inaccuracy* = classification ∈ {inaccuracy, mistake, blunder, miss}
- *voiced a concrete cause* = a fact's rendered sentence leads the visible text; a bare
  "X was stronger"/neutral pool line does NOT count — that is honest abstention
- *right & grounded* = led by the expected fact (`leadFactIn`), grounded in the expected
  facts, in an expected class tier, and free of the case's forbidden wrong-reason

| Date | Coverage | Precision | Cases | Notes |
|---|---|---|---|---|
<!-- selective-history -->
| 2026-06-30 | 100.0% | 82.4% | 18 | |
| 2026-06-30 | 100.0% | 82.4% | 18 | |

