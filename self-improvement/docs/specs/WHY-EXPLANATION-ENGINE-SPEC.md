# UPGRADE SPEC — Chess "Why" Explanation Engine

**Audience:** an AI coding agent working inside an EXISTING, ~90%-complete, client-side chess analysis app.
**Read this entire file before writing any code.**

---

## 0. Mission & context

The existing system already works: it runs Stockfish, classifies moves, and prints shallow labels like
`"Blunder. Nf3 was the best move."` or `"loses a pawn"`.

**What is missing — and what you will build — is the WHY layer:** the explanation of *why* a move is good or bad, e.g.

> "12...Bd6?? is a blunder. After Qxd5, your knight on c3 is pinned to the king and cannot recapture — you lose a piece."

**You are NOT rebuilding the app.** You are adding one module (the *explanation engine*) and wiring it into the existing classification/message code.

This is exactly how Chess.com's Game Review works internally: classification (eval-probability deltas) is one system; explanation is a **separate feature-detection engine** that finds discrete, verifiable facts (fork, lost piece, mate, pin) and templates them. You will replicate that architecture. Everything below is deterministic, runs client-side, and costs $0 — no APIs, no servers.

### 0.1 FIRST ACTION — audit the existing codebase
Before writing code, read the repo and answer:
1. **Language?** (JavaScript/TypeScript in browser, or Python.) The reference implementation below is Python (`python-chess`). If the codebase is JS, port it 1:1 using §9 (porting table). Do not switch the project's language.
2. **Where is the engine called?** Find the Stockfish call site. Confirm whether it already requests `MultiPV` and whether it stores the **full PV (line of moves)** per position — not just `bestmove`. If it only stores `bestmove` + score, extend it (§2).
3. **Where are classifications decided and message strings produced?** That is your integration point (§11).
4. Reuse the existing board library (`chess.js` or `python-chess`). Do not add a second one.

---

## 1. Non-negotiable rules (anti-hallucination)

1. **Never state a chess claim that a detector did not verify on the actual board.** No detector fired ⇒ use the generic fallback template. A generic-but-true sentence always beats a specific-but-wrong one.
2. **The "why" lives in the engine's lines, not in the played move itself.** A bad move's reason is encoded in the *refutation* (the opponent's best line after it). A good move's reason is encoded in its own PV. Always analyze the line, never guess from the single move.
3. **All thresholds operate on win-probability, never raw centipawns.** Convert every score with `win_pct()` first (§2.3).
4. **POV discipline.** Every engine score must be converted to the *mover's* point of view before comparing (`score.pov(mover)` in python-chess; negate UCI `score cp` when the opponent is to move). POV sign bugs are the #1 failure mode of this kind of system.
5. **Use SEE (`see_capture`) for any material claim.** `is_hanging` is a defender-existence test only — it cannot judge exchanges.
6. **Detectors require legal positions.** Garbage in ⇒ garbage out (e.g., a FEN where the side not to move is in check breaks everything).
7. **Output at most one primary fact + one "better was" clause per move** (§7). Do not dump every detected feature.
8. If a future LLM-polish layer is ever added (optional, costs money — out of scope for now), it may ONLY rephrase the verified fact object. It must never introduce a square, piece, or motif that is not in the facts.

---

## 2. Engine protocol & classification

### 2.1 One engine search per position (efficient)
For a game with positions `P0, P1, ... Pn` (after each move), analyze **each position once** with:

```
setoption name MultiPV value 3
go depth 20        # 18–22; raise to 24+ only if needed in sharp positions
```

Store per position, **per MultiPV line**: the score and the **full PV move list**.

Then for the move `m` played at `P_i`:
- `A_before = analysis[P_i]` → line 1 is the best move + best PV.
- `A_after  = analysis[P_(i+1)]` → its score is the eval after `m`, and **its PV line 1 is the refutation** (the opponent's punishment line). 

No second search per move is needed — position `i+1`'s analysis doubles as move `i`'s "after" analysis.

> UCI parsing note (JS): `info depth .. multipv N score cp X (or score mate M) .. pv e2e4 e7e5 ...`. The score is **from the side to move's perspective** in that position. Keep only the highest-depth info per `multipv` index.

### 2.2 Per-move quantities (all from the MOVER's POV)
```
cp_best  = A_before.line1.score.pov(mover)      # mate → use mate_score=100000, then cap
cp_after = A_after.line1.score.pov(mover)
delta_wp = win_pct(cp_best) - win_pct(cp_after)   # ≥ 0; how much the move threw away
```
If a score is mate: treat `win_pct` as 100 (mate for mover) or 0 (mate against), or just cap cp to ±1000 (gives 97.5/2.5 — fine).

### 2.3 Win-probability formula (Lichess, public)
```
win_pct(cp) = 50 + 50 * (2 / (1 + exp(-0.00368208 * clamp(cp, -1000, 1000))) - 1)
```
Sanity: `win_pct(0)=50`, `win_pct(100)≈59.1`, `win_pct(-300)≈24.9`.

### 2.4 Classification bands (Δwin%, tunable)
| Δwin% lost | Label |
|---|---|
| 0 | Best |
| (0, 2] | Excellent |
| (2, 5] | Good |
| (5, 10] | Inaccuracy |
| (10, 20] | Mistake |
| > 20 | **Blunder candidate** → gate below |

(These are Chess.com's published expected-points cutoffs ×100. Lichess uses 10/20/30 for inaccuracy/mistake/blunder — either is acceptable; keep them as constants.)

**Blunder gate (Chess.com's recalibration):** label "Blunder" only if Δwin% > 20 **AND** the explanation engine (§5) confirms a concrete cost: `loses_material` with value ≥ 3, **or** `allows_mate`. Otherwise downgrade the label to "Mistake". This makes labels match how a human coach talks.

**Miss (recommended):** if the opponent's previous move was itself a Mistake/Blunder and `explain_good_move(P_i, best)` (§6) finds a `wins_material` or `mate_for` fact, but the player's move lost ≥ 10 Δwin% versus best ⇒ label **Miss** and use the `missed_win` template.

**Great / Brilliant (OPTIONAL heuristics, ship last):**
- *Great:* the only good move — `win_pct(line1) − win_pct(line2) ≥ 15` (needs MultiPV ≥ 2), or the move flips losing→winning.
- *Brilliant:* played move is best/near-best (Δwin% ≤ 2) AND it is a sacrifice (the moved piece lands `in_bad_spot`, or `see_capture(move) < 0`) AND the mover was not already completely winning (`win_pct before < 90`) AND eval after stays ≥ roughly equal.

### 2.5 User-facing eval words (never print raw centipawns)
| win% (mover) | phrase |
|---|---|
| 50±5 | "equal" |
| 55–65 | "slightly better" |
| 65–85 | "clearly better" |
| 85–97 | "winning" |
| mate | "forced mate" |

---

## 3. Architecture (the pipeline you are adding)

```
position Pi + played move m
        │
        ▼
 engine analyses (already exist / §2.1)
   A_before = analysis[Pi]      A_after = analysis[Pi+1]
        │                              │
        ▼                              ▼
 Δwin% → classification        refutation PV (opponent's best line)
        │                              │
        └────────────┬─────────────────┘
                     ▼
        FACT EXTRACTION (§5 bad moves, §6 good moves)
        run verified detectors (§4) on the PV positions
                     ▼
        fact objects {type, pieces, squares, line, reason}
                     ▼
        PRIORITY LADDER (§7) → pick 1 primary fact (+1 "better was")
                     ▼
        TEMPLATES (§8) → final sentence(s)
```

---

## 4. Verified reference detectors (the core toolbox)

The code below was **executed and verified** (21/21 acceptance tests, §10) with `python-chess`. Copy it into a module (e.g. `explain/detectors.py`). If the codebase is JS, port function-by-function using §9 — keep names and semantics identical.

Key design facts you must preserve when porting:
- `is_defended`/`is_hanging` = defender **existence** test (with x-ray defenders). Used for motif logic only — never for exchange math.
- `effective_defenders` excludes **absolutely pinned** defenders whose pin-ray doesn't include the contested square. This is what produces the sentence *"the defender is pinned and cannot recapture."*
- `see_capture` walks **legal** captures only, so pins are handled automatically (a pinned recapture simply never appears). It returns net material for the mover; negative = losing capture.
- `fork_targets` requires the forker itself to be safe (`not in_bad_spot`) and ≥ 2 qualifying targets (worth more than the forker, or hanging and unable to take the forker). King counts as value 99.
- `is_trapped` must be called with the trapped piece's **owner to move**.
- `mate_threat(board)` answers: did the side that **just moved** create a mate-in-1 threat? (null-move trick; skip when in check).

```python
"""Reference 'why' detectors for chess move explanation. Verified with python-chess."""
import math
import chess

VALUES = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9}
KING_VALUES = {**VALUES, chess.KING: 99}
RAY_PIECES = (chess.QUEEN, chess.ROOK, chess.BISHOP)
PIECE_NAMES = {chess.PAWN: "pawn", chess.KNIGHT: "knight", chess.BISHOP: "bishop",
               chess.ROOK: "rook", chess.QUEEN: "queen", chess.KING: "king"}


# ---------- evaluation conversion ----------

def win_pct(cp: int) -> float:
    """Lichess centipawn -> win probability (0..100). Cap cp at +/-1000."""
    cp = max(-1000, min(1000, cp))
    return 50 + 50 * (2 / (1 + math.exp(-0.00368208 * cp)) - 1)


# ---------- material ----------

def material_count(board: chess.Board, color: chess.Color) -> int:
    return sum(VALUES[pt] * len(board.pieces(pt, color)) for pt in VALUES)


def material_diff(board: chess.Board, color: chess.Color) -> int:
    return material_count(board, color) - material_count(board, not color)


# ---------- defense / hanging ----------

def is_defended(board: chess.Board, square: chess.Square) -> bool:
    piece = board.piece_at(square)
    if board.attackers(piece.color, square):
        return True
    # x-ray defense: a friendly defender may sit behind an enemy ray attacker
    for asq in board.attackers(not piece.color, square):
        a = board.piece_at(asq)
        if a.piece_type in RAY_PIECES:
            b = board.copy(stack=False)
            b.remove_piece_at(asq)
            if b.attackers(piece.color, square):
                return True
    return False


def is_hanging(board: chess.Board, square: chess.Square) -> bool:
    return not is_defended(board, square)


def effective_defenders(board: chess.Board, square: chess.Square) -> list:
    """Defenders that could actually recapture on `square`: absolutely pinned
    defenders whose pin-ray does not include `square` are excluded."""
    piece = board.piece_at(square)
    out = []
    for dsq in board.attackers(piece.color, square):
        d = board.piece_at(dsq)
        if d.piece_type != chess.KING and board.is_pinned(piece.color, dsq):
            if square not in board.pin(piece.color, dsq):
                continue
        out.append(dsq)
    return out


def why_capturable(board: chess.Board, square: chess.Square) -> str:
    """Why can the piece on `square` be profitably captured?
    Call only after SEE has confirmed the capture wins material."""
    defenders = list(board.attackers(board.piece_at(square).color, square))
    if not defenders:
        return "undefended"
    if not effective_defenders(board, square):
        return "defender_pinned"
    return "outnumbered"


# ---------- bad spot / trapped ----------

def can_be_taken_by_lower_piece(board: chess.Board, square: chess.Square) -> bool:
    piece = board.piece_at(square)
    for asq in board.attackers(not piece.color, square):
        a = board.piece_at(asq)
        if a.piece_type != chess.KING and VALUES[a.piece_type] < VALUES[piece.piece_type]:
            return True
    return False


def is_in_bad_spot(board: chess.Board, square: chess.Square) -> bool:
    piece = board.piece_at(square)
    return bool(board.attackers(not piece.color, square)) and (
        is_hanging(board, square) or can_be_taken_by_lower_piece(board, square))


def is_trapped(board: chess.Board, square: chess.Square) -> bool:
    """It must be the piece owner's turn. True if an attacked piece has no safe move."""
    piece = board.piece_at(square)
    if piece is None or piece.piece_type in (chess.PAWN, chess.KING):
        return False
    if board.is_check() or board.is_pinned(piece.color, square):
        return False
    if not is_in_bad_spot(board, square):
        return False
    for move in board.legal_moves:
        if move.from_square != square:
            continue
        captured = board.piece_at(move.to_square)
        if captured and KING_VALUES[captured.piece_type] >= KING_VALUES[piece.piece_type]:
            return False  # can trade itself for equal or better
        board.push(move)
        bad = is_in_bad_spot(board, move.to_square)
        board.pop()
        if not bad:
            return False  # found a safe square
    return True


# ---------- static exchange evaluation ----------

def see_square(board: chess.Board, square: chess.Square) -> int:
    """Best material the side to move can win on `square` (never negative:
    capturing is optional). Uses legal moves, so pins are handled automatically."""
    target = board.piece_at(square)
    if target is None:
        return 0
    caps = [m for m in board.legal_moves if m.to_square == square and board.is_capture(m)]
    if not caps:
        return 0
    m = min(caps, key=lambda mv: KING_VALUES[board.piece_at(mv.from_square).piece_type])
    b = board.copy(stack=False)
    b.push(m)
    return max(0, KING_VALUES[target.piece_type] - see_square(b, square))


def see_capture(board: chess.Board, move: chess.Move) -> int:
    """Net material for the mover of capture `move` (can be negative)."""
    captured = 1 if board.is_en_passant(move) else KING_VALUES[board.piece_at(move.to_square).piece_type]
    b = board.copy(stack=False)
    b.push(move)
    return captured - see_square(b, move.to_square)


# ---------- tactical motifs ----------

def fork_targets(board: chess.Board, square: chess.Square) -> list:
    """`board` is the position AFTER the forking piece landed on `square`.
    Returns >=2 qualifying target squares, else []."""
    piece = board.piece_at(square)
    if piece is None or piece.piece_type == chess.KING:
        return []
    if is_in_bad_spot(board, square):
        return []  # the 'forker' can simply be captured
    targets = []
    for tsq in board.attacks(square):
        t = board.piece_at(tsq)
        if t is None or t.color == piece.color or t.piece_type == chess.PAWN:
            continue
        if KING_VALUES[t.piece_type] > KING_VALUES[piece.piece_type]:
            targets.append(tsq)
        elif is_hanging(board, tsq) and square not in board.attacks(tsq):
            targets.append(tsq)
    return targets if len(targets) >= 2 else []


def discovered_attacks(board_before: chess.Board, move: chess.Move) -> list:
    """(attacker_sq, target_sq) pairs newly opened by `move` vacating its square."""
    us = board_before.turn
    b = board_before.copy(stack=False)
    b.push(move)
    found = []
    for sq in chess.SquareSet(b.occupied_co[us]):
        p = b.piece_at(sq)
        if sq == move.to_square or p.piece_type not in RAY_PIECES:
            continue
        for t in b.attacks(sq):
            tp = b.piece_at(t)
            if tp and tp.color != us and KING_VALUES[tp.piece_type] >= 3:
                if move.from_square in chess.SquareSet.between(sq, t) \
                        and t not in board_before.attacks(sq):
                    found.append((sq, t))
    return found


def gives_discovered_check(board_before: chess.Board, move: chess.Move) -> bool:
    b = board_before.copy(stack=False)
    b.push(move)
    ck = b.checkers()
    return bool(ck) and move.to_square not in ck


def is_skewer(board_before: chess.Board, capture_move: chess.Move,
              prev_opp_move: chess.Move) -> bool:
    """A ray piece captures along a line that the opponent's previous move vacated,
    and the piece that fled was worth more than the one captured behind it."""
    cap = board_before.piece_at(capture_move.from_square)
    victim = board_before.piece_at(capture_move.to_square)
    if cap is None or victim is None or cap.piece_type not in RAY_PIECES:
        return False
    if prev_opp_move.from_square not in chess.SquareSet.between(
            capture_move.from_square, capture_move.to_square):
        return False
    moved = board_before.piece_at(prev_opp_move.to_square)
    return moved is not None and KING_VALUES[moved.piece_type] > KING_VALUES[victim.piece_type]


def pins_created(board_before: chess.Board, move: chess.Move) -> list:
    """Enemy squares newly absolutely-pinned by `move`."""
    b = board_before.copy(stack=False)
    b.push(move)
    them = b.turn
    out = []
    for sq in chess.SquareSet(b.occupied_co[them]):
        was_pinned = board_before.piece_at(sq) is not None and board_before.is_pinned(them, sq)
        if b.is_pinned(them, sq) and not was_pinned:
            out.append(sq)
    return out


def is_back_rank_mate(board: chess.Board) -> bool:
    """`board` is a checkmate position."""
    if not board.is_checkmate():
        return False
    color = board.turn  # the mated side
    ksq = board.king(color)
    back = 7 if color == chess.BLACK else 0
    if chess.square_rank(ksq) != back:
        return False
    step = -8 if color == chess.BLACK else 8
    kf = chess.square_file(ksq)
    for df in (-1, 0, 1):
        f = kf + df
        if 0 <= f <= 7:
            front = board.piece_at(ksq + step + df)
            if front is None or front.color != color:
                return False  # escape square not blocked by own piece
    return any(chess.square_rank(c) == back for c in board.checkers())


def mate_threat(board: chess.Board):
    """`board`: position after the mover's move (opponent to move).
    Returns the mating move if the mover threatens mate-in-1, else None."""
    if board.is_check():
        return None
    b = board.copy(stack=False)
    b.push(chess.Move.null())  # give the mover a free move
    for mv in b.legal_moves:
        b.push(mv)
        mate = b.is_checkmate()
        b.pop()
        if mate:
            return mv
    return None
```

---

## 5. `explain_bad_move` — the refutation walk (THE missing core)

This is the algorithm that replaces "Blunder. X was best." with the actual reason. The principle: **simulate the punishment line and attribute the damage.**

```python
MAX_WALK_PLIES = 8

def explain_bad_move(P, m, A_before, A_after):
    """P: position before the move. m: played move.
    A_before/A_after: stored analyses (§2.1). Returns ordered list of facts."""
    mover = P.turn
    facts = []
    refut = A_after.line1.pv                      # opponent's punishment line
    score_after = pov(A_after.line1.score, mover)

    # ---- P0: allows forced mate ----
    if is_mate_against(score_after):
        facts.append({"type": "allows_mate", "n": mate_in(score_after),
                      "line": san_prefix(P_after(P, m), refut, 2*mate_in(score_after)-1)})

    # ---- P1/P2: walk the refutation ----
    b = P.copy(); b.push(m)
    mat_start = material_diff(b, mover)
    prev_move = m
    for i, r in enumerate(refut[:MAX_WALK_PLIES]):
        opp_move = (b.turn != mover)

        # capture against the mover that actually wins material (SEE-verified)
        if opp_move and b.is_capture(r):
            victim_sq = r.to_square
            victim = b.piece_at(victim_sq)        # NB: None for en passant — handle
            if victim and victim.color == mover and see_capture(b, r) > 0:
                reason = why_capturable(b, victim_sq)
                fact = {"type": "loses_material", "piece": victim.piece_type,
                        "square": victim_sq, "reason": reason,
                        "value": see_capture(b, r),
                        "line": san_prefix_from(b, refut[i:], 1, lead_in=refut[:i], root=P, played=m)}
                if reason == "defender_pinned":
                    fact["pinned_defender"] = pinned_defender_info(b, victim_sq)  # square + what it's pinned to
                facts.append(fact)
                break                              # first concrete loss IS the reason

        # motifs created by the opponent's move (need post-push board)
        b.push(r)
        if opp_move:
            ft = fork_targets(b, r.to_square)
            if ft:
                facts.append({"type": "allows_fork", "by_square": r.to_square,
                              "targets": ft, "move": r}); break
            if is_skewer(prev_board(b, r), r, prev_move):
                facts.append({"type": "allows_skewer", "move": r}); break
            da = discovered_attacks(prev_board(b, r), r)
            if da:
                facts.append({"type": "allows_discovered", "pairs": da, "move": r})
            mt = mate_threat(b)                    # opponent threatens mate next?
            if mt:
                facts.append({"type": "allows_mate_threat", "threat": mt, "move": r}); break
        prev_move = r

    # ---- fallback: net material over the whole line ----
    if not any(f["type"] == "loses_material" for f in facts):
        end = simulate(P, m, refut[:MAX_WALK_PLIES])
        net = material_diff(end, mover) - mat_start
        if net <= -2:
            facts.append({"type": "loses_material_eventually", "value": net,
                          "line": san(refut[:MAX_WALK_PLIES])})

    # ---- always: what the best move achieved ----
    best = A_before.line1.pv[0]
    facts.append({"type": "better_was", "move": best,
                  "purpose": explain_good_move(P, A_before)})   # §6, may be None
    return facts
```

Implementation notes:
- `prev_board(b, r)` = the position before `r` was pushed (pop/copy — implement however fits; the skewer/discovered detectors take the *pre-move* board plus the move).
- The walk also automatically covers the simplest case "the played move hangs a piece": then `refut[0]` is the capture and the loop reports it on iteration 0 with `reason="undefended"` → template renders "hangs your knight — Qxd5 simply wins it."
- Pinned-defender info for the killer sentence: the defender excluded by `effective_defenders` plus the king/piece behind it on `board.pin(...)`'s ray.
- For Inaccuracies (small Δwin%) the walk often finds nothing — that's correct; you'll fall to positional (§6.5) or the comparative fallback (§8).

---

## 6. `explain_good_move` — purpose detection (also powers "X was better because…")

Run the same toolbox on the move's **own** PV, from the mover's side:

```python
def explain_good_move(P, A):                      # A: analysis whose line1 starts with the move
    mover = P.turn
    mv = A.line1.pv[0]
    score = pov(A.line1.score, mover)
    b = P.copy(); b.push(mv)

    if is_mate_for(score):
        return {"type": "mate_for", "n": mate_in(score)}
    if P.is_capture(mv) and see_capture(P, mv) > 0:
        return {"type": "wins_material", "value": see_capture(P, mv),
                "square": mv.to_square, "reason": why_capturable(P, mv.to_square)}
    ft = fork_targets(b, mv.to_square)
    if ft:  return {"type": "fork_for", "targets": ft}
    pc = pins_created(P, mv)
    if pc:  return {"type": "pin_for", "pinned": pc[0]}
    da = discovered_attacks(P, mv)
    if da:  return {"type": "discovered_for", "pairs": da}
    mt = mate_threat(b)
    if mt:  return {"type": "threat_for", "threat": mt, "is_mate_threat": True}
    # rescue / escape: a mover piece that was in a bad spot in P and is safe now
    saved = [s for s in bad_spot_squares(P, mover) if not still_bad(b, s, mv)]
    if saved: return {"type": "saves_piece", "square": saved[0]}
    # traps an enemy piece (after our move it's opponent's turn — required by is_trapped)
    tr = [s for s in attacked_enemy_squares(b, mover) if is_trapped(b, s)]
    if tr:  return {"type": "trap_for", "square": tr[0]}
    return positional_purpose(P, mv)              # §6.5, may return None
```

Use it in three places: (a) explaining the player's good moves; (b) the `better_was` clause inside every bad-move explanation; (c) Miss detection (§2.4).

### 6.5 Positional layer (fallback when no tactic fires)
Compute cheap features on `P` vs the position after the move (and after `best`), and report the **worst regression** (bad move) or **best improvement** (good move). Only trigger when no tactical fact exists and Δwin% ≥ 5.

| Feature | Detection sketch | Phrase fragment |
|---|---|---|
| King pawn shield | count own pawns on king's file ±1, 1–2 ranks in front; report drop | "weakens the pawn shield in front of your king" |
| Open file vs king | enemy R/Q on a file with no own pawns, aligned with own king | "opens the {f}-file against your king" |
| Doubled pawns | a file containing ≥ 2 own pawns (new) | "creates doubled {f}-pawns" |
| Isolated pawn | own pawn with no own pawns on adjacent files (new) | "leaves the {f}-pawn isolated" |
| Passed pawn (good) | no enemy pawns ahead on file ±1 | "creates a passed {f}-pawn" |
| Knight on rim | knight moved to file a/h | "puts the knight offside on the rim" |
| Development (fullmove ≤ 12) | minor pieces still on home squares vs opponent | "falls behind in development" |
| Center control | Δ of own attackers of d4/e4/d5/e5 | "gives up central control" |

All are 5–15 lines each with `board.pieces(PAWN, color)` + file/rank arithmetic. Implement behind one function `positional_purpose(P, mv) -> fact|None` and a mirror `positional_regression(P, mv) -> fact|None`.

---

## 7. Priority ladder — choose ONE thing to say

When several facts exist, pick the **highest** of:

```
P0  mate          (mate_for / allows_mate)
P1  material      (wins_material / loses_material, SEE-verified) — attach its reason motif
P2  pure tactic   (fork / pin / skewer / discovered / trap / saves_piece)
P3  threat        (mate_threat / allows_mate_threat)
P4  missed win    (Miss)
P5  positional    (king safety > pawn structure > files/activity > development)
P6  fallback      (comparative: what best kept)
```

Final message = primary fact's template + (for Inaccuracy/Mistake/Blunder/Miss) the `better_was` clause. **Never more than these two sentences.** Never enumerate every motif found.

---

## 8. Templates (string bank)

Keep ALL templates in one dictionary keyed by fact type, with named slots — so a second language set (e.g. Arabic/RTL) can be swapped in without touching logic. A template may only render if its fact exists with all slots detector-filled.

```
allows_mate          : "{move} is a blunder — it allows forced mate in {n}: {line}."
loses_material:undefended      : "{move} loses your {piece}: after {line}, the {piece} on {sq} is undefended."
loses_material:defender_pinned : "{move} loses material: after {line}, your {defender} on {dsq} is pinned to your {pinned_to} and cannot recapture on {sq}."
loses_material:outnumbered     : "{move} loses your {piece} on {sq} — it is attacked more times than it is defended ({line})."
hangs_piece (walk i=0, undefended) : "{move} hangs your {piece} on {sq} — {opp_capture} simply wins it."
allows_fork          : "{move} allows {opp_move}, forking your {t1} and {t2}."
allows_skewer        : "{move} walks into a skewer: {opp_move} wins material behind your {piece}."
allows_discovered    : "{move} allows {opp_move}, a discovered attack on your {target}."
allows_mate_threat   : "{move} lets your opponent threaten mate with {threat}."
loses_material_eventually : "{move} loses material by force: after {line} you end up down {value_words}."
mate_for             : "{move} forces checkmate in {n}."
wins_material        : "{move} wins a {piece}: {reason_clause}."
fork_for             : "{move} forks the {t1} and {t2}."
pin_for              : "{move} pins the {piece} on {sq} against the {behind}."
discovered_for       : "{move} unleashes a discovered attack on the {target}."
trap_for             : "{move} traps the {piece} on {sq} — it has no safe squares."
saves_piece          : "{move} rescues your attacked {piece} on {sq}."
threat_for           : "{move} threatens {threat}{mate_suffix}."
positional:*         : "{move} {fragment}."           # fragments from §6.5 table
missed_win           : "This misses a win — {best} would have {purpose_clause}."
better_was           : "{best} was better: {purpose_clause}."
fallback_bad         : "{move} lets your advantage slip — {best} keeps {the pressure|the extra material|your attack}."
fallback_good        : "A solid move, keeping the position {eval_word}."
reason_clause(undefended)      : "it is undefended"
reason_clause(defender_pinned) : "its defender on {dsq} is pinned and cannot recapture"
reason_clause(outnumbered)     : "it has more attackers than defenders"
```

Render pieces as words ("knight", not "N"), squares as `c3`, lines as short SAN (≤ 3 moves shown, ellipsis after).

---

## 9. JS porting table (only if the codebase is JavaScript)

Engine: use **stockfish.js / stockfish-18-lite WASM** in a Web Worker (the single-threaded *lite* build needs no COOP/COEP headers). Same UCI text protocol as §2.1.

Board: **chess.js v1+** (`npm i chess.js`).

| python-chess | chess.js v1 equivalent |
|---|---|
| `board.attackers(color, sq)` | `chess.attackers(square, color)` → includes pinned pieces (good — same semantics) |
| `board.attacks(from)` | helper: `SQUARES.filter(s => chess.attackers(s, colorOfPiece).includes(from))` (O(64), fine) |
| `board.is_pinned(color, sq)` | helper: `remove(sq)`; own king now attacked by an enemy Q/R/B whose ray crosses `sq`? `put` back. |
| `board.pin(color, sq)` (ray) | derive the ray squares between that sliding attacker and the king (incl. attacker) |
| `board.is_capture(m)` / en passant | `move.flags` contains `'c'` / `'e'` from `moves({verbose:true})` |
| `board.legal_moves` from a square | `chess.moves({ square, verbose: true })` |
| `push/pop`, `copy` | apply `move()` on a `new Chess(fen)` copy / `undo()` |
| `is_checkmate / checkers` | `isCheckmate()`; checkers: enemy `attackers(kingSq, enemyColor)` while `inCheck()` |
| `Move.null()` (mate_threat) | manual FEN turn-flip: swap ` w ` ↔ ` b `, clear the en-passant field, `new Chess(flippedFen)` (skip when `inCheck()`) |
| `material_diff` | iterate `chess.board()` and sum VALUES |

Port the detectors with identical names/semantics, then make the §10 suite pass in JS before integrating.

---

## 10. MANDATORY acceptance tests — must be green before integration

These exact positions and expected outputs were executed and verified. Re-implementing detectors (any language) MUST reproduce all of them. (Pitfall from development: ensure every test FEN is a *legal* position — a side-not-to-move in check silently breaks detectors.)

| # | FEN / setup | Call | Expected |
|---|---|---|---|
| T0 | — | `win_pct(0)`, `win_pct(100)`, `win_pct(-300)` | `50`, `≈59.1`, `≈24.9` |
| T1a | `k7/8/8/3n4/8/8/3Q4/3K4 w` | `is_hanging(d5)` | `True` |
| T1b | same | `see_capture(Qd2xd5)` | `+3` |
| T1c | `k7/8/2p5/3n4/8/8/3Q4/3K4 w` | `see_capture(Qd2xd5)` | `-6` (pawn recaptures) |
| T2 | `r3k3/2N5/8/8/8/8/8/4K3 b` | `fork_targets(c7)` | `{a8, e8}` (royal fork) |
| T3 | `4k3/8/2n5/1B2p3/8/5N2/8/4K3 w` | `is_pinned(black, c6)`; `is_defended(e5)`; `effective_defenders(e5)`; `why_capturable(e5)`; `see_capture(Nf3xe5)` | `True`; `True`; `[]`; `"defender_pinned"`; `+1` |
| T4 | `r3k3/B1p5/1p6/8/8/8/8/4K3 w` | `is_trapped(a7)` | `True` (Bxa7 b6! trap) |
| T5 | `6k1/5ppp/8/8/8/8/8/R5K1 w` then `Ra8#` | `is_back_rank_mate(board)` | `True` |
| T6 | `6k1/5ppp/8/8/8/8/5PPP/3R2K1 b` | `mate_threat(board)` | move `d1d8` (White threatens Rd8#) |
| T7 | `3qk3/8/8/8/3N4/8/8/3R2K1 w`, move `Nd4-f5` | `discovered_attacks` | contains `(d1, d8)` |
| T8 | `4k3/8/2n5/8/8/8/8/4KB2 w`, move `Bf1-b5` | `pins_created` | `[c6]` |
| T9 | `n6k/8/8/8/3q4/8/8/R3K3 w`, capture `Ra1xa8`, prev opp move `Qa5-d4` | `is_skewer` | `True` |
| T10 | `k7/8/8/8/8/8/8/K2R4 w` | `material_diff(white)` | `+5` |

T3 is the most important test — it produces the target sentence end-to-end: *"loses material: the knight on c6 is pinned to the king and cannot recapture on e5."* Note how SEE handled the pin automatically (the illegal recapture never enters the search).

The exact runnable suite (Python):

```python
import chess
from detectors import *

results = []

def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(f"{'PASS' if cond else 'FAIL'} - {name} {detail}")

# T0 win_pct sanity
check("T0a win_pct(0)==50", abs(win_pct(0) - 50) < 1e-9)
check("T0b win_pct(100)~59", 58.5 < win_pct(100) < 60, f"={win_pct(100):.2f}")
check("T0c win_pct(-300)~26", 24 < win_pct(-300) < 28, f"={win_pct(-300):.2f}")

# T1 hanging piece + SEE
b = chess.Board("k7/8/8/3n4/8/8/3Q4/3K4 w - - 0 1")
check("T1a Nd5 hanging", is_hanging(b, chess.D5))
check("T1b SEE Qxd5 == +3", see_capture(b, chess.Move.from_uci("d2d5")) == 3,
      f"={see_capture(b, chess.Move.from_uci('d2d5'))}")

# T1c defended piece -> losing capture
b = chess.Board("k7/8/2p5/3n4/8/8/3Q4/3K4 w - - 0 1")
check("T1c SEE Qxd5 == -6 (pawn defends)", see_capture(b, chess.Move.from_uci("d2d5")) == -6,
      f"={see_capture(b, chess.Move.from_uci('d2d5'))}")
check("T1d why=outnumbered? no: defended, SEE<0 so never called; is_defended True",
      is_defended(b, chess.D5))

# T2 fork (knight on c7 forks Ke8 and Ra8)
b = chess.Board("r3k3/2N5/8/8/8/8/8/4K3 b - - 0 1")
ft = fork_targets(b, chess.C7)
check("T2 fork targets == {a8,e8}", set(ft) == {chess.A8, chess.E8}, f"={[chess.square_name(s) for s in ft]}")

# T3 pinned defender (Bb5 pins Nc6; e5 pawn only 'defended' by the pinned knight)
b = chess.Board("4k3/8/2n5/1B2p3/8/5N2/8/4K3 w - - 0 1")
check("T3a Nc6 absolutely pinned", b.is_pinned(chess.BLACK, chess.C6))
check("T3b e5 naively defended", is_defended(b, chess.E5))
check("T3c e5 has no EFFECTIVE defenders", effective_defenders(b, chess.E5) == [])
check("T3d why_capturable(e5)=='defender_pinned'", why_capturable(b, chess.E5) == "defender_pinned")
check("T3e SEE Nxe5 == +1 (recapture illegal)", see_capture(b, chess.Move.from_uci("f3e5")) == 1,
      f"={see_capture(b, chess.Move.from_uci('f3e5'))}")

# T4 trapped piece (Bxa7 b6! trap: bishop's only squares b8/b6 are both bad)
b = chess.Board("r3k3/B1p5/1p6/8/8/8/8/4K3 w - - 0 1")
check("T4 Ba7 is trapped", is_trapped(b, chess.A7))

# T5 back-rank mate
b = chess.Board("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1")
b.push_san("Ra8#")
check("T5a position is mate", b.is_checkmate())
check("T5b back_rank_mate True", is_back_rank_mate(b))

# T6 mate threat: black to move, white threatens Rd8#
b = chess.Board("6k1/5ppp/8/8/8/8/5PPP/3R2K1 b - - 0 1")
mt = mate_threat(b)
check("T6 mate_threat finds Rd8#", mt == chess.Move.from_uci("d1d8"), f"={mt}")

# T7 discovered attack: Nd4 moves, Rd1 newly attacks Qd8
b = chess.Board("3qk3/8/8/8/3N4/8/8/3R2K1 w - - 0 1")
da = discovered_attacks(b, chess.Move.from_uci("d4f5"))
check("T7 discovered Rd1->Qd8", (chess.D1, chess.D8) in da, f"={[(chess.square_name(a), chess.square_name(t)) for a,t in da]}")

# T8 pin created: Bf1-b5 pins Nc6 to Ke8
b = chess.Board("4k3/8/2n5/8/8/8/8/4KB2 w - - 0 1")
pc = pins_created(b, chess.Move.from_uci("f1b5"))
check("T8 pin created on c6", pc == [chess.C6], f"={[chess.square_name(s) for s in pc]}")

# T9 skewer: black queen fled a5->d4 off the a-file, Rxa8 wins knight behind it
b = chess.Board("n6k/8/8/8/3q4/8/8/R3K3 w - - 0 1")
check("T9 skewer detected", is_skewer(b, chess.Move.from_uci("a1a8"), chess.Move.from_uci("a5d4")))

# T10 material diff
b = chess.Board("k7/8/8/8/8/8/8/K2R4 w - - 0 1")
check("T10 material_diff white +5", material_diff(b, chess.WHITE) == 5)

fails = [r for r in results if not r[1]]
print(f"\n{len(results)-len(fails)}/{len(results)} passed")
if fails:
    raise SystemExit(1)
```

---

## 11. Integration order (do these in sequence)

1. **Audit** (§0.1). Identify language, engine call site, classification site.
2. **Engine data**: ensure one MultiPV-3, depth ~20 analysis per position is stored with full PVs; map `A_before`/`A_after` per move as in §2.1. (If the app currently re-searches or stores only `bestmove`, fix this first.)
3. **Add the detectors module** (§4 verbatim if Python; §9 port if JS).
4. **Make the acceptance suite pass** (§10). Do not proceed until 21/21.
5. **Wire `explain_bad_move`** into the Inaccuracy/Mistake/Blunder message path; **wire `explain_good_move`** into Best/Excellent and into every `better_was` clause.
6. **Switch classification to Δwin% + blunder gate** (§2.2–2.4) if the current code compares raw centipawns.
7. **Priority ladder + templates** (§7–8). Replace the old shallow strings.
8. Optional, in this order: **Miss** label → **positional layer** (§6.5) → **Great/Brilliant** heuristics.
9. Do NOT add an LLM layer now (costs money; the template output above is the Chess.com-style product).

### Definition of done
- A move that hangs a piece → names the piece, square, and capturing move.
- A move losing to a pinned defender → produces the T3-style sentence.
- A move allowing a fork/mate/mate-threat → names it with the opponent's move.
- A quiet inaccuracy → positional fragment or the comparative fallback; never an invented tactic.
- Every emitted square/piece/motif is traceable to a detector result (log the fact object alongside the message during QA).

---

## 12. DO-NOT list (common failure modes)

- Do NOT claim a motif without its detector firing on the real position.
- Do NOT explain from the played move's surface features — walk the refutation/PV.
- Do NOT compare raw centipawns across positions; convert to win% first; never show cp to users.
- Do NOT use `is_hanging` to evaluate captures or exchanges — that's `see_capture`'s job.
- Do NOT mix POV. Every score → `pov(mover)` before any math.
- Do NOT forget en passant (`piece_at(to_square)` is `None`) and promotions (SEE treats them approximately — acceptable; note it in code).
- Do NOT call `is_trapped` unless it's the trapped piece owner's turn; do NOT call `mate_threat` when the side to move is in check.
- Do NOT trust PVs from depth < 12 or truncated `info` lines; keep the deepest completed depth per MultiPV.
- Do NOT emit more than primary fact + `better_was`.

---

## 13. References (background, not required to implement)

- Chess.com move classification (expected-points table): support.chess.com/en/articles/8572705 · Game Review explanation engine: chess.com/news/view/chesscom-releases-new-game-review
- Lichess win%/accuracy math: lichess.org/page/accuracy · source: `lichess-org/lila` (`WinPercent.scala`, `Advice.scala`)
- Motif-detector origin (battle-tested on millions of puzzles): `ornicar/lichess-puzzler` → `tagger/cook.py`, `tagger/util.py` (the detectors in §4 follow its semantics; note its `overloading()` is a non-functional stub — do not port that one). License note: lichess code is AGPL — the §4 code is a clean reference implementation of the *algorithms*, verified independently.
- SEE algorithm: chessprogramming.org/Static_Exchange_Evaluation
- python-chess: python-chess.readthedocs.io · chess.js: github.com/jhlywa/chess.js · Stockfish WASM: github.com/nmrugg/stockfish.js
- Research basis: Jhamtani et al. ACL 2018 (P18-1154); Zang et al. ACL 2019 (arXiv:1909.10413); **Kim et al. NAACL 2025 "Concept-guided Chess Commentary" (arXiv:2410.20811)** — validates exactly this architecture: deterministic concept extraction → prioritized facts → (optional) language polish; Maia (arXiv:2006.01855) for future rating-aware explanations.
