/**
 * Board-level tactical primitives on chessops bitboards.
 *
 * Ports of the lichess-puzzler tagger predicates (tagger/util.py, MIT) plus
 * the classic iterative SEE "swap algorithm" (chessprogramming.org). These
 * feed Brilliant-move detection now and the concept detector later.
 */
import {
  attacks,
  bishopAttacks,
  kingAttacks,
  knightAttacks,
  pawnAttacks,
  rookAttacks,
} from 'chessops/attacks';
import type { Board } from 'chessops/board';
import type { Chess } from 'chessops/chess';
import { SquareSet } from 'chessops/squareSet';
import type { Color, Role, Square } from 'chessops/types';
import { opposite } from 'chessops/util';

/** Standard material values; king valued like lichess-puzzler king_values. */
export const PIECE_VALUES: Record<Role, number> = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 99,
};

/** Ascending capture order for SEE attacker selection. */
const ROLES_BY_VALUE: Role[] = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];

const RAY_ROLES: Role[] = ['bishop', 'rook', 'queen'];

/** All `color` pieces attacking `square`, given an occupancy mask. */
export const attackersTo = (
  board: Board,
  square: Square,
  color: Color,
  occupied: SquareSet,
): SquareSet =>
  SquareSet.empty()
    .union(pawnAttacks(opposite(color), square).intersect(board.pieces(color, 'pawn')))
    .union(knightAttacks(square).intersect(board.pieces(color, 'knight')))
    .union(kingAttacks(square).intersect(board.pieces(color, 'king')))
    .union(
      bishopAttacks(square, occupied).intersect(
        board.pieces(color, 'bishop').union(board.pieces(color, 'queen')),
      ),
    )
    .union(
      rookAttacks(square, occupied).intersect(
        board.pieces(color, 'rook').union(board.pieces(color, 'queen')),
      ),
    )
    .intersect(occupied);

/** Total material (no kings) for one side, in pawns. */
export const materialCount = (board: Board, color: Color): number => {
  let sum = 0;
  for (const role of ['pawn', 'knight', 'bishop', 'rook', 'queen'] as Role[])
    sum += board.pieces(color, role).size() * PIECE_VALUES[role];
  return sum;
};

/**
 * Is the piece on `square` defended? X-ray aware like lichess-puzzler's
 * is_defended: if a direct defender is missing, temporarily remove each enemy
 * ray attacker and re-check (a defender may stand behind the attacker).
 */
export const isDefended = (board: Board, square: Square): boolean => {
  const piece = board.get(square);
  if (!piece) return false;
  if (attackersTo(board, square, piece.color, board.occupied).nonEmpty()) return true;
  for (const attacker of attackersTo(board, square, opposite(piece.color), board.occupied)) {
    const attackerPiece = board.get(attacker)!;
    if (RAY_ROLES.includes(attackerPiece.role)) {
      const without = board.occupied.without(attacker);
      if (attackersTo(board, square, piece.color, without).nonEmpty()) return true;
    }
  }
  return false;
};

/**
 * Is the piece on `square` capturable at a (likely) profit? True when it is
 * attacked and either undefended or attackable by a cheaper piece.
 */
export const isHanging = (board: Board, square: Square): boolean => {
  const piece = board.get(square);
  if (!piece) return false;
  const enemies = attackersTo(board, square, opposite(piece.color), board.occupied);
  if (enemies.isEmpty()) return false;
  if (!isDefended(board, square)) return true;
  for (const sq of enemies) {
    const attacker = board.get(sq)!;
    if (attacker.role !== 'king' && PIECE_VALUES[attacker.role] < PIECE_VALUES[piece.role])
      return true;
  }
  return false;
};

/**
 * Static exchange evaluation of capturing whatever sits on `to` starting with
 * the piece on `from` — iterative swap algorithm with x-ray reintroduction.
 * Positive = the exchange wins material for the side moving first.
 */
export const see = (pos: Chess, from: Square, to: Square): number => {
  const board = pos.board;
  const mover = board.get(from);
  if (!mover) return 0;

  let occupied = board.occupied.without(from);
  const diagSliders = board.bishop.union(board.queen);
  const lineSliders = board.rook.union(board.queen);

  // attackers of `to` from both sides, refreshed as pieces are consumed
  let attadef = attackersTo(board, to, 'white', occupied).union(
    attackersTo(board, to, 'black', occupied),
  );

  const gain: number[] = [PIECE_VALUES[board.get(to)?.role ?? 'pawn'] * (board.get(to) ? 1 : 0)];
  let attackerValue = PIECE_VALUES[mover.role];
  let stm: Color = opposite(mover.color);
  let depth = 0;

  for (;;) {
    depth++;
    gain[depth] = attackerValue - gain[depth - 1]; // speculative: capture and be recaptured
    // pick the least valuable attacker of the side to move
    let next: Square | undefined;
    for (const role of ROLES_BY_VALUE) {
      const candidates = board.pieces(stm, role).intersect(attadef).intersect(occupied);
      const sq = candidates.first();
      if (sq !== undefined) {
        next = sq;
        attackerValue = PIECE_VALUES[role];
        break;
      }
    }
    if (next === undefined) break;
    occupied = occupied.without(next);
    // reveal x-ray attackers behind the consumed piece
    attadef = attadef
      .union(bishopAttacks(to, occupied).intersect(diagSliders))
      .union(rookAttacks(to, occupied).intersect(lineSliders))
      .intersect(occupied);
    stm = opposite(stm);
  }

  // negamax the gain array: each side may stand pat instead of recapturing
  for (let d = depth - 1; d > 0; d--) gain[d - 1] = -Math.max(-gain[d - 1], gain[d]);
  return gain[0] + 0; // normalize -0
};

/** Squares of `color`'s non-pawn, non-king pieces. */
export const minorMajorSquares = (board: Board, color: Color): Square[] => {
  const out: Square[] = [];
  for (const role of ['knight', 'bishop', 'rook', 'queen'] as Role[])
    for (const sq of board.pieces(color, role)) out.push(sq);
  return out;
};

/** Re-export for callers that need raw attack sets. */
export { attacks };
