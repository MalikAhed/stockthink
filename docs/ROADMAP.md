# ROADMAP

## Current arc: THE SELF-AWARE ARC (started 2026-06-12)

The project can now measure its own explanation quality (`npm run eval`).
Sessions are chosen by evidence, not vibes; every session leaves the brain
(CLAUDE.md + docs/) truer and leaner. Where we're going: an explanation engine
that teaches why bad moves are bad, stays quiet otherwise, and never says
anything the engine line doesn't support — wrapped in a system that improves
itself every single session.

## Milestones

### M1 — Eval v1 baseline ✅ 2026-06-12
18 engine-verified cases (gate games, lichess puzzles, crafted traps including
the rook open-file-vs-mate-threat case and the Légal queen-grab trap), scored
deterministically. Baseline: CAUSAL 80.0 · GROUNDED 85.3 · ECONOMY 81.8 ·
TOTAL 82.9%. Exit met: `npm run eval` byte-identical across runs, row in METRICS.md.

### M2 — Eval-driven explanation fixes  ← WE ARE HERE
Each /work loop takes the worst eval failure cluster and fixes the underlying
detector/composer cause. Known baseline gaps (see BACKLOG #1):
why-bad regression platitudes (b5 case) · praise stacking on good moves ·
secondary positional platitudes riding along · lead-priority on missed tactics.
**Exit: TOTAL ≥ 90% with zero regressions on previously-passing cases.**

### M3 — Ratchet and guard
Eval floor asserted in a vitest suite (same ratchet pattern as recall FLOORS in
test/recall.test.ts) so a falling score blocks a commit like a red gate. Expand
to 25+ cases: STS positional traps (TODO DS2), more trap-wrong-reason cases,
endgame cases. **Exit: red eval = red gate; 25+ cases; runtime still < 60s.**

### Beyond (unscheduled)
Type-1 content arcs continue in parallel via improve/ (book chunks B6–B19,
R-list concepts). Candidate next arcs: Spotlight depth round 2 · volatility
gate for positional facts in sharp positions · endgame knowledge.
