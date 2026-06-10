/**
 * Structured analysis fact sheet — the single contract every language layer
 * consumes: the deterministic templates (Tier 1), the on-device reworder
 * (Tier 2, WebLLM) and the copy/paste exchange with a frontier LLM (Tier 3).
 *
 * The split is the central finding of the chess-LLM literature: LLMs are
 * near-chance at deriving evaluations or tactics from a position (ChessQA
 * arXiv:2510.23948: 40% on a 5-way eval pick even for frontier reasoning
 * models) but gain +30–45pts when verified facts are pushed into the prompt
 * (MATE arXiv:2411.06655). So the engine + detectors produce ALL analysis,
 * serialized here; language layers may only reword it.
 */
import { formatEval } from '../analysis/commentary';
import type { AnnotatedMove, AnnotatedReport } from '../analyze';
import type { Fact } from '../explain/explain';

export const FACTS_VERSION = 'stockthink-facts-1';

export interface MoveFactSheet {
  ply: number;
  moveNumber: number;
  color: 'white' | 'black';
  san: string;
  classification: string;
  /** Win-percentage points the mover lost with this move (0 = perfect). */
  winDrop: number;
  /** The mover's winning chances after the move, 0–100. */
  moverWinAfter: number;
  /** White-POV eval after the move, e.g. "+1.4" or "#-3". */
  evalAfter: string;
  /** Engine's best move (SAN) in the position before the move. */
  bestSan: string | null;
  wasBest: boolean;
  /** Engine best line (SAN) from before the move. */
  pvSan: string[];
  /** Verified primary fact — THE reason the move is good/bad. */
  primaryFact: Fact | null;
  /** Verified purpose of the better move (bad moves only). */
  betterWasFact: Fact | null;
  /** Tactically volatile position (sharp; positional talk suppressed). */
  volatile: boolean;
  /** Opening name, on book moves. */
  opening?: string;
  /** Deterministic template renderings — the grounding reference text. */
  templateShort: string;
  templateLong: string;
}

export interface GameFactSheet {
  version: typeof FACTS_VERSION;
  white: { name: string; accuracy: number };
  black: { name: string; accuracy: number };
  result: string;
  opening?: string;
  moves: MoveFactSheet[];
}

const moveFactSheet = (m: AnnotatedMove): MoveFactSheet => ({
  ply: m.ply,
  moveNumber: m.moveNumber,
  color: m.color,
  san: m.san,
  classification: m.classification,
  winDrop: Math.round(m.winDrop * 10) / 10,
  moverWinAfter:
    Math.round((m.color === 'white' ? m.winPercentAfter : 100 - m.winPercentAfter) * 10) / 10,
  evalAfter: formatEval(m.evalAfter),
  bestSan: m.bestSan,
  wasBest: m.wasBest,
  pvSan: m.lines[0]?.sanPv ?? [],
  primaryFact: m.explain?.primary ?? null,
  betterWasFact: m.explain?.betterWas ?? null,
  volatile: m.volatile,
  opening: m.opening?.name,
  templateShort: m.commentary.short,
  templateLong: m.commentary.long,
});

export function buildFactSheet(report: AnnotatedReport): GameFactSheet {
  return {
    version: FACTS_VERSION,
    white: { name: report.headers.White ?? 'White', accuracy: report.players.white.accuracy },
    black: { name: report.headers.Black ?? 'Black', accuracy: report.players.black.accuracy },
    result: report.headers.Result ?? '*',
    opening: report.opening?.name,
    moves: report.moves.map(moveFactSheet),
  };
}
