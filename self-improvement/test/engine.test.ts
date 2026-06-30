/**
 * Integration tests: drive the REAL Stockfish 18 Lite WASM binary through our
 * UCI protocol layer, using a Node child-process transport in place of the
 * browser Worker (same engine file, same line protocol).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Engine, parseInfo, type UciTransport } from '@backend/engine/engine';
import { EnginePool } from '@backend/engine/pool';
import { ChildProcessTransport, setupEngineFiles } from './helpers/transport';

/** A scripted UCI transport: emits canned info/bestmove lines on `go`. */
class ScriptedTransport implements UciTransport {
  private cb: ((line: string) => void) | null = null;
  constructor(private onGo: (emit: (line: string) => void) => void) {}
  send(cmd: string): void {
    if (cmd.startsWith('go')) this.onGo(l => this.cb?.(l));
  }
  onLine(cb: (line: string) => void): void {
    this.cb = cb;
  }
  terminate(): void {}
}

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
  const wdlRaw = 'info depth 14 multipv 1 score cp 38 wdl 84 911 5 nodes 100 pv e2e4 e7e5';
  it('parses the wdl triple (white POV) under UCI_ShowWDL', () => {
    expect(parseInfo(wdlRaw, 'white')!.wdl).toEqual({ win: 84, draw: 911, loss: 5 });
  });
  it('swaps win/loss in wdl for black to move (white POV)', () => {
    expect(parseInfo(wdlRaw, 'black')!.wdl).toEqual({ win: 5, draw: 911, loss: 84 });
  });
  it('leaves wdl undefined when the engine omits it (graceful fallback)', () => {
    expect(parseInfo(raw, 'white')!.wdl).toBeUndefined();
  });
});

describe('analyze — per-depth trajectory (Phase 1.4, synthetic transport)', () => {
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  it('captures the multipv-1 eval at each new depth in order (one per depth, incl. a sign flip)', async () => {
    const engine = new Engine(
      new ScriptedTransport(emit => {
        emit('info depth 1 multipv 1 score cp 50 pv e2e4');
        emit('info depth 2 multipv 1 score cp 30 pv e2e4');
        emit('info depth 2 multipv 1 score cp 33 pv e2e4'); // same depth refine → no dup entry
        emit('info depth 1 multipv 2 score cp 10 pv g1f3'); // mpv2 never enters the trajectory
        emit('info depth 3 multipv 1 score cp -20 pv d2d4'); // advantage flips sign
        emit('info depth 4 multipv 1 score cp -45 pv d2d4');
        emit('bestmove d2d4');
      }),
    );
    const a = await engine.analyze(startFen, { depth: 4 });
    expect(a.trajectory).toEqual([
      { depth: 1, eval: { cp: 50 } },
      { depth: 2, eval: { cp: 30 } },
      { depth: 3, eval: { cp: -20 } },
      { depth: 4, eval: { cp: -45 } },
    ]);
    expect(a.shallowEval).toEqual(a.trajectory![0].eval); // [0] is the shallow eval
  });
  it('is undefined for a terminal position (only bestmove (none))', async () => {
    const engine = new Engine(new ScriptedTransport(emit => emit('bestmove (none)')));
    const a = await engine.analyze('6k1/5ppp/8/8/8/8/5PPP/R5K1 b - - 0 1', { depth: 4 });
    expect(a.terminal).toBe(true);
    expect(a.trajectory).toBeUndefined();
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

  it('captures a per-depth eval trajectory, ascending and unique (Phase 1.4)', async () => {
    const a = await engine.analyze(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      { depth: 12 },
    );
    expect(a.trajectory!.length).toBeGreaterThan(1);
    const depths = a.trajectory!.map(t => t.depth);
    expect(depths).toEqual([...depths].sort((x, y) => x - y)); // ascending
    expect(new Set(depths).size).toBe(depths.length); // one entry per depth
    expect(a.trajectory![0].eval).toEqual(a.shallowEval); // [0] is the shallow eval
  }, 60_000);

  it('emits a white-POV WDL triple under UCI_ShowWDL (lite WASM capability ratchet)', async () => {
    const a = await engine.analyze(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      { depth: 12 },
    );
    const wdl = a.lines[0].wdl;
    expect(wdl).toBeDefined();
    expect(wdl!.win + wdl!.draw + wdl!.loss).toBe(1000);
    expect(wdl!.win).toBeGreaterThanOrEqual(wdl!.loss); // white's slight start edge
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
