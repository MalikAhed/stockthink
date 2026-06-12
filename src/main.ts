/**
 * StockThink app shell: input → progress → review screens.
 */
import 'chessground/assets/chessground.base.css';
import './style.css'; // includes chess.com green board + Neo piece theme

import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import { Chess, normalizeMove } from 'chessops/chess';
import { chessgroundDests } from 'chessops/compat';
import { parseFen } from 'chessops/fen';
import { makeSan } from 'chessops/san';
import type { NormalMove } from 'chessops/types';
import { parseSquare } from 'chessops/util';
import type { AnnotatedMove, AnnotatedReport, Tier } from './analyze';
import { winPercent } from './analysis/winprob';
import type { CcGame } from './chesscom/api';
import { analysisQueue, type QueueJob } from './chesscom/queue';
import { getReport } from './chesscom/store';
import type { VariationChip } from './compose/compose';
import { disposeLive, liveMoveReport, seedLiveAnalysis } from './live';
import { initChesscomTab, refreshCached } from './ui/chesscom';
import { startLoader, stopLoader } from './ui/loader';
import { badgeSvg } from './ui/badges';
import { formatEval, renderCoach, renderCoachThinking } from './ui/coach';
import { renderDeepReview } from './ui/deepreview';
import { buildWalkthrough, renderSpotlightCard, renderTryCard, type WalkthroughStep } from './ui/walkthrough';
import { attachPreviews } from './ui/santag';
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
/** Best-move Spotlight (focus mode): user-paced engine-line walkthrough. */
let spotlight: {
  steps: WalkthroughStep[];
  i: number;
  title: string;
  kind: 'best' | 'refutation';
  chip: VariationChip;
  /** User's own moves played from the current step (live-rated). */
  tryLine: AnnotatedMove[];
  thinking: boolean;
} | null = null;
/** Hover preview of a move tag — remembers how to restore the view. */
let previewTimer: ReturnType<typeof setTimeout> | null = null;
let previewing = false;
let aiComments: Map<number, string> = new Map();
/** Live "try a move" line played by the user from the current ply. */
let exploreLine: AnnotatedMove[] = [];
let exploreThinking = false;
let liveToken = 0; // stale-search guard: bumped whenever the user navigates

/* ---------------------------------------------------------- screens --- */
const screens = {
  home: () => $('#screen-home'),
  input: () => $('#screen-input'),
  progress: () => $('#screen-progress'),
  review: () => $('#screen-review'),
};

function show(name: keyof typeof screens): void {
  // leaving the review dissolves an open Spotlight (no focus-mode bleed)
  if (name !== 'review' && spotlight) {
    spotlight = null;
    document.body.classList.remove('focus-mode');
  }
  for (const [key, get] of Object.entries(screens))
    get().classList.toggle('hidden', key !== name);
  // one knight tours wherever it's needed: progress screen or home hero
  if (name === 'progress') startLoader($('#loader-board'), $('#progress-quip'));
  else if (name === 'home') startLoader($('#home-board'));
  else stopLoader();
  // topbar nav state ("Game Review" stays lit while its analysis runs)
  const navFor = name === 'progress' ? 'input' : name;
  for (const nav of ['home', 'input', 'review'])
    $(`#nav-${nav}`).classList.toggle('active', nav === navFor);
  if (name === 'home') renderHome();
}

/** Home: hero + entry cards + a resume card when a review is open. */
function renderHome(): void {
  const el = $('#home-continue');
  if (!report) {
    el.innerHTML = '';
    return;
  }
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  // "?" is the PGN placeholder for an unknown player — don't show it
  const name = (h: string | undefined): string | null => (h && h !== '?' ? h : null);
  const w = name(report.headers.White);
  const b = name(report.headers.Black);
  const who = w || b ? ` — <b>${esc(w ?? 'White')}</b> vs <b>${esc(b ?? 'Black')}</b>` : '';
  el.innerHTML = `
    <button class="home-continue" id="home-resume">
      <span class="home-continue-dot"></span>
      <span class="home-continue-text">Continue your review${who}</span>
      <span class="home-go">Resume →</span>
    </button>`;
  $('#home-resume').addEventListener('click', () => show('review'));
}

/* ----------------------------------------------------------- analyze --- */
const currentTier = (): Tier => ($('#tier') as unknown as HTMLSelectElement).value as Tier;

const isAbortError = (e: unknown): boolean =>
  e instanceof DOMException && e.name === 'AbortError';

function openReport(r: AnnotatedReport): void {
  report = r;
  $('#nav-review').classList.remove('hidden');
  initReview();
}

let pasteSeq = 0;
/** Id of the analysis the progress screen is showing (Cancel targets it). */
let foregroundJobId: string | null = null;
/** Bumped per foreground run — a superseded run must not drive the UI. */
let fgSeq = 0;

/**
 * Progress screen + queue-front analysis (preempts any background job).
 * Resolves null when a newer foreground analysis took over meanwhile
 * (the user navigated away and started something else).
 */
async function runForeground(job: QueueJob, sub: string | null): Promise<AnnotatedReport | null> {
  const seq = ++fgSeq;
  show('progress');
  const subEl = $('#progress-sub');
  subEl.textContent = sub ?? '';
  subEl.classList.toggle('hidden', !sub);
  $('#progress-text').textContent = 'Starting engines…';
  $('#progress-fill').style.width = '0%';
  $('#progress-pct').textContent = '0%';
  foregroundJobId = job.id;
  try {
    const r = await analysisQueue.runNow(job, (done, total) => {
      const pct = `${Math.round((done / total) * 100)}%`;
      $('#progress-fill').style.width = pct;
      $('#progress-pct').textContent = pct;
      $('#progress-text').textContent = `Evaluating position ${done} / ${total}`;
    });
    return seq === fgSeq ? r : null;
  } catch (e) {
    if (seq !== fgSeq) return null; // superseded — outcome no longer drives the UI
    throw e;
  } finally {
    if (seq === fgSeq) foregroundJobId = null;
  }
}

async function startAnalysis(): Promise<void> {
  const pgn = ($('#pgn-input') as HTMLTextAreaElement).value.trim();
  const errEl = $('#input-error');
  errEl.classList.add('hidden');
  if (!pgn) {
    errEl.textContent = 'Paste a PGN first.';
    errEl.classList.remove('hidden');
    return;
  }
  try {
    const job = { id: `paste-${++pasteSeq}`, pgn, tier: currentTier(), label: 'Pasted game' };
    const r = await runForeground(job, null);
    if (r) openReport(r);
  } catch (e) {
    show('input');
    setTab('pgn');
    if (isAbortError(e)) return;
    errEl.textContent = e instanceof Error ? e.message : String(e);
    errEl.classList.remove('hidden');
  }
}

/** A game picked from the chess.com list: cached → instant, else analyze now. */
async function reviewCcGame(game: CcGame): Promise<void> {
  const tier = currentTier();
  const cached = await getReport(game.uuid, tier);
  if (cached) return openReport(cached);
  const label = `${game.white.username} vs ${game.black.username}`;
  const tc = game.timeClass ? ` · ${game.timeClass.charAt(0).toUpperCase()}${game.timeClass.slice(1)}` : '';
  try {
    const r = await runForeground(
      { id: game.uuid, pgn: game.pgn, tier, label, cacheUuid: game.uuid },
      `${label}${tc}`,
    );
    if (r) openReport(r);
  } catch (e) {
    // cancelled or failed — back to the list (a failed row wears its chip)
    show('input');
    setTab('cc');
    if (!isAbortError(e)) void refreshCached();
  }
}

/* ------------------------------------------------------------ review --- */
function initReview(): void {
  const r = report!;
  show('review');
  ply = 0;
  orientation = 'white';
  aiComments = new Map();
  exploreLine = [];
  exploreThinking = false;
  renderDeepReview($('#deep-review'), r, imported => {
    aiComments = imported;
    render();
  });
  board = Chessground($('#board'), {
    fen: r.initialFen,
    coordinates: true,
    movable: { free: false, color: undefined, events: { after: onUserMove } },
    draggable: { enabled: true },
    selectable: { enabled: true },
    drawable: { enabled: false, visible: true },
  });
  render();
}

/* -------------------------------------------------- live "try a move" --- */

/** FEN currently shown on the board (game position or explored line). */
function shownFen(): string {
  const r = report!;
  if (exploreLine.length) return exploreLine[exploreLine.length - 1].fenAfter;
  return ply > 0 ? r.moves[ply - 1].fenAfter : r.initialFen;
}

/** Hand the report's already-computed analysis of `fen` to the live cache. */
function seedFromReport(fen: string): void {
  const r = report!;
  const m = r.moves.find(mv => mv.fenBefore === fen);
  if (!m) return;
  seedLiveAnalysis(fen, {
    fen,
    lines: m.lines.map((l, i) => ({ multipv: i + 1, depth: 0, eval: l.eval, pvUci: l.uciPv })),
    bestmoveUci: m.bestUci,
    terminal: m.lines.length === 0,
  });
}

/** User dropped a piece: run the move through the normal analysis pipeline. */
function onUserMove(orig: Key, dest: Key): void {
  if (!report || exploreThinking) return;
  if (spotlight) return onSpotlightMove(orig, dest);
  const fenBefore = shownFen();
  const pos = Chess.fromSetup(parseFen(fenBefore).unwrap()).unwrap();
  const from = parseSquare(orig);
  const to = parseSquare(dest);
  if (from === undefined || to === undefined) return render();
  let move: NormalMove = { from, to };
  if (pos.board.get(from)?.role === 'pawn' && (to >= 56 || to < 8))
    move = { ...move, promotion: 'queen' }; // auto-queen
  move = normalizeMove(pos, move) as NormalMove;
  if (!pos.isLegal(move)) return render();

  const san = makeSan(pos, move);
  const token = ++liveToken;
  exploreThinking = true;
  render();
  renderCoachThinking($('#coach'), san);

  seedFromReport(fenBefore);
  const plyIndex = ply + exploreLine.length + 1;
  void liveMoveReport(fenBefore, move, plyIndex)
    .then(m => {
      if (token !== liveToken) return; // user navigated away meanwhile
      exploreThinking = false;
      if (m) exploreLine.push(m);
      render();
    })
    .catch(() => {
      if (token !== liveToken) return;
      exploreThinking = false;
      render();
    });
}

function exitExplore(): void {
  liveToken++;
  exploreLine = [];
  exploreThinking = false;
}

/** Squares to highlight for a move (castling shown as the king's hop). */
function displaySquares(m: AnnotatedMove): [Key, Key] {
  if (m.san.startsWith('O-O')) {
    const rank = m.color === 'white' ? '1' : '8';
    return [`e${rank}` as Key, (m.san.startsWith('O-O-O') ? `c${rank}` : `g${rank}`) as Key];
  }
  return [m.uci.slice(0, 2) as Key, m.uci.slice(2, 4) as Key];
}

/* ------------------------------------------- best-move Spotlight --- */

/** Chip click → enter focus mode and walk the line at the user's pace. */
function enterSpotlight(chip: VariationChip): void {
  if (!board || !report) return;
  const m = exploreLine.length
    ? exploreLine[exploreLine.length - 1]
    : ply > 0
      ? report.moves[ply - 1]
      : null;
  const fine = m
    ? !['inaccuracy', 'mistake', 'blunder', 'miss'].includes(m.classification)
    : false;
  const steps = buildWalkthrough(chip, m?.san ?? null, fine);
  if (steps.length < 2) return;
  spotlight = {
    steps,
    i: 0,
    title:
      chip.kind === 'best'
        ? `The best move was ${chip.sanPv[0] ?? ''}`
        : `Why ${m?.san ?? 'that move'} falls short`,
    kind: chip.kind,
    chip,
    tryLine: [],
    thinking: false,
  };
  document.body.classList.add('focus-mode');
  renderSpotlight();
}

/** Eval bar update — shared by review, spotlight steps and try moves. */
function setEvalBar(ev: { cp?: number; mate?: number }, win: number): void {
  ($('#eval-bar .white-fill') as HTMLElement).style.height = `${win}%`;
  $('#eval-bar .eval-label').textContent = formatEval(ev);
}

function renderSpotlight(): void {
  if (!board || !spotlight) return;
  const { steps, i, title, kind, chip } = spotlight;
  const step = steps[i];
  // pieces stay movable — trying your own idea is one drag away
  const pos = Chess.fromSetup(parseFen(step.fen).unwrap()).unwrap();
  board.set({
    fen: step.fen,
    lastMove: step.lastMove as Key[] | undefined,
    turnColor: pos.turn,
    movable: {
      free: false,
      color: spotlight.thinking || pos.isEnd() ? undefined : pos.turn,
      dests: chessgroundDests(pos),
    },
  });
  board.setAutoShapes(
    step.arrow ? [{ orig: step.arrow.orig as Key, dest: step.arrow.dest as Key, brush: step.arrow.brush }] : [],
  );
  if (chip.eval) setEvalBar(chip.eval, winPercent(chip.eval));
  renderSpotlightCard($('#coach'), title, kind, steps, i, {
    go: n => {
      if (!spotlight) return;
      spotlight.i = Math.max(0, Math.min(steps.length - 1, n));
      renderSpotlight();
    },
    exit: exitSpotlight,
  });
  attachPreviews($('#coach'), startPreview, endPreview);
}

/** Board position the Spotlight is currently showing (step or try line). */
function spotlightFen(): string {
  const sp = spotlight!;
  return sp.tryLine.length ? sp.tryLine[sp.tryLine.length - 1].fenAfter : sp.steps[sp.i].fen;
}

/** A piece moved inside the Spotlight → rate it live, switch to try mode. */
function onSpotlightMove(orig: Key, dest: Key): void {
  if (!board || !spotlight || spotlight.thinking) return;
  const fenBefore = spotlightFen();
  const pos = Chess.fromSetup(parseFen(fenBefore).unwrap()).unwrap();
  const from = parseSquare(orig);
  const to = parseSquare(dest);
  if (from === undefined || to === undefined) return renderSpotView();
  let move: NormalMove = { from, to };
  if (pos.board.get(from)?.role === 'pawn' && (to >= 56 || to < 8))
    move = { ...move, promotion: 'queen' };
  move = normalizeMove(pos, move) as NormalMove;
  if (!pos.isLegal(move)) return renderSpotView();

  const san = makeSan(pos, move);
  const token = ++liveToken;
  spotlight.thinking = true;
  renderTryCard($('#coach'), null, san, { undo: () => {}, back: backToLine });
  const plyIndex = ply + spotlight.i + spotlight.tryLine.length + 1;
  void liveMoveReport(fenBefore, move, plyIndex)
    .then(m => {
      if (!spotlight || token !== liveToken) return;
      spotlight.thinking = false;
      if (m) spotlight.tryLine.push(m);
      renderSpotView();
    })
    .catch(() => {
      if (!spotlight || token !== liveToken) return;
      spotlight.thinking = false;
      renderSpotView();
    });
}

/** Render whichever Spotlight view applies (best line or the user's try). */
function renderSpotView(): void {
  if (!spotlight) return;
  if (spotlight.tryLine.length) renderSpotTry();
  else renderSpotlight();
}

function backToLine(): void {
  if (!spotlight) return;
  liveToken++;
  spotlight.tryLine = [];
  spotlight.thinking = false;
  renderSpotlight();
}

function undoTryMove(): void {
  if (!spotlight) return;
  liveToken++;
  spotlight.thinking = false;
  spotlight.tryLine.pop();
  renderSpotView();
}

/** Try mode: user's own move on the board, rated — visually distinct card. */
function renderSpotTry(): void {
  if (!board || !spotlight) return;
  const m = spotlight.tryLine[spotlight.tryLine.length - 1];
  const pos = Chess.fromSetup(parseFen(m.fenAfter).unwrap()).unwrap();
  const [from, to] = displaySquares(m);
  board.set({
    fen: m.fenAfter,
    lastMove: [from, to],
    turnColor: pos.turn,
    movable: {
      free: false,
      color: spotlight.thinking || pos.isEnd() ? undefined : pos.turn,
      dests: chessgroundDests(pos),
    },
  });
  board.setAutoShapes([
    { orig: to, customSvg: { html: badgeSvg(m.classification), center: 'orig' } },
  ]);
  setEvalBar(m.evalAfter, m.winPercentAfter);
  renderTryCard($('#coach'), m, m.san, { undo: undoTryMove, back: backToLine });
  attachPreviews($('#coach'), startPreview, endPreview);
}

/* --------------------------------------------- move-tag hover preview --- */

function startPreview(fen: string, uci: string): void {
  if (!board || exploreThinking || spotlight?.thinking) return;
  previewing = true;
  if (previewTimer !== null) clearTimeout(previewTimer);
  board.set({ fen, lastMove: undefined, movable: { color: undefined } });
  board.setAutoShapes([
    { orig: uci.slice(0, 2) as Key, dest: uci.slice(2, 4) as Key, brush: 'green' },
  ]);
  // a beat to read the arrow, then the move plays itself
  previewTimer = setTimeout(() => {
    board?.move(uci.slice(0, 2) as Key, uci.slice(2, 4) as Key);
  }, 380);
}

function endPreview(): void {
  if (previewTimer !== null) {
    clearTimeout(previewTimer);
    previewTimer = null;
  }
  if (!previewing) return;
  previewing = false;
  if (spotlight) renderSpotView();
  else renderBoardOnly();
}

function exitSpotlight(): void {
  if (!spotlight) return;
  spotlight = null;
  document.body.classList.remove('focus-mode');
  render();
}

/** Board + arrow + badge + eval bar from the current review state only. */
function renderBoardOnly(): void {
  const r = report!;
  if (!r.moves.length || !board) return;
  const live = exploreLine.length > 0;
  const m = live ? exploreLine[exploreLine.length - 1] : ply > 0 ? r.moves[ply - 1] : null;

  // board + best-move arrow (when the played move lost ≥5 win%) + badge
  const shapes: DrawShape[] = [];
  let lastMove: Key[] | undefined;
  if (m) {
    const [from, to] = displaySquares(m);
    lastMove = [from, to];
    if (m.winDrop >= 5 && m.bestUci && !m.wasBest)
      shapes.push({
        orig: m.bestUci.slice(0, 2) as Key,
        dest: m.bestUci.slice(2, 4) as Key,
        brush: 'green',
      });
    shapes.push({ orig: to, customSvg: { html: badgeSvg(m.classification), center: 'orig' } });
  }

  // the user may move a piece from any shown position (live commentary)
  const fen = m ? m.fenAfter : r.initialFen;
  const pos = Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
  const movableColor = exploreThinking || pos.isEnd() ? undefined : pos.turn;
  board.set({
    fen,
    lastMove,
    orientation,
    turnColor: pos.turn,
    movable: { free: false, color: movableColor, dests: chessgroundDests(pos) },
  });
  board.setAutoShapes(shapes);

  const ev = m ? m.evalAfter : r.moves[0].evalBefore;
  setEvalBar(ev, m ? m.winPercentAfter : winPercent(ev));
}

function render(): void {
  const r = report!;
  if (!r.moves.length || !board) return;
  if (spotlight) {
    // navigating anywhere else dissolves the Spotlight back into the review
    spotlight = null;
    document.body.classList.remove('focus-mode');
  }
  const live = exploreLine.length > 0;
  const m = live ? exploreLine[exploreLine.length - 1] : ply > 0 ? r.moves[ply - 1] : null;
  renderBoardOnly();

  // panels (move list & graph stay anchored to the game while exploring)
  renderSummary($('#summary'), r);
  renderCoach(
    $('#coach'),
    r,
    m,
    enterSpotlight,
    m && !live ? (aiComments.get(m.ply) ?? null) : null,
    live,
  );
  $('#coach')
    .querySelector('#live-back')
    ?.addEventListener('click', () => {
      exitExplore();
      render();
    });
  attachPreviews($('#coach'), startPreview, endPreview);
  renderGraph($('#graph'), r.moves, ply, seek);
  renderMoveList($('#moves'), r.moves, ply, seek);
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
  exitExplore();
  ply = Math.max(0, Math.min(report.moves.length, p));
  render();
}

/* ------------------------------------------------------------ wiring --- */
function setTab(tab: 'pgn' | 'cc'): void {
  $('#tab-pgn').classList.toggle('hidden', tab !== 'pgn');
  $('#tab-cc').classList.toggle('hidden', tab !== 'cc');
  $('#tab-btn-pgn').classList.toggle('active', tab === 'pgn');
  $('#tab-btn-cc').classList.toggle('active', tab === 'cc');
  $('#tab-btn-pgn').setAttribute('aria-selected', String(tab === 'pgn'));
  $('#tab-btn-cc').setAttribute('aria-selected', String(tab === 'cc'));
}
$('#tab-btn-pgn').addEventListener('click', () => setTab('pgn'));
$('#tab-btn-cc').addEventListener('click', () => setTab('cc'));

// topbar navigation + home entry cards
$('#nav-brand').addEventListener('click', () => show('home'));
$('#nav-home').addEventListener('click', () => show('home'));
$('#nav-input').addEventListener('click', () => show('input'));
$('#nav-review').addEventListener('click', () => {
  if (report) show('review');
});
$('#home-pgn').addEventListener('click', () => {
  show('input');
  setTab('pgn');
});
$('#home-cc').addEventListener('click', () => {
  show('input');
  setTab('cc');
});

initChesscomTab($('#tab-cc'), {
  review: game => void reviewCcGame(game),
  getTier: currentTier,
});
$('#tier').addEventListener('change', () => void refreshCached());

$('#progress-cancel').addEventListener('click', () => {
  if (foregroundJobId) analysisQueue.cancel(foregroundJobId);
});

// topbar pill: background analysis keeps the user posted on any screen
// (hidden on the progress screen, which already shows the same numbers)
analysisQueue.subscribe(snap => {
  const pill = $('#queue-pill');
  const busy = snap.pendingCount + (snap.active ? 1 : 0);
  if (!busy || !screens.progress().classList.contains('hidden')) {
    pill.classList.add('hidden');
    return;
  }
  const pct = snap.active?.total
    ? ` · ${Math.round((snap.active.done / snap.active.total) * 100)}%`
    : '';
  const n = Math.min(snap.doneCount + 1, snap.totalCount);
  pill.innerHTML = `<span class="cc-spin"></span>Analyzing ${n} of ${snap.totalCount}${pct}`;
  pill.classList.remove('hidden');
});

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
  spotlight = null;
  document.body.classList.remove('focus-mode');
  exitExplore();
  disposeLive();
  $('#nav-review').classList.add('hidden');
  show('input');
});

show('home'); // boot: land on the home screen (starts its knight)

document.addEventListener('keydown', e => {
  if (!report || screens.review().classList.contains('hidden')) return;
  if (e.target instanceof HTMLTextAreaElement) return;
  if (spotlight) {
    // try mode first: ← undoes, Esc returns to the line
    if (spotlight.tryLine.length || spotlight.thinking) {
      if (e.key === 'ArrowLeft') undoTryMove();
      else if (e.key === 'Escape') backToLine();
      return;
    }
    // focus mode: arrows step the line, Esc returns — nothing else
    if (e.key === 'ArrowRight') {
      if (spotlight.i >= spotlight.steps.length - 1) exitSpotlight();
      else {
        spotlight.i++;
        renderSpotlight();
      }
    } else if (e.key === 'ArrowLeft' && spotlight.i > 0) {
      spotlight.i--;
      renderSpotlight();
    } else if (e.key === 'Escape') exitSpotlight();
    return;
  }
  switch (e.key) {
    case 'ArrowLeft':
      if (exploreLine.length) {
        // step back through the explored line before leaving it
        liveToken++;
        exploreThinking = false;
        exploreLine.pop();
        render();
      } else seek(ply - 1);
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
