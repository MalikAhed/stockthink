# StockThink — Session Context for Claude

## What this project is
Zero-budget client-side chess Game Review app deployed at https://malikahed.github.io/stockthink/. No API keys, no server, no payment methods ever. Runs fully in the browser via Stockfish 18 WASM + chessops + chessground. Stack: Vite 5 + TypeScript, vitest, `~/bin/gh` (NOT on PATH) for deploys.

## ✅ Current state (2026-06-11): V2 ANALYSIS SYSTEM SHIPPED (M1–M5 complete)
The V1 analysis brain was deleted (eval-narration + PV dumps — last full V1 at
git `cee389b`) and rebuilt research-first. All five milestones of
`docs/specs/ANALYSIS-SYSTEM-V2.md` are implemented, gated, and deployed:

- **M1 `src/concepts/`** — `board.ts` (x-ray predicates), `primitives.ts`
  (pin rays, pin-aware SEE, forks/skewers/traps/mate threats; 21 acceptance
  tests), `detectors.ts` (move-level tactical: hangs/defends/fork/trap/
  captures/trade/sacrifice/blocks/mate-threat/tempo), `positional.ts`
  (typed facts: 14 purpose + 7 regression kinds; shield gated to castled kings).
- **M2 `concepts/facts.ts` + `annotate.ts`** — typed `Fact` union with
  priority sort; `annotateMove(before, move, ctx)` runs detectors over the
  played move, the reply PV (refutation walk with trade-safe parity), and the
  engine best move (missed mate/free piece/fork/pin/trap). Wired into
  `analysis/report.ts` (every `MoveReport` carries `facts`).
- **M3 `analysis/classify.ts`** — win%-drop ladder (0/2/5/10/20) +
  Book (EPD)/Forced/Brilliant (SEE sacrifice + near-best + not lost +
  not already ≥95%)/Great (only_move)/Miss (concrete missed resource).
- **M4 `src/compose/`** — `templates.ts` (one renderer per fact kind) +
  `compose.ts` (bad: cause→consequence→better-with-why; good: purpose;
  zero facts: one neutral line). Engine lines ship as clickable
  **variation chips**, never prose. UI restored: `ui/badges.ts` (chess.com
  PNGs), `ui/coach.ts` (bubble + chips + explain-more), `ui/summary.ts`
  (accuracy + counts), movelist badges, board badge overlay (customSvg).
- **M5 `src/llm/`** — `factsheet.ts` (per-move FEN + piece list + legal moves
  + best line + facts + baseline + whitelist; prompt per the C1/CCC contract:
  feigned discovery, verdict = ground truth, no engine mention),
  `verify.ts` (R4: SAN/square whitelist + eval-speak ban), `exchange.ts`
  (paste-import, per-move fallback), `ui/deepreview.ts` (copy prompt → paste
  JSON panel).
- **Gate `test/gate.e2e.test.ts`** — Opera Game + Blackburne Shilling trap
  through the REAL engine; prints every comment; asserts zero eval-speak and
  no PV dumps. Coverage at gate: 93–100% of non-book moves carry facts.
  Found+fixed: chessops castling (king-takes-rook) read as "wins the rook".

**142 tests, 13 files.** Run the gate with
`npx vitest run test/gate.e2e.test.ts` (real WASM engine, ~20s).

## The five hard rules (never regress these)
R1 no eval numbers in prose · R2 no PV dumps in prose (chips instead) ·
R3 no empty-handed fallback (say less) · R4 every claim machine-verified ·
R5 cause before verdict. The V1 disease was an eval-speak fallback template —
there is structurally no such path in V2; keep it that way.

## Project map

```
stockthink/
├── CLAUDE.md            ← you are here
├── index.html           ← summary/coach/deep-review divs restored
├── src/
│   ├── main.ts          ← app shell + chip playback + badge overlay
│   ├── analyze.ts       ← PGN → engine pool → report (TIER_NODES 75k/200k/500k)
│   ├── engine/          ← UCI wrapper + worker pool (white-POV at parse time)
│   ├── analysis/        ← pgn, winprob (lichess formulas), report (facts +
│   │                      classification + counts), classify, openings
│   ├── concepts/        ← STAGE 2: board/primitives/detectors/positional/
│   │                      facts/annotate  (the heart — deterministic facts)
│   ├── compose/         ← STAGE 4: templates + compose (Mode A prose)
│   ├── llm/             ← MODE B: factsheet/verify/exchange
│   └── ui/              ← badges, coach, summary, movelist, graph, deepreview
├── test/                ← vitest; helpers/transport.ts = real-engine harness
│                          gate.e2e.test.ts = THE quality gate
├── public/engine/       ← Stockfish 18 Lite WASM (7.3 MB, committed)
├── public/badges/       ← chess.com classification badges
└── docs/                ← specs/ANALYSIS-SYSTEM-V2.md, research/, prototype/
```

## Key constraints
- $0 budget, no API keys, fully client-side on GitHub Pages (Mode B = paste
  exchange with a Claude chat, still free).
- Commentary must never hallucinate and never degrade into eval-bar narration.
- User is token-anxious: NO background agents/workflows — work inline, commit
  often, report concretely.
- Deploy: `git add -A && git commit && git push` — Pages auto-deploys main.
- Next ideas: play-vs-engine mode (v-next), volatility flag (shallow+deep
  pass) to suppress positional facts in sharp positions, more cook.py
  detectors (skewer-in-annotator, discovered-attack-with-win).
