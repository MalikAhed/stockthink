---
description: Step back and rethink — architecture, scaling, or replacing a core approach. The one mode that reads broadly.
argument-hint: <what feels wrong / what we want to change>
---

You are in **RETHINK MODE**. Concern: $ARGUMENTS

The rare one: something structural feels wrong, we need to scale, or we're replacing a core approach (e.g. hardcoded analysis → a better solution). This is the ONLY mode where reading broadly is correct — the work is cross-cutting.

**Understand deeply first (NO edits yet):**
- All of `CLAUDE.md`, `self-improvement/docs/PROJECT_MAP.md`, ROADMAP, and the relevant `self-improvement/docs/specs/`.
- How the pieces actually connect — trace the real data flow through `backend/src/` and `frontend/src/`; don't assume.
- The constraints that must survive: $0 / client-side / GitHub Pages / no hallucination (R4) / the eval bar.

**Then:**
1. Frame the problem + 2–3 candidate directions. For a wide design space, spin up Plan / parallel agents to weigh approaches independently.
2. For each: concrete trade-offs — what it buys, costs, risks, and breaks. Be honest about uncertainty.
3. Propose a STAGED, reversible migration — small verifiable steps, each ending green on build/tests/eval, behind a rollback tag (like the reorg did).
4. **Get the user's approval before any big change.** Present the plan; don't start rewriting.

This mode plans and proves; it does not rush edits. Anything shipped still follows: branch → gates green → screenshot/approve → commit. Record the decision in `self-improvement/docs/` (a spec or ROADMAP arc) + a `JOURNAL.md` line.
