---
description: One self-managing improvement loop — 8 steps, one block, evidence required
---

Run ONE loop of the daily ritual. One block per loop — stop when it's done,
even with appetite left. The Laws of the Loop (CLAUDE.md) govern every step.

## 1 · BOOT
Read, in order, NOTHING else: `docs/PROJECT_MAP.md` → top ~30 lines of
`docs/JOURNAL.md` → `docs/BACKLOG.md` → `docs/METRICS.md`.
(CLAUDE.md is already loaded.)

## 2 · ORIENT
Output exactly 5 lines: where the project is (arc + milestone) · the top
BACKLOG item · why it is the highest-leverage thing today, citing a METRICS
number or JOURNAL evidence · the predicted proof · the files you expect to touch.
**Rule:** if anything you read in BOOT contradicts the code, STOP — fixing the
brain file is this loop's block, and it preempts the backlog.

## 3 · TYPE DISPATCH
- Top item tagged **[T1]** → execute `improve/README.md` exactly (its unit
  budget, gates, and bookkeeping apply) as your BUILD+PROVE block, then resume
  at step 7.
- **[T2] / [SYS]** → continue below.

## 4 · PLAN
The smallest valuable block of the top item (an item may take several loops —
fine). Name the exact files. Predict the evidence that will prove success
("eval case X goes 0→2 on CAUSAL", "test N green", "gate prints Y").

## 5 · BUILD
That block only. No drive-by refactors, no new dependencies. Every new flaw
you notice becomes ONE line in BACKLOG.md with a severity — never chased now.

## 6 · PROVE
Run what the change touches: `npx vitest run test/gate.e2e.test.ts` ·
`npx vitest run` · `npm run eval`. Show before vs after numbers.
**No evidence = not done**: say so plainly, journal it as failed, revert
anything left broken. A red gate twice on the same block → revert, journal as
blocked, stop.

## 7 · REVIEW
Re-read the FULL diff as the hostile senior who assumes the worst model wrote
it: R1–R5 intact? Scope creep? Would you approve this PR? Read the gate's
printed comments — a wrong-sounding one is a bug even if assertions pass.
Fix or revert what you find; file the rest in BACKLOG.

## 8 · REFLECT & WRITE
- ONE entry in `docs/JOURNAL.md` (newest on top): date · block · evidence ·
  failures · surprises. A delegated T1 session journals once — here.
- Re-rank `docs/BACKLOG.md`; name tomorrow's top item.
- `docs/PROJECT_MAP.md` if structure changed · `docs/LESSONS.md` only for a
  real burn · `npm run eval -- --tests N/M` if anything metric-relevant moved.

## 9 · UPGRADE — mandatory, never skipped, never doubled
Ship exactly ONE small improvement (≤15 min) to the SYSTEM itself: a new eval
case · a rubric tightening · a stale map row fixed · a sharper CLAUDE.md rule ·
a command wording that caused friction this session · a journal→lesson
distillation. The loop must improve the loop.

## 10 · SHIP
Commit (repo conventions; gate green) and **push** — a session that doesn't
push didn't happen. Tell the user: block done, evidence, what's next. STOP.

**Hard bounds:** one block per loop · needs a user decision → write the
question into BACKLOG "Blocked", skip, stop · never touch `src/ui/`
(walkthrough captions excepted), `src/llm/`, `index.html` unless the block
explicitly says so.
