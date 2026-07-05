// Screenshot the ASSEMBLY entry (the coach → finale transition) at several progress values p in ONE
// Chrome session. Drives finale-stage.html: __setT(0) + __setP(p) — verifies the staged build:
// table rises / lamp drops / board slides in / the dark room fades in around the set.
// Pass values > 1 as GAME times instead (t = v, p = 1) to check late frames (e.g. the tableau).
// Usage: GL=sw [PORT=5174] node editor/probes/probe-assembly.mjs <p_or_t ...>
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
const PORT = process.env.PORT || 5173;
const MS = process.argv.slice(2).map(Number).filter((n) => !Number.isNaN(n));
const TIMES = MS.length ? MS : [0.1, 0.3, 0.5, 0.7, 0.85, 1.0];
const URL = `http://localhost:${PORT}/frontend/landing/editor/probes/finale-stage.html?t=0`;
const DBG = 9323;
const profile = mkdtempSync(join(tmpdir(), 'st-chrome-'));
const glFlags = process.env.GL === 'sw'
  ? ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  : ['--disable-gpu'];
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${DBG}`,
  `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', ...glFlags,
  '--window-size=1280,720', URL], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJSON = async (p) => (await fetch(`http://localhost:${DBG}${p}`)).json();
let ws, msgId = 0; const pending = new Map(); const logs = [];
const send = (m, p = {}) => new Promise((res, rej) => { const id = ++msgId; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evalJS = async (e) => { const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || 'err'); return result.value; };
(async () => {
  try {
    let t; for (let i = 0; i < 40; i++) { try { const l = await getJSON('/json'); t = l.find((x) => x.type === 'page' && x.url.includes('finale-stage')); if (t?.webSocketDebuggerUrl) break; } catch {} await sleep(250); }
    ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 1 << 28 });
    await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
    ws.on('message', (d) => { const m = JSON.parse(d); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } else if (m.method === 'Runtime.consoleAPICalled') logs.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`); else if (m.method === 'Runtime.exceptionThrown') logs.push('EXC: ' + (m.params.exceptionDetails.exception?.description || '')); });
    await send('Page.enable'); await send('Runtime.enable');
    let status = '';
    for (let i = 0; i < 60; i++) { await sleep(1000); status = await evalJS(`(window.__enderReady?'ready':(window.__enderErr?('ERR '+window.__enderErr):'wait'))`); if (status.startsWith('ready') || status.startsWith('ERR')) break; }
    console.log('STATUS:', status);
    for (const m of TIMES) {
      const asP = m <= 1;   // ≤1 → assembly progress; >1 → a game time with the set fully built
      await evalJS(asP ? `window.__setT(0); window.__setP(${m})` : `window.__setT(${m}); window.__setP(1)`);
      await sleep(700);   // let a few rAF frames render the seeked state
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      const out = `/tmp/st-asm-${String(m).replace('.', '_')}.png`;
      writeFileSync(out, Buffer.from(data, 'base64'));
      console.log('saved ' + out);
    }
    if (logs.length) console.log('LOGS\n' + logs.slice(-12).join('\n'));
  } catch (e) { console.error('ERR', e.message); } finally { try { ws?.close(); } catch {} chrome.kill(); process.exit(0); }
})();
