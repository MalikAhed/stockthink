// DEV-ONLY frame capturer: drive record/studio.html one deterministic frame at a time and screenshot
// each to a PNG sequence. editor/encode.mjs then muxes them to video with ffmpeg.
//   GL=sw PORT=5180 SCENE=ender FRAMES=180 W=1920 H=1080 SS=1.5 OUT=/tmp/rec/ender node editor/record.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';

const PORT = process.env.PORT || 5180;
const SCENE = process.env.SCENE || 'ender';
const FRAMES = parseInt(process.env.FRAMES || '180', 10);   // TOTAL frames (defines p = f/(FRAMES-1))
const FSTART = parseInt(process.env.FSTART || '0', 10);      // this instance renders [FSTART, FEND) — for parallel slices
const FEND = parseInt(process.env.FEND || String(FRAMES), 10);
const W = parseInt(process.env.W || '1920', 10);
const H = parseInt(process.env.H || '1080', 10);
const SS = process.env.SS || '1.5';
const OUT = process.env.OUT || `/tmp/rec/${SCENE}`;
const DBG = parseInt(process.env.DBG || '9360', 10);        // unique per parallel instance
// URLPATH lets the same recorder drive either the Vite dev server (default) or a flat static server
// (Colab serves the render bundle at /record/studio.html — see the Colab notebook).
const URLPATH = process.env.URLPATH || '/frontend/landing/record/studio.html';
const url = `http://localhost:${PORT}${URLPATH}?scene=${SCENE}&perf=high&ss=${SS}`;
// GL=sw → SwiftShader (this GPU-less box). GL=gpu → real GPU via ANGLE/EGL (Colab T4, ~50× faster).
const glFlags = process.env.GL === 'sw'
  ? ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  : process.env.GL === 'gpu'
  ? ['--no-sandbox', '--enable-gpu', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl', '--enable-features=Vulkan,UseSkiaRenderer']
  : ['--use-gl=angle'];

// Only the lead slice (FSTART===0) clears the dir; parallel slices must not wipe each other's frames.
if (FSTART === 0 && process.env.CLEAR !== '0') rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'st-rec-'));
const chrome = spawn('google-chrome', ['--headless=new', `--remote-debugging-port=${DBG}`,
  `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', ...glFlags,
  // keep rAF + timers running at full rate; a headless page is "hidden" and Chrome otherwise throttles it
  // to a near-halt, which hangs frame capture after a while.
  '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
  '--hide-scrollbars', `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJSON = async (p) => (await fetch(`http://localhost:${DBG}${p}`)).json();
let ws, id = 0; const pend = new Map();
const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async (e) => { const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || 'eval err'); return result.value; };

(async () => {
  const t0 = Date.now();
  try {
    let t; for (let i = 0; i < 40; i++) { try { const l = await getJSON('/json'); t = l.find((x) => x.type === 'page'); if (t?.webSocketDebuggerUrl) break; } catch {} await sleep(250); }
    ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 1 << 30 });
    await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
    ws.on('message', (d) => { const m = JSON.parse(d); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } });
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url });
    // wait for the studio to finish building the scene (it loads GLBs)
    let ready = false;
    for (let i = 0; i < 120; i++) {
      await sleep(500);
      const st = await ev('JSON.stringify({ready:!!(window.RB&&window.RB.ready), err:window.RB&&window.RB.error})').catch(() => null);
      if (st) { const s = JSON.parse(st); if (s.err) throw new Error('studio: ' + s.err); if (s.ready) { ready = true; break; } }
    }
    if (!ready) throw new Error('studio never became ready');
    const glr = await ev('window.RB && window.RB.glRenderer').catch(() => null);
    console.log(`GL renderer  : ${glr || 'unknown'}   ${/swiftshader|llvmpipe|software/i.test(glr || '') ? '(CPU/software)' : ''}`);
    console.log(`studio ready (${SCENE}) — capturing frames [${FSTART},${FEND}) of ${FRAMES} at ${W}x${H} ss=${SS}`);
    for (let f = FSTART; f < FEND; f++) {
      const p = FRAMES === 1 ? 0 : f / (FRAMES - 1);
      await ev(`window.RB.frame(${p})`);     // synchronous render to the canvas (no in-page rAF — that can hang headless)
      await sleep(30);                        // node-side beat so the GL buffer is ready for compositing
      const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      writeFileSync(join(OUT, `f${String(f).padStart(4, '0')}.png`), Buffer.from(data, 'base64'));
      if ((f - FSTART) % 10 === 0 || f === FEND - 1) console.log(`  [${FSTART}-${FEND}) frame ${f}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
    console.log(`DONE slice [${FSTART},${FEND}) — ${OUT}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  } catch (e) { console.error('ERR', e.message); process.exitCode = 1; } finally { try { ws?.close(); } catch {} chrome.kill(); try { rmSync(profile, { recursive: true, force: true }); } catch {} process.exit(); }
})();
