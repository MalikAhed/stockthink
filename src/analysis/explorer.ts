/**
 * Deep book detection via the lichess opening-explorer masters database
 * (free, keyless, CORS-open — fits the $0/client-side constraint).
 *
 * The baked EPD map (openings.ts) only knows *named* positions (~3.7k), so it
 * declares "out of book" several moves before real theory ends. Here a move
 * counts as book if masters (2200+ OTB games) actually played it from the
 * exact position. Walked front-to-back, stopping at the first non-book move —
 * book is a prefix property. Any network failure degrades silently to
 * whatever was confirmed so far (the EPD map still backstops names/classify).
 */

const EXPLORER_URL = 'https://explorer.lichess.ovh/masters';
/** Book never extends past this many plies (15 full moves — chess.com-like). */
const MAX_BOOK_PLIES = 30;
/** Minimum master games in which the played move occurred. */
const MIN_GAMES = 10;

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

/**
 * Indices of the leading plies that are master-book moves. Sequential
 * fetches, ≤1 per ply, stops at the first miss. Never throws.
 */
export async function masterBookPlies(
  plies: BookPly[],
  fetchFn: typeof fetch = fetch,
): Promise<Set<number>> {
  const out = new Set<number>();
  for (let i = 0; i < Math.min(plies.length, MAX_BOOK_PLIES); i++) {
    try {
      const res = await fetchFn(
        `${EXPLORER_URL}?fen=${encodeURIComponent(plies[i].fenBefore)}&moves=30&topGames=0&recentGames=0`,
      );
      if (!res.ok) return out;
      const data = (await res.json()) as { moves?: ExplorerMove[] };
      const mv = data.moves?.find(x => x.san === plies[i].san);
      const games = mv ? mv.white + mv.draws + mv.black : 0;
      if (games < MIN_GAMES) return out;
      out.add(i);
    } catch {
      return out; // offline / blocked / rate-limited → EPD fallback only
    }
  }
  return out;
}
