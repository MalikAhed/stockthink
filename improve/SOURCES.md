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

## Mining protocol (one MINE unit)

1. Pick the next unmined chunk from the chunk queue below.
2. `pdftotext -f A -l B ~/think-like-a-super-gm-*.pdf -` (or sed ranges on
   /tmp/supergm.txt) — read ONLY that chunk.
3. Extract ≤3 pattern candidates in the format above, status `mined`.
   A good candidate is *checkable by our pipeline* (board-detectable trigger +
   engine-confirmable). Pure psychology ("don't rush") is queue-worthy only if
   it maps to a checkable behavior (e.g. "moved the same piece twice for no
   tactical reason").
4. Mark the chunk done. That's the whole unit — building comes later, as
   separate BUILD units, top of queue first.

## Chunk queue (book)

- [ ] B1 §4.1 The Candidate Move (pp. 372–374)
- [ ] B2 §4.2 The Art of Falsifying (pp. 374–379)
- [ ] B3 §4.3 Why Can't I Play Like a Super-GM? (pp. 379–392)
- [ ] B4 §4.5 How Many Moves Ahead (pp. 395–401)
- [ ] B5 §4.6 Grandmaster Secrets (pp. 401–416)
- [ ] B6 §1.6 Tips for Solving the Puzzles (pp. 27–29)
- [ ] B7–B18 Puzzle solutions, 4 positions per chunk (pp. 37–314) — mine the
      GM-vs-club-player *differences* (what the GM checked that the club
      player didn't) + harvest each position as a candidate fixture
- [ ] B19 Part V Eyetracker conclusions (pp. 448–456)

## Mined queue

(empty — first MINE unit starts at B1)
