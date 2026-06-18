# Landing — UI/UX Improvement Planning (observations only)

**Rules for this doc (read before adding):**
- This is a **pro-designer review log**. I note inconsistencies, imperfections, and improvement ideas.
- **I do NOT change any code from this loop.** Findings only. The user decides what to action.
- Maintained on a recurring pass (every ~10 min) while the user is away; newest pass on top.
- Each finding: `[severity] area — observation → suggested fix`. Severity = 🔴 high / 🟡 medium / 🟢 polish.
- Verify before asserting where I can (read the CSS/HTML); flag anything I can only see live (WebGL/visual).

Reviewed so far: design system (`base.css`) · hero · nav · intro poster · steps 1–2 markup.
Still to review (next passes pick from here): steps 3–5 demos · Beat 1 (engine) · Beat 2
(number→reason) · the coach beat (live) · footer · typography rhythm across sections · copy/microcopy ·
accessibility deep-dive · responsive/mobile.

---

## Pass 2 — hero · nav · intro poster · steps 1–2 markup (2026-06-18)

### 🔴 High
- **No `<h1>` on the page.** The hero wordmark is a `<div class="wordmark">`, step 0 opens with `<h2>`,
  steps use `<h3>`. So the document outline starts at h2 with no h1 → SEO + screen-reader landmark gap.
  → Promote the hero wordmark (or the step-0 lead "The why behind every Stockfish move") to the single h1.
- **Visible placeholder content shipping.** Step 0 still renders `<div class="ohh-img"><span
  class="ohh-ph">your "ohhh" photo</span></div>` — a literal "your 'ohhh' photo" placeholder box in the
  hero poster. → Replace with the real image or hide until it exists; a placeholder in the first
  above-the-fold section undercuts the whole premium feel.
- **Dead nav links.** `Product` and `Pricing` are `href="#"` (jump to top); only "How it works"
  (`#hookSec`) is real. → Wire them, or remove until there's somewhere to go. Half-working nav reads
  unfinished on the very first interaction.

### 🟡 Medium
- **Two theme toggles + an emoji icon.** There's a nav toggle (`#navThemeToggle`, label "Light",
  icon = ☀️ **emoji**) AND the bottom-center `#ctrls` from Pass 1. Pick ONE. And the ☀️ emoji is the
  only emoji icon in an otherwise all-inline-SVG system — it renders differently per OS and breaks the
  crafted look. → Single toggle, custom sun/moon SVG.
- **Missing social/SEO head tags.** `<title>` is just "StockThink"; there's no meta description and no
  Open Graph/Twitter card tags. → A shared link currently previews as nothing. Add description + OG
  image/title/desc (the hero is a strong OG candidate).
- **Fake input semantics.** Step 2's `<input id="ccUser" readonly tabindex="-1">` is a decorative demo
  field; screen readers may still announce an editable textbox. → `aria-hidden="true"` on purely
  decorative demo controls.

### 🟢 Polish
- **Repeated "why behind every move" motif.** Hero tagline = "The why behind every move"; step-0 lead =
  'The "why" behind every Stockfish move.' Nice echo or near-duplication? → Decide if it's an
  intentional refrain; if not, differentiate the two so the hero→step transition adds info.
- **Inline rating-icon chain is duplicated by hand** (full 10-badge set written twice for the marquee
  loop). Works, but it's a big block of hand-maintained markup. → Generate/loop it, or at least comment
  the "×2 for seamless scroll" intent.
- **Tagline dots** (`<span class="dot">` both sides) — confirm they read as intentional ornament and
  not stray bullets at small sizes. (Live check.)

---

## Pass 1 — design system & global CSS (2026-06-18)

### 🔴 High
- **Two different "greens" in the project.** `base.css` brand palette is chess-green
  `--green:#769656` / `--green-bright:#8ab86a`, but the coach beat (and the engine "getting smarter"
  language) uses `#6fc24a`. Two greens read as two brands. → Decide one accent system: either map the
  coach green to a token, or document that #6fc24a is the "AI/learning" accent vs #769656 the "chess"
  accent — but make it intentional, not accidental.
- **No visible keyboard focus states.** `nav .links a`, `#ctrls button`, `.btn`, etc. only style
  `:hover`, no `:focus-visible`. Keyboard users get no focus ring → accessibility gap (WCAG 2.4.7).
  → Add a consistent `:focus-visible` outline token.
- **No global `prefers-reduced-motion` guard for CSS animations.** JS demos branch on reduced-motion,
  but CSS keyframes (`loRise` on the loader, `fade`) and `html{scroll-behavior:smooth}` don't. → Add a
  `@media (prefers-reduced-motion: reduce)` block that neutralizes loader rise + smooth scroll.

### 🟡 Medium
- **Duplicated CSS rules.** `#cardFrame` is defined twice (≈L133 and ≈L152), `.sec` twice (≈L60 and
  ≈L168), `.sec2` twice. Redundant/overriding declarations are a maintenance smell and a source of
  "why didn't my change take?" bugs. → De-dupe into one block each.
- **`--muted` contrast is borderline.** `#8a8a84` on `--bg:#0a0a0a` ≈ 4.6:1 — okay for large text,
  risky for the 11–13px uppercase labels (`.meta`, nav links, eyebrows) where it's used most. → Nudge
  muted lighter (~#9a9a93) or reserve it for ≥14px.
- **Light-theme parity not guaranteed per surface.** The rule "every new surface needs a `body.light`
  override" is real but easy to miss (the coach panels each needed one). → A later pass should diff
  every component for a light override; track misses here.

### 🟢 Polish
- **Wordmark uses raw `vw` (`--wm-size:15.8vw`)** with no max — on ultrawide (>2200px) the hero
  wordmark can get oversized. → `clamp()` it like the section headings already do.
- **`#ctrls` (theme toggle, bottom-center) overlaps content.** It floats at `bottom:24px;left:50%`
  over the scrolling card — on shorter sections it can sit on top of text/CTAs. → Move to nav, or
  auto-hide on scroll.
- **Two ambient glow blobs** (`#amb1` green, `#amb2` amber) are `position:fixed` — they don't move with
  the card scroll, so their light pools feel detached on long scroll. → Consider parallax or fade per
  section. (Confirm live — can't judge intensity headless.)

### Open questions for the user (don't action, just flag)
- Is the **theme toggle** (`#ctrls`) meant to ship to users, or is it a dev affordance?
- Is the **chess-green vs AI-green** split intentional brand language or drift?

---

*(Next pass will review the hero + nav + steps 0–5 markup/spacing for rhythm and consistency.)*
