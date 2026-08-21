# StockThink Landing — session guide & tracker

Loads every session in `frontend/landing/`. It's the build tracker + the design/animation
rulebook. **This is my memory — read it, then work; update it as I learn.** File map lives in
`README.md` (don't duplicate it here). Beat-3 plan lives in `coach-plan.md`. Editor spec lives in
`the-edit-interface.md`. Keep this file lean: prune done-history, don't let it re-bloat.

---

## How the user works (follow exactly)
- **Speedy, direct edits. No over-planning, no over-complicating.** He shows the running page, says
  what's wrong, I fix it fast. Edit → 1–2 line summary of what changed → he looks → feedback. Loop.
- Fast + self-correcting beats slow perfectionism. One concern per edit; don't bundle.
- When he picks an option, build THAT — don't relitigate.
- **Screenshots: verify silently, surface only on request.** Silently screenshotting via the headless
  harness to check my OWN work is encouraged; pushing shots at him unprompted is not.
- He hands an EXACT target (`#N selector` + `📌 NOTE`, from the Edit Interface) — go straight to it.
- Reference media lands in `user provides/` (mp4/gif/png). When he says "I gave you a reference",
  look there FIRST and `Read` it; don't ask where files are.
- **When he corrects a mistake or likes a style — record it here** (Mistakes / Design system below).

## Speed rules (earned the hard way — they prevent the slow loops)
1. **Don't edit blind. Verify → change → re-verify** with the harness (below). Editing by reasoning
   alone cost ~3 rounds; one harness run finds the real cause.
2. **Build on the proven skeleton.** Any new section = `.s1sec > .s1step > .s1left/.s1right`. 3D /
   canvas / video go in as separate absolutely-positioned layers (z0 behind text, z3 in front) —
   NEVER re-layout the text into a bespoke absolute/sticky stage (that clustered the title, ~6 turns).
3. **One visible increment at a time.** Ship the smallest thing he can see, confirm, add the next.
4. **Make the look HIS to dial.** For material/position/timing/color work, build a throwaway on-page
   tuning panel (sliders + a "Copy params" button emitting a JS-ready config). He tweaks live, pastes
   back, I bake it as default and delete the panel. Keep tunables as a plain object at the TOP of the
   file (see `gears.js` `TUNE`/`GEARS`) so baking = one paste. Biggest speed win — he loved it.
5. **Lock the CONCEPT before polishing pacing.** For a fresh cinematic: restate the STRUCTURE (what
   each act shows, one line each), get a 👍, build it rough, THEN tune ms/heat/zoom. Beat 2 was rebuilt
   4× because timings were gold-plated before the shape was approved. Offer 2–3 ASCII layout options up
   front (AskUserQuestion) instead of guessing then rebuilding.
6. **Restate motion back as a numbered second-by-second sequence before coding it.** Biggest time sink
   = guessing what a motion word means ("transition" built as "sidebar recedes" when he meant
   "board shrinks→net→result→board returns" = 2 reworks). Match any `user provides/` reference literally.
7. **Animations = a TIMED phase pipeline.** Build each multi-step anim as one `playX()` using the
   `tN/iN/TN/IN/clearN` registry with explicit ms offsets (see `playEngine` in `sections.js`). Verify
   each phase by tuning the probe `sleep(ms)` to that offset. Keep timings/colors as plain literals.
8. **Big animations = their OWN module** (per-act `actN()` fns + a generic `camTo()/heat()/fit()`
   camera + own IntersectionObserver + own CSS), imported in `main.js`. `number-to-reason.js` is the
   pattern — a rework then touches ONE file. Use this for anything bigger than a single `playX()`.

---

## Harnesses — SEE the page (you are NOT blind)
Browser MCPs can't reach localhost here — skip them. What works: headless `google-chrome`
(`/usr/bin/google-chrome`) over CDP with the `ws` pkg. **Needs `npm run dev` up.** Caveats: the `#load`
overlay must be force-hidden, `html{scroll-behavior:smooth}` fights `scrollIntoView` (poll-scroll instead),
and chess.com CDN PNGs don't load headless. **WebGL DOES render** with `GL=sw` (adds `--no-sandbox
--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`) — so coach/gears/hero ARE visible via
SwiftShader, but SLOW (≈one heavy coach frame per run): for spot-checking single frames, not fast iteration.

**The one-off probe scripts now live in `editor/probes/`** (2026-06-23 tidy) — prefix the table commands
with `probes/` (e.g. `node editor/probes/probe.mjs`). The render pipeline (`record.mjs`/`encode.mjs`/
`make-render-kit.mjs`) + the Edit Interface (`editor.js`/`editor.css`/`edits.json`) stay at `editor/` root.

| Run | What it does |
|---|---|
| `node editor/probe.mjs` | screenshot+probe any state → `/tmp/st-shot.png`. Tune the post-build `sleep(ms)` (from when the demo fires) to capture a specific animation phase. The ready-made base — copy its CDP boilerplate for new pages. |
| `node editor/probe-wd.mjs <ms…> [light]` | **multi-phase** Beat-2 shots in ONE Chrome session → `/tmp/st-wd-<ms>.png` each. Pass every act offset at once (≈600 desktop · ≈4400 terminal · ≈9000 reformat · ≈13000 heat table · ≈18400 explanation). `light` = light theme. |
| `node editor/devtest.mjs` | drives the Edit Interface headlessly (real Pick hover+click, dumps the tree) → `/tmp/st-editor-shot.png`. Run before editing `editor.js`. |
| `[GL=sw] PORT=5173 STEP=N node editor/probe-scrub.mjs <fracs…>` | drive an animation's **scrubber** to fractions → `/tmp/st-scrub-N-NN.png` each (prints `time [label]`). STEP = section `data-step` (1,2,3,7,8,10). `GL=sw` to see the 3D coach (step 10), slowly. |
| `GL=sw PORT=… node editor/probes/probe-assembly.mjs <p_or_t…>` | screenshot the finale **assembly entry** at progress p (≤1, drives finale-stage `__setP`) or game times (>1) → `/tmp/st-asm-*.png`. `probe-assembly-page.mjs` = the same check on the REAL page (scrolls the live track). (`probe-dim.mjs` is OBSOLETE — it tested the removed `.ender-fade` veil.) ⚠ 2026-07-04 night: headless-chrome↔vite module fetches went flaky on this box (random `Failed to fetch` aborts, code-independent) — restart vite + retry, or verify with the user's eyes. |
| `PORT=5173 node editor/probe-sweep.mjs <steps…>` | full-page consistency sweep: screenshot each `data-step` settled → `/tmp/st-sweep-<step>.png`. |

**Dev scrubber** (`scrub.js`, DEV-only UI, tree-shaken from prod) — ONE universal frame-seekable bar on
every autoplay animation, so the user pins the exact bad frame and `Copy`s e.g. `engine · your browser
t=6.01s [result · Nxf7]`. `Reel` = a virtual-clock timeline that REPLACED the setTimeout pipelines and
drives them in prod too: each `playX` body became `xBuild(reel)` + a reset hook via `reel.load(build,
reset)`; `at()`/`every()` replace `setTimeout`/`setInterval`; rAF loops read `reel.time()`. It even
seeks CSS animations/transitions (`reel.attachCss(scope)` pauses them + drives `currentTime`). GSAP
(coach) wraps via `gsapTransport(tl)`. Wired: steps 1/2/3 + engine (`sections.js` reels `reel1/reel2/
revReel/engReel`), `number-to-reason.js`, `coach.js`. The OLD hand-rolled bars (coach `buildScrubber`,
sections `buildReviewScrub` HTML-snapshot hack) are deleted. To add a new animated thing: drive it off
the reel (`at`/`every`/`reel.time()`), never its own clock, or it won't pause/seek.

**Engine-verify** (`/tmp/sfverify`) — verify EVERY crafted FEN before using it. Rebuild in 10s:
`cp frontend/public/engine/stockfish-18-lite-single.js /tmp/sfverify/stockfish.cjs` + the `.wasm`
**renamed to `/tmp/sfverify/stockfish.wasm`** (locateFile derives the wasm name from the .cjs basename
— mismatch = `ENOENT` abort). `node /tmp/sfverify/check.cjs "FEN1" "FEN2" …` speaks UCI (`setoption
name MultiPV value 3` / `position fen … / go depth 22`). Forced wins show ~depth 16; quiet evals need 20–22.

---

## Design system & preferences (decided — don't re-derive)
- **Theme:** dark default + light. Vars in `base.css` (`--bg:#0a0a0a` `--bg2:#111110` `--ink:#f5f3ee`
  `--muted` `--line`); `body.light` resets them. Every new surface MUST work in both themes (add a
  `body.light` override for any hard-coded color). Caption/label overlays sitting over BOTH dark and
  light backgrounds need their own dark pill + light text (`.n2r-step`/`.n2r-cap`).
- **Card colors:** warm grey `#272522` for move-log/data cards; white `#f8f7f5` for comment/explanation
  cards (own scoped `--ink`/`--muted` for dark text on white). Light theme grey cards → `var(--bg2)`.
- **Break the 50/50 pattern** — each step gets a layout chosen for its own demo.
- **The "chess analysis tab" panel** (`rev-panel`) is the house style for board demos:
  `[eval bar | board | sidebar]` in one rounded card; sidebar = stacked cards (comment on top, move log
  below), chess.com-style.
- **Board:** `.rev-sq` squares + `.rp` pieces positioned by % (12.5% grid), chess.com NEO PNGs (`NEO`
  const in `sections.js`). Move tags in prose = NEO PNG + square, pill-styled (`.rev-mv`). Move ratings
  = local SVGs in `./icons/` (`good.svg`, `best.svg`, `blunder.svg`…).
- **Buttons clicked by a fake cursor** (`.fakecursor`/`.s4-cursor`): flies in, `press`+`clicking`
  classes, then acts. Same pattern in steps 1, 2, 4.

## Animation patterns (reuse these)
- **Video-like demos LOOP while on screen** (2026-07-04): the step reels (1/2/3/engine) + Beat 2 are
  `loop:true` with an `endHold` (hold the final frame ~2.2–3s, then replay); Beat 2 pauses off-screen and
  resumes on return; the coach loops via its GSAP `onComplete`; the finale intentionally RESTS on its CTA.
- **Autoplay video-style, NOT scroll-scrubbed.** Demos play on a timer when the section enters view.
  Only the hero outro + the "talks."→"talks?" hook morph are scroll-linked (in `scroll-engine.js`).
  Exception: the Beat-1 gears ARE scroll-coupled (he asked for it).
- **Timers:** per-step registry `tN`/`iN` + `TN(ms,fn)` + `clearN()`; `demoIO` calls `fire(n)`/`reset(n)`.
  Always push timers to the registry so resets cancel cleanly. `TN` schedules from when it's called →
  safe to chain inside callbacks.
- **Typewriter:** token arrays mixing strings (char-by-char) and `{mv,code}` move-tags (pop in whole as
  a pill). See `s4type` / step-3 `REV_TOKENS`.
- **Reduced motion:** every `play*` has an `if(RM())` branch jumping to the final state. Keep it.
- **Pacing:** SLOW between scenes (~0.8–1.8s pauses) so the viewer comprehends each beat.
- **Smoothness:** lock board size (e.g. 300×300) so it never resizes when sidebar text grows;
  comment card content-sized, sidebar capped to board height with `overflow:hidden` so long text clips
  INSIDE (never `flex:none`, never unbounded `flex:1`); tall `line-height` so inline pills never grow a
  line; strike = a line that SWEEPS left→right greying text (not instant `line-through`).
- **A fixed-size stage must `fit()` to width AND height** (`s = min(1, availW/960, availH/540)`) or it
  overflows short sections and collides with the title.

## Cinematics = pre-rendered VIDEO (the perf endgame — 2026-06-23)
Heavy below-the-fold cinematics are converted to **pre-rendered clips**: rendered ONCE at max quality
offline, shipped as a hardware-decoded `<video>` → ~zero runtime cost on ANY device, and quality no
longer touches device perf (so crank resolution freely). **Hero + gears stay LIVE** (they sit over text,
where a video bg won't composite). **Finale = DONE (video). Coach = NEXT** — video for the 3D, but keep
its captions/typed-code as **LIVE editable HTML** (user wants to edit text without re-rendering; the GSAP
timeline that positions overlays is cheap — only the WebGL render is heavy, so only that becomes video).

**Render pipeline (dev-only, `record/` + `editor/`):**
- `record/studio.html`+`studio.js` — max-quality offline stage; `?scene=…&ss=<supersample>`; exposes
  `window.RB.frame(p)` (deterministic per-frame) + `RB.glRenderer`. An importmap maps `three`→CDN so it
  also runs **without Vite** (the Colab bundle).
- `editor/record.mjs` — headless-Chrome frame capturer → PNG seq. `GL=sw` (this GPU-less box, ~13–25 s/
  frame) or `GL=gpu` (Colab). Env: `SCENE PORT URLPATH FRAMES W H SS OUT DBG FSTART FEND`. Renders sync +
  waits node-side (headless rAF throttling hangs it otherwise). **Don't edit served files mid-render** (HMR
  stalls it); parallel slices thrash on this 4-core/6 GB box — use ONE instance.
- `editor/encode.mjs` — PNG seq → `<scene>.mp4` (H.264) + `.webm` (VP9) + poster via `ffmpeg-static`
  (npm) or system ffmpeg. Env: `SCENE FPS CRF VPCRF IN OUTDIR FFMPEG`. Output → `public/landing/video/`.
- **GPU path (no GPU here):** `editor/make-render-kit.mjs` → `render-kit.tgz` (self-contained, no Vite) +
  `render/colab-render.ipynb` (Colab GPU notebook). A **Colab MCP** (`googlecolab/colab-mcp`) is in
  `.mcp.json` (needs `uv` + a Claude-Code restart + the user's Google auth) so a future session drives the
  GPU directly. To feed Colab, the kit must reach it (git clone or upload).
- **Re-render the finale:** `npm run dev`, then `GL=sw SCENE=ender FRAMES=120 W=2560 H=1440 SS=1.25
  OUT=/tmp/rec/ender node editor/record.mjs` → `SCENE=ender FPS=24 IN=/tmp/rec/ender node editor/encode.mjs`.
  Current finale clip: 2560×1440, ~4.6 MB mp4. Verify playback: `node editor/probes/probe-endervideo.mjs`.

## Performance — the lightness pass (2026-06-19; never regress)
The page had ~8 WebGL contexts ALL rendering every frame forever + all created at boot → the hero
intro + every scroll lagged. Two rules fix it (proven via `editor/probe-perf.mjs`: off-screen = **0**
draws/sec):
- **Every render loop MUST be visibility-gated.** A `requestAnimationFrame` that calls `renderer.render`
  unconditionally is a bug. Gate it: hero (`scene.js`) skips both renderers when `#heroSec` is off-screen;
  `coach.js` `frame()` early-returns unless its IntersectionObserver set `visible`; `gears`/`logoGears`
  already skip via a rect check; `ender.js` renders only while `active`. Any NEW 3D scene does the same.
- **Below-the-fold 3D modules load LAZILY, never at boot.** `main.js` `lazy3D()` arms an approach-observer
  (`rootMargin:'300%'`) per section AND idle-preloads (`requestIdleCallback`, staggered, started ~3s after
  load so it never competes with the intro). Boot creates only the hero context → buttery intro. Don't add
  a `await import('./<3d>.js')` at boot; register it in the `heavy3D` list instead.
- Pixel ratio cap ≤ **1.5** everywhere (was 1.75 on coach). The loader wordmark illuminates letter-by-letter
  with real progress (`setProgress` toggles `.lit`; CSS in `base.css`).

**v3 — the performance manager / "runs on almost any device" (2026-06-22; the root fix).** `perf.js` is
now a manager, not just an fps gate. It picks a **tier** at boot from cheap signals (reduced-motion / no
WebGL / software GPU → `min`; saveData / deviceMemory≤2 / mobile / cores≤4 → `low`; cores≤8 → `mid`; else
`high`) and exposes ONE `QUALITY` object every module reads: `{dpr, antialias, fpsCap, hero, gears, cinema}`.
- **DPR is the big lever** (render cost ≈ quadratic in DPR): capped 1.0 (low/min) → 1.25 (mid) → 1.5 (high).
  `antialias` off except high. Every renderer is built `antialias:QUALITY.antialias` + `registerRenderer(r)`
  (the manager owns `setPixelRatio` and can lower it LIVE). No module sets pixel ratio itself anymore.
- **Tier gates which 3D loads** (`main.js`): hero behind `QUALITY.hero`, gears/logoGears behind
  `QUALITY.gears`, coach/ender behind `QUALITY.cinema`. Per the user's priority: the **hovering hero is
  dropped first** on weak devices, the **spinning gears are kept longest**, the **cinemas** in between.
  Each render loop also early-returns on its flag so the watchdog can disable it live.
- **Adaptive FPS watchdog** (`startWatchdog`) — **TWO-WAY since 2026-07-04**: 3 bad ~1s windows (>30%
  frames dropped) → one graduated demotion down the ladder (lower DPR → drop hero → lower DPR → drop
  cinema → lower DPR → drop gears); sustained clean windows → promotion back up toward the boot tier
  (flapping doubles the required clean streak). Flick-scroll windows need a 2× worse ratio to count and
  hidden-tab windows are discarded. The OLD one-way version permanently killed the hero/coach/gears on
  any 2s jank until refresh — never regress to one-way.
- **Lite CSS** (`styles/ender.css`): `body.lite-cinema` hides the coach canvas + collapses the 350vh
  `.ender` (and `ender.js` zeroes its veil when `!QUALITY.cinema`); `body.lite-gears` hides gear canvases;
  `no-hero` is the existing wordmark fallback. Debug/test any device with **`?perf=min|low|mid|high`**
  (forces a tier); `window.__perf` shows the detected tier. Probe: `GL=sw PERF=high node editor/probe-tier.mjs`.
- `fpsGate()` now takes NO arg — it reads `QUALITY.fpsCap` live (so a demotion tightens every loop at once).
  The old per-module `FPS` export is gone.

**First-play jank = lazy shader compiles/texture uploads (2026-07-05).** The finale hitched at every
first-seen object/effect until one full pass had rendered. Fix pattern: a `warmup()` on the scene —
`renderer.compile` + render ONE frame of every beat while the canvas is still CSS-invisible, then reset
to t=0 (safe because frame(t) is pure). The controller warms the front-layer renderer too, builds the
scene at `rootMargin 250%` AND idle-prebuilds ~6s after load. Any new heavy scene should warm up the same way
(the hero already does — `warmUpRender` in scene.js).
  - **CAVEAT — "reset to t=0" is NOT automatically clean for captured-piece DISSOLVE state (2026-07-11 bug).**
    frame(t) is only pure for state written EVERY frame. The queen/king dissolve (`setDissolve` → `uDis`) is
    written ONLY inside its move window (`setCapture` runs only when `t≥m.at`), and `frame(0)` skips `setMoves`
    (`t<MOVE_START`) — so warmup's late beats (Kxd8 t≈18.4, mate, detonation) left the queen at `uDis=1` and
    the final `frame(0)` never reset it. Result: the queen's shader DISCARDED every fragment (invisible, even
    though `.visible=true`) from load until her capture window at t≈15.2 — she "popped in" only when the king
    took her. Fix: warmup explicitly `setDissolve(MOVES[2].cap_g,0)` + `setDissolve(_theKing,0)` before its
    trailing `frame(0)`. Lesson: after any warmup that touches window-gated state, RESET that state by hand —
    don't trust `frame(0)`. (Offline render never warms up + walks t upward, so uDis stays 0 there — this only
    bit the live path.) Proven via the A/B CDP probe: old-warmup-sim → `uDis:1`, fixed warmup → `uDis:0`.

**Three.js "faster WITHOUT lowering quality" (reusable, the standard pro moves — pixel-identical output):**
- **Never re-bake the shadow map every frame.** A shadow pass re-renders every caster from the light's POV —
  as costly as a second scene. Set `renderer.shadowMap.autoUpdate = false` and drive `needsUpdate` yourself
  ONLY when a caster actually moved (or half-rate for soft/slow shadows — imperceptible ≤1-frame lag). The
  finale (`ender-scene.js`) was setting `needsUpdate=true` every frame for ~45s → now half-rate (`_shadowFrame & 1`).
  Camera motion NEVER needs a shadow re-bake (the map is from the light, not the eye).
- **`powerPreference:'high-performance'`** on every `WebGLRenderer` — a free hint so dual-GPU laptops pick the
  discrete GPU instead of the weak integrated one.
- Other zero-quality levers when needed: `matrixAutoUpdate=false` on static decor (call `updateMatrix()` once
  FIRST or it snaps to origin), reuse geometries/materials, no per-frame allocations (scratch objects), keep
  render loops visibility-gated + fps-capped (already done). Quality-COST levers (DPR, fewer lights, drop AA)
  stay in `perf.js`'s tier system — don't reach for them to fix a hotspot you haven't profiled. **If lag
  persists after the free wins, PROFILE (`renderer.info.render.calls/triangles` + DevTools Performance)** to
  find the real hotspot rather than guessing.

**v2 — the frame-rate governor (2026-06-21; never regress).** `requestAnimationFrame` fires at the DISPLAY
refresh, so on 120/144Hz panels every on-screen WebGL loop re-rendered 120–144×/sec (the hero is TWO
full-screen contexts) — the real cause of the "laggy / low fps" report, NOT gating. Fix: `perf.js` exports
`fpsGate(fps)` + a tunable `FPS` object (`hero:50 · gears:36 · coach:40 · ender:40` — one dial). Each loop
calls `if(!gate()) return;` AFTER its visibility check, before `renderer.render`. Motion stays correct
because it's all clock/`tl.time()`-driven. The gears were ALSO converted to a **time-based** idle spin
(`SPIN.idle*…*dtF`) — they used to spin 2–2.4× too fast on high-refresh displays — and accumulate scroll
delta across throttled frames (`scrollAcc`) so the scroll-coupled spin stays exact. Any NEW 3D loop MUST
fps-gate the same way. Further levers if still heavy: lower decorative DPR (gears→1.25), fewer idle-preloaded
contexts (8 live at once).

## Chess accuracy (non-negotiable — burned us)
- **Never guess a position.** Verify EVERY crafted FEN with the engine harness before using it.
  Verify legality AND the story (the fork really forks, the king must move out of check, etc.).
- **Best move = Stockfish's #1, full stop.** A small eval gap doesn't make it "not best".
- No eval numbers in prose (repo R1 holds on the landing too).
- Locked positions: Beat-1 Fried Liver `r1bqkb1r/ppp2ppp/2n5/3np1N1/2B5/8/PPPP1PPP/RNBQK2R w` → **Nxf7**.
  Step-4 `r1qr2k1/pb3ppp/1p6/2pN4/4P3/8/PP3PPP/R2Q1RK1 w` → Good=Qf3 (level), Best=**Ne7+** (royal fork).

---

## ALWAYS / NEVER
**ALWAYS:** match surrounding idiom · keep both themes working · push timers to their registry · keep
the `RM()` branch · `node --check sections.js` after JS edits · verify chess with the engine · lock
board size · keep the comment card content-sized.

**NEVER:** scroll-scrub a step demo · invent a "best move" · let a card resize the board or spill above
it · reuse a `const` name already declared in `sections.js` (namespace step-scoped consts: `S4_PC`…) ·
add red accent lines or any flourish he didn't ask for · over-plan a fix I can just see and approve ·
show a screenshot unprompted.

## Mistakes to avoid (real bugs, kept for immunity)
- **Asset paths assembled inside JavaScript strings are invisible to Vite's production bundler** — Beat 2's
  dock used literal `./icons/dock/...` strings, so dev worked but the files were absent from the Pages build.
  For module-owned local artwork, use a separate static `new URL('./path', import.meta.url).href` for each
  asset; Vite can then fingerprint, emit, and base-prefix it. Verify the built DOM URLs and HTTP responses.
- **Overlapping ASYNC scene builds orphan objects** — ui.js re-applies a saved theme at boot, so
  setHeroTheme's buildBackPieces raced the initial one; the loser added a SECOND rook nothing ever
  animated/removed (the "ghost rook until refresh"). Any async build that adds to a scene needs a
  generation token (only the latest call mutates) + must remove what's already there itself.
- **Fixed overlays driven only from a gated rAF loop POP on fast scroll** — the finale CTA opacity was
  written only inside the fps-capped loop (which also stops when `active` flips), so scrolling up fast
  froze "Your games hide moments…" on screen, then it snapped off. Drive overlay fades from the scroll
  handler too, and give them a short CSS opacity transition.
- **`position:fixed` overlays appended to `<body>` do NOT scroll away with their section** — the finale's
  CTA/flash/front-piece lingered over the next section after the cinematic ended (they're driven only by the
  clock, force-hidden only at `ratio≤0.01`). Fix: an `exitFade` computed in `onScroll` from the section rect
  (`lead = max(r.top, innerHeight - r.bottom, 0)` → `1 - lead/(0.4·vh)`; 1 while it covers the frame, →0 as
  either edge scrolls in) multiplied into every fixed overlay's opacity in `ender.js`. In-section (non-fixed)
  layers like `.ender-canvas` don't need this — they scroll off naturally.
- `buildAbsBoard` does `el.innerHTML=h` → wipes overlay children of `#engBoard`. Put scan/net/arrow
  overlays as **siblings in `.engboardwrap`**, not inside the board element.
- Bottom-anchored overlays collide with a zoomed full-bleed element → zoom a bit less + bias the camera
  centre upward (`camTo(el, k, centerY)`) to reserve a bottom strip for the caption.
- Same-baseline raw→readable cross-fades look garbled mid-transition (~0.3s overlap); sequence them if
  it bothers him (fade raw fully out, THEN fade readable in).
- One source of truth for a reveal — never let a safety `setTimeout` fight an animation tween (the
  intro flicker: `introScale` vs `__intro.v` desynced; tween must start from the CURRENT value).
- 3D things must be visible without precise scroll — gears idle-spin continuously; scroll only ADDS
  rotation (tying visibility to scroll-progress hid them at progress 0).

---

## STATUS TRACKER

### 🎯 ACTIVE — "How StockThink works" cinematic, 3 beats after the hook
- **Hook (data-step 6, scroll morph):** "Stockfish that talks." morphs "." → "?". WORKS — keep it.
- **Beat 1 — "The strongest engine — right in your browser." (01/03, data-step 7) — DONE & approved.**
  Gears + the "engine in your browser" demo (`engBuild`/`engReel` in `sections.js`; panel right-aligned
  off the gears; explanation card matches the review card; CSS under
  "engine-in-your-browser" in `how-it-works.css`, markup in `.s1right` of data-step 7). Timeline (ms
  from fire): 500 scan → 2500 board shrinks+fades → 2950 net panel + `Calculating…` → 4250 `Processing…`
  → 5800 `Nxf7` result pops → 7450 board returns → 8000 L-arrow + `★Nxf7` chip → 8400 typed explanation.
  **Engine visual language (reuse for any engine beat):** neural net = SQUARE nodes on a white compute
  panel, teal→green, edges DRAW IN in two ramped stages; loader word `Calculating…`→`Processing…`;
  result move pops standalone on the panel, THEN board returns (a sequence, not simultaneous); knight
  arrow is L-shaped (up then left), green `#6fc24a`; stats = big mono number over a small label; scan =
  green gradient bar bottom↔top.
- **Beat 2 — "How we process Stockfish's output." (02/03, data-step 8) — BUILT.** The number→reason
  cinematic (`number-to-reason.js`, own observer + a `Reel`). ~24s: opening title card → a cursor opens
  VS Code from the dock → terminal types UCI → `analysis.json` (cursor opens it, panes sequenced — no
  crossfade garble) → plain facts → pattern-match heat table → StockThink app card (loads, then the
  verdict). Captions = clean lower-third (green kicker + white caption + scrim, no pills). Helpers:
  `camTo`/`cursorTo`/`zoomToComment`/`heat`. CSS `styles/number-to-reason.css`, header `.lay-theater`.
- **Beat 3 — "A coach that studies while you sleep." (03/03, data-step 10) — BUILT, needs final polish.**
  Autoplay 3D GSAP cinematic in `coach.js` (Claude logo → book → subagents → board); one paused timeline
  `tl` with per-act `tl.addLabel(...)`. Scrubber via `gsapTransport(tl)`. Anything animated MUST run off
  `tl.time()` (never its own clock) or it won't pause/seek. Tunables at the top (`CAM`/`POS`/`SHIFT`/…) —
  change numbers, not structure. No headless screenshots (no WebGL) — verify with the user's eyes.
  Board/pieces load from **real URL files** (`coach-board.js` uses `window.PIECES`/`window.BOARD3D` set by
  `pieces.js`; the old ~6.8 MB base64 `coach-board-data.js` blob is DELETED, `board-layout.js` keeps the
  opening layout). **NEXT: convert to video** (see "Cinematics = pre-rendered video") — clip the 3D, keep
  the captions/typed-code as live editable HTML.

- **Beat 4 — THE FINALE — "The Queen's Grave" — the live move cinematic is DONE (2026-06-30).**
  Réti–Tartakower basement set (board on a table under a caged Edison bulb). The full queen sacrifice now
  PLAYS OUT as a live WebGL cinematic driven by ONE clock `view.frame(t)` (so it scrubs deterministically
  AND bakes to `<video>` identically). Files: `ender.js` (controller: scroll veil + `body.ending` flip +
  the real-time clock + the rating lower-third HUD), `ender-scene.js` (THE cinematic — see its top-of-file
  tunables), `ender-board.js` (per-piece FEN builder, real URL GLBs). The retired `<video>` path
  (`ender-video.js`) stays intact for after the bake.
  **The cut (all tunable — `MOVES` table + `CAM_KEYS` in `ender-scene.js`, numbers not structure):**
  establishing → pieces rain in → dolly to seated White POV → held beat → **8…Nxe4 🔴** (knight hops, grabs
  the bait, cold-red flash; white Ne4 topples) → **9.Qd8+ ✨** (the queen's long low glide up the WHOLE
  d-file into the king's lap, gold flare, big push-in) → **9…Kxd8** (forced; queen topples + fades, clearing
  d8) → **10.Bg5+ 🟢** (clears d2 → unblocks Rd1 = DOUBLE check; the cut's ONE widen+lift+ORBIT so two
  converging beams — rook d-file cool-teal + bishop diagonal gold — read as a wedge on d8) → **10…Kc7** (the
  king flees, beams fade) → **11.Bd8# 👑** (the bishop returns to **d8, the queen's grave**, to mate; rook
  d-file re-lights to show it guards; king resign-topples) → outro recompose. Throughout: the room DRAINS
  to chiaroscuro (ambient/exposure/fog + a camera-child vignette) while the spotlight HUNTS the king.
  Open FEN `rnb1kb1r/pp3ppp/2p2n2/4q3/4N3/3Q4/PPPB1PPP/2KR1BNR b kq - 0 8`. Line is engine-verified
  (chessops + SF18 d24; `Kc7→Bd8#` chosen, `Ke8→Rd8#` is the verified sibling). Dev harness:
  `editor/probes/finale-stage.html` + `probe-finale.mjs <t…>` (screenshots any beat) + `probe-finale-pos.mjs`
  (numeric square check) + `badge-preview.html` (the HUD). **OPEN:** it's ~45s AUTOPLAY-on-arrival — long
  for a scroll page; duration / the 220vh section / autoplay-vs-scroll-scrub are open dials for the user.
  Re-render to video on approval (studio.js drives `frame(t)`; `FRAMES ≈ DURATION*24`).
  **ENDING (death → nuclear blast → hero tableau → CTA) — DONE & approved (2026-07-04).** After the mate:
  king topples → dissolves+shakes → DETONATES (fireball + heat wobble + radial whiteout). Out of the white
  the **4 surviving black pieces GLIDE IN like the hero pieces** (blown out under the white, then descend
  from above-and-to-a-side, lean→straighten→soft-land onto the dialled `TABLEAU[]` poses; tunables in
  `const HERO={hide,glide,lat,tilt}` + `setScatter`). The **CTA (`.ender-cta` = copy + bottom scrim) fades in
  WITH the pieces** — `ctaAt` retimed to `EXPLODE_AT+4.1` (~39.5s), was `+7.2` (felt ~3s late). The f6 knight
  is `front:true` → renders on `.ender-front` ABOVE the copy (`ender.js` lifts it at `t>duration-6.0`, under
  the white). **The `mushroom-explosion.html` finale STUDIO was removed** (done with it) — tune `ender-scene.js`
  directly now. Not a Vite entry (inputs: `index.html` + `landing/index.html`), so the build is unaffected.
  **ENTRY = the scroll-SCRUBBED ASSEMBLY (2026-07-04 night, v2 — replaced the radial light-up the user
  disliked).** The canvas is alpha:true; while the page keeps its OWN background the set assembles out of
  nowhere — table rises from below, lamp+cord drop from above, board slides in from the left, each part
  fading in (per-part material opacity) — then the "lights go out": the dark room fades in via the clear-
  colour alpha + fog, `body.ending` flips at assemP>0.75, and only at assemP=1 does the GAME clock arm
  (the pieces rain). It's a PURE function of scroll (`assemP = -r.top/(0.9vh)` in ender.js) so scrolling
  back up plays the whole entry in REVERSE; mid-game scroll-up FREEZES the game clock (resumes on return).
  Scene side: `setAssembly(p)` + the `ASSEMBLY` tunables in ender-scene.js (windows/from-offsets); partial
  p re-applies EVERY frame (frame()'s setEffects rewrites fog/bg — a memoized skip floods the fog back);
  restore-at-1 runs once. `setEffects`' background write is null-guarded (bg is null during assembly).
  The offline render path never calls setAssembly → bakes untouched. The CTA also fades on scroll-up via
  a scrollY anchor captured when it first appears (`ctaAnchor` — edge-based exitFade alone was too late on
  the 220vh track). Director/keyboard-nav/RM bypass the assembly (set fully built).

After the finale: an optional further cinematic — editable 3D masters now at
`~/stockthink-3d-source/landing-source-html/` (the basement/board source HTML moved out of the repo).

### 🧰 PAUSED — the Live Edit Interface (`editor/`)
A real, working dev-only tool (use it to Pick elements / read `editor/edits.json`); just NOT the active
build. Verified: Page→regions→sections→components tree, Pick, Components/Settings tabs, per-row pencil,
full-range controls, 3D-objects-as-nodes, Save→edits.json, drag/resize. **Spec: `the-edit-interface.md`.**
Loaded only in dev via `main.js`, tree-shaken from prod. Next-if-resumed: wire the disabled search ·
multi-select · add-text/component · "request a setting". Verify with `node editor/devtest.mjs`.

### 🔧 LOW-PRIORITY (only if he raises it)
- `sections.js` still holds DEAD code — `playEval/playExplain/playLoop` + `buildNet/EvalBoard/ExBoard/Pipe`
  (old steps, unwired; the engine demo now uses `engReel`, so `t7/clear7` is dead too). Safe to delete,
  with the matching dead `evalStage/explainStage/loopStage` CSS in `how-it-works.css`.
- Design-review findings log: `improvement-planning.md` (findings only; the user actions them).

---

## Quality gates (don't regress the app)
Marketing landing, but the repo's real app shares the tree. A pure-UI change must keep `npm run build`
(tsc) and `npx vitest run` green; if you touch commentary/analysis logic (rare from here), also run
`npm run eval`. End a session with one line in `self-improvement/docs/JOURNAL.md`.
