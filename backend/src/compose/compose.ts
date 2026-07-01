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
  /**
   * Phase 3 — first-class honest-silence output: the composer found no groundable
   * concrete cause to voice, so `text` is the classification badge line, NOT an
   * invented reason. Lets the eval (and UI) tell true silence apart from a voiced
   * cause — on an `expectSilence` move a badge is the honest call, a filler
   * over-speaks. (R3 still holds: `text` is never empty.)
   */
  badge?: boolean;
}

// exported for self-improvement/eval/score.ts — the truth harness must judge with the same
// kind sets the composer speaks with (drift here would corrupt the eval)
export const BAD_KINDS: Fact['kind'][] = ['hangs_piece', 'abandons_square', 'ignores_threat', 'allows_mate', 'allows_fork', 'refutation', 'invites_capture'];
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

/** How deep into the played move's own continuation a created pin must matter. */
const PIN_PV_PLIES = 10;

/**
 * Phase 2 (PV-grounding) — a created pin is GROUNDED only if the engine's own
 * line FROM THE PLAYED MOVE actually acts on the pinned square. A pin the
 * engine never touches is decorative geometry, not the cause — even when the
 * detector found a plausible `exploit` move (that move can sit on the PV for
 * unrelated reasons, so the pinned square is the load-bearing test, not the
 * exploit). Voicing such a pin invents a reason — the fake-reason disease this
 * arc exists to kill.
 *
 * The line judged is the played move's OWN continuation (`[uci, ...replyPv]`),
 * never `lines[0]`: under hash carryover `lines[0]` can be a *different* move's
 * line whose unrelated play (e.g. the formerly-pinned knight escaping) fakes a
 * touch on the square. Conservative: with no post-move line to read, never demote.
 */
function pinGrounded(f: Extract<Fact, { kind: 'creates_pin' }>, m: MoveReport): boolean {
  if (!m.replyPv || m.replyPv.length === 0) return true; // no continuation to judge
  const touched = new Set<string>();
  for (const uci of [m.uci, ...m.replyPv].slice(0, PIN_PV_PLIES))
    if (uci.length >= 4) {
      touched.add(uci.slice(0, 2));
      touched.add(uci.slice(2, 4));
    }
  return touched.has(f.pinned.square);
}

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

  // Phase 2 grounding: a decorative pin the engine's own best line never acts on
  // is geometry, not the cause — suppress it from the prose entirely (lead AND
  // "explain more") so the move falls to its real purpose or a neutral line
  // instead of inventing a tactical reason.
  const speakable = (f: Fact): boolean => !(f.kind === 'creates_pin' && !pinGrounded(f, m));

  const badFacts = facts.filter(isBad);
  const missedFacts = facts.filter(isMissed);
  // "a fair trade" is redundant next to "wins a piece" — keep the stronger story
  const wonMaterial = facts.some(f => f.kind === 'wins_free_piece' || f.kind === 'captures_higher');
  const purposeFacts = facts.filter(f => isPurpose(f) && speakable(f) && !(wonMaterial && f.kind === 'trade'));

  const used: Fact[] = [];
  const parts: string[] = [];
  // Phase 3 — set when the move produces no groundable concrete cause and falls
  // to a bare classification line: honest silence, not an invented reason.
  let badge = false;

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
    // BACKLOG #1/#2: a named concrete winner must LEAD over a SOFT fault — an
    // incidental `abandons_square` walk-away, or a bare `regression` platitude with
    // no concrete bad fact behind it (the V1 disease: "gives up the center" burying
    // "Nxd4 wins a knight"). Promote the missed tactic, or the capture the engine
    // itself preferred; a hangs_piece / ignores_threat / allows_mate fault IS the
    // concrete story and still leads (R5). NB the promoted miss must be concrete —
    // never a positional/quiet `missed_idea` (that's just a second platitude).
    const bigMiss =
      missedFacts.find(
        f => f.kind === 'missed_fork' || f.kind === 'missed_free_piece' || f.kind === 'missed_mate',
      ) ??
      missedFacts.find(
        f => f.kind === 'missed_idea' && f.ideas.some(i => i.what === 'captures' || i.what === 'wins_material'),
      );
    const softLead = cause?.kind === 'abandons_square' || cause?.kind === 'regression';
    const leadMiss = softLead ? bigMiss : undefined;
    if (leadMiss) {
      parts.push(sentence(leadMiss)!);
      used.push(leadMiss);
    }
    // keep an `abandons_square` as the follow-up consequence, but a bare
    // `regression` reads as an ambiguous "It …" after a different-move lead — let
    // it fall to "explain more" instead of muddying the headline.
    if (cause && !used.includes(cause) && !(leadMiss && cause.kind === 'regression')) {
      parts.push(sentence(cause)!);
      used.push(cause);
    }
    // GM-5 (book §4.2, Lasker): a miss is not a bad move — it let a better
    // one go. Frame it that way before naming what was on the table.
    if (m.classification === 'miss' && !cause)
      parts.push('A decent move on its own — but the position offered more.');
    // then what was better, and WHY (the best move's own facts) — skipping the
    // missed fact already promoted to the lead above
    const better = missedFacts.find(f => !used.includes(f));
    if (better) {
      parts.push(sentence(better)!);
      used.push(better);
    } else if (!leadMiss && m.bestSan && !m.wasBest) {
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
      // GM-1: candidate framing beats a generic neutral line — but a move already
      // in the engine's TOP tier is not a "second candidate" ("only X promised
      // more" contradicts a best/great/brilliant verdict), so it falls to the
      // honest neutral line instead. (Under hash carryover a near-equal best move
      // can be the engine's line 2 — Phase 2: don't voice a contradiction.)
      const topTier =
        m.classification === 'best' || m.classification === 'great' || m.classification === 'brilliant';
      const sc = !m.wasBest && !topTier && facts.find(f => f.kind === 'second_candidate');
      if (sc) {
        parts.push(sentence(sc)!);
        used.push(sc);
      } else {
        // R3: every good-move badge carries text — great/brilliant have no pool
        // of their own, so fall back to the excellent-tier lines rather than the
        // empty string this path used to emit (Phase 3.4: close the empty-text path).
        const pool = NEUTRAL[m.classification] ?? NEUTRAL.excellent!;
        parts.push(pool[Math.floor(m.ply / 2) % pool.length]);
        badge = true; // honest silence — no groundable concrete cause to voice
      }
    }
  }

  // "explain more": remaining facts, one sentence each — but classification-aware.
  // On a bad move, purpose facts must read as the (failed) intent, never as praise.
  const remaining = facts.filter(f => !used.includes(f) && !CONTEXT_KINDS.includes(f.kind) && speakable(f));
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
    badge,
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
