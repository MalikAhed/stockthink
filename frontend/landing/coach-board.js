// Builds the chess board + full starting position as ONE THREE.Group, faithfully ported from
// '3D assets/black-chess-board-only (1).html' (its buildBoardScene): same orientation logic
// (thin axis up, +90° Y so files face the players), same materials, same LAYOUT placement.
// coach.js mounts the returned group into its `board` group and scales/places it as a unit.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LAYOUT } from './board-layout.js';
// Pieces + board are real URL files (window.PIECES / window.BOARD3D from pieces.js) — the same cached
// assets the hero uses, instead of a 6.8 MB base64 blob.

const _tl = new THREE.TextureLoader();
function makeTex(uri, srgb) {
  if (!uri) return null;
  const t = _tl.load(uri); t.flipY = false; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}
function blackMat(P) {
  return new THREE.MeshStandardMaterial({
    map: makeTex(P.base, true), normalMap: makeTex(P.nrm, false),
    roughnessMap: makeTex(P.mr, false), metalnessMap: makeTex(P.mr, false),
    color: new THREE.Color(0.2, 0.2, 0.2), roughness: 1, metalness: 1, envMapIntensity: 1.0,
  });
}
function whiteMat(P) {
  return new THREE.MeshStandardMaterial({
    normalMap: makeTex(P.nrm, false), roughnessMap: makeTex(P.mr, false),
    color: new THREE.Color(0.82, 0.77, 0.66), roughness: 0.3, metalness: 0.05, envMapIntensity: 0.9,
  });
}

export async function buildBoard() {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  await MeshoptDecoder.ready;
  const BOARD = window.BOARD3D, A = window.PIECES;       // real URL files (loaded + cached on demand)
  const load = (url) => loader.loadAsync(url);
  const root = new THREE.Group();

  // ---- board ----
  const bg = await load(BOARD.glb);
  const boardMat = new THREE.MeshStandardMaterial({
    map: makeTex(BOARD.base, true), roughnessMap: makeTex(BOARD.mr, false),
    roughness: 0, metalness: 0.0, envMapIntensity: 0,
  });
  const bm = bg.scene; bm.traverse((o) => { if (o.isMesh) o.material = boardMat; });
  let rb = new THREE.Box3().setFromObject(bm); const rs = rb.getSize(new THREE.Vector3());
  bm.position.sub(rb.getCenter(new THREE.Vector3()));
  const board = new THREE.Group(); board.add(bm);
  // thin axis up -> flat
  const thin = (rs.x <= rs.y && rs.x <= rs.z) ? 'x' : (rs.y <= rs.x && rs.y <= rs.z) ? 'y' : 'z';
  if (thin === 'x') board.rotation.z = Math.PI / 2; else if (thin === 'z') board.rotation.x = -Math.PI / 2;
  board.rotation.y += Math.PI / 2;       // files (a–h) face the players
  let fb = new THREE.Box3().setFromObject(board); const fs = fb.getSize(new THREE.Vector3());
  const BOARD_W = 4.2; const foot = Math.max(fs.x, fs.z) || 1;
  board.scale.setScalar(BOARD_W / foot);
  let gb = new THREE.Box3().setFromObject(board); const gc = gb.getCenter(new THREE.Vector3());
  board.position.x -= gc.x; board.position.z -= gc.z - 0.1;
  board.position.y += 0 - gb.min.y;      // board bottom rests on y=0
  root.add(board);

  const finalBox = new THREE.Box3().setFromObject(board); const finalSize = finalBox.getSize(new THREE.Vector3());
  const topY = finalBox.max.y;
  const cx = (finalBox.min.x + finalBox.max.x) / 2, cz = (finalBox.min.z + finalBox.max.z) / 2;
  const playX = finalSize.x * 0.80, playZ = finalSize.z * 0.80;
  const stepX = playX / 8, stepZ = playZ / 8;
  const GRID = { x0: cx - playX / 2 + stepX / 2, z0: cz - playZ / 2 + stepZ / 2, stepX, stepZ, y: topY };

  // ---- pieces ----
  const GEO = {};
  for (const type of Object.keys(A)) {
    const g = await load(A[type].glb);
    const m = g.scene; const bx = new THREE.Box3().setFromObject(m); const c = bx.getCenter(new THREE.Vector3());
    m.position.x -= c.x; m.position.z -= c.z; m.position.y -= bx.min.y; GEO[type] = m;
  }
  // LIGHTWEIGHT: both armies use ONE material each (pieces carry no per-piece textures), so we bake
  // all 16 white pieces into a single merged geometry and all 16 black into another — 2 draw calls for
  // 32 pieces instead of 32+ meshes. Identical look, a fraction of the per-frame cost.
  const KING_H = 0.85;
  const bucket = { white: [], black: [] };
  for (const slot of LAYOUT) {
    const P = A[slot.type];
    const inst = GEO[slot.type].clone(true);
    const wrap = new THREE.Group(); wrap.add(inst);
    wrap.scale.setScalar(KING_H * P.ratio);
    if (slot.type === 'knight') wrap.rotation.y = slot.army === 'white' ? -Math.PI / 2 : Math.PI / 2;
    wrap.position.set(GRID.x0 + slot.col * GRID.stepX, GRID.y - 0.002, GRID.z0 + (slot.rank - 1) * GRID.stepZ);
    wrap.updateMatrixWorld(true);
    inst.traverse((o) => {
      if (!o.isMesh) return;
      let g = o.geometry.clone().applyMatrix4(o.matrixWorld);
      if (g.index) g = g.toNonIndexed();
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      const ng = new THREE.BufferGeometry();
      ng.setAttribute('position', g.getAttribute('position'));
      ng.setAttribute('normal', g.getAttribute('normal'));
      bucket[slot.army].push(ng);
    });
  }
  for (const army of ['white', 'black']) {
    if (!bucket[army].length) continue;
    const merged = mergeGeometries(bucket[army], false);
    root.add(new THREE.Mesh(merged, army === 'white' ? whiteMat(A.king) : blackMat(A.king)));
  }
  return root;
}
