/**
 * Stage-3 classification (V2 M3) — ladder + special classes over synthetic
 * MoveReports.
 */
import { describe, expect, it } from 'vitest';
import { classifyMove } from '../src/analysis/classify';
import type { MoveReport } from '../src/analysis/report';
import type { Fact } from '../src/concepts/facts';

const move = (over: Partial<MoveReport>): MoveReport =>
  ({
    ply: 9,
    moveNumber: 5,
    color: 'white',
    san: 'Nf3',
    uci: 'g1f3',
    fenBefore: '',
    fenAfter: '',
    epdAfter: '',
    evalBefore: { cp: 0 },
    evalAfter: { cp: 0 },
    winPercentAfter: 50,
    winDrop: 0,
    accuracy: 100,
    bestUci: 'g1f3',
    bestSan: 'Nf3',
    wasBest: true,
    lines: [],
    facts: [] as Fact[],
    classification: 'good',
    openingName: null,
    ...over,
  }) as MoveReport;

describe('classifyMove ladder', () => {
  it.each([
    [0, 'best'],
    [1.5, 'excellent'],
    [4, 'good'],
    [8, 'inaccuracy'],
    [15, 'mistake'],
    [30, 'blunder'],
  ])('winDrop %s → %s', (winDrop, expected) => {
    expect(classifyMove(move({ winDrop: winDrop as number, wasBest: false }), false)).toBe(
      expected,
    );
  });
});

describe('classifyMove special classes', () => {
  it('book beats everything', () => {
    expect(classifyMove(move({ winDrop: 30 }), true)).toBe('book');
  });

  it('forced fact wins', () => {
    expect(classifyMove(move({ facts: [{ kind: 'forced' }], winDrop: 12 }), false)).toBe('forced');
  });

  it('delivering mate is best', () => {
    expect(classifyMove(move({ facts: [{ kind: 'delivers_mate' }] }), false)).toBe('best');
  });

  it('sound sacrifice played as best = brilliant', () => {
    const m = move({
      facts: [{ kind: 'sacrifice', piece: 'bishop' }],
      wasBest: true,
      winPercentAfter: 65,
      evalBefore: { cp: 50 },
    });
    expect(classifyMove(m, false)).toBe('brilliant');
  });

  it('sacrifice that leaves the mover lost is NOT brilliant', () => {
    const m = move({
      facts: [{ kind: 'sacrifice', piece: 'bishop' }],
      wasBest: false,
      winDrop: 25,
      winPercentAfter: 20,
      evalBefore: { cp: 0 },
    });
    expect(classifyMove(m, false)).toBe('blunder');
  });

  it('only good move in a critical position = great', () => {
    expect(classifyMove(move({ facts: [{ kind: 'only_move' }], winDrop: 0.5 }), false)).toBe(
      'great',
    );
  });

  it('letting a mate go while still winning = miss', () => {
    const m = move({
      facts: [{ kind: 'missed_mate', mateIn: 2, move: { san: 'Qh7+', uci: 'd3h7' } }],
      wasBest: false,
      winDrop: 14,
      winPercentAfter: 80,
    });
    expect(classifyMove(m, false)).toBe('miss');
  });

  it('softens one step when the mover is still completely winning after (chess.com leniency)', () => {
    // 99% → 91%: drop 8 would be "inaccuracy", but the game is still decided
    const m = move({ wasBest: false, winDrop: 8, winPercentAfter: 91, evalBefore: { cp: 900 } });
    expect(classifyMove(m, false)).toBe('good');
  });

  it('softens one step in an already-lost position', () => {
    // 15% → 3%: a "mistake"-sized drop changes nothing — soften to inaccuracy
    const m = move({ wasBest: false, winDrop: 12, winPercentAfter: 3, evalBefore: { cp: -450 } });
    expect(classifyMove(m, false)).toBe('inaccuracy');
  });

  it('never softens a move that walks into a forced mate', () => {
    const m = move({
      wasBest: false,
      winDrop: 12,
      winPercentAfter: 0.1,
      evalBefore: { cp: -450 },
      evalAfter: { mate: -3 },
    });
    expect(classifyMove(m, false)).toBe('mistake');
  });

  it('missing a resource AND ending up lost is just a blunder', () => {
    const m = move({
      facts: [{ kind: 'missed_free_piece', move: { san: 'Qxd5', uci: 'd2d5' }, victim: { role: 'knight', square: 'd5' } }],
      wasBest: false,
      winDrop: 35,
      winPercentAfter: 20,
    });
    expect(classifyMove(m, false)).toBe('blunder');
  });
});
