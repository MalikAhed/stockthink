/**
 * Coach panel: classification headline + verified commentary for the
 * current move, with an "explain more" expansion.
 */
import type { AnnotatedMove, AnnotatedReport } from '../analyze';
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
      <div class="coach">
        <div class="coach-head"><span class="coach-title">Game Review</span></div>
        <p class="coach-text">${esc(opening)}Use ← → (or click a move) to step through the game.</p>
      </div>`;
    return;
  }
  const c = move.classification;
  el.innerHTML = `
    <div class="coach" style="border-left-color:${CLASS_COLORS[c]}">
      <div class="coach-head">
        ${badgeHtml(c)}
        <span class="coach-title" style="color:${CLASS_COLORS[c]}">
          ${move.san} is ${headline(c)}
        </span>
      </div>
      <p class="coach-text">${esc(move.commentary.short)}</p>
      ${
        move.commentary.long && move.commentary.long !== move.commentary.short
          ? `<details class="coach-more"><summary>Explain more</summary>
             <p class="coach-text">${esc(move.commentary.long)}</p></details>`
          : ''
      }
    </div>`;
}
