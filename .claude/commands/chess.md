---
description: Start a chess-analysis / explanation-engine session — improve the backend logic the eval measures.
argument-hint: <concept, detector, or explanation to improve>
---

You are in **CHESS MODE**. Goal: $ARGUMENTS

Backend / analysis / explanation-quality work — the engine that turns positions into comments. The eval is your judge.

**Read first (only the slice you're changing):**
- `CLAUDE.md` → the 5 hard rules (R1–R5) + "Pipeline in one breath".
- `self-improvement/docs/PROJECT_MAP.md` → the "To change X, edit here" table; go straight to the right file.
- The specific `backend/src/{concepts,compose,analysis}/*` file(s) and their test in `self-improvement/test/`; the covering cases in `self-improvement/eval/positions.json`.

**Which kind of work?**
- **New chess content** (concept / tactic / pattern / phrasing): run the **improve-analysis** skill — it executes `self-improvement/improve/README.md` exactly (bounded: 3–5 units, one commit per item). The protocol's limits are contractual; don't freelance.
- **Tuning the brain** (when to speak, grounding, anti-spam) or a detector/template fix: edit the file, add/extend a fixture, measure.

**Keep green (this proves the change connects AND improves, not regresses):**
- `npx vitest run self-improvement/test/gate.e2e.test.ts` — READ every printed comment; a wrong-sounding one is a bug even if it passes.
- `npm run eval` — the score must NOT fall on previously-passing cases (falling = regression; fix before commit).
- `npx vitest run` — full suite green.

Branch the work; commit when gates are green and the comments read true. End: one line in `self-improvement/docs/JOURNAL.md`.
