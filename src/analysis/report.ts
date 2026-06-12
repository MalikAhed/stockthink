/**
 * Slim game report: parsed game + engine analyses → per-move evals, win%,
 * accuracy, ACPL. Classification & commentary were removed pending the
 * analysis-system redesign (see docs/ — research-first rebuild).
 */
import type { PositionAnalysis } from '../engine/engine';
import type { ParsedGame, Ply } from './pgn';
import {
  type EvalScore,
  gameAccuracy,
  moveAccuracy,
  winPercent,
  winPercentDrop,
} from './winprob';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { makeSan } from 'chessops/san';
import { parseUci } from 'chessops/util';
import type { NormalMove } from 'chessops/types';
import { annotateMove } from '../concepts/annotate';
import type { Fact } from '../concepts/facts';
import { classifyMove, type Classification } from './classify';
import { openingBook } from './openings';

export interface EngineLineReport {
  /** White-POV eval of this line. */
  eval: EvalScore;
  sanPv: string[];
  uciPv: string[];
}

export interface MoveReport extends Ply {
  /** White-POV eval before/after the move. */
  evalBefore: EvalScore;
  evalAfter: EvalScore;
  winPercentAfter: number;
  /** Mover-POV win% lost by this move (0 if it gained). */
  winDrop: number;
  accuracy: number;
  /** Engine best move from the position before the move. */
  bestUci: string | null;
  bestSan: string | null;
  wasBest: boolean;
  /** Top engine lines (MultiPV) from the position before the move. */
  lines: EngineLineReport[];
  /** Stage-2 typed facts (concept annotator), priority-sorted. */
  facts: Fact[];
  classification: Classification;
  /** Opening name when this move is still in book. */
  openingName: string | null;
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
  /** Deepest book match in the game. */
  opening: string | null;
}

const PV_PLIES = 10;

/** Eval → mover-independent white-POV cp, mate mapped to ±1000 for ACPL. */
const cpForAcpl = (ev: EvalScore): number =>
  ev.mate !== undefined ? (ev.mate > 0 ? 1000 : -1000) : Math.max(-1000, Math.min(1000, ev.cp ?? 0));

/**
 * One ply + its before/after engine analyses → a fully classified MoveReport.
 * Shared by the PGN review (buildReport) and the live "try a move" path —
 * one pipeline, one set of rules.
 */
export function buildMoveReport(
  ply: Ply,
  before: PositionAnalysis,
  after: PositionAnalysis | undefined,
  book: Map<string, { name: string }>,
  /** Deep-book override (lichess masters explorer) — EPD map is the fallback. */
  inMasterBook = false,
): MoveReport {
  const pos = Chess.fromSetup(parseFen(ply.fenBefore).unwrap()).unwrap();
  const lines = before.lines.map(line => sanifyLine(pos, line.eval, line.pvUci));
  // engine layer already normalizes evals to white POV
  const evalBefore = before.lines[0].eval;
  // terminal positions (mate/stalemate) have no lines — carry the eval over
  const evalAfter = after?.lines.length ? after.lines[0].eval : evalBefore;
  const bestUci = before.lines[0]?.pvUci[0] ?? null;
  const winDrop = winPercentDrop(ply.color, evalBefore, evalAfter);
  const played = parseUci(ply.uci) as NormalMove | undefined;
  const facts =
    played && pos.isLegal(played)
      ? annotateMove(pos, played, {
          evalBefore,
          evalAfter,
          winDrop,
          bestUci,
          lines: before.lines.map(l => ({ eval: l.eval, pvUci: l.pvUci })),
          replyPv: after?.lines[0]?.pvUci,
        })
      : [];
  const m: MoveReport = {
    ...ply,
    evalBefore,
    evalAfter,
    winPercentAfter: winPercent(evalAfter),
    winDrop,
    accuracy: moveAccuracy(winDrop),
    bestUci,
    bestSan: bestUci ? sanOf(pos, bestUci) : null,
    wasBest: bestUci === ply.uci,
    lines,
    facts,
    classification: 'good' as Classification,
    openingName: book.get(ply.epdAfter)?.name ?? null,
  };
  m.classification = classifyMove(m, m.openingName !== null || inMasterBook);
  return m;
}

export function buildReport(
  game: ParsedGame,
  analyses: PositionAnalysis[],
  /** Ply indices confirmed as book by the masters explorer (optional). */
  masterBook: Set<number> = new Set(),
): GameReport {
  const book = openingBook();
  const moves: MoveReport[] = game.plies.map((ply, i) =>
    buildMoveReport(ply, analyses[i], analyses[i + 1], book, masterBook.has(i)),
  );

  return {
    headers: game.headers,
    moves,
    players: {
      white: summarize('white', moves),
      black: summarize('black', moves),
    },
    opening: [...moves].reverse().find(m => m.openingName)?.openingName ?? null,
  };
}

function summarize(color: 'white' | 'black', moves: MoveReport[]): PlayerSummary {
  const accuracies: number[] = [];
  const winPercents: number[] = [];
  let cpLossSum = 0;
  let cpLossMoves = 0;
  const counts = Object.fromEntries(
    (
      [
        'brilliant', 'great', 'best', 'excellent', 'good', 'book',
        'forced', 'inaccuracy', 'mistake', 'miss', 'blunder',
      ] as Classification[]
    ).map(c => [c, 0]),
  ) as Record<Classification, number>;

  for (const m of moves) {
    if (m.color !== color) continue;
    counts[m.classification]++;
    accuracies.push(m.accuracy);
    // player-POV win% before this move (for volatility windows)
    const before = winPercent(m.evalBefore);
    winPercents.push(color === 'white' ? before : 100 - before);
    // ACPL from mover-POV cp drop, mate ≈ ±1000
    const drop =
      color === 'white'
        ? cpForAcpl(m.evalBefore) - cpForAcpl(m.evalAfter)
        : cpForAcpl(m.evalAfter) - cpForAcpl(m.evalBefore);
    cpLossSum += Math.min(1000, Math.max(0, drop));
    cpLossMoves++;
  }

  // final position win% closes the last volatility window
  const last = moves[moves.length - 1];
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
