# Beat 3 — "The Coach" · AUTOPLAY 3D CINEMATIC — SOURCE OF TRUTH

The Claude logo acts out StockThink's overnight self-improvement loop. Module: `coach.js`
(own Three.js scene + GSAP timeline). Styles: `styles/coach.css`. Markup: the `section.coach`
in `index.html` (3 layers: `.coach-canvas` z0 · `.coach-overlay` z1 HUD · chrome z2).

> **This file is the brief I read FIRST every time I touch the coach scene.** It supersedes the
> old "recede → clone → merge-back → board → code" plan (DEAD). When the user changes something,
> update THIS file in the same pass — that's how details stop getting dropped.

## Hard rules (the user has corrected me on each of these — do not regress)
- **DESKTOP-FIRST (for now).** Tune for ~16:9. A separate simpler phone version comes later. Don't
  compromise the desktop composition to satisfy narrow windows.
- **The logo has a FRONT FACE; turning = rotation.y (NOT a z-tilt).** At `logoGroup.rotation.y = 0`
  the face points +Z (at the camera). To look at a target: `yaw = atan2(dx, dz)` (`faceYaw()`).
  `frame()` drives this every tick so Claude/agents keep their face on the book even mid-move.
- **Claude must read SLIGHTLY SMALLER than the book** in the book scene (`CLAUDE.book` ≈ 0.50 →
  verified ratio ~0.84 at the wide shot, ≤1.0 at every inspect angle). The entrance uses the
  bigger `CLAUDE.rest`.
- **Nothing goes INSIDE the book.** Claude (inspection) and every agent angle must clear the book's
  world AABB with a gap > ~0.1. The book's real AABB is ~1.26³ (half-extent ~0.63) — bigger than it
  looks. VERIFY with `editor/coach-check.mjs` (loads the real GLBs, reports gap + size + screen-%).
- **Agents move INDEPENDENTLY, not in unison.** Each owns a region + a primary axis + its OWN loop
  timing (`CLONE_TIMING`) so some go up while others go right/down. Plus a per-agent sway in `frame()`.
- **Camera framing is intentional and verified**, not eyeballed. `SCENE_DOWN` drops only the book
  scene (`down:true` shots); the entrance stays centred. Numbers checked in `editor/coach-frame.mjs`.
- Smooth eases everywhere (`sine.inOut` / `power2.inOut`), generous holds. No snappy `power3` shifts.
- Colour story: clay/brass = Claude studying (never recolored); green `#6fc24a` = getting smarter.

## The beats (current, locked) — each act is a labelled block in `buildTimeline()`
0. **Entrance.** Empty stage (corner titles only). Claude resolves in from transparent, **dead-centre**
   (50/50), at `CLAUDE.rest`. (No "Claude" word — removed.)
1. **Look right.** Claude TURNS about Y (`REACT.lookYaw`) as if something's coming; holds. Titles fade.
2. **Book appears.** It slides in from the right to `POS.book` and scales up. ONLY THEN Claude **backs
   up** (recoil, `back.out`) and **recedes to `CLAUDE.book`** — keeping its current facing (does NOT
   turn to face the book; that side-on view looked bad). `claudeFace` stays OFF.
3. **Curiosity.** Light pause → a **`?` thought bubble** above Claude, lingers. Both visible (Claude
   left ~26%, book right ~71%).
4. **Inspection.** `claudeFace` ON → Claude goes in, camera CENTRES (`focus`), and it **shifts to each
   angle then PAUSES** (`INSPECT_OFF`): front-left close · right-lower-behind (reads smaller) · left-top.
   Face stays locked on the book; stays AROUND it, never inside.
5. **It gets it.** Claude returns to the recoil spot and **faces the user again** (yaw→0); camera back
   to `wide`. A **`♞` chess-piece bubble** (now it knows the book's subject).
6. **Spawn + scan.** Claude **pulses gently**, 3 clones **bud out top/left/right**, then **fly to the
   book** (staggered) and each runs its **own independent shift+pause loop** around its region, facing
   the book. **Camera STAYS WIDE** (no re-centre) so the original Claude stays in frame. (Loops forever
   until reset; this is currently the end — more beats come later.)

## Tunables (all at the top of `coach.js`; geometry-/frame-verified values live here)
`CLAUDE{rest,book}` · `CLONE{scale,count}` · `BOOK{fit,show,rx,ry,rz}` (user-tuned via panel) ·
`POS{home,recoil,book}` · `CAM{settle,react,wide,focus}` + `SCENE_DOWN` (per-shot `down` flag) ·
`REACT` · `INSPECT_OFF` (Claude angles) · `CLONE_OFF` (agent angles, per agent) · `EMERGE` ·
`CLONE_TIMING` (per-agent loop dur/hold) · `SHIFT` (Claude inspect dur/hold) · `FACE_YAW` (flip to PI
if a face ever points the wrong way — currently 0 = correct).

## Tools (USE THESE before/after editing — I am blind to the WebGL render)
- **`editor/coach-check.mjs`** — THE tool. Loads the real GLBs, rebuilds the exact transform chain, and
  reports for every beat: screen-% framing, Claude-vs-book apparent size, and **AABB gap to the book**
  (negative = inside). Ground truth for "smaller than the book", "not inside it", and on-screen.
  Run from `frontend/`: `node landing/editor/coach-check.mjs [aspect]`. Keep its constants in sync with
  `coach.js` when baking, then re-run until every gap is positive and sizes are ≤ the book.
- **dev Tune panel** (⚙ Tune, dev-only) — pose + sliders for book/Claude/clone size & rotation +
  book pos → **Copy params**. The user dials look, pastes back, I bake. Keep `coach-check.mjs` constants
  in sync with `coach.js` when baking.

## Liveliness checklist (the "tiny details" — keep adding, never regress)
face-tracks-the-book (rot Y, continuous) · independent per-agent loops + per-agent sway · gentle bob ·
smooth eases + holds · pulse before spawn · staggered births + staggered fly-over · `?`→`♞` thought
bubbles that follow Claude · recoil overshoot · Claude recedes-as-it-backs-up.

## NOT done yet / next
- After the agents scan: (the rest of the loop — what Claude does with what they learned). TBD with user.
- A simpler **phone** version of this scene.
- Material/lighting polish can only be judged by the user's eyes (WebGL doesn't render headless).
