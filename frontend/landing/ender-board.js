// Finale board builder — the basement endgame. Ports buildBoardScene from
// '3D assets/black-chess-basement (3).html', but with two differences from coach-board.js:
//   1. pieces are placed from a FEN (not the default LAYOUT) — we open on Réti–Tartakower
//      after 8.O-O-O, the position right before the blunder.
//   2. every piece stays its OWN THREE.Group (NOT merged), kept in a Map keyed by square,
//      so each one can be glided, glowed and toppled independently during the cinematic.
// Returns { root, pieces, GRID, squareXYZ, tableTopY }. The scene adds `root`.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
// Pieces + board are real URL files (window.PIECES / window.BOARD3D from pieces.js) — the same assets
// the hero already loads and caches. We pull ONLY the piece types this FEN needs, not a 6.8 MB blob.

const FEN_TO_TYPE = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
const FILES = 'abcdefgh';

const _tl = new THREE.TextureLoader();
function makeTex(uri, srgb) {
  if (!uri) return null;
  const t = _tl.load(uri); t.flipY = false; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}
// per-piece materials (each piece owns one, so we can pulse its emissive later)
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

// FEN placement field -> [{ square, type, army }]
function parseFen(fen) {
  const rows = fen.split(' ')[0].split('/');
  const out = [];
  for (let r = 0; r < 8; r++) {
    const rank = 8 - r;            // FEN row 0 is rank 8
    let file = 0;
    for (const ch of rows[r]) {
      if (/\d/.test(ch)) { file += +ch; continue; }
      const army = ch === ch.toUpperCase() ? 'white' : 'black';
      out.push({ square: FILES[file] + rank, type: FEN_TO_TYPE[ch.toLowerCase()], army });
      file++;
    }
  }
  return out;
}

export async function buildEnderBoard(fen, tableTopY = -0.80) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  await MeshoptDecoder.ready;
  const BOARD = window.BOARD3D, A = window.PIECES;       // real URL files (loaded + cached on demand)
  const load = (url) => loader.loadAsync(url);
  const root = new THREE.Group();

  // ---- board (identical orientation/fit logic to the source scene) ----
  const bg = await load(BOARD.glb);
  const boardMat = new THREE.MeshStandardMaterial({
    map: makeTex(BOARD.base, true), roughnessMap: makeTex(BOARD.mr, false),
    roughness: 0, metalness: 0.0, envMapIntensity: 0,
  });
  const bm = bg.scene; bm.traverse((o) => { if (o.isMesh) { o.material = boardMat; o.receiveShadow = true; o.castShadow = true; } });
  let rb = new THREE.Box3().setFromObject(bm); const rs = rb.getSize(new THREE.Vector3());
  bm.position.sub(rb.getCenter(new THREE.Vector3()));
  const board = new THREE.Group(); board.add(bm);
  const thin = (rs.x <= rs.y && rs.x <= rs.z) ? 'x' : (rs.y <= rs.x && rs.y <= rs.z) ? 'y' : 'z';
  if (thin === 'x') board.rotation.z = Math.PI / 2; else if (thin === 'z') board.rotation.x = -Math.PI / 2;
  board.rotation.y += Math.PI / 2;       // files (a–h) face the players
  let fb = new THREE.Box3().setFromObject(board); const fs = fb.getSize(new THREE.Vector3());
  const BOARD_W = 4.2; const foot = Math.max(fs.x, fs.z) || 1;
  board.scale.setScalar(BOARD_W / foot);
  let gb = new THREE.Box3().setFromObject(board); const gc = gb.getCenter(new THREE.Vector3());
  board.position.x -= gc.x; board.position.z -= gc.z - 0.1;
  board.position.y += tableTopY - gb.min.y;   // rest board bottom on the table top
  root.add(board);

  const finalBox = new THREE.Box3().setFromObject(board); const finalSize = finalBox.getSize(new THREE.Vector3());
  const topY = finalBox.max.y;
  const cx = (finalBox.min.x + finalBox.max.x) / 2, cz = (finalBox.min.z + finalBox.max.z) / 2;

  // ---- fit the 8×8 grid to the ACTUAL playing surface (not a guessed 80% of the bounding box) ----
  // The board GLB is one AI-generated mesh: a raised rim/frame around a flat top where the squares are
  // PAINTED. Raycasting straight DOWN onto it recovers the real grid from two facts:
  //   1) HEIGHT — the rim reads higher than the flat squares, so the piece-seat Y is the surface the ray
  //      hits. (Seating at the bbox top, topY, put pieces on the rim "lid" → the hover the eye caught.)
  //   2) EXTENT — scanning across the board, the contiguous span that reads at the flat surface height IS
  //      the playing area; size the grid to that span and centre it there, instead of guessing 0.80.
  board.updateMatrixWorld(true);
  const _ray = new THREE.Raycaster(); const _DOWN = new THREE.Vector3(0, -1, 0); const _surf = new Map();
  const rayY = (x, z) => { _ray.set(new THREE.Vector3(x, topY + 2, z), _DOWN); const h = _ray.intersectObject(board, true)[0]; return h ? h.point.y : null; };
  const surfMid = rayY(cx, cz) ?? topY;                          // the squares' surface height (under the centre)
  const onSurf = (x, z) => { const y = rayY(x, z); return y != null && Math.abs(y - surfMid) < 0.03; };
  const span = (horiz) => {
    let lo = null, hi = null;
    for (let t = -2.6; t <= 2.6; t += 0.02) { if (horiz ? onSurf(cx + t, cz) : onSurf(cx, cz + t)) { if (lo == null) lo = t; hi = t; } }
    return lo == null ? [-finalSize.x * 0.4, finalSize.x * 0.4] : [lo, hi];
  };
  const [xLo, xHi] = span(true), [zLo, zHi] = span(false);
  const INSET = 0.06;                                            // trim a touch so edge pieces don't ride the label border
  const playX = (xHi - xLo) - INSET, playZ = (zHi - zLo) - INSET;
  const fitCx = cx + (xLo + xHi) / 2, fitCz = cz + (zLo + zHi) / 2;
  const stepX = playX / 8, stepZ = playZ / 8;
  const surfaceY = (x, z) => { const k = `${x.toFixed(3)},${z.toFixed(3)}`; if (_surf.has(k)) return _surf.get(k); const y = rayY(x, z); const v = y == null ? surfMid : y; _surf.set(k, v); return v; };
  const GRID = { x0: fitCx - playX / 2 + stepX / 2, z0: fitCz - playZ / 2 + stepZ / 2, stepX, stepZ, y: topY, surfaceY };
  if (import.meta.env && import.meta.env.DEV) console.log('[ender-board] fit playX=', +playX.toFixed(3), 'playZ=', +playZ.toFixed(3), 'centre=', +fitCx.toFixed(3), +fitCz.toFixed(3), 'surfY=', +surfMid.toFixed(3), 'hoverRemoved=', +(topY - surfMid).toFixed(3));

  // square -> world position (centre of the piece base, seated on the real surface — never the rim)
  const squareXYZ = (sq) => {
    const col = FILES.indexOf(sq[0]); const rank = +sq[1];
    const x = GRID.x0 + col * GRID.stepX, z = GRID.z0 + (rank - 1) * GRID.stepZ;
    return new THREE.Vector3(x, surfaceY(x, z) - 0.002, z);
  };

  // ---- piece geometries (one URL load per type present in the FEN, then clone per instance) ----
  const types = [...new Set(parseFen(fen).map((p) => p.type))];
  const GEO = {};
  for (const type of types) {
    const g = await load(A[type].glb);
    const m = g.scene; const bx = new THREE.Box3().setFromObject(m); const c = bx.getCenter(new THREE.Vector3());
    m.position.x -= c.x; m.position.z -= c.z; m.position.y -= bx.min.y; GEO[type] = m;
  }

  const KING_H = 0.85;
  const pieces = new Map();
  for (const slot of parseFen(fen)) {
    const P = A[slot.type];
    const inst = GEO[slot.type].clone(true);
    const mat = slot.army === 'white' ? whiteMat(P) : blackMat(P);
    inst.traverse((o) => { if (o.isMesh) { o.material = mat; o.castShadow = true; o.receiveShadow = true; } });
    const wrap = new THREE.Group(); wrap.add(inst);
    wrap.scale.setScalar(KING_H * P.ratio);
    if (slot.type === 'knight') wrap.rotation.y = slot.army === 'white' ? -Math.PI / 2 : Math.PI / 2;
    wrap.position.copy(squareXYZ(slot.square));
    wrap.userData = { type: slot.type, army: slot.army, square: slot.square, material: mat };
    root.add(wrap);
    pieces.set(slot.square, wrap);
  }

  return { root, pieces, GRID, squareXYZ, tableTopY };
}
