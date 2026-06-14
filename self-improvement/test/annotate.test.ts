/**
 * Stage-2 annotator (V2 M2) — facts from played move, refutation PV, and
 * missed best move, with synthetic engine contexts.
 */
import { describe, expect, it } from 'vitest';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import type { NormalMove } from 'chessops/types';
import { parseSquare } from 'chessops/util';
import { annotateMove, type AnnotateContext } from '@backend/concepts/annotate';
import type { Fact } from '@backend/concepts/facts';

const pos = (fen: string): Chess => Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
const sq = (name: string) => parseSquare(name)!;
const mv = (uci: string): NormalMove => ({ from: sq(uci.slice(0, 2)), to: sq(uci.slice(2, 4)) });

const ctx = (over: Partial<AnnotateContext> = {}): AnnotateContext => ({
  evalBefore: { cp: 0 },
  evalAfter: { cp: 0 },
  winDrop: 0,
  bestUci: null,
  lines: [],
  ...over,
});

const byKind = (facts: Fact[], kind: Fact['kind']): Fact | undefined =>
  facts.find(f => f.kind === kind);

describe('annotateMove — terminal & context', () => {
  it('checkmate yields only delivers_mate', () => {
    const p = pos('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
    expect(annotateMove(p, mv('a1a8'), ctx())).toEqual([{ kind: 'delivers_mate' }]);
  });

  it('a single legal move is forced', () => {
    const p = pos('7k/6Q1/8/8/8/8/8/K7 b - - 0 1');
    expect(annotateMove(p, mv('h8g7'), ctx())).toEqual([{ kind: 'forced' }]);
  });

  it('only_move fires when the played best move is 10+ win% above line 2', () => {
    const p = pos('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1');
    const facts = annotateMove(
      p,
      mv('d1d2'),
      ctx({
        bestUci: 'd1d2',
        lines: [
          { eval: { cp: 0 }, pvUci: ['d1d2'] },
          { eval: { cp: -300 }, pvUci: ['d1a1'] },
        ],
      }),
    );
    expect(byKind(facts, 'only_move')).toBeTruthy();
  });

  it('second_candidate fires when the played move heads engine line 2 (GM-1)', () => {
    const p = pos('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1');
    const lines = [
      { eval: { cp: 50 }, pvUci: ['d1d8'] },
      { eval: { cp: 20 }, pvUci: ['d1d2'] },
    ];
    const facts = annotateMove(p, mv('d1d2'), ctx({ bestUci: 'd1d8', winDrop: 4, lines }));
    const sc = byKind(facts, 'second_candidate');
    expect(sc).toBeTruthy();
    expect(sc && sc.kind === 'second_candidate' && sc.best.san).toBe('Rd8#');
    // mistake-sized drop: PV2 membership is not "shortlist company" (gate <10)
    expect(
      byKind(annotateMove(p, mv('d1d2'), ctx({ bestUci: 'd1d8', winDrop: 15, lines })), 'second_candidate'),
    ).toBeFalsy();
    // the best move itself never gets the fact
    expect(
      byKind(annotateMove(p, mv('d1d8'), ctx({ bestUci: 'd1d8', winDrop: 0, lines })), 'second_candidate'),
    ).toBeFalsy();
  });
});

describe('annotateMove — what the move concedes', () => {
  it('hanging queen: fact carries the capturing move from the reply PV', () => {
    const p = pos('6k1/8/8/4r3/8/8/8/3Q2K1 w - - 0 1');
    const facts = annotateMove(p, mv('d1d5'), ctx({ winDrop: 30, replyPv: ['e5d5'] }));
    expect(byKind(facts, 'hangs_piece')).toMatchObject({
      piece: { role: 'queen', square: 'd5' },
      capture: { san: 'Rxd5' },
    });
  });

  it('ignores_threat: a piece already under attack, move does nothing, reply takes it (U2)', () => {
    // White knight on c3 is attacked by the b4 pawn and undefended BEFORE the
    // move; White plays the unrelated h3 and the engine reply wins the knight.
    const p = pos('6k1/6pp/8/8/1p6/2N5/P6P/6K1 w - - 0 1');
    const facts = annotateMove(p, mv('h2h3'), ctx({ winDrop: 25, replyPv: ['b4c3'] }));
    expect(byKind(facts, 'ignores_threat')).toMatchObject({
      piece: { role: 'knight', square: 'c3' },
      capture: { san: 'bxc3' },
    });
    // and it must NOT double-report as a fresh hang
    expect(byKind(facts, 'hangs_piece')).toBeUndefined();
  });

  it('ignores_threat does not fire when the move rescues the attacked piece', () => {
    const p = pos('6k1/6pp/8/8/1p6/2N5/P6P/6K1 w - - 0 1');
    const facts = annotateMove(p, mv('c3d5'), ctx({ winDrop: 0, replyPv: [] }));
    expect(byKind(facts, 'ignores_threat')).toBeUndefined();
  });

  it('missed_idea: a quiet best move is explained by its own purpose (U6/C3)', () => {
    // White wastes time with a3 while the engine wanted the rescuing Nd5
    // (knight on c3 is attacked by b4 and undefended → best move escapes).
    const p = pos('6k1/6pp/8/8/1p6/2N5/P6P/6K1 w - - 0 1');
    const facts = annotateMove(
      p,
      mv('h2h3'),
      ctx({ winDrop: 25, bestUci: 'c3d5', lines: [{ eval: { cp: 0 }, pvUci: ['c3d5'] }], replyPv: ['b4c3'] }),
    );
    const idea = byKind(facts, 'missed_idea') as Extract<Fact, { kind: 'missed_idea' }>;
    expect(idea).toBeTruthy();
    expect(idea.move.san).toBe('Nd5');
    expect(idea.ideas.some(i => i.what === 'escapes' && i.role === 'knight')).toBe(true);
  });

  it('missed_idea does not fire when a concrete tactical miss already explains it', () => {
    // best move wins a hanging queen → missed_free_piece, no idea fact needed
    const p = pos('6k1/8/8/3q4/8/8/8/3R2K1 w - - 0 1');
    const facts = annotateMove(
      p,
      mv('g1h1'),
      ctx({ winDrop: 30, bestUci: 'd1d5', lines: [{ eval: { cp: 900 }, pvUci: ['d1d5'] }] }),
    );
    expect(byKind(facts, 'missed_free_piece')).toBeTruthy();
    expect(byKind(facts, 'missed_idea')).toBeUndefined();
  });

  it('allows mate-in-1 (fool’s mate pattern) with the mating reply named', () => {
    const p = pos('rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2');
    const facts = annotateMove(
      p,
      mv('g2g4'),
      ctx({ evalAfter: { mate: -1 }, winDrop: 50, replyPv: ['d8h4'] }),
    );
    expect(byKind(facts, 'allows_mate')).toMatchObject({
      mateIn: 1,
      firstMove: { san: 'Qh4#' },
    });
  });

  it('allows a royal fork found in the reply PV', () => {
    const p = pos('1k6/8/8/8/4n3/8/P7/1K1R4 w - - 0 1');
    const facts = annotateMove(
      p,
      mv('a2a3'),
      ctx({ winDrop: 18, replyPv: ['e4c3', 'b1b2', 'c3d1'] }),
    );
    const fork = byKind(facts, 'allows_fork');
    expect(fork).toMatchObject({ forkMove: { san: 'Nc3+' } });
    expect((fork as Extract<Fact, { kind: 'allows_fork' }>).targets.map(t => t.role)).toEqual(
      expect.arrayContaining(['king', 'rook']),
    );
  });

  it('ignoring an attacked rook produces a refutation, not a hang', () => {
    const p = pos('1k1r4/8/8/8/8/8/8/K2R4 w - - 0 1');
    const facts = annotateMove(p, mv('a1b1'), ctx({ winDrop: 25, replyPv: ['d8d1'] }));
    expect(byKind(facts, 'hangs_piece')).toBeUndefined();
    expect(byKind(facts, 'refutation')).toMatchObject({ lossRole: 'rook' });
  });

  it('an immediately-recaptured capture in the PV is NOT a refutation', () => {
    // trade down the d-file: Rxd8 Rxd8 — no net loss, no refutation
    const p = pos('1k1r4/8/8/8/8/8/8/1KR4R w - - 0 1');
    const facts = annotateMove(
      p,
      mv('h1h2'),
      ctx({ winDrop: 12, replyPv: ['d8d2', 'h2d2'] }),
    );
    expect(byKind(facts, 'refutation')).toBeUndefined();
  });
});

describe('annotateMove — what the best move would have done', () => {
  it('missed mate-in-1', () => {
    const p = pos('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1');
    const facts = annotateMove(
      p,
      mv('g1f1'),
      ctx({
        winDrop: 20,
        bestUci: 'd1d8',
        lines: [{ eval: { mate: 1 }, pvUci: ['d1d8'] }],
      }),
    );
    expect(byKind(facts, 'missed_mate')).toMatchObject({ mateIn: 1, move: { san: 'Rd8#' } });
    // the mating move gives check — never "hard to find" (GM-2 exception)
    expect(byKind(facts, 'hard_to_find')).toBeFalsy();
  });

  it('a QUIET missed tactic earns hard_to_find (GM-2)', () => {
    // best Qf6: no capture, no check — threatens Qg7# (supported by the h6 pawn)
    const p = pos('r5k1/5p1p/7P/8/5Q2/8/8/6K1 w - - 0 1');
    const facts = annotateMove(
      p,
      mv('g1f1'),
      ctx({
        winDrop: 18,
        bestUci: 'f4f6',
        lines: [{ eval: { cp: 900 }, pvUci: ['f4f6'] }],
      }),
    );
    expect(byKind(facts, 'missed_mate_threat')).toMatchObject({ move: { san: 'Qf6' } });
    expect(byKind(facts, 'hard_to_find')).toMatchObject({ move: { san: 'Qf6' }, reason: 'quiet' });
  });

  it('a missed quiet RETREAT carries the retreat reason (GM-8)', () => {
    // best Ra1: a backwards rook move, no capture/check; the engine line
    // shows a forced mate was missed (lines[0] eval mate 2)
    const p = pos('7k/R7/8/8/8/8/8/6K1 w - - 0 1');
    const facts = annotateMove(
      p,
      mv('g1g2'),
      ctx({
        winDrop: 18,
        bestUci: 'a7a1',
        lines: [{ eval: { mate: 2 }, pvUci: ['a7a1'] }],
      }),
    );
    expect(byKind(facts, 'missed_mate')).toBeTruthy();
    expect(byKind(facts, 'hard_to_find')).toMatchObject({ reason: 'retreat' });
  });

  it('a missed PAWN BREAK carries the pawn_break reason (GM-12)', () => {
    // best g6: a non-capturing pawn advance threatening Qg7# (queen supported
    // by the pushed pawn). Book §4.6: novices rarely suspect a pawn move bites.
    const p = pos('6k1/6pp/7Q/5P2/8/8/8/6K1 w - - 0 1');
    const facts = annotateMove(
      p,
      mv('g1f1'),
      ctx({
        winDrop: 18,
        bestUci: 'f5f6',
        lines: [{ eval: { cp: 900 }, pvUci: ['f5f6'] }],
      }),
    );
    expect(byKind(facts, 'missed_mate_threat')).toMatchObject({ move: { san: 'f6' } });
    expect(byKind(facts, 'hard_to_find')).toMatchObject({ move: { san: 'f6' }, reason: 'pawn_break' });
  });

  it('missed free piece', () => {
    const p = pos('k7/8/8/3n4/8/8/3Q4/3K4 w - - 0 1');
    const facts = annotateMove(
      p,
      mv('d2e2'),
      ctx({
        winDrop: 12,
        bestUci: 'd2d5',
        lines: [{ eval: { cp: 300 }, pvUci: ['d2d5'] }],
      }),
    );
    expect(byKind(facts, 'missed_free_piece')).toMatchObject({
      move: { san: 'Qxd5+' },
      victim: { role: 'knight', square: 'd5' },
    });
  });

  it('no missed facts below the winDrop gate', () => {
    const p = pos('k7/8/8/3n4/8/8/3Q4/3K4 w - - 0 1');
    const facts = annotateMove(
      p,
      mv('d2e2'),
      ctx({ winDrop: 3, bestUci: 'd2d5', lines: [{ eval: { cp: 300 }, pvUci: ['d2d5'] }] }),
    );
    expect(byKind(facts, 'missed_free_piece')).toBeUndefined();
  });
});

describe('annotateMove — what the move achieves', () => {
  it('royal fork is reported with both targets', () => {
    const p = pos('r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1');
    const fork = byKind(annotateMove(p, mv('b5c7'), ctx()), 'creates_fork');
    expect(fork).toBeTruthy();
    expect((fork as Extract<Fact, { kind: 'creates_fork' }>).targets.map(t => t.role)).toEqual(
      expect.arrayContaining(['king', 'rook']),
    );
  });

  it('new absolute pin is reported with pinned piece and king', () => {
    const p = pos('4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1');
    expect(byKind(annotateMove(p, mv('f1b5'), ctx()), 'creates_pin')).toMatchObject({
      pinned: { role: 'knight', square: 'c6' },
      against: { role: 'king', square: 'e8' },
    });
  });

  it('an insignificant relative pin (nothing wins it, engine ignores it) is NOT reported', () => {
    // Re1 lines up knight e5 + queen e8, but the queen guards the knight and
    // the engine line never touches the pin — geometry, not a reason
    const p = pos('4q1k1/8/8/4n3/8/8/8/3R2K1 w - - 0 1');
    const facts = annotateMove(p, mv('d1e1'), ctx({ replyPv: ['g8f8', 'g1f2'] }));
    expect(byKind(facts, 'creates_pin')).toBeUndefined();
  });

  it('a relative pin the engine piles on is kept and cites the exploiting move', () => {
    // same pin, but the engine follow-up Bg3 adds a second attacker on e5
    const p = pos('4q1k1/8/8/4n3/8/8/5B2/3R2K1 w - - 0 1');
    const facts = annotateMove(p, mv('d1e1'), ctx({ replyPv: ['g8f8', 'f2g3'] }));
    expect(byKind(facts, 'creates_pin')).toMatchObject({
      pinned: { role: 'knight', square: 'e5' },
      exploit: { san: 'Bg3' },
    });
  });

  it('a pin that wins the pinned piece outright is kept without engine help', () => {
    // dxe5 wins the knight: the queen behind cannot profitably recapture
    const p = pos('4q1k1/8/8/4n3/3P4/8/8/3R2K1 w - - 0 1');
    const facts = annotateMove(p, mv('d1e1'), ctx());
    expect(byKind(facts, 'creates_pin')).toBeTruthy();
  });

  it('a fork the engine defense refutes with a counter-check is NOT reported', () => {
    // Qd4 "forks" the loose knights on b6 and g7, but …Ra1+ wins the tempo
    // back — with the king in check nothing can be harvested
    const p = pos('r3k3/6n1/1n6/8/8/8/8/3Q3K w - - 0 1');
    const facts = annotateMove(p, mv('d1d4'), ctx({ replyPv: ['a8a1'] }));
    expect(byKind(facts, 'creates_fork')).toBeUndefined();
  });

  it('the same fork is kept when the best defense only saves one knight', () => {
    const p = pos('r3k3/6n1/1n6/8/8/8/8/3Q3K w - - 0 1');
    const facts = annotateMove(p, mv('d1d4'), ctx({ replyPv: ['b6d7'] }));
    expect(byKind(facts, 'creates_fork')).toBeTruthy();
  });

  it('a quiet move is explained by the engine follow-up it enables (prepares)', () => {
    // Nb2 looks pointless but clears the d-file: the engine line continues
    // …Ke7 Qd4, forking both knights — explain the two moves as one plan
    const p = pos('4k3/6n1/1n6/8/8/3N4/8/3Q3K w - - 0 1');
    const facts = annotateMove(p, mv('d3b2'), ctx({ replyPv: ['e8e7', 'd1d4'] }));
    expect(byKind(facts, 'prepares')).toMatchObject({
      move: { san: 'Qd4' },
      idea: { what: 'fork' },
    });
  });

  it('missed_idea narrates the best move via its PV follow-up when move 1 is quiet (U6)', () => {
    // White played the aimless Kh2; the engine wanted the quiet Nb2 whose
    // POINT is one move deeper: …Ke7 Qd4 forking both knights.
    const p = pos('4k3/6n1/1n6/8/8/3N4/8/3Q3K w - - 0 1');
    const facts = annotateMove(
      p,
      mv('h1h2'),
      ctx({
        winDrop: 15,
        bestUci: 'd3b2',
        lines: [{ eval: { cp: 300 }, pvUci: ['d3b2', 'e8e7', 'd1d4'] }],
      }),
    );
    const idea = byKind(facts, 'missed_idea') as Extract<Fact, { kind: 'missed_idea' }>;
    expect(idea).toBeTruthy();
    expect(idea.move.san).toBe('Nb2');
    expect(idea.ideas[0]).toMatchObject({ what: 'prepares', move: { san: 'Qd4' }, idea: { what: 'fork' } });
  });

  it('no prepares fact when the follow-up was already available before the move', () => {
    // here Qd4 was playable immediately — the quiet king move prepared nothing
    const p = pos('4k3/6n1/1n6/8/8/8/8/3Q3K w - - 0 1');
    const facts = annotateMove(p, mv('h1h2'), ctx({ replyPv: ['e8e7', 'd1d4'] }));
    expect(byKind(facts, 'prepares')).toBeUndefined();
  });

  it('mate threat carries the rendered mating move', () => {
    const p = pos('6k1/5ppp/8/8/8/8/5PPP/2R3K1 w - - 0 1');
    expect(byKind(annotateMove(p, mv('c1d1'), ctx()), 'mate_threat')).toMatchObject({
      mateMove: { san: 'Rd8#' },
    });
  });

  it('facts come back priority-sorted (mate threat before positional)', () => {
    const p = pos('6k1/5ppp/8/8/8/8/5PPP/2R3K1 w - - 0 1');
    const facts = annotateMove(p, mv('c1d1'), ctx());
    const kinds = facts.map(f => f.kind);
    expect(kinds.indexOf('mate_threat')).toBeLessThan(
      kinds.includes('positional') ? kinds.indexOf('positional') : kinds.length,
    );
  });
});

describe('annotateMove — GM-6 removes-checks prophylaxis', () => {
  // White is clearly better; Kh2 strips Black's only check (…Rb1+), while
  // the played rook shuffle leaves it available.
  const FEN = '1r4k1/6pp/8/8/R7/3Q3P/5PP1/6K1 w - - 0 1';
  const lines = [{ eval: { cp: 300 }, pvUci: ['g1h2'] }];

  it('missed quiet king move that strips every check → removes_checks idea', () => {
    const facts = annotateMove(
      pos(FEN),
      mv('a4a5'),
      ctx({ evalBefore: { cp: 300 }, winDrop: 8, bestUci: 'g1h2', lines }),
    );
    const idea = byKind(facts, 'missed_idea');
    expect(idea).toBeTruthy();
    expect(idea && idea.kind === 'missed_idea' && idea.ideas.some(i => i.what === 'removes_checks')).toBe(
      true,
    );
  });

  it('stays silent when checks remain after the king move', () => {
    // a queen on b8 still finds …Qg3+ after Kh2 — no clean prophylaxis story
    const facts = annotateMove(
      pos('1q4k1/6pp/8/8/R7/3Q3P/5PP1/6K1 w - - 0 1'),
      mv('a4a5'),
      ctx({ evalBefore: { cp: 300 }, winDrop: 8, bestUci: 'g1h2', lines }),
    );
    const idea = byKind(facts, 'missed_idea');
    expect(
      idea && idea.kind === 'missed_idea' && idea.ideas.some(i => i.what === 'removes_checks'),
    ).toBeFalsy();
  });
});

describe('annotateMove — GM-10 strike-now pawn break (open_lines)', () => {
  // White fully developed vs Black's untouched Nb8/Bc8; the bayonet f4-f5
  // hits e6, and the engine line f5 exf5 Qxf5 plants the queen on the
  // king's doorstep (f7/h7) — slider pressure on the king zone 1 → 2.
  const FEN = 'rnbq1rk1/p4ppp/4p3/8/5P2/3Q4/P5PP/5RK1 w - - 0 1';
  const lines = [{ eval: { cp: 250 }, pvUci: ['f4f5', 'e6f5', 'd3f5'] }];

  it('missed pawn break with a dev lead + PV-confirmed king pressure → open_lines idea', () => {
    const facts = annotateMove(
      pos(FEN),
      mv('a2a3'),
      ctx({ evalBefore: { cp: 250 }, winDrop: 8, bestUci: 'f4f5', lines }),
    );
    const idea = byKind(facts, 'missed_idea');
    expect(idea).toBeTruthy();
    expect(
      idea && idea.kind === 'missed_idea' && idea.ideas.some(i => i.what === 'open_lines'),
    ).toBe(true);
  });

  it('stays silent without the development lead', () => {
    // same break, but Black's minors are gone from home — no lead to press
    const facts = annotateMove(
      pos('r2q1rk1/p4ppp/4p3/8/5P2/3Q4/P5PP/5RK1 w - - 0 1'),
      mv('a2a3'),
      ctx({ evalBefore: { cp: 250 }, winDrop: 8, bestUci: 'f4f5', lines }),
    );
    const idea = byKind(facts, 'missed_idea');
    expect(
      idea && idea.kind === 'missed_idea' && idea.ideas.some(i => i.what === 'open_lines'),
    ).toBeFalsy();
  });
});

describe('annotateMove — GM-7 abandons a covered square', () => {
  // Ng4 is the only piece covering f2; after Ne5 the queen infiltrates there
  it('fires when the refutation lands on the square the moved piece left', () => {
    const facts = annotateMove(
      pos('6k1/q5pp/8/8/6N1/7P/6PK/3R4 w - - 0 1'),
      mv('g4e5'),
      ctx({ evalBefore: { cp: 100 }, winDrop: 12, bestUci: 'd1d2', replyPv: ['a7f2'] }),
    );
    const f = byKind(facts, 'abandons_square');
    expect(f).toMatchObject({ role: 'knight', from: 'g4', square: 'f2' });
    expect(f && f.kind === 'abandons_square' && f.reply.san).toBe('Qf2');
  });

  it('stays silent when another piece still covers the square', () => {
    // same position with a bishop on g1 — f2 is still covered after Ne5
    const facts = annotateMove(
      pos('6k1/q5pp/8/8/6N1/7P/6PK/3R2B1 w - - 0 1'),
      mv('g4e5'),
      ctx({ evalBefore: { cp: 100 }, winDrop: 12, bestUci: 'd1d2', replyPv: ['a7f2'] }),
    );
    expect(byKind(facts, 'abandons_square')).toBeFalsy();
  });
});

describe('annotateMove — GM-9 counterattack beats passive defense', () => {
  // The c3-knight hangs to …bxc3; the best move ignores it — Bg5 hits the
  // queen (bigger threat). Kh1 (played) just shrugs.
  const FEN = '3q2k1/6pp/8/8/1p6/2N2N2/8/2BQ2K1 w - - 0 1';

  it('leads the missed idea with the counterattack lesson', () => {
    const facts = annotateMove(
      pos(FEN),
      mv('g1h1'),
      ctx({
        evalBefore: { cp: 100 },
        winDrop: 8,
        bestUci: 'c1g5',
        lines: [{ eval: { cp: 100 }, pvUci: ['c1g5', 'd8d7'] }],
      }),
    );
    const idea = byKind(facts, 'missed_idea');
    expect(idea && idea.kind === 'missed_idea' && idea.ideas[0]?.what).toBe('counterattack');
  });

  it('no counterattack story when the best move simply saves the piece', () => {
    const facts = annotateMove(
      pos(FEN),
      mv('g1h1'),
      ctx({
        evalBefore: { cp: 100 },
        winDrop: 8,
        bestUci: 'c3e4',
        lines: [{ eval: { cp: 100 }, pvUci: ['c3e4'] }],
      }),
    );
    const idea = byKind(facts, 'missed_idea');
    expect(
      idea && idea.kind === 'missed_idea' && idea.ideas.some(i => i.what === 'counterattack'),
    ).toBeFalsy();
  });
});

describe('annotateMove — GM-2 praise side (quiet_strength)', () => {
  const FEN = 'r5k1/5p1p/7P/8/5Q2/8/8/6K1 w - - 0 1';

  it('playing a quiet tactical best move earns quiet_strength', () => {
    // Qf6: quiet (no capture/check) and threatens Qg7#
    const facts = annotateMove(
      pos(FEN),
      mv('f4f6'),
      ctx({ winDrop: 0, bestUci: 'f4f6', lines: [{ eval: { cp: 900 }, pvUci: ['f4f6'] }] }),
    );
    expect(byKind(facts, 'mate_threat')).toBeTruthy();
    expect(byKind(facts, 'quiet_strength')).toBeTruthy();
  });

  it('checking or non-best moves earn nothing extra', () => {
    // a check is its own announcement — no quiet-strength praise
    const check = annotateMove(
      pos('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1'),
      mv('d1d8'),
      ctx({ winDrop: 0, bestUci: 'd1d8' }),
    );
    expect(byKind(check, 'quiet_strength')).toBeFalsy();
    // same quiet move but NOT the engine's best
    const notBest = annotateMove(
      pos(FEN),
      mv('f4f6'),
      ctx({ winDrop: 1, bestUci: 'f4e5', lines: [{ eval: { cp: 900 }, pvUci: ['f4e5'] }] }),
    );
    expect(byKind(notBest, 'quiet_strength')).toBeFalsy();
  });
});
