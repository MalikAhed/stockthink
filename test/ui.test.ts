// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import type { AnnotatedMove, AnnotatedReport } from '../src/analyze';
import { renderCoach } from '../src/ui/coach';
import { renderGraph } from '../src/ui/graph';
import { renderMoveList } from '../src/ui/movelist';
import { renderSummary } from '../src/ui/summary';

const move = (over: Partial<AnnotatedMove>): AnnotatedMove => ({
  ply: 1,
  moveNumber: 1,
  color: 'white',
  san: 'e4',
  uci: 'e2e4',
  fenBefore: '',
  fenAfter: '',
  epdAfter: '',
  classification: 'best',
  epLoss: 0,
  winDrop: 0,
  accuracy: 100,
  evalBefore: { cp: 20 },
  evalAfter: { cp: 25 },
  winPercentAfter: 52,
  bestUci: 'e2e4',
  wasBest: true,
  bestSan: 'e4',
  lines: [],
  volatile: false,
  facts: null,
  commentary: { short: 'The strongest move.', long: 'The strongest move. Evaluation: +0.3.' },
  ...over,
});

const report = (): AnnotatedReport => {
  const counts = {
    brilliant: 0, great: 0, best: 1, excellent: 0, good: 0, book: 0,
    forced: 0, inaccuracy: 0, mistake: 0, miss: 0, blunder: 1,
  };
  return {
    headers: { White: 'alice <x>', Black: 'bob', WhiteElo: '1500' },
    initialFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    moves: [
      move({}),
      move({
        ply: 2, color: 'black', san: 'g5??', uci: 'g7g5', classification: 'blunder',
        winPercentAfter: 85, winDrop: 30, evalAfter: { cp: 700 }, wasBest: false, bestSan: 'e5',
        commentary: { short: 'A blunder. e5 was best.', long: 'A blunder. e5 was best. Eval: +7.0.' },
      }),
    ],
    players: {
      white: { accuracy: 99.1, acpl: 3, estimatedElo: 3007, counts: { ...counts, blunder: 0 } },
      black: { accuracy: 41.2, acpl: 350, estimatedElo: 94, counts: { ...counts, best: 0 } },
    },
    opening: { eco: 'B00', name: "King's Pawn Game" },
  };
};

const el = (): HTMLElement => document.createElement('div');

describe('UI components', () => {
  it('summary shows accuracies, ratings, counts — and escapes player names', () => {
    const e = el();
    renderSummary(e, report());
    expect(e.textContent).toContain('99.1');
    expect(e.textContent).toContain('41.2');
    expect(e.textContent).toContain('est. 3007');
    expect(e.textContent).toContain('Blunder');
    expect(e.innerHTML).not.toContain('<x>'); // escaped
    expect(e.textContent).toContain('alice <x>');
    expect(e.textContent).toContain("King's Pawn Game");
  });

  it('move list renders rows, badges and current highlight, and seeks on click', () => {
    const e = el();
    let sought = -1;
    renderMoveList(e, report().moves, 2, p => (sought = p));
    const cells = e.querySelectorAll('.mv[data-ply]');
    expect(cells).toHaveLength(2);
    expect(e.querySelector('.mv.current')?.textContent).toContain('g5??');
    (cells[0] as HTMLElement).click();
    expect(sought).toBe(1);
  });

  it('graph draws the win% path, error dot and cursor, and seeks on click', () => {
    const e = el();
    document.body.appendChild(e);
    renderGraph(e, report().moves, 1, () => {});
    expect(e.querySelector('svg path')).toBeTruthy();
    expect(e.querySelectorAll('circle')).toHaveLength(1); // the blunder dot
    expect(e.querySelector('line[stroke="#f4bf44"]')).toBeTruthy(); // cursor
  });

  it('coach shows the classification headline and commentary', () => {
    const e = el();
    const r = report();
    renderCoach(e, r, r.moves[1]);
    expect(e.textContent).toContain('g5?? is a blunder');
    expect(e.textContent).toContain('A blunder. e5 was best.');
    renderCoach(e, r, null);
    expect(e.textContent).toContain("King's Pawn Game");
  });
});
