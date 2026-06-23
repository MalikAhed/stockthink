// Landing-page entry point.
// Loads GSAP from npm (was a CDN <script>), exposes it as window.gsap for the
// scene's intro animation, then boots the modules in dependency order:
//   pieces (asset manifest) -> scene (three.js) -> sections (scroll demos) -> ui.
import gsap from 'gsap';
import { QUALITY, startWatchdog } from './perf.js';
window.gsap = gsap;

await import('./pieces.js');

// ---- preloader dismissal — INDEPENDENT of the 3D hero --------------------------------------------
// The #load curtain is normally dismissed by scene.js once the hero is warmed up. But on weak devices
// the hero never loads (QUALITY.hero === false), so that dismissal never runs and the page sticks at
// 0% forever. So own a dismissal here too. It's idempotent with scene.js's (adding `.done` twice is a
// no-op), and a backstop timer guarantees the curtain can never trap the page if the hero path hangs.
function dismissLoader() {
  const load = document.getElementById('load');
  if (!load || load.classList.contains('done')) return;
  const bar = document.getElementById('loadBar'); if (bar) bar.style.width = '100%';
  const pct = document.getElementById('loadPct'); if (pct) pct.textContent = '100%';
  const w = document.getElementById('loadWord'); if (w) for (const s of w.children) s.classList.add('lit');
  // setTimeout, not requestAnimationFrame: rAF is throttled to a near-halt in backgrounded/hidden tabs,
  // which would strand the curtain at 100% without ever fading. A timer still fires (clamped) and lets
  // the 100% paint for a beat before the CSS opacity fade. Idempotent guard above makes double-calls safe.
  setTimeout(() => load.classList.add('done'), 200);
}
// Backstop: never let the curtain trap the page. If anything in the hero preloader stalls (slow GLB
// fetch on a weak connection, decoder hiccup), force the page visible after a bounded wait — no tier.
setTimeout(dismissLoader, 9000);

// The 3D hero is the heaviest thing on the page (two full-screen WebGL contexts). It needs WebGL AND a
// device that can afford it. The perf manager decides: on weak devices QUALITY.hero is false, so we skip
// it entirely and fall back to the static wordmark — the same fallback used when WebGL can't initialise.
function heroFallback() {
  document.body.classList.add('no-hero');
  // The 3D intro normally clears `pre-intro` (which hides the nav/wordmark/tagline);
  // without it they'd stay invisible, so reveal them here.
  document.body.classList.remove('pre-intro');
  // The scroll engine gates the wordmark/tagline outro on HERO_READY (set only by scene.js). With no
  // hero, set it so scrolling past the masthead still fades it out instead of freezing it on screen.
  window.HERO_READY = true;
  // No hero means scene.js never runs — so dismiss the loader here, or the page sticks at 0%.
  dismissLoader();
}
if (QUALITY.hero) {
  try {
    await import('./scene.js');
  } catch (err) {
    console.warn('[landing] 3D hero unavailable — continuing without it:', err);
    heroFallback();
  }
} else {
  heroFallback();   // weak device: skip the hovering hero, keep the rest
}

await import('./scroll-engine.js');   // hero outro + hook morph (scroll-scrubbed motion)
await import('./sections.js');        // per-step demo controller + reveal observers
await import('./number-to-reason.js');// Beat 2 "number → reason" cinematic (self-contained, own observer)

await import('./ui.js');              // nav theme toggle + the "why" colour-sync (cheap DOM)

// ---- below-the-fold 3D: load LAZILY, never at boot --------------------------------------------
// Each of these spins up its OWN WebGL context and parses GLBs. Creating all of them at boot is
// what janked the hero intro and every scroll. Instead: arm an approach-observer per section
// (loads ~3 screens early — the safety net for fast scrollers) AND idle-preload them in the
// background once the browser is free after the intro. Whichever fires first wins; the render
// loops are visibility-gated (only the on-screen scene draws), so off-screen scenes cost nothing.
function lazy3D(selector, importer, label) {
  let started = false;
  const go = () => {
    if (started) return Promise.resolve();
    started = true;
    return importer().catch((err) => console.warn(`[landing] ${label} unavailable — continuing:`, err));
  };
  const el = document.querySelector(selector);
  if (el) {
    const io = new IntersectionObserver((ents) => {
      if (ents.some((e) => e.isIntersecting)) { io.disconnect(); go(); }
    }, { rootMargin: '300% 0px' });
    io.observe(el);
  }
  return go;   // also callable directly (idle preload below)
}
// Which below-the-fold 3D loads is tier-gated by the perf manager: the spinning gears (QUALITY.gears)
// are kept longest; the coach + finale cinematics (QUALITY.cinema) load only when the device can afford
// them. A weak device simply never spins these contexts up — the sections degrade to their DOM content.
const heavy3D = [];
if (QUALITY.gears) {
  heavy3D.push(lazy3D('.gearSec', () => import('./gears.js'), '3D gears'));
  heavy3D.push(lazy3D('.sf-stage', () => import('./logoGears.js'), 'logo gears'));
}
if (QUALITY.cinema) {
  heavy3D.push(lazy3D('section.coach', () => import('./coach.js'), 'coach cinematic'));
}
// The finale is a pre-rendered video (no WebGL) — load its tiny controller on EVERY device regardless of
// tier. That's the whole point of the video swap: the cinematic plays smooth even on the weakest GPU.
import('./ender-video.js').catch((err) => console.warn('[landing] ender video unavailable:', err));
// Idle-preload, fully staggered (await each → parses never overlap), so they're ready before you
// reach them but never compete with the intro. Start only AFTER the intro has settled (~3s) — an
// idle callback firing in a gap mid-intro could parse a GLB and drop a frame. Fast scrollers are
// covered by the approach-observers above, so this delay never leaves a section empty when reached.
const onIdle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 300));
setTimeout(() => { (function pump(i) { if (i >= heavy3D.length) return; onIdle(async () => { await heavy3D[i](); pump(i + 1); }); })(0); }, 3000);

// Boot the adaptive FPS watchdog: it applies the chosen tier's lite classes immediately and then, if real
// frames are still janky, progressively lowers DPR and disables 3D (hovering hero → cinematics → gears).
startWatchdog();

// Dev-only live Edit Interface (visual editor → editor/edits.json). Never ships:
// import.meta.env.DEV is statically false in the production build, so Vite
// tree-shakes the whole module out.
if (import.meta.env.DEV) {
  import('./editor/editor.js').catch((err) => console.warn('[landing] edit interface failed to load:', err));
}
