# TRACKER — coverage snapshot + daily log

## Coverage snapshot (edit rows in place when status changes)

✅ implemented · 🟡 partial · ❌ missing. Full detail: `../docs/knowledge/concept-taxonomy.md`.

| Concept | Status | Concept | Status |
|---|---|---|---|
| Hanging piece (wins/hangs) | ✅ | Recapture | ❌ D1 |
| Fork (+missed/allowed) | ✅ | Escapes attack | ❌ D2 |
| Pin (+missed) | ✅ | Purpose-phrased suggestion | ❌ D3 |
| Trapped piece | ✅ | Skewer | ❌ D4 |
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
| 2026-06-11 | 93–100% | — | — | — | — | — | — | — | — |

## Daily log (append ONE entry per session, 1–3 lines, newest on top)

- **2026-06-11** · setup · Built the workshop (README/TODO/TRACKER), audited
  reading list vs V2 (9 concepts already done), merged backlogs, wrote puzzle
  fetch script. Next: I1 fixtures → I2 recall harness.
