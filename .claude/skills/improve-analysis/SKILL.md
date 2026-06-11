---
name: improve-analysis
description: Run one bounded daily improvement session on the StockThink analysis engine — pick items from the backlog, implement, test against ground truth, measure, journal, commit, STOP. Use when the user says "improve analysis", "train", "daily improvement", or similar.
---

# Daily improvement session

You are running ONE bounded session. The goal is steady daily progress, not a
marathon. Everything you need is in three files — read them first, in order:

1. `docs/improve/BACKLOG.md` — what to do (take items top-down, P0 first)
2. `docs/improve/journal/` — read the most recent entry (where we left off)
3. `docs/knowledge/concept-taxonomy.md` — the concept matrix you'll update

Reference material (consult as needed, don't re-read wholesale):
- `docs/knowledge/chesscom-templates.md` — target phrasing + trigger conditions
- `docs/knowledge/sources.md` — data sources (lichess puzzles etc.)
- `CLAUDE.md` — the five hard rules R1–R5 and project map

## Session budget — HARD LIMITS

- **Max 5 work units** per session. 1 unit = one backlog detector/composer item,
  OR one infra item, OR triaging+fixing up to 10 recall-test failures for one
  theme. A big item (new detector + templates + tests) may count as 2 units —
  judge honestly.
- **Stop immediately** when any of these hits:
  - 5 units done
  - the gate (`npx vitest run test/gate.e2e.test.ts`) fails twice on the same
    item → revert that item, journal it as blocked, move on or stop
  - an item needs a design decision the backlog doesn't answer → journal the
    question for the user, skip the item
- Default scope per day when the user gives no number: **3 units**. If the user
  says "learn 10 puzzles" or similar, interpret as: triage 10 recall failures.
- NO refactors outside the item's scope. NO new dependencies. NO touching
  `src/llm/` or UI unless the item says so.

## Per-item procedure (repeat per unit)

1. Pick the topmost unchecked item that's unblocked.
2. Implement minimally: detector in `src/concepts/`, fact kind + priority in
   `facts.ts`, template in `src/compose/templates.ts`, wiring in `annotate.ts`.
3. Tests: unit tests next to existing patterns in `test/`; if fixtures exist
   for the theme, run `npx vitest run test/recall.test.ts`.
4. Quality gate: `npx vitest run test/gate.e2e.test.ts` must pass (real engine,
   ~20s). The five rules R1–R5 are non-negotiable.
5. Bookkeeping IN THE SAME COMMIT:
   - check the item off in `BACKLOG.md` (move to Done with date)
   - flip the row in `concept-taxonomy.md`
   - if a chess.com template from `chesscom-templates.md` is now covered,
     update its status there
6. Commit: `improve(<id>): <title>` — one commit per item.

## End-of-session procedure (ALWAYS, even if 0 units finished)

1. Run the full suite once: `npx vitest run`.
2. Update `docs/improve/METRICS.md` history table (coverage + any recall numbers).
3. Write `docs/improve/journal/<today>.md`: done / insights / blocked /
   next-session pointer. Keep it under 30 lines.
4. If new gaps were discovered during work, append ≤5 new backlog items (don't
   let the backlog balloon).
5. Commit bookkeeping, then `git push` (Pages auto-deploys main).
6. Report to the user: units done, recall/coverage deltas, what's next. STOP.

## Data discipline

- Ground truth = lichess puzzle fixtures (`test/fixtures/puzzles/`). They are
  positives-only → they measure recall. Precision is guarded by the gate game
  comments — read them when the gate prints them; if a comment sounds wrong,
  that's a bug even if assertions pass.
- Never invent training examples. New phrasing must come from the template
  library or be clearly principled; new detectors must be validated on fixtures
  or hand-built FEN unit tests.
- When fed new chess.com material by the user, append to
  `chesscom-templates.md` (append-only) and diff against the taxonomy.
