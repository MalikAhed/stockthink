// Perf probe: count WebGL draw calls/sec while parked at different scroll positions, to PROVE
// off-screen 3D scenes no longer render. Usage: GL=sw node editor/probe-perf.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
const PORT = process.env.PORT || 5173;
const URL = `http://localhost:${PORT}/frontend/landing/index.html`;
const DBG = 9319;
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
    await sleep(6500);
    await evalJS('document.getElementById("load")?.classList.add("done");document.body.classList.remove("pre-intro");document.documentElement.style.scrollBehavior="auto"');
    // global draw-call counter (hook both GL1 + GL2 draw paths)
    await evalJS(`(()=>{window.__draws=0;for(const P of [window.WebGLRenderingContext,window.WebGL2RenderingContext]){if(!P)continue;for(const fn of ['drawElements','drawArrays']){const o=P.prototype[fn];if(o&&!o.__hk){P.prototype[fn]=function(){window.__draws++;return o.apply(this,arguments);};P.prototype[fn].__hk=1;}}}return true;})()`);
    // let the idle-preload pull in every below-fold module, so we test the GATING (not just absence)
    await evalJS(`(async()=>{for(const f of [0.2,0.45,0.7,0.95,0.6,0.3,0]){const max=document.body.scrollHeight-innerHeight;window.scrollTo(0,max*f);await new Promise(r=>setTimeout(r,700));}window.scrollTo(0,0);})()`);
    await sleep(2500);
    const sampleAt = async (label, y) => {
      await evalJS(`window.scrollTo(0, ${y})`);
      await sleep(500);
      const before = await evalJS('window.__draws|0');
      await sleep(1000);
      const after = await evalJS('window.__draws|0');
      const ctxs = await evalJS(`[...document.querySelectorAll('canvas')].filter(c=>{try{return !!(c.getContext('webgl2',{stencil:false})||c.getContext('webgl'));}catch(e){return false;}}).length`);
      console.log(`${label.padEnd(26)} draws/sec=${String(after - before).padStart(5)}   (live webgl canvases: ${ctxs})`);
    };
    const Y = await evalJS(`(()=>{const q=s=>{const e=document.querySelector(s);if(!e)return -1;const r=e.getBoundingClientRect();return Math.round(r.top+scrollY);};return JSON.stringify({hero:0,domStep:q('section[data-step="2"]'),coach:q('section.coach'),ender:q('section.ender')});})()`);
    const pos = JSON.parse(Y);
    console.log('\n=== draw calls per second while parked (gating proof: off-screen → ~0) ===');
    await sampleAt('HERO (top, 3D visible)', 0);
    await sampleAt('DOM step (no 3D visible)', pos.domStep);
    await sampleAt('COACH (3D visible)', pos.coach + 200);
    await sampleAt('ENDER (3D visible)', pos.ender + 200);
  } catch (e) { console.error('ERR', e.message); } finally { try { ws?.close(); } catch {} chrome.kill(); process.exit(0); }
})();
