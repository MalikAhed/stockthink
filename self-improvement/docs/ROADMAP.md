# ROADMAP

## Current arc: THE SELF-AWARE ARC (started 2026-06-12)

The project can now measure its own explanation quality (`npm run eval`).
Sessions are chosen by evidence, not vibes; every session leaves the brain
(CLAUDE.md + self-improvement/docs/) truer and leaner. Where we're going: an explanation engine
that teaches why bad moves are bad, stays quiet otherwise, and never says
anything the engine line doesn't support — wrapped in a system that improves
itself every single session.

## Parallel arc: THE UX ARC (started 2026-06-14)
The repo was reorganized into three zones (`frontend/` · `backend/` ·
`self-improvement/`) and a live design workflow was wired up: `npm run dev` + the
Chrome DevTools / Playwright MCPs let a session SEE the page, iterate, and commit
only on the user's approval (CLAUDE.md → "The UX loop"). With that in place,
interface/UX redesign is back in scope — the old "UI is frozen" rule is retired.
Direction: the homepage moves toward an AI-generated-video hero; design references
live in `~/stockthink-design-archive/` (user hands over the script).

### UX-M1 — foundation ✅ 2026-06-14
3-zone reorg (no behaviour change: build green, 246 tests, eval TOTAL 90.8%),
`@frontend`/`@backend` aliases, `.mcp.json` browser MCPs, `vite-plugin-checker`
overlay, `release.yml` + CHANGELOG. **Exit met.**

### UX-M2 — first redesign pass  ← NEXT
One surface redesigned end-to-end in the new loop (home hero the likely first),
screenshot-approved by the user. **Exit: a merged UI change shipped via the loop.**

## Milestones

### M1 — Eval v1 baseline ✅ 2026-06-12
18 engine-verified cases (gate games, lichess puzzles, crafted traps including
the rook open-file-vs-mate-threat case and the Légal queen-grab trap), scored
deterministically. Baseline: CAUSAL 80.0 · GROUNDED 85.3 · ECONOMY 81.8 ·
TOTAL 82.9%. Exit met: `npm run eval` byte-identical across runs, row in METRICS.md.

### M2 — Eval-driven explanation fixes ✅ 2026-06-12
Each /work loop takes the worst eval failure cluster and fixes the underlying
detector/composer cause. Known baseline gaps (see BACKLOG #1):
why-bad regression platitudes (b5 case) · praise stacking on good moves ·
secondary positional platitudes riding along · lead-priority on missed tactics.
**Exit met 2026-06-12: TOTAL 90.8% (E 100.0 · G 91.2 · C 80.0), zero
regressions.** The two CAUSAL-side gaps (b5 punishment narration,
lead-priority) carry on as BACKLOG #1–2 — the exit bar, not the gap list,
defined done.

### M3 — Ratchet and guard  ← WE ARE HERE
Eval floor asserted in a vitest suite (same ratchet pattern as recall FLOORS in
self-improvement/test/recall.test.ts) so a falling score blocks a commit like a red gate. Expand
to 25+ cases: STS positional traps (TODO DS2), more trap-wrong-reason cases,
endgame cases. **Exit: red eval = red gate; 25+ cases; runtime still < 60s.**

### Beyond (unscheduled)
Type-1 content arcs continue in parallel via self-improvement/improve/ (book chunks B6–B19,
R-list concepts). Candidate next arcs: Spotlight depth round 2 · volatility
gate for positional facts in sharp positions · endgame knowledge.
