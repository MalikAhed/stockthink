/**
 * Browser-side orchestration: PGN text → engine pool → eval report.
 * (Classification & commentary removed pending the analysis-system redesign.)
 */
import { masterBookPlies } from './analysis/explorer';
import { parseGame } from './analysis/pgn';
import { buildReport, type GameReport, type MoveReport } from './analysis/report';
import { WorkerTransport } from './engine/engine';
import { EnginePool } from './engine/pool';

export type Tier = 'fast' | 'standard' | 'deep';

/**
 * Fixed NODE budgets per position (not movetime): node-capping is the
 * literature's reproducibility lever — it eliminates eval variance from
 * hardware speed and load (MoM, arXiv:2602.04447, evaluation protocol),
 * so the same PGN always yields the same review on any device.
 */
const TIER_NODES: Record<Tier, number> = {
  fast: 75_000,
  standard: 200_000,
  deep: 500_000,
};

export type AnnotatedMove = MoveReport;

export interface AnnotatedReport extends GameReport {
  initialFen: string;
}

const ENGINE_URL = `${import.meta.env.BASE_URL}engine/stockfish-18-lite-single.js`;

export async function analyzeGame(
  pgnText: string,
  tier: Tier,
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<AnnotatedReport> {
  const game = parseGame(pgnText);
  // MultiPV 3 (literature: ≥3 to measure move "criticality" — the PV1–PV2
  // win% gap distinguishes only-move positions from anything-works ones).
  const pool = await EnginePool.create(
    () => new WorkerTransport(ENGINE_URL),
    EnginePool.suggestedSize(),
    { multiPv: 3, hashMb: 64 },
  );
  try {
    onProgress(0, game.fens.length);
    // deep book check (lichess masters) runs alongside the engine — it
    // resolves long before the analysis does and never throws
    const bookPromise = masterBookPlies(game.plies);
    const analyses = await pool.analyzeAll(
      game.fens,
      { nodes: TIER_NODES[tier] },
      p => onProgress(p.done, p.total),
      signal,
    );
    const report = buildReport(game, analyses, await bookPromise);
    return { ...report, initialFen: game.initialFen };
  } finally {
    pool.dispose();
  }
}
