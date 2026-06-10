import { describe, expect, it } from 'vitest';
import type { AnnotatedMove, AnnotatedReport } from '../src/analyze';
import type { Classification } from '../src/analysis/classify';
import {
  applyImportedCommentary,
  buildLlmPrompt,
  COMMENTARY_VERSION,
  parseImportedCommentary,
} from '../src/llm/exchange';
import { buildFactSheet, FACTS_VERSION } from '../src/llm/factsheet';
import { verifyCommentText } from '../src/llm/verify';

const counts = () =>
  Object.fromEntries(
    [
      'brilliant', 'great', 'best', 'excellent', 'good', 'book',
      'forced', 'inaccuracy', 'mistake', 'miss', 'blunder',
    ].map(k => [k, 0]),
  ) as Record<Classification, number>;

const move = (over: Partial<AnnotatedMove>): AnnotatedMove => ({
  ply: 1,
  moveNumber: 1,
  color: 'white',
  san: 'e4',
  uci: 'e2e4',
  fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
  epdAfter: '',
  classification: 'best',
  epLoss: 0,
  winDrop: 0,
  accuracy: 100,
  evalBefore: { cp: 20 },
  evalAfter: { cp: 25 },
  winPercentAfter: 51,
  bestUci: 'e2e4',
  wasBest: true,
  bestSan: 'e4',
  lines: [],
  volatile: false,
  facts: null,
  commentary: { short: 'Best play.', long: 'Best play. After this, White is slightly better.' },
  ...over,
});

const report = (moves: AnnotatedMove[]): AnnotatedReport => ({
  headers: { White: 'Alice', Black: 'Bob', Result: '1-0' },
  moves,
  players: {
    white: { accuracy: 91.2, acpl: 18, estimatedElo: 2100, counts: counts() },
    black: { accuracy: 74.5, acpl: 55, estimatedElo: 1700, counts: counts() },
  },
  initialFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
});

const blunderMove = (): AnnotatedMove =>
  move({
    ply: 2,
    color: 'black',
    san: 'Qg5',
    uci: 'd8g5',
    classification: 'blunder',
    winDrop: 31.4,
    wasBest: false,
    bestSan: 'Nf6',
    explain: {
      primary: {
        kind: 'loses_material',
        victim: { role: 'queen', square: 'g5' },
        reason: 'undefended',
        value: 9,
        immediate: true,
        captureSan: 'Bxg5',
        line: ['Bxg5'],
      },
      betterWas: null,
    } as AnnotatedMove['explain'],
    commentary: {
      short: 'This hangs your queen on g5 — Bxg5 simply wins it. Nf6 was best.',
      long: 'This hangs your queen on g5 — Bxg5 simply wins it. Nf6 was best.',
    },
  });

describe('fact sheet', () => {
  it('serializes the verified analysis, never raw positions to analyze', () => {
    const sheet = buildFactSheet(report([move({}), blunderMove()]));
    expect(sheet.version).toBe(FACTS_VERSION);
    expect(sheet.white.name).toBe('Alice');
    expect(sheet.moves).toHaveLength(2);
    expect(sheet.moves[1].classification).toBe('blunder');
    expect(sheet.moves[1].primaryFact?.kind).toBe('loses_material');
    expect(sheet.moves[1].templateShort).toContain('queen on g5');
    // the prompt asks for rewording only and carries the schema version
    const prompt = buildLlmPrompt(sheet);
    expect(prompt).toContain('REWORDER');
    expect(prompt).toContain(COMMENTARY_VERSION);
    expect(prompt).toContain('"version": "stockthink-facts-1"');
  });
});

describe('fact-check verifier', () => {
  const sheetMove = () => buildFactSheet(report([blunderMove()])).moves[0];

  it('accepts text that only uses verified squares', () => {
    expect(
      verifyCommentText('Dropping the queen on g5 — after Bxg5 it is simply gone.', sheetMove()),
    ).toBe(true);
  });

  it('rejects hallucinated squares', () => {
    expect(verifyCommentText('This weakens the d4 outpost badly.', sheetMove())).toBe(false);
  });

  it('rejects hallucinated mate claims', () => {
    expect(verifyCommentText('It even allows mate in 3 here.', sheetMove())).toBe(false);
  });
});

describe('import round-trip', () => {
  it('parses a fenced JSON reply', () => {
    const parsed = parseImportedCommentary(
      'Sure! Here you go:\n```json\n{"version":"x","moves":[{"ply":1,"short":"Nice."}]}\n```\nHope it helps!',
    );
    expect(parsed.moves[0].ply).toBe(1);
  });

  it('rejects garbage with a readable error', () => {
    expect(() => parseImportedCommentary('not json at all')).toThrow(/JSON/);
  });

  it('applies verified comments and keeps templates for hallucinations', () => {
    const r = report([move({}), blunderMove()]);
    const sheet = buildFactSheet(r);
    const res = applyImportedCommentary(r, sheet, {
      moves: [
        { ply: 1, short: 'A strong, principled start.' },
        { ply: 2, short: 'A disaster — it loses the rook on a8 immediately.' }, // a8 not in facts
        { ply: 99, short: 'No such move.' },
      ],
    });
    expect(res.applied).toBe(1);
    expect(res.rejected).toEqual([2]);
    expect(res.unknown).toEqual([99]);
    expect(r.moves[0].commentary.short).toBe('A strong, principled start.');
    expect(r.moves[1].commentary.short).toContain('queen on g5'); // template kept
  });
});
