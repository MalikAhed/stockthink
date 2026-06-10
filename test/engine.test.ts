/**
 * Integration tests: drive the REAL Stockfish 18 Lite WASM binary through our
 * UCI protocol layer, using a Node child-process transport in place of the
 * browser Worker (same engine file, same line protocol).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Engine, parseInfo } from '../src/engine/engine';
import { EnginePool } from '../src/engine/pool';
import { ChildProcessTransport, setupEngineFiles } from './helpers/transport';

let enginePath: string;
beforeAll(() => {
  enginePath = setupEngineFiles();
});

describe('parseInfo', () => {
  const raw =
    'info depth 12 seldepth 20 multipv 2 score cp -9 nodes 177263 nps 135833 time 1305 pv c6b4 c2c3';
  it('parses depth, multipv, score, pv', () => {
    const line = parseInfo(raw, 'white')!;
    expect(line).toMatchObject({ multipv: 2, depth: 12, eval: { cp: -9 } });
    expect(line.pvUci).toEqual(['c6b4', 'c2c3']);
  });
  it('negates score for black to move (white POV)', () => {
    expect(parseInfo(raw, 'black')!.eval).toEqual({ cp: 9 });
  });
  it('skips mate 0 and bound-only mainlines', () => {
    expect(parseInfo('info depth 5 score mate 0 pv e2e4', 'white')).toBeNull();
    expect(parseInfo('info depth 9 multipv 1 score cp 30 lowerbound pv e2e4', 'white')).toBeNull();
  });
});

describe('Engine (real Stockfish 18 WASM)', () => {
  let engine: Engine;
  beforeAll(async () => {
    engine = new Engine(new ChildProcessTransport(enginePath), { multiPv: 2, hashMb: 32 });
    await engine.init();
  }, 60_000);
  afterAll(() => engine.dispose());

  it('analyzes the start position with two lines, near-equal eval', async () => {
    const a = await engine.analyze(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      { depth: 10 },
    );
    expect(a.terminal).toBe(false);
    expect(a.lines.length).toBe(2);
    expect(a.bestmoveUci).toMatch(/^[a-h][1-8][a-h][1-8]$/);
    expect(Math.abs(a.lines[0].eval.cp ?? 0)).toBeLessThan(120);
  }, 60_000);

  it('reports white POV mate for a back-rank mate in 1 (white to move)', async () => {
    const a = await engine.analyze('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', { depth: 12 });
    expect(a.lines[0].eval.mate).toBe(1);
    expect(a.bestmoveUci).toBe('a1a8');
  }, 60_000);

  it('reports positive white mate when BLACK to move is getting mated (POV flip)', async () => {
    // Ladder mate: Ra6 + Rb7 vs lone king — any black move, then Ra8#.
    const a = await engine.analyze('6k1/1R6/R7/8/8/8/8/6K1 b - - 0 1', { depth: 14 });
    expect(a.lines[0].eval.mate).toBeGreaterThan(0); // white POV
  }, 60_000);

  it('flags checkmated positions as terminal', async () => {
    const a = await engine.analyze('R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1', { depth: 5 });
    expect(a.terminal).toBe(true);
    expect(a.bestmoveUci).toBeNull();
  }, 60_000);
});

describe('EnginePool', () => {
  it('analyzes multiple positions in input order across 2 engines', async () => {
    const pool = await EnginePool.create(() => new ChildProcessTransport(enginePath), 2, {
      multiPv: 2,
      hashMb: 32,
    });
    const fens = [
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
    ];
    const seen: number[] = [];
    const results = await pool.analyzeAll(fens, { depth: 10 }, p => seen.push(p.index));
    pool.dispose();
    expect(results).toHaveLength(3);
    expect(results[2].lines[0].eval.mate).toBe(1); // order preserved
    expect(seen.sort()).toEqual([0, 1, 2]);
  }, 120_000);
});
