/**
 * UCI engine wrapper for Stockfish WASM.
 *
 * Protocol patterns follow lichess lila's ui/lib/src/ceval/protocol.ts
 * (re-implemented): one search in flight per engine, info-line parsing,
 * side-to-move → white-POV score normalization at the parse layer.
 *
 * The transport is abstracted so the browser uses a Web Worker and tests
 * can use a Node child process running the same engine binary.
 */
import { type EvalScore, toWhitePov } from '../analysis/winprob';

export interface UciTransport {
  send(cmd: string): void;
  /** Register the single line listener (one UCI output line per call). */
  onLine(cb: (line: string) => void): void;
  terminate(): void;
}

/** Browser transport: the stockfish .js loader run as a Web Worker. */
export class WorkerTransport implements UciTransport {
  private worker: Worker;
  constructor(scriptUrl: string) {
    this.worker = new Worker(scriptUrl);
  }
  send(cmd: string): void {
    this.worker.postMessage(cmd);
  }
  onLine(cb: (line: string) => void): void {
    this.worker.onmessage = (e: MessageEvent<string>) => cb(e.data);
  }
  terminate(): void {
    this.worker.terminate();
  }
}

export interface SearchLimits {
  depth?: number;
  movetime?: number;
  nodes?: number;
}

/** Win/draw/loss probabilities in permille (win + draw + loss = 1000). */
export interface Wdl {
  win: number;
  draw: number;
  loss: number;
}

export interface EngineLine {
  multipv: number;
  depth: number;
  /** White-POV score. */
  eval: EvalScore;
  /** Principal variation in UCI long algebraic ("e2e4"), from this position. */
  pvUci: string[];
  /**
   * Win/draw/loss permille (sums to 1000) from `UCI_ShowWDL`, normalized to
   * white POV (win = P(white wins)). `undefined` when the engine build omits it
   * — the shipped lite WASM DOES emit it (probed 2026-06-30); consumers treat
   * absence as "signal unavailable" so the silence layer degrades gracefully.
   */
  wdl?: Wdl;
}

export interface PositionAnalysis {
  fen: string;
  /** Sorted by multipv index; [0] is the engine's best line. May be empty if terminal. */
  lines: EngineLine[];
  bestmoveUci: string | null;
  /** True when the position has no legal moves (mate/stalemate). */
  terminal: boolean;
  /**
   * White-POV eval of the FIRST (shallowest) completed mainline iteration.
   * |shallow − deep| is the per-position volatility margin: a divergence
   * beyond ~60–70cp marks a tactically volatile position whose static
   * features are about to be overturned (arXiv:2412.17948 quiet-position
   * filter, inverted).
   */
  shallowEval?: EvalScore;
  /**
   * White-POV eval of the best (multipv-1) line at each completed search depth,
   * in depth order. A late sign-flip or large late swing marks an unstable
   * position whose static features are about to be overturned — the silence
   * layer's trajectory-stability signal (Phase 3). Same per-depth semantics as
   * `onDepth`/`shallowEval` (first exact line at each new depth), so
   * `trajectory[0].eval` equals `shallowEval` and the last entry is the deepest
   * depth reached. `undefined` on terminal positions.
   */
  trajectory?: { depth: number; eval: EvalScore }[];
}

export interface EngineOptions {
  multiPv?: number;
  hashMb?: number;
}

const sideToMove = (fen: string): 'white' | 'black' =>
  fen.split(' ')[1] === 'b' ? 'black' : 'white';

export class Engine {
  private transport: UciTransport;
  private lineHandler: ((line: string) => void) | null = null;
  readonly multiPv: number;

  constructor(transport: UciTransport, opts: EngineOptions = {}) {
    this.transport = transport;
    this.multiPv = opts.multiPv ?? 2;
    transport.onLine(line => this.lineHandler?.(line));
    this.optionCmds = [
      'setoption name UCI_AnalyseMode value true',
      `setoption name MultiPV value ${this.multiPv}`,
      `setoption name Hash value ${opts.hashMb ?? 64}`,
      // Reporting-only: adds a `wdl W D L` field to info lines, never changes
      // search/score (verified eval-identical 2026-06-30). Unknown options are
      // ignored per UCI, so this is safe on builds that lack it.
      'setoption name UCI_ShowWDL value true',
      'setoption name UCI_Chess960 value true',
    ];
  }

  private optionCmds: string[];

  /** UCI handshake; resolves when the engine is ready to search. */
  init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('engine init timeout')), 30_000);
      this.lineHandler = line => {
        if (line === 'uciok') {
          for (const cmd of this.optionCmds) this.transport.send(cmd);
          this.transport.send('ucinewgame');
          this.transport.send('isready');
        } else if (line === 'readyok') {
          clearTimeout(timer);
          this.lineHandler = null;
          resolve();
        }
      };
      this.transport.send('uci');
    });
  }

  /**
   * Analyze a single position. One search in flight at a time per Engine.
   * Resolves on `bestmove` with the deepest completed line per multipv slot.
   */
  analyze(
    fen: string,
    limits: SearchLimits,
    onDepth?: (depth: number, best: EngineLine) => void,
  ): Promise<PositionAnalysis> {
    const stm = sideToMove(fen);
    const lines = new Map<number, EngineLine>();
    let shallow: EngineLine | undefined;
    const trajectory: { depth: number; eval: EvalScore }[] = [];

    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`search timeout on ${fen}`)),
        Math.max(120_000, (limits.movetime ?? 0) * 4),
      );
      this.lineHandler = raw => {
        if (raw.startsWith('info ')) {
          const line = parseInfo(raw, stm);
          if (!line) return;
          if (line.multipv === 1 && shallow === undefined) shallow = line;
          const prev = lines.get(line.multipv);
          if (!prev || line.depth >= prev.depth) lines.set(line.multipv, line);
          if (line.multipv === 1 && (!prev || line.depth > prev.depth)) {
            trajectory.push({ depth: line.depth, eval: line.eval });
            onDepth?.(line.depth, line);
          }
        } else if (raw.startsWith('bestmove')) {
          clearTimeout(timer);
          this.lineHandler = null;
          const best = raw.split(/\s+/)[1];
          const terminal = !best || best === '(none)';
          resolve({
            fen,
            lines: [...lines.values()].sort((a, b) => a.multipv - b.multipv),
            bestmoveUci: terminal ? null : best,
            terminal,
            shallowEval: shallow?.eval,
            trajectory: trajectory.length ? trajectory : undefined,
          });
        }
      };
      this.transport.send(`position fen ${fen}`);
      const go =
        limits.nodes !== undefined
          ? `go nodes ${limits.nodes}`
          : limits.movetime !== undefined
            ? `go movetime ${limits.movetime}`
            : `go depth ${limits.depth ?? 14}`;
      this.transport.send(go);
    });
  }

  dispose(): void {
    try {
      this.transport.send('quit');
    } catch {
      /* transport may already be gone */
    }
    this.transport.terminate();
  }
}

/**
 * Parse one `info …` line into an EngineLine (white POV), or null when the
 * line carries no usable pv/score (bound-only lines on pv1, currmove chatter…).
 */
export function parseInfo(raw: string, stm: 'white' | 'black'): EngineLine | null {
  const parts = raw.trim().split(/\s+/);
  let depth = 0;
  let multipv = 1;
  let isMate = false;
  let score: number | undefined;
  let bound = false;
  let pv: string[] = [];
  let wdl: number[] | undefined;

  for (let i = 1; i < parts.length; i++) {
    switch (parts[i]) {
      case 'depth':
        depth = parseInt(parts[++i]);
        break;
      case 'multipv':
        multipv = parseInt(parts[++i]);
        break;
      case 'score':
        isMate = parts[++i] === 'mate';
        score = parseInt(parts[++i]);
        if (parts[i + 1] === 'lowerbound' || parts[i + 1] === 'upperbound') {
          bound = true;
          i++;
        }
        break;
      case 'wdl':
        // side-to-move POV: `wdl <win> <draw> <loss>` permille (sums to 1000)
        wdl = [parseInt(parts[++i]), parseInt(parts[++i]), parseInt(parts[++i])];
        break;
      case 'pv':
        pv = parts.slice(i + 1);
        i = parts.length;
        break;
    }
  }

  if (score === undefined || pv.length === 0) return null;
  if (isMate && score === 0) return null; // "mate 0" = game over, skip like lila
  if (bound && multipv === 1) return null; // ignore bound-only mainline updates

  const povEval: EvalScore = isMate ? { mate: score } : { cp: score };
  const line: EngineLine = { multipv, depth, eval: toWhitePov(stm, povEval), pvUci: pv };
  if (wdl && wdl.every(Number.isFinite)) {
    const [w, d, l] = wdl;
    // white POV: swap win/loss when black is to move (draw is side-agnostic)
    line.wdl = stm === 'white' ? { win: w, draw: d, loss: l } : { win: l, draw: d, loss: w };
  }
  return line;
}
