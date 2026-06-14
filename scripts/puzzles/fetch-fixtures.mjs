#!/usr/bin/env node
// Build per-theme puzzle fixtures from the lichess puzzle DB (CC0).
// Source: https://huggingface.co/datasets/Lichess/chess-puzzles via the
// datasets-server /rows API (no deps, no full-DB download, no FTS index —
// the /filter endpoint's index takes hours to build and 422s while it does).
//
// Strategy: one sequential scan of the dataset in stable row order,
// filtering client-side until every theme bucket is full. Deterministic for
// a given dataset revision.
//
// Usage: node scripts/puzzles/fetch-fixtures.mjs [theme ...]
// Output: self-improvement/test/fixtures/puzzles/<theme>.csv  (deterministic, capped)
//
// CSV columns: PuzzleId,FEN,Moves,Rating,Themes
// NOTE on semantics: FEN is the position BEFORE the opponent's setup move.
// Moves is space-separated UCI; Moves[0] is the OPPONENT's move — the tactic
// (what our detectors must fire on) is Moves[1] played from the position after
// Moves[0]. The recall harness must apply Moves[0] first.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = join(ROOT, 'self-improvement', 'test', 'fixtures', 'puzzles');
const API = 'https://datasets-server.huggingface.co/rows';
const DATASET = 'Lichess/chess-puzzles';

const DEFAULT_THEMES = [
  'fork', 'pin', 'skewer', 'discoveredAttack', 'hangingPiece',
  'trappedPiece', 'mateIn1', 'mateIn2', 'backRankMate', 'sacrifice',
];
const PER_THEME = 200;       // cap per fixture file
const MIN_POPULARITY = 90;   // crowd-validated puzzles only
const MAX_RD = 80;           // stable rating
const PAGE = 100;            // datasets-server max rows per request
const MAX_ROWS = 500_000;    // scan cap — rare themes may end short of 200

async function fetchPage(offset, tries = 10) {
  const url = `${API}?dataset=${DATASET}&config=default&split=train&offset=${offset}&length=${PAGE}`;
  for (let i = 0; i < tries; i++) {
    let res;
    try {
      res = await fetch(url);
    } catch {
      await new Promise(r => setTimeout(r, 3000));
      continue;
    }
    if (res.ok) {
      const body = await res.text();
      try {
        return JSON.parse(body).rows?.map(r => r.row) ?? [];
      } catch {
        // HTML error page behind a 200 (rate-limit edge) — treat as retryable
        await new Promise(r => setTimeout(r, 5000 * (i + 1)));
        continue;
      }
    }
    if (res.status === 429 || res.status >= 500) {
      await new Promise(r => setTimeout(r, 5000 * (i + 1)));
      continue;
    }
    throw new Error(`offset ${offset}: HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`);
  }
  throw new Error(`offset ${offset}: gave up after ${tries} retries`);
}

const esc = v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);

async function main() {
  const themes = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_THEMES;
  await mkdir(OUT_DIR, { recursive: true });
  const buckets = new Map(themes.map(t => [t, []]));

  let offset = 0;
  for (; offset < MAX_ROWS; offset += PAGE) {
    const batch = await fetchPage(offset);
    if (batch.length === 0) break; // end of dataset
    for (const r of batch) {
      if (r.Popularity < MIN_POPULARITY || r.RatingDeviation > MAX_RD) continue;
      // Themes arrives as an array from /rows; normalize (exact tag match).
      const tags = Array.isArray(r.Themes) ? r.Themes : String(r.Themes ?? '').split(/\s+/);
      for (const t of themes) {
        const b = buckets.get(t);
        if (b.length < PER_THEME && tags.includes(t)) b.push(r);
      }
    }
    const filled = [...buckets.values()].filter(b => b.length >= PER_THEME).length;
    if (offset % 10_000 === 0)
      console.log(`scanned ${offset + PAGE} rows — ${filled}/${themes.length} buckets full`);
    if (filled === themes.length) break;
  }

  for (const [theme, rows] of buckets) {
    const csv = ['PuzzleId,FEN,Moves,Rating,Themes',
      ...rows.map(r => [
        r.PuzzleId, r.FEN, r.Moves, r.Rating,
        Array.isArray(r.Themes) ? r.Themes.join(' ') : r.Themes, // lichess CSV format: space-separated
      ].map(esc).join(',')),
    ].join('\n') + '\n';
    await writeFile(join(OUT_DIR, `${theme}.csv`), csv);
    console.log(`${theme}: ${rows.length} puzzles`);
    if (rows.length < 100) console.warn(`  WARNING: ${theme} below 100 rows after scanning ${offset} rows`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
