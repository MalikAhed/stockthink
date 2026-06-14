# StockThink Docs

Everything that isn't code lives here. Quick map:

## The brain (the self-managing system — see CLAUDE.md)

| Path | What it is | Read it when… |
|---|---|---|
| `PROJECT_MAP.md` | Codebase index: every module + "to change X, edit here" | Looking for where anything lives |
| `ROADMAP.md` | Current arc + next 3 milestones | Orienting a session |
| `BACKLOG.md` | MASTER ranked backlog (coarse; top item = next /work) | Choosing what to do |
| `JOURNAL.md` | One entry per session, newest on top — THE single journal | Every session boot |
| `LESSONS.md` | Distilled anti-patterns from real mistakes | Before repeating history |
| `METRICS.md` | The numbers that define "better" + dated history | Judging whether work helped |

## Reference shelf (read per-item, never wholesale)

| Path | What it is | Read it when… |
|---|---|---|
| `specs/ANALYSIS-SYSTEM-V2.md` | The V2 analysis-system design (facts pipeline, classification ladder, Mode A/B) | Touching the pipeline architecture |
| `specs/WHY-EXPLANATION-ENGINE-SPEC.md` | The full spec for the WHY commentary engine (detector toolbox, refutation walk, priority ladder, string bank, acceptance tests) | Touching `backend/src/concepts/`, `backend/src/compose/`, or commentary behavior |
| `knowledge/concept-taxonomy.md` | Full concept matrix (what we detect vs. what chess.com says) | Planning new detectors |
| `knowledge/chesscom-templates.md` | Verbatim target phrasing library (append-only) | Writing/editing templates |
| `knowledge/sources.md` | Ground-truth sources (lichess puzzle DB etc.) | Building fixtures/datasets |
| `research/RESEARCH-DIGEST.txt` | Condensed, verified research findings: classification formulas, freechess/wintrchess/Chesskit algorithms, verifier corrections | Touching classification, accuracy, brilliancy/great detection |
| `research/LAST-RESEARCH-NOTES.md` | Actionable notes from the five V2-design papers (CCC, MoM, …) | Re-checking a design decision's rationale |
| `research/LLM-COMMENTARY-RESEARCH.md` | Why LLMs must only *reword* facts, never analyze the board; rationale for the 3-transport AI commentary design | Touching `backend/src/llm/` or the Deep Review panel |
| `research/chess-research-papers.md` | Bibliography of academic papers used (node budgets, eval noise, volatility) | Citing or re-checking a paper claim |
| `prototype/stockthink-trial.html` | "Chess Lens" — the user's original single-file prototype. Defines the design language (palette, layout, classification colors, commentary-JSON format) | Doing UI/design work — the look is pinned to this file |

Removed during the 2026-06-12 cleanup (recoverable from git history): the five
arXiv PDFs behind `LAST-RESEARCH-NOTES.md`, `research-full.json` (raw data
behind the digest), and `openchess-insights-chess_review.py` (external
reference code — its useful algorithms live in `backend/src/concepts/positional.ts`).
