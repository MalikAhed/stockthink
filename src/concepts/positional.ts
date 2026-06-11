/**
 * Positional move-level detectors (V2 spec stage 2, M1) — cheap, fully
 * board-verifiable geometry. Emits TYPED FACTS, never prose (the composer
 * words them later). Returns every fact that fires, strongest first; the
 * composer takes the head and "explain more" reveals the rest.
 *
 * Ported from V1 explain/positional.ts (priority order kept) + chess_review.py
 * (MIT): castling and fianchetto added.
 */
import { attacks, between } from 'chessops/attacks';
import type { Board } from 'chessops/board';
import { Chess } from 'chessops/chess';
import type { Color, NormalMove, Role, Square } from 'chessops/types';
import { makeSquare, opposite, parseSquare } from 'chessops/util';
import { attackersTo, PIECE_VALUES } from './board';
import { isPinned, materialDiff } from './primitives';

export type PositionalFact =
  | { kind: 'castles'; side: 'king' | 'queen' }
  | { kind: 'passed_pawn'; square: string }
  | { kind: 'simplifies_ahead'; lead: number }
  | { kind: 'releases_pin'; square: string; role: Role }
  | { kind: 'rook_open_file'; file: number }
  | { kind: 'rook_seventh'; square: string }
  | { kind: 'knight_outpost'; square: string }
  | { kind: 'file_battery'; file: number; partnerRole: Role }
  | { kind: 'fianchetto'; square: string }
  | { kind: 'develops'; role: Role; square: string }
  | { kind: 'improves_shield' }
  | { kind: 'center_gain' }
  | { kind: 'mobility_gain'; role: Role; gain: number };

export type RegressionFact =
  | { kind: 'weakens_shield' }
  | { kind: 'opens_king_file'; file: number }
  | { kind: 'doubled_pawns'; file: number }
  | { kind: 'isolated_pawn'; file: number }
  | { kind: 'rim_knight'; square: string }
  | { kind: 'lags_development' }
  | { kind: 'cedes_center' };

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

const HOME_MINORS: Record<Color, Square[]> = {
  white: ['b1', 'g1', 'c1', 'f1'].map(s => parseSquare(s)!),
  black: ['b8', 'g8', 'c8', 'f8'].map(s => parseSquare(s)!),
};

function undevelopedMinors(board: Board, color: Color): number {
  let n = 0;
  for (const sq of HOME_MINORS[color]) {
    const p = board.get(sq);
    if (p && p.color === color && (p.role === 'knight' || p.role === 'bishop')) n++;
  }
  return n;
}

function mobility(board: Board, color: Color, sq: Square): number {
  const p = board.get(sq);
  if (!p) return 0;
  return attacks(p, sq, board.occupied).diff(board[color]).size();
}

/** Outpost candidates (mover's POV): c5/d5/e5/f5 for white, c4/d4/e4/f4 for black. */
const OUTPOSTS: Record<Color, Square[]> = {
  white: ['c5', 'd5', 'e5', 'f5'].map(s => parseSquare(s)!),
  black: ['c4', 'd4', 'e4', 'f4'].map(s => parseSquare(s)!),
};

/** No enemy pawn can ever advance to attack `sq` (adjacent files, ranks in front). */
function safeFromEnemyPawns(board: Board, color: Color, sq: Square): boolean {
  const f = fileOf(sq);
  const r = rankOf(sq);
  for (const esq of board.pieces(opposite(color), 'pawn')) {
    if (Math.abs(fileOf(esq) - f) !== 1) continue;
    if (color === 'white' ? rankOf(esq) > r : rankOf(esq) < r) return false;
  }
  return true;
}

/** Own rook/queen connected to `sq` along its file (empty squares between). */
function fileBatteryPartner(board: Board, color: Color, sq: Square): Square | null {
  const heavies = board.pieces(color, 'rook').union(board.pieces(color, 'queen'));
  for (const h of heavies) {
    if (h === sq || fileOf(h) !== fileOf(sq)) continue;
    if (between(h, sq).intersect(board.occupied).isEmpty()) return h;
  }
  return null;
}

/** Enemy rook/queen sitting on `file`? */
function enemyHeavyOnFile(board: Board, color: Color, file: number): boolean {
  const heavies = board
    .pieces(opposite(color), 'rook')
    .union(board.pieces(opposite(color), 'queen'));
  for (const sq of heavies) if (fileOf(sq) === file) return true;
  return false;
}

/** Shield accounting only matters once the king has left the central files
 *  (an uncastled king pushing e4/d4 is not "weakening its shield"). */
function shieldRelevant(board: Board, color: Color): boolean {
  const ksq = board.kingOf(color);
  return ksq !== undefined && fileOf(ksq) !== 3 && fileOf(ksq) !== 4;
}

const FIANCHETTO: Record<Color, Square[]> = {
  white: ['b2', 'g2'].map(s => parseSquare(s)!),
  black: ['b7', 'g7'].map(s => parseSquare(s)!),
};

/* ---------------------------------------------------------------------- */

/**
 * Every verified positional improvement achieved by `mv`, strongest first
 * (V1 priority order; castling on top).
 */
export function positionalPurposes(posBefore: Chess, mv: NormalMove): PositionalFact[] {
  const mover = posBefore.turn;
  const after = posBefore.clone();
  after.play(mv);
  const b0 = posBefore.board;
  const b1 = after.board;
  const out: PositionalFact[] = [];

  // castles (chessops: castling arrives as king-takes-rook or a 2-file king hop)
  const movedBefore = b0.get(mv.from);
  if (movedBefore?.role === 'king') {
    const toRook = b0.get(mv.to)?.role === 'rook' && b0.get(mv.to)!.color === mover;
    const hop = Math.abs(fileOf(mv.to) - fileOf(mv.from)) === 2;
    if (toRook || hop) out.push({ kind: 'castles', side: fileOf(mv.to) > fileOf(mv.from) ? 'king' : 'queen' });
  }

  const moved = b1.get(mv.to) ?? movedBefore; // castling may leave mv.to occupied by the rook

  // creates a passed pawn
  if (
    moved?.role === 'pawn' &&
    b1.get(mv.to)?.role === 'pawn' &&
    isPassedPawn(b1, mover, mv.to) &&
    !(b0.get(mv.from)?.role === 'pawn' && isPassedPawn(b0, mover, mv.from))
  )
    out.push({ kind: 'passed_pawn', square: makeSquare(mv.to) });

  // trades down while ahead (equal-value capture, lead ≥ a minor piece)
  const victim = b0.get(mv.to);
  if (
    victim &&
    victim.color !== mover &&
    movedBefore &&
    PIECE_VALUES[victim.role] === PIECE_VALUES[movedBefore.role] &&
    materialDiff(b0, mover) >= 3
  )
    out.push({ kind: 'simplifies_ahead', lead: materialDiff(b0, mover) });

  // frees a piece from a pin
  for (const sq of b1[mover]) {
    const p1 = b1.get(sq);
    if (!p1 || p1.role === 'king' || sq === mv.to) continue;
    if (b0.get(sq)?.role === p1.role && isPinned(b0, sq) && !isPinned(b1, sq))
      out.push({ kind: 'releases_pin', square: makeSquare(sq), role: p1.role });
  }

  // rook to an open file
  if (
    moved?.role === 'rook' &&
    fileOf(mv.to) !== fileOf(mv.from) &&
    pawnsOnFile(b1, mover, fileOf(mv.to)) === 0 &&
    pawnsOnFile(b1, opposite(mover), fileOf(mv.to)) === 0
  )
    out.push({ kind: 'rook_open_file', file: fileOf(mv.to) });

  // rook seizes the 7th (enemy king on back rank or pawns to harass)
  if (moved?.role === 'rook') {
    const seventh = mover === 'white' ? 6 : 1;
    const back = mover === 'white' ? 7 : 0;
    if (rankOf(mv.to) === seventh && rankOf(mv.from) !== seventh) {
      const eking = b1.kingOf(opposite(mover));
      let enemyPawns = 0;
      for (const esq of b1.pieces(opposite(mover), 'pawn'))
        if (rankOf(esq) === seventh) enemyPawns++;
      if ((eking !== undefined && rankOf(eking) === back) || enemyPawns > 0)
        out.push({ kind: 'rook_seventh', square: makeSquare(mv.to) });
    }
  }

  // knight outpost
  if (
    moved?.role === 'knight' &&
    OUTPOSTS[mover].includes(mv.to) &&
    safeFromEnemyPawns(b1, mover, mv.to)
  )
    out.push({ kind: 'knight_outpost', square: makeSquare(mv.to) });

  // new heavy-piece file battery
  if (moved && (moved.role === 'rook' || moved.role === 'queen')) {
    const partner = fileBatteryPartner(b1, mover, mv.to);
    const had =
      fileOf(mv.from) === fileOf(mv.to) && fileBatteryPartner(b0, mover, mv.from) !== null;
    if (partner !== null && !had)
      out.push({ kind: 'file_battery', file: fileOf(mv.to), partnerRole: b1.get(partner)!.role });
  }

  // fianchetto (bishop to b2/g2/b7/g7 behind the knight-pawn)
  if (moved?.role === 'bishop' && FIANCHETTO[mover].includes(mv.to))
    out.push({ kind: 'fianchetto', square: makeSquare(mv.to) });

  // develops a minor in the opening
  if (posBefore.fullmoves <= 12 && HOME_MINORS[mover].includes(mv.from)) {
    const p = b1.get(mv.to);
    if (
      p &&
      (p.role === 'knight' || p.role === 'bishop') &&
      !(fileOf(mv.to) === 0 || fileOf(mv.to) === 7)
    )
      out.push({ kind: 'develops', role: p.role, square: makeSquare(mv.to) });
  }

  // improves the king's pawn shield (castled-ish kings only)
  if (
    shieldRelevant(b1, mover) &&
    pawnShieldCount(b1, mover) > pawnShieldCount(b0, mover) + 1
  )
    out.push({ kind: 'improves_shield' });

  // strengthens the center
  if (centerControl(b1, mover) >= centerControl(b0, mover) + 2) out.push({ kind: 'center_gain' });

  // a minor piece gains real scope
  if (moved && (moved.role === 'knight' || moved.role === 'bishop')) {
    const gain = mobility(b1, mover, mv.to) - mobility(b0, mover, mv.from);
    if (gain >= 3) out.push({ kind: 'mobility_gain', role: moved.role, gain });
  }

  return out;
}

/**
 * Every verified positional regression caused by `mv`, worst first
 * (V1 priority: king safety > pawn structure > development > center).
 */
export function positionalRegressions(posBefore: Chess, mv: NormalMove): RegressionFact[] {
  const mover = posBefore.turn;
  const after = posBefore.clone();
  after.play(mv);
  const b0 = posBefore.board;
  const b1 = after.board;
  const out: RegressionFact[] = [];

  if (shieldRelevant(b0, mover) && pawnShieldCount(b1, mover) < pawnShieldCount(b0, mover))
    out.push({ kind: 'weakens_shield' });

  const ksq = b1.kingOf(mover);
  if (ksq !== undefined) {
    const kf = fileOf(ksq);
    if (
      pawnsOnFile(b0, mover, kf) > 0 &&
      pawnsOnFile(b1, mover, kf) === 0 &&
      enemyHeavyOnFile(b1, mover, kf)
    )
      out.push({ kind: 'opens_king_file', file: kf });
  }

  for (const f of doubledFiles(b1, mover))
    if (!doubledFiles(b0, mover).has(f)) out.push({ kind: 'doubled_pawns', file: f });

  for (const f of isolatedFiles(b1, mover))
    if (!isolatedFiles(b0, mover).has(f)) out.push({ kind: 'isolated_pawn', file: f });

  const moved = b1.get(mv.to);
  if (moved?.role === 'knight' && (fileOf(mv.to) === 0 || fileOf(mv.to) === 7))
    out.push({ kind: 'rim_knight', square: makeSquare(mv.to) });

  if (posBefore.fullmoves <= 12) {
    const own = undevelopedMinors(b1, mover);
    const theirs = undevelopedMinors(b1, opposite(mover));
    const developed = HOME_MINORS[mover].includes(mv.from);
    if (own >= theirs + 2 && !developed) out.push({ kind: 'lags_development' });
  }

  if (centerControl(b1, mover) <= centerControl(b0, mover) - 2) out.push({ kind: 'cedes_center' });

  return out;
}
