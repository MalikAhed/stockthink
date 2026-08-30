// Landing-page entry point.
// Loads GSAP from npm (was a CDN <script>), exposes it as window.gsap for the
// scene's intro animation, then boots the modules in dependency order:
//   pieces (asset manifest) -> scene (three.js) -> sections (scroll demos) -> ui.
import gsap from 'gsap';
import { QUALITY, startWatchdog } from './perf.js';
window.gsap = gsap;

await import('./pieces.js');

// ---- preloader dismissal for the explicit DOM-only fallback -------------------------------------
// A successful 3D boot is dismissed only by scene.js after strict asset + GPU readiness. This helper
// exists for devices without WebGL and for genuine load failures, where no piece animation will run.
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
// what janked the hero intro and exhausted GPU memory on phones. Build a scene only when its section
// is approaching; offscreen render loops are visibility-gated, and unopened scenes allocate nothing.
function lazy3D(selector, importer, label, screensAhead = 2) {
  let task = null;
  const go = () => {
    if (task) return task;
    task = importer().catch((err) => console.warn(`[landing] ${label} unavailable — continuing:`, err));
    return task;
  };
  const el = document.querySelector(selector);
  if (el) {
    const verticalMargin = Math.round(innerHeight * screensAhead);
    const io = new IntersectionObserver((ents) => {
      if (ents.some((e) => e.isIntersecting)) { io.disconnect(); go(); }
    }, { rootMargin: `${verticalMargin}px 0px` });
    io.observe(el);
  }
  return go;
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
  const coachPreload = lazy3D('section.coach', async () => {
    const mod = await import('./coach.js'); await mod.coachReady;
  }, 'coach cinematic', 5);
  const enderPreload = lazy3D('section.ender', async () => {
    const mod = await import('./ender.js'); await mod.enderReady;
  }, 'ender finale', 7);
  heavy3D.push(coachPreload, enderPreload);

  // Use the user's first real downward scroll as the signal to prepare the remaining story. Work is
  // sequential (coach, then finale) and starts in idle time, so two large WebGL scenes never parse at
  // once or compete with the hero intro. The wide observers above remain a fast-scroll safety net.
  let scrollPreloadArmed = true;
  const idle = (fn) => window.requestIdleCallback
    ? requestIdleCallback(fn, { timeout: 1800 })
    : setTimeout(fn, 120);
  const preloadStory = () => {
    if (!scrollPreloadArmed || scrollY < 24) return;
    scrollPreloadArmed = false;
    removeEventListener('scroll', preloadStory);
    idle(async () => { await coachPreload(); idle(() => enderPreload()); });
  };
  addEventListener('scroll', preloadStory, { passive: true });
  preloadStory(); // covers a fast scroll that happened while the post-hero modules were still importing
}

// Boot the adaptive FPS watchdog: it applies the chosen tier's lite classes immediately and then, if real
// frames are still janky, progressively lowers DPR and disables 3D (hovering hero → cinematics → gears).
startWatchdog();

// Dev-only live Edit Interface (visual editor → editor/edits.json). Never ships:
// import.meta.env.DEV is statically false in the production build, so Vite
// tree-shakes the whole module out.
if (import.meta.env.DEV) {
  import('./editor/editor.js').catch((err) => console.warn('[landing] edit interface failed to load:', err));
}
