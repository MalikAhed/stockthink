# StockThink Docs

Everything that isn't code lives here. Quick map:

| Path | What it is | Read it when… |
|---|---|---|
| `specs/WHY-EXPLANATION-ENGINE-SPEC.md` | The full spec for the WHY commentary engine (detector toolbox, refutation walk, priority ladder, string bank, acceptance tests) | Touching anything in `src/explain/` or commentary behavior |
| `research/RESEARCH-DIGEST.txt` | Condensed, verified research findings: classification formulas, freechess/wintrchess/Chesskit algorithms, verifier corrections | Touching classification, accuracy, brilliancy/great detection |
| `research/research-full.json` | Raw research data behind the digest | The digest isn't detailed enough |
| `research/LLM-COMMENTARY-RESEARCH.md` | Why LLMs must only *reword* facts, never analyze the board; rationale for the 3-tier AI commentary design | Touching `src/llm/` or the AI panel |
| `research/chess-research-papers.md` | Bibliography of academic papers used (node budgets, eval noise, volatility) | Citing or re-checking a paper claim |
| `prototype/stockthink-trial.html` | "Chess Lens" — the user's original single-file prototype. Defines the design language (palette, layout, classification colors, commentary-JSON format) | Doing UI/design work — the look is pinned to this file |
