/**
 * V2 QUALITY GATE (design doc §Milestones #6): run the Opera Game and a
 * famous trap-riddled flawed game through the REAL pipeline (Stockfish 18
 * WASM), print every comment, and allow ZERO eval-speak sentences through.
 *
 * Run with: npx vitest run test/gate.e2e.test.ts
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { parseGame } from '@backend/analysis/pgn';
import { buildReport, type GameReport } from '@backend/analysis/report';
import { composeComment } from '@backend/compose/compose';
import { EnginePool } from '@backend/engine/pool';
import { ChildProcessTransport, setupEngineFiles } from './helpers/transport';

const OPERA_GAME = `[Event "Paris Opera"]
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7
14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`;

// Blackburne Shilling Gambit trap — blunders on both sides, ends in mate.
const FLAWED_GAME = `[Event "Blitz"]
[White "Club Player"]
[Black "Trapster"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Nd4 4. Nxe5 Qg5 5. Nxf7 Qxg2 6. Rf1 Qxe4+
7. Be2 Nf3# 0-1`;

/** R1: no eval-speak may reach prose. */
const EVAL_SPEAK =
  /%|centipawn|\bcp\b|\beval(uation)?\b|\bengine\b|stockfish|win(ning)? chance|accuracy|\d+\.\d+/i;
/** R2: three or more consecutive SAN tokens = a PV dump. */
const PV_DUMP = /(?:[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?\s+){3,}/;

let enginePath: string;
beforeAll(() => {
  enginePath = setupEngineFiles();
});

async function analyze(pgn: string): Promise<GameReport> {
  const game = parseGame(pgn);
  const pool = await EnginePool.create(() => new ChildProcessTransport(enginePath), 2, {
    multiPv: 3,
    hashMb: 32,
  });
  try {
    const analyses = await pool.analyzeAll(game.fens, { nodes: 60_000 });
    return buildReport(game, analyses);
  } finally {
    pool.dispose();
  }
}

function gateGame(name: string, report: GameReport): void {
  console.log(`\n======== ${name} ========`);
  let withFacts = 0;
  let nonBook = 0;
  for (const m of report.moves) {
    const c = composeComment(m);
    const moveNo = `${m.moveNumber}${m.color === 'white' ? '.' : '…'}`;
    console.log(`${moveNo} ${m.san} [${m.classification}] — ${c.text}`);
    if (c.more) console.log(`    more: ${c.more}`);
    // THE GATE
    expect(c.text, `eval-speak in: ${c.text}`).not.toMatch(EVAL_SPEAK);
    expect(c.text, `PV dump in: ${c.text}`).not.toMatch(PV_DUMP);
    if (c.more) expect(c.more, `eval-speak in more: ${c.more}`).not.toMatch(EVAL_SPEAK);
    if (m.classification !== 'book') {
      nonBook++;
      if (m.facts.length > 0) withFacts++;
    }
  }
  const coverage = withFacts / Math.max(1, nonBook);
  console.log(
    `coverage: ${withFacts}/${nonBook} non-book moves carry facts (${Math.round(coverage * 100)}%)`,
  );
  console.log(
    `accuracy: W ${report.players.white.accuracy} / B ${report.players.black.accuracy}`,
  );
}

describe('V2 quality gate (real engine)', () => {
  it(
    'Opera Game: zero eval-speak, mate found, sacrifices explained',
    async () => {
      const report = await analyze(OPERA_GAME);
      gateGame('Opera Game (Morphy)', report);
      const last = report.moves[report.moves.length - 1];
      expect(last.san).toBe('Rd8#');
      expect(last.facts[0]).toEqual({ kind: 'delivers_mate' });
      // Qb8+!! — the queen sacrifice must at least carry the sacrifice fact
      const qb8 = report.moves.find(m => m.san === 'Qb8+')!;
      expect(qb8.facts.some(f => f.kind === 'sacrifice')).toBe(true);
    },
    600_000,
  );

  it(
    'Flawed game: blunders called out with concrete causes',
    async () => {
      const report = await analyze(FLAWED_GAME);
      gateGame('Blackburne Shilling trap', report);
      const last = report.moves[report.moves.length - 1];
      expect(last.san).toBe('Nf3#');
      expect(last.facts[0]).toEqual({ kind: 'delivers_mate' });
      // 5. Nxf7?? must be classified as a serious error
      const nxf7 = report.moves.find(m => m.san === 'Nxf7')!;
      expect(['mistake', 'blunder', 'miss']).toContain(nxf7.classification);
    },
    600_000,
  );
});
