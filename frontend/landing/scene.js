import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { fpsGate, QUALITY, registerRenderer } from './perf.js';

const canvas=document.getElementById('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:QUALITY.antialias,alpha:true,powerPreference:'high-performance'});
registerRenderer(renderer);   // perf manager sets pixel ratio (and can lower it live)
renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.0;
renderer.outputColorSpace=THREE.SRGBColorSpace;

const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(34,innerWidth/innerHeight,0.1,100);
camera.position.set(0,0,10);
camera.lookAt(0,0,0);

// lighting
const hemi=new THREE.HemisphereLight(0xffffff,0x141414,0.5); scene.add(hemi);
const key=new THREE.DirectionalLight(0xffffff,2.6); key.position.set(5,7,7); scene.add(key);
const amberRim=new THREE.DirectionalLight(0xfdb153,1.3); amberRim.position.set(-4,1,-3); scene.add(amberRim);
const coolFill=new THREE.DirectionalLight(0x9fb8d0,0.55); coolFill.position.set(-5,3,4); scene.add(coolFill);

const _tl=new THREE.TextureLoader();
const textureCache=new Map();
const texturePromises=new Map();
function textureKey(uri,srgb){ return `${uri}|${srgb?'srgb':'linear'}`; }
function configureTexture(t,srgb){ t.flipY=false;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;if(srgb)t.colorSpace=THREE.SRGBColorSpace;return t; }
async function ensureTexture(uri,srgb){
  const key=textureKey(uri,srgb);
  if(textureCache.has(key)) return textureCache.get(key);
  if(!texturePromises.has(key)){
    const pending=_tl.loadAsync(uri).then(async(t)=>{
      // TextureLoader resolves on image load, but decode() is the stronger guarantee that the JPEG is
      // fully decompressed before we ask either WebGL context to upload it.
      if(t.image && typeof t.image.decode==='function') await t.image.decode();
      configureTexture(t,srgb); textureCache.set(key,t); return t;
    }).catch((err)=>{ texturePromises.delete(key); throw err; });
    texturePromises.set(key,pending);
  }
  return texturePromises.get(key);
}
function tex(uri,srgb){
  const t=textureCache.get(textureKey(uri,srgb));
  if(!t) throw new Error(`Texture used before preload completed: ${uri}`);
  return t;
}
function blackMat(P){ return new THREE.MeshStandardMaterial({ map:tex(P.base,true),normalMap:tex(P.nrm,false),roughnessMap:tex(P.mr,false),metalnessMap:tex(P.mr,false),color:new THREE.Color(0x161616),roughness:0.34,metalness:0.5,envMapIntensity:1.0 }); }
function whiteMat(P){ return new THREE.MeshStandardMaterial({ normalMap:tex(P.nrm,false),roughnessMap:tex(P.mr,false),color:new THREE.Color(0.82,0.77,0.66),roughness:0.34,metalness:0.05,envMapIntensity:0.9 }); }

const loader=new GLTFLoader();
const geoCache={};   // type -> normalized Object3D (centered, base at y=0, unit height)
const geoPromises={};

let pieceGroup=null;     // the on-screen piece wrapper
let activeMat=null;      // current piece material (for live editing)
let currentType='king';
let isLight=false;       // default DARK theme
try{ isLight=localStorage.getItem('st-theme')==='light'; if(isLight) document.body.classList.add('light'); }catch(e){}
let HERO_HEIGHT=4.6;   // world height the piece occupies
// live-adjustable transform (editable via panel)
const T={ posX:0.35, posY:1.8, posZ:1.7, scale:0.7, rotX:0, rotY:2.62, rotZ:0, camZ:10.3, fov:34 };
let introScale=0;   // 0..1 intro grow factor
let introStarted=false;   // true once the grow-in tween has begun (guards the safety net)
// per-theme render presets (light = black knight, dark = white knight)
const RENDER_PRESETS={
  light:{ exposure:2.2, roughness:1.0, metalness:0.0, env:0.98, keyInt:6.0, amberInt:3.05, coolInt:3.0, shadow:0.38 },
  dark: { exposure:0.96, roughness:1.0, metalness:0.32, env:1.6, keyInt:3.2, amberInt:1.6, coolInt:0.8, shadow:0.30 }
};
const R={ exposure:0.96, roughness:1.0, metalnessW:0.32, metalnessB:0.32, env:1.6,
          keyInt:3.2, amberInt:1.6, coolInt:0.8, shadow:0.30, bgColor:null };
function loadRenderPreset(themeName){
  const p=RENDER_PRESETS[themeName]; if(!p) return;
  R.exposure=p.exposure; R.roughness=p.roughness; R.metalnessW=p.metalness; R.metalnessB=p.metalness;
  R.env=p.env; R.keyInt=p.keyInt; R.amberInt=p.amberInt; R.coolInt=p.coolInt; R.shadow=p.shadow;
  renderer.toneMappingExposure=R.exposure;
  key.intensity=R.keyInt; amberRim.intensity=R.amberInt; coolFill.intensity=R.coolInt;
  if(shadowBlob) shadowBlob.material.opacity=R.shadow;
  applyMaterial();
  syncRenderSliders();
}
function syncRenderSliders(){
  const set=(id,vid,v,fmt)=>{ const s=document.getElementById(id); if(s){s.value=v; const b=document.getElementById(vid); if(b)b.textContent=(fmt||(x=>(+x).toFixed(2)))(v);} };
  set('r_exp','vr_exp',R.exposure); set('r_rough','vr_rough',R.roughness); set('r_metal','vr_metal',R.metalnessW);
  set('r_env','vr_env',R.env); set('r_key','vr_key',R.keyInt); set('r_amber','vr_amber',R.amberInt);
  set('r_cool','vr_cool',R.coolInt); set('r_shadow','vr_shadow',R.shadow);
}

async function ensureGeo(type){
  if(geoCache[type]) return geoCache[type];
  if(!geoPromises[type]){
    const P=window.PIECES[type];
    geoPromises[type]=(async()=>{
      const gltf=await loader.loadAsync(P.glb);   // load + meshopt decode + GLTF parse
      const m=gltf.scene;
      // normalize: center X/Z, base to y=0
      let bx=new THREE.Box3().setFromObject(m); let c=bx.getCenter(new THREE.Vector3());
      m.position.x-=c.x; m.position.z-=c.z; m.position.y-=bx.min.y;
      // measure unit height
      let bx2=new THREE.Box3().setFromObject(m); let sz=bx2.getSize(new THREE.Vector3());
      geoCache[type]={ obj:m, height:sz.y };
      return geoCache[type];
    })().catch((err)=>{ delete geoPromises[type]; throw err; });
  }
  return geoPromises[type];
}
async function ensurePieceAssets(type){
  const P=window.PIECES[type];
  await Promise.all([
    ensureGeo(type),
    ensureTexture(P.base,true),
    ensureTexture(P.nrm,false),
    ensureTexture(P.mr,false),
  ]);
}

// Generation tokens: overlapping async builds (a theme toggle firing while the initial GLB load is
// still in flight — ui.js applies a saved theme at boot) used to EACH add their own piece group. The
// superseded one kept a frozen, never-animated copy in the scene until refresh (the "ghost rook").
// Only the latest call may mutate the scene; it also removes whatever is already there first.
let pieceGen=0, backGen=0;
async function setPiece(type){
  currentType=type;
  const gen=++pieceGen;
  const P=window.PIECES[type];
  await ensurePieceAssets(type);
  const g=geoCache[type];
  if(gen!==pieceGen) return;   // a newer setPiece superseded this one mid-load
  // remove old
  if(pieceGroup){ scene.remove(pieceGroup); pieceGroup=null; }
  const inst=g.obj.clone(true);
  const mat = isLight ? blackMat(P) : whiteMat(P);   // dark theme -> white piece, light -> black
  mat.transparent=true;
  activeMat=mat;
  applyMaterial();
  inst.traverse(o=>{ if(o.isMesh) o.material=mat; });
  // scale so the piece is exactly HERO_HEIGHT tall
  const s=HERO_HEIGHT/g.height;
  inst.scale.setScalar(s);
  // after scaling, base is at y=0. We want it VERTICALLY CENTERED on screen:
  // shift down by half its height so its mid-point is at world y=0 (screen center).
  inst.position.y = -HERO_HEIGHT/2;
  // knight faces profile
  if(type==='knight') inst.rotation.y = Math.PI/2;
  const wrap=new THREE.Group(); wrap.add(inst);
  scene.add(wrap); pieceGroup=wrap;
  applyTransform();
}


function applyTransform(){
  if(!pieceGroup) return;
  pieceGroup.position.set(T.posX, T.posY, T.posZ);
  // base rotation stored on the inner mesh; here we add user rotation
  pieceGroup.rotation.set(T.rotX, T.rotY, T.rotZ);
  pieceGroup.userData.userScale=T.scale;
  camera.position.z=T.camZ; camera.fov=T.fov; camera.updateProjectionMatrix();
}
window.setPieceTransform=(k,v)=>{ T[k]=v; applyTransform(); };
window.getPieceTransform=()=>JSON.parse(JSON.stringify(T));


function applyMaterial(){
  if(!activeMat) return;
  activeMat.roughness=R.roughness;
  activeMat.metalness = isLight ? R.metalnessB : R.metalnessW;
  activeMat.envMapIntensity=R.env;
  activeMat.needsUpdate=true;
  renderer.toneMappingExposure=R.exposure;
}
window.setRender=(k,v)=>{ R[k]=v;
  if(k==='exposure') renderer.toneMappingExposure=v;
  else if(k==='keyInt') key.intensity=v;
  else if(k==='amberInt') amberRim.intensity=v;
  else if(k==='coolInt') coolFill.intensity=v;
  else if(k==='shadow'){ if(shadowBlob) shadowBlob.material.opacity=v; }
  else applyMaterial();
};
window.getRender=()=>JSON.parse(JSON.stringify(R));
window.setBgColor=(hex)=>{ R.bgColor=hex; document.getElementById('canvasBg').style.background = hex==='transparent'?'transparent':hex; };

// soft contact shadow under the piece (a blurred radial sprite on a plane)
let shadowBlob=null;
(function(){
  const cv=document.createElement('canvas'); cv.width=cv.height=256;
  const x=cv.getContext('2d');
  const g=x.createRadialGradient(128,128,0,128,128,128);
  g.addColorStop(0,'rgba(0,0,0,0.55)'); g.addColorStop(0.5,'rgba(0,0,0,0.22)'); g.addColorStop(1,'rgba(0,0,0,0)');
  x.fillStyle=g; x.beginPath(); x.ellipse(128,128,128,90,0,0,6.28); x.fill();
  const t=new THREE.CanvasTexture(cv);
  shadowBlob=new THREE.Mesh(new THREE.PlaneGeometry(4,2.6), new THREE.MeshBasicMaterial({map:t,transparent:true,opacity:0,depthWrite:false}));
  shadowBlob.rotation.x=-Math.PI/2;
  scene.add(shadowBlob);
})();


// ===== BACK SCENE (bishop + rook behind the text) =====
const canvasB=document.getElementById('cBack');
const rendererB=new THREE.WebGLRenderer({canvas:canvasB,antialias:QUALITY.antialias,alpha:true,powerPreference:'high-performance'});
registerRenderer(rendererB);
rendererB.setSize(innerWidth,innerHeight);
rendererB.toneMapping=THREE.ACESFilmicToneMapping; rendererB.toneMappingExposure=1.0; rendererB.outputColorSpace=THREE.SRGBColorSpace;
const sceneB=new THREE.Scene();
const camB=new THREE.PerspectiveCamera(34,innerWidth/innerHeight,0.1,100); camB.position.set(0,0,10); camB.lookAt(0,0,0);
sceneB.add(new THREE.HemisphereLight(0xffffff,0x141414,0.5));
const keyB=new THREE.DirectionalLight(0xffffff,2.2); keyB.position.set(5,7,7); sceneB.add(keyB);
const amberB=new THREE.DirectionalLight(0xfdb153,1.0); amberB.position.set(-4,1,-3); sceneB.add(amberB);
const environmentTargets=[];
async function prepareEnvironments(){
  const {RoomEnvironment}=await import('three/addons/environments/RoomEnvironment.js');
  const make=(targetRenderer,intensity,targetScene)=>{
    const pmrem=new THREE.PMREMGenerator(targetRenderer);
    pmrem.compileCubemapShader();
    const room=new RoomEnvironment();
    const target=pmrem.fromScene(room,0.04);
    environmentTargets.push(target); // keep the render target alive for as long as the scenes use it
    targetScene.environment=target.texture;
    targetScene.environmentIntensity=intensity;
    room.dispose(); pmrem.dispose();
  };
  make(renderer,0.5,scene);
  make(rendererB,0.4,sceneB);
}
// transforms for the two bg pieces (editable)
const TB={ posX:-5.55, posY:2.35, posZ:-1, scale:0.68, rotX:0.62, rotY:-1.3, rotZ:0 };  // bishop
const TR={ posX: 6.15, posY:-0.35, posZ:-2.4, scale:0.62, rotX:0.4, rotY:0.32, rotZ:0 };  // rook
let bishopG=null, rookG=null;
async function buildBackPieces(){
  const gen=++backGen;
  await Promise.all([ensurePieceAssets('bishop'),ensurePieceAssets('rook')]);
  const gb=geoCache.bishop;
  const gr=geoCache.rook;
  if(gen!==backGen) return;    // superseded mid-load (theme toggled) — the newer call owns the scene
  if(bishopG){ sceneB.remove(bishopG); bishopG=null; }
  if(rookG){ scene.remove(rookG); rookG=null; }
  // bishop
  const bi=gb.obj.clone(true);
  const matB = isLight ? blackMat(window.PIECES.bishop) : whiteMat(window.PIECES.bishop);
  matB.transparent=true;
  const sB=4.0/gb.height; bi.scale.setScalar(sB); bi.position.y=-2.0;
  bi.traverse(o=>{ if(o.isMesh) o.material=matB; });
  bishopG=new THREE.Group(); bishopG.add(bi); bishopG.userData.mat=matB; sceneB.add(bishopG);
  // rook -> FRONT scene (positive z, over the text)
  const ri=gr.obj.clone(true);
  const matR = isLight ? blackMat(window.PIECES.rook) : whiteMat(window.PIECES.rook);
  matR.transparent=true;
  const sR=4.0/gr.height; ri.scale.setScalar(sR); ri.position.y=-2.0;
  ri.traverse(o=>{ if(o.isMesh) o.material=matR; });
  rookG=new THREE.Group(); rookG.add(ri); rookG.userData.mat=matR; scene.add(rookG);
  applyBack();
}
function applyBack(){
  if(bishopG){ bishopG.position.set(TB.posX,TB.posY,TB.posZ); bishopG.rotation.set(TB.rotX,TB.rotY,TB.rotZ); bishopG.scale.setScalar(TB.scale*Math.max(introScale,0.001)); }
  if(rookG){ rookG.position.set(TR.posX,TR.posY,TR.posZ); rookG.rotation.set(TR.rotX,TR.rotY,TR.rotZ); rookG.scale.setScalar(TR.scale*Math.max(introScale,0.001)); }
}
window.warmUpRender=()=>{ try{ if(typeof rendererB!=="undefined"&&sceneB&&camB) rendererB.render(sceneB,camB); renderer.render(scene,camera); }catch(e){} };
window.__intro={v:0};
// Grow the pieces in. Start the tween from the CURRENT introScale (not a hard 0)
// so if the safety net below already revealed them, the tween can't yank them back
// to 0 — which was the "appear → vanish → grow" flicker on slow loads.
window.introPieces=()=>{
  introStarted=true;
  window.__intro.v=introScale;
  if(window.gsap) gsap.to(window.__intro,{v:1,duration:1.4,ease:"power3.out",delay:0.3,onUpdate:()=>{introScale=window.__intro.v;}});
  else introScale=1;
};
window.setBackTransform=(which,k,v)=>{ (which==='bishop'?TB:TR)[k]=v; applyBack(); };
window.getBackTransform=()=>({bishop:JSON.parse(JSON.stringify(TB)),rook:JSON.parse(JSON.stringify(TR))});

// ===== PRELOADER: build everything, track progress, then reveal =====
(function(){
  const word=document.getElementById('loadWord');
  if(word){ const txt='STOCKTHINK'; word.innerHTML=''; [...txt].forEach((c,k)=>{ const s=document.createElement('span'); s.textContent=c; s.style.animationDelay=(k*0.04)+'s'; word.appendChild(s); }); }
})();
let _progress=0;
function setProgress(p){
  _progress=Math.max(_progress,p);
  const bar=document.getElementById('loadBar'), pct=document.getElementById('loadPct');
  if(bar) bar.style.width=Math.round(_progress*100)+'%';
  if(pct) pct.textContent=Math.round(_progress*100)+'%';
  // illuminate the wordmark letter-by-letter as the real work completes
  const W=document.getElementById('loadWord');
  if(W){ const sp=W.children, n=Math.round(_progress*sp.length); for(let i=0;i<sp.length;i++) sp[i].classList.toggle('lit', i<n); }
}

async function warmUpHero(){
  const savedScale=introScale;
  introScale=1;
  applyBack();
  if(pieceGroup){ pieceGroup.scale.setScalar(T.scale); pieceGroup.visible=true; }
  if(activeMat) activeMat.opacity=1;
  if(bishopG){ bishopG.visible=true; if(bishopG.userData.mat) bishopG.userData.mat.opacity=1; }
  if(rookG){ rookG.visible=true; if(rookG.userData.mat) rookG.userData.mat.opacity=1; }

  // compileAsync waits for parallel shader compilation when the browser exposes it. The rendered
  // frames then force real texture uploads, VAO creation, and draw submission in both WebGL contexts.
  const compiles=[];
  if(renderer.compileAsync) compiles.push(renderer.compileAsync(scene,camera));
  else renderer.compile(scene,camera);
  if(rendererB.compileAsync) compiles.push(rendererB.compileAsync(sceneB,camB));
  else rendererB.compile(sceneB,camB);
  await Promise.all(compiles);
  for(let k=0;k<6;k++){
    rendererB.render(sceneB,camB);
    renderer.render(scene,camera);
    await new Promise((resolve)=>requestAnimationFrame(resolve));
  }
  // Do not drop the curtain while uploads/compiles are still queued on the GPU.
  try{ renderer.getContext().finish(); rendererB.getContext().finish(); }catch(e){}

  introScale=savedScale;
  applyBack();
  if(pieceGroup) pieceGroup.scale.setScalar(T.scale*Math.max(savedScale,0.001));
}

await (async()=>{
  // Nothing below this gate (including initScroll) executes until every piece model and texture is
  // downloaded, decoded, parsed, instantiated where needed, shader-compiled, uploaded, and rendered.
  await MeshoptDecoder.ready;
  loader.setMeshoptDecoder(MeshoptDecoder);
  setProgress(0.08);
  // 1) wait for fonts so text doesn't reflow/flash
  try{ if(document.fonts && document.fonts.ready) await document.fonts.ready; }catch(e){}
  setProgress(0.16);
  // 2) preload and preprocess every chess piece, not only the three visible in the hero
  const types=Object.keys(window.PIECES);
  let readyCount=0;
  await Promise.all(types.map(async(type)=>{
    await ensurePieceAssets(type);
    readyCount++;
    setProgress(0.16+(readyCount/types.length)*0.42);
  }));
  // 3) create both environment maps before materials are compiled
  await prepareEnvironments();
  setProgress(0.66);
  // 4) instantiate the main knight
  await setPiece(window.HERO_PIECE||'king');
  setProgress(0.75);
  // 5) instantiate bishop + rook
  await buildBackPieces();
  setProgress(0.84);
  // 6) apply render preset
  loadRenderPreset(isLight?'light':'dark');
  setProgress(0.9);
  // 7) finish shader compilation and GPU uploads under the loader
  await warmUpHero();
  setProgress(1.0);
  // 8) hold a beat so progress reads 100%, then reveal
  await new Promise(r=>setTimeout(r,300));
  const loadEl=document.getElementById('load');
  if(loadEl) loadEl.classList.add('done');
  // Let the fade begin only after all prep is complete, then start the intro underneath it.
  await new Promise(r=>setTimeout(r,200));
  window.HERO_READY=true;
})();

// expose controls
window.setHeroPiece=(type)=>{ setPiece(type); };
window.setHeroTheme=(light)=>{ if(isLight===light){ loadRenderPreset(light?"light":"dark"); return; } isLight=light; loadRenderPreset(light?"light":"dark"); if(pieceGroup) setPiece(currentType);
  // rebuild bishop+rook so their color follows the theme (white on dark, black on light);
  // buildBackPieces removes the existing groups itself and is generation-guarded against overlap
  buildBackPieces();
};

// scroll progress + mouse parallax
window.heroProgress=1;   // canvas scrolls away naturally now; pieces stay full
window.heroMotion=true;
let mx=0,my=0,tmx=0,tmy=0;
addEventListener('mousemove',e=>{ tmx=(e.clientX/innerWidth-0.5); tmy=(e.clientY/innerHeight-0.5); });

const clock=new THREE.Clock();
// Only the hero is on-screen at the top; once it has scrolled fully away there's nothing to draw,
// so skip BOTH hero renderers (front + back) entirely. This is the single biggest scroll win —
// off-screen the hero used to keep rendering two WebGL scenes every frame forever.
const heroSec=document.getElementById('heroSec');
function heroVisible(){ if(!heroSec) return true; const r=heroSec.getBoundingClientRect(); return r.bottom>-120 && r.top<innerHeight+120; }
const heroGate=fpsGate();   // cap below display refresh — two full-screen contexts shouldn't draw at 144Hz
function animate(){
  requestAnimationFrame(animate);
  if(!QUALITY.hero) return;         // perf watchdog can disable the hovering hero live
  if(!heroVisible()) return;
  if(!heroGate()) return;           // throttle the render; motion is clock-based so it stays correct
  const et=clock.getElapsedTime();
  const Pr=Math.max(0,Math.min(1,window.heroProgress));
  mx+=(tmx-mx)*0.05; my+=(tmy-my)*0.05;
  if(pieceGroup){
    const mo=window.heroMotion!==false;
    // base transform from T, plus subtle motion + mouse parallax + scroll exit
    pieceGroup.rotation.x = T.rotX + my*0.10;
    pieceGroup.rotation.y = T.rotY + (mo?Math.sin(et*0.16)*0.16:0) + mx*0.22;
    pieceGroup.rotation.z = T.rotZ;
    pieceGroup.position.x = T.posX;
    pieceGroup.position.y = T.posY + (mo?Math.sin(et*0.38)*0.05:0) + (1-Pr)*4;
    pieceGroup.position.z = T.posZ;
    const sc = T.scale*(0.85+0.15*Pr)*introScale;   // subtle scale + intro grow
    pieceGroup.scale.setScalar(sc);
    // FADE the knight as it scrolls up (cleaner than just moving off)
    const fade = Math.max(0, Math.min(1, (Pr-0.15)/0.55));   // fully faded by ~15% scroll
    if(activeMat) activeMat.opacity = fade;
    pieceGroup.visible = fade>0.01;
    if(shadowBlob){ shadowBlob.position.set(T.posX, T.posY-2.3*T.scale, T.posZ); shadowBlob.visible=fade>0.1 && R.shadow>0; shadowBlob.material.opacity=R.shadow*fade; }
  }
  // back pieces: subtle drift + same mouse parallax, render back scene
  if(bishopG){ const mo=window.heroMotion!==false;
    bishopG.rotation.y = TB.rotY + (mo? et*0.18 : 0);
    bishopG.rotation.z = TB.rotZ + (mo? Math.sin(et*0.4)*0.06 : 0);
    bishopG.position.x = TB.posX + (mo? Math.sin(et*0.35)*0.12 : 0) - (1-Pr)*3.2;   // slide LEFT out of frame
    bishopG.position.y = TB.posY + (mo? Math.cos(et*0.28)*0.12 : 0) + (1-Pr)*1.5;
    bishopG.scale.setScalar(TB.scale*introScale);
    const bf = Math.max(0, Math.min(1, (Pr-0.12)/0.5));    // fade as it leaves
    if(bishopG.userData.mat) bishopG.userData.mat.opacity = bf;
    bishopG.visible = introScale>0.01 && bf>0.01;
  }
  if(rookG){ const mo=window.heroMotion!==false;
    rookG.rotation.y = TR.rotY + (mo? et*0.15 : 0);
    rookG.rotation.z = TR.rotZ + (mo? Math.cos(et*0.45+1)*0.05 : 0);
    rookG.position.x = TR.posX + (mo? Math.cos(et*0.32+1)*0.12 : 0) + (1-Pr)*3.2;   // slide RIGHT out of frame
    rookG.position.y = TR.posY + (mo? Math.sin(et*0.3+1)*0.12 : 0) + (1-Pr)*1.5;
    rookG.scale.setScalar(TR.scale*introScale);
    const rf = Math.max(0, Math.min(1, (Pr-0.12)/0.5));    // fade as it leaves
    if(rookG.userData.mat) rookG.userData.mat.opacity = rf;
    rookG.visible = introScale>0.01 && rf>0.01;
  }
  camB.position.x += (mx*0.7 - camB.position.x)*0.04; camB.position.y += (-my*0.5 - camB.position.y)*0.04; camB.lookAt(0,0,0);
  rendererB.render(sceneB,camB);
  // camera subtle parallax
  camera.position.x += (mx*0.5 - camera.position.x)*0.04;
  camera.position.y += (-my*0.35 - camera.position.y)*0.04;
  camera.lookAt(0,0,0);
  renderer.render(scene,camera);
}
animate();

addEventListener('resize',()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); camB.aspect=innerWidth/innerHeight; camB.updateProjectionMatrix(); rendererB.setSize(innerWidth,innerHeight); });

// ===== GSAP intro + scroll outro =====
function initScroll(){
  document.body.classList.remove("pre-intro");

  // ---------- INTRO (first load, smooth & staggered) ----------
  if(window.gsap){
    gsap.set('#cardFrame', {scale:0.985, opacity:0});
    gsap.set('.wordmark .w', {yPercent:115, opacity:0, filter:'blur(8px)'});
    gsap.set('#tagline', {y:24, opacity:0});
    gsap.set('.hero-cta', {y:16, opacity:0});
    gsap.set('nav', {y:-30, opacity:0});
    gsap.set('.meta', {opacity:0});
    const tl=gsap.timeline({defaults:{ease:'power3.out'}, delay:0.15});
    tl.to('#cardFrame', {scale:1, opacity:1, duration:1.0, ease:'power2.out'})
      .to('.wordmark .w', {yPercent:0, opacity:1, filter:'blur(0px)', duration:1.15, stagger:0.14, ease:'expo.out'}, '-=0.6')
      .to('#tagline', {y:0, opacity:1, duration:0.9}, '-=0.55')
      .to('.hero-cta', {y:0, opacity:1, duration:0.75}, '-=0.65')
      .to('nav', {y:0, opacity:1, duration:0.8}, '-=0.8')
      .to('.meta', {opacity:1, duration:0.9, stagger:0.1}, '-=0.6')
      .add(()=>{ gsap.set(['.wordmark','.wordmark .w','#tagline','.hero-cta','nav'], {clearProps:'all'}); });
  } else {
    document.body.classList.remove("pre-intro");
  }
  if(window.introPieces) window.introPieces();
  // OUTRO is now handled by the unified scroll engine (drives window.heroProgress) — no ScrollTrigger here.
}
if(window.HERO_READY) initScroll(); else window.onHeroReady=initScroll;





