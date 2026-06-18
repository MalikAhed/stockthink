// ===== SECTION 1 controller (independent of three.js module) =====





// ===== simple section controller (normal scroll, fire demos when sections enter view) =====
(function(){
  const sections=[...document.querySelectorAll('.s1sec')];
  const rail=document.getElementById('s1rail');
  const railDots=rail?[...rail.querySelectorAll('.dot')]:[];
  const fired={};


  // ---------- shared helpers + timer registries (so resets cancel cleanly) ----------
  const $=id=>document.getElementById(id);
  const PGN='1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Nf6 5.Qd3 e5 6.dxe5';
  let t1=[],i1=[],raf1=null;
  const T1=(ms,fn)=>{const id=setTimeout(fn,ms);t1.push(id);return id;};
  const I1=(ms,fn)=>{const id=setInterval(fn,ms);i1.push(id);return id;};
  function clear1(){ t1.forEach(clearTimeout); t1=[]; i1.forEach(clearInterval); i1=[]; if(raf1){cancelAnimationFrame(raf1);raf1=null;} }
  let t2=[],i2=[];
  const T2=(ms,fn)=>{const id=setTimeout(fn,ms);t2.push(id);return id;};
  const I2=(ms,fn)=>{const id=setInterval(fn,ms);i2.push(id);return id;};
  function clear2(){ t2.forEach(clearTimeout); t2=[]; i2.forEach(clearInterval); i2=[]; }
  let t3=[],i3=[];
  const T3=(ms,fn)=>{const id=setTimeout(fn,ms);t3.push(id);return id;};
  function clear3(){ t3.forEach(clearTimeout); t3=[]; i3.forEach(clearInterval); i3=[]; }
  let t4=[],i4=[];
  const T4=(ms,fn)=>{const id=setTimeout(fn,ms);t4.push(id);return id;};
  function clear4(){ t4.forEach(clearTimeout); t4=[]; i4.forEach(clearInterval); i4=[]; }
  let t5=[],i5=[],raf5=null;
  const T5=(ms,fn)=>{const id=setTimeout(fn,ms);t5.push(id);return id;};
  const I5=(ms,fn)=>{const id=setInterval(fn,ms);i5.push(id);return id;};
  function clear5(){ t5.forEach(clearTimeout); t5=[]; i5.forEach(clearInterval); i5=[]; if(raf5){cancelAnimationFrame(raf5);raf5=null;} }
  let t6=[],i6=[];
  const T6=(ms,fn)=>{const id=setTimeout(fn,ms);t6.push(id);return id;};
  function clear6(){ t6.forEach(clearTimeout); t6=[]; i6.forEach(clearInterval); i6=[]; }
  let t7=[],i7=[];
  const T7=(ms,fn)=>{const id=setTimeout(fn,ms);t7.push(id);return id;};
  const I7=(ms,fn)=>{const id=setInterval(fn,ms);i7.push(id);return id;};
  function clear7(){ t7.forEach(clearTimeout); t7=[]; i7.forEach(clearInterval); i7=[]; }
  let t8=[],i8=[];
  const T8=(ms,fn)=>{const id=setTimeout(fn,ms);t8.push(id);return id;};
  const I8=(ms,fn)=>{const id=setInterval(fn,ms);i8.push(id);return id;};
  function clear8(){ t8.forEach(clearTimeout); t8=[]; i8.forEach(clearInterval); i8=[]; }
  const RM=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;

  /* =================== STEP 1: "Get your game ready" combined demo ===================
     paste a PGN -> the disabled Analyse button lights up -> cursor clicks ->
     progress bar + live quips -> "Game analysed". */
  function resetGetReady(){
    clear1();
    const typed=$('pgnTyped'); if(typed){ typed.textContent=''; typed.classList.remove('flash'); }
    const menu=$('ctxMenu'); if(menu) menu.classList.remove('show');
    const paste=$('ctxPaste'); if(paste) paste.classList.remove('hot');
    const pc=$('pasteCursor'); if(pc){ pc.style.transition='none'; pc.style.opacity='0'; pc.classList.remove('clicking'); }
    const fc=$('fakeCursor'); if(fc){ fc.style.transition='none'; fc.style.opacity='0'; fc.classList.remove('clicking'); }
    const btn=$('anBtn'); if(btn){ btn.classList.remove('lit','press','done'); btn.disabled=true; }
    const lbl=$('anLabel'); if(lbl) lbl.textContent='Analyse game';
    $('progWrap')?.classList.remove('show');
    const pf=$('progFill'); if(pf) pf.style.width='0%';
    const pp=$('progPct'); if(pp) pp.textContent='0%';
    const pt=$('progText'); if(pt) pt.textContent='Starting engines\u2026';
    const pq=$('progQuip'); if(pq) pq.textContent='';
    $('progBadge')?.classList.remove('show');
    document.getElementById('titleReady')?.classList.remove('lit');
  }
  function playGetReady(){
    resetGetReady();
    const box=$('pgnBox'), cur=$('pasteCursor'), menu=$('ctxMenu'), paste=$('ctxPaste'), typed=$('pgnTyped');
    if(!box||!cur||!menu||!paste||!typed) return;
    const bw=box.clientWidth, bh=box.clientHeight;
    cur.style.left=(bw*0.7)+'px'; cur.style.top=(bh+50)+'px';
    T1(200,()=>{ cur.style.transition='left .55s cubic-bezier(.3,.7,.3,1),top .55s cubic-bezier(.3,.7,.3,1),opacity .25s';
      cur.style.opacity='1'; cur.style.left=(bw*0.42)+'px'; cur.style.top=(bh*0.5)+'px'; });
    T1(880,()=>{ cur.classList.add('clicking'); menu.style.left=(bw*0.42)+'px'; menu.style.top=(bh*0.5)+'px'; menu.classList.add('show'); });
    T1(1030,()=>cur.classList.remove('clicking'));
    T1(1300,()=>{ const br=box.getBoundingClientRect(), pr=paste.getBoundingClientRect();
      cur.style.left=((pr.left-br.left)+pr.width*0.5)+'px'; cur.style.top=((pr.top-br.top)+pr.height*0.5)+'px'; });
    T1(1720,()=>paste.classList.add('hot'));
    T1(1920,()=>cur.classList.add('clicking'));
    T1(2060,()=>{ cur.classList.remove('clicking'); menu.classList.remove('show');
      typed.textContent=PGN; void typed.offsetWidth; typed.classList.add('flash'); });
    T1(2380,()=>{ cur.style.opacity='0'; });
    // the analyse button lights up now that a game is in
    T1(2680,()=>{ const btn=$('anBtn'); if(btn){ btn.disabled=false; btn.classList.add('lit'); } });
    // fake cursor flies to the button and clicks it
    T1(3120,()=>{ const btn=$('anBtn'), fc=$('fakeCursor'); if(!btn||!fc) return;
      const br=btn.getBoundingClientRect();
      fc.style.transition='none'; fc.style.left=(br.width*0.5+46)+'px'; fc.style.top=(br.height+58)+'px'; fc.style.opacity='0'; void fc.offsetWidth;
      fc.style.transition='left .55s cubic-bezier(.3,.7,.3,1),top .55s cubic-bezier(.3,.7,.3,1),opacity .3s';
      fc.style.opacity='1'; fc.style.left=(br.width*0.5-6)+'px'; fc.style.top=(br.height*0.5)+'px'; });
    T1(3760,()=>{ $('anBtn')?.classList.add('press'); $('fakeCursor')?.classList.add('clicking'); });
    T1(3920,()=>{ $('anBtn')?.classList.remove('press'); $('fakeCursor')?.classList.remove('clicking');
      const lbl=$('anLabel'); if(lbl) lbl.textContent='Analysing\u2026';
      $('progWrap')?.classList.add('show'); T1(240,runProgress); });
    T1(4260,()=>{ $('fakeCursor') && ($('fakeCursor').style.opacity='0'); });
  }
  const QUIPS=['Stockfish 18 is crunching every position\u2026','Checking captures, checks and threats first\u2026',
    'Grading each move, from book to blunder\u2026','Measuring how the win chances swing\u2026',
    'No servers \u2014 your machine does all the work\u2026','Hunting for brilliancies and missed wins\u2026'];
  function runProgress(){
    const fill=$('progFill'), pct=$('progPct'), txt=$('progText'), quip=$('progQuip');
    if(!fill) return;
    const TOTAL=24; let qi=0;
    const showQuip=()=>{ if(!quip) return; quip.classList.add('q-out');
      T1(150,()=>{ quip.textContent=QUIPS[qi%QUIPS.length]; qi++; quip.classList.remove('q-out'); }); };
    showQuip();
    const quipId=I1(950,showQuip);
    const DUR=2400, t0=performance.now();
    (function step(now){
      const p=Math.min(1,(now-t0)/DUR);
      const e=p<0.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;   // easeInOutCubic
      const v=Math.round(e*100);
      fill.style.width=v+'%'; if(pct) pct.textContent=v+'%';
      if(txt && v<100) txt.textContent='Evaluating position '+Math.min(TOTAL,Math.round(e*TOTAL)+1)+' / '+TOTAL;
      if(p<1){ raf1=requestAnimationFrame(step); } else { clearInterval(quipId); finishProgress(); }
    })(performance.now());
  }
  function finishProgress(){
    const txt=$('progText'); if(txt) txt.textContent='All 24 positions evaluated.';
    const quip=$('progQuip'); if(quip) quip.textContent='';
    $('progBadge')?.classList.add('show');
    const lbl=$('anLabel'); if(lbl) lbl.textContent='Review ready';
    $('anBtn')?.classList.add('done');
    document.getElementById('titleReady')?.classList.add('lit');
  }

  /* =================== STEP 2: "Connect chess.com" demo ===================
     type a username -> Find games -> player card -> game history -> pick a game. */
  const CC_USER='MalikAhed';
  function resetChesscom(){
    clear2();
    const inp=$('ccUser'); if(inp) inp.value='';
    $('ccBox')?.classList.remove('focus');
    const find=$('ccFind'); if(find) find.classList.remove('finding','press');
    const fl=$('ccFindLabel'); if(fl) fl.textContent='Find games';
    const cur=$('ccCursor'); if(cur){ cur.style.transition='none'; cur.style.opacity='0'; cur.classList.remove('clicking'); }
    $('ccPlayerWrap')?.classList.remove('show');
    $('ccListWrap')?.classList.remove('show');
    document.querySelectorAll('#ccList .cc-row').forEach(r=>{ r.classList.remove('hot','sel','loading','ready'); const s=r.querySelector('[data-status]'); if(s) s.innerHTML=''; });
    const ab=$('ccAnalyse'); if(ab){ ab.disabled=true; ab.classList.remove('lit','finding','done','press'); }
    const al=$('ccAnalyseLabel'); if(al) al.textContent='Analyse games';
    const sc=$('ccSelCount'); if(sc) sc.textContent='Select games to analyse';
    document.getElementById('titleConnect')?.classList.remove('lit');
  }
  function playChesscom(){
    resetChesscom();
    const inp=$('ccUser'), box=$('ccBox'), find=$('ccFind'), fl=$('ccFindLabel'), cur=$('ccCursor'), app=$('ccApp');
    if(!inp||!find||!app) return;
    const rel=(el)=>{ const r=el.getBoundingClientRect(), a=app.getBoundingClientRect(); return {l:r.left-a.left,t:r.top-a.top,w:r.width,h:r.height}; };
    T2(300,()=>box?.classList.add('focus'));
    let k=0; const typeId=I2(70,()=>{ if(k<=CC_USER.length){ inp.value=CC_USER.slice(0,k); k++; } else clearInterval(typeId); });
    const tEnd=300+CC_USER.length*70+260;
    // cursor to Find, click
    T2(tEnd,()=>{ if(!cur) return; const b=rel(find);
      cur.style.transition='none'; cur.style.left=(b.l+b.w*0.5)+'px'; cur.style.top=(b.t+b.h+50)+'px'; cur.style.opacity='0'; void cur.offsetWidth;
      cur.style.transition='left .55s cubic-bezier(.3,.7,.3,1),top .55s cubic-bezier(.3,.7,.3,1),opacity .3s';
      cur.style.opacity='1'; cur.style.left=(b.l+b.w*0.5)+'px'; cur.style.top=(b.t+b.h*0.5)+'px'; });
    T2(tEnd+650,()=>{ find.classList.add('press'); cur?.classList.add('clicking'); });
    T2(tEnd+820,()=>{ find.classList.remove('press'); cur?.classList.remove('clicking');
      box?.classList.remove('focus'); find.classList.add('finding'); if(fl) fl.textContent='Finding\u2026';
      document.getElementById('titleConnect')?.classList.add('lit'); });
    // player card, then game list
    T2(tEnd+1550,()=>{ find.classList.remove('finding'); if(fl) fl.textContent='Find games'; $('ccPlayerWrap')?.classList.add('show'); });
    T2(tEnd+1980,()=>$('ccListWrap')?.classList.add('show'));
    T2(tEnd+2150,()=>{ if(cur) cur.style.opacity='0'; });
    // --- multi-select: tick 3 games, then click "Analyse games" ---
    const rowsEls=()=>document.querySelectorAll('#ccList .cc-row');
    const moveCur=(el,fx,fy)=>{ if(!cur||!el) return; const b=rel(el);
      cur.style.transition='left .42s cubic-bezier(.3,.7,.3,1),top .42s cubic-bezier(.3,.7,.3,1),opacity .25s';
      cur.style.opacity='1'; cur.style.left=(b.l+b.w*fx)+'px'; cur.style.top=(b.t+b.h*fy)+'px'; };
    const PICK=[0,1,2];
    let tt=tEnd+2500;
    PICK.forEach((idx)=>{
      T2(tt,()=>moveCur(rowsEls()[idx],0.045,0.5));        // cursor to the row's checkbox (far left)
      T2(tt+380,()=>cur?.classList.add('clicking'));
      T2(tt+500,()=>{ cur?.classList.remove('clicking');
        rowsEls()[idx]?.classList.add('sel');
        const n=document.querySelectorAll('#ccList .cc-row.sel').length;
        const sc=$('ccSelCount'); if(sc) sc.textContent=n+' game'+(n>1?'s':'')+' selected';
        const ab=$('ccAnalyse'), al=$('ccAnalyseLabel');
        if(ab){ ab.disabled=false; ab.classList.add('lit'); } if(al) al.textContent='Analyse '+n+' game'+(n>1?'s':''); });
      tt+=760;
    });
    // cursor to the Analyse button, click it
    T2(tt,()=>moveCur($('ccAnalyse'),0.5,0.5));
    T2(tt+440,()=>{ $('ccAnalyse')?.classList.add('press'); cur?.classList.add('clicking'); });
    T2(tt+580,()=>{ $('ccAnalyse')?.classList.remove('press'); cur?.classList.remove('clicking');
      $('ccAnalyse')?.classList.add('finding'); const al=$('ccAnalyseLabel'); if(al) al.textContent='Analysing\u2026';
      if(cur) cur.style.opacity='0'; });
    // each selected game, in order: checkbox -> loading spinner -> play button (ready to view)
    PICK.forEach((idx,k)=>{
      T2(tt+800+k*620,()=>rowsEls()[idx]?.classList.add('loading'));
      T2(tt+1560+k*620,()=>{ const r=rowsEls()[idx]; if(r){ r.classList.remove('loading'); r.classList.add('ready'); } });
    });
    T2(tt+1560+PICK.length*620+200,()=>{ $('ccAnalyse')?.classList.remove('finding'); $('ccAnalyse')?.classList.add('done');
      const al=$('ccAnalyseLabel'); if(al) al.textContent='\u2713 3 ready to view'; });
  }

  /* =================== STEP 3: live blunder review ===================
     queen walks d6 -> d4, a pawn takes it, the Blunder badge stamps in,
     the eval swings to White, and the explanation types itself out. */
  const NEO='https://images.chesscomfiles.com/chess-themes/pieces/neo/150';
  // position just before the blunder: the queen sits on d6 (everything else is the teaching position)
  // balanced middlegame (material dead-even) — Black's queen will grab the e5 bishop,
  // which is guarded only by the f4-pawn. Black to "move" the blunder Qxe5.
  const REV_POS={
    g8:'bk', f8:'br', c8:'bb', f6:'bn', h5:'bq',
    a7:'bp', b7:'bp', c7:'bp', f7:'bp', g7:'bp', h7:'bp',
    e5:'wb', f4:'wp', e4:'wp', c3:'wn',
    a2:'wp', b2:'wp', g2:'wp', h2:'wp', d2:'wq', f1:'wr', g1:'wk' };
  function sqXY(sq){ const f='abcdefgh'.indexOf(sq[0]), r=parseInt(sq[1],10); return {x:f*12.5, y:(8-r)*12.5}; }
  function buildBoard(){
    const b=$('revBoard'); if(!b) return;
    let h='';
    for(let row=0;row<8;row++) for(let col=0;col<8;col++){
      const c=((row+col)%2)?'#739552':'#ebecd0';
      h+='<div class="rev-sq" style="left:'+(col*12.5)+'%;top:'+(row*12.5)+'%;background:'+c+'"></div>';
    }
    h+='<div class="rev-hi" id="revHiFrom"></div><div class="rev-hi" id="revHiTo"></div><div class="rev-hi rev-guard" id="revGuardHi"></div><div class="rev-cap" id="revCap"></div>';
    // file/rank coordinates, coloured to contrast their square
    const FILES='abcdefgh';
    for(let i=0;i<8;i++){
      h+='<span class="rev-coord rev-rank" style="top:'+(i*12.5)+'%;color:'+((i%2)?'#ebecd0':'#739552')+'">'+(8-i)+'</span>';
      h+='<span class="rev-coord rev-file" style="left:'+((i+1)*12.5)+'%;color:'+(((7+i)%2)?'#ebecd0':'#739552')+'">'+FILES[i]+'</span>';
    }
    for(const sq in REV_POS){ const code=REV_POS[sq]; const xy=sqXY(sq);
      const idAttr = code==='bq' ? ' id="revQueen"' : (sq==='e5' ? ' id="revBishop"' : '');
      h+='<div class="rp"'+idAttr+' data-sq="'+sq+'" style="left:'+xy.x+'%;top:'+xy.y+"%;background-image:url('"+NEO+'/'+code+".png')\"></div>";
    }
    // the on-square blunder badge that pops onto d4 (reuses the card's badge image — no duplicated data URI)
    const bsq=sqXY('e5'); const ico=$('revCardIco'); const src=ico?ico.src:'';
    h+='<div class="rev-sqbadge" id="revSqBadge" style="left:'+bsq.x+'%;top:'+bsq.y+'%"><img src="'+src+'" alt=""></div>';
    b.innerHTML=h;
    buildMovelog();
  }
  function placeAt(el,sq){ if(!el) return; const xy=sqXY(sq); el.style.left=xy.x+'%'; el.style.top=xy.y+'%'; }
  function showHi(id,sq){ const el=$(id); if(!el) return; const xy=sqXY(sq); el.style.left=xy.x+'%'; el.style.top=xy.y+'%'; el.classList.add('on'); }
  // move log data \u2014 6 moves that reach the teaching position (queen lands on h5 last)
  const REV_MOVES=[['e4','e5'],['Nf3','Nc6'],['Bc4','Bc5'],['Nc3','Nf6'],['d3','d6'],['f4','Qh5']];
  const ML_PC={N:'n',B:'b',Q:'q',R:'r',K:'k'};
  function fmtMlMove(mv,col){
    const isBlunder=mv.endsWith('??');
    const clean=isBlunder?mv.slice(0,-2):mv;
    const pc=ML_PC[clean[0]];
    let h='';
    if(pc) h+='<img class="ml-pico" src="'+NEO+'/'+col+pc+'.png" alt="">'+clean.slice(1);
    else h+=clean;
    if(isBlunder) h+='<img class="ml-badge" src="./icons/blunder.svg" alt="??">';
    return h;
  }
  function buildMovelog(){
    const el=$('revMovelog'); if(!el) return;
    let h='';
    REV_MOVES.forEach(([w,b],i)=>{
      h+='<div class="ml-row" id="mlr'+(i+1)+'"><span class="ml-num">'+(i+1)+'</span>'
        +'<span class="ml-w">'+fmtMlMove(w,'w')+'</span>'
        +'<span class="ml-b">'+fmtMlMove(b,'b')+'</span></div>';
    });
    el.innerHTML=h;
  }
  // graph: pre-blunder baseline then blunder spike
  const REV_GP='0,16 16,17 33,15 50,17 66,14 83,16';
  function resetGraph(){
    const ln=$('revGraphLine'),fl=$('revGraphFill'),dt=$('revGraphDot');
    if(ln) ln.setAttribute('points',REV_GP);
    if(fl) fl.setAttribute('d','M0,16 L16,17 L33,15 L50,17 L66,14 L83,16 L83,18 L0,18 Z');
    if(dt) dt.setAttribute('opacity','0');
  }
  function spikeGraph(){
    const ln=$('revGraphLine'),fl=$('revGraphFill'),dt=$('revGraphDot');
    if(ln) ln.setAttribute('points',REV_GP+' 100,5');
    if(fl) fl.setAttribute('d','M0,16 L16,17 L33,15 L50,17 L66,14 L83,16 L100,5 L100,18 L0,18 Z');
    if(dt){ dt.setAttribute('cx','100'); dt.setAttribute('cy','5'); dt.setAttribute('opacity','1'); }
  }
  function resetBlunder(){
    clear3();
    buildBoard(); // also rebuilds movelog
    const ev=$('revEval'); if(ev) ev.style.height='50%';
    const et=$('revEvalTop'); if(et){ et.textContent='0.0'; et.classList.remove('lead'); }
    const eb=$('revEvalBot'); if(eb){ eb.textContent='0.0'; eb.classList.remove('lead'); }
    $('revSqBadge')?.classList.remove('show');
    $('revCardHead')?.classList.remove('show');
    $('revIdle')?.classList.remove('hide');
    $('revAnalysing')?.classList.add('hide');
    const tx=$('revText'); if(tx) tx.textContent='';
    $('revCaret')?.classList.remove('on');
    resetGraph();
  }
  const NEO_MV=(mv,code)=>{ const piece=/^[KQRBN]/.test(mv);
    return '<span class="rev-mv">'+(piece?'<img class="rev-mv-ico" src="'+NEO+'/'+code+'.png" alt="">':'')+(piece?mv.slice(1):mv)+'</span>'; };
  const REV_ESC=(s)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  const REV_TOKENS=[ {mv:'Qxe5',code:'bq'}, '?? snaps off the bishop \u2014 but it\u2019s guarded by the f4-pawn. ',
    {mv:'fxe5',code:'wp'}, ' wins the queen back: a whole queen for a bishop.' ];
  function playBlunder(){
    resetBlunder();
    // 0-1080ms: cursor sweeps the move log (each row highlights in turn)
    REV_MOVES.forEach((_,i)=>{
      T3(i*180,()=>{
        document.querySelectorAll('.ml-row').forEach(r=>r.classList.remove('ml-active'));
        document.getElementById('mlr'+(i+1))?.classList.add('ml-active');
      });
    });
    // 1100ms: queen slides h5\u2192e5
    T3(1100,()=>{ showHi('revHiFrom','h5'); showHi('revHiTo','e5'); const q=$('revQueen'); if(q) q.style.zIndex='5'; placeAt(q,'e5'); });
    // 1630ms: bishop disappears; blunder row 7 appended to log
    T3(1630,()=>{
      const bs=$('revBishop'); if(bs) bs.style.opacity='0';
      document.querySelectorAll('.ml-row').forEach(r=>r.classList.remove('ml-active'));
      const ml=$('revMovelog');
      if(ml){
        const row=document.createElement('div');
        row.className='ml-row'; row.id='mlrBlunder';
        row.innerHTML='<span class="ml-num">7</span><span class="ml-w"></span>'
          +'<span class="ml-b ml-blunder"><img class="ml-pico" src="'+NEO+'/bq.png" alt="">xe5<img class="ml-badge" src="./icons/blunder.svg" alt="??"></span>';
        ml.appendChild(row);
        setTimeout(()=>{ row.classList.add('ml-active'); ml.scrollTop=ml.scrollHeight; },30);
      }
    });
    // 1730ms: badge, eval bar, red cap, guard highlight, graph spike, analysis starts
    T3(1730,()=>{
      $('revSqBadge')?.classList.add('show');
      const ev=$('revEval'); if(ev) ev.style.height='80%';
      const bot=$('revEvalBot'); if(bot){ bot.textContent='+5.8'; bot.classList.add('lead'); }
      const top=$('revEvalTop'); if(top) top.textContent='-5.8';
      const cap=$('revCap'); if(cap){ const xy=sqXY('e5'); cap.style.left=xy.x+'%'; cap.style.top=xy.y+'%'; cap.classList.add('on'); }
      showHi('revGuardHi','f4');
      $('revCardHead')?.classList.add('show');
      $('revIdle')?.classList.add('hide');
      $('revAnalysing')?.classList.remove('hide');
      spikeGraph();
    });
    // 2950ms: explanation types itself out
    T3(2950,()=>{ $('revAnalysing')?.classList.add('hide'); $('revCaret')?.classList.add('on');
      const el=$('revText'); if(!el) return; el.innerHTML='';
      const body=el.closest('.rev-card-body');               // scroll container so the tail stays visible
      const keepEnd=()=>{ if(body) body.scrollTop=body.scrollHeight; };
      let ti=0, ci=0;
      const build=(upto,partial)=>{ let s='';
        for(let i=0;i<upto;i++){ const t=REV_TOKENS[i]; s+=(typeof t==='string')?REV_ESC(t):NEO_MV(t.mv,t.code); }
        if(partial!=null) s+=REV_ESC(partial); return s; };
      const stepFn=()=>{
        if(ti>=REV_TOKENS.length){ const id=setTimeout(()=>$('revCaret')?.classList.remove('on'),450); t3.push(id); return; }
        const t=REV_TOKENS[ti];
        if(typeof t==='string'){ ci++; el.innerHTML=build(ti,t.slice(0,ci)); keepEnd(); if(ci>=t.length){ ti++; ci=0; }
          const id=setTimeout(stepFn,20); t3.push(id); }
        else { el.innerHTML=build(ti+1,null); keepEnd(); ti++; ci=0; const id=setTimeout(stepFn,130); t3.push(id); }
      };
      stepFn(); });
  }

  /* =================== STEP 4: a "good" move, then the BEST move ===================
     Engine-verified position (Stockfish 18, depth 18): White to move.
       FEN r1qr2k1/pb3ppp/1p6/2pN4/4P3/8/PP3PPP/R2Q1RK1 w
     Good = Qf3 (quiet, keeps it level, eval ~0.0). Best = Ne7+ (engine #1, +3.2):
     a knight check that FORKS the king (g8) and queen (c8), winning the queen for
     the knight. Story: good move ticked → "Show best move" button → cursor clicks →
     the good line is struck/greyed/faded → the engine reveals Ne7+ and explains it. */
  const POS4={
    a8:'br', c8:'bq', d8:'br', g8:'bk',
    a7:'bp', b7:'bb', f7:'bp', g7:'bp', h7:'bp',
    b6:'bp', c5:'bp',
    d5:'wn', e4:'wp',
    a2:'wp', b2:'wp', f2:'wp', g2:'wp', h2:'wp',
    a1:'wr', d1:'wq', f1:'wr', g1:'wk' };
  function buildBoard4(){
    const b=$('board4'); if(!b) return;
    let h='';
    for(let row=0;row<8;row++) for(let col=0;col<8;col++){
      const c=((row+col)%2)?'#739552':'#ebecd0';
      h+='<div class="rev-sq" style="left:'+(col*12.5)+'%;top:'+(row*12.5)+'%;background:'+c+'"></div>';
    }
    h+='<div class="rev-hi" id="s4HiFrom"></div><div class="rev-hi" id="s4HiTo"></div>'
      +'<div class="s4-greenhi" id="s4Green"></div>'
      +'<div class="s4-forkhi" id="s4ForkK"></div><div class="s4-forkhi" id="s4ForkQ"></div>';
    // file/rank coordinates (match step 3)
    const FILES='abcdefgh';
    for(let i=0;i<8;i++){
      h+='<span class="rev-coord rev-rank" style="top:'+(i*12.5)+'%;color:'+((i%2)?'#ebecd0':'#739552')+'">'+(8-i)+'</span>';
      h+='<span class="rev-coord rev-file" style="left:'+((i+1)*12.5)+'%;color:'+(((7+i)%2)?'#ebecd0':'#739552')+'">'+FILES[i]+'</span>';
    }
    for(const sq in POS4){ const code=POS4[sq]; const xy=sqXY(sq);
      const idAttr = sq==='d5' ? ' id="s4Knight"' : (sq==='d1' ? ' id="s4Queen"' : (sq==='c8' ? ' id="s4BlackQ"' : (sq==='g8' ? ' id="s4King"' : (sq==='d8' ? ' id="s4BlackR"' : ''))));
      h+='<div class="rp"'+idAttr+' data-sq="'+sq+'" style="left:'+xy.x+'%;top:'+xy.y+"%;background-image:url('"+NEO+'/'+code+".png')\"></div>";
    }
    // best-move badge (pops on the knight's square) + good badge (pops on f3) + the check tag near the king
    const e7=sqXY('e7'), f3=sqXY('f3');
    h+='<div class="rev-sqbadge" id="s4Badge" style="left:'+e7.x+'%;top:'+e7.y+'%"><img src="./icons/best.svg" alt=""></div>';
    h+='<div class="rev-sqbadge" id="s4GoodBadge" style="left:'+f3.x+'%;top:'+f3.y+'%"><img src="./icons/good.svg" alt=""></div>';
    h+='<div class="s4-checktag" id="s4Check" style="left:76.5%;top:1.5%">+</div>';
    b.innerHTML=h;
  }
  function s4hi(id,sq,on){ const el=$(id); if(!el) return; if(sq){ const xy=sqXY(sq); el.style.left=xy.x+'%'; el.style.top=xy.y+'%'; } el.classList.toggle('on',on); }
  // move the best-move badge onto a square (left/top are instant — no slide while hidden)
  function s4badgeAt(sq){ const el=$('s4Badge'); if(!el) return; const xy=sqXY(sq); el.style.left=xy.x+'%'; el.style.top=xy.y+'%'; }
  function s4head(icoFile,title,code,moveText){
    const ico=$('s4CardIco'); if(ico) ico.src='./icons/'+icoFile;
    const t=$('s4CardTitle'); if(t) t.textContent=title;
    const mv=$('s4CardMove'); if(mv) mv.innerHTML='<img class="rev-mv-ico" src="'+NEO+'/'+code+'.png" alt="">'+moveText;
  }
  function s4eval(h,top,bot,lead){
    const e=$('s4Eval'); if(e) e.style.height=h;
    const t=$('s4EvalTop'); if(t){ t.textContent=top; t.classList.toggle('lead',lead==='top'); }
    const b=$('s4EvalBot'); if(b){ b.textContent=bot; b.classList.toggle('lead',lead==='bot'); }
  }
  // token typewriter (shared shape with step 3) — strings type out, move-tags pop in whole
  function s4type(el,tokens,doneCb){
    if(!el) return; el.innerHTML=''; let ti=0,ci=0;
    const body=el.closest('.rev-card-body');                 // scroll container so the tail stays visible
    const keepEnd=()=>{ if(body) body.scrollTop=body.scrollHeight; };
    const build=(upto,partial)=>{ let s='';
      for(let i=0;i<upto;i++){ const t=tokens[i]; s+=(typeof t==='string')?REV_ESC(t):NEO_MV(t.mv,t.code); }
      if(partial!=null) s+=REV_ESC(partial); return s; };
    const stepFn=()=>{
      if(ti>=tokens.length){ doneCb&&doneCb(); return; }
      const t=tokens[ti];
      if(typeof t==='string'){ ci++; el.innerHTML=build(ti,t.slice(0,ci)); keepEnd(); if(ci>=t.length){ ti++; ci=0; }
        const id=setTimeout(stepFn,20); t4.push(id); }
      else { el.innerHTML=build(ti+1,null); keepEnd(); ti++; ci=0; const id=setTimeout(stepFn,120); t4.push(id); }
    };
    stepFn();
  }
  // ---- eval-history graph (mirrors step 3): flat through the good move, spikes up on the best move ----
  const S4_GP='0,17 16,18 33,16 50,18 66,17 83,18';
  function s4resetGraph(){
    const ln=$('s4GraphLine'),fl=$('s4GraphFill'),dt=$('s4GraphDot');
    if(ln) ln.setAttribute('points',S4_GP);
    if(fl) fl.setAttribute('d','M0,17 L16,18 L33,16 L50,18 L66,17 L83,18 L83,18 L0,18 Z');
    if(dt) dt.setAttribute('opacity','0');
  }
  function s4spikeGraph(){
    const ln=$('s4GraphLine'),fl=$('s4GraphFill'),dt=$('s4GraphDot');
    if(ln) ln.setAttribute('points',S4_GP+' 100,10');
    if(fl) fl.setAttribute('d','M0,17 L16,18 L33,16 L50,18 L66,17 L83,18 L100,10 L100,18 L0,18 Z');
    if(dt){ dt.setAttribute('cx','100'); dt.setAttribute('cy','10'); dt.setAttribute('opacity','1'); }
  }
  const GOOD_TOKENS=[ {mv:'Qf3',code:'wq'}, ' keeps the game level — a calm, sensible developing move.' ];
  const BEST_CHECK_TOKENS=[ {mv:'Ne7+',code:'wn'}, ' is a royal fork — the knight checks the king and hits the queen at the same time.' ];
  const BEST_CAP_TOKENS=[ 'Now ', {mv:'Nxc8',code:'wn'}, ' grabs the queen — a whole queen for a knight.' ];
  // ---- move log (chess-analysis-tab style) ----
  const S4_PC={K:'k',Q:'q',R:'r',B:'b',N:'n'};
  function mlPiece(mv,color){ const m=S4_PC[mv[0]]; return m?('<img class="ml-pico" src="'+NEO+'/'+color+m+'.png" alt="">'+mv.slice(1)):mv; }
  function s4mlReset(){ const el=$('s4Movelog'); if(!el) return;
    el.innerHTML=
      '<div class="ml-row ml-ctx"><span class="ml-num">16</span><span class="ml-w">'+mlPiece('Nd5','w')+'</span><span class="ml-b">c5</span></div>'+
      '<div class="ml-row ml-ctx"><span class="ml-num">17</span><span class="ml-w">'+mlPiece('e4','w')+'</span><span class="ml-b">b6</span></div>'; }
  function s4mlAdd(html,id){ const el=$('s4Movelog'); if(!el) return null;
    const d=document.createElement('div'); d.className='ml-row'; if(id) d.id=id; d.innerHTML=html; el.appendChild(d); el.scrollTop=el.scrollHeight; return d; }
  // move the step-4 cursor onto an element (relative to the panel)
  function s4moveCur(targetEl,fx,fy){
    const cur=$('s4Cursor'), panel=document.querySelector('.s1better .rev-panel');
    if(!cur||!panel||!targetEl) return;
    const r=targetEl.getBoundingClientRect(), a=panel.getBoundingClientRect();
    cur.style.transition='left .55s cubic-bezier(.3,.7,.3,1),top .55s cubic-bezier(.3,.7,.3,1),opacity .3s';
    cur.style.opacity='1';
    cur.style.left=(r.left-a.left+r.width*fx)+'px';
    cur.style.top=(r.top-a.top+r.height*fy)+'px';
  }
  function resetBest(){
    clear4();
    buildBoard4();
    s4mlReset();
    s4resetGraph();
    s4eval('50%','0.0','0.0',null);
    s4head('good.svg','Good move','wq','f3');
    $('s4Comment')?.classList.remove('s4-struck','s4-greyed','s4-fade');
    $('s4Strike')?.classList.remove('sweep');
    $('s4Idle')?.classList.remove('hide');
    $('s4Analysing')?.classList.add('hide');
    const tx=$('s4Text'); if(tx) tx.innerHTML='';
    $('s4Caret')?.classList.remove('on');
    $('s4ShowBtn')?.classList.remove('show','press','gone');
    $('s4NextBtn')?.classList.remove('show','press','gone');
    $('s4CardHead')?.classList.remove('show');
    const cur=$('s4Cursor'); if(cur){ cur.style.transition='none'; cur.style.opacity='0'; cur.classList.remove('clicking'); }
  }
  function playBest(){
    resetBest();
    if(RM()){
      placeAt($('s4King'),'h8'); const kn=$('s4Knight'); if(kn) kn.style.opacity='0';
      const bq=$('s4BlackQ'); if(bq) bq.style.opacity='0'; placeAt($('s4BlackR'),'c8');
      s4badgeAt('c8'); $('s4Badge')?.classList.add('show'); s4hi('s4Green','c8',true);
      s4eval('73%','-3.2','+3.2','bot'); s4head('best.svg','Best move','wn','xc8'); s4spikeGraph();
      $('s4Idle')?.classList.add('hide'); $('s4CardHead')?.classList.add('show');
      const tx=$('s4Text'); if(tx) tx.innerHTML=NEO_MV('Nxc8','wn')+REV_ESC(' wins the queen for a knight — and ')+NEO_MV('Rxc8','br')+REV_ESC(' can only recapture.');
      s4mlAdd('<span class="ml-num">18</span><span class="ml-w ml-best">'+mlPiece('Ne7+','w')+'<img class="ml-badge" src="./icons/best.svg"></span><span class="ml-b">'+mlPiece('Kh8','b')+'</span>');
      s4mlAdd('<span class="ml-num">19</span><span class="ml-w ml-best">'+mlPiece('Nxc8','w')+'</span><span class="ml-b ml-best">'+mlPiece('Rxc8','b')+'<img class="ml-badge" src="./icons/best.svg"></span>');
      return;
    }
    // ================= 1) the GOOD move: Qf3 — keeps it level, ticked "Good" =================
    T4(700,()=>{ s4hi('s4HiFrom','d1',true); s4hi('s4HiTo','f3',true); placeAt($('s4Queen'),'f3');
      s4eval('50%','0.0','0.0',null);
      $('s4GoodBadge')?.classList.add('show');               // "good" badge pops top-right of f3
      $('s4CardHead')?.classList.add('show');
      s4mlAdd('<span class="ml-num">18</span><span class="ml-w ml-good">'+mlPiece('Qf3','w')+'<img class="ml-badge" src="./icons/good.svg"></span><span class="ml-b"></span>','s4mlGood');
      $('s4Idle')?.classList.add('hide'); $('s4Analysing')?.classList.remove('hide'); });
    T4(1800,()=>{ $('s4Analysing')?.classList.add('hide'); $('s4Caret')?.classList.add('on');
      s4type($('s4Text'),GOOD_TOKENS,()=>{ T4(700,()=>{ $('s4Caret')?.classList.remove('on'); $('s4ShowBtn')?.classList.add('show'); }); }); });
    // ================= 2) cursor → "Show best move" → click → good badge goes, gray strike =======
    T4(4600,()=>{ s4moveCur($('s4ShowBtn'),0.5,0.5); });
    T4(5550,()=>{ $('s4ShowBtn')?.classList.add('press'); $('s4Cursor')?.classList.add('clicking'); });
    T4(5780,()=>{ $('s4ShowBtn')?.classList.remove('press'); $('s4Cursor')?.classList.remove('clicking');
      const cur=$('s4Cursor'); if(cur) cur.style.opacity='0';
      $('s4ShowBtn')?.classList.add('gone');
      $('s4GoodBadge')?.classList.remove('show');            // good badge disappears on the click
      $('s4Strike')?.classList.add('sweep');                 // gray line sweeps L→R crossing the text
      $('s4Comment')?.classList.add('s4-struck');            // text greys + line-through as the line passes
      $('s4mlGood')?.classList.add('ml-struck');
      s4hi('s4HiFrom',null,false); s4hi('s4HiTo',null,false); });
    T4(6700,()=>{ $('s4Comment')?.classList.add('s4-greyed'); });   // pause to read, then grey out
    T4(7400,()=>{ $('s4Comment')?.classList.add('s4-fade'); });     // …then fade away
    // ================= 3) re-cast the card while still faded, then FADE the best card in ========
    T4(8100,()=>{
      placeAt($('s4Queen'),'d1');
      $('s4Comment')?.classList.remove('s4-struck','s4-greyed');   // keep s4-fade → card stays invisible
      $('s4Strike')?.classList.remove('sweep');
      s4head('best.svg','Best move','wn','e7+');
      const tx=$('s4Text'); if(tx) tx.innerHTML='';
      $('s4Analysing')?.classList.remove('hide');
      T4(80,()=>$('s4Comment')?.classList.remove('s4-fade')); });  // now fade the fresh best card in
    // ================= 4) BEST move: Ne7+ — knight lands e7, best badge pops the moment it lands ====
    T4(9000,()=>{ s4hi('s4HiFrom','d5',true); s4hi('s4HiTo','e7',true); placeAt($('s4Knight'),'e7');
      s4badgeAt('e7'); $('s4Badge')?.classList.add('show');   // best svg appears as the knight lands
      $('s4Check')?.classList.add('on'); s4hi('s4ForkK','g8',true); s4hi('s4ForkQ','c8',true);
      s4eval('70%','-3.0','+3.0','bot'); s4spikeGraph();       // the fork already wins the queen → bar swings now
      s4mlAdd('<span class="ml-num">18</span><span class="ml-w ml-best">'+mlPiece('Ne7+','w')+'<img class="ml-badge" src="./icons/best.svg"></span><span class="ml-b" id="s4mlBlack"></span>','s4mlBestRow'); });
    T4(9550,()=>{ $('s4Analysing')?.classList.add('hide'); $('s4Caret')?.classList.add('on');
      s4type($('s4Text'),BEST_CHECK_TOKENS,()=>{
        // ===== whole continuation chained off "typing done" so ordering is guaranteed =====
        // a) the king escapes → the e7 badge goes away the moment the king moves
        T4(1000,()=>{ $('s4Caret')?.classList.remove('on');
          $('s4Badge')?.classList.remove('show');            // svg goes away as the king moves
          placeAt($('s4King'),'h8'); $('s4Check')?.classList.remove('on'); s4hi('s4ForkK',null,false);
          const mb=$('s4mlBlack'); if(mb) mb.innerHTML=mlPiece('Kh8','b'); });
        // b) the knight takes the queen → best badge re-pops on c8
        T4(1900,()=>{ s4hi('s4HiFrom','e7',true); s4hi('s4HiTo','c8',true); placeAt($('s4Knight'),'c8');
          const bq=$('s4BlackQ'); if(bq) bq.style.opacity='0';
          $('s4ForkQ')?.classList.remove('on'); s4hi('s4Green','c8',true);
          s4badgeAt('c8'); $('s4Badge')?.classList.add('show');
          s4eval('73%','-3.2','+3.2','bot'); s4head('best.svg','Best move','wn','xc8'); s4spikeGraph();
          s4mlAdd('<span class="ml-num">19</span><span class="ml-w ml-best">'+mlPiece('Nxc8','w')+'</span><span class="ml-b" id="s4mlBlack2"></span>','s4mlCapRow'); });
        // c) the explanation types out
        T4(2500,()=>{ const tx=$('s4Text'); if(tx) tx.innerHTML=''; $('s4Caret')?.classList.add('on');
          s4type($('s4Text'),BEST_CAP_TOKENS,()=>{ T4(300,()=>$('s4Caret')?.classList.remove('on')); }); });
        // d) Black's only reply: Rxc8 recaptures the knight (best by Black) — badge re-pops for the move
        T4(4400,()=>{ s4hi('s4HiFrom','d8',true); s4hi('s4HiTo','c8',true);
          const kn=$('s4Knight'); if(kn) kn.style.opacity='0';   // knight is captured
          placeAt($('s4BlackR'),'c8'); $('s4Badge')?.classList.remove('show');
          const mb=$('s4mlBlack2'); if(mb){ mb.innerHTML=mlPiece('Rxc8','b')+'<img class="ml-badge" src="./icons/best.svg">'; mb.classList.add('ml-best'); } });
        T4(4800,()=>{ s4badgeAt('c8'); $('s4Badge')?.classList.add('show'); s4hi('s4HiFrom',null,false); s4hi('s4HiTo',null,false); });
        // e) "Back to game analysis" → cursor clicks → return to the original game
        T4(5800,()=>{ $('s4NextBtn')?.classList.add('show'); });
        T4(6600,()=>{ s4moveCur($('s4NextBtn'),0.5,0.5); });
        T4(7550,()=>{ $('s4NextBtn')?.classList.add('press'); $('s4Cursor')?.classList.add('clicking'); });
        T4(7780,()=>{ $('s4NextBtn')?.classList.remove('press'); $('s4Cursor')?.classList.remove('clicking');
          $('s4NextBtn')?.classList.add('gone'); resetBest(); });
      }); });
  }

  /* =================== HOW IT WORKS — shared abs-board builder =================== */
  function buildAbsBoard(id,pos,opt){
    const b=$(id); if(!b) return; opt=opt||{};
    let h='';
    for(let row=0;row<8;row++) for(let col=0;col<8;col++){ const c=((row+col)%2)?'#739552':'#ebecd0';
      h+='<div class="rev-sq" style="left:'+(col*12.5)+'%;top:'+(row*12.5)+'%;background:'+c+'"></div>'; }
    h+='<div class="rev-hi" id="'+id+'HiA"></div><div class="rev-hi" id="'+id+'HiB"></div><div class="s4-greenhi" id="'+id+'Green"></div>';
    for(const sq in pos){ const code=pos[sq]; const xy=sqXY(sq);
      const idAttr = (opt.markId && sq===opt.markSq) ? ' id="'+opt.markId+'"' : '';
      h+='<div class="rp"'+idAttr+' data-sq="'+sq+'" style="left:'+xy.x+'%;top:'+xy.y+"%;background-image:url('"+NEO+'/'+code+".png')\"></div>"; }
    b.innerHTML=h;
  }

  /* =================== BEAT 1: the engine, in your browser (Stockfish finds Nxf7) ===================
     Fried Liver — engine-verified: Stockfish #1 = Nxf7 (g5f7). We show the search narrowing
     candidate arrows down to that move. No eval, no words — that's pure engine. */
  const POS_ENG={ a8:'br',c8:'bb',d8:'bq',e8:'bk',f8:'bb',h8:'br',
    a7:'bp',b7:'bp',c7:'bp',f7:'bp',g7:'bp',h7:'bp',
    c6:'bn', d5:'bn',e5:'bp',g5:'wn', c4:'wb',
    a2:'wp',b2:'wp',c2:'wp',d2:'wp',f2:'wp',g2:'wp',h2:'wp',
    a1:'wr',b1:'wn',c1:'wb',d1:'wq',e1:'wk',h1:'wr' };
  function buildEngBoard(){ buildAbsBoard('engBoard',POS_ENG,{}); }
  // The best move is the L-shaped knight hop g5->f7: go UP then point LEFT into f7 (engine-verified Nxf7).
  function engDrawBest(){ const g=$('engArrowG'); if(!g) return;
    const a=sqXY('g5'), b=sqXY('f7'); const x1=a.x+6.25,y1=a.y+6.25,x2=b.x+6.25,y2=b.y+6.25;
    g.innerHTML='<polyline class="eng-arr eng-arr-best" points="'+x1+','+y1+' '+x1+','+y2+' '+x2+','+y2+'" marker-end="url(#engAh)"></polyline>'; }
  // the neural-net "compute" visual — square nodes in the reference topology (teal→green).
  // f = filled green node, else black-outlined node; edges cross like the reference icon.
  function engBuildNet(){ const svg=$('engNetSvg'); if(!svg) return;
    const N=[ {x:15,y:50,s:18,f:false},  // 0 input (big)
              {x:50,y:18,s:13,f:false},  // 1 top
              {x:48,y:40,s:13,f:true},   // 2 mid-upper
              {x:48,y:61,s:13,f:true},   // 3 mid-lower
              {x:50,y:83,s:13,f:false},  // 4 bottom
              {x:85,y:30,s:13,f:true},   // 5 right-upper
              {x:85,y:71,s:13,f:true} ]; // 6 right-lower
    // Stage 1: input → the 4 middle nodes. Stage 2 (after a short pause): the 4 → the 2 right nodes.
    const G1=[[0,1],[0,2],[0,3],[0,4]];
    const G2=[[1,5],[3,5],[2,6],[4,6],[5,6]];
    const STEP=0.13, PAUSE=0.30, g2base=G1.length*STEP+0.70+PAUSE;   // stage-1 finishes, brief pause, then stage 2
    function line(p,delay){ const a=N[p[0]],b=N[p[1]], len=Math.hypot(b.x-a.x,b.y-a.y).toFixed(1);
      return '<line class="enge" x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'" '
        +'style="stroke-dasharray:'+len+';stroke-dashoffset:'+len+';animation-delay:'+delay.toFixed(2)+'s"></line>'; }
    let e='';
    G1.forEach((p,i)=>e+=line(p, i*STEP));
    G2.forEach((p,i)=>e+=line(p, g2base + i*STEP));
    let r=''; N.forEach((n)=>{ const x=(n.x-n.s/2).toFixed(1),y=(n.y-n.s/2).toFixed(1);
      r+='<rect class="engn '+(n.f?'engn-f':'engn-o')+'" x="'+x+'" y="'+y+'" width="'+n.s+'" height="'+n.s+'" rx="2.6"></rect>'; });
    svg.innerHTML=e+r; }
  // short, engine-true line about the move (Nxf7 hits both the queen on d8 and rook on h8)
  const ENG_EXPL='Knight to f7 — a fork on the queen and rook.';
  function engTypeExpl(){ const sk=$('engSkel'), tx=$('engExpText'); if(!tx) return;
    if(sk) sk.style.display='none'; tx.style.display='block'; tx.classList.remove('done'); let c=0;
    const id=I7(28,()=>{ if(c<=ENG_EXPL.length){ tx.textContent=ENG_EXPL.slice(0,c); c++; }
      else { clearInterval(id); tx.classList.add('done'); } }); }
  function fmtNodes(n){ return n>=1e6 ? (n/1e6).toFixed(1)+'M' : Math.round(n/1e3)+'k'; }
  function engRunDepth(){ let d=1,n=0; const de=$('engDepth'),ne=$('engNodes');
    const id=I7(72,()=>{ d=Math.min(36,d+1); n+=300000+Math.floor(Math.random()*700000);
      if(de) de.textContent=d; if(ne) ne.textContent=fmtNodes(n);
      if(d>=36) clearInterval(id); }); }
  function resetEngine(){ clear7(); buildEngBoard();
    $('engScan')?.classList.remove('run'); $('engBoard')?.classList.remove('out');
    $('engNet')?.classList.remove('show','result'); const ns=$('engNetSvg'); if(ns) ns.innerHTML='';
    const ec=$('engCalc'); if(ec){ ec.textContent='Calculating…'; ec.classList.remove('swap'); }
    const sk=$('engSkel'); if(sk) sk.style.display=''; const tx=$('engExpText'); if(tx){ tx.style.display='none'; tx.textContent=''; tx.classList.remove('done'); }
    $('engHud')?.classList.remove('show'); $('engArrows')?.classList.remove('show'); $('engBest')?.classList.remove('show');
    const g=$('engArrowG'); if(g) g.innerHTML=''; const de=$('engDepth'); if(de) de.textContent='1'; const ne=$('engNodes'); if(ne) ne.textContent='0'; }
  function playEngine(){ resetEngine();
    if(RM()){ engDrawBest(); $('engArrows')?.classList.add('show'); $('engBest')?.classList.add('show');
      const sk=$('engSkel'); if(sk) sk.style.display='none'; const tx=$('engExpText'); if(tx){ tx.style.display='block'; tx.textContent=ENG_EXPL; tx.classList.add('done'); } return; }
    T7(500,()=>$('engScan')?.classList.add('run'));            // scan sweeps the board
    T7(2500,()=>{ $('engScan')?.classList.remove('run'); $('engBoard')?.classList.add('out'); });  // board shrinks + fades
    T7(2950,()=>{ engBuildNet(); $('engNet')?.classList.add('show');   // edges draw in two ramped stages
      $('engHud')?.classList.add('show'); engRunDepth(); });
    T7(4250,()=>{ const ec=$('engCalc'); if(!ec) return;             // stage 2 begins → swap the loader word
      ec.classList.add('swap'); T7(260,()=>{ ec.textContent='Processing…'; ec.classList.remove('swap'); }); });
    T7(5800,()=>{ $('engNet')?.classList.add('result'); $('engHud')?.classList.remove('show'); }); // net + word fade → Nxf7 pops on the panel
    T7(7100,()=>$('engNet')?.classList.remove('show'));         // the white panel (with result) fades out
    T7(7450,()=>$('engBoard')?.classList.remove('out'));        // board returns
    T7(8000,()=>{ engDrawBest(); $('engArrows')?.classList.add('show'); $('engBest')?.classList.add('show'); }); // best move shown on the board
    T7(8400,()=>engTypeExpl()); }                                // short explanation types out

  /* =================== 01 EVALUATE: neural net + search converging on Nd5 =================== */
  // White to move; Nc3-d5 lands a permanent outpost (e4 guards d5; ...Nd7 blocks the d-file).
  const POS_EVAL={ a8:'br',c8:'bb',d8:'bq',f8:'br',g8:'bk',
    a7:'bp',b7:'bp',f7:'bp',g7:'bp',h7:'bp', d7:'bn', c5:'bp',e5:'bp',
    e4:'wp', c3:'wn', a2:'wp',b2:'wp',f2:'wp',g2:'wp',h2:'wp',
    a1:'wr',c1:'wb',d1:'wq',f1:'wr',g1:'wk' };
  let nnLayers=[];
  function buildNet(){
    const edges=$('nnEdges'), nodes=$('nnNodes'); if(!edges||!nodes) return;
    const sizes=[4,5,5,3], xs=[16,74,130,186]; nnLayers=[];
    for(let l=0;l<sizes.length;l++){ const k=sizes[l], arr=[];
      for(let i=0;i<k;i++) arr.push({x:xs[l],y:35+(i-(k-1)/2)*11}); nnLayers.push(arr); }
    let eh=''; for(let l=0;l<nnLayers.length-1;l++) for(const a of nnLayers[l]) for(const b of nnLayers[l+1])
      eh+='<line class="nnEdge" x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'"></line>';
    edges.innerHTML=eh;
    let nh=''; nnLayers.forEach(layer=>layer.forEach(n=>{ nh+='<circle class="nnNode" cx="'+n.x+'" cy="'+n.y+'" r="3"></circle>'; }));
    nodes.innerHTML=nh;
    const circles=[...nodes.querySelectorAll('.nnNode')]; let ci=0;
    nnLayers.forEach(layer=>layer.forEach(n=>{ n.el=circles[ci++]; }));
  }
  function buildEvalBoard(){ buildAbsBoard('evalBoard',POS_EVAL,{markSq:'c3',markId:'s7Knight'}); }
  function netPulse(hop){
    const pulse=$('nnPulse'); if(!pulse||!nnLayers.length) return;
    const path=nnLayers.map((layer,li)=>layer[(hop+li)%layer.length]);
    path.forEach((n,li)=>T5(li*140,()=>{ pulse.style.opacity='1';
      pulse.style.transform='translate('+n.x+'px,'+n.y+'px)';
      n.el&&n.el.classList.add('hot'); T5(320,()=>n.el&&n.el.classList.remove('hot')); }));
  }
  function resetEval(){ clear5(); buildNet(); buildEvalBoard();
    const d=$('evalDepth'); if(d) d.textContent='0'; const f=$('evalDepthFill'); if(f) f.style.width='0%';
    $('evalBest')?.classList.remove('show'); const p=$('nnPulse'); if(p) p.style.opacity='0'; }
  function playEval(){
    resetEval();
    const depthEl=$('evalDepth'), fill=$('evalDepthFill');
    if(RM()){ placeAt($('s7Knight'),'d5'); s4hi('evalBoardGreen','d5',true);
      if(depthEl) depthEl.textContent='24'; if(fill) fill.style.width='100%'; $('evalBest')?.classList.add('show'); return; }
    const D=24, t0=performance.now(), DUR=2200;
    (function tick(now){ const p=Math.min(1,(now-t0)/DUR);
      if(depthEl) depthEl.textContent=Math.round(p*D); if(fill) fill.style.width=(p*100)+'%';
      if(p<1) raf5=requestAnimationFrame(tick); })(performance.now());
    let hop=0; netPulse(hop++); const netId=I5(640,()=>netPulse(hop++));
    const sqs=['b5','a4','e2','b1'];
    sqs.forEach((s,i)=>T5(520+i*340,()=>{ placeAt($('s7Knight'),s); s4hi('evalBoardHiB',s,true);
      T5(250,()=>s4hi('evalBoardHiB',s,false)); }));
    T5(520+sqs.length*340+260,()=>{ clearInterval(netId);
      placeAt($('s7Knight'),'d5'); s4hi('evalBoardGreen','d5',true); $('evalBest')?.classList.add('show');
      document.querySelectorAll('#nnet .nnNode').forEach(n=>n.classList.remove('hot'));
      nnLayers.forEach(layer=>{ const n=layer[Math.floor(layer.length/2)]; n.el&&n.el.classList.add('hot'); });
      const pulse=$('nnPulse'); if(pulse){ const last=nnLayers[nnLayers.length-1][1]; pulse.style.transform='translate('+last.x+'px,'+last.y+'px)'; } });
  }

  /* =================== 02 EXPLAIN: pattern chips + plain-words typewriter =================== */
  const POS_EX=Object.assign({},POS_EVAL); delete POS_EX.c3; POS_EX.d5='wn';
  const EX_TEXT='A knight on d5 no pawn can ever kick — a permanent outpost. It cramps Black and stares at the holes around the king. Karpov won a hundred games on this square.';
  function buildExBoard(){ buildAbsBoard('exBoard',POS_EX,{}); }
  function resetExplain(){ clear6(); buildExBoard();
    document.querySelectorAll('#exChips .chip').forEach(c=>c.classList.remove('in','lit'));
    $('exScan')?.classList.remove('run'); const t=$('exText'); if(t) t.textContent=''; $('exCaret')?.classList.remove('on'); }
  function playExplain(){
    resetExplain();
    const chips=[...document.querySelectorAll('#exChips .chip')];
    if(RM()){ s4hi('exBoardGreen','d5',true); chips.forEach(c=>c.classList.add('in','lit'));
      const t=$('exText'); if(t) t.textContent=EX_TEXT; return; }
    T6(300,()=>s4hi('exBoardGreen','d5',true));
    T6(550,()=>$('exScan')?.classList.add('run'));
    chips.forEach((c,i)=>{ T6(900+i*240,()=>c.classList.add('in')); T6(1100+i*240,()=>c.classList.add('lit')); });
    T6(2150,()=>{ const tx=$('exText'); if(!tx) return; $('exCaret')?.classList.add('on'); let c=0;
      const id=setInterval(()=>{ if(c<=EX_TEXT.length){ tx.textContent=EX_TEXT.slice(0,c); c++; }
        else { clearInterval(id); T6(500,()=>$('exCaret')?.classList.remove('on')); } },20); i6.push(id); });
  }

  /* =================== 03 IMPROVE: the daily Claude learning loop =================== */
  let pipeIn=[],pipeOut=[],pipeC={x:110,y:66}, loopN=0, conceptI=0;
  const CONCEPTS=['Greek gift sacrifice','zwischenzug','rook lift','minority attack','prophylaxis','clearance sac','overloaded piece','deeper search +2 ply'];
  function buildPipe(){
    const edges=$('pipeEdges'),nodes=$('pipeNodes'),pulses=$('pipePulses'); if(!edges||!nodes||!pulses) return;
    pipeIn=[{x:30,y:30,l:'games'},{x:30,y:66,l:'puzzles'},{x:30,y:102,l:'tactics'}];
    pipeOut=[{x:190,y:50},{x:190,y:82}]; pipeC={x:110,y:66};
    let eh=''; pipeIn.forEach(n=>eh+='<line class="pipeEdge" x1="'+n.x+'" y1="'+n.y+'" x2="'+pipeC.x+'" y2="'+pipeC.y+'"></line>');
    pipeOut.forEach(n=>eh+='<line class="pipeEdge" x1="'+pipeC.x+'" y1="'+pipeC.y+'" x2="'+n.x+'" y2="'+n.y+'"></line>'); edges.innerHTML=eh;
    let nh=''; pipeIn.forEach(n=>{ nh+='<circle class="pipeNode" cx="'+n.x+'" cy="'+n.y+'" r="6"></circle><text class="pipeLbl" x="'+n.x+'" y="'+(n.y-9)+'">'+n.l+'</text>'; });
    pipeOut.forEach(n=>nh+='<circle class="pipeNode" cx="'+n.x+'" cy="'+n.y+'" r="5"></circle>'); nodes.innerHTML=nh;
    pulses.innerHTML='<circle class="pipePulse" r="3"></circle><circle class="pipePulse" r="3"></circle><circle class="pipePulse" r="2.6"></circle>';
  }
  function loopPass(){
    const ps=[...document.querySelectorAll('#pipePulses .pipePulse')]; if(ps.length<3) return;
    [0,1].forEach((k,idx)=>{ const p=ps[idx], inp=pipeIn[(loopN+idx)%pipeIn.length];
      p.style.transition='none'; p.style.opacity='1'; p.style.transform='translate('+inp.x+'px,'+inp.y+'px)';
      requestAnimationFrame(()=>{ p.style.transition='transform .6s ease,opacity .6s ease'; p.style.transform='translate('+pipeC.x+'px,'+pipeC.y+'px)'; }); });
    T7(720,()=>{ const p=ps[2], o=pipeOut[loopN%pipeOut.length];
      p.style.transition='none'; p.style.opacity='1'; p.style.transform='translate('+pipeC.x+'px,'+pipeC.y+'px)';
      requestAnimationFrame(()=>{ p.style.transition='transform .6s ease,opacity .6s ease'; p.style.transform='translate('+o.x+'px,'+o.y+'px)'; });
      const ul=$('conceptList'); if(ul){ const li=document.createElement('li');
        li.innerHTML='<span class="plus">+</span>'+CONCEPTS[conceptI%CONCEPTS.length]; conceptI++;
        ul.appendChild(li); requestAnimationFrame(()=>li.classList.add('in'));
        while(ul.children.length>4) ul.removeChild(ul.firstChild); }
      loopN++; const cnt=$('loopCount'); if(cnt) cnt.textContent=String(128+loopN); });
    T7(1500,()=>ps.forEach(p=>p.style.opacity='0'));
  }
  function resetLoop(){ clear7(); buildPipe(); loopN=0; conceptI=0;
    const ul=$('conceptList'); if(ul) ul.innerHTML=''; const cnt=$('loopCount'); if(cnt) cnt.textContent='0';
    const d=$('loopDay'); if(d){ d.textContent='v1 · day 1'; d.classList.remove('tick'); } }
  function playLoop(){
    resetLoop();
    if(RM()){ const ul=$('conceptList'); if(ul) ['Greek gift sacrifice','zwischenzug','rook lift','prophylaxis'].forEach(c=>{
        const li=document.createElement('li'); li.innerHTML='<span class="plus">+</span>'+c; li.classList.add('in'); ul.appendChild(li); });
      const cnt=$('loopCount'); if(cnt) cnt.textContent='131'; const d=$('loopDay'); if(d){ d.textContent='v2 · day 2'; d.classList.add('tick'); } return; }
    T7(400,loopPass); I7(2400,loopPass);
    T7(5000,()=>{ const d=$('loopDay'); if(d){ d.textContent='v2 · day 2'; d.classList.add('tick'); } });
  }

  /* =================== steps 3 & 4: board eval (unchanged) =================== */
  function animEval(id,to){ const el=$(id); if(el) el.style.height=to; }
  function playStrike(){ const s=$('strike4'),board=$('board4'); if(!s||!board) return;
    const br=board.getBoundingClientRect(),cell=br.width/8,cx=cell*3+cell/2,cy=cell*4+cell/2;
    s.style.display='block'; s.style.left=(cx-cell*0.55)+'px'; s.style.top=cy+'px'; s.style.width='0px'; s.style.transform='rotate(-32deg)';
    requestAnimationFrame(()=>{ s.style.transition='width .5s ease-out'; s.style.width=(cell*1.1)+'px'; }); }

  function fire(n){ if(fired[n])return; fired[n]=true;
    if(n==='1') playGetReady();
    if(n==='2') playChesscom();
    if(n==='3') playBlunder();
    if(n==='4') playBest();
    if(n==='7') playEngine(); }
  // data-step 8 ("the words") is the self-contained number-to-reason.js cinematic — it owns its
  // own IntersectionObserver + timeline, so it's intentionally NOT wired into fire/reset here.
  function reset(n){ fired[n]=false;
    if(n==='1') resetGetReady();
    if(n==='2') resetChesscom();
    if(n==='3') resetBlunder();
    if(n==='4') resetBest();
    if(n==='7') resetEngine(); }

  // ----- REVEAL / OUTRO: trigger earlier so content animates while still on screen -----
  const revealIO=new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      const n=e.target.getAttribute('data-step');
      if(e.isIntersecting){
        e.target.classList.add('in-view'); e.target.classList.remove('exit-up');
        railDots.forEach((d,i)=>d.classList.toggle('on', String(i)===n));
      } else {
        const goingUp=e.boundingClientRect.top<0;
        e.target.classList.remove('in-view');
        if(goingUp) e.target.classList.add('exit-up'); else e.target.classList.remove('exit-up');
      }
    });
  },{ threshold:0, rootMargin:'-8% 0px -20% 0px' });
  sections.forEach(s=>revealIO.observe(s));

  // ----- DEMO FIRE / RESET: when the section is properly centered, so the full demo is seen -----
  const demoIO=new IntersectionObserver((entries)=>{
    entries.forEach(e=>{ const n=e.target.getAttribute('data-step');
      if(e.isIntersecting) fire(n); else reset(n); });
  },{ threshold:0.55 });
  sections.forEach(s=>demoIO.observe(s));

  // show rail only while within the §1 sections
  const railIO=new IntersectionObserver((entries)=>{
    const any=entries.some(e=>e.isIntersecting);
    if(rail) rail.classList.toggle('show', any);
  },{threshold:0.1});
  sections.forEach(s=>railIO.observe(s));

  // render the boards/diagrams up front so they exist before the demos fire
  buildBoard();
  buildBoard4();
})();
