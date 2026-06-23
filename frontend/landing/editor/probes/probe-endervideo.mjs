// Verify the finale-as-video on the live page: navigate, scroll to the finale, and confirm the <video>
// loads its real sources (200), autoplays (currentTime advances), and the page→black flip fires.
// Headless tier = min (software GPU), which is exactly a weak device — the video must still work there.
//   PORT=5180 node editor/probe-endervideo.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
const PORT = process.env.PORT || 5180;
const DBG = 9362;
const url = `http://localhost:${PORT}/frontend/landing/index.html`;
const profile = mkdtempSync(join(tmpdir(), 'st-ev-'));
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${DBG}`,
  `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--no-sandbox',
  '--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader', '--disable-renderer-backgrounding', '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJSON = async (p) => (await fetch(`http://localhost:${DBG}${p}`)).json();
let ws, id = 0; const pend = new Map(); const vids = []; const errs = [];
const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async (e) => { const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || 'err'); return result.value; };
(async () => {
  try {
    let t; for (let i = 0; i < 40; i++) { try { const l = await getJSON('/json'); t = l.find((x) => x.type === 'page'); if (t?.webSocketDebuggerUrl) break; } catch {} await sleep(250); }
    ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 1 << 28 });
    await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
    ws.on('message', (d) => { const m = JSON.parse(d); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
      else if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails.exception?.description || '').split('\n')[0]);
      else if (m.method === 'Network.responseReceived') { const u = m.params.response.url; if (/landing\/video\//.test(u)) vids.push({ u: u.split('/landing/video/')[1], s: m.params.response.status }); } });
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
    await send('Page.navigate', { url });
    // wait for boot
    for (let i = 0; i < 40; i++) { await sleep(300); if (await ev('!!window.__perf').catch(() => false)) break; }
    const tier = await ev('window.__perf && window.__perf.tier');
    // land cleanly INSIDE the finale's revealed range: 0.7 viewport-heights past the section top
    // (revealP≈1, body.ending on) — NOT past the 2.2vh section, which would re-arm/reset the clip.
    await ev(`(async()=>{const s=document.querySelector('section.ender');
      window.scrollTo(0, s.offsetTop + innerHeight*0.4); await new Promise(r=>setTimeout(r,500));
      window.scrollTo(0, s.offsetTop + innerHeight*0.7); await new Promise(r=>setTimeout(r,500));})()`);
    await sleep(2500);
    const st = JSON.parse(await ev(`(()=>{const v=document.getElementById('enderVideo');return JSON.stringify({
      exists:!!v, srcCount:v?v.querySelectorAll('source').length:0, readyState:v?v.readyState:-1,
      currentTime:v?+v.currentTime.toFixed(2):-1, paused:v?v.paused:null, duration:v?(+v.duration||0).toFixed(2):-1,
      opacity:v?getComputedStyle(v).opacity:'-', ending:document.body.classList.contains('ending'),
      hasFade:!!document.querySelector('.ender-fade'), poster:v?(v.poster||'').split('/landing/')[1]:'' })})()`));
    console.log('tier         :', tier, '(headless software GPU = weakest-device case)');
    console.log('video        : exists=' + st.exists, 'sources=' + st.srcCount, 'readyState=' + st.readyState, 'duration=' + st.duration);
    console.log('autoplay     : currentTime=' + st.currentTime, 'paused=' + st.paused, '(currentTime>0 ⇒ playing)');
    console.log('reveal/flip  : video opacity=' + st.opacity, 'body.ending=' + st.ending, 'veil=' + st.hasFade, 'poster=' + st.poster);
    console.log('video reqs   :', vids.length ? JSON.stringify(vids) : '(none)');
    console.log('JS errors    :', errs.length ? [...new Set(errs)].slice(0, 4) : 'none');
  } catch (e) { console.error('ERR', e.message); } finally { try { ws?.close(); } catch {} chrome.kill(); process.exit(0); }
})();
