// COACH SCENE — ground-truth checker. Loads the real GLBs, rebuilds coach.js's exact transform chain,
// and reports for every beat: (a) screen-% framing, (b) Claude-vs-book apparent size, (c) whether the
// logo's world bounding-box INTERSECTS the book (so we can keep Claude "around it, not inside it").
// Run: node landing/editor/coach-check.mjs            (desktop aspect 1.78)
//
// node polyfills so GLTFLoader's texture path doesn't crash in node — we only need GEOMETRY.
globalThis.self = globalThis;
globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} });
if (!globalThis.URL.createObjectURL) globalThis.URL.createObjectURL = () => 'blob:stub';
if (!globalThis.URL.revokeObjectURL) globalThis.URL.revokeObjectURL = () => {};
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { readFileSync } from 'fs';

const ASPECT = parseFloat(process.argv[2]) || 1.78;

// ===== mirror of coach.js tunables (keep in sync when baking) =====
const FACE_Y = -1.680, FACE_YAW = 0, SCENE_DOWN = 0.32;
const CAM = {
  settle: { pos: [0, 0, 3.4], tgt: [0, 0, 0], down: false },
  wide:   { pos: [0.4, 0.25, 5.7], tgt: [0.5, 0, -0.2], down: true },
  focus:  { pos: [1.1, 0.2, 4.6], tgt: [1.7, 0, -0.35], down: true },
};
const POS = { home: [0, 0, 0], recoil: [-0.85, 0.32, 0.5], book: [1.92, 0.23, -0.55] };
const CLAUDE = { rest: 0.70, book: 0.50, after: 0.60 };
const LOGO_H = 1.65;       // logo world height at logoGroup scale 1 (raw maxdim 1.0 * 1.7 fit)
const BUBBLE_GAP = 0.12;   // world gap above Claude's head where the bubble bottom should sit
const CLONE = { scale: 0.21 };
const BOOK = { fit: 1.30, show: 1.0, rx: 1.17, ry: -1.67, rz: 0.49 };
// Claude inspects from a SAFE radius (book half-extent ~0.63): front-left close, right-behind low, left-top high
const INSPECT_OFF = [[-0.5, 0.05, 1.25], [1.15, -0.2, -0.55], [-1.05, 0.85, 0.85]];
// 3 agents, each its OWN REGION + primary motion axis (so they move independently, not in unison):
//   A = left side, moves vertically · B = front/top, moves horizontally · C = right/bottom, moves diagonally
const CLONE_OFF = [
  [[-0.95, -0.55, 0.4], [-1.05, 0.1, 0.5], [-0.85, 0.8, 0.45]],  // A: up the left side
  [[-0.4, 0.6, 1.0], [0.25, 0.9, 0.8], [0.7, 0.5, 1.0]],         // B: across the front-top
  [[1.05, 0.1, 0.5], [0.3, -0.85, 0.9], [0.9, -0.4, 0.65]],      // C: around the lower-right
];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// ===== load GLBs, build rigs matching coach.js =====
const loader = new GLTFLoader();
await MeshoptDecoder.ready; loader.setMeshoptDecoder(MeshoptDecoder);
const loadGLB = (p) => { const b = readFileSync(p); const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); return new Promise((res, rej) => loader.parse(ab, '', res, rej)); };
const bookGLB = await loadGLB('landing/models/book.glb');
const logoGLB = await loadGLB('landing/models/claude-logo.glb');

// book rig: group(pos, scale=show) > model(fit, rot)
function makeBook() {
  const m = bookGLB.scene.clone(true);
  let box = new THREE.Box3().setFromObject(m); const sz = box.getSize(new THREE.Vector3());
  m.scale.setScalar(BOOK.fit / Math.max(sz.x, sz.y, sz.z));
  box = new THREE.Box3().setFromObject(m); m.position.sub(box.getCenter(new THREE.Vector3()));
  m.rotation.set(BOOK.rx, BOOK.ry, BOOK.rz);
  const g = new THREE.Group(); g.add(m); g.position.set(...POS.book); g.scale.setScalar(BOOK.show);
  g.updateMatrixWorld(true); return g;
}
// claude rig: group(pos, yaw, scale) > bob > model(FACE_Y, fit 1.7)
function makeClaude() {
  const m = logoGLB.scene.clone(true);
  let box = new THREE.Box3().setFromObject(m); const sz = box.getSize(new THREE.Vector3());
  m.scale.setScalar(1.7 / Math.max(sz.x, sz.y, sz.z));
  box = new THREE.Box3().setFromObject(m); m.position.sub(box.getCenter(new THREE.Vector3()));
  m.rotation.y = FACE_Y;
  const bob = new THREE.Group(); bob.add(m);
  const g = new THREE.Group(); g.add(bob); return g;
}
const bookRig = makeBook();
const claudeRig = makeClaude();
const bookBox = new THREE.Box3().setFromObject(bookRig);

function faceYaw(from, to) { return Math.atan2(to[0] - from[0], to[2] - from[2]) + FACE_YAW; }
function placeClaude(p, scale, faceBook) {
  claudeRig.position.set(p[0], p[1], p[2]);
  claudeRig.rotation.y = faceBook ? faceYaw(p, POS.book) : 0;
  claudeRig.scale.setScalar(scale);
  claudeRig.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(claudeRig);
}
// signed gap between two AABBs: <0 means overlap (boxes intersect), >0 = clear gap in world units
function gap(a, b) {
  const dx = Math.max(a.min.x - b.max.x, b.min.x - a.max.x);
  const dy = Math.max(a.min.y - b.max.y, b.min.y - a.max.y);
  const dz = Math.max(a.min.z - b.max.z, b.min.z - a.max.z);
  if (dx <= 0 && dy <= 0 && dz <= 0) return Math.max(dx, dy, dz); // overlapping (negative)
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0));
}

// ===== camera + projection =====
const cam = new THREE.PerspectiveCamera(34, ASPECT, 0.1, 100);
function shot(name) { const s = CAM[name], dy = s.down ? SCENE_DOWN : 0; cam.position.set(s.pos[0], s.pos[1] + dy, s.pos[2]); cam.up.set(0, 1, 0); cam.lookAt(s.tgt[0], s.tgt[1] + dy, s.tgt[2]); cam.updateMatrixWorld(); cam.updateProjectionMatrix(); }
function scr(p) { const v = new THREE.Vector3(...p).project(cam); return { x: (v.x * 0.5 + 0.5) * 100, y: (-v.y * 0.5 + 0.5) * 100 }; }
function apparent(box) { // on-screen height fraction of a world AABB at its centre depth
  const c = box.getCenter(new THREE.Vector3()); const h = box.getSize(new THREE.Vector3()).y;
  const top = scr([c.x, c.y + h / 2, c.z]).y, bot = scr([c.x, c.y - h / 2, c.z]).y; return Math.abs(bot - top);
}

// ===== reports =====
console.log(`\n=== COACH CHECK @ aspect ${ASPECT} | book sphere center ${bookBox.getCenter(new THREE.Vector3()).toArray().map((n)=>n.toFixed(2))} ===`);
console.log(`book world size: ${bookBox.getSize(new THREE.Vector3()).toArray().map((n) => n.toFixed(2)).join(' x ')}`);

shot('wide');
const bScr = scr(POS.book), bApp = apparent(bookBox);
const cScr = scr(POS.recoil);
const cAppBook = apparent(placeClaude(POS.recoil, CLAUDE.book, false));
const cAppAfter = apparent(placeClaude(POS.recoil, CLAUDE.after, false));
// vertical EYELINE: compare the on-screen y of the two CENTRES (want them ~equal = aligned heights)
const bookCenterY = scr([POS.book[0], POS.book[1], POS.book[2]]).y;
const claudeCenterY = scr([POS.recoil[0], POS.recoil[1], POS.recoil[2]]).y;
// bubble: world point where its BOTTOM sits = Claude top + gap; want it CLOSE above Claude's head
const claudeTopY = scr([POS.recoil[0], POS.recoil[1] + (LOGO_H / 2) * CLAUDE.after + BUBBLE_GAP, POS.recoil[2]]).y;
console.log(`\n[wide] side-by-side: SIZE relationship + EYELINE alignment + bubble proximity:`);
console.log(`  book   screenH=${bApp.toFixed(1)}%  centre x=${bScr.x.toFixed(0)}% y=${bookCenterY.toFixed(1)}%`);
console.log(`  Claude centre x=${cScr.x.toFixed(0)}% y=${claudeCenterY.toFixed(1)}%   <-- EYELINE Δ vs book = ${(claudeCenterY - bookCenterY).toFixed(1)}% (want ~0)`);
console.log(`  size while scanning  ratio=${(cAppBook / bApp).toFixed(2)} (want <1, slightly smaller)`);
console.log(`  size after the scan ratio=${(cAppAfter / bApp).toFixed(2)} (want a little bigger, ~0.95–1.05)`);
console.log(`  bubble bottom lands at y=${claudeTopY.toFixed(1)}%  (Claude centre y=${claudeCenterY.toFixed(1)}% → gap ${(claudeCenterY - claudeTopY).toFixed(1)}% above head; want small/tight)`);

console.log(`\n[focus] INSPECTION — around the book not inside (gap>0.08), and not looming bigger than it:`);
shot('focus');
const bookAppFocus = apparent(bookBox);
INSPECT_OFF.forEach((o, i) => {
  const p = add(POS.book, o); const box = placeClaude(p, CLAUDE.book, true);
  const g = gap(box, bookBox); const s = scr(p); const ratio = apparent(box) / bookAppFocus;
  console.log(`  angle ${i + 1}  x=${s.x.toFixed(0)}% y=${s.y.toFixed(0)}%  gap=${g >= 0 ? '+' : ''}${g.toFixed(2)}  size/book=${ratio.toFixed(2)}${g <= 0.08 ? '  <-- INSIDE' : ''}${ratio > 1.05 ? '  <-- TOO BIG' : ''}`);
});

console.log(`\n[wide] SUBAGENTS — around the book, not touching (gap>0), and on-screen:`);
shot('wide');
CLONE_OFF.forEach((spots, i) => spots.forEach((o, k) => {
  const p = add(POS.book, o); const box = placeClaude(p, CLONE.scale, true);
  const g = gap(box, bookBox); const s = scr(p);
  const off = (s.x < 3 || s.x > 97) ? ' OFF-X' : '';
  console.log(`  agent ${i + 1}.${k + 1}  x=${s.x.toFixed(0)}% y=${s.y.toFixed(0)}%  gap=${g >= 0 ? '+' : ''}${g.toFixed(2)}${g <= 0.03 ? '  <-- TOUCHING' : ''}${off}`);
}));
console.log('');
