/**
 * Mode B R4 verifier + exchange (V2 M5) — hallucinated pieces/moves and
 * eval-speak must be rejected; honest comments pass.
 */
import { describe, expect, it } from 'vitest';
import { verifyComment } from '../src/llm/verify';
import { importCommentary } from '../src/llm/exchange';
import type { GameFactsheet } from '../src/llm/factsheet';

const WHITELIST = ['Nf3', 'Qxd5+', 'e4', 'd5', 'c3', 'g8', 'Rxc3', 'O-O'];

describe('verifyComment', () => {
  it('accepts a comment using only whitelisted squares and moves', () => {
    const r = verifyComment(
      'Qxd5+ (queen takes d5 with check) wins the knight, since the rook on c3 is overloaded.',
      WHITELIST,
    );
    expect(r).toEqual({ ok: true, reasons: [] });
  });

  it('rejects a hallucinated move', () => {
    const r = verifyComment('Bxh7+ wins on the spot.', WHITELIST);
    expect(r.ok).toBe(false);
    expect(r.reasons[0]).toContain('Bxh7+');
  });

  it('rejects an unknown square', () => {
    const r = verifyComment('The bishop on a6 dominates.', WHITELIST);
    expect(r.ok).toBe(false);
    expect(r.reasons[0]).toContain('a6');
  });

  it('rejects eval-speak and engine references (R1)', () => {
    expect(verifyComment('This costs 13% in winning chances.', WHITELIST).ok).toBe(false);
    expect(verifyComment('The engine prefers Nf3.', WHITELIST).ok).toBe(false);
    expect(verifyComment('Stockfish shows mate.', WHITELIST).ok).toBe(false);
  });

  it('accepts castling notation', () => {
    expect(verifyComment('O-O tucks the king away.', WHITELIST).ok).toBe(true);
  });
});

describe('importCommentary', () => {
  const sheet = {
    headers: {},
    opening: null,
    moves: [
      { ply: 1, whitelist: WHITELIST },
      { ply: 2, whitelist: WHITELIST },
    ],
  } as unknown as GameFactsheet;

  it('accepts good comments and rejects hallucinated ones, with fences tolerated', () => {
    const pasted = [
      'Here you go:',
      '```json',
      JSON.stringify({
        comments: [
          { ply: 1, comment: 'Nf3 develops with tempo toward d5.' },
          { ply: 2, comment: 'Qh4 mates next move.' }, // Qh4 not whitelisted
        ],
      }),
      '```',
    ].join('\n');
    const r = importCommentary(pasted, sheet);
    expect(r.accepted.get(1)).toContain('Nf3');
    expect(r.accepted.has(2)).toBe(false);
    expect(r.rejected.get(2)![0]).toContain('Qh4');
  });

  it('throws a clear error on non-JSON input', () => {
    expect(() => importCommentary('no json here', sheet)).toThrow(/JSON/);
  });
});
