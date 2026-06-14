# Data sources & references

## Ground-truth training/eval data (real, human-validated)

- **Lichess puzzle database** — https://database.lichess.org/#puzzles
  (`lichess_db_puzzle.csv.zst`, ~5M puzzles, CC0). Columns:
  `PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags`.
  Note: `FEN` is the position BEFORE the opponent's setup move; `Moves` is UCI,
  first move is the OPPONENT's, the solution starts at move 2.
  Mirror with API access: https://huggingface.co/datasets/Lichess/chess-puzzles
  (parquet; filterable via https://datasets-server.huggingface.co/filter).
  **Use**: per-theme recall fixtures → `self-improvement/scripts/puzzles/fetch-fixtures.mjs`
  → `self-improvement/test/fixtures/puzzles/*.csv` → `self-improvement/test/recall.test.ts`.
- **Lichess open game DBs** — https://database.lichess.org/ (full games, PGN,
  with [%eval] annotations on many) — future source for classification calibration.

## Style reference (what good commentary sounds like)

- `self-improvement/docs/knowledge/chesscom-templates.md` — verbatim chess.com phrases + triggers.
  Grow by feeding interesting positions/screens, but prefer real data above for detector work.

## Research already digested

- `self-improvement/docs/research/RESEARCH-DIGEST.txt`, `LLM-COMMENTARY-RESEARCH.md`,
  `LAST-RESEARCH-NOTES.md`, `chess-research-papers.md`, PDFs in `last research/`.
- `self-improvement/docs/research/openchess-insights-chess_review.py` — reference Python
  implementation of a review pipeline (detector ideas; our code is TypeScript).

## Specs

- `self-improvement/docs/specs/ANALYSIS-SYSTEM-V2.md` — the implemented V2 system.
- `self-improvement/docs/specs/WHY-EXPLANATION-ENGINE-SPEC.md` — explanation engine spec.
