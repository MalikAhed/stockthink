/**
 * Coach panel: chess.com-style speech bubble — classification verdict row
 * (badge · "<san> is <classification>" · eval chip) + verified commentary.
 */
import type { AnnotatedMove, AnnotatedReport } from '../analyze';
import { formatEval } from '../analysis/commentary';
import { badgeHtml, CLASS_COLORS } from './badges';

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

export function renderCoach(
  el: HTMLElement,
  report: AnnotatedReport,
  move: AnnotatedMove | null,
): void {
  if (!move) {
    const opening = report.opening ? `${report.opening.name}. ` : '';
    el.innerHTML = `
      <div id="commentary-card">
        <div class="bubble">
          <div class="verdict-row">
            <span class="verdict-label">Game Review</span>
          </div>
          <div class="commentary-text">${esc(opening)}Use ← → (or click a move) to step through the game.</div>
        </div>
      </div>`;
    return;
  }
  const c = move.classification;
  el.innerHTML = `
    <div id="commentary-card">
      <div class="bubble">
        <div class="verdict-row">
          ${badgeHtml(c)}
          <span class="verdict-label"><span class="san">${esc(move.san)}</span> is <span class="verdict-class" style="color:${CLASS_COLORS[c]}">${headline(c)}</span></span>
          <span class="score-chip">${formatEval(move.evalAfter)}</span>
        </div>
        <div class="commentary-text">${esc(move.commentary.short)}</div>
        ${
          move.commentary.long && move.commentary.long !== move.commentary.short
            ? `<details class="coach-more"><summary>Explain more</summary>
               <div class="commentary-text">${esc(move.commentary.long)}</div></details>`
            : ''
        }
      </div>
    </div>`;
}
