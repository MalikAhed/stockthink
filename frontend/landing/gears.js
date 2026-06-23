// gears.js — 3D gears layered around the beat-1 title.
// Two canvases: .gear-back (z0, behind the text) and .gear-front (z3, in front of it).
// Each gear's `front` flag decides which layer it lives in → real depth around the text.
// TUNE = the locked-in material/tilt; GEARS = the locked-in per-gear layout.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { fpsGate, QUALITY, registerRenderer } from './perf.js';

const RM=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;

// ---- material/tilt (locked-in look) ----
const TUNE={ tiltX:0.017, tiltY:0.192, sat:0.56, tint:'#d1e5ff', bright:2.00, rough:1.00, metal:1.00, env:2.00 };

// ---- spin feel ----
// idle    = radians/frame of the always-on spin · scrollK = radians per px of scroll
// resume  = how fast idle fades back in after scrolling stops (0..1)
const SPIN={ idle:0.0025, scrollK:0.0018, resume:0.12 };

// ---- the gears (locked-in layout) ----
const GEARS=[
  { x:-2.2, y: 2.0, z:-0.6, s:2.4, dir: 1, spin:1.00, front:true },
  { x:-4.3, y: 2.2, z:-1.0, s:1.4, dir:-1, spin:1.30, front:true },
  { x:-6.0, y:-0.1, z: 4.0, s:2.4, dir:-1, spin:1.60, front:true },
  { x:-2.0, y: 0.2, z:-1.4, s:1.3, dir:-1, spin:1.40, front:true },
];

let GEAR=null;
const MATS=[];
const uSat={value:TUNE.sat}, uTint={value:new THREE.Color(TUNE.tint)}, uBright={value:TUNE.bright};
let back=null, front=null;   // {canvas,renderer,scene,camera}
let secEl=null;
let prevY=null, dirSmooth=1, idleW=1;  // dirSmooth = last scroll dir (+down/-up); idleW = idle-spin weight (0 while scrolling → 1 when stopped)

function faceCameraWrap(model){
  const box=new THREE.Box3().setFromObject(model);
  const size=box.getSize(new THREE.Vector3()), center=box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  model.scale.setScalar(1/(Math.max(size.x,size.y,size.z)||1));
  const inner=new THREE.Group(); inner.add(model);
  if(size.y<=size.x && size.y<=size.z) inner.rotation.x=Math.PI/2;
  else if(size.x<=size.y && size.x<=size.z) inner.rotation.y=Math.PI/2;
  const outer=new THREE.Group(); outer.add(inner);
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

// Per-gear edit API for the live Edit Interface (each gear is its OWN object).
window.stGears={
  count:()=>GEARS.length,
  get:(i)=>({ x:GEARS[i].x, y:GEARS[i].y, z:GEARS[i].z, s:GEARS[i].s, spin:GEARS[i].spin }),
  set:(i,k,v)=>{ if(!GEARS[i]) return; GEARS[i][k]=v; place(GEARS[i]); },
};
function despawn(gear){ if(gear._mesh&&gear._mesh.parent){ gear._mesh.parent.remove(gear._mesh); } gear._mesh=null; }
function rebuild(){ GEARS.forEach(despawn); GEARS.forEach(spawn); }

// dScroll = px scrolled since the last RENDERED frame (accumulated across throttled frames so the
// scroll-coupled spin stays exact). dtF = elapsed render frames at 60fps-equivalent, so the idle spin
// is time-based (constant speed regardless of display refresh or the fps cap). While scrolling, idleW→0
// so rotation tracks the scroll; when it stops, idleW fades back to 1 and the idle spin resumes in
// dirSmooth (the last scroll direction). Each gear integrates its own angle.
function renderLayer(L,dScroll,dtF){
  fit(L);
  GEARS.forEach(g=>{
    if(!g._mesh || (g.front?front:back)!==L) return;
    g._ang=(g._ang||0) + g.dir*g.spin*(SPIN.idle*dirSmooth*idleW*dtF + dScroll*SPIN.scrollK);
    g._mesh.rotation.set(TUNE.tiltX,TUNE.tiltY,g._ang);
  });
  L.renderer.render(L.scene,L.camera);
}

function boot(){
  secEl=document.querySelector('.gearSec'); if(!secEl) return;
  back=makeLayer(secEl.querySelector('.gear-back'));
  front=makeLayer(secEl.querySelector('.gear-front'));
  rebuild();
  addEventListener('resize',()=>{ back.lw=back.lh=front.lw=front.lh=0; },{passive:true});

  if(RM()){ renderLayer(back,0,1); renderLayer(front,0,1); return; }
  const draw=fpsGate();
  let scrollAcc=0, lastDraw=performance.now();
  (function loop(){
    requestAnimationFrame(loop);
    if(!QUALITY.gears) return;                                            // perf watchdog can disable the gears (last resort)
    const r=secEl.getBoundingClientRect();
    if(r.bottom<-100 || r.top>innerHeight+100){ prevY=scrollY; return; }   // offscreen → skip the draw
    const y=scrollY; if(prevY===null) prevY=y;
    const d=y-prevY; prevY=y; scrollAcc+=d;                // accumulate scroll across throttled frames
    if(Math.abs(d)>0.05) dirSmooth=Math.sign(d);           // lock idle's direction to the scroll
    if(!draw()) return;                                    // fps cap — but the scroll above keeps accruing
    const now=performance.now(); const dtF=Math.min(4,(now-lastDraw)/16.667); lastDraw=now;
    const moving=Math.abs(scrollAcc)>0.05;
    idleW += ((moving?0:1)-idleW)*(moving?0.6:SPIN.resume); // kill idle fast while scrolling, ease it back when stopped
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
