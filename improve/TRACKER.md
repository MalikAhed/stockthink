# TRACKER — coverage snapshot + daily log

## Coverage snapshot (edit rows in place when status changes)

✅ code exists — but **UNAUDITED**: treat as unproven until its R-item in
TODO.md is done (read source → audit → fix → tests), then mark it 🔒 audited.
🟡 partial · ❌ missing · 🔒 audited & proven.
Full detail: `../docs/knowledge/concept-taxonomy.md`.

| Concept | Status | Concept | Status |
|---|---|---|---|
| Hanging piece (wins/hangs) | ✅ | Recapture | ❌ D1 |
| Fork (+missed/allowed) | ✅ | Escapes attack | ❌ D2 |
| Pin (+missed) | ✅ | Purpose-phrased suggestion | ❌ D3 |
| Trapped piece | ✅ | Skewer | 🟡 D4 |
| Mate / mate threat / allows mate | ✅ | Discovered attack (material) | ❌ D5 |
| Discovered check | ✅ | Pressure stacking | ❌ D6 |
| Sacrifice / trade / captures-higher | ✅ | Early queen | ❌ D7 |
| Wins tempo | ✅ | Same piece twice | ❌ D8 |
| Defends piece | ✅ | Luft | ❌ D9 |
| Castling / fianchetto | ✅ | Opens line for piece | ❌ D10 |
| Develops / lags development | ✅ | Trade offer | ❌ D11 |
| Outpost / open file / 7th rank | ✅ | Plain check | ❌ D12 |
| Passed pawn | ✅ | King-safety synthesis | 🟡 D15 |
| Isolated / doubled pawns | ✅ | Backward pawn | ❌ D16 |
| Mobility / center | ✅ | Bishop pair | ❌ D17 |
| Shield weaken / king file | ✅ | Space advantage | 🟡 D18 |
| Rim knight | ✅ | Pawn-structure phrasing | ❌ D19 |
| Battery / doubling | 🟡 C-phrasing | Overload / deflection | ❌ D20/D21 |
| Only move / forced | ✅ | Good-square phrasing | 🟡 D22 |

## Recall (from puzzle fixtures — pending I1/I2)

Theme→detector map: fork→creates_fork · pin→creates_pin · skewer→creates_skewer ·
discoveredAttack→discovered attack · hangingPiece→wins_free_piece ·
trappedPiece→traps_piece · mateIn1→delivers_mate/mate_threat · sacrifice→sacrifice.

| Date | gate coverage | fork | pin | skewer | discAtk | hanging | trapped | mateIn1 | sac |
|---|---|---|---|---|---|---|---|---|---|
| 2026-06-11 | 93–100% | 62% | 21% | 0% | 63% | 100% | 72% | 100% | 75% |
| 2026-06-11b | 93–100% | 100% | 80% | 100% | 95% | 100% | 100% | 100% | 86% |

## Daily log (append ONE entry per session, 1–3 lines, newest on top)

- **2026-06-12c** (loop iter 3/6) · 3 units · U3+U4: Deep Review panel now has
  one-click commentary via user's own Anthropic key AND a fully local WebLLM
  option (Llama-3.2-1B, ~700 MB, WebGPU-gated, CDN dynamic import — zero bundle
  cost); both reuse factsheet→verify→fallback. providers.test.ts mocks fetch.
  Next: U2/U6 PV-plan narration, U5 detector audit, C5/C6 phrasing.
- **2026-06-12b** (loop iter 2/6) · 3 units · U6/C3 missed_idea: quiet best-move
  suggestions now carry a WHY ("Bxf6 was the better way — it would have defended
  the pawn on e4"); ideas: escapes/defends/trades/tempo/positional, max 2.
  Next: U3/U4 LLM rephrase toggles (needs src/llm+ui override), U2/U6 PV-plan narration.
- **2026-06-12** (loop iter 1/6) · 3 units · U1 explain-more no longer praises bad
  moves (intent frame) · U2 ignores_threat fact (already-attacked piece, move
  ignores it — fires on Blackburne 5.Nxf7) · U5 slice: dash-soup + decap polish.
  Next: U2 remaining (PV punishment narration), U6 best-move intention, U3/U4 LLM toggles.
- **2026-06-11c** · 3 units · DS1–DS4 dataset items queued (STS, WAC/ECM EPDs,
  [%eval] games, more puzzle themes) · R15 relative pins + exploit-pin mapping ·
  recall harness now line-wide (themes are line-level): pin 21→80, skewer 0→100,
  fork→100; floors ratcheted. Next: R-list top-down; D4 skewer wiring; sac 86%.
- **2026-06-11b** · 2 units · I1 fixtures (HF /rows scan, 10×200 puzzles) + I2
  recall harness. Baseline: hanging/mateIn1 100%, sac 75%, trapped 72%, discAtk
  63%, fork 62%, pin 21%, skewer 0%. Next: R-list; pin+skewer are the gaps.
- **2026-06-11** · setup · Built the workshop (README/TODO/TRACKER), audited
  reading list vs V2 (9 concepts already done), merged backlogs, wrote puzzle
  fetch script. Next: I1 fixtures → I2 recall harness.
