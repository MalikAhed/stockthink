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
  // ---- keyboard scene step-through (← / → walk the beats; each plays as ONE burst then holds) ----
  let navMode = false;      // the user has taken manual control with the arrow keys (pauses autoplay)
  let sceneI = 0;           // current beat index
  let sceneClock = 0;       // performance.now() when the current beat's burst began
  let curT = 0;             // last t the loop rendered (so a first keypress can grab the current beat)
  // ---- dev-only CAMERA DIRECTOR: scrub time + fly the camera (OrbitControls), drop keyframes, copy them out ----
  let director = false, dirT = 0, dirControls = null; const dirKeys = [];

  // ---- the fade-to-black veil (kept from the video edition) --------------------------------------
  // A fixed black overlay whose opacity is scrubbed by scroll: fades the whole screen to black as the
  // coach leaves, holds black while the canvas fades to opaque underneath, then lifts to reveal it.
  const fade = document.createElement('div');
  fade.className = 'ender-fade';
  document.body.appendChild(fade);

  // ---- the king-entrance fade veil: a second black overlay driven by the scene's pure cutFadeAt(t) ----
  // Fades the screen out/in around each king's drop (the camera cuts to the close shot while it's black).
  const cutVeil = document.createElement('div');
  cutVeil.className = 'ender-cut';
  document.body.appendChild(cutVeil);

  // ---- the scene-nav tag (shows "3 / 10 · The white king" while stepping with the arrows) ----
  const navTag = document.createElement('div');
  navTag.className = 'ender-navtag';
  document.body.appendChild(navTag);

  // ---- the explosion flash (white bloom, driven by the scene's pure flashAt) + the final CTA message ----
  const B0 = (import.meta.env && import.meta.env.BASE_URL) || '/';
  const flash = document.createElement('div'); flash.className = 'ender-flash'; document.body.appendChild(flash);
  const cta = document.createElement('div'); cta.className = 'ender-cta';
  cta.innerHTML =
    '<div class="ender-cta-in">' +
      '<div class="ender-cta-kick">The why behind every move</div>' +
      '<h2 class="ender-cta-h">Your games hide<br>moments <span class="am">like that</span>.</h2>' +
      '<p class="ender-cta-p">StockThink reviews any game the way a grandmaster would &mdash; surfacing every brilliancy and blunder, and the idea that turned it. Free, in your browser.</p>' +
      '<a class="ender-cta-btn" href="' + B0 + '">Analyse my game &rarr;</a>' +
    '</div>';
  document.body.appendChild(cta);

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
    // the king-entrance fade veil
    if (view.cutFadeAt) cutVeil.style.opacity = String(view.cutFadeAt(t));
    // the explosion flash + the final CTA reveal
    if (view.flashAt) {                                    // the detonation glow: a radial white that EXPANDS from the blast to engulf the surroundings
      const fa = director ? 0 : view.flashAt(t); flash.style.opacity = String(fa);
      if (fa > 0 && view.flashGrowAt) { const R = view.flashGrowAt(t) * 165; flash.style.background = 'radial-gradient(circle at 50% 54%, #fff 0%, #fff ' + (R * 0.5).toFixed(1) + '%, rgba(255,255,255,0) ' + R.toFixed(1) + '%)'; }
    }
    if (view.ctaAt) { const c = director ? 0 : view.ctaAt(t); cta.style.opacity = String(c); cta.style.pointerEvents = c > 0.5 ? 'auto' : 'none'; }
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
      evalBar.style.opacity = String(clamp01((t - 8.0) / 0.8));   // fade in after the king entrances settle (just before the blunder)
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

  // ---- keyboard scene navigation: ← / → step beats (each a burst), Space replays the current beat ----
  function sceneAtTime(tt) {
    const s = view && view.scenes; if (!s) return 0;
    for (let i = s.length - 1; i >= 0; i--) if (tt >= s[i].start - 1e-3) return i;
    return 0;
  }
  function playScene(i) {
    const s = view && view.scenes; if (!s) return;
    sceneI = Math.max(0, Math.min(s.length - 1, i));
    playing = true; sceneClock = performance.now();
    navTag.textContent = `${sceneI + 1} / ${s.length}  ·  ${s[sceneI].label}`;
    navTag.classList.add('show');
    if (view && !raf && active) loop();
  }
  addEventListener('keydown', (e) => {
    if (!active || !view || !view.scenes) return;   // only capture keys while the finale is on screen
    const isArrow = e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowUp';
    const isSpace = e.key === ' ' || e.key === 'Spacebar';
    if (!isArrow && !(isSpace && navMode)) return;  // let Space scroll normally until nav mode is on
    e.preventDefault();
    const dir = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 0;
    if (!navMode) { navMode = true; playScene(sceneAtTime(curT)); }   // first press: take over from wherever autoplay was
    else if (isSpace) playScene(sceneI);                              // Space: replay this beat
    else playScene(sceneI + dir);                                     // arrows: step to the next/previous beat
  }, { passive: false });

  // ---- the dev CAMERA DIRECTOR panel: scrub any time, fly the camera, drop keyframes, copy them for me ----
  async function initDirector() {
    if (!import.meta.env.DEV || dirControls || !view) return;
    const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
    dirControls = new OrbitControls(view.camera, canvas);
    dirControls.enableDamping = true; dirControls.dampingFactor = 0.09; dirControls.enabled = false;
    const p = document.createElement('div'); p.className = 'ender-dir';
    p.innerHTML =
      '<button class="ender-dir-tog">🎥 Camera director</button>' +
      '<div class="ender-dir-body" hidden>' +
        '<div class="ender-dir-row"><input class="ender-dir-t" type="range" min="0" max="' + view.duration.toFixed(2) + '" step="0.02" value="0"><span class="ender-dir-tv">0.00s</span></div>' +
        '<div class="ender-dir-pose">—</div>' +
        '<div class="ender-dir-row"><button class="ender-dir-add">+ Keyframe @ time</button><button class="ender-dir-copy">Copy all</button></div>' +
        '<div class="ender-dir-list"></div>' +
      '</div>';
    document.body.appendChild(p);
    const $ = (s) => p.querySelector(s), r2 = (n) => Math.round(n * 100) / 100;
    const tEl = $('.ender-dir-t'), tv = $('.ender-dir-tv'), poseEl = $('.ender-dir-pose'), listEl = $('.ender-dir-list'), copyBtn = $('.ender-dir-copy');
    const renderList = () => { listEl.innerHTML = dirKeys.map((k, i) => '<div class="ender-dir-k"><b>' + k.t + 's</b><span>eye [' + k.eye.join(', ') + ']</span><button data-go="' + i + '">go</button><button data-del="' + i + '">✕</button></div>').join(''); };
    $('.ender-dir-tog').onclick = (e) => {
      director = !director; view.setDirector(director); dirControls.enabled = director;
      $('.ender-dir-body').hidden = !director; e.target.textContent = director ? '🎥 Director: ON' : '🎥 Camera director';
      if (director) { playing = true; navMode = false; navTag.classList.remove('show'); dirT = curT || 0; tEl.value = dirT; tv.textContent = dirT.toFixed(2) + 's'; dirControls.target.copy(view.lookTarget); if (!raf && active) loop(); }
    };
    tEl.oninput = () => { dirT = +tEl.value; tv.textContent = dirT.toFixed(2) + 's'; };
    $('.ender-dir-add').onclick = () => { const e = view.camera.position, tg = dirControls.target;
      dirKeys.push({ t: r2(dirT), eye: [r2(e.x), r2(e.y), r2(e.z)], tgt: [r2(tg.x), r2(tg.y), r2(tg.z)] });
      dirKeys.sort((a, b) => a.t - b.t); renderList(); };
    copyBtn.onclick = () => { const js = '[\n' + dirKeys.map((k) => '  { t: ' + k.t + ', eye: [' + k.eye.join(', ') + '], tgt: [' + k.tgt.join(', ') + '] },').join('\n') + '\n]';
      navigator.clipboard && navigator.clipboard.writeText(js); copyBtn.textContent = 'Copied!'; setTimeout(() => (copyBtn.textContent = 'Copy all'), 1200); };
    listEl.onclick = (ev) => { const go = ev.target.getAttribute('data-go'), del = ev.target.getAttribute('data-del');
      if (go != null) { const k = dirKeys[+go]; dirT = k.t; tEl.value = k.t; tv.textContent = k.t.toFixed(2) + 's'; view.camera.position.set(k.eye[0], k.eye[1], k.eye[2]); dirControls.target.set(k.tgt[0], k.tgt[1], k.tgt[2]); }
      else if (del != null) { dirKeys.splice(+del, 1); renderList(); } };
    setInterval(() => { if (!director) return; const e = view.camera.position, tg = dirControls.target;
      poseEl.textContent = 'eye [' + r2(e.x) + ', ' + r2(e.y) + ', ' + r2(e.z) + ']  ·  tgt [' + r2(tg.x) + ', ' + r2(tg.y) + ', ' + r2(tg.z) + ']'; }, 140);
  }

  async function ensureScene() {
    if (view || building) return;
    building = true;
    try {
      const { createEnderScene } = await import('./ender-scene.js');
      view = await createEnderScene(canvas);
      view.resize();
      if (import.meta.env.DEV) window.__ender = view;   // dev-only handle (the camera-director tool is disabled)
      void initDirector;   // (kept but not mounted — the directing is done in-code now)
      if (active) loop();
    } catch (err) {
      console.warn('[ender] basement scene unavailable:', err);
    } finally { building = false; }
  }

  function loop() {
    if (!view || !active) { raf = 0; return; }
    raf = requestAnimationFrame(loop);
    if (!enderGate()) return;            // throttle to fpsCap (motion is clock-driven, so it stays correct)
    let t;
    if (director) t = dirT;                                                    // camera director: hold the scrubbed time, fly the camera
    else if (RM) t = 999;                                                      // RM → jump to the assembled position
    else if (navMode && view.scenes) {                                         // manual step: play this beat, then HOLD at its end
      const sc = view.scenes[sceneI];
      t = Math.min(sc.start + (performance.now() - sceneClock) / 1000, sc.end);
    } else t = playing ? (performance.now() - clockStart) / 1000 : 0;          // autoplay
    curT = t;
    view.frame(t);                       // the master timeline: the rain + the moves + effects (camera skipped in director mode)
    if (director && dirControls) { dirControls.update(); view.lookTarget.copy(dirControls.target); }   // OrbitControls own the camera
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
      if (!on && e.intersectionRatio <= 0.01) { playing = false; navMode = false; navTag.classList.remove('show');
        flash.style.opacity = '0'; cta.style.opacity = '0'; cta.style.pointerEvents = 'none'; }   // don't let the flash/CTA linger + block the page
    });
  }, { threshold: [0, 0.01] });
  flip.observe(section);
}
