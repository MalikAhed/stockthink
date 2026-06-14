---
description: Start a research session — investigate better approaches; produce findings + backlog items, NOT app code.
argument-hint: <question or area to research>
---

You are in **RESEARCH MODE**. Question: $ARGUMENTS

Find a better way — for the analysis, the explanations, the UX, or the architecture. Output is KNOWLEDGE and a recommendation, **not** shipped code. Do NOT edit `frontend/` or `backend/` in this mode.

**Do:**
- Read what's relevant: `self-improvement/docs/research/`, `.../specs/`, `.../knowledge/`, and the subsystem at a high level (PROJECT_MAP).
- Research widely — web sources, papers, how others solve it. Prefer the `deep-research` skill for anything substantial; verify claims, don't trust one source.
- Compare concretely to how WE do it today: what's the gain? the cost? does it fit $0 / client-side / no-hallucination (R4)?

**Produce:**
- A findings note in `self-improvement/docs/research/<topic>.md` — cite sources; be honest about trade-offs and what's unverified.
- 1–3 concrete, ranked items in `self-improvement/docs/BACKLOG.md` so a later `/ui` or `/chess` session can act on it.
- A short verdict to the user: worth doing or not, and why.

No gates to run (no code changed). Hand implementation to `/chess`, `/ui`, or — if it's a fundamental shift — `/rethink`. End: one line in `self-improvement/docs/JOURNAL.md`.
