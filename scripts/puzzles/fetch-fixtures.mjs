#!/usr/bin/env node
// Build per-theme puzzle fixtures from the lichess puzzle DB (CC0).
// Source: https://huggingface.co/datasets/Lichess/chess-puzzles via the
// datasets-server /filter API (no deps, no full-DB download).
//
// Usage: node scripts/puzzles/fetch-fixtures.mjs [theme ...]
// Output: test/fixtures/puzzles/<theme>.csv  (deterministic, capped)
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
const OUT_DIR = join(ROOT, 'test', 'fixtures', 'puzzles');
const API = 'https://datasets-server.huggingface.co/filter';
const DATASET = 'Lichess/chess-puzzles';

const DEFAULT_THEMES = [
  'fork', 'pin', 'skewer', 'discoveredAttack', 'hangingPiece',
  'trappedPiece', 'mateIn1', 'mateIn2', 'backRankMate', 'sacrifice',
];
const PER_THEME = 200;       // cap per fixture file
const MIN_POPULARITY = 90;   // crowd-validated puzzles only
const MAX_RD = 80;           // stable rating
const PAGE = 100;            // datasets-server max rows per request

async function fetchTheme(theme) {
  const rows = [];
  for (let offset = 0; rows.length < PER_THEME && offset < 1000; offset += PAGE) {
    const where = encodeURIComponent(
      `"Themes" LIKE '%${theme}%' AND "Popularity" >= ${MIN_POPULARITY} AND "RatingDeviation" <= ${MAX_RD}`
    );
    const orderby = encodeURIComponent('"NbPlays" DESC, "PuzzleId" ASC');
    const url = `${API}?dataset=${DATASET}&config=default&split=train&where=${where}&orderby=${orderby}&offset=${offset}&length=${PAGE}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${theme}: HTTP ${res.status} — ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const batch = (data.rows ?? []).map(r => r.row);
    if (batch.length === 0) break;
    for (const r of batch) {
      // Guard against substring matches (e.g. 'pin' inside another tag).
      const themes = String(r.Themes ?? '').split(/\s+/);
      if (!themes.includes(theme)) continue;
      rows.push(r);
      if (rows.length >= PER_THEME) break;
    }
  }
  return rows;
}

const esc = v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);

async function main() {
  const themes = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_THEMES;
  await mkdir(OUT_DIR, { recursive: true });
  for (const theme of themes) {
    process.stdout.write(`${theme}... `);
    const rows = await fetchTheme(theme);
    const csv = ['PuzzleId,FEN,Moves,Rating,Themes',
      ...rows.map(r => [r.PuzzleId, r.FEN, r.Moves, r.Rating, r.Themes].map(esc).join(',')),
    ].join('\n') + '\n';
    await writeFile(join(OUT_DIR, `${theme}.csv`), csv);
    console.log(`${rows.length} puzzles`);
    if (rows.length < 100) console.warn(`  WARNING: ${theme} below 100 rows — loosen filters or check API`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
