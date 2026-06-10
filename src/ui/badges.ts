/**
 * Classification visual vocabulary — chess.com-matched palette (sampled by
 * freechess/wintrchess) + glyphs + the SVG badge drawn on the board square.
 */
import type { Classification } from '../analysis/classify';

export const CLASS_COLORS: Record<Classification, string> = {
  brilliant: '#26c2a3',
  great: '#5c8bb0',
  best: '#95b776',
  excellent: '#95b776',
  good: '#95af7a',
  book: '#a88865',
  forced: '#7c9c7b',
  inaccuracy: '#f7c045',
  mistake: '#e58f2a',
  miss: '#ff7769',
  blunder: '#ca3431',
};

export const CLASS_GLYPHS: Record<Classification, string> = {
  brilliant: '!!',
  great: '!',
  best: '★',
  excellent: '✓',
  good: '✓',
  book: 'B',
  forced: 'F',
  inaccuracy: '?!',
  mistake: '?',
  miss: '✗',
  blunder: '??',
};

export const CLASS_LABELS: Record<Classification, string> = {
  brilliant: 'Brilliant',
  great: 'Great move',
  best: 'Best move',
  excellent: 'Excellent',
  good: 'Good',
  book: 'Book',
  forced: 'Forced',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  miss: 'Miss',
  blunder: 'Blunder',
};

/** Order classifications appear in the summary table. */
export const CLASS_ORDER: Classification[] = [
  'brilliant',
  'great',
  'best',
  'excellent',
  'good',
  'book',
  'forced',
  'inaccuracy',
  'mistake',
  'miss',
  'blunder',
];

/**
 * SVG fragment for a classification badge at the top-right of a square
 * (chessground customSvg space: 100×100 viewBox per square).
 */
export const badgeSvg = (cls: Classification): string => {
  const glyph = CLASS_GLYPHS[cls];
  const fontSize = glyph.length > 1 ? 15 : 17;
  return (
    `<g class="st-badge">` +
    `<circle cx="86" cy="14" r="15" fill="${CLASS_COLORS[cls]}" stroke="#fff" stroke-width="2.2"/>` +
    `<text x="86" y="14" font-size="${fontSize}" font-weight="bold" fill="#fff"` +
    ` text-anchor="middle" dominant-baseline="central"` +
    ` font-family="Arial, sans-serif">${glyph}</text>` +
    `</g>`
  );
};

/** Small inline HTML badge (move list, coach header). */
export const badgeHtml = (cls: Classification): string =>
  `<span class="badge" style="background:${CLASS_COLORS[cls]}">${CLASS_GLYPHS[cls]}</span>`;
