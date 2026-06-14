/**
 * Engine pool: N single-threaded Stockfish instances, each analyzing one
 * position at a time. This is the freechess parallelization pattern — no
 * SharedArrayBuffer / COOP / COEP needed, so it works on plain GitHub Pages.
 */
import {
  Engine,
  type EngineOptions,
  type PositionAnalysis,
  type SearchLimits,
  type UciTransport,
} from './engine';

export interface PoolProgress {
  done: number;
  total: number;
  /** Index of the position that just finished. */
  index: number;
  analysis: PositionAnalysis;
}

export class EnginePool {
  private engines: Engine[] = [];

  private constructor() {}

  static async create(
    makeTransport: () => UciTransport,
    size: number,
    opts: EngineOptions = {},
  ): Promise<EnginePool> {
    const pool = new EnginePool();
    pool.engines = Array.from({ length: size }, () => new Engine(makeTransport(), opts));
    await Promise.all(pool.engines.map(e => e.init()));
    return pool;
  }

  /** Suggested pool size for this device (browser context). */
  static suggestedSize(): number {
    const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 4) : 4;
    return Math.max(1, Math.min(4, cores - 1));
  }

  /**
   * Analyze every FEN; resolves with results in input order.
   * Positions are handed to the next free engine (work stealing).
   * An aborted signal stops handing out new positions; in-flight searches
   * finish first (seconds), then the call rejects with an AbortError.
   */
  async analyzeAll(
    fens: string[],
    limits: SearchLimits,
    onProgress?: (p: PoolProgress) => void,
    signal?: AbortSignal,
  ): Promise<PositionAnalysis[]> {
    const results: PositionAnalysis[] = new Array(fens.length);
    let next = 0;
    let done = 0;

    const runOn = async (engine: Engine): Promise<void> => {
      while (next < fens.length && !signal?.aborted) {
        const index = next++;
        const analysis = await engine.analyze(fens[index], limits);
        results[index] = analysis;
        done++;
        onProgress?.({ done, total: fens.length, index, analysis });
      }
    };

    await Promise.all(this.engines.map(runOn));
    if (signal?.aborted) throw new DOMException('Analysis aborted', 'AbortError');
    return results;
  }

  dispose(): void {
    for (const e of this.engines) e.dispose();
    this.engines = [];
  }
}
