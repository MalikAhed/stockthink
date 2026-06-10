# StockThink ♟️

**Free chess game review — entirely in your browser.** Paste a PGN (or play a game), get a full chess.com-style analysis: eval bar, move classifications (Brilliant‼ → Blunder⁇), accuracy scores, and clear human-readable commentary for every move — with "explain more" when you want the full idea.

No server. No account. No API keys. No cost. Powered by **Stockfish 18 (NNUE)** running as WebAssembly on your machine.

## How it works

1. **Engine** — Stockfish 18 Lite (7.3 MB WASM, single-threaded, MultiPV 3) analyzes every position of your game in parallel web workers, at **fixed node budgets** (75k/200k/500k per move) so the same game always gets the same review on any device (node-capping is the reproducibility protocol from arXiv:2602.04447).
2. **Win-probability model** — centipawn evals are converted to win% with the lichess sigmoid (`50 + 50·(2/(1+e^(−0.00368208·cp))−1)`); classification uses chess.com's published expected-points-lost ladder, whose bands sit above the engine's measured ~2.5–5 win% self-noise floor (arXiv:2306.09983).
3. **Classifications** — Best / Excellent / Good / Inaccuracy / Mistake / Blunder by win% loss, plus Book (ECO database), Forced, **Brilliant** (sound sacrifice detection), **Great** (critical only-good-moves, measured as a ≥10 win% top-2 gap), and **Miss** (unpunished mistakes). A **volatility gate** (shallow-vs-deep eval divergence >65cp, per arXiv:2412.17948) suppresses positional commentary in tactically sharp positions.
4. **Accuracy** — lichess accuracy curve per move; game accuracy = mean of volatility-weighted and harmonic means. Plus an estimated game rating.
5. **Commentary** — a deterministic WHY engine (refutation walk + verified detectors: SEE, hanging pieces, forks, pins, skewers, discovered attacks, traps, mate threats) extracts *typed facts* from the engine lines; a template engine words them into short, clear sentences. Because every statement is slot-filled from engine-verified facts, the commentary **cannot hallucinate**.
6. **Optional AI rewording** — the chess-LLM literature is unanimous that LLMs must never *analyze* the board (near-chance evaluation accuracy: arXiv:2510.23948) but are excellent at *rewording* supplied facts (+30–45pts with facts in-prompt: arXiv:2411.06655). So StockThink can hand its verified fact sheet to a language layer that only paraphrases: either a one-click **copy-prompt → paste into Claude/ChatGPT → import JSON** exchange (free, every browser), or an opt-in **on-device model** (WebLLM + Qwen, ~0.4 GB one-time download, WebGPU). Every AI sentence is fact-checked against the verified facts on the way in — any hallucinated square or mate claim is rejected and the deterministic template is kept.

## Use it

Live at **https://malikahed.github.io/stockthink/** — paste a PGN from chess.com (Game → Share → PGN) or lichess, pick an engine time, and hit *Analyze game*. Everything runs locally; nothing is uploaded anywhere.

## Development

```bash
npm install
npm run dev      # local dev server
npm test         # unit tests
npm run build    # production build (GitHub Pages base path)
```

## License

GPL-3.0-or-later — required by Stockfish (GPLv3) and chessground (GPL-3.0), and we're happy about it: this project exists because open source made it possible.

Stockfish 18 WASM build © Chess.com LLC, GPLv3, from [nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js).

Optional on-device AI: [WebLLM](https://github.com/mlc-ai/web-llm) (Apache-2.0) running Qwen small instruct models (Apache-2.0), loaded only when the user opts in.

Attributions: board UI [chessground](https://github.com/lichess-org/chessground) (GPL-3.0+) with **cburnett** piece set (CC BY-SA 3.0, Colin M.L. Burnett); chess rules [chessops](https://github.com/niklasf/chessops) (GPL-3.0+); opening names from [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) (CC0); win%/accuracy formulas from lichess (AGPL-3.0 project — formulas reimplemented); classification thresholds from chess.com's published support article; Brilliant/Great heuristics re-implemented clean-room from ideas in freechess/wintrchess.
