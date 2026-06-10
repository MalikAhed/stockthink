/**
 * End-to-end robustness on realistic PGN inputs (real engine, low depth):
 * chess.com-style export with clocks, mate finish, promotion, stalemate.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { openingBook } from '../src/analysis/openings';
import { parseGame } from '../src/analysis/pgn';
import { buildReport, type GameReport } from '../src/analysis/report';
import { moveFacts } from '../src/analysis/concepts';
import { commentFor } from '../src/analysis/commentary';
import { EnginePool } from '../src/engine/pool';
import { ChildProcessTransport, setupEngineFiles } from './helpers/transport';

let pool: EnginePool;
beforeAll(async () => {
  pool = await EnginePool.create(() => new ChildProcessTransport(setupEngineFiles()), 2, {
    multiPv: 2,
    hashMb: 32,
  });
}, 120_000);
afterAll(() => pool.dispose());

async function review(pgn: string): Promise<GameReport> {
  const game = parseGame(pgn);
  const analyses = await pool.analyzeAll(game.fens, { depth: 8 });
  return buildReport(game, analyses, { openings: openingBook() });
}

// Légall's mate with chess.com-style headers and clock comments
const CHESSCOM_STYLE = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2026.06.10"]
[White "légall_fan <3"]
[Black "duke2026"]
[Result "1-0"]
[TimeControl "180"]
[WhiteElo "1432"]
[BlackElo "1455"]
[Termination "légall_fan <3 won by checkmate"]

1. e4 {[%clk 0:02:59.1]} e5 {[%clk 0:02:58]} 2. Nf3 {[%clk 0:02:57]} d6
{[%clk 0:02:55]} 3. Bc4 {[%clk 0:02:54]} Bg4 {[%clk 0:02:50]} 4. Nc3
{[%clk 0:02:51]} g6 {[%clk 0:02:44]} 5. Nxe5 {[%clk 0:02:40]} Bxd1
{[%clk 0:02:30]} 6. Bxf7+ {[%clk 0:02:38]} Ke7 {[%clk 0:02:25]} 7. Nd5#
{[%clk 0:02:36]} 1-0`;

describe('real-PGN end-to-end (real engine)', () => {
  it("handles a chess.com-style export and Légall's mate", async () => {
    const r = await review(CHESSCOM_STYLE);
    expect(r.moves).toHaveLength(13);
    expect(r.moves[0].clockSeconds).toBeCloseTo(179.1);
    const last = r.moves[12];
    expect(last.san).toBe('Nd5#');
    expect(last.classification).toBe('best');
    expect(last.winPercentAfter).toBe(100);
    // Bxd1?? grabbed the queen but allowed mate in 2 — must grade badly
    expect(['blunder', 'mistake']).toContain(r.moves[9].classification);
    // commentary renders for every move without throwing
    for (const m of r.moves) {
      const facts = moveFacts(m.fenBefore, m.uci);
      const c = commentFor(m, facts);
      expect(c.short.length).toBeGreaterThan(0);
    }
  }, 120_000);

  it('handles promotion from a custom FEN start', async () => {
    const r = await review('[FEN "8/5P2/8/8/8/k7/8/K7 w - - 0 1"]\n\n1. f8=Q');
    expect(r.moves[0].san).toBe('f8=Q+'); // SAN normalized: it is check
    expect(['best', 'excellent', 'good']).toContain(r.moves[0].classification);
    const facts = moveFacts(r.moves[0].fenBefore, r.moves[0].uci);
    expect(facts.isPromotion).toBe(true);
  }, 120_000);

  it('handles a stalemating blunder (terminal draw = 50%)', async () => {
    const r = await review('[FEN "7k/5Q2/8/8/8/8/8/K7 w - - 0 1"]\n\n1. Qg6');
    expect(r.moves[0].winPercentAfter).toBe(50);
    expect(r.moves[0].classification).toBe('blunder'); // threw away a forced win
  }, 120_000);
});
