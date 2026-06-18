/* ============================================================================
   StockThink live Edit Interface — dev-only visual editor (v0).

   Goal: select anything on the landing page (from a component tree OR by
   clicking it), tweak position/spacing/color/text with full-range sliders +
   manual number boxes, pin a "note for Claude", then SAVE a structured
   changeset that Claude reads from landing/editor/edits.json — no chat bloat.

   Self-contained: all DOM ids/classes are namespaced `st-ed*`. Loaded only in
   dev (main.js guards on import.meta.env.DEV). Iterated every session — keep it
   robust and additive; new controls plug into CONTROLS / GROUPS below.
   ========================================================================== */
import './editor.css';

const SAVE_URL = '/__st_edit_save';        // dev endpoint (see vite.config.ts)
const SELF = (el) => el && el.closest && el.closest('#st-ed, #st-ed-launch, #st-ed-toast, #st-ed-hl, #st-ed-sel');

/* ---- stable selector for an element (how Claude finds it in the source) -- */
function cssPath(el) {
  if (!el || el === document.body) return 'body';
  if (el.id) return '#' + el.id;
  const parts = [];
  let node = el;
  while (node && node.nodeType === 1 && node !== document.body) {
    if (node.id) { parts.unshift('#' + node.id); break; }
    let sel = node.tagName.toLowerCase();
    const p = node.parentElement;
    if (p) {
      const same = [...p.children].filter((c) => c.tagName === node.tagName);
      if (same.length > 1) sel += `:nth-of-type(${same.indexOf(node) + 1})`;
    }
    parts.unshift(sel);
    node = node.parentElement;
  }
  return parts.join(' > ');
}
function elMeta(el) {
  return {
    selector: cssPath(el),
    tag: el.tagName.toLowerCase(),
    id: el.id || null,
    classes: el.className && typeof el.className === 'string' ? el.className : null,
  };
}
/* ---- friendly naming (the user thinks in "things", not "divs") ---------- */
const PICK_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'BUTTON', 'A', 'IMG', 'CANVAS', 'svg', 'INPUT', 'SELECT', 'TEXTAREA', 'LI', 'LABEL']);
function humanize(s) {
  return String(s).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ').trim().replace(/^\w/, (c) => c.toUpperCase());
}
function trunc(s, n = 34) { s = s.replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function typeOf(el) {
  const t = el.tagName;
  if (t === 'BODY') return 'page';
  if (t === 'NAV') return 'nav';
  if (t === 'MAIN') return 'main';
  if (t === 'FOOTER') return 'footer';
  if (t === 'HEADER') return 'nav';
  if (t === 'SECTION') return 'section';
  if (/^H[1-6]$/.test(t)) return 'title';
  if (t === 'P') return 'text';
  if (t === 'BUTTON') return 'button';
  if (t === 'A') return 'link';
  if (t === 'IMG') return 'image';
  if (t === 'CANVAS') return '3d';
  if (t === 'svg') return 'icon';
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(t)) return 'field';
  if (['SPAN', 'LABEL', 'STRONG', 'EM', 'B', 'I', 'SMALL', 'LI'].includes(t)) return 'text';
  return 'group';
}
function nameOf(el) {
  const t = el.tagName;
  if (t === 'BODY') return 'Page';
  if (t === 'MAIN') return 'Body';
  if (t === 'NAV') return 'Navigation';
  if (t === 'FOOTER') return 'Footer';
  if (t === 'SECTION' || t === 'HEADER') {
    if (el.id === 'heroSec' || el.classList.contains('hero')) return 'Hero';
    const ds = el.getAttribute('data-step');
    const head = el.querySelector('h1,h2,h3');
    if (head && head.textContent.trim()) return trunc(head.textContent, 30);
    if (ds != null) return 'Step ' + ds;
    return el.id ? humanize(el.id) : 'Section';
  }
  if (t === 'IMG') return el.alt ? humanize(el.alt) : 'Image';
  if (t === 'CANVAS') {
    if (el.id === 'c') return '3D pieces (front)';
    if (el.id === 'cBack') return '3D pieces (back)';
    if (el.classList.contains('gear-front')) return '3D gears (front)';
    if (el.classList.contains('gear-back')) return '3D gears (back)';
    return '3D scene';
  }
  if (t === 'svg') return 'Icon';
  // own text (titles, buttons, links, paragraphs)
  if (/^H[1-6]$/.test(t) || ['P', 'BUTTON', 'A', 'LI', 'LABEL', 'SPAN'].includes(t)) {
    const txt = el.textContent.trim();
    if (txt) return trunc(txt, 34);
  }
  // a small element whose own text IS its label (e.g. corner notes, pills, chips)
  const directText = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').trim();
  if (directText && el.querySelectorAll('*').length <= 2) return trunc(directText, 34);
  // A layout wrapper that holds whole sections is STRUCTURE, not a component —
  // never name it after a heading buried inside it (that's what made one "group"
  // swallow the whole hero). Name it by id, or call it a content wrapper.
  if (el.querySelector('section') || el.children.length > 4) {
    return el.id ? humanize(el.id) : 'Content';
  }
  // a small wrapper (card / step) — naming it after its heading reads well
  const head = el.querySelector('h1,h2,h3,h4');
  if (head && head.textContent.trim()) return trunc(head.textContent, 30);
  if (el.id) return humanize(el.id);
  if (el.classList.length) return humanize(el.classList[0]);
  return humanize(t.toLowerCase());
}
function label(el) { return el ? nameOf(el) : '—'; }

/* ---- the changeset: selector -> { meta, transform, styles, note } ------- */
const edits = new Map();
function editFor(el) {
  const key = cssPath(el);
  if (!edits.has(key)) {
    edits.set(key, { meta: elMeta(el), transform: {}, styles: {}, note: '' });
  }
  return edits.get(key);
}
function hasAnyEdit(rec) {
  return rec && (Object.keys(rec.transform).length || Object.keys(rec.styles).length || rec.note.trim());
}

/* Re-apply a record's transform + styles as inline styles on its element. */
function applyRecord(el, rec) {
  const t = rec.transform;
  const tparts = [];
  if (t.tx != null || t.ty != null) tparts.push(`translate(${t.tx || 0}px, ${t.ty || 0}px)`);
  if (t.scale != null) tparts.push(`scale(${t.scale})`);
  if (t.rot != null) tparts.push(`rotate(${t.rot}deg)`);
  if (tparts.length) el.style.transform = tparts.join(' ');
  for (const [prop, val] of Object.entries(rec.styles)) {
    if (val === '' || val == null) el.style.removeProperty(prop);
    else el.style.setProperty(prop, val);
  }
}

/* ========================================================================== *
   Control definitions — this is what you extend each session to add settings.
   Each control reads/writes the selected element's edit record.
   kind: 'num' (slider+manual box) | 'color' | 'select' | 'note'
   ========================================================================== */
const px = (v) => (v === '' || v == null ? '' : v + 'px');

const GROUPS = [
  {
    name: 'Move & transform', open: true, controls: [
      { key: 'tx',    label: 'X (left ↔ right)', kind: 'num', min: -2000, max: 2000, step: 1, unit: 'px',
        get: (r) => r.transform.tx, set: (r, v) => (r.transform.tx = v) },
      { key: 'ty',    label: 'Y (up ↕ down)',    kind: 'num', min: -2000, max: 2000, step: 1, unit: 'px',
        get: (r) => r.transform.ty, set: (r, v) => (r.transform.ty = v) },
      { key: 'z',     label: 'Z (stack order)',  kind: 'num', min: -50, max: 9999, step: 1,
        get: (r) => r.styles['z-index'], set: (r, v) => setStyle(r, 'z-index', v === '' ? '' : String(v)) },
      { key: 'scale', label: 'Scale',  kind: 'num', min: 0, max: 8, step: 0.05,
        get: (r) => r.transform.scale, set: (r, v) => (r.transform.scale = v) },
      { key: 'rot',   label: 'Rotate', kind: 'num', min: -360, max: 360, step: 1, unit: '°',
        get: (r) => r.transform.rot, set: (r, v) => (r.transform.rot = v) },
    ],
  },
  {
    name: 'Spacing', open: false, controls: [
      ['padding-top', 'Padding top'], ['padding-right', 'Padding right'],
      ['padding-bottom', 'Padding bottom'], ['padding-left', 'Padding left'],
      ['margin-top', 'Margin top'], ['margin-right', 'Margin right'],
      ['margin-bottom', 'Margin bottom'], ['margin-left', 'Margin left'],
    ].map(([prop, lab]) => ({
      key: prop, label: lab, kind: 'num', min: -200, max: 400, step: 1, unit: 'px',
      get: (r) => stripPx(r.styles[prop]), set: (r, v) => setStyle(r, prop, px(v)),
    })),
  },
  {
    name: 'Size', open: false, controls: [
      { key: 'width',  label: 'Width',  kind: 'num', min: 0, max: 2000, step: 1, unit: 'px',
        get: (r) => stripPx(r.styles.width),  set: (r, v) => setStyle(r, 'width', px(v)) },
      { key: 'height', label: 'Height', kind: 'num', min: 0, max: 2000, step: 1, unit: 'px',
        get: (r) => stripPx(r.styles.height), set: (r, v) => setStyle(r, 'height', px(v)) },
    ],
  },
  {
    name: 'Color', open: false, controls: [
      { key: 'bg',  label: 'Background', kind: 'color',
        get: (r) => r.styles['background-color'], set: (r, v) => setStyle(r, 'background-color', v) },
      { key: 'col', label: 'Text color', kind: 'color',
        get: (r) => r.styles.color, set: (r, v) => setStyle(r, 'color', v) },
      { key: 'opacity', label: 'Opacity', kind: 'num', min: 0, max: 1, step: 0.01,
        get: (r) => r.styles.opacity, set: (r, v) => setStyle(r, 'opacity', v === '' ? '' : String(v)) },
    ],
  },
  {
    name: 'Text', open: false, controls: [
      { key: 'fs', label: 'Font size', kind: 'num', min: 6, max: 200, step: 1, unit: 'px',
        get: (r) => stripPx(r.styles['font-size']), set: (r, v) => setStyle(r, 'font-size', px(v)) },
      { key: 'fw', label: 'Font weight', kind: 'select',
        opts: ['', '300', '400', '500', '600', '700', '800', '900'],
        get: (r) => r.styles['font-weight'] || '', set: (r, v) => setStyle(r, 'font-weight', v) },
      { key: 'ls', label: 'Letter spacing', kind: 'num', min: -5, max: 30, step: 0.1, unit: 'px',
        get: (r) => stripPx(r.styles['letter-spacing']), set: (r, v) => setStyle(r, 'letter-spacing', px(v)) },
      { key: 'ta', label: 'Align', kind: 'select', opts: ['', 'left', 'center', 'right', 'justify'],
        get: (r) => r.styles['text-align'] || '', set: (r, v) => setStyle(r, 'text-align', v) },
    ],
  },
  {
    name: '📌 Note for Claude', open: true, controls: [
      { key: 'note', label: 'Describe the problem / what you want here', kind: 'note',
        get: (r) => r.note, set: (r, v) => (r.note = v) },
    ],
  },
];
function setStyle(rec, prop, val) {
  if (val === '' || val == null) delete rec.styles[prop];
  else rec.styles[prop] = val;
}
function stripPx(v) { return v == null ? '' : String(v).replace(/px$/, ''); }

/* ========================================================================== *
   UI construction
   ========================================================================== */
let panel, treeEl, inspEl, selBar, countEl, searchEl;
let picking = false;
let selected = null;
let selectedV = null;            // currently selected virtual 3D object (if any)
const v3dEdits = new Map();      // id -> { id, name, changed:{}, note }
const hlBox = make('div', { id: 'st-ed-hl' }, '<span class="st-ed-tip"></span>');
const selBoxEl = make('div', { id: 'st-ed-sel' });
const boxViz = make('div', { id: 'st-ed-box' }, '<div class="mar"></div><div class="pad"></div>');

function make(tag, attrs = {}, html) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else e.setAttribute(k, v);
  }
  if (html != null) e.innerHTML = html;
  return e;
}

// inline SVG icons (stroke = currentColor) — keeps the tool crisp & dependency-free
const svg = (p) => `<svg class="st-ed-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICON = {
  target: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/>'),
  layers: svg('<path d="M12 3 3 8l9 5 9-5-9-5z"/><path d="M3 13l9 5 9-5"/>'),
  sliders: svg('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M18 18h2"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="18" r="2"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
  save: svg('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>'),
  edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>'),
  chevron: svg('<path d="m9 6 6 6-6 6"/>'),
};

function buildPanel() {
  panel = make('div', { id: 'st-ed' });
  panel.innerHTML = `
    <div class="st-ed-head">
      <span class="st-ed-logo">✎</span><b>Editor</b>
      <span class="st-ed-grow"></span>
      <button class="st-ed-iconbtn" id="sted-pick" title="Pick mode — click any element on the page">${ICON.target} Pick</button>
      <button class="st-ed-iconbtn ghost" id="sted-close" title="Close editor">✕</button>
    </div>
    <div class="st-ed-tabs" role="tablist">
      <button class="st-ed-tab is-active" data-tab="tree">${ICON.layers} Components</button>
      <button class="st-ed-tab" data-tab="insp">${ICON.sliders} Settings</button>
    </div>
    <div class="st-ed-body">
      <div class="st-ed-pane is-active" data-pane="tree">
        <div class="st-ed-search">
          <span class="st-ed-search-ico">${ICON.search}</span>
          <input id="sted-search" placeholder="Search (coming soon)" disabled />
        </div>
        <div class="st-ed-tree" id="sted-tree"></div>
      </div>
      <div class="st-ed-pane" data-pane="insp">
        <div class="st-ed-insp" id="sted-insp">
          <div class="st-ed-selbar" id="sted-selbar"><span class="sel-empty">Pick an element on the page, or open one from <b>Components</b>.</span></div>
        </div>
      </div>
    </div>
    <div class="st-ed-foot">
      <span class="count" id="sted-count">0 edits</span>
      <button class="st-ed-btn ghost" id="sted-copy">Copy</button>
      <button class="st-ed-btn primary" id="sted-save">${ICON.save} Save</button>
    </div>
    <div class="st-ed-rz st-ed-rz-l" title="Drag to resize width"></div>
    <div class="st-ed-rz st-ed-rz-b" title="Drag to resize height"></div>`;
  document.body.appendChild(panel);
  document.body.append(hlBox, selBoxEl);
  makePanelMovable();

  treeEl = panel.querySelector('#sted-tree');
  inspEl = panel.querySelector('#sted-insp');
  selBar = panel.querySelector('#sted-selbar');
  countEl = panel.querySelector('#sted-count');
  searchEl = panel.querySelector('#sted-search');

  panel.querySelector('#sted-close').onclick = () => toggle(false);
  panel.querySelector('#sted-pick').onclick = () => setPick(!picking);
  panel.querySelector('#sted-copy').onclick = copyForClaude;
  panel.querySelector('#sted-save').onclick = save;
  panel.querySelectorAll('.st-ed-tab').forEach((t) => { t.onclick = () => setTab(t.dataset.tab); });
  // search is intentionally disabled for now (known: not wired up yet)
  // NB: do NOT build the tree here — it walks the whole DOM (getBoundingClientRect
  // on every node) and would force a reflow during the page's intro animation.
  // The tree is built lazily when the panel is first opened (see toggle()).
}
function setTab(name) {
  if (!panel) return;
  panel.querySelectorAll('.st-ed-tab').forEach((t) => t.classList.toggle('is-active', t.dataset.tab === name));
  panel.querySelectorAll('.st-ed-pane').forEach((p) => p.classList.toggle('is-active', p.dataset.pane === name));
}

/* ---- what counts as a real, selectable element -------------------------- */
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'svg', 'path', 'BR', 'HR']);
const MEDIA = 'img,canvas,button,input,select,textarea,h1,h2,h3,h4,h5,h6,p,a,li,label';
// Full-bleed decorative layers (cardFrame, grain, vignette, canvasBg, …) cover
// the whole viewport and carry no content — they made Pick highlight the entire
// page and cluttered the tree. Treat zero-size and big-but-empty elements as junk.
function isDecorative(el) {
  const t = el.tagName;
  if (t === 'IMG' || t === 'CANVAS' || t === 'svg' || t === 'VIDEO') return false; // media is content
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return true;
  const big = r.width * r.height > 0.55 * window.innerWidth * window.innerHeight;
  const hasText = el.textContent.trim().length > 0;
  const hasMedia = !!el.querySelector(MEDIA);
  return big && !hasText && !hasMedia;
}
const LANDMARKS = new Set(['NAV', 'MAIN', 'FOOTER', 'HEADER', 'SECTION', 'ASIDE']);
function isHidden(el) {
  const cs = getComputedStyle(el);
  return cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0;
}
/* A leaf component = the DEEPEST visible thing worth editing: a title, a line of
   text, a button, an icon, an image, a small UI part (progress bar, eval pill,
   the blunder svg…). NEVER a section or a big layout container — picking those is
   what made it feel like it "selected the whole page". */
function isLeafComponent(el) {
  const t = el.tagName;
  if (SELF(el) || SKIP.has(t) || LANDMARKS.has(t)) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return false;
  if (r.height >= window.innerHeight * 0.85) return false;          // full-screen layer / column
  if (r.width * r.height > 0.30 * window.innerWidth * window.innerHeight) return false; // big container
  if (el.querySelector('section')) return false;                    // never a region
  if (['IMG', 'svg', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A', 'CANVAS'].includes(t)) return true;
  if (/^H[1-6]$/.test(t) || ['P', 'LI', 'LABEL', 'SPAN'].includes(t)) return el.textContent.trim().length > 0;
  // a div/figure is a component only if it's a leaf-ish UI part: has its own text,
  // or wraps just an icon/image/single small child (progress bar, badge, chip…)
  const hasDirectText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  if (hasDirectText) return true;
  return el.children.length <= 2 && r.height < window.innerHeight * 0.4;
}
function meaningful(el) {
  if (!el || el.nodeType !== 1) return false;
  if (SELF(el)) return false;
  if (SKIP.has(el.tagName)) return false;
  if (LANDMARKS.has(el.tagName)) return true;          // always show structural regions
  if (isHidden(el) || isDecorative(el)) return false;  // hide invisible / purely decorative chrome
  if (el.tagName === 'CANVAS' && (['c', 'cBack'].includes(el.id) || el.classList.contains('gear-canvas'))) return false; // shown as 3D objects, not raw canvas
  if (['IMG', 'CANVAS', 'VIDEO', 'svg'].includes(el.tagName)) return true; // self is media
  if (el.textContent.trim().length > 0) return true;   // has its own content
  if (el.querySelector(MEDIA + ',canvas,svg')) return true;
  return [...el.children].some(meaningful);             // or wraps something real
}
/* The component under the cursor (innermost first). Skips inline spans so a
   click on a word inside a title selects the whole title, not the <span>.
   Always returns SOMETHING selectable so Pick never feels dead. */
const INLINE = new Set(['SPAN', 'STRONG', 'EM', 'B', 'I', 'SMALL']);
function pickAt(x, y) {
  const stack = document.elementsFromPoint(x, y)
    .filter((el) => el && el.nodeType === 1 && !SELF(el) && !SKIP.has(el.tagName));
  // innermost-first: take the deepest real component. Prefer a block over an
  // inline span (so a word inside a title selects the whole title).
  for (const el of stack) if (!INLINE.has(el.tagName) && isLeafComponent(el)) return el;
  for (const el of stack) if (isLeafComponent(el)) return el;
  return null;   // empty section space → select nothing (never grab a whole section)
}
/* ---- virtual 3D objects: WebGL pieces/gears aren't DOM, so each one is its own
   editable node (wired to the scene APIs) instead of one un-splittable canvas. -- */
const V3D_CTRLS = [
  { key: 'posX', label: 'Move X', min: -15, max: 15, step: 0.05 },
  { key: 'posY', label: 'Move Y', min: -15, max: 15, step: 0.05 },
  { key: 'posZ', label: 'Move Z (depth)', min: -15, max: 15, step: 0.05 },
  { key: 'scale', label: 'Scale', min: 0, max: 5, step: 0.02 },
  { key: 'rotX', label: 'Rotate X', min: -3.2, max: 3.2, step: 0.02 },
  { key: 'rotY', label: 'Rotate Y', min: -3.2, max: 3.2, step: 0.02 },
  { key: 'rotZ', label: 'Rotate Z', min: -3.2, max: 3.2, step: 0.02 },
];
const GEAR_CTRLS = [
  { key: 'x', label: 'Move X', min: -12, max: 12, step: 0.05 },
  { key: 'y', label: 'Move Y', min: -12, max: 12, step: 0.05 },
  { key: 'z', label: 'Move Z (depth)', min: -12, max: 12, step: 0.05 },
  { key: 's', label: 'Size', min: 0, max: 6, step: 0.05 },
  { key: 'spin', label: 'Spin speed', min: 0, max: 4, step: 0.05 },
];
function vObjects(sectionEl) {
  const out = [];
  try {
    if (sectionEl.id === 'heroSec' || sectionEl.classList.contains('hero')) {
      if (window.getPieceTransform) out.push({ id: 'piece:knight', name: 'Knight (3D)', sectionEl, ctrls: V3D_CTRLS, get: (k) => window.getPieceTransform()[k], set: (k, v) => window.setPieceTransform(k, v) });
      if (window.getBackTransform) {
        out.push({ id: 'piece:bishop', name: 'Bishop (3D)', sectionEl, ctrls: V3D_CTRLS, get: (k) => window.getBackTransform().bishop[k], set: (k, v) => window.setBackTransform('bishop', k, v) });
        out.push({ id: 'piece:rook', name: 'Rook (3D)', sectionEl, ctrls: V3D_CTRLS, get: (k) => window.getBackTransform().rook[k], set: (k, v) => window.setBackTransform('rook', k, v) });
      }
    }
    if (sectionEl.classList.contains('gearSec') && window.stGears) {
      for (let i = 0; i < window.stGears.count(); i++) out.push({ id: 'gear:' + i, name: 'Gear ' + (i + 1) + ' (3D)', sectionEl, ctrls: GEAR_CTRLS, get: ((idx) => (k) => window.stGears.get(idx)[k])(i), set: ((idx) => (k, v) => window.stGears.set(idx, k, v))(i) });
    }
    // logo gears (the "engine" wrapped around the Stockfish logo on the closing slide) — deletable
    if (sectionEl.querySelector('.sf-stage') && window.stLogoGears) {
      const g = window.stLogoGears;
      for (let i = 0; i < g.count(); i++) out.push({ id: 'logogear:' + i, name: 'Logo gear ' + (i + 1) + ' (3D)', sectionEl, ctrls: GEAR_CTRLS,
        get: ((idx) => (k) => g.get(idx)[k])(i), set: ((idx) => (k, v) => g.set(idx, k, v))(i),
        alive: ((idx) => () => g.alive(idx))(i), del: ((idx) => () => g.del(idx))(i), restore: ((idx) => () => g.restore(idx))(i),
        isFront: ((idx) => () => g.isFront(idx))(i), setFront: ((idx) => (v) => g.setFront(idx, v))(i) });
    }
  } catch { /* 3D not loaded (e.g. no WebGL) — just show no 3D objects */ }
  return out;
}

const AUTO_OPEN_DEPTH = 2;   // Page → wrappers → sections all visible on open
function buildTree() {
  treeEl.innerHTML = '';
  treeEl.appendChild(treeNode(document.body, 0));   // single "Page" root, like a real web editor
}
function vNode(vo) {
  const node = make('div', { class: 'st-ed-node' });
  node._vo = vo;
  const row = make('div', { class: 'st-ed-row' });
  row.innerHTML = `<span class="st-ed-tog"></span>
    <span class="st-ed-chip type-3d">3d</span>
    <span class="st-ed-name">${escapeHtml(vo.name)}</span>
    <button class="st-ed-editbtn" title="Edit settings">${ICON.edit}</button>`;
  node.appendChild(row);
  row.onclick = (ev) => { ev.stopPropagation(); selectV(vo); };
  row.querySelector('.st-ed-editbtn').onclick = (ev) => { ev.stopPropagation(); selectV(vo, { openSettings: true }); };
  return node;
}
function treeNode(el, depth) {
  const node = make('div', { class: 'st-ed-node' });
  node._el = el;
  const kids = [...el.children].filter(meaningful);
  const vobjs = el.tagName === 'SECTION' ? vObjects(el) : [];
  const total = kids.length + vobjs.length;
  const type = typeOf(el);
  const row = make('div', { class: 'st-ed-row' });
  row.innerHTML = `<span class="st-ed-tog">${total ? ICON.chevron : ''}</span>
    <span class="st-ed-chip type-${type}">${type}</span>
    <span class="st-ed-name">${escapeHtml(nameOf(el))}</span>
    ${total ? `<span class="st-ed-num">${total}</span>` : ''}
    <button class="st-ed-editbtn" title="Edit settings">${ICON.edit}</button>`;
  node.appendChild(row);
  const kidsWrap = make('div', { class: 'st-ed-kids' });
  node.appendChild(kidsWrap);

  let built = false;
  const buildKids = () => {
    if (built) return;
    for (const k of kids) kidsWrap.appendChild(treeNode(k, depth + 1));
    for (const vo of vobjs) kidsWrap.appendChild(vNode(vo));
    built = true;
  };
  const toggleOpen = () => { if (!total) return; buildKids(); node.classList.toggle('is-open'); };
  // exposed so revealInTree() can expand the path down to a picked element
  node._buildKids = buildKids;
  node._open = () => { if (total) { buildKids(); node.classList.add('is-open'); } };

  row.onmouseenter = () => showHighlight(el);
  row.onmouseleave = () => hideHighlight();
  // chevron toggles open/closed; the row body selects (+ scrolls page to it & reveals);
  // the pencil opens its Settings tab.
  row.querySelector('.st-ed-tog').onclick = (ev) => { ev.stopPropagation(); toggleOpen(); };
  row.onclick = (ev) => { ev.stopPropagation(); select(el, { scroll: true }); };
  row.querySelector('.st-ed-editbtn').onclick = (ev) => { ev.stopPropagation(); select(el, { scroll: true, openSettings: true }); };

  if (depth < AUTO_OPEN_DEPTH && total) { buildKids(); node.classList.add('is-open'); }
  return node;
}
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function filterTree(q) {
  // simple: expand everything and dim non-matches by text content
  treeEl.querySelectorAll('.st-ed-node').forEach((n) => {
    const txt = n.querySelector('.st-ed-row').textContent.toLowerCase();
    n.style.display = !q || txt.includes(q) ? '' : 'none';
  });
}
function nodeForEl(el) { return [...treeEl.querySelectorAll('.st-ed-node')].find((n) => n._el === el); }
/* Expand the tree down to `el` (lazy nodes are built on the way), then select +
   scroll its row into view — so a Pick on the page lands on the right place in
   the hierarchy, not just a page highlight. */
function revealInTree(el) {
  treeEl.querySelectorAll('.st-ed-row.is-sel').forEach((r) => r.classList.remove('is-sel'));
  if (!el) return;
  const chain = [];
  for (let n = el; n && n !== document.body; n = n.parentElement) chain.unshift(n);
  let parent = nodeForEl(document.body);
  if (parent && parent._open) parent._open();
  for (const target of chain) {
    if (parent && parent._buildKids) parent._buildKids();
    const tnode = nodeForEl(target);
    if (!tnode) break;
    if (tnode._open) tnode._open();
    parent = tnode;
  }
  const node = nodeForEl(el);
  if (node) {
    const row = node.querySelector('.st-ed-row');
    row.classList.add('is-sel');
    row.scrollIntoView({ block: 'nearest' });
  }
}

/* ---- selection + inspector --------------------------------------------- */
function select(el, opts = {}) {
  selected = el;
  selectedV = null;
  if (opts.scroll && el && el !== document.body) {
    try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch { el.scrollIntoView(); }
  }
  drawSelBox();
  revealInTree(el);
  renderInspector();
  if (opts.openSettings) setTab('insp');
}
/* select a virtual 3D object (no DOM box — it's WebGL; scroll its section in) */
function selectV(vo, opts = {}) {
  selected = null; selectedV = vo;
  selBoxEl.classList.remove('show'); hideHighlight();
  treeEl.querySelectorAll('.st-ed-row.is-sel').forEach((r) => r.classList.remove('is-sel'));
  const n = [...treeEl.querySelectorAll('.st-ed-node')].find((x) => x._vo === vo);
  if (n) n.querySelector('.st-ed-row').classList.add('is-sel');
  if (vo.sectionEl) { try { vo.sectionEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch {} }
  renderVInspector(vo);
  if (opts.openSettings) setTab('insp');
}
function v3dRec(vo) {
  if (!v3dEdits.has(vo.id)) v3dEdits.set(vo.id, { id: vo.id, name: vo.name, changed: {}, note: '' });
  return v3dEdits.get(vo.id);
}
const round3 = (v) => Math.round(v * 1000) / 1000;
function vCtrlDesc(vo, c) {
  return {
    key: c.key, label: c.label, kind: 'num', min: c.min, max: c.max, step: c.step,
    get: (rec) => (rec.changed[c.key] !== undefined ? rec.changed[c.key] : round3(Number(vo.get(c.key)) || 0)),
    set: (rec, v) => {
      if (v === '') { delete rec.changed[c.key]; vo.set(c.key, Number(vo.get(c.key)) || 0); }
      else { rec.changed[c.key] = v; vo.set(c.key, Number(v) || 0); }
    },
  };
}
function renderVInspector(vo) {
  while (inspEl.children.length > 1) inspEl.removeChild(inspEl.lastChild);
  selBar.innerHTML = `<button class="st-ed-back" id="sted-back" title="Back to Components">${ICON.chevron}</button>
    <span class="sel-chip type-3d">3d</span>
    <span class="sel-name">${escapeHtml(vo.name)}</span>
    <span class="st-ed-grow"></span>
    <button class="st-ed-iconbtn" id="sted-vreset" title="Forget edits recorded for this object">reset</button>`;
  selBar.querySelector('#sted-back').onclick = () => setTab('tree');
  selBar.querySelector('#sted-vreset').onclick = () => { if (vo.restore && !(vo.alive && vo.alive())) vo.restore(); v3dEdits.delete(vo.id); renderVInspector(vo); updateCount(); };
  const rec = v3dRec(vo);
  // keep-or-delete: live-removes the gear and records it so Claude bakes it out
  if (vo.del && vo.restore) {
    const dead = vo.alive ? !vo.alive() : !!rec.deleted;
    const btn = make('button', { class: 'st-ed-delgear' + (dead ? ' is-restore' : '') },
      dead ? '↩ Restore this gear' : '🗑 Delete this gear');
    btn.onclick = () => {
      if (vo.alive ? vo.alive() : !rec.deleted) { vo.del(); rec.deleted = true; }
      else { vo.restore(); delete rec.deleted; }
      renderVInspector(vo); updateCount();
    };
    inspEl.appendChild(btn);
  }
  // front-of / behind the logo: live re-parents the gear between layers, records the choice to bake
  if (vo.setFront) {
    const isF = vo.isFront ? vo.isFront() : !!rec.changed.front;
    const lb = make('button', { class: 'st-ed-layerbtn' }, isF ? '⬇ Move behind the logo' : '⬆ Bring in front of the logo');
    lb.onclick = () => {
      const nv = !(vo.isFront ? vo.isFront() : rec.changed.front);
      vo.setFront(nv); rec.changed.front = nv;
      renderVInspector(vo); updateCount();
    };
    inspEl.appendChild(lb);
  }
  inspEl.appendChild(buildGroup({ name: '3D — move, scale & rotate', open: true, controls: vo.ctrls.map((c) => vCtrlDesc(vo, c)) }, rec));
  inspEl.appendChild(buildGroup({ name: '📌 Note for Claude', open: true, controls: [{ key: 'note', label: 'Describe what you want', kind: 'note', get: (r) => r.note, set: (r, v) => (r.note = v) }] }, rec));
  updateCount();
}
function renderInspector() {
  // wipe everything after the selbar
  while (inspEl.children.length > 1) inspEl.removeChild(inspEl.lastChild);
  if (!selected) {
    selBar.innerHTML = '<span class="sel-empty">Nothing selected — click an element or a tree row.</span>';
    return;
  }
  const rec = editFor(selected);
  const type = typeOf(selected);
  selBar.innerHTML = `<button class="st-ed-back" id="sted-back" title="Back to Components">${ICON.chevron}</button>
    <span class="sel-chip type-${type}">${type}</span>
    <span class="sel-name">${escapeHtml(nameOf(selected))}</span>
    <span class="st-ed-grow"></span>
    <button class="st-ed-iconbtn" id="sted-up" title="Select parent">↑</button>
    <button class="st-ed-iconbtn" id="sted-clear" title="Reset all edits on this element">reset</button>`;
  selBar.querySelector('#sted-back').onclick = () => setTab('tree');
  selBar.querySelector('#sted-up').onclick = () => { if (selected.parentElement && selected.parentElement !== document.body) select(selected.parentElement, { scroll: true, openSettings: true }); };
  selBar.querySelector('#sted-clear').onclick = () => resetElement();

  for (const g of GROUPS) inspEl.appendChild(buildGroup(g, rec));
  updateCount();
}
function buildGroup(g, rec) {
  const wrap = make('div', { class: 'st-ed-group' + (g.open ? ' is-open' : '') });
  const hd = make('div', { class: 'st-ed-grouphd' }, `<span class="caret">▶</span>${g.name}`);
  hd.onclick = () => wrap.classList.toggle('is-open');
  const body = make('div', { class: 'st-ed-groupbody' });
  for (const c of g.controls) body.appendChild(buildControl(c, rec));
  wrap.append(hd, body);
  return wrap;
}
function buildControl(c, rec) {
  const wrap = make('div', { class: 'st-ed-ctl' + (c.kind === 'note' ? ' note' : '') });
  const cur = c.get(rec);

  if (c.kind === 'note') {
    wrap.innerHTML = `<label>${c.label}</label><textarea placeholder="e.g. this title is too low, raise it ~30px and centre it"></textarea>`;
    const ta = wrap.querySelector('textarea');
    ta.value = cur || '';
    ta.oninput = () => { c.set(rec, ta.value); updateCount(); };
    return wrap;
  }
  if (c.kind === 'select') {
    wrap.innerHTML = `<label>${c.label}</label><div class="ctl-row"><select></select><button class="ctl-reset" title="reset">⟲</button></div>`;
    const sel = wrap.querySelector('select');
    sel.innerHTML = c.opts.map((o) => `<option value="${o}">${o || '(default)'}</option>`).join('');
    sel.value = cur || '';
    sel.onchange = () => { c.set(rec, sel.value); reapply(); updateCount(); };
    wrap.querySelector('.ctl-reset').onclick = () => { c.set(rec, ''); reapply(); renderInspector(); };
    return wrap;
  }
  if (c.kind === 'color') {
    const v = cur || '';
    wrap.innerHTML = `<label>${c.label}<span class="val"></span></label>
      <div class="ctl-row">
        <input type="color" value="${toHex(v) || '#888888'}">
        <input type="text" placeholder="none" value="${v}">
        <button class="ctl-reset" title="reset">⟲</button>
      </div>`;
    const [picker, text] = wrap.querySelectorAll('input');
    picker.oninput = () => { text.value = picker.value; c.set(rec, picker.value); reapply(); updateCount(); };
    text.oninput = () => { c.set(rec, text.value); if (toHex(text.value)) picker.value = toHex(text.value); reapply(); updateCount(); };
    wrap.querySelector('.ctl-reset').onclick = () => { c.set(rec, ''); reapply(); renderInspector(); };
    return wrap;
  }
  // numeric: slider + unclamped manual box (type ANY value, drag is convenience)
  const unit = c.unit || '';
  wrap.innerHTML = `<label>${c.label}<span class="unit">${unit}</span></label>
    <div class="ctl-row">
      <input type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${num(cur, 0)}">
      <input type="number" step="${c.step}" value="${cur === '' || cur == null ? '' : cur}">
      <button class="ctl-reset" title="reset">⟲</button>
    </div>`;
  const [range, box] = wrap.querySelectorAll('input');
  const commit = (raw) => {
    const v = raw === '' ? '' : Number(raw);
    c.set(rec, v);
    reapply();
    updateCount();
  };
  range.oninput = () => { box.value = range.value; commit(range.value); };
  box.oninput = () => { if (box.value !== '') range.value = box.value; commit(box.value); };
  wrap.querySelector('.ctl-reset').onclick = () => { c.set(rec, ''); reapply(); renderInspector(); };
  return wrap;
}
function num(v, d) { return v === '' || v == null || isNaN(v) ? d : v; }
function toHex(v) {
  if (!v) return '';
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  if (/^#[0-9a-f]{3}$/i.test(v)) return '#' + v.slice(1).split('').map((c) => c + c).join('');
  return '';
}

function reapply() {
  if (!selected) return;
  const rec = editFor(selected);
  applyRecord(selected, rec);
  drawSelBox();
}
function resetElement() {
  if (!selected) return;
  const key = cssPath(selected);
  const rec = edits.get(key);
  if (rec) {
    selected.style.transform = '';
    for (const prop of Object.keys(rec.styles)) selected.style.removeProperty(prop);
    edits.delete(key);
  }
  renderInspector();
  updateCount();
}

/* ---- on-page highlight + selection boxes -------------------------------- */
function rectOf(el) { return el.getBoundingClientRect(); }
function showHighlight(el) {
  if (!el || SELF(el)) return hideHighlight();
  const r = rectOf(el);
  Object.assign(hlBox.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  hlBox.querySelector('.st-ed-tip').textContent = label(el);
  hlBox.classList.add('show');
}
function hideHighlight() { hlBox.classList.remove('show'); }
function setPick(on) {
  picking = on;
  const btn = panel.querySelector('#sted-pick');
  if (btn) btn.classList.toggle('is-on', on);
  document.body.classList.toggle('st-ed-pick', on);
  if (!on) hideHighlight();
}
function drawBoxViz_unused(el, r) {
  const cs = getComputedStyle(el);
  const p = ['Top', 'Right', 'Bottom', 'Left'].map((s) => parseFloat(cs['padding' + s]) || 0);
  const m = ['Top', 'Right', 'Bottom', 'Left'].map((s) => parseFloat(cs['margin' + s]) || 0);
  Object.assign(boxViz.style, { left: r.left - m[3] + 'px', top: r.top - m[0] + 'px', width: r.width + m[1] + m[3] + 'px', height: r.height + m[0] + m[2] + 'px' });
  const mar = boxViz.querySelector('.mar'), pad = boxViz.querySelector('.pad');
  Object.assign(mar.style, { inset: 0 });
  Object.assign(pad.style, { left: m[3] + 'px', top: m[0] + 'px', width: r.width + 'px', height: r.height + 'px', boxSizing: 'border-box', borderWidth: `${p[0]}px ${p[1]}px ${p[2]}px ${p[3]}px`, borderStyle: 'solid', borderColor: 'rgba(123,216,143,.22)' });
  boxViz.classList.add('show');
}
function drawSelBox() {
  if (!selected) return selBoxEl.classList.remove('show');
  const r = rectOf(selected);
  Object.assign(selBoxEl.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  selBoxEl.classList.add('show');
}
window.addEventListener('scroll', () => { if (selected) drawSelBox(); }, true);
window.addEventListener('resize', () => { if (selected) drawSelBox(); });

/* ---- drag to move + drag edges to resize (so you can see behind it) ------ */
function makePanelMovable() {
  const head = panel.querySelector('.st-ed-head');
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
  const goFloat = () => {
    if (panel.classList.contains('is-floating')) return;
    const r = panel.getBoundingClientRect();
    panel.classList.add('is-floating');
    Object.assign(panel.style, { left: r.left + 'px', top: r.top + 'px', right: 'auto', width: r.width + 'px', height: r.height + 'px' });
  };
  const drag = (startEv, onMove) => {
    startEv.preventDefault();
    const move = (e) => onMove(e);
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.body.style.userSelect = ''; };
    document.body.style.userSelect = 'none';
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };
  // move via header
  head.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, input')) return;
    goFloat();
    const r = panel.getBoundingClientRect();
    const ox = e.clientX - r.left, oy = e.clientY - r.top;
    drag(e, (ev) => {
      panel.style.left = clamp(ev.clientX - ox, -r.width + 80, window.innerWidth - 80) + 'px';
      panel.style.top = clamp(ev.clientY - oy, 0, window.innerHeight - 44) + 'px';
    });
  });
  // width — drag left edge (anchored to the panel's right edge)
  panel.querySelector('.st-ed-rz-l').addEventListener('pointerdown', (e) => {
    const right = panel.getBoundingClientRect().right;
    const floating = panel.classList.contains('is-floating');
    drag(e, (ev) => {
      const w = clamp(right - ev.clientX, 280, window.innerWidth - 20);
      panel.style.width = w + 'px';
      if (floating) panel.style.left = (right - w) + 'px';
    });
  });
  // height — drag bottom edge (floats the panel so it isn't full-height)
  panel.querySelector('.st-ed-rz-b').addEventListener('pointerdown', (e) => {
    goFloat();
    const top = panel.getBoundingClientRect().top;
    drag(e, (ev) => { panel.style.height = clamp(ev.clientY - top, 240, window.innerHeight - top) + 'px'; });
  });
}

/* ---- page-side picking -------------------------------------------------- */
function pickActive() { return picking && panel && panel.classList.contains('is-open'); }
document.addEventListener('mousemove', (e) => {
  if (!pickActive()) return;
  if (SELF(e.target)) return hideHighlight();
  const el = pickAt(e.clientX, e.clientY);
  if (el) showHighlight(el); else hideHighlight();
}, true);
document.addEventListener('click', (e) => {
  if (!pickActive() || SELF(e.target)) return;
  e.preventDefault(); e.stopPropagation();
  const el = pickAt(e.clientX, e.clientY);
  if (el) select(el, { openSettings: true });   // stay in pick mode; open its settings
}, true);

/* ---- footer: count + export -------------------------------------------- */
function v3dHasEdit(rec) { return rec && (Object.keys(rec.changed).length || rec.note.trim() || rec.deleted); }
function updateCount() {
  let n = 0;
  for (const rec of edits.values()) if (hasAnyEdit(rec)) n++;
  for (const rec of v3dEdits.values()) if (v3dHasEdit(rec)) n++;
  countEl.textContent = `${n} edit${n === 1 ? '' : 's'}`;
}
function buildChangeset() {
  const list = [];
  for (const rec of edits.values()) {
    if (!hasAnyEdit(rec)) continue;
    const styles = { ...rec.styles };
    const t = rec.transform, tp = [];
    if (t.tx != null || t.ty != null) tp.push(`translate(${t.tx || 0}px, ${t.ty || 0}px)`);
    if (t.scale != null) tp.push(`scale(${t.scale})`);
    if (t.rot != null) tp.push(`rotate(${t.rot}deg)`);
    if (tp.length) styles.transform = tp.join(' ');
    list.push({ ...rec.meta, styles, note: rec.note.trim() || undefined });
  }
  for (const rec of v3dEdits.values()) {
    if (!v3dHasEdit(rec)) continue;
    list.push({ kind: '3d', target: rec.id, name: rec.name, transform: { ...rec.changed }, deleted: rec.deleted || undefined, note: rec.note.trim() || undefined });
  }
  return { savedAt: new Date().toISOString(), page: location.pathname, edits: list };
}
function toClaudeText(cs) {
  if (!cs.edits.length) return 'No edits.';
  return cs.edits.map((e, i) => {
    if (e.kind === '3d') {
      const lines = [`#${i + 1}  [3D] ${e.name}  (${e.target})`];
      if (e.deleted) lines.push(`    🗑 DELETE this gear`);
      for (const [k, v] of Object.entries(e.transform || {})) lines.push(`    ${k}: ${v}`);
      if (e.note) lines.push(`    📌 NOTE: ${e.note}`);
      return lines.join('\n');
    }
    const lines = [`#${i + 1}  ${e.selector}`];
    if (e.classes) lines.push(`    classes: ${e.classes}`);
    for (const [k, v] of Object.entries(e.styles || {})) lines.push(`    ${k}: ${v};`);
    if (e.note) lines.push(`    📌 NOTE: ${e.note}`);
    return lines.join('\n');
  }).join('\n\n');
}
async function copyForClaude() {
  const txt = toClaudeText(buildChangeset());
  try { await navigator.clipboard.writeText(txt); toast('Copied changeset for Claude'); }
  catch { console.log('[st-ed] changeset:\n' + txt); toast('Copy blocked — logged to console'); }
}
async function save() {
  const cs = buildChangeset();
  try {
    const res = await fetch(SAVE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cs, null, 2) });
    if (!res.ok) throw new Error(res.status);
    toast(`Saved ${cs.edits.length} edit(s) → editor/edits.json`);
  } catch (err) {
    console.warn('[st-ed] save endpoint unavailable, falling back to clipboard:', err);
    copyForClaude();
  }
}
let toastEl;
function toast(msg) {
  if (!toastEl) { toastEl = make('div', { id: 'st-ed-toast', class: 'st-ed-toast' }); document.body.appendChild(toastEl); }
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => toastEl.classList.remove('show'), 1800);
}

/* ---- launcher + boot ---------------------------------------------------- */
function toggle(on) {
  const open = on == null ? !panel.classList.contains('is-open') : on;
  panel.classList.toggle('is-open', open);
  document.body.classList.toggle('st-ed-open', open);
  launchBtn.classList.toggle('is-on', open);
  if (!open) { setPick(false); selBoxEl.classList.remove('show'); }
  else { buildTree(); setTab('tree'); }   // rebuild fresh each open (DOM may have changed), start on Components
}
let launchBtn;
function boot() {
  launchBtn = make('button', { id: 'st-ed-launch', title: 'Open the live edit interface (dev only)' }, '✎ Edit');
  document.body.appendChild(launchBtn);
  buildPanel();
  launchBtn.onclick = () => toggle();
  // Test/debug hook (dev only) — lets the headless harness probe internals.
  window.__sted = {
    open: () => toggle(true),
    pick: (on) => setPick(on !== false),
    get picking() { return picking; },
    get isOpen() { return panel.classList.contains('is-open'); },
    pickInfo: (x, y) => { const el = pickAt(x, y); return el ? `${typeOf(el)}:${nameOf(el)} <${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}>` : null; },
    hlShown: () => hlBox.classList.contains('show'),
    selInfo: () => (selected ? `${typeOf(selected)}:${nameOf(selected)}` : null),
  };
  console.info('[st-ed] live Edit Interface ready — click ✎ Edit (dev only).');
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
