import { describe, expect, it } from 'vitest';
import {
  moveAccuracy,
  toWhitePov,
  winPercent,
  winPercentDrop,
} from '@backend/analysis/winprob';

// Anchor values verified against lichess source/docs during research.
describe('winPercent', () => {
  it('is 50% for an equal position', () => {
    expect(winPercent({ cp: 0 })).toBeCloseTo(50, 5);
  });
  it('is ~59.1% at +100cp (lichess sigmoid)', () => {
    expect(winPercent({ cp: 100 })).toBeCloseTo(59.1, 0.5);
  });
  it('caps at ~97.55% for cp (clamp ±1000)', () => {
    expect(winPercent({ cp: 1000 })).toBeCloseTo(97.55, 1);
    expect(winPercent({ cp: 5000 })).toBeCloseTo(97.55, 1); // clamped
  });
  it('mate always beats any cp eval: M1≈99.94%, M10+≈98.3%', () => {
    expect(winPercent({ mate: 1 })).toBeGreaterThan(99.9);
    expect(winPercent({ mate: 10 })).toBeCloseTo(98.3, 0.5);
    expect(winPercent({ mate: 30 })).toBeCloseTo(98.3, 0.5); // min(10, N)
    expect(winPercent({ mate: 10 })).toBeGreaterThan(winPercent({ cp: 99999 }));
  });
  it('is symmetric for black', () => {
    expect(winPercent({ cp: -100 })).toBeCloseTo(100 - winPercent({ cp: 100 }), 5);
    expect(winPercent({ mate: -3 })).toBeCloseTo(100 - winPercent({ mate: 3 }), 5);
  });
});

describe('winPercentDrop', () => {
  it('is 0 when the position improves for the mover', () => {
    expect(winPercentDrop('white', { cp: 50 }, { cp: 200 })).toBe(0);
  });
  it('measures the drop from the mover POV', () => {
    const drop = winPercentDrop('black', { cp: 0 }, { cp: 300 });
    expect(drop).toBeGreaterThan(15); // black just lost ~19 win points
  });
});

describe('moveAccuracy', () => {
  it('is 100 for the best move', () => {
    expect(moveAccuracy(0)).toBe(100);
  });
  it('matches the lichess curve at a 10-point drop (~64.6+1)', () => {
    // 103.1668·e^(−0.43544) − 3.1669 ≈ 63.5; +1 bonus ≈ 64.5
    expect(moveAccuracy(10)).toBeGreaterThan(60);
    expect(moveAccuracy(10)).toBeLessThan(70);
  });
  it('approaches 0 for catastrophic drops', () => {
    expect(moveAccuracy(90)).toBeLessThan(2);
  });
});

describe('toWhitePov', () => {
  it('negates scores when black is to move', () => {
    expect(toWhitePov('black', { cp: 35 })).toEqual({ cp: -35, mate: undefined });
    expect(toWhitePov('black', { mate: -2 })).toEqual({ cp: undefined, mate: 2 });
    expect(toWhitePov('white', { cp: 35 })).toEqual({ cp: 35 });
  });
});
