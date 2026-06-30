/**
 * CASE-VETTING PROBE — run the REAL pipeline on candidate FEN + move pairs BEFORE
 * they go into positions.json. Authoring eval cases by hand has burned us: crafted
 * FENs that don't tell the story they look like (see self-improvement/docs/LESSONS.md).
 * This is the antidote — it prints exactly what the engine + detectors + composer
 * make of a position, so a candidate is VERIFIED, not assumed.
 *
 *   npx vite-node self-improvement/eval/probe.ts -- "<fen>" <uci> ["<fen2>" <uci2> ...]
 *
 * One engine startup scores every pair. For each it reports: legality, SAN,
 * classification, winDrop, evals, what the comment LEADS with, the composed
 * comment, every fact in priority order, and the engine PVs (best + reply).
 *
 * Use it to confirm a fake-reason candidate — a GOOD move (low winDrop, good-tier
 * class) whose coincidental pin/fork/develops fact LEADS the comment while the
 * engine's real reason (its PV) is elsewhere.
 */
import { Chess } from 'chessops/chess';
import { parseFen, makeFen } from 'chessops/fen';
import { parseUci } from 'chessops/util';
import { makeSan } from 'chessops/san';
import { ChildProcessTransport, setupEngineFiles } from '../test/helpers/transport';
import { EnginePool } from '@backend/engine/pool';
import { buildMoveReport } from '@backend/analysis/report';
import { openingBook } from '@backend/analysis/openings';
import { composeComment } from '@backend/compose/compose';
import { renderFact } from '@backend/compose/templates';
import type { EvalScore } from '@backend/analysis/winprob';
import type { Ply } from '@backend/analysis/pgn';

const fmtEval = (ev: EvalScore): string => (ev.mate !== undefined ? `#${ev.mate}` : `${ev.cp}cp`);

function sanLine(fen: string, pvUci: string[], n = 8): string {
  const pos = Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
  const out: string[] = [];
  for (const u of pvUci.slice(0, n)) {
    const mv = parseUci(u);
    if (!mv || !pos.isLegal(mv)) break;
    out.push(makeSan(pos, mv));
    pos.play(mv);
  }
  return out.join(' ');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length < 2 || args.length % 2 !== 0)
    throw new Error('usage: probe.ts -- "<fen>" <uci> ["<fen2>" <uci2> ...]');
  const pairs: { fen: string; uci: string }[] = [];
  for (let i = 0; i < args.length; i += 2) pairs.push({ fen: args[i], uci: args[i + 1] });

  const enginePath = setupEngineFiles();
  const pool = await EnginePool.create(() => new ChildProcessTransport(enginePath), 1, { multiPv: 3, hashMb: 32 });
  const book = openingBook();
  try {
    for (const { fen, uci } of pairs) {
      const setup = parseFen(fen).unwrap();
      const pos = Chess.fromSetup(setup).unwrap();
      const move = parseUci(uci);
      if (!move || !pos.isLegal(move)) {
        console.log(`\n=== ${uci} in ${fen}\nILLEGAL MOVE — skipped`);
        continue;
      }
      const color = pos.turn;
      const san = makeSan(pos, move);
      const moveNumber = setup.fullmoves;
      const ply = (moveNumber - 1) * 2 + (color === 'white' ? 1 : 2);
      pos.play(move);
      const plyObj: Ply = {
        ply, moveNumber, color, san, uci,
        fenBefore: fen,
        fenAfter: makeFen(pos.toSetup()),
        epdAfter: makeFen(pos.toSetup(), { epd: true }),
      };

      const [before, after] = await pool.analyzeAll([plyObj.fenBefore, plyObj.fenAfter], { nodes: 60000 });
      const m = buildMoveReport(plyObj, before, after, book, false);
      const comment = composeComment(m);

      let lead: string | null = null, leadPos = Infinity;
      for (const f of m.facts) {
        const s = renderFact(f);
        if (!s) continue;
        const at = comment.text.indexOf(s);
        if (at >= 0 && at < leadPos) { leadPos = at; lead = f.kind; }
      }

      console.log(`\n=== ${san} (${uci})  [${m.classification}]  winDrop ${m.winDrop.toFixed(1)}  wasBest=${m.wasBest}`);
      console.log(`eval ${fmtEval(m.evalBefore)} → ${fmtEval(m.evalAfter)} · best ${m.bestSan ?? '—'}`);
      console.log(`LEAD fact: ${lead ?? '(none — neutral/badge)'}`);
      console.log(`comment:   ${comment.text}`);
      if (comment.more) console.log(`more:      ${comment.more}`);
      console.log(`facts (priority order): ${m.facts.length ? '' : '(none)'}`);
      for (const f of m.facts) console.log(`  ${f.kind.padEnd(16)} ${JSON.stringify(f)}`);
      console.log(`best line:   ${fmtEval(m.lines[0]?.eval ?? m.evalBefore)}  ${m.lines[0]?.sanPv.join(' ') ?? '—'}`);
      if (m.lines[1]) console.log(`2nd line:    ${fmtEval(m.lines[1].eval)}  ${m.lines[1].sanPv.join(' ')}`);
      console.log(`reply (after): ${after?.lines?.[0] ? sanLine(plyObj.fenAfter, after.lines[0].pvUci) : '—'}`);
    }
  } finally {
    pool.dispose();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
