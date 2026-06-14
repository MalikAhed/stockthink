/**
 * Stage-3 classification (V2) — pure math over the engine pass + stage-2
 * facts. Formulas unchanged from the research digest:
 *
 * - chess.com expected-points ladder on mover-POV win% drop:
 *   Best 0 / Excellent ≤2 / Good ≤5 / Inaccuracy ≤10 / Mistake ≤20 / Blunder >20,
 *   softened one step in already-decided positions (chess.com leniency)
 * - Book: EPD match in the lichess CC0 opening book.
 * - Forced: single legal move (stage-2 fact).
 * - Brilliant: clean-room freechess rule — a SEE-verified sacrifice that is
 *   (near-)best and doesn't leave the mover lost.
 * - Great: the only good move in a critical position (top-2 gap ≥10 win%).
 * - Miss: a concrete winning resource (mate / free piece / fork) existed and
 *   the played move let it go.
 */
import type { Fact } from '../concepts/facts';
import type { MoveReport } from './report';
import { winPercent } from './winprob';

export type Classification =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'forced'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'miss';

const has = (facts: Fact[], kind: Fact['kind']): boolean => facts.some(f => f.kind === kind);

/** Mover-POV win% from a white-POV eval-derived percentage. */
const povPercent = (color: 'white' | 'black', whitePercent: number): number =>
  color === 'white' ? whitePercent : 100 - whitePercent;

export function classifyMove(
  m: MoveReport,
  isBook: boolean,
): Classification {
  const facts = m.facts;

  if (isBook) return 'book';
  if (has(facts, 'forced')) return 'forced';
  if (has(facts, 'delivers_mate')) return 'best';

  const drop = m.winDrop;
  const afterPov = povPercent(m.color, m.winPercentAfter);
  const beforePov = povPercent(m.color, winPercent(m.evalBefore));

  // Brilliant: real sacrifice, (near-)best, and the mover is still OK after.
  if (has(facts, 'sacrifice') && (m.wasBest || drop <= 2) && afterPov >= 40 && beforePov < 95)
    return 'brilliant';

  // Great: found the only good move in a critical position.
  if (has(facts, 'only_move') && drop <= 2) return 'great';

  // Miss: a concrete winning resource existed and was let go (shown instead
  // of inaccuracy/mistake when the player is still not lost).
  const missedConcrete =
    has(facts, 'missed_mate') || has(facts, 'missed_free_piece') || has(facts, 'missed_fork');
  if (missedConcrete && drop >= 10 && afterPov >= 45) return 'miss';

  let verdict: Classification;
  if (m.wasBest || drop <= 0) verdict = 'best';
  else if (drop <= 2) verdict = 'excellent';
  else if (drop <= 5) verdict = 'good';
  else if (drop <= 10) verdict = 'inaccuracy';
  else if (drop <= 20) verdict = 'mistake';
  else verdict = 'blunder';

  // chess.com-style leniency (Game Review behavior, mirrored from the
  // freechess clean-room reimplementation): when the game is already decided
  // — still completely winning after the move, or completely lost before it —
  // the drop barely changes the expected result, so the label softens one
  // step. Never softened into a forced mate against the mover.
  const matedSoon =
    m.evalAfter.mate !== undefined && (m.color === 'white' ? m.evalAfter.mate < 0 : m.evalAfter.mate > 0);
  if ((afterPov >= 80 || beforePov <= 20) && !matedSoon) {
    if (verdict === 'blunder') verdict = 'mistake';
    else if (verdict === 'mistake') verdict = 'inaccuracy';
    else if (verdict === 'inaccuracy') verdict = 'good';
  }
  return verdict;
}

/**
 * Per-classification accuracy score, CAPS2-style (chess.com): game accuracy
 * is the plain average of these across a player's moves — book/forced count
 * as perfect, errors cost by severity. Values from the freechess clean-room
 * reimplementation of chess.com's Game Review.
 */
export const classificationScore: Record<Classification, number> = {
  brilliant: 1,
  great: 1,
  best: 1,
  excellent: 0.9,
  good: 0.65,
  book: 1,
  forced: 1,
  inaccuracy: 0.4,
  mistake: 0.2,
  miss: 0.2,
  blunder: 0,
};
