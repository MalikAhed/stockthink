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
- [ ] B3 §4.3 Why Can't I Play Like a Super-GM? (pp. 379–392)
- [ ] B4 §4.5 How Many Moves Ahead (pp. 395–401)
- [ ] B5 §4.6 Grandmaster Secrets (pp. 401–416)
- [ ] B6 §1.6 Tips for Solving the Puzzles (pp. 27–29)
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
  quiet pin Qe2). RESIDUAL: praise side (escalate brilliant/great voice when
  the PLAYER finds a quiet tactical move) — needs quietness fact on played
  moves; queue as PATTERN follow-up.

### GM-4 falsify-before-committing coaching                           [mined]
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

### GM-5 Lasker frame for Miss                                        [mined]
Pattern: weaker players stop at the first good-looking move; GMs keep looking
  for a better one. A move that keeps the win but skips a clean knockout is
  the classic case.
AUDIT: the `miss` classification + missed_* facts already detect this —
  extend the miss-class voice with the Lasker frame ("A good move — but the
  position offered more: …"), don't add detection.
Source: GM pp. 377–379 (§4.2, "relentless determination").

### GM-3 single-candidate positions                                   [mined]
Pattern: when one candidate towers over the rest, the position is critical —
  say so ("the position demanded exactly this").
AUDIT: `only_move` fact already detects this (gap ≥25 between PV1/PV2,
  annotate.ts:322) — audit its threshold + voice against the book framing
  rather than adding anything new.
Source: GM pp. 372–373 (§4.1).
