/**
 * Live "try a move" path: liveMoveReport must run a user move through the
 * SAME pipeline as the pre-analysis (facts → classification → report shape).
 * Both positions are seeded into the cache, so no engine is ever spawned.
 */
import { describe, expect, it } from 'vitest';
import { Chess } from 'chessops/chess';
import { makeFen, parseFen } from 'chessops/fen';
import { parseSquare, parseUci } from 'chessops/util';
import type { NormalMove } from 'chessops/types';
import { liveMoveReport, seedLiveAnalysis } from '@backend/live';
import type { PositionAnalysis } from '@backend/engine/engine';

const seed = (fen: string, cp: number, pvUci: string[]): void => {
  const analysis: PositionAnalysis = {
    fen,
    lines: pvUci.length ? [{ multipv: 1, depth: 20, eval: { cp }, pvUci }] : [],
    bestmoveUci: pvUci[0] ?? null,
    terminal: pvUci.length === 0,
  };
  seedLiveAnalysis(fen, analysis);
};

const afterFen = (fen: string, uci: string): string => {
  const pos = Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
  pos.play(parseUci(uci) as NormalMove);
  return makeFen(pos.toSetup());
};

describe('liveMoveReport', () => {
  it('a hung queen comes back as a blunder with the hangs_piece fact', async () => {
    const before = '6k1/8/8/4r3/8/8/8/3Q2K1 w - - 0 1';
    const after = afterFen(before, 'd1d5');
    seed(before, 0, ['d1a1', 'e5e8']);
    seed(after, -900, ['e5d5', 'g1f1']);
    const m = await liveMoveReport(before, { from: parseSquare('d1')!, to: parseSquare('d5')! }, 1);
    expect(m).toBeTruthy();
    expect(m!.san).toBe('Qd5+');
    expect(m!.classification).toBe('blunder');
    expect(m!.facts.some(f => f.kind === 'hangs_piece')).toBe(true);
    expect(m!.fenAfter).toBe(after);
  });

  it('normalizes a chessground castling drag (e1g1) into O-O', async () => {
    const before = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
    const after = afterFen(before, 'e1h1'); // chessops encodes castling king-takes-rook
    seed(before, 30, ['e1h1', 'e8h8']);
    seed(after, 30, ['e8h8', 'a1e1']);
    const m = await liveMoveReport(before, { from: parseSquare('e1')!, to: parseSquare('g1')! }, 1);
    expect(m).toBeTruthy();
    expect(m!.san).toBe('O-O');
    expect(m!.classification).toBe('best');
  });

  it('rejects an illegal move with null instead of guessing', async () => {
    const before = '6k1/8/8/4r3/8/8/8/3Q2K1 w - - 0 1';
    const m = await liveMoveReport(before, { from: parseSquare('d1')!, to: parseSquare('e3')! }, 1);
    expect(m).toBeNull();
  });
});
