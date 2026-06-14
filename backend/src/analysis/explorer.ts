/**
 * Deep book detection via the lichess opening-explorer databases
 * (free, keyless, CORS-open — fits the $0/client-side constraint).
 *
 * The baked EPD map (openings.ts) only knows *named* positions (~3.7k), so it
 * declares "out of book" several moves before real theory ends. Here a move
 * counts as book if either database actually played it from the exact
 * position:
 *   1. masters DB (2200+ OTB games) — strict theory
 *   2. lichess online DB (2200+ rated games) — the long tail of known lines
 *      that few masters bother with but everyone plays (chess.com-like depth)
 * Walked front-to-back, stopping at the first non-book move — book is a
 * prefix property. Any network failure degrades silently to whatever was
 * confirmed so far (the EPD map still backstops names/classification).
 */

const MASTERS_URL = 'https://explorer.lichess.ovh/masters';
const LICHESS_URL = 'https://explorer.lichess.ovh/lichess';
/** Book never extends past this many plies (15 full moves — chess.com-like). */
const MAX_BOOK_PLIES = 30;
/** Minimum master games in which the played move occurred. */
const MIN_MASTER_GAMES = 5;
/** Minimum high-rated online games (much bigger DB → higher bar). */
const MIN_LICHESS_GAMES = 500;

export interface BookPly {
  fenBefore: string;
  san: string;
}

interface ExplorerMove {
  san: string;
  white: number;
  draws: number;
  black: number;
}

/** Games in which `san` was played from `fen`, per one explorer DB. -1 = fetch failed. */
async function gamesFor(
  url: string,
  fen: string,
  san: string,
  fetchFn: typeof fetch,
): Promise<number> {
  try {
    const res = await fetchFn(`${url}&fen=${encodeURIComponent(fen)}&moves=30&topGames=0&recentGames=0`);
    if (!res.ok) return -1;
    const data = (await res.json()) as { moves?: ExplorerMove[] };
    const mv = data.moves?.find(x => x.san === san);
    return mv ? mv.white + mv.draws + mv.black : 0;
  } catch {
    return -1;
  }
}

/**
 * Indices of the leading plies that are book moves. Sequential fetches
 * (≤2 per ply — the online DB is only consulted when masters comes up
 * short), stops at the first miss. Never throws.
 */
export async function masterBookPlies(
  plies: BookPly[],
  fetchFn: typeof fetch = fetch,
): Promise<Set<number>> {
  const out = new Set<number>();
  for (let i = 0; i < Math.min(plies.length, MAX_BOOK_PLIES); i++) {
    const { fenBefore, san } = plies[i];
    const masters = await gamesFor(`${MASTERS_URL}?`, fenBefore, san, fetchFn);
    if (masters === -1) break; // network trouble → keep what we have
    if (masters < MIN_MASTER_GAMES) {
      const online = await gamesFor(
        `${LICHESS_URL}?ratings=2200,2500&speeds=blitz,rapid,classical`,
        fenBefore,
        san,
        fetchFn,
      );
      if (online < MIN_LICHESS_GAMES) break;
    }
    out.add(i);
  }
  // eslint-disable-next-line no-console -- diagnosis: book depth is user-visible
  console.info(`[stockthink] explorer book: first ${out.size} plies confirmed as theory`);
  return out;
}
