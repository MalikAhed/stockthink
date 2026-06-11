# chess.com Game Review — Template Library (ground truth)

Verbatim phrases transcribed from real chess.com Game Review sessions, with the
situation that triggered each one. This is the reference corpus StockThink's
composer is benchmarked against. **Append-only**: when a new game is fed in, add
new phrases under the right category and never delete observed ones.

Status legend: ✅ StockThink has an equivalent fact+template · 🟡 partial · ❌ missing.

Source: game `Mystical_Meeee (1202) vs kxhamouda (1202)`, 0-1
(https://www.chess.com/analysis/game/pgn/4Rwk15XaUW/analysis), 2026-06-11.
Moves 10–18 not yet captured (transcription paused — refeed if needed).

## 1. Opening / book moves

| Phrase (verbatim) | Trigger | Status |
|---|---|---|
| "Strong players throughout history have played this move. Garry Kasparov, Magnus Carlsen, and Bobby Fischer…" | 1. e4 book | ❌ (we show opening name only) |
| "The Sicilian Defense fights for the center without copying White's first move." | 1... c5 book — named opening + one-line idea | ❌ |
| "c4 takes space in the center, controls the d5 square and prepares to develop the knight behind the c-pawn." | book pawn move — space + square control + prep | ❌ |
| "Developing the knight and increasing influence in the [center]." | book knight development (reused verbatim for two different moves) | 🟡 `develops` |
| "Textbook play! Following the greats, building a solid game!" | generic book filler | ❌ |

## 2. Development / opening principles (non-book)

| Phrase | Trigger | Status |
|---|---|---|
| "The bishop is ready to be [developed] to an active square." | pawn move opening a bishop's diagonal | ❌ (prepares-development concept) |
| "Usually other pieces are developed before the Queen for safety. The better move was to develop a knight and attack the center." | early queen move classified Mistake — **principle violation + better-plan** | ❌ (early-queen detector) |
| "Moving the same piece twice in the opening isn't good for development. The best option was to put a pawn in the center." | same piece moved twice in opening, Inaccuracy | ❌ (same-piece-twice detector) |
| "White develops further." | minor developing move midgame | 🟡 `develops` (ours is gated to fullmove ≤12) |

## 3. Better-move suggestions (the "X was the better way" family)

chess.com phrases the suggestion as a **plan**, not a SAN move:

| Phrase | Trigger | Status |
|---|---|---|
| "The best option was to put a pawn in the center." | best move is a central pawn push (used for both Mistake and Inaccuracy) | ❌ (we say "`{san}` was the better way.") |
| "The better move was to put a pawn in the center." | same, alternate wording | ❌ |
| "The best option was to recapture a piece." | best move is a recapture | ❌ |
| "The better move was to develop a knight and attack the center." | best move develops + attacks center | ❌ |

→ Concept: **describe the best move by its PURPOSE** (recapture / central pawn /
develop / castle / defend), falling back to SAN only when no purpose is known.

## 4. Threats & pressure

| Phrase | Trigger | Status |
|---|---|---|
| "A new attacker joins the pressure on the pawn." | move adds an attacker to an already-attacked pawn | ❌ (pressure-stacking detector) |
| "This threatens to take an [outpost] with a knight." | knight move threatening to reach an outpost square | ❌ (threat-to-improve) |
| "The threat on the pawn becomes more serious with this move." | reinforcing an existing threat | ❌ |
| "This wins a tempo by [threatening] a queen and forcing it to move away." | attack on higher piece forcing it to move | ✅ `wins_tempo` |
| "This threatens checkmate with **Qxh6#** next." style | mate-in-1 threat | ✅ `mate_threat` |

## 5. Captures, trades, recaptures

| Phrase | Trigger | Status |
|---|---|---|
| "Taking that pawn will win material at the end of the line." | capture that wins material after forced sequence | 🟡 `wins_free_piece` (ours is immediate-only) |
| "Taking that pawn will win material after the follow-up trades are made." | same, alternate wording | 🟡 |
| "That pawn was free for the taking." | free pawn capture | ✅ `wins_free_piece` (piece-phrasing) |
| "This offers to [exchange] pieces of equal value." | offering a trade (not capturing yet) | ❌ (trade-offer ≠ trade) |
| "After all captures, this is an equal [trade]." | initiating an equal trade | ✅ `trade` |
| "A straightforward recapture." | recapture (most common) | ❌ (recapture concept) |
| "A clear recapture." | recapture, variant | ❌ |
| "Takes back." | recapture, terse variant | ❌ |

## 6. Safety / escaping danger

| Phrase | Trigger | Status |
|---|---|---|
| "This move steps the bishop out of danger and keeps material balance." | attacked piece moves to safety | ❌ (escapes-attack detector) |
| "This move steps the queen out of danger and keeps material balance." | same template, queen | ❌ |
| "This calmly removes the rook from an immediate threat." | same concept, variant | ❌ |
| "This moves the bishop to safety." | same concept, terse | ❌ |
| "This move puts the queen on a safer square." | prophylactic retreat (not nec. attacked) | ❌ |
| "This [protects] the attacked pawn." | defending an attacked pawn | 🟡 `defends_piece` (ours skips pawns?) — verify |
| "This creates space for the king to [move] in case it is attacked." | luft (h6/h3-style) | ❌ (luft detector) |

## 7. Piece activity / structure

| Phrase | Trigger | Status |
|---|---|---|
| "Black opens the diagonal for the [bishop], increasing its activity." | pawn move opening own bishop's diagonal | ❌ (opens-line-for-piece) |
| "The piece finds a new, active square." | repositioning to a better square | 🟡 `mobility_gain` |
| "One more piece joins the action." | bringing last inactive piece into play | ❌ |
| "Doubling the rooks is now a real possibility for Black." | move enabling future rook doubling | ❌ (enables-plan concept) |
| "The rooks are coordinated and powerfully [doubled] on the file." | rooks doubled on a file | 🟡 `file_battery` (rook-rook case phrasing) |
| "This creates a pawn chain, linked pawns that form a strong structure." | pawn move completing a chain | ❌ (pawn-chain detector) |

## 8. Mistakes / losses (vague tier — used when no concrete tactic)

| Phrase | Trigger | Status |
|---|---|---|
| "The game is still close to equal, but Black lost their advantage." | Inaccuracy that gives back an edge, no concrete refutation | ❌ (advantage-swing narration WITHOUT numbers — note: borderline eval-speak; if adopted, keep R1) |
| "This loses material." | Mistake dropping material, no elaboration | 🟡 (we always elaborate; fine) |
| "This permits the opponent to checkmate the king." | move allowing mate | ✅ `allows_mate` |

## 9. Praise fillers (Best/Excellent with no concrete fact)

chess.com rotates many variants — StockThink has 3 neutral lines:

- "What a move! Super solid, right on target!" (Best — used twice)
- "Strong choice, right on target. You love to see it." (Best)
- "The best move here, no doubt about it." (Best)
- "This is one of the best moves!" (Excellent — used twice)
- "That's one of the best moves in this position." (Excellent — used twice)
- "One of the best moves, it is very strong play." (Excellent — used twice)

Status: 🟡 — rotate a larger pool; keep R3 (praise stays brief).

## 10. Game frame

| Phrase | Trigger | Status |
|---|---|---|
| "Tough break for White, but hey, learning from losses is key! Let's break it down." | review intro, loser's POV | ❌ (summary intro line) |
| "And the game is over." | final mating move | 🟡 `delivers_mate` |

## UI observations (for parity, not urgent)

- One short sentence per move; glossary terms rendered as tappable chips
  ([center], [outpost], [exchange], [trade], [doubled], [protects], …).
- Buttons: "Best" (shown only when played ≠ best), "Explain", "Next".
- Suggestions drawn as green arrows on the board, not SAN in text.
- Classification icon inline in move list; eval badge next to classification.
- Templates are openly reused across moves and even across classifications.
