/**
 * Move-level tactical detectors (V2 M1) — each detector gets at least one
 * positive and one negative FEN case.
 */
import { describe, expect, it } from 'vitest';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import type { NormalMove } from 'chessops/types';
import { parseSquare } from 'chessops/util';
import {
  attackedPieces,
  blocksCheck,
  capturesFreePiece,
  capturesHigherPiece,
  createsFork,
  createsMateThreat,
  defendsHangingPieces,
  forkingMoves,
  freeCaptures,
  hangsPieces,
  isSacrifice,
  isTrade,
  trapsPieces,
  winsTempo,
} from '../src/concepts/detectors';

const pos = (fen: string): Chess => Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
const sq = (name: string) => parseSquare(name)!;
const mv = (uci: string): NormalMove => ({ from: sq(uci.slice(0, 2)), to: sq(uci.slice(2, 4)) });

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('hangsPieces', () => {
  it('moving the queen onto an attacked square hangs it', () => {
    const p = pos('6k1/8/8/4r3/8/8/8/3Q2K1 w - - 0 1');
    expect(hangsPieces(p, mv('d1d5'))).toEqual([sq('d5')]);
  });
  it('moving the defender away leaves the knight hanging', () => {
    const p = pos('2r3k1/8/8/8/8/2N5/3Q4/6K1 w - - 0 1');
    expect(hangsPieces(p, mv('d2h6'))).toEqual([sq('c3')]);
  });
  it('a queen move that keeps defending the knight hangs nothing', () => {
    const p = pos('2r3k1/8/8/8/8/2N5/3Q4/6K1 w - - 0 1');
    expect(hangsPieces(p, mv('d2e3'))).toEqual([]); // Qe3 still guards c3 along the rank
  });
});

describe('defendsHangingPieces', () => {
  it('Qd2 newly protects the attacked knight on c3', () => {
    const p = pos('2r3k1/8/8/8/8/2N5/8/3Q2K1 w - - 0 1');
    expect(defendsHangingPieces(p, mv('d1d2'))).toEqual([sq('c3')]);
  });
  it('a queen move that ignores the hanging knight defends nothing', () => {
    const p = pos('2r3k1/8/8/8/8/2N5/8/3Q2K1 w - - 0 1');
    expect(defendsHangingPieces(p, mv('d1f1'))).toEqual([]);
  });
});

describe('createsFork / forkingMoves', () => {
  const fen = 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1';
  it('Nc7+ royal-forks king and rook', () => {
    expect(new Set(createsFork(pos(fen), mv('b5c7')))).toEqual(new Set([sq('a8'), sq('e8')]));
  });
  it('Nd4 forks nothing', () => {
    expect(createsFork(pos(fen), mv('b5d4'))).toEqual([]);
  });
  it('forkingMoves finds Nc7+', () => {
    expect(forkingMoves(pos(fen))).toContainEqual(mv('b5c7'));
  });
});

describe('trapsPieces', () => {
  const fen = 'r3k3/Bpp5/8/8/8/8/8/4K3 b - - 0 1'; // white Ba7 just grabbed a pawn
  it('…b6! traps the bishop on a7', () => {
    expect(trapsPieces(pos(fen), mv('b7b6'))).toEqual([sq('a7')]);
  });
  it('…c6 leaves the bishop an escape via b6', () => {
    expect(trapsPieces(pos(fen), mv('c7c6'))).toEqual([]);
  });
  it('an ALREADY trapped piece is not re-announced by an unrelated move', () => {
    // bishop a7 was boxed in last move; …c6 did not trap it
    const stale = 'r3k3/B1p5/1p6/8/8/8/8/4K3 b - - 0 1';
    expect(trapsPieces(pos(stale), mv('c7c6'))).toEqual([]);
  });
});

describe('captures', () => {
  it('capturesFreePiece: Qxd5 wins the undefended knight outright', () => {
    expect(capturesFreePiece(pos('k7/8/8/3n4/8/8/3Q4/3K4 w - - 0 1'), mv('d2d5'))).toBe(true);
  });
  it('capturesFreePiece: not free when a pawn defends', () => {
    expect(capturesFreePiece(pos('k7/8/2p5/3n4/8/8/3Q4/3K4 w - - 0 1'), mv('d2d5'))).toBe(false);
  });
  it('capturesHigherPiece: rook takes queen', () => {
    expect(capturesHigherPiece(pos('k7/8/8/3q4/8/8/3R4/3K4 w - - 0 1'), mv('d2d5'))).toBe(true);
  });
  it('capturesHigherPiece: queen takes knight is not higher', () => {
    expect(capturesHigherPiece(pos('k7/8/8/3n4/8/8/3Q4/3K4 w - - 0 1'), mv('d2d5'))).toBe(false);
  });
  it('freeCaptures lists the winning capture and nothing in the defended case', () => {
    expect(freeCaptures(pos('k7/8/8/3n4/8/8/3Q4/3K4 w - - 0 1'))).toContainEqual(mv('d2d5'));
    expect(freeCaptures(pos('k7/8/2p5/3n4/8/8/3Q4/3K4 w - - 0 1'))).toEqual([]);
  });
});

describe('isTrade', () => {
  it('QxQ with a recapture available is a trade', () => {
    expect(isTrade(pos('2kq4/8/8/8/8/8/8/K2Q4 w - - 0 1'), mv('d1d8'))).toBe(true);
  });
  it('QxQ with no possible recapture is not a trade', () => {
    expect(isTrade(pos('k2q4/8/8/8/8/8/8/K2Q4 w - - 0 1'), mv('d1d8'))).toBe(false);
  });
  it('unequal capture is not a trade', () => {
    expect(isTrade(pos('k7/8/8/3q4/8/8/3R4/3K4 w - - 0 1'), mv('d2d5'))).toBe(false);
  });
});

describe('isSacrifice', () => {
  it('Bxh7+ (Greek gift screening): bishop for pawn', () => {
    const p = pos('rnbq1rk1/ppppbppp/8/8/8/3B4/PPPP1PPP/RNBQK2R w KQ - 0 1');
    expect(isSacrifice(p, mv('d3h7'))).toBe(true);
  });
  it('placing the queen en prise is a (screened) sacrifice', () => {
    expect(isSacrifice(pos('6k1/8/8/4r3/8/8/8/3Q2K1 w - - 0 1'), mv('d1d5'))).toBe(true);
  });
  it('a normal developing move is not a sacrifice', () => {
    expect(isSacrifice(pos(START), mv('b1c3'))).toBe(false);
  });
});

describe('blocksCheck', () => {
  it('interposing the rook blocks the check', () => {
    expect(blocksCheck(pos('k7/8/8/8/4r3/8/7R/4K3 w - - 0 1'), mv('h2e2'))).toBe(true);
  });
  it('a king move is not a block', () => {
    expect(blocksCheck(pos('k7/8/8/8/4r3/8/7R/4K3 w - - 0 1'), mv('e1d1'))).toBe(false);
  });
  it('capturing the checker is not a block', () => {
    expect(blocksCheck(pos('k7/8/8/8/4r2R/8/8/4K3 w - - 0 1'), mv('h4e4'))).toBe(false);
  });
});

describe('createsMateThreat', () => {
  it('Rd1 threatens the back-rank mate Rd8#', () => {
    const p = pos('6k1/5ppp/8/8/8/8/5PPP/2R3K1 w - - 0 1');
    expect(createsMateThreat(p, mv('c1d1'))).toMatchObject({ from: sq('d1'), to: sq('d8') });
  });
  it('1. e4 threatens no mate', () => {
    expect(createsMateThreat(pos(START), mv('e2e4'))).toBeNull();
  });
});

describe('winsTempo', () => {
  it('Nf3 attacking the queen on h4 gains a tempo', () => {
    const p = pos('rnb1kbnr/pppp1ppp/8/4p3/4P2q/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1');
    expect(winsTempo(p, mv('g1f3'))).toBe(sq('h4'));
  });
  it('Nf3 attacking only a pawn gains nothing', () => {
    const p = pos('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1');
    expect(winsTempo(p, mv('g1f3'))).toBeNull();
  });
  it('an absolutely pinned attacker threatens nothing off its pin ray', () => {
    // Ne4 "attacks" the queen on g5, but the knight is pinned to the king by Re8
    const p = pos('4r1k1/8/8/6q1/8/3P4/3N4/4K3 w - - 0 1');
    expect(winsTempo(p, mv('d2e4'))).toBeNull();
  });
  it('the same knight unpinned does win the tempo', () => {
    const p = pos('6k1/8/8/6q1/8/3P4/3N4/4K3 w - - 0 1');
    expect(winsTempo(p, mv('d2e4'))).toBe(sq('g5'));
  });
});

describe('attackedPieces', () => {
  it('lists the knight under attack by the rook', () => {
    expect(attackedPieces(pos('2r3k1/8/8/8/8/2N5/8/3Q2K1 w - - 0 1'), 'white')).toEqual([
      sq('c3'),
    ]);
  });
  it('empty when nothing is attacked', () => {
    expect(attackedPieces(pos(START), 'white')).toEqual([]);
  });
});
