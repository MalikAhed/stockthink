/**
 * chess.com Public Data API client (api.chess.com/pub — free, keyless,
 * CORS-open, read-only; fits the $0 client-side constraint). Fetchers are
 * thin; normalization and outcome mapping are pure functions so tests cover
 * them without network.
 */

const API = 'https://api.chess.com/pub';

export interface CcPlayer {
  /** Canonical-cased username from the API. */
  username: string;
  name?: string;
  /** OTB title when present (GM, IM, …). */
  title?: string;
  avatar?: string;
  /** Public profile URL on chess.com. */
  url: string;
}

export interface CcRatings {
  rapid?: number;
  blitz?: number;
  bullet?: number;
  daily?: number;
}

export interface CcSide {
  username: string;
  rating: number;
  /** Raw chess.com result code (win, resigned, timeout, repetition, …). */
  result: string;
}

export interface CcGame {
  uuid: string;
  url: string;
  pgn: string;
  /** Unix seconds when the game ended. */
  endTime: number;
  timeClass: string;
  timeControl: string;
  rated: boolean;
  white: CcSide;
  black: CcSide;
  /** chess.com CAPS accuracies, when the game was reviewed there. */
  accuracies?: { white: number; black: number };
  /** Full-move count parsed from the movetext (display only). */
  moveCount: number;
}

export class CcApiError extends Error {}

async function getJson(url: string, notFound: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new CcApiError('Could not reach chess.com — check your connection.');
  }
  if (res.status === 404) throw new CcApiError(notFound);
  if (res.status === 429)
    throw new CcApiError('chess.com is rate-limiting requests — wait a moment and retry.');
  if (!res.ok) throw new CcApiError(`chess.com returned an error (${res.status}).`);
  return res.json();
}

export async function fetchPlayer(username: string): Promise<CcPlayer> {
  const u = username.trim().toLowerCase();
  const raw = (await getJson(
    `${API}/player/${encodeURIComponent(u)}`,
    `No chess.com account named “${username.trim()}”.`,
  )) as Record<string, unknown>;
  return {
    username: typeof raw.username === 'string' ? raw.username : u,
    name: typeof raw.name === 'string' ? raw.name : undefined,
    title: typeof raw.title === 'string' ? raw.title : undefined,
    avatar: typeof raw.avatar === 'string' ? raw.avatar : undefined,
    url: typeof raw.url === 'string' ? raw.url : `https://www.chess.com/member/${u}`,
  };
}

/** Best-effort current ratings (a stats failure never blocks the games list). */
export async function fetchRatings(username: string): Promise<CcRatings> {
  try {
    const raw = (await getJson(
      `${API}/player/${encodeURIComponent(username.toLowerCase())}/stats`,
      'stats',
    )) as Record<string, { last?: { rating?: number } }>;
    const last = (k: string): number | undefined => raw[k]?.last?.rating;
    return {
      rapid: last('chess_rapid'),
      blitz: last('chess_blitz'),
      bullet: last('chess_bullet'),
      daily: last('chess_daily'),
    };
  } catch {
    return {};
  }
}

/** Monthly archive URLs, oldest → newest (may be empty for fresh accounts). */
export async function fetchArchives(username: string): Promise<string[]> {
  const raw = (await getJson(
    `${API}/player/${encodeURIComponent(username.toLowerCase())}/games/archives`,
    `No chess.com account named “${username}”.`,
  )) as { archives?: unknown };
  return Array.isArray(raw.archives) ? raw.archives.filter(a => typeof a === 'string') : [];
}

export interface MonthGames {
  games: CcGame[];
  /** Games dropped from the list (variants / missing PGN — not analyzable). */
  hidden: number;
}

export async function fetchMonth(archiveUrl: string): Promise<MonthGames> {
  const raw = (await getJson(archiveUrl, 'No games in this month.')) as { games?: unknown };
  return normalizeGames(Array.isArray(raw.games) ? raw.games : []);
}

/** Raw archive entries → newest-first CcGames; variants and PGN-less games are counted, not shown. */
export function normalizeGames(raw: unknown[]): MonthGames {
  const games: CcGame[] = [];
  let hidden = 0;
  for (const entry of raw) {
    const g = entry as Record<string, unknown>;
    const side = (s: unknown): CcSide | null => {
      const o = s as Record<string, unknown> | undefined;
      return o && typeof o.username === 'string'
        ? {
            username: o.username,
            rating: typeof o.rating === 'number' ? o.rating : 0,
            result: typeof o.result === 'string' ? o.result : '',
          }
        : null;
    };
    const white = side(g.white);
    const black = side(g.black);
    const pgn = typeof g.pgn === 'string' ? g.pgn : '';
    if (g.rules !== 'chess' || !pgn || typeof g.uuid !== 'string' || !white || !black) {
      hidden++;
      continue;
    }
    const acc = g.accuracies as { white?: number; black?: number } | undefined;
    games.push({
      uuid: g.uuid,
      url: typeof g.url === 'string' ? g.url : '',
      pgn,
      endTime: typeof g.end_time === 'number' ? g.end_time : 0,
      timeClass: typeof g.time_class === 'string' ? g.time_class : '',
      timeControl: typeof g.time_control === 'string' ? g.time_control : '',
      rated: g.rated === true,
      white,
      black,
      accuracies:
        typeof acc?.white === 'number' && typeof acc?.black === 'number'
          ? { white: acc.white, black: acc.black }
          : undefined,
      moveCount: moveCount(pgn),
    });
  }
  games.sort((a, b) => b.endTime - a.endTime);
  return { games, hidden };
}

/* --------------------------------------------------- pure view helpers --- */

/** Which side of the game the searched user played (case-insensitive). */
export function userSide(game: CcGame, username: string): 'white' | 'black' {
  return game.white.username.toLowerCase() === username.toLowerCase() ? 'white' : 'black';
}

/** Result codes that mean a draw — everything else non-"win" is a loss. */
const DRAW_RESULTS = new Set([
  'agreed',
  'repetition',
  'stalemate',
  'insufficient',
  '50move',
  'timevsinsufficient',
]);

/** Game outcome from the searched user's perspective. */
export function userOutcome(game: CcGame, username: string): 'win' | 'draw' | 'loss' {
  const mine = game[userSide(game, username)].result;
  if (mine === 'win') return 'win';
  return DRAW_RESULTS.has(mine) ? 'draw' : 'loss';
}

/** Standard score string for the game ("1-0", "0-1", "½-½"). */
export function resultLabel(game: CcGame): string {
  if (game.white.result === 'win') return '1-0';
  if (game.black.result === 'win') return '0-1';
  return '½-½';
}

/** Highest move number in the movetext (good enough for "42 moves"). */
export function moveCount(pgn: string): number {
  let max = 0;
  for (const m of pgn.matchAll(/(?:^|\s)(\d+)\./g)) max = Math.max(max, parseInt(m[1]));
  return max;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** ".../games/2026/05" → "May 2026". */
export function archiveLabel(archiveUrl: string): string {
  const m = archiveUrl.match(/(\d{4})\/(\d{2})$/);
  if (!m) return archiveUrl;
  return `${MONTHS[parseInt(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

/** "May 2" for this year's games, "May 2, 2025" for older ones. */
export function dateLabel(endTimeSeconds: number, now: Date = new Date()): string {
  const d = new Date(endTimeSeconds * 1000);
  const day = `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
  return d.getFullYear() === now.getFullYear() ? day : `${day}, ${d.getFullYear()}`;
}
