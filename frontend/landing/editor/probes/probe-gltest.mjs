// Decisive test: can headless Chrome create a (software) WebGL context at all?
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
const DBG = 9317;
const profile = mkdtempSync(join(tmpdir(), 'st-gl-'));
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${DBG}`,
  `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--no-sandbox',
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJSON = async (p) => (await fetch(`http://localhost:${DBG}${p}`)).json();
let ws, msgId = 0; const pending = new Map();
const send = (m, p = {}) => new Promise((res, rej) => { const id = ++msgId; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evalJS = async (e) => { const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: e, returnByValue: true }); if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || 'err'); return result.value; };
(async () => {
  try {
    let t; for (let i = 0; i < 30; i++) { try { const l = await getJSON('/json'); t = l.find((x) => x.type === 'page'); if (t?.webSocketDebuggerUrl) break; } catch {} await sleep(200); }
    ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false });
    await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
    ws.on('message', (d) => { const m = JSON.parse(d); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } });
    await send('Runtime.enable');
    const out = await evalJS(`(()=>{const c=document.createElement('canvas');const gl=c.getContext('webgl2')||c.getContext('webgl');if(!gl)return 'NO WEBGL';const dbg=gl.getExtension('WEBGL_debug_renderer_info');return 'OK · '+(dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.VERSION));})()`);
    console.log('WEBGL:', out);
  } catch (e) { console.error('ERR', e.message); } finally { try { ws?.close(); } catch {} chrome.kill(); process.exit(0); }
})();
