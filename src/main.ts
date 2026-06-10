/**
 * StockThink app shell: input → progress → review screens.
 */
import 'chessground/assets/chessground.base.css';
import './style.css'; // includes chess.com green board + Neo piece theme

import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import { analyzeGame, type AnnotatedMove, type AnnotatedReport, type Tier } from './analyze';
import { formatEval } from './analysis/commentary';
import { winPercent } from './analysis/winprob';
import { renderAiPanel } from './ui/aipanel';
import { badgeSvg } from './ui/badges';
import { renderCoach } from './ui/coach';
import { renderGraph } from './ui/graph';
import { renderMoveList } from './ui/movelist';
import { renderSummary } from './ui/summary';

const $ = <T extends HTMLElement = HTMLElement>(sel: string): T =>
  document.querySelector(sel) as T;

/* ------------------------------------------------------------ state --- */
let report: AnnotatedReport | null = null;
let ply = 0; // 0 = initial position, n = after move n
let board: Api | null = null;
let orientation: 'white' | 'black' = 'white';

const BAD = new Set(['inaccuracy', 'mistake', 'miss', 'blunder']);

/* ---------------------------------------------------------- screens --- */
const screens = {
  input: () => $('#screen-input'),
  progress: () => $('#screen-progress'),
  review: () => $('#screen-review'),
};

function show(name: keyof typeof screens): void {
  for (const [key, get] of Object.entries(screens))
    get().classList.toggle('hidden', key !== name);
}

/* ----------------------------------------------------------- analyze --- */
async function startAnalysis(): Promise<void> {
  const pgn = ($('#pgn-input') as HTMLTextAreaElement).value.trim();
  const tier = ($('#tier') as unknown as HTMLSelectElement).value as Tier;
  const errEl = $('#input-error');
  errEl.classList.add('hidden');
  if (!pgn) {
    errEl.textContent = 'Paste a PGN first.';
    errEl.classList.remove('hidden');
    return;
  }
  show('progress');
  $('#progress-text').textContent = 'Starting engines…';
  $('#progress-fill').style.width = '0%';
  try {
    report = await analyzeGame(pgn, tier, (done, total) => {
      $('#progress-fill').style.width = `${Math.round((done / total) * 100)}%`;
      $('#progress-text').textContent = `Evaluating position ${done} / ${total}`;
    });
    initReview();
  } catch (e) {
    show('input');
    errEl.textContent = e instanceof Error ? e.message : String(e);
    errEl.classList.remove('hidden');
  }
}

/* ------------------------------------------------------------ review --- */
function initReview(): void {
  const r = report!;
  show('review');
  ply = 0;
  orientation = 'white';
  board = Chessground($('#board'), {
    fen: r.initialFen,
    coordinates: true,
    movable: { free: false, color: undefined },
    draggable: { enabled: false },
    selectable: { enabled: false },
    drawable: { enabled: false, visible: true },
  });
  renderSummary($('#summary'), r);
  renderAiPanel($('#ai-tools'), {
    getReport: () => report,
    onCommentaryUpdated: () => render(),
  });
  render();
}

/** Squares to highlight for a move (castling shown as the king's hop). */
function displaySquares(m: AnnotatedMove): [Key, Key] {
  if (m.san.startsWith('O-O')) {
    const rank = m.color === 'white' ? '1' : '8';
    return [`e${rank}` as Key, (m.san.startsWith('O-O-O') ? `c${rank}` : `g${rank}`) as Key];
  }
  return [m.uci.slice(0, 2) as Key, m.uci.slice(2, 4) as Key];
}

function render(): void {
  const r = report!;
  if (!r.moves.length || !board) return;
  const m = ply > 0 ? r.moves[ply - 1] : null;

  // board + badge + best-move arrow
  const shapes: DrawShape[] = [];
  let lastMove: Key[] | undefined;
  if (m) {
    const [from, to] = displaySquares(m);
    lastMove = [from, to];
    shapes.push({ orig: to, customSvg: { html: badgeSvg(m.classification), center: 'orig' } });
    if (BAD.has(m.classification) && m.bestUci && !m.wasBest)
      shapes.push({
        orig: m.bestUci.slice(0, 2) as Key,
        dest: m.bestUci.slice(2, 4) as Key,
        brush: 'green',
      });
  }
  board.set({ fen: m ? m.fenAfter : r.initialFen, lastMove, orientation });
  board.setAutoShapes(shapes);

  // eval bar
  const ev = m ? m.evalAfter : r.moves[0].evalBefore;
  const win = m ? m.winPercentAfter : winPercent(ev);
  ($('#eval-bar .white-fill') as HTMLElement).style.height = `${win}%`;
  $('#eval-bar .eval-label').textContent = formatEval(ev);

  // panels
  renderGraph($('#graph'), r.moves, ply, seek);
  renderMoveList($('#moves'), r.moves, ply, seek);
  renderCoach($('#coach'), r, m);
  renderPlayerBars();
}

function renderPlayerBars(): void {
  const r = report!;
  const h = r.headers;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const strip = (name: string, elo: string | undefined): string =>
    `<div class="player-avatar">${esc(name.charAt(0).toUpperCase() || '?')}</div>
     <div class="player-info">
       <span class="player-name">${esc(name)}</span>
       <span class="elo">${elo ? `(${esc(elo)})` : ''}</span>
     </div>`;
  const white = strip(h.White ?? 'White', h.WhiteElo);
  const black = strip(h.Black ?? 'Black', h.BlackElo);
  const top = $('#player-top');
  const bottom = $('#player-bottom');
  top.innerHTML = orientation === 'white' ? black : white;
  bottom.innerHTML = orientation === 'white' ? white : black;
  // green side-bar marks the player to move (chess.com active strip)
  const toMove: 'white' | 'black' = ply < r.moves.length ? r.moves[ply].color : 'white';
  top.classList.toggle('active', toMove !== orientation);
  bottom.classList.toggle('active', toMove === orientation);
}

function seek(p: number): void {
  if (!report) return;
  ply = Math.max(0, Math.min(report.moves.length, p));
  render();
}

/* ------------------------------------------------------------ wiring --- */
$('#analyze-btn').addEventListener('click', () => void startAnalysis());
$('#btn-start').addEventListener('click', () => seek(0));
$('#btn-prev').addEventListener('click', () => seek(ply - 1));
$('#btn-next').addEventListener('click', () => seek(ply + 1));
$('#btn-end').addEventListener('click', () => seek(report?.moves.length ?? 0));
$('#btn-flip').addEventListener('click', () => {
  orientation = orientation === 'white' ? 'black' : 'white';
  render();
});
$('#btn-new').addEventListener('click', () => {
  report = null;
  show('input');
});

document.addEventListener('keydown', e => {
  if (!report || screens.review().classList.contains('hidden')) return;
  if (e.target instanceof HTMLTextAreaElement) return;
  switch (e.key) {
    case 'ArrowLeft':
      seek(ply - 1);
      break;
    case 'ArrowRight':
      seek(ply + 1);
      break;
    case 'Home':
      seek(0);
      break;
    case 'End':
      seek(report.moves.length);
      break;
    case 'f':
      orientation = orientation === 'white' ? 'black' : 'white';
      render();
      break;
  }
});
