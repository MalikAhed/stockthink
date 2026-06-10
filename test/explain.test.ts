/**
 * WHY-engine end-to-end: spec §11 "definition of done".
 * - hangs a piece → names the piece, square, and capturing move
 * - pinned defender → the T3-style sentence
 * - allows a fork/mate → named with the opponent's move
 * - quiet inaccuracy → positional fragment, never an invented tactic
 * - good move → its verified purpose; better_was clause on bad moves
 */
import { describe, expect, it } from 'vitest';
import { Chess } from 'chessops/chess';
import { makeFen, parseFen } from 'chessops/fen';
import { parseUci } from 'chessops/util';
import type { NormalMove } from 'chessops/types';
import { type ExplainArgs, explainMove } from '../src/explain/explain';
import { renderBetterWas, renderPrimary } from '../src/explain/templates';

/** Build fenAfter by playing `uci` on `fenBefore`. */
const playFen = (fenBefore: string, uci: string): string => {
  const pos = Chess.fromSetup(parseFen(fenBefore).unwrap()).unwrap();
  pos.play(parseUci(uci) as NormalMove);
  return makeFen(pos.toSetup());
};

const args = (over: Partial<ExplainArgs> & Pick<ExplainArgs, 'fenBefore' | 'uci'>): ExplainArgs => ({
  fenAfter: playFen(over.fenBefore, over.uci),
  mover: 'white',
  evalAfter: { cp: 0 },
  refutationUci: [],
  bestPvUci: [],
  isBad: true,
  winDrop: 25,
  ...over,
});

describe('explainBadMove — the refutation walk', () => {
  it('names the hung piece, its square and the capturing move', () => {
    // Ng5?? hangs the knight to Qxg5
    const ex = explainMove(
      args({
        fenBefore: '3q3k/8/8/8/8/5N2/8/K7 w - - 0 1',
        uci: 'f3g5',
        evalAfter: { cp: -350 },
        refutationUci: ['d8g5'],
      }),
    );
    expect(ex.primary?.kind).toBe('loses_material');
    const text = renderPrimary(ex.primary!);
    expect(text).toBe('This hangs your knight on g5 — Qxg5 simply wins it.');
  });

  it('produces the T3 pinned-defender sentence', () => {
    // Black wastes a tempo; Nxe5 wins the pawn because Nc6 is pinned by Bb5
    const ex = explainMove(
      args({
        fenBefore: '4k3/7p/2n5/1B2p3/8/5N2/8/4K3 b - - 0 1',
        uci: 'h7h6',
        mover: 'black',
        evalAfter: { cp: 150 },
        refutationUci: ['f3e5'],
        winDrop: 12,
      }),
    );
    expect(ex.primary?.kind).toBe('loses_material');
    if (ex.primary?.kind !== 'loses_material') throw new Error('unreachable');
    expect(ex.primary.reason).toBe('defender_pinned');
    const text = renderPrimary(ex.primary);
    expect(text).toContain('knight on c6');
    expect(text).toContain('pinned to your king');
    expect(text).toContain('cannot recapture');
  });

  it('names an allowed fork with the opponent move and both targets', () => {
    // Black wastes a tempo and allows Nc7+, royal-forking Ke8 and Ra8
    const ex = explainMove(
      args({
        fenBefore: 'r3k3/7p/8/3N4/8/8/8/4K3 b - - 0 1',
        uci: 'h7h6',
        mover: 'black',
        evalAfter: { cp: 400 },
        refutationUci: ['d5c7'],
      }),
    );
    expect(ex.primary?.kind).toBe('allows_fork');
    const text = renderPrimary(ex.primary!);
    expect(text).toContain('Nc7+');
    expect(text).toContain('rook on a8');
    expect(text).toContain('king on e8');
  });

  it('names an allowed forced mate with the mating line', () => {
    // Kh8?? walks into back-rank mate Rd8#
    const ex = explainMove(
      args({
        fenBefore: '6k1/5ppp/8/8/8/8/8/3R2K1 b - - 0 1',
        uci: 'g8h8',
        mover: 'black',
        evalAfter: { mate: 1 },
        refutationUci: ['d1d8'],
      }),
    );
    expect(ex.primary?.kind).toBe('allows_mate');
    expect(renderPrimary(ex.primary!)).toBe('This allows a forced mate in 1: Rd8#.');
  });

  it('falls back to a verified positional fragment on a quiet bad move', () => {
    // g4? weakens the king's pawn shield; no tactic exists
    const ex = explainMove(
      args({
        fenBefore: '6k1/8/8/8/8/8/6PP/6K1 w - - 0 1',
        uci: 'g2g4',
        evalAfter: { cp: -80 },
        refutationUci: ['g8f7'],
        winDrop: 8,
      }),
    );
    expect(ex.primary?.kind).toBe('positional');
    expect(renderPrimary(ex.primary!)).toBe(
      'This weakens the pawn shield in front of your king.',
    );
  });

  it('builds the better-was clause from the best move purpose', () => {
    // White shuffles the king while Qxd8 won the undefended rook
    const ex = explainMove(
      args({
        fenBefore: '3r3k/8/8/8/8/8/8/K2Q4 w - - 0 1',
        uci: 'a1a2',
        evalAfter: { cp: -50 },
        refutationUci: ['d8d1'],
        bestPvUci: ['d1d8'],
        bestEval: { cp: 500 },
      }),
    );
    expect(ex.betterWas?.kind).toBe('wins_material');
    const clause = renderBetterWas('Qxd8+', ex.betterWas);
    expect(clause).toContain('Qxd8+ was better, winning the rook on d8');
    expect(clause).toContain('it is undefended');
  });
});

describe('explainGoodMove — purpose detection', () => {
  it('explains a capture that wins because the defender is pinned', () => {
    const ex = explainMove(
      args({
        fenBefore: '4k3/8/2n5/1B2p3/8/5N2/8/4K3 w - - 0 1',
        uci: 'f3e5',
        isBad: false,
        evalAfter: { cp: 120 },
      }),
    );
    expect(ex.primary?.kind).toBe('wins_material');
    const text = renderPrimary(ex.primary!);
    expect(text).toContain('wins the pawn on e5');
    expect(text).toContain('pinned');
  });

  it('explains a fork', () => {
    // Nc7+ royal fork
    const ex = explainMove(
      args({
        fenBefore: 'r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1',
        uci: 'd5c7',
        isBad: false,
        evalAfter: { cp: 400 },
      }),
    );
    expect(ex.primary?.kind).toBe('fork_for');
    const text = renderPrimary(ex.primary!);
    expect(text).toContain('forks the rook on a8 and the king on e8');
  });

  it('explains delivered checkmate', () => {
    const ex = explainMove(
      args({
        fenBefore: '6k1/5ppp/8/8/8/8/8/3R2K1 w - - 0 1',
        uci: 'd1d8',
        isBad: false,
        evalAfter: { mate: 1 },
      }),
    );
    expect(ex.primary).toEqual({ kind: 'mate_for', n: 0 });
  });

  it('never invents a tactic on a quiet move (generic fallback)', () => {
    const ex = explainMove(
      args({
        fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        uci: 'a2a3',
        isBad: false,
        evalAfter: { cp: 10 },
      }),
    );
    // a3 does nothing verifiable → no fact at all (UI falls back to eval words)
    expect(ex.primary).toBeNull();
  });

  it('explains development in the opening', () => {
    const ex = explainMove(
      args({
        fenBefore: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        uci: 'g8f6',
        mover: 'black',
        isBad: false,
        evalAfter: { cp: 20 },
      }),
    );
    expect(ex.primary?.kind).toBe('positional');
    expect(renderPrimary(ex.primary!)).toBe('This develops a piece.');
  });
});
