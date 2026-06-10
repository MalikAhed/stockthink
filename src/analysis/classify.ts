/**
 * Move classification — chess.com's official expected-points-lost ladder
 * (support article 8572705) on top of the lichess win-probability model,
 * plus the special classes: Book, Forced, Brilliant, Great, Miss, and
 * blunder softening. Brilliant/Great are clean-room re-implementations of
 * the freechess ideas (algorithms re-derived, no code copied — freechess
 * is CC BY-NC-SA).
 *
 * Mate transitions are handled by the continuous lichess mate→win% mapping
 * (synthetic cp = (21 − min(10,|mate|))·100) rather than discrete tables:
 * losing a forced mate but staying winning is a small win% drop (Excellent/
 * Good), allowing mate is a huge one (Blunder), automatically.
 */
import type { PositionAnalysis } from '../engine/engine';
import { type Explanation, explainMove } from '../explain/explain';
import { isHanging, minorMajorSquares, PIECE_VALUES, see } from './board';
import type { ParsedGame } from './pgn';
import {
  type EvalScore,
  moveAccuracy,
  winPercent,
  winPercentDrop,
} from './winprob';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { parseUci } from 'chessops/util';
import type { Color, NormalMove } from 'chessops/types';

export type Classification =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'forced'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder';

export interface OpeningInfo {
  eco: string;
  name: string;
}

export interface MoveJudgment {
  classification: Classification;
  /** Expected points lost (win-prob drop / 100), 0..1. */
  epLoss: number;
  /** Win% points dropped by the mover, 0..100. */
  winDrop: number;
  /** Per-move accuracy, 0..100 (lichess curve). */
  accuracy: number;
  /** White-POV eval of the position before / after the move. */
  evalBefore: EvalScore;
  evalAfter: EvalScore;
  /** White's win% after the move (graph + eval bar; 100/0 on checkmate). */
  winPercentAfter: number;
  /** Engine best move (UCI) in the position before the move. */
  bestUci: string | null;
  wasBest: boolean;
  /** Set on book moves: the deepest matched opening so far. */
  opening?: OpeningInfo;
  /** WHY-engine result: verified primary fact + "better was" purpose. */
  explain?: Explanation | null;
  /**
   * True when the position BEFORE the move is tactically volatile: side to
   * move in check, mate on the board, or shallow vs deep eval diverging by
   * more than ~65cp (arXiv:2412.17948's quiet-position margins M₁=60/M₂=70,
   * inverted as a sharpness detector). Static positional features are
   * unreliable here, so positional-only explanations are suppressed.
   */
  volatile: boolean;
}

export interface ClassifyOptions {
  /** EPD → opening, for Book detection (lichess chess-openings). */
  openings?: Map<string, OpeningInfo>;
}

/**
 * chess.com official ladder: expected points lost → classification.
 * These bands also sit safely above the engine's measured self-noise:
 * at practical node budgets ~20% of positions show ≥2.5 win% eval flips
 * under semantically null transformations and ~6% show ≥5 (consistency-
 * checks paper, arXiv:2306.09983), so nothing below a 5-win%-point drop
 * is ever labelled worse than "good".
 */
const ladder = (epLoss: number): Classification => {
  if (epLoss <= 0.02) return 'excellent';
  if (epLoss <= 0.05) return 'good';
  if (epLoss <= 0.1) return 'inaccuracy';
  if (epLoss <= 0.2) return 'mistake';
  return 'blunder';
};

/**
 * Volatility margin (cp) between the first and the deepest completed
 * mainline iteration beyond which a position counts as tactically sharp
 * (arXiv:2412.17948: 60–70cp static-vs-search divergence is the empirical
 * quiet/volatile boundary).
 */
const VOLATILITY_CP = 65;

/** Is the position tactically volatile? (see MoveJudgment.volatile) */
function isVolatile(analysis: PositionAnalysis, pos: Chess): boolean {
  if (pos.isCheck()) return true;
  const deep = analysis.lines[0]?.eval;
  const shallow = analysis.shallowEval;
  if (!deep || !shallow) return false;
  if (deep.mate !== undefined || shallow.mate !== undefined) return true;
  return Math.abs((deep.cp ?? 0) - (shallow.cp ?? 0)) > VOLATILITY_CP;
}

/** Mover-POV scalar where mate counts as ±infinity-ish for comparisons. */
const moverPovValue = (ev: EvalScore, mover: Color): number => {
  if (ev.mate !== undefined) {
    const v = ev.mate > 0 ? 100000 - Math.abs(ev.mate) : -100000 + Math.abs(ev.mate);
    return mover === 'white' ? v : -v;
  }
  const cp = ev.cp ?? 0;
  return mover === 'white' ? cp : -cp;
};

const chessFrom = (fen: string): Chess =>
  Chess.fromSetup(parseFen(fen).unwrap()).unwrap();

/**
 * Classify every ply of a parsed game given engine analyses for every
 * position (`analyses.length === game.plies.length + 1`, in order).
 */
export function classifyMoves(
  game: ParsedGame,
  analyses: PositionAnalysis[],
  opts: ClassifyOptions = {},
): MoveJudgment[] {
  if (analyses.length !== game.plies.length + 1)
    throw new Error(
      `need ${game.plies.length + 1} analyses for ${game.plies.length} plies, got ${analyses.length}`,
    );

  const judgments: MoveJudgment[] = [];
  let inBook = true;
  let lastOpening: OpeningInfo | undefined;

  for (let i = 0; i < game.plies.length; i++) {
    const ply = game.plies[i];
    const mover = ply.color;
    const before = analyses[i];
    const after = analyses[i + 1];

    const evalBefore: EvalScore = before.lines[0]?.eval ?? { cp: 0 };
    const posAfter = chessFrom(ply.fenAfter);

    // --- eval/win% after the move (terminal positions are exact) ---
    let evalAfter: EvalScore;
    let winAfter: number;
    const mateDelivered = after.terminal && posAfter.isCheckmate();
    if (mateDelivered) {
      evalAfter = { mate: mover === 'white' ? 1 : -1 }; // for graph continuity
      winAfter = mover === 'white' ? 100 : 0;
    } else if (after.terminal) {
      evalAfter = { cp: 0 }; // stalemate
      winAfter = 50;
    } else {
      evalAfter = after.lines[0]?.eval ?? { cp: 0 };
      winAfter = winPercent(evalAfter);
    }

    const winDrop = mateDelivered ? 0 : winPercentDrop(mover, evalBefore, evalAfter);
    const epLoss = winDrop / 100;
    const wasBest = before.bestmoveUci !== null && ply.uci === before.bestmoveUci;

    // --- classification ---
    let classification: Classification;
    const opening = inBook ? opts.openings?.get(ply.epdAfter) : undefined;

    if (opening) {
      classification = 'book';
      lastOpening = opening;
    } else {
      inBook = false;
      const posBefore = chessFrom(ply.fenBefore);
      if (mateDelivered) {
        classification = 'best';
      } else if (onlyOneLegalMove(posBefore)) {
        classification = 'forced';
      } else if (wasBest || winDrop <= 0) {
        classification = 'best';
        if (wasBest) {
          if (isBrilliant(posBefore, posAfter, ply.uci, ply.san, mover, before, evalAfter))
            classification = 'brilliant';
          else if (isGreat(posAfter, ply.uci, before, judgments[i - 1]))
            classification = 'great';
        }
      } else {
        classification = ladder(epLoss);
        // Miss: failed to punish the opponent's mistake/blunder (a move that
        // would otherwise be an inaccuracy/mistake; an outright blunder stays
        // a blunder, like chess.com)
        const prev = judgments[i - 1];
        if (
          (classification === 'inaccuracy' || classification === 'mistake') &&
          (prev?.classification === 'blunder' || prev?.classification === 'mistake')
        )
          classification = 'miss';
        // No freechess-style "blunder softening" needed: the win-prob sigmoid
        // already compresses completely winning/lost positions (e.g. +1000 →
        // +650 is only a ~6 win% drop = Inaccuracy), so the cp-ladder
        // pathology it patched cannot occur here.
      }
    }

    // --- volatility gate (suppresses positional talk in sharp positions) ---
    let volatile = false;
    try {
      volatile = isVolatile(before, chessFrom(ply.fenBefore));
    } catch {
      volatile = false;
    }

    // --- WHY explanation (refutation walk / purpose detection) ---
    let explain: Explanation | null = null;
    if (classification !== 'book' && classification !== 'forced') {
      const isBad =
        classification === 'inaccuracy' ||
        classification === 'mistake' ||
        classification === 'miss' ||
        classification === 'blunder';
      try {
        explain = explainMove({
          fenBefore: ply.fenBefore,
          fenAfter: ply.fenAfter,
          uci: ply.uci,
          mover,
          evalAfter,
          refutationUci: after.lines[0]?.pvUci ?? [],
          bestPvUci: before.lines[0]?.pvUci ?? [],
          bestEval: evalBefore,
          isBad,
          winDrop,
        });
        // In a tactically volatile position, static positional features are
        // about to be overturned by tactics — a positional "why" would be
        // noise, so drop it and let the comparative fallback speak instead.
        if (volatile && explain?.primary?.kind === 'positional')
          explain = { ...explain, primary: null };
      } catch {
        explain = null; // never block the report on an explainer bug
      }
    }

    // Blunder gate (§2.4): only call it a Blunder when the explanation
    // engine confirms a concrete cost (material ≥ a piece, forced mate, or
    // a stalemate that throws the game away); otherwise a human coach would
    // say "Mistake".
    if (classification === 'blunder') {
      const p = explain?.primary;
      const confirmed =
        (p !== undefined &&
          p !== null &&
          (p.kind === 'allows_mate' ||
            (p.kind === 'loses_material' && p.value >= 3) ||
            (p.kind === 'loses_material_eventually' && p.value >= 3))) ||
        isMateForSide(evalAfter, mover === 'white' ? 'black' : 'white') ||
        after.terminal; // stalemated from a winning position
      if (!confirmed) classification = 'mistake';
    }

    judgments.push({
      classification,
      epLoss,
      winDrop,
      accuracy: classification === 'book' ? 100 : moveAccuracy(winDrop),
      evalBefore,
      evalAfter,
      winPercentAfter: winAfter,
      bestUci: before.bestmoveUci,
      wasBest,
      opening: classification === 'book' ? lastOpening : undefined,
      explain,
      volatile,
    });
  }

  return judgments;
}

/** Is this white-POV eval a forced mate for the given side? */
const isMateForSide = (ev: EvalScore, side: Color): boolean =>
  ev.mate !== undefined && (side === 'white' ? ev.mate > 0 : ev.mate < 0);

const onlyOneLegalMove = (pos: Chess): boolean => {
  let count = 0;
  for (const [, dests] of pos.allDests()) {
    count += dests.size();
    if (count > 1) return false;
  }
  return count === 1;
};

/**
 * Brilliant: the best move is a genuine piece sacrifice.
 * Conditions (freechess-style, clean room): mover not worse after the move,
 * not already completely winning (2nd line < +700cp and not dual mates),
 * not a promotion, not escaping check, and a non-pawn piece is left
 * profitably capturable — where at least one capture is "viable": it does
 * not lose material (SEE) and, for minor-piece sacs, does not walk into an
 * immediate mate-in-1.
 */
function isBrilliant(
  posBefore: Chess,
  posAfter: Chess,
  uci: string,
  san: string,
  mover: Color,
  before: PositionAnalysis,
  evalAfter: EvalScore,
): boolean {
  if (san.includes('=')) return false;
  if (posBefore.isCheck()) return false;
  if (moverPovValue(evalAfter, mover) < 0) return false;

  const second = before.lines[1];
  if (second) {
    const secondVal = moverPovValue(second.eval, mover);
    const bothMate = before.lines[0]?.eval.mate !== undefined && second.eval.mate !== undefined;
    if (secondVal >= 700 || (bothMate && secondVal > 0)) return false; // winning anyway
  }

  const move = parseUci(uci) as NormalMove | undefined;
  if (!move || !('to' in move)) return false;
  const capturedValue = capturedValueOf(posBefore, move);

  for (const sq of minorMajorSquares(posAfter.board, mover)) {
    const role = posAfter.board.get(sq)!.role;
    if (PIECE_VALUES[role] <= capturedValue) continue; // just a trade, not a sac
    if (!isHanging(posAfter.board, sq)) continue;
    if (hasViableCapture(posAfter, sq, PIECE_VALUES[role])) return true;
  }
  return false;
}

const capturedValueOf = (posBefore: Chess, move: NormalMove): number => {
  const victim = posBefore.board.get(move.to);
  if (victim) return PIECE_VALUES[victim.role];
  // en passant: pawn moved diagonally to an empty square
  const moved = posBefore.board.get(move.from);
  if (moved?.role === 'pawn' && (move.from - move.to) % 8 !== 0) return 1;
  return 0;
};

/** Can the opponent actually take the hanging piece without losing out? */
function hasViableCapture(posAfter: Chess, square: number, sacValue: number): boolean {
  const ctx = posAfter.ctx();
  for (const [from, dests] of posAfter.allDests(ctx)) {
    if (!dests.has(square)) continue;
    if (see(posAfter, from, square) < 0) continue; // capture loses material
    if (sacValue < 5) {
      // minor-piece sac: capture is refuted if it allows immediate mate
      const probe = posAfter.clone();
      probe.play({ from, to: square });
      if (hasMateInOne(probe)) continue;
    }
    return true;
  }
  return false;
}

const hasMateInOne = (pos: Chess): boolean => {
  for (const [from, dests] of pos.allDests())
    for (const to of dests) {
      const probe = pos.clone();
      probe.play({ from, to });
      if (probe.isCheckmate()) return true;
    }
  return false;
};

/**
 * Great: the best move played right after the opponent erred badly, when it
 * was the ONLY good move and the moved piece is not left hanging. (Mistake
 * counts too: the blunder gate can downgrade an unconfirmed blunder.)
 *
 * "Only good move" = top-2 engine lines ≥ 10 win-percentage points apart.
 * The gap is measured in win% space, not centipawns: cp gaps are
 * meaningless when both lines are far from equality (+800 vs +650 is the
 * same result), and 10 win% sits safely above the engine's ~2.5–5 win%
 * self-noise floor (arXiv:2306.09983 flags 0.2–0.25 on [−1,1] — i.e.
 * 10–12.5 win% — as unambiguous).
 */
function isGreat(
  posAfter: Chess,
  uci: string,
  before: PositionAnalysis,
  prev: MoveJudgment | undefined,
): boolean {
  if (prev?.classification !== 'blunder' && prev?.classification !== 'mistake') return false;
  const top = before.lines[0];
  const second = before.lines[1];
  if (!top || !second) return false;
  if (top.eval.mate !== undefined || second.eval.mate !== undefined) return false;
  if (Math.abs(winPercent(top.eval) - winPercent(second.eval)) < 10) return false;
  const move = parseUci(uci);
  if (!move || !('to' in move)) return false;
  return !isHanging(posAfter.board, move.to);
}
