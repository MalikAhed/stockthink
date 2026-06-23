// Throwaway check: verify the ender's scroll-driven light-theme dimming (ender.js onScroll) —
// body background should darken as the finale rises into view and restore on scroll-up. No WebGL
// needed (we --disable-gpu), so it's fast and won't choke on the 3D contexts.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
const PORT = process.env.PORT || 5173;
const DBG = 9341;
const profile = mkdtempSync(join(tmpdir(), 'st-chrome-'));
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${DBG}`,
  `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu',
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
    await sleep(4000);
    await ev('document.getElementById("load")?.classList.add("done");document.body.classList.remove("pre-intro");document.documentElement.style.scrollBehavior="auto";document.body.classList.add("light")');
    const enderTop = await ev(`(()=>{const s=document.querySelector('section.ender');return Math.round(s.getBoundingClientRect().top+scrollY);})()`);
    const sample = async (label, y) => {
      await ev(`window.scrollTo(0, ${y})`); await sleep(120);
      // force a couple of rAF ticks so the handler's rAF-throttled onScroll actually runs in headless
      await ev(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`); await sleep(60);
      const d = await ev(`(()=>{const s=document.querySelector('section.ender');const r=s.getBoundingClientRect();
        const f=document.querySelector('.ender-fade'),c=document.querySelector('.ender-canvas');
        return JSON.stringify({top:Math.round(r.top),veil:f?(+(f.style.opacity||0)).toFixed(2):'NO-EL',
          canvas:c?(c.style.opacity===''?'1(css0)':(+c.style.opacity).toFixed(2)):'NO-EL'});})()`);
      console.log(label.padEnd(30), d);
    };
    console.log('ender section top =', enderTop, '(light theme)');
    // prime: scroll into the finale so the lazy ender.js (and its fade veil) is loaded, then test the ramp
    await ev(`window.scrollTo(0, ${enderTop + 1500})`); await sleep(1500);
    await ev(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`); await sleep(200);
    await sample('before approach (1.6 vp above)', enderTop - Math.round(1.6 * 900));
    await sample('half a viewport into approach', enderTop - 450);
    await sample('fully entered (sticky pinned)', enderTop + 50);
    await sample('mid track', enderTop + Math.round(1.2 * 900));
    await sample('scrolled BACK up (above)', enderTop - 1000);
    console.log('JS exceptions:', errs.length ? [...new Set(errs)].slice(0, 4) : 'none');
  } catch (e) { console.error('ERR', e.message); } finally { try { ws?.close(); } catch {} chrome.kill(); process.exit(0); }
})();
