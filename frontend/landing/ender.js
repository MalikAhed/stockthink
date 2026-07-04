// Finale controller — the live "basement endgame" cinematic (Réti–Tartakower, Vienna 1910).
// AUTHORING PHASE: the page ships this LIVE WebGL finale while we build the animated game; once the
// cinematic is approved it bakes back to a <video> (ender-video.js) and the QUALITY.cinema gate returns.
//
// TWO clocks: the master clock `m` drives the LIGHT-UP entry (the bulb sputters alight, its pool of
// light grows over the page and swallows the viewport), then the game clock t = m − lightupLead drives
// view.frame(t): the pieces RAIN into the position, the camera dollies from the wide establishing shot
// to the seated White POV, and the moves play. The old scroll-driven fade-to-black veil is gone.
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
  let exitFade = 1;         // 1 while the finale covers the viewport; →0 as it scrolls away — fades the fixed CTA/flash/front overlays (they live on <body>, so they don't scroll off with the section) so the final title never lingers over the next/previous section
  let clockStart = 0;       // performance.now() when the cinematic began
  let playing = false;      // armed once the basement is actually being revealed
  // ---- keyboard scene step-through (← / → walk the beats; each plays as ONE burst then holds) ----
  let navMode = false;      // the user has taken manual control with the arrow keys (pauses autoplay)
  let sceneI = 0;           // current beat index
  let sceneClock = 0;       // performance.now() when the current beat's burst began
  let curT = 0;             // last t the loop rendered (so a first keypress can grab the current beat)
  // ---- dev-only CAMERA DIRECTOR: scrub time + fly the camera (OrbitControls), drop keyframes, copy them out ----
  let director = false, dirT = 0, dirControls = null; const dirKeys = [];

  // ---- the LIGHT-UP entry (replaces the fade-to-black veil) --------------------------------------
  // An in-section overlay painted the PAGE's background colour (var(--bg), so it follows the theme)
  // with a growing transparent hole: the section scrolls in looking like plain page, then a warm pool
  // of light blooms where the bulb hangs (the bulb sputters alight inside it), grows over the table,
  // then the board, and finally swallows the viewport — that moment IS "the site goes dark". It lives
  // inside .ender-sticky (not on <body>), so scrolling away carries it off naturally — nothing fixed
  // can linger. Radius/centre come from the scene (lightupHole/bulbScreen) each frame.
  const sticky = section.querySelector('.ender-sticky');
  const hole = document.createElement('div');
  hole.className = 'ender-hole';
  if (sticky) sticky.appendChild(hole);
  let holeOpen = false;    // fully open → element display:none, gradient writes stop
  function updateHole(m, skip) {
    if (skip) { if (!holeOpen) { holeOpen = true; hole.style.display = 'none'; } return; }
    const r = view ? view.lightupHole(m) : 0;
    if (r >= 1.45) { if (!holeOpen) { holeOpen = true; hole.style.display = 'none'; } return; }
    if (holeOpen) { holeOpen = false; hole.style.display = ''; }
    if (r < 0.005) { hole.style.background = 'var(--bg)'; return; }
    const p = view.bulbScreen();
    hole.style.background = 'radial-gradient(circle ' + (r * 100).toFixed(2) + 'vmax at ' +
      (p.x * 100).toFixed(1) + '% ' + (p.y * 100).toFixed(1) + '%, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 55%, var(--bg) 96%)';
  }
  function resetHole() { holeOpen = false; hole.style.display = ''; hole.style.background = 'var(--bg)'; }
  resetHole();

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
      '<h2 class="ender-cta-h">Your games hide<br>moments <span class="am">like that</span><svg class="cta-brill" viewBox="0 0 18 19" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path opacity=".3" d="M9,.5a9,9,0,1,0,9,9A9,9,0,0,0,9,.5Z"/><path fill="#1bada6" d="M9,0a9,9,0,1,0,9,9A9,9,0,0,0,9,0Z"/><path fill="#fff" d="M12.57,14.1a.51.51,0,0,1,0,.13.44.44,0,0,1-.08.11l-.11.08-.13,0h-2l-.13,0L10,14.34A.41.41,0,0,1,10,14.1V12.2A.32.32,0,0,1,10,12a.39.39,0,0,1,.1-.08l.13,0h2a.31.31,0,0,1,.24.1.39.39,0,0,1,.08.1.51.51,0,0,1,0,.13Zm-.12-3.93a.17.17,0,0,1,0,.12.41.41,0,0,1-.07.11.4.4,0,0,1-.23.08H10.35a.31.31,0,0,1-.34-.31L9.86,3.4A.36.36,0,0,1,10,3.16a.23.23,0,0,1,.11-.08.27.27,0,0,1,.13,0H12.3a.32.32,0,0,1,.25.1.36.36,0,0,1,.09.24Z"/><path fill="#fff" d="M8.07,14.1a.51.51,0,0,1,0,.13.44.44,0,0,1-.08.11l-.11.08-.13,0h-2l-.13,0-.11-.08a.41.41,0,0,1-.08-.24V12.2a.27.27,0,0,1,0-.13.36.36,0,0,1,.07-.1.39.39,0,0,1,.1-.08l.13,0h2A.31.31,0,0,1,8,12a.39.39,0,0,1,.08.1.51.51,0,0,1,0,.13ZM8,10.17a.17.17,0,0,1,0,.12.41.41,0,0,1-.07.11.4.4,0,0,1-.23.08H5.85a.31.31,0,0,1-.34-.31L5.36,3.4a.36.36,0,0,1,.09-.24.23.23,0,0,1,.11-.08.27.27,0,0,1,.13,0H7.8a.35.35,0,0,1,.25.1.36.36,0,0,1,.09.24Z"/></svg></h2>' +
      '<div class="ender-cta-btns">' +
        '<a class="ender-cta-btn" href="' + B0 + '">Analyse your games &rarr;</a>' +
        '<a class="ender-cta-btn ender-cta-btn2" href="mailto:abodsaid1996@gmail.com">Contact developer</a>' +
      '</div>' +
    '</div>';
  document.body.appendChild(cta);

  // ---- front-of-text layer: a canvas stacked ABOVE the CTA copy; the scene renders the flagged hero piece here
  //      so it reads IN FRONT of the text during the final reveal. Empty/idle until the tableau settles. ----
  const frontCanvas = document.createElement('canvas'); frontCanvas.className = 'ender-front'; document.body.appendChild(frontCanvas);

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
  let lastShowFront = false;   // mirrored from the loop so onScroll can keep the front canvas honest between frames
  function updateHud(t) {
    if (!view) return;
    // the king-entrance fade veil — also scaled by exitFade so a mid-cut scroll-away can't leave a dark pane
    if (view.cutFadeAt) cutVeil.style.opacity = String(view.cutFadeAt(t) * exitFade);
    // the explosion flash + the final CTA reveal
    if (view.flashAt) {                                    // the detonation glow: a radial white that EXPANDS from the blast to engulf the surroundings
      const fa = (director ? 0 : view.flashAt(t)) * exitFade; flash.style.opacity = String(fa);
      if (fa > 0 && view.flashGrowAt) { const R = view.flashGrowAt(t) * 165; flash.style.background = 'radial-gradient(circle at 50% 54%, #fff 0%, #fff ' + (R * 0.5).toFixed(1) + '%, rgba(255,255,255,0) ' + R.toFixed(1) + '%)'; }
    }
    if (view.ctaAt) { const c = (director ? 0 : view.ctaAt(t)) * exitFade; cta.style.opacity = String(c); cta.style.pointerEvents = c > 0.5 ? 'auto' : 'none'; }
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
  let revealPLatest = 0;   // last computed pin progress — the loop arms the clock from it once the scene is built
  function onScroll() {
    const r = section.getBoundingClientRect();
    const revealP = clamp01(-r.top / (innerHeight * 0.6));          // 0→1 over the first ~⅔ viewport once pinned
    revealPLatest = revealP;
    // the CTA / flash / front-piece are fixed <body> overlays → they DON'T scroll away with the section. Fade
    // them as the finale leaves the viewport in EITHER direction (1 while it covers the frame; →0 as an edge scrolls in).
    const lead = Math.max(r.top, innerHeight - r.bottom, 0);
    exitFade = clamp01(1 - lead / (innerHeight * 0.6));
    // Re-apply the fixed overlays' opacities NOW, from the scroll handler itself: the rAF loop is
    // throttled (fps cap) and stops entirely once `active` flips, so a fast flick used to leave the
    // CTA/flash/front-piece at their last-rendered opacity for several frames — the "text doesn't go
    // away smoothly when I scroll back up" bug. Scroll events outrun the gated loop, so drive it here too.
    if (view) {
      updateHud(curT);
      frontCanvas.style.opacity = lastShowFront ? String(exitFade) : '0';
    }
    // start the master clock once the section is genuinely pinned AND the scene exists (else the bulb
    // would sputter unseen behind the page-coloured hole while the GLBs still parse). One-shot; re-armed
    // when the section fully leaves. The loop also arms from revealPLatest for the "pinned, then stopped
    // scrolling while the scene finished building" case — no further scroll event would fire.
    if (revealP > 0.05 && !playing && !RM && view) { playing = true; clockStart = performance.now(); }
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
      canvas.style.opacity = '1';   // the hole overlay owns the reveal now (was a scroll-scrubbed fade)
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
    // arm here too: covers "pinned, stopped scrolling, scene finished building a beat later"
    if (!playing && !RM && revealPLatest > 0.05) { playing = true; clockStart = performance.now(); }
    // TWO clocks: m = the master clock (drives the light-up entry); t = the GAME clock = m minus the
    // light-up lead, so every approved beat timing in the scene is untouched. Manual modes (director /
    // keyboard step / reduced motion) bypass the light-up entirely (lights at full, hole hidden).
    const manual = director || RM || (navMode && view.scenes);
    let t, m;
    if (director) { t = dirT; m = 1e9; }                                       // camera director: hold the scrubbed time, fly the camera
    else if (RM) { t = 999; m = 1e9; }                                         // RM → jump to the assembled position
    else if (navMode && view.scenes) {                                         // manual step: play this beat, then HOLD at its end
      const sc = view.scenes[sceneI];
      t = Math.min(sc.start + (performance.now() - sceneClock) / 1000, sc.end);
      m = 1e9;
    } else { m = playing ? (performance.now() - clockStart) / 1000 : 0; t = Math.max(0, m - (view.lightupLead || 0)); }   // autoplay
    curT = t;
    view.frame(t);                       // the master timeline: the rain + the moves + effects (camera skipped in director mode)
    if (view.setLightup) view.setLightup(m);   // AFTER frame() so the light-up wins the per-frame light/exposure writes
    updateHole(m, manual);
    if (director && dirControls) { dirControls.update(); view.lookTarget.copy(dirControls.target); }   // OrbitControls own the camera
    updateHud(t);                        // the rating lower-third (🔴 Blunder · ✨ Brilliant · 🟢 Double check · 👑 Checkmate)
    view.tick();                         // gentle rim-light drift
    // front-of-text hero piece: once the tableau has settled (the reveal), lift it onto the front layer so it
    // renders ABOVE the CTA copy. Before then it plays the game normally in the main pass.
    const showFront = !director && view.frontPieces && view.frontPieces.length && t > view.duration - 6.0;   // lift onto the front layer just BEFORE the CTA reveals (under the whiteout), so the hero piece glides in ABOVE the copy
    lastShowFront = showFront;
    if (view.setFrontActive) view.setFrontActive(showFront);
    view.render();
    if (showFront) view.renderFront(frontCanvas);
    frontCanvas.style.opacity = showFront ? String(exitFade) : '0';
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
        flash.style.opacity = '0'; cta.style.opacity = '0'; cta.style.pointerEvents = 'none'; cutVeil.style.opacity = '0';
        lastShowFront = false; frontCanvas.style.opacity = '0'; if (view && view.setFrontActive) view.setFrontActive(false);
        resetHole(); if (view && view.setLightup && !RM) view.setLightup(0); }   // don't let the flash/CTA/cut-veil/front piece linger + re-arm the light-up for the next visit
    });
  }, { threshold: [0, 0.01] });
  flip.observe(section);
}
