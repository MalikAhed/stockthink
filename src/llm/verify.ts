/**
 * Post-generation fact-check for LLM-reworded commentary.
 *
 * The literature's mandatory last step (Geometric Stability, arXiv:2512.15033
 * recommends external verification of every LLM chess claim; LLM Chess,
 * arXiv:2512.01992 measured 37.9% hallucinated moves even with legal moves
 * in-context): any square, move or mate count mentioned in generated text
 * must already exist in the verified fact sheet for that move, otherwise the
 * text is rejected and the deterministic template is kept.
 */
import type { MoveFactSheet } from './factsheet';

const SQUARE_RE = /\b[a-h][1-8]\b/g;
const MATE_RE = /mate in (\d+)/gi;

/** Every board square the verified facts for this move are allowed to name. */
export function allowedSquares(m: MoveFactSheet): Set<string> {
  const pool = [
    m.san,
    m.bestSan ?? '',
    m.pvSan.join(' '),
    // every square inside the typed facts (victims, targets, lines, SANs…)
    JSON.stringify(m.primaryFact ?? {}),
    JSON.stringify(m.betterWasFact ?? {}),
    m.templateLong,
  ].join(' ');
  return new Set(pool.match(SQUARE_RE) ?? []);
}

/** Mate distances the facts actually assert. */
export function allowedMateCounts(m: MoveFactSheet): Set<number> {
  const out = new Set<number>();
  for (const f of [m.primaryFact, m.betterWasFact])
    if (f && 'n' in f && typeof f.n === 'number') out.add(f.n);
  const evalMate = m.evalAfter.match(/^#-?(\d+)$/);
  if (evalMate) out.add(parseInt(evalMate[1]));
  return out;
}

/**
 * True when `text` only references squares and mate counts present in the
 * verified facts. Conservative by design: a rejection costs one templated
 * sentence; an accepted hallucination costs the user's trust.
 */
export function verifyCommentText(text: string, m: MoveFactSheet): boolean {
  const squares = allowedSquares(m);
  for (const sq of text.match(SQUARE_RE) ?? []) if (!squares.has(sq)) return false;
  const mates = allowedMateCounts(m);
  for (const match of text.matchAll(MATE_RE))
    if (!mates.has(parseInt(match[1]))) return false;
  return true;
}
