# SOURCES — the pattern-mining queue (workflow v3)

The v3 principle (the user's contract, never violate it):
**a source gives the PATTERN, Stockfish confirms it applies in the position —
only then do we say it, in a GM's voice.** Never quote a source as authority
on a concrete position; never copy source prose into this public repo —
patterns are recorded in our own words with a short reference.

## Source registry

| id | Source | Where | Mine for |
|---|---|---|---|
| GM | *Think Like a Super-GM* (Adams/Hurtado, QC 2022) | PDF: `~/think-like-a-super-gm-9781784831677-9781784831684_compress.pdf` · text: `pdftotext` it to `/tmp/supergm.txt` (NOT into the repo — copyright) | thought-process patterns (Part IV pp. 372–416), GM phrasing voice, 48 puzzle positions as fixtures with verbalized GM reasoning |
| CPW | chessprogramming.org | WebFetch per item | detector algorithms, evaluation patterns |
| LIP | lichess puzzle DB | `scripts/puzzles/fetch-fixtures.mjs` | ground-truth fixtures per theme (recall tests) |
| CCT | `docs/knowledge/chesscom-templates.md` | repo | target phrasing |

## Pattern item format (append under "Mined queue")

```
### GM-7 <short name>                    [mined | speced | built | proven]
Pattern: <one sentence, OUR OWN WORDS — when X, Y tends to be good/bad>
Exceptions: <when the pattern does NOT apply — mine these too, they become guard conditions>
Source: GM p.NNN (§4.2) — paraphrase only
Confirm-gate: <what Stockfish must show in-position before we voice it
              (e.g. winDrop threshold, SEE sign, PV containing the motif)>
Voice: <target sentence skeleton, GM register>
Fixture: <FEN or puzzle ref that must trigger it + one that must NOT>
```

An item is **proven** only when: detector + confirm-gate + template + both
fixtures (fires / correctly stays silent) are green AND the e2e gate passed.

## Context rules (non-negotiable — they keep 700 pages from poisoning sessions)

1. **The book is read ONCE per chunk, ever.** A MINE unit distills its chunk
   into this file and checks it off; no session re-opens a done chunk. PATTERN
   and BUILD units read SOURCES.md items only — NEVER the book.
2. **One chunk per MINE unit, ≤15 pages.** Never "read ahead", never read the
   whole book, never bulk-convert it to markdown (that's just a second
   700-page context bomb, with mangled diagrams).
3. **Diagrams**: `pdftotext` for prose. When a fixture needs a board position,
   Read the specific PDF page(s) visually (the Read tool renders pages),
   transcribe to FEN, and the test MUST verify the FEN parses legally with
   chessops AND that the book's key move is legal in it — a fixture that fails
   either check is a misread diagram: re-read the page, don't guess.
4. **No memory of the book.** Every pattern carries its page ref; if a later
   session doubts a pattern, it re-reads those 1–2 pages — it never recalls
   the book from model memory. Anything voiced to users still has to pass the
   confirm-gate, so even a misread pattern cannot produce wrong commentary.
5. **Anti-mess dedupe.** Before adding a pattern item, grep
   `docs/knowledge/concept-taxonomy.md` + `src/concepts/facts.ts`. If we
   already detect it, the item becomes `AUDIT: <existing detector> vs GM
   pattern` (tighten gate/voice/exceptions) — NOT a new detector. Expect most
   book patterns to land as audits; new code is the exception.
6. **Backlog cap.** Max **6 unbuilt** (`mined`/`speced`) items in the queue.
   At the cap, MINE units are forbidden — build down first. Mining the whole
   book before building it = 50 stale patterns and spaghetti.

## Mining protocol (one MINE unit)

1. Pick the next unmined chunk from the chunk queue below (skip if at the
   backlog cap — do PATTERN units instead).
2. `pdftotext -f A -l B ~/think-like-a-super-gm-*.pdf -` (or sed ranges on
   /tmp/supergm.txt) — read ONLY that chunk.
3. Extract ≤3 pattern candidates in the format above, status `mined`, each
   with its page ref. A good candidate is *checkable by our pipeline*
   (board-detectable trigger + engine-confirmable). Pure psychology ("don't
   rush") is queue-worthy only if it maps to a checkable behavior (e.g.
   "moved the same piece twice for no tactical reason"). Run the rule-5
   dedupe on each.
4. Mark the chunk done (date it). That's the whole unit — building comes
   later, as separate PATTERN units, top of queue first.

## Chunk queue (book)

- [x] B1 §4.1 The Candidate Move (pp. 372–374) — mined 2026-06-12 → GM-1/2/3
- [x] B2 §4.2 The Art of Falsifying (pp. 374–379) — mined 2026-06-12 → GM-4/5
- [x] B3 §4.3 (pp. 379–392, Carlsen–Nakamura Kh2 study + think-alouds) — mined 2026-06-12 → GM-6/GM-7
- [x] B4 §4.5 (pp. 395–401, Storey–Crouch Bd1 study) — mined 2026-06-12 → GM-8/GM-9
- [x] B5 §4.6 (pp. 401–416, Puzzle 33 tail + Puzzle 34 "bayonet attack" think-alouds) — mined 2026-06-12 → GM-10/GM-11/GM-12 (GM-12 proven same session)
- [x] B6 §1.6 Tips for Solving the Puzzles (pp. 27–30) — mined 2026-06-12 →
      GM-13 (rest is book logistics: scoring/pacing; "points for 2nd/3rd best
      move" dedupes to GM-1)
- [ ] B7–B18 Puzzle solutions, 4 positions per chunk (pp. 37–314) — mine the
      GM-vs-club-player *differences* (what the GM checked that the club
      player didn't) + harvest each position as a candidate fixture
- [ ] B19 Part V Eyetracker conclusions (pp. 448–456)

## Mined queue

### GM-1 second-candidate contrast                                   [proven]
Pattern: strong players weigh a small shortlist of candidate moves; a move
  that was on the engine's own shortlist but not its top pick deserves
  candidate framing ("a natural candidate, but…"), not generic criticism or
  generic praise.
Exceptions: not when the drop is mistake/blunder-sized (≥10) — being PV2 at
  a huge gap isn't "shortlist company"; not when the move IS the best.
Source: GM pp. 372–374 (§4.1) — GMs shortlist candidates via pattern
  recognition, then pick between them.
Confirm-gate: played move == first move of engine MultiPV line 2 AND
  winDrop < 10 AND move != best.
Voice: "One of the main candidate moves here — only {best} promised a bit
  more." / on an inaccuracy: "A natural candidate, but it falls just short."
Fixture: synthetic-lines unit (played==lines[1][0], drop 6 → fires; drop 15
  → silent; played==best → silent) + gate e2e read-through.
Proven 2026-06-12: fact `second_candidate` (annotate.ts, gate winDrop<10) +
  composer weaving (neutral-pool replacement on good moves, verdict softener
  on inaccuracies). Gate shows it live on Opera Game 8.Nc3.

### GM-2 hard-to-find best move                                      [proven]
Pattern: in complex/irrational positions even GMs take 4× longer and club
  players find the best move only ~40% of the time — a missed best move that
  was "unnatural" (quiet move, sacrifice, retreat) deserves softened
  criticism; finding it deserves escalated praise.
Exceptions: obvious recaptures/checks are never "hard to find".
Source: GM pp. 373–374 (§4.1).
Confirm-gate: needs a board-checkable "unnatural" predicate (sacrifice via
  SEE<0, retreat, quiet non-capture non-check while tactics are on) — spec
  in a PATTERN unit. AUDIT overlap: `only_move` fact + brilliant/great
  classifications already cover part of this; extend their voice, don't
  duplicate.
Fixture: quiet Qf6 mate-threat miss fires; checking mate move Rd8# stays
  silent (annotate.test.ts).
Proven 2026-06-12 (miss side): fact `hard_to_find` — best move quiet (no
  capture/check/promotion, EP-aware) + a missed_* tactic at MISS_GATE →
  softener appended to the verdict. Gate shows it on Blackburne 7.Be2 (missed
  quiet pin Qe2). Praise side proven 2026-06-12: context fact `quiet_strength`
  (played==best, winDrop≤2, no capture/check/promo, carries a confirmed
  creates_fork/creates_pin/traps_piece/mate_threat) → "A quiet move with
  teeth — the kind most players never even consider. Well spotted." 

### GM-4 falsify-before-committing coaching                          [proven]
Pattern: strength correlates directly with time spent trying to REFUTE your
  own candidate move (GMs ~85% of thinking time; club players ~38% and they
  only check confirming lines). When a move with a clear point fails to a
  concrete reply, coach the habit: name the test the move had to pass.
Exceptions: don't preach on inaccuracies (drop <10) or when no concrete
  refutation fact exists — the coaching must point at a real, engine-verified
  reply, never at a vibe.
Source: GM pp. 374–377 (§4.2); Lasker's "when you see a good move, look for
  a better one" (public domain) quoted there.
Confirm-gate: classification mistake/blunder AND ≥1 purpose fact (the move
  had an idea) AND a bad fact carrying a concrete reply (hangs_piece.capture
  / refutation.moves[0] / allows_mate.firstMove).
Voice (in "explain more"): "The test this move had to pass was {reply} —
  strong players spend most of their time looking for exactly this kind of
  answer before committing."
Fixture: compose unit — purpose+hang mistake → coaching line appears; same
  facts at inaccuracy → absent.
Proven 2026-06-12: composer 'explain more' on mistake/blunder with ≥1 purpose
  fact + concrete reply (allows_mate.firstMove > hangs_piece.capture >
  refutation[0] by priority sort). Live on Blackburne 5.Nxf7 (Qxg2) and
  7.Be2 (Nf3#), Opera 15.Bxd7+ (Nxd7).

### GM-5 Lasker frame for Miss                                       [proven]
Pattern: weaker players stop at the first good-looking move; GMs keep looking
  for a better one. A move that keeps the win but skips a clean knockout is
  the classic case.
AUDIT: the `miss` classification + missed_* facts already detect this —
  extend the miss-class voice with the Lasker frame ("A good move — but the
  position offered more: …"), don't add detection.
Source: GM pp. 377–379 (§4.2, "relentless determination").
Proven 2026-06-12: miss without a concrete bad cause leads with "A decent
  move on its own — but the position offered more." before the missed fact.

### GM-3 single-candidate positions                                  [proven]
Pattern: when one candidate towers over the rest, the position is critical —
  say so ("the position demanded exactly this").
AUDIT: `only_move` fact already detects this (gap ≥25 between PV1/PV2,
  annotate.ts:322) — audit its threshold + voice against the book framing
  rather than adding anything new.
Source: GM pp. 372–373 (§4.1).
Proven 2026-06-12 (audit): ONLY_MOVE_GAP=10 win% confirmed sane (book:
  towering candidate = critical moment); voice now opens with "The position
  demanded exactly this". Note: earlier queue note said gap 25 — actual is 10.

### GM-6 quiet improving move / remove-the-checks                    [proven]
Pattern: when you stand better but nothing forcing works, the strongest move
  is often a quiet one that improves your worst-placed piece or removes the
  opponent's resources (especially CHECKS) — "putting the ball in the
  opponent's court". Club players fixate on forcing candidates (all four
  sub-GM solvers shortlisted only Qg5/Ne5/Qe7-type moves first); the GM chose
  Kh2 because every defensive line for the opponent leaned on a check.
Exceptions: not when a concrete tactic exists (missed_* facts take priority);
  not in lost positions (improving doesn't apply when you must act).
Source: GM pp. 383–392 (§ Puzzle 32, Carlsen–Nakamura Baerum 2018, Adams
  "Deeper Analysis"; think-aloud panel comparison).
Confirm-gate: engine best is a quiet non-forcing king move (no capture/check/
  promotion) AND the opponent's checking moves count drops to 0 after it AND
  mover is better (beforePov ≥ 55). Detector: count opponent checks before/
  after best move. AUDIT overlap: GM-2 hard_to_find requires a TACTICAL_MISS
  fact, so quiet-positional misses never soften — extend there.
Voice: "Not every strong move attacks — {best} quietly takes away every
  check and leaves all the hard decisions to your opponent."
Fixture: needs the book diagram FEN (visual page read, p. 384) or a crafted
  position: quiet Kh2 removing Qa7+/Qf2 resources fires; same position with
  a winning tactic available stays silent.
Proven 2026-06-12: MissedIdea variant `removes_checks` in the missed_idea
  machinery (annotate.ts): best is quiet non-castle king move, mover ≥55%
  before, opponent checking-move count goes ≥1 (after played) → 0 (after
  best). Crafted Kh2 fixtures (rook: fires / queen keeps Qg3+: silent).
  Voice via ideaClause: "quietly taken away every check, leaving all the
  hard decisions to your opponent." Residual: GM-2 hard_to_find still skips
  quiet-positional misses (needs non-tactical softener decision).

### GM-7 walks away from its job                                     [proven]
Pattern: a move can fail not by what it does but by what it STOPS doing —
  Adams rejects 1.Ne5?! because the knight on g4 "has an important defensive
  influence, keeping f2 under control"; after it leaves, ...Qf2 infiltrates.
  When a mistake's refutation lands on a square the moved piece used to
  cover from its old square (and no longer does), say that: the piece
  abandoned its defensive duty.
Exceptions: only when the refutation CONCRETELY uses the abandoned square
  (engine reply PV move lands there); never for pawns (they don't have
  "duties" in this sense); skip if the square is still covered by another
  defender.
Source: GM pp. 387–388 (§ Puzzle 32 analysis, 1.Ne5?! refutation).
Confirm-gate: classification ≥ mistake AND refutation/reply first move's
  TO-square was attacked by the moved piece from its origin square but not
  from its destination AND no other friendly piece now covers it.
Voice: "The {piece} had a job on {from} — covering {square} — and this move
  walks away from it; {reply} steps straight into the gap."
Fixture: crafted: knight leaves the only cover of f2, Qf2 infiltrates →
  fires; same but a bishop still covers f2 → silent.
Proven 2026-06-12: fact `abandons_square` (priority 3.5, BAD_KINDS) — reply
  PV lands on an empty square the moved piece covered exclusively from its
  old post and nobody covers now. Voice: "The knight had a job on g4 —
  covering f2 — and this move walks away from it; Qf2 steps straight into
  the gap." Both fixtures green; gate unchanged (no false fires).

### GM-8 backwards moves are the hardest to spot                     [proven]
Pattern: retreating moves ("a strong backwards move, notoriously difficult
  to spot... a long-range tactical idea on a crowded board") deserve the
  same softened criticism as quiet moves when missed — 1.Bd1! was "commonly
  missed" even by strong solvers.
AUDIT: GM-2 `hard_to_find` covers quiet misses only — add a `reason` field
  ('quiet' | 'retreat'): retreat = best move travels toward the mover's back
  rank, same tactical-miss + MISS_GATE gates; retreat-specific voice.
Source: GM pp. 397–398 (§ Puzzle 33, Storey–Crouch Durham 1998).
Voice: "To be fair, {best} is a backwards move — the kind even strong
  players overlook."
Proven 2026-06-12: hard_to_find.reason quiet|retreat (retreat = toward own
  back rank, non-king); Ra1 mate-miss fixture; Blackburne Qe2 stays quiet.

### GM-10 strike-while-ahead pawn break (bayonet)                     [mined]
Pattern: when you lead in development and the opponent is underdeveloped, the
  strongest move is often a PAWN BREAK that opens lines toward the enemy king
  ("this is the time to strike — less urgent continuations cost a large part
  of the advantage"); a quiet developing move squanders the initiative.
Exceptions: only when a real development lead exists AND the pawn break opens
  a file/diagonal pointing at the enemy king; never in equal/worse positions
  (where opening lines cuts both ways); concrete tactics still take priority.
Source: GM pp. 409–410, 416 (§4.6, Puzzle 34 Adams Insight, 1...g5! bayonet).
Confirm-gate (spec in a future PATTERN unit): mover has a develops/lead edge
  AND engine best is a non-capturing pawn advance AND it opens a file or
  diagonal whose far end bears on the enemy king zone AND a slower developing
  alternative drops a meaningful slice of eval. AUDIT overlap: missed_idea
  positional + opens_line; likely extends missed_idea with an 'open_lines'
  lead-in rather than a new fact.
Voice: "The time to strike was now — {best} tears open lines toward the king
  before the defender can untangle."
Fixture: book diagram (visual read p. 410) or crafted: dev-lead + ...g5 opening
  the g-file toward a congested white king fires; same break with no king
  target / no dev lead stays silent.

### GM-13 calibrated human eval vocabulary                            [mined]
Pattern: the book gives a calibrated translation from engine eval ranges to
  human verdict language (±0.09 equal/drawn · to 0.29 "more pleasant, nothing
  serious" · to 0.59 "slightly better / pawn up with compensation" · to 0.89
  "significantly better" · to 1.39 "significant to large, not decisive" · to
  2.49 "substantial, probably winning" · 2.5+ "clearly winning"). Wherever we
  voice who stands better (Spotlight intros, lineOutcome, summaries), the
  wording should match this scale — never stronger or weaker than the eval
  supports, and never the number itself (R1).
Exceptions: mate scores are their own vocabulary; volatile/sharp positions may
  deserve a hedge (ties to the volatility flag in Later).
Source: GM p. 30 (§1.6, evaluation-points table) — paraphrased scale.
Confirm-gate: AUDIT, not a detector — sweep existing verdict phrasing
  (compose/templates, walkthrough captions) against the scale; any place we
  say "winning/much better/slightly better", the underlying eval bucket must
  match. Add a shared evalVocabulary(cp) helper if phrasing is ad hoc.
Voice: per-bucket phrases above, our own words.
Fixture: unit test mapping cp values to buckets + gate read-through (no
  caption claims "winning" below the 1.4 bucket, etc.).

### GM-11 the guarded target — count defenders before lunging          [mined]
Pattern: a tempting piece lunge onto a square that is already defended is a
  mirage; the resourceful idea first removes or targets the DEFENDER (Puzzle 34:
  every solver blurted 1...Ng4 then retracted — "h2 is guarded" by Nf3 — and the
  real plan 1...Ne4 attacks the f3 defender). Name the defender the attack had
  to clear.
Exceptions: only when the lunge's target is genuinely held (SEE-losing for the
  attacker) AND the engine best concretely attacks/removes that defender;
  never when the target was already winnable.
Source: GM pp. 407–408 (§4.6, Puzzle 34 think-aloud transcripts).
Confirm-gate (spec later): played/inaccuracy move attacks a square whose
  capture is SEE-bad because of one identifiable defender AND engine best's
  first move attacks or captures that defender. AUDIT overlap: this is the
  deflection / capturing-the-defender family (TODO R17 overload, R18
  deflection, DS1 capturingDefender theme) — build there, not as a new fork.
Voice: "The {square} only looked loose — {defender} guards it; {best} goes
  after the guard first."
Fixture: crafted: knight lunge onto a square held by one defender (SEE<0),
  best attacks that defender → fires; target with no defender → silent.

### GM-12 pawn moves are the hardest miss of all                      [proven]
Pattern: novices base attacks on piece play and "will not suspect that a pawn
  move can have such strength" — a missed best move that is a quiet pawn
  advance deserves the same softened criticism as a quiet piece move or a
  retreat (GM-2/GM-8 family).
AUDIT: extends GM-2 `hard_to_find` — its reason field gains 'pawn_break'
  (best is a non-capturing pawn advance; a pawn never retreats, so it
  short-circuits the retreat/quiet split). Same MISS_GATE + tactical-miss
  gates, pawn-specific voice. No new detector.
Source: GM pp. 415–416 (§4.6, Puzzle 34 Phil's commentary + Adams Insight).
Proven 2026-06-12: facts.ts reason union + annotate.ts reason computation
  (bestRole==='pawn' → 'pawn_break') + template "a quiet pawn move — few
  players suspect a pawn push can hit this hard." Fixture: missed f6 (threatens
  Qxg7#, supported by the f6 pawn) → fires pawn_break; quiet Qf6 stays 'quiet',
  retreat Ra1 stays 'retreat'. Gate green, full suite 227.

### GM-9 meet the threat indirectly                                   [proven]
Pattern: when a piece is attacked, club players reach for defense/retreat;
  the strong choice often IGNORES the threat and creates a bigger one
  (Adams: "meeting the threat to the knight indirectly, by attacking one of
  Black's pieces, may have been another factor in this being widely
  overlooked"). When the missed best move does this, name the lesson.
Exceptions: only when the threat was real (attacked piece, SEE-losing) AND
  the best move's counter-threat is engine-line confirmed (existing
  tempoConfirmed / trap machinery); never when best simply defends.
Source: GM pp. 397–398 (§ Puzzle 33 analysis).
Confirm-gate: a mover piece is attacked before the move AND best move
  neither moves nor defends it AND best creates a confirmed tempo/trap/fork
  → missed_idea lead-in variant ("instead of defending, it answers the
  threat with a bigger one").
Fixture: crafted: knight attacked, best traps a rook instead of retreating
  → fires; best retreats the knight → silent.
Proven 2026-06-12: MissedIdea `counterattack` (unshifted to lead) when a
  mover piece is in a bad spot, best neither moves nor defends it, and a
  confirmed wins_tempo idea exists. Voice: "answered the threat to the
  knight with a bigger one". Fixtures: Bg5-vs-queen fires / Ne4 escape silent.
