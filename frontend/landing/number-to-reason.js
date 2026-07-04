// ===== Beat 2 — "How we process Stockfish's output" cinematic (data-step 8), rev 4 =====
// Self-contained vanilla JS. Acts:
//   ① a Mac desktop with a VS Code project — camera zooms into the IDE; Stockfish runs complex UCI
//      live in the integrated terminal  →  ② its output is saved as analysis.json and StockThink
//      reformats it into readable facts in the editor  →  ③ those facts are matched against a pattern
//      table (% + red→yellow→green heat map)  →  ④ the StockThink app appears, then we zoom into the
//      explanation. Theme-aware stage; the IDE/terminal stay dark by design.
import { Reel, Scrubber } from './scrub.js';

(function () {
  const stage = document.getElementById('n2rStage');
  if (!stage) return;
  const RMQ = matchMedia('(prefers-reduced-motion:reduce)');
  const NEO = 'https://images.chesscomfiles.com/chess-themes/pieces/neo/150';
  const CHAR = 9, ROW_STEP = 85, SCORE_STEP = 360;

  // A real Stockfish UCI session — launch, set the position, search, get the eval + best move.
  // Kept short on purpose: the long banner/seldepth/nodes/nps strings only padded the typing time.
  const TERM = [
    { pr: '$', t: './stockfish' },
    { t: 'Stockfish 18', cls: 'di' },
    { pr: '>', t: 'position fen 3q2k1/1pp2ppp/3b4/8/2B1P3/8/PP3PPP/3R2K1 w' },
    { pr: '>', t: 'go depth 20' },
    { t: 'info depth 20 score cp 312 pv e4e5', cls: 'di' },
    { t: 'bestmove e4e5', cls: 'gd' },
  ];
  const CODE_PY = '<span class="cm"># analyse.py — run Stockfish on the position</span>\n'
    + '<span class="kw">import</span> chess.engine\n'
    + 'sf   = chess.engine.<span class="fn">popen</span>(<span class="st">"./stockfish"</span>)\n'
    + 'info = sf.<span class="fn">analyse</span>(board, depth=<span class="nu">30</span>)\n'
    + '<span class="fn">save_json</span>(info, <span class="st">"analysis.json"</span>)';
  const CODE_JSON = '{\n  <span class="ppt">"depth"</span>: <span class="nu">20</span>,\n'
    + '  <span class="ppt">"score_cp"</span>: <span class="nu">312</span>,\n'
    + '  <span class="ppt">"bestmove"</span>: <span class="st">"e4e5"</span>,\n'
    + '  <span class="ppt">"pv"</span>: [<span class="st">"e4e5"</span>]\n}';
  const CODE_FACTS = '<span class="gd">// StockThink — plain, useful facts</span>\n'
    + 'verdict : <span class="st">the bishop is pinned and lost</span>\n'
    + 'move    : <span class="st">Bishop → d6  (blunder)</span>\n'
    + 'best    : <span class="st">push e5 — wins the bishop</span>';

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

  // The cinematic runs on a Reel — a seekable virtual clock — so the dev Scrubber can pause/seek
  // every frame. at(ms,fn) schedules on it exactly like setTimeout did (fires at now+ms, chains too).
  const reel = new Reel({ name: 'number → reason', loop: false });
  const at = (ms, fn) => reel.at(ms, fn);
  const mk = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };

  let world, stepEl, capEl, desk, vscode, jsonRow, jsonTab, paneCode, paneJson, paneFacts, termLines, match, mrows, mscan, app, appComment, replay, hostStep, titleCard, cursor, vscodeIcon;

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
    // macOS-style dock along the bottom — real app logos, then StockThink (our brand)
    desk.appendChild(mk('div', 'n2r-dock',
      '<img class="n2r-dapp" src="./icons/dock/finder.png" alt="Finder">'
      + '<img class="n2r-dapp" src="./icons/dock/vscode.svg" alt="VS Code">'
      + '<img class="n2r-dapp" src="./icons/dock/chrome.svg" alt="Chrome">'
      + '<img class="n2r-dapp" src="./icons/dock/terminal.svg" alt="Terminal">'
      + '<span class="n2r-dsep"></span><span class="n2r-dapp stock">&#9822;</span>'));
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

    // ---- app (same components as the Step-03 review panel: eval bar · board · explanation + moves cards) ----
    app = mk('div', 'n2r-app',
      '<div class="n2r-appbar"><span class="dots"><i></i><i></i><i></i></span><span class="u">stockthink.app · game review</span></div>'
      + '<div class="n2r-appbody"><div class="n2r-aeval"><i></i></div><div class="n2r-aboard"></div>'
      + '<div class="n2r-aside">'
      + '<div class="n2r-acard n2r-aexplain">'
      + '<div class="n2r-ach2">Review</div>'
      + '<div class="n2r-askel"><i></i><i></i><i></i></div>'
      + '<div class="n2r-ahead"><img class="n2r-aico" src="./icons/blunder.svg" alt="blunder"><span class="n2r-atitle">Blunder</span>'
      + '<span class="n2r-amove"><img src="' + NEO + '/bb.png" alt="">Bd6</span></div>'
      + '<div class="n2r-abody">Your bishop is <b>pinned</b> — it can’t move without losing the queen behind it, so it’s as good as lost.</div>'
      + '</div>'
      + '<div class="n2r-acard n2r-amoves"><div class="n2r-ach">Moves</div><div class="n2r-amllist">'
      + '<div class="n2r-mlrow"><span class="n2r-mlnum">16</span><span class="n2r-mlw">Rd1</span><span class="n2r-mlb">Qd8</span></div>'
      + '<div class="n2r-mlrow"><span class="n2r-mlnum">17</span><span class="n2r-mlw">e4</span>'
      + '<span class="n2r-mlb blun"><img src="' + NEO + '/bb.png" alt="">Bd6<img class="n2r-mlbadge" src="./icons/blunder.svg" alt=""></span></div>'
      + '</div></div>'
      + '<div class="n2r-acard n2r-agraph"><div class="n2r-ach">Eval history</div>'
      + '<svg class="n2r-agsvg" viewBox="0 0 100 30" preserveAspectRatio="none">'
      + '<defs><linearGradient id="n2rGraphGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#81b64c" stop-opacity="0.4"/><stop offset="1" stop-color="#81b64c" stop-opacity="0"/></linearGradient></defs>'
      + '<line class="n2r-agmid" x1="0" y1="15" x2="100" y2="15"/>'
      + '<polygon class="n2r-agfill" points="0,13 18,12 36,14 54,12 72,13 86,25 100,28 100,30 0,30"/>'
      + '<polyline class="n2r-agline" points="0,13 18,12 36,14 54,12 72,13 86,25 100,28"/>'
      + '<circle class="n2r-agdot" cx="100" cy="28" r="2.2"/></svg></div>'
      + '</div></div>');
    world.appendChild(app);
    appComment = app.querySelector('.n2r-aexplain');
    buildMiniBoard(app.querySelector('.n2r-aboard'));

    // opening: a big title card over the (closed) editor, then a cursor opens VS Code from the dock
    titleCard = mk('div', 'n2r-titlecard', '<div class="n2r-tc-k">02 / 03</div><div class="n2r-tc-t">How we process<br>Stockfish’s output.</div>');
    world.appendChild(titleCard);
    cursor = mk('div', 'n2r-cursor'); cursor.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 3l14 7-6 1.5L10 18 5 3z" fill="#fff" stroke="#111" stroke-width="1.3" stroke-linejoin="round"/></svg>';
    cursor.style.left = '480px'; cursor.style.top = '560px'; world.appendChild(cursor);
    vscodeIcon = desk.querySelector('.n2r-dapp[alt="VS Code"]');
    vscode.classList.add('n2r-closed');   // the editor window starts closed; the cursor opens it

    capEl = mk('div', 'n2r-cap'); world.appendChild(capEl);
    replay = mk('button', 'n2r-replay', 'Replay ↺'); replay.type = 'button';
    replay.addEventListener('click', () => { reel.rewind(); reel.play(); });
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

  const setStep = (n, name) => { reel.cue(0, n + ' · ' + name); };
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

  // fly the fake cursor onto a target element (stage coords)
  function cursorTo(target, fx, fy) {
    if (!cursor || !target) return;
    const sr = stage.getBoundingClientRect(), tr = target.getBoundingClientRect();
    const fs = (sr.width / 960) || 1;
    cursor.style.left = ((tr.left + tr.width * (fx == null ? 0.5 : fx) - sr.left) / fs) + 'px';
    cursor.style.top = ((tr.top + tr.height * (fy == null ? 0.5 : fy) - sr.top) / fs) + 'px';
  }

  function typeTerminal(next) {
    let li = 0;
    const typeLine = () => {
      if (li >= termLines.length) { next(); return; }
      const ln = termLines[li], tx = ln.querySelector('.tx'), txt = ln._txt;
      ln.classList.add('show', 'typing'); let ci = 0;
      const h = reel.every(CHAR, () => {     // each typed char is its own keyframe → seekable mid-line
        ci++; tx.textContent = txt.slice(0, ci);
        if (ci >= txt.length) { h.cancel(); ln.classList.remove('typing'); li++; at(90, typeLine); }
      });
    };
    typeLine();
  }

  // ---- timeline ----
  function runTimeline() {
    stage.classList.add('play');
    setStep('1', 'Analyse');
    at(120, () => { if (hostStep) hostStep.classList.add('n2r-playing'); });     // the section header recedes
    at(320, () => titleCard.classList.add('in'));                               // a big on-stage title fades up over the closed-window desktop
    at(2000, () => { titleCard.classList.remove('in'); cap('Open the analysis project in your editor.'); });
    at(2450, () => { cursor.classList.add('show'); cursorTo(vscodeIcon, 0.5, 0.42); });   // a cursor flies to the VS Code dock icon
    at(3350, () => { cursor.classList.add('clicking'); if (vscodeIcon) vscodeIcon.classList.add('bounce'); });
    at(3520, () => { cursor.classList.remove('clicking'); vscode.classList.remove('n2r-closed'); });   // …and the editor window opens
    at(4350, () => { cursor.classList.remove('show'); camTo(vscode, 1.18, 232); capSwap('Stockfish searches the position in the terminal.'); });
    at(5550, () => typeTerminal(act2));
  }

  function act2() {
    setStep('2', 'Reformat'); capSwap('Stockfish writes its analysis to a file — analysis.json.');
    at(300, () => jsonRow.classList.add('show', 'hot'));                              // the new file slides into the explorer
    at(1200, () => { cursor.classList.add('show'); cursorTo(jsonRow, 0.5, 0.5); });   // the cursor navigates to it
    at(2050, () => cursor.classList.add('clicking'));
    at(2240, () => { cursor.classList.remove('clicking'); jsonTab.classList.add('show', 'on');
      vscode.querySelector('.vs-tab').classList.remove('on'); paneCode.classList.remove('show'); });   // click → the code pane clears…
    at(2560, () => paneJson.classList.add('show'));                                   // …then analysis.json fades in (sequenced — no garbled overlap)
    at(2700, () => cursor.classList.remove('show'));
    at(3100, () => capSwap('StockThink reads that data and rewrites it as plain facts.'));
    at(3300, () => { paneJson.classList.remove('show'); jsonRow.classList.remove('hot'); });            // json clears…
    at(3620, () => paneFacts.classList.add('show'));                                  // …then the plain-facts pane fades in
    at(5000, act3);
  }

  function act3() {
    desk.style.opacity = '0';
    setStep('3', 'Match'); capSwap('It compares those facts against every pattern it knows.');
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
    at(total + 150, () => { mscan.classList.remove('on'); capSwap('Only one is a strong match — a pin.'); });
    at(total + 1200, next);
  }

  function act4() {
    setStep('4', 'Explain'); capHide();
    at(350, () => { match.style.opacity = '0'; });
    at(800, () => { app.classList.add('in'); if (appComment) appComment.classList.add('loading'); cap('In the app, it becomes one plain sentence.'); });
    at(1750, () => { if (appComment) appComment.classList.remove('loading'); });   // the card finishes loading → the verdict fades in
    at(3000, () => { capHide(); stepEl.classList.remove('in'); zoomToComment(); });
    at(4400, () => replay.classList.add('in'));
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

  // Reset hook for the Reel: restore the clean pre-play DOM (the Reel clears its own queue).
  function resetAll() {
    stage.classList.remove('play');
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

  // The Reel drives the cinematic: runTimeline = the timeline body, resetAll = its clean state.
  reel.load(runTimeline, resetAll);
  if (import.meta.env.DEV) { new Scrubber(reel, hostStep || stage.closest('section') || stage, { loop: false }); reel.attachCss(stage); }

  let played = false;
  new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting && e.intersectionRatio >= 0.6 && !played) {
        played = true;
        if (RMQ.matches) finalFrame(); else reel.play();
      }
    });
  }, { threshold: [0, 0.6, 1] }).observe(stage);
})();
