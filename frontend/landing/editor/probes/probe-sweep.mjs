// Full-page consistency sweep: scroll to each data-step (settled) and screenshot → /tmp/st-sweep-<step>.png
// Usage: PORT=5173 node editor/probe-sweep.mjs 0 2 5 6   (defaults to a representative set)
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
const PORT = process.env.PORT || 5173;
const URL = `http://localhost:${PORT}/frontend/landing/index.html`;
const DBG = 9316;
const args = process.argv.slice(2).filter((a) => /^(\d+|hero)$/.test(a));
const STEPS = args.length ? args : ['hero', '0', '1', '2', '3', '5', '7', '8'];
const profile = mkdtempSync(join(tmpdir(), 'st-chrome-'));
const glFlags = process.env.GL === 'sw'
  ? ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  : ['--disable-gpu'];
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${DBG}`,
  `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', ...glFlags,
  '--window-size=1280,900', URL], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJSON = async (p) => (await fetch(`http://localhost:${DBG}${p}`)).json();
let ws, msgId = 0; const pending = new Map();
const send = (m, p = {}) => new Promise((res, rej) => { const id = ++msgId; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evalJS = async (e) => { const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || 'err'); return result.value; };
(async () => {
  try {
    let t; for (let i = 0; i < 40; i++) { try { const l = await getJSON('/json'); t = l.find((x) => x.type === 'page' && x.url.includes(`localhost:${PORT}`)); if (t?.webSocketDebuggerUrl) break; } catch {} await sleep(250); }
    ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 1 << 28 });
    await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
    ws.on('message', (d) => { const m = JSON.parse(d); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } });
    await send('Page.enable'); await send('Runtime.enable');
    await sleep(4500);
    await evalJS('document.getElementById("load")?.classList.add("done");document.body.classList.remove("pre-intro")');
    await evalJS(`document.documentElement.style.scrollBehavior='auto'`);
    for (const s of STEPS) {
      await evalJS(s === 'hero' ? 'window.scrollTo(0,0)' : `(()=>{const el=document.querySelector('section[data-step="${s}"]')||document.querySelector('[data-step="${s}"]');if(el){const r=el.getBoundingClientRect();window.scrollTo(0, r.top+scrollY - innerHeight/2 + r.height/2);}})()`);
      await sleep(2200);
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      const f = `/tmp/st-sweep-${s}.png`; writeFileSync(f, Buffer.from(data, 'base64'));
      console.log('swept step', s, '=>', f);
    }
  } catch (e) { console.error('ERR', e.message); } finally { try { ws?.close(); } catch {} chrome.kill(); process.exit(0); }
})();
