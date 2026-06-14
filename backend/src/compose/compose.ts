/**
 * Stage-4 explanation composer, Mode A (V2 spec).
 *
 * Builds 1–3 sentence comments from the move's typed facts only. Structure is
 * enforced here, not hoped for:
 *  - bad moves: cause → consequence → what was better and WHY (R5)
 *  - good moves: purpose
 *  - zero facts: one short neutral sentence, never eval-speak (R3)
 * Engine lines never enter prose — they ship as clickable chips (R2).
 */
import type { MoveReport } from '../analysis/report';
import type { Fact } from '../concepts/facts';
import { renderFact } from './templates';

export interface VariationChip {
  label: string;
  /** What this line shows — drives the walkthrough intro & button styling. */
  kind: 'best' | 'refutation';
  /** White-POV eval of the line (focus-mode eval bar). */
  eval?: import('../analysis/winprob').EvalScore;
  sanPv: string[];
  uciPv: string[];
  /** Position the line starts from. */
  fen: string;
}

export interface Comment {
  text: string;
  /**
   * Expansion tail — remaining facts, one sentence each. Formerly shown as an
   * "Explain more" toggle; that UI was removed per user request (a better
   * feature is planned). Still composed + tested so re-adding it is trivial.
   */
  more: string | null;
  chips: VariationChip[];
}

// exported for self-improvement/eval/score.ts — the truth harness must judge with the same
// kind sets the composer speaks with (drift here would corrupt the eval)
export const BAD_KINDS: Fact['kind'][] = ['hangs_piece', 'abandons_square', 'ignores_threat', 'allows_mate', 'allows_fork', 'refutation'];
export const MISSED_KINDS: Fact['kind'][] = [
  'missed_mate',
  'missed_free_piece',
  'missed_fork',
  'missed_pin',
  'missed_trap',
  'missed_mate_threat',
  'missed_idea',
];
export const CONTEXT_KINDS: Fact['kind'][] = ['only_move', 'forced', 'second_candidate', 'hard_to_find', 'quiet_strength'];

const isBad = (f: Fact): boolean => BAD_KINDS.includes(f.kind) || f.kind === 'regression';
const isMissed = (f: Fact): boolean => MISSED_KINDS.includes(f.kind);
const isPurpose = (f: Fact): boolean =>
  !isBad(f) && !isMissed(f) && !CONTEXT_KINDS.includes(f.kind);

/** Neutral one-liners for fact-less moves (R3 — short, never eval-speak).
 *  ≥6 rotating variants per tier, picked deterministically by ply so the same
 *  game always reads the same (C6). */
const NEUTRAL: Partial<Record<MoveReport['classification'], string[]>> = {
  best: [
    'The most precise continuation.',
    'Exactly the right move.',
    'The strongest move in the position.',
    'Spot on — this keeps everything under control.',
    'The best move here, no doubt about it.',
    'Right on target.',
  ],
  excellent: [
    'A solid choice.',
    'One of the best moves in this position.',
    'Very strong play.',
    'An excellent decision.',
    'Hard to improve on this.',
    'A fine move.',
  ],
  good: [
    'A reasonable continuation.',
    'A sensible move.',
    'A perfectly playable choice.',
    'Nothing wrong with this.',
    'A sound, practical decision.',
    'This keeps the game on course.',
  ],
};

/** The concrete engine-verified reply a bad move failed against (GM-4 gate). */
const concreteReply = (facts: Fact[]): string | null => {
  for (const f of facts) {
    if (f.kind === 'hangs_piece') return f.capture.san;
    if (f.kind === 'refutation') return f.moves[0]?.san ?? null;
    if (f.kind === 'allows_mate' && f.firstMove) return f.firstMove.san;
  }
  return null;
};

/** "Develops the knight toward the center." → "develops the knight toward the center"
 *  (keeps the capital when the sentence starts with a SAN token or square). */
const asClause = (s: string): string => {
  // inner em-dashes would collide with the "The idea — … —" frame
  const t = s.replace(/\.\s*$/, '').replace(/\s+—\s+/g, ', ');
  // decap a leading English word ("Develops…", "A fair trade…") but never a
  // SAN token or square name (those contain digits)
  return /^(?:[A-Z][a-z]+|A)\b/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
};

export function composeComment(m: MoveReport): Comment {
  const facts = m.facts;
  const chips = buildChips(m);

  if (m.classification === 'book')
    return { text: m.openingName ? `Book: ${m.openingName}.` : 'A known book move.', more: null, chips: [] };

  const sentence = (f: Fact | undefined): string | null => (f ? renderFact(f) : null);

  const badFacts = facts.filter(isBad);
  const missedFacts = facts.filter(isMissed);
  // "a fair trade" is redundant next to "wins a piece" — keep the stronger story
  const wonMaterial = facts.some(f => f.kind === 'wins_free_piece' || f.kind === 'captures_higher');
  const purposeFacts = facts.filter(f => isPurpose(f) && !(wonMaterial && f.kind === 'trade'));

  const used: Fact[] = [];
  const parts: string[] = [];

  const isBadMove =
    m.classification === 'inaccuracy' ||
    m.classification === 'mistake' ||
    m.classification === 'blunder' ||
    m.classification === 'miss';

  if (m.classification === 'forced') {
    parts.push('The only legal move.');
  } else if (isBadMove) {
    // R5: cause → consequence first
    const cause = badFacts.find(f => f.kind !== 'regression') ?? badFacts[0];
    if (cause) {
      parts.push(sentence(cause)!);
      used.push(cause);
    }
    // GM-5 (book §4.2, Lasker): a miss is not a bad move — it let a better
    // one go. Frame it that way before naming what was on the table.
    if (m.classification === 'miss' && !cause)
      parts.push('A decent move on its own — but the position offered more.');
    // then what was better, and WHY (the best move's own facts)
    const better = missedFacts[0];
    if (better) {
      parts.push(sentence(better)!);
      used.push(better);
    } else if (m.bestSan && !m.wasBest) {
      parts.push(`${m.bestSan} was the better way.`);
    }
    // a bad move with no concrete facts at all: name the better move, say no more (R3)
    if (parts.length === 0 && m.bestSan) parts.push(`${m.bestSan} was stronger here.`);
    // GM-1: the move sat on the engine's own shortlist — soften the verdict
    if (facts.some(f => f.kind === 'second_candidate'))
      parts.push('A natural candidate, but it falls just short.');
    // GM-2: the miss was a quiet tactical move — the hardest kind to spot
    const htf = facts.find(f => f.kind === 'hard_to_find');
    if (htf) {
      parts.push(sentence(htf)!);
      used.push(htf);
    }
  } else {
    // good move: purpose (top 2 facts max)
    const lead = facts.find(f => f.kind === 'only_move');
    if (lead && (m.classification === 'great' || m.classification === 'brilliant')) {
      parts.push(sentence(lead)!);
      used.push(lead);
    }
    // a generic positional purpose never rides along once a concrete purpose
    // carries the comment — it waits in "explain more" (trap-rook-file-kick)
    const concrete = purposeFacts.filter(f => f.kind !== 'positional');
    for (const f of concrete.length ? concrete : purposeFacts) {
      if (parts.length >= 2) break;
      parts.push(sentence(f)!);
      used.push(f);
    }
    // GM-2 praise side: quiet-strength garnish only when the text would
    // otherwise be a single line — praise never stacks past the cap
    const qs = facts.find(f => f.kind === 'quiet_strength');
    if (qs && parts.length === 1) {
      parts.push(sentence(qs)!);
      used.push(qs);
    }
    if (parts.length === 0) {
      // GM-1: candidate framing beats a generic neutral line
      const sc = !m.wasBest && facts.find(f => f.kind === 'second_candidate');
      if (sc) {
        parts.push(sentence(sc)!);
        used.push(sc);
      } else {
        const pool = NEUTRAL[m.classification];
        if (pool) parts.push(pool[Math.floor(m.ply / 2) % pool.length]);
      }
    }
  }

  // "explain more": remaining facts, one sentence each — but classification-aware.
  // On a bad move, purpose facts must read as the (failed) intent, never as praise.
  const remaining = facts.filter(f => !used.includes(f) && !CONTEXT_KINDS.includes(f.kind));
  let rest: string[];
  if (isBadMove) {
    rest = remaining
      .filter(f => !isPurpose(f))
      .map(renderFact)
      .filter((s): s is string => s !== null && !parts.includes(s));
    const intent = remaining
      .filter(isPurpose)
      .map(renderFact)
      .filter((s): s is string => s !== null)
      .map(asClause);
    if (intent.length)
      rest.push(`The idea — ${intent.join('; ')} — doesn't make up for what this concedes.`);
    // GM-4 (book §4.2, falsify before committing): on a real mistake whose
    // move HAD an idea, coach the habit by naming the concrete test it failed.
    const serious = m.classification === 'mistake' || m.classification === 'blunder';
    const reply = serious && facts.some(isPurpose) ? concreteReply(facts) : null;
    if (reply)
      rest.push(
        `The test this move had to pass was ${reply} — strong players spend most of their time looking for exactly this kind of answer before committing.`,
      );
  } else {
    rest = remaining
      .map(f =>
        // a mate allowed by a GOOD move means the game was already beyond
        // saving — frame it so the best try doesn't read like a blunder (P3)
        f.kind === 'allows_mate'
          ? `The game could not be saved either way — ${asClause(renderFact(f)!)}.`
          : renderFact(f),
      )
      .filter((s): s is string => s !== null && !parts.includes(s));
  }

  return {
    text: parts.join(' '),
    more: rest.length ? rest.join(' ') : null,
    chips,
  };
}

function buildChips(m: MoveReport): VariationChip[] {
  const chips: VariationChip[] = [];
  if (!m.wasBest && m.bestSan && m.lines[0]?.sanPv.length)
    chips.push({
      label: `Best: ${m.bestSan}`,
      kind: 'best',
      eval: m.lines[0].eval,
      sanPv: m.lines[0].sanPv,
      uciPv: m.lines[0].uciPv,
      fen: m.fenBefore,
    });
  const refutation = m.facts.find(f => f.kind === 'refutation');
  if (refutation && refutation.kind === 'refutation')
    chips.push({
      label: `Why it fails: ${refutation.moves[0].san}`,
      kind: 'refutation',
      eval: m.evalAfter,
      sanPv: refutation.moves.map(x => x.san),
      uciPv: refutation.moves.map(x => x.uci),
      fen: m.fenAfter,
    });
  return chips;
}
