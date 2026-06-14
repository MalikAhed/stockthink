/**
 * "From Chess.com" input tab: username → player card → monthly game list.
 * Click a game to review it (cached reports open instantly); tick several and
 * pre-analyze — the queue crunches in the background while the user reads a
 * finished review, and every row's status chip tracks it live.
 */
import {
  archiveLabel,
  dateLabel,
  fetchArchives,
  fetchMonth,
  fetchPlayer,
  fetchRatings,
  resultLabel,
  userOutcome,
  userSide,
  type CcGame,
  type CcPlayer,
  type CcRatings,
} from '@backend/chesscom/api';
import { analysisQueue, type QueueSnapshot } from '@backend/chesscom/queue';
import { cachedKeys, reportKey } from '@backend/chesscom/store';
import type { Tier } from '@backend/analyze';

export interface ChesscomCallbacks {
  /** Open this game in the review flow (cache-aware — main decides how). */
  review: (game: CcGame) => void;
  getTier: () => Tier;
}

const PAGE = 50;

/* Stopwatch / bolt / bullet / sun — chess.com's time-class vocabulary. */
const TC_ICONS: Record<string, string> = {
  rapid:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9.5V13l2.4 1.8M9.5 2.5h5"/></svg>',
  blitz:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4.5 13.5h5L9.5 22 18 10.5h-5L13 2z"/></svg>',
  bullet:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.2 3.4c1.9-.8 4-.9 5.6-.2.7 1.6.6 3.7-.2 5.6-.8 1.9-2.2 3.8-4.1 5.7l-2.6 2.6-6-6 2.6-2.6c1.9-1.9 3.8-3.3 4.7-5.1zM6 15l3 3-4.6 3.1c-.5.3-1-.2-.7-.7L6 15z"/></svg>',
  daily:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8"/></svg>',
};
const tcIcon = (timeClass: string): string =>
  `<span class="cc-tc cc-tc-${timeClass}" title="${esc(cap(timeClass))}">${TC_ICONS[timeClass] ?? TC_ICONS.rapid}</span>`;

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/* ------------------------------------------------------------ state --- */
let host: HTMLElement;
let callbacks: ChesscomCallbacks;
let player: CcPlayer | null = null;
let ratings: CcRatings = {};
let archives: string[] = []; // newest first
let monthUrl = '';
let games: CcGame[] = [];
let hidden = 0;
let shown = PAGE;
let selected = new Set<string>();
let cached = new Set<string>(); // report-cache keys (uuid:tier)
let busy: 'player' | 'games' | null = null;
let error = '';
let lastSearch = '';

export function initChesscomTab(el: HTMLElement, cbs: ChesscomCallbacks): void {
  host = el;
  callbacks = cbs;
  void refreshCached();
  analysisQueue.subscribe(onQueue);
  render();
}

/** Re-read the report cache (after a job lands or the tier changes). */
export async function refreshCached(): Promise<void> {
  cached = await cachedKeys();
  if (host) updateStatuses();
}

const isCached = (uuid: string): boolean => cached.has(reportKey(uuid, callbacks.getTier()));

let hadActive = false;
function onQueue(snap: QueueSnapshot): void {
  // a job just finished → its report is now in the cache
  if (hadActive && !snap.active) void refreshCached();
  hadActive = !!snap.active;
  updateStatuses();
}

/* ------------------------------------------------------------ fetch --- */
async function loadPlayer(query: string): Promise<void> {
  // accept "name", "@name" or a pasted profile URL
  const m = query.match(/chess\.com\/member\/([^/?#\s]+)/i);
  const username = (m ? m[1] : query).replace(/^@/, '').trim();
  if (!username) return;
  lastSearch = username;
  busy = 'player';
  error = '';
  player = null;
  games = [];
  selected = new Set();
  render();
  try {
    const [p, r, a] = await Promise.all([
      fetchPlayer(username),
      fetchRatings(username),
      fetchArchives(username),
    ]);
    player = p;
    ratings = r;
    archives = [...a].reverse();
    busy = null;
    if (archives.length) {
      render();
      await loadMonth(archives[0]);
      return;
    }
    monthUrl = '';
    render();
  } catch (e) {
    busy = null;
    error = e instanceof Error ? e.message : String(e);
    render();
  }
}

async function loadMonth(url: string): Promise<void> {
  monthUrl = url;
  busy = 'games';
  error = '';
  games = [];
  selected = new Set();
  shown = PAGE;
  render();
  try {
    const month = await fetchMonth(url);
    games = month.games;
    hidden = month.hidden;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  busy = null;
  render();
}

/* ----------------------------------------------------------- render --- */
function render(): void {
  host.innerHTML = `
    <form id="cc-form" class="cc-search">
      <div class="cc-search-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg>
        <input id="cc-user" type="text" placeholder="chess.com username" autocomplete="off"
               spellcheck="false" value="${esc(lastSearch)}" ${busy === 'player' ? 'disabled' : ''}>
      </div>
      <button type="submit" class="primary" ${busy === 'player' ? 'disabled' : ''}>
        ${busy === 'player' ? 'Finding…' : 'Find games'}
      </button>
    </form>
    ${error ? `<p class="error">${esc(error)}</p>` : ''}
    ${player ? playerCardHtml() : busy !== 'player' && !error ? `<p class="hint cc-blurb">Look up any account and review its games — yours, a rival's, or a streamer's. Pick several and pre-analyze them in the background while you read the first review.</p>` : ''}
    ${player ? gamesHtml() : ''}`;

  $('#cc-form')?.addEventListener('submit', e => {
    e.preventDefault();
    void loadPlayer(($('#cc-user') as HTMLInputElement).value);
  });
  const avatar = $('.cc-avatar img') as HTMLImageElement | null;
  avatar?.addEventListener('error', () => {
    avatar.parentElement!.innerHTML = letterAvatar();
  });
  $('#cc-month')?.addEventListener('change', e => {
    void loadMonth((e.target as HTMLSelectElement).value);
  });
  $('#cc-more')?.addEventListener('click', () => {
    shown += PAGE;
    render();
  });
  $('#cc-sel-page')?.addEventListener('click', selectPage);
  $('#cc-sel-none')?.addEventListener('click', () => {
    selected = new Set();
    updateStatuses();
  });
  $('#cc-analyze-sel')?.addEventListener('click', preanalyzeSelected);
  for (const row of host.querySelectorAll<HTMLElement>('.cc-row')) {
    const game = games.find(g => g.uuid === row.dataset.uuid);
    if (!game) continue;
    row.addEventListener('click', () => callbacks.review(game));
    // the visible span is the click target — stop it at the label or the
    // row handler underneath would open the review on every tick
    row.querySelector('.cc-check')?.addEventListener('click', e => e.stopPropagation());
    const box = row.querySelector<HTMLInputElement>('input[type=checkbox]');
    box?.addEventListener('change', () => {
      if (box.checked) selected.add(game.uuid);
      else selected.delete(game.uuid);
      updateStatuses();
    });
  }
  updateStatuses();
}

const $ = <T extends HTMLElement = HTMLElement>(sel: string): T | null =>
  host.querySelector(sel) as T | null;

const letterAvatar = (): string =>
  `<span class="cc-avatar-letter">${esc((player?.username ?? '?').charAt(0).toUpperCase())}</span>`;

function playerCardHtml(): string {
  const p = player!;
  const rating = (key: keyof CcRatings): string =>
    ratings[key] === undefined
      ? ''
      : `<span class="cc-rating" title="${cap(key)}">${tcIcon(key)}${ratings[key]}</span>`;
  return `
    <div class="cc-player">
      <span class="cc-avatar">${p.avatar ? `<img src="${esc(p.avatar)}" alt="">` : letterAvatar()}</span>
      <div class="cc-player-main">
        <div class="cc-player-name">
          ${p.title ? `<span class="cc-title">${esc(p.title)}</span>` : ''}
          <span>${esc(p.username)}</span>
          ${p.name ? `<span class="cc-realname">${esc(p.name)}</span>` : ''}
          <a class="cc-profile" href="${esc(p.url)}" target="_blank" rel="noopener" title="Open chess.com profile">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6"/></svg>
          </a>
        </div>
        <div class="cc-ratings">
          ${rating('bullet')}${rating('blitz')}${rating('rapid')}${rating('daily')}
        </div>
      </div>
    </div>`;
}

function gamesHtml(): string {
  if (!archives.length)
    return `<p class="hint">This account hasn't played any games yet.</p>`;
  const options = archives
    .map(a => `<option value="${esc(a)}" ${a === monthUrl ? 'selected' : ''}>${esc(archiveLabel(a))}</option>`)
    .join('');
  const list =
    busy === 'games'
      ? `<p class="hint cc-loading">Loading games…</p>`
      : games.length
        ? `<div class="cc-list">${games.slice(0, shown).map(rowHtml).join('')}</div>
           ${games.length > shown ? `<button id="cc-more" class="cc-more">Show ${Math.min(PAGE, games.length - shown)} more of ${games.length - shown}</button>` : ''}`
        : `<p class="hint">No standard games this month.</p>`;
  return `
    <div class="cc-toolbar">
      <select id="cc-month">${options}</select>
      <span class="cc-count">${busy === 'games' ? '' : `${games.length} games${hidden ? ` · ${hidden} variant games hidden` : ''}`}</span>
      <span class="cc-select-links">Select <button type="button" id="cc-sel-page">shown</button> · <button type="button" id="cc-sel-none">none</button></span>
    </div>
    ${list}
    <div id="cc-selbar" class="cc-selbar hidden">
      <span id="cc-sel-count"></span>
      <button id="cc-analyze-sel" class="primary"></button>
      <span class="cc-selbar-hint">runs in the background — open any game while the rest finish</span>
    </div>`;
}

function rowHtml(g: CcGame): string {
  const u = player!.username;
  const side = userSide(g, u);
  const outcome = userOutcome(g, u);
  const playerSpan = (s: 'white' | 'black'): string =>
    `<span class="cc-dot ${s}"></span><span class="cc-name ${s === side ? 'me' : ''}">${esc(g[s].username)}</span><span class="cc-elo">(${g[s].rating})</span>`;
  const acc = g.accuracies?.[side];
  return `
    <div class="cc-row" data-uuid="${esc(g.uuid)}" title="Open game review">
      <label class="cc-check"><input type="checkbox" ${selected.has(g.uuid) ? 'checked' : ''}><span></span></label>
      ${tcIcon(g.timeClass)}
      <div class="cc-game">
        <div class="cc-players">${playerSpan('white')}<span class="cc-vs">vs</span>${playerSpan('black')}</div>
        <div class="cc-meta">${dateLabel(g.endTime)} · ${g.moveCount} moves · ${resultLabel(g)}${g.rated ? '' : ' · unrated'}${acc !== undefined ? ` · ${acc.toFixed(0)}% acc` : ''}</div>
      </div>
      <span class="cc-res ${outcome}">${outcome === 'win' ? '+' : outcome === 'loss' ? '−' : '='}</span>
      <span class="cc-status"></span>
      <svg class="cc-go" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m9.5 6 6 6-6 6"/></svg>
    </div>`;
}

/* --------------------------------------- live status chips & sel bar --- */
function updateStatuses(): void {
  if (!host.isConnected || !player) return;
  const snap = analysisQueue.snapshot();
  for (const row of host.querySelectorAll<HTMLElement>('.cc-row')) {
    const uuid = row.dataset.uuid!;
    const status = row.querySelector<HTMLElement>('.cc-status')!;
    const box = row.querySelector<HTMLInputElement>('input[type=checkbox]')!;
    const state = snap.states.get(uuid);
    let chip = '';
    if (isCached(uuid)) {
      chip = `<span class="chip done" title="Opens instantly">✓ Analyzed</span>`;
    } else if (state === 'analyzing' && snap.active?.id === uuid) {
      const pct = snap.active.total ? Math.round((snap.active.done / snap.active.total) * 100) : 0;
      chip = `<span class="chip busy"><span class="cc-spin"></span>${pct}%</span>`;
    } else if (state === 'queued') {
      chip = `<span class="chip queued">Queued</span>`;
    } else if (state === 'failed') {
      chip = `<span class="chip failed" title="${esc(snap.failures.get(uuid) ?? '')}">Failed</span>`;
    }
    status.innerHTML = chip;
    const settled = isCached(uuid) || state === 'queued' || state === 'analyzing';
    box.disabled = settled;
    if (settled) {
      selected.delete(uuid);
      box.checked = false; // the chip tells the story from here
    }
    row.classList.toggle('analyzed', isCached(uuid));
  }
  const bar = $('#cc-selbar');
  if (bar) {
    bar.classList.toggle('hidden', selected.size === 0);
    const n = selected.size;
    const count = $('#cc-sel-count');
    const btn = $('#cc-analyze-sel');
    if (count) count.textContent = `${n} game${n === 1 ? '' : 's'} selected`;
    if (btn)
      btn.textContent = `Pre-analyze ${n === 1 ? 'it' : `all ${n}`} · ${cap(callbacks.getTier())}`;
  }
}

function selectPage(): void {
  const snap = analysisQueue.snapshot();
  for (const g of games.slice(0, shown)) {
    const state = snap.states.get(g.uuid);
    if (!isCached(g.uuid) && state !== 'queued' && state !== 'analyzing') selected.add(g.uuid);
  }
  for (const row of host.querySelectorAll<HTMLElement>('.cc-row')) {
    const box = row.querySelector<HTMLInputElement>('input[type=checkbox]')!;
    box.checked = selected.has(row.dataset.uuid!);
  }
  updateStatuses();
}

function preanalyzeSelected(): void {
  const tier = callbacks.getTier();
  const jobs = games
    .filter(g => selected.has(g.uuid) && !isCached(g.uuid))
    .map(g => ({
      id: g.uuid,
      pgn: g.pgn,
      tier,
      label: `${g.white.username} vs ${g.black.username}`,
      cacheUuid: g.uuid,
    }));
  selected = new Set();
  analysisQueue.enqueue(jobs);
}
