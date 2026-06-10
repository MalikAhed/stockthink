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

export interface EngineLine {
  multipv: number;
  depth: number;
  /** White-POV score. */
  eval: EvalScore;
  /** Principal variation in UCI long algebraic ("e2e4"), from this position. */
  pvUci: string[];
}

export interface PositionAnalysis {
  fen: string;
  /** Sorted by multipv index; [0] is the engine's best line. May be empty if terminal. */
  lines: EngineLine[];
  bestmoveUci: string | null;
  /** True when the position has no legal moves (mate/stalemate). */
  terminal: boolean;
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

    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`search timeout on ${fen}`)),
        Math.max(120_000, (limits.movetime ?? 0) * 4),
      );
      this.lineHandler = raw => {
        if (raw.startsWith('info ')) {
          const line = parseInfo(raw, stm);
          if (!line) return;
          const prev = lines.get(line.multipv);
          if (!prev || line.depth >= prev.depth) lines.set(line.multipv, line);
          if (line.multipv === 1 && (!prev || line.depth > prev.depth) && onDepth)
            onDepth(line.depth, line);
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
  return { multipv, depth, eval: toWhitePov(stm, povEval), pvUci: pv };
}
