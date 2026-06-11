/**
 * Move list: two-column numbered SAN with classification badges on every
 * notable move (chess.com style — quiet classes stay clean).
 */
import type { AnnotatedMove } from '../analyze';
import type { Classification } from '../analysis/classify';
import { badgeUrl, CLASS_COLORS } from './badges';

/** Classes whose badge appears in the move list. */
const BADGED: Classification[] = [
  'brilliant',
  'great',
  'inaccuracy',
  'mistake',
  'miss',
  'blunder',
];

export function renderMoveList(
  el: HTMLElement,
  moves: AnnotatedMove[],
  currentPly: number,
  onSeek: (ply: number) => void,
): void {
  let html = '<div class="movelist">';
  for (let i = 0; i < moves.length; i += 2) {
    const wm = moves[i];
    const bm = moves[i + 1];
    html += `<div class="moverow"><span class="mvnum">${wm.moveNumber}.</span>`;
    html += moveCell(wm, currentPly);
    html += bm ? moveCell(bm, currentPly) : '<span class="mv empty"></span>';
    html += '</div>';
  }
  html += '</div>';
  el.innerHTML = html;

  el.querySelectorAll<HTMLElement>('.mv[data-ply]').forEach(span =>
    span.addEventListener('click', () => onSeek(parseInt(span.dataset.ply!))),
  );
  el.querySelector('.mv.current')?.scrollIntoView({ block: 'nearest' });
}

const moveCell = (m: AnnotatedMove, currentPly: number): string => {
  const cls = m.ply === currentPly ? ' current' : '';
  const c = m.classification;
  const badge = BADGED.includes(c)
    ? `<img class="mv-badge" src="${badgeUrl(c)}" alt="${c}" draggable="false">`
    : '';
  const color = BADGED.includes(c) ? ` style="color:${CLASS_COLORS[c]}"` : '';
  return `<span class="mv${cls}" data-ply="${m.ply}"${color}>${m.san}${badge}</span>`;
};
