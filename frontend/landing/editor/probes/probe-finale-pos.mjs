// Numeric verification: drive finale-stage.html to a given t and dump each moving piece's world
// position + the board square it's nearest to, so chess-correctness is checked by coordinates, not by eye.
// Usage: GL=sw node editor/probes/probe-finale-pos.mjs <t1> <t2> ...
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
const PORT = process.env.PORT || 5173;
const TIMES = process.argv.slice(2).map(Number).filter((n) => !Number.isNaN(n));
const TS = TIMES.length ? TIMES : [18.2];
const URL = `http://localhost:${PORT}/frontend/landing/editor/probes/finale-stage.html?t=${TS[0]}`;
const DBG = 9324;
const profile = mkdtempSync(join(tmpdir(), 'st-chrome-'));
const glFlags = process.env.GL === 'sw'
  ? ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  : ['--disable-gpu'];
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${DBG}`,
  `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', ...glFlags, '--window-size=800,600', URL], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJSON = async (p) => (await fetch(`http://localhost:${DBG}${p}`)).json();
let ws, msgId = 0; const pending = new Map();
const send = (m, p = {}) => new Promise((res, rej) => { const id = ++msgId; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method: m, params: p })); });
const evalJS = async (e) => { const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || 'err'); return result.value; };
(async () => {
  try {
    let t; for (let i = 0; i < 40; i++) { try { const l = await getJSON('/json'); t = l.find((x) => x.type === 'page' && x.url.includes('finale-stage')); if (t?.webSocketDebuggerUrl) break; } catch {} await sleep(250); }
    ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 1 << 28 });
    await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
    const errs = [];
    ws.on('message', (d) => { const m = JSON.parse(d); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } else if (m.method === 'Runtime.exceptionThrown') errs.push('EXC: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').slice(0, 160)); else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push('console.error: ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 160)); });
    await send('Runtime.enable');
    for (let i = 0; i < 40; i++) { await sleep(1000); const r = await evalJS(`!!window.__enderReady || !!window.__enderErr`); if (r) break; }
    const err = await evalJS('window.__enderErr || ""'); if (err) { console.log('SCENE ERR:', err); throw new Error(err); }
    // setup the classifier once
    await evalJS(`window.__probe = (function(){
      const v = window.__ender; const FILES='abcdefgh';
      const grid = {}; for (const f of FILES) for (let r=1;r<=8;r++){ const s=f+r; const p=v.squareXYZ(s); grid[s]=[p.x,p.z]; }
      function nearest(x,z){ let best=null,bd=1e9; for(const s in grid){ const dx=x-grid[s][0], dz=z-grid[s][1]; const d=dx*dx+dz*dz; if(d<bd){bd=d;best=s;} } return best+' (d='+Math.sqrt(bd).toFixed(3)+')'; }
      const tracked = { 'blackKnight(f6)':'f6','queen(d3)':'d3','blackKing(e8)':'e8','bishop(d2)':'d2','whiteKnight(e4)':'e4' };
      return function(){ const row={}; for(const lab in tracked){ const g=v.pieces.get(tracked[lab]); if(!g){row[lab]='MISSING';continue;} v.scene.updateMatrixWorld(true); const wp=new (g.position.constructor)(); g.getWorldPosition(wp); row[lab]={near:nearest(wp.x,wp.z), y:+wp.y.toFixed(3), vis:g.visible, opacity:(g.userData.material&&g.userData.material.opacity!=null)?+g.userData.material.opacity.toFixed(2):'-'}; }
        row.badge = v.badgeAt ? v.badgeAt(window.__T) : '-'; return JSON.stringify(row); };
    })(); 'ok'`);
    const out = {};
    for (const tt of TS) {
      await evalJS(`window.__T=${tt}; window.__setT(${tt})`);   // drive via the harness clock (avoids racing its rAF loop)
      await sleep(+process.env.READMS || 260);                   // let the loop apply frame(tt) before reading (raise under slow SwiftShader)
      out['t=' + tt] = JSON.parse(await evalJS('window.__probe()'));
    }
    out.camera = await evalJS('(function(){const c=window.__ender.camera.position;return {x:+c.x.toFixed(2),y:+c.y.toFixed(2),z:+c.z.toFixed(2)};})()');
    console.log(JSON.stringify(out, null, 1));
    console.log(errs.length ? 'PAGE ERRORS:\n' + errs.slice(0, 8).join('\n') : 'no page errors');
  } catch (e) { console.error('ERR', e.message); } finally { try { ws?.close(); } catch {} chrome.kill(); process.exit(0); }
})();
