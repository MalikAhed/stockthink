// logoGears.js — 3D gears wrapped around the Stockfish logo on the closing "talks" slide.
// Same gear.glb + locked material look as gears.js, but a SEPARATE instance so the approved
// Beat-1 gears stay untouched. Two canvases inside .sf-orb: .lg-back (behind the logo, z1) and
// .lg-front (in front, z3) → real depth around the logo. Gears spin constantly = "processing".
// TUNE = material/tilt (matched to gears.js); LGEARS = the per-gear layout (tunable, see stLogoGears).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { fpsGate, QUALITY, registerRenderer } from './perf.js';

const RM = () => matchMedia('(prefers-reduced-motion:reduce)').matches;

// ---- material/tilt (matched to gears.js so both gear groups read identical) ----
const TUNE = { tiltX:0.017, tiltY:0.192, sat:0.56, tint:'#d1e5ff', bright:2.00, rough:1.00, metal:1.00, env:2.00 };

// ---- spin feel ----
// idle    = radians/frame of the always-on "processing" spin (cuts out while scrolling)
// scrollK = radians per px of scroll (gears track scroll speed + direction)
// resume  = how fast the idle spin fades back in after scrolling stops (0..1)
const SPIN = { idle:0.009, scrollK:0.0024, resume:0.12 };

// ---- the gears wrapped around the logo, clustered + meshed so it reads as an ENGINE.
// Mix of BIG and SMALL gears at DIFFERENT depths (z) split across the two layers (front:true → in
// front of the logo, false → behind). Neighbours spin opposite directions (dir) like a real gear
// train. x/y are world units (the logo spans roughly ±1.6); s = scale; spin = relative speed. ----
const LGEARS = [
  // user-tuned layout (baked 2026-06-17 via the Edit Interface) — 6 gears, mixed sizes/depths
  { x: 1.05, y: 1.30, z:-1.30, s:2.00, dir: 1, spin:0.85, front:false },  // big anchor, behind upper-right
  { x:-0.10, y: 1.45, z:-1.10, s:1.20, dir:-1, spin:1.05, front:false },  // behind, top-centre
  { x:-1.25, y:-0.95, z:-1.40, s:1.30, dir: 1, spin:1.40, front:true  },  // front, lower-left
  { x: 1.40, y: 0.10, z:-0.90, s:0.90, dir:-1, spin:1.70, front:false },  // behind, right
  { x:-0.30, y:-1.20, z:-2.70, s:0.95, dir:-1, spin:3.85, front:true  },  // front, fast spinner, lower-centre
  { x:-1.25, y:-0.15, z: 0.25, s:0.75, dir: 1, spin:2.35, front:true  },  // front, small, mid-left
];

let GEAR = null;
const MATS = [];
const uSat = { value:TUNE.sat }, uTint = { value:new THREE.Color(TUNE.tint) }, uBright = { value:TUNE.bright };
let back = null, front = null;   // {canvas,renderer,scene,camera,lw,lh}
let secEl = null;
let prevY = null, dirSmooth = 1, idleW = 1;  // dirSmooth = last scroll dir (+down/-up); idleW = idle-spin weight (0 while scrolling → 1 when stopped)

function faceCameraWrap(model){
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  model.scale.setScalar(1/(Math.max(size.x,size.y,size.z)||1));
  const inner = new THREE.Group(); inner.add(model);
  if(size.y<=size.x && size.y<=size.z) inner.rotation.x=Math.PI/2;
  else if(size.x<=size.y && size.x<=size.z) inner.rotation.y=Math.PI/2;
  const outer = new THREE.Group(); outer.add(inner);
  return outer;
}
function convertMaterials(root){
  root.traverse(o=>{
    if(!o.isMesh) return;
    const s=o.material;
    const p=new THREE.MeshPhysicalMaterial({
      map:s.map||null, normalMap:s.normalMap||null, roughnessMap:s.roughnessMap||null,
      metalnessMap:s.metalnessMap||null, aoMap:s.aoMap||null,
      color:s.color?s.color.clone():new THREE.Color(0xffffff),
      metalness:TUNE.metal, roughness:TUNE.rough, envMapIntensity:TUNE.env, clearcoat:0.25, clearcoatRoughness:0.35,
    });
    if(p.map) p.map.colorSpace=THREE.SRGBColorSpace;
    p.onBeforeCompile=(sh)=>{
      sh.uniforms.uSat=uSat; sh.uniforms.uTint=uTint; sh.uniforms.uBright=uBright;
      sh.fragmentShader=sh.fragmentShader
        .replace('#include <common>','#include <common>\nuniform float uSat;\nuniform vec3 uTint;\nuniform float uBright;')
        .replace('#include <map_fragment>',
          `#include <map_fragment>
           { float g=dot(diffuseColor.rgb,vec3(0.299,0.587,0.114));
             diffuseColor.rgb=mix(vec3(g),diffuseColor.rgb,uSat)*uTint*uBright; }`);
    };
    o.material=p; MATS.push(p);
  });
}

function makeLayer(canvas){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:QUALITY.antialias,alpha:true});
  registerRenderer(renderer);   // perf manager owns the pixel ratio (and can lower it live)
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(35,1,0.1,100); camera.position.set(0,0,12);
  scene.add(new THREE.HemisphereLight(0xffffff,0x12150e,0.6));
  const key=new THREE.DirectionalLight(0xffffff,2.4); key.position.set(4,6,8); scene.add(key);
  const grn=new THREE.DirectionalLight(0x8fe06a,1.0); grn.position.set(-5,2,-3); scene.add(grn);
  const cool=new THREE.DirectionalLight(0x9fb8d0,0.5); cool.position.set(-4,3,6); scene.add(cool);
  import('three/addons/environments/RoomEnvironment.js').then(({RoomEnvironment})=>{
    const pm=new THREE.PMREMGenerator(renderer);
    scene.environment=pm.fromScene(new RoomEnvironment(),0.04).texture; scene.environmentIntensity=0.85;
  });
  return {canvas,renderer,scene,camera,lw:0,lh:0};
}
function fit(L){
  const r=L.canvas.getBoundingClientRect();
  const w=Math.max(1,r.width|0), h=Math.max(1,r.height|0);
  if(w===L.lw && h===L.lh) return;
  L.lw=w; L.lh=h; L.renderer.setSize(w,h,false); L.camera.aspect=w/h; L.camera.updateProjectionMatrix();
}

function layerOf(gear){ return gear.front?front:back; }
function spawn(gear){ const g=GEAR.clone(true); gear._mesh=g; layerOf(gear).scene.add(g); place(gear); }
function place(gear){ if(gear._mesh){ gear._mesh.position.set(gear.x,gear.y,gear.z); gear._mesh.scale.setScalar(gear.s); } }
function despawn(gear){ if(gear._mesh&&gear._mesh.parent){ gear._mesh.parent.remove(gear._mesh); } gear._mesh=null; }
function rebuild(){ LGEARS.forEach(despawn); LGEARS.forEach(g=>{ if(!g._deleted) spawn(g); }); }

// Per-gear edit API for the live Edit Interface (each logo gear is its OWN object).
// del/restore let the user keep only the gears they like; alive reports current state.
window.stLogoGears={
  count:()=>LGEARS.length,
  get:(i)=>({ x:LGEARS[i].x, y:LGEARS[i].y, z:LGEARS[i].z, s:LGEARS[i].s, spin:LGEARS[i].spin }),
  set:(i,k,v)=>{ if(!LGEARS[i]) return; LGEARS[i][k]=v; place(LGEARS[i]); },
  alive:(i)=>!!LGEARS[i] && !LGEARS[i]._deleted,
  del:(i)=>{ if(!LGEARS[i]) return; LGEARS[i]._deleted=true; despawn(LGEARS[i]); },
  restore:(i)=>{ if(!LGEARS[i]||!LGEARS[i]._deleted) return; LGEARS[i]._deleted=false; spawn(LGEARS[i]); },
  isFront:(i)=>!!LGEARS[i] && !!LGEARS[i].front,
  // move the gear between the front (in front of the logo) and back (behind it) layers, live
  setFront:(i,v)=>{ const g=LGEARS[i]; if(!g) return; g.front=!!v; if(g._deleted) return; despawn(g); spawn(g); },
};

// dScroll = px scrolled since last frame. While scrolling, idleW→0 so rotation tracks scroll
// frame-by-frame (speed + direction); when it stops, idleW fades back to 1 and the idle
// "processing" spin resumes in dirSmooth (the last scroll direction). Each gear integrates its angle.
function renderLayer(L,dScroll,dtF){
  fit(L);
  LGEARS.forEach(g=>{
    if(!g._mesh || layerOf(g)!==L) return;
    g._ang=(g._ang||0) + g.dir*g.spin*(SPIN.idle*dirSmooth*idleW*dtF + dScroll*SPIN.scrollK);
    g._mesh.rotation.set(TUNE.tiltX,TUNE.tiltY,g._ang);
  });
  L.renderer.render(L.scene,L.camera);
}

function boot(){
  secEl=document.querySelector('.sf-stage'); if(!secEl) return;
  const bc=secEl.querySelector('.lg-back'), fc=secEl.querySelector('.lg-front');
  if(!bc||!fc) return;
  back=makeLayer(bc); front=makeLayer(fc);
  rebuild();
  addEventListener('resize',()=>{ back.lw=back.lh=front.lw=front.lh=0; },{passive:true});

  if(RM()){ renderLayer(back,0,1); renderLayer(front,0,1); return; }
  const draw=fpsGate();
  let scrollAcc=0, lastDraw=performance.now();
  (function loop(){
    requestAnimationFrame(loop);
    if(!QUALITY.gears) return;                                           // perf watchdog can disable the gears (last resort)
    const r=secEl.getBoundingClientRect();
    if(r.bottom<-100 || r.top>innerHeight+100){ prevY=scrollY; return; }  // offscreen → skip the draw
    const y=scrollY; if(prevY===null) prevY=y;
    const d=y-prevY; prevY=y; scrollAcc+=d;                  // accumulate scroll across throttled frames
    if(Math.abs(d)>0.05) dirSmooth=Math.sign(d);             // lock idle's direction to the scroll
    if(!draw()) return;                                      // fps cap — but the scroll above keeps accruing
    const now=performance.now(); const dtF=Math.min(4,(now-lastDraw)/16.667); lastDraw=now;
    const moving=Math.abs(scrollAcc)>0.05;
    idleW += ((moving?0:1)-idleW)*(moving?0.6:SPIN.resume);  // kill idle fast while scrolling, ease it back when stopped
    renderLayer(back,scrollAcc,dtF); renderLayer(front,scrollAcc,dtF);
    scrollAcc=0;
  })();
}

// ---------------- load once, then boot ----------------
const loader=new GLTFLoader();
await MeshoptDecoder.ready;
loader.setMeshoptDecoder(MeshoptDecoder);
await new Promise((res,rej)=>{
  loader.load(new URL('./models/gear.glb',import.meta.url).href,(gltf)=>{
    GEAR=faceCameraWrap(gltf.scene); convertMaterials(GEAR); res();
  },undefined,rej);
});
boot();
