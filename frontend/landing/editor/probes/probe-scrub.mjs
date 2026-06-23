// Scrubber test harness: scroll to an animation, then DRIVE its scrub bar (real slider →
// 'input' event) to a list of fractions and screenshot each — proves frame-accurate seeking.
// Usage: PORT=5173 STEP=8 node editor/probe-scrub.mjs 0.12 0.35 0.55 0.75 0.95 [light]
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
const PORT = process.env.PORT || 5173;
const STEP = process.env.STEP || '8';
const URL = `http://localhost:${PORT}/frontend/landing/index.html`;
const DBG = 9315;
const args = process.argv.slice(2);
const light = args.includes('light');
const fr = args.filter((a) => /^[\d.]+$/.test(a)).map(Number);
const FRACS = fr.length ? fr : [0.12, 0.35, 0.55, 0.75, 0.95];
const profile = mkdtempSync(join(tmpdir(), 'st-chrome-'));
// GL=sw → software WebGL (SwiftShader) so the 3D scenes (coach/gears/hero) actually render headless.
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
    let t; for (let i = 0; i < 40; i++) { try { const l = await getJSON('/json'); t = l.find((x) => x.type === 'page' && x.url.includes(`localhost:${PORT}`)); if (t?.webSocketDebuggerUrl) break; } catch {} await sleep(250); }
    ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 1 << 28 });
    await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
    ws.on('message', (d) => { const m = JSON.parse(d); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } else if (m.method === 'Runtime.consoleAPICalled') logs.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`); else if (m.method === 'Runtime.exceptionThrown') logs.push('EXC: ' + (m.params.exceptionDetails.exception?.description || '')); });
    await send('Page.enable'); await send('Runtime.enable');
    await sleep(4500);
    await evalJS('document.getElementById("load")?.classList.add("done");document.body.classList.remove("pre-intro")');
    if (light) await evalJS('document.body.classList.add("light")');
    await evalJS(`document.documentElement.style.scrollBehavior='auto'`);
    let shown = false;
    for (let i = 0; i < 18; i++) {
      await evalJS(`(()=>{const s=document.querySelector('section[data-step="${STEP}"]');if(!s)return;const r=s.getBoundingClientRect();window.scrollTo(0, r.top+scrollY - innerHeight/2 + r.height/2);})()`);
      await sleep(450);
      shown = await evalJS(`!!document.querySelector('.scrubbar.show')`);
      if (shown) break;
    }
    const info = await evalJS(`(()=>{const b=document.querySelector('.scrubbar');return JSON.stringify({hasBar:!!b,shown:b?b.classList.contains('show'):false,time:document.querySelector('.scrubbar .sb-time')?.textContent,name:document.querySelector('.scrubbar .sb-name')?.textContent});})()`);
    console.log('INFO', info);
    for (const f of FRACS) {
      const r = await evalJS(`(()=>{const bar=document.querySelector('.scrubbar.show')||document.querySelector('.scrubbar');if(!bar)return 'no-bar';const rg=bar.querySelector('.sb-range');rg.value=String(Math.round(${f}*10000));rg.dispatchEvent(new Event('pointerdown',{bubbles:true}));rg.dispatchEvent(new Event('input',{bubbles:true}));return (bar.querySelector('.sb-time')?.textContent||'')+'  ['+(bar.querySelector('.sb-label')?.textContent||'')+']';})()`);
      await sleep(280);
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      const file = `/tmp/st-scrub-${STEP}-${String(Math.round(f * 100)).padStart(2, '0')}${light ? '-light' : ''}.png`;
      writeFileSync(file, Buffer.from(data, 'base64'));
      console.log('seek', f, '->', r, '=>', file);
    }
    if (logs.length) console.log('LOGS\n' + logs.slice(-16).join('\n'));
  } catch (e) { console.error('ERR', e.message); } finally { try { ws?.close(); } catch {} chrome.kill(); process.exit(0); }
})();
