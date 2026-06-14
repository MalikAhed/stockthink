/**
 * Report summary card: per-player accuracy, estimated rating and the
 * classification-count table (chess.com Game Review layout).
 */
import type { AnnotatedReport } from '@backend/analyze';
import { badgeHtml, CLASS_COLORS, CLASS_LABELS, CLASS_ORDER } from './badges';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderSummary(el: HTMLElement, report: AnnotatedReport): void {
  const w = report.players.white;
  const b = report.players.black;
  const white = esc(report.headers.White ?? 'White');
  const black = esc(report.headers.Black ?? 'Black');

  const rows = CLASS_ORDER.map(
    c => `
      <tr class="cnt-row${w.counts[c] + b.counts[c] === 0 ? ' zero' : ''}">
        <td class="cnt-w">${w.counts[c] || ''}</td>
        <td class="cnt-label" style="color:${CLASS_COLORS[c]}">
          ${badgeHtml(c)}
          ${CLASS_LABELS[c]}
        </td>
        <td class="cnt-b">${b.counts[c] || ''}</td>
      </tr>`,
  ).join('');

  el.innerHTML = `
    <div class="summary-card">
      <div class="acc-grid">
        <div class="acc-col">
          <div class="player-name">${white}</div>
          <div class="acc-box white-box">${w.accuracy.toFixed(1)}</div>
          <div class="est-elo">est. ${w.estimatedElo}</div>
        </div>
        <div class="acc-title">Accuracy</div>
        <div class="acc-col">
          <div class="player-name">${black}</div>
          <div class="acc-box black-box">${b.accuracy.toFixed(1)}</div>
          <div class="est-elo">est. ${b.estimatedElo}</div>
        </div>
      </div>
      ${report.opening ? `<div class="opening-name">${esc(report.opening)}</div>` : ''}
      <table class="counts">${rows}</table>
    </div>`;
}
