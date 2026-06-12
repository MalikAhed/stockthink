/**
 * Deep book detection (lichess masters explorer) — prefix walk, thresholds,
 * and silent degradation (the analyzer must never lose a game to a fetch).
 */
import { describe, expect, it, vi } from 'vitest';
import { masterBookPlies } from '../src/analysis/explorer';

const ply = (san: string) => ({ fenBefore: `fen-${san}`, san });

const explorerResponse = (moves: Array<[string, number]>) => ({
  ok: true,
  json: async () => ({
    moves: moves.map(([san, games]) => ({ san, white: games, draws: 0, black: 0 })),
  }),
});

describe('masterBookPlies', () => {
  it('walks the prefix and stops at the first non-book move', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(explorerResponse([['e4', 5000]]))
      .mockResolvedValueOnce(explorerResponse([['e5', 4000]]))
      .mockResolvedValueOnce(explorerResponse([['Nf3', 3000]])) // played san not listed
      .mockResolvedValueOnce(explorerResponse([['d4', 9999]]));
    const out = await masterBookPlies([ply('e4'), ply('e5'), ply('h4'), ply('d4')], fetchFn as never);
    expect([...out]).toEqual([0, 1]);
    expect(fetchFn).toHaveBeenCalledTimes(3); // never queried past the miss
  });

  it('a move below the games threshold is not book', async () => {
    const fetchFn = vi.fn().mockResolvedValue(explorerResponse([['e4', 9]]));
    expect((await masterBookPlies([ply('e4')], fetchFn as never)).size).toBe(0);
  });

  it('degrades silently on HTTP error and on network failure', async () => {
    const httpErr = vi
      .fn()
      .mockResolvedValueOnce(explorerResponse([['e4', 100]]))
      .mockResolvedValueOnce({ ok: false, status: 429 });
    expect([...(await masterBookPlies([ply('e4'), ply('e5')], httpErr as never))]).toEqual([0]);

    const netErr = vi.fn().mockRejectedValue(new Error('offline'));
    expect((await masterBookPlies([ply('e4')], netErr as never)).size).toBe(0);
  });

  it('queries the masters endpoint with the position FEN', async () => {
    const fetchFn = vi.fn().mockResolvedValue(explorerResponse([['e4', 100]]));
    await masterBookPlies([ply('e4')], fetchFn as never);
    const url = fetchFn.mock.calls[0][0] as string;
    expect(url).toContain('explorer.lichess.ovh/masters');
    expect(url).toContain(encodeURIComponent('fen-e4'));
  });
});
