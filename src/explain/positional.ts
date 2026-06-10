/**
 * Positional layer (spec §6.5) — cheap, fully board-verifiable features.
 * Reports the WORST regression for a bad move (positionalRegression) or the
 * BEST improvement for a good move (positionalPurpose). All fragments are
 * derived from pawn/piece geometry only — nothing speculative.
 */
import type { Board } from 'chessops/board';
import { Chess } from 'chessops/chess';
import type { Color, NormalMove, Square } from 'chessops/types';
import { opposite, parseSquare } from 'chessops/util';
import { attackersTo } from '../analysis/board';

const FILES = 'abcdefgh';
const fileOf = (sq: Square): number => sq & 7;
const rankOf = (sq: Square): number => sq >> 3;

const pawnsOnFile = (board: Board, color: Color, file: number): number => {
  let n = 0;
  for (const sq of board.pieces(color, 'pawn')) if (fileOf(sq) === file) n++;
  return n;
};

/** Own pawns on the king's file ±1, one or two ranks in front of the king. */
function pawnShieldCount(board: Board, color: Color): number {
  const ksq = board.kingOf(color);
  if (ksq === undefined) return 0;
  const dir = color === 'white' ? 1 : -1;
  let n = 0;
  for (const df of [-1, 0, 1]) {
    const f = fileOf(ksq) + df;
    if (f < 0 || f > 7) continue;
    for (const dr of [1, 2]) {
      const r = rankOf(ksq) + dir * dr;
      if (r < 0 || r > 7) continue;
      const p = board.get(r * 8 + f);
      if (p && p.color === color && p.role === 'pawn') n++;
    }
  }
  return n;
}

/** Is the pawn of `color` on `sq` passed (no enemy pawns ahead on file ±1)? */
function isPassedPawn(board: Board, color: Color, sq: Square): boolean {
  const f = fileOf(sq);
  const r = rankOf(sq);
  for (const esq of board.pieces(opposite(color), 'pawn')) {
    if (Math.abs(fileOf(esq) - f) > 1) continue;
    if (color === 'white' ? rankOf(esq) > r : rankOf(esq) < r) return false;
  }
  return true;
}

/** Files containing ≥2 own pawns. */
function doubledFiles(board: Board, color: Color): Set<number> {
  const out = new Set<number>();
  for (let f = 0; f < 8; f++) if (pawnsOnFile(board, color, f) >= 2) out.add(f);
  return out;
}

/** Files with an own pawn but no own pawns on adjacent files. */
function isolatedFiles(board: Board, color: Color): Set<number> {
  const out = new Set<number>();
  for (let f = 0; f < 8; f++) {
    if (pawnsOnFile(board, color, f) === 0) continue;
    const left = f > 0 ? pawnsOnFile(board, color, f - 1) : 0;
    const right = f < 7 ? pawnsOnFile(board, color, f + 1) : 0;
    if (left + right === 0) out.add(f);
  }
  return out;
}

const CENTER: Square[] = ['d4', 'e4', 'd5', 'e5'].map(s => parseSquare(s)!);

/** How many of `color`'s pieces/pawns attack the four center squares (sum). */
function centerControl(board: Board, color: Color): number {
  let n = 0;
  for (const sq of CENTER) n += attackersTo(board, sq, color, board.occupied).size();
  return n;
}

/** Home squares of the minor pieces. */
const HOME_MINORS: Record<Color, Square[]> = {
  white: ['b1', 'g1', 'c1', 'f1'].map(s => parseSquare(s)!),
  black: ['b8', 'g8', 'c8', 'f8'].map(s => parseSquare(s)!),
};

/** Minor pieces still sitting on their home squares. */
function undevelopedMinors(board: Board, color: Color): number {
  let n = 0;
  for (const sq of HOME_MINORS[color]) {
    const p = board.get(sq);
    if (p && p.color === color && (p.role === 'knight' || p.role === 'bishop')) n++;
  }
  return n;
}

/** Enemy rook/queen sitting on `file`? */
function enemyHeavyOnFile(board: Board, color: Color, file: number): boolean {
  const heavies = board.pieces(opposite(color), 'rook').union(board.pieces(opposite(color), 'queen'));
  for (const sq of heavies) if (fileOf(sq) === file) return true;
  return false;
}

/* ---------------------------------------------------------------------- */

/**
 * Worst verified positional regression caused by playing `mv` (bad moves).
 * Priority: king safety > pawn structure > development > center.
 */
export function positionalRegression(
  posBefore: Chess,
  mv: NormalMove,
  mover: Color,
): string | null {
  const after = posBefore.clone();
  after.play(mv);
  const b0 = posBefore.board;
  const b1 = after.board;

  // king pawn shield weakened
  if (pawnShieldCount(b1, mover) < pawnShieldCount(b0, mover))
    return 'weakens the pawn shield in front of your king';

  // opens a file against own king
  const ksq = b1.kingOf(mover);
  if (ksq !== undefined) {
    const kf = fileOf(ksq);
    if (
      pawnsOnFile(b0, mover, kf) > 0 &&
      pawnsOnFile(b1, mover, kf) === 0 &&
      enemyHeavyOnFile(b1, mover, kf)
    )
      return `opens the ${FILES[kf]}-file against your king`;
  }

  // new doubled pawns
  for (const f of doubledFiles(b1, mover))
    if (!doubledFiles(b0, mover).has(f)) return `creates doubled ${FILES[f]}-pawns`;

  // newly isolated pawn
  for (const f of isolatedFiles(b1, mover))
    if (!isolatedFiles(b0, mover).has(f)) return `leaves the ${FILES[f]}-pawn isolated`;

  // knight to the rim
  const moved = b1.get(mv.to);
  if (moved?.role === 'knight' && (fileOf(mv.to) === 0 || fileOf(mv.to) === 7))
    return 'puts the knight offside on the rim';

  // falls behind in development (opening only)
  if (posBefore.fullmoves <= 12) {
    const own = undevelopedMinors(b1, mover);
    const theirs = undevelopedMinors(b1, opposite(mover));
    const developed = HOME_MINORS[mover].includes(mv.from);
    if (own >= theirs + 2 && !developed) return 'falls behind in development';
  }

  // gives up central control
  if (centerControl(b1, mover) <= centerControl(b0, mover) - 2)
    return 'gives up control of the center';

  return null;
}

/**
 * Best verified positional improvement achieved by `mv` (good moves).
 */
export function positionalPurpose(
  posBefore: Chess,
  mv: NormalMove,
  mover: Color,
): string | null {
  const after = posBefore.clone();
  after.play(mv);
  const b0 = posBefore.board;
  const b1 = after.board;

  // creates a passed pawn (the moved pawn, or a pawn revealed by a capture)
  const moved = b1.get(mv.to);
  if (
    moved?.role === 'pawn' &&
    isPassedPawn(b1, mover, mv.to) &&
    !(b0.get(mv.from)?.role === 'pawn' && isPassedPawn(b0, mover, mv.from))
  )
    return `creates a passed ${FILES[fileOf(mv.to)]}-pawn`;

  // develops a minor piece in the opening
  if (posBefore.fullmoves <= 12 && HOME_MINORS[mover].includes(mv.from)) {
    const p = b1.get(mv.to);
    if (p && (p.role === 'knight' || p.role === 'bishop') && !(fileOf(mv.to) === 0 || fileOf(mv.to) === 7))
      return 'develops a piece';
  }

  // improves the king's pawn shield (rare outside castling, which is flagged elsewhere)
  if (pawnShieldCount(b1, mover) > pawnShieldCount(b0, mover) + 1)
    return 'shores up the pawn cover in front of your king';

  // strengthens the center
  if (centerControl(b1, mover) >= centerControl(b0, mover) + 2)
    return 'increases your control of the center';

  return null;
}
