/**
 * Tests for the expanded positionalPurpose() detectors (good-move
 * commentary): open file, 7th rank, outpost, battery, pin release,
 * mobility, simplification. Each FEN is constructed so no earlier
 * fragment in the ladder fires.
 */
import { describe, expect, it } from 'vitest';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import type { NormalMove } from 'chessops/types';
import { parseSquare } from 'chessops/util';
import { positionalPurpose } from '../src/explain/positional';

const pos = (fen: string): Chess => Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
const sq = (name: string) => parseSquare(name)!;
const mv = (uci: string): NormalMove => ({ from: sq(uci.slice(0, 2)), to: sq(uci.slice(2, 4)) });

describe('positionalPurpose — expanded detectors', () => {
  it('rook to an open file', () => {
    const p = pos('r3k2r/ppp2ppp/8/8/8/8/PPP2PPP/R3K2R w KQkq - 0 20');
    expect(positionalPurpose(p, mv('a1d1'), 'white')).toBe('places your rook on the open d-file');
  });

  it('rook seizes the 7th rank (file not open, enemy king on back rank)', () => {
    const p = pos('6k1/5ppp/8/8/3p4/8/5PPP/3R2K1 w - - 0 30');
    expect(positionalPurpose(p, mv('d1d7'), 'white')).toBe('seizes the 7th rank with your rook');
  });

  it('knight lands on a safe outpost', () => {
    const p = pos('r1b1kb1r/pp3ppp/8/8/8/2N5/PPPPPPPP/R1B1KB1R w KQkq - 0 15');
    expect(positionalPurpose(p, mv('c3d5'), 'white')).toBe('plants your knight on a strong outpost');
  });

  it('no outpost when an enemy pawn can challenge the square', () => {
    const p = pos('r1b1kb1r/pp3ppp/2p5/8/8/2N5/PPPPPPPP/R1B1KB1R w KQkq - 0 15');
    expect(positionalPurpose(p, mv('c3d5'), 'white')).not.toBe(
      'plants your knight on a strong outpost',
    );
  });

  it('doubles rooks on a file', () => {
    const p = pos('6k1/3p1ppp/8/4R3/8/8/5PPP/3R2K1 w - - 0 30');
    expect(positionalPurpose(p, mv('e5d5'), 'white')).toBe('doubles your rooks on the d-file');
  });

  it('queen + rook battery', () => {
    const p = pos('6k1/3p1ppp/8/8/8/8/4QPPP/3R2K1 w - - 0 30');
    expect(positionalPurpose(p, mv('e2d2'), 'white')).toBe(
      'forms a queen-and-rook battery on the d-file',
    );
  });

  it('blocking move frees a pinned piece', () => {
    const p = pos('4r1k1/5ppp/8/8/8/4N3/5PPP/3QK3 w - - 0 30');
    expect(positionalPurpose(p, mv('d1e2'), 'white')).toBe('frees your knight from the pin');
  });

  it('bishop gains real scope (mobility ≥ 3)', () => {
    const p = pos('6k1/5ppp/8/8/8/8/1P3PPP/2B3K1 w - - 0 40');
    expect(positionalPurpose(p, mv('c1f4'), 'white')).toBe("improves your bishop's activity");
  });

  it('equal trade while ahead in material', () => {
    const p = pos('3q2k1/5ppp/8/8/8/8/5PPP/R2Q2K1 w - - 0 30');
    expect(positionalPurpose(p, mv('d1d8'), 'white')).toBe(
      'trades pieces, simplifying while ahead in material',
    );
  });

  it('quiet shuffle still returns null (no invented purpose)', () => {
    const p = pos('6k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 40');
    expect(positionalPurpose(p, mv('g1f1'), 'white')).toBeNull();
  });
});
