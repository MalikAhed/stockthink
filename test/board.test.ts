import { describe, expect, it } from 'vitest';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { parseSquare } from 'chessops/util';
import { isDefended, isHanging, materialCount, see } from '../src/concepts/board';

const pos = (fen: string): Chess => Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
const sq = (name: string) => parseSquare(name)!;

describe('board primitives', () => {
  it('materialCount sums standard values', () => {
    const p = pos('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(materialCount(p.board, 'white')).toBe(39);
    expect(materialCount(p.board, 'black')).toBe(39);
  });

  it('isDefended sees x-ray defenders through an enemy ray attacker', () => {
    // Black rook d8 attacks white knight d4; white rook d1 defends d4 only
    // through... nothing in between: plain defense.
    const direct = pos('3r3k/8/8/8/3N4/8/8/3R3K w - - 0 1');
    expect(isDefended(direct.board, sq('d4'))).toBe(true);
    // White pawn e3 defended by Qd2 x-raying THROUGH attacking Bc5? No —
    // x-ray case: white knight d4 defended by Rd1 behind black Rd2 attacker.
    const xray = pos('7k/8/8/8/3N4/8/3r4/3R3K w - - 0 1');
    expect(isDefended(xray.board, sq('d4'))).toBe(true);
    const undefended = pos('7k/8/8/8/3N4/8/3r4/4R2K w - - 0 1');
    expect(isDefended(undefended.board, sq('d4'))).toBe(false);
  });

  it('isHanging: undefended + attacked, or attackable by a cheaper piece', () => {
    const undefended = pos('7k/8/8/8/3N4/8/3r4/4R2K w - - 0 1');
    expect(isHanging(undefended.board, sq('d4'))).toBe(true);
    // Queen defended but attacked by a pawn → still hanging
    const byPawn = pos('7k/8/4p3/3Q4/8/8/8/3R3K w - - 0 1');
    expect(isHanging(byPawn.board, sq('d5'))).toBe(true);
    // Defended knight attacked only by an equal-value piece → not hanging
    const safe = pos('7k/8/8/8/3N4/8/3n4/3R3K w - - 0 1');
    expect(isHanging(safe.board, sq('d4'))).toBe(false);
  });

  it('SEE: winning, equal and losing captures', () => {
    // pawn takes undefended pawn: +1
    const free = pos('1k6/8/8/3p4/4P3/8/8/1K6 w - - 0 1');
    expect(see(free, sq('e4'), sq('d5'))).toBe(1);
    // rook takes pawn defended by pawn: 1 - 5 = -4
    const bad = pos('1k6/2p5/3p4/8/3R4/8/8/1K6 w - - 0 1');
    expect(see(bad, sq('d4'), sq('d6'))).toBe(-4);
    // pawn takes pawn defended by pawn: 1 - 1 = 0 (even trade)
    const even = pos('1k6/2p5/3p4/4P3/8/8/8/1K6 w - - 0 1');
    expect(see(even, sq('e5'), sq('d6'))).toBe(0);
    // x-ray: Rxd6 with second white rook behind on d1, pawn defended by c7 pawn:
    // 1 (pawn) - 5 (Rd4 falls) + 1... actually exchange: Rxd6 cxd6 Rxd6 → +1-5+1 = -3
    const xray = pos('1k6/2p5/3p4/8/3R4/8/8/1K1R4 w - - 0 1');
    expect(see(xray, sq('d4'), sq('d6'))).toBe(-3);
  });
});
