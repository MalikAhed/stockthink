import { describe, expect, it } from 'vitest';
import type { PositionAnalysis } from '../src/engine/engine';
import type { EvalScore } from '../src/analysis/winprob';
import { classifyMoves } from '../src/analysis/classify';
import { openingBook } from '../src/analysis/openings';
import { parseGame } from '../src/analysis/pgn';
import { buildReport } from '../src/analysis/report';

/** Fabricate a PositionAnalysis (synthetic engine output, white POV). */
const A = (
  main: EvalScore,
  second: EvalScore | null,
  best: string | null,
  terminal = false,
): PositionAnalysis => ({
  fen: '',
  lines: terminal
    ? []
    : [
        { multipv: 1, depth: 12, eval: main, pvUci: [] },
        ...(second ? [{ multipv: 2, depth: 12, eval: second, pvUci: [] }] : []),
      ],
  bestmoveUci: best,
  terminal,
});

describe('classifyMoves — expected-points ladder', () => {
  it('walks the official chess.com thresholds (blunder gate downgrades unconfirmed)', () => {
    // 5 plies, evals tuned so each move lands in a distinct class:
    // drops ≈ 1.8 / 4.6 / 9.2 / 18.2 / 48 win% points.
    // The last drop is blunder-sized, but with no refutation PV the
    // explanation engine cannot confirm a concrete cost → Mistake (§2.4).
    const game = parseGame('1. e4 e5 2. Nf3 Nc6 3. Bc4');
    const evals = [0, -20, 30, -70, 130, -500];
    const analyses = evals.map(cp => A({ cp }, { cp: cp - 40 }, 'a2a3'));
    const cls = classifyMoves(game, analyses).map(j => j.classification);
    expect(cls).toEqual(['excellent', 'good', 'inaccuracy', 'mistake', 'mistake']);
  });

  it('keeps a Blunder when the explanation engine confirms hung material', () => {
    // Qd5?? hangs the queen to Rxd5 — refutation walk verifies value 9.
    const game = parseGame('[FEN "3r3k/8/8/8/8/8/3Q4/3K4 w - - 0 1"]\n\n1. Qd5');
    const analyses = [A({ cp: 0 }, { cp: -40 }, 'd2a2'), A({ cp: -900 }, null, 'd8d5')];
    analyses[1].lines[0].pvUci = ['d8d5'];
    const j = classifyMoves(game, analyses);
    expect(j[0].classification).toBe('blunder');
    expect(j[0].explain?.primary?.kind).toBe('loses_material');
  });

  it('flags a Miss when failing to punish a bad move', () => {
    const game = parseGame('1. e4 e5 2. Nf3');
    // e4 = blunder-sized drop (0 → −400, unconfirmed → mistake),
    // e5 = inaccuracy for black (drop ≈ 9.8) → Miss
    const analyses = [0, -400, -250, -240].map(cp => A({ cp }, { cp: cp - 40 }, 'a2a3'));
    const j = classifyMoves(game, analyses);
    expect(j[0].classification).toBe('mistake');
    expect(j[1].classification).toBe('miss');
  });

  it('inherently softens big cp losses in winning positions (sigmoid compression)', () => {
    const game = parseGame('1. e4');
    // +1000 → +650 is a 350cp loss but only ~6 win% points: NOT a blunder
    const analyses = [A({ cp: 1000 }, { cp: 900 }, 'a2a3'), A({ cp: 650 }, { cp: 600 }, 'a2a3')];
    expect(classifyMoves(game, analyses)[0].classification).toBe('inaccuracy');
  });
});

describe('classifyMoves — special classes', () => {
  it('classifies book moves from the lichess opening book', () => {
    const game = parseGame('1. e4 e5');
    const analyses = [0, 20, 25].map(cp => A({ cp }, { cp: cp - 30 }, 'a2a3'));
    const j = classifyMoves(game, analyses, { openings: openingBook() });
    expect(j[0].classification).toBe('book');
    expect(j[1].classification).toBe('book');
    expect(j[1].opening?.name).toBe("King's Pawn Game");
    expect(j[1].accuracy).toBe(100);
  });

  it('classifies the only legal move as forced', () => {
    const game = parseGame('[FEN "7k/R7/6K1/8/8/8/8/8 b - - 0 1"]\n\n1... Kg8');
    const analyses = [A({ cp: 800 }, null, 'h8g8'), A({ cp: 800 }, null, 'a7a8')];
    expect(classifyMoves(game, analyses)[0].classification).toBe('forced');
  });

  it('classifies delivering checkmate as best with 100% win', () => {
    const game = parseGame('1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7#');
    const analyses = [
      ...[0, 10, 20, 30, 40, 50].map(cp => A({ cp }, { cp: cp - 30 }, 'a2a3')),
      A({ mate: 1 }, { cp: 500 }, 'h5f7'),
      A({ cp: 0 }, null, null, true), // terminal: checkmate
    ];
    const j = classifyMoves(game, analyses);
    expect(j[6].classification).toBe('best');
    expect(j[6].winPercentAfter).toBe(100);
    expect(j[6].accuracy).toBe(100);
  });

  it('upgrades the only good punish of a bad move to Great', () => {
    const game = parseGame('1. e4 e5 2. Nf3');
    const analyses = [
      A({ cp: 0 }, { cp: -30 }, 'a2a3'),
      A({ cp: -20 }, { cp: -60 }, 'a2a3'), // before black's e5
      A({ cp: 300 }, { cp: 100 }, 'g1f3'), // e5 threw the game away; Nf3 only good move (gap 200)
      A({ cp: 280 }, { cp: 80 }, 'a7a6'),
    ];
    const j = classifyMoves(game, analyses);
    expect(j[1].classification).toBe('mistake'); // blunder-sized but unconfirmed (§2.4 gate)
    expect(j[2].classification).toBe('great');
  });

  it("upgrades Légall's queen sacrifice to Brilliant", () => {
    // 5.Nxe5! leaves the queen on d1 capturable by the g4 bishop
    const game = parseGame('1. e4 e5 2. Nf3 d6 3. Bc4 Bg4 4. Nc3 g6 5. Nxe5');
    const analyses = [
      ...[30, 30, 30, 30, 30, 30, 30, 30].map(cp => A({ cp }, { cp: 10 }, 'a2a3')),
      A({ cp: 250 }, { cp: 40 }, 'f3e5'), // before Nxe5: best by far, not winning anyway
      A({ cp: 220 }, { cp: 0 }, 'a7a6'),
    ];
    const j = classifyMoves(game, analyses);
    expect(j[8].classification).toBe('brilliant');
  });

  it('does not call a plain best move Brilliant when nothing hangs', () => {
    const game = parseGame('1. e4 e5 2. Nf3');
    const analyses = [
      A({ cp: 0 }, { cp: -30 }, 'e2e4'),
      A({ cp: 20 }, { cp: -10 }, 'e7e5'),
      A({ cp: 25 }, { cp: 0 }, 'g1f3'),
      A({ cp: 25 }, { cp: 0 }, 'a7a6'),
    ];
    const j = classifyMoves(game, analyses);
    expect(j.map(x => x.classification)).toEqual(['best', 'best', 'best']);
  });
});

describe('buildReport', () => {
  it('aggregates per-player accuracy, counts, ACPL and estimated Elo', () => {
    const game = parseGame('1. e4 e5 2. Nf3 Nc6 3. Bc4');
    const evals = [0, -20, 30, -70, 130, -500];
    const analyses = evals.map((cp, i) =>
      A({ cp }, { cp: cp - 40 }, i === 0 ? 'd2d4' : 'a2a3'),
    );
    analyses[0].lines[0].pvUci = ['d2d4', 'd7d5'];
    const r = buildReport(game, analyses);

    expect(r.moves).toHaveLength(5);
    expect(r.moves[0].bestSan).toBe('d4');
    expect(r.moves[0].lines[0].sanPv).toEqual(['d4', 'd5']);

    const w = r.players.white;
    const b = r.players.black;
    expect(w.counts.excellent).toBe(1);
    expect(w.counts.inaccuracy).toBe(1);
    expect(w.counts.mistake).toBe(1); // blunder-sized drop, unconfirmed → mistake
    expect(b.counts.good).toBe(1);
    expect(b.counts.mistake).toBe(1);
    expect(w.accuracy).toBeGreaterThan(0);
    expect(w.accuracy).toBeLessThan(b.accuracy); // white blundered worse
    expect(w.acpl).toBeGreaterThan(b.acpl);
    expect(w.estimatedElo).toBeGreaterThan(0);
    expect(r.opening).toBeUndefined();
  });

  it('surfaces the deepest book opening name', () => {
    const game = parseGame('1. e4 e5');
    const analyses = [0, 20, 25].map(cp => A({ cp }, { cp: cp - 30 }, 'a2a3'));
    const r = buildReport(game, analyses, { openings: openingBook() });
    expect(r.opening?.eco).toBe('C20');
    expect(r.opening?.name).toBe("King's Pawn Game");
  });
});
