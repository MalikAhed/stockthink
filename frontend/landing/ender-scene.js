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
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: QUALITY.antialias, alpha: true, powerPreference: 'high-performance' });
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
  cord.position.set(0, 4.25, 0);   // spans y≈2.95 → 5.55 · parented to the LAMP group below so cord+lamp assemble as ONE part

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
  lampGroup.add(cord);
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
    // the two kings don't rain in with everyone else — they get their own straight-down entrance below
    const order = [...boardData.pieces.values()].filter((wrap) => wrap.userData.type !== 'king').map((wrap) => ({ wrap, h: hsh(wrap.userData.square, 0) })).sort((a, b) => a.h - b.h);
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

  // ---- the two kings: they DON'T rain in with everyone else. Once the other 26 pieces are down, each
  // king enters via a FADE — the screen fades to black, the (dead-still) camera CUTS to a close shot of the
  // king's square while hidden, then fades back in as the king DROPS straight down and lands. The camera
  // NEVER travels: it just holds and the look-target tracks the fall. Black king, then White, then a fade
  // back to the board read for the blunder. Tunables below — change numbers, not structure. ----
  const KING = { pause: 0.15, fade: 0.22, black: 0.05, fly: 0.6, hold: 0.9, up: 3.0 };
  const FO_A_S = _introEnd + KING.pause;               // fade A → the black king: start fading out once the field has landed
  const FO_A_E = FO_A_S + KING.fade;                   // full black — the still camera CUTS to the black-king shot here
  const BLACK_KING_AT = FO_A_E + KING.black;           // king begins its drop; the screen fades back in ON it
  const FI_A_E = BLACK_KING_AT + KING.fade;
  const BLACK_KING_LANDS = BLACK_KING_AT + KING.fly;
  const FO_B_S = BLACK_KING_LANDS + KING.hold;         // fade B → the white king: hold on the landed black king, then fade out
  const FO_B_E = FO_B_S + KING.fade;                   // full black — CUT to the white-king shot
  const WHITE_KING_AT = FO_B_E + KING.black;
  const FI_B_E = WHITE_KING_AT + KING.fade;
  const WHITE_KING_LANDS = WHITE_KING_AT + KING.fly;
  const FO_C_S = WHITE_KING_LANDS + KING.hold;         // fade C → back to the board read for the blunder
  const FO_C_E = FO_C_S + KING.fade;                   // full black — CUT back to the read pose
  const FI_C_S = FO_C_E + KING.black;
  const KING_CAM_END = FI_C_S + KING.fade;             // fully revealed on the read → hand the camera back to the keyframed path
  const KING_SQ = { black: 'e8', white: 'c1' };
  const _kingRig = ['black', 'white'].map((army) => {
    const sq = KING_SQ[army];
    const wrap = boardData.pieces.get(sq);
    const mat = wrap.userData.material;
    const restPos = wrap.position.clone();
    const restQuat = wrap.quaternion.clone();
    const startPos = restPos.clone().add(new THREE.Vector3(0, KING.up, 0));   // straight overhead — no lean, no drift
    wrap.visible = false; if (mat) { mat.transparent = true; mat.opacity = 0; }
    return { wrap, mat, restPos, restQuat, startPos, at: army === 'black' ? BLACK_KING_AT : WHITE_KING_AT };
  });
  function setKing(t) {
    for (const k of _kingRig) {
      const lt = (t - k.at) / KING.fly;
      if (lt <= 0) { k.wrap.visible = false; continue; }
      k.wrap.visible = true;
      const vP = _smoother(Math.min(lt, 1));
      k.wrap.position.lerpVectors(k.startPos, k.restPos, vP);   // straight down onto the centre of its square
      k.wrap.quaternion.copy(k.restQuat);
      if (k.mat) k.mat.opacity = Math.min(1, lt / 0.3);
    }
  }
  // ---- the king-entrance camera: DEAD STILL for the whole beat. It never travels to a king — the fade
  // hides an instant CUT to a close, slightly-raised shot of the king's square, and the camera simply holds
  // there while the look-target tracks the king down. Poses are explicit eye+target WORLD points (not the
  // board orbit) so "close to THIS king" is literal. The read endpoints match CAM_KEYS → seamless hand-off. ----
  const READ_POSE = { radius: 5.20, height: 3.55, az: 0.00, tgt: [0, -0.88, 0.42] };   // "read the whole board" pose (shared with CAM_KEYS)
  const _readEye = [Math.sin(READ_POSE.az) * READ_POSE.radius, READ_POSE.height, CAM.zCenter - Math.cos(READ_POSE.az) * READ_POSE.radius];
  const KCAM = { back: 2.6, eyeY: 0.3, look: 0.25 };   // distance behind the king (farther ⇒ king framed fully) · camera height (low, lifted slightly) · look-at height on the king
  const _bR = _kingRig[0].restPos, _wR = _kingRig[1].restPos;
  const _blackEye = [_bR.x, KCAM.eyeY, _bR.z + KCAM.back];        // close, low, behind e8 (far side)
  const _whiteEye = [_wR.x, KCAM.eyeY, _wR.z - KCAM.back];        // close, low, behind c1 (near side)
  const _blackRestTgt = [_bR.x, _bR.y + KCAM.look, _bR.z];        // look at the king's body (holds here once landed)
  const _whiteRestTgt = [_wR.x, _wR.y + KCAM.look, _wR.z];
  // owns the camera across the king beat; the fade veil (cutFadeAt) hides the cuts between these static holds
  function setKingCam(t) {
    if (t < _introEnd || t > KING_CAM_END) return false;
    let eye, tgt;
    if (t < FO_A_E)      { eye = _readEye;  tgt = READ_POSE.tgt; }   // still on the read (fading out)
    else if (t < FO_B_E) { eye = _blackEye; tgt = _blackRestTgt; }   // the black-king shot
    else if (t < FO_C_E) { eye = _whiteEye; tgt = _whiteRestTgt; }   // the white-king shot
    else                 { eye = _readEye;  tgt = READ_POSE.tgt; }   // back on the read (fading in for the blunder)
    camera.position.set(eye[0], eye[1], eye[2]);
    // the camera stays put; only the look-target follows the falling king down
    if (t >= BLACK_KING_AT && t <= BLACK_KING_LANDS + 0.1) { const k = _kingRig[0].wrap.position; lookTarget.set(k.x, k.y + KCAM.look, k.z); }
    else if (t >= WHITE_KING_AT && t <= WHITE_KING_LANDS + 0.1) { const k = _kingRig[1].wrap.position; lookTarget.set(k.x, k.y + KCAM.look, k.z); }
    else lookTarget.set(tgt[0], tgt[1], tgt[2]);
    return true;
  }
  // the fade-to-black veil the DOM layer reads (pure function of t): fade out → hold black (the cut) → fade in
  function _fadePulse(t, foS, foE, fiS, fiE) {
    if (t < foS || t > fiE) return 0;
    if (t < foE) return _q5(_clamp((t - foS) / (foE - foS)));    // fade to black
    if (t < fiS) return 1;                                       // full black — the camera cuts here
    return 1 - _q5(_clamp((t - fiS) / (fiE - fiS)));             // fade back in
  }
  function cutFadeAt(t) {
    return Math.max(
      _fadePulse(t, FO_A_S, FO_A_E, BLACK_KING_AT, FI_A_E),
      _fadePulse(t, FO_B_S, FO_B_E, WHITE_KING_AT, FI_B_E),
      _fadePulse(t, FO_C_S, FO_C_E, FI_C_S,        KING_CAM_END),
      _fadePulse(t, FADE_OUT, FADE_BLACK, FADE_IN, FADE_DONE),   // the death ending: fade to black over the fallen king, reveal the top-down
      _fadePulse(t, F2_OUT, F2_BLACK, F2_IN, F2_DONE),           // the detonation: fade black over the shaking king, CUT to the piece-level POV
    );
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
    { at: 15.20, dur: 1.20, from: 'e8', to: 'd8', cap: true,  arc: 0.05, rating: 'forced'       }, // 9…Kxd8 — the king is FORCED to take the queen out of check; she dies on d8
    { at: 17.60, dur: 1.40, from: 'd2', to: 'g5', cap: false, arc: 0.07, rating: 'doublecheck' }, // 10.Bg5+ — clears d2, unblocks Rd1: DOUBLE check
    { at: 21.20, dur: 1.00, from: 'd8', to: 'c7', cap: false, arc: 0.06, rating: 'forced'       }, // 10…Kc7 — also FORCED: the king flees the double check (badge only, no glow)
    { at: 23.20, dur: 1.60, from: 'g5', to: 'd8', cap: false, arc: 0.07, rating: 'mate'        }, // 11.Bd8# — the bishop returns to the queen's grave to mate
  ];
  const MATE_AT = MOVES[5].at + MOVES[5].dur;     // ≈24.8 — the mate lands
  // ---- THE DRAMATIC DEATH SEQUENCE (all absolute; the ending camera, the topple + the kill-beam key off these) ----
  const BUILD_AT  = MATE_AT + 0.35;   // ≈25.15 — the tense close ORBIT around the king + bishop begins (brief beat on the mate first)
  const SHOOT_AT  = MATE_AT + 3.2;    // ≈28.0 — the bishop SHOOTS a beam from the top of its head at the king
  const HIT_AT    = MATE_AT + 3.6;    // ≈28.4 — the beam reaches the king
  const WOBBLE_AT = HIT_AT;           // struck, the king WOBBLES (teeters on its base)
  const FALL_AT   = MATE_AT + 3.9;    // ≈28.7 — then it TOPPLES, head-first, into the open
  const FALL_END  = MATE_AT + 5.4;    // ≈30.2 — settled, lying dead on the board
  const FADE_OUT  = MATE_AT + 5.6;    // ≈30.4 — fade to black over the fallen king
  const FADE_BLACK= MATE_AT + 6.0;    // ≈30.8 — full black (the camera cuts to the top-down)
  const FADE_IN   = MATE_AT + 6.3;    // ≈31.1 — start revealing the top-down view
  const FADE_DONE = MATE_AT + 6.9;    // ≈31.7 — the top-down of the defeated king is revealed
  const RISE_AT   = MATE_AT + 7.8;    // ≈32.6 — the king begins DISSOLVING + SHAKING with rage (top-down HELD, camera still)
  const F2_OUT    = MATE_AT + 8.8;    // fade to black over the shaking king
  const F2_BLACK  = MATE_AT + 9.2;    // full black — CUT (no camera move) to the piece-level POV
  const F2_IN     = MATE_AT + 9.5;    // reveal the piece-level POV
  const F2_DONE   = MATE_AT + 10.0;   // piece-level revealed (king still shaking on the board)
  const EXPLODE_AT= MATE_AT + 10.6;   // ≈35.4 — it DETONATES: a SLOW-MO mushroom + a neat outward piece scatter → whiteout
  const MATE_HOLD = 20.4;             // + the slow-mo blast → whiteout → a held CLEAR tableau beat → the invitation
  const MOVES_END = MATE_AT + MATE_HOLD;
  const DURATION = MOVES_END;                     // the finale runs ≈42s (the message lingers after)
  const DRAIN_FROM = 13.2;                        // the room starts draining to black from the sacrifice's landing

  // The full camera path — "The Queen's Grave" cut. The establishing key + the intro-dolly settle reproduce
  // the far→near dolly; from t6.4 the camera only ever PUSHES (monotonic tighten toward the mate), with ONE
  // motivated exception: a widen+lift+ORBIT on the discovered double-check (the only az past ±0.06), so the
  // rook's d1→d8 beam is seen obliquely instead of end-on. HOLD beats are duplicated bracketing keyframes
  // (identical pose over a window → the lerp is a no-op → genuinely dead-still). Only 'smooth'/'smoother'
  // eases (zero-velocity joins) — never the single-sided in/out (they break C1 continuity at the joins).
  // READ_POSE is defined up in the king-entrance block (shared, so the camera hand-off is seamless).
  CAM_KEYS = [
    { t: INTRO.camStart, radius: CAM.far.radius, height: CAM.far.height, az: CAM.far.az, tgt: CAM.far.tgt.slice(), ease: 'smoother' }, // establishing (wide, lamp in frame)
    { t: _introEnd - 0.1, ...READ_POSE, ease: 'smoother' },    // settle to the board read as the field lands — then setKingCam OWNS the camera through both king drops
    { t: 8.20,  ...READ_POSE, ease: 'smoother' },              // read pose restored for the blunder (setKingCam hands back here)
    { t: 9.40,  radius: 4.05, height: 2.45, az: 0.13,  tgt: [0.14, -0.74, 0.46], ease: 'smoother' },       // 🔴 blunder: the camera DROPS and pushes in toward the centre as the knight grabs the bait
    { t: 10.80, radius: 4.05, height: 2.45, az: 0.13,  tgt: [0.14, -0.74, 0.46], ease: 'smooth' },         // HOLD low on the blunder
    { t: 13.20, radius: 3.30, height: 1.95, az: -0.20, tgt: [-0.16, -0.55, 1.28], ease: 'smoother' },      // ✨ SACRIFICE: a big dramatic LOW push that rides the queen up the whole d-file + orbits behind her
    { t: 15.00, radius: 3.20, height: 1.85, az: -0.22, tgt: [-0.18, -0.54, 1.33], ease: 'smooth' },        // hold the offer — low + intimate, the queen beside the king
    { t: 17.40, radius: 3.45, height: 2.05, az: -0.12, tgt: [-0.20, -0.55, 1.24], ease: 'smooth' },        // accept: stay low + tight on d8 as the king takes; a small reframe
    { t: 19.00, radius: 4.95, height: 3.15, az: 0.36,  tgt: [0.04, -0.50, 0.74], ease: 'smoother' },       // 🟢 DOUBLE-CHECK: the BIG move — a sweeping orbit (az −0.12→+0.36) that lifts up + around so both attack lines bloom
    { t: 21.00, radius: 4.95, height: 3.15, az: 0.36,  tgt: [0.04, -0.50, 0.74], ease: 'smooth' },         // HOLD the wedge of the double check
    { t: 22.70, radius: 3.95, height: 2.55, az: 0.12,  tgt: [-0.12, -0.52, 0.96], ease: 'smoother' },      // ease IN toward the mate zone (follow the bishop to d8) — one continuous arc, no chase-the-king detour
    { t: 24.80, radius: 3.10, height: 1.75, az: -0.15, tgt: [-0.30, -0.52, 1.16], ease: 'smoother' },      // 👑 MATE: a smooth LOW settle onto the kill — then setEndCam OWNS the camera for the death sequence
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
  // resign topple: the king falls AWAY from the mating bishop (d8), into the open b6/a5 space (no piece to
  // overlap), pivoting head-first. Direction + pivot axis precomputed once.
  const _resignDir = boardData.squareXYZ('c7').clone().sub(boardData.squareXYZ('d8')); _resignDir.y = 0; _resignDir.normalize();
  const _resignAxis = new THREE.Vector3().crossVectors(_UP, _resignDir).normalize();
  const _resignQ = new THREE.Quaternion();
  // the king's collision radius — half its footprint. When it lies on its side its central axis sits THIS far
  // above the board, so lifting by (radius · sin angle) keeps the piece resting ON the surface, never inside it.
  const _kingBox = new THREE.Box3().setFromObject(_theKing), _kingSz = new THREE.Vector3(); _kingBox.getSize(_kingSz);
  const _kr = Math.max(_kingSz.x, _kingSz.z) * 0.5;
  const _kingLift = (_kr > 0.01 && _kr < 0.5) ? _kr : 0.09;   // fall back if the bbox came back degenerate

  const _clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const _q5 = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * k * (k * (k * 6 - 15) + 10));   // quintic ease-in-out
  const _easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1, p = x - 1; return 1 + c3 * p * p * p + c1 * p * p; };   // gentle overshoot then settle
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
  // ============================================================================================
  // FX — the master toggle. Flip ANY flag to false to remove that effect completely (as if never added).
  // Everything below is gated on these, so nothing is ever "stuck". (#7 DOF lands in its own careful pass.)
  // ============================================================================================
  const FX = {
    dissolveKing:    true,   // the defeated KING dissolves away (noise + glowing edge) as the camera pulls back
    dissolveQueen:   true,   // the QUEEN dissolves (noise + glow) when the king takes her (Kxd8)
    ashCapture:      true,   // OTHER captures (the pawn on Nxe4) crumble to a DARK ASH puff instead (a different look)
    chargeGlow:      true,   // #8 — the queen's glow BUILDS as she nears d8 for the sacrifice
    ignite:          true,   // #3 — the d-file squares light up one-by-one beneath the gliding queen
    goldBurst:       true,   // #6 — the shockwave ring spreads across the WHOLE board + pieces tremble in order as it reaches them
    cometTrail:      false,  // #2 — the gold light-trail (OFF — removed)
    foreshadow:      true,   // #9 — the mating line flashes for a beat after she lands
    fireShader:      true,   // the detonation's fireball is a REAL procedural fire billboard (ported shader) — set false to fall back to particles only
  };
  // ---- DISSOLVE: erode a piece via 3D noise with a glowing burning edge (driven by progress 0→1). Piece
  // materials are unique, so we inject straight into each one — no cloning. A matching CUSTOM DEPTH material
  // makes the SHADOW dissolve in lock-step (no lingering shadow). Pure function of t → bakes. ----
  const DISS = { noiseScale: 11.0, edgeGlow: 2.4 };
  const _DISS_NOISE = `
    float dHash(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    float dNoise(vec3 x){ vec3 i=floor(x),f=fract(x); f=f*f*(3.0-2.0*f);
      return mix(mix(mix(dHash(i+vec3(0,0,0)),dHash(i+vec3(1,0,0)),f.x),mix(dHash(i+vec3(0,1,0)),dHash(i+vec3(1,1,0)),f.x),f.y),
                 mix(mix(dHash(i+vec3(0,0,1)),dHash(i+vec3(1,0,1)),f.x),mix(dHash(i+vec3(0,1,1)),dHash(i+vec3(1,1,1)),f.x),f.y),f.z); }`;
  function makeDissolvable(wrap, edgeColor) {
    const mat = wrap && wrap.userData && wrap.userData.material; if (!mat || mat.userData._dis) return;
    const uDis = { value: 0 }, uNS = { value: DISS.noiseScale };   // SHARED across the colour + depth shaders
    mat.userData._dis = { uDis };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uDis = uDis; sh.uniforms.uNS = uNS; sh.uniforms.uEdge = { value: 0.09 };
      sh.uniforms.uEcol = { value: new THREE.Color(edgeColor) }; sh.uniforms.uEglow = { value: DISS.edgeGlow };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vDpos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDpos = position;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vDpos;\nuniform float uDis;uniform float uEdge;uniform float uNS;uniform vec3 uEcol;uniform float uEglow;\n' + _DISS_NOISE)
        .replace('#include <dithering_fragment>',
          'float dn = dNoise(vDpos * uNS);\n if (uDis > 0.0001 && dn < uDis) discard;\n float de = 1.0 - smoothstep(uDis, uDis + uEdge, dn);\n gl_FragColor.rgb += uEcol * de * uEglow * step(0.0001, uDis);\n#include <dithering_fragment>');
    };
    mat.needsUpdate = true;
    // custom depth material: the SHADOW erodes with the same noise, so it fades in sync (fixes the lingering shadow)
    const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    dm.onBeforeCompile = (sh) => {
      sh.uniforms.uDis = uDis; sh.uniforms.uNS = uNS;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vDpos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDpos = position;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vDpos;\nuniform float uDis;uniform float uNS;\n' + _DISS_NOISE)
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n if (uDis > 0.0001 && dNoise(vDpos * uNS) < uDis) discard;');
    };
    wrap.traverse((o) => { if (o.isMesh) o.customDepthMaterial = dm; });
  }
  function setDissolve(wrap, p) {
    const d = wrap && wrap.userData && wrap.userData.material && wrap.userData.material.userData._dis;
    if (d) d.uDis.value = p;
    wrap.visible = p < 0.999;
  }
  if (FX.dissolveQueen) makeDissolvable(MOVES[2].cap_g, 0xffcaa0);   // ONLY the queen (when captured) + the king dissolve
  if (FX.dissolveKing) makeDissolvable(_theKing, 0xffe6b0);          // king → a regal gold dissolve
  const KING_DISS_FROM = RISE_AT, KING_DISS_TO = EXPLODE_AT + 0.4;   // the king dissolves — mostly gone by the moment it EXPLODES
  // a captured piece either DISSOLVES to ash (FX.dissolveCapture) or does the classic knock-topple
  function setCapture(m, t) {
    if (!m.cap_g) return;
    const dis = m.cap_g.userData.material && m.cap_g.userData.material.userData._dis;
    if (dis) setDissolve(m.cap_g, _q5(_clamp((t - (m.at + m.dur * 0.4)) / (m.dur * 0.6 + 0.4))));   // king/queen → noise dissolve
    else if (FX.ashCapture) setAshCapture(m, t);                                                    // other pieces → a dark ash puff
    else { const p = t <= m.at + m.dur ? _q5(_clamp((t - m.at) / m.dur)) : 1; toppleCaptured(m, _clamp((p - 0.5) / 0.5)); }
  }

  // inertia-lean scratch + magnitude (a moving piece tips back under acceleration, forward as it slows)
  const _leanDir = new THREE.Vector3(), _leanAxis = new THREE.Vector3(), _leanQ = new THREE.Quaternion();
  const LEAN_MAX = 0.2;   // peak tilt in radians (~11°); scale per move via m.lean
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
        const u = (t - m.at) / m.dur;
        const p = _q5(u);
        m.mover.position.lerpVectors(m.fromXYZ, m.toXYZ, p);
        m.mover.position.y += m.arc * Math.sin(Math.PI * p);   // a gentle lift-and-set (knights hop highest)
        // inertia lean: the base leads, the head tips BACK as it accelerates then forward as it settles — like a
        // standing rider when a car surges then brakes. Zero at both ends (upright at rest), so it never snaps.
        _leanDir.subVectors(m.toXYZ, m.fromXYZ); _leanDir.y = 0;
        if (_leanDir.lengthSq() > 1e-6) {
          _leanDir.normalize(); _leanAxis.crossVectors(_leanDir, _UP);        // world axis ⟂ travel → tips fore/aft
          const lean = LEAN_MAX * (m.lean != null ? m.lean : 1) * Math.sin(2 * Math.PI * u);
          _leanQ.setFromAxisAngle(_leanAxis, lean);
          m.mover.quaternion.multiplyQuaternions(_leanQ, m.restQuat);         // world tilt ∘ the piece's own facing
        } else m.mover.quaternion.copy(m.restQuat);
        if (m.cap_g) setCapture(m, t);   // captured piece dissolves to ash (or topples, per FX)
      } else {
        m.mover.position.copy(m.toXYZ); m.mover.quaternion.copy(m.restQuat);
        if (m.cap_g) setCapture(m, t);
      }
    }
    // the king's DEATH: struck by the beam it WOBBLES (teeters), then TOPPLES head-first into the open, its
    // head BOUNCING off the board before it lies still. Lifted by its collision radius so it rests ON the
    // board — never sunk inside it. (real knocked-king physics: teeter → accelerate → impact → damped bounce.)
    if (_theKing) {
      const c7 = boardData.squareXYZ('c7');
      if (t >= WOBBLE_AT && t < FALL_AT) {
        // teeter: a growing, damped oscillation about the fall axis — the beam's shove building to the topple
        const tw = t - WOBBLE_AT, grow = _q5(_clamp(tw / (FALL_AT - WOBBLE_AT)));
        const ang = Math.sin(tw * 15) * 0.1 * grow;
        _resignQ.setFromAxisAngle(_resignAxis, ang);
        _theKing.quaternion.multiplyQuaternions(_resignQ, MOVES[2].restQuat);
        _theKing.position.copy(c7); _theKing.position.y = c7.y + _kingLift * Math.abs(Math.sin(ang));
      } else if (t >= FALL_AT) {
        const te = t - FALL_AT, FALL = 0.65, FLAT = 1.52;          // time to head-impact · angle lying on its head (~87°)
        let ang, hop = 0;
        if (te < FALL) ang = FLAT * Math.pow(_clamp(te / FALL), 1.7);   // gravity ease-in: accelerates into the impact
        else {
          const tb = te - FALL, damp = Math.exp(-tb * 4.2), osc = Math.abs(Math.sin(tb * 12));
          ang = FLAT - osc * 0.16 * damp;                          // the head BOUNCES up off the board, damping to rest
          hop = osc * 0.045 * damp;                                // the whole piece lifts a touch on each bounce
        }
        _resignQ.setFromAxisAngle(_resignAxis, ang);
        _theKing.quaternion.multiplyQuaternions(_resignQ, MOVES[2].restQuat);
        _theKing.position.copy(c7);
        _theKing.position.addScaledVector(_resignDir, 0.14 * _clamp(ang / FLAT));    // roll off the base edge as it tips
        _theKing.position.y = c7.y + hop + _kingLift * Math.sin(ang);                // rest ON the board (lift by the radius)
      }
      // the defeated king DISSOLVES away (noise + glowing edge) as the finale draws in
      if (FX.dissolveKing) setDissolve(_theKing, _q5(_clamp((t - KING_DISS_FROM) / (KING_DISS_TO - KING_DISS_FROM))));
      // …and it SHAKES with rage, harder and harder, until it detonates
      if (t >= RISE_AT && t < EXPLODE_AT) { const s = 0.004 + 0.024 * _clamp((t - RISE_AT) / (EXPLODE_AT - RISE_AT));
        _theKing.position.x += s * Math.sin(t * 46); _theKing.position.z += s * Math.sin(t * 53 + 1.2); }
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

  // ---- the KILL-BEAM: a separate, thicker bolt the bishop fires from the TOP OF ITS HEAD at the king to end it.
  // Fires at SHOOT_AT (travels bishop-top → king), FLASHES on impact, then fades as the king falls. ----
  const killBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.028, 1, 14, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff2418, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));   // a shiny RED death-ray
  killBeam.geometry.translate(0, 0.5, 0); killBeam.visible = false; killBeam.renderOrder = 7; scene.add(killBeam);
  const killCore = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.011, 1, 12, 1, true),   // a hot white-red inner core makes it read as shiny/energetic
    new THREE.MeshBasicMaterial({ color: 0xffd8c0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  killCore.geometry.translate(0, 0.5, 0); killCore.visible = false; killCore.renderOrder = 8; scene.add(killCore);
  const KILL = { bishopTopY: 0.46, kingHitY: 0.22 };   // height of the bishop's head · where on the king it strikes
  const _kbFrom = new THREE.Vector3(), _kbTo = new THREE.Vector3(), _kbTip = new THREE.Vector3();
  function setKillBeam(t) {
    if (t < SHOOT_AT || t > FALL_AT + 0.5) { killBeam.visible = false; killCore.visible = false; return; }
    _kbFrom.copy(boardData.squareXYZ('d8')); _kbFrom.y += KILL.bishopTopY;         // the top of the bishop's head on d8
    _kbTo.copy(boardData.squareXYZ('c7')); _kbTo.y += KILL.kingHitY;               // the king's body on c7
    const grow = _q5(_clamp((t - SHOOT_AT) / (HIT_AT - SHOOT_AT)));                 // the bolt travels down to the king
    const flash = t >= HIT_AT ? Math.exp(-Math.pow((t - HIT_AT) / 0.16, 2)) : 0;   // a bright flash on impact
    const fade = 1 - _clamp((t - HIT_AT) / (FALL_AT + 0.5 - HIT_AT));              // then fades out as the king dies
    const op = (1.15 + 1.9 * flash) * Math.max(t < HIT_AT ? 1 : fade, flash);      // shiny + a hard impact flash
    _bv.subVectors(_kbTo, _kbFrom); const len = _bv.length();
    killBeam.position.copy(_kbFrom); killBeam.scale.set(1, len * grow, 1);
    killBeam.quaternion.setFromUnitVectors(_UP, _bv.normalize());
    killBeam.material.opacity = op; killBeam.visible = op > 0.01;
    killCore.position.copy(_kbFrom); killCore.scale.set(1, len * grow, 1);         // the hot inner core rides with it
    killCore.quaternion.copy(killBeam.quaternion);
    killCore.material.opacity = op * 0.9; killCore.visible = op > 0.01;
  }

  // ---- IMPACT DAMAGE: a burst of hot sparks + a flash where the bolt strikes the king. Deterministic (bakes). ----
  const _hitPos = boardData.squareXYZ('c7').clone(); _hitPos.y += KILL.kingHitY;
  const SPARK = { n: 34, life: 0.75, speed: 2.9, grav: 4.2, size: 0.055 };
  const _sparkGeo = new THREE.BufferGeometry();
  const _sparkPos = new Float32Array(SPARK.n * 3), _sparkA = new Float32Array(SPARK.n), _sparkS = new Float32Array(SPARK.n);
  _sparkGeo.setAttribute('position', new THREE.BufferAttribute(_sparkPos, 3));
  _sparkGeo.setAttribute('aAlpha', new THREE.BufferAttribute(_sparkA, 1));
  _sparkGeo.setAttribute('aSize', new THREE.BufferAttribute(_sparkS, 1));
  const _sparkP = [];   // per-spark direction/speed/size — deterministic hash, no RNG
  for (let i = 0; i < SPARK.n; i++) {
    const h = (n) => { const x = Math.sin((i + 1) * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
    const th = h(1) * Math.PI * 2, ph = 0.12 + h(2) * 1.3;   // fly outward + up from the strike
    _sparkP.push({ dir: [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)],
      sp: SPARK.speed * (0.45 + h(3) * 0.9), sz: SPARK.size * (0.55 + h(4) * 0.9), aS: 0.7 + h(5) * 0.5 });
  }
  const _sparkMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0xff4a1e) }, uScale: { value: 300 } },
    vertexShader: `attribute float aAlpha; attribute float aSize; uniform float uScale; varying float vA;
      void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = min(90.0, aSize * uScale / max(0.02, -mv.z)); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA;
        if (a <= 0.003) discard; gl_FragColor = vec4(mix(uColor, vec3(1.0, 0.9, 0.7), a * 0.7), a); }`,   // hot core → red edges
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
  });
  const _spark = new THREE.Points(_sparkGeo, _sparkMat); _spark.frustumCulled = false; _spark.renderOrder = 9; _spark.visible = false; scene.add(_spark);
  const hitFlash = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTex([[0, 'rgba(255,240,220,1)'], [0.22, 'rgba(255,90,40,0.72)'], [0.6, 'rgba(255,40,20,0.2)'], [1, 'rgba(0,0,0,0)']]),
    transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  hitFlash.position.copy(_hitPos); hitFlash.renderOrder = 9; scene.add(hitFlash);
  function _sparkScale() { _sparkMat.uniforms.uScale.value = 0.5 * renderer.domElement.height / Math.tan((camera.fov * Math.PI / 180) / 2); }
  _sparkScale();
  function setImpact(t) {
    const age = t - HIT_AT;
    if (age <= 0 || age >= SPARK.life) { _spark.visible = false; hitFlash.visible = false; return; }
    const fl = Math.max(0, 1 - age / 0.28); hitFlash.material.opacity = fl * fl * 0.95; hitFlash.visible = fl > 0.02;   // bright pop → quick fade
    const fsz = 0.55 + 1.2 * _q5(_clamp(age / 0.2)); hitFlash.scale.set(fsz, fsz, 1);
    const k = age / SPARK.life;
    for (let i = 0; i < SPARK.n; i++) {
      const p = _sparkP[i];
      _sparkPos[i * 3]     = _hitPos.x + p.dir[0] * p.sp * age;
      _sparkPos[i * 3 + 1] = _hitPos.y + p.dir[1] * p.sp * age - 0.5 * SPARK.grav * age * age;   // ballistic: gravity pulls them down
      _sparkPos[i * 3 + 2] = _hitPos.z + p.dir[2] * p.sp * age;
      _sparkS[i] = p.sz; _sparkA[i] = p.aS * (1 - _q5(k));
    }
    _spark.visible = true;
    _sparkGeo.attributes.position.needsUpdate = true; _sparkGeo.attributes.aAlpha.needsUpdate = true; _sparkGeo.attributes.aSize.needsUpdate = true;
  }

  // ---- DARK ASH: a non-glowing capture (the pawn) CRUMBLES — it fades out while a puff of dark ash rises +
  // disperses + falls. A different look from the glowing dissolve. Deterministic (bakes). ----
  const ASH = { n: 26, life: 1.2, up: 0.55, out: 0.65, grav: 0.85, size: 0.075 };
  const _ashGeo = new THREE.BufferGeometry();
  const _ashPos = new Float32Array(ASH.n * 3), _ashA = new Float32Array(ASH.n), _ashS = new Float32Array(ASH.n);
  _ashGeo.setAttribute('position', new THREE.BufferAttribute(_ashPos, 3));
  _ashGeo.setAttribute('aAlpha', new THREE.BufferAttribute(_ashA, 1));
  _ashGeo.setAttribute('aSize', new THREE.BufferAttribute(_ashS, 1));
  const _ashP = [];
  for (let i = 0; i < ASH.n; i++) { const h = (n) => { const x = Math.sin((i + 2) * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
    const th = h(1) * 6.283, ph = 0.35 + h(2) * 0.9;
    _ashP.push({ dir: [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)], sp: 0.5 + h(3) * 0.9, sz: 0.6 + h(4) * 0.9, aS: 0.6 + h(5) * 0.5 }); }
  const _ashMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0x5b524a) }, uScale: { value: 300 } },   // warm dark ash (normal blending — it's dark, not light)
    vertexShader: `attribute float aAlpha; attribute float aSize; uniform float uScale; varying float vA;
      void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = min(160.0, aSize * uScale / max(0.02, -mv.z)); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.08, d) * vA; if (a <= 0.003) discard; gl_FragColor = vec4(uColor, a); }`,
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.NormalBlending });
  const _ash = new THREE.Points(_ashGeo, _ashMat); _ash.frustumCulled = false; _ash.renderOrder = 8; _ash.visible = false; scene.add(_ash);
  function _ashScale() { _ashMat.uniforms.uScale.value = 0.5 * renderer.domElement.height / Math.tan((camera.fov * Math.PI / 180) / 2); }
  _ashScale();
  function setAshCapture(m, t) {
    const fs = m.at + m.dur * 0.45, age = t - fs;   // crumble begins as the capturer arrives
    if (m.capMat) { m.capMat.transparent = true; m.capMat.opacity = 1 - _clamp(age / (m.dur * 0.5 + 0.3)); }   // fade the piece away
    m.cap_g.visible = age < m.dur * 0.5 + 0.3;
    if (age <= 0 || age >= ASH.life) { _ash.visible = false; return; }
    const o = m.toXYZ, k = age / ASH.life;
    for (let i = 0; i < ASH.n; i++) { const p = _ashP[i];
      _ashPos[i * 3]     = o.x + p.dir[0] * ASH.out * p.sp * age;
      _ashPos[i * 3 + 1] = o.y + 0.1 + ASH.up * p.dir[1] * age * 2.0 - 0.5 * ASH.grav * age * age;   // puff up, then settle
      _ashPos[i * 3 + 2] = o.z + p.dir[2] * ASH.out * p.sp * age;
      _ashS[i] = ASH.size * p.sz * (0.7 + age); _ashA[i] = p.aS * (1 - _q5(k)) * 0.75; }
    _ash.visible = true;
    _ashGeo.attributes.position.needsUpdate = true; _ashGeo.attributes.aAlpha.needsUpdate = true; _ashGeo.attributes.aSize.needsUpdate = true;
  }

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
  // rating → colour · how strong the room-glow is · how strong the piece-pulse is · which badge icon
  const RATING_FX = {
    blunder:     { color: 0xff3b3b, glow: 0.42, pulse: 0.85, tex: () => iconTexture('blunder.svg') },
    brilliant:   { color: 0x2ad6c4, glow: 0.85, pulse: 1.15, tex: () => iconTexture('brilliant.svg') }, // teal ‼ — the page's brilliant colour
    forced:      { color: 0x9aa7b2, glow: 0,    pulse: 0,    tex: () => iconTexture('forced.svg') },     // forced KING moves: badge only — no glow/highlight on the king
    doublecheck: { color: 0x66d24a, glow: 0.60, pulse: 0.95, tex: () => iconTexture('great.svg') },
    mate:        { color: 0xffe08a, glow: 0.95, pulse: 1.20, tex: () => iconTexture('checkmate.svg') },  // the "#" checkmate badge
  };
  // the rating glow lives IN THE WORLD, not as a screen overlay: two coloured lights flank the board (low +
  // to each side) and wash the pieces, table and surrounding fog with the rating colour, while the void air
  // itself takes a tint of it (fog wash in setEffects). Real 3D light → it has depth + parallax and can never
  // read as a frame-edge vignette. Intensity is driven per-frame from the rating envelope.
  const ratingLightA = new THREE.PointLight(0xffffff, 0, 22, 1.0); ratingLightA.position.set(-2.2, 0.5, 1.7); scene.add(ratingLightA);
  const ratingLightB = new THREE.PointLight(0xffffff, 0, 22, 1.0); ratingLightB.position.set(2.2, 0.35, -1.3); scene.add(ratingLightB);
  // one badge sprite per rated move, parked above its destination square (faces the camera, drawn over pieces)
  const _ratedFx = MOVES.filter((m) => m.rating).map((m) => {
    const mat = new THREE.SpriteMaterial({ map: RATING_FX[m.rating].tex(), transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(mat); sprite.renderOrder = 999; sprite.visible = false;
    const pos = boardData.squareXYZ(m.to).clone(); pos.y += 0.66;     // float above the piece on its square
    sprite.position.copy(pos); scene.add(sprite);
    return { m, sprite, landT: m.at + m.dur, fx: RATING_FX[m.rating], last: false };   // no lingering badge — every rating fades on the same timing
  });
  // ============================================================================================
  // LANDING SMOKE — a dust puff kicked up where each KING lands. A particle burst (THREE.Points) that
  // billows OUTWARD from the impact along the ground (the strike's momentum), rises, expands and disperses.
  // It's a pure function of t (deterministic per-particle constants, no Math.random) so it bakes with the
  // clip identically. Tunables in SMOKE — change numbers, not structure. ============================
  const SMOKE = { per: 22, life: 1.0, drift: 1.15, tau: 0.45, rise: 0.55, size: 0.29, grow: 1.8, alpha: 0.4 };
  const _smokeSpawns = [
    { o: boardData.squareXYZ('e8').clone(), t0: BLACK_KING_LANDS },   // where the black king lands
    { o: boardData.squareXYZ('c1').clone(), t0: WHITE_KING_LANDS },   // where the white king lands
  ];
  const _smokeN = SMOKE.per * _smokeSpawns.length;
  const _smokeGeo = new THREE.BufferGeometry();
  const _smokePos = new Float32Array(_smokeN * 3), _smokeA = new Float32Array(_smokeN), _smokeS = new Float32Array(_smokeN);
  _smokeGeo.setAttribute('position', new THREE.BufferAttribute(_smokePos, 3));
  _smokeGeo.setAttribute('aAlpha', new THREE.BufferAttribute(_smokeA, 1));
  _smokeGeo.setAttribute('aSize', new THREE.BufferAttribute(_smokeS, 1));
  const _smokeP = [];   // per-particle constants: outward direction + speed + base size (deterministic hash, no RNG)
  for (let s = 0; s < _smokeSpawns.length; s++) {
    for (let i = 0; i < SMOKE.per; i++) {
      const h = (n) => { const x = Math.sin((i + 1) * 12.9898 + (s + 1) * 3.77 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
      const ang = h(1) * Math.PI * 2, elev = 0.10 + h(2) * 0.28, ce = Math.cos(elev), se = Math.sin(elev);  // mostly along the ground, slight rise
      _smokeP.push({ spawn: _smokeSpawns[s], dir: [Math.cos(ang) * ce, se, Math.sin(ang) * ce],
        speed: SMOKE.drift * (0.5 + h(3) * 0.75), sz: SMOKE.size * (0.7 + h(4) * 0.7), aS: 0.7 + h(5) * 0.5, wob: h(6) * 6.283 });
    }
  }
  const _smokeMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0xe9e3d7) }, uScale: { value: 300 } },   // light warm dust; uScale = world→pixel size factor
    vertexShader: `attribute float aAlpha; attribute float aSize; uniform float uScale; varying float vA;
      void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = min(360.0, aSize * uScale / max(0.02, -mv.z)); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, d) * vA;
        if (a <= 0.003) discard; gl_FragColor = vec4(uColor, a); }`,
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.NormalBlending,
  });
  const _smoke = new THREE.Points(_smokeGeo, _smokeMat); _smoke.frustumCulled = false; _smoke.renderOrder = 5; scene.add(_smoke);
  function _smokeScale() { _smokeMat.uniforms.uScale.value = 0.5 * renderer.domElement.height / Math.tan((camera.fov * Math.PI / 180) / 2); }
  _smokeScale();
  function setSmoke(t) {
    let any = false;
    for (let j = 0; j < _smokeN; j++) {
      const p = _smokeP[j], age = t - p.spawn.t0;
      if (age <= 0 || age >= SMOKE.life) { _smokeA[j] = 0; continue; }
      any = true;
      const k = age / SMOKE.life;
      const horiz = p.speed * SMOKE.tau * (1 - Math.exp(-age / SMOKE.tau));   // momentum: fast burst outward, then drag eases it
      const wob = 0.05 * Math.sin(age * 3 + p.wob), o = p.spawn.o;
      _smokePos[j * 3]     = o.x + p.dir[0] * horiz + wob;
      _smokePos[j * 3 + 1] = o.y + p.dir[1] * horiz * 1.4 + SMOKE.rise * age;   // drift + buoyant rise
      _smokePos[j * 3 + 2] = o.z + p.dir[2] * horiz + wob;
      _smokeS[j] = p.sz * (0.5 + SMOKE.grow * k);                              // expands as it disperses
      _smokeA[j] = p.aS * _q5(_clamp(k / 0.15)) * (1 - _q5(_clamp((k - 0.35) / 0.65))) * SMOKE.alpha;   // smooth swell in, graceful fade out
    }
    _smoke.visible = any;
    if (any) { _smokeGeo.attributes.position.needsUpdate = true; _smokeGeo.attributes.aAlpha.needsUpdate = true; _smokeGeo.attributes.aSize.needsUpdate = true; }
  }

  // ---- the BRILLIANT "boom": an expanding light-grey shockwave ring on the board where the queen lands (Qd8+).
  // Starts small at her landing spot, grows outward and fades — a pure function of t (bakes with the clip). ----
  function shockTex() {                          // a soft grey RING: clear centre → bright ring → clear edge
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
    const g = x.createRadialGradient(64, 64, 8, 64, 64, 64);
    g.addColorStop(0.00, 'rgba(255,255,255,0)');
    g.addColorStop(0.55, 'rgba(255,255,255,0)');
    g.addColorStop(0.80, 'rgba(255,255,255,0.95)');   // the ring itself
    g.addColorStop(0.92, 'rgba(255,255,255,0.30)');
    g.addColorStop(1.00, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(cv);
  }
  const SHOCK = { land: MOVES[1].at + MOVES[1].dur, dur: 1.35, from: 0.04, to: 12.0, alpha: 0.85 };   // Qd8+ lands → a boom that spreads from UNDER her across the WHOLE board (starts as a point at her base)
  const shock = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: shockTex(), color: 0xe8dfce, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  shock.rotation.x = -Math.PI / 2;               // lie flat on the board surface
  shock.position.copy(boardData.squareXYZ('d8')); shock.position.y += 0.02;
  shock.renderOrder = 6; shock.visible = false; scene.add(shock);
  const _shockScale = (age) => { const k = _clamp(age / SHOCK.dur); return SHOCK.from + (SHOCK.to - SHOCK.from) * (1 - (1 - k) * (1 - k)); };
  const shockRadius = (age) => 0.40 * _shockScale(age);   // world radius of the expanding ring front (the radial tremble keys off this)
  function setShock(t) {
    const age = t - SHOCK.land;
    if (age <= 0 || age >= SHOCK.dur) { shock.visible = false; return; }
    shock.visible = true; const k = age / SHOCK.dur;
    shock.scale.set(_shockScale(age), _shockScale(age), 1);
    shock.material.opacity = SHOCK.alpha * (1 - _q5(k)) * (1 - k * 0.35);   // gets bigger AND lighter (fainter) as it reaches the edges
  }

  // landing envelope: a SMOOTH glow that swells up, holds a beat, then eases fully back to 0 — reaching 0
  // well inside its beat (span 1.2s) so a held keyboard step never freezes a piece mid-glow ("stays red").
  function _landEnv(t, landT, span = 1.2) {
    const k = (t - landT) / span;
    if (k <= 0 || k >= 1) return 0;
    const up = _q5(_clamp(k / 0.22));              // smooth glow-up
    const down = _q5(_clamp((k - 0.42) / 0.58));   // smooth fade — reaches 0 exactly at k=1
    return up * (1 - down);
  }

  function sizeVignette() {
    const h = 2 * Math.tan((camera.fov * Math.PI / 180) / 2) * VIGN_DIST;
    vignette.scale.set(h * camera.aspect, h, 1);   // exactly fill the view at VIGN_DIST (elliptical follows the frame)
  }
  sizeVignette();   // size once now (fov is fixed; only aspect changes → re-sized in resize(), not per-frame)
  function aimBeam(beam, fromSq, toSq, opacity, grow = 1) {
    if (opacity <= 0.001) { beam.visible = false; return; }
    const a = boardData.squareXYZ(fromSq).clone(); a.y += BEAM_Y;
    const b = boardData.squareXYZ(toSq).clone(); b.y += BEAM_Y;
    _bv.subVectors(b, a); const len = _bv.length();
    beam.position.copy(a); beam.scale.set(1, len * grow, 1);   // grow<1 → the bolt is still travelling from `from` toward `to`
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
  const _fogColorBase = scene.fog.color.clone(), _ratingCol = new THREE.Color();   // for the "void air takes the rating colour" tint
  const _coolBase = coolRim.intensity, _cyanBase = cyanRim.intensity, _warmBase = warmRim.intensity, _glintBase = glint.intensity;   // room-fill baselines (dimmed by the drain / queen focus)
  const _darkBg = new THREE.Color(0x041615), _heroBg = new THREE.Color(0xeceae4), _bgScratch = new THREE.Color();   // final HERO beat: the room floods to a clean light backdrop for the floating pieces
  const _triWave = (t, a, b) => { const k = _clamp((t - a) / (b - a)); return Math.sin(Math.PI * k); };   // 0→1→0 over [a,b]
  const _kpos = new THREE.Vector3();
  function setEffects(t) {
    // ---- RATING EFFECTS: per rated move, the moved piece GLOWS + pulses once on landing, its on-square
    // BADGE pops, and the room takes the rating colour. Only one rated move is landing-active at a time. ----
    let glowColor = 0xffffff, glowAmt = 0;
    for (const r of _ratedFx) {
      const env = _landEnv(t, r.landT);
      // the moved piece glows up then fully fades — but NEVER a king (the user wants zero highlight on the king)
      if (r.m.mover && r.m.mover.userData.type !== 'king') pulse(r.m.mover, r.fx.color, env * r.fx.pulse);
      const k = t - r.landT;                                      // the on-square badge: SMOOTH swell in, hold, ease out (mate lingers)
      let bo = 0, bs = 0.46;
      if (k > -0.05) {
        const inK = _q5(_clamp(k / 0.42));                       // quintic fade-in — same timing for every rating (incl. forced)
        const out = r.last ? 0 : _q5(_clamp((k - 0.85) / 0.5));  // quintic fade-out
        bo = inK * (1 - out);
        bs = 0.46 * (0.6 + 0.4 * _easeOutBack(_clamp(k / 0.5)));  // scale grows with a gentle overshoot, then settles — no snap
      }
      r.sprite.material.opacity = bo; r.sprite.visible = bo > 0.01; r.sprite.scale.set(bs, bs, 1);
      if (env * r.fx.glow > glowAmt) { glowAmt = env * r.fx.glow; glowColor = r.fx.color; }
    }
    // the rating glow is a REAL glow in the world: two coloured lights wash the chess set + the fog around it,
    // and the void air takes a tint of the colour. Depth + parallax → never a frame-edge vignette.
    _ratingCol.setHex(glowColor);
    ratingLightA.color.copy(_ratingCol); ratingLightA.intensity = glowAmt * 55;
    ratingLightB.color.copy(_ratingCol); ratingLightB.intensity = glowAmt * 44;
    scene.fog.color.copy(_fogColorBase).lerp(_ratingCol, glowAmt * 0.7);

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

    // ---- the QUEEN's move gets its own spotlight beat: the room DIMS as she readies, a tight spot isolates
    // her and TRACKS her glide up the d-file for the brilliant sacrifice — THEN the existing drain carries the
    // whole room to black while the spot hunts the king (chiaroscuro: the light is the cage). One continuous
    // darkening curve (queen dim → drain to black), so nothing snaps at the hand-off. ----
    const Q_FROM = MOVES[1].at - 0.4;                 // the room begins to dim + the spot finds the queen (start of her scene)
    const Q_LAND = MOVES[1].at + MOVES[1].dur;        // she lands on d8
    const Q_DARK = 0.95;                               // how DARK the room gets during her move — near-black, so the queen pops
    // the queen focus is a TEMPORARY dark spotlight beat that RECOVERS to full brightness after she lands
    // (the room is NOT dim the whole time). The ENDING drain re-darkens the room for the death sequence.
    let qDark = 0;
    if (t >= Q_FROM && t < Q_LAND + 1.9) { const up = _q5(_clamp((t - Q_FROM) / 0.9)), down = _q5(_clamp((t - (Q_LAND + 0.45)) / 1.35)); qDark = Q_DARK * up * (1 - down); }
    const DRAIN2 = MOVES[3].at - 0.6;                  // the room sinks to black for the finale from the double-check (Bg5+) onward
    const dark = Math.max(qDark, _q5(_clamp((t - DRAIN2) / (MATE_AT - DRAIN2))));
    amb.intensity = _mx(_ambBase, 0.07, dark);
    renderer.toneMappingExposure = _mx(_expBase, 0.42, dark);
    scene.fog.density = _mx(_fogBase, 0.09, dark);
    vignette.material.opacity = dark * VIGN_MAX;
    coolRim.intensity = _mx(_coolBase, _coolBase * 0.06, dark);   // dim the room fill so the SPOT dominates (but recovers after the beat)
    cyanRim.intensity = _mx(_cyanBase, _cyanBase * 0.06, dark);
    warmRim.intensity = _mx(_warmBase, _warmBase * 0.06, dark);
    glint.intensity   = _mx(_glintBase, _glintBase * 0.16, dark);
    // ---- the final HERO beat: as the blast whites out, the room floods to a clean LIGHT backdrop so the
    // surviving pieces read (dark-on-light) as they hover + rotate under the closing invitation. ----
    // the light backdrop rises EXACTLY as the whiteout recedes (a cross-fade), so the room + bulb + pieces
    // resolve smoothly OUT of the white instead of popping in after it clears. Matched to flashAt's recede.
    const hero = _q5(_clamp((eAge(t) - 1.8) / 1.6));
    // ALWAYS reset the background from the dark base (hero=0 → dark) so the light NEVER sticks on scrub/replay —
    // the surroundings only go white as the blast's glow actually reaches them.
    _bgScratch.copy(_darkBg).lerp(_heroBg, hero);
    if (scene.background) scene.background.copy(_bgScratch);   // null during the assembly entry (page shows through)
    scene.fog.color.lerp(_heroBg, hero);
    if (hero > 0) {
      amb.intensity = _mx(amb.intensity, 1.35, hero);
      renderer.toneMappingExposure = _mx(renderer.toneMappingExposure, 1.0, hero);
      scene.fog.density = _mx(scene.fog.density, 0.008, hero);
      vignette.material.opacity = _mx(vignette.material.opacity, 0.0, hero);
      coolRim.intensity = _mx(coolRim.intensity, _coolBase * 0.9, hero);   // restore fill so the pieces keep their form on white
      warmRim.intensity = _mx(warmRim.intensity, _warmBase * 0.9, hero);
      glint.intensity   = _mx(glint.intensity, _glintBase, hero);
    }
    // the spotlight: during the queen's beat it eases smoothly to a TIGHT, bright, soft-edged pool that TRACKS
    // her up the d-file; afterwards it widens back to the drain's hunt of the king.
    const inQueen = t >= Q_FROM && t < Q_LAND + 0.2;
    const qf = inQueen ? _q5(_clamp((t - Q_FROM) / 0.6)) * (1 - _q5(_clamp((t - (Q_LAND + 0.05)) / 0.18))) : 0;   // smoother onset
    const wideAngle = _mx(_spotBaseAngle, _spotBaseAngle * 0.74, dark);
    spot.angle = _mx(wideAngle, 0.18, qf);                       // a tight ~10° cone isolates the queen
    spot.penumbra = _mx(1, 0.6, qf);                             // a soft, smooth pool edge — cinematic, not a hard circle
    spot.intensity = _mx(_spotBaseInt, _spotBaseInt * 1.18, dark) * _mx(1, 1.95, qf);   // brighter on her against the darker room
    let _stgt = null;
    if (inQueen && MOVES[1].mover) { MOVES[1].mover.getWorldPosition(_kpos); _stgt = qf; }   // follow the queen up the d-file
    else if (_theKing) { _theKing.getWorldPosition(_kpos); _stgt = dark; }                    // then hunt the king
    if (_stgt !== null) {
      spot.target.position.set(_mx(_spotBaseTgt.x, _kpos.x, _stgt), _spotBaseTgt.y, _mx(_spotBaseTgt.z, _kpos.z, _stgt));
      spot.target.updateMatrixWorld();
    }
  }

  // ---- rating lower-third (the page's move-rating language): a PURE function of t the DOM layer reads ----
  // Kept as live HTML (ender.js) so the captions stay editable without re-rendering the clip — only the heavy
  // WebGL bakes to video. One badge per rated move (Kc7 is the only unrated reply). outAt values COMPLETE the
  // fade before each beat's step-boundary, so a held keyboard step never freezes a caption mid-fade.
  // fin/fout = fade-in / fade-out seconds (default 0.45 / 0.5). Forced captions use fast fades so they fully
  // clear inside their short beats (a held keyboard step never freezes them mid-fade).
  const BADGES = [
    { rating: 'blunder',     label: 'Blunder',      move: 'Nxe4', icon: 'blunder.svg',   inAt: 9.20,  outAt: 10.70 },
    { rating: 'brilliant',   label: 'Brilliant',    move: 'Qd8+', icon: 'brilliant.svg', inAt: 13.00, outAt: 14.70 },
    { rating: 'forced',      label: 'Forced',       move: 'Kxd8', icon: 'forced.svg',    inAt: 16.40, outAt: 18.00 }, // king must take the queen out of check — same on-screen time as the others
    { rating: 'doublecheck', label: 'Double check', move: 'Bg5+', icon: 'great.svg',     inAt: 18.90, outAt: 20.70 },
    { rating: 'forced',      label: 'Forced',       move: 'Kc7',  icon: 'forced.svg',    inAt: 22.20, outAt: 23.80 }, // king is forced to flee the double check
    { rating: 'mate',        label: 'Checkmate',    move: 'Bd8#', icon: 'checkmate.svg',  inAt: 24.70, outAt: 26.10 }, // the "#" badge — fades right after the check
  ];
  function badgeAt(t) {
    for (const b of BADGES) {
      if (t < b.inAt - 0.05 || t > b.outAt) continue;
      const fin = _clamp((t - b.inAt) / (b.fin || 0.45));
      const fout = _clamp((t - (b.outAt - (b.fout || 0.5))) / (b.fout || 0.5));
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

  // ---- the ENDING camera: mate hand-off → a tense CLOSE ORBIT around the king + bishop → a lunge-in as the
  // bishop's bolt strikes → ride the fall → HOLD, then FADE to black → reveal a TOP-DOWN of the defeated king
  // → a short pause → a slow straight ZOOM-OUT (same orientation) as the sad defeat. Explicit eye+tgt poses. ----
  const _c7w = boardData.squareXYZ('c7');
  const _deadPos = _c7w.clone().addScaledVector(_resignDir, 0.42); _deadPos.y = _c7w.y;   // ≈ centre of the lying king
  const _mateEye = new THREE.Vector3(-0.463, 1.75, -2.965);       // the mate pose eye — the orbit BEGINS here (no push-in)
  // close orbit: rotate around the king+bishop midpoint while pushing IN closer. No lens warp — a plain move.
  const _orbC = _c7w.clone().add(boardData.squareXYZ('d8')).multiplyScalar(0.5); _orbC.y += 0.28;
  const _ob0 = _mateEye.clone().sub(_orbC); const ORB_r0 = _ob0.length(); _ob0.normalize();
  const ORB_el = Math.asin(Math.max(-1, Math.min(1, _ob0.y))), ORB_az0 = Math.atan2(_ob0.x, -_ob0.z);
  const ORB = { azOff: 1.4, r1mul: 0.55 };                        // rotate a LOT around the pair + get much closer (tense)
  const _orbCe = Math.cos(ORB_el), _orbSe = Math.sin(ORB_el);
  const _orbEyeAt = (az, rad) => [_orbC.x + Math.sin(az) * _orbCe * rad, _orbC.y + _orbSe * rad, _orbC.z - Math.cos(az) * _orbCe * rad];
  const _orbEye0 = _orbEyeAt(ORB_az0, ORB_r0), _orbEye1 = _orbEyeAt(ORB_az0 + ORB.azOff, ORB_r0 * ORB.r1mul);
  const _kb = [_c7w.x, _c7w.y + 0.30, _c7w.z];   // the king's mid-body — the death shot looks LEVEL at this
  const _lungeEye = [_c7w.x - 0.08, _c7w.y + 0.34, _c7w.z - 1.7];   // LOW + LEVEL, front of the king — the FULL king stays in frame (never looking down)
  const _mateTgt = [-0.30, -0.52, 1.16];   // the mate view's look point — the orbit eases OFF this so there's no fast shift to the king
  // the top-down of the fallen king: look at the king's centre (nudged toward the crown so its FULL body shows,
  // crown not clipped). The defeat zoom-out just recedes ALONG this axis (no rotation).
  const _tdLook = _deadPos.clone().addScaledVector(_resignDir, 0.12); const _tdLookA = [_tdLook.x, _tdLook.y, _tdLook.z];
  const _tdV = [0.08, 2.5, 0.08], _td = (s) => [_tdLook.x + _tdV[0] * s, _tdLook.y + _tdV[1] * s, _tdLook.z + _tdV[2] * s];
  const _fallHold = { eye: [_deadPos.x - 0.22, _deadPos.y + 0.42, _deadPos.z - 1.45], tgt: [_deadPos.x, _deadPos.y + 0.06, _deadPos.z] };   // lower + more level, so the falling king reads fully
  // the detonation shot: a LOW, PIECE-LEVEL POV (cut to it behind the black — no visible camera move). Sits
  // just above the board and close, so the featured pieces read big in the FOREGROUND (like the hero pieces),
  // with the fireball rising behind them.
  const _boardMid = boardData.squareXYZ('d4').lerp(boardData.squareXYZ('e5'), 0.5);   // centre of the set
  const _pcEye = [4.8, 0.68, 3.98], _pcTgt = [2.25, 0.71, 1.97];   // the hero shot the user dialled in the studio — pieces surge toward THIS side
  const END_CAM = [
    { t: MATE_AT,    eye: [-0.463, 1.75, -2.965], tgt: _mateTgt, ease: 'smoother' },   // == the mate pose (seamless hand-off from setCam)
    { t: BUILD_AT,   eye: _orbEye0, tgt: _mateTgt, ease: 'smoother' },                 // hold the mate LOOK (the orbit eases off it below — no fast shift to the king)
    { t: SHOOT_AT,   eye: _orbEye1, tgt: [_orbC.x, _orbC.y, _orbC.z], ease: 'smooth' },// = the orbit end
    { t: HIT_AT,     eye: _lungeEye, tgt: [_kb[0], _kb[1], _kb[2]], ease: 'smooth' },  // LUNGE close (push-in from the orbit's end) as the bolt strikes (tgt live-tracked below)
    { t: FALL_END,   eye: _fallHold.eye, tgt: _fallHold.tgt, ease: 'smooth' },         // ride the fall down + settle
    { t: FADE_OUT,   eye: _fallHold.eye, tgt: _fallHold.tgt, ease: 'smooth' },         // hold on the lying king...
    { t: FADE_BLACK, eye: _fallHold.eye, tgt: _fallHold.tgt, ease: 'smooth' },         // ...STILL holding as the screen fades to FULL BLACK (we never see the camera move)
    { t: FADE_IN,    eye: _td(1), tgt: _tdLookA, ease: 'smooth' },                     // (behind black) NOW at the top-down — revealed as it fades in
    { t: FADE_DONE,  eye: _td(1), tgt: _tdLookA, ease: 'smoother' },                   // top-down of the defeated king — FULL body, centred — hold to comprehend
    { t: RISE_AT,    eye: _td(1), tgt: _tdLookA, ease: 'smooth' },                     // top-down HELD — the king dissolves + shakes
    { t: F2_BLACK,   eye: _td(1), tgt: _tdLookA, ease: 'smooth' },                     // …still held as the screen fades to full black
    { t: F2_BLACK + 0.01, eye: _pcEye, tgt: _pcTgt, ease: 'smooth' },                  // CUT (behind the black) to the piece-level POV — no visible move
    { t: DURATION,   eye: _pcEye, tgt: _pcTgt, ease: 'smooth' },                       // held STATIC — the slow-mo blast + scatter play out in front of it
  ];
  function _lerpEyeTgt(ks, t) {
    if (t <= ks[0].t) return ks[0];
    const last = ks[ks.length - 1]; if (t >= last.t) return last;
    let i = 0; while (i < ks.length - 1 && t > ks[i + 1].t) i++;
    const a = ks[i], b = ks[i + 1];
    const e = (_easeName[b.ease] || _easeName.smooth)((t - a.t) / (b.t - a.t));
    return { eye: [_mx(a.eye[0], b.eye[0], e), _mx(a.eye[1], b.eye[1], e), _mx(a.eye[2], b.eye[2], e)],
             tgt: [_mx(a.tgt[0], b.tgt[0], e), _mx(a.tgt[1], b.tgt[1], e), _mx(a.tgt[2], b.tgt[2], e)] };
  }
  function setEndCam(t) {
    if (t >= BUILD_AT && t < SHOOT_AT) {
      // a tense CLOSE ORBIT around the king + bishop (no lens warp): rotate around them while pushing IN closer
      const op = _q5(_clamp((t - BUILD_AT) / (SHOOT_AT - BUILD_AT)));
      const az = ORB_az0 + ORB.azOff * op, rad = _mx(ORB_r0, ORB_r0 * ORB.r1mul, op);
      camera.position.set(_orbC.x + Math.sin(az) * _orbCe * rad, _orbC.y + _orbSe * rad, _orbC.z - Math.cos(az) * _orbCe * rad);
      const lk = _q5(_clamp((t - BUILD_AT) / 1.4));   // ease the LOOK off the mate point onto the orbit centre — no fast shift to the king
      lookTarget.set(_mx(_mateTgt[0], _orbC.x, lk), _mx(_mateTgt[1], _orbC.y, lk), _mx(_mateTgt[2], _orbC.z, lk));
      return;
    }
    const p = _lerpEyeTgt(END_CAM, t);
    camera.position.set(p.eye[0], p.eye[1], p.eye[2]);
    if (t >= WOBBLE_AT && t < FALL_END + 0.25 && _theKing) { _theKing.getWorldPosition(_kpos); lookTarget.set(_kpos.x, _kpos.y + 0.26, _kpos.z); }   // track the struck + falling king (look at its MID so the full body stays framed)
    else lookTarget.set(p.tgt[0], p.tgt[1], p.tgt[2]);
  }

  // ============================================================================================
  // BRILLIANT-move flourishes — the Qd8+ sacrifice. Each is self-contained + FX-gated (kill any freely).
  // ============================================================================================
  const _Q = MOVES[1], _qLand = _Q.at + _Q.dur;
  const _qPosAt = (tt) => { const pp = _q5(_clamp((tt - _Q.at) / _Q.dur));
    return new THREE.Vector3().lerpVectors(_Q.fromXYZ, _Q.toXYZ, pp).setY(_mx(_Q.fromXYZ.y, _Q.toXYZ.y, pp) + _Q.arc * Math.sin(Math.PI * pp)); };
  const qHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex([[0, 'rgba(255,238,180,0.95)'], [0.4, 'rgba(255,205,95,0.4)'], [1, 'rgba(0,0,0,0)']]), transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
  qHalo.renderOrder = 6; qHalo.visible = false; scene.add(qHalo);   // #8 charge glow
  const _ignite = ['d3', 'd4', 'd5', 'd6', 'd7', 'd8'].map((sq) => {   // #3 d-file ignite
    const mm = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radialTex([[0, 'rgba(255,224,140,0.9)'], [0.5, 'rgba(255,185,75,0.35)'], [1, 'rgba(0,0,0,0)']]), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    mm.rotation.x = -Math.PI / 2; const pp = boardData.squareXYZ(sq); mm.position.set(pp.x, pp.y + 0.014, pp.z); mm.scale.set(0.44, 0.44, 1); mm.renderOrder = 4; mm.visible = false; scene.add(mm); return { mm, z: pp.z };
  });
  const _goldMat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(0xffd070) }, uScale: { value: 300 } },
    vertexShader: `attribute float aAlpha; attribute float aSize; uniform float uScale; varying float vA; void main(){ vA=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=min(150.0, aSize*uScale/max(0.02,-mv.z)); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ float d=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.0,d)*vA; if(a<=0.003)discard; gl_FragColor=vec4(uColor,a); }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
  const CT_N = 20, _ctGeo = new THREE.BufferGeometry(), _ctPos = new Float32Array(CT_N * 3), _ctA = new Float32Array(CT_N), _ctS = new Float32Array(CT_N);   // #2 comet trail
  _ctGeo.setAttribute('position', new THREE.BufferAttribute(_ctPos, 3)); _ctGeo.setAttribute('aAlpha', new THREE.BufferAttribute(_ctA, 1)); _ctGeo.setAttribute('aSize', new THREE.BufferAttribute(_ctS, 1));
  const _comet = new THREE.Points(_ctGeo, _goldMat); _comet.frustumCulled = false; _comet.renderOrder = 6; _comet.visible = false; scene.add(_comet);
  const GB_N = 26, _gbGeo = new THREE.BufferGeometry(), _gbPos = new Float32Array(GB_N * 3), _gbA = new Float32Array(GB_N), _gbS = new Float32Array(GB_N);   // #6 gold burst
  _gbGeo.setAttribute('position', new THREE.BufferAttribute(_gbPos, 3)); _gbGeo.setAttribute('aAlpha', new THREE.BufferAttribute(_gbA, 1)); _gbGeo.setAttribute('aSize', new THREE.BufferAttribute(_gbS, 1));
  const _gbP = []; for (let i = 0; i < GB_N; i++) { const h = (n) => { const x = Math.sin((i + 3) * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
    const th = h(1) * 6.283, ph = 0.15 + h(2) * 1.2; _gbP.push({ dir: [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)], sp: 2.4 * (0.5 + h(3) * 0.8), sz: 0.055 * (0.6 + h(4) * 0.8), aS: 0.7 + h(5) * 0.5 }); }
  const _gb = new THREE.Points(_gbGeo, _goldMat); _gb.frustumCulled = false; _gb.renderOrder = 7; _gb.visible = false; scene.add(_gb);
  const _gbOrigin = boardData.squareXYZ('d8').clone(); _gbOrigin.y += 0.2;
  const _trembleP = [...boardData.pieces.values()]; const _d8pos = boardData.squareXYZ('d8');
  function _brScale() { _goldMat.uniforms.uScale.value = 0.5 * renderer.domElement.height / Math.tan((camera.fov * Math.PI / 180) / 2); }
  _brScale();
  function setBrilliant(t) {
    // #8 — a gold halo follows the queen, its glow BUILDING through the glide, a flash at landing, then fade
    if (FX.chargeGlow && _Q.mover && t >= _Q.at - 0.1 && t < _qLand + 0.8) {
      _Q.mover.getWorldPosition(_kpos); qHalo.position.set(_kpos.x, _kpos.y + 0.22, _kpos.z);
      const build = _q5(_clamp((t - _Q.at) / _Q.dur)) * 0.7, flash = t >= _qLand ? Math.exp(-Math.pow((t - _qLand) / 0.25, 2)) : 0, out = _clamp((t - _qLand) / 0.8);
      qHalo.material.opacity = Math.max(build * (1 - out), flash); qHalo.scale.setScalar(0.55 + 0.5 * build + 0.7 * flash); qHalo.visible = qHalo.material.opacity > 0.02;
    } else qHalo.visible = false;
    // #3 — each d-file square glows as she passes over it, then fades out
    const qz = _Q.mover ? (_Q.mover.getWorldPosition(_kpos), _kpos.z) : -99;
    for (const g of _ignite) {
      if (!FX.ignite || t < _Q.at || t > _qLand + 1.2) { g.mm.visible = false; continue; }
      const k = qz >= g.z - 0.12 ? _clamp((t - _Q.at) / 0.3) : 0, fade = 1 - _clamp((t - _qLand) / 1.2);
      g.mm.material.opacity = k * 0.9 * fade; g.mm.visible = g.mm.material.opacity > 0.02;
    }
    // #2 — a comet trail of gold motes strung along her recent path, fading with age
    if (FX.cometTrail && t >= _Q.at && t < _qLand + 0.5) {
      for (let i = 0; i < CT_N; i++) { const pp = _qPosAt(t - i * 0.05), age = i / CT_N;
        _ctPos[i * 3] = pp.x; _ctPos[i * 3 + 1] = pp.y + 0.12; _ctPos[i * 3 + 2] = pp.z;
        _ctA[i] = (1 - age) * (1 - age) * 0.8 * (1 - _clamp((t - _qLand) / 0.5)); _ctS[i] = 0.16 * (1 - age * 0.7); }
      _comet.visible = true; _ctGeo.attributes.position.needsUpdate = true; _ctGeo.attributes.aAlpha.needsUpdate = true; _ctGeo.attributes.aSize.needsUpdate = true;
    } else _comet.visible = false;
    // #6 — a gold spark burst on landing + a quick board-wide tremble
    if (FX.goldBurst) {
      const age = t - _qLand;
      if (age > 0 && age < 0.8) { for (let i = 0; i < GB_N; i++) { const p = _gbP[i];
          _gbPos[i * 3] = _gbOrigin.x + p.dir[0] * p.sp * age; _gbPos[i * 3 + 1] = _gbOrigin.y + p.dir[1] * p.sp * age - 0.5 * 4.0 * age * age; _gbPos[i * 3 + 2] = _gbOrigin.z + p.dir[2] * p.sp * age;
          _gbS[i] = p.sz; _gbA[i] = p.aS * (1 - _q5(age / 0.8)); }
        _gb.visible = true; _gbGeo.attributes.position.needsUpdate = true; _gbGeo.attributes.aAlpha.needsUpdate = true; _gbGeo.attributes.aSize.needsUpdate = true;
      } else _gb.visible = false;
      // RADIAL tremble: each piece shudders as the shockwave RING sweeps past it — in order, from d8 outward
      if (age > 0 && age < SHOCK.dur + 0.4) {
        const rad = shockRadius(age);
        for (let i = 0; i < _trembleP.length; i++) { const w = _trembleP[i];
          const te = rad - Math.hypot(w.position.x - _d8pos.x, w.position.z - _d8pos.z);   // how far the ring front has passed this piece
          if (te > 0 && te < 0.5) { const env = Math.sin((te / 0.5) * Math.PI);   // the wave LIFTS each piece as it passes — a natural little hop
            w.position.y += 0.055 * env; }
        }
      }
    } else _gb.visible = false;
    // #9 — foreshadow the net: the rook's d-file line flashes for a beat after she lands (reuses the attack beam)
    if (FX.foreshadow && t >= _qLand + 0.15 && t < _qLand + 1.1) aimBeam(rookBeam, 'd1', 'd8', Math.sin(_clamp((t - (_qLand + 0.15)) / 0.95) * Math.PI) * 0.6);
  }

  // ============================================================================================
  // THE MUSHROOM CLOUD — the dissolving king detonates: a YELLOW ground SHOCKWAVE (the brilliant boom, but
  // yellow) + a rising FIREBALL that mushrooms into a billowing vortex-ring cap, glowing brighter until the
  // whole screen goes WHITE for the final message. Deterministic → bakes. (Real cloud physics: a buoyant
  // column rises and its edges curl into a vortex ring → the cap.)
  // ============================================================================================
  const _blast = boardData.squareXYZ('c7'); const _blastY = _blast.y;
  // SLOW MOTION: the blast starts FAST (the first frames), then eases into slow-mo so the mushroom + the neat
  // outward scatter can be savoured. eAge(t) is the effective age the mushroom / scatter / whiteout all read.
  const eAge = (t) => { const r = t - EXPLODE_AT; if (r <= 0) return 0; return r < 0.22 ? 2.3 * r : 0.506 + (r - 0.22) * 0.45; };
  const _exRing = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),   // the yellow ground shockwave
    new THREE.MeshBasicMaterial({ map: shockTex(), color: 0xffd23a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  _exRing.rotation.x = -Math.PI / 2; _exRing.position.set(_blast.x, _blastY + 0.03, _blast.z); _exRing.renderOrder = 9; _exRing.visible = false; scene.add(_exRing);
  const _fireball = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex([[0, 'rgba(255,255,240,1)'], [0.3, 'rgba(255,214,90,0.9)'], [0.65, 'rgba(255,120,30,0.4)'], [1, 'rgba(0,0,0,0)']]), transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
  _fireball.renderOrder = 10; _fireball.visible = false; scene.add(_fireball);   // the rising fireball core
  // ---- a REAL fire billboard: the roiling fireball + column. Ported from a self-contained procedural fire
  // shader (simplex noise → fbm → fire gradient, NO textures), masked to a mushroom silhouette. Faces the
  // camera; rises + grows; driven by eAge → bakes. Toggle: FX.fireShader. ----
  const _fbMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uFade: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'precision highp float; varying vec2 vUv; uniform float uTime, uFade;',
      'vec2 hash(vec2 p){ p = vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3))); return -1.0 + 2.0*fract(sin(p)*43758.5453123); }',
      'float noise(in vec2 p){ const float K1=0.366025404, K2=0.211324865; vec2 i=floor(p+(p.x+p.y)*K1); vec2 a=p-i+(i.x+i.y)*K2; vec2 o=step(a.yx,a.xy); vec2 b=a-o+K2; vec2 c=a-1.0+2.0*K2; vec3 h=max(0.5-vec3(dot(a,a),dot(b,b),dot(c,c)),0.0); vec3 n=h*h*h*h*vec3(dot(a,hash(i+0.0)),dot(b,hash(i+o)),dot(c,hash(i+1.0))); return dot(n, vec3(70.0)); }',
      'float fbm(in vec2 p){ float f=0.0; mat2 m=mat2(1.6,1.2,-1.2,1.6); f=0.5*noise(p); p=m*p; f+=0.25*noise(p); p=m*p; f+=0.125*noise(p); p=m*p; f+=0.0625*noise(p); return 0.5+0.5*f; }',
      'void main(){',
      '  vec2 uv = vUv;',
      '  vec2 cc = (uv - vec2(0.5, 0.5));',                          // a ROUND fireball (not a mushroom column)
      '  float shape = smoothstep(0.5, 0.06, length(cc));',
      '  float boil = fbm(uv * 4.5 + vec2(0.0, -uTime * 0.5));',
      '  shape *= 0.5 + 0.7 * boil; shape = smoothstep(0.28, 0.72, shape);',
      '  float n = fbm(uv * vec2(5.0, 6.0) + vec2(uTime * 0.06, -uTime * 0.6));',
      '  vec3 col = n * vec3(2.2*n, 2.0*n*n*n, n*n*n*n) * 3.4;',   // hotter, brighter fire gradient
      '  col += vec3(1.5, 0.95, 0.5) * pow(shape, 2.6);',          // a white-hot GLOWING core (blooms into the whiteout)
      '  float alpha = shape * (0.5 + 0.9 * n) * uFade;',
      '  if (alpha < 0.01) discard;',
      '  gl_FragColor = vec4(col, alpha);',
      '}',
    ].join('\n'),
    transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  const _fb = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), _fbMat); _fb.renderOrder = 9; _fb.frustumCulled = false; _fb.visible = false; scene.add(_fb);
  // the mushroom cloud: a narrow STEM + a wide DOME cap whose edges curl down (the vortex ring), billowing +
  // rising. Coloured fire-orange at the base → dim smoke-grey up top (aH = height fraction, fed per-frame).
  const MUSH = { n: 220, dur: 3.8, capH: 1.15, capR: 2.1, dome: 0.85, stemR: 0.24 };
  const _muGeo = new THREE.BufferGeometry();
  const _muPos = new Float32Array(MUSH.n * 3), _muA = new Float32Array(MUSH.n), _muS = new Float32Array(MUSH.n), _muH = new Float32Array(MUSH.n);
  _muGeo.setAttribute('position', new THREE.BufferAttribute(_muPos, 3)); _muGeo.setAttribute('aAlpha', new THREE.BufferAttribute(_muA, 1));
  _muGeo.setAttribute('aSize', new THREE.BufferAttribute(_muS, 1)); _muGeo.setAttribute('aH', new THREE.BufferAttribute(_muH, 1));
  // a normal explosion BURST: each particle flies out from the blast in a random direction (biased up + out),
  // rises then falls under gravity, and fades fire→smoke. Deterministic (seeded per-i) → bakes with the clip.
  const _muP = [];
  for (let i = 0; i < MUSH.n; i++) { const h = (n) => { const x = Math.sin((i + 9) * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
    const ang = h(1) * 6.283, rad = 0.5 + h(2) * 1.7;                             // outward radial speed
    _muP.push({ dx: Math.cos(ang) * rad, dz: Math.sin(ang) * rad, dy: 0.5 + h(3) * 1.9,  // up bias
      spd: 0.7 + h(4) * 1.5, size: 0.34 + h(6) * 0.5, wob: h(7) * 6.283, aS: 0.4 + h(8) * 0.45, smoke: 0.2 + h(5) * 0.8 }); }
  const _muMat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 300 } },
    vertexShader: `attribute float aAlpha; attribute float aSize; attribute float aH; uniform float uScale; varying float vA; varying float vH;
      void main(){ vA = aAlpha; vH = aH; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = min(420.0, aSize * uScale / max(0.02, -mv.z)); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; varying float vH; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.03, d) * vA; if (a <= 0.003) discard;
      vec3 fire = vec3(1.0, 0.55, 0.13), smoke = vec3(0.42, 0.4, 0.42);
      vec3 col = mix(fire, smoke, smoothstep(0.05, 0.5, vH));   // glowing fire at the base → grey smoke up top
      gl_FragColor = vec4(col + vec3(0.55) * a * (1.0 - vH), a); }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending });
  const _mush = new THREE.Points(_muGeo, _muMat); _mush.frustumCulled = false; _mush.renderOrder = 10; _mush.visible = false; scene.add(_mush);
  function _muScale() { _muMat.uniforms.uScale.value = 0.5 * renderer.domElement.height / Math.tan((camera.fov * Math.PI / 180) / 2); }
  _muScale();
  function setMushroom(t) {
    const age = eAge(t);   // slow-motion time
    if (t < EXPLODE_AT || age > MUSH.dur + 0.6) { _mush.visible = false; _fireball.visible = false; _exRing.visible = false; _fb.visible = false; _heatStrength = 0; return; }
    // heat haze: snaps on with the blast, lingers through the fireball, gone before the calm hero reveal
    _heatTime = age; _heatStrength = (age < 0.12 ? _clamp(age / 0.12) : 1) * (1 - _q5(_clamp((age - 1.9) / 1.3)));
    if (FX.fireShader) {                                            // the REAL fire billboard: rises + grows, faces the camera
      _fb.visible = true; const g = _q5(_clamp(age / 1.2)); const S = 1.1 + 4.2 * g;   // a round fireball that blooms + rises
      _fb.scale.set(S, S, 1); _fb.position.set(_blast.x, _blastY + 0.35 + S * 0.22, _blast.z); _fb.quaternion.copy(camera.quaternion);
      _fbMat.uniforms.uTime.value = age; _fbMat.uniforms.uFade.value = (age < 0.2 ? _clamp(age / 0.2) : 1) * (1 - _q5(_clamp((age - 1.35) / 1.0)));   // fully gone before the calm hero reveal
    } else _fb.visible = false;
    if (age < 1.7) { _exRing.visible = true; const rk = age / 1.7, sc = 0.2 + 30 * (1 - (1 - rk) * (1 - rk)); _exRing.scale.set(sc, sc, 1); _exRing.material.opacity = 0.9 * (1 - _q5(rk)); }
    else _exRing.visible = false;
    const fb = _clamp(age / 2.4); _fireball.visible = fb < 0.99;   // the fireball rises then dims into the cloud
    _fireball.position.set(_blast.x, _blastY + 0.2 + 2.0 * _q5(fb), _blast.z); _fireball.scale.setScalar(0.6 + 2.5 * _q5(fb));
    _fireball.material.opacity = (age < 0.18 ? _clamp(age / 0.18) : 1) * (1 - _q5(_clamp((age - 1.3) / 1.5)));
    _mush.visible = true;
    for (let i = 0; i < MUSH.n; i++) { const p = _muP[i];
      const s = p.spd, wob = 0.12 * Math.sin(age * 1.6 + p.wob);
      const x = p.dx * s * age + wob, z = p.dz * s * age + wob;
      const y = p.dy * s * age - 0.4 * age * age;                                  // rise, then gravity pulls it back
      _muPos[i * 3] = _blast.x + x; _muPos[i * 3 + 1] = _blastY + 0.16 + Math.max(-0.1, y); _muPos[i * 3 + 2] = _blast.z + z;
      _muS[i] = p.size * (0.6 + age * 0.6);                                         // swell as it dissipates
      _muH[i] = p.smoke * _q5(_clamp(age / 1.4));                                   // fire → smoke over time
      _muA[i] = p.aS * (age < 0.18 ? _clamp(age / 0.18) : 1) * (1 - _q5(_clamp((age - 1.1) / 1.7))); }
    _muGeo.attributes.position.needsUpdate = true; _muGeo.attributes.aAlpha.needsUpdate = true; _muGeo.attributes.aSize.needsUpdate = true; _muGeo.attributes.aH.needsUpdate = true;
  }
  // the blast keeps just a FEW pieces (the hero shot): they surge into the FOREGROUND close to camera, TILTED
  // outward (right-side pieces lean right, left lean left), then hover + turn slowly. Every OTHER piece is blown
  // clean out of frame. Deterministic → bakes.
  const _scPieces = _trembleP.filter((w) => w !== _theKing && w !== MOVES[0].cap_g && w !== MOVES[2].cap_g);
  const _bc = new THREE.Vector3(); _scPieces.forEach((w) => _bc.add(w.position)); if (_scPieces.length) _bc.multiplyScalar(1 / _scPieces.length);
  // featured survivors re-form from the whiteout, then GLIDE IN like the hero pieces (above-and-to-a-side →
  // lean → straighten → soft-land). hide = eAge at which they snap to their sky start (hidden under full white);
  // glide = how long the descent takes; lat/tilt = when the sideways offset / the lean have fully closed.
  const HERO = { hide: 1.4, glide: 1.8, lat: 0.6, tilt: 0.72 };
  // THE FINAL TABLEAU — the exact poses the user dialled in the studio (📋 Copy piece layout). Four surviving
  // black pieces GLIDE into the FOREGROUND and settle here; every OTHER piece is blown clean out of frame.
  // pos = parent-local position · rotDeg = local XYZ euler (degrees) · front = renders IN FRONT of the CTA text.
  const TABLEAU = [
    { sq: 'a8', pos: [1.04, 1.15, 2.59],  rot: [-9, 46, -28] },                 // black rook — nudged up + left
    { sq: 'b8', pos: [3.6, 0.42, 3.76],  rot: [14, -17, 2] },                   // black knight
    { sq: 'c8', pos: [4.25, 1.08, 2.24], rot: [-180, -88, 34] },                // black bishop
    { sq: 'f6', pos: [2.75, 0.29, 1.02], rot: [136, 32, -148], front: true },   // black knight — nudged left
  ];
  const _D2R = Math.PI / 180, _frontPieces = [], _tabByPiece = new Map();
  for (const spec of TABLEAU) {
    const w = _scPieces.find((p) => p.userData && p.userData.square === spec.sq);
    if (!w) continue;
    const target = new THREE.Vector3(spec.pos[0], spec.pos[1], spec.pos[2]);
    const targetQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(spec.rot[0] * _D2R, spec.rot[1] * _D2R, spec.rot[2] * _D2R, 'XYZ'));
    _tabByPiece.set(w, { target, targetQ, front: !!spec.front });
    if (spec.front) _frontPieces.push(w);
  }
  const _scat = _scPieces.map((w, i) => {
    const h = (n) => { const x = Math.sin((i + 5) * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
    const tab = _tabByPiece.get(w), featured = !!tab;
    // the hero-glide START: above the dialled pose + a per-piece sideways offset it glides in from
    const gStart = tab ? tab.target.clone().add(new THREE.Vector3(
      Math.cos(h(8) * 6.283) * (0.9 + h(9) * 1.3), 2.6 + h(10) * 1.3, Math.sin(h(8) * 6.283) * (0.9 + h(9) * 1.3))) : null;
    return { w, idx: i, rest: null, restQ: null, away: null, featured,   // rest/away/restQ captured LAZILY at the blast (pieces have moved by then)
      target: tab ? tab.target : null, targetQ: tab ? tab.targetQ : null,
      gStart, lean: (0.10 + h(11) * 0.15) * (h(12) < 0.5 ? -1 : 1),   // a small left/right lean that straightens before touchdown
      hAmp: 0.014 + h(3) * 0.02, hPh: h(4) * 6.283, hFq: 0.45 + h(5) * 0.3, spin: (h(6) < 0.5 ? -1 : 1) * (0.09 + h(7) * 0.07), flySp: 5.5 + h(1) * 4 };
  });
  const _headQ = new THREE.Quaternion();
  function setScatter(t) {
    if (t < EXPLODE_AT) return;
    const a = eAge(t);
    for (const s of _scat) {
      if (!s.rest) {   // capture the piece's ACTUAL pose at the blast (it has moved since build)
        s.rest = s.w.position.clone(); s.restQ = s.w.quaternion.clone();
        s.away = s.rest.clone().sub(_bc); s.away.y = 0;
        if (s.away.lengthSq() < 1e-4) s.away.set(Math.cos(s.idx * 2.4), 0, Math.sin(s.idx * 2.4)); s.away.normalize();
      }
      if (s.featured) {
        if (a < HERO.hide) {                                                     // …blown out with the rest while the whiteout builds over them…
          s.w.position.copy(s.rest).addScaledVector(s.away, s.flySp * a);
          s.w.position.y = s.rest.y + 3.0 * a - 0.5 * 4.0 * a * a;
          _headQ.setFromUnitVectors(_UP, s.away);
          s.w.quaternion.copy(s.restQ).slerp(_headQ, _q5(_clamp(a / 0.4)));
          s.w.visible = s.w.position.y > -6;
        } else {                                                                 // …then GLIDE IN out of the white (hero-style): sideways offset closes early, soft vertical land
          const gp = _clamp((a - HERO.hide) / HERO.glide);
          const latP = _smoother(_clamp(gp / HERO.lat));                         // lateral closes early → straight-down, centred touchdown
          const vP = _smoother(gp);                                             // soft, decelerating descent
          s.w.position.set(
            s.gStart.x + (s.target.x - s.gStart.x) * latP,
            s.gStart.y + (s.target.y - s.gStart.y) * vP,
            s.gStart.z + (s.target.z - s.gStart.z) * latP);
          s.w.position.y += s.hAmp * Math.sin(a * s.hFq * 6.283 + s.hPh) * vP;   // a barely-there hover once it's alive
          const roll = s.lean * (1 - _smoother(_clamp(gp / HERO.tilt)));         // the lean straightens before it lands
          _rollQ.setFromAxisAngle(_WORLDZ, roll);
          s.w.quaternion.multiplyQuaternions(_rollQ, s.targetQ);                 // world lean ∘ the dialled orientation
          s.w.visible = true;
        }
      } else {                                                                    // everyone else: blown out, HEAD-FIRST away from the king
        s.w.position.copy(s.rest).addScaledVector(s.away, s.flySp * a);
        s.w.position.y = s.rest.y + 3.0 * a - 0.5 * 4.0 * a * a;
        _headQ.setFromUnitVectors(_UP, s.away);                                  // head leads along `away`, base trails toward the king
        s.w.quaternion.copy(s.restQ).slerp(_headQ, _q5(_clamp(a / 0.4)));        // snap into the spear pose in the first instants
        s.w.visible = a < 1.8 && s.w.position.y > -6;
      }
    }
  }
  // the whiteout is the explosion's OWN brightness blowing out the screen — it builds WITH the fireball's
  // peak (not as a separate fade after it dies), tops out as the blast is brightest, then RECEDES to reveal
  // the settled tableau. eAge peak ≈1.5 = right when the fireball glows hottest + the pieces reach their pose.
  function flashAt(t) { const e = eAge(t); return _q5(_clamp((e - 0.55) / 0.95)) * (1 - _q5(_clamp((e - 1.8) / 1.6))); }   // recede is SLOW + long-tailed so nothing snaps as the scene resolves out of the white
  function flashGrowAt(t) { return _q5(_clamp(eAge(t) / 1.4)); }                  // radius fills fast so the brightness engulfs the frame at the peak
  function ctaAt(t) { return _q5(_clamp((t - (EXPLODE_AT + 4.1)) / 1.8)); }       // the invitation (+ its bottom scrim) rises WITH the surviving pieces as the whiteout recedes

  let directorMode = false;   // dev camera-director tool: when on, frame() leaves the camera to the user's OrbitControls
  function setDirector(b) { directorMode = !!b; }
  let _shadowFrame = 0;       // shadow-map re-bake is HALF-RATE: a full scene pass from the light's POV every frame is wasted on these soft, slow shadows — updating at half the framerate is imperceptible (≤1 frame lag) and halves that cost
  // ===== THE ASSEMBLY ENTRY (the coach → finale transition; scroll-SCRUBBED so it reverses) =======
  // The canvas is alpha:true — during assembly the scene has NO background, so the set floats on the
  // PAGE itself (white in light theme): the table rises from below, the lamp (with its cord) drops from
  // above, the board slides in from the side — each part fading in. Once everything is set up, the
  // "lights go out": the dark room fades in around the set (clear-color alpha 0→1 + fog returns), and
  // only then does the game clock start (the pieces drop). setAssembly(p) is a PURE function of
  // p∈[0,1] driven by scroll in ender.js — scrolling back up plays the whole entry in reverse.
  // The offline render path never calls setAssembly, so bakes are untouched.
  const ASSEMBLY = {
    table: [0.02, 0.40], lamp: [0.16, 0.56], board: [0.40, 0.78],   // per-part windows within p
    dark: [0.72, 1.0],                                              // the room fades in around the finished set
    tableFrom: [0, -3.2, 0], lampFrom: [0, 3.6, 0], boardFrom: [-4.8, 0.6, 0],   // where each part glides in from
  };
  const _asmBg = scene.background;            // the authored dark background Color instance (restored at p=1)
  const _asmFog = scene.fog.density;
  function _collectMats(obj, arr, skip) {
    if (skip && skip.has(obj)) return;
    if ((obj.isMesh || obj.isSprite) && obj.material && arr.indexOf(obj.material) < 0) arr.push(obj.material);
    for (const c of obj.children) _collectMats(c, arr, skip);
  }
  const _pieceWraps = new Set(boardData.pieces.values());   // pieces own their opacity (setIntro) — never touch them here
  const _asmParts = [
    { group: setGroup, win: ASSEMBLY.table, from: ASSEMBLY.tableFrom, mats: [] },
    { group: lampGroup, win: ASSEMBLY.lamp, from: ASSEMBLY.lampFrom, mats: [] },
    { group: boardData.root, win: ASSEMBLY.board, from: ASSEMBLY.boardFrom, mats: [] },
  ];
  for (const part of _asmParts) {
    _collectMats(part.group, part.mats, _pieceWraps);
    part.base = part.group.position.clone();
    part.state = part.mats.map((m) => ({ m, op: m.opacity, tr: m.transparent }));
  }
  const _beamBase2 = VolMat.uniforms.uBeamScale.value;
  let _asmP = -1;
  function setAssembly(p) {
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    if (p >= 1) {                                     // fully assembled → hand everything back untouched
      if (_asmP === 1) return;                        // restore once; after that frame() owns everything again
      _asmP = 1;
      scene.background = _asmBg;
      for (const part of _asmParts) {
        part.group.position.copy(part.base); part.group.visible = true;
        for (const s of part.state) { s.m.opacity = s.op; s.m.transparent = s.tr; }
      }
      VolMat.uniforms.uBeamScale.value = _beamBase2;
      return;
    }
    _asmP = p;   // NOTE: partial p re-applies EVERY call (no memo) — frame()'s setEffects rewrites
    // fog/background each frame, so a memoized skip would let the full fog flood back mid-assembly
    const dark = _smoother((p - ASSEMBLY.dark[0]) / (ASSEMBLY.dark[1] - ASSEMBLY.dark[0]));
    scene.background = null;                          // page shows through; the dark room fades in via clear alpha
    renderer.setClearColor(_asmBg, dark);
    scene.fog.density = _asmFog * dark;               // fog only once the room exists (it would tint parts on white)
    VolMat.uniforms.uBeamScale.value = _beamBase2 * dark;   // the visible light cone belongs to the dark room
    for (const part of _asmParts) {
      const e = _smoother((p - part.win[0]) / (part.win[1] - part.win[0]));
      part.group.visible = e > 0.001;
      part.group.position.set(
        part.base.x + part.from[0] * (1 - e),
        part.base.y + part.from[1] * (1 - e),
        part.base.z + part.from[2] * (1 - e),
      );
      for (const s of part.state) { s.m.transparent = true; s.m.opacity = s.op * e; }
    }
  }

  // frame(t): the master cinematic clock. setShot stays exported for the offline render stage.
  function frame(t) {
    setIntro(t);                          // lands + reveals every piece at its rest (cheap; idempotent for large t)
    setKing(t);                           // the two kings drop straight down, one at a time, after the rest have landed
    if (t >= MOVE_START) setMoves(t);     // move the pieces first (so the ending camera can track the falling king)
    if (!directorMode) {                  // DIRECTOR MODE (dev tool): the user's OrbitControls own the camera — skip the cinematic camera
      if (setKingCam(t)) { /* the king entrances own the camera */ }
      else if (t >= MATE_AT) setEndCam(t);  // the death sequence owns the camera (close-up → top-down → crane away)
      else setCam(t);                       // the move cinematic's keyframed path
    }
    setSmoke(t);                          // dust puffs kicked up where the two kings land
    setShock(t);                          // the brilliant "boom" shockwave when the queen lands on d8
    setKillBeam(t);                       // the bishop's kill-bolt fired from the top of its head at the king
    setImpact(t);                         // hot sparks + a flash where the bolt strikes (impact damage)
    setEffects(t);
    setBrilliant(t);                      // the Qd8+ flourishes (charge glow · ignite · gold burst + tremble · foreshadow)
    setMushroom(t);                       // the king's detonation → a rising yellow MUSHROOM CLOUD + ground shockwave → whiteout
    setScatter(t);                        // …and the blast blows every remaining piece off the board (runs LAST — owns the piece transforms)
    if (t <= MOVES_END + 0.2 && (++_shadowFrame & 1)) renderer.shadowMap.needsUpdate = true;   // shadows track the rain + the moves (half-rate), then freeze
  }

  // ---- named beats, for keyboard step-through (each plays start→end as one burst, then holds at its end) ----
  // The ends sit on natural HOLD frames (just before the next fade/move) so a paused beat reads cleanly.
  const SCENES = [
    { label: 'The board assembles', start: 0,                 end: FO_A_S },
    { label: 'The black king lands', start: FO_A_S,           end: FO_B_S },
    { label: 'The white king lands', start: FO_B_S,           end: FO_C_S },
    { label: 'Blunder · Nxe4',       start: FO_C_S,           end: MOVES[1].at - 0.4 },
    { label: 'Sacrifice · Qd8+',     start: MOVES[1].at - 0.4, end: MOVES[2].at - 0.4 },
    { label: 'Forced · Kxd8',        start: MOVES[2].at - 0.4, end: MOVES[3].at - 0.4 },
    { label: 'Double check · Bg5+',  start: MOVES[3].at - 0.4, end: MOVES[4].at - 0.4 },
    { label: 'The king flees · Kc7', start: MOVES[4].at - 0.4, end: MOVES[5].at - 0.4 },
    { label: 'Mate · Bd8#',          start: MOVES[5].at - 0.4, end: BUILD_AT },
    { label: 'The king falls',       start: BUILD_AT,         end: FADE_OUT },
    { label: 'Defeat',               start: FADE_OUT,         end: RISE_AT },
    { label: 'Detonation · the end', start: RISE_AT,          end: DURATION },
  ];

  // ---- HEAT DISTORTION: real screen-space refraction over the fireball. Core THREE only (a render target +
  // a fullscreen quad), NO addon imports, so it never touches the studio's boot path. The scene is rendered
  // to a target, then a passthrough quad re-samples it with a rising fbm heat-haze offset, masked to the blast
  // and ramped by _heatStrength (set in setMushroom). When strength≈0 the offset is 0 → a pixel-identical
  // passthrough. Deterministic → bakes with the clip. Manual linear→sRGB keeps colour 1:1 with a direct render.
  let _heatStrength = 0, _heatTime = 0;
  const _heatRT = new THREE.WebGLRenderTarget(1, 1, { magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, depthBuffer: false });
  const _heatCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const _heatScene = new THREE.Scene();
  const _heatMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uStrength: { value: 0 }, uAspect: { value: 1 }, uCenter: { value: new THREE.Vector2(0.5, 0.5) }, uRadius: { value: 0.55 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: [
      'precision highp float; varying vec2 vUv;',
      'uniform sampler2D tDiffuse; uniform float uTime, uStrength, uAspect, uRadius; uniform vec2 uCenter;',
      'vec2 hash(vec2 p){ p = vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3))); return -1.0 + 2.0*fract(sin(p)*43758.5453123); }',
      'float noise(in vec2 p){ const float K1=0.366025404, K2=0.211324865; vec2 i=floor(p+(p.x+p.y)*K1); vec2 a=p-i+(i.x+i.y)*K2; vec2 o=step(a.yx,a.xy); vec2 b=a-o+K2; vec2 c=a-1.0+2.0*K2; vec3 h=max(0.5-vec3(dot(a,a),dot(b,b),dot(c,c)),0.0); vec3 n=h*h*h*h*vec3(dot(a,hash(i+0.0)),dot(b,hash(i+o)),dot(c,hash(i+1.0))); return dot(n, vec3(70.0)); }',
      'float fbm(in vec2 p){ float f=0.0; mat2 m=mat2(1.6,1.2,-1.2,1.6); f=0.5*noise(p); p=m*p; f+=0.25*noise(p); p=m*p; f+=0.125*noise(p); return 0.5+0.5*f; }',
      'void main(){',
      '  vec2 d = vUv - uCenter; d.x *= uAspect; float dist = length(d);',
      '  float radial = smoothstep(uRadius, 0.0, dist);',
      '  float above = smoothstep(-0.14, 0.42, vUv.y - uCenter.y);',   // heat rises → more haze above the blast
      '  float mask = radial * mix(0.28, 1.0, above) * uStrength;',
      '  float n1 = fbm(vec2(vUv.x*13.0, vUv.y*7.0 - uTime*2.1));',
      '  float n2 = fbm(vec2(vUv.x*21.0 + 4.0, vUv.y*10.0 - uTime*3.1));',
      '  vec2 off = vec2(n1-0.5, (n2-0.5)*1.7) * 0.058 * mask;',       // stronger, clearly-visible heat wobble
      '  off.y += 0.015 * mask * sin(vUv.x*46.0 + uTime*7.0);',        // rising shimmer
      '  vec3 lin = texture2D(tDiffuse, clamp(vUv + off, 0.001, 0.999)).rgb;',
      '  vec3 srgb = mix(lin*12.92, 1.055*pow(max(lin,0.0), vec3(0.41666))-0.055, step(0.0031308, lin));',
      '  gl_FragColor = vec4(srgb, 1.0);',
      '}',
    ].join('\n'),
    depthTest: false, depthWrite: false, toneMapped: false,
  });
  _heatScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), _heatMat));
  const _heatV = new THREE.Vector3();
  function _sizeHeatRT() { const el = renderer.domElement; _heatRT.setSize(el.width, el.height); _heatMat.uniforms.uAspect.value = el.width / Math.max(1, el.height); }
  _sizeHeatRT();

  // ---- FRONT-OF-TEXT layer: the dialled hero piece(s) render to a SEPARATE canvas the caller stacks ABOVE the
  // HTML CTA copy, so they read IN FRONT of the text. Core THREE only; the caller owns the canvas + the timing.
  // setFrontActive(true) moves the flagged pieces onto layer 1 (so the MAIN render drops them) — call it only
  // during the reveal; renderFront() then draws just those pieces (camera on layer 1) into the front canvas.
  let _frontR = null;
  function setFrontActive(on) { const L = on ? 1 : 0; for (const w of _frontPieces) w.traverse((c) => c.layers.set(L)); }
  function renderFront(canvas) {
    if (!_frontPieces.length || !canvas) return;
    if (!_frontR) {
      _frontR = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      _frontR.setPixelRatio(Math.min(1.5, (typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1)));
      _frontR.setClearColor(0x000000, 0); _frontR.outputColorSpace = renderer.outputColorSpace; _frontR.toneMapping = renderer.toneMapping;
      _frontR.setSize(innerWidth, innerHeight);
      scene.traverse((o) => { if (o.isLight) o.layers.enableAll(); });   // lights must reach layer 1 too
    }
    _frontR.toneMappingExposure = renderer.toneMappingExposure;
    const bg = scene.background; scene.background = null;
    camera.layers.set(1); _frontR.render(scene, camera); camera.layers.set(0);
    scene.background = bg;
  }
  function _resizeFront() { if (_frontR) _frontR.setSize(innerWidth, innerHeight); }

  // ---- public api ----
  function render() {
    camera.lookAt(lookTarget); camera.updateMatrixWorld();
    if (_heatStrength > 0.01) {                       // composite the heat-haze pass over the blast
      _heatV.set(_blast.x, _blastY + 1.2, _blast.z).project(camera);
      _heatMat.uniforms.uCenter.value.set(_heatV.x * 0.5 + 0.5, _heatV.y * 0.5 + 0.5);
      _heatMat.uniforms.uStrength.value = _heatStrength; _heatMat.uniforms.uTime.value = _heatTime;
      renderer.setRenderTarget(_heatRT); renderer.render(scene, camera); renderer.setRenderTarget(null);
      _heatMat.uniforms.tDiffuse.value = _heatRT.texture;
      renderer.render(_heatScene, _heatCam);
    } else renderer.render(scene, camera);
  }
  function resize() {
    const w = innerWidth, h = innerHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
    sizeVignette();   // aspect changed → re-fit the camera-child vignette to the new frame
    _smokeScale();    // drawing-buffer height changed → keep the particle point-size world-correct
    _sparkScale();
    _ashScale();
    _brScale();
    _muScale();
    _sizeHeatRT();    // keep the heat render-target matched to the drawing buffer
    _resizeFront();   // keep the front-of-text canvas matched to the viewport
  }
  // ---- WARM-UP: kill the first-play jank ----------------------------------------------------------
  // Shader programs compile and textures upload lazily on an object's FIRST rendered frame, so the
  // first pass through the cinematic used to hitch at every arrival (each piece, the flare, the beams,
  // the mushroom, the heat-haze pass). Render ONE frame of every beat now, while the canvas is still
  // invisible (CSS opacity 0), then reset to t=0 — frame(t) is a pure function of t, so this is safe.
  function warmup() {
    renderer.compile(scene, camera);
    const beats = [0, 1.6, FO_A_S + 0.3, BLACK_KING_AT + 0.3,          // rain · king cut shots
      MOVES[0].at + 0.5, MOVES[1].at + 0.9,                            // blunder glow · sacrifice flare
      MOVES[3].at + 0.8, MOVES[5].at + 0.4,                            // double-check beams · mate
      BUILD_AT + 0.5, EXPLODE_AT + 0.3, EXPLODE_AT + 1.4,              // king fall · fireball/mushroom · heat haze + whiteout
      EXPLODE_AT + 5.0, DURATION - 0.5];                               // hero backdrop · settled tableau
    for (const t of beats) { frame(t); render(); }
    // the late beats above dissolve the captured queen (Kxd8) + the king to uDis=1 / visible=false. frame(0)
    // does NOT run setMoves (t<MOVE_START), so it never resets their dissolve → on the LIVE path they stay
    // fully DISCARDED by the shader (invisible) until their own move window rewrites uDis. Un-dissolve them
    // here; the trailing frame(0) then re-asserts the correct `visible` via setIntro/setKing. (The offline
    // render never warms up + walks t upward from 0, so uDis is already 0 there — this only bites live.)
    if (FX.dissolveQueen && MOVES[2].cap_g) setDissolve(MOVES[2].cap_g, 0);
    if (FX.dissolveKing && _theKing) setDissolve(_theKing, 0);
    frame(0); render();                                                // leave it clean at the start
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
    scene, camera, renderer, lookTarget, render, resize, tick, setShot, frame, badgeAt, evalAt, cutFadeAt, flashAt, flashGrowAt, ctaAt, setDirector, scenes: SCENES, duration: DURATION, explodeAt: EXPLODE_AT,
    setAssembly, warmup,
    frontPieces: _frontPieces, setFrontActive, renderFront,
    pieces: boardData.pieces, GRID: boardData.GRID, squareXYZ: boardData.squareXYZ,
    refs: { spot, wash, beam, VolMat, fog: scene.fog, bulbGlass, amb, coolRim, cyanRim, warmRim, lampGroup, boardRoot: boardData.root, rookBeam, bishopBeam },
  };
}
