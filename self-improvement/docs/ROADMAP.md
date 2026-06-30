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

### M3 — Ratchet and guard  (ratchet/expand intent folded into M4 Phase 0)
Eval floor asserted in a vitest suite (same ratchet pattern as recall FLOORS in
self-improvement/test/recall.test.ts) so a falling score blocks a commit like a red gate. Expand
to 25+ cases: STS positional traps (TODO DS2), more trap-wrong-reason cases,
endgame cases. **Exit: red eval = red gate; 25+ cases; runtime still < 60s.**

### M4 — Explain the *why*: honest cause + principled silence  ← WE ARE HERE (chess)
The concrete route to this arc's stated destination (line 7). Plan:
`docs/RESEARCH-explaining-the-why.md` (deep-research, every code claim hand-verified).
Two diseases — **fake reasons** (facts born from geometry, never grounded against the
engine's own line) and **can't stay silent** (abstention only on fact *absence*). Cure:
ground every spoken fact on the engine's relevant PV (Cure A) + a dual-gate
confidence/silence layer that shows a badge instead of inventing a reason (Cure C),
both $0/client-side; surgical counterfactual ablation (Cure B) for the worst cases;
local-LLM phrasing (Cure D) deferred. Six phases (0 methodology → 5 optional);
subsumes BACKLOG #1/#2/#6 and M3's ratchet intent. **Phase 0.1 ✅ 2026-06-30** —
paired COVERAGE/PRECISION metric in the eval (baseline 100% / 82.4%; the 82.4% is the
3 fake-reason cases, now a number). **Exit: PRECISION ≥ ~0.95 at meaningful coverage,
with the badge/silence tier shipped.**

### Beyond (unscheduled)
Type-1 content arcs continue in parallel via self-improvement/improve/ (book chunks B6–B19,
R-list concepts). Candidate next arcs: Spotlight depth round 2 · volatility
gate for positional facts in sharp positions · endgame knowledge.
