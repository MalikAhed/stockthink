# StockThink ♟️

**Free chess game review — entirely in your browser.** Paste a PGN (or play a game), get a full chess.com-style analysis: eval bar, move classifications (Brilliant‼ → Blunder⁇), accuracy scores, and clear human-readable commentary for every move — with "explain more" when you want the full idea.

No server. No account. No API keys. No cost. Powered by **Stockfish 18 (NNUE)** running as WebAssembly on your machine.

## How it works

1. **Engine** — Stockfish 18 Lite (7.3 MB WASM, single-threaded, MultiPV 2) analyzes every position of your game in parallel web workers.
2. **Win-probability model** — centipawn evals are converted to win% with the lichess sigmoid (`50 + 50·(2/(1+e^(−0.00368208·cp))−1)`); classification uses chess.com's published expected-points-lost ladder.
3. **Classifications** — Best / Excellent / Good / Inaccuracy / Mistake / Blunder by win% loss, plus Book (ECO database), Forced, **Brilliant** (sound sacrifice detection), **Great** (critical only-good-moves), and **Miss** (unpunished mistakes).
4. **Accuracy** — lichess accuracy curve per move; game accuracy = mean of volatility-weighted and harmonic means. Plus an estimated game rating.
5. **Commentary** — a rule-based concept detector (hanging pieces, forks, pins, skewers, sacrifices, mate threats, missed tactics…) extracts *verified facts* from the engine lines; a template engine words them into short, clear sentences. Because every statement is derived from engine-verified facts, the commentary **cannot hallucinate**.

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

Attributions: board UI [chessground](https://github.com/lichess-org/chessground) (GPL-3.0+) with **cburnett** piece set (CC BY-SA 3.0, Colin M.L. Burnett); chess rules [chessops](https://github.com/niklasf/chessops) (GPL-3.0+); opening names from [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) (CC0); win%/accuracy formulas from lichess (AGPL-3.0 project — formulas reimplemented); classification thresholds from chess.com's published support article; Brilliant/Great heuristics re-implemented clean-room from ideas in freechess/wintrchess.
