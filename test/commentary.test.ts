import { describe, expect, it } from 'vitest';
import { Chess } from 'chessops/chess';
import { makeFen, parseFen } from 'chessops/fen';
import { parseUci } from 'chessops/util';
import { commentFor, formatEval } from '../src/analysis/commentary';
import { moveFacts } from '../src/analysis/concepts';
import type { MoveReport } from '../src/analysis/report';
import { explainMove } from '../src/explain/explain';

/** Minimal MoveReport fixture. */
const mr = (over: Partial<MoveReport>): MoveReport => ({
  ply: 1,
  moveNumber: 1,
  color: 'white',
  san: 'e4',
  uci: 'e2e4',
  fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
  epdAfter: '',
  classification: 'best',
  epLoss: 0,
  winDrop: 0,
  accuracy: 100,
  evalBefore: { cp: 20 },
  evalAfter: { cp: 25 },
  winPercentAfter: 51,
  bestUci: 'e2e4',
  wasBest: true,
  bestSan: 'e4',
  lines: [],
  volatile: false,
  ...over,
});

const fenAfterMove = (fen: string, uci: string): string => {
  const pos = Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
  pos.play(parseUci(uci)!);
  return makeFen(pos.toSetup());
};

const BAD = new Set(['inaccuracy', 'mistake', 'miss', 'blunder']);

/** Run the WHY engine for a fixture, exactly as classify.ts does in production. */
const withExplain = (
  m: MoveReport,
  refutationUci: string[] = [],
  bestPvUci: string[] = [],
): MoveReport => ({
  ...m,
  explain: explainMove({
    fenBefore: m.fenBefore,
    fenAfter: fenAfterMove(m.fenBefore, m.uci),
    uci: m.uci,
    mover: m.color,
    evalAfter: m.evalAfter,
    refutationUci,
    bestPvUci,
    bestEval: m.evalBefore,
    isBad: BAD.has(m.classification),
    winDrop: m.winDrop,
  }),
});

describe('commentary engine', () => {
  it('is deterministic for the same move', () => {
    const m = mr({});
    const f = moveFacts(m.fenBefore, m.uci);
    expect(commentFor(m, f)).toEqual(commentFor(m, f));
  });

  it('names the opening on book moves', () => {
    const m = mr({
      classification: 'book',
      opening: { eco: 'C20', name: "King's Pawn Game" },
    });
    const c = commentFor(m, moveFacts(m.fenBefore, m.uci));
    expect(c.short).toContain("King's Pawn Game");
  });

  it('explains a blunder that hangs a piece, and suggests the best move', () => {
    const fen = '1k1r4/8/8/8/3B4/5N2/8/1K6 w - - 0 1';
    const m = withExplain(
      mr({
        san: 'Ng1',
        uci: 'f3g1',
        fenBefore: fen,
        classification: 'blunder',
        winDrop: 28.4,
        epLoss: 0.284,
        evalBefore: { cp: 50 },
        evalAfter: { cp: -250 },
        wasBest: false,
        bestUci: 'f3e5',
        bestSan: 'Ne5',
        lines: [{ eval: { cp: 50 }, sanPv: ['Ne5', 'Rd5'], uciPv: ['f3e5', 'd8d5'] }],
      }),
      ['d8d4'], // refutation: Rxd4
      ['f3e5', 'd8d5'],
    );
    const c = commentFor(m, moveFacts(fen, m.uci));
    expect(c.short).toContain('bishop on d4');
    expect(c.short).toMatch(/hangs|hanging/);
    expect(c.short).toContain('Ne5');
    expect(c.long).toContain('cost White 28.4% in winning chances');
    expect(c.long).toContain('After this, White is'); // eval words, never raw centipawns
  });

  it('flags an allowed forced mate', () => {
    const m = withExplain(
      mr({
        san: 'Kb1',
        uci: 'b2b1',
        color: 'white',
        fenBefore: '1k6/8/8/8/8/8/1K4r1/8 w - - 0 1',
        classification: 'blunder',
        evalAfter: { mate: -3 },
        wasBest: false,
        bestSan: 'Kc3',
      }),
    );
    const c = commentFor(m, moveFacts(m.fenBefore, m.uci));
    expect(c.short).toContain('forced mate in 3');
  });

  it('celebrates a fork on the short line', () => {
    const fen = '7k/2q5/8/8/4Pr2/2N5/8/K7 w - - 0 1';
    const m = withExplain(
      mr({
        san: 'Nd5',
        uci: 'c3d5',
        fenBefore: fen,
        classification: 'best',
        wasBest: true,
        bestSan: 'Nd5',
      }),
    );
    const c = commentFor(m, moveFacts(fen, m.uci));
    expect(c.short).toMatch(
      /forks the (queen on c7 and the rook on f4|rook on f4 and the queen on c7)/,
    );
  });

  it('never mentions squares that are not in the verified data (no hallucination)', () => {
    const cases: Array<[string, string, Partial<MoveReport>]> = [
      ['1k1r4/8/8/8/3B4/5N2/8/1K6 w - - 0 1', 'f3g1', { classification: 'blunder', bestSan: 'Ne5', lines: [{ eval: { cp: 0 }, sanPv: ['Ne5', 'Rd5'], uciPv: [] }] }],
      ['7k/2q5/8/8/4Pr2/2N5/8/K7 w - - 0 1', 'c3d5', { classification: 'best', wasBest: true }],
      ['4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1', 'f1b5', { classification: 'excellent' }],
    ];
    for (const [fen, uci, over] of cases) {
      const m = withExplain(mr({ fenBefore: fen, uci, san: uci, ...over }));
      const f = moveFacts(fen, uci);
      const c = commentFor(m, f);
      const allowed = new Set<string>([
        // every square inside the WHY engine's verified facts is allowed
        ...(JSON.stringify(m.explain ?? {}).match(/[a-h][1-8]/g) ?? []),
        uci.slice(0, 2),
        uci.slice(2, 4),
        ...(m.bestSan?.match(/[a-h][1-8]/g) ?? []),
        ...m.lines.flatMap(l => l.sanPv.flatMap(s => s.match(/[a-h][1-8]/g) ?? [])),
        ...f.hangs.map(p => p.square),
        ...f.forkedPieces.map(p => p.square),
        ...f.missedFreePieces.map(p => p.square),
        ...(f.pins ? [f.pins.front.square, f.pins.behind.square] : []),
        ...(f.skewers ? [f.skewers.front.square, f.skewers.behind.square] : []),
        ...(f.trapped ? [f.trapped.square] : []),
        ...(f.captured ? [f.captured.square] : []),
        f.piece.square,
      ]);
      for (const sq of (c.short + ' ' + c.long).match(/\b[a-h][1-8]\b/g) ?? [])
        expect(allowed, `square ${sq} leaked into: ${c.long}`).toContain(sq);
    }
  });

  it('formats evals', () => {
    expect(formatEval({ cp: 134 })).toBe('+1.3');
    expect(formatEval({ cp: -50 })).toBe('-0.5');
    expect(formatEval({ mate: 4 })).toBe('#4');
    expect(formatEval({ mate: -2 })).toBe('#-2');
  });
});
