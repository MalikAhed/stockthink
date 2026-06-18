# BUILD SPEC — StockThink "Number → Reason" cinematic (≈13s, vanilla HTML/CSS/JS)

> **For Claude Code:** This is a complete, execute-not-deliberate build spec for one self-contained
> landing-page section. Build it exactly as written. Do not substitute a framework, do not invent a
> board scene, do not add extra colors. Every timing, color, easing, and motion is specified. If a
> chess.com NEO piece asset exists in the repo, use it where marked `TODO: swap to NEO`; otherwise use
> a clean SVG silhouette placeholder.

## What this animation teaches (the point)
A first-time viewer, even muted, must understand this arc:
**Stockfish output is cold gibberish → StockThink ingests it and makes it readable data (NOT a board) →
it filters many chess tactics down to the one that's actually true on the board → it explains the move
in one plain-English sentence.** The final human sentence is the only payoff; everything before it is
"the program's side."

---

## Global rules
- **Vanilla HTML/CSS/JS only.** No React, no GSAP, no chess.js, no canvas. Use SVG for piece glyphs and
  the strike/cancel lines; DOM + CSS transforms for all other motion.
- **One fixed stage** `960 × 540`, centered, `position:relative`; every child is `position:absolute`.
  **Never animate layout flow** — only animate `transform`, `opacity`, `filter`, SVG `stroke-dashoffset`,
  and bar `height`. Nothing may reflow or shift the box of another element.
- **Palette (CSS custom properties):**
  - `--bg:#0b0f0d` (near-black, green-tinted)
  - `--ink:#e8efe9` (off-white text)
  - `--mute:#5d6b62` (grey-green — the "noise / data" color, also reject color)
  - `--line:#1c2722` (panel borders, rails)
  - `--accent:#6fc24a` (THE one green)
  - `--accent-soft:#8fe06a` (glow / highlight green)
- **Fonts:**
  - `--mono: ui-monospace, "SF Mono", Menlo, monospace` — for ALL engine + process text.
  - `--sans: "Inter", system-ui, sans-serif` — for the FINAL sentence ONLY.
- **Easing tokens:**
  - `--ease-out: cubic-bezier(.22, 1, .36, 1)` → entrances, decode, slides-in.
  - `--ease-inout: cubic-bezier(.65, 0, .35, 1)` → draws, bar moves, slides-out, strike lines.
  - `--ease-snap: cubic-bezier(.34, 1.56, .64, 1)` → the SINGLE "selected" overshoot (pin lock) only.
  - `linear` → only the text-typing and the intake/scan sweeps. Nothing else.
- **Speed-ramp principle:** every motion starts slightly fast and settles slow (that is what `--ease-out`
  buys). Inter-act holds are 0.7–1.1s so each beat lands. Never rush.
- **Color discipline:** one green accent only. Rejected concepts go **grey (`--mute`) and get struck —
  NEVER red.** This keeps the green "selected" moment and the white final sentence as the only warm
  payoffs, so they actually pop.
- **Master clock:** one `const T = {}` object of millisecond offsets, and one `runTimeline()` made of
  `setTimeout`s referencing `T`. An `IntersectionObserver` with `threshold: 0.6` adds a `.play` class and
  calls `runTimeline()` exactly once.
- **Reduced motion:** if `prefers-reduced-motion: reduce`, skip all sweeps/morphs and jump straight to
  the final frame (parked data rows + selected pin + final sentence + low eval bar), fading the whole
  stage in over 600ms.

## Stage z-order (back → front)
1. `bg-vignette` — radial gradient darkening the edges.
2. `scene-noise` — Act 1 terminal log.
3. `scene-data` — Act 2 readable data rows.
4. `scene-queue` — Act 3 concept queue + processing gate.
5. `scene-sentence` — Act 4 final sentence + eval bar.
6. `grain` — optional ~4% opacity noise overlay.

All scenes start `opacity:0` except `bg-vignette`; JS reveals each on schedule.

---

## ACT 1 — THE NOISE  (0.0s → 3.0s)
**On screen:** Black-green void. A terminal panel sits **center-left** (bordered with `--line`, faint).
Raw Stockfish log streams in fast — cryptic, meaningless to a human.

- **t = 0 → 200ms:** `bg-vignette` opacity 0→1. The whole stage scales `1.02 → 1.0` over 600ms
  `--ease-out` (a gentle filmic push-in).
- **t = 200 → 1500ms:** ~9 log lines stream in, **120ms apart**, `--mono` 13px, color `--mute`. Each line
  slides from `translateY(6px)` opacity 0→1 over 200ms. Content (verbatim):
  ```
  info depth 22 seldepth 31 multipv 1
  score cp -312  nodes 4811992  nps 1881233
  pv b5d6 d2d5 c3a4 e1g1
  bestmove b5d6 ponder d2d5
  hashfull 612  tbhits 0
  12...b5d6  cp -312
  ```
  The junk lines (`nodes`, `nps`, `hashfull`, `tbhits`) flicker opacity `1 → .6 → 1` on a 500ms loop —
  live, useless churn.
- **t = 1500 → 2400ms:** A caption types in below the terminal, `--mono`, color easing `--mute → --ink`:
  `Raw Stockfish. Cold numbers, cryptic moves.`  hold 300ms, then a second line fades in under it:
  `Unreadable.`
- **t = 2400 → 3000ms (handoff tension):** The entire terminal **desaturates and dims** to opacity .45.
  Hold. This pile of noise is about to be pulled in.

---

## ACT 1 → 2 — THE PULL + DECODE  (3.0s → 6.2s)
**Key correction:** the noise does **NOT** become a chessboard (we've over-used boards). It becomes
**readable engine data rows** — still "the program's side," but now legible. Readable ≠ explained yet.

- **t = 3000 → 3500ms:** The dim terminal panel slides **left and out** (`translateX(-50px)`, opacity→0,
  500ms `--ease-inout`). Simultaneously a `--accent` **intake sweep** — a soft vertical green light bar —
  passes **left→right** across center (600ms `linear`, opacity .5, then gone). This sweep IS the literal
  "fetched / ingested by StockThink" moment.
- **t = 3500 → 4400ms (the decode — money transition #1):** From center, **3 clean data rows** resolve in,
  stacked. Each row builds in **two stages** so we literally watch gibberish become readable:
  - **Stage A (raw token):** e.g. `b5d6  -312` in `--mute` `--mono`, fades in from `translateY(8px)`
    over 250ms.
  - **Stage B (150ms later — decode):** the raw token **cross-fades** into a readable line with an inline
    piece-glyph SVG. Cross-fade = raw span opacity 1→0 while readable span opacity 0→1 over 300ms, on the
    **same baseline** (no vertical shift, no reflow). A 1px `--accent` underline wipes under each row
    left→right (250ms `--ease-out`) as it resolves — a "verified readable" tick.
    - **Row 1:** `[♝ svg]  Bishop → d6   ·  losing`
    - **Row 2:** `[♛ svg]  best: Queen takes d5`
    - **Row 3:** `eval  ▮▮▮▯▯   black ahead`
  - Rows resolve **staggered 200ms apart**.
  - Piece glyphs: clean SVG silhouettes (`--ink` fill, ~22px), sitting inline-left of each row.
    `TODO: swap to chess.com NEO piece asset if present in repo.` These small crisp glyphs are the ONLY
    visual richness in this act — NOT a board.
- **t = 4400 → 5200ms:** Caption fades in under the rows, `--mono` `--ink`:
  `Now it's readable — but it's still just data.`  (hold). Framing matters: legible ≠ explained yet.
  The underlines glow faintly, holding.
- **t = 5200 → 6200ms (hold + pivot):** Rows settle to a calm resting state (underlines fade to `--line`,
  glyphs steady). One subtle move: **Row 1** (`Bishop → d6 · losing`) brightens to `--ink` and gains a
  thin `--accent` left-edge bar — this is the move we will now explain. Rows 2 and 3 dim to opacity .4.
  Hold 500ms. Handoff to the process.

---

## ACT 3 — THE PROCESS: CONCEPT QUEUE + GATE  (6.2s → 10.4s)
**The mechanic:** many concept tokens line up in a **queue** and feed through a single processing
**GATE** one by one. Wrong ones **grey out and get struck/canceled** and drop away; the right one
**passes the gate and is selected.** This reads like a real program filtering candidates.

**On screen:** The 3 data rows slide to the **far left** as a compact stack (`translateX(-60px)`,
scale .85, 400ms `--ease-inout`) — parked context. Center-right becomes the machine: a vertical **queue**
of concept tokens on the right, feeding **leftward** through a glowing vertical **GATE** (an `--accent`
aperture/slit).

- **t = 6200 → 6700ms (machine wakes):** A `--mono` label types above the gate: `matching patterns…`.
  The GATE fades in: a 2px-wide vertical `--accent-soft` line with soft glow, ~120px tall, centered. A
  faint horizontal **rail** (`--line`) runs from the queue (right) into the gate (left), the track tokens
  ride along.
- **t = 6700 → 7000ms (queue loads):** 6 concept tokens fade in stacked on the **right**, waiting in line.
  `--mono` pills, `--mute` border, opacity .6, each offset 60ms. Top→bottom order:
  `fork · skewer · hanging · discovered · pin · back-rank`.
  They idle subtly (whole stack breathes `translateY ±2px`, 2s loop).
- **t = 7000 → 9400ms (feed through the gate — the core beat):** Tokens advance one at a time,
  **right → left into the gate, 380ms apart.** For each token:
  - It slides along the rail to gate-center (`translateX` to gate, 300ms `--ease-out`), brightening to
    opacity 1 as it enters the gate's glow.
  - **At the gate it is "tested":** a quick `--accent` pulse runs across it (150ms).
  - **REJECT (every token except `pin`):** the test fails → token desaturates to `--mute`; an SVG
    **strike-line draws through it** left→right (`stroke-dashoffset` full→0, 200ms `--ease-inout`); then it
    **drops out below the gate** and fades (`translateY(+50px)`, opacity→0, 320ms `--ease-inout`). The
    queue behind it shifts up to fill the slot (200ms `--ease-out`) — a real "line moving forward" feel.
    - **Special — `fork` (first token):** its gate-pulse flashes `--accent` for ~150ms (it *almost*
      passes) BEFORE the strike draws through it — the "it nearly said the wrong thing, then canceled it"
      rigor beat. Keep this; it's the trust moment.
  - **SELECT (`pin`):** enters the gate, the pulse runs and **holds green** — no strike. Instead it scales
    `1.0 → 1.15` with `--ease-snap` (the ONE overshoot in the whole piece), border + fill go `--accent`, a
    green glow blooms, a ✓ appears, and it **locks in the gate center** (stops moving). All remaining
    queued tokens behind it fade to opacity .1 and the idle stops.
- **t = 7000ms — caption swap:** `it tests every tactic it knows — and cancels what the board doesn't prove.`
- **t = 9400 → 10400ms (selected → carried to the answer):** The locked `pin` token detaches from the gate
  and travels toward the bottom-center answer zone (`translateX/Y` toward the upcoming sentence, 500ms
  `--ease-out`), shrinking to a small chip and leaving a faint `--accent` trail that fades. The gate, rail,
  and queue all fade out (300ms). This carries the matched concept into Act 4. Hold 300ms.

---

## ACT 4 — THE WORDS  (10.4s → 13.4s)
**On screen:** everything machine-like is gone. The parked data rows (far left) remain faint for context.
Center: the one human sentence assembles from the carried `pin` chip.

- **t = 10400 → 10800ms (causal link):** The small `pin` chip lands at the left of an opening text zone
  (center) and **dissolves into the word "pinned"** — chip opacity→0 while the sentence's first key word
  fades in at the same spot over 300ms. (The selected concept literally becomes the word.)
- **t = 10800 → 12700ms (the sentence — money transition #2):** In `--sans`, `--ink`, ~22px, one line
  types out at **~24ms/char**. The box is **pre-sized so there is ZERO reflow** (measure the full string
  in an invisible span first, then reveal via `el.textContent = str.slice(0, i)`; never append nodes).
  Exact string:
  > `Your bishop walks into a pin — the knight behind it can't recapture, so you lose a piece.`

  As key words type, a tiny **synced pulse** (subtle, 150ms brightness pulses):
  - on `pin` → the parked Row 1 (`Bishop → d6 · losing`) brightens.
  - on `bishop` → the `♝` glyph pulses.
  - on `lose a piece` → a faint `--mute` ghost piece fades out near the rows.
- **t = 12700 → 13400ms (consequence lands LAST):** A thin vertical **eval bar** at the far left animates
  its fill height `50% → 20%` over 700ms `--ease-inout`, color easing `--ink → --mute`. The advantage
  visibly drains **after** the explanation — the result always comes last, never leads. Final hold.
- **t = 13400ms:** Done. A ghost **`Replay ↺`** button fades in bottom-right (`--mute` text, hover
  `--accent`). Clicking it resets all elements to their initial classes and re-runs `runTimeline()`.

---

## Implementation notes (so the build is smooth, not janky)
- **Decode cross-fade (Act 2):** each row is a container holding two stacked spans (raw + readable) at the
  same absolute position; animate their opacities only. No layout change, no reflow.
- **Queue mechanics (Act 3):** drive it from a JS array, one scheduler loop:
  ```js
  const CONCEPTS = [
    { name: 'fork',       reject: true,  almost: true  },
    { name: 'skewer',     reject: true                 },
    { name: 'hanging',    reject: true                 },
    { name: 'discovered', reject: true                 },
    { name: 'pin',        reject: false                },
    { name: 'back-rank',  reject: true                 },
  ];
  ```
  For each, schedule slide → test → (strike + drop) | (lock) using `T.feed + i*380`. Each token's strike
  is a per-token `<svg><line stroke-dasharray="…">` animated via `stroke-dashoffset`.
- **Typing with zero reflow:** pre-measure the full sentence in a `position:absolute; opacity:0` span to
  fix the box height/width, then type into a separate visible span. Never append/remove nodes mid-type.
- **Pin / selected glow:** use `box-shadow` + a duplicated blurred element; do not animate `filter: blur`
  on large areas (cheap-looking + janky). Keep glows tight.
- **All timings live in one object** (tune here, not inline):
  ```js
  const T = {
    vignette: 0,    stream: 200,   dim: 2400,
    pull: 3000,     decode: 3500,  dataHold: 4400, pivot: 5200,
    park: 6200,     gate: 6700,    queue: 6700,    feed: 7000,
    lock: 9000,     carry: 9400,
    sentence: 10800, barDrop: 12700, done: 13400,
  };
  ```
- **Trigger:**
  ```js
  const stage = document.querySelector('.stage');
  let played = false;
  new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting && e.intersectionRatio > 0.6 && !played) {
        played = true;
        stage.classList.add('play');
        runTimeline();
      }
    });
  }, { threshold: [0, 0.6, 1] }).observe(stage);
  ```
- **Reduced motion:** final frame = parked data rows + locked `pin` resolved into the sentence + eval bar
  low. Fade the stage in over 600ms; run no sweeps.

---

## Acceptance test (must all pass)
- Total runtime ≈13.4s; autoplays exactly once at 60% in view; holds the final frame; `Replay ↺` re-runs it.
- **Zero reflow or layout jump anywhere** — the board-free data rows and the pre-sized sentence box never
  resize mid-animation.
- Four beats read clearly even on mute:
  1. cold Stockfish noise →
  2. readable-but-still-data rows (with inline piece glyphs, **NO board**) →
  3. concepts queue through a gate, wrong ones greyed + struck + dropped, `pin` selected →
  4. one plain-English sentence, with the eval bar dropping **last** as the consequence.
- One green accent only; rejects are grey + struck, **never red**. The final sentence is the only `--sans`
  element on the stage.
- The two "pulling" moments are present and smooth: the **decode cross-fade** (~3.5–4.4s, gibberish →
  readable rows) and the **queue-through-the-gate** (~7–9.4s, including the `fork` almost-fires-then-cancels
  beat).
- Newcomer takeaway, unmistakable: *Stockfish is gibberish → StockThink makes it readable data → it filters
  many tactics down to the one that's true → it explains the move in one human sentence.*
