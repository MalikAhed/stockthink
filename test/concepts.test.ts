import { describe, expect, it } from 'vitest';
import { moveFacts } from '../src/analysis/concepts';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('moveFacts', () => {
  it('describes a quiet developing move', () => {
    const f = moveFacts(START, 'g1f3');
    expect(f.piece).toEqual({ role: 'knight', square: 'f3' });
    expect(f.isCapture).toBe(false);
    expect(f.isCheck).toBe(false);
    expect(f.hangs).toEqual([]);
    expect(f.forkedPieces).toEqual([]);
    expect(f.missedFreePieces).toEqual([]);
  });

  it('describes captures, including en passant', () => {
    const f = moveFacts('1k6/8/8/3p4/4P3/8/8/1K6 w - - 0 1', 'e4d5');
    expect(f.isCapture).toBe(true);
    expect(f.captured).toEqual({ role: 'pawn', square: 'd5' });
    expect(f.winsMaterial).toBe(true);
    const ep = moveFacts('1k6/8/8/4pP2/8/8/8/1K6 w - e6 0 1', 'f5e6');
    expect(ep.isCapture).toBe(true);
    expect(ep.captured?.role).toBe('pawn');
  });

  it('detects castling (and does not re-report pre-existing hanging pieces)', () => {
    const f = moveFacts('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'e1h1');
    expect(f.isCastling).toBe(true);
    expect(f.piece).toEqual({ role: 'king', square: 'g1' });
    expect(f.hangs).toEqual([]); // Ra1 was already hanging before the move
  });

  it('detects a knight fork on queen and rook', () => {
    // Nc3–d5 (defended by the e4 pawn) forks Qc7 and Rf4
    const f = moveFacts('7k/2q5/8/8/4Pr2/2N5/8/K7 w - - 0 1', 'c3d5');
    expect(f.forkedPieces.map(p => p.square).sort()).toEqual(['c7', 'f4']);
  });

  it('detects discovered and double check', () => {
    // Re1 behind Ne4 vs Ke8: Nc5 = discovered check; Nd6 = double check
    const disc = moveFacts('4k3/8/8/8/4N3/8/8/4R2K w - - 0 1', 'e4c5');
    expect(disc.isCheck).toBe(true);
    expect(disc.isDiscoveredCheck).toBe(true);
    expect(disc.isDoubleCheck).toBe(false);
    const dbl = moveFacts('4k3/8/8/8/4N3/8/8/4R2K w - - 0 1', 'e4d6');
    expect(dbl.isCheck).toBe(true);
    expect(dbl.isDoubleCheck).toBe(true);
  });

  it('reports a piece newly left hanging by the move', () => {
    // the f3 knight defends Bd4 against Rd8; Ng1 abandons it
    const f = moveFacts('1k1r4/8/8/8/3B4/5N2/8/1K6 w - - 0 1', 'f3g1');
    expect(f.hangs.map(p => p.square)).toContain('d4');
  });

  it('detects a pin against the king', () => {
    // Bf1–b5 pins the c6 knight to the e8 king
    const f = moveFacts('4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1', 'f1b5');
    expect(f.pins?.front).toEqual({ role: 'knight', square: 'c6' });
    expect(f.pins?.behind.role).toBe('king');
  });

  it('detects a skewer through a queen', () => {
    // Rd1–d3 hits Qd5 with Rd8 behind it on the d-file
    const f = moveFacts('k2r4/8/8/3q4/8/8/8/K2R4 w - - 0 1', 'd1d3');
    expect(f.skewers?.front).toEqual({ role: 'queen', square: 'd5' });
    expect(f.skewers?.behind).toEqual({ role: 'rook', square: 'd8' });
  });

  it('detects a trapped piece', () => {
    // ...Kg7 attacks the h7 bishop; g8 is king-covered and Bxg6 hangs: trapped
    const f = moveFacts('6k1/7B/6p1/8/8/8/8/K7 b - - 0 1', 'g8g7');
    expect(f.trapped).toEqual({ role: 'bishop', square: 'h7' });
  });

  it('reports free enemy pieces the mover ignored', () => {
    // the white e1 rook hangs to Rd1, but black plays Ka8 instead
    const f = moveFacts('1k6/8/8/8/8/8/K7/3rR3 b - - 0 1', 'b8a8');
    expect(f.missedFreePieces).toEqual([{ role: 'rook', square: 'e1' }]);
  });
});
