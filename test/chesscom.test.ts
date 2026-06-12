/**
 * chess.com import: archive normalization, outcome mapping, and the analysis
 * queue's contract — order, dedupe, foreground preemption (runNow), cancel,
 * and failure isolation. No network, no engine: fetchers stay thin and the
 * queue takes an injected analyzer.
 */
import { describe, expect, it } from 'vitest';
import type { AnnotatedReport } from '../src/analyze';
import {
  archiveLabel,
  dateLabel,
  moveCount,
  normalizeGames,
  resultLabel,
  userOutcome,
  userSide,
  type CcGame,
} from '../src/chesscom/api';
import { AnalysisQueue, type AnalyzeFn } from '../src/chesscom/queue';
import { cachedKeys, getReport, putReport } from '../src/chesscom/store';

const rawGame = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  uuid: 'g1',
  url: 'https://www.chess.com/game/live/1',
  pgn: '[Event "Live Chess"]\n\n1. e4 e5 2. Nf3 1-0',
  end_time: 1_777_737_679,
  time_class: 'blitz',
  time_control: '180',
  rules: 'chess',
  rated: true,
  white: { username: 'Alice', rating: 1500, result: 'win' },
  black: { username: 'Bob', rating: 1480, result: 'resigned' },
  accuracies: { white: 91.2, black: 84.0 },
  ...over,
});

const game = (over: Record<string, unknown> = {}): CcGame =>
  normalizeGames([rawGame(over)]).games[0];

describe('normalizeGames', () => {
  it('maps fields and keeps accuracies when both sides have one', () => {
    const g = game();
    expect(g).toMatchObject({
      uuid: 'g1',
      timeClass: 'blitz',
      rated: true,
      endTime: 1_777_737_679,
      accuracies: { white: 91.2, black: 84.0 },
    });
    expect(g.moveCount).toBe(2);
  });

  it('hides variants and PGN-less games, sorts the rest newest first', () => {
    const { games, hidden } = normalizeGames([
      rawGame({ uuid: 'old', end_time: 100 }),
      rawGame({ uuid: 'v960', rules: 'chess960' }),
      rawGame({ uuid: 'nopgn', pgn: undefined }),
      rawGame({ uuid: 'new', end_time: 200 }),
    ]);
    expect(games.map(g => g.uuid)).toEqual(['new', 'old']);
    expect(hidden).toBe(2);
  });

  it('drops accuracies when only one side was reviewed', () => {
    expect(game({ accuracies: { white: 90 } }).accuracies).toBeUndefined();
  });
});

describe('outcome mapping', () => {
  it('finds the user side case-insensitively', () => {
    expect(userSide(game(), 'ALICE')).toBe('white');
    expect(userSide(game(), 'bob')).toBe('black');
  });

  it('maps win / draw / loss from the user perspective', () => {
    expect(userOutcome(game(), 'alice')).toBe('win');
    expect(userOutcome(game(), 'bob')).toBe('loss');
    for (const draw of ['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient']) {
      const g = game({
        white: { username: 'Alice', rating: 1500, result: draw },
        black: { username: 'Bob', rating: 1480, result: draw },
      });
      expect(userOutcome(g, 'alice')).toBe('draw');
    }
    for (const loss of ['checkmated', 'timeout', 'resigned', 'abandoned']) {
      const g = game({
        white: { username: 'Alice', rating: 1500, result: loss },
        black: { username: 'Bob', rating: 1480, result: 'win' },
      });
      expect(userOutcome(g, 'alice')).toBe('loss');
    }
  });

  it('renders the standard score string', () => {
    expect(resultLabel(game())).toBe('1-0');
    const bWins = game({
      white: { username: 'a', rating: 1, result: 'checkmated' },
      black: { username: 'b', rating: 1, result: 'win' },
    });
    expect(resultLabel(bWins)).toBe('0-1');
    const drawn = game({
      white: { username: 'a', rating: 1, result: 'agreed' },
      black: { username: 'b', rating: 1, result: 'agreed' },
    });
    expect(resultLabel(drawn)).toBe('½-½');
  });
});

describe('display helpers', () => {
  it('counts moves through chess.com clock comments and 1... continuations', () => {
    const pgn =
      '[Event "x"]\n\n1. e4 {[%clk 0:02:58]} 1... e5 {[%clk 0:02:57]} 2. Nf3 2... Nc6 3. Bb5 1-0';
    expect(moveCount(pgn)).toBe(3);
  });

  it('labels archives and dates', () => {
    expect(archiveLabel('https://api.chess.com/pub/player/x/games/2026/05')).toBe('May 2026');
    const may2 = Date.UTC(2026, 4, 2, 12) / 1000; // midday UTC — same date in any TZ
    expect(dateLabel(may2, new Date('2026-06-12'))).toBe('May 2');
    expect(dateLabel(may2, new Date('2027-01-01'))).toBe('May 2, 2026');
  });
});

describe('report store (memory fallback)', () => {
  it('round-trips reports keyed by uuid + tier', async () => {
    const report = { headers: {}, moves: [] } as unknown as AnnotatedReport;
    await putReport('u1', 'standard', report);
    expect(await getReport('u1', 'standard')).toEqual(report);
    expect(await getReport('u1', 'deep')).toBeNull();
    expect(await cachedKeys()).toContain('u1:standard');
  });
});

/* -------------------------------------------------- analysis queue --- */

interface FakeCall {
  pgn: string;
  resolve: (r: AnnotatedReport) => void;
  reject: (e: unknown) => void;
}

/** Analyzer the test resolves by hand; rejects AbortError when its signal fires. */
function fakeAnalyzer(): { calls: FakeCall[]; fn: AnalyzeFn } {
  const calls: FakeCall[] = [];
  const fn: AnalyzeFn = (pgn, _tier, _onProgress, signal) =>
    new Promise<AnnotatedReport>((resolve, reject) => {
      calls.push({ pgn, resolve, reject });
      signal?.addEventListener('abort', () =>
        reject(new DOMException('Analysis aborted', 'AbortError')),
      );
    });
  return { calls, fn };
}

const fakeReport = (id: string): AnnotatedReport =>
  ({ headers: { id }, moves: [] }) as unknown as AnnotatedReport;

const tick = (): Promise<void> => new Promise(r => setTimeout(r, 0));

const job = (id: string, cache = true) => ({
  id,
  pgn: `pgn-${id}`,
  tier: 'standard' as const,
  label: id,
  cacheUuid: cache ? id : undefined,
});

describe('AnalysisQueue', () => {
  it('processes jobs in order, saves cacheable reports, dedupes ids', async () => {
    const { calls, fn } = fakeAnalyzer();
    const saved: string[] = [];
    const q = new AnalysisQueue(fn, async uuid => void saved.push(uuid));
    q.enqueue([job('a'), job('b'), job('a')]); // second 'a' is a no-op
    await tick();
    expect(calls.map(c => c.pgn)).toEqual(['pgn-a']);
    expect(q.snapshot().active?.id).toBe('a');
    expect(q.snapshot().totalCount).toBe(2);

    calls[0].resolve(fakeReport('a'));
    await tick();
    expect(q.snapshot().states.get('a')).toBe('done');
    expect(q.snapshot().active?.id).toBe('b');

    calls[1].resolve(fakeReport('b'));
    await tick();
    expect(saved).toEqual(['a', 'b']);
    expect(q.snapshot().pendingCount).toBe(0);
    expect(q.snapshot().active).toBeNull();
  });

  it('runNow preempts the active job and re-queues it right behind', async () => {
    const { calls, fn } = fakeAnalyzer();
    const q = new AnalysisQueue(fn, async () => {});
    q.enqueue([job('bg')]);
    await tick();
    expect(q.snapshot().active?.id).toBe('bg');

    const fg = q.runNow(job('fg'));
    await tick(); // bg aborted (signal) → fg starts
    expect(q.snapshot().states.get('bg')).toBe('queued');
    expect(calls.map(c => c.pgn)).toEqual(['pgn-bg', 'pgn-fg']);

    calls[1].resolve(fakeReport('fg'));
    await expect(fg).resolves.toMatchObject({ headers: { id: 'fg' } });
    await tick(); // bg restarts after the foreground job
    expect(calls.map(c => c.pgn)).toEqual(['pgn-bg', 'pgn-fg', 'pgn-bg']);

    calls[2].resolve(fakeReport('bg'));
    await tick();
    expect(q.snapshot().states.get('bg')).toBe('done');
  });

  it('cancel rejects the waiter and clears the job', async () => {
    const { calls, fn } = fakeAnalyzer();
    const q = new AnalysisQueue(fn, async () => {});
    const p = q.runNow(job('solo'));
    await tick();
    q.enqueue([job('later')]);
    q.cancel('solo');
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    await tick();
    expect(q.snapshot().states.has('solo')).toBe(false);
    expect(q.snapshot().active?.id).toBe('later'); // queue moved on

    q.cancel('later'); // active background job: abort, no waiters
    await tick();
    expect(q.snapshot().states.has('later')).toBe(false);
    expect(q.snapshot().active).toBeNull();
    expect(calls).toHaveLength(2);
  });

  it('a failed game is marked and the queue keeps going', async () => {
    const { calls, fn } = fakeAnalyzer();
    const q = new AnalysisQueue(fn, async () => {});
    q.enqueue([job('bad'), job('ok')]);
    await tick();
    calls[0].reject(new Error('Illegal or unreadable move 3'));
    await tick();
    expect(q.snapshot().states.get('bad')).toBe('failed');
    expect(q.snapshot().failures.get('bad')).toMatch(/unreadable/);
    expect(q.snapshot().active?.id).toBe('ok');
    calls[1].resolve(fakeReport('ok'));
    await tick();
    expect(q.snapshot().states.get('ok')).toBe('done');
  });
});
