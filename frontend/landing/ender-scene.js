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

  // ---- public api ----
  function render() { camera.lookAt(lookTarget); camera.updateMatrixWorld(); renderer.render(scene, camera); }
  function resize() {
    const w = innerWidth, h = innerHeight;
    camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
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
    scene, camera, renderer, lookTarget, render, resize, tick, setShot,
    pieces: boardData.pieces, GRID: boardData.GRID, squareXYZ: boardData.squareXYZ,
    refs: { spot, wash, beam, VolMat, fog: scene.fog, bulbGlass, amb, coolRim, cyanRim, warmRim, lampGroup, boardRoot: boardData.root },
  };
}
