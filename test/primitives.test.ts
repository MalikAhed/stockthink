/**
 * MANDATORY acceptance suite for the "why" detectors
 * (CHESS_WHY_EXPLANATION_ENGINE_SPEC §10) — all 21 checks, verified
 * against the python-chess reference implementation.
 */
import { describe, expect, it } from 'vitest';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { parseSan } from 'chessops/san';
import type { NormalMove } from 'chessops/types';
import { parseSquare } from 'chessops/util';
import {
  discoveredAttacks,
  effectiveDefenders,
  forkTargets,
  isBackRankMate,
  isDefended,
  isHanging,
  isPinned,
  isSkewer,
  isTrapped,
  materialDiff,
  mateThreat,
  pinsCreated,
  seeCapture,
  whyCapturable,
} from '../src/concepts/primitives';
import { winPercent } from '../src/analysis/winprob';

const pos = (fen: string): Chess => Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
const sq = (name: string) => parseSquare(name)!;
const mv = (uci: string): NormalMove => ({ from: sq(uci.slice(0, 2)), to: sq(uci.slice(2, 4)) });

describe('T0 win_pct sanity', () => {
  it('win_pct(0) == 50', () => {
    expect(winPercent({ cp: 0 })).toBeCloseTo(50, 9);
  });
  it('win_pct(100) ≈ 59', () => {
    const v = winPercent({ cp: 100 });
    expect(v).toBeGreaterThan(58.5);
    expect(v).toBeLessThan(60);
  });
  it('win_pct(-300) ≈ 26', () => {
    const v = winPercent({ cp: -300 });
    expect(v).toBeGreaterThan(24);
    expect(v).toBeLessThan(28);
  });
});

describe('T1 hanging piece + SEE', () => {
  it('T1a Nd5 hanging', () => {
    const p = pos('k7/8/8/3n4/8/8/3Q4/3K4 w - - 0 1');
    expect(isHanging(p.board, sq('d5'))).toBe(true);
  });
  it('T1b SEE Qxd5 == +3', () => {
    const p = pos('k7/8/8/3n4/8/8/3Q4/3K4 w - - 0 1');
    expect(seeCapture(p, mv('d2d5'))).toBe(3);
  });
  it('T1c SEE Qxd5 == -6 (pawn defends)', () => {
    const p = pos('k7/8/2p5/3n4/8/8/3Q4/3K4 w - - 0 1');
    expect(seeCapture(p, mv('d2d5'))).toBe(-6);
  });
  it('T1d defended knight: is_defended true', () => {
    const p = pos('k7/8/2p5/3n4/8/8/3Q4/3K4 w - - 0 1');
    expect(isDefended(p.board, sq('d5'))).toBe(true);
  });
});

describe('T2 fork', () => {
  it('knight on c7 forks Ke8 and Ra8 (royal fork)', () => {
    const p = pos('r3k3/2N5/8/8/8/8/8/4K3 b - - 0 1');
    const targets = forkTargets(p.board, sq('c7'));
    expect(new Set(targets)).toEqual(new Set([sq('a8'), sq('e8')]));
  });
});

describe('T3 pinned defender (THE target sentence)', () => {
  const fen = '4k3/8/2n5/1B2p3/8/5N2/8/4K3 w - - 0 1';
  it('T3a Nc6 is absolutely pinned', () => {
    expect(isPinned(pos(fen).board, sq('c6'))).toBe(true);
  });
  it('T3b e5 is naively defended', () => {
    expect(isDefended(pos(fen).board, sq('e5'))).toBe(true);
  });
  it('T3c e5 has no EFFECTIVE defenders', () => {
    expect(effectiveDefenders(pos(fen).board, sq('e5'))).toEqual([]);
  });
  it('T3d why_capturable(e5) == defender_pinned', () => {
    expect(whyCapturable(pos(fen).board, sq('e5'))).toBe('defender_pinned');
  });
  it('T3e SEE Nxe5 == +1 (pinned recapture is illegal)', () => {
    expect(seeCapture(pos(fen), mv('f3e5'))).toBe(1);
  });
});

describe('T4 trapped piece', () => {
  it('Ba7 is trapped (Bxa7 b6! trap)', () => {
    const p = pos('r3k3/B1p5/1p6/8/8/8/8/4K3 w - - 0 1');
    expect(isTrapped(p, sq('a7'))).toBe(true);
  });
});

describe('T5 back-rank mate', () => {
  it('Ra8# is a back-rank mate', () => {
    const p = pos('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
    const m = parseSan(p, 'Ra8#')!;
    p.play(m);
    expect(p.isCheckmate()).toBe(true);
    expect(isBackRankMate(p)).toBe(true);
  });
});

describe('T6 mate threat', () => {
  it('finds Rd8# as the threatened mate', () => {
    const p = pos('6k1/5ppp/8/8/8/8/5PPP/3R2K1 b - - 0 1');
    const threat = mateThreat(p);
    expect(threat).toBeTruthy();
    expect(threat).toMatchObject({ from: sq('d1'), to: sq('d8') });
  });
});

describe('T7 discovered attack', () => {
  it('Nd4-f5 opens Rd1 onto Qd8', () => {
    const p = pos('3qk3/8/8/8/3N4/8/8/3R2K1 w - - 0 1');
    const pairs = discoveredAttacks(p, mv('d4f5'));
    expect(pairs).toContainEqual({ attacker: sq('d1'), target: sq('d8') });
  });
});

describe('T8 pin created', () => {
  it('Bf1-b5 pins Nc6 to Ke8', () => {
    const p = pos('4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1');
    expect(pinsCreated(p, mv('f1b5'))).toEqual([sq('c6')]);
  });
});

describe('T9 skewer', () => {
  it('Qa5-d4 fled the a-file; Rxa8 wins the knight behind', () => {
    const p = pos('n6k/8/8/8/3q4/8/8/R3K3 w - - 0 1');
    expect(isSkewer(p, mv('a1a8'), mv('a5d4'))).toBe(true);
  });
});

describe('T10 material diff', () => {
  it('K+R vs K is +5 for white', () => {
    const p = pos('k7/8/8/8/8/8/8/K2R4 w - - 0 1');
    expect(materialDiff(p.board, 'white')).toBe(5);
  });
});
