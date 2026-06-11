/**
 * Move-level tactical detectors (V2 spec stage 2, M1).
 *
 * Each detector answers one concrete question about a move, using only board
 * logic + pin-aware SEE — never engine evals. Ports of OpenChess-Insights
 * chess_review.py (MIT) and lichess-puzzler cook.py (MIT) ideas onto chessops.
 *
 * Conventions: `before` is the position with the mover to play; `move` is the
 * mover's move. Anything "after" plays the move on a clone.
 */
import type { Chess } from 'chessops/chess';
import type { NormalMove, Square } from 'chessops/types';
import { opposite } from 'chessops/util';
import { attacks } from 'chessops/attacks';
import { attackersTo, isInBadSpot, PIECE_VALUES } from './board';
import { forkTargets, isTrapped, mateThreat, seeCapture, seeSquare } from './primitives';

const after = (before: Chess, move: NormalMove): Chess => {
  const b = before.clone();
  b.play(move);
  return b;
};

const valueAt = (pos: Chess, sq: Square): number => {
  const p = pos.board.get(sq);
  return p ? PIECE_VALUES[p.role] : 0;
};

/** Value of an ENEMY piece on `sq` (0 for empty or own piece — castling is
 *  encoded king-takes-rook and must never read as a capture). */
const enemyValueAt = (pos: Chess, sq: Square): number => {
  const p = pos.board.get(sq);
  return p && p.color !== pos.turn ? PIECE_VALUES[p.role] : 0;
};

/* ------------------------------------------------------- hanging pieces --- */

/**
 * Mover pieces left profitably capturable by the move (pin-aware SEE),
 * that were NOT already loose before the move. Includes the moved piece
 * itself unless the move was an equal-or-better capture (a trade, not a hang).
 */
export function hangsPieces(before: Chess, move: NormalMove): Square[] {
  const us = before.turn;
  const captured = valueAt(before, move.to);
  const moverValue = valueAt(before, move.from);
  const b = after(before, move);
  const out: Square[] = [];
  for (const sq of b.board[us]) {
    const piece = b.board.get(sq)!;
    if (piece.role === 'king') continue;
    if (seeSquare(b, sq) <= 0) continue; // opponent can't win material there
    if (sq === move.to) {
      // moved piece en prise: not a "hang" if it captured equal/greater value
      if (captured >= moverValue) continue;
      out.push(sq);
    } else if (!isInBadSpot(before.board, sq)) {
      out.push(sq); // newly loose, not already loose before the move
    }
  }
  return out;
}

/** Own previously-loose pieces this move now adequately protects. */
export function defendsHangingPieces(before: Chess, move: NormalMove): Square[] {
  const us = before.turn;
  const b = after(before, move);
  const out: Square[] = [];
  for (const sq of b.board[us]) {
    const piece = b.board.get(sq)!;
    if (piece.role === 'king' || sq === move.to) continue;
    if (isInBadSpot(before.board, sq) && seeSquare(b, sq) === 0) out.push(sq);
  }
  return out;
}

/* ---------------------------------------------------------------- forks --- */

/** Fork target squares if `move` lands a piece forking ≥2 targets. */
export function createsFork(before: Chess, move: NormalMove): Square[] {
  return forkTargets(after(before, move).board, move.to);
}

/** All legal moves for the side to play that create a fork. */
export function forkingMoves(pos: Chess): NormalMove[] {
  const out: NormalMove[] = [];
  for (const [from, dests] of pos.allDests()) {
    for (const to of dests) {
      const m: NormalMove = { from, to };
      if (createsFork(pos, m).length) out.push(m);
    }
  }
  return out;
}

/* ----------------------------------------------------------- trapped ----- */

/** Opponent pieces trapped after `move` (no safe escape, can't trade out). */
export function trapsPieces(before: Chess, move: NormalMove): Square[] {
  const b = after(before, move); // opponent to move: isTrapped's requirement
  const them = b.turn;
  const out: Square[] = [];
  for (const sq of b.board[them]) {
    const piece = b.board.get(sq)!;
    if (piece.role === 'pawn' || piece.role === 'king') continue;
    if (isTrapped(b, sq)) out.push(sq);
  }
  return out;
}

/* --------------------------------------------------------- captures ------ */

/** Capture that wins the full victim value (nothing recaptures profitably). */
export function capturesFreePiece(before: Chess, move: NormalMove): boolean {
  const victim = enemyValueAt(before, move.to);
  return victim > 0 && seeCapture(before, move) >= victim;
}

/** Capture of a piece worth more than the capturer. */
export function capturesHigherPiece(before: Chess, move: NormalMove): boolean {
  const victim = enemyValueAt(before, move.to);
  return victim > 0 && victim > valueAt(before, move.from);
}

/** Equal-value capture the opponent can safely recapture: a trade. */
export function isTrade(before: Chess, move: NormalMove): boolean {
  const victim = enemyValueAt(before, move.to);
  if (!victim || victim !== valueAt(before, move.from)) return false;
  if (seeCapture(before, move) < 0) return false;
  const b = after(before, move);
  for (const [, dests] of b.allDests()) if (dests.has(move.to)) return true;
  return false;
}

/** Capture moves available to the side to play that win material (SEE > 0). */
export function freeCaptures(pos: Chess): NormalMove[] {
  const out: NormalMove[] = [];
  for (const [from, dests] of pos.allDests()) {
    for (const to of dests) {
      if (!pos.board.get(to) || pos.board.get(to)!.color === pos.turn) continue;
      const m: NormalMove = { from, to };
      if (seeCapture(pos, m) > 0) out.push(m);
    }
  }
  return out;
}

/* -------------------------------------------------------- sacrifice ------ */

/**
 * SEE screening for a deliberate material offer of ≥2 points: a losing
 * capture, or a non-capture landing where the opponent wins ≥2 by force.
 * (Engine confirmation that the position is still good happens at the
 * classification layer — this is only the geometric test.)
 */
export function isSacrifice(before: Chess, move: NormalMove): boolean {
  if (valueAt(before, move.from) === 0) return false;
  const role = before.board.get(move.from)!.role;
  if (role === 'pawn' || role === 'king') return false; // king moves incl. castling
  if (enemyValueAt(before, move.to) > 0) return seeCapture(before, move) <= -2;
  if (before.board.get(move.to)) return false; // own piece on target: castling encoding
  return seeSquare(after(before, move), move.to) >= 2;
}

/* ------------------------------------------------------- check / mate ---- */

/** In-check before, and `move` interposes a piece (no king move, no capture
 *  of the checker). */
export function blocksCheck(before: Chess, move: NormalMove): boolean {
  if (!before.isCheck()) return false;
  const piece = before.board.get(move.from);
  if (!piece || piece.role === 'king') return false;
  const ksq = before.board.kingOf(before.turn)!;
  const checkers = before.kingAttackers(ksq, opposite(before.turn), before.board.occupied);
  if (checkers.has(move.to)) return false; // capturing the checker, not blocking
  return !after(before, move).isCheck();
}

/** The mating move if `move` creates a mate-in-1 threat, else null. */
export function createsMateThreat(before: Chess, move: NormalMove): NormalMove | null {
  const threat = mateThreat(after(before, move));
  return threat && 'from' in threat ? (threat as NormalMove) : null;
}

/* ------------------------------------------------------------- tempo ----- */

/**
 * The moved piece safely attacks a more valuable piece (or wins material on
 * it by SEE), forcing the opponent to react: a tempo gain.
 */
export function winsTempo(before: Chess, move: NormalMove): Square | null {
  const b = after(before, move);
  const piece = b.board.get(move.to);
  if (!piece || piece.role === 'king') return null;
  if (isInBadSpot(b.board, move.to)) return null; // attacker itself is loose
  if (b.isCheck()) return null; // checks are their own story
  for (const tsq of attacks(piece, move.to, b.board.occupied)) {
    const t = b.board.get(tsq);
    if (!t || t.color === piece.color || t.role === 'king' || t.role === 'pawn') continue;
    if (PIECE_VALUES[t.role] > PIECE_VALUES[piece.role]) return tsq;
  }
  return null;
}

/* ------------------------------------------------- helper for annotate --- */

/** Squares of `color` pieces (non-pawn, non-king) attacked by the enemy. */
export function attackedPieces(pos: Chess, color: 'white' | 'black'): Square[] {
  const out: Square[] = [];
  for (const sq of pos.board[color]) {
    const p = pos.board.get(sq)!;
    if (p.role === 'king' || p.role === 'pawn') continue;
    if (attackersTo(pos.board, sq, opposite(color), pos.board.occupied).nonEmpty()) out.push(sq);
  }
  return out;
}
