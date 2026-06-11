/**
 * Stage-3 classification (V2) — pure math over the engine pass + stage-2
 * facts. Formulas unchanged from the research digest:
 *
 * - chess.com expected-points ladder on mover-POV win% drop:
 *   Best 0 / Excellent ≤2 / Good ≤5 / Inaccuracy ≤10 / Mistake ≤20 / Blunder >20
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

  if (m.wasBest || drop <= 0) return 'best';
  if (drop <= 2) return 'excellent';
  if (drop <= 5) return 'good';
  if (drop <= 10) return 'inaccuracy';
  if (drop <= 20) return 'mistake';
  return 'blunder';
}
