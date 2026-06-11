/**
 * Stage-2 annotator (V2 M2) — facts from played move, refutation PV, and
 * missed best move, with synthetic engine contexts.
 */
import { describe, expect, it } from 'vitest';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import type { NormalMove } from 'chessops/types';
import { parseSquare } from 'chessops/util';
import { annotateMove, type AnnotateContext } from '../src/concepts/annotate';
import type { Fact } from '../src/concepts/facts';

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
