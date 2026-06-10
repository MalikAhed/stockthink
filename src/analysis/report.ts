/**
 * Game report assembly: parsed game + engine analyses → per-move records
 * (classification, accuracy, SAN engine lines) and per-player summaries
 * (lichess game accuracy, ACPL, estimated Elo, classification counts).
 */
import type { PositionAnalysis } from '../engine/engine';
import {
  type Classification,
  type ClassifyOptions,
  classifyMoves,
  type MoveJudgment,
  type OpeningInfo,
} from './classify';
import type { ParsedGame, Ply } from './pgn';
import { type EvalScore, gameAccuracy, winPercent } from './winprob';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { makeSan } from 'chessops/san';
import { parseUci } from 'chessops/util';

export interface EngineLineReport {
  /** White-POV eval of this line. */
  eval: EvalScore;
  sanPv: string[];
  uciPv: string[];
}

export interface MoveReport extends Ply, MoveJudgment {
  /** Engine best move in SAN (from the position before the move). */
  bestSan: string | null;
  /** Top engine lines (MultiPV) from the position before the move. */
  lines: EngineLineReport[];
}

export interface PlayerSummary {
  accuracy: number;
  /** Average centipawn loss (mate ≈ ±1000, per-move loss capped at 1000). */
  acpl: number;
  /** Chesskit formula: 3100·e^(−0.01·acpl). */
  estimatedElo: number;
  counts: Record<Classification, number>;
}

export interface GameReport {
  headers: Record<string, string>;
  moves: MoveReport[];
  players: { white: PlayerSummary; black: PlayerSummary };
  /** Deepest matched book opening, if any. */
  opening?: OpeningInfo;
}

const PV_PLIES = 10;

/** Eval → mover-independent white-POV cp, mate mapped to ±1000 for ACPL. */
const cpForAcpl = (ev: EvalScore): number =>
  ev.mate !== undefined ? (ev.mate > 0 ? 1000 : -1000) : Math.max(-1000, Math.min(1000, ev.cp ?? 0));

const emptyCounts = (): Record<Classification, number> => ({
  brilliant: 0,
  great: 0,
  best: 0,
  excellent: 0,
  good: 0,
  book: 0,
  forced: 0,
  inaccuracy: 0,
  mistake: 0,
  miss: 0,
  blunder: 0,
});

export function buildReport(
  game: ParsedGame,
  analyses: PositionAnalysis[],
  opts: ClassifyOptions = {},
): GameReport {
  const judgments = classifyMoves(game, analyses, opts);

  const moves: MoveReport[] = game.plies.map((ply, i) => {
    const pos = Chess.fromSetup(parseFen(ply.fenBefore).unwrap()).unwrap();
    const lines = analyses[i].lines.map(line => sanifyLine(pos, line.eval, line.pvUci));
    const j = judgments[i];
    const bestSan = j.bestUci ? sanOf(pos, j.bestUci) : null;
    return { ...ply, ...j, bestSan, lines };
  });

  return {
    headers: game.headers,
    moves,
    players: {
      white: summarize('white', game, judgments),
      black: summarize('black', game, judgments),
    },
    opening: [...judgments].reverse().find(j => j.opening)?.opening,
  };
}

function summarize(
  color: 'white' | 'black',
  game: ParsedGame,
  judgments: MoveJudgment[],
): PlayerSummary {
  const counts = emptyCounts();
  const accuracies: number[] = [];
  const winPercents: number[] = [];
  let cpLossSum = 0;
  let cpLossMoves = 0;

  for (let i = 0; i < judgments.length; i++) {
    if (game.plies[i].color !== color) continue;
    const j = judgments[i];
    counts[j.classification]++;
    accuracies.push(j.accuracy);
    // player-POV win% before this move (for volatility windows)
    const before = winPercent(j.evalBefore);
    winPercents.push(color === 'white' ? before : 100 - before);
    // ACPL from mover-POV cp drop, mate ≈ ±1000
    const cpBefore = cpForAcpl(j.evalBefore);
    const cpAfter = cpForAcpl(j.evalAfter);
    const drop = color === 'white' ? cpBefore - cpAfter : cpAfter - cpBefore;
    cpLossSum += Math.min(1000, Math.max(0, drop));
    cpLossMoves++;
  }

  // final position win% closes the last volatility window
  const last = judgments[judgments.length - 1];
  if (last) winPercents.push(color === 'white' ? last.winPercentAfter : 100 - last.winPercentAfter);

  const acpl = cpLossMoves ? cpLossSum / cpLossMoves : 0;
  return {
    accuracy: Math.round(gameAccuracy(accuracies, winPercents) * 10) / 10,
    acpl: Math.round(acpl),
    estimatedElo: Math.round(3100 * Math.exp(-0.01 * acpl)),
    counts,
  };
}

const sanOf = (pos: Chess, uci: string): string | null => {
  const move = parseUci(uci);
  return move ? makeSan(pos, move) : null;
};

function sanifyLine(pos: Chess, ev: EvalScore, pvUci: string[]): EngineLineReport {
  const probe = pos.clone();
  const sanPv: string[] = [];
  const uciPv = pvUci.slice(0, PV_PLIES);
  for (const uci of uciPv) {
    const move = parseUci(uci);
    if (!move || !probe.isLegal(move)) break;
    sanPv.push(makeSan(probe, move));
    probe.play(move);
  }
  return { eval: ev, sanPv, uciPv };
}
