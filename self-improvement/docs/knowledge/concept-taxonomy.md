# Concept Taxonomy — master matrix

One row per chess concept the commentary engine could name. Three columns of
truth: does **chess.com** comment on it (observed in `chesscom-templates.md`),
does **lichess** tag it as a puzzle theme (= free labeled test data), and does
**StockThink** detect it (fact kind in `backend/src/concepts/facts.ts`).

This file is the single source for "what's missing". The daily improvement
loop (`/improve-analysis`) picks ❌/🟡 rows, implements them, and flips status.
Keep it sorted by section; update status in the same commit as the code.

Legend: ✅ done · 🟡 partial · ❌ missing · — not applicable / no data.

## Tactics (move achieves)

| Concept | chess.com | lichess theme | StockThink fact | Status |
|---|---|---|---|---|
| Free piece capture | ✅ | `hangingPiece` | `wins_free_piece` | ✅ |
| Wins material at end of forced line | ✅ | `crushing`,`advantage` | — | 🟡 deep-line material win not phrased |
| Favorable exchange (takes higher) | — | — | `captures_higher` | ✅ |
| Fork | observed lib-wide | `fork` | `creates_fork` | ✅ |
| Pin | observed lib-wide | `pin` | `creates_pin` | ✅ |
| Skewer | observed lib-wide | `skewer` | — (`isSkewer` in primitives.ts UNWIRED) | ❌ wire it |
| Discovered attack (wins material) | observed lib-wide | `discoveredAttack` | — | ❌ |
| Discovered check | — | `discoveredAttack` | `discovered_check` | ✅ |
| Double check | — | `doubleCheck` | — | ❌ |
| X-ray attack | — | `xRayAttack` | — | ❌ |
| Deflection / overloading | — | `deflection`,`overloading` | — | ❌ (advanced, later) |
| Attraction | — | `attraction` | — | ❌ (advanced, later) |
| Clearance | — | `clearance` | — | ❌ (advanced, later) |
| Trapped piece | — | `trappedPiece` | `traps_piece` | ✅ |
| Mate threat (in 1) | ✅ | `mate` | `mate_threat` | ✅ |
| Mate delivered | ✅ | `mateIn1..5` | `delivers_mate` | ✅ |
| Back-rank mate pattern | — | `backRankMate` | helper unused (primitives.ts) | ❌ name the pattern |
| Smothered mate | — | `smotheredMate` | — | ❌ |
| Sacrifice | — | `sacrifice` | `sacrifice` | ✅ |
| Wins tempo | ✅ | — | `wins_tempo` | ✅ |
| Plain check (no mate/tempo) | — | — | — | ❌ silent today |
| Zugzwang | — | `zugzwang` | — | ❌ (endgame, later) |

## Defense / safety

| Concept | chess.com | lichess theme | StockThink fact | Status |
|---|---|---|---|---|
| Escapes attack ("steps out of danger") | ✅ ×4 variants | — | — | ❌ HIGH PRIORITY |
| Defends attacked piece/pawn | ✅ | `defensiveMove` | `defends_piece` | 🟡 verify pawn coverage |
| Blocks check | — | — | `blocks_check` | ✅ |
| Luft ("space for the king") | ✅ | — | — | ❌ |
| Prophylactic retreat ("safer square") | ✅ | — | — | ❌ |
| Only move | — | `defensiveMove` | `only_move` | ✅ |

## Captures / trades

| Concept | chess.com | StockThink fact | Status |
|---|---|---|---|
| Recapture ("takes back") | ✅ ×3 variants | — | ❌ HIGH PRIORITY (very common) |
| Equal trade | ✅ | `trade` | ✅ |
| Trade OFFER (non-capture) | ✅ | — | ❌ |
| Simplifies when ahead | — | `simplifies_ahead` | ✅ |

## Threats / pressure

| Concept | chess.com | StockThink fact | Status |
|---|---|---|---|
| Adds attacker to attacked target ("new attacker joins the pressure") | ✅ | — | ❌ |
| Reinforces existing threat ("becomes more serious") | ✅ | — | ❌ |
| Threatens to improve (e.g. reach outpost) | ✅ | — | ❌ |
| Reveals/creates weakness (squares around king, color complex) | observed lib-wide | `exposedKing`,`weakSquare`(opening tags) | regressions partially | 🟡 |

## Development / opening principles

| Concept | chess.com | StockThink fact | Status |
|---|---|---|---|
| Develops a piece | ✅ | `develops` | ✅ |
| Prepares development ("bishop ready to be developed") | ✅ | — | ❌ |
| Early queen warning | ✅ | — | ❌ |
| Same piece twice in opening | ✅ | — | ❌ |
| Book + opening idea sentence | ✅ | opening name only | 🟡 (idea lines for top ~50 openings) |
| Falls behind in development | — | `lags_development` | ✅ |

## Activity / structure

| Concept | chess.com | StockThink fact | Status |
|---|---|---|---|
| Opens line/diagonal for own piece | ✅ | — | ❌ |
| Last piece joins the action | ✅ | — | ❌ |
| Enables future plan (e.g. doubling rooks) | ✅ | — | ❌ (later — needs plan model) |
| Rooks doubled / battery | ✅ | `file_battery` | 🟡 phrasing for rook-rook |
| Pawn chain formed | ✅ | — | ❌ |
| Passed pawn / promotion | — (lib-wide) | `passed_pawn` + lichess `advancedPawn`,`promotion` | ✅ |
| Outpost, open file, 7th rank, fianchetto, center, mobility | partial | corresponding facts | ✅ |

## Better-move phrasing (composer, not detector)

| Concept | chess.com | StockThink | Status |
|---|---|---|---|
| Describe best move by PURPOSE ("recapture a piece", "put a pawn in the center", "develop a knight") | ✅ | "`{san}` was the better way." | ❌ HIGH PRIORITY — run annotateMove on bestMove, phrase by its top purpose fact |
| Principle + plan combo for bad moves | ✅ | cause→consequence→better | 🟡 |
| Praise pool rotation | ✅ ~6 variants/class | 3 total | 🟡 widen pool |

## Endgame (all later-stage)

| Concept | lichess theme | Status |
|---|---|---|
| Pawn race / breakthrough | `pawnEndgame`,`advancedPawn` | ❌ |
| King activity | `kingsideAttack` etc. | ❌ |
| Fortress / wrong bishop | `fortress` | ❌ |
