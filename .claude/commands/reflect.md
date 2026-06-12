---
description: Brain hygiene — compress the journal, prune stale files, re-derive priorities
---

Maintenance of the brain itself. **No `src/` changes at all.** Run when
JOURNAL grows past ~300 lines, when priorities feel stale, or roughly weekly.

## Procedure
1. **Compress JOURNAL** (only if > ~300 lines): take the OLDEST half; distill
   anything with lasting value into `docs/LESSONS.md` (anti-pattern form, dated)
   or `docs/knowledge/` (chess knowledge); then DELETE those entries from
   JOURNAL, leaving one line: "Entries before DATE compressed into LESSONS
   (DATE)." History lives in git; the journal is a working set, not an archive.
2. **Prune CLAUDE.md**: delete stale lines, tighten wording, verify pointers
   still resolve. `wc -l CLAUDE.md` must stay ≤ 150. If a rule has been
   superseded by an enforced test/gate, the prose rule can shrink to a pointer.
3. **Spot-check PROJECT_MAP**: pick 3 rows, grep the named exports/constants in
   the code. Any drift → fix the map now; 2+ drifted rows → add a BACKLOG item
   to re-verify the whole map.
4. **Re-derive BACKLOG ranking** from METRICS + ROADMAP: is the top item still
   what the weakest number says it should be? Is the current milestone's exit
   criterion still right? Re-rank, prune items overtaken by events (note why
   in the commit message, not in the file).
5. **Verify the truth instruments**: every METRICS column still measurable by
   the stated command? Every LESSONS rule still true (delete ones now enforced
   by code, note which test enforces them)? `eval/positions.json` cases still
   match `eval/results/latest.json` behavior?
6. **Write**: JOURNAL entry (what was pruned/moved/re-ranked, line counts
   before→after) · commit (`reflect: brain compression + re-rank`) · push · STOP.

**Bounds:** never delete the only record of an unfixed flaw — unresolved
items move to BACKLOG before their journal entry is compressed · LESSONS may
only shrink when a rule is enforced elsewhere (name the enforcement).
