# BUILD SPEC — StockThink "The Coach That Studies Overnight" (3D scroll section)

Hand this to Claude Code. It is a build script, not a discussion. Execute it. Where it says `TODO`, leave a clear comment and a working fallback.

---

## What this section is

A scroll-driven 3D story about StockThink's self-improvement loop, told with the existing 3D Claude logo as the "coach." Three beats, in order: **it reads → it tests → it learns.** The 3D logo and the 3D chess board are real Three.js (reuse the user's existing GLB viewers). Scroll moves the camera *between* beats; each beat's action autoplays when it centers; ambient motion (logo rotation, constellation shimmer) loops continuously.

The emotional line, in plain words: *StockThink isn't frozen. Every night a coach reads the world's best chess books, tests one new idea until the engine proves it, and wakes up explaining your game a little better than yesterday.*

Color rule that is also the story: **brass/clay = Claude studying** (the logo's native material, do NOT recolor it), **green `#6fc24a` = StockThink getting smarter** (every StockThink-side signal: pattern text, the verify ✓, the growing library nodes). The two colors meeting is the teaching moment. Rejects are grey, never red.

---

## Assets the user already has (reuse, do not rebuild)

1. **`claude-logo-render.html`** — a self-contained Three.js viewer: a matte-clay recolored 3D Claude logo (GLB embedded as base64) with brass accents and a studio-lighting rig, slow auto-rotate. **Extract the GLB base64 + the material/lighting setup from this file** and reuse it. Keep the logo's native brass/clay material exactly as-is.
2. **`black-chess-board-only.html`** — a Three.js board + all pieces rendered in the same matte studio style, GLB embedded. **Extract and reuse** for Beat 2's "engine proves it on the board."

> If extracting both GLBs into one scene is heavy, load them as two GLB blobs and add both to one shared scene. One renderer, one camera, one scene. Do NOT run two separate canvases.

---

## Tech constraints

- **Three.js only** for 3D (reuse whatever version/import style the existing viewers use — match it, don't upgrade). All 2D overlay (captions, pattern text, the library counter, the verify chips) is plain **HTML/CSS positioned over the canvas**, not drawn in 3D. This keeps text crisp and easy to tweak.
- **One `<canvas>`**, `position: sticky; top: 0; height: 100vh`, sitting behind a tall scroll container. The scroll container is ~`300vh` (one viewport of scroll per beat).
- **Scroll → progress:** compute a single `0→1` scroll progress for the section. Map it to three sub-ranges (Beat 1: 0–0.33, Beat 2: 0.33–0.66, Beat 3: 0.66–1.0). Camera position/target lerp across these ranges. Use a smoothed (damped) progress value, not the raw one, so camera motion feels filmic — lerp current toward target each frame at ~0.08.
- **Autoplay-on-center:** each beat has a one-shot "action timeline" (the book beam, the verify pulse, the node flying in). Fire it once when that beat's sub-range becomes active (e.g. progress crosses into it). Guard with a `played[beat]` boolean so it doesn't re-fire on every frame. Ambient motion (logo rotation, constellation shimmer, dust) runs every frame regardless.
- **Easing:** entrances `cubic-bezier(.22,1,.36,1)`; draws/beams `cubic-bezier(.65,0,.35,1)`; the one "node locks into library" pop uses a slight overshoot `cubic-bezier(.34,1.56,.64,1)`. Typing + shimmer are `linear`.
- **`prefers-reduced-motion`:** disable scroll-camera lerp and autoplay; show each beat's *final* state, let the user scroll through three static framed shots. Logo still rotates slowly (or freeze it if reduced-motion is strict — freeze it).
- **Palette (CSS vars):**
  - `--bg:#0b0f0d` · `--ink:#e8efe9` · `--mute:#5d6b62` · `--line:#1c2722`
  - `--accent:#6fc24a` (StockThink green) · `--accent-soft:#8fe06a`
  - `--brass:#c9a24b` (reference only — this lives in the 3D material, not CSS; used if any UI needs to echo the logo)
- **Fonts:** `--mono` (ui-monospace/Menlo) for engine/pattern/counter text; `--sans` (Inter/system) for the human captions.

---

## Scene setup (one Three.js scene)

- **Background:** `--bg` (#0b0f0d), subtle. Optional faint radial vignette via a large dark plane or just CSS on a wrapper behind the canvas.
- **Logo:** centered-ish, the hero. Reuse its material + lights from `claude-logo-render.html`. Slow continuous Y-rotation (~0.0015 rad/frame — slower than the original, scholarly). It stays on screen in all 3 beats; the camera reframes around it.
- **Board:** loaded but **hidden/offscreen-low** at start (position it below, opacity via material or just move it out of frame). It rises into frame only for Beat 2, then lowers again for Beat 3.
- **Lighting:** reuse the studio rig. Add one **brass-tinted key beam** object (a thin elongated glowing plane or a spotlight cone) that we can fade in for Beat 1's "reading beam." Add the ability to tint a soft **green** rim for StockThink moments.
- **Ambient dust (optional, cheap):** a few dozen tiny points slowly drifting, opacity ~0.15, so the void feels alive. Skip if it costs too much.

### Camera keyframes (lerp targets per beat)
Use these as relative framings; adjust numbers to the actual GLB scale. Camera `lookAt` target moves too.

- **Beat 1 (reads):** medium shot, slightly low angle looking up at the logo (reverence). Logo center-frame, a little space upper-left where book spines float. `cam ≈ (0, 0.3, 4.2)`, `target ≈ (0, 0.1, 0)`.
- **Beat 2 (tests):** camera pushes in and tilts DOWN so the logo sits upper-frame and the **board rises into the lower two-thirds**. `cam ≈ (0.2, 1.1, 3.4)`, `target ≈ (0, -0.4, 0)`. This is the only beat the board is featured.
- **Beat 3 (learns):** camera pulls BACK and orbits slightly so we see the logo small-ish at center surrounded by the **growing constellation** of knowledge nodes. `cam ≈ (0.6, 0.5, 6.0)`, `target ≈ (0, 0.2, 0)`. Wide, calm, final.

Lerp camera + target across the damped progress between these three anchor states.

---

## BEAT 1 — "IT READS" (scroll 0 → 0.33)

**Persistent:** logo rotating, dust drifting.

**Ambient/persistent visuals:** 3 faint **source spines** float in the upper-left negative space — represent a GM book, a stack of puzzle cards, a chessprogramming page. Make these simple: small flat planes with `--mute` borders and tiny `--mono` labels (`GM endgames`, `tactics set`, `engine refs`), OR thin 3D slabs if cheap. They drift on a slow 6s sine loop. They are context, dim (opacity ~0.4).

**HTML caption (top, `--sans` `--ink`), fades with scroll-in:**
> Line 1: `Most chess tools ship once and stop learning.`
> Beat. Line 2 (brightens): `StockThink doesn't.`

**Autoplay action (fires when Beat 1 centers, ~2.4s one-shot):**
1. **t=0→500:** One book spine (`GM endgames`) detaches and drifts toward the logo.
2. **t=400→1100:** A **brass key beam** fades in connecting that spine to the logo — the logo is "reading." (Fade the brass spotlight/plane from 0 → ~0.7 opacity, `--ease-inout`.)
3. **t=900→1900:** A single line of **plain-English pattern text** resolves in `--mono` near the logo, in **green `--accent`** (this is the extracted idea, StockThink-side):
   `a rook behind a passed pawn pushes it home`
   (types or fades in, ~24ms/char or a 400ms fade — your call, keep it calm.)
4. **t=1900→2400:** Brass beam dims back to ~0.3; the green pattern line holds, waiting. Caption swaps under it (`--mono` `--mute`): `Every night, it studies one idea from grandmaster play.`

> Brass = the act of studying (Claude side). Green = the idea, now owned by StockThink. Don't mix them.

---

## BEAT 2 — "IT TESTS" (scroll 0.33 → 0.66) — the trust beat

This is the beat that makes skeptics believe the product. It must read clearly: *the book's claim is NOT believed on faith — Stockfish has to prove it on a real board, and sometimes the claim is rejected.*

**Camera:** already tilting down; the **board rises** into the lower frame (animate board Y position up into view over the scroll-in of this beat, OR fire it as part of the autoplay — prefer tying board-rise to scroll progress so it feels physical).

**The green pattern line from Beat 1** travels down and docks above the board (small `--mono` `--accent` chip): `rook behind passed pawn`.

**Autoplay action (fires when Beat 2 centers, ~3.0s one-shot):**
1. **t=0→600:** Board finishes settling, lights up. Set up a **simple, legible position** that demonstrates the pattern: a passed pawn with a rook behind it (hardcode piece positions — reuse the board+pieces GLB; you only need to *place* the relevant pieces, dim or omit the rest). `TODO: confirm exact squares; suggestion — white rook a1, white passed pawn a5, black king g7, black rook somewhere passive.`
2. **t=600→1400 — VERIFY PULSE (pass):** A **green `--accent` verification pulse** runs across the board (a sweep or a pulse ring), the engine "checks" the pattern. A **green ✓** appears with a `--mono` tag: `engine confirms ✓`. The rook + pawn briefly glow `--accent`. This pattern *holds*.
3. **t=1400→2200 — THE REJECT (the line that sells it):** A SECOND candidate pattern chip slides in (`--mute` `--mono`): e.g. `bishop pair always wins here`. The verify pulse runs again — and **fails**: the chip desaturates, an SVG **strike-line draws through it L→R** (`stroke-dashoffset` full→0, 250ms), a `--mono` `--mute` tag reads `unproven — discarded`. It drops and fades.

   > Keep both: one pattern PASSES (green ✓), one FAILS (grey, struck). The contrast is the entire point — it shows rigor, not magic. Same DNA as the Section-1 gate; that's intentional, it threads the two sections together.

4. **t=2200→3000:** Board dims slightly, the **verified** pattern (the green one) brightens and lifts off the board, ready to be filed. Caption (`--sans` `--ink`, the trust line):
   > `But it never takes a book's word for it — the engine has to prove it on the board first.`

---

## BEAT 3 — "IT LEARNS" (scroll 0.66 → 1.0)

**Camera:** pulls back and orbits slightly. Board lowers out of frame. Logo returns to center, now surrounded by a **constellation/library** of knowledge nodes.

**Persistent constellation:** a cluster of small glowing **green `--accent` nodes** orbiting the logo at varying radii, connected by faint `--line` threads — the existing knowledge base. They shimmer (opacity 0.5↔0.8 on slow random offsets) and slowly orbit. Start with ~12–16 nodes already present (knowledge it already has).

**Autoplay action (fires when Beat 3 centers, ~2.6s one-shot):**
1. **t=0→700:** The verified green pattern from Beat 2 **flies into the constellation** and **locks in as a NEW node** with the one overshoot pop (`cubic-bezier(.34,1.56,.64,1)`), a small `--accent` bloom on arrival. The constellation visibly got one bigger.
2. **t=300→900 — counter ticks:** A `--mono` counter near the logo increments: `concepts known   1,248 → 1,249` (the `+1` flashes `--accent`). `TODO: real number from repo if available; else use a believable figure.`
3. **t=900→1600:** Caption (`--sans` `--ink`): `Then it teaches StockThink a new way to explain your moves.`
4. **t=1600→2600 — pull to the close:** Camera settles to the wide final frame. The constellation shimmers, the logo keeps its slow rotation, the cycle is implied to repeat. Final caption resolves (`--sans` `--ink`, larger):
   > `So the version that explains your game tomorrow is smarter than the one today.`
   > Optional kicker line under it (`--mono` `--mute`): `Open, auditable, and always studying.`

**Final resting state (what reduced-motion users see for Beat 3):** wide shot, logo center, dense green constellation with the new node present, both captions shown, counter at the +1 value.

---

## Overlay / DOM structure

```
section.coach (height ~300vh, position relative)
└─ .sticky (position sticky, top 0, height 100vh)
   ├─ canvas#scene            (the one Three.js canvas, fills .sticky)
   ├─ .overlay (absolute, fills, pointer-events none)
   │  ├─ .caption-1  (Beat 1 captions)
   │  ├─ .pattern-line (Beat 1 green pattern text)
   │  ├─ .board-chips (Beat 2 pattern chip + reject chip + ✓ tag)
   │  ├─ .caption-2  (Beat 2 trust line)
   │  ├─ .counter    (Beat 3 concepts counter)
   │  └─ .caption-3  (Beat 3 closing lines)
   └─ .replay (optional, bottom-right, ghost --mute, hover --accent) // re-runs all 3 autoplays
```
Each overlay element is shown/hidden by the same scroll-progress logic that drives the camera. Tie each caption's opacity to its beat's sub-range so they cross-fade as you scroll.

---

## JS skeleton (shape only — implement fully)

```js
const RANGES = { read:[0,0.33], test:[0.33,0.66], learn:[0.66,1.0] };
const CAM = {
  read:  { pos:[0,0.3,4.2],  tgt:[0,0.1,0]  },
  test:  { pos:[0.2,1.1,3.4], tgt:[0,-0.4,0] },
  learn: { pos:[0.6,0.5,6.0], tgt:[0,0.2,0]  },
};
let played = { read:false, test:false, learn:false };
let progress = 0, smooth = 0;

function onScroll(){ progress = sectionScroll01(); }       // raw 0..1 for this section

function frame(){
  smooth += (progress - smooth) * 0.08;                    // damped
  lerpCameraAcrossBeats(smooth, CAM);                      // pos+target lerp
  logo.rotation.y += 0.0015;                               // ambient
  shimmerConstellation();                                  // ambient
  driftDust();                                             // ambient
  fireAutoplaysIfEntered(smooth, played);                  // one-shot guards
  updateOverlayOpacities(smooth, RANGES);                  // captions cross-fade
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
```

`fireAutoplaysIfEntered`: if `smooth` is inside `RANGES.read` and `!played.read`, set `played.read=true` and run the Beat-1 autoplay timeline (a sequence of `setTimeout`s OR a tiny tween chain). Same for test/learn. The Replay button resets `played` to all-false and snaps progress logic so they can re-fire (or just call the three timelines in sequence).

---

## Acceptance test

- One `<canvas>`, one Three.js scene, both reused GLBs (logo + board) loaded into it. No second canvas.
- Logo material stays native **brass/clay** — never recolored to green.
- Scrolling moves the **camera** smoothly between 3 framed beats (damped, filmic), not the page jankily.
- Beat 1: source spines float, a **brass beam** connects book→logo, a **green** pattern line resolves. Caption: studies one idea nightly.
- Beat 2: board **rises** into frame; **one pattern passes** (green ✓ `engine confirms`), **one pattern is rejected** (grey, struck `unproven — discarded`). Trust caption present.
- Beat 3: verified pattern **flies in as a new green node**, constellation grows, **counter +1**, two closing captions. Camera ends wide.
- Color discipline holds: brass = studying, green = StockThink, **rejects grey not red**.
- `prefers-reduced-motion`: three static framed shots at each beat's final state, no autoplay, no scroll-camera lerp.
- A newcomer who scrolls through, sound off, understands: *it reads a book idea → the engine has to prove it (and rejects bad ones) → the proven idea joins a growing library, so it's smarter tomorrow.*

---

## Two things baked in for you to veto later

1. The **reject beat** in Beat 2 (`bishop pair always wins` getting struck) — it's the trust-maker. Easy to remove if you want a cleaner pass-only version.
2. The **counter +1** in Beat 3 — pull the real number from the repo if it exists; otherwise the placeholder reads fine.

When Claude Code builds this, send me what it produces and we'll tune timing/camera and move to the next section.
