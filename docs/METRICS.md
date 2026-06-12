# METRICS — the numbers that define "better"

No number here may be hand-edited except the Notes column. "Improved" without
a moved number below is a feeling, not a fact (Laws of the Loop).

## Definitions

| Metric | What it measures | Regenerate with |
|---|---|---|
| **Eval CAUSAL** | Comments name the concrete consequence, not just a verdict (0–2/case) | `npm run eval` |
| **Eval GROUNDED** | The stated reason is the engine's reason — never a banned true-but-wrong one (0–2/case) | `npm run eval` |
| **Eval ECONOMY** | Quiet when there's nothing to teach: sentence caps + no complaints on good moves (0–2/case) | `npm run eval` |
| **Tests** | vitest pass count (`231/232` = 231 pass, 1 intentionally skipped: explorer needs network) | `npx vitest run` |
| **Recall avg** | Mean tactical recall across the 8 lichess-puzzle themes (last entry of `improve/metrics.json`; per-theme detail in `improve/TRACKER.md`) | `npx vitest run test/recall.test.ts` |
| **src LOC** | Code-health proxy: total lines in `src/**/*.ts`. The premise of this project is a small deterministic pipeline — eval-score-per-LOC is leverage; unexplained growth is suspect | computed by `npm run eval` |

## How to read the eval

- The truth set is `eval/positions.json` (18 cases: bad moves needing causal
  explanations · good moves deserving ≤1–2 quiet lines · trap cases where a
  true-but-wrong reason is tempting). Per-case detail: `eval/results/latest.json`.
- **Silence is a feature, emptiness is not**: `composeComment` never returns
  empty text by design (R3). ECONOMY scores one-short-line behavior. Never
  "improve" ECONOMY by emitting empty comments — that violates R3 and the gate.
- Aspiration cases (e.g. `opera-09-b5`) are EXPECTED to fail at baseline —
  they encode where we want to go (see each case's `realCause`). A falling
  score on a previously-passing case is a regression; treat it like a red gate.
- Determinism: pool size 1, fixed nodes, sequential cases → identical
  `latest.json` on every run. Changing the CASE LIST can shift borderline
  classifications of OTHER cases (engine hash carries across positions within
  a run) — when adding cases, re-check the whole set, and spec `expectClass`
  tolerantly (the eval judges comments, not verdict tiers).
- Score script: `eval/score.ts`. Flags: `-- --dry` (no writes),
  `-- --explain <id>` (full facts/lines/checks for one case),
  `-- --tests N/M` (record suite pass rate in the history row).

## History (newest on top — the eval row is script-written)

| Date | Causal | Grounded | Economy | Total | Cases | Tests | Recall avg | src LOC |
|---|---|---|---|---|---|---|---|---|
<!-- eval-history -->
| 2026-06-12 | 80.0% | 85.3% | 81.8% | 82.9% | 18 | 231/232 | 94.8% | 5561 |
