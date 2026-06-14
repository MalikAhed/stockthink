---
description: Start a UI/UX / frontend session — design + front-end features, via the live browser-MCP loop.
argument-hint: <what to build or improve>
---

You are in **UI MODE**. Goal: $ARGUMENTS

Frontend / interface / UX work. Stay scoped — do NOT load the whole project.

**Read first (only what the goal touches):**
- `CLAUDE.md` → "The UX loop" + the 5 hard rules.
- `frontend/src/main.ts` (app shell + screen wiring), `frontend/src/style.css`, and the specific `frontend/src/ui/*` file(s) for the surface you're changing; `index.html` for that surface's markup.
- `self-improvement/docs/PROJECT_MAP.md` UI rows if unsure where something lives.
- Open a `backend/src/*` module ONLY if the feature needs its data/logic — and read it before calling it.

**The loop:**
1. Branch: `git checkout -b ux/<short-name>`.
2. `npm run dev` in the background (HMR + in-page TS-error overlay).
3. Edit in `frontend/src/`. Always read a file's current code before changing it.
4. SEE it: Chrome DevTools MCP → navigate `http://localhost:5173` → `take_screenshot` + read console.
5. Show the user the screenshot + one-line summary. Iterate on their feedback.
6. Commit ONLY on approval; merge to main when they say go.

**Keep green (this is what proves your new code connects to the rest):** `npm run build` (tsc must pass), `npx vitest run`. Pure UI must not change the eval; if you touched commentary, run `npm run eval` too.

**Database / server feature?** The app is $0 and fully client-side (IndexedDB for cache, no server). If the feature needs a real backend, STOP and flag it — that's an architecture decision → `/rethink`, not a UI change.

End: one line in `self-improvement/docs/JOURNAL.md`.
