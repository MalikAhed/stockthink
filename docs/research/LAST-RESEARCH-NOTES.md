# Notes on the five papers in `last research/` (read 2026-06-11)

Read carefully for the V2 analysis-system redesign. Actionable findings only.

## 1. CCC — Concept-guided Chess Commentary (arXiv:2410.20811, NAACL 2025)
*The* method paper for our pipeline. Human-eval numbers (scale 0–1):

| Method | Correctness | Relevance | Completeness |
|---|---|---|---|
| GPT-4o alone | 0.36 | 0.49 | 0.40 |
| GPT-4o + engine eval | 0.43 | 0.56 | 0.49 |
| **GPT-4o + engine + concepts (CCC)** | **0.60** | **0.67** | **0.59** |
| Human reference comments | 0.62 | 0.52 | 0.30 |

CCC **beats human commentary** on every axis except correctness (statistical tie).

Actionable design rules:
- **Prioritize concepts by before/after delta**: score each concept on the
  position before and after the move; the concepts that *changed most* are
  the ones the commentary should mention. (Our deterministic equivalent:
  facts diffed across the move, ranked by material/threat impact.)
- **Enumerate all existing attacks in the prompt** to stop the LLM from
  inventing pieces/attacks (their hallucination rate: 0.46 → 0.20).
- Few-shot + CoT + chess-specific info in the prompt.
- **Residual failure**: "wrong evaluation of move/position" stayed at ~0.34
  even with concepts → THE VERDICT MUST COME FROM THE ENGINE, never the
  language layer. The LLM words; it never judges.
- Their concept list (Stockfish-8 families): material, imbalance, pawns,
  knights/bishops/rooks/queens (per-piece activity), mobility, king safety,
  threats, space, passed pawns. Paper's own limitation note: fork/pin/
  double-pawn/open-file concepts would help but lacked labels — OUR
  DETECTORS PROVIDE EXACTLY THESE. We have the better concept source.

## 2. C1 / Master Distillation (arXiv:2603.20510, Mar 2026)
4B model trained to solve puzzles with explanations; not directly usable
($0 budget) but its **ablation-validated prompt engineering** is our Mode B
prompt contract:
- **Augment FEN with an explicit piece list + full legal-move list** — FEN
  alone fails from tokenization; ChessQA confirms piece arrangement context
  "significantly improves performance".
- **Single best-move PV beats MultiPV in the prompt** (17.6 vs 20.1 SFT
  accuracy) — extra lines are noise when one move is clearly best. Give the
  language layer ONE line per claim, not three.
- **Context that helps**: opponent's last move; tactical theme hints (our
  detector facts!); difficulty/rating to calibrate explanation depth.
- **Style constraints that worked**: 4–10 sentences scaled to complexity;
  annotate moves with natural-language clarification — "Qxh7+ (queen takes
  h7 with check)"; ground every claim in explicit coordinates ("the queen
  on h5"); objective voice (no "I see/I notice"); NEVER mention engine
  scores, themes-as-labels, or that the solution was provided.
- **Feigned discovery**: the explainer pretends to discover the move through
  analysis while being secretly steered by the engine PV. Removing this was
  their single largest quality drop. Mode B prompt must instruct: "explain
  why this move works as if analyzing fresh — never reveal an engine found it."

## 3. MATE (arXiv:2411.06655, NAACL 2025)
- 5 strategy categories (annotated by experts incl. a world champion):
  **material count, piece activity, pawn structure, space, king safety** —
  each with ~20 linguistic expressions. Good checklist for our positional
  detector vocabulary and template phrase banks.
- Tactics annotated as **factual move-sequence descriptions** (engine-generated
  lines + what they win), not abstract labels.
- Facts-in-prompt gains: o1-mini +34pts with strategy+tactic vs none;
  fine-tuned 8B: 63.5 → 95.2. Strategy AND tactic together always beat either.

## 4. ChessQA (arXiv:2510.23948)
- Benchmark. Four recurring LLM failure modes: (1) board-state hallucination,
  (2) legality errors in short tactics, (3) sound analysis → wrong final
  action, (4) false "no answer".
- Giving piece-arrangement context significantly improves all categories —
  again: always include the piece list.
- Failure mode (3) re-confirms: even when the LLM reasons well, the FINAL
  action/verdict must be pinned by the engine.

## 5. LLM Chess (arXiv:2512.01992)
- 37.9% of move errors are hallucinated/illegal moves even WITH the legal-move
  list in context; best LLM ≈ 758 Elo. Reinforces R4: post-generation
  verification of every square/piece/move mention is mandatory, whitelist
  from the fact sheet.

## Consolidated implications for V2 (delta over ANALYSIS-SYSTEM-V2.md v1)
1. Concept prioritization = facts diffed before/after the move, biggest
   impact first (CCC).
2. Mode B prompt contract (C1+CCC+ChessQA): piece list, legal moves, last
   move, ONE PV per claim, detector facts as theme hints, engine verdict
   stated as ground truth the LLM must not contradict, feigned-discovery
   instruction, 4–10 sentences scaled, NL-annotated moves, objective voice,
   no numbers/engine mention in output.
3. The language layer NEVER evaluates: verdict, classification, and "what
   was better" all come from engine+detectors; the LLM only words them (CCC
   residual-error table; ChessQA failure mode 3).
4. Template phrase banks organized by MATE's 5 strategy families + tactic
   facts as move-sequence descriptions.
