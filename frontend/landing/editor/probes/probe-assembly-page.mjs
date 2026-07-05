// REAL-PAGE check of the finale ASSEMBLY entry: loads the live landing page (GL=sw for WebGL),
// scrolls into the ender track at fractions of the assembly scrub, screenshots each state, then
// scrolls back up to verify the entry REVERSES. → /tmp/st-asmpage-*.png
// Usage: GL=sw PORT=5174 node editor/probes/probe-assembly-page.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
const PORT = process.env.PORT || 5173;
const DBG = 9343;
const profile = mkdtempSync(join(tmpdir(), 'st-chrome-'));
const glFlags = process.env.GL === 'sw'
  ? ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  : ['--disable-gpu'];
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${DBG}`,
  `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', ...glFlags,
  '--window-size=1280,900', `http://localhost:${PORT}/frontend/landing/index.html`], { stdio: 'ignore' });
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
    await sleep(6000);
    await ev('document.getElementById("load")?.classList.add("done");document.body.classList.remove("pre-intro");document.documentElement.style.scrollBehavior="auto"');
    const enderTop = await ev(`(()=>{const s=document.querySelector('section.ender');return Math.round(s.getBoundingClientRect().top+scrollY);})()`);
    const vh = 900;
    // prime: get near the finale so the lazy ender module + scene build (GLBs, SwiftShader shaders)
    await ev(`window.scrollTo(0, ${enderTop - 400})`);
    for (let i = 0; i < 30; i++) { await sleep(1000); if (await ev('!!window.__ender')) break; }
    console.log('scene built:', await ev('!!window.__ender'));
    const shot = async (label, y) => {
      await ev(`window.scrollTo(0, ${y})`);
      await sleep(2500);   // several slow SwiftShader frames so the state settles
      const st = await ev(`JSON.stringify({ending:document.body.classList.contains('ending')})`);
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      const out = `/tmp/st-asmpage-${label}.png`;
      writeFileSync(out, Buffer.from(data, 'base64'));
      console.log('saved', out, st);
    };
    await shot('p02', enderTop + Math.round(0.2 * 0.9 * vh));
    await shot('p05', enderTop + Math.round(0.5 * 0.9 * vh));
    await shot('p08', enderTop + Math.round(0.8 * 0.9 * vh));
    await shot('p10', enderTop + Math.round(1.05 * 0.9 * vh));
    await shot('rev04', enderTop + Math.round(0.4 * 0.9 * vh));   // scrolled BACK UP → the entry reverses
    console.log('JS exceptions:', errs.length ? [...new Set(errs)].slice(0, 4) : 'none');
  } catch (e) { console.error('ERR', e.message); } finally { try { ws?.close(); } catch {} chrome.kill(); process.exit(0); }
})();
