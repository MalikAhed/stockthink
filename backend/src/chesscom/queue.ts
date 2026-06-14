/**
 * The app's single analysis lane. Every game review — pasted PGN, a clicked
 * chess.com game, or batch pre-analysis — runs through here one at a time
 * (a second engine pool would fight the first for the same cores).
 *
 * Background batches keep crunching while the user reads a finished review;
 * results land in the report cache (store.ts) so each game opens instantly
 * afterwards. A foreground request (runNow) preempts: the in-flight job is
 * aborted between positions and re-queued right behind it, waiters intact.
 */
import { analyzeGame, type AnnotatedReport, type Tier } from '../analyze';
import { putReport } from './store';

export interface QueueJob {
  /** Unique id (chess.com game uuid, or a synthetic id for pasted PGNs). */
  id: string;
  pgn: string;
  tier: Tier;
  /** "white vs black" for status surfaces. */
  label: string;
  /** When set, the finished report is cached under this chess.com uuid. */
  cacheUuid?: string;
}

export type JobState = 'queued' | 'analyzing' | 'done' | 'failed';

export interface QueueSnapshot {
  /** Live read-only views — do not mutate. */
  states: ReadonlyMap<string, JobState>;
  failures: ReadonlyMap<string, string>;
  active: { id: string; label: string; done: number; total: number } | null;
  pendingCount: number;
  /** Session batch counters (reset when the queue drains) — drive "2 of 5". */
  doneCount: number;
  totalCount: number;
}

type ProgressFn = (done: number, total: number) => void;
export type AnalyzeFn = (
  pgn: string,
  tier: Tier,
  onProgress: ProgressFn,
  signal?: AbortSignal,
) => Promise<AnnotatedReport>;
type SaveFn = (uuid: string, tier: Tier, report: AnnotatedReport) => Promise<void>;

interface Waiter {
  resolve: (r: AnnotatedReport) => void;
  reject: (e: unknown) => void;
  progress?: ProgressFn;
}

interface InternalJob extends QueueJob {
  waiters: Waiter[];
}

const isAbort = (e: unknown): boolean => e instanceof DOMException && e.name === 'AbortError';

export class AnalysisQueue {
  private pending: InternalJob[] = [];
  private states = new Map<string, JobState>();
  private failures = new Map<string, string>();
  private active: {
    job: InternalJob;
    ctrl: AbortController;
    done: number;
    total: number;
    requeued: boolean;
    cancelled: boolean;
  } | null = null;
  private processing = false;
  private doneCount = 0;
  private totalCount = 0;
  private listeners = new Set<(s: QueueSnapshot) => void>();

  constructor(
    private analyze: AnalyzeFn = analyzeGame,
    private save: SaveFn = putReport,
  ) {}

  /** Queue games for background analysis (already-done/queued ids are skipped). */
  enqueue(jobs: QueueJob[]): void {
    for (const job of jobs) {
      const state = this.states.get(job.id);
      if (state === 'queued' || state === 'analyzing' || state === 'done') continue;
      this.failures.delete(job.id); // a re-enqueue retries a failed game
      this.pending.push({ ...job, waiters: [] });
      this.states.set(job.id, 'queued');
      this.totalCount++;
    }
    this.emit();
    void this.pump();
  }

  /**
   * Analyze this game next and resolve with its report. An in-flight
   * background job is aborted and re-queued right behind this one.
   */
  runNow(job: QueueJob, onProgress?: ProgressFn): Promise<AnnotatedReport> {
    return new Promise<AnnotatedReport>((resolve, reject) => {
      const waiter: Waiter = { resolve, reject, progress: onProgress };
      if (this.active?.job.id === job.id) {
        this.active.job.waiters.push(waiter);
        return;
      }
      const queued = this.pending.findIndex(j => j.id === job.id);
      const internal: InternalJob =
        queued >= 0 ? this.pending.splice(queued, 1)[0] : { ...job, waiters: [] };
      if (queued < 0) this.totalCount++;
      internal.waiters.push(waiter);
      this.pending.unshift(internal);
      this.states.set(internal.id, 'queued');
      this.failures.delete(internal.id);
      if (this.active) {
        // park the preempted job right behind the foreground one
        this.pending.splice(1, 0, this.active.job);
        this.states.set(this.active.job.id, 'queued');
        this.active.requeued = true;
        this.active.ctrl.abort();
      }
      this.emit();
      void this.pump();
    });
  }

  /** Abort an active job or drop a queued one; its waiters reject (AbortError). */
  cancel(id: string): void {
    if (this.active?.job.id === id && !this.active.requeued) {
      this.active.cancelled = true;
      this.active.ctrl.abort();
      return;
    }
    const i = this.pending.findIndex(j => j.id === id);
    if (i < 0) return;
    const [job] = this.pending.splice(i, 1);
    this.states.delete(id);
    this.totalCount = Math.max(0, this.totalCount - 1);
    const err = new DOMException('Analysis cancelled', 'AbortError');
    for (const w of job.waiters) w.reject(err);
    this.emit();
  }

  subscribe(cb: (s: QueueSnapshot) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  snapshot(): QueueSnapshot {
    return {
      states: this.states,
      failures: this.failures,
      active: this.active
        ? {
            id: this.active.job.id,
            label: this.active.job.label,
            done: this.active.done,
            total: this.active.total,
          }
        : null,
      pendingCount: this.pending.length,
      doneCount: this.doneCount,
      totalCount: this.totalCount,
    };
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const cb of this.listeners) cb(snap);
  }

  private async pump(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    while (this.pending.length) {
      const job = this.pending.shift()!;
      const ctrl = new AbortController();
      const active = { job, ctrl, done: 0, total: 0, requeued: false, cancelled: false };
      this.active = active;
      this.states.set(job.id, 'analyzing');
      this.emit();
      try {
        const report = await this.analyze(
          job.pgn,
          job.tier,
          (done, total) => {
            active.done = done;
            active.total = total;
            for (const w of job.waiters) w.progress?.(done, total);
            this.emit();
          },
          ctrl.signal,
        );
        if (job.cacheUuid) await this.save(job.cacheUuid, job.tier, report);
        this.states.set(job.id, 'done');
        this.doneCount++;
        for (const w of job.waiters) w.resolve(report);
        job.waiters = [];
      } catch (e) {
        if (isAbort(e) && active.requeued) {
          // preempted — already re-queued with waiters attached; nothing to settle
        } else if (isAbort(e) && active.cancelled) {
          this.states.delete(job.id);
          this.totalCount = Math.max(0, this.totalCount - 1);
          for (const w of job.waiters) w.reject(e);
          job.waiters = [];
        } else {
          this.states.set(job.id, 'failed');
          this.failures.set(job.id, e instanceof Error ? e.message : String(e));
          for (const w of job.waiters) w.reject(e);
          job.waiters = [];
        }
      }
      this.active = null;
      this.emit();
    }
    // drained: next batch starts its "x of y" from zero
    this.doneCount = 0;
    this.totalCount = 0;
    this.processing = false;
    this.emit();
  }
}

/** The app-wide queue (UI + main). Tests build their own instances. */
export const analysisQueue = new AnalysisQueue();
