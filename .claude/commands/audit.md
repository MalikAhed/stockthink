---
description: Deep hostile review of ONE subsystem → evidenced findings → BACKLOG
argument-hint: "[subsystem: concepts | compose | classify | engine | eval | spotlight | brain]"
---

Audit **$ARGUMENTS** (if empty: pick the subsystem implicated by the weakest
METRICS dimension and say why). One subsystem per invocation. This is a
READ-and-WRITE-BRAIN ritual: **no `src/` edits** — findings become work items,
not hotfixes.

## Procedure
1. **Scope** from `self-improvement/docs/PROJECT_MAP.md`: list the subsystem's files; read every
   one of them FULLY (this is the one ritual where reading whole files is the job).
2. **Hostile checklist** — assume the worst model wrote it:
   - Could this ever say something FALSE to a user? (R1–R5 risk paths,
     unverified claims, template slots filled with the wrong piece/square)
   - Facts firing on coincidence — geometrically true, causally irrelevant
     (the eval's trap cases are the canary; could more slip through?)
   - Doc-vs-code drift: constants, thresholds, names vs what PROJECT_MAP /
     comments / SOURCES.md claim (read the constant — LESSONS).
   - Dead code, unwired exports, duplicated logic.
   - Untested branches: which paths have no fixture? Which fixtures are
     weaker than they look (line-wide credit, tolerant asserts)?
   - Gameable metrics: could a future session "improve" a number without
     improving the thing it measures?
3. **Rank findings** by severity (S1 blocks quality / S2 visible flaw /
   S3 hygiene). Every finding carries `file:line` evidence — a finding without
   evidence does not get written.
4. **Write:**
   - BACKLOG.md: one line per finding, severity-tagged, slotted into the ranking.
   - JOURNAL.md: one entry — subsystem, files read, finding count by severity,
     the single worst thing found.
   - PROJECT_MAP.md: correct any drift found (that part is fixed now, not filed).
   - LESSONS.md: only if a finding reveals a repeatable anti-pattern.
5. Commit the brain updates (`audit(<subsystem>): findings → backlog`), push, STOP.

**Bounds:** one subsystem · no src edits · if the audit surfaces something
actively lying to users RIGHT NOW (S1, live), stop and tell the user instead
of silently filing it.
