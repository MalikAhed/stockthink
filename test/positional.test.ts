/**
 * Positional detectors (V2 M1) — typed facts. FENs from the V1 suite plus
 * castling/fianchetto/regression cases.
 */
import { describe, expect, it } from 'vitest';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import type { NormalMove } from 'chessops/types';
import { parseSquare } from 'chessops/util';
import { positionalPurposes, positionalRegressions } from '../src/concepts/positional';

const pos = (fen: string): Chess => Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
const sq = (name: string) => parseSquare(name)!;
const mv = (uci: string): NormalMove => ({ from: sq(uci.slice(0, 2)), to: sq(uci.slice(2, 4)) });

const kinds = (facts: Array<{ kind: string }>): string[] => facts.map(f => f.kind);

describe('positionalPurposes', () => {
  it('rook to an open file', () => {
    const p = pos('r3k2r/ppp2ppp/8/8/8/8/PPP2PPP/R3K2R w KQkq - 0 20');
    expect(positionalPurposes(p, mv('a1d1'))).toContainEqual({ kind: 'rook_open_file', file: 3 });
  });

  it('rook seizes the 7th rank (enemy king on back rank)', () => {
    const p = pos('6k1/5ppp/8/8/3p4/8/5PPP/3R2K1 w - - 0 30');
    expect(positionalPurposes(p, mv('d1d7'))).toContainEqual({
      kind: 'rook_seventh',
      square: sq('d7'),
    });
  });

  it('knight lands on a safe outpost', () => {
    const p = pos('r1b1kb1r/pp3ppp/8/8/8/2N5/PPPPPPPP/R1B1KB1R w KQkq - 0 15');
    expect(positionalPurposes(p, mv('c3d5'))).toContainEqual({
      kind: 'knight_outpost',
      square: sq('d5'),
    });
  });

  it('no outpost when an enemy pawn can challenge the square', () => {
    const p = pos('r1b1kb1r/pp3ppp/2p5/8/8/2N5/PPPPPPPP/R1B1KB1R w KQkq - 0 15');
    expect(kinds(positionalPurposes(p, mv('c3d5')))).not.toContain('knight_outpost');
  });

  it('doubles rooks on a file', () => {
    const p = pos('6k1/3p1ppp/8/4R3/8/8/5PPP/3R2K1 w - - 0 30');
    expect(positionalPurposes(p, mv('e5d5'))).toContainEqual({
      kind: 'file_battery',
      file: 3,
      partnerRole: 'rook',
    });
  });

  it('queen + rook battery', () => {
    const p = pos('6k1/3p1ppp/8/8/8/8/4QPPP/3R2K1 w - - 0 30');
    expect(positionalPurposes(p, mv('e2d2'))).toContainEqual({
      kind: 'file_battery',
      file: 3,
      partnerRole: 'rook',
    });
  });

  it('blocking move frees a pinned piece', () => {
    const p = pos('4r1k1/5ppp/8/8/8/4N3/5PPP/3QK3 w - - 0 30');
    expect(positionalPurposes(p, mv('d1e2'))).toContainEqual({
      kind: 'releases_pin',
      square: sq('e3'),
      role: 'knight',
    });
  });

  it('bishop gains real scope (mobility ≥ 3)', () => {
    const p = pos('6k1/5ppp/8/8/8/8/1P3PPP/2B3K1 w - - 0 40');
    expect(kinds(positionalPurposes(p, mv('c1f4')))).toContain('mobility_gain');
  });

  it('equal trade while ahead in material', () => {
    const p = pos('3q2k1/5ppp/8/8/8/8/5PPP/R2Q2K1 w - - 0 30');
    expect(positionalPurposes(p, mv('d1d8'))).toContainEqual({
      kind: 'simplifies_ahead',
      lead: 5,
    });
  });

  it('castling short is detected', () => {
    const p = pos('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 10');
    expect(positionalPurposes(p, mv('e1g1'))).toContainEqual({ kind: 'castles', side: 'king' });
  });

  it('fianchetto: bishop to g2', () => {
    const p = pos('rnbqkbnr/pppppppp/8/8/8/5NP1/PPPPPP1P/RNBQKB1R w KQkq - 0 3');
    expect(positionalPurposes(p, mv('f1g2'))).toContainEqual({
      kind: 'fianchetto',
      square: sq('g2'),
    });
  });

  it('passed pawn created by a push (sidesteps the last blocker)', () => {
    const p = pos('6k1/5ppp/8/8/p7/1P6/5PPP/6K1 w - - 0 40');
    expect(positionalPurposes(p, mv('b3b4'))).toContainEqual({
      kind: 'passed_pawn',
      square: sq('b4'),
    });
  });

  it('developing a knight in the opening', () => {
    const p = pos('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(positionalPurposes(p, mv('g1f3'))).toContainEqual({
      kind: 'develops',
      role: 'knight',
      square: sq('f3'),
    });
  });

  it('quiet shuffle yields no facts (nothing invented)', () => {
    const p = pos('6k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 40');
    expect(positionalPurposes(p, mv('g1f1'))).toEqual([]);
  });
});

describe('positionalRegressions', () => {
  it('pushing a shield pawn weakens the king', () => {
    const p = pos('6k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 30');
    expect(kinds(positionalRegressions(p, mv('g2g4')))).toContain('weakens_shield');
  });

  it('a capture creating doubled pawns is flagged', () => {
    const p = pos('6k1/5ppp/8/8/8/7b/5PPP/6K1 w - - 0 30');
    expect(positionalRegressions(p, mv('g2h3'))).toContainEqual({
      kind: 'doubled_pawns',
      file: 7,
    });
  });

  it('knight to the rim', () => {
    const p = pos('6k1/5ppp/8/8/8/2N5/5PPP/6K1 w - - 0 30');
    expect(positionalRegressions(p, mv('c3a4'))).toContainEqual({
      kind: 'rim_knight',
      square: sq('a4'),
    });
  });

  it('a sound central move regresses nothing', () => {
    const p = pos('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(positionalRegressions(p, mv('e2e4'))).toEqual([]);
  });
});
