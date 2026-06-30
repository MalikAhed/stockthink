/**
 * report.ts plumbing: annotateContext must carry the free engine signals the
 * grounding/silence layers will read — the after-position reply lines and the
 * before-position shallow eval — without disturbing any existing context field
 * (RESEARCH §1.2–1.3, data only — no detector consumes them yet).
 */
import { describe, expect, it } from 'vitest';
import { annotateContext } from '@backend/analysis/report';
import type { EngineLine, PositionAnalysis } from '@backend/engine/engine';

const line = (multipv: number, cp: number, pvUci: string[]): EngineLine => ({
  multipv,
  depth: 20,
  eval: { cp },
  pvUci,
});

const before: PositionAnalysis = {
  fen: 'before',
  lines: [line(1, 30, ['e2e4', 'e7e5']), line(2, 10, ['d2d4', 'd7d5'])],
  bestmoveUci: 'e2e4',
  terminal: false,
  shallowEval: { cp: 120 },
};
const after: PositionAnalysis = {
  fen: 'after',
  lines: [line(1, -40, ['g8f6']), line(2, -10, ['b8c6']), line(3, 50, ['f7f5'])],
  bestmoveUci: 'g8f6',
  terminal: false,
};
const derived = { evalBefore: { cp: 30 }, evalAfter: { cp: -40 }, winDrop: 5, bestUci: 'e2e4' };

describe('annotateContext — free-signal plumbing (RESEARCH §1.2–1.3)', () => {
  it('threads the before-position shallowEval into the context (1.2)', () => {
    expect(annotateContext(before, after, derived).shallowEval).toEqual({ cp: 120 });
  });

  it('carries the full after-position reply lines with evals, alongside replyPv (1.3)', () => {
    const ctx = annotateContext(before, after, derived);
    expect(ctx.replyPv).toEqual(['g8f6']); // unchanged: still after.lines[0].pvUci
    expect(ctx.replyLines).toHaveLength(3);
    expect(ctx.replyLines![0].pvUci).toEqual(ctx.replyPv); // [0] is the refutation replyPv heads
    expect(ctx.replyLines![1].eval).toEqual({ cp: -10 }); // the Phase 2.3 uniqueness signal
  });

  it('leaves every existing context field byte-identical (no behaviour change)', () => {
    const ctx = annotateContext(before, after, derived);
    expect(ctx.evalBefore).toEqual({ cp: 30 });
    expect(ctx.evalAfter).toEqual({ cp: -40 });
    expect(ctx.winDrop).toBe(5);
    expect(ctx.bestUci).toBe('e2e4');
    expect(ctx.lines).toEqual([
      { eval: { cp: 30 }, pvUci: ['e2e4', 'e7e5'] },
      { eval: { cp: 10 }, pvUci: ['d2d4', 'd7d5'] },
    ]);
  });

  it('tolerates missing / terminal after-positions without losing the before-signal', () => {
    const undefinedAfter = annotateContext(before, undefined, derived); // last ply of a game
    expect(undefinedAfter.replyPv).toBeUndefined();
    expect(undefinedAfter.replyLines).toBeUndefined();

    const terminal: PositionAnalysis = { fen: 'mate', lines: [], bestmoveUci: null, terminal: true };
    const ctx = annotateContext(before, terminal, derived);
    expect(ctx.replyPv).toBeUndefined();
    expect(ctx.replyLines).toEqual([]);
    expect(ctx.shallowEval).toEqual({ cp: 120 }); // before-position signal survives
  });
});
