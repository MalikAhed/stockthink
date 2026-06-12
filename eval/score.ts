/**
 * THE TRUTH — explanation-quality eval v1.
 *
 * Runs the REAL pipeline (Stockfish 18 WASM under Node, exactly like the e2e
 * gate) over eval/positions.json and scores every comment on three rubric
 * dimensions, 0–2 each:
 *   CAUSAL   — names the concrete consequence, not just a verdict
 *   GROUNDED — the stated reason is the engine's reason, not merely true
 *   ECONOMY  — quiet when there is nothing to teach (NB: composeComment never
 *              returns empty text by design (R3); economy = one short line,
 *              zero false teaching — NOT emptiness)
 *
 * Determinism: pool size 1, cases scored sequentially in file order, fixed
 * node budgets, single-threaded WASM → identical output every run.
 *
 *   npm run eval                  score everything, write results + METRICS row
 *   npm run eval -- --dry         score + print, write nothing
 *   npm run eval -- --explain ID  one case, full facts/lines/checks, no writes
 *   npm run eval -- --tests N/M   record the suite pass rate in the METRICS row
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chessops/chess';
import { parseFen, makeFen } from 'chessops/fen';
import { parseUci } from 'chessops/util';
import { makeSan } from 'chessops/san';
import { ChildProcessTransport, setupEngineFiles } from '../test/helpers/transport';
import { EnginePool } from '../src/engine/pool';
import { buildMoveReport, type MoveReport } from '../src/analysis/report';
import { openingBook } from '../src/analysis/openings';
import { composeComment, BAD_KINDS, MISSED_KINDS, type Comment } from '../src/compose/compose';
import { renderFact, } from '../src/compose/templates';
import type { Ply } from '../src/analysis/pgn';
import type { FactKind } from '../src/concepts/facts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

type Dim = 'causal' | 'grounded' | 'economy';

interface EvalCase {
  id: string;
  name: string;
  source: string;
  fen: string;
  playedUci: string;
  category: 'bad-causal' | 'good-quiet' | 'trap-wrong-reason';
  dims: Dim[];
  expectClass?: string[];
  /** Outer = ALL of, inner = ANY of. Checked against detected fact kinds. */
  expectFacts?: string[][];
  /** The fact whose sentence LEADS the visible comment must be one of these. */
  leadFactIn?: string[];
  /** Outer = ALL of, inner = ANY of. Substrings checked in the VISIBLE text (R5). */
  mustMention?: string[][];
  /** Flat list of banned substrings (the tempting-but-wrong reason). */
  mustNotMention?: string[];
  notMentionScope?: 'text' | 'text+more';
  maxSentences?: number;
  realCause: string;
  nodes?: number;
}

interface TruthSet {
  version: number;
  defaults: { nodes: number; multiPv: number; hashMb: number };
  cases: EvalCase[];
}

const GOOD_SIDE = new Set(['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'forced']);

/** FEN + UCI → a synthetic Ply, exactly shaped like analysis/pgn.ts produces. */
function plyFromCase(c: EvalCase): Ply {
  const setup = parseFen(c.fen).unwrap();
  const pos = Chess.fromSetup(setup).unwrap();
  const move = parseUci(c.playedUci);
  if (!move || !pos.isLegal(move))
    throw new Error(`MIS-SPECIFIED CASE ${c.id}: move ${c.playedUci} is not legal in ${c.fen}`);
  const color = pos.turn;
  const san = makeSan(pos, move);
  const moveNumber = setup.fullmoves;
  const ply = (moveNumber - 1) * 2 + (color === 'white' ? 1 : 2);
  pos.play(move);
  return {
    ply,
    moveNumber,
    color,
    san,
    uci: c.playedUci,
    fenBefore: c.fen,
    fenAfter: makeFen(pos.toSetup()),
    epdAfter: makeFen(pos.toSetup(), { epd: true }),
  };
}

/** The fact whose rendered sentence appears EARLIEST in the visible text. */
function leadFactKind(m: MoveReport, text: string): FactKind | null {
  let bestKind: FactKind | null = null;
  let bestPos = Infinity;
  for (const f of m.facts) {
    const s = renderFact(f);
    if (!s) continue;
    const at = text.indexOf(s);
    if (at >= 0 && at < bestPos) {
      bestPos = at;
      bestKind = f.kind;
    }
  }
  return bestKind;
}

interface Checks {
  mentionsOk: boolean;
  factsOk: boolean;
  leadOk: boolean;
  forbiddenHits: string[];
  classOk: boolean;
  sentences: number;
  maxSentences: number;
  falseAlarm: boolean;
}

interface CaseResult {
  id: string;
  category: EvalCase['category'];
  dims: Dim[];
  classification: string;
  leadKind: string | null;
  factKinds: string[];
  text: string;
  more: string | null;
  checks: Checks;
  scores: Partial<Record<Dim, number>>;
}

function scoreCase(c: EvalCase, m: MoveReport, comment: Comment): CaseResult {
  const kinds = m.facts.map(f => f.kind);
  const leadKind = leadFactKind(m, comment.text);
  const textL = comment.text.toLowerCase();
  const fullL = `${comment.text} ${comment.more ?? ''}`.toLowerCase();

  const mentionsOk = (c.mustMention ?? []).every(group =>
    group.some(s => textL.includes(s.toLowerCase())),
  );
  const factsOk = (c.expectFacts ?? []).every(group => group.some(k => kinds.includes(k as FactKind)));
  const leadOk = !c.leadFactIn || (leadKind !== null && c.leadFactIn.includes(leadKind));
  const scope = c.notMentionScope === 'text+more' ? fullL : textL;
  const forbiddenHits = (c.mustNotMention ?? []).filter(s => scope.includes(s.toLowerCase()));
  const classOk = !c.expectClass || c.expectClass.includes(m.classification);
  const sentences = comment.text.split(/[.!?](?:\s|$)/).filter(s => s.trim().length > 0).length;
  const maxSentences = c.maxSentences ?? (c.category === 'good-quiet' ? 2 : 3);
  // complaining (bad/missed lead) about a move the classifier itself calls
  // good = teaching that isn't there. Regression leads count as complaints.
  const falseAlarm =
    GOOD_SIDE.has(m.classification) &&
    leadKind !== null &&
    (BAD_KINDS.includes(leadKind) || MISSED_KINDS.includes(leadKind) || leadKind === 'regression');

  const scores: Partial<Record<Dim, number>> = {};
  for (const dim of c.dims) {
    if (dim === 'causal')
      scores.causal = mentionsOk && factsOk && leadOk ? 2 : mentionsOk || (factsOk && leadOk) ? 1 : 0;
    if (dim === 'grounded')
      scores.grounded = forbiddenHits.length > 0 || !classOk ? 0 : factsOk && leadOk ? 2 : 1;
    if (dim === 'economy')
      scores.economy = falseAlarm ? 0 : sentences <= maxSentences ? 2 : sentences <= maxSentences + 1 ? 1 : 0;
  }

  return {
    id: c.id,
    category: c.category,
    dims: c.dims,
    classification: m.classification,
    leadKind,
    factKinds: kinds,
    text: comment.text,
    more: comment.more,
    checks: { mentionsOk, factsOk, leadOk, forbiddenHits, classOk, sentences, maxSentences, falseAlarm },
    scores,
  };
}

function countSrcLoc(): number {
  let total = 0;
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.ts')) total += readFileSync(p, 'utf8').split('\n').length;
    }
  };
  walk(join(ROOT, 'src'));
  return total;
}

function recallAvg(): string {
  try {
    const entries = JSON.parse(readFileSync(join(ROOT, 'improve/metrics.json'), 'utf8'));
    const recall = entries[entries.length - 1]?.recall ?? {};
    const vals = Object.values(recall) as number[];
    if (!vals.length) return '—';
    return `${((vals.reduce((a, b) => a + b, 0) / vals.length) * 100).toFixed(1)}%`;
  } catch {
    return '—';
  }
}

const pct = (pts: number, max: number): string => (max ? `${((pts / max) * 100).toFixed(1)}%` : '—');

function aggregate(results: CaseResult[]): Record<string, { pts: number; max: number; pct: string }> {
  const dims: Dim[] = ['causal', 'grounded', 'economy'];
  const out: Record<string, { pts: number; max: number; pct: string }> = {};
  let allPts = 0;
  let allMax = 0;
  for (const dim of dims) {
    const carrying = results.filter(r => r.dims.includes(dim));
    const pts = carrying.reduce((a, r) => a + (r.scores[dim] ?? 0), 0);
    const max = carrying.length * 2;
    out[dim] = { pts, max, pct: pct(pts, max) };
    allPts += pts;
    allMax += max;
  }
  out.total = { pts: allPts, max: allMax, pct: pct(allPts, allMax) };
  return out;
}

function writeMetricsRow(totals: ReturnType<typeof aggregate>, nCases: number, tests: string): void {
  const path = join(ROOT, 'docs/METRICS.md');
  let md: string;
  try {
    md = readFileSync(path, 'utf8');
  } catch {
    console.log('docs/METRICS.md not found — skipping history row (results JSON still written).');
    return;
  }
  const marker = '<!-- eval-history -->';
  if (!md.includes(marker)) {
    console.log('METRICS.md has no eval-history marker — skipping history row.');
    return;
  }
  const date = new Date().toISOString().slice(0, 10);
  const row = `| ${date} | ${totals.causal.pct} | ${totals.grounded.pct} | ${totals.economy.pct} | ${totals.total.pct} | ${nCases} | ${tests} | ${recallAvg()} | ${countSrcLoc()} |`;
  writeFileSync(path, md.replace(marker, `${marker}\n${row}`));
  console.log(`METRICS.md ← ${row}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const explainId = args.includes('--explain') ? args[args.indexOf('--explain') + 1] : null;
  const tests = args.includes('--tests') ? args[args.indexOf('--tests') + 1] : '—';

  const truth: TruthSet = JSON.parse(readFileSync(join(ROOT, 'eval/positions.json'), 'utf8'));
  const cases = explainId ? truth.cases.filter(c => c.id === explainId) : truth.cases;
  if (explainId && cases.length === 0) throw new Error(`no case with id ${explainId}`);

  const started = Date.now();
  const enginePath = setupEngineFiles();
  const pool = await EnginePool.create(() => new ChildProcessTransport(enginePath), 1, {
    multiPv: truth.defaults.multiPv,
    hashMb: truth.defaults.hashMb,
  });
  const book = openingBook();

  const results: CaseResult[] = [];
  try {
    for (const c of cases) {
      const ply = plyFromCase(c);
      const nodes = c.nodes ?? truth.defaults.nodes;
      const [before, after] = await pool.analyzeAll([ply.fenBefore, ply.fenAfter], { nodes });
      const m = buildMoveReport(ply, before, after, book, false);
      const comment = composeComment(m);
      const r = scoreCase(c, m, comment);
      results.push(r);

      const s = c.dims.map(d => `${d[0].toUpperCase()}${r.scores[d]}`).join(' ');
      console.log(`${r.id.padEnd(22)} [${m.classification}] ${s}  — ${comment.text}`);
      if (explainId) {
        console.log(`\nname:      ${c.name}`);
        console.log(`realCause: ${c.realCause}`);
        console.log(`played:    ${ply.san} (${ply.uci})  best: ${m.bestSan} (${m.bestUci})`);
        console.log(`facts:     ${JSON.stringify(m.facts, null, 1)}`);
        console.log(`lead:      ${r.leadKind}`);
        console.log(`more:      ${comment.more}`);
        console.log(`checks:    ${JSON.stringify(r.checks)}`);
        console.log('engine lines:');
        for (const line of m.lines)
          console.log(
            `  ${line.eval.mate !== undefined ? `#${line.eval.mate}` : line.eval.cp} ${line.sanPv.join(' ')}`,
          );
      }
    }
  } finally {
    pool.dispose();
  }

  if (explainId) return;

  const totals = aggregate(results);
  const runtime = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `\nCAUSAL ${totals.causal.pct} (${totals.causal.pts}/${totals.causal.max}) · ` +
      `GROUNDED ${totals.grounded.pct} (${totals.grounded.pts}/${totals.grounded.max}) · ` +
      `ECONOMY ${totals.economy.pct} (${totals.economy.pts}/${totals.economy.max}) · ` +
      `TOTAL ${totals.total.pct} (${totals.total.pts}/${totals.total.max}) · ` +
      `${results.length} cases in ${runtime}s`,
  );

  if (dry) return;
  mkdirSync(join(ROOT, 'eval/results'), { recursive: true });
  const payload = {
    date: new Date().toISOString().slice(0, 10),
    defaults: truth.defaults,
    totals,
    cases: results,
  };
  writeFileSync(join(ROOT, 'eval/results/latest.json'), `${JSON.stringify(payload, null, 2)}\n`);
  console.log('eval/results/latest.json written.');
  writeMetricsRow(totals, results.length, tests);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
