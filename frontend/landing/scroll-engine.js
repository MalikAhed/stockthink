// ===== Scroll engine: the scroll-scrubbed motion framework =====
// Drives the hero OUTRO (window.heroProgress -> 3D pieces fade/slide as you
// scroll past the hero) and the 'Stockfish that talks.' -> 'talks?' hook morph.
// This is the home for scroll-driven (scrubbed) motion; per-step scrub demos
// extend the same idea. Independent of the step-demo controller in sections.js.
(function(){
  // ---- HERO OUTRO: drive window.heroProgress from scroll through the hero section ----
  // heroProgress = 1 at top (full hero), -> 0 as you scroll one viewport down (pieces fade+slide out)
  const heroSec=document.getElementById('heroSec');
  function updateHero(){
    if(!heroSec) return;
    const h=window.innerHeight;
    const scrolled=window.scrollY;            // how far down the page
    // map 0..(0.85*viewport) of scroll -> heroProgress 1..0
    const p=Math.max(0, Math.min(1, scrolled/(h*0.85)));
    window.heroProgress=1-p;                   // 1 = full hero, 0 = fully exited (always live -> drives the 3D pieces)
    // Don't fight the load-in intro: only drive the wordmark/tagline exit once the hero intro has run.
    // (Before HERO_READY the GSAP intro owns these elements; styling them here caused a pre-intro flash.)
    if(!window.HERO_READY) return;
    const wm=document.querySelector('.wordmark'), tg=document.getElementById('tagline');
    const ease=p*p*(3-2*p);
    if(wm){ wm.style.opacity=(1-ease); wm.style.transform=`translateY(${-ease*55}px)`; wm.style.filter=`blur(${ease*5}px)`; }
    // The tagline is centered via translateX(-50%) in CSS. Keep that in the inline transform too,
    // otherwise scrolling replaces the transform and the tagline jumps to the right.
    if(tg){ const t=Math.min(1,p/0.6); tg.style.opacity=(1-t*t*(3-2*t)); tg.style.transform=`translateX(-50%) translateY(${-ease*40}px)`; }
  }
  // ---- the "Stockfish that talks." -> "talks?" scroll morph (data-step 6) ----
  let hookQPopped=false;
  function updateHook(){
    const sec=document.getElementById('hookSec'), title=document.getElementById('hookTitle');
    if(!sec||!title) return;
    if(matchMedia('(prefers-reduced-motion:reduce)').matches){ return; }
    const r=sec.getBoundingClientRect();
    const track=Math.max(1, r.height-window.innerHeight);
    const p=Math.max(0, Math.min(1, (-r.top)/track));     // 0 at section top, 1 at section bottom
    const m=Math.min(1, p/0.6), ease=m*m*(3-2*m);          // morph completes by 60% of the track
    title.style.transform=`translateY(${(1-ease)*16}vh) scale(${0.62+ease*0.38})`;
    title.style.opacity=String(0.85+ease*0.15);
    const dot=document.getElementById('hookDot'), q=document.getElementById('hookQ'),
          sub=document.getElementById('hookSub'), kick=document.getElementById('hookKick');
    if(!hookQPopped && p>=0.62){ hookQPopped=true; dot&&dot.classList.add('gone'); q&&q.classList.add('pop');
      sub&&sub.classList.add('in'); kick&&kick.classList.add('in'); }
    else if(hookQPopped && p<0.55){ hookQPopped=false; dot&&dot.classList.remove('gone'); q&&q.classList.remove('pop');
      sub&&sub.classList.remove('in'); kick&&kick.classList.remove('in'); }
  }
  // one rAF-throttled scroll handler for both the hero exit and the hook morph
  let scrollTick=false;
  function onScroll(){ if(scrollTick) return; scrollTick=true;
    requestAnimationFrame(()=>{ updateHero(); updateHook(); scrollTick=false; }); }
  addEventListener('scroll', onScroll, {passive:true});
  addEventListener('resize', ()=>{ updateHero(); updateHook(); });
  updateHero(); updateHook();
})();
