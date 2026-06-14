/**
 * One-time build step: fetch the lichess-org/chess-openings TSVs (CC0) and
 * bake src/analysis/openings.json — a { epd: [eco, name] } map for Book
 * detection (EPD matching is transposition-safe).
 *
 * Run: node scripts/build-openings.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chessops/chess';
import { makeFen } from 'chessops/fen';
import { parseSan } from 'chessops/san';

const BASE = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master';
const FILES = ['a.tsv', 'b.tsv', 'c.tsv', 'd.tsv', 'e.tsv'];

const out = {};
let total = 0;

for (const file of FILES) {
  const res = await fetch(`${BASE}/${file}`);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  const lines = (await res.text()).trim().split('\n').slice(1); // drop header
  for (const line of lines) {
    const [eco, name, pgn] = line.split('\t');
    if (!eco || !name || !pgn) continue;
    const pos = Chess.default();
    let ok = true;
    for (const token of pgn.split(/\s+/)) {
      if (/^\d+\.$/.test(token) || token === '') continue;
      const move = parseSan(pos, token);
      if (!move) {
        ok = false;
        break;
      }
      pos.play(move);
    }
    if (!ok) {
      console.warn(`skipped (bad SAN): ${eco} ${name}`);
      continue;
    }
    const epd = makeFen(pos.toSetup(), { epd: true });
    out[epd] = [eco, name];
    total++;
  }
  console.log(`${file}: done (${total} cumulative)`);
}

const dest = join(dirname(fileURLToPath(import.meta.url)), '../backend/src/analysis/openings.json');
writeFileSync(dest, JSON.stringify(out));
console.log(`wrote ${total} openings to ${dest}`);
