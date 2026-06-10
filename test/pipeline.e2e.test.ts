/**
 * End-to-end: a real historical game through the full pipeline —
 * PGN parse → engine pool (real Stockfish 18 WASM) → classification →
 * accuracy → report. This is the same path the browser app will take.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { openingBook } from '../src/analysis/openings';
import { parseGame } from '../src/analysis/pgn';
import { buildReport, type GameReport } from '../src/analysis/report';
import { EnginePool } from '../src/engine/pool';
import { ChildProcessTransport, setupEngineFiles } from './helpers/transport';

// Morphy vs Duke Karl / Count Isouard, Paris Opera 1858 — ends in mate.
const OPERA_GAME = `[Event "Paris Opera"]
[White "Morphy, Paul"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7
14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`;

describe('full pipeline on the Opera Game (real engine)', () => {
  let report: GameReport;

  beforeAll(async () => {
    const game = parseGame(OPERA_GAME);
    expect(game.plies).toHaveLength(33);
    const pool = await EnginePool.create(
      () => new ChildProcessTransport(setupEngineFiles()),
      2,
      { multiPv: 2, hashMb: 32 },
    );
    const analyses = await pool.analyzeAll(game.fens, { depth: 10 });
    pool.dispose();
    report = buildReport(game, analyses, { openings: openingBook() });
  }, 240_000);

  it('produces a full report with sane values', () => {
    expect(report.moves).toHaveLength(33);
    for (const m of report.moves) {
      expect(m.winPercentAfter).toBeGreaterThanOrEqual(0);
      expect(m.winPercentAfter).toBeLessThanOrEqual(100);
      expect(m.accuracy).toBeGreaterThanOrEqual(0);
      expect(m.accuracy).toBeLessThanOrEqual(100);
      expect(m.epLoss).toBeGreaterThanOrEqual(0);
    }
  });

  it('detects the Philidor Defense book moves', () => {
    expect(report.opening?.name).toMatch(/Philidor/);
    expect(report.moves[0].classification).toBe('book'); // 1. e4
    expect(report.moves[3].classification).toBe('book'); // 2... d6
  });

  it('classifies the final mate as best with 100% win', () => {
    const last = report.moves[32];
    expect(last.san).toBe('Rd8#');
    expect(last.classification).toBe('best');
    expect(last.winPercentAfter).toBe(100);
  });

  it('scores Morphy far above the allies', () => {
    const w = report.players.white;
    const b = report.players.black;
    expect(w.accuracy).toBeGreaterThan(b.accuracy);
    expect(w.acpl).toBeLessThan(b.acpl);
    // the allies erred repeatedly (9... b5?, 11... Nbd7?, ...) — exact grades
    // vary with search depth, so assert on the aggregate
    const errors =
      b.counts.inaccuracy + b.counts.mistake + b.counts.blunder + b.counts.miss;
    expect(errors).toBeGreaterThanOrEqual(2);
    // classification counts cover every move
    const sum = (c: Record<string, number>) => Object.values(c).reduce((a, x) => a + x, 0);
    expect(sum(w.counts)).toBe(17);
    expect(sum(b.counts)).toBe(16);
  });

  it('finds at least one of Morphy\'s brilliant sacrifices (Nxb5/Rxd7/Qb8+)', () => {
    expect(report.players.white.counts.brilliant).toBeGreaterThanOrEqual(1);
  });

  it('reports accuracies in the plausible chess.com-like band', () => {
    expect(report.players.white.accuracy).toBeGreaterThan(60);
    expect(report.players.white.accuracy).toBeLessThanOrEqual(100);
    expect(report.players.black.accuracy).toBeGreaterThan(10);
    expect(report.players.black.estimatedElo).toBeGreaterThan(0);
  });
});
