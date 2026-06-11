# StockThink — Session Context for Claude

## What this project is
Zero-budget client-side chess Game Review app deployed at https://malikahed.github.io/stockthink/. No API keys, no server, no payment methods ever. Runs fully in the browser via Stockfish 18 WASM + chessops + chessground. Stack: Vite 5 + TypeScript, vitest, `~/bin/gh` (NOT on PATH) for deploys.

## ⚠️ Current state (2026-06-11): ANALYSIS SYSTEM RESET
The user was unhappy with the commentary quality (eval-narration like "this cost
13% in winning chances" + raw PV dumps instead of real WHY explanations), so the
entire analysis brain was **deleted** for a research-first redesign:

- **Deleted**: `src/analysis/{classify,commentary,concepts,board}.ts`, all of
  `src/explain/`, all of `src/llm/`, `src/ui/{coach,summary,aipanel,badges}.ts`,
  and their tests. (All recoverable from git history before commit — last full
  version at `cee389b`.)
- **Kept (working plumbing)**: engine layer (`src/engine/`), PGN parsing,
  win-prob/accuracy math (`winprob.ts`), opening book data, slim `report.ts`
  (evals/win%/accuracy only), and a degraded UI (board, eval bar, graph,
  move list, player strips — no badges, no commentary panels).
- 25 tests passing (winprob, pgn, engine), build clean.

**Root cause of the bad commentary (design against this!)**: the old system's
detector coverage was thin; when no tactical fact fired, a fallback template
produced eval-speak + PV dump. The new design must have NO such fallback path —
when nothing concrete is known, say less, and detector/concept coverage must be
deep enough that this is rare.

## Redesign direction (user's intent, 2026-06-11)
Research-first rebuild with a system-design mindset:
1. Re-read `docs/research/` (digest, full json, LLM-commentary research, papers)
   + user may supply more papers. Research further where gaps exist.
2. Pipeline shape the user wants: PGN → concept/tactic annotator (pins, forks,
   hanging pieces, king safety, center control, development, allows mate, …)
   producing grounded per-move facts FIRST → explanations of why a move is
   good/bad built only from those facts. No room for AI to invent analysis.
3. Possibly BOTH a client-side path and a "run it here with Claude" path
   (user remembers the in-session analysis giving better explanations).
4. NOT a hard-coded eval-bar narrator — explanations must carry chess meaning.

## Project map — where everything lives

```
stockthink/
├── CLAUDE.md            ← you are here: project context + reset state
├── README.md            ← public-facing (still describes old system — update at rebuild)
├── index.html           ← single page; commentary panel divs removed
├── src/
│   ├── main.ts          ← app shell: input → progress → review screens
│   ├── analyze.ts       ← PGN → engine pool → slim eval report
│   ├── style.css        ← all styling (design tokens from the trial prototype)
│   ├── engine/          ← Stockfish UCI wrapper (engine.ts) + worker pool (pool.ts)
│   ├── analysis/        ← pgn.ts, winprob.ts (lichess formulas), report.ts (slim),
│   │                      openings.ts/json (lichess CC0 book, EPD-keyed)
│   └── ui/              ← movelist.ts, graph.ts (only survivors)
├── test/                ← vitest; helpers/transport.ts = real-engine harness
│                          (engine .js must be copied to .cjs for Node)
├── public/
│   ├── engine/          ← Stockfish 18 Lite WASM (committed, 7.3 MB)
│   └── badges/          ← chess.com classification badge PNGs (kept for rebuild)
├── docs/                ← specs, research, prototype — see docs/README.md index
└── scripts/             ← build-openings.mjs (regenerates openings.json)
```

**Before designing the new system:** read `docs/research/RESEARCH-DIGEST.txt`
and `docs/research/LLM-COMMENTARY-RESEARCH.md`. The old WHY-engine spec
(`docs/specs/WHY-EXPLANATION-ENGINE-SPEC.md`) is reference material — good
toolbox ideas (SEE, pin rays, refutation walk), but its template output was
part of what the user rejected.

## Key constraints
- $0 budget, no API keys, fully client-side on GitHub Pages (a Claude-session
  analysis path is allowed as a second mode).
- Commentary must never hallucinate and never degrade into eval-bar narration.
- User is token-anxious: NO background agents/workflows — work inline, commit
  often, report concretely.
- Deploy: `git add -A && git commit && git push` — Pages auto-deploys from main.
