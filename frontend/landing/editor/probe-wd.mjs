// Beat-2 (data-step 8) screenshot harness — MULTI-PHASE: one Chrome session, many capture offsets.
// Usage:  node editor/probe-wd.mjs 600 4400 9000 13000 18400 [light]
//   → saves /tmp/st-wd-600.png, /tmp/st-wd-4400.png, … (ms = time into the cinematic after it starts).
//   Pass increasing offsets; add "light" anywhere to test the light theme. One arg also works.
// This replaces spawning a fresh Chrome per phase (the slow loop). Read the PNGs you care about.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
const URL = 'http://localhost:5173/frontend/landing/index.html';
const PORT = 9314;
const args = process.argv.slice(2);
const light = args.includes('light');
const PHASES = args.filter((a) => a !== 'light').map(Number).filter((n) => n > 0).sort((a, b) => a - b);
if (!PHASES.length) PHASES.push(11000);
const profile = mkdtempSync(join(tmpdir(), 'st-chrome-'));
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--window-size=1280,900', URL], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJSON = async (p) => (await fetch(`http://localhost:${PORT}${p}`)).json();
let ws, msgId = 0; const pending = new Map(); const logs = [];
const send = (m, p = {}) => new Promise((res, rej) => { const id = ++msgId; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evalJS = async (e) => { const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || 'err'); return result.value; };
(async () => {
  try {
    let t; for (let i = 0; i < 40; i++) { try { const l = await getJSON('/json'); t = l.find((x) => x.type === 'page' && x.url.includes('localhost:5173')); if (t?.webSocketDebuggerUrl) break; } catch {} await sleep(250); }
    ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 1 << 28 });
    await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
    ws.on('message', (d) => { const m = JSON.parse(d); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } else if (m.method === 'Runtime.exceptionThrown') logs.push('EXC: ' + (m.params.exceptionDetails.exception?.description || '').split('\n')[0]); });
    await send('Page.enable'); await send('Runtime.enable');
    await sleep(4500);
    await evalJS('document.getElementById("load")?.classList.add("done");document.body.classList.remove("pre-intro")');
    await evalJS(`document.documentElement.style.scrollBehavior='auto'`);
    if (light) await evalJS(`document.body.classList.add('light')`);
    for (let i = 0; i < 12; i++) {
      await evalJS(`(()=>{const s=document.querySelector('section[data-step="8"]');const r=s.getBoundingClientRect();window.scrollTo(0, r.top+scrollY - innerHeight/2 + r.height/2);})()`);
      await sleep(380);
      if (await evalJS(`document.getElementById('n2rStage')?.classList.contains('play')||false`)) break;
    }
    let elapsed = 0;
    for (const ms of PHASES) {
      await sleep(Math.max(0, ms - elapsed)); elapsed = ms;
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      const f = `/tmp/st-wd-${ms}.png`; writeFileSync(f, Buffer.from(data, 'base64'));
      console.log('saved ' + f);
    }
    if (logs.length) console.log('JS ERRORS:', [...new Set(logs)].slice(0, 4).join(' | '));
  } catch (e) { console.error('ERR', e.message); } finally { try { ws?.close(); } catch {} chrome.kill(); process.exit(0); }
})();
