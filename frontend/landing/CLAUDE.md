# StockThink Landing — Frontend Guide & Tracker

This file loads every session you run Claude in `frontend/landing/`. It is BOTH the
build tracker and the design/animation rulebook. Read it, then start working — do
not re-plan what's already decided here.

> **CURRENT FOCUS (2026-06-17): the "How StockThink works" cinematic beats.** Beat 1 (the engine) and
> Beat 2 ("How we process Stockfish's output" — the rev-4 desktop→terminal→json→pattern-match→app
> cinematic in `number-to-reason.js`) are DONE & approved. **Beat 3 (the coach) is next** (still a
> placeholder; the user will shape its copy/idea — confirm before building). The Beat-2 cinematic is the
> QUALITY BAR for these. SEE the page with the headless harness — **`node editor/probe-wd.mjs <ms…>
> [light]`** (multi-phase, Beat 2) or `editor/probe.mjs` (Beat 1). The **Live Edit Interface (`editor/`)
> is an available TOOL, not the active build** (its spec/details are in the 🛠️ section below).

---

## How to work with me (the user's style — follow this exactly)
- **Speedy, direct edits. No over-thinking, no over-planning, no over-complicating.**
- since this is claude.md and runs every session you must use it and update it as you memory
- when the user user points a mistake learn form it and put it in here to avoid it next time
- when the user likes something or a certain animations or a syle learn form it discribe it and how you did it so new session learn form it
  I show you the running page, I see what's wrong, I tell you, you fix it fast.
- Make the edit → tell me what changed in 1–2 lines → I look → I give feedback. Loop.
- It's fine to make mistakes if you're fast and correct them fast. Slow perfectionism is worse.
- **Screenshots: verify silently, show only on request.** Don't narrate browser babysitting or
  push shots at me unprompted. BUT you SHOULD silently screenshot via the headless harness to
  *verify your own work* (read it yourself) — that's encouraged, not the thing I'm vetoing. Only
  surface a screenshot when I ask or when it's genuinely the clearest way to present a result.
- One concern per edit. Don't bundle unrelated changes.
- When I pick an option, build THAT — don't relitigate it.
- when the user tells you dont do theat again note it in the mistaks to avide here 

---

## GO FASTER NEXT TIME (rules earned this session — follow them, they prevent the slow loops)

**0. Touching the Edit Interface? RUN THE HARNESS FIRST, don't edit blind.** `node
frontend/landing/editor/devtest.mjs` (needs `npm run dev`) actually drives the editor headlessly and
prints what Pick selects + the tree + a screenshot. Editing editor.js by reasoning alone cost ~3
rounds of "still broken" this session; one harness run found the real causes immediately. Verify →
then change → then re-verify. (Pick's 3 root causes + the harness are documented below.)

**1. Build on the proven skeleton, layer extras on top.** Any new section starts as
`.s1sec > .s1step > .s1left/.s1right` (the layout that already works). 3D / canvas / video go in
as **separate absolutely-positioned layers** (`z0` behind text, `z3` in front) — NEVER re-layout the
text into a bespoke absolute/sticky stage. (Doing that clustered the title and cost ~6 turns.)

**2. One visible increment at a time — confirm, then add.** For anything non-trivial, ship the
SMALLEST thing the user can see (e.g. just the text), let them confirm, then add the next piece.
Don't deliver a big complex feature in one shot — when it breaks you can't tell which part.

**3. Make the look the USER's to dial, not yours to guess.** For any material / position / timing /
color work, build a throwaway on-page **tuning panel** (sliders + a **"Copy params"** button that
emits a JS-ready config). User tweaks live → pastes the config back → you bake it as the default and
delete the panel. This is the single biggest speed win — the user loved it. Keep tunables as a
plain object at the TOP of the file (see `gears.js` `TUNE`/`GEARS`) so baking = one paste.

**4. Robust-first AND verify by screenshot.** Still write code that works first try (guard missing
DOM, auto-fit canvas every frame, idle-animate motion, isolate WebGL in try/catch) — but you are NOT
blind: capture a PNG via the headless harness (see "Seeing the page") and `Read` it before claiming
done. Only WebGL/3D can't be seen headlessly; use the user's eyes for that.

**5. The user gives you the EXACT target — honour the format, don't re-scope.** He hands you a
`#N selector` + `📌 NOTE` per fix (from the Edit Interface). Go straight to that element. He also
drops **reference media in `frontend/landing/user provides/`** (mp4/gif/png) — ALWAYS look there
first when he says "I gave you a reference"; `Read` the png/gif (first frame) to extract the exact
look, then recreate it in our colors (he'll say e.g. "make it green"). Don't ask where files are
before checking that folder.

**6. Animations = a TIMED phase pipeline you can verify phase-by-phase.** Build every multi-step
animation as a single `playX()` using the `tN/iN/TN/IN/clearN` registry with explicit ms offsets
(see `playEngine` in `sections.js` — scan→board-out→net→result→board→arrow→type, each its own `T7`).
Then verify each phase with `probe.mjs` by tuning `sleep(ms)` to that offset. This turns "is the
animation right?" into a fast, checkable loop instead of a guess. Keep all timings + colors as plain
literals so re-pacing = editing numbers, not logic.

**7. Speed: don't redo standing work.** `probe.mjs` (screenshots) and `/tmp/sfverify` (engine) exist
— reuse them. Verify chess positions in ONE batch run (`check.cjs` with several FENs), pick one, move
on; don't hunt for the "perfect" position. A single edit shouldn't take 40 min — the time sinks were
rebuilding harnesses and over-searching, both now avoidable.

**8. The verification loop is the BIGGEST time sink — capture many phases in ONE Chrome run.** Each
probe spawns Chrome (~5s) + waits to the offset; running it once per phase (this session: ~12 runs of a
13-act cinematic) is most of the wall-clock. **`probe-wd.mjs` is now MULTI-PHASE:** `node
editor/probe-wd.mjs 600 4400 9000 13000 18400 [light]` saves `/tmp/st-wd-<ms>.png` for every offset in a
single session. Pass all the act offsets at once, then `Read` only the PNGs that matter. (For a brand-new
animation, copy this harness and point it at the new selector.)

**9. LOCK the concept before polishing pacing.** Beat 2 was rebuilt 4× as the user reshaped the idea
(board → terminal+gate → data-table → desktop/VS Code). Each time, finely-tuned timings/positions were
thrown away. For a fresh cinematic: restate the STRUCTURE (what each act shows, one line each) and get a
👍 FIRST; build it rough; THEN tune ms offsets / heat / zoom. Don't gold-plate timing before the shape is
approved. Offering 2–3 quick layout/structure options (AskUserQuestion with ASCII previews) up front
beats guessing then rebuilding.

**10. Big animations = their OWN module, per-act functions + a generic camera.** `number-to-reason.js`
is the pattern: its own stage DOM + IntersectionObserver@0.6 + chained `actN()` functions + reusable
`camTo()/zoomToComment()/heat()/fit()`, isolated from `sections.js`, imported in `main.js`, styled in its
own `styles/*.css`. A rework then touches ONE file and feedback localizes to one `actN()`. Use the
self-contained-module pattern for anything bigger than a single `playX()`.

## Engine-verify harness (`/tmp/sfverify`) — rebuild in 10s if `/tmp` was wiped
`cp frontend/public/engine/stockfish-18-lite-single.js /tmp/sfverify/stockfish.cjs` AND the `.wasm`
**renamed to `/tmp/sfverify/stockfish.wasm`** (the .cjs locateFile derives the wasm name from its OWN
basename — mismatched names = `ENOENT stockfish.wasm` abort). Then a node script spawns it, speaks UCI
(`setoption name MultiPV value 3` / `position fen … / go depth 22`), parses `info … multipv N … pv …`
+ `bestmove`. `check.cjs` is the ready instance: `node /tmp/sfverify/check.cjs "FEN1" "FEN2" …`.
Locked Beat-1 position: Fried Liver `r1bqkb1r/ppp2ppp/2n5/3np1N1/2B5/8/PPPP1PPP/RNBQK2R w` → #1 = **Nxf7**.

## Editor verification harness (USE THIS — stop guessing on editor behaviour)
`node frontend/landing/editor/devtest.mjs` (needs `npm run dev` up) launches headless
`google-chrome` (at `/usr/bin/google-chrome`), drives it over CDP via the `ws` pkg, opens the
editor, runs real hover+click Pick on scrolled-in elements, dumps the tree, and saves a shot to
`/tmp/st-editor-shot.png`. The editor exposes `window.__sted` (dev only) for probing. Caveats:
headless has **no WebGL** → `scene.js`/`gears.js` throw on import, so the 3D objects don't appear
AND the `#load` overlay never auto-hides (the harness force-hides it). Three Pick bugs it caught
(2026-06-17): `.sec{pointer-events:none}` hid section content from `elementsFromPoint` (→ force
`pointer-events:auto` while picking); pick auto-disabled after one pick; the highlight overlay
stole the click (→ keep `#st-ed-hl/#st-ed-sel` `pointer-events:none` during pick).

## Seeing the page — the headless harness IS the way (you are NOT blind)
The browser MCPs (chrome-devtools / playwright) can't reach `localhost` here — skip them, don't
retry them. **What WORKS and is proven:** headless **`google-chrome`** (`/usr/bin/google-chrome`)
driven over CDP with the `ws` npm pkg — navigate `http://localhost:5173/frontend/landing/index.html`,
scroll to a selector, `Page.captureScreenshot` → save PNG → `Read` it. `editor/devtest.mjs` is the
ready-made instance (it also opens/drives the editor + dumps the tree); copy its CDP boilerplate for
a plain screenshot of any page state. **Caveats:** headless has **no WebGL** → 3D (hero pieces,
gears) won't render in the shot, and the `#load` overlay must be force-hidden
(`document.getElementById('load')?.classList.add('done')`). So: harness to SEE the DOM/layout/editor;
the user's eyes only for 3D/visual polish that headless can't render.

### `editor/probe.mjs` — the ready-made screenshot+probe (USE THIS, don't rebuild it)
Built 2026-06-17, it's the fast path: navigate → force-hide `#load` + remove `pre-intro` → scroll a
selector to center → wait → dump a JSON probe (`engBoard` kids/rect, body classes, scrollY) + save
`/tmp/st-shot.png`. Run `node frontend/landing/editor/probe.mjs` (needs `npm run dev`), then `Read`
the PNG. Two hard-won gotchas baked in — keep them:
- **Scroll is fought by `html{scroll-behavior:smooth}` + the scroll-engine.** `scrollIntoView` and a
  single `scrollTo` silently no-op (scrollY stays 0). FIX: set `scrollBehavior='auto'`, then **loop**
  `window.scrollTo(0, rect.top+scrollY - innerHeight/2 + rect.height/2)` polling `engBoard.children.length>0`
  until the demo builds. The gearSec centers at scrollY≈7317.
- **Capture a specific animation phase by tuning the post-build `sleep(ms)`** — ms is measured from
  when the demo fires. e.g. Beat-1: ~3700 = scan/stage-1, ~4900 = processing/stage-2, ~9700 = final
  move+typed explanation. Change one number, re-run, `Read`. This is how you verify timed animations.
- Pieces look "missing" in shots = chess.com CDN PNGs don't load headless. Not a bug; they show live.

### `editor/probe-wd.mjs` — MULTI-PHASE shots of Beat 2 (the `number-to-reason` cinematic)
Same CDP boilerplate as `probe.mjs`, but scrolls `section[data-step="8"]`, waits for `#n2rStage.play`,
and captures **several offsets in ONE Chrome session**: `node editor/probe-wd.mjs 600 4400 9000 13000
18400 [light]` → `/tmp/st-wd-<ms>.png` each. Add `light` anywhere to test the light theme. This is the
fast way to review a long autoplay cinematic — pass every act offset at once. Current Beat-2 offsets:
≈600 full desktop · ≈4400 zoomed terminal · ≈9000 json→facts reformat · ≈13000 heat-map table · ≈18400
zoomed explanation. (The IDE/terminal are intentionally dark in both themes; the chess.com CDN pieces
on the app board don't load headless — they show live.)

---

## 🛠️ THE LIVE EDIT INTERFACE (`editor/`) — use it, keep improving it
A **dev-only in-page visual editor** so the user moves/styles things himself instead of
"move this, edit that" chat loops. Iterated every session; goal end-state = a reusable,
maybe-npm-installable **public skill**. **Spec / source of truth: `the-edit-interface.md`**
(concept, goal, the DOM-hygiene contract, dynamic-hierarchy rules, do/avoid) — read it before
extending the tool; keep refining it. Selecting is bidirectional: Pick on the page expands +
reveals the item at its place in the tree (`revealInTree`), and tree rows scroll the page to it.
- **Files:** `editor/editor.js` + `editor/editor.css` (all ids/classes namespaced `st-ed*`,
  cannot collide). Loaded ONLY in dev via `main.js` (`if (import.meta.env.DEV) import('./editor/editor.js')`)
  — tree-shaken out of the production build, never ships.
- **UI = tabbed editing tool** (redesigned 2026-06-17): header (logo + Pick + close) · **two tabs
  `Components` / `Settings`** · footer (count + Copy + Save). Tree rows have a hover **pencil
  button** that opens that item's Settings; Picking on the page also jumps to Settings. Settings
  header has a back-chevron to Components, ↑ parent, reset. Icons are inline SVGs (`ICON` map).
  **Known TODO: the search box is intentionally disabled (not wired up yet).**
- **How the user uses it:** click the floating **✎ Edit** button → panel opens. Pick **Pick**
  mode to click elements on the page, or click rows in the **component tree** (Page → regions →
  sections → components, lazy; hovering a row highlights it on the page). Selected element →
  **inspector** groups: Move/transform (X/Y/Z/scale/rotate), Spacing, Size, Color, Text, and a
  **📌 Note for Claude**. Every numeric control = slider **+ unclamped manual box** (type ANY
  value → full range, no "stuck at edge" bug). Live-applies as inline styles.
- **HOW CLAUDE GETS THE EDITS (the output method — this is the whole point):** user clicks
  **Save** → POST to dev endpoint `/__st_edit_save` (a Vite `serve`-only plugin in
  `vite.config.ts`) → writes `editor/edits.json`. **Claude just `Read`s that file** and applies
  the real CSS/HTML. `{selector, classes, styles:{prop:val}, note}` per edit. No chat bloat, no
  paste. (Fallback: **Copy for Claude** button → structured text to clipboard.) `edits.json` is
  gitignored (transient).
- **To add a setting:** push a control into the `GROUPS` array in `editor.js` (kinds: `num` /
  `color` / `select` / `note`); each has `{key,label,get,set}` over the element's edit record.
- **3D objects are separate editable nodes (not one canvas).** WebGL pieces/gears aren't DOM, so
  `vObjects(section)` registers each as its own tree node (chip `3d`) wired to scene APIs:
  hero Knight via `window.setPieceTransform`/`getPieceTransform`; Bishop/Rook via
  `setBackTransform('bishop'|'rook',…)`/`getBackTransform`; gears via `window.stGears` (added to
  `gears.js`). Selecting one shows move/scale/rotate sliders (manual box unclamped). The raw 3D
  canvases (`#c`,`#cBack`,`.gear-canvas`) are hidden from the tree (shown as objects instead).
  3D edits save as `{kind:'3d',target,name,transform,note}` → bake into the `T`/`TB`/`TR` defaults
  in `scene.js` and `GEARS` in `gears.js`. (Can't be verified headless — confirm visually.)
- **The tool drives DOM hygiene (key principle).** The editor only shows what's worth editing:
  the tree is rooted at a `page` node (`<body>`) → structural regions (`nav` / `main` / `footer` /
  `section`, always shown + colour-chipped) → leaf components. Picking (`pickAt` → `isLeafComponent`)
  targets ONLY deep leaf things (titles, text, buttons, icons, the blunder svg, progress bar) and
  NEVER a section/full-screen layer. Invisible/decorative chrome (opacity:0, full-bleed empty divs)
  is filtered (`isHidden`/`isDecorative`). **So: keep the markup semantic and neat** — real `<nav>`/
  `<main>`/`<footer>`, no pointless wrapper divs — and the tool stays clear for the user (and for you).
  Names come from `nameOf` (heading text / button label / alt / humanised id; 3D canvases get
  explicit names). Done 2026-06-17: wrapped content in `<main id="pageClip">`, moved the `.meta`
  corner labels into `<footer class="page-corners">`, so the page now reads nav / Body / Footer.
- **NOT built yet (next increments, from the idea file):** add-new-text-box, add existing
  components (chess pieces / 3D gears with float/animation props), multi-select, delete-a-setting,
  "request a setting" (describe → Claude adds it). Build these smallest-visible-first, confirm, add.

## Where things live (file map)
```
frontend/landing/
  index.html              all sections (hero, steps 0–5, hook 6, beats 7/8/10), static markup
  main.js                 boot: pieces → try(scene) → scroll-engine → sections → number-to-reason → gears → ui
  sections.js             demo controllers + timers for steps 1–5 + Beat 1 engine (playEngine). NOTE: still
                          holds DEAD code — playEval/playExplain/playLoop + buildNet/EvalBoard/ExBoard/Pipe
                          (old steps 8/9, now unwired). Safe to delete in a cleanup, BUT t7/clear7 is shared
                          with the live engine demo — keep that registry.
  number-to-reason.js     Beat 2 cinematic — OWN module (own stage DOM + observer + actN() timeline). rev 4.
  scroll-engine.js        scroll-scrubbed motion: hero outro + the "talks." → "talks?" hook morph
  pieces.js / scene.js    3D hero (three.js + GSAP). scene.js is wrapped in try/catch in main.js
  styles.css              @import manifest →
  styles/
    base.css              CSS vars, theme (:root + body.light), nav, hero, cards frame
    steps-layout.css      per-step layouts, cursor, board card, rail, PGN box (step 1)
    steps-demos.css       per-step demo styling (steps 2/3/4 + how-it-works shared bits)
    how-it-works.css      hook morph + beat LAYOUTS (lay-corners / lay-theater) + Beat-1 engine demo.
                          (The old evalStage/explainStage/loopStage CSS here is dead — see sections.js note.)
    number-to-reason.css  all Beat-2 `.n2r-*`/`.vs-*` styling (theme-aware; IDE/terminal dark by design)
```
Served by Vite multi-page (`vite.config.ts` has `main` + `landing` entries). `npm run dev`,
HMR is instant. Engine assets at `frontend/public/engine/` (also used for verification).

---

## STATUS TRACKER

### 🎯 ACTIVE ARC — "How StockThink works" cinematic beats
Beat 1 (engine) + Beat 2 (number→reason, rev 4) DONE & approved. **Beat 3, the coach (data-step 10), IN
PROGRESS — now an AUTOPLAY 3D CINEMATIC** (the scroll-scrub idea + the old `stockthink-coach-overnight-section.md`
spec are BOTH DEAD). FOUNDATION built (`coach.js` + `styles/coach.css`): the real Claude logo
(`models/claude-logo.glb`, clay material reused from `3D assets/claude-logo-render.html`) faces the user
dead-centre (`FACE_Y=-1.680`), static camera, gentle bob; a corner guide (two lines top-left, one bottom-right)
fades on scroll. **Full plan + acts + open questions: `coach-plan.md` (SOURCE OF TRUTH).** Assets: logo ✓,
board ✓ (`models/chess-board.glb`, 0.54 MB), **3D book ⬜ user provides next session**, code file = 2D overlay.
NEXT: answer the 5 open questions in the plan, then build the camera/Claude choreography on PLACEHOLDER boxes
before swapping in GLBs (lock the move, then materials/timing). Treat the Beat-2 cinematic as the QUALITY BAR.
After the beats: the final cinematic endgame (3D masters at `~/stockthink-3d-source/`). All landing work is
uncommitted on `ux/landing-page`.

### 🧰 PAUSED — the Live Edit Interface (`editor/`)
Still a real, working TOOL (use it to pick elements / read `editor/edits.json`); just NOT the active build.
Verified: Page→regions→sections→components tree, Pick, Components/Settings tabs, per-row pencil, full-range
controls, 3D-objects-as-nodes, Save→edits.json, drag/resize. Spec `the-edit-interface.md`; details in the
🛠️ section below. Next-if-resumed: wire the disabled search · multi-select · add-text/component · "request
a setting". Verify with `node editor/devtest.mjs`.

### ✅ DONE
- **Hero section** (3D wordmark, tagline, scroll outro). Resilient: if WebGL fails,
  `body.no-hero` fallback clears the loader and shows the page.
- **"How to use StockThink" — the 5-step product demo (steps 0–5):**
  - Step 0 intro poster · Step 1 "Get your game ready" (PGN paste) · Step 2 "connect
    chess.com" (multi-select + analyse) · Step 3 "Learn from your mistakes" (live blunder
    review, chess.com-style panel) · Step 4 "See what would've been better" (good → best
    move, engine-verified) · Step 5 closing slide.
  - These use the **autoplay video-style demos** (see Animation rules). Approved look.
- **"How StockThink works" — Beat 1 (data-step 7) DONE & approved (2026-06-17):** gear title + the
  full **"engine in your browser" demo** (scan → board-out → square-node neural net "thinking" →
  Nxf7 result pop → board returns w/ L-arrow + chip → typed explanation). Spec + the reusable ENGINE
  VISUAL LANGUAGE are in "Progress + decisions" below.
- **NOW 3 BEATS (not 4), restructured 2026-06-17:** 01 The engine · 02 The words · 03 The coach.
  The old "It will never bluff you" beat was DELETED; the coach is `03 / 03`. Beat 1 kicker → `01 / 03`.
- **"How StockThink works" — Beat 2 (data-step 8) DONE & verified (2026-06-17, rev 4):** seeded by
  `stockthink-number-to-reason-animation.md` but reworked 4× on the user's notes — **that spec is now
  HISTORICAL (rev 4 diverged completely); the code + this entry are the source of truth, don't rebuild
  from the spec.** NO board. Kicker = just
  `02 / 03`; title = small **"How we process Stockfish's output."** that slides in from the left on reveal
  and **recedes when the animation plays** (`.lay-theater.n2r-playing .cv-top`, set by the module). The
  stage now **fills the section** (`lay-theater` = header overlay + full-bleed `cv-stage`; section height
  `min(86vh,800px)`) for a bigger viewer. Self-contained **~19s, 4-act** cinematic, theme-aware, with a
  `STEP n/4` + caption **pill** (dark, light text — legible on the dark IDE AND the light stage):
  - **① Analyse:** a **Mac desktop** (menu bar + wallpaper) with a **VS Code window** (Explorer showing the
    STOCKTHINK project — engine/, src/, analyse.py… — editor + integrated terminal), shown full, then the
    **camera zooms into the IDE** (`camTo(el,k,centerY)` pans+scales the `.n2r-desk`). Stockfish types
    **complex UCI live** in the terminal (info depth…/bestmove/✓ wrote analysis.json).
  - **② Reformat:** `analysis.json` **appears in the Explorer** (NEW tag); the editor opens it (raw JSON),
    then **StockThink reformats it into plain facts** (editor crossfades JSON → `verdict/move/best`).
  - **③ Match:** a centered **pattern-match TABLE** (`Pattern · Definition · Match · %`); a scan scores each
    with a **% + red→yellow→green HEAT MAP** (`heat()` lerps colour by match); only **`pin`** scores high.
    (User OK'd red here — overrides the old "never red" note.)
  - **④ Explain:** the desk fades and the **StockThink APP** (browser mock: eval bar + board with the pin
    position + Blunder rating + comment) appears, then **`zoomToComment()` zooms into the explanation**.
  - **Files (isolated from sections.js):** `number-to-reason.js` (own 960×540 stage DOM + per-act chained
    timeline + own IntersectionObserver@0.6 + Replay + reduced-motion frame + **`fit()` scales to width AND
    height** + `camTo()` + `zoomToComment()` + `heat()` + `buildMiniBoard()`) · `styles/number-to-reason.css`
    (all `.n2r-*`/`.vs-*`; palette + `body.light` overrides; the IDE/terminal stay dark by design). Header
    layout in `styles/how-it-works.css` (`.lay-theater`). Imported in `main.js`+`styles.css`.
    **StockThink has no logo yet** — the app/IDE use text marks; swap in the real logo when it exists.
  - **Wiring:** data-step 8 is NOT in `sections.js` `fire()/reset()` — the module owns its observer.
    Tune timing via the `at(...)` offsets in each act fn + `CHAR`/`ROW_STEP`/`SCORE_STEP` at the top.
  - **Verify:** `node editor/probe-wd.mjs <ms> [light]` → `/tmp/st-wd.png` (≈600 full desktop, ≈4400 zoomed
    terminal, ≈9000 json→facts reformat, ≈13000 heat table, ≈18400 zoomed explanation). Both themes verified.
  - Beat 3 (coach) still a STAGE-1 placeholder box (on the corners layout).

### 🔧 LOW-PRIORITY BACKLOG (not blocking — only if the user raises them)
- Old carryover: give Steps 3 & 4 one live play-through (Step 4 was rebuilt a few sessions ago) and
  polish any timing/spacing nits. Not urgent — they've shipped fine through many sessions since.
- Cleanup: delete the dead `playEval/playExplain/playLoop` block in `sections.js` (keep the `t7`
  registry — the live engine demo shares it). Lower the file from ~810 lines so it reads faster.

### ⬜ TODO (next arcs, in order)
1. **Beat 3 "The coach" (data-step 10) — IN PROGRESS, autoplay 3D cinematic. SEE `coach-plan.md`.**
   Foundation done (logo faces user + corner guide). The acted-out self-improvement loop: Claude recedes →
   book appears, Claude pulses + spawns a clone (subagent) → clone scans the book, evolves, returns → board
   appears, Claude learns the puzzle + pulses → Claude writes new concepts into a code file. Autoplay (NOT
   scroll). Next: answer the 5 open questions, build choreography on placeholder boxes, then swap in GLBs.
   3D book asset still to come from the user.
2. **Final cinematic endgame show** — the closing 3D/cinematic moment. Editable 3D
   masters live OUTSIDE the repo at `~/stockthink-3d-source/` (see root memory). Not started.

---

## DESIGN SYSTEM & PREFERENCES (decided this session — don't re-derive)
- **Theme:** dark default + light. Vars in `base.css`: `--bg:#0a0a0a` `--bg2:#111110`
  `--ink:#f5f3ee` `--muted` `--line`. Light = `body.light` resets the vars.
  Every new surface MUST work in both themes (add a `body.light` override if it uses a
  hard-coded color).
- **Card colors:** warm grey `#272522` for move-log / data cards (matches step 1 PGN box +
  step 2). White `#f8f7f5` for the comment/explanation card (with its own scoped `--ink`/
  `--muted` so dark text reads on white). Light theme grey cards reset to `var(--bg2)`.
- **Break the repetitive 50/50 pattern.** Each step gets a layout chosen for its own demo
  (poster, app-left, text+panel, etc.). Don't make every step text-left/demo-right.
- **The "chess analysis tab" panel** (`rev-panel`) is the house style for board demos:
  `[eval bar | board | sidebar]` in one rounded card. Sidebar = stacked cards (comment on
  top, move log below, etc.), just like chess.com's review tab.
- **Board:** built from `.rev-sq` squares + `.rp` pieces positioned by % (12.5% grid).
  Pieces = chess.com NEO PNGs (`NEO` const in sections.js). Coordinates = `.rev-coord`
  spans colored to contrast their square (ranks top-left, files bottom-right).
- **Move tags in prose** = NEO piece PNG + square text, pill-styled (`.rev-mv`).
  **Move ratings** = local SVGs in `./icons/` (`good.svg`, `best.svg`, `blunder.svg`, …).
- **Buttons clicked by a fake cursor** (`.fakecursor` / `.s4-cursor`): cursor flies in,
  `press` + `clicking` classes, then action. Same pattern in steps 1, 2, 4.

---

## HOW THE ANIMATIONS WORK (the patterns — reuse these)
- **Autoplay video-style, NOT scroll-scrubbed.** Demos play themselves on a timer when the
  section enters view (think Anthropic feature demos). I REJECTED scroll-scrubbed step
  animations — only the hero outro + the "talks."→"talks?" hook morph are scroll-linked
  (those live in `scroll-engine.js`).
- **Timers:** each step has a registry `tN`/`iN` + `TN(ms,fn)` helper + `clearN()`.
  `demoIO` (IntersectionObserver) calls `fire(n)` when centered, `reset(n)` on leave.
  Always push timers to the registry so resets cancel cleanly. `TN` schedules from the
  moment it's called → safe to chain inside callbacks (e.g. after a typewriter finishes).
- **Typewriter:** token arrays mixing strings (type char-by-char) and `{mv,code}` move-tags
  (pop in whole as a pill). See `s4type` / step-3 `REV_TOKENS`.
- **Reduced motion:** every `play*` has an `if(RM())` branch that jumps straight to the
  final state. Keep it.
- **Pacing:** SLOW between scenes — ~0.8–1.8s pauses so the viewer comprehends each beat.
  Don't rush beats together.
- **Smoothness rules (hard-won):**
  - Lock the board size (e.g. 300×300) so it NEVER resizes when sidebar text grows.
  - Comment/explanation card = **content-sized**, and cap the sidebar to the board height
    with `overflow:hidden` so long text clips INSIDE the card instead of spilling above the
    board. (Do NOT make the comment card `flex:1` unbounded, and never `flex:none` on it.)
  - Keep `line-height` tall enough that inline move-pills never grow a line (kills text
    "shift" as pills type in). Pills `vertical-align:middle`.
  - Strike/cancel = a line that SWEEPS left→right (`width 0→100%`), greying text as it
    passes, then fade. Not an instant `line-through`.

---

## CHESS ACCURACY (non-negotiable — burned us this session)
- **Never guess a position.** Verify EVERY crafted FEN with the real Stockfish before using
  it. Last session the original step-4 demo had the best move BACKWARDS (d3 was best, not d4).
- **Best move = Stockfish's #1, full stop.** A small eval gap does NOT make it "not best";
  it only means the eval bar moves less. Don't editorialize the engine's ranking.
- Verify legality AND the story (fork really forks, king must move out of check, etc.).
- **Verification harness** (rebuild if `/tmp/sfverify` is gone): copy
  `frontend/public/engine/stockfish-18-lite-single.js` → `stockfish.cjs` + the `.wasm`
  alongside, `spawn('node', [enginePath])`, speak UCI (`position fen … / go depth N`,
  `setoption name MultiPV value 3`). The repo's `self-improvement/test/helpers/transport.ts`
  is the reference. Forced material wins show at depth ~16; quiet evals need depth ~20–22.
- Step-4 locked position (engine-verified): `r1qr2k1/pb3ppp/1p6/2pN4/4P3/8/PP3PPP/R2Q1RK1 w`
  — Good = Qf3 (~0.0, level), Best = **Ne7+** (#1, +3.2: royal fork, wins the queen).

---

## ALWAYS / NEVER
**ALWAYS:** match the surrounding code's idiom · keep both themes working · push timers to
their registry · keep the `RM()` branch · `node --check sections.js` after JS edits ·
verify chess with the engine · lock board size · keep the comment card content-sized.

**NEVER:** scroll-scrub a step demo · invent a "best move" · let a card resize the board or
spill above it · reuse a `const` name already declared in `sections.js` · add red accent
lines (or any flourish) I didn't ask for · over-plan a fix I can just see and approve ·
SHOW me a screenshot unprompted (silently verifying with the harness is fine — encouraged, even).

---

## MISTAKES TO AVOID (this session's actual bugs)
- **A fixed-size stage must `fit()` to width AND height.** Scaling only to width let the 540px stage
  overflow a short section and collide with the section title. FIX: `s = min(1, availW/960, availH/540)`
  measuring the `.cv-stage` box (see `number-to-reason.js` `fit()`).
- **Caption/label overlays that sit over BOTH dark and light backgrounds need their own pill.** In light
  theme the dark-ink caption vanished on the dark IDE; over the light stage a light caption would vanish
  too. FIX: a fixed dark pill + light text (`.n2r-step`/`.n2r-cap`) reads on everything.
- **Bottom-anchored overlays collide with a zoomed full-bleed element.** When the IDE zoomed to fill the
  stage, the terminal's last lines sat under the bottom caption. FIX: zoom a bit less + bias the camera
  centre upward (`camTo(el, k, centerY)`) to reserve a bottom strip for the caption.
- **Same-baseline raw→readable cross-fades look garbled MID-transition** (both texts overlap for ~0.3s).
  Acceptable if brief; if it bothers the user, sequence it (fade raw fully out, THEN fade readable in).
- **Biggest time sink (2026-06-17): guessing what a motion word means.** "Transition" got built as
  "sidebar dims/recedes" when he meant "board shrinks→fades→neural-net→result→board returns" — 2
  reworks. "Scan" got built white when he wanted green. FIX = before coding any multi-step motion,
  **restate it back as a numbered second-by-second sequence** and match any reference in `user
  provides/` literally; build to that, don't improvise the choreography.
- **Don't ask "where are the files?" first** — he drops references in `frontend/landing/user provides/`.
  Check there, `Read` them, then build.
- `buildAbsBoard` does `el.innerHTML=h` — it **wipes any overlay child** you put inside `#engBoard`.
  Put scan/net/arrow overlays as **siblings in a `.engboardwrap`**, not inside the board element.
- `const ML_PC` declared twice in `sections.js` → "already declared". Namespace step-scoped
  consts (`S4_PC`, etc.).
- `.s1review #revComment{flex:none}` made the explanation card grow with text and push
  **above the board**. Fix = `flex:1; min-height:0` + sidebar `height:300px; overflow:hidden`.
- Circular width: `width:100%` inside a flex parent with no explicit width re-resolves as
  text types in → the whole card jumps. Give the parent a real size.
- Move-pills taller than the text line → each pill pops the line height → text shifts.
- Instant `line-through` looked cheap; the swept strike line reads as a real "cancel".
- Dismissing the engine's #1 because the gap was small — wrong; best is best.
- Over-searching for the "perfect" position — verify a couple, pick, move on.
- **Custom full-stage layouts cluster/break.** A bespoke `gearStage` with a `position:absolute;inset:0`
  title flex-box clustered the text and was a nightmare to debug. FIX: reuse the proven
  `.s1sec > .s1step > .s1left/.s1right` framework for text, and add 3D/visuals as **separate
  absolutely-positioned canvas layers** behind (z0) and in front (z3) of it — never re-layout the text.
- **"Can't screenshot here" was WRONG (corrected 2026-06-17).** The MCP browsers fail on
  localhost, but headless `google-chrome` + CDP (`ws`) works — see "Seeing the page" /
  `editor/devtest.mjs`. Don't build blind; capture a PNG and `Read` it. Only true blind spot:
  WebGL/3D doesn't render headless.
- **3D things must be visible without precise scroll.** Tying gear visibility to scroll-progress
  hid them at the top of the section (progress 0). FIX: gears idle-spin continuously (always
  visible); scroll only *adds* rotation.
- **Intro "appear → vanish → grow" flicker (intermittent).** Root cause: two visibility sources
  desynced — `introScale` (what `animate()` renders) vs `window.__intro.v` (what the grow tween
  drives) — and a safety `setTimeout` force-set `introScale=1` on SLOW loads, then the tween yanked
  it back to 0. FIX (scene.js): tween starts from the CURRENT `introScale` (can't snap to 0), and
  the safety only fires if the intro never started (`introStarted` guard). Lesson: one source of
  truth for a reveal; never let a safety net fight the animation.

---

## NEXT ARC: "How StockThink works" (steps 6–9) — START CLEAN, STAGED

Last session felt rough because we improvised and patched bad parts. Do NOT do that here.
Build this section in **explicit stages, each gated by my approval before the next:**

1. **STAGE 1 — Layout grid (skeleton only).** Lay out the whole "how it works" run as a
   VISIBLE grid: bordered boxes / placeholder blocks showing where every section and its
   sub-areas sit (heading area, visual area, etc.). No real content, no animation — just
   visible borders so I can approve the spatial distribution. **Stop, show me, get approval.**
2. **STAGE 2 — Content.** Drop the real texts + components into their approved boxes
   (static, no motion). Stop, get approval.
3. **STAGE 3 — Transitions.** Add intro/outro transitions linked to scrolling (reveal on
   enter, exit on leave). Stop, get approval.
4. **STAGE 4 — Animations.** Only now build the per-step demo animations (autoplay,
   video-style). This is LAST.

Never jump ahead a stage. The whole point is to get the bones right before the flesh.

### Progress + decisions (this section)
- **Voice = "reassuring & human"** (chosen). **3 beats** (restructured 2026-06-17, after the "Stockfish
  that talks?" hook): 1 "The strongest engine — right in your browser." (THE ENGINE · 01/03) ·
  2 "How a number becomes a sentence." (THE WORDS · 02/03) · 3 "A coach that studies while you sleep."
  (THE COACH · 03/03). The old beat-2 "No numbers…" title and the "It will never bluff you" beat were
  cut. Beat-2 kicker/copy were rewritten short ("Stockfish gives a move and a score. StockThink finds
  the idea behind it — the tactic, the pattern, the purpose — and tells you in plain words.").
- **Beat 1 DONE (incl. the right-side engine demo, 2026-06-17):** `index.html` data-step 7 = standard
  `.s1step`, title LEFT + two gear canvases (`.gear-back` z0, `.gear-front` z3) wrapping it. The RIGHT
  side (`.s1right`) now holds the **"engine in your browser" demo** — see its spec below. (The old
  "Higgsfield video" idea is dropped.)
- **Gears (`gears.js`):** scroll-coupled spin baked in — idle spin cuts out *while* scrolling so the
  gears track scroll speed+direction frame-by-frame, then resume in the last scroll direction. Tunables
  at top: `SPIN = { idle, scrollK, resume }` (alongside `TUNE`/`GEARS`).
- **The 3D scene = scroll-linked motion is OK here** (user asked for it) — supersedes the old
  "no scroll-scrub" rule for this gear section only.

#### Beat-1 engine demo — spec & knobs (so you can tweak it FAST)
The whole thing is `playEngine()`/`resetEngine()` in `sections.js` (wired to `fire/reset('7')`), CSS
under "engine-in-your-browser" in `how-it-works.css`, markup in the `.s1right` of data-step 7.
DOM: `.engwin` (mac browser chrome: dots + `🔒 your device · offline`) › `.engbody` = `.engboardwrap`
(`#engBoard` house board + `#engScan` + `#engNet` + `#engArrows` + `#engHud` + `#engBest`) and
`.engside` (`#engExp` explanation, `.engml` move log with `.cur` highlight, `.enggraph` w/ area fill).
Timeline (ms from fire): 500 scan → 2500 board shrinks+fades (`.engboard.out`) → 2950 net (`#engNet`
white panel) + `Calculating…` + depth/nodes stats → 4250 word→`Processing…` → 5800 net fades, `Nxf7`
result pops on panel → 7100 panel fades → 7450 board returns → 8000 L-arrow + `★Nxf7` chip → 8400
explanation types out. Everything has an `if(RM())` jump-to-final. Verify phases with `probe.mjs`
sleep offsets (see harness note). Locked move: **Nxf7** (engine-verified, Fried Liver).

#### THE STOCKFISH / ENGINE VISUAL LANGUAGE (user-approved this session — reuse for any "engine" beat)
- **Neural net = SQUARE nodes** in the `user provides/neural-net` topology (input→4→2 with crossing
  edges + a vertical link), on a **white "compute" panel**; teal→**green** (filled `#57bf3c`, outlined
  black-on-white). Edges **DRAW IN** (stroke-dashoffset→0) in **two ramped stages** (input→4 nodes,
  short pause, 4→2 nodes) so you SEE lines grow left→right. Nodes **solid** (no pulse), they **fade
  with the panel** when done.
- **Loader word above the net:** `Calculating…` during stage 1 → fade-swap to `Processing…` for stage 2.
- **Result reveal:** after thinking, the move (`Nxf7`) **pops standalone** big on the white panel
  (text `#474747`), THEN fades, THEN the board returns and shows the move. Don't show the move on the
  board at the same time as the standalone result — it's a sequence.
- **Move arrows are move-shaped:** a knight move is an **L** (rise straight up, then turn and point
  left into the square), not a diagonal line. Arrow green `#6fc24a` (slightly darker than brand green).
- **Stats look like stats:** big mono number (`#2f9e1e`) over a small uppercase label — NOT tiny pills,
  and never overlapping other text. (Dark pills were rejected.)
- **Explanation = typewriter, short & direct, engine-true** (e.g. "Knight to f7 — a fork on the queen
  and rook."). Blinking caret that stops on done. No eval numbers (repo R1 still holds on the landing).
- **Scan sweep** = green gradient bar, bottom↔top (`.engscan.run`). White scan was rejected.
- **WORKFLOW THE USER LIKES — temp tuning panel.** For 3D/visual look work, build a throwaway
  on-page panel (sliders for material + per-object x/y/z/size/etc.) with a **"Copy params"** button
  that emits a JS-ready config; user tweaks live, pastes the config back, you bake it as the default
  and delete the panel. One round, no edit ping-pong. Locked gear values live at the top of `gears.js`
  (`TUNE` + `GEARS`).

### "How StockThink works" — the beats (CURRENT state — supersedes the old steps-7/8/9 plan)
3 beats after the hook (the old "First it reads / Then it explains / sharpens every day" plan + its
`playEval/playExplain/playLoop` demos are obsolete):
- **Hook (data-step 6, scroll morph):** kicker "How StockThink works"; title "Stockfish that talks."
  morphs "." → "?"; sub "Three things happen the moment you hit analyse." WORKS — keep the mechanic.
- **Beat 1 (data-step 7) — "The strongest engine — right in your browser." (THE ENGINE · 01/03)** —
  DONE: gears + the engine-in-your-browser demo (`playEngine` in `sections.js`).
- **Beat 2 (data-step 8) — "How we process Stockfish's output." (02/03)** — DONE rev 4: the
  number→reason cinematic (`number-to-reason.js`). The quality bar.
- **Beat 3 (data-step 10) — "A coach that studies while you sleep." (THE COACH · 03/03)** — NEXT;
  placeholder on `lay-corners`. Idea: an LLM (Claude) studies fresh games/puzzles daily and teaches
  StockThink new patterns (a growing concept list + day/version counter). User will shape the copy —
  confirm the structure before building, then build it as its own module if it's a big cinematic.

After the beats: the final cinematic endgame (editable 3D masters at `~/stockthink-3d-source/`).

---

## Quality gates (don't regress the app)
This is the marketing landing page, but the repo's real app shares the tree. A pure-UI
change must keep `npm run build` (tsc) and `npx vitest run` green. If you ever touch
commentary/analysis logic (you usually won't from here), also run `npm run eval`.
End a session with one line in `self-improvement/docs/JOURNAL.md`.
