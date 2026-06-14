/**
 * Recall harness (I2): replay lichess puzzle fixtures and measure how often
 * the mapped detector fires on the tactic move.
 *
 * Fixture semantics (see self-improvement/scripts/puzzles/fetch-fixtures.mjs): `FEN` is the
 * position BEFORE the opponent's setup move; `Moves[0]` is that setup move;
 * the tactic our detectors must fire on is `Moves[1]`.
 *
 * This harness MEASURES recall and persists it to improve/metrics.json; the
 * assertions only enforce a per-theme floor (ratcheted up as detectors
 * improve) so a regression fails the suite without demanding perfection.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { Chess } from 'chessops/chess';
import { parseFen } from 'chessops/fen';
import { parseUci } from 'chessops/util';
import type { NormalMove } from 'chessops/types';
import {
  capturesFreePiece,
  createsFork,
  isSacrifice,
  trapsPieces,
} from '@backend/concepts/detectors';
import {
  discoveredAttacks,
  isSkewer,
  pinnedDefenderInfo,
  pinsCreatedEx,
  pinsHeld,
} from '@backend/concepts/primitives';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = join(ROOT, 'test', 'fixtures', 'puzzles');
const METRICS_PATH = join(ROOT, 'improve', 'metrics.json');

interface Puzzle {
  id: string;
  fen: string;
  moves: string[];
}

/** Minimal CSV parse — our writer only quotes fields containing , " or \n. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

function loadTheme(theme: string): Puzzle[] {
  const path = join(FIXTURE_DIR, `${theme}.csv`);
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, 'utf8').trim().split('\n').slice(1);
  return lines.map(l => {
    const [id, fen, moves] = parseCsvLine(l);
    return { id, fen, moves: moves.split(' ') };
  });
}

/** Detector predicate for a theme: position before the tactic, the tactic
 *  move, and the opponent's setup move (skewers need it). */
type Detector = (before: Chess, tactic: NormalMove, setup: NormalMove) => boolean;

const DETECTORS: Record<string, Detector> = {
  fork: (b, m) => createsFork(b, m).length > 0,
  // The tactic either creates a pin or exploits one: captures a pinned piece,
  // or wins material because the victim's defender is pinned.
  pin: (b, m) =>
    pinsCreatedEx(b, m).length > 0 ||
    pinsHeld(b.board, b.turn).some(p => p.pinned === m.to) ||
    (b.board.get(m.to) !== undefined && pinnedDefenderInfo(b.board, m.to) !== null),
  skewer: (b, m, setup) => isSkewer(b, m, setup),
  discoveredAttack: (b, m) => discoveredAttacks(b, m).length > 0,
  hangingPiece: (b, m) => capturesFreePiece(b, m),
  trappedPiece: (b, m) => trapsPieces(b, m).length > 0,
  mateIn1: (b, m) => {
    const a = b.clone();
    a.play(m);
    return a.isCheckmate();
  },
  sacrifice: (b, m) => isSacrifice(b, m),
};

/** Minimum acceptable recall per theme — ratchet UP as detectors improve.
 *  A theme absent here is measured but not enforced. */
const FLOORS: Record<string, number> = {
  fork: 0.95,
  pin: 0.75,
  skewer: 0.95,
  discoveredAttack: 0.9,
  hangingPiece: 0.95,
  trappedPiece: 0.95,
  mateIn1: 0.95,
  sacrifice: 0.8,
};

interface ThemeResult {
  theme: string;
  total: number;
  fired: number;
  recall: number;
  missedSample: string[];
}

const results: ThemeResult[] = [];

const themes = existsSync(FIXTURE_DIR)
  ? readdirSync(FIXTURE_DIR).filter(f => f.endsWith('.csv')).map(f => f.replace('.csv', ''))
  : [];

describe('puzzle recall', () => {
  it.skipIf(themes.length > 0)('fixtures missing — run self-improvement/scripts/puzzles/fetch-fixtures.mjs', () => {});

  for (const theme of themes) {
    const det = DETECTORS[theme];
    if (!det) continue; // fetched but unmapped (e.g. mateIn2, backRankMate)
    it(`measures ${theme}`, () => {
      const puzzles = loadTheme(theme);
      expect(puzzles.length).toBeGreaterThan(0);
      let fired = 0;
      const missed: string[] = [];
      let total = 0;
      for (const p of puzzles) {
        const setupRes = parseFen(p.fen);
        if (setupRes.isErr) continue;
        const posRes = Chess.fromSetup(setupRes.unwrap());
        if (posRes.isErr) continue;
        const pos = posRes.unwrap();
        const moves = p.moves.map(u => parseUci(u) as NormalMove | undefined);
        if (moves.some(m => !m)) continue;
        total++;
        // Lichess themes describe the whole solution line: credit the theme
        // if the detector fires on ANY of our moves (odd plies; even plies
        // are the opponent's setup/replies).
        let hit = false;
        for (let i = 0; i + 1 < moves.length; i += 2) {
          pos.play(moves[i]!); // opponent's move
          if (det(pos, moves[i + 1]!, moves[i]!)) { hit = true; break; }
          pos.play(moves[i + 1]!); // our move, continue down the line
        }
        if (hit) fired++;
        else if (missed.length < 10) missed.push(p.id);
      }
      const recall = total ? fired / total : 0;
      results.push({ theme, total, fired, recall: Math.round(recall * 1000) / 1000, missedSample: missed });
      // eslint-disable-next-line no-console
      console.log(`recall ${theme}: ${fired}/${total} = ${(recall * 100).toFixed(1)}%  missed: ${missed.join(' ')}`);
      if (FLOORS[theme] !== undefined) expect(recall).toBeGreaterThanOrEqual(FLOORS[theme]);
    });
  }

  it.skipIf(themes.length === 0)('persists metrics', () => {
    const history: unknown[] = existsSync(METRICS_PATH)
      ? JSON.parse(readFileSync(METRICS_PATH, 'utf8'))
      : [];
    history.push({
      date: new Date().toISOString().slice(0, 10),
      recall: Object.fromEntries(results.map(r => [r.theme, r.recall])),
      missed: Object.fromEntries(results.filter(r => r.missedSample.length).map(r => [r.theme, r.missedSample])),
    });
    writeFileSync(METRICS_PATH, JSON.stringify(history, null, 2) + '\n');
  });
});
