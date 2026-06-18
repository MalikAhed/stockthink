// ===== Beat 2 — "How we process Stockfish's output" cinematic (data-step 8), rev 4 =====
// Self-contained vanilla JS. Acts:
//   ① a Mac desktop with a VS Code project — camera zooms into the IDE; Stockfish runs complex UCI
//      live in the integrated terminal  →  ② its output is saved as analysis.json and StockThink
//      reformats it into readable facts in the editor  →  ③ those facts are matched against a pattern
//      table (% + red→yellow→green heat map)  →  ④ the StockThink app appears, then we zoom into the
//      explanation. Theme-aware stage; the IDE/terminal stay dark by design.
(function () {
  const stage = document.getElementById('n2rStage');
  if (!stage) return;
  const RMQ = matchMedia('(prefers-reduced-motion:reduce)');
  const NEO = 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150';
  const CHAR = 15, ROW_STEP = 85, SCORE_STEP = 360;

  const TERM = [
    { pr: '›', t: './stockfish  —  go depth 30' },
    { t: 'Stockfish 18 by the Stockfish developers', cls: 'di' },
    { t: 'info depth 24 score cp -271 pv b5d6 d2d5' },
    { t: 'info depth 30 seldepth 41 score cp -312 nodes 4.8M' },
    { t: 'bestmove b5d6 ponder d2d5' },
    { pr: '✓', t: 'wrote analysis.json', cls: 'gd' },
  ];
  const CODE_PY = '<span class="cm"># analyse.py — run Stockfish on the position</span>\n'
    + '<span class="kw">import</span> chess.engine\n'
    + 'sf   = chess.engine.<span class="fn">popen</span>(<span class="st">"./stockfish"</span>)\n'
    + 'info = sf.<span class="fn">analyse</span>(board, depth=<span class="nu">30</span>)\n'
    + '<span class="fn">save_json</span>(info, <span class="st">"analysis.json"</span>)';
  const CODE_JSON = '{\n  <span class="ppt">"depth"</span>: <span class="nu">30</span>,\n'
    + '  <span class="ppt">"score_cp"</span>: <span class="nu">-312</span>,\n'
    + '  <span class="ppt">"bestmove"</span>: <span class="st">"b5d6"</span>,\n'
    + '  <span class="ppt">"pv"</span>: [<span class="st">"b5d6"</span>, <span class="st">"d2d5"</span>]\n}';
  const CODE_FACTS = '<span class="gd">// StockThink — plain, useful facts</span>\n'
    + 'verdict : <span class="st">your move loses material</span>\n'
    + 'move    : <span class="st">Bishop → d6</span>\n'
    + 'best    : <span class="st">Queen takes d5</span>';

  const CONCEPTS = [
    { nm: 'fork', def: 'one piece attacks two', m: 18 },
    { nm: 'skewer', def: 'attack through to a bigger piece', m: 38 },
    { nm: 'hanging', def: 'a piece left undefended', m: 52 },
    { nm: 'discovered', def: 'a move unveils another attacker', m: 13 },
    { nm: 'pin', def: 'a piece can’t move — it shields a bigger one', m: 96, match: true },
    { nm: 'back-rank', def: 'king trapped behind its pawns', m: 8 },
  ];
  const APP_POS = {
    g8: 'bk', d8: 'bq', d6: 'bb', b7: 'bp', c7: 'bp', f7: 'bp', g7: 'bp', h7: 'bp',
    d1: 'wr', g1: 'wk', c4: 'wb', e4: 'wp', a2: 'wp', b2: 'wp', f2: 'wp', g2: 'wp', h2: 'wp',
  };

  function heat(m) {
    const R = [224, 88, 79], Y = [230, 178, 60], G = [111, 194, 74];
    const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
    const c = m < 50 ? lerp(R, Y, m / 50) : lerp(Y, G, (m - 50) / 50);
    return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
  }

  let timers = [];
  const at = (ms, fn) => { timers.push(setTimeout(fn, ms)); };
  const clearAll = () => { timers.forEach((id) => { clearTimeout(id); clearInterval(id); }); timers = []; };
  const mk = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };

  let world, stepEl, capEl, desk, vscode, jsonRow, jsonTab, paneCode, paneJson, paneFacts, termLines, match, mrows, mscan, app, appComment, replay, hostStep;

  function build() {
    stage.innerHTML = '';
    stage.appendChild(mk('div', 'n2r-vignette'));
    world = mk('div', 'n2r-world'); stage.appendChild(world);
    stepEl = mk('div', 'n2r-step'); world.appendChild(stepEl);

    // ---- desktop + VS Code ----
    desk = mk('div', 'n2r-desk');
    desk.appendChild(mk('div', 'n2r-menubar', '<span style="font-size:13px"></span><b>Code</b><span>File</span><span>Run</span><span>Terminal</span><span class="sp">stockthink — workspace</span>'));
    vscode = mk('div', 'n2r-vscode',
      '<div class="vs-title"><span class="dots"><i></i><i></i><i></i></span><span class="t">stockthink — Visual Studio Code</span></div>'
      + '<div class="vs-body">'
      + '<div class="vs-activity"><i class="on"></i><i></i><i></i><i></i></div>'
      + '<div class="vs-explorer"><div class="vs-exhead">Explorer</div>'
      + '<div class="vs-row"><span class="ic">▾</span>STOCKTHINK</div>'
      + '<div class="vs-row ind"><span class="ic">▾</span>engine</div>'
      + '<div class="vs-row ind" style="padding-left:44px">stockfish</div>'
      + '<div class="vs-row ind" style="padding-left:44px">position.fen</div>'
      + '<div class="vs-row ind"><span class="ic">▾</span>src</div>'
      + '<div class="vs-row ind" style="padding-left:44px">analyse.py</div>'
      + '<div class="vs-row ind appear" id="n2rJsonRow" style="padding-left:44px">analysis.json<span class="tag">NEW</span></div>'
      + '<div class="vs-row ind" style="padding-left:44px">README.md</div></div>'
      + '<div class="vs-main">'
      + '<div class="vs-tabs"><div class="vs-tab on">analyse.py</div><div class="vs-tab appear" id="n2rJsonTab">analysis.json</div></div>'
      + '<div class="vs-editor">'
      + '<div class="vs-pane show" id="n2rPaneCode"><pre class="vs-code">' + CODE_PY + '</pre></div>'
      + '<div class="vs-pane" id="n2rPaneJson"><pre class="vs-code">' + CODE_JSON + '</pre></div>'
      + '<div class="vs-pane" id="n2rPaneFacts"><pre class="vs-code">' + CODE_FACTS + '</pre></div>'
      + '</div>'
      + '<div class="vs-terminal"><div class="vs-termbar"><span class="on">Terminal</span><span>Problems</span><span>Output</span></div>'
      + '<div class="vs-termbody" id="n2rTermBody"></div></div>'
      + '</div></div>');
    desk.appendChild(vscode);
    world.appendChild(desk);
    jsonRow = vscode.querySelector('#n2rJsonRow'); jsonTab = vscode.querySelector('#n2rJsonTab');
    paneCode = vscode.querySelector('#n2rPaneCode'); paneJson = vscode.querySelector('#n2rPaneJson'); paneFacts = vscode.querySelector('#n2rPaneFacts');
    const tb = vscode.querySelector('#n2rTermBody'); termLines = TERM.map((l) => {
      const ln = mk('div', 'vs-tl' + (l.cls ? ' ' + l.cls : ''), '<span class="pr">' + (l.pr || '') + '</span><span class="tx"></span>');
      ln._txt = l.t; tb.appendChild(ln); return ln;
    });

    // ---- match table ----
    match = mk('div', 'n2r-match');
    match.appendChild(mk('div', 'n2r-mhead', '<span>Pattern</span><span>Definition</span><span>Match</span><span>%</span>'));
    const wrap = mk('div', 'n2r-mrows'); mscan = mk('div', 'n2r-mscan'); wrap.appendChild(mscan);
    mrows = CONCEPTS.map((c) => {
      const r = mk('div', 'n2r-mrow', '<span class="nm">' + c.nm + '</span><span class="def">' + c.def + '</span>'
        + '<span class="bar"><span class="bar-fill"></span></span><span class="pct"></span>');
      wrap.appendChild(r); return r;
    });
    match.appendChild(wrap); world.appendChild(match);

    // ---- app ----
    app = mk('div', 'n2r-app',
      '<div class="n2r-appbar"><span class="dots"><i></i><i></i><i></i></span><span class="u">stockthink.app · game review</span></div>'
      + '<div class="n2r-appbody"><div class="n2r-aeval"><i></i></div><div class="n2r-aboard"></div>'
      + '<div class="n2r-aside"><div class="n2r-arating"><span class="badge">??</span>Blunder<span class="mv">Bd6</span></div>'
      + '<div class="n2r-acomment"><div class="ch">why</div><div class="ct">Your bishop is <b>pinned</b> — it can’t move without losing the queen behind it, so it’s as good as lost.</div></div>'
      + '</div></div>');
    world.appendChild(app);
    appComment = app.querySelector('.n2r-acomment');
    buildMiniBoard(app.querySelector('.n2r-aboard'));

    capEl = mk('div', 'n2r-cap'); world.appendChild(capEl);
    replay = mk('button', 'n2r-replay', 'Replay ↺'); replay.type = 'button';
    replay.addEventListener('click', () => { resetAll(); requestAnimationFrame(runTimeline); });
    stage.appendChild(replay);
  }

  function buildMiniBoard(b) {
    if (!b) return;
    const xy = (sq) => ({ x: 'abcdefgh'.indexOf(sq[0]) * 12.5, y: (8 - +sq[1]) * 12.5 });
    let h = '';
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) h += '<div class="n2r-asq" style="left:' + c * 12.5 + '%;top:' + r * 12.5 + '%;background:' + ((r + c) % 2 ? '#739552' : '#ebecd0') + '"></div>';
    ['d6', 'd8'].forEach((sq) => { const p = xy(sq); h += '<div class="n2r-ahi" style="left:' + p.x + '%;top:' + p.y + '%"></div>'; });
    for (const sq in APP_POS) { const p = xy(sq); h += '<div class="n2r-ap" style="left:' + p.x + '%;top:' + p.y + "%;background-image:url('" + NEO + '/' + APP_POS[sq] + ".png')\"></div>"; }
    b.innerHTML = h;
  }

  const setStep = (n, name) => { stepEl.innerHTML = 'Step ' + n + ' / 4 &nbsp;·&nbsp; <b>' + name + '</b>'; stepEl.classList.add('in'); };
  const cap = (txt) => { capEl.textContent = txt; capEl.classList.add('in'); };
  const capSwap = (txt) => { capEl.classList.remove('in'); at(240, () => { capEl.textContent = txt; capEl.classList.add('in'); }); };
  const capHide = () => capEl.classList.remove('in');

  // camera: pan + scale the desktop so `target` is centred at scale k
  function camTo(target, k, cy0) {
    cy0 = cy0 || 270;
    const sr = stage.getBoundingClientRect(), tr = target.getBoundingClientRect();
    const fs = (sr.width / 960) || 1;
    const cx = (tr.left + tr.width / 2 - sr.left) / fs, cy = (tr.top + tr.height / 2 - sr.top) / fs;
    desk.style.transform = 'translate(' + (480 - k * cx) + 'px,' + (cy0 - k * cy) + 'px) scale(' + k + ')';
  }

  function typeTerminal(next) {
    let li = 0;
    const typeLine = () => {
      if (li >= termLines.length) { next(); return; }
      const ln = termLines[li], tx = ln.querySelector('.tx'), txt = ln._txt;
      ln.classList.add('show', 'typing'); let ci = 0;
      const id = setInterval(() => {
        ci++; tx.textContent = txt.slice(0, ci);
        if (ci >= txt.length) { clearInterval(id); ln.classList.remove('typing'); li++; at(90, typeLine); }
      }, CHAR);
      timers.push(id);
    };
    typeLine();
  }

  // ---- timeline ----
  function runTimeline() {
    stage.classList.add('play');
    setStep('1', 'Analyse'); cap('A real engine, running in a real project.');
    at(1000, () => { if (hostStep) hostStep.classList.add('n2r-playing'); });   // title recedes, viewer takes over
    at(1700, () => { camTo(vscode, 1.18, 232); capSwap('Stockfish searches the position in the terminal.'); });
    at(2900, () => typeTerminal(act2));
  }

  function act2() {
    setStep('2', 'Reformat'); capSwap('Its output is saved as data — analysis.json.');
    at(300, () => { jsonRow.classList.add('show'); jsonRow.classList.add('hot'); jsonTab.classList.add('show'); });
    at(1100, () => { paneCode.classList.remove('show'); paneJson.classList.add('show'); jsonTab.classList.add('on'); vscode.querySelector('.vs-tab').classList.remove('on'); });
    at(2300, () => capSwap('StockThink reads it and rewrites it as plain facts.'));
    at(2500, () => { paneJson.classList.remove('show'); paneFacts.classList.add('show'); jsonRow.classList.remove('hot'); });
    at(4200, act3);
  }

  function act3() {
    desk.style.opacity = '0';
    setStep('3', 'Match'); capSwap('Then it matches those facts to a known pattern.');
    at(500, () => match.classList.add('in'));
    mrows.forEach((r, i) => at(700 + i * ROW_STEP, () => r.classList.add('in')));
    at(700 + mrows.length * ROW_STEP + 350, () => scoreRows(act4));
  }

  function scoreRows(next) {
    mscan.classList.add('on');
    CONCEPTS.forEach((c, i) => at(i * SCORE_STEP, () => {
      mscan.style.top = i * 40 + 'px';
      const r = mrows[i], fill = r.querySelector('.bar-fill'), pct = r.querySelector('.pct');
      r.classList.add('tested');
      fill.style.width = c.m + '%'; fill.style.background = heat(c.m);
      pct.textContent = c.m + '%'; pct.style.color = heat(c.m);
      if (c.match) r.classList.add('match');
    }));
    const total = CONCEPTS.length * SCORE_STEP;
    at(total + 150, () => { mscan.classList.remove('on'); capSwap('Only one scores high — a pin.'); });
    at(total + 1200, next);
  }

  function act4() {
    setStep('4', 'Explain'); capHide();
    at(350, () => { match.style.opacity = '0'; });
    at(800, () => { app.classList.add('in'); cap('In the app, it becomes one plain sentence.'); });
    at(2500, () => { capHide(); zoomToComment(); });
    at(3900, () => replay.classList.add('in'));
  }

  function zoomToComment() {
    if (!appComment) return;
    const sr = stage.getBoundingClientRect(), cr = appComment.getBoundingClientRect();
    const fs = (sr.width / 960) || 1, k = 1.85;
    const cx = (cr.left + cr.width / 2 - sr.left) / fs, cy = (cr.top + cr.height / 2 - sr.top) / fs;
    const aL = app.offsetLeft, aT = app.offsetTop;
    app.style.transform = 'translate(' + (480 - aL - k * (cx - aL)) + 'px,' + (270 - aT - k * (cy - aT)) + 'px) scale(' + k + ')';
  }

  function finalFrame() {
    stage.classList.add('play');
    if (hostStep) hostStep.classList.add('n2r-playing');
    setStep('4', 'Explain');
    desk.style.opacity = '0'; app.classList.add('in');
    replay.classList.add('in');
  }

  function resetAll() {
    clearAll(); stage.classList.remove('play');
    if (hostStep) hostStep.classList.remove('n2r-playing');
    build(); fit();
  }

  function fit() {
    const wrap = document.getElementById('n2rFit'); if (!wrap) return;
    const box = wrap.parentElement;
    const availW = box.clientWidth || 960, availH = box.clientHeight > 60 ? box.clientHeight : 540;
    const s = Math.min(1, availW / 960, availH / 540);
    stage.style.transform = 'translateX(-50%) scale(' + s + ')';
    wrap.style.height = 540 * s + 'px';
  }

  hostStep = stage.closest('.lay-theater');
  build();
  fit();
  requestAnimationFrame(fit);
  window.addEventListener('resize', fit);

  let played = false;
  new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting && e.intersectionRatio >= 0.6 && !played) {
        played = true;
        if (RMQ.matches) finalFrame(); else runTimeline();
      }
    });
  }, { threshold: [0, 0.6, 1] }).observe(stage);
})();
