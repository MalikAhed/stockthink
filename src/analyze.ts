/**
 * Browser-side orchestration: PGN text → engine pool → annotated report.
 */
import { commentFor, type Commentary } from './analysis/commentary';
import { moveFacts, type MoveFacts } from './analysis/concepts';
import { openingBook } from './analysis/openings';
import { parseGame } from './analysis/pgn';
import { buildReport, type GameReport, type MoveReport } from './analysis/report';
import { WorkerTransport } from './engine/engine';
import { EnginePool } from './engine/pool';

export type Tier = 'fast' | 'standard' | 'deep';

/**
 * Fixed NODE budgets per position (not movetime): node-capping is the
 * literature's reproducibility lever — it eliminates eval variance from
 * hardware speed and load (MoM, arXiv:2602.04447, evaluation protocol),
 * so the same PGN always yields the same review on any device. Budgets
 * roughly match the previous 200/450/1000ms on a typical desktop.
 */
const TIER_NODES: Record<Tier, number> = {
  fast: 75_000,
  standard: 200_000,
  deep: 500_000,
};

export interface AnnotatedMove extends MoveReport {
  facts: MoveFacts | null;
  commentary: Commentary;
}

export interface AnnotatedReport extends Omit<GameReport, 'moves'> {
  moves: AnnotatedMove[];
  initialFen: string;
}

const ENGINE_URL = `${import.meta.env.BASE_URL}engine/stockfish-18-lite-single.js`;

export async function analyzeGame(
  pgnText: string,
  tier: Tier,
  onProgress: (done: number, total: number) => void,
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
    const analyses = await pool.analyzeAll(game.fens, { nodes: TIER_NODES[tier] }, p =>
      onProgress(p.done, p.total),
    );
    const report = buildReport(game, analyses, { openings: openingBook() });
    const moves: AnnotatedMove[] = report.moves.map(m => {
      let facts: MoveFacts | null = null;
      try {
        facts = moveFacts(m.fenBefore, m.uci);
      } catch {
        facts = null; // never block the report on a facts bug
      }
      const commentary = facts
        ? commentFor(m, facts)
        : { short: '', long: '' };
      return { ...m, facts, commentary };
    });
    return { ...report, moves, initialFen: game.initialFen };
  } finally {
    pool.dispose();
  }
}
