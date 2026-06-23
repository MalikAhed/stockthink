// Probe the isolated ender-test.html (one WebGL context → fast under SwiftShader).
// Usage: GL=sw node editor/probe-endertest.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
const PORT = process.env.PORT || 5173;
const P = process.env.P || '0';   // camera progress 0..1 (drives setShot in ender-test.html)
const URL = `http://localhost:${PORT}/frontend/landing/editor/ender-test.html?p=${P}`;
const DBG = 9318;
const profile = mkdtempSync(join(tmpdir(), 'st-chrome-'));
const glFlags = process.env.GL === 'sw'
  ? ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  : ['--disable-gpu'];
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${DBG}`,
  `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', ...glFlags,
  '--window-size=1280,900', URL], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJSON = async (p) => (await fetch(`http://localhost:${DBG}${p}`)).json();
let ws, msgId = 0; const pending = new Map(); const logs = [];
const send = (m, p = {}) => new Promise((res, rej) => { const id = ++msgId; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evalJS = async (e) => { const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || 'err'); return result.value; };
(async () => {
  try {
    let t; for (let i = 0; i < 40; i++) { try { const l = await getJSON('/json'); t = l.find((x) => x.type === 'page' && x.url.includes('ender-test')); if (t?.webSocketDebuggerUrl) break; } catch {} await sleep(250); }
    ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 1 << 28 });
    await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
    ws.on('message', (d) => { const m = JSON.parse(d); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } else if (m.method === 'Runtime.consoleAPICalled') logs.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`); else if (m.method === 'Runtime.exceptionThrown') logs.push('EXC: ' + (m.params.exceptionDetails.exception?.description || '')); });
    await send('Page.enable'); await send('Runtime.enable');
    let status = '';
    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      status = await evalJS(`(window.__enderReady?'ready':(window.__enderErr?('ERR '+window.__enderErr):'wait'))+' | '+(document.getElementById('st')?.textContent||'')`);
      if (status.startsWith('ready') || status.startsWith('ERR')) break;
    }
    console.log('STATUS:', status);
    await sleep(800);
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const out = `/tmp/st-endertest-${P}.png`;
    writeFileSync(out, Buffer.from(data, 'base64'));
    console.log('saved ' + out);
    if (logs.length) console.log('LOGS\n' + logs.slice(-18).join('\n'));
  } catch (e) { console.error('ERR', e.message); } finally { try { ws?.close(); } catch {} chrome.kill(); process.exit(0); }
})();
