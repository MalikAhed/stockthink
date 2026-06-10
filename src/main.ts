/**
 * StockThink — free, fully client-side chess game review.
 * Boot module: proves the engine loads; replaced by the real app as UI lands.
 */
import { winPercent } from './analysis/winprob';

const app = document.getElementById('app')!;
app.innerHTML = `
  <div style="font-family: system-ui, sans-serif; padding: 2rem; max-width: 640px; margin: 0 auto;">
    <h1 style="color:#81b64c">StockThink</h1>
    <p>Free chess game review, entirely in your browser.</p>
    <pre id="engine-log" style="background:#312e2b;padding:1rem;border-radius:8px;min-height:8rem"></pre>
  </div>`;

const log = (line: string) => {
  document.getElementById('engine-log')!.textContent += line + '\n';
};

// Engine smoke test: load the worker, confirm UCI handshake, eval startpos.
const engineUrl = `${import.meta.env.BASE_URL}engine/stockfish-18-lite-single.js`;
const sf = new Worker(engineUrl);
log('loading Stockfish 18 Lite (7.3 MB, one-time)…');
sf.onmessage = (e: MessageEvent<string>) => {
  const line = e.data;
  if (line === 'uciok') {
    log('✓ engine ready (UCI handshake ok)');
    sf.postMessage('position startpos');
    sf.postMessage('go depth 15');
  } else if (line.startsWith('info depth 15') && line.includes(' multipv 1 ')) {
    const cp = Number(/score cp (-?\d+)/.exec(line)?.[1] ?? 0);
    log(`startpos at depth 15: +${(cp / 100).toFixed(2)} → ${winPercent({ cp }).toFixed(1)}% for White`);
  } else if (line.startsWith('bestmove')) {
    log(`✓ ${line}`);
    sf.terminate();
  }
};
sf.postMessage('uci');
