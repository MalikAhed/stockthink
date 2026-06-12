# PROJECT MAP — find the right file in seconds

The codebase index. Every row below was written from reading the actual code
(2026-06-12). If this map contradicts the code, **fixing the map IS the work**
(see CLAUDE.md, Laws of the Loop). Line counts are approximate signposts.

## The pipeline

```
PGN text
  └─ analysis/pgn.ts:parseGame()          → Ply[] (san/uci/fenBefore/fenAfter/epdAfter)
       └─ engine/pool.ts:EnginePool.analyzeAll()   ← N×Stockfish WASM, work-stealing
            └─ analysis/report.ts:buildReport()
                 └─ buildMoveReport()      ← ONE move's full story (also used by live.ts & eval/)
                      ├─ concepts/annotate.ts:annotateMove()   ← THE HEART: all facts
                      │    ├─ concepts/detectors.ts            ← tactical (hangs/fork/trap/mate-threat/…)
                      │    ├─ concepts/positional.ts           ← 14 purposes + 7 regressions
                      │    └─ concepts/primitives.ts, board.ts ← pin rays, pin-aware SEE, fork targets
                      ├─ analysis/classify.ts:classifyMove()   ← brilliant…blunder ladder
                      └─ (UI/eval then call) compose/compose.ts:composeComment() ← facts → prose
```

## Modules

### Core analysis
| File | What it does | Key exports |
|---|---|---|
| `src/analyze.ts` (63L) | Browser orchestration: PGN → pool → report; node budgets; optional AbortSignal | `analyzeGame`, `Tier`, `TIER_NODES` (75k/200k/500k), `AnnotatedReport` |
| `src/analysis/pgn.ts` (93L) | PGN → headers + per-ply records with FENs (chess.com exports, [%clk], NAGs) | `parseGame`, `Ply`, `ParsedGame` |
| `src/analysis/report.ts` (206L) | Plies + engine analyses → classified `MoveReport`s + accuracy/ACPL/Elo | `buildMoveReport` (single-move entry — eval & live reuse it), `buildReport`, `MoveReport`, `GameReport` |
| `src/analysis/classify.ts` (107L) | Win%-drop ladder + fact-aware brilliant/great + decided-position leniency; CAPS2-style scores | `classifyMove`, `Classification`, `classificationScore` |
| `src/analysis/winprob.ts` (88L) | Eval → win-probability math (lichess formulas, verified 2026-06) | `EvalScore`, `winPercent`, `winPercentDrop`, `moveAccuracy`, `toWhitePov` |
| `src/analysis/openings.ts` (23L) | EPD-keyed opening book (lichess chess-openings, CC0) | `openingBook` |
| `src/analysis/explorer.ts` (84L) | Deep book via lichess masters explorer (keyless; UNVERIFIED in browser — sandbox blocked it) | `masterBookPlies` |

### Engine
| File | What it does | Key exports |
|---|---|---|
| `src/engine/engine.ts` (219L) | UCI wrapper (lila protocol patterns); white-POV evals at parse time; `ucinewgame` only at init | `Engine`, `UciTransport`, `WorkerTransport`, `PositionAnalysis`, `SearchLimits`, `parseInfo` |
| `src/engine/pool.ts` (79L) | N single-threaded engines, work-stealing, results in input order; AbortSignal stops between positions | `EnginePool.create/analyzeAll/dispose` |

### Concepts — THE HEART (facts, never prose)
| File | What it does | Key exports |
|---|---|---|
| `src/concepts/annotate.ts` (725L) | Runs every detector over played move + engine lines → priority-sorted `Fact[]`. Gates live here: `MISS_GATE=10`, `ONLY_MOVE_GAP=10`, confirm-gates (forkConfirmed/tempoConfirmed/refutation walk/missed_idea/hard_to_find) | `annotateMove`, `AnnotateContext` |
| `src/concepts/facts.ts` (154L) | The typed `Fact` union (~40 kinds + `MissedIdea` variants) + composer priority | `Fact`, `FactKind`, `SanMove`, `PieceOn`, `factPriority`, `sortFacts` |
| `src/concepts/detectors.ts` (227L) | Move-level tactical detectors | `hangsPieces`, `createsFork`, `trapsPieces`, `isSacrifice`, `isTrade`, `createsMateThreat`, `blocksCheck`, … |
| `src/concepts/positional.ts` (361L) | Positional purposes/regressions (develops, center, open file, 7th rank, king safety, pawn structure…) | `positionalPurposes`, `positionalRegressions`, `PositionalFact`, `RegressionFact` |
| `src/concepts/primitives.ts` (383L) | "Why" primitives: pin rays, effective defenders, pin-aware SEE, fork targets, trapped, discovered attacks | `pinRay`, `isPinned`, `whyCapturable`, `see*`, `forkTargets`, `isTrapped`, `discoveredAttacks` |
| `src/concepts/board.ts` (184L) | Bitboard primitives (lichess-puzzler tagger ports): attackers, hanging, SEE, bad-spot | `PIECE_VALUES`, `attackersTo`, `isHanging`, `isDefended`, `see`, `isInBadSpot` |

### Compose (Mode A prose)
| File | What it does | Key exports |
|---|---|---|
| `src/compose/compose.ts` (257L) | Facts → 1–3 sentences. Structure enforced: bad = cause→consequence→better+why (R5); good = ≤2 purposes (concrete outrank positional ride-alongs; quiet_strength only as a 2nd line); factless = NEUTRAL one-liner rotated by ply (never empty — R3). GM-1/2/4/5 weaving. BAD/MISSED/CONTEXT kind sets defined at top | `composeComment`, `Comment`, `VariationChip` |
| `src/compose/templates.ts` (242L) | One sentence renderer per fact kind; slots filled only from the fact (R4) | `renderFact` |

### LLM (Mode B — reword only, never analyze)
| File | What it does | Key exports |
|---|---|---|
| `src/llm/factsheet.ts` (154L) | Per-game factsheet + ablation-validated prompt | `buildFactsheet`, `buildPrompt` |
| `src/llm/verify.ts` (34L) | R4 verifier: every AI sentence checked vs whitelist + eval-speak ban | `verifyComment` |
| `src/llm/exchange.ts` (42L) | Parse pasted JSON reply, verify, fallback to Mode A | `importCommentary` |
| `src/llm/providers.ts` (103L) | Auto transports: user's own Anthropic key / local WebLLM (WebGPU) | `generateViaApi`, `generateViaWebLLM`, `getStoredKey` |

### chess.com import (input tab + background pre-analysis)
| File | What it does | Key exports |
|---|---|---|
| `src/chesscom/api.ts` (222L) | Pub API client (keyless, CORS-open) + pure normalization: archives → `CcGame`s (variants filtered), outcome/result/date/moveCount helpers | `fetchPlayer/Ratings/Archives/Month`, `normalizeGames`, `userOutcome`, `archiveLabel` |
| `src/chesscom/queue.ts` (225L) | THE single analysis lane for the whole app (one engine pool ever). Background batches; `runNow` preempts (aborts + re-queues the active job, waiters intact); `cancel`; snapshot/subscribe for live chips | `AnalysisQueue`, `analysisQueue`, `QueueJob`, `QueueSnapshot` |
| `src/chesscom/store.ts` (123L) | IndexedDB report cache keyed `uuid:tier` (in-memory fallback); analyzed games open instantly, survive reloads; LRU prune at 60 | `getReport`, `putReport`, `cachedKeys`, `reportKey` |
| `src/ui/chesscom.ts` (348L) | The tab UI: username search → player card → monthly list with select-and-pre-analyze; live status chips driven by queue snapshots | `initChesscomTab`, `refreshCached` |

### UI (done — only walkthrough captions may change, per improve/README)
| File | What it does | Key exports |
|---|---|---|
| `src/main.ts` (643L) | App shell: input tabs (PGN / chess.com) → progress → review; all analysis routed through `analysisQueue`; topbar queue pill; chip playback; badge overlay | (entry) |
| `src/live.ts` (95L) | "Try a move": same pipeline on demand, lazy worker, cached | `liveMoveReport`, `seedLiveAnalysis` |
| `src/ui/coach.ts` (114L) | Coach bubble: verdict row + commentary + variation chips | `renderCoach`, `headline`, `formatEval` |
| `src/ui/walkthrough.ts` (503L) | Best-move Spotlight: user-paced PV walkthrough, board-verified captions, try-mode | `buildWalkthrough`, `lineOutcome`, `renderSpotlightCard`, `CONFIDENT_PLIES` |
| `src/ui/santag.ts` (105L) | SAN tokens in prose → piece-image pills (legality-checked) + hover preview | `renderRich`, `attachPreviews` |
| `src/ui/badges.ts` `movelist.ts` `summary.ts` `graph.ts` `deepreview.ts` | chess.com badge assets · move list · summary card · win% graph · Mode B panel | — |

### Truth & tests
| File | What it does |
|---|---|
| `eval/positions.json` | THE TRUTH SET: cases with expectations (facts, mentions, bans, sentence caps) |
| `eval/score.ts` | Scores the pipeline against the truth set (CAUSAL/GROUNDED/ECONOMY 0–2) → `eval/results/latest.json` + METRICS.md row. Run: `npm run eval` (flags: `-- --explain <id>`, `--dry`, `--tests N/M`) |
| `test/gate.e2e.test.ts` | THE QUALITY GATE: real engine over Opera + Blackburne, prints every comment, zero eval-speak. `npx vitest run test/gate.e2e.test.ts` |
| `test/recall.test.ts` | Lichess-puzzle recall per theme, ratcheting floors → `improve/metrics.json` (KNOWN FLAW: appends a snapshot every run — BACKLOG) |
| `test/helpers/transport.ts` | `ChildProcessTransport` + `setupEngineFiles`: real Stockfish WASM under Node |
| `test/fixtures/puzzles/*.csv` | Per-theme lichess fixtures. Semantics: `Moves[0]` = setup move; the tactic is `Moves[1]` from the position after `Moves[0]` |
| other `test/*.test.ts` | Unit suites mirroring src modules (annotate, detectors, positional, compose, classify, winprob, board, primitives, pgn, engine, live, santag, walkthrough, providers, verify, explorer) |

### Scripts & assets
| File | What it does |
|---|---|
| `scripts/build-openings.mjs` | Bakes lichess chess-openings TSVs → `src/analysis/openings.json` |
| `scripts/puzzles/fetch-fixtures.mjs` | Lichess puzzle DB (HF /rows scan) → `test/fixtures/puzzles/<theme>.csv` |
| `public/engine/` | Stockfish 18 Lite single-threaded WASM (7.3 MB, committed) |
| `public/badges/` | chess.com classification badges |

## To change X, edit here

| X | Where |
|---|---|
| When a comment fires / when we stay quiet | `src/compose/compose.ts` (kind sets, NEUTRAL pools) + the detector's confirm-gate in `src/concepts/annotate.ts` |
| Explanation wording | `src/compose/templates.ts` (one renderer per fact kind) |
| Add a chess concept | detector (`detectors.ts`/`positional.ts`) + fact kind & priority (`facts.ts`) + template (`templates.ts`) + wiring (`annotate.ts`) — see improve/README.md |
| Verdict thresholds (brilliant…blunder) | `src/analysis/classify.ts` |
| Engine interface / search settings | `src/engine/engine.ts`; node budgets `src/analyze.ts` (`TIER_NODES`) |
| Accuracy / win% math | `src/analysis/winprob.ts` + `summarize()` in `report.ts` |
| Spotlight walkthrough captions | `src/ui/walkthrough.ts` (captions only — layout is frozen) |
| Eval cases / scoring rubric | `eval/positions.json` / `eval/score.ts` |
| What counts as "better" | `docs/METRICS.md` |
| chess.com import (search/list/pre-analysis UX) | `src/ui/chesscom.ts` (tab) + `src/chesscom/api.ts` (data) + `src/chesscom/queue.ts` (scheduling) + `src/chesscom/store.ts` (cache); wiring & tabs `src/main.ts` + `index.html` |
