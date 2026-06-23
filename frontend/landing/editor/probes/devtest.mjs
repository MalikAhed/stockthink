// Headless-Chrome test harness for the live Edit Interface (dev only).
// Launches google-chrome --headless, drives it over CDP (raw ws), exercises the
// editor's pick flow on REAL coordinates, and reports what got picked/selected.
// Run: node frontend/landing/editor/devtest.mjs   (needs `npm run dev` running)
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';

const URL = 'http://localhost:5173/frontend/landing/index.html';
const PORT = 9311;
const profile = mkdtempSync(join(tmpdir(), 'st-chrome-'));

const chrome = spawn('google-chrome', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--window-size=1280,900', URL,
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJSON(path) {
  const res = await fetch(`http://localhost:${PORT}${path}`);
  return res.json();
}

let ws, msgId = 0;
const pending = new Map();
const consoleLogs = [];
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evalJS(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || JSON.stringify(exceptionDetails));
  return result.value;
}
async function mouse(type, x, y, button = 'none', clickCount = 0) {
  await send('Input.dispatchMouseEvent', { type, x, y, button, clickCount, buttons: button === 'left' && type !== 'mouseReleased' ? 1 : 0 });
}

(async () => {
  try {
    // wait for the debug endpoint + a page target
    let target;
    for (let i = 0; i < 40; i++) {
      try { const list = await getJSON('/json'); target = list.find((t) => t.type === 'page' && t.url.includes('localhost:5173')); if (target?.webSocketDebuggerUrl) break; } catch {}
      await sleep(250);
    }
    if (!target) throw new Error('no page target — is `npm run dev` running?');

    ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
    await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
    ws.on('message', (data) => {
      const m = JSON.parse(data);
      if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
      else if (m.method === 'Runtime.consoleAPICalled') consoleLogs.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
      else if (m.method === 'Runtime.exceptionThrown') consoleLogs.push(`EXCEPTION: ${m.params.exceptionDetails.exception?.description || ''}`);
    });
    await send('Page.enable'); await send('Runtime.enable');

    // poll for the editor to boot (WebGL-failure retries can delay main.js a few seconds)
    let ready = false;
    for (let i = 0; i < 40; i++) { ready = await evalJS('!!window.__sted && !!document.getElementById("st-ed-launch")'); if (ready) break; await sleep(300); }
    console.log('editor loaded:', ready);
    if (!ready) throw new Error('editor (__sted) not present');
    // Headless has no WebGL, so scene.js throws on import and never hides the
    // full-screen #load overlay. Dismiss it so it doesn't intercept every click
    // (in the real browser the preloader does this once 3D is ready).
    await evalJS('document.getElementById("load")?.classList.add("done"); document.body.classList.add("no-hero","loaded")');

    // open via the real launcher button + enable pick via the real Pick button
    await evalJS('document.getElementById("st-ed-launch").click()');
    await sleep(150);
    await evalJS('document.getElementById("sted-pick").click()');
    console.log('isOpen:', await evalJS('window.__sted.isOpen'), '| picking (after Pick button):', await evalJS('window.__sted.picking'));

    // scroll each target into view, then probe + real hover + click
    const sels = ['nav .brand', '.s1title', '#anBtn', '.lead', '.rev-explain-card', '.progtrack'];
    for (const sel of sels) {
      const c = await evalJS(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if(!el) return null; el.scrollIntoView({block:'center', behavior:'instant'}); const r = el.getBoundingClientRect(); return [Math.round(r.left+r.width/2), Math.round(r.top+r.height/2)]; })()`);
      if (!c) { console.log(`  ${sel}: (missing)`); continue; }
      await sleep(250);
      // recompute after scroll
      const c2 = await evalJS(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); const r = el.getBoundingClientRect(); return [Math.round(r.left+r.width/2), Math.round(r.top+r.height/2)]; })()`);
      const [cx, cy] = c2;
      await evalJS('window.__sted.pick(true)');
      await mouse('mouseMoved', cx, cy);
      await sleep(80);
      const hl = await evalJS('window.__sted.hlShown()');
      await mouse('mousePressed', cx, cy, 'left', 1);
      await mouse('mouseReleased', cx, cy, 'left', 1);
      await sleep(100);
      const selInfo = await evalJS('window.__sted.selInfo()');
      console.log(`  ${sel} @(${cx},${cy})  hover-hl=${hl}  picked=`, selInfo);
    }

    // dump the tree the user sees (top + a couple levels)
    const tree = await evalJS(`(() => {
      const rows = [...document.querySelectorAll('#sted-tree .st-ed-row')].slice(0, 30);
      return rows.map(r => { const chip = r.querySelector('.st-ed-chip'); const name = r.querySelector('.st-ed-name'); const depth = (()=>{let d=0,n=r.closest('.st-ed-node'); while(n){n=n.parentElement.closest('.st-ed-node'); d++;} return d;})(); return '  '.repeat(depth-1) + (chip?chip.textContent:'?') + ' · ' + (name?name.textContent:''); });
    })()`);
    console.log('\nTREE (top 30 rows):\n' + tree.join('\n'));

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync('/tmp/st-editor-shot.png', Buffer.from(shot.data, 'base64'));
    console.log('\nscreenshot -> /tmp/st-editor-shot.png');

    console.log('\n--- console logs ---\n' + (consoleLogs.join('\n') || '(none)'));
  } catch (err) {
    console.error('TEST ERROR:', err.message);
  } finally {
    try { ws?.close(); } catch {}
    chrome.kill('SIGKILL');
    process.exit(0);
  }
})();
