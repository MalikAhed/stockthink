# Improvement Workshop — START HERE

This folder is the ONLY place a daily improvement session needs to start from.
You are improving ONE thing: the quality of move explanations. The UI/UX is
done — do not touch it.

**This folder has exactly 4 files:**
- `README.md` — this protocol (how to work)
- `TODO.md` — engineering queue (pick top-down)
- `SOURCES.md` — pattern-mining queue (workflow v3: books/CPW/puzzles → patterns)
- `TRACKER.md` — coverage snapshot + daily log (update before you stop)

## Session protocol — follow exactly

### 1. Orient (2 minutes, don't read more than this)
1. Read `TRACKER.md` — last 3 daily-log entries + the coverage snapshot.
2. Pick units. A session mixes three unit types, top-down within each queue:
   - **BUILD** — topmost unchecked, unblocked item in `TODO.md`
   - **MINE** — next chunk in `SOURCES.md` (read one bounded source chunk,
     extract ≤3 pattern candidates in our own words — no code)
   - **PATTERN** — topmost `mined` item in `SOURCES.md` → take it to `proven`
     (detector + confirm-gate + GM-voiced template + fires/stays-silent
     fixtures). Counts as 2 units. **The v3 contract: the source gives the
     pattern, Stockfish must confirm it in the position before we voice it.**
   Default mix when nothing is urgent: 1 MINE + 1 PATTERN, or 3 BUILD.
3. Only if your item needs it, consult the reference shelf (don't browse it):
   - `../docs/knowledge/chesscom-templates.md` — target phrasing + triggers
   - `../docs/knowledge/concept-taxonomy.md` — full concept matrix
   - `../docs/knowledge/sources.md` — data sources (lichess puzzles)
   - the chessprogramming.org link on the TODO item itself (WebFetch it)

### 2. Budget — HARD LIMITS
- Default **3 work units**, max **5**. 1 unit = one TODO item, or triaging up
  to 10 recall-test failures for one theme. A big detector (+templates +tests)
  counts as 2 — judge honestly.
- Stop immediately when: budget spent · OR the gate fails twice on the same
  item (revert it, log as blocked) · OR an item needs a user decision (log the
  question, skip the item).
- No refactors outside the item. No new dependencies. Never touch `src/ui/`,
  `src/llm/`, `index.html`, or `src/style.css`.

### 3. Per-item procedure
1. Implement minimally. Where things go (the only 4 code files you normally edit):
   - detector → `src/concepts/detectors.ts` or `positional.ts`
   - fact kind + priority → `src/concepts/facts.ts`
   - sentence template → `src/compose/templates.ts`
   - wiring → `src/concepts/annotate.ts`
2. Unit tests in `test/` (copy existing patterns; hand-built FENs or puzzle
   fixtures — never invented-from-memory positions without verifying legality).
3. Quality gate MUST pass: `npx vitest run test/gate.e2e.test.ts` (~20s, real
   engine). Read the printed comments — if one sounds wrong, that's a bug even
   if assertions pass.
4. The five hard rules are non-negotiable: no eval numbers in prose · no PV
   dumps in prose · no empty-handed fallback · every claim machine-verified ·
   cause before verdict.
5. Same commit: check the item off in `TODO.md` (move to Done, add date).
6. Commit: `improve(<id>): <title>` — one commit per item.

### 4. End of session — ALWAYS, even after 0 finished units
1. `npx vitest run` (full suite) must be green.
2. Update `TRACKER.md`:
   - flip any concept rows in the coverage snapshot you changed
   - append ONE daily-log entry, 1–3 lines MAX (date · units · what · next)
3. If you discovered new gaps, add ≤5 items to `TODO.md` — never let it balloon.
4. Commit bookkeeping, then **`git push`** — GitHub Pages auto-deploys main.
   A session that doesn't push didn't happen. (If push fails with HTTP2/host
   errors: `git config http.version HTTP/1.1`, auth via
   `-c credential.helper='!~/bin/gh auth git-credential'`, retry.)
5. Tell the user: units done, what improved, what's next. STOP.

## Model notes
Any Claude model runs this. If an item is tagged `[hard]` and you are not the
strongest available model, skip it without spending units and note it in the
log — `[hard]` items are for designated sessions. When in doubt about chess
correctness, trust the tests and fixtures over your own board visualization.
