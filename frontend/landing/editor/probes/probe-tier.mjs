// Verify the perf-manager tiering: load the page at a given tier (?perf=…) and report which 3D modules
// actually loaded, the body lite-classes, and any JS errors. Usage: GL=sw PERF=high node editor/probe-tier.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
const PORT = process.env.PORT || 5173;
const PERF = process.env.PERF || '';
const DBG = 9343;
const url = `http://localhost:${PORT}/frontend/landing/index.html${PERF ? `?perf=${PERF}` : ''}`;
const glFlags = process.env.GL === 'sw'
  ? ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  : ['--disable-gpu'];
const profile = mkdtempSync(join(tmpdir(), 'st-chrome-'));
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${DBG}`,
  `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', ...glFlags,
  '--window-size=1280,900', url], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJSON = async (p) => (await fetch(`http://localhost:${DBG}${p}`)).json();
let ws, id = 0; const pend = new Map(); const errs = [];
const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async (e) => { const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || 'err'); return result.value; };
(async () => {
  try {
    let t; for (let i = 0; i < 40; i++) { try { const l = await getJSON('/json'); t = l.find((x) => x.type === 'page' && x.url.includes(`localhost:${PORT}`)); if (t?.webSocketDebuggerUrl) break; } catch {} await sleep(250); }
    ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 1 << 28 });
    await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
    ws.on('message', (d) => { const m = JSON.parse(d); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } else if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails.exception?.description || '').split('\n')[0]); });
    await send('Page.enable'); await send('Runtime.enable');
    await sleep(4000);
    await ev('document.getElementById("load")?.classList.add("done")');
    // scroll through so the approach-observers + idle-preload get a chance to load whatever the tier allows
    await ev(`(async()=>{const h=document.body.scrollHeight-innerHeight;for(const f of [0.15,0.4,0.65,0.9,0.5,0]){window.scrollTo(0,h*f);await new Promise(r=>setTimeout(r,500));}})()`);
    await sleep(2500);
    const out = await ev(`JSON.stringify({
      tier: window.__perf && window.__perf.tier, q: window.__perf,
      loaded: { hero: typeof window.setHeroPiece==='function', gears: !!window.stGears, logoGears: !!window.stLogoGears,
                coach: !!document.querySelector('.coach-code'), ender: !!document.querySelector('.ender-fade') },
      body: ['no-hero','lite-gears','lite-cinema','ending'].filter(c=>document.body.classList.contains(c)),
    })`);
    const o = JSON.parse(out);
    console.log('URL          :', url);
    console.log('tier         :', o.tier, '|', JSON.stringify(o.q));
    console.log('modules loaded:', JSON.stringify(o.loaded));
    console.log('body classes :', o.body.join(' ') || '(none)');
    console.log('JS errors    :', errs.length ? [...new Set(errs)].slice(0, 5) : 'none');
  } catch (e) { console.error('ERR', e.message); } finally { try { ws?.close(); } catch {} chrome.kill(); process.exit(0); }
})();
