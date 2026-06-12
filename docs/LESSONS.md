# LESSONS — anti-patterns distilled from real mistakes

Format: NEVER/ALWAYS X, because Y happened on DATE. New entries come from
JOURNAL compression (/reflect) or a burn worth permanent immunity (/work
step 8). Delete a lesson only when its rule is enforced by code/tests.

- **NEVER add a fallback that narrates the eval bar.** The V1 disease was an
  eval-speak fallback template; V2 has structurally no such path and the gate
  regex-bans it. (pre-2026-06-11, CLAUDE.md R1–R5)
- **ALWAYS audit the harness before "fixing" the code when a metric looks
  catastrophic.** Pin recall "jumped" 21%→80% on 2026-06-11c purely from a
  recall-harness fix (line-wide credit); zero detector changes.
- **NEVER trust prose about code constants — read the constant.** GM-3 audit
  (2026-06-12): the queue note claimed ONLY_MOVE_GAP=25; the code says 10.
- **NEVER trust a crafted FEN until the engine + chessops confirm the whole
  story.** 2026-06-12 bootstrap: the Légal-trap fixture was authored missing
  Black's f8-bishop; the engine immediately rated ...Bxd1 "best" because
  Kf8! escaped the mate. The verification step caught the misread — a fixture
  that fails verification is a misread position; re-derive it, never force it.
- **NEVER freeze eval/test expectations from a DIFFERENT engine context.**
  2026-06-12 bootstrap: 3...Bg4 classified inaccuracy in the gate's
  game-sequence context but good in the eval's context (hash carryover at
  fixed nodes); a case that punishes borderline verdict tiers is
  mis-specified. Spec `expectClass` tolerantly; judge the COMMENT.
- **A named-positions EPD map is not "book" ground truth.** chess.com marks
  ~6 more book moves; external truth (masters explorer) needed (2026-06-12i).
  Corollary: network features must be verified in a real browser — the dev
  sandbox proxy silently blocks endpoints.
- **NEVER let copyrighted source text into the repo.** Book text stays in
  /tmp, patterns recorded in our own words with page refs (SOURCES.md v3
  contract, 2026-06-12g).
