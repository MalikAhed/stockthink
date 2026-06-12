/**
 * Coach panel: chess.com-style speech bubble — verdict row (badge ·
 * "<san> is <classification>" · eval chip) + composed commentary +
 * clickable variation chips (engine lines live HERE, never in prose — R2).
 */
import type { AnnotatedMove, AnnotatedReport } from '../analyze';
import { composeComment, type VariationChip } from '../compose/compose';
import type { EvalScore } from '../analysis/winprob';
import { badgeHtml, CLASS_COLORS } from './badges';

/** "+1.3" / "−0.5" / "M5" — numbers belong to chips/bars, not prose. */
export function formatEval(ev: EvalScore): string {
  if (ev.mate !== undefined) return `M${Math.abs(ev.mate)}`;
  const pawns = (ev.cp ?? 0) / 100;
  return `${pawns > 0 ? '+' : pawns < 0 ? '−' : ''}${Math.abs(pawns).toFixed(1)}`;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const headline = (c: AnnotatedMove['classification']): string => {
  switch (c) {
    case 'best': return 'the best move';
    case 'book': return 'a book move';
    case 'forced': return 'forced';
    case 'brilliant': return 'brilliant!';
    case 'great': return 'a great move';
    case 'excellent': return 'excellent';
    case 'good': return 'good';
    case 'inaccuracy': return 'an inaccuracy';
    case 'mistake': return 'a mistake';
    case 'miss': return 'a miss';
    case 'blunder': return 'a blunder';
  }
};

/** "Thinking…" bubble while the live engine checks the user's own move. */
export function renderCoachThinking(el: HTMLElement, san: string): void {
  el.innerHTML = `
    <div id="commentary-card">
      <div class="bubble">
        <div class="verdict-row">
          <span class="verdict-label">You played <span class="san">${esc(san)}</span></span>
        </div>
        <div class="commentary-text live-thinking">Checking your move…</div>
      </div>
    </div>`;
}

export function renderCoach(
  el: HTMLElement,
  report: AnnotatedReport,
  move: AnnotatedMove | null,
  onChip: (chip: VariationChip) => void,
  aiComment: string | null = null,
  live = false,
): void {
  if (!move) {
    const opening = report.opening ? `${esc(report.opening)}. ` : '';
    el.innerHTML = `
      <div id="commentary-card">
        <div class="bubble">
          <div class="verdict-row"><span class="verdict-label">Game Review</span></div>
          <div class="commentary-text">${opening}Use ← → (or click a move) to step through the game — or move a piece to try your own idea.</div>
        </div>
      </div>`;
    return;
  }
  const c = move.classification;
  const comment = composeComment(move);
  const isBadMove = c === 'inaccuracy' || c === 'mistake' || c === 'blunder' || c === 'miss';
  // Friendly Spotlight CTAs — no raw engine lines on buttons; the walkthrough
  // explains the moves one step at a time instead.
  const ctaLabel = (chip: (typeof comment.chips)[number]): string =>
    chip.kind === 'refutation'
      ? '🔍 See why it fails'
      : isBadMove
        ? '✨ Show me the best move'
        : '✨ What did the engine prefer?';
  const chipsHtml = comment.chips
    .map(
      (chip, i) => `
      <button class="var-chip cta-${chip.kind}" data-chip="${i}">
        ${ctaLabel(chip)}
      </button>`,
    )
    .join('');
  el.innerHTML = `
    <div id="commentary-card">
      <div class="bubble">
        ${live ? '<div class="live-row"><span class="live-tag">Your move</span><button id="live-back" title="Return to the game">↩ Back to review</button></div>' : ''}
        <div class="verdict-row">
          ${badgeHtml(c)}
          <span class="verdict-label"><span class="san">${esc(move.san)}</span> is <span class="verdict-class" style="color:${CLASS_COLORS[c]}">${headline(c)}</span></span>
          <span class="score-chip">${formatEval(move.evalAfter)}</span>
        </div>
        <div class="commentary-text">${esc(aiComment ?? comment.text)}</div>
        ${chipsHtml ? `<div class="chips-row">${chipsHtml}</div>` : ''}
        ${
          aiComment
            ? `<details class="coach-more"><summary>Quick take</summary>
               <div class="commentary-text">${esc(comment.text)}</div></details>`
            : comment.more
              ? `<details class="coach-more"><summary>Explain more</summary>
               <div class="commentary-text">${esc(comment.more)}</div></details>`
              : ''
        }
      </div>
    </div>`;
  el.querySelectorAll<HTMLButtonElement>('.var-chip').forEach(btn => {
    btn.addEventListener('click', () => onChip(comment.chips[Number(btn.dataset.chip)]));
  });
}
