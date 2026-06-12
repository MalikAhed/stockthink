/**
 * Mode A composer (V2 M4) — structure (cause→consequence→better) and the
 * hard rules R1 (no eval numbers in prose) / R2 (no PV dumps) / R3 (no
 * eval-speak fallback).
 */
import { describe, expect, it } from 'vitest';
import { composeComment } from '../src/compose/compose';
import type { MoveReport } from '../src/analysis/report';
import type { Fact } from '../src/concepts/facts';

const move = (over: Partial<MoveReport>): MoveReport =>
  ({
    ply: 9,
    moveNumber: 5,
    color: 'white',
    san: 'Qh6',
    uci: 'd2h6',
    fenBefore: 'fenB',
    fenAfter: 'fenA',
    epdAfter: '',
    evalBefore: { cp: 0 },
    evalAfter: { cp: -300 },
    winPercentAfter: 38,
    winDrop: 24,
    accuracy: 30,
    bestUci: 'd2e3',
    bestSan: 'Qe3',
    wasBest: false,
    lines: [{ eval: { cp: 0 }, sanPv: ['Qe3', 'Rc7'], uciPv: ['d2e3', 'c8c7'] }],
    facts: [] as Fact[],
    classification: 'blunder',
    openingName: null,
    ...over,
  }) as MoveReport;

/** R1/R3 watchdog: no eval-speak may ever reach prose. */
const assertNoEvalSpeak = (text: string) => {
  expect(text).not.toMatch(/%|centipawn|\beval\b|win(ning)? chance|accuracy|\d+\.\d+/i);
  expect(text).not.toMatch(/cost (White|Black|you)/i);
};

/** R2 watchdog: three or more consecutive SAN tokens = a PV dump. */
const assertNoPvDump = (text: string) => {
  expect(text).not.toMatch(/([KQRBN]?[a-h]?x?[a-h][1-8][+#]?\s+){3,}/);
};

describe('composeComment — bad moves (cause → consequence → better)', () => {
  const hangFact: Fact = {
    kind: 'hangs_piece',
    piece: { role: 'knight', square: 'c3' },
    capture: { san: 'Rxc3', uci: 'c8c3' },
  };
  const missedFact: Fact = {
    kind: 'missed_fork',
    move: { san: 'Nd4', uci: 'b3d4' },
    targets: [
      { role: 'king', square: 'g8' },
      { role: 'queen', square: 'd7' },
    ],
  };

  it('cause comes before the better move, and the better move has a WHY', () => {
    const c = composeComment(move({ facts: [hangFact, missedFact] }));
    expect(c.text).toContain('knight on c3 hanging');
    expect(c.text).toContain('Rxc3');
    expect(c.text).toContain('Nd4 would have forked');
    expect(c.text.indexOf('hanging')).toBeLessThan(c.text.indexOf('Nd4'));
    assertNoEvalSpeak(c.text);
    assertNoPvDump(c.text);
  });

  it('a blunder with no concrete fact names the better move and stops (R3)', () => {
    const c = composeComment(move({ facts: [] }));
    expect(c.text).toBe('Qe3 was the better way.');
    assertNoEvalSpeak(c.text);
  });

  it('"explain more" on a bad move never recites purpose facts as praise (U1)', () => {
    const c = composeComment(
      move({
        facts: [
          hangFact,
          { kind: 'positional', fact: { kind: 'develops', role: 'knight', square: 'f3' } },
          { kind: 'defends_piece', piece: { role: 'bishop', square: 'd3' } } as Fact,
        ],
      }),
    );
    // purpose facts may only appear inside the concessive "The idea —" frame
    expect(c.more).not.toBeNull();
    expect(c.more!).toMatch(/^The idea — /);
    expect(c.more!).toContain("doesn't make up for");
    // and never as standalone praise sentences
    expect(c.more!).not.toMatch(/(^|\. )Develops /);
    expect(c.more!).not.toMatch(/(^|\. )Defends /);
    assertNoEvalSpeak(c.text + ' ' + c.more!);
  });

  it('"explain more" on a bad move leads with remaining negative facts', () => {
    const c = composeComment(
      move({
        facts: [
          hangFact,
          missedFact,
          { kind: 'missed_mate', move: { san: 'Qh7#', uci: 'h6h7' } } as Fact,
          { kind: 'positional', fact: { kind: 'center_gain' } },
        ],
      }),
    );
    // hang + missed_fork go to the main text; missed_mate must come before the intent frame
    expect(c.more).not.toBeNull();
    const idea = c.more!.indexOf('The idea —');
    expect(idea).toBeGreaterThan(0);
  });

  it('non-best moves carry a Best-line chip instead of a PV in prose', () => {
    const c = composeComment(move({ facts: [hangFact] }));
    expect(c.chips.some(ch => ch.label === 'Best: Qe3')).toBe(true);
    assertNoPvDump(c.text);
  });
});

describe('composeComment — good moves (purpose)', () => {
  it('renders the top purpose facts', () => {
    const c = composeComment(
      move({
        classification: 'best',
        wasBest: true,
        winDrop: 0,
        facts: [
          {
            kind: 'creates_fork',
            forker: { role: 'knight', square: 'c7' },
            targets: [
              { role: 'king', square: 'e8' },
              { role: 'rook', square: 'a8' },
            ],
          },
        ],
      }),
    );
    expect(c.text).toContain('knight on c7 forks the king and the rook on a8');
    assertNoEvalSpeak(c.text);
  });

  it('fact-less good move gets one short neutral sentence (R3)', () => {
    const c = composeComment(move({ classification: 'good', winDrop: 3, facts: [] }));
    expect(c.text).toBe('A reasonable continuation.');
    assertNoEvalSpeak(c.text);
  });

  it('book moves name the opening', () => {
    const c = composeComment(move({ classification: 'book', openingName: "King's Indian Defense" }));
    expect(c.text).toBe("Book: King's Indian Defense.");
  });

  it('extra facts go to "explain more", not the main text', () => {
    const c = composeComment(
      move({
        classification: 'best',
        wasBest: true,
        winDrop: 0,
        facts: [
          { kind: 'wins_tempo', target: { role: 'queen', square: 'h4' } },
          { kind: 'positional', fact: { kind: 'develops', role: 'knight', square: 'f3' } },
          { kind: 'positional', fact: { kind: 'center_gain' } },
        ],
      }),
    );
    expect(c.text).toContain('gains time');
    expect(c.more).toContain('center');
    assertNoEvalSpeak(c.text + ' ' + (c.more ?? ''));
  });
});
