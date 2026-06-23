// ===== scrub.js — DEV-only universal animation scrubber =====
// ONE control surface for EVERY animation on the page, so the exact wrong frame can be
// found and reported. Tree-shaken from prod (`import.meta.env.DEV` is statically false in
// the build), so nothing here ships.
//
// Two animation kinds live on this page, and this module makes BOTH fully frame-seekable
// behind one interface (a "transport"):
//   • setTimeout pipelines (engine demo, number→reason, the step demos) — NOT natively
//     seekable. The `Reel` below turns them into a seekable timeline: it runs the SAME
//     schedule against a VIRTUAL clock, so seeking forward fires the keyframes up to t, and
//     seeking back rewinds to a clean state and replays up to t. Every DOM mutation is a
//     keyframe → every frame is reproducible.
//   • a GSAP timeline (the coach cinematic) — already seekable; `gsapTransport` adapts it.
//
// A `Scrubber` is the shared bar UI; point it at any transport. The OLD per-animation
// scrubbers (coach's buildScrubber, sections' buildReviewScrub DOM-snapshot recorder) are
// deleted in favour of this.
import gsap from 'gsap';

// ---------------------------------------------------------------------------------------
// Reel — a seekable virtual-clock timeline that drives a setTimeout-style animation.
//
//   reel.load(build, reset)   build(reel) registers the top-level keyframes (the body of the
//                             animation's play() fn, with setTimeout→reel.at, setInterval→
//                             reel.every). reset() restores the clean pre-play DOM.
//   reel.at(delay, fn, label) schedule fn at (now + delay)ms. Chains correctly: when a
//                             keyframe firing at t calls at(d,…) it lands at t+d — exactly
//                             like setTimeout. Optional label marks an act for the readout.
//   reel.every(delay, fn)     repeating keyframe (typewriters); returns {cancel()}.
//   reel.seek(ms) play() pause() — transport surface the Scrubber drives.
// ---------------------------------------------------------------------------------------
export class Reel {
  constructor(opts = {}) {
    this.name = opts.name || 'animation';
    this.loop = opts.loop !== false;       // most demos loop; pass {loop:false} to stop at the end
    this._cap = opts.measureCap || 90000;  // safety ceiling for duration measuring (ms)
    this._onClaim = opts.onClaim || null;  // called once when the user first grabs control
    this.speed = 1;
    this.claimed = false;
    this.vt = 0;                           // virtual time (ms)
    this._queue = [];                      // [{t, fn}] sorted ascending, stable for equal t
    this._intervals = [];                  // [{delay, fn, nextT, alive, i}]
    this._labels = [];                     // [{t, name}] sorted ascending
    this._buildFn = null;
    this._resetFn = null;
    this._playing = false;
    this._raf = null;
    this._last = 0;
    this._dur = null;
    this._keyframes = null;
    this._lastFiredT = 0;
    this._measuring = false;
    this._kfset = null;
    this._tickCbs = new Set();
    this._cssScope = null; this._anims = new Map();   // CSS-animation coupling (DEV scrub only)
  }

  // ---- registration (called from build() and from inside firing keyframes) ----
  at(delay, fn, label) {
    const t = this.vt + Math.max(0, delay);
    const item = { t, fn };
    const q = this._queue;
    let i = q.length;                      // insert keeping ascending order, stable (FIFO) on ties
    while (i > 0 && q[i - 1].t > t) i--;
    q.splice(i, 0, item);
    if (label) this.cue(delay, label);
    return item;
  }
  cue(delay, name) {
    const t = this.vt + Math.max(0, delay);
    const L = this._labels;
    let i = L.length; while (i > 0 && L[i - 1].t > t) i--;
    L.splice(i, 0, { t, name });
  }
  every(delay, fn) {
    const iv = { delay: Math.max(1, delay), fn, nextT: this.vt + Math.max(1, delay), alive: true, i: 0 };
    this._intervals.push(iv);
    return { cancel() { iv.alive = false; } };
  }
  onReset(fn) { this._resetFn = fn; return this; }
  load(buildFn, resetFn) { this._buildFn = buildFn; if (resetFn) this._resetFn = resetFn; return this; }

  // ---- core stepping: advance the virtual clock to `target`, firing keyframes it crosses ----
  _step(target) {
    let guard = 0;
    for (;;) {
      if (++guard > 500000) { console.warn('[scrub] step guard tripped on', this.name); break; }
      const q = this._queue;
      const nextQ = q.length ? q[0].t : Infinity;
      let iv = null, nextI = Infinity;
      for (const v of this._intervals) { if (v.alive && v.nextT < nextI) { nextI = v.nextT; iv = v; } }
      const te = Math.min(nextQ, nextI);
      if (te === Infinity || te > target) break;
      this.vt = te; this._lastFiredT = te;
      if (this._measuring) this._kfset.add(Math.round(te));
      if (nextQ <= nextI) {                 // queue keyframe fires first on a tie
        const it = q.shift();
        try { it.fn(); } catch (e) { console.warn('[scrub] keyframe error in', this.name, e); }
      } else {                              // interval tick
        try { iv.fn(iv.i++); } catch (e) { console.warn('[scrub] interval error in', this.name, e); }
        if (iv.alive) iv.nextT += iv.delay;
        if (!iv.alive) { const k = this._intervals.indexOf(iv); if (k >= 0) this._intervals.splice(k, 1); }
      }
      if (this._cssScope && !this._measuring) this._capture();   // tag CSS anims with the vt they were born
    }
    this.vt = target;
    if (this._cssScope && !this._measuring) this._syncCss();     // freeze/seek CSS anims to the reel clock
  }

  rewind() {
    this._playing = false; if (this._raf) cancelAnimationFrame(this._raf); this._raf = null;
    this.vt = 0; this._lastFiredT = 0;
    this._queue = []; this._intervals = []; this._labels = []; this._anims.clear();
    if (this._resetFn) this._resetFn();
    if (this._buildFn) this._buildFn(this);   // re-seed the top-level keyframes at vt=0
    if (this._cssScope && !this._measuring) { this._capture(); this._syncCss(); }
    if (!this._measuring) this._emit();        // don't recurse into _refresh→duration() mid-measure
    return this;
  }

  _measure() {
    this._measuring = true; this._kfset = new Set();
    this.rewind();                          // clean + re-seed
    this._step(this._cap);                  // run the whole schedule in virtual time
    this._dur = Math.max(1, this._lastFiredT);
    this._keyframes = this._kfset ? [...this._kfset].sort((a, b) => a - b) : [];
    this._measuring = false; this._kfset = null;
    this.rewind();                          // leave it clean at t=0
  }

  // ---- transport surface ----
  duration() { if (this._dur == null && !this._measuring) this._measure(); return this._dur == null ? 1 : this._dur; }
  time() { return this.vt; }
  paused() { return !this._playing; }
  cues() { return this._labels.map((l) => l.t); }
  keyframes() { if (this._keyframes == null) this._measure(); return this._keyframes; }
  labelAt(ms) { let n = '—'; for (const l of this._labels) { if (l.t <= ms + 1e-3) n = l.name; else break; } return n; }
  setLoop(b) { this.loop = !!b; }
  onTick(cb) { this._tickCbs.add(cb); }
  offTick(cb) { this._tickCbs.delete(cb); }
  _emit() { for (const cb of this._tickCbs) { try { cb(); } catch (e) {} } }
  claim() { if (!this.claimed) { this.claimed = true; if (this._onClaim) this._onClaim(); } }

  // ---- CSS-animation coupling: make CSS transitions/keyframes seek with the reel, not the wall clock ----
  // (opt-in via attachCss(scopeEl); DEV scrub only). Every CSS animation/transition under the scope is
  // paused and its currentTime is driven from the virtual clock, offset by the vt it first appeared at.
  attachCss(el) { this._cssScope = el || null; return this; }
  _capture() {
    let list; try { list = this._cssScope.getAnimations({ subtree: true }); } catch (e) { return; }
    for (const a of list) { if (!this._anims.has(a)) { this._anims.set(a, this.vt); try { a.pause(); } catch (e) {} } }
  }
  _syncCss() {
    for (const [a, birth] of this._anims) {
      try {
        const ct = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
        const end = ct && isFinite(ct.endTime) ? ct.endTime : null;
        let v = this.vt - birth; if (v < 0) v = 0; if (end != null && v > end) v = end;
        a.currentTime = v;
      } catch (e) {}
    }
  }

  seek(ms) {
    const d = this.duration();
    ms = Math.max(0, Math.min(d, ms));
    if (ms < this.vt) this.rewind();
    this._step(ms);
    this._emit();
    return this;
  }

  play() {
    const d = this.duration();
    if (this.vt >= d - 1) this.rewind();
    this._playing = true;
    this._last = performance.now();
    const tick = (now) => {
      if (!this._playing) return;
      const dt = (now - this._last) * this.speed; this._last = now;
      const dur = this.duration();
      let nt = this.vt + dt;
      if (nt >= dur) {
        this._step(dur);
        if (this.loop) { this.rewind(); this._last = now; }
        else { this._playing = false; this._emit(); return; }
      } else {
        this._step(nt);
      }
      this._emit();
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
    this._emit();
    return this;
  }
  pause() { this._playing = false; if (this._raf) cancelAnimationFrame(this._raf); this._raf = null; this._emit(); return this; }
  toggle() { return this.paused() ? this.play() : this.pause(); }
}

// ---------------------------------------------------------------------------------------
// gsapTransport — wrap a GSAP timeline (the coach cinematic) in the same transport surface.
// (GSAP units are seconds; the Scrubber speaks ms.)
// ---------------------------------------------------------------------------------------
export function gsapTransport(tl, opts = {}) {
  const onClaim = opts.onClaim || null;
  let claimed = false;
  const cb2g = new WeakMap();             // map our tick cb -> the gsap.ticker wrapper, so offTick works
  return {
    name: opts.name || 'timeline',
    duration: () => tl.duration() * 1000,
    time: () => tl.time() * 1000,
    paused: () => tl.paused(),
    play() { if (tl.time() >= tl.duration() - 1e-3) tl.time(0); tl.play(); },
    pause() { tl.pause(); },
    seek(ms) { tl.time(Math.max(0, Math.min(tl.duration(), ms / 1000))); },
    labelAt(ms) {
      const t = ms / 1000; let best = '—', bt = -1;
      const labels = tl.labels || {};
      for (const k in labels) { if (labels[k] <= t + 1e-3 && labels[k] > bt) { bt = labels[k]; best = k; } }
      return best;
    },
    cues() { return Object.values(tl.labels || {}).map((s) => s * 1000).sort((a, b) => a - b); },
    keyframes() { return this.cues(); },
    setLoop(b) { tl.repeat(b ? -1 : 0); },
    onTick(cb) { const g = () => cb(); cb2g.set(cb, g); gsap.ticker.add(g); },
    offTick(cb) { const g = cb2g.get(cb); if (g) gsap.ticker.remove(g); },
    claim() { if (!claimed) { claimed = true; if (onClaim) onClaim(); } },
  };
}

// ---------------------------------------------------------------------------------------
// Scrubber — the shared bar UI. Fixed at the bottom; shows only while its anchor section is
// on screen (so exactly one bar is visible at a time, no overlap). Drives any transport.
// ---------------------------------------------------------------------------------------
let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return; stylesInjected = true;
  const css = `
.scrubbar{position:fixed;left:50%;bottom:16px;transform:translateX(-50%) translateY(8px);z-index:99999;
  display:none;align-items:center;gap:7px;padding:7px 10px;border-radius:13px;opacity:0;
  background:rgba(14,14,16,.94);border:1px solid rgba(255,255,255,.16);
  box-shadow:0 10px 34px rgba(0,0,0,.55);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  font:600 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:#ededed;
  max-width:min(95vw,820px);transition:opacity .18s ease,transform .18s ease;user-select:none}
.scrubbar.show{display:flex;opacity:1;transform:translateX(-50%) translateY(0)}
.scrubbar .sb-name{color:#9aa0a6;letter-spacing:.02em;padding:0 6px 0 2px;border-right:1px solid rgba(255,255,255,.14);
  white-space:nowrap;max-width:130px;overflow:hidden;text-overflow:ellipsis}
.scrubbar button{all:unset;cursor:pointer;display:grid;place-items:center;width:26px;height:24px;border-radius:7px;
  color:#e8e8e8;font-size:13px;line-height:1;transition:background .12s ease,color .12s ease}
.scrubbar button:hover{background:rgba(255,255,255,.13)}
.scrubbar button:active{background:rgba(255,255,255,.2)}
.scrubbar .sb-play{font-size:14px;width:30px}
.scrubbar .sb-range{-webkit-appearance:none;appearance:none;height:5px;width:260px;border-radius:6px;
  background:rgba(255,255,255,.2);outline:none;cursor:pointer;margin:0 2px}
.scrubbar .sb-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:14px;height:14px;border-radius:50%;
  background:#6fc24a;border:2px solid #0e0e10;box-shadow:0 1px 4px rgba(0,0,0,.5);cursor:pointer}
.scrubbar .sb-range::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#6fc24a;border:2px solid #0e0e10;cursor:pointer}
.scrubbar .sb-time{color:#c7c7c7;min-width:104px;text-align:center;font-variant-numeric:tabular-nums;white-space:nowrap}
.scrubbar .sb-label{color:#7cd35a;max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  padding:3px 8px;border-radius:7px;background:rgba(124,211,90,.12)}
.scrubbar .sb-loop.on{color:#7cd35a;background:rgba(124,211,90,.14)}
.scrubbar .sb-copy{width:auto;padding:0 9px;font-size:11px;color:#cfcfcf;background:rgba(255,255,255,.08)}
.scrubbar .sb-copy:hover{background:rgba(255,255,255,.16)}`;
  const el = document.createElement('style'); el.id = 'scrubbar-styles'; el.textContent = css;
  document.head.appendChild(el);
}

export class Scrubber {
  constructor(transport, anchorEl, opts = {}) {
    injectStyles();
    this.t = transport;
    this.frame = opts.frame || (1000 / (opts.fps || 30));   // fine step (ms) for ◀ / ▶
    this._drag = false;
    this._visible = false;

    const bar = document.createElement('div');
    bar.className = 'scrubbar';
    bar.innerHTML =
      `<span class="sb-name" title="${transport.name}">${transport.name}</span>`
      + `<button class="sb-cueprev" type="button" title="previous act (Shift+←)">⏮</button>`
      + `<button class="sb-stepback" type="button" title="step back 1 frame (←)">⟨</button>`
      + `<button class="sb-play" type="button" title="play / pause (Space)">▶</button>`
      + `<button class="sb-stepfwd" type="button" title="step forward 1 frame (→)">⟩</button>`
      + `<button class="sb-cuenext" type="button" title="next act (Shift+→)">⏭</button>`
      + `<input class="sb-range" type="range" min="0" max="10000" value="0" step="1">`
      + `<span class="sb-time">0.00 / 0.00s</span>`
      + `<span class="sb-label">—</span>`
      + `<button class="sb-loop" type="button" title="loop playback">⟲</button>`
      + `<button class="sb-copy" type="button" title="copy timestamp to paste back">Copy</button>`;
    document.body.appendChild(bar);
    this.bar = bar;
    this.stepfwd = bar.querySelector('.sb-stepfwd');
    this.range = bar.querySelector('.sb-range');
    this.timeEl = bar.querySelector('.sb-time');
    this.labelEl = bar.querySelector('.sb-label');
    this.playBtn = bar.querySelector('.sb-play');
    this.loopBtn = bar.querySelector('.sb-loop');
    this.copyBtn = bar.querySelector('.sb-copy');
    this.loopBtn.classList.toggle('on', opts.loop !== false);

    const claim = () => transport.claim && transport.claim();
    const dur = () => transport.duration() || 1;
    const seekTo = (ms) => { claim(); transport.pause(); transport.seek(Math.max(0, Math.min(dur(), ms))); };

    // range scrub — grab the thumb, pause, and stop the live refresh from yanking it back
    this.range.addEventListener('pointerdown', () => { this._drag = true; claim(); transport.pause(); });
    this.range.addEventListener('input', () => {
      this._drag = true; claim(); transport.pause();
      transport.seek((this.range.value / 10000) * dur());
    });
    const endDrag = () => { this._drag = false; };
    this.range.addEventListener('pointerup', endDrag);
    this.range.addEventListener('change', endDrag);

    this.playBtn.addEventListener('click', () => { claim(); transport.paused() ? transport.play() : transport.pause(); });
    bar.querySelector('.sb-stepback').addEventListener('click', () => seekTo(transport.time() - this.frame));
    this.stepfwd.addEventListener('click', () => seekTo(transport.time() + this.frame));
    bar.querySelector('.sb-cueprev').addEventListener('click', () => seekTo(this._cue(-1)));
    bar.querySelector('.sb-cuenext').addEventListener('click', () => seekTo(this._cue(1)));
    this.loopBtn.addEventListener('click', () => {
      const on = !this.loopBtn.classList.contains('on');
      this.loopBtn.classList.toggle('on', on); transport.setLoop && transport.setLoop(on);
    });
    this.copyBtn.addEventListener('click', () => {
      const t = transport.time();
      const txt = `${transport.name} t=${(t / 1000).toFixed(2)}s [${transport.labelAt(t)}]`;
      navigator.clipboard && navigator.clipboard.writeText(txt).then(() => {
        this.copyBtn.textContent = 'copied ✓'; setTimeout(() => { this.copyBtn.textContent = 'Copy'; }, 1200);
      });
    });

    // keyboard — only the on-screen bar reacts
    this._onKey = (e) => {
      if (!this._visible) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
      if (e.key === ' ') { e.preventDefault(); claim(); transport.paused() ? transport.play() : transport.pause(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); e.shiftKey ? seekTo(this._cue(-1)) : seekTo(transport.time() - this.frame); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); e.shiftKey ? seekTo(this._cue(1)) : seekTo(transport.time() + this.frame); }
    };
    addEventListener('keydown', this._onKey);

    // live refresh + visibility
    this._refresh = this._refresh.bind(this);
    transport.onTick(this._refresh);
    this._refresh();
    if (anchorEl) {
      const io = new IntersectionObserver((es) => {
        es.forEach((en) => { this._visible = en.isIntersecting && en.intersectionRatio >= 0.35; bar.classList.toggle('show', this._visible); });
      }, { threshold: [0, 0.35, 0.7] });
      io.observe(anchorEl);
    } else { this._visible = true; bar.classList.add('show'); }
  }

  _cue(dir) {
    const t = this.t.time();
    const cues = (this.t.cues && this.t.cues()) || [];
    if (dir < 0) { let best = 0; for (const c of cues) if (c < t - 30) best = c; return best; }
    let best = this.t.duration(); for (let i = cues.length - 1; i >= 0; i--) if (cues[i] > t + 30) best = cues[i]; return best;
  }

  _refresh() {
    const d = this.t.duration() || 1, t = this.t.time();
    if (!this._drag) this.range.value = String(Math.max(0, Math.min(10000, (t / d) * 10000)));
    this.timeEl.textContent = `${(t / 1000).toFixed(2)} / ${(d / 1000).toFixed(2)}s`;
    this.labelEl.textContent = this.t.labelAt(t);
    this.playBtn.textContent = this.t.paused() ? '▶' : '⏸';
  }
}
