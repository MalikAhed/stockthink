import { describe, expect, it } from 'vitest';
import { parseGame } from '@backend/analysis/pgn';

const CHESSCOM_PGN = `[Event "Live Chess"]
[Site "Chess.com"]
[White "alice"]
[Black "bob"]
[Result "1-0"]
[WhiteElo "1500"]
[BlackElo "1480"]

1. e4 {[%clk 0:02:58.7]} e5 {[%clk 0:02:57]} 2. Nf3 {[%clk 0:02:55]} Nc6
3. Bc4 Nf6 4. O-O 1-0`;

describe('parseGame', () => {
  it('parses headers, plies, fens and clocks from a chess.com PGN', () => {
    const g = parseGame(CHESSCOM_PGN);
    expect(g.headers.White).toBe('alice');
    expect(g.plies).toHaveLength(7);
    expect(g.fens).toHaveLength(8);
    expect(g.initialFen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    const e4 = g.plies[0];
    expect(e4).toMatchObject({ ply: 1, moveNumber: 1, color: 'white', san: 'e4', uci: 'e2e4' });
    expect(e4.clockSeconds).toBeCloseTo(178.7);
    expect(e4.fenAfter).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
    expect(g.plies[1]).toMatchObject({ color: 'black', moveNumber: 1, san: 'e5' });
  });

  it('emits castling in chess960/king-takes-rook UCI form (matches UCI_Chess960 engine)', () => {
    const g = parseGame(CHESSCOM_PGN);
    expect(g.plies[6].san).toBe('O-O');
    expect(g.plies[6].uci).toBe('e1h1');
  });

  it('supports a custom starting position via FEN header', () => {
    const g = parseGame('[FEN "7k/R7/6K1/8/8/8/8/8 b - - 0 1"]\n\n1... Kg8');
    expect(g.initialFen).toBe('7k/R7/6K1/8/8/8/8/8 b - - 0 1');
    expect(g.plies[0].san).toBe('Kg8');
  });

  it('computes the EPD after each move', () => {
    const g = parseGame('1. e4');
    expect(g.plies[0].epdAfter).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -');
  });

  it('throws on garbage and on illegal moves', () => {
    expect(() => parseGame('')).toThrow();
    expect(() => parseGame('1. e4 e5 2. Ke2 Bc5 3. Ke1')).not.toThrow();
    expect(() => parseGame('1. e5')).toThrow(/Illegal/);
  });
});
