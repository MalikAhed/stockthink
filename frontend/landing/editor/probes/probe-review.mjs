import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
const URL = 'http://localhost:5173/frontend/landing/index.html';
const PORT = 9314;
// offsets (ms from when the demo fires) to screenshot; light theme if 'light' passed
const args = process.argv.slice(2);
const light = args.includes('light');
const offs = args.filter((a) => /^\d+$/.test(a)).map(Number);
const OFFS = offs.length ? offs : [2500, 4700, 9300];
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
    ws.on('message', (d) => { const m = JSON.parse(d); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } else if (m.method === 'Runtime.consoleAPICalled') logs.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`); else if (m.method === 'Runtime.exceptionThrown') logs.push('EXC: ' + (m.params.exceptionDetails.exception?.description || '')); });
    await send('Page.enable'); await send('Runtime.enable');
    await sleep(4500);
    await evalJS('document.getElementById("load")?.classList.add("done");document.body.classList.remove("pre-intro")');
    if (light) await evalJS('document.body.classList.add("light")');
    await evalJS(`document.documentElement.style.scrollBehavior='auto'`);
    // scroll the merged review section to centre so demoIO fires playBest
    for (let i = 0; i < 10; i++) {
      await evalJS(`(()=>{const s=document.querySelector('section[data-step="3"]');const r=s.getBoundingClientRect();window.scrollTo(0, r.top+scrollY - innerHeight/2 + r.height/2);})()`);
      await sleep(500);
      const k = await evalJS(`document.getElementById('board4')?.children.length||0`);
      if (k > 0) break;
    }
    const info = await evalJS(`(()=>{const b=document.getElementById('board4');const w=document.getElementById('r2Win');const r=w?w.getBoundingClientRect():null;return JSON.stringify({hasBoard:!!b,kids:b?b.children.length:0,winRect:r?{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}:null,bodyClasses:document.body.className,scrollY:Math.round(scrollY)});})()`);
    console.log('INFO', info);
    let last = 0;
    for (const off of OFFS) {
      await sleep(off - last); last = off;
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      const f = `/tmp/st-rev-${off}${light ? '-light' : ''}.png`;
      writeFileSync(f, Buffer.from(data, 'base64'));
      console.log('saved', f);
    }
    if (logs.length) console.log('LOGS\n' + logs.slice(-12).join('\n'));
  } catch (e) { console.error('ERR', e.message); } finally { try { ws?.close(); } catch {} chrome.kill(); process.exit(0); }
})();
