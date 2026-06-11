/**
 * Live "try a move" analysis: the user moves a piece on the review board and
 * gets the SAME facts → classification → prose pipeline as the pre-analysis,
 * on demand. One lazy Stockfish worker, one search at a time, results cached
 * by FEN (the report seeds the cache, so most moves cost a single search).
 */
import { Chess, normalizeMove } from 'chessops/chess';
import { makeFen, parseFen } from 'chessops/fen';
import { makeSan } from 'chessops/san';
import { makeUci } from 'chessops/util';
import type { NormalMove } from 'chessops/types';
import type { Ply } from './analysis/pgn';
import { openingBook } from './analysis/openings';
import { buildMoveReport, type MoveReport } from './analysis/report';
import { Engine, WorkerTransport, type PositionAnalysis } from './engine/engine';

/** Fast-tier node budget: ~a second per search, deterministic on any device. */
const LIVE_NODES = 75_000;

const ENGINE_URL = `${import.meta.env.BASE_URL}engine/stockfish-18-lite-single.js`;

let enginePromise: Promise<Engine> | null = null;
let queue: Promise<unknown> = Promise.resolve();
const cache = new Map<string, PositionAnalysis>();

function getEngine(): Promise<Engine> {
  if (!enginePromise) {
    const engine = new Engine(new WorkerTransport(ENGINE_URL), { multiPv: 3, hashMb: 32 });
    enginePromise = engine.init().then(() => engine);
  }
  return enginePromise;
}

/** Seed the cache with an analysis already computed by the game review. */
export function seedLiveAnalysis(fen: string, analysis: PositionAnalysis): void {
  if (!cache.has(fen)) cache.set(fen, analysis);
}

/** Analyze one FEN (cached; searches are serialized on the single worker). */
function analyzeLive(fen: string): Promise<PositionAnalysis> {
  const hit = cache.get(fen);
  if (hit) return Promise.resolve(hit);
  const job = queue.then(async () => {
    const again = cache.get(fen);
    if (again) return again;
    const engine = await getEngine();
    const analysis = await engine.analyze(fen, { nodes: LIVE_NODES });
    cache.set(fen, analysis);
    return analysis;
  });
  queue = job.catch(() => undefined); // a failed search must not jam the queue
  return job;
}

/**
 * Analyze a user move from `fenBefore` and return a fully classified
 * MoveReport — identical shape to the pre-analysis, so the coach bubble,
 * badge and chips render it with zero special cases.
 */
export async function liveMoveReport(
  fenBefore: string,
  rawMove: NormalMove,
  plyIndex: number,
): Promise<MoveReport | null> {
  const pos = Chess.fromSetup(parseFen(fenBefore).unwrap()).unwrap();
  const move = normalizeMove(pos, rawMove) as NormalMove; // castling → king-takes-rook
  if (!pos.isLegal(move)) return null;
  const san = makeSan(pos, move);
  const color = pos.turn;
  const after = pos.clone();
  after.play(move);
  const fenAfter = makeFen(after.toSetup());
  const ply: Ply = {
    ply: plyIndex,
    moveNumber: Math.ceil(plyIndex / 2),
    color,
    san,
    uci: makeUci(move),
    fenBefore,
    fenAfter,
    epdAfter: makeFen(after.toSetup(), { epd: true }),
  };
  // before-position is usually seeded from the report → one live search
  const beforeAnalysis = await analyzeLive(fenBefore);
  const afterAnalysis = await analyzeLive(fenAfter);
  return buildMoveReport(ply, beforeAnalysis, afterAnalysis, openingBook());
}

/** Drop the worker and cache (when leaving the review for a new game). */
export function disposeLive(): void {
  void enginePromise?.then(e => e.dispose());
  enginePromise = null;
  queue = Promise.resolve();
  cache.clear();
}
