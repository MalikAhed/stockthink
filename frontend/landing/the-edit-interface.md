# The Live Edit Interface — Concept & Build Spec

> Status: living document. This is the source of truth for what the Live Edit
> Interface is, why it exists, and the rules Claude must follow when building any
> project so the interface stays clean and useful. It will ship as a public,
> installable skill — treat it as a product spec, not a scratchpad. Keep refining it.

---

## 1. What it is (in one paragraph)

The Live Edit Interface is a **dev-only, in-page visual editor** for a running web
UI. A human opens it on top of their own running app, **selects any real thing on
the page** (a title, a button, an image, a 3D object), **manipulates it directly**
with full-range controls (move, size, color, rotate…), optionally **pins a note**,
and then **hands the result back to Claude as a structured changeset** that Claude
applies to the source code. It turns "describe the change in words, wait, re-describe"
into "show the change by doing it, then transmit the exact delta."

---

## 2. The problem it solves

Editing UI through chat is a **lossy, slow channel**. Spatial and visual intent
("move it a bit left, no, up, make it breathe more") survives badly as text, so it
becomes a ping-pong loop: user describes → Claude guesses → user corrects → repeat.
Every loop costs tokens, time, and patience, and the result is still approximate.

The Live Edit Interface removes that loop:

- **For the user:** direct, pixel-exact control. They *do* the change instead of
  describing it. Drag a slider, see it live, done.
- **For Claude:** unambiguous, machine-applicable instructions — a precise diff of
  *selector → properties* (or *3D object → transform*) plus optional notes — with
  **zero chat bloat**. Claude reads one file and bakes it into the source.
- **For both, long-term:** because the tool is only as good as the markup behind it,
  it pushes the project toward **clean, semantic, well-named structure** — which is
  exactly what makes the codebase easy to edit precisely later.

This is the deeper point: **the tool and the code quality reinforce each other.** A
neat project makes the editor clear; using the editor forces the project to stay neat.

---

## 3. Core principles (non-negotiable)

1. **Human-first surface.** The interface shows *things*, never raw `<div>`s. Every
   editable item has a human name and a colored type tag, arranged in a hierarchy a
   non-technical person understands at a glance.
2. **Never harm the page.** Dev-only (stripped from production builds), fully
   namespaced so it cannot collide with app styles/markup, and feature-guarded so
   missing capabilities (e.g. no WebGL) degrade silently.
3. **Clean round-trip.** Every edit becomes a small, reviewable, idempotent
   changeset Claude can apply mechanically. No guessing, no prose.
4. **Verify, don't assume.** The editor's own behavior (selection, picking,
   hierarchy) must be testable headlessly. Building this blind fails — always prove it.
5. **Smart, per-project structure.** There is no single correct hierarchy. Claude
   derives the right one for *this* interface (see §6).

---

## 4. How it works — structure & user story

### Surface
- A floating **launcher** (dev only) opens a docked, **draggable + resizable** panel.
- The panel has three parts: a **component tree** (the project hierarchy), an
  **inspector** (controls for the selected thing), and a **footer** (edit count +
  Save / Copy-for-Claude).

### User story
1. User clicks **✎ Edit**. The tree shows their project's hierarchy.
2. They find a thing two ways:
   - **Browse the tree** — Page → regions → sections → components → leaf parts, plus
     any non-DOM objects (3D, canvas) attached to their logical parent.
   - **Pick on the page** — toggle Pick, hover (the element highlights with its name),
     click. The selection then **opens at the correct place in the tree hierarchy**
     (the tree expands and scrolls to it) — selecting on the page and selecting in the
     tree are the same act, just two entry points.
3. The **inspector** opens for that thing: full-range controls — every numeric control
   is a slider **plus an unclamped manual box** so any value, however extreme, is
   reachable. Changes apply **live**.
4. They can drop a **📌 note for Claude** on any item ("this is misaligned, pull it
   left ~20px and center it").
5. **Save** → the changeset is written to a file Claude reads (or copied to clipboard).
6. Claude **bakes** it into the real source (CSS / HTML / engine defaults) and the
   panel can be cleared.

### The output contract (the changeset)
- **DOM edit:** `{ selector, classes?, styles: { prop: value, … }, note? }`
- **Non-DOM / 3D edit:** `{ kind: "3d", target, name, transform: { key: value, … }, note? }`
- Written to a transient, gitignored file via a dev-only endpoint; Claude reads and
  applies it. Keep entries **minimal and reviewable**.

---

## 5. How Claude must handle divs (the DOM-hygiene contract)

**This is the heart of the spec.** The editor can only present what the markup makes
presentable. So when Claude builds or edits any project that uses this interface, the
markup is part of the deliverable. Rules:

1. **Use semantic landmarks.** Real `<nav>`, `<header>`, `<main>`, `<section>`,
   `<footer>`, `<aside>`. These become the top-level, color-coded regions of the tree.
   Do not fake regions with anonymous wrapper divs.
2. **One purpose per element. No mindless wrappers.** Every element should earn its
   place. If a wrapper exists purely for layout, it should still be either (a) clearly
   structural and *named*, or (b) invisible to the editor (see rule 4).
3. **Everything editable must be name-able.** A component is presentable only if the
   editor can give it a human name — from heading text, button/link text, `alt`,
   `aria-label`, a meaningful `id`/class, or an explicit `data-ed-name`. **Naming is
   part of the work:** if an important element would otherwise read as "div", Claude
   adds a real name to the source.
4. **Hide structural-only elements from the editor.** Purely decorative or
   must-exist-but-invisible elements (full-bleed overlays, clip/mask layers, grain,
   ambient gradients) must NOT clutter the tree. Keep them detectably non-content
   (zero-size, `opacity:0`, empty + full-bleed) so the editor's filter drops them, or
   tag them to be skipped. The editor is for the human eye — only show what a human
   would want to touch.
5. **Right leaf granularity.** The smallest meaningful unit — a title, a chip, the
   progress bar, an icon — should be a clean, directly-selectable element. Don't bury
   text under deep anonymous span nesting; don't merge several distinct controls into
   one undifferentiated blob.
6. **Non-DOM things are first-class objects, not canvases.** WebGL/3D/canvas content
   must be exposed as **individual logical objects** (e.g. "Knight", "Gear 1"), each
   wired to an engine transform API — never as one giant full-screen canvas that
   "selects the whole page." Each object is separately selectable and movable.

**The div rubric — run it before shipping markup:** *"If I open this in the edit
interface right now, will every editable thing have (a) a clear human name, (b) the
correct parent region, and (c) no junk/duplicate/anonymous nodes around it?"* If not,
fix the structure — that fix *is* the work, and it pays off every future edit.

---

## 6. The dynamic hierarchy (smart, per-project)

Not all projects share a shape. A marketing landing page is a sequence of *beats/
sections*; a dashboard is *panels/widgets*; a form is *field groups*; an app shell is
*nav / content / detail*. The editor's tree must reflect **how the user thinks about
this specific product**, not a fixed template.

Claude derives the hierarchy by:
- **Reading the live structure** — landmarks, sections, repeated components,
  design-system pieces — rather than hard-coding it.
- **Mapping it to a tree:** Page → regions → sections/groups → components → leaf parts,
  with non-DOM objects attached to their logical parent.
- **Choosing depth and grouping that match the mental model** of the product.
- **Keeping it data-driven**, so it adapts as the project grows.

### Who decides the hierarchy — ASK FIRST
At the start of setting up the interface for a project, Claude **must ask the user**
how they want the hierarchy decided, because it's their product and the grouping is a
genuine choice:

- **Claude auto (default/recommended):** Claude proposes an intuitive hierarchy and
  briefly explains it, then lets the user adjust.
- **User-defined:** the user dictates the grouping/labels; Claude implements exactly
  that.
- **Collaborative:** Claude drafts, the user refines.

Respect the answer. If auto, *explain the chosen structure in one or two lines* so the
user can veto. Never silently impose a deep or idiosyncratic hierarchy.

---

## 7. How Claude names things (presentable in the editor)

- **Prefer human labels**, in order: own text (heading/button/link) → `alt` →
  `aria-label` → humanized `id` → humanized first class → tag name.
- **Classify with a type tag + distinct color** (region, title, text, button, link,
  image, icon, field, 3d, group…). Color-coding makes the hierarchy scannable.
- **Give engine/3D objects explicit names** ("Knight", "Gear 1").
- **Truncate** long text to a short, recognizable label.
- If something important can't be named from the DOM, **add a name to the source**
  (`data-ed-name`, a meaningful `id`, or real text). Don't ship "div / div / div".

---

## 8. What Claude MUST do (checklist)

- Keep markup **semantic and named**; when the tree reveals junk or anonymity,
  restructure the source — that's the job.
- **Ask** how the hierarchy should be decided before imposing one.
- Represent **non-DOM objects as separate editable nodes**, never raw canvases.
- Make every control **full-range** (slider + unclamped manual entry).
- Make selection **bidirectional**: picking on the page reveals the item at the right
  place in the tree, and vice-versa.
- **Verify editor behavior** (selection, picking, hierarchy, naming) with a headless
  harness before claiming it works.
- Keep the editor **dev-only, namespaced, and guarded**; it must never affect prod or
  the app's own styles.
- Output a **clean structured changeset**; apply it to source rather than discussing
  edits in chat.

## 9. What Claude must AVOID

- Anonymous wrapper-div soup; unnamed or duplicate-looking nodes.
- Exposing full-screen canvases/overlays as the editable unit.
- Letting Pick or the tree select a whole **section** when the user wants a leaf.
- **Clamped** controls that can't reach extreme/edge values.
- Editor code leaking into the production build or overriding page styles.
- **Guessing** at editor behavior instead of verifying it.
- **Bloating the chat** with edit instructions instead of the structured changeset.
- Imposing a fixed, one-size hierarchy across different kinds of projects.

---

## 10. Toward a public skill (roadmap)

- **Generalize:** auto-detect framework/structure, derive the hierarchy dynamically,
  pluggable control sets per element type, add-new-component, edit-text-in-place,
  "request a setting" (describe → Claude adds the control), multi-select,
  delete-a-setting, persistence of edits.
- **Package:** zero-config dev integration; installable as an npm package / Claude
  skill that any project can adopt.
- **Keep this document as the living spec** — every session that improves the tool
  refines this file: sharpen the concept, add hard-won do/avoid rules, and keep the
  explanation clear enough that a fresh Claude (or a new user) understands the goal,
  the structure, and the standards immediately.
