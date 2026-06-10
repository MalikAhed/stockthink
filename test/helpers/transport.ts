/**
 * Shared test helper: run the real Stockfish WASM build under Node as a
 * child process speaking UCI on stdio — a stand-in for the browser Worker.
 */
import { type ChildProcess, spawn } from 'node:child_process';
import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as readline from 'node:readline';
import type { UciTransport } from '../../src/engine/engine';

export class ChildProcessTransport implements UciTransport {
  private proc: ChildProcess;
  private cb: ((line: string) => void) | null = null;
  constructor(enginePath: string) {
    this.proc = spawn('node', [enginePath], { stdio: ['pipe', 'pipe', 'ignore'] });
    const rl = readline.createInterface({ input: this.proc.stdout! });
    rl.on('line', line => this.cb?.(line));
  }
  send(cmd: string): void {
    this.proc.stdin!.write(cmd + '\n');
  }
  onLine(cb: (line: string) => void): void {
    this.cb = cb;
  }
  terminate(): void {
    this.proc.kill();
  }
}

/**
 * Copy the engine to a tmpdir as .cjs (the build is CJS; our package.json is
 * "type":"module") with the wasm alongside. Returns the runnable .cjs path.
 */
export function setupEngineFiles(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), 'stockthink-sf-'));
  const enginePath = join(dir, 'stockfish.cjs');
  copyFileSync(join(here, '../../public/engine/stockfish-18-lite-single.js'), enginePath);
  copyFileSync(
    join(here, '../../public/engine/stockfish-18-lite-single.wasm'),
    join(dir, 'stockfish.wasm'),
  );
  return enginePath;
}
