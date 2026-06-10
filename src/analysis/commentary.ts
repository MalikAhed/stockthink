/**
 * Commentary engine — Tier 1: deterministic template NLG.
 *
 * Every sentence is slot-filled exclusively from engine-verified data
 * (MoveReport) and board-verified facts (MoveFacts), so the text cannot
 * hallucinate pieces, squares or tactics (CCC paper, arxiv 2410.20811:
 * concept-grounded commentary matches human correctness; free generation
 * does not). Phrase variants are picked by a PRNG seeded on the ply so
 * output is stable for a given game.
 */
import { evalWords, renderBetterWas, renderMissedWin, renderPrimary } from '../explain/templates';
import type { Classification } from './classify';
import type { MoveFacts, PieceOn } from './concepts';
import type { MoveReport } from './report';
import type { EvalScore } from './winprob';

export interface Commentary {
  /** 1–2 sentences shown under the move. */
  short: string;
  /** Expanded "explain more" paragraph. */
  long: string;
}

/* ---------------------------------------------------------- helpers --- */

/** mulberry32 — tiny seeded PRNG for reproducible phrase choice. */
const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const pick = <T>(rand: () => number, xs: T[]): T => xs[Math.floor(rand() * xs.length)];

const ROLE_NAMES: Record<string, string> = {
  pawn: 'pawn',
  knight: 'knight',
  bishop: 'bishop',
  rook: 'rook',
  queen: 'queen',
  king: 'king',
};

const named = (p: PieceOn): string => `${ROLE_NAMES[p.role]} on ${p.square}`;

/** Format a white-POV eval like "+1.4", "-0.3" or "#4" / "#-3". */
export const formatEval = (ev: EvalScore): string => {
  if (ev.mate !== undefined) return `#${ev.mate}`;
  const pawns = (ev.cp ?? 0) / 100;
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(1)}`;
};

const moverName = (color: 'white' | 'black') => (color === 'white' ? 'White' : 'Black');
const oppName = (color: 'white' | 'black') => (color === 'white' ? 'Black' : 'White');

/* ----------------------------------------------------- fact clauses --- */

/** Most salient verified tactical clause for this move, if any. */
function tacticClause(m: MoveReport, f: MoveFacts): string | undefined {
  const mateAfter = m.evalAfter.mate;
  const moverSign = m.color === 'white' ? 1 : -1;
  if (mateAfter !== undefined && mateAfter * moverSign < 0)
    return `This allows a forced mate in ${Math.abs(mateAfter)}`;
  if (f.hangs.length > 0) return `It leaves the ${named(f.hangs[0])} hanging`;
  if (
    m.evalBefore.mate !== undefined &&
    m.evalBefore.mate * moverSign > 0 &&
    (mateAfter === undefined || mateAfter * moverSign <= 0) &&
    m.bestSan
  )
    return `There was a forced mate in ${Math.abs(m.evalBefore.mate)} starting with ${m.bestSan}`;
  if (f.missedFreePieces.length > 0 && !f.winsMaterial)
    return `The ${named(f.missedFreePieces[0])} could have been captured`;
  if (f.forkedPieces.length >= 2)
    return `The ${ROLE_NAMES[f.piece.role]} forks the ${f.forkedPieces.map(named).join(' and the ')}`;
  if (f.skewers) return `It skewers the ${named(f.skewers.front)} against the ${named(f.skewers.behind)}`;
  if (f.pins) return `It pins the ${named(f.pins.front)} to the ${named(f.pins.behind)}`;
  if (f.trapped) return `The ${oppName(m.color).toLowerCase()} ${named(f.trapped)} is trapped`;
  if (f.winsMaterial && f.captured) return `It wins the ${named(f.captured)}`;
  if (mateAfter !== undefined && mateAfter * moverSign > 0)
    return `${moverName(m.color)} now has a forced mate in ${Math.abs(mateAfter)}`;
  if (f.isDoubleCheck) return `Double check — the king must move`;
  if (f.isDiscoveredCheck) return `A discovered check`;
  return undefined;
}

/* ----------------------------------------------------- phrase banks --- */

const OPENERS: Record<Classification, string[]> = {
  book: ['A known book move', 'Still in theory', 'Standard opening theory'],
  forced: ['The only legal move', 'Forced — there was no alternative'],
  brilliant: ['A brilliant sacrifice!', 'Spectacular — a true sacrifice!', 'Stunning!'],
  great: ['A great move — the only one that works here', 'Precisely the critical move'],
  best: ["The engine's top choice", 'The strongest move', 'Best play'],
  excellent: ['An excellent move', 'Nearly perfect', 'Very accurate'],
  good: ['A solid move', 'A reasonable choice', 'Decent'],
  inaccuracy: ['An inaccuracy', 'Slightly imprecise', 'Not the most accurate'],
  mistake: ['A mistake', 'This goes wrong', 'An error'],
  miss: ['A missed chance', 'The punishment slips away', 'An opportunity missed'],
  blunder: ['A blunder', 'A serious mistake', 'This loses the thread badly'],
};

const BAD = new Set<Classification>(['inaccuracy', 'mistake', 'miss', 'blunder']);

/* ------------------------------------------------------------ main --- */

/**
 * Build short + long commentary for one analyzed move.
 * `facts` must come from moveFacts(move.fenBefore, move.uci).
 *
 * When the WHY engine produced an explanation (move.explain), the short text
 * is the spec §7/§8 output: ONE primary verified fact + (for bad moves) the
 * "better was" clause. The legacy fact-clause path remains as a fallback.
 */
export function commentFor(move: MoveReport, facts: MoveFacts): Commentary {
  const rand = rng(move.ply * 2654435761);
  const opener = pick(rand, OPENERS[move.classification]);
  const parts: string[] = [];
  const ex = move.explain;
  const isBad = BAD.has(move.classification);

  if (move.classification === 'book' && move.opening) {
    parts.push(`${opener} — the ${move.opening.name}.`);
  } else if (ex !== undefined && move.classification !== 'forced') {
    // ---- WHY path (max one primary fact + one better-was clause) ----
    if (isBad) {
      if (move.classification === 'miss' && move.bestSan)
        parts.push(renderMissedWin(move.bestSan, ex?.betterWas ?? null));
      else {
        if (ex?.primary) parts.push(renderPrimary(ex.primary));
        if (move.bestSan) parts.push(renderBetterWas(move.bestSan, ex?.betterWas ?? null));
        if (parts.length === 0) parts.push(`${opener}.`);
      }
    } else if (ex?.primary) {
      parts.push(renderPrimary(ex.primary));
    } else {
      const moverWin = move.color === 'white' ? move.winPercentAfter : 100 - move.winPercentAfter;
      parts.push(`${opener}, keeping the position ${evalWords(moverWin, false)}.`);
    }
  } else {
    // ---- legacy fact-clause path ----
    const tactic = tacticClause(move, facts);
    parts.push(`${opener}.`);
    if (tactic) parts.push(`${tactic}.`);
    if (isBad && move.bestSan && !tactic?.includes(move.bestSan))
      parts.push(`${move.bestSan} was best.`);
  }
  const short = parts.join(' ');

  // ---- explain more ----
  const long: string[] = [short];
  if (move.classification !== 'book') {
    if (isBad)
      long.push(
        `This move cost ${move.winDrop.toFixed(1)} win-percentage points` +
          ` (${moverName(move.color)}'s winning chances fell).`,
      );
    const bestLine = move.lines[0];
    if (move.bestSan && bestLine && bestLine.sanPv.length > 1 && !move.wasBest)
      long.push(`The engine preferred ${move.bestSan}, e.g. ${bestLine.sanPv.join(' ')}.`);
    else if (move.wasBest && bestLine && bestLine.sanPv.length > 1)
      long.push(`The main line continues ${bestLine.sanPv.slice(1).join(' ')}.`);
    const moverWin = move.color === 'white' ? move.winPercentAfter : 100 - move.winPercentAfter;
    long.push(
      move.evalAfter.mate !== undefined
        ? `After this, ${moverName(move.color)} ${moverWin >= 50 ? 'has a forced mate' : 'is getting mated'}.`
        : `After this, ${moverName(move.color)} is ${evalWords(moverWin, false)}.`,
    );
    if (facts.isCastling) long.push(`${moverName(move.color)} castles to safety.`);
    if (facts.isPromotion) long.push('The pawn promotes.');
  }

  return { short, long: long.join(' ') };
}
