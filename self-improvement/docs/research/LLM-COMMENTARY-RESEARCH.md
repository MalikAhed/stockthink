# Research basis for StockThink's commentary architecture

Digest of the 14 papers in `~/research on how to analyise chess positions/chess_research_papers.md`,
read June 2026. This file records WHY the commentary system is built the way
it is. One-line verdict from the literature: **every study that gave LLMs the
analysis job found chance-level or brittle results; every study that gave
them pre-computed facts found large immediate gains.** Hence:

```
Stockfish (fixed nodes, MultiPV 3)
  → win% conversion (lichess sigmoid)
  → classification ladder (expected points lost)
  → deterministic detectors (SEE, pins, forks, refutation walk…) → typed facts
  → fact sheet JSON  (backend/src/llm/factsheet.ts — the only contract)
  → language layer: templates | on-device reworder | Claude/ChatGPT exchange
  → post-generation fact-check (backend/src/llm/verify.ts) — reject & keep template
```

## What LLMs CANNOT do (must stay deterministic)

| Finding | Source |
|---|---|
| Frontier-LLM cp-eval error 330–730cp on normal positions; 180° board rotation explodes error ~600% (memorized patterns, not spatial reasoning) | Geometric Stability, arXiv:2512.15033 |
| GPT-5 with ~15K reasoning tokens: only 40% on a 5-way eval pick (chance 20%) | ChessQA, arXiv:2510.23948 |
| Chess-fine-tuned 3B model: 53.5% on 3-way advantage classification (chance 33%) | ChessGPT, arXiv:2306.09200 |
| 37.9% of LLM move errors are hallucinated moves **with the legal-move list in context**; best LLM Elo ≈ 758 | LLM Chess, arXiv:2512.01992 |
| Asking the model to reason/explain **degrades** move quality — hallucinated analysis contaminates output; NL board descriptions are the weakest input modality | ChatGPT on the Chessboard, arXiv:2308.15118 |
| RL cannot instill chess judgment (plateau 25–30% puzzle accuracy); o3 reasoning-trace SFT gave no gains | Strategic Reasoning, arXiv:2507.00726 |
| Text-side move-sentiment classification caps at 62% F1 even fine-tuned | ASSESS, arXiv:2405.06499 |

## What LLMs CAN do (the language layer's job)

| Finding | Source |
|---|---|
| +30–45pts move-judgment when expert strategy/tactic facts are in the prompt; fine-tuned 8B: 63.5%→95.2% with facts | MATE, arXiv:2411.06655 |
| Selecting correct expert commentary: 74–80% — LLMs' single strongest chess skill | ChessQA Semantic |
| Push facts into the prompt; removing tool-fetch loops and providing the data directly improved results 20% | LLM Chess ablation |
| Spelling out piece arrangement explicitly "significantly improves performance" | ChessQA error analysis |

## Engine-side protocol (papers 8–14)

- **Win% space, never raw cp**: `Win% = 100/(1+e^(−0.00368208·cp))` (the only explicit formula in the corpus, MoM arXiv:2602.04447; win-prob rewards beat best-move rewards, arXiv:2507.00726).
- **Fixed nodes, not movetime**: node-capping eliminates hardware/load eval variance (MoM evaluation protocol). Depth matters: deep vs shallow engine labels are worth +350 Elo as supervision (ChessLLM, arXiv:2501.17186).
- **Noise floor**: ~20% of positions show ≥2.5 win% eval flips under null transformations, ~6% show ≥5, at practical budgets; 8× compute only buys 3–6× fewer violations (Consistency Checks, arXiv:2306.09983). → never classify below ~3 win% drop; 5/10/20 bands are safely above noise; "only move" = top-2 gap ≥ 10 win%.
- **Volatility gate**: |static/shallow − search eval| > 60–70cp marks a tactically volatile position (NNUE Dataset, arXiv:2412.17948 quiet filter M₁=60/M₂=70, inverted); static positional features are unreliable there → suppress positional commentary, prefer tactical/comparative facts.
- **Feature vocabulary**: material, piece activity/mobility, space, pawn structure, king safety (MATE's 5 strategy categories = Stockfish classical families, Sabatelli et al.); tactics inventory: pin, fork, skewer, battery, x-ray, discovered attack, double attack (+ Lichess's 20 puzzle themes) — all detected by board logic, never by a model.

## Implementation mapping

- Fixed nodes + MultiPV 3 — `backend/src/analyze.ts` (TIER_NODES)
- Win% ladder + noise-floor docs — `backend/src/analysis/classify.ts` (ladder)
- Volatility gate — `backend/src/engine/engine.ts` (shallowEval), `backend/src/analysis/classify.ts` (isVolatile)
- Win%-space criticality for Great — `backend/src/analysis/classify.ts` (isGreat)
- Typed facts / refutation walk — `src/explain/` (spec §4–§8)
- Fact sheet contract — `backend/src/llm/factsheet.ts`
- Constrained reworders — `backend/src/llm/webllm.ts` (on-device), `backend/src/llm/exchange.ts` (Claude/ChatGPT paste)
- Post-generation verification — `backend/src/llm/verify.ts`
