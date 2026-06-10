/**
 * Eval graph: SVG area chart of White's win% per ply (lichess plots win
 * chance, not centipawns — "Plot winchance because logarithmic").
 */
import type { AnnotatedMove } from '../analyze';
import { winPercent } from '../analysis/winprob';
import { CLASS_COLORS } from './badges';

const W = 600;
const H = 110;

const MARKED = new Set(['brilliant', 'great', 'mistake', 'miss', 'blunder']);

export function renderGraph(
  el: HTMLElement,
  moves: AnnotatedMove[],
  currentPly: number,
  onSeek: (ply: number) => void,
): void {
  // win% sequence: start position + after every ply (white POV)
  const wins = [moves.length ? winPercent(moves[0].evalBefore) : 50];
  for (const m of moves) wins.push(m.winPercentAfter);

  const x = (i: number) => (i / (wins.length - 1)) * W;
  const y = (w: number) => H - (w / 100) * H;
  const pts = wins.map((w, i) => `${x(i).toFixed(1)},${y(w).toFixed(1)}`);

  const dots = moves
    .map((m, i) =>
      MARKED.has(m.classification)
        ? `<circle cx="${x(i + 1).toFixed(1)}" cy="${y(wins[i + 1]).toFixed(1)}" r="4"` +
          ` fill="${CLASS_COLORS[m.classification]}" stroke="#262421" stroke-width="1.5"/>`
        : '',
    )
    .join('');

  const cursor =
    currentPly > 0
      ? `<line x1="${x(currentPly).toFixed(1)}" y1="0" x2="${x(currentPly).toFixed(1)}"` +
        ` y2="${H}" stroke="#f4bf44" stroke-width="1.5"/>`
      : '';

  el.innerHTML =
    `<svg viewBox="0 0 ${W} ${H}" class="eval-graph" role="img" aria-label="evaluation graph">` +
    `<rect width="${W}" height="${H}" fill="#1f1d1b"/>` +
    `<path d="M0,${H} L${pts.join(' L')} L${W},${H} Z" fill="#e8e6e3" opacity="0.9"/>` +
    `<line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" stroke="#777" stroke-width="0.6" stroke-dasharray="3 3"/>` +
    cursor +
    dots +
    `</svg>`;

  const svg = el.querySelector('svg')!;
  svg.addEventListener('click', e => {
    const rect = svg.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(moves.length, Math.round(frac * (wins.length - 1)))));
  });
}
