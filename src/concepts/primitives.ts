/**
 * "Why" detectors — verified board facts for the explanation engine.
 *
 * 1:1 port of the spec's reference detectors (CHESS_WHY_EXPLANATION_ENGINE_SPEC
 * §4, verified against python-chess) onto chessops. Names and semantics are
 * kept identical; the §10 acceptance suite lives in test/detectors.test.ts.
 *
 * Design facts preserved from the reference:
 * - isDefended/isHanging are defender-EXISTENCE tests (x-ray aware) for motif
 *   logic only — never for exchange math (board.ts already provides them).
 * - effectiveDefenders excludes absolutely-pinned defenders whose pin ray
 *   does not include the contested square → "the defender is pinned and
 *   cannot recapture".
 * - seeCapture walks LEGAL captures only, so pins are handled automatically
 *   (a pinned recapture never appears). Negative = losing capture.
 * - forkTargets requires the forker itself to be safe and ≥2 qualifying
 *   targets. King counts as value 99.
 * - isTrapped must be called with the trapped piece's owner to move.
 * - mateThreat uses the null-move trick; never call it when in check.
 */
import { attacks, between, ray } from 'chessops/attacks';
import type { Board } from 'chessops/board';
import { Chess } from 'chessops/chess';
import { SquareSet } from 'chessops/squareSet';
import type { Color, Move, NormalMove, Role, Square } from 'chessops/types';
import { opposite } from 'chessops/util';
import {
  attackersTo,
  canBeTakenByLowerPiece,
  isDefended,
  isHanging,
  isInBadSpot,
  materialCount,
  PIECE_VALUES,
} from './board';

const RAY_ROLES: Role[] = ['bishop', 'rook', 'queen'];

/** Material values with king = 99 (royal fork targets, SEE caps). */
export const KING_VALUES = PIECE_VALUES;

export { isDefended, isHanging, isInBadSpot, canBeTakenByLowerPiece };

/* ------------------------------------------------------------ material --- */

/** Material balance for `color` (positive = ahead), pawns. */
export const materialDiff = (board: Board, color: Color): number =>
  materialCount(board, color) - materialCount(board, opposite(color));

/* ------------------------------------------------------- pins / rays ----- */

/**
 * If the piece on `sq` is absolutely pinned to its own king, return the full
 * pin ray (the line through pinner and king, python-chess `board.pin`
 * semantics). Otherwise null.
 */
export function pinRay(board: Board, sq: Square): SquareSet | null {
  const piece = board.get(sq);
  if (!piece) return null;
  const ksq = board.kingOf(piece.color);
  if (ksq === undefined || ksq === sq) return null;
  const occWithout = board.occupied.without(sq);
  for (const a of attackersTo(board, ksq, opposite(piece.color), occWithout)) {
    if (!RAY_ROLES.includes(board.get(a)!.role)) continue;
    if (!between(a, ksq).has(sq)) continue;
    // path between pinner and king must be clear apart from the pinned piece
    if (between(a, ksq).intersect(occWithout).nonEmpty()) continue;
    return ray(a, ksq);
  }
  return null;
}

/** Absolute pin test (python-chess `board.is_pinned`). */
export const isPinned = (board: Board, sq: Square): boolean => pinRay(board, sq) !== null;

/**
 * Defenders that could actually recapture on `square`: absolutely pinned
 * defenders whose pin ray does not include `square` are excluded.
 */
export function effectiveDefenders(board: Board, square: Square): Square[] {
  const piece = board.get(square);
  if (!piece) return [];
  const out: Square[] = [];
  for (const dsq of attackersTo(board, square, piece.color, board.occupied)) {
    const d = board.get(dsq)!;
    if (d.role !== 'king') {
      const rayOf = pinRay(board, dsq);
      if (rayOf && !rayOf.has(square)) continue;
    }
    out.push(dsq);
  }
  return out;
}

export type CaptureReason = 'undefended' | 'defender_pinned' | 'outnumbered';

/**
 * Why can the piece on `square` be profitably captured?
 * Call only after SEE has confirmed the capture wins material.
 */
export function whyCapturable(board: Board, square: Square): CaptureReason {
  const piece = board.get(square)!;
  const defenders = attackersTo(board, square, piece.color, board.occupied);
  if (defenders.isEmpty()) return 'undefended';
  if (effectiveDefenders(board, square).length === 0) return 'defender_pinned';
  return 'outnumbered';
}

/** The pinned defender of `square` and what it is pinned against. */
export function pinnedDefenderInfo(
  board: Board,
  square: Square,
): { defender: Square; pinnedTo: Square } | null {
  const piece = board.get(square);
  if (!piece) return null;
  for (const dsq of attackersTo(board, square, piece.color, board.occupied)) {
    if (board.get(dsq)!.role === 'king') continue;
    const rayOf = pinRay(board, dsq);
    if (rayOf && !rayOf.has(square)) {
      const ksq = board.kingOf(piece.color)!;
      return { defender: dsq, pinnedTo: ksq };
    }
  }
  return null;
}

/* ------------------------------------------------- trapped (spec §4) ----- */

/**
 * It must be the piece owner's turn. True if an attacked piece has no safe
 * move (and cannot trade itself for equal or better material).
 */
export function isTrapped(pos: Chess, square: Square): boolean {
  const piece = pos.board.get(square);
  if (!piece || piece.role === 'pawn' || piece.role === 'king') return false;
  if (pos.turn !== piece.color) throw new Error('isTrapped requires the piece owner to move');
  if (pos.isCheck() || isPinned(pos.board, square)) return false;
  if (!isInBadSpot(pos.board, square)) return false;
  for (const to of pos.dests(square)) {
    const captured = pos.board.get(to);
    if (captured && PIECE_VALUES[captured.role] >= PIECE_VALUES[piece.role]) return false;
    const probe = pos.clone();
    probe.play({ from: square, to });
    if (!isInBadSpot(probe.board, to)) return false;
  }
  return true;
}

/* --------------------------------- static exchange (legal-move walk) ----- */

/** Least-valuable legal capture onto `square` for the side to move, if any. */
function cheapestLegalCapture(pos: Chess, square: Square): NormalMove | null {
  let best: NormalMove | null = null;
  let bestValue = Infinity;
  for (const [from, dests] of pos.allDests()) {
    if (!dests.has(square)) continue;
    const v = PIECE_VALUES[pos.board.get(from)!.role];
    if (v < bestValue) {
      bestValue = v;
      best = { from, to: square };
    }
  }
  return best;
}

/**
 * Best material the side to move can win on `square` (never negative:
 * capturing is optional). Uses legal moves, so pins are handled automatically.
 */
export function seeSquare(pos: Chess, square: Square): number {
  const target = pos.board.get(square);
  if (!target) return 0;
  const m = cheapestLegalCapture(pos, square);
  if (!m) return 0;
  const b = pos.clone();
  b.play(m);
  return Math.max(0, PIECE_VALUES[target.role] - seeSquare(b, square));
}

/**
 * Net material for the mover of capture `move` (can be negative).
 * Promotions are treated approximately (the promoted piece recaptures at
 * its new value), matching the reference implementation.
 */
export function seeCapture(pos: Chess, move: NormalMove): number {
  const victim = pos.board.get(move.to);
  const isEp =
    pos.board.get(move.from)?.role === 'pawn' && !victim && (move.from - move.to) % 8 !== 0;
  const captured = isEp ? 1 : PIECE_VALUES[victim!.role];
  const b = pos.clone();
  b.play(move);
  return captured - seeSquare(b, move.to);
}

/* ----------------------------------------------------- tactical motifs --- */

/**
 * `board` is the position AFTER the forking piece landed on `square`.
 * Returns ≥2 qualifying target squares, else [].
 */
export function forkTargets(board: Board, square: Square): Square[] {
  const piece = board.get(square);
  if (!piece || piece.role === 'king') return [];
  if (isInBadSpot(board, square)) return []; // the 'forker' can simply be captured
  const targets: Square[] = [];
  for (const tsq of attacks(piece, square, board.occupied)) {
    const t = board.get(tsq);
    if (!t || t.color === piece.color || t.role === 'pawn') continue;
    if (PIECE_VALUES[t.role] > PIECE_VALUES[piece.role]) targets.push(tsq);
    else if (isHanging(board, tsq) && !attacks(t, tsq, board.occupied).has(square))
      targets.push(tsq);
  }
  return targets.length >= 2 ? targets : [];
}

/**
 * (attacker, target) pairs newly opened by `move` vacating its from-square.
 * `posBefore` is the position before the move.
 */
export function discoveredAttacks(
  posBefore: Chess,
  move: NormalMove,
): Array<{ attacker: Square; target: Square }> {
  const us = posBefore.turn;
  const b = posBefore.clone();
  b.play(move);
  const found: Array<{ attacker: Square; target: Square }> = [];
  for (const sq of b.board[us].intersect(b.board.occupied)) {
    const p = b.board.get(sq)!;
    if (sq === move.to || !RAY_ROLES.includes(p.role)) continue;
    for (const t of attacks(p, sq, b.board.occupied)) {
      const tp = b.board.get(t);
      if (!tp || tp.color === us || PIECE_VALUES[tp.role] < 3) continue;
      const attackedBefore = attacks(p, sq, posBefore.board.occupied).has(t);
      if (between(sq, t).has(move.from) && !attackedBefore) found.push({ attacker: sq, target: t });
    }
  }
  return found;
}

/** Did `move` give a check delivered by a piece other than the moved one? */
export function givesDiscoveredCheck(posBefore: Chess, move: NormalMove): boolean {
  const b = posBefore.clone();
  b.play(move);
  if (!b.isCheck()) return false;
  const ksq = b.board.kingOf(b.turn);
  if (ksq === undefined) return false;
  const checkers = b.kingAttackers(ksq, opposite(b.turn), b.board.occupied);
  return checkers.nonEmpty() && !checkers.has(move.to);
}

/**
 * A ray piece captures along a line that the opponent's previous move
 * vacated, and the piece that fled was worth more than the one captured
 * behind it. `posBefore` is the position before `captureMove`.
 */
export function isSkewer(
  posBefore: Chess,
  captureMove: NormalMove,
  prevOppMove: NormalMove,
): boolean {
  const cap = posBefore.board.get(captureMove.from);
  const victim = posBefore.board.get(captureMove.to);
  if (!cap || !victim || !RAY_ROLES.includes(cap.role)) return false;
  if (!between(captureMove.from, captureMove.to).has(prevOppMove.from)) return false;
  const moved = posBefore.board.get(prevOppMove.to);
  return moved !== undefined && PIECE_VALUES[moved.role] > PIECE_VALUES[victim.role];
}

/** Enemy squares newly absolutely-pinned by `move`. */
export function pinsCreated(posBefore: Chess, move: NormalMove): Square[] {
  const b = posBefore.clone();
  b.play(move);
  const them = b.turn;
  const out: Square[] = [];
  for (const sq of b.board[them].intersect(b.board.occupied)) {
    const wasPinned = posBefore.board.get(sq) !== undefined && isPinned(posBefore.board, sq);
    if (isPinned(b.board, sq) && !wasPinned) out.push(sq);
  }
  return out;
}

export interface PinFound {
  /** The ray piece holding the pin. */
  pinner: Square;
  pinned: Square;
  /** The piece behind the pinned one (king for an absolute pin). */
  against: Square;
  absolute: boolean;
}

/**
 * All pin relations held by `color`'s ray pieces on `board`: enemy piece P
 * attacked along a ray with a more valuable enemy piece Q directly behind it
 * (only P between attacker and Q). King behind = absolute pin; otherwise a
 * relative pin — both Q and the attacker must outvalue P, so capturing the
 * unmasked P is profitable and moving P loses material.
 */
export function pinsHeld(board: Board, color: Color): PinFound[] {
  const out: PinFound[] = [];
  for (const sq of board[color]) {
    const piece = board.get(sq)!;
    if (!RAY_ROLES.includes(piece.role)) continue;
    for (const psq of attacks(piece, sq, board.occupied)) {
      const p = board.get(psq);
      if (!p || p.color === color || p.role === 'king') continue;
      // Q = first occupied square behind P, continuing past P away from sq.
      const behind = ray(sq, psq)
        .intersect(board.occupied)
        .without(sq)
        .without(psq);
      let qsq: Square | undefined;
      for (const c of behind) {
        if (!between(sq, c).has(psq)) continue; // wrong side: between attacker and P
        if (between(psq, c).intersect(board.occupied).nonEmpty()) continue; // not adjacent on ray
        qsq = c;
        break;
      }
      if (qsq === undefined) continue;
      const q = board.get(qsq)!;
      if (q.color === color) continue;
      if (q.role === 'king') out.push({ pinner: sq, pinned: psq, against: qsq, absolute: true });
      else if (
        PIECE_VALUES[q.role] > PIECE_VALUES[p.role] &&
        PIECE_VALUES[piece.role] <= PIECE_VALUES[q.role] &&
        // a pinned PAWN is only worth mentioning with a major piece behind it
        (p.role !== 'pawn' || PIECE_VALUES[q.role] >= 5)
      )
        out.push({ pinner: sq, pinned: psq, against: qsq, absolute: false });
    }
  }
  return out;
}

/** Pin relations (absolute or relative) newly created by `move`. */
export function pinsCreatedEx(posBefore: Chess, move: NormalMove): PinFound[] {
  const us = posBefore.turn;
  const b = posBefore.clone();
  b.play(move);
  const beforeKeys = new Set(pinsHeld(posBefore.board, us).map(p => `${p.pinned}-${p.against}`));
  return pinsHeld(b.board, us).filter(p => !beforeKeys.has(`${p.pinned}-${p.against}`));
}

/** `pos` must be a checkmate position. Back-rank mate pattern test. */
export function isBackRankMate(pos: Chess): boolean {
  if (!pos.isCheckmate()) return false;
  const color = pos.turn; // the mated side
  const ksq = pos.board.kingOf(color);
  if (ksq === undefined) return false;
  const back = color === 'black' ? 7 : 0;
  if (ksq >> 3 !== back) return false;
  const step = color === 'black' ? -8 : 8;
  const kf = ksq & 7;
  for (const df of [-1, 0, 1]) {
    const f = kf + df;
    if (f < 0 || f > 7) continue;
    const front = pos.board.get(ksq + step + df);
    if (!front || front.color !== color) return false; // escape square not blocked by own piece
  }
  const checkers = pos.kingAttackers(ksq, opposite(color), pos.board.occupied);
  for (const c of checkers) if (c >> 3 === back) return true;
  return false;
}

/**
 * `pos`: position after the mover's move (opponent to move). Returns the
 * mating move if the mover threatens mate-in-1, else null. Null-move trick;
 * skipped (null) when the side to move is in check.
 */
export function mateThreat(pos: Chess): Move | null {
  if (pos.isCheck()) return null;
  const b = pos.clone();
  b.turn = opposite(b.turn); // null move: hand the mover a free move
  b.epSquare = undefined;
  for (const [from, dests] of b.allDests()) {
    for (const to of dests) {
      const probe = b.clone();
      probe.play({ from, to });
      if (probe.isCheckmate()) return { from, to };
    }
  }
  return null;
}
