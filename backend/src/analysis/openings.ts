/**
 * Opening book: lichess-org/chess-openings (CC0), baked to an EPD-keyed map
 * by scripts/build-openings.mjs. EPD matching is transposition-safe.
 */
import rawOpenings from './openings.json';

export interface OpeningInfo {
  eco: string;
  name: string;
}

let cache: Map<string, OpeningInfo> | undefined;

/** EPD → opening map (built once, ~3.7k entries). */
export function openingBook(): Map<string, OpeningInfo> {
  if (!cache) {
    cache = new Map();
    const entries = rawOpenings as unknown as Record<string, [string, string]>;
    for (const [epd, [eco, name]] of Object.entries(entries))
      cache.set(epd, { eco, name });
  }
  return cache;
}
