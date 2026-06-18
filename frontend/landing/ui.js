// ===== NAV DARK / LIGHT THEME TOGGLE =====
(function(){
  const btn = document.getElementById('navThemeToggle');
  const label = document.getElementById('navToggleLabel');
  const icon = btn ? btn.querySelector('.nav-toggle-icon') : null;
  if(!btn) return;
  function applyTheme(light){
    document.body.classList.toggle('light', light);
    if(label) label.textContent = light ? 'Dark' : 'Light';
    if(icon) icon.textContent = light ? '\uD83C\uDF19' : '\u2600\uFE0F';
    if(window.setHeroTheme) window.setHeroTheme(light);
    try{ localStorage.setItem('st-theme', light ? 'light' : 'dark'); }catch(e){}
  }
  btn.addEventListener('click', ()=> applyTheme(!document.body.classList.contains('light')));
  try{
    const saved = localStorage.getItem('st-theme');
    if(saved === 'light') applyTheme(true);
  }catch(e){}
})();

// ===== color-sync the "why" word to the badge currently above it =====
(function(){
  function start(){
    const why=document.getElementById('whyWord');
    const track=document.querySelector('.chaintrack');
    if(!why||!track) return;
    const badges=[...track.querySelectorAll('.chainb')];
    function tick(){
      const wr=why.getBoundingClientRect();
      const wx=wr.left+wr.width/2;
      let best=null,bd=1e9;
      for(const b of badges){
        const br=b.getBoundingClientRect();
        if(br.width===0) continue;
        const bx=br.left+br.width/2;
        const d=Math.abs(bx-wx);
        if(d<bd){ bd=d; best=b; }
      }
      if(best){
        const col=best.getAttribute('data-color');
        why.style.color=col;
        why.style.textShadow='0 0 22px '+col+'88, 0 0 46px '+col+'55';
      }
      requestAnimationFrame(tick);
    }
    tick();
  }
  if(document.readyState!=='loading') start(); else addEventListener('DOMContentLoaded',start);
})();
