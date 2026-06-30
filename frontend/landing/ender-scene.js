// Finale scene — "the basement". Faithful port of the set in
// '3D assets/black-chess-basement (3).html': fog, theatre spotlight, a real volumetric
// light cone, a caged Edison pendant, warm light pools, and a wooden table. The board +
// pieces are built by ender-board.js and parented in here.
//
// Embedded base64 floor textures from the source are dropped in favour of the scene's OWN
// procedural concrete (the floor is far + heavily fogged, so it reads identically) — that
// keeps this module asset-free apart from the board/piece GLBs already in the repo.
//
// createEnderScene(canvas) -> { scene, camera, renderer, lookTarget, render, resize, tick,
//   pieces, GRID, squareXYZ, refs }   (refs = tunable handles for the dev panel / later beats)
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildEnderBoard } from './ender-board.js';
import { QUALITY, registerRenderer } from './perf.js';

// Réti–Tartakower, Vienna 1910 — the position right after 8.O-O-O (Black to move, about to blunder).
export const START_FEN = 'rnb1kb1r/pp3ppp/2p2n2/4q3/4N3/3Q4/PPPB1PPP/2KR1BNR b kq - 0 8';
const TABLE_TOP_Y = -0.80;

// ---- procedural textures (canvas — no assets) -----------------------------------
// (the concrete floor + its 16k-iteration texture gen were removed — the floor was a large
//  fillrate cost and the canvas build hitched the scene right at the transition into the finale.)
function woodTex() {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const x = cv.getContext('2d');
  x.fillStyle = '#6e4a26'; x.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 260; i++) {
    x.strokeStyle = `rgba(${50 + Math.random() * 60},${30 + Math.random() * 40},15,${0.1 + Math.random() * 0.25})`;
    x.lineWidth = 0.5 + Math.random() * 1.5; x.beginPath();
    const y = Math.random() * 256; x.moveTo(0, y);
    x.bezierCurveTo(170, y + (Math.random() - 0.5) * 14, 340, y + (Math.random() - 0.5) * 14, 512, y + (Math.random() - 0.5) * 8);
    x.stroke();
  }
  for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(20,12,6,${Math.random() * 0.15})`; x.fillRect(Math.random() * 512, Math.random() * 256, Math.random() * 3, Math.random() * 3); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function radialTex(stops) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const x = cv.getContext('2d'); const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  stops.forEach(([o, c]) => g.addColorStop(o, c)); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(cv);
}

export async function createEnderScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: QUALITY.antialias });
  registerRenderer(renderer);   // perf manager owns the pixel ratio (and can lower it live)
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.76;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x041615);
  scene.fog = new THREE.FogExp2(0x041615, 0.06);

  const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.01, 100);
  const lookTarget = new THREE.Vector3();
  // ---- scroll-driven camera path (the scene owns it so it can be verified in isolation) ----
  // A far, high establishing shot (full lamp + rope + board in frame) DOLLIES IN to a seated
  // White-player POV — slightly above, angled down — White = rank 1 = -Z. Tunables: edit numbers.
  const CAM = {
    far:  { radius: 10.8, height: 3.3, az: -0.42, tgt: [0, 0.55, 0.1] },   // wide: lamp+rope at top, board below
    near: { radius: 5.3,  height: 2.85, az:  0.0,  tgt: [0, -0.98, 0.3] },  // seated white POV, raised for a clearer top-down read of the board
    zCenter: 0.1,                                                           // board centre z (White=-z, Black=+z)
  };
  const _c01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const _sm = (t) => t * t * (3 - 2 * t);
  const _mx = (a, b, e) => a + (b - a) * e;
  function setShot(p) {
    const e = _sm(_c01(p));
    const radius = _mx(CAM.far.radius, CAM.near.radius, e);
    const height = _mx(CAM.far.height, CAM.near.height, e);
    const az = _mx(CAM.far.az, CAM.near.az, e);
    camera.position.set(Math.sin(az) * radius, height, CAM.zCenter - Math.cos(az) * radius);
    lookTarget.set(_mx(CAM.far.tgt[0], CAM.near.tgt[0], e), _mx(CAM.far.tgt[1], CAM.near.tgt[1], e), _mx(CAM.far.tgt[2], CAM.near.tgt[2], e));
  }
  setShot(0);   // open on the establishing shot

  // ---- keyframed cinematic camera (the move phase needs more than a 1-D far→near lerp) ----
  // A list of poses on the master clock t; setCam(t) eases between the bracketing keyframes. The first
  // two keyframes reproduce the intro dolly (far→near) EXACTLY (same numbers as CAM.far/CAM.near over
  // [camStart,camEnd]); the rest choreograph the sacrifice → double-check → mate. Tune the numbers freely.
  const _UP = new THREE.Vector3(0, 1, 0);
  const _easeName = {
    linear: (k) => k,
    smooth: (k) => k * k * (3 - 2 * k),
    smoother: (k) => k * k * k * (k * (k * 6 - 15) + 10),
    out: (k) => 1 - (1 - k) * (1 - k),     // ease-out: fast start, gentle arrive (a "push" that settles)
    in: (k) => k * k,                       // ease-in: gentle start, accelerate away (a "pull")
  };
  // CAM_KEYS is filled in the move block below, once INTRO + the move timeline (absolute times) exist.
  let CAM_KEYS = [];
  function applyPose(radius, height, az, tgt) {
    camera.position.set(Math.sin(az) * radius, height, CAM.zCenter - Math.cos(az) * radius);
    lookTarget.set(tgt[0], tgt[1], tgt[2]);
  }
  function setCam(t) {
    const ks = CAM_KEYS;
    if (t <= ks[0].t) { const k = ks[0]; return applyPose(k.radius, k.height, k.az, k.tgt); }
    const last = ks[ks.length - 1];
    if (t >= last.t) return applyPose(last.radius, last.height, last.az, last.tgt);
    let i = 0; while (i < ks.length - 1 && t > ks[i + 1].t) i++;
    const a = ks[i], b = ks[i + 1];
    const e = (_easeName[b.ease] || _easeName.smooth)((t - a.t) / (b.t - a.t));
    applyPose(_mx(a.radius, b.radius, e), _mx(a.height, b.height, e), _mx(a.az, b.az, e),
      [_mx(a.tgt[0], b.tgt[0], e), _mx(a.tgt[1], b.tgt[1], e), _mx(a.tgt[2], b.tgt[2], e)]);
  }

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0;

  // ---- rim + ambient lights ----
  const coolRim = new THREE.DirectionalLight(0x16ffb4, 1.18); coolRim.position.set(-3, 1.4, -1.0); scene.add(coolRim);
  const cyanRim = new THREE.DirectionalLight(0x1fd9ff, 1.2); cyanRim.position.set(-2.6, -0.4, -1.6); scene.add(cyanRim);
  const warmRim = new THREE.DirectionalLight(0xffb24a, 1.42); warmRim.position.set(3, 0.5, -1.4); scene.add(warmRim);
  const glint = new THREE.DirectionalLight(0xe6fff0, 0.8); glint.position.set(0.5, 4, 2.4); scene.add(glint);
  const fillD = new THREE.DirectionalLight(0x0a160f, 0.35); fillD.position.set(0, 0, 4); scene.add(fillD);
  const amb = new THREE.AmbientLight(0x1a1208, 0.46); scene.add(amb);

  // ---- the set: wooden table (the floor/ground was removed for performance) ----
  const setGroup = new THREE.Group(); scene.add(setGroup);
  const wood = woodTex();
  const tableMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55, metalness: 0.04, color: 0xb89066 });
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.30, 6.0), tableMat);
  tableTop.position.set(0, -0.95, 0.1); tableTop.receiveShadow = true; setGroup.add(tableTop);
  const apron = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.22, 5.5),
    new THREE.MeshStandardMaterial({ map: wood, roughness: 0.7, metalness: 0.03, color: 0x7a5430 }));
  apron.position.set(0, -1.12, 0.1); setGroup.add(apron);
  const legMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.68, metalness: 0.02, color: 0x6b4a28 });
  const legGeo = new THREE.BoxGeometry(0.32, 1.00, 0.32);
  [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.6], [2.5, 2.6]].forEach((p) => {
    const l = new THREE.Mesh(legGeo, legMat); l.position.set(p[0], -1.60, p[1]); setGroup.add(l);
  });
  // the rope/cord: hangs from above (off-frame ceiling) down to the lamp cap (~y3.0) — long
  // enough to read as genuinely suspended, so the full lamp + its rope are visible in the wide shot
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.6, 8),
    new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.75, metalness: 0.2 }));
  cord.position.set(0, 4.25, 0.1); setGroup.add(cord);   // spans y≈2.95 → 5.55

  // ---- the cinematic spotlight + washes ----
  const SPOT_Y = 3.45, SPOT_X = 0, SPOT_Z = 0.1;
  const spot = new THREE.SpotLight(0xfdb153, 44, 23, 0.78, 1, 1.4);
  spot.position.set(SPOT_X, SPOT_Y, SPOT_Z); spot.target.position.set(0, -0.80, 0.1);
  spot.castShadow = true; spot.shadow.mapSize.set(512, 512);
  spot.shadow.camera.near = 0.5; spot.shadow.camera.far = 12; spot.shadow.bias = -0.0005;
  scene.add(spot); scene.add(spot.target);
  const floorBounce = new THREE.PointLight(0x6a4420, 1.1, 9, 1.6); floorBounce.position.set(0, 0.4, 1.6); scene.add(floorBounce);
  const wash = new THREE.SpotLight(0xffbb6a, 28.0, 14, Math.PI / 3.5, 1.0, 1.5);
  wash.position.set(0, 2.2, 0.1); wash.target.position.set(0, -0.80, 0.1); scene.add(wash); scene.add(wash.target);
  const fillPt = new THREE.PointLight(0xffb060, 1.0, 4.5, 2.2); fillPt.position.set(0, 0.1, 0.8); scene.add(fillPt);

  // ---- volumetric light cone (additive fresnel shader) ----
  const beamH = SPOT_Y + 1.4;
  const beamGeo = new THREE.CylinderGeometry(0.05, 1.5, beamH, 48, 12, true);
  beamGeo.translate(0, -beamH / 2, 0);
  const VolMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0xffbb63) }, uExp: { value: 9.0 }, uHeight: { value: beamH }, uBeamScale: { value: 0.1 } },
    vertexShader: `varying vec3 vWorldNormal; varying vec3 vWorldPos; varying float vY;
      void main(){ vWorldNormal = normalize(mat3(modelMatrix)*normal); vec4 wp = modelMatrix*vec4(position,1.0);
        vWorldPos = wp.xyz; vY = position.y; gl_Position = projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uExp; uniform float uHeight; uniform float uBeamScale;
      varying vec3 vWorldNormal; varying vec3 vWorldPos; varying float vY;
      void main(){ vec3 V = normalize(cameraPosition - vWorldPos);
        float edge = pow(1.0 - abs(dot(V, normalize(vWorldNormal))), uExp);
        float t = clamp(-vY/uHeight, 0.0, 1.0);
        float along = smoothstep(0.0,0.30,t)*(1.0 - smoothstep(0.40,0.95,t));
        float a = edge*along*uBeamScale; gl_FragColor = vec4(uColor*a, a); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(beamGeo, VolMat); beam.position.set(SPOT_X, SPOT_Y + 0.05, SPOT_Z); scene.add(beam);

  // ---- warm light pools ----
  const poolTex = () => radialTex([[0, 'rgba(255,225,180,0.7)'], [0.4, 'rgba(235,195,140,0.28)'], [0.75, 'rgba(120,95,65,0.07)'], [1, 'rgba(0,0,0,0)']]);
  // (the floor light-pool was removed with the floor — only the table pool remains)
  const tablePool = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 7.4), new THREE.MeshBasicMaterial({ map: poolTex(), transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false }));
  tablePool.rotation.x = -Math.PI / 2; tablePool.position.set(0, -0.795, 0.1); scene.add(tablePool);

  // ---- caged Edison pendant ----
  const lampY = 2.75; const lampGroup = new THREE.Group(); lampGroup.position.set(0, 0, 0.1); scene.add(lampGroup);
  const metalDark = new THREE.MeshStandardMaterial({ color: 0x20211f, roughness: 0.5, metalness: 0.85 });
  const metalPatina = new THREE.MeshStandardMaterial({ color: 0x2c3a30, roughness: 0.55, metalness: 0.7 });
  const shadeOut = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.34, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0x243029, roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide }));
  shadeOut.position.set(0, lampY, 0); lampGroup.add(shadeOut);
  const shadeIn = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.32, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0xbfae8a, roughness: 0.6, metalness: 0.2, side: THREE.BackSide, emissive: 0x4a3318, emissiveIntensity: 0.5 }));
  shadeIn.position.set(0, lampY, 0); lampGroup.add(shadeIn);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.1, 20), metalDark); cap.position.set(0, lampY + 0.2, 0); lampGroup.add(cap);
  const rimRing = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.02, 10, 48), metalPatina); rimRing.rotation.x = Math.PI / 2; rimRing.position.set(0, lampY - 0.17, 0); lampGroup.add(rimRing);
  const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.14, 16), metalDark); socket.position.set(0, lampY - 0.24, 0); lampGroup.add(socket);
  const cageBottom = lampY - 0.62, cageTop = lampY - 0.30, cageR = 0.16;
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x2a2b28, roughness: 0.45, metalness: 0.9 });
  const NWIRES = 6;
  for (let i = 0; i < NWIRES; i++) {
    const ang = (i / NWIRES) * Math.PI * 2;
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 6), wireMat);
    const midR = cageR * 0.8; wire.position.set(Math.cos(ang) * midR, (cageTop + cageBottom) / 2, Math.sin(ang) * midR);
    wire.rotation.z = Math.cos(ang) * 0.18; wire.rotation.x = -Math.sin(ang) * 0.18; lampGroup.add(wire);
  }
  [cageTop, (cageTop + cageBottom) / 2, cageBottom + 0.02].forEach((yy, idx) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(idx === 2 ? 0.05 : cageR, 0.008, 8, 32), wireMat);
    ring.rotation.x = Math.PI / 2; ring.position.set(0, yy, 0); lampGroup.add(ring);
  });
  const bulbY = lampY - 0.42;
  const bulbGlass = new THREE.Mesh(new THREE.SphereGeometry(0.10, 24, 24), new THREE.MeshStandardMaterial({ color: 0xffb84d, emissive: 0xff9a2e, emissiveIntensity: 5.9, roughness: 0.25, metalness: 0.0, transparent: true, opacity: 0.92 }));
  bulbGlass.scale.set(1, 1.25, 1); bulbGlass.position.set(0, bulbY, 0); lampGroup.add(bulbGlass);
  const filament = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 12), new THREE.MeshBasicMaterial({ color: 0xfff0c0 })); filament.position.set(0, bulbY, 0); lampGroup.add(filament);
  const brass = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.07, 16), new THREE.MeshStandardMaterial({ color: 0x8a6a2c, roughness: 0.4, metalness: 0.85 })); brass.position.set(0, bulbY + 0.12, 0); lampGroup.add(brass);
  const lampHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex([[0, 'rgba(255,200,110,0.95)'], [0.3, 'rgba(255,160,70,0.4)'], [0.6, 'rgba(200,90,40,0.12)'], [1, 'rgba(0,0,0,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  lampHalo.scale.set(1.4, 1.4, 1); lampHalo.position.set(0, bulbY, 0.05); lampGroup.add(lampHalo);

  // ---- the board + the endgame position ----
  const boardData = await buildEnderBoard(START_FEN, TABLE_TOP_Y);
  scene.add(boardData.root);
  renderer.shadowMap.needsUpdate = true;   // pieces cast/receive — refresh the static shadow map once

  // ---- intro timeline: pieces GLIDE in from above-and-to-a-side, leaning slightly left/right, then
  // STRAIGHTEN and set straight down onto the CENTRE of their square — a clean stand, never a hover.
  // One clock `t` (seconds) drives it via frame(t) so the SAME timeline plays live and bakes to video.
  //   · the sideways offset closes EARLY (by latFrac) → for the last stretch the piece is directly over its
  //     square, descending straight down, so it lands centred (not skidding in sideways).
  //   · a small left/right ROLL eases to upright by tiltFrac → the piece is straight before it touches down.
  //   · quintic smoothstep on the vertical → a soft, decelerating landing. The final frame is the EXACT rest
  //     transform — and rest is the raycast SURFACE seat (ender-board.js), so it ends truly ON the board.
  const INTRO = {
    camStart: 0.2, camEnd: 6.4,   // camera dolly (wide → seated White POV) runs ACROSS the arrivals
    flyDur: 1.25,                 // one piece's glide time (longer = smoother)
    rainSpan: 2.6,                // spread of start-delays across the 28 pieces (orchestrated, not one thud)
    fadeFrac: 0.35,               // a piece fades 0→1 over the first part of its flight ("from nowhere")
    latFrac: 0.6,                 // fraction of the glide over which the SIDEWAYS offset closes (then it's overhead)
    tiltFrac: 0.72,               // fraction by which the left/right lean has fully straightened (before touchdown)
    upMin: 2.4, upMax: 3.8,       // how high above its square a piece starts (world units)
    sideMin: 0.8, sideMax: 2.2,   // lateral offset at the start → glide in from the sides, not just straight down
    leanMin: 0.10, leanMax: 0.26, // left/right lean (radians, ≈6–15°); the sign alternates per piece
  };
  const _introEnd = INTRO.rainSpan + INTRO.flyDur + 0.15;
  const _smoother = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * k * (k * (k * 6 - 15) + 10));   // quintic: very soft ends
  const _WORLDZ = new THREE.Vector3(0, 0, 1);   // view-ish axis → a roll about it reads as a left/right lean
  const _rollQ = new THREE.Quaternion();
  const _flyers = [];
  {
    // deterministic per-square hashes → varied but reproducible entry (no Math.random, so the render matches)
    const hsh = (s, salt) => { const x = Math.sin(s.charCodeAt(0) * 12.9898 + s.charCodeAt(1) * 78.233 + salt) * 43758.5453; return x - Math.floor(x); };
    const mix = (a, b, k) => a + (b - a) * k;
    const order = [...boardData.pieces.values()].map((wrap) => ({ wrap, h: hsh(wrap.userData.square, 0) })).sort((a, b) => a.h - b.h);
    order.forEach(({ wrap }, i) => {
      const s = wrap.userData.square;
      const mat = wrap.userData.material;
      if (mat) { mat.transparent = true; mat.opacity = 0; }
      wrap.visible = false;
      const restPos = wrap.position.clone();
      const restQuat = wrap.quaternion.clone();          // preserves the knights' yaw — settle back to THIS, not 0
      const az = hsh(s, 1.7) * Math.PI * 2;              // which side it glides in from
      const side = mix(INTRO.sideMin, INTRO.sideMax, hsh(s, 3.1));
      const up = mix(INTRO.upMin, INTRO.upMax, hsh(s, 5.9));
      const startPos = restPos.clone().add(new THREE.Vector3(Math.cos(az) * side, up, Math.sin(az) * side));
      const lean = mix(INTRO.leanMin, INTRO.leanMax, hsh(s, 7.3)) * (hsh(s, 9.1) < 0.5 ? -1 : 1);   // left OR right
      _flyers.push({ wrap, mat, restPos, restQuat, startPos, lean, delay: INTRO.rainSpan * (i / Math.max(1, order.length - 1)) });
    });
  }
  function setIntro(t) {
    for (const f of _flyers) {
      const lt = (t - f.delay) / INTRO.flyDur;
      if (lt <= 0) { f.wrap.visible = false; continue; }   // not yet entered
      f.wrap.visible = true;
      const latP = _smoother(lt / INTRO.latFrac);          // sideways closes early → vertical, centred touchdown
      const vP = _smoother(lt);                            // soft vertical descent onto the surface
      f.wrap.position.set(
        f.startPos.x + (f.restPos.x - f.startPos.x) * latP,
        f.startPos.y + (f.restPos.y - f.startPos.y) * vP,
        f.startPos.z + (f.restPos.z - f.startPos.z) * latP,
      );
      const roll = f.lean * (1 - _smoother(lt / INTRO.tiltFrac));   // lean → upright before it lands
      _rollQ.setFromAxisAngle(_WORLDZ, roll);
      f.wrap.quaternion.multiplyQuaternions(_rollQ, f.restQuat);
      if (f.mat) f.mat.opacity = lt < INTRO.fadeFrac ? lt / INTRO.fadeFrac : 1;
    }
  }
  // ============================================================================================
  // THE MOVE CINEMATIC — the Réti–Tartakower queen sacrifice plays out (engine-verified line).
  //   8…Nxe4 🔴 · 9.Qd8+ ✨ · 9…Kxd8 · 10.Bg5+ 🟢 (double check) · 10…Kc7 · 11.Bd8# 👑
  // Pure function of the master clock t (frame(t)) so it scrubs deterministically + bakes to video.
  // Tunables: the MOVES table (timing/arc) + CAM_KEYS (camera) — change numbers, not structure.
  // ============================================================================================
  const MOVE_START = 8.2;   // first move begins after the dolly settles (~6.4) + a 1.8s held beat of stillness
  // Low, ceremonial glides (arc kept small) — only the knight hops high. The queen's long slow travel up
  // the ENTIRE d-file is the emotional centre, so it gets the longest beat.
  const MOVES = [
    { at: 8.20,  dur: 1.20, from: 'f6', to: 'e4', cap: true,  arc: 0.55, rating: 'blunder'     }, // 8…Nxe4 — the knight hops highest, grabs the bait
    { at: 11.20, dur: 2.00, from: 'd3', to: 'd8', cap: false, arc: 0.07, rating: 'brilliant'   }, // 9.Qd8+!! — the long, low glide up the whole d-file into the king's lap
    { at: 15.20, dur: 1.20, from: 'e8', to: 'd8', cap: true,  arc: 0.05, rating: null          }, // 9…Kxd8 — forced, played quietly; the queen dies on d8
    { at: 17.60, dur: 1.40, from: 'd2', to: 'g5', cap: false, arc: 0.07, rating: 'doublecheck' }, // 10.Bg5+ — clears d2, unblocks Rd1: DOUBLE check
    { at: 21.20, dur: 1.00, from: 'd8', to: 'c7', cap: false, arc: 0.06, rating: null          }, // 10…Kc7 — the king flees, but the net holds
    { at: 23.20, dur: 1.60, from: 'g5', to: 'd8', cap: false, arc: 0.07, rating: 'mate'        }, // 11.Bd8# — the bishop returns to the queen's grave to mate
  ];
  const MATE_AT = MOVES[5].at + MOVES[5].dur;     // ≈24.8 — the mate lands
  const MATE_HOLD = 2.4;
  const MOVES_END = MATE_AT + MATE_HOLD;          // ≈27.2
  const DURATION = MOVES_END + 3.0;               // + the outro recompose → ≈30.2s total
  const DRAIN_FROM = 13.2;                        // the room starts draining to black from the sacrifice's landing

  // The full camera path — "The Queen's Grave" cut. The establishing key + the intro-dolly settle reproduce
  // the far→near dolly; from t6.4 the camera only ever PUSHES (monotonic tighten toward the mate), with ONE
  // motivated exception: a widen+lift+ORBIT on the discovered double-check (the only az past ±0.06), so the
  // rook's d1→d8 beam is seen obliquely instead of end-on. HOLD beats are duplicated bracketing keyframes
  // (identical pose over a window → the lerp is a no-op → genuinely dead-still). Only 'smooth'/'smoother'
  // eases (zero-velocity joins) — never the single-sided in/out (they break C1 continuity at the joins).
  CAM_KEYS = [
    { t: INTRO.camStart, radius: CAM.far.radius, height: CAM.far.height, az: CAM.far.az, tgt: CAM.far.tgt.slice(), ease: 'smoother' }, // establishing (wide, lamp in frame)
    { t: INTRO.camEnd, radius: 5.20, height: 3.55, az: 0.00, tgt: [0, -0.88, 0.42], ease: 'smoother' },    // settle HIGH + looking down — read the whole board position (the user wants a higher opening)
    { t: 8.20,  radius: 5.20, height: 3.55, az: 0.00,  tgt: [0.00, -0.88, 0.42], ease: 'smooth' },         // HOLD the board read (beat before the blunder)
    { t: 9.40,  radius: 4.05, height: 2.45, az: 0.13,  tgt: [0.14, -0.74, 0.46], ease: 'smoother' },       // 🔴 blunder: the camera DROPS and pushes in toward the centre as the knight grabs the bait
    { t: 10.80, radius: 4.05, height: 2.45, az: 0.13,  tgt: [0.14, -0.74, 0.46], ease: 'smooth' },         // HOLD low on the blunder
    { t: 13.20, radius: 3.30, height: 1.95, az: -0.20, tgt: [-0.16, -0.55, 1.28], ease: 'smoother' },      // ✨ SACRIFICE: a big dramatic LOW push that rides the queen up the whole d-file + orbits behind her
    { t: 15.00, radius: 3.20, height: 1.85, az: -0.22, tgt: [-0.18, -0.54, 1.33], ease: 'smooth' },        // hold the offer — low + intimate, the queen beside the king
    { t: 17.40, radius: 3.45, height: 2.05, az: -0.12, tgt: [-0.20, -0.55, 1.24], ease: 'smooth' },        // accept: stay low + tight on d8 as the king takes; a small reframe
    { t: 19.00, radius: 4.95, height: 3.15, az: 0.36,  tgt: [0.04, -0.50, 0.74], ease: 'smoother' },       // 🟢 DOUBLE-CHECK: the BIG move — a sweeping orbit (az −0.12→+0.36) that lifts up + around so both attack lines bloom
    { t: 21.00, radius: 4.95, height: 3.15, az: 0.36,  tgt: [0.04, -0.50, 0.74], ease: 'smooth' },         // HOLD the wedge of the double check
    { t: 22.20, radius: 3.75, height: 2.30, az: 0.00,  tgt: [-0.34, -0.60, 1.06], ease: 'smooth' },        // flight: swing back through centre + tighten, chasing the fleeing king
    { t: 24.80, radius: 3.10, height: 1.75, az: -0.15, tgt: [-0.30, -0.52, 1.16], ease: 'smoother' },      // 👑 MATE: a dramatic LOW, CLOSE push onto the kill (king c7 · bishop on the queen's grave d8)
    { t: MOVES_END, radius: 3.10, height: 1.75, az: -0.15, tgt: [-0.30, -0.52, 1.16], ease: 'smooth' },    // HOLD the kill as the king topples + the room drains
    { t: DURATION, radius: 6.40, height: 3.60, az: -0.30, tgt: [-0.05, -0.30, 0.60], ease: 'smoother' },   // outro: a slow crane up + orbit out under the bulb
  ];

  // resolve each move to concrete piece Groups + world endpoints by simulating the (fixed) sequence
  const _bySq = new Map(boardData.pieces);
  for (const m of MOVES) {
    m.mover = _bySq.get(m.from) || null;
    m.cap_g = m.cap ? (_bySq.get(m.to) || null) : null;
    m.fromXYZ = boardData.squareXYZ(m.from);
    m.toXYZ = boardData.squareXYZ(m.to);
    m.restQuat = m.mover ? m.mover.quaternion.clone() : new THREE.Quaternion();
    if (m.cap_g) {
      m.capRestQuat = m.cap_g.quaternion.clone();
      m.capMat = m.cap_g.userData.material || null;
      const inc = m.toXYZ.clone().sub(m.fromXYZ); inc.y = 0; inc.normalize();
      m.toppleAxis = _UP.clone().cross(inc).normalize();   // horizontal axis ⟂ the incoming capture → falls away
    }
    _bySq.delete(m.from); _bySq.set(m.to, m.mover);
  }
  const _theKing = MOVES[2].mover;   // black king (mover of Kxd8) — used by the resign-topple + the spotlight hunt

  const _clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const _q5 = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * k * (k * (k * 6 - 15) + 10));   // quintic ease-in-out
  const _toppleQ = new THREE.Quaternion();
  const _toppleDir = new THREE.Vector3();
  function toppleCaptured(m, k) {
    const g = m.cap_g; if (!g) return;
    if (k <= 0.0001) { g.visible = true; if (m.capMat) m.capMat.opacity = 1; g.quaternion.copy(m.capRestQuat); g.position.copy(m.toXYZ); return; }
    const f = _q5(_clamp(k));
    g.visible = f < 0.995;
    // a hard knock: tip well past 90° onto its side (was a timid ~85°)
    _toppleQ.setFromAxisAngle(m.toppleAxis, f * 2.05);
    g.quaternion.multiplyQuaternions(_toppleQ, m.capRestQuat);
    // knocked AWAY from the incoming piece (slide along the strike direction) + an impact hop that settles
    _toppleDir.copy(m.toXYZ).sub(m.fromXYZ); _toppleDir.y = 0;
    if (_toppleDir.lengthSq() > 1e-6) _toppleDir.normalize();
    const hop = Math.sin(_clamp(k * 2.4) * Math.PI) * 0.085;           // pop up on the strike, then settle
    g.position.copy(m.toXYZ).addScaledVector(_toppleDir, 0.22 * f);
    g.position.y = m.toXYZ.y - 0.02 * f + hop;
    // a sharp white strike-flash at the moment of impact, then fade out faster than it falls
    if (m.capMat) { m.capMat.transparent = true; m.capMat.opacity = 1 - _clamp((k - 0.12) / 0.55); }
    pulse(g, 0xffffff, Math.exp(-Math.pow(k / 0.11, 2)) * 0.9);
  }
  function setMoves(t) {
    for (const m of MOVES) {
      if (!m.mover) continue;
      if (t < m.at) {
        // Before this move plays, DON'T position the mover. setIntro already holds every piece at its build
        // square, and any EARLIER move of the same piece holds it at that move's destination (the rest
        // between moves). Pinning it to m.fromXYZ here teleported a piece that moves twice (the king:
        // Kxd8→Kc7, the bishop: Bg5+→Bd8#) to its LATER move's start square (d8, g5) from the very start —
        // the bug where the king sat on d8 and the bishop on g5, and pieces looked like they moved together.
        // Likewise don't touch m.cap_g: the captured piece is owned by setIntro / its own earlier move until
        // the instant this move captures it. Strict one-move-at-a-time: a move only acts within its window.
        continue;
      } else if (t <= m.at + m.dur) {
        const p = _q5((t - m.at) / m.dur);
        m.mover.position.lerpVectors(m.fromXYZ, m.toXYZ, p);
        m.mover.position.y += m.arc * Math.sin(Math.PI * p);   // a gentle lift-and-set (knights hop highest)
        m.mover.quaternion.copy(m.restQuat);
        if (m.cap_g) toppleCaptured(m, _clamp((p - 0.5) / 0.5));   // captured topples over the second half
      } else {
        m.mover.position.copy(m.toXYZ); m.mover.quaternion.copy(m.restQuat);
        if (m.cap_g) toppleCaptured(m, 1);
      }
    }
    // the resign: after the mate holds, the black king slowly bows over (knocked-king finish)
    if (_theKing) {
      const rs = _clamp((t - (MATE_AT + 0.7)) / 1.6);
      if (rs > 0) {
        _toppleQ.setFromAxisAngle(_UP.clone().cross(new THREE.Vector3(0, 0, -1)).normalize(), _q5(rs) * 1.4);
        const c7 = boardData.squareXYZ('c7');
        _theKing.quaternion.multiplyQuaternions(_toppleQ, MOVES[2].restQuat);
        _theKing.position.copy(c7); _theKing.position.y = c7.y - 0.01 * _q5(rs);
      }
    }
  }

  // ---- double-check / mate "attack-line" beams: thin additive light cords from a checker to the king ----
  function makeBeam(color) {
    const geo = new THREE.CylinderGeometry(0.014, 0.014, 1, 8, 1, true); geo.translate(0, 0.5, 0);   // base at origin, +Y
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat); mesh.visible = false; scene.add(mesh); return mesh;
  }
  const rookBeam = makeBeam(0xbfe9e6);    // the discovered rook's line up the d-file (cool white-teal — premium, not neon)
  const bishopBeam = makeBeam(0xffd56b);  // the bishop's diagonal (warm gold — the hero's line)
  const _bv = new THREE.Vector3();
  const BEAM_Y = 0.10;                     // skim just above the pieces' bases

  // ---- a real (bakeable) vignette: a camera-child plane, radial transparent→black, drawn last ----
  // It darkens the FRAME edges to gather the eye into the still-bright spotlight pool as the room drains.
  // Lives in the GL render (not an HTML overlay) so it bakes to the offline clip identically.
  function vignetteTex() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const x = cv.getContext('2d');
    const g = x.createRadialGradient(128, 128, 70, 128, 128, 182);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.55, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(cv); return t;
  }
  const VIGN_DIST = 0.5, VIGN_MAX = 0.62;
  const vignette = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: vignetteTex(), transparent: true, opacity: 0, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
  vignette.position.set(0, 0, -VIGN_DIST); vignette.renderOrder = 999; vignette.frustumCulled = false;
  camera.add(vignette); scene.add(camera);   // camera in the graph so its child (the vignette) renders

  // ============================================================================================
  // RATING EFFECTS — per rated move: the moved piece GLOWS + pulses on landing, a rating BADGE pops
  // on its square, and the whole room takes on a rating-coloured GLOW (red blunder · gold brilliant ·
  // green double-check · gold mate). All a pure function of t (bakes with the clip).
  // ============================================================================================
  const _B = (import.meta.env && import.meta.env.BASE_URL) || '/';
  function iconTexture(file) {                 // a /badges SVG → a sprite texture (async; pops in once loaded)
    const tex = new THREE.Texture(); tex.colorSpace = THREE.SRGBColorSpace;
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const cx = cv.getContext('2d'); cx.drawImage(img, 6, 6, 116, 116); tex.image = cv; tex.needsUpdate = true; };
    img.onerror = () => {}; img.src = `${_B}badges/${file}`;
    return tex;
  }
  function crownTexture() {                    // mate badge (no SVG exists): a gold disc + a dark crown
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
    x.beginPath(); x.arc(64, 64, 60, 0, Math.PI * 2); x.fillStyle = '#f5c451'; x.fill();
    x.fillStyle = '#3a2c08'; x.beginPath();
    x.moveTo(28, 88); x.lineTo(33, 48); x.lineTo(50, 70); x.lineTo(64, 40); x.lineTo(78, 70); x.lineTo(95, 48); x.lineTo(100, 88); x.closePath(); x.fill();
    x.fillRect(28, 90, 72, 9);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function edgeGlowTex() {                      // transparent centre → white edges (for an additive coloured screen glow)
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d');
    const g = x.createRadialGradient(128, 128, 30, 128, 128, 150);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(cv);
  }
  // rating → colour · how strong the room-glow is · how strong the piece-pulse is · which badge icon
  const RATING_FX = {
    blunder:     { color: 0xff3b3b, glow: 0.42, pulse: 0.85, tex: () => iconTexture('blunder.svg') },
    brilliant:   { color: 0x2ad6c4, glow: 0.85, pulse: 1.15, tex: () => iconTexture('brilliant.svg') }, // teal ‼ — the page's brilliant colour
    doublecheck: { color: 0x66d24a, glow: 0.60, pulse: 0.95, tex: () => iconTexture('great.svg') },
    mate:        { color: 0xffe08a, glow: 0.95, pulse: 1.20, tex: () => crownTexture() },
  };
  // the room-glow plane (additive, coloured, camera-child) — same framing as the vignette
  const ratingGlow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: edgeGlowTex(), transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  ratingGlow.position.set(0, 0, -VIGN_DIST * 0.985); ratingGlow.renderOrder = 998; ratingGlow.frustumCulled = false;
  camera.add(ratingGlow);
  // one badge sprite per rated move, parked above its destination square (faces the camera, drawn over pieces)
  const _ratedFx = MOVES.filter((m) => m.rating).map((m) => {
    const mat = new THREE.SpriteMaterial({ map: RATING_FX[m.rating].tex(), transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(mat); sprite.renderOrder = 999; sprite.visible = false;
    const pos = boardData.squareXYZ(m.to).clone(); pos.y += 0.66;     // float above the piece on its square
    sprite.position.copy(pos); scene.add(sprite);
    return { m, sprite, landT: m.at + m.dur, fx: RATING_FX[m.rating], last: m.rating === 'mate' };
  });
  // landing envelope: 0 → quick GLOW-up → a single PULSE bump → fade (the piece "glows and pulses once then fades")
  function _landEnv(t, landT, span = 1.6) {
    const k = (t - landT) / span;
    if (k <= 0 || k >= 1) return 0;
    const rise = Math.min(1, k / 0.10);
    const fade = 1 - _clamp((k - 0.5) / 0.5);
    const bump = Math.exp(-Math.pow((k - 0.30) / 0.085, 2));        // one sharp pulse just after the glow-up
    return _clamp((rise * 0.55 + bump * 0.75) * fade, 0, 1.3);
  }

  function sizeVignette() {
    const h = 2 * Math.tan((camera.fov * Math.PI / 180) / 2) * VIGN_DIST;
    vignette.scale.set(h * camera.aspect, h, 1);   // exactly fill the view at VIGN_DIST (elliptical follows the frame)
    ratingGlow.scale.copy(vignette.scale);
  }
  sizeVignette();   // size once now (fov is fixed; only aspect changes → re-sized in resize(), not per-frame)
  function aimBeam(beam, fromSq, toSq, opacity) {
    if (opacity <= 0.001) { beam.visible = false; return; }
    const a = boardData.squareXYZ(fromSq).clone(); a.y += BEAM_Y;
    const b = boardData.squareXYZ(toSq).clone(); b.y += BEAM_Y;
    _bv.subVectors(b, a); const len = _bv.length();
    beam.position.copy(a); beam.scale.set(1, len, 1);
    beam.quaternion.setFromUnitVectors(_UP, _bv.normalize());
    beam.material.opacity = opacity; beam.visible = true;
  }

  // emissive pulse helper (golden flare on the sacrifice, etc.) — restores cleanly when k→0
  function pulse(g, color, k) {
    if (!g || !g.userData.material) return;
    const mat = g.userData.material;
    if (!mat.userData) mat.userData = {};
    if (mat.userData._baseEmissive === undefined) { mat.userData._baseEmissive = mat.emissive.getHex(); mat.userData._baseEI = mat.emissiveIntensity || 0; }
    if (k <= 0.001) { mat.emissive.setHex(mat.userData._baseEmissive); mat.emissiveIntensity = mat.userData._baseEI; return; }
    mat.emissive.setHex(color); mat.emissiveIntensity = mat.userData._baseEI + k;
  }

  // baselines captured once, so every effect is a clean lerp away from the built state (and restores for t<drain)
  const _spotBaseAngle = spot.angle, _spotBaseInt = spot.intensity, _spotBaseTgt = spot.target.position.clone();
  const _ambBase = amb.intensity, _expBase = renderer.toneMappingExposure, _fogBase = scene.fog.density;
  const _triWave = (t, a, b) => { const k = _clamp((t - a) / (b - a)); return Math.sin(Math.PI * k); };   // 0→1→0 over [a,b]
  const _kpos = new THREE.Vector3();
  function setEffects(t) {
    // ---- RATING EFFECTS: per rated move, the moved piece GLOWS + pulses once on landing, its on-square
    // BADGE pops, and the room takes the rating colour. Only one rated move is landing-active at a time. ----
    let glowColor = 0xffffff, glowAmt = 0;
    for (const r of _ratedFx) {
      const env = _landEnv(t, r.landT);
      pulse(r.m.mover, r.fx.color, env * r.fx.pulse);             // the moved piece glows + pulses once then fades
      const k = t - r.landT;                                      // the on-square badge: pop in, hold, fade (mate lingers)
      let bo = 0, bs = 0.5;
      if (k > -0.05) {
        const pop = _clamp(k / 0.22), out = r.last ? 0 : _clamp((k - 1.15) / 0.6);
        bo = pop * (1 - out);
        bs = 0.46 * (0.72 + 0.40 * Math.min(1, k / 0.16));        // a little overshoot as it pops on
      }
      r.sprite.material.opacity = bo; r.sprite.visible = bo > 0.01; r.sprite.scale.set(bs, bs, 1);
      if (env * r.fx.glow > glowAmt) { glowAmt = env * r.fx.glow; glowColor = r.fx.color; }
    }
    ratingGlow.material.color.setHex(glowColor);
    ratingGlow.material.opacity = glowAmt;

    // attack-line beams. Double-check: BOTH lines bloom converging on d8 (the only honest way to show it);
    // they fade as the king flees, then on the mate the BISHOP's killing line d8→c7 re-lights PRIMARY while
    // the rook's d-file glows SECONDARY (it only guards d8 in this branch — the bishop mates). Embered by the outro.
    const dc = MOVES[3], landDC = dc.at + dc.dur, flee = MOVES[4].at, mate = MOVES[5], landMate = mate.at + mate.dur;
    let rookO = 0, bishO = 0, bFrom = 'g5', bTo = 'd8', rTo = 'd8';
    if (t >= landDC - 0.2 && t < flee + 0.6) {                 // the discovered double check: two lines onto d8
      const up = _clamp((t - (landDC - 0.2)) / 0.45), down = _clamp((t - flee) / 0.6);
      const k = up * (1 - down); rookO = k; bishO = k; bFrom = 'g5'; bTo = 'd8'; rTo = 'd8';
    }
    if (t >= landMate - 0.15) {                                // the mate: bishop d8→c7 decisive, rook d-file guards
      const up = _clamp((t - (landMate - 0.15)) / 0.5);
      const ember = _clamp((t - (DURATION - 2.6)) / 2.6);      // fade to ember over the outro → fully gone for the reduced-motion still
      const k = up * (1 - ember);
      bishO = Math.max(bishO, k); bFrom = 'd8'; bTo = 'c7';
      rookO = Math.max(rookO, k * 0.55); rTo = 'd8';
    }
    aimBeam(rookBeam, 'd1', rTo, rookO * 0.85);
    aimBeam(bishopBeam, bFrom, bTo, bishO);

    // the room DRAINS to black from the sacrifice onward — ambient/exposure/fog/vignette gather darkness at
    // the edges — while the SPOTLIGHT tightens and continuously HUNTS the king's live position, so he stays
    // lit as everything else falls away (chiaroscuro: the light is the cage). Continuous (not a square-snap).
    const drain = _q5(_clamp((t - DRAIN_FROM) / (MATE_AT - DRAIN_FROM)));
    amb.intensity = _mx(_ambBase, 0.34, drain);
    renderer.toneMappingExposure = _mx(_expBase, 0.70, drain);
    scene.fog.density = _mx(_fogBase, 0.085, drain);
    vignette.material.opacity = drain * VIGN_MAX;
    spot.angle = _mx(_spotBaseAngle, _spotBaseAngle * 0.74, drain);
    spot.intensity = _mx(_spotBaseInt, _spotBaseInt * 1.18, drain);
    if (_theKing) {
      _theKing.getWorldPosition(_kpos);
      spot.target.position.set(_mx(_spotBaseTgt.x, _kpos.x, drain), _spotBaseTgt.y, _mx(_spotBaseTgt.z, _kpos.z, drain));
      spot.target.updateMatrixWorld();
    }
  }

  // ---- rating lower-third (the page's move-rating language): a PURE function of t the DOM layer reads ----
  // Kept as live HTML (ender.js) so the captions stay editable without re-rendering the clip — only the
  // heavy WebGL bakes to video. One badge per RATED move; the forced replies (Kxd8, Kc7) get none.
  const BADGES = [
    { rating: 'blunder',     label: 'Blunder',      move: 'Nxe4', icon: 'blunder.svg',   inAt: 9.20,  outAt: 11.00 },
    { rating: 'brilliant',   label: 'Brilliant',    move: 'Qd8+', icon: 'brilliant.svg', inAt: 13.00, outAt: 15.10 },
    { rating: 'doublecheck', label: 'Double check', move: 'Bg5+', icon: 'great.svg',     inAt: 18.90, outAt: 21.30 },
    { rating: 'mate',        label: 'Checkmate',    move: 'Bd8#', icon: null,             inAt: 24.70, outAt: 9999 }, // lingers: the final word (and the reduced-motion still)
  ];
  function badgeAt(t) {
    for (const b of BADGES) {
      if (t < b.inAt - 0.05 || t > b.outAt) continue;
      const fin = _clamp((t - b.inAt) / 0.45);
      const fout = _clamp((t - (b.outAt - 0.5)) / 0.5);
      const opacity = fin * (1 - fout);
      if (opacity > 0.01) return { rating: b.rating, label: b.label, move: b.move, icon: b.icon, opacity: +opacity.toFixed(3) };
    }
    return null;
  }

  // ---- live eval bar: REAL Stockfish 18 evaluations (depth 24) at each position, keyed to move landings ----
  // White's perspective. The position already favours White (+1.3); the blunder Nxe4 SLAMS it to a forced
  // mate. Pure function of t so the bar bakes with the clip. (Pre-computed real SF evals — not made up.)
  const EVAL_KEYS = [
    { t: 0,                          cp: 131, mate: 0, label: '+1.3' },                 // start (after 8.O-O-O): White clearly better
    { t: MOVES[0].at + MOVES[0].dur, cp: null, mate: 3, label: 'M3' },                 // after 8…Nxe4 — blunder → White mates in 3
    { t: MOVES[1].at + MOVES[1].dur, cp: null, mate: 2, label: 'M2' },                 // after 9.Qd8+
    { t: MOVES[2].at + MOVES[2].dur, cp: null, mate: 2, label: 'M2' },                 // after 9…Kxd8
    { t: MOVES[3].at + MOVES[3].dur, cp: null, mate: 1, label: 'M1' },                 // after 10.Bg5+
    { t: MOVES[4].at + MOVES[4].dur, cp: null, mate: 1, label: 'M1' },                 // after 10…Kc7
    { t: MOVES[5].at + MOVES[5].dur, cp: null, mate: 0, label: '#', checkmate: true }, // after 11.Bd8# — checkmate
  ];
  const _fillOf = (k) => (k.mate > 0 || k.checkmate) ? 1 : 0.5 + 0.5 * Math.tanh((k.cp || 0) / 350);
  function evalAt(t) {
    let i = 0; while (i < EVAL_KEYS.length - 1 && t >= EVAL_KEYS[i + 1].t) i++;
    const cur = EVAL_KEYS[i];
    let fill = _fillOf(cur);
    const TRANS = i === 1 ? 0.35 : 0.5;                 // the blunder slam is snappier than the rest
    if (i > 0) fill = _mx(_fillOf(EVAL_KEYS[i - 1]), _fillOf(cur), _q5(_clamp((t - cur.t) / TRANS)));
    return { fill, label: cur.label, mate: cur.mate > 0 || !!cur.checkmate };
  }

  // frame(t): the master cinematic clock. setShot stays exported for the offline render stage.
  function frame(t) {
    setCam(t);
    setIntro(t);                          // lands + reveals every piece at its rest (cheap; idempotent for large t)
    if (t >= MOVE_START) setMoves(t);     // override the movers with the combination
    setEffects(t);
    if (t <= MOVES_END + 0.2) renderer.shadowMap.needsUpdate = true;   // shadows track the rain + the moves, then freeze
  }

  // ---- public api ----
  function render() { camera.lookAt(lookTarget); camera.updateMatrixWorld(); renderer.render(scene, camera); }
  function resize() {
    const w = innerWidth, h = innerHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
    sizeVignette();   // aspect changed → re-fit the camera-child vignette to the new frame
  }
  // gentle rim drift so the metal/marble never sits dead-still
  let _t = 0;
  function tick() {
    _t += 0.0044;
    coolRim.position.x = -3 * Math.cos(_t) - 0.4; coolRim.position.z = -1.0 - Math.sin(_t) * 0.6;
    cyanRim.position.x = -2.6 * Math.cos(_t + 0.5) - 0.3; cyanRim.position.z = -1.6 - Math.sin(_t + 0.5) * 0.5;
    warmRim.position.x = 3 * Math.cos(_t + 1.2) + 0.4; warmRim.position.z = -1.4 + Math.sin(_t) * 0.5;
  }

  return {
    scene, camera, renderer, lookTarget, render, resize, tick, setShot, frame, badgeAt, evalAt, duration: DURATION,
    pieces: boardData.pieces, GRID: boardData.GRID, squareXYZ: boardData.squareXYZ,
    refs: { spot, wash, beam, VolMat, fog: scene.fog, bulbGlass, amb, coolRim, cyanRim, warmRim, lampGroup, boardRoot: boardData.root, rookBeam, bishopBeam },
  };
}
