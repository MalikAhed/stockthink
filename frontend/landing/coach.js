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
};
// scene anchor positions
const POS = {
  home: [0, 0, 0],                // entrance: Claude dead-centre
  recoil: [-0.85, 0.32, 0.5],     // backs up here — y raised so Claude is on the SAME EYELINE as the book (Δ~0)
  book:   [1.92, 0.23, -0.55],    // where the book arrives (your tuned value); it stays here the whole scene
  board:  [0, -0.75, 0],          // (placeholder board — the later beat, deferred)
};
// Claude's "look right" reaction — a real TURN about Y; kept small (not exaggerated)
const REACT = { lookYaw: 0.7, dip: 0.1, hold: 0.55 };
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
const SHIFT = { dur: 0.85, hold: 1.05 };      // Claude inspection: SMOOTH shift (sine), then a pause at each angle
// size arc: entrance 0.70 → backs up + scans at 0.50 (reads ~0.84× the book) → after the scan grows to
// 0.60 (~book size, a little bigger). Verified in editor/coach-check.mjs.
const CLAUDE = { rest: 0.70, book: 0.50, after: 0.60 };
const CLONE = { scale: 0.21, count: 3 };      // the smaller subagents that inspect the book (your tuned value)
const BOOK = { fit: 1.30, show: 1.00, rx: 1.17, ry: -1.67, rz: 0.49 }; // size + orientation (your tuned values)
// ACT 0 entrance — empty stage (just the corner titles), then the logo resolves into view
const ENTER = {
  hold: 0.8,           // empty-stage beat: titles alone, the "what is this?" moment
  dur: 2.4,            // a slow, composed arrival
  settle: 1.3,         // calm beat after it lands, before the cinematic proper begins
  z0: -1.7,            // eases gently forward from just behind (no fly-in)
  s0: 0.88,            // barely scales up — no pop
  rise: 0.16,          // floats up a touch as it resolves
  turn: 0.20,          // a whisper of rotation that levels out (no pinwheel)
  nameAt: 0.66,        // 0..1 through the entrance when "Claude" fades in beneath it
};

// ---- renderer / scene ----------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
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
let cloneLoops = [];           // ONE independent repeating loop per subagent (so they desync — lively)
let claudeFace = false;        // when true, frame() turns Claude (rot Y) to keep its face on the book
let clonesFace = false;        // when true, frame() turns each subagent to keep its face on the book
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

const board = new THREE.Group();
{
  // simple 8x8 checker plane (placeholder for chess-board.glb)
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    x.fillStyle = (i + j) % 2 ? '#3a4750' : '#cdd6dc';
    x.fillRect(i * 32, j * 32, 32, 32);
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const plane = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.08, 1.5),
    [0, 0, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), 0, 0, 0].map(
      (m) => m || new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.7 }),
    ),
  );
  board.add(plane);
}
board.position.set(...POS.board);
board.scale.setScalar(0.001); board.visible = false;
scene.add(board);

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
codePanel.innerHTML = `
  <div class="cc-bar"><i></i><i></i><i></i><span class="cc-file">concepts.ts</span></div>
  <div class="cc-body">${[
    '<span class="cc-line">export const concepts = [</span>',
    '<span class="cc-line">  "fork", "pin", "skewer",</span>',
    '<span class="cc-line">  "discovered attack",</span>',
    '<span class="cc-line cc-add">  "rook behind a passed pawn",</span>',
    '<span class="cc-line">];</span>',
  ].join('\n')}</div>`;
overlay.appendChild(codePanel);
const codeLines = codePanel.querySelectorAll('.cc-line');

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
  tl.add(() => codePanel.classList.add('show'), at);
  codeLines.forEach((ln, i) => tl.add(() => ln.classList.add('on'), at + 0.4 + i * 0.28));
}
function hideCode(tl, at) { tl.add(() => { codePanel.classList.remove('show'); codeLines.forEach((l) => l.classList.remove('on')); }, at); }

// Each subagent gets its OWN repeating shift+pause loop (its own region, axis, and timing) so the three
// move INDEPENDENTLY — some up while others go right/down — never in lockstep. Positions only; frame()
// keeps each one's face on the book and adds a gentle sway. Geometry-checked clear of the book.
function killCloneLoops() { cloneLoops.forEach((l) => l.kill()); cloneLoops = []; }
const cloneSpot = (i, k) => { const b = book.position, o = CLONE_OFF[i][k % CLONE_OFF[i].length]; return [b.x + o[0], b.y + o[1], b.z + o[2]]; };
// builds each agent's independent loop. Assumes the agent is already sitting at its spot 0 (ACT 6 flies it
// there first). The loop: hold → shift to the next angle → hold → … → back to spot 0, forever.
function startCloneInspect() {
  killCloneLoops();
  clonesFace = true;
  if (RM()) { cloneGroups.forEach((g, i) => g.position.set(...cloneSpot(i, 0))); return; }
  cloneGroups.forEach((g, i) => {
    const tm = CLONE_TIMING[i], n = CLONE_OFF[i].length;
    const lp = gsap.timeline({ repeat: -1 });
    for (let k = 1; k <= n; k++) {
      const s = cloneSpot(i, k % n);
      lp.to({}, { duration: tm.hold })                                                    // study the current angle
        .to(g.position, { x: s[0], y: s[1], z: s[2], duration: tm.dur, ease: 'sine.inOut' }); // shift to the next
    }
    cloneLoops.push(lp);
  });
}

// ---- the timeline --------------------------------------------------------------
let tl = null;
function buildTimeline() {
  tl = gsap.timeline({ paused: true });

  // reset state at t=0 — empty stage: logo hidden far back, titles alone
  tl.add(() => {
    killCloneLoops(); claudeFace = false; clonesFace = false;
    logoGroup.visible = false;
    logoGroup.position.set(0, 0, ENTER.z0); logoGroup.rotation.set(ENTER.tilt, ENTER.spin, 0); logoGroup.scale.setScalar(CLAUDE.rest * 0.9);
    cloneGroups.forEach((g) => { g.visible = false; g.position.set(...POS.home); g.rotation.set(0, 0, 0); g.scale.setScalar(0.001); });
    book.visible = false; book.position.set(...POS.book); book.scale.setScalar(0.001);
    if (board) { board.visible = false; board.scale.setScalar(0.001); }
    codePanel.classList.remove('show'); codeLines.forEach((l) => l.classList.remove('on'));
    camera.position.set(...CAM.settle.pos); lookTarget.set(...CAM.settle.tgt); // entrance: centred on Claude
    if (guide) gsap.set(guide, { opacity: 1 });
    logoMats.forEach((m) => { m.transparent = true; m.opacity = 0; m.needsUpdate = true; });
    nameTag.classList.remove('show'); cap.classList.remove('show');
    bubble.classList.remove('show'); bubbleOn = false;
  });

  // ACT 0 — entrance: stage sits empty (titles only), then the logo resolves into view + settles
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
  tl.to(logoGroup.rotation, { y: REACT.lookYaw, x: REACT.dip, z: 0, duration: 0.8, ease: 'power2.inOut' }, AFTER_ENTER);
  tl.to(guide, { opacity: 0, duration: 0.7, ease: 'power2.inOut' }, '<');
  camTo(tl, CAM.react, 1.1, '<');

  // ACT 2 — the book appears (slides in from the right); Claude just BACKS UP, keeping its current facing
  //          (NOT turning to face the book — that side-on view looked bad). claudeFace stays OFF here.
  tl.add(() => { book.visible = true; book.position.set(3.7, POS.book[1], POS.book[2]); book.scale.setScalar(0.001); }, `>+${REACT.hold}`);
  tl.to(book.position, { x: POS.book[0], duration: 1.5, ease: 'power2.out' }, '<')
    .to(book.scale, { x: BOOK.show, y: BOOK.show, z: BOOK.show, duration: 1.1, ease: 'power2.out' }, '<');
  camTo(tl, CAM.wide, 1.6, '<');                                   // wide: Claude (left) + book (right) both visible
  tl.to(logoGroup.position, { x: POS.recoil[0], y: POS.recoil[1], z: POS.recoil[2], duration: 0.8, ease: 'back.out(1.3)' }, '<+0.5'); // back up, facing unchanged
  tl.to(logoGroup.scale, { x: CLAUDE.book, y: CLAUDE.book, z: CLAUDE.book, duration: 0.9, ease: 'power2.inOut' }, '<'); // recede to book-scene size (reads slightly smaller than the book)

  // ACT 3 — light pause, then Claude wonders what it is ('?'), and lingers (both still visible)
  tl.to({}, { duration: 0.5 });                                    // a light pause before it reacts
  showBubble('>', '?');
  tl.to({}, { duration: 1.3 });                                    // hold: '?' above Claude, book waiting on the right

  // ACT 4 — NOW Claude goes in to see: it starts facing the book, camera centres them, then shifts angle→angle
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
  tl.add(() => { claudeFace = false; }, '>+0.1');                  // stop tracking the book — about to face the user
  tl.to(logoGroup.position, { x: POS.recoil[0], y: POS.recoil[1], z: POS.recoil[2], duration: 1.2, ease: 'power2.inOut' }, '<');
  tl.to(logoGroup.rotation, { y: 0, x: 0, z: 0, duration: 1.2, ease: 'power2.inOut' }, '<'); // face the user again
  tl.to(logoGroup.scale, { x: CLAUDE.after, y: CLAUDE.after, z: CLAUDE.after, duration: 1.2, ease: 'power2.inOut' }, '<'); // grow a little after the scan
  camTo(tl, CAM.wide, 1.4, '<');
  // it "gets it": a chess piece thought — now Claude knows what the book is about
  showBubble('>-0.2', '<span class="cb-piece">&#9822;</span>');
  tl.to({}, { duration: 1.4 }); // hold the chess thought

  // ACT 6 — Claude pulses gently, then 3 clones bud out (top / left / right); they go scan the book.
  //          The camera STAYS WIDE here (no re-centring) so the original Claude stays in frame.
  hideBubble('>');
  tl.to(logoGroup.scale, { x: CLAUDE.after * 1.1, y: CLAUDE.after * 1.1, z: CLAUDE.after * 1.1, duration: 0.35, ease: 'sine.inOut' }, '>-0.05') // a slight, smooth pulse
    .to(logoGroup.scale, { x: CLAUDE.after, y: CLAUDE.after, z: CLAUDE.after, duration: 0.45, ease: 'sine.inOut' });
  tl.add(() => { cloneGroups.forEach((g) => { g.visible = true; g.position.copy(logoGroup.position); g.scale.setScalar(0.001); }); }, '<+0.2');
  cloneGroups.forEach((g, i) => {
    tl.to(g.scale, { x: CLONE.scale, y: CLONE.scale, z: CLONE.scale, duration: 0.5, ease: 'back.out(1.6)' }, i ? `<+${i * 0.12}` : '<')
      .to(g.position, { x: POS.recoil[0] + EMERGE[i][0], y: POS.recoil[1] + EMERGE[i][1], z: POS.recoil[2] + EMERGE[i][2], duration: 0.6, ease: 'power2.out' }, '<'); // bud out top/left/right
  });
  tl.to({}, { duration: 0.5 }); // hold them around Claude a beat
  showCap('>-0.1', 'It spawns subagents that study the book from every angle in parallel.');
  // they FLY OVER to the book (each to its first angle), facing it as they go — staggered so it's not in unison
  tl.add(() => { clonesFace = true; });
  cloneGroups.forEach((g, i) => {
    const s = [POS.book[0] + CLONE_OFF[i][0][0], POS.book[1] + CLONE_OFF[i][0][1], POS.book[2] + CLONE_OFF[i][0][2]];
    tl.to(g.position, { x: s[0], y: s[1], z: s[2], duration: 1.25, ease: 'power2.inOut' }, i ? `<+${i * 0.18}` : '>+0.1');
  });
  tl.add(() => startCloneInspect()); // then each agent loops its own angles independently (lively, never in sync)
}

// ---- autoplay on center + replay -----------------------------------------------
let played = false;
function playGuideOut() { if (guide) guide.style.opacity = '0'; }
function playGuideIn() { if (guide) guide.style.opacity = '1'; }
function run() {
  if (!tl) return;
  if (RM()) { tl.progress(1).pause(); playGuideOut(); return; }
  playGuideIn();      // titles stay through the empty beat + entrance; the timeline fades them at recede
  tl.restart();
}
function maybeAutoplay() { if (played && ready) run(); }

const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting && e.intersectionRatio >= 0.55) {
      if (!played) { played = true; run(); }
    } else if (e.intersectionRatio <= 0.01) {
      played = false;   // fully scrolled away — re-arm so it replays on the next return
    }
  });
}, { threshold: [0, 0.55, 0.9] });
io.observe(section);

replayBtn?.addEventListener('click', () => { played = true; run(); });

// ---- dev-only TUNE panel: size + direction of each asset, then "Copy params" ----
// (tree-shaken out of prod — only runs under `npm run dev`). Lets the user pose the book/
// Claude/clones, read the numbers off, and paste them back to bake into the tunables.
if (import.meta.env.DEV) buildTunePanel();
function buildTunePanel() {
  const S = {
    bookSize: BOOK.fit, bookRX: BOOK.rx, bookRY: BOOK.ry, bookRZ: BOOK.rz,
    bookPX: POS.book[0], bookPY: POS.book[1], bookPZ: POS.book[2],
    claudeSize: CLAUDE.book, claudeRX: 0, claudeRY: 0, claudeRZ: 0,
    cloneSize: CLONE.scale,
  };
  const panel = document.createElement('div');
  panel.className = 'coach-tune';
  panel.innerHTML = `<button class="ct-toggle" type="button">⚙ Tune</button><div class="ct-body"></div>`;
  section.querySelector('.coach-sticky').appendChild(panel);
  const body = panel.querySelector('.ct-body');
  const toggle = panel.querySelector('.ct-toggle');
  let open = false;

  function apply() {
    if (bookModel) { bookModel.scale.setScalar(S.bookSize); bookModel.rotation.set(S.bookRX, S.bookRY, S.bookRZ); }
    book.visible = true; book.scale.setScalar(BOOK.show); book.position.set(S.bookPX, S.bookPY, S.bookPZ);
    logoGroup.visible = true; logoGroup.scale.setScalar(S.claudeSize); logoGroup.rotation.set(S.claudeRX, S.claudeRY, S.claudeRZ);
    logoMats.forEach((m) => { m.transparent = false; m.opacity = 1; m.needsUpdate = true; });
    cloneGroups.forEach((g) => { g.visible = true; g.scale.setScalar(S.cloneSize); });
  }
  function pose() {                 // freeze the cinematic and lay everything out so it's all visible
    tl?.pause(); killCloneLoops(); claudeFace = false; clonesFace = false;
    logoGroup.position.set(POS.recoil[0], POS.recoil[1], POS.recoil[2]);
    const b = POS.book;
    const spots = [[b[0] - 0.6, b[1] + 0.3, b[2] + 0.6], [b[0] + 0.6, b[1] + 0.2, b[2] + 0.5], [b[0], b[1] + 0.5, b[2] - 0.3]];
    cloneGroups.forEach((g, i) => g.position.set(...spots[i % spots.length]));
    camera.position.set(CAM.focus.pos[0], CAM.focus.pos[1] + (CAM.focus.down ? SCENE_DOWN : 0), CAM.focus.pos[2]);
    lookTarget.set(CAM.focus.tgt[0], CAM.focus.tgt[1] + (CAM.focus.down ? SCENE_DOWN : 0), CAM.focus.tgt[2]);
    apply();
  }
  function fmt(n) { return (+n).toFixed(2); }
  function copy() {
    const txt =
`BOOK = { fit: ${fmt(S.bookSize)}, show: ${fmt(BOOK.show)}, rx: ${fmt(S.bookRX)}, ry: ${fmt(S.bookRY)}, rz: ${fmt(S.bookRZ)} }
POS.book = [${fmt(S.bookPX)}, ${fmt(S.bookPY)}, ${fmt(S.bookPZ)}]
CLAUDE.book = ${fmt(S.claudeSize)}    // book-scene size · rot while posed: ${fmt(S.claudeRX)}, ${fmt(S.claudeRY)}, ${fmt(S.claudeRZ)}
CLONE.scale = ${fmt(S.cloneSize)}`;
    navigator.clipboard?.writeText(txt).then(() => { copyBtn.textContent = 'copied ✓'; setTimeout(() => (copyBtn.textContent = 'Copy params'), 1300); });
  }
  function addRow(label, key, min, max, step) {
    const row = document.createElement('label'); row.className = 'ct-row';
    const span = document.createElement('span'); span.textContent = label;
    const rng = document.createElement('input'); rng.type = 'range'; rng.min = min; rng.max = max; rng.step = step; rng.value = S[key];
    const num = document.createElement('input'); num.type = 'number'; num.step = step; num.value = S[key]; num.className = 'ct-num';
    const set = (v) => { const f = parseFloat(v); if (Number.isNaN(f)) return; S[key] = f; rng.value = f; num.value = f; apply(); };
    rng.addEventListener('input', (e) => set(e.target.value));
    num.addEventListener('input', (e) => set(e.target.value));
    row.append(span, rng, num); body.appendChild(row);
  }
  function head(t) { const h = document.createElement('div'); h.className = 'ct-head'; h.textContent = t; body.appendChild(h); }

  head('Book'); addRow('size', 'bookSize', 0.2, 3, 0.01);
  addRow('rot X', 'bookRX', -3.15, 3.15, 0.01); addRow('rot Y', 'bookRY', -3.15, 3.15, 0.01); addRow('rot Z', 'bookRZ', -3.15, 3.15, 0.01);
  addRow('pos X', 'bookPX', -2.5, 2.5, 0.01); addRow('pos Y', 'bookPY', -2, 2, 0.01); addRow('pos Z', 'bookPZ', -2, 2, 0.01);
  head('Claude'); addRow('size', 'claudeSize', 0.2, 2, 0.01);
  addRow('rot X', 'claudeRX', -3.15, 3.15, 0.01); addRow('rot Y', 'claudeRY', -3.15, 3.15, 0.01); addRow('rot Z', 'claudeRZ', -3.15, 3.15, 0.01);
  head('Subagents'); addRow('size', 'cloneSize', 0.1, 1.2, 0.01);
  const copyBtn = document.createElement('button'); copyBtn.type = 'button'; copyBtn.className = 'ct-copy'; copyBtn.textContent = 'Copy params';
  copyBtn.addEventListener('click', copy); body.appendChild(copyBtn);

  toggle.addEventListener('click', () => {
    open = !open; panel.classList.toggle('on', open);
    if (open) pose(); else { played = true; run(); } // closing resumes the cinematic
  });
}

// ---- render loop ---------------------------------------------------------------
function resize() {
  const w = section.clientWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

let t = 0;
function frame() {
  requestAnimationFrame(frame);
  t += 0.016;
  if (!RM()) bobNode.position.y = Math.sin(t * 0.8) * BOB;
  // turn-to-face: Claude and the subagents keep their front face on the book, even while moving
  const k = RM() ? 1 : 0.12;
  if (claudeFace) logoGroup.rotation.y = lerpAngle(logoGroup.rotation.y, faceYaw(logoGroup.position, book.position), k);
  if (clonesFace && !RM()) cloneGroups.forEach((g, i) => {
    g.rotation.y = lerpAngle(g.rotation.y, faceYaw(g.position, book.position), k);
    g.rotation.z = Math.sin(t * 1.6 + i * 2.1) * 0.10;  // gentle individual sway — each agent feels alive
  });
  camera.lookAt(lookTarget);
  camera.updateMatrixWorld();
  if (bubbleOn) positionBubble();
  renderer.render(scene, camera);
}
frame();
