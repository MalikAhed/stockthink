// Finale controller — the live "basement endgame" cinematic (Réti–Tartakower, Vienna 1910).
// AUTHORING PHASE: the page ships this LIVE WebGL finale while we build the animated game; once the
// cinematic is approved it bakes back to a <video> (ender-video.js) and the QUALITY.cinema gate returns.
//
// One clock `t` (seconds) drives the whole timeline via view.frame(t): the pieces RAIN into the
// position from above, the camera dollies from the wide establishing shot to the seated White POV,
// then (next beat) the moves play. The scroll-driven fade-to-black veil + page→black theme flip into
// the finale are kept (cheap DOM) so the transition looks identical to the video edition.
import { fpsGate } from './perf.js';
const section = document.querySelector('section.ender');
const canvas = document.getElementById('enderScene');
if (section && canvas) {
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const enderGate = fpsGate();   // cap below display refresh — the set is near-static between moves
  let view = null;          // the scene api once built
  let building = false;
  let active = false;       // section in view -> run the rAF loop
  let raf = 0;
  let clockStart = 0;       // performance.now() when the cinematic began
  let playing = false;      // armed once the basement is actually being revealed

  // ---- the fade-to-black veil (kept from the video edition) --------------------------------------
  // A fixed black overlay whose opacity is scrubbed by scroll: fades the whole screen to black as the
  // coach leaves, holds black while the canvas fades to opaque underneath, then lifts to reveal it.
  const fade = document.createElement('div');
  fade.className = 'ender-fade';
  document.body.appendChild(fade);

  // ---- the rating lower-third (the page's move-rating language) ------------------------------------
  // Built once into the section's overlay; driven each frame by the scene's pure badgeAt(t). Kept as
  // live HTML (per the project's "captions stay editable, only WebGL bakes" convention).
  const B = (import.meta.env && import.meta.env.BASE_URL) || '/';
  const overlay = document.getElementById('enderOverlay');
  let cap = null, capIco = null, capRating = null, capMove = null, _capKey = '';
  if (overlay) {
    cap = document.createElement('div'); cap.className = 'ender-cap';
    capIco = document.createElement('img'); capIco.className = 'ender-cap-ico'; capIco.alt = '';
    capRating = document.createElement('span'); capRating.className = 'ender-cap-rating';
    capMove = document.createElement('span'); capMove.className = 'ender-cap-move';
    cap.append(capIco, capRating, capMove);
    overlay.appendChild(cap);
  }
  // ---- live Stockfish eval bar (real evals, fed by the scene's pure evalAt(t)) --------------------
  let evalBar = null, evFill = null, evNum = null;
  if (overlay) {
    evalBar = document.createElement('div'); evalBar.className = 'ender-eval';
    evFill = document.createElement('div'); evFill.className = 'ev-fill';
    evNum = document.createElement('div'); evNum.className = 'ev-num';
    evalBar.append(evFill, evNum);
    overlay.appendChild(evalBar);
  }
  function updateHud(t) {
    if (!view) return;
    // the rating lower-third
    if (cap && view.badgeAt) {
      const b = view.badgeAt(t);
      if (!b) { cap.style.opacity = '0'; }
      else {
        cap.style.opacity = String(b.opacity);
        if (b.rating !== _capKey) {        // swap icon/text only when the active badge changes
          _capKey = b.rating;
          cap.className = 'ender-cap r-' + b.rating;
          if (b.icon) { capIco.src = `${B}badges/${b.icon}`; capIco.style.display = ''; } else { capIco.style.display = 'none'; }   // publicDir → emitted in prod (dist/badges/)
          capRating.textContent = b.label;
          capMove.textContent = b.move;
        }
      }
    }
    // the eval bar: fades in once the board is set (just before the first move), then tracks evalAt(t)
    if (evalBar && view.evalAt) {
      evalBar.style.opacity = String(clamp01((t - 6.6) / 0.8));   // fade in after the dolly settles
      const e = view.evalAt(t);
      evFill.style.height = (e.fill * 100).toFixed(2) + '%';
      evalBar.classList.toggle('ev-mate', e.mate);
      if (evNum.textContent !== e.label) evNum.textContent = e.label;
    }
  }

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  function onScroll() {
    const r = section.getBoundingClientRect();
    const approachP = clamp01(1 - r.top / innerHeight);             // 0→1 as the section's top rises into view
    const revealP = clamp01(-r.top / (innerHeight * 0.6));          // 0→1 over the first ~⅔ viewport once pinned
    canvas.style.opacity = String(clamp01(revealP / 0.5));                            // opaque by the halfway point
    fade.style.opacity = String(approachP * (1 - clamp01((revealP - 0.5) / 0.5)));   // holds black, then lifts
    // start the cinematic clock once the basement is genuinely being revealed (not while behind the veil) —
    // otherwise the rain would play out unseen. One-shot; re-armed when the section fully leaves.
    if (revealP > 0.05 && !playing && !RM) { playing = true; clockStart = performance.now(); }
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
      if (import.meta.env.DEV) window.__ender = view;   // dev-only handle for probes/scrubbing (tree-shaken from prod)
      if (active) loop();
    } catch (err) {
      console.warn('[ender] basement scene unavailable:', err);
    } finally { building = false; }
  }

  function loop() {
    if (!view || !active) { raf = 0; return; }
    raf = requestAnimationFrame(loop);
    if (!enderGate()) return;            // throttle to fpsCap (motion is clock-driven, so it stays correct)
    const t = RM ? 999 : (playing ? (performance.now() - clockStart) / 1000 : 0);   // RM → jump to the assembled position
    view.frame(t);                       // the master timeline: camera dolly + the rain + the moves + effects
    updateHud(t);                        // the rating lower-third (🔴 Blunder · ✨ Brilliant · 🟢 Double check · 👑 Checkmate)
    view.tick();                         // gentle rim-light drift
    view.render();
  }

  // build + render only while the section is anywhere near the viewport
  const near = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) ensureScene(); });
  }, { rootMargin: '60% 0px' });
  near.observe(section);

  // theme flip: as soon as the finale is on screen, fade the page to black + hide the chrome.
  // On full exit, re-arm the clock so the rain replays the next time you scroll back in.
  const flip = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const on = e.isIntersecting;
      document.body.classList.toggle('ending', on);
      active = on;
      if (on && view && !raf) loop();
      if (!on && e.intersectionRatio <= 0.01) playing = false;
    });
  }, { threshold: [0, 0.01] });
  flip.observe(section);
}
