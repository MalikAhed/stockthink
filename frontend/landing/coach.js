// Beat 3 — "The coach" · AUTOPLAY 3D CINEMATIC (own module). Plan: coach-plan.md.
// One Three.js scene. The Claude logo acts out the overnight self-improvement loop:
//   recede → book appears, Claude pulses + spawns a clone (subagent) → clone scans the
//   book, evolves, returns → board appears, Claude learns the puzzle + pulses → Claude
//   writes new concepts into a code file. Smooth camera throughout (GSAP timeline).
//
// THIS PASS: book + board are PLACEHOLDER boxes so we lock the camera/Claude choreography
// first; swap in the real GLBs (models/chess-board.glb + the 3D book) once the motion is OK.
//
// Colour story (locked): clay/brass = Claude studying (never recolored); green #6fc24a =
// StockThink getting smarter (scan, evolve glow, learned-pulse, added code). Rejects grey.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import gsap from 'gsap';
import { Scrubber, gsapTransport } from './scrub.js';
import { fpsGate, QUALITY, registerRenderer } from './perf.js';

const section = document.querySelector('section.coach');
const canvas = document.getElementById('coachScene');
const guide = document.getElementById('coachGuide');
const replayBtn = document.getElementById('coachReplay');
// the 2D HUD layer — caption, name + thought-bubble mount here (full-bleed, same coord space as the canvas)
const overlay = document.getElementById('coachOverlay') || document.querySelector('.coach-sticky');
if (!section || !canvas) {
  // eslint-disable-next-line no-throw-literal
  throw 'coach section markup missing';
}

const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- tunables (edit numbers, not logic) ----------------------------------------
const CLAY = { sat: 0.40, tint: '#cc6b3f', bright: 1.60, roughAdd: 0.40, base: 1.60 };
const FACE_Y = -1.680;        // baked: model's front turned to camera (applied to the model)
const BOB = 0.035;            // idle breathing amplitude
const GREEN = 0x6fc24a;
// FRONT FACE: at logoGroup.rotation.y = 0 the logo's face points toward +Z (the camera). So to face a
// target we set yaw = atan2(dx, dz) toward it. Flip FACE_YAW to PI if the face ever points the wrong way.
const FACE_YAW = 0;
// SCENE_DOWN drops the book-scene lower in frame (pans the camera up); ONLY shots flagged `down:true` use it,
// so the ENTRANCE stays centred on Claude. Verified per-shot with editor/coach-frame.mjs (screen-% projection).
const SCENE_DOWN = 0.32;
// camera keyframes: {pos, tgt, down}. Frame-checked composition (x:0=left..100=right, y:0=top..100=bottom):
//   settle  entrance — Claude 50/50            react  Claude stays ~44/50 while it turns
//   wide    Claude ~26% · book ~71% (balanced) focus  book centred ~53%, Claude/agents 35–72%
const CAM = {
  settle: { pos: [0, 0, 3.4],     tgt: [0, 0, 0],         down: false }, // entrance: dead-centre on Claude
  react:  { pos: [0.1, 0, 3.6],   tgt: [0.22, 0, 0],      down: false }, // Claude alone — keep it centred
  wide:   { pos: [0.4, 0.25, 5.7], tgt: [0.5, 0, -0.2],   down: true },  // BOTH: Claude (left) + book (right)
  focus:  { pos: [1.1, 0.2, 4.6], tgt: [1.7, 0, -0.35],   down: true },  // centre on Claude + book
  glance: { pos: [-0.5, 0.1, 5.2], tgt: [-0.9, 0, -0.2],  down: false }, // Claude turns left toward the glow
  board:  { pos: [-1.7, 0.9, 4.8], tgt: [-2.4, -0.4, 0],  down: false }, // finds the board (left), tilted to see its face
  code:   { pos: [0.05, 0.12, 3.55], tgt: [-0.2, 0, 0.2], down: false }, // FINALE: pulled in close on Claude, code panel takes the right
};
// scene anchor positions
const POS = {
  home: [0, 0, 0],                // entrance: Claude dead-centre
  recoil: [-0.85, 0.32, 0.5],     // backs up here — y raised so Claude is on the SAME EYELINE as the book (Δ~0)
  book:   [1.92, 0.23, -0.55],    // where the book arrives (your tuned value); it stays here the whole scene
  board:  [-2.45, -0.85, 0],      // the board arrives on the LEFT, low in frame
  code:   [-0.35, 0.05, 0.9],     // FINALE: Claude returns here, pulled forward CLOSE to the terminal
};
// FINALE: Claude turns slightly RIGHT (+yaw) to face the terminal/code panel sitting on the right
const CODE_YAW = 0.5;
// Claude's "look right" reaction — a real TURN about Y; kept small (not exaggerated)
const REACT = { lookYaw: 0.7, dip: 0.1, hold: 0.3 };
// Claude's inspect angles, OFFSETS from the book centre. GEOMETRY-VERIFIED (editor/coach-check.mjs): each
// keeps the logo AROUND the book, never inside it (gap +0.14..+0.37), and never bigger than the book.
//   1 front-left close · 2 right, lower + BEHIND (reads smaller) · 3 left, TOP angle + a little high
const INSPECT_OFF = [
  [-0.5, 0.05, 1.25],
  [1.15, -0.2, -0.55],
  [-1.05, 0.85, 0.85],
];
// each subagent's inspect angles (offsets from book). Each agent owns a REGION + a primary motion axis so
// they move INDEPENDENTLY (not in unison). All geometry-verified clear of the book (gap +0.13..+0.34):
//   A = left side, travels vertically · B = front-top, travels across · C = lower-right, travels around
const CLONE_OFF = [
  [[-0.95, -0.55, 0.4], [-1.05, 0.1, 0.5], [-0.85, 0.8, 0.45]],
  [[-0.4, 0.6, 1.0], [0.25, 0.9, 0.8], [0.7, 0.5, 1.0]],
  [[1.05, 0.1, 0.5], [0.3, -0.85, 0.9], [0.9, -0.4, 0.65]],
];
// the 3 clones first emerge top / left / right around Claude, then travel to the book
const EMERGE = [[0, 0.55, 0], [-0.55, 0, 0], [0.55, 0, 0]];
// per-agent loop timing — DIFFERENT for each so they desync (lively, never in lockstep)
const CLONE_TIMING = [{ dur: 0.85, hold: 1.1 }, { dur: 0.7, hold: 0.85 }, { dur: 0.95, hold: 1.3 }];
const SHIFT = { dur: 0.6, hold: 0.4 };        // Claude inspection: SMOOTH shift (sine), then a shorter pause at each angle (tightened)
// size arc: entrance 0.70 → backs up + scans at 0.50 (reads ~0.84× the book) → after the scan grows to
// 0.60 (~book size, a little bigger). Verified in editor/coach-check.mjs.
const CLAUDE = { rest: 0.70, book: 0.50, after: 0.60 };
const CLONE = { scale: 0.21, count: 3 };      // the smaller subagents that inspect the book (your tuned value)
const BOOK = { fit: 1.30, show: 1.00, rx: 1.17, ry: -1.67, rz: 0.49 }; // size + orientation (your tuned values)
const BOARD = { fit: 2.20, show: 1.00, rx: 0, ry: 0, rz: 0 };          // chess board — lies flat (tune live)
// ACT 7 — board scene (LEFT). Claude notices a glow on the left, turns to it, the camera finds the board
// (already sitting there), then Claude orbits SEVERAL spots all ABOVE the board, always looking down at it.
const GLANCE = { yaw: -0.7, dur: 0.8, hold: 0.4 };   // Claude's small turn-left toward the glow (tightened)
// inspect spots — all offsets from the board centre, all elevated (y>0). boardFace (frame()) keeps Claude
// turned toward the board's centre and tilted down at it as it moves between these.
const ABOVE_OFF = [
  [0, 1.05, 0.6],       // above-front
  [-0.8, 1.05, 0.15],   // above-left
  [0.8, 1.05, 0.15],    // above-right
  [0, 1.1, -0.5],       // above-behind
];
const ABOVE = { dur: 1.3 };    // first flight up to the board
const BOOK_LOOK_DOWN = 0.26;   // ACT 4: Claude hovers above the book, so it tilts slightly down to read it
// ACT 0 entrance — empty stage (just the corner titles), then the logo resolves into view
const ENTER = {
  hold: 0.3,           // empty-stage beat: titles alone, the "what is this?" moment (tightened)
  dur: 1.7,            // a composed arrival (tightened)
  settle: 0.5,         // brief beat after it lands, before the cinematic proper begins
  z0: -1.7,            // eases gently forward from just behind (no fly-in)
  s0: 0.88,            // barely scales up — no pop
  rise: 0.16,          // floats up a touch as it resolves
  turn: 0.20,          // a whisper of rotation that levels out (no pinwheel)
  nameAt: 0.66,        // 0..1 through the entrance when "Claude" fades in beneath it
};

// ---- renderer / scene ----------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: QUALITY.antialias, alpha: true });
registerRenderer(renderer);   // perf manager owns the pixel ratio (and can lower it live)
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.4;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
camera.position.set(...CAM.settle.pos);
const lookTarget = new THREE.Vector3(...CAM.settle.tgt);

const key = new THREE.DirectionalLight(0xffffff, 2.3); key.position.set(-2.2, 2.6, 3.0); scene.add(key);
const fill = new THREE.DirectionalLight(0x9fb6d6, 2.1); fill.position.set(3.0, 0.8, 1.5); scene.add(fill);
const rim = new THREE.DirectionalLight(0xffb066, 0.6); rim.position.set(3.4, 1.2, -2.6); scene.add(rim);
const topL = new THREE.DirectionalLight(0xcfe0ff, 1.4); topL.position.set(0, 4, 0.2); scene.add(topL);
scene.add(new THREE.AmbientLight(0x202830, 0.4));
import('three/addons/environments/RoomEnvironment.js').then(({ RoomEnvironment }) => {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
}).catch(() => {});

// a roaming green light for scan/evolve/learn flashes
const flash = new THREE.PointLight(GREEN, 0, 6, 2); scene.add(flash);

// ---- the Claude logo -----------------------------------------------------------
// hierarchy: logoGroup (cinematic position + turn) > bobNode (idle bob) > model (faces camera)
const logoGroup = new THREE.Group(); logoGroup.visible = false; scene.add(logoGroup); // hidden until the entrance
logoGroup.rotation.order = 'YXZ'; // yaw first, then pitch — so "turn toward, then look down" composes correctly
const bobNode = new THREE.Group(); logoGroup.add(bobNode);
const logoMats = [];          // the logo's materials — faded in during the entrance
const cloneGroups = [];       // the 3 subagents (clay, like Claude) — filled once the logo loads

function clayMaterial(src, greenTint) {
  const p = new THREE.MeshPhysicalMaterial({
    map: src.map || null, normalMap: src.normalMap || null,
    roughnessMap: src.roughnessMap || null, metalnessMap: src.metalnessMap || null,
    aoMap: src.aoMap || null,
    color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
    metalness: 0.0, roughness: src.roughness !== undefined ? src.roughness : 0.5,
    envMapIntensity: 0.0, clearcoat: 0.0, clearcoatRoughness: 0.35,
    emissive: new THREE.Color(greenTint ? GREEN : 0x000000), emissiveIntensity: greenTint ? 0.18 : 0,
  });
  if (p.map) p.map.colorSpace = THREE.SRGBColorSpace;
  p.roughness = THREE.MathUtils.clamp(p.roughness + CLAY.roughAdd, 0.02, 1);
  p.color.multiplyScalar(CLAY.base);
  const uSat = { value: CLAY.sat }, uTint = { value: new THREE.Color(CLAY.tint) }, uBright = { value: CLAY.bright };
  p.onBeforeCompile = (sh) => {
    sh.uniforms.uSat = uSat; sh.uniforms.uTint = uTint; sh.uniforms.uBright = uBright;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>',
        '#include <common>\nuniform float uSat;\nuniform vec3 uTint;\nuniform float uBright;')
      .replace('#include <map_fragment>',
        `#include <map_fragment>
         {
           float g = dot(diffuseColor.rgb, vec3(0.299,0.587,0.114));
           vec3 desat = mix(vec3(g), diffuseColor.rgb, uSat);
           diffuseColor.rgb = desat * uTint * uBright;
         }`);
  };
  p.needsUpdate = true;
  return p;
}

let ready = false;
let bookModel = null;          // the inner book GLB node (so the Tune panel can resize/rotate it)
let cloneLoops = [];           // ONE repeating loop per subagent (so they desync — lively); DRIVEN by tl.time()
let cloneStart = 0;            // tl time at which the subagent inspection begins (so the loops seek/pause WITH the scrubber)
let claudeFace = false;        // when true, frame() turns Claude (rot Y) to keep its face on the book (+ a slight look-down)
let clonesFace = false;        // when true, frame() turns each subagent to keep its face on the book
let boardFace = false;         // when true, frame() keeps Claude turned toward the board AND tilted down at it
const loader = new GLTFLoader();

// turn-to-face helpers: yaw so the +Z front face points from `from` toward `to`; shortest-path lerp
function faceYaw(from, to) { return Math.atan2(to.x - from.x, to.z - from.z) + FACE_YAW; }
function lerpAngle(cur, target, k) {
  let d = (target - cur) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
  return cur + d * k;
}
loader.setMeshoptDecoder(MeshoptDecoder);
loader.load(new URL('./models/claude-logo.glb', import.meta.url).href, (gltf) => {
  const model = gltf.scene;
  model.traverse((o) => { if (o.isMesh) { o.material = clayMaterial(o.material, false); o.material.transparent = true; logoMats.push(o.material); } });
  let box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  model.scale.setScalar(1.7 / Math.max(size.x, size.y, size.z));
  box = new THREE.Box3().setFromObject(model);
  model.position.sub(box.getCenter(new THREE.Vector3()));
  model.rotation.y = FACE_Y;                 // baked facing lives on the model
  bobNode.add(model);

  // subagents: 3 clones in the SAME clay material as Claude (workers, not a different colour)
  for (let i = 0; i < CLONE.count; i++) {
    const clone = model.clone(true);
    clone.traverse((o) => { if (o.isMesh) o.material = clayMaterial(o.material, false); });
    const g = new THREE.Group(); g.add(clone);
    g.scale.setScalar(0.001); g.visible = false;
    scene.add(g); cloneGroups.push(g);
  }

  ready = true;
  buildTimeline();
  maybeAutoplay();
  // dev-only universal scrubber — drives the GSAP timeline (frame() already reads tl.time()).
  if (import.meta.env.DEV) new Scrubber(gsapTransport(tl, { name: 'coach', onClaim: () => { played = true; } }), section, { loop: true });
}, undefined, (err) => console.warn('[coach] logo GLB failed', err));

// ---- the book (real GLB) --------------------------------------------------------
// group scale is what the timeline animates (0 -> BOOK.show); the model inside is fit + oriented once.
const book = new THREE.Group();
book.position.set(...POS.book);
book.scale.setScalar(0.001); book.visible = false;
scene.add(book);
loader.load(new URL('./models/book.glb', import.meta.url).href, (gltf) => {
  const m = gltf.scene;
  let b = new THREE.Box3().setFromObject(m);
  const sz = b.getSize(new THREE.Vector3());
  m.scale.setScalar(BOOK.fit / Math.max(sz.x, sz.y, sz.z));
  b = new THREE.Box3().setFromObject(m);
  m.position.sub(b.getCenter(new THREE.Vector3()));
  m.rotation.set(BOOK.rx, BOOK.ry, BOOK.rz);
  book.add(m); bookModel = m;
}, undefined, (err) => console.warn('[coach] book GLB failed', err));

// ---- the chess board (real GLB) -------------------------------------------------
// group scale is what the timeline animates (0 -> BOARD.show); the model inside is fit + oriented once.
const board = new THREE.Group();
let boardModel = null;
board.position.set(...POS.board);
board.scale.setScalar(0.001); board.visible = false;
scene.add(board);
// LAZY: the board+pieces module is ~6.8MB of base64 — never load it on initial page load. Dynamic-import
// and build only when the coach section is near (kicked off from the IntersectionObserver below). One-shot.
let boardReq = null;
function ensureBoard() {
  if (boardReq) return boardReq;
  boardReq = import('./coach-board.js')
    .then(({ buildBoard }) => buildBoard())
    .then((grp) => {
      // the built group already carries the HTML's orientation + full piece set; fit it into the scene
      let b = new THREE.Box3().setFromObject(grp);
      const sz = b.getSize(new THREE.Vector3());
      grp.scale.setScalar(BOARD.fit / Math.max(sz.x, sz.y, sz.z));
      b = new THREE.Box3().setFromObject(grp);
      grp.position.sub(b.getCenter(new THREE.Vector3()));   // centre it so POS.board places its middle
      grp.rotation.set(BOARD.rx, BOARD.ry, BOARD.rz);        // fine-tune nudges only (default 0)
      board.add(grp); boardModel = grp;
    })
    .catch((err) => console.warn('[coach] board build failed', err));
  return boardReq;
}

// ---- helpers -------------------------------------------------------------------
function camTo(tl, s, dur, at, ease = 'power2.inOut') {
  const dy = s.down ? SCENE_DOWN : 0; // only the book-scene shots drop; the entrance stays centred
  tl.to(camera.position, { x: s.pos[0], y: s.pos[1] + dy, z: s.pos[2], duration: dur, ease }, at);
  tl.to(lookTarget, { x: s.tgt[0], y: s.tgt[1] + dy, z: s.tgt[2], duration: dur, ease }, '<');
}
function pulse(tl, node, at, k = 1.14) {
  const s = node.scale.x;
  tl.to(node.scale, { x: s * k, y: s * k, z: s * k, duration: 0.22, ease: 'power2.out' }, at)
    .to(node.scale, { x: s, y: s, z: s, duration: 0.34, ease: 'power2.in' });
}
function flashAt(tl, targetObj, at, intensity = 2.2) {
  tl.add(() => flash.position.copy(targetObj.position), at)
    .fromTo(flash, { intensity: 0 }, { intensity, duration: 0.25, ease: 'power2.out' }, at)
    .to(flash, { intensity: 0, duration: 0.6, ease: 'power2.in' });
}

// green scan sweep across an object (book/board)
const scanMat = new THREE.MeshBasicMaterial({ color: GREEN, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
const scanBar = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.04), scanMat); scanBar.visible = false; scene.add(scanBar);
function scanSweep(tl, targetObj, at, dur = 1.0) {
  tl.add(() => { scanBar.visible = true; scanBar.position.copy(targetObj.position); scanBar.position.z += 0.2; }, at)
    .fromTo(scanBar.position, { y: targetObj.position.y - 0.45 }, { y: targetObj.position.y + 0.45, duration: dur, ease: 'none' }, at)
    .fromTo(scanMat, { opacity: 0 }, { opacity: 0.55, duration: 0.2 }, at)
    .to(scanMat, { opacity: 0, duration: 0.25 }, `>-0.25`)
    .add(() => { scanBar.visible = false; });
}

// ---- code-file panel (Act 5, 2D overlay) ---------------------------------------
const codePanel = document.createElement('div');
codePanel.className = 'coach-code';
// the lines Claude "types" — spans start EMPTY and fill in char-by-char (touch-type) when showCode runs
const CODE_TXT = [
  { t: 'export const concepts = [' },
  { t: '  "fork", "pin", "skewer",' },
  { t: '  "discovered attack",' },
  { t: '  "rook behind a passed pawn",', add: true },
  { t: '];' },
];
codePanel.innerHTML = `
  <div class="cc-bar"><i></i><i></i><i></i><span class="cc-file">concepts.ts</span><span class="cc-save">✓ Saved</span></div>
  <div class="cc-body">${CODE_TXT.map((l) => `<span class="cc-line${l.add ? ' cc-add' : ''}"></span>`).join('\n')}</div>`;
overlay.appendChild(codePanel);
const codeLines = codePanel.querySelectorAll('.cc-line');
const TYPE_CPS = 42;   // typing speed (chars/sec) for the code finale

// ---- "Claude" name tag (appears beneath the logo as it arrives) ----------------
const nameTag = document.createElement('div');
nameTag.className = 'coach-name';
nameTag.textContent = 'Claude';
overlay.appendChild(nameTag);

// ---- explainer caption (one clear line per phase, fades as it changes) ----------
const cap = document.createElement('div');
cap.className = 'coach-cap';
overlay.appendChild(cap);
function showCap(at, text) {
  tl.add(() => { cap.textContent = text; cap.classList.add('show'); }, at);
}
function hideCap(at) { tl.add(() => cap.classList.remove('show'), at); }

// ---- thought bubble (floats above Claude; '?' curiosity, then a chess piece once it "gets it") -----
const bubble = document.createElement('div');
bubble.className = 'coach-bubble';
bubble.innerHTML = '<span class="cb-in"></span>';
overlay.appendChild(bubble);
const bubbleIn = bubble.querySelector('.cb-in');
let bubbleOn = false;
function showBubble(at, html) { tl.add(() => { bubbleIn.innerHTML = html; bubble.classList.add('show'); bubbleOn = true; }, at); }
function hideBubble(at) { tl.add(() => { bubble.classList.remove('show'); bubbleOn = false; }, at); }
const _pv = new THREE.Vector3();
const LOGO_H = 1.65;            // logo world height at logoGroup scale 1 (raw maxdim 1 * 1.7 fit)
function positionBubble() {
  // sit the bubble's bottom just above Claude's HEAD (scale-aware), so it hugs the logo at any size
  _pv.copy(logoGroup.position); _pv.y += (LOGO_H / 2) * logoGroup.scale.x + 0.14;
  _pv.project(camera);
  bubble.style.left = `${(_pv.x * 0.5 + 0.5) * section.clientWidth}px`;
  bubble.style.top = `${(-_pv.y * 0.5 + 0.5) * innerHeight}px`;
}
function showCode(tl, at) {
  // panel slides in, then each line touch-types in sequence. Driven entirely off the timeline so the
  // scrub bar pauses/seeks the typing too. A block caret rides the end of the line being typed.
  tl.add(() => { codePanel.classList.add('show'); codeLines.forEach((ln) => { ln.textContent = ''; ln.classList.add('on'); }); }, at);
  tl.to({}, { duration: 0.4 }, '>'); // wait for the panel slide-in before typing
  codeLines.forEach((ln, i) => {
    const full = CODE_TXT[i].t;
    const st = { n: 0 };
    tl.to(st, {
      n: full.length, duration: Math.max(0.25, full.length / TYPE_CPS), ease: 'none',
      onUpdate() { const n = Math.round(st.n); ln.textContent = full.slice(0, n) + (n < full.length ? '▌' : ''); },
    }, i === 0 ? '>' : '>+0.12');
  });
}
function hideCode(tl, at) { tl.add(() => { codePanel.classList.remove('show'); codeLines.forEach((l) => { l.classList.remove('on'); l.textContent = ''; }); }, at); }

// Each subagent gets its OWN repeating shift+pause loop (its own region, axis, and timing) so the three
// move INDEPENDENTLY — some up while others go right/down — never in lockstep. Positions only; frame()
// keeps each one's face on the book and adds a gentle sway. Geometry-checked clear of the book.
function killCloneLoops() { cloneLoops.forEach((l) => l.kill()); cloneLoops = []; }
const cloneSpot = (i, k) => { const b = book.position, o = CLONE_OFF[i][k % CLONE_OFF[i].length]; return [b.x + o[0], b.y + o[1], b.z + o[2]]; };
// builds each agent's independent loop. Assumes the agent is already sitting at its spot 0 (ACT 6 flies it
// there first). The loop MOVES FIRST (so inspecting is visible the instant it starts), then holds to study:
// shift → study → shift → study → … → back to spot 0, forever.
function startCloneInspect() {
  killCloneLoops();
  clonesFace = true;
  if (RM()) { cloneGroups.forEach((g, i) => g.position.set(...cloneSpot(i, 0))); return; }
  cloneGroups.forEach((g, i) => {
    const tm = CLONE_TIMING[i], n = CLONE_OFF[i].length;
    const lp = gsap.timeline({ repeat: -1, paused: true }); // paused — frame() scrubs it from tl.time(), so it pauses/seeks WITH the bar
    for (let k = 1; k <= n; k++) {
      const s = cloneSpot(i, k % n);
      lp.to(g.position, { x: s[0], y: s[1], z: s[2], duration: tm.dur, ease: 'sine.inOut' }) // shift to the next angle (moves right away)
        .to({}, { duration: tm.hold });                                                      // then study it a beat
    }
    cloneLoops.push(lp);
  });
}

// ---- the timeline --------------------------------------------------------------
let tl = null;
function buildTimeline() {
  // First play runs the entrance (ACT 0); when it finishes while the viewer is STILL watching we loop
  // WITHOUT the intro (see loopWithoutIntro). The full intro only returns on a fresh entry (run() restarts
  // from 0), i.e. when they scroll away and come back.
  tl = gsap.timeline({ paused: true, onComplete: loopWithoutIntro });

  // reset state at t=0 — empty stage: logo hidden far back, titles alone
  tl.add(() => {
    killCloneLoops(); claudeFace = false; clonesFace = false; boardFace = false;
    logoGroup.visible = false;
    logoGroup.position.set(0, 0, ENTER.z0); logoGroup.rotation.set(ENTER.tilt, ENTER.spin, 0); logoGroup.scale.setScalar(CLAUDE.rest * 0.9);
    cloneGroups.forEach((g) => { g.visible = false; g.position.set(...POS.home); g.rotation.set(0, 0, 0); g.scale.setScalar(0.001); });
    book.visible = false; book.position.set(...POS.book); book.scale.setScalar(0.001);
    if (board) { board.visible = false; board.scale.setScalar(0.001); }
    codePanel.classList.remove('show'); codePanel.classList.remove('saved'); codeLines.forEach((l) => { l.classList.remove('on'); l.textContent = ''; });
    camera.position.set(...CAM.settle.pos); lookTarget.set(...CAM.settle.tgt); // entrance: centred on Claude
    if (guide) gsap.set(guide, { opacity: 1 });
    logoMats.forEach((m) => { m.transparent = true; m.opacity = 0; m.needsUpdate = true; });
    nameTag.classList.remove('show'); cap.classList.remove('show');
    bubble.classList.remove('show'); bubbleOn = false;
  });

  // ACT 0 — entrance: stage sits empty (titles only), then the logo resolves into view + settles
  tl.addLabel('act0 · entrance', 0);
  const fade = { o: 0 };
  const R = CLAUDE.rest;
  tl.add(() => { logoGroup.visible = true; }, ENTER.hold);
  tl.fromTo(logoGroup.position, { y: -ENTER.rise, z: ENTER.z0 }, { y: 0, z: 0, duration: ENTER.dur, ease: 'power3.out' }, ENTER.hold);
  tl.fromTo(logoGroup.scale, { x: R * 0.9, y: R * 0.9, z: R * 0.9 }, { x: R, y: R, z: R, duration: ENTER.dur, ease: 'power2.out' }, '<');
  tl.fromTo(logoGroup.rotation, { y: ENTER.turn, x: 0 }, { y: 0, x: 0, duration: ENTER.dur, ease: 'power3.out' }, '<');
  tl.fromTo(fade, { o: 0 }, { o: 1, duration: ENTER.dur * 0.8, ease: 'power1.inOut',
    onUpdate() { logoMats.forEach((m) => { m.opacity = fade.o; }); } }, '<');
  tl.add(() => { logoMats.forEach((m) => { m.opacity = 1; m.transparent = false; m.needsUpdate = true; }); }, ENTER.hold + ENTER.dur);
  const AFTER_ENTER = ENTER.hold + ENTER.dur + ENTER.settle; // the cinematic proper starts here

  // ACT 1 — Claude TURNS about Y to look right, as if something is coming; then holds
  tl.addLabel('act1 · look right', AFTER_ENTER);
  tl.to(logoGroup.rotation, { y: REACT.lookYaw, x: REACT.dip, z: 0, duration: 0.8, ease: 'power2.inOut' }, AFTER_ENTER);
  tl.to(guide, { opacity: 0, duration: 0.7, ease: 'power2.inOut' }, '<');
  camTo(tl, CAM.react, 1.1, '<');

  // ACT 2 — the book appears (slides in from the right); Claude just BACKS UP, keeping its current facing
  //          (NOT turning to face the book — that side-on view looked bad). claudeFace stays OFF here.
  tl.addLabel('act2 · book arrives');
  tl.add(() => { book.visible = true; book.position.set(3.7, POS.book[1], POS.book[2]); book.scale.setScalar(0.001); }, `>+${REACT.hold}`);
  tl.to(book.position, { x: POS.book[0], duration: 1.5, ease: 'power2.out' }, '<')
    .to(book.scale, { x: BOOK.show, y: BOOK.show, z: BOOK.show, duration: 1.1, ease: 'power2.out' }, '<');
  camTo(tl, CAM.wide, 1.6, '<');                                   // wide: Claude (left) + book (right) both visible
  tl.to(logoGroup.position, { x: POS.recoil[0], y: POS.recoil[1], z: POS.recoil[2], duration: 0.8, ease: 'back.out(1.3)' }, '<+0.5'); // back up, facing unchanged
  tl.to(logoGroup.scale, { x: CLAUDE.book, y: CLAUDE.book, z: CLAUDE.book, duration: 0.9, ease: 'power2.inOut' }, '<'); // recede to book-scene size (reads slightly smaller than the book)

  // ACT 3 — light pause, then Claude wonders what it is ('?'), and lingers (both still visible)
  tl.addLabel('act3 · wonders (?)');
  tl.to({}, { duration: 0.3 });                                    // a light pause before it reacts
  showBubble('>', '?');
  tl.to({}, { duration: 0.5 });                                    // hold: '?' above Claude, book waiting on the right

  // ACT 4 — NOW Claude goes in to see: it starts facing the book, camera centres them, then shifts angle→angle
  tl.addLabel('act4 · inspect book');
  hideBubble('>');
  tl.add(() => { claudeFace = true; });                            // from here it tracks the book (rot Y)
  camTo(tl, CAM.focus, 1.5, '<');
  const bw = (o) => [POS.book[0] + o[0], POS.book[1] + o[1], POS.book[2] + o[2]];
  INSPECT_OFF.forEach((o, i) => {
    const p = bw(o);
    const at = i === 0 ? '>-0.4' : `>+${SHIFT.hold}`;   // the gap between shifts IS the pause at the previous angle
    tl.to(logoGroup.position, { x: p[0], y: p[1], z: p[2], duration: SHIFT.dur, ease: 'sine.inOut' }, at);
  });
  tl.to({}, { duration: SHIFT.hold }); // hold the last angle

  // ACT 5 — Claude returns to the spot it backed up to and FACES THE USER again; camera back to wide
  tl.addLabel('act5 · gets it (♞)');
  tl.add(() => { claudeFace = false; }, '>+0.1');                  // stop tracking the book — about to face the user
  tl.to(logoGroup.position, { x: POS.recoil[0], y: POS.recoil[1], z: POS.recoil[2], duration: 1.2, ease: 'power2.inOut' }, '<');
  tl.to(logoGroup.rotation, { y: 0, x: 0, z: 0, duration: 1.2, ease: 'power2.inOut' }, '<'); // face the user again
  tl.to(logoGroup.scale, { x: CLAUDE.after, y: CLAUDE.after, z: CLAUDE.after, duration: 1.2, ease: 'power2.inOut' }, '<'); // grow a little after the scan
  camTo(tl, CAM.wide, 1.4, '<');
  // it "gets it": a chess piece thought — now Claude knows what the book is about
  showBubble('>-0.2', '<span class="cb-piece">&#9822;</span>');
  tl.to({}, { duration: 0.7 }); // hold the chess thought

  // ACT 6 — Claude pulses gently, then 3 clones bud out (top / left / right); they go scan the book.
  //          The camera STAYS WIDE here (no re-centring) so the original Claude stays in frame.
  tl.addLabel('act6 · spawns subagents');
  hideBubble('>');
  tl.to(logoGroup.scale, { x: CLAUDE.after * 1.1, y: CLAUDE.after * 1.1, z: CLAUDE.after * 1.1, duration: 0.35, ease: 'sine.inOut' }, '>-0.05') // a slight, smooth pulse
    .to(logoGroup.scale, { x: CLAUDE.after, y: CLAUDE.after, z: CLAUDE.after, duration: 0.45, ease: 'sine.inOut' });
  tl.add(() => { cloneGroups.forEach((g) => { g.visible = true; g.position.copy(logoGroup.position); g.scale.setScalar(0.001); }); }, '<+0.2');
  cloneGroups.forEach((g, i) => {
    tl.to(g.scale, { x: CLONE.scale, y: CLONE.scale, z: CLONE.scale, duration: 0.5, ease: 'back.out(1.6)' }, i ? `<+${i * 0.12}` : '<')
      .to(g.position, { x: POS.recoil[0] + EMERGE[i][0], y: POS.recoil[1] + EMERGE[i][1], z: POS.recoil[2] + EMERGE[i][2], duration: 0.6, ease: 'power2.out' }, '<'); // bud out top/left/right
  });
  tl.to({}, { duration: 0.3 }); // hold them around Claude a beat
  showCap('>-0.1', 'It studies the book closely, learning a new concept.');
  // they FLY OVER to the book (each to its first angle), facing it as they go — staggered so it's not in unison
  tl.add(() => { clonesFace = true; });
  cloneGroups.forEach((g, i) => {
    const s = [POS.book[0] + CLONE_OFF[i][0][0], POS.book[1] + CLONE_OFF[i][0][1], POS.book[2] + CLONE_OFF[i][0][2]];
    tl.to(g.position, { x: s[0], y: s[1], z: s[2], duration: 1.25, ease: 'power2.inOut' }, i ? `<+${i * 0.18}` : '>+0.1');
  });
  cloneStart = tl.duration();        // remember WHEN inspection begins, so frame() can scrub the loops from tl.time()
  tl.add(() => startCloneInspect()); // then each agent loops its own angles independently (lively, never in sync)

  // ACT 7 — while the subagents study the book, Claude turns left; the camera pans left and the chess board
  //          ANIMATES into being as it arrives; then Claude moves ABOVE it and studies it (facing DOWN).
  tl.addLabel('act7a · turns left');
  tl.to({}, { duration: 0.4 });                 // brief beat as the subagents study the book
  // the board GROWS into being NOW (far left, off-frame) — concurrently with Claude's turn — so it has fully
  // materialised before the camera pans over to it. A smooth rise + scale, not a pop.
  tl.add(() => { board.visible = true; board.position.set(POS.board[0], POS.board[1] - 0.5, POS.board[2]); board.scale.setScalar(0.001); }, '>');
  // Claude notices the board and turns toward it — turning left AND tilting down at it (it sits low on the left)
  tl.to(logoGroup.rotation, { y: GLANCE.yaw, x: 0.34, z: 0, duration: GLANCE.dur, ease: 'power2.inOut' }, '<');
  camTo(tl, CAM.glance, GLANCE.dur + 0.2, '<');
  tl.to(board.scale, { x: BOARD.show, y: BOARD.show, z: BOARD.show, duration: 1.25, ease: 'power3.out' }, '<')
    .to(board.position, { y: POS.board[1], duration: 1.25, ease: 'power3.out' }, '<'); // rise into place as it grows
  tl.to({}, { duration: GLANCE.hold });
  showCap('>-0.2', 'A new position to learn from.');
  // ACT 7b — the camera pans to the board AND Claude starts inspecting right away (flies up above it as the
  //          camera moves; boardFace keeps it turned toward the board's centre and tilted down at it).
  tl.addLabel('act7b · camera + inspect');
  tl.add(() => { claudeFace = false; boardFace = true; }); // frame() now owns Claude's rotation (face board + look down)
  camTo(tl, CAM.board, 1.6, '>');
  tl.to(logoGroup.scale, { x: CLAUDE.book, y: CLAUDE.book, z: CLAUDE.book, duration: ABOVE.dur, ease: 'power2.inOut' }, '<');
  ABOVE_OFF.forEach((o, i) => {
    const p = [POS.board[0] + o[0], POS.board[1] + o[1], POS.board[2] + o[2]];
    const at = i === 0 ? '<' : `>+${SHIFT.hold}`;          // the gap between moves IS the pause at the previous spot
    const dur = i === 0 ? ABOVE.dur : SHIFT.dur;
    tl.to(logoGroup.position, { x: p[0], y: p[1], z: p[2], duration: dur, ease: 'sine.inOut' }, at);
  });
  tl.to({}, { duration: SHIFT.hold });          // hold the last spot — Claude studying from above

  // ACT 8 — the study ends: the board recedes, the book shrinks, the subagents fly back INTO Claude (which
  //          pulses as it absorbs them), then a code file appears and Claude writes what it learned into how
  //          StockThink explains. Camera regroups centre-left so the 2D code panel owns the right side.
  tl.addLabel('act8 · returns + codes');
  tl.add(() => { boardFace = false; claudeFace = false; });
  // the board recedes — reverse of its entrance (shrinks + sinks back off-frame), then hides
  tl.to(board.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 1.0, ease: 'power2.in' }, '>')
    .to(board.position, { y: POS.board[1] - 0.5, duration: 1.0, ease: 'power2.in' }, '<')
    .add(() => { board.visible = false; });
  // Claude pulls in CLOSE and turns slightly right to face the terminal, growing back up
  tl.to(logoGroup.rotation, { y: CODE_YAW, x: 0, z: 0, duration: 1.2, ease: 'power2.inOut' }, '<')
    .to(logoGroup.position, { x: POS.code[0], y: POS.code[1], z: POS.code[2], duration: 1.2, ease: 'power2.inOut' }, '<')
    .to(logoGroup.scale, { x: CLAUDE.after, y: CLAUDE.after, z: CLAUDE.after, duration: 1.2, ease: 'power2.inOut' }, '<');
  camTo(tl, CAM.code, 1.4, '<');
  showCap('>-0.3', 'Then it brings everything it learned back together.');

  // the book shrinks away and the 3 subagents fly back INTO Claude (converge to its spot, scaled to nothing)
  tl.add(() => { killCloneLoops(); clonesFace = false; }, '>');
  tl.to(book.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.8, ease: 'power2.in' }, '<')
    .add(() => { book.visible = false; });
  cloneGroups.forEach((g, i) => {
    tl.to(g.position, { x: POS.code[0], y: POS.code[1], z: POS.code[2], duration: 0.85, ease: 'power2.in' }, i ? `<+${i * 0.1}` : '<')
      .to(g.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.5, ease: 'power2.in' }, '>-0.4');
  });
  tl.add(() => { cloneGroups.forEach((g) => { g.visible = false; }); });

  // it absorbs them: a green learned-pulse + flash (the "getting smarter" colour beat)
  const A = CLAUDE.after;
  tl.to(logoGroup.scale, { x: A * 1.12, y: A * 1.12, z: A * 1.12, duration: 0.22, ease: 'power2.out' }, '>-0.1')
    .to(logoGroup.scale, { x: A, y: A, z: A, duration: 0.4, ease: 'power2.in' });
  flashAt(tl, logoGroup, '<', 2.4);

  // a code file appears and Claude writes the new concept into how StockThink explains
  showCap('>-0.1', 'It writes what it learned into how StockThink explains.');
  showCode(tl, '>+0.2');
  tl.to({}, { duration: 0.7 }); // read the finished code a beat

  // ACT 9 — Claude SAVES the work (green confirm + flash), CLOSES the tab, recenters; then the timeline loops
  tl.addLabel('act9 · save + recenter');
  tl.add(() => codePanel.classList.add('saved'), '>');
  flashAt(tl, logoGroup, '<', 1.8);
  showCap('<', 'Saved — sharper for your next game.');
  tl.to({}, { duration: 0.5 });
  tl.add(() => { codePanel.classList.remove('show'); });           // close the tab — it slides out
  hideCap('>');
  // recenter on screen, face the user again, back to rest size; camera returns to the centred entrance shot
  tl.to(logoGroup.position, { x: POS.home[0], y: POS.home[1], z: POS.home[2], duration: 1.0, ease: 'power2.inOut' }, '>')
    .to(logoGroup.rotation, { y: 0, x: 0, z: 0, duration: 1.0, ease: 'power2.inOut' }, '<')
    .to(logoGroup.scale, { x: CLAUDE.rest, y: CLAUDE.rest, z: CLAUDE.rest, duration: 1.0, ease: 'power2.inOut' }, '<');
  camTo(tl, CAM.settle, 1.1, '<');
  tl.add(() => codePanel.classList.remove('saved'));               // reset the badge for the next loop
  tl.to({}, { duration: 0.4 });                                    // a beat centred, then it replays
}

// ---- autoplay on center + replay -----------------------------------------------
let played = false;
let visible = false;   // true while the coach section is on screen — gates the render loop (set by `io`)
function playGuideOut() { if (guide) guide.style.opacity = '0'; }
function playGuideIn() { if (guide) guide.style.opacity = '1'; }
function run() {
  if (!tl) return;
  if (RM()) { tl.progress(1).pause(); playGuideOut(); return; }
  playGuideIn();      // titles stay through the empty beat + entrance; the timeline fades them at recede
  tl.restart();
}
function maybeAutoplay() { if (played && ready) run(); }
// Seamless replay while the viewer stays in the section: resume from act1 (skip the entrance fade-in/
// scale-up). ACT 9 already left Claude centred at rest, so jumping to the act1 label loops cleanly.
function loopWithoutIntro() {
  if (RM()) return;        // reduced motion: stay parked on the final frame, don't loop
  tl.play('act1 · look right');
}

const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    visible = e.isIntersecting;             // gate the render loop — off-screen the coach scene never draws
    if (e.isIntersecting) ensureBoard();   // start fetching/building the board the moment the section nears
    if (e.isIntersecting && e.intersectionRatio >= 0.55) {
      if (!played) { played = true; run(); }
    } else if (e.intersectionRatio <= 0.01) {
      played = false;   // fully scrolled away — re-arm so it replays on the next return
    }
  });
}, { threshold: [0, 0.55, 0.9] });
io.observe(section);

replayBtn?.addEventListener('click', () => { played = true; run(); });

// The dev-only timeline scrubber is mounted in the GLB onLoad above (new Scrubber + gsapTransport
// from ./scrub.js) — one universal bar, replacing the old hand-rolled one.

// ---- render loop ---------------------------------------------------------------
function resize() {
  const w = section.clientWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

let t = 0;
const coachGate = fpsGate();   // cap below display refresh — cinematic, time-driven (scrub-safe)
function frame() {
  requestAnimationFrame(frame);
  if (!QUALITY.cinema) return;   // perf watchdog can disable the cinematics
  if (!visible) return;   // coach off-screen → don't render (the GSAP clock keeps time on its own)
  if (!coachGate()) return;
  t += 0.016;
  // ct = the cinematic clock. Use the TIMELINE's own time so EVERYTHING (bob, sway, the subagent loops) freezes
  // when the scrub bar is paused and seeks when you drag it — nothing runs on its own clock anymore.
  const ct = tl ? tl.time() : t;
  // subagent inspection loops are paused; we scrub them from the timeline so they're fully bar-controlled
  if (cloneLoops.length && ct >= cloneStart) {
    const e = ct - cloneStart;
    cloneLoops.forEach((lp) => lp.totalTime(e));
  }
  if (!RM()) bobNode.position.y = Math.sin(ct * 0.8) * BOB;
  // turn-to-face: Claude and the subagents keep their front face on the book, even while moving.
  // While paused/scrubbing, SNAP (k=1) so facing matches the seeked frame and never eases on after a pause.
  const k = (RM() || (tl && tl.paused())) ? 1 : 0.12;
  if (claudeFace) {
    // above the book → turn toward it (yaw) AND tilt slightly down (pitch) to read it
    logoGroup.rotation.y = lerpAngle(logoGroup.rotation.y, faceYaw(logoGroup.position, book.position), k);
    logoGroup.rotation.x = THREE.MathUtils.lerp(logoGroup.rotation.x, BOOK_LOOK_DOWN, k);
  }
  if (boardFace) {
    // hovering above the board → aim at its centre (yaw) and look down by however far above it is (pitch)
    const dx = board.position.x - logoGroup.position.x, dz = board.position.z - logoGroup.position.z;
    const dy = logoGroup.position.y - board.position.y, horiz = Math.hypot(dx, dz) || 0.001;
    logoGroup.rotation.y = lerpAngle(logoGroup.rotation.y, Math.atan2(dx, dz) + FACE_YAW, k);
    logoGroup.rotation.x = THREE.MathUtils.lerp(logoGroup.rotation.x, Math.atan2(dy, horiz), k);
  }
  if (clonesFace && !RM()) cloneGroups.forEach((g, i) => {
    g.rotation.y = lerpAngle(g.rotation.y, faceYaw(g.position, book.position), k);
    g.rotation.z = Math.sin(ct * 1.6 + i * 2.1) * 0.10;  // gentle individual sway — each agent feels alive
  });
  camera.lookAt(lookTarget);
  camera.updateMatrixWorld();
  if (bubbleOn) positionBubble();
  renderer.render(scene, camera);
}
frame();
