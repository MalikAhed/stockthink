/**
 * Commentary engine — Tier 1: deterministic template NLG.
 *
 * Every sentence is slot-filled exclusively from engine-verified data
 * (MoveReport) and the WHY engine's verified facts (move.explain), so the
 * text cannot hallucinate pieces, squares or tactics. The research is
 * unanimous on this split (MATE arXiv:2411.06655: +30–45pts when facts are
 * supplied vs derived; ChessQA arXiv:2510.23948: language-about-chess is
 * LLMs' strongest skill, evaluation their weakest): analysis must stay
 * deterministic; language layers may only reword. Phrase variants are
 * picked by a PRNG seeded on the ply so output is stable for a given game.
 */
import { evalWords, renderBetterWas, renderMissedWin, renderPrimary } from '../explain/templates';
import type { Classification } from './classify';
import type { MoveFacts } from './concepts';
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

/** Format a white-POV eval like "+1.4", "-0.3" or "#4" / "#-3". */
export const formatEval = (ev: EvalScore): string => {
  if (ev.mate !== undefined) return `#${ev.mate}`;
  const pawns = (ev.cp ?? 0) / 100;
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(1)}`;
};

const moverName = (color: 'white' | 'black') => (color === 'white' ? 'White' : 'Black');

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
 * The short text is the spec §7/§8 output: ONE primary verified fact +
 * (for bad moves) the "better was" clause, all rendered from the WHY
 * engine's verified facts. There is deliberately no free-form fallback:
 * when no fact is verified, the text says less rather than guessing.
 */
export function commentFor(move: MoveReport, facts: MoveFacts): Commentary {
  const rand = rng(move.ply * 2654435761);
  const opener = pick(rand, OPENERS[move.classification]);
  const parts: string[] = [];
  const ex = move.explain;
  const isBad = BAD.has(move.classification);

  if (move.classification === 'book') {
    parts.push(move.opening ? `${opener} — the ${move.opening.name}.` : `${opener}.`);
  } else if (move.classification === 'forced') {
    parts.push(`${opener}.`);
  } else if (isBad) {
    // ---- WHY path (max one primary fact + one better-was clause) ----
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
  const short = parts.join(' ');

  // ---- explain more ----
  const long: string[] = [short];
  if (move.classification !== 'book') {
    if (move.volatile)
      long.push('This is a sharp position — small errors are punished quickly.');
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
