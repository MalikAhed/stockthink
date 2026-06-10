/**
 * Concept detector: engine-verified tactical facts about a single move.
 * Clean-room ports of the lichess-puzzler tagger motifs (tagger/cook.py,
 * MIT) onto chessops. Every fact is computed from the board — the
 * commentary layer only rewords facts, so it cannot hallucinate.
 */
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { SquareSet } from 'chessops/squareSet';
import type { Role, Square } from 'chessops/types';
import { makeSquare, opposite, parseUci } from 'chessops/util';
import { attacks, ray } from 'chessops/attacks';
import {
  attackersTo,
  isHanging,
  isInBadSpot,
  minorMajorSquares,
  PIECE_VALUES,
  see,
} from './board';

export interface PieceOn {
  role: Role;
  square: string; // algebraic, e.g. "f7"
}

export interface MoveFacts {
  /** The piece that moved (post-promotion role). */
  piece: PieceOn;
  isCapture: boolean;
  captured?: PieceOn;
  isCheck: boolean;
  isDoubleCheck: boolean;
  isDiscoveredCheck: boolean;
  isCastling: boolean;
  isPromotion: boolean;
  /** Mover's own pieces newly left capturable (worst first). */
  hangs: PieceOn[];
  /** The capture wins material outright (SEE > 0 on the capture). */
  winsMaterial: boolean;
  /** ≥2 enemy non-pawn pieces attacked from a safe square. */
  forkedPieces: PieceOn[];
  /** Enemy piece pinned to a more valuable one (incl. king) by the moved piece. */
  pins?: { front: PieceOn; behind: PieceOn };
  /** Enemy piece attacked through a more valuable front piece forced to move. */
  skewers?: { front: PieceOn; behind: PieceOn };
  /** Enemy non-pawn piece left with no safe square after this move. */
  trapped?: PieceOn;
  /** Enemy hanging pieces the mover could capture right now (before moving). */
  missedFreePieces: PieceOn[];
}

const pieceOn = (board: Chess['board'], sq: Square): PieceOn => ({
  role: board.get(sq)!.role,
  square: makeSquare(sq),
});

const chessFrom = (fen: string): Chess => Chess.fromSetup(parseFen(fen).unwrap()).unwrap();

/** Compute all verified facts for one move (UCI) played from `fenBefore`. */
export function moveFacts(fenBefore: string, uci: string): MoveFacts {
  const posBefore = chessFrom(fenBefore);
  const move = parseUci(uci);
  if (!move || !('from' in move)) throw new Error(`bad uci: ${uci}`);
  if (!posBefore.isLegal(move)) throw new Error(`illegal move ${uci} in ${fenBefore}`);

  const mover = posBefore.turn;
  const movedRole = posBefore.board.get(move.from)!.role;
  const isCastling = movedRole === 'king' && posBefore.board.get(move.to)?.color === mover;

  // capture info (incl. en passant)
  const victim = isCastling ? undefined : posBefore.board.get(move.to);
  const isEp =
    movedRole === 'pawn' && !victim && (move.from - move.to) % 8 !== 0;
  const captured: PieceOn | undefined = victim
    ? { role: victim.role, square: makeSquare(move.to) }
    : isEp
      ? { role: 'pawn', square: makeSquare(move.to) }
      : undefined;

  // hanging enemy pieces the mover could have captured instead
  const missedFreePieces: PieceOn[] = minorMajorSquares(posBefore.board, opposite(mover))
    .filter(
      sq =>
        sq !== move.to &&
        isHanging(posBefore.board, sq) &&
        attackersTo(posBefore.board, sq, mover, posBefore.board.occupied).nonEmpty(),
    )
    .map(sq => pieceOn(posBefore.board, sq));

  const hangingBefore = new Set(
    minorMajorSquares(posBefore.board, mover).filter(sq => isHanging(posBefore.board, sq)),
  );

  const posAfter = posBefore.clone();
  posAfter.play(move);
  const board = posAfter.board;
  const dest = isCastling ? board.pieces(mover, 'king').first()! : move.to;
  const destRole = board.get(dest)!.role;

  // checks
  const checkers = posAfter.isCheck()
    ? posAfter.kingAttackers(
        board.pieces(opposite(mover), 'king').first()!,
        mover,
        board.occupied,
      )
    : SquareSet.empty();
  const isCheck = checkers.nonEmpty();
  const isDoubleCheck = checkers.size() >= 2;
  const isDiscoveredCheck = isCheck && !checkers.has(dest);

  // own pieces newly hanging after the move (worst first)
  const hangs = minorMajorSquares(board, mover)
    .filter(sq => !hangingBefore.has(sq) && isHanging(board, sq))
    .sort((a, b) => PIECE_VALUES[board.get(b)!.role] - PIECE_VALUES[board.get(a)!.role])
    .map(sq => pieceOn(board, sq));

  // fork from the destination square (cook.py): safe square, ≥2 targets that
  // are higher-valued or hanging-and-not-defending-the-forker
  const forkedPieces: PieceOn[] = [];
  if (destRole !== 'king' && !isInBadSpot(board, dest)) {
    const attacked = attacks(board.get(dest)!, dest, board.occupied);
    for (const sq of attacked) {
      const target = board.get(sq);
      if (!target || target.color === mover || target.role === 'pawn') continue;
      if (
        PIECE_VALUES[target.role] > PIECE_VALUES[destRole] ||
        (isHanging(board, sq) &&
          !attackersTo(board, dest, target.color, board.occupied).has(sq))
      )
        forkedPieces.push(pieceOn(board, sq));
    }
    forkedPieces.sort((a, b) => PIECE_VALUES[b.role] - PIECE_VALUES[a.role]);
  }

  // pin / skewer along the moved ray piece's line
  let pins: MoveFacts['pins'];
  let skewers: MoveFacts['skewers'];
  if (['bishop', 'rook', 'queen'].includes(destRole)) {
    for (const front of attacks(board.get(dest)!, dest, board.occupied)) {
      const frontPiece = board.get(front);
      if (!frontPiece || frontPiece.color === mover) continue;
      // continue the ray behind the front piece
      const behindRay = ray(dest, front).intersect(
        attacks(board.get(dest)!, dest, board.occupied.without(front)),
      );
      for (const behind of behindRay) {
        if (behind === front || ray(dest, front).has(behind) === false) continue;
        // `behind` must be farther from dest than `front` on the same ray
        if (!isBeyond(dest, front, behind)) continue;
        const behindPiece = board.get(behind);
        if (!behindPiece || behindPiece.color === mover) continue;
        const fv = PIECE_VALUES[frontPiece.role];
        const bv = PIECE_VALUES[behindPiece.role];
        if (bv > fv && frontPiece.role !== 'king')
          pins = { front: pieceOn(board, front), behind: pieceOn(board, behind) };
        else if (fv > bv && frontPiece.role !== 'pawn')
          skewers = { front: pieceOn(board, front), behind: pieceOn(board, behind) };
      }
    }
  }

  // trapped enemy piece (cook.py is_trapped, on the position after the move)
  let trapped: PieceOn | undefined;
  if (!isCheck) {
    for (const sq of minorMajorSquares(board, opposite(mover))) {
      if (!isInBadSpot(board, sq)) continue;
      if (isTrapped(posAfter, sq)) {
        trapped = pieceOn(board, sq);
        break;
      }
    }
  }

  return {
    piece: { role: destRole, square: makeSquare(dest) },
    isCapture: captured !== undefined,
    captured,
    isCheck,
    isDoubleCheck,
    isDiscoveredCheck,
    isCastling,
    isPromotion: 'promotion' in move && move.promotion !== undefined,
    hangs,
    winsMaterial:
      captured !== undefined && see(posBefore, move.from, move.to) > 0 && !isCastling,
    forkedPieces,
    pins,
    skewers,
    trapped,
    missedFreePieces,
  };
}

/** Is `behind` on the ray dest→front, farther from dest than front? */
const isBeyond = (dest: Square, front: Square, behind: Square): boolean => {
  if (!ray(dest, front).has(behind)) return false;
  const d = (a: Square, b: Square) =>
    Math.max(Math.abs((a & 7) - (b & 7)), Math.abs((a >> 3) - (b >> 3)));
  return d(dest, behind) > d(dest, front);
};

/** cook.py is_trapped: no escape leads to safety or wins equal material. */
function isTrapped(pos: Chess, square: Square): boolean {
  const piece = pos.board.get(square)!;
  if (piece.role === 'pawn' || piece.role === 'king') return false;
  // the trapped side is not necessarily to move; probe from their POV
  const probeBase = pos.clone();
  if (probeBase.turn !== piece.color) {
    probeBase.turn = piece.color;
    if (probeBase.isCheck()) return false; // can't probe legally
  }
  if (probeBase.isCheck()) return false;
  if (probeBase.ctx().blockers.has(square)) return false; // pinned ≠ trapped
  const dests = probeBase.dests(square);
  for (const to of dests) {
    const target = probeBase.board.get(to);
    if (target && PIECE_VALUES[target.role] >= PIECE_VALUES[piece.role]) return false;
    const probe = probeBase.clone();
    probe.play({ from: square, to });
    if (!isInBadSpot(probe.board, to)) return false;
  }
  return true;
}
