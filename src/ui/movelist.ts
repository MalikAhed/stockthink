/**
 * Move list: two-column numbered SAN. (Classification badges/colors removed
 * pending the analysis-system redesign.)
 */
import type { AnnotatedMove } from '../analyze';

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
  return `<span class="mv${cls}" data-ply="${m.ply}">${m.san}</span>`;
};
