// Finale controller (data-step: the ender). PHASE 1: lazily builds the basement scene when
// the section nears, parks the camera on the establishing shot, renders only while the section
// is in view, and flips the whole page to black (the cinematic theme) on approach.
// PHASE 2 will map section scroll -> a camera timeline; PHASE 3 adds the move beats + effects.
import { fpsGate, QUALITY } from './perf.js';
const section = document.querySelector('section.ender');
const canvas = document.getElementById('enderScene');
if (section && canvas) {
  const enderGate = fpsGate();   // cap below display refresh — near-static cinematic set
  let view = null;        // the scene api once built
  let building = false;
  let active = false;     // section in view -> run the rAF loop
  let raf = 0;
  let scrollP = 0;        // 0..1 camera progress along the sticky scroll track

  // ---- the fade-to-black transition (both themes) ------------------------------------------------
  // A fixed black veil fades the WHOLE screen to black as the finale rises in, so the coach cinematic
  // DISSOLVES to black instead of hard-cutting; then the basement scene cross-fades in on top of it
  // (the canvas's own opacity). Reversible, and it clears again as the section leaves so the footer/CTA
  // below is never covered. The camera dolly runs off the same scroll progress (view.setShot).
  const fade = document.createElement('div');
  fade.className = 'ender-fade';
  document.body.appendChild(fade);

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  function onScroll() {
    if (!QUALITY.cinema) { fade.style.opacity = '0'; return; }      // cinematics disabled → no veil (section is hidden)
    const r = section.getBoundingClientRect();
    const approachP = clamp01(1 - r.top / innerHeight);             // 0→1 as the section's top rises into view
    const revealP = clamp01(-r.top / (innerHeight * 0.6));          // 0→1 over the first ~⅔ viewport once pinned
    // Fade-to-black, then fade-from-black — with NO hard edge and NO light leak:
    //  · approach: the whole screen fades to black via the veil (section bg is transparent, so it's uniform).
    //  · reveal phase A: the scene canvas fades to OPAQUE while the veil is still full black (so it's hidden).
    //  · reveal phase B: the veil lifts, uncovering the now-opaque scene.
    canvas.style.opacity = String(clamp01(revealP / 0.5));                            // opaque by the halfway point
    fade.style.opacity = String(approachP * (1 - clamp01((revealP - 0.5) / 0.5)));   // holds black, then lifts
    const track = Math.max(1, section.offsetHeight - innerHeight);
    scrollP = clamp01((scrollY - section.offsetTop) / track);       // drives the camera dolly (applied in loop)
  }
  let scrollTick = false;
  addEventListener('scroll', () => { if (scrollTick) return; scrollTick = true;
    requestAnimationFrame(() => { onScroll(); scrollTick = false; }); }, { passive: true });
  addEventListener('resize', () => { if (view) view.resize(); onScroll(); });
  onScroll();

  async function ensureScene() {
    if (view || building) return;
    building = true;
    try {
      const { createEnderScene } = await import('./ender-scene.js');
      view = await createEnderScene(canvas);
      view.resize();
      if (active) loop();
    } catch (err) {
      console.warn('[ender] basement scene unavailable:', err);
    } finally { building = false; }
  }

  function loop() {
    if (!view || !active) { raf = 0; return; }
    raf = requestAnimationFrame(loop);
    if (!QUALITY.cinema) return;   // perf watchdog can disable the cinematics
    if (!enderGate()) return;   // throttle: the set is near-static, rim drift is time-eased
    view.setShot(scrollP);      // scroll position drives the camera dolly-in
    view.tick();
    view.render();
  }

  // build + render only while the section is anywhere near the viewport
  const near = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) ensureScene();
    });
  }, { rootMargin: '60% 0px' });
  near.observe(section);

  // the theme flip: as soon as the finale is on screen, fade the page to black + hide the chrome
  const flip = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const on = e.isIntersecting;
      document.body.classList.toggle('ending', on);
      active = on;
      if (on && view && !raf) loop();
    });
  }, { threshold: 0.01 });
  flip.observe(section);
}
