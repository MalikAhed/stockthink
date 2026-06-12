/**
 * Best-move Spotlight — step builder: captions are board-verified (capture/
 * check/mate), depth capped at 3 confident moves, user POV correct for both
 * best lines and refutations.
 */
import { describe, expect, it } from 'vitest';
import { buildWalkthrough, CONFIDENT_PLIES, lineOutcome } from '../src/ui/walkthrough';
import type { VariationChip } from '../src/compose/compose';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const chip = (over: Partial<VariationChip>): VariationChip => ({
  label: 'Best: e4',
  kind: 'best',
  sanPv: ['e4'],
  uciPv: ['e2e4'],
  fen: START,
  ...over,
});

describe('buildWalkthrough', () => {
  it('intro previews the best move, then one step per ply with friendly captions', () => {
    // Scholar's mate finish (after 1.e4 e5 2.Bc4 Nc6): Qh5 Nf6 Qxf7#
    const steps = buildWalkthrough(
      chip({
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3',
        sanPv: ['Qh5', 'Nf6', 'Qxf7#'],
        uciPv: ['d1h5', 'g8f6', 'h5f7'],
      }),
      'd4',
    );
    expect(steps).toHaveLength(4); // intro + 3 plies
    expect(steps[0].side).toBe('intro');
    expect(steps[0].caption).toContain('Instead of d4');
    expect(steps[0].arrow?.brush).toBe('green');
    expect(steps[1].side).toBe('you');
    expect(steps[1].caption).toContain('Qh5');
    expect(steps[2].side).toBe('opponent'); // reply steps belong to the opponent
    expect(steps[2].arrow?.brush).toBe('yellow');
    const mate = steps[3];
    expect(mate.caption).toContain('captures the pawn on f7');
    expect(mate.caption).toContain('checkmate');
  });

  it('stops the walkthrough at checkmate even if the PV continues', () => {
    // Fool's mate refutation: 1.f3 e5 2.g4?? and Qh4# ends everything
    const steps = buildWalkthrough(
      chip({
        kind: 'refutation',
        fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2',
        sanPv: ['Qh4#', 'Ke2'],
        uciPv: ['d8h4', 'e1e2'],
      }),
      'g4',
    );
    expect(steps).toHaveLength(2); // intro + the mate, nothing after
    expect(steps[0].caption).toContain('wrong with g4');
    expect(steps[1].side).toBe('opponent'); // refutations start with the opponent's punish
    expect(steps[1].caption).toContain('checkmate');
  });

  it('beyond 3 moves: plain engine-continues caption + honesty note', () => {
    const shuffle = ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8'];
    const steps = buildWalkthrough(
      chip({ sanPv: ['Nf3'], uciPv: shuffle }),
      null,
    );
    expect(steps).toHaveLength(1 + shuffle.length);
    const confident = steps[CONFIDENT_PLIES]; // last explained ply
    expect(confident.note).toBeUndefined();
    const deep = steps[CONFIDENT_PLIES + 1];
    expect(deep.caption).toContain('The engine continues');
    expect(deep.note).toContain('3 moves');
  });

  it('intro carries the machine-verified WHY (forced mate)', () => {
    const steps = buildWalkthrough(
      chip({
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3',
        sanPv: ['Qh5', 'Nf6', 'Qxf7#'],
        uciPv: ['d1h5', 'g8f6', 'h5f7'],
      }),
      'd4',
    );
    expect(steps[0].caption).toContain('it forces checkmate');
  });

  it('truncates at an illegal pv move instead of guessing', () => {
    const steps = buildWalkthrough(
      chip({ uciPv: ['e2e4', 'e2e4'], sanPv: ['e4', '??'] }),
      null,
    );
    expect(steps).toHaveLength(2); // intro + the one legal ply
  });
});

describe('lineOutcome (the WHY proof)', () => {
  it('detects a forced mate with the right move count', () => {
    const o = lineOutcome('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3', [
      'd1h5',
      'g8f6',
      'h5f7',
    ]);
    expect(o).toEqual({ kind: 'mate', mateIn: 2 });
  });

  it('detects a clean piece win, measured at a quiet point', () => {
    // Qxd6 takes a free knight; the quiet king reply settles the count
    const o = lineOutcome('4k3/8/3n4/8/8/8/3Q4/4K3 w - - 0 1', ['d2d6', 'e8f7']);
    expect(o).toEqual({ kind: 'material', pieceWon: 'knight' });
  });

  it('does not promise material when the PV ends mid-exchange', () => {
    // capture with no quiet move after it — the exchange may not be over
    expect(lineOutcome('4k3/8/3n4/8/8/8/3Q4/4K3 w - - 0 1', ['d2d6'])).toBeNull();
  });

  it('returns null for a quiet line with nothing concrete to show', () => {
    expect(
      lineOutcome('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', ['g1f3', 'g8f6']),
    ).toBeNull();
  });
});
