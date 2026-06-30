// ===== Performance manager — the root "runs smooth on almost any device" strategy =====
// One QUALITY object every 3D module reads, chosen from cheap device signals at boot AND continuously
// corrected by a measured-FPS watchdog. The page therefore self-tunes: it starts conservative on weak
// hardware and, if real frames are still janky, progressively LOWERS render resolution and DISABLES 3D
// scenes live until it's smooth — regardless of what the static guess got wrong.
//
// Biggest lever by far is devicePixelRatio: render cost is ~quadratic in DPR, so a DPR-3 phone forced to
// 1.0 draws ~1/9 the pixels — that alone unblocks most weak GPUs. Then: no MSAA, fewer simultaneous WebGL
// contexts (the hovering hero is dropped first on weak devices; the spinning gears are kept longest), and
// an FPS cap.

// ---- device signals ------------------------------------------------------------------------------
// Two DISTINCT questions, kept separate on purpose (conflating them was the bug that blanked the hero
// on every GPU-less box — Linux VMs, crostini, CI): (1) is there a WebGL context AT ALL, and (2) is it
// a *software* renderer. No context → DOM-only fallback. Software context → renders, just slowly, so we
// still show the 3D and let the FPS watchdog demote live if real frames are janky.
function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) return false;
    const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
    return true;
  } catch (e) { return false; }
}
function isSoftwareGL() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) return false;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '') : '';
    const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
    return /swiftshader|software|llvmpipe|microsoft basic|mesa offscreen/i.test(r);
  } catch (e) { return false; }
}
function detectTier() {
  try {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 'min';
    if (!hasWebGL()) return 'min';                 // truly no WebGL → DOM fallback only
    // Software GL (SwiftShader / llvmpipe) CAN render, just slowly → treat as 'low' (full 3D at dpr 1.0).
    // The watchdog drops it live only if real frames actually jank. Was 'min' here, which blanked the
    // hero + coach on every GPU-passthrough-less box even though they render fine on a real GPU.
    if (isSoftwareGL()) return 'low';
    const n = navigator;
    if (n.connection && n.connection.saveData) return 'low';
    if (n.deviceMemory && n.deviceMemory <= 2) return 'low';
    const cores = n.hardwareConcurrency || 4;
    const mobile = /Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle/i.test(n.userAgent || '');
    if (mobile) return 'low';
    // A 4-core *desktop* with a real GPU runs the hovering hero fine — core count is a poor proxy for
    // GPU power, so don't blank the hero on it. (Mobile/saveData/low-RAM already fell through to 'low'.)
    if (cores <= 8) return 'mid';
    return 'high';
  } catch (e) { return 'low'; }   // anything unexpected → assume weak (but still render)
}

// ---- quality presets per tier --------------------------------------------------------------------
// hero   = the hovering hero pieces (heaviest: two full-screen contexts).
// gears  = the spinning decorative gears — KEPT longest (the user likes them).
// cinema = the coach + finale story cinematics.
// Only 'min' (no WebGL / reduced-motion) starts with 3D OFF. Every WebGL-capable tier renders the hero
// at boot; if real frames jank, the watchdog demotes in the user's priority order (hero dropped FIRST,
// gears last). So "drop the hero on weak devices" is now a measured, live decision — not a boot guess.
const PRESETS = {
  min:  { dpr: 1.0,  antialias: false, fpsCap: 30, hero: false, gears: false, cinema: false },
  low:  { dpr: 1.0,  antialias: false, fpsCap: 30, hero: true,  gears: true,  cinema: true  },
  mid:  { dpr: 1.25, antialias: false, fpsCap: 36, hero: true,  gears: true,  cinema: true  },
  high: { dpr: 1.5,  antialias: true,  fpsCap: 45, hero: true,  gears: true,  cinema: true  },
};

// `?perf=high|mid|low|min` forces a tier — for testing/debugging on a specific device.
function tierOverride() {
  try { const p = new URLSearchParams(location.search).get('perf'); if (p && PRESETS[p]) return p; } catch (e) {}
  return null;
}
const _tier = tierOverride() || detectTier();
export const QUALITY = { tier: _tier, ...PRESETS[_tier] };
// expose for debugging — check `__perf.tier` in the console to see what the device was classified as
try { window.__perf = QUALITY; } catch (e) {}

// ---- renderer registry (so the watchdog can change pixel ratio live — runtime-safe, unlike MSAA) --
const _renderers = new Set();
export function registerRenderer(renderer) {
  _renderers.add(renderer);
  try { renderer.setPixelRatio(Math.min(devicePixelRatio, QUALITY.dpr)); } catch (e) {}
  return renderer;
}
function applyDprToAll() {
  _renderers.forEach((r) => { try { r.setPixelRatio(Math.min(devicePixelRatio, QUALITY.dpr)); } catch (e) {} });
}
function applyLiteClasses() {
  const b = document.body;
  b.classList.toggle('no-hero', !QUALITY.hero);
  b.classList.toggle('lite-gears', !QUALITY.gears);
  b.classList.toggle('lite-cinema', !QUALITY.cinema);
}

// ---- graduated demotion: each call applies the next-cheapest relief, in the user's priority order ----
// lower DPR → drop the hovering hero → lower DPR → drop the story → lower DPR → drop the gears (last).
const _demoteCbs = [];
export function onDemote(cb) { _demoteCbs.push(cb); }
let _demoted = false;
function demote(reason) {
  let did = true;
  if (QUALITY.dpr > 1.0) { QUALITY.dpr = 1.0; }
  else if (QUALITY.hero) { QUALITY.hero = false; }                       // drop the hovering first
  else if (QUALITY.dpr > 0.8) { QUALITY.dpr = 0.8; QUALITY.fpsCap = 30; }
  else if (QUALITY.cinema) { QUALITY.cinema = false; }                   // then the story
  else if (QUALITY.dpr > 0.6) { QUALITY.dpr = 0.6; QUALITY.fpsCap = 24; }
  else if (QUALITY.gears) { QUALITY.gears = false; }                     // spinning gears dropped last
  else did = false;                                                     // already minimal
  if (!did) return false;
  _demoted = true;
  applyDprToAll();
  applyLiteClasses();
  _demoteCbs.forEach((cb) => { try { cb(QUALITY); } catch (e) {} });
  try { console.warn(`[perf] demote (${reason}) → tier-ish dpr=${QUALITY.dpr} hero=${QUALITY.hero} cinema=${QUALITY.cinema} gears=${QUALITY.gears}`); } catch (e) {}
  return true;
}

// ---- adaptive FPS watchdog -----------------------------------------------------------------------
// Counts dropped frames (interval > 33ms ≈ slower than 30fps) over rolling ~1s windows. Two consecutive
// bad windows → one demotion, then a cooldown so the relief can take effect before re-judging. One-way.
export function startWatchdog() {
  applyLiteClasses();                          // reflect the boot tier immediately
  if (QUALITY.tier === 'min') return;          // nothing heavy to watch
  let winStart = performance.now(), last = winStart, frames = 0, dropped = 0, badStreak = 0, cooldownUntil = 0;
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = now - last; last = now;
    frames++; if (dt > 33) dropped++;
    if (now - winStart < 1000) return;
    const ratio = dropped / Math.max(1, frames);
    winStart = now; frames = 0; dropped = 0;
    if (now < cooldownUntil) return;
    if (ratio > 0.3) {                         // >30% of frames dropped this second
      if (++badStreak >= 2) { if (demote('sustained jank')) { cooldownUntil = now + 2500; } badStreak = 0; }
    } else { badStreak = 0; }
  }
  requestAnimationFrame(tick);
}

// ---- fps gate (reads the LIVE cap, so demotion tightens every loop at once) -----------------------
export function fpsGate() {
  let last = -1e9;
  return function gate() {
    const now = performance.now();
    if (now - last < 1000 / QUALITY.fpsCap) return false;
    last = now;
    return true;
  };
}
