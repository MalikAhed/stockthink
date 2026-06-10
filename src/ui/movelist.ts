/**
 * Move list: two-column numbered SAN with classification colors/badges.
 */
import type { AnnotatedMove } from '../analyze';
import { CLASS_COLORS, CLASS_GLYPHS } from './badges';

/** Classes that get a glyph next to the SAN in the list. */
const GLYPHED = new Set(['brilliant', 'great', 'inaccuracy', 'mistake', 'miss', 'blunder']);

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
  const glyph = GLYPHED.has(m.classification)
    ? `<span class="mv-glyph" style="color:${CLASS_COLORS[m.classification]}">${CLASS_GLYPHS[m.classification]}</span>`
    : '';
  const cls = m.ply === currentPly ? ' current' : '';
  const color =
    m.classification === 'best' || m.classification === 'book' || m.classification === 'forced'
      ? ''
      : ` style="color:${CLASS_COLORS[m.classification]}"`;
  return `<span class="mv${cls}" data-ply="${m.ply}"${color}>${m.san}${glyph}</span>`;
};
