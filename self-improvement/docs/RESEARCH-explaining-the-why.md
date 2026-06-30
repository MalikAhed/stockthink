# RESEARCH — Explaining the *why* of a move (true cause + principled silence)

> **Status:** findings + proposed plan (not yet ranked into BACKLOG, not yet built).
> **Date:** 2026-06-30. **Source:** deep-research workflow `wf_8ef3857a-393`
> (39 agents — 5 code audits + 6 web angles + 3-vote adversarial verification + synthesis;
> ~949k tokens). Every load-bearing *code* claim re-verified by hand against the repo
> (file:line below). External claims carry a verification status in **Sources**.
> **Owner's call:** the recommendation in §5 is the lead engineer's, not the workflow's.

This doc answers one question the user raised: *the explanations sometimes assert a
plausible-but-fake reason (a "pin" that isn't the real cause), and they never know when
to shut up.* It diagnoses both, surveys how the world solves them, and lays out a
$0 / client-side / zero-friction plan to fix them day by day.

---

## 1. Verdict (TL;DR)

There are **two distinct diseases**, and they need **two distinct cures**:

- **Pain (a) — fake reasons.** Every positive/positional fact is born from **static board
  geometry with no eval-attribution**. The "confirm" gates only prove the tactic *survives*
  the opponent's reply, never that it *causes* the eval. → **Cure A: ground every spoken
  fact against the engine's *own* line** (a fact may lead only if its square is on the PV the
  engine actually plays).
- **Pain (b) — can't stay silent.** Abstention fires **only on fact *absence***, never on
  fact-*irrelevance* or low confidence. There is no confidence signal, no badge-only output,
  no "too deep to name" state. → **Cure C: a dual-gate confidence/silence layer** (speak only
  when one cause is **grounded ∧ dominant ∧ stable**, else show the badge).

**Recommended architecture: `C + A` as the spine** (both are *free* — no extra engine calls,
no model, no WebGPU), **`B` (counterfactual ablation) as a surgical scalpel** for the few
highest-stakes disputed leads, **`D` (local WebLLM phrasing) deferred** and strictly additive.

**The non-obvious keystone:** none of this moves the number unless we **fix the metric
first**. Today `score.ts` rewards the neutral filler line **2/2** and hands out a free
**1/2** for grounding just for not tripping a blocklist (`score.ts:166-168`). Fix the pains
without fixing the metric and the work looks like a *regression*. **Phase 0 = methodology.**

---

## 2. The two diseases, diagnosed (verified against the code)

### Pain (a): fake reasons — geometry masquerading as cause
- `report.ts:99-106` builds the fact context with `evalBefore/After`, `winDrop`, `bestUci`,
  the **before** multiPV `lines`, and `replyPv: after.lines[0].pvUci`. **`shallowEval` and
  `after.lines[1..2]` are dropped at the door** — the mover's own best continuation is never
  cross-checked against the fact.
- `annotate.ts` pushes `creates_pin / creates_fork / wins_tempo / positional` from **static
  geometry**. The confirm gates prove *survival, not causation*:
  - `pinSignificance` (`annotate.ts:184-239`) keeps a pin via `attackers > defenders`
    (`:198-199`, pure counting) and the **quiet absolute pin** branch (`:231-236`, *no engine
    line consulted at all*). Its PV probe (`:201-227`) only checks the **opponent's reply**
    doesn't dissolve the pin.
  - `forkConfirmed` / `tempoConfirmed` (`:249-298`) only verify the opponent's single reply
    reacts; they never compare against a no-tactic baseline.
- `compose.ts:135` then takes the **priority-sorted head** as the spoken cause
  (`badFacts.find(... !== 'regression') ?? badFacts[0]`); good moves take the first
  non-positional purpose fact (`:172-177`). So on a near-zero-`winDrop` good move, a
  **coincidental** pin (priority 15) or a geometric "develops" becomes the headline even
  though Stockfish chose the move for something else. **This is the fake "a pin."**

### Pain (b): can't stay silent — abstention only on absence
- There is **no confidence field on a `Fact`**, no badge-only return, no "reason too deep"
  state. Silence happens *only* when no fact fires.
- When `winDrop` is real but nothing nameable fired (diffuse squeeze / long prophylaxis),
  control falls to a **position-blind `NEUTRAL` pool indexed by ply parity**
  (`compose.ts:192-193`: `pool[Math.floor(m.ply/2) % pool.length]`) or `"<best> was stronger
  here."` (`:153`). It cannot tell *"nothing to say"* from *"the real reason is a 15-ply bind."*
- The **one signal that could detect this is already computed and thrown away:**
  `shallowEval` (`engine.ts:66,152`), documented as the `|shallow − deep|` volatility margin
  from arXiv:2412.17948 (`engine.ts:60-63`) — `grep` finds it referenced **nowhere else in
  the codebase**. `UCI_ShowWDL` is **not enabled** (zero `wdl` hits in backend) though the
  binary advertises it.

### The metric is blind (why Phase 0 is first)
- `score.ts` scores 3 dims 0-2: CAUSAL / GROUNDED / ECONOMY.
- `:166` GROUNDED = `forbiddenHits>0 || !classOk ? 0 : factsOk && leadOk ? 2 : 1` — a **free
  1/2** for merely not hitting a blocklist substring; no *positive* grounding required.
- `:168` ECONOMY = `falseAlarm ? 0 : sentences<=max ? 2 : ...` — the **filler line scores
  2/2**. The header even notes *"composeComment never returns empty text by design (R3)."*
- ⇒ The eval **cannot currently see honesty.** It must change before the cures land.

---

## 3. What the world does (external state-of-the-art)

Convergent finding across products and papers: **prove before you speak, and prefer a badge
to a guess.** Specifics (sources + verification status in §9):

- **Lichess** — classifies purely on **win%-drop** (not raw cp) and shows **no prose at all**:
  badge + engine lines only. This *is* R3 ("say less") as a shipped product. Win% comes from a
  sigmoid fitted to real game data. *(Caveat: the exact threshold scale and accuracy-formula
  constants we found were partly **refuted** on verification — adopt the engine's own WDL or
  re-derive from primary source; don't hardcode the numbers in this doc.)*
- **chess.com Game Review** — classification is win-probability based ("Expected Points");
  prose appears **only when a deterministic pattern fires** (fork / lost piece / mate / idea),
  never from the eval number. Blunder (v2) wants a **concrete material/mate consequence**, not
  just an eval drop. *(Caveats: Expected-Points also takes **player rating** as input — we
  can't perfectly replicate it; the "Brilliant narrow-path" 4th criterion is **unverified**.)*
- **DecodeChess** & **Kim et al. 2025 (Concept-guided Chess Commentary, NAACL)** — both
  independently land on **concept-delta dominance**: compute each concept's value before/after,
  take the arg-max delta, and **only speak when one concept clearly dominates (≥ ~2× the
  second)** — else stay silent. DecodeChess "never emits a claim it cannot probe for."
- **SARFA (ICLR 2020)** & 2025 SHAP piece-ablation — the black-box causal test: **remove the
  feature and re-search**; if the eval/best-move collapses it's causal, if stable it's
  decorative. Needs only engine output — runnable in our WASM pool, rationed.
- **Selective prediction / reject option** (Chow 1957; Geifman–El-Yaniv 2017) — the formal
  frame for "say less": tightening the abstention threshold trades **coverage** for
  **precision**, monotonically. That trade is the *correct* engineering choice here.
- **Keystone correction — Stockfish 16+ deleted the hand-crafted eval.** The `eval` trace is
  now opaque (PSQT + Positional buckets); **there is no named-concept breakdown.** So "attribute
  the swing to king-safety vs mobility from the eval" is **dead**. Concept attribution must come
  only from **(a) our chessops detectors, (b) the refutation PV tactic, (c) material diff** —
  never the eval number.
- **Free in-browser LLM (optional, later)** — WebLLM/WebGPU runs a 1-3B 4-bit model at
  40-180 tok/s (one sentence ≪ 500 ms); **XGrammar enum-constrained decoding** makes a reason
  outside the engine-detected concept set *structurally untokenizable*, with a post-gen audit
  that every cited fact is real. ~83% device coverage; **must be additive, never default.**

---

## 4. The four candidate cures (scored)

| Cure | Idea | Truthfulness | $0/client fit | Effort |
|---|---|---|---|---|
| **A. PV-grounding + refutation forensics** | A fact may lead only if its square is on the engine's *own* relevant PV (mover's best PV for good moves; refutation PV for bad). Demote the ungrounded pin branches. Use `after.lines[1..2]` for "only this punishes it." | High for *on the engine's path*; medium for *the* cause | **Perfect** — reuses lines already searched, no extra calls | Medium |
| **C. Confidence / silence layer** | Govern *when to speak*, not the cause. Wire in `shallowEval` volatility, per-depth trajectory, inverse-multiPV spread, WDL. Below threshold → badge-only. | High for the *withhold* decision; neutral on attribution | **Perfect** — every signal is free / one `setoption` away | Low–med |
| **B. Counterfactual ablation** | For a *disputed* lead only, re-search with the key piece removed; keep the claim only if the eval collapses (SARFA). True causal proof. | **Highest** — an actual perturbation test | Acceptable **if rationed** — spends scarce search budget | High |
| **D. WebLLM phrasing** | Optional enum-constrained local model that *rewords* verified facts; default path works with no LLM. | Neutral-to-+ only if constrained; dangerous if it ever *generates* | Yes in principle, gated on WebGPU + weight download | High |

---

## 5. Recommendation (the lead engineer's call)

**Build `C + A` as the default spine, add `B` surgically, defer `D`. Do Phase 0 first.**

Reasoning, decisively:
- **`C` and `A` together need zero extra engine calls, no model, no WebGPU**, and keep the
  deterministic eval/gate/recall methodology intact — they satisfy *every* hard constraint
  ($0, client-side, zero friction). They make the system **honest by construction**: speak
  only when one grounded cause is dominant and the eval is stable, else show the badge.
- **`C` is nearly free and fixes pain (b) on its own** — `shallowEval` is already computed,
  WDL is one `setoption`, the multiPV spread reuses lines in hand. It also kills the accidental
  filler bugs and gives us the validated **Lichess badge-only tier**.
- **`A` fixes pain (a)** with small, testable diffs in `annotate.ts`/`compose.ts`. "On the
  engine's PV" proves *relevance*, not strict causality — which is a large honesty win over
  today's geometry-only, and good enough to **demote** fake leads to the badge.
- **`B` is the only true causal proof**, but it spends the scarce serialized search budget and
  perturbs hash carryover (determinism drift). So it is a **scalpel** for the exact fake-reason
  class (a pin/fork carrying a near-zero-`winDrop` good move), never the default path.
- **`D` adds polish, not truth.** Build it only after C+A are green and the rubric credits
  silence — otherwise it's cosmetic effort over an unsolved core.

### The proposed pipeline (new stages in **bold**)
```
PGN → engine pool  (+ now carries: WDL · shallowEval · multiPV gap · per-depth trajectory · after.lines[1..2])
    → per-move FACTS            (detectors — unchanged)
    → ★ GROUNDING GATE (Cure A) — a fact may LEAD only if its square is on the engine's own relevant PV
          · good move → mover's best PV (before.lines[0].pvUci)
          · bad move  → refutation PV (after.lines[0].pvUci), first ~3 plies; "only this punishes" needs after.lines[1] worse
          · demote geometry-only pins/forks/positional that fail grounding
    → ★ CONFIDENCE / SILENCE GATE (Cure C) — dual-gate reject-option (§6)
          · pass  → COMPOSE (templates)
          · fail  → BADGE-ONLY  or  "a quiet, long-term improvement"  (never an invented cause)
    → [later, optional] ★ WebLLM enum-constrained phrasing (Cure D) — additive, audited, behind WebGPU
    → ⊹ BUDGETED ABLATION PROBE (Cure B) — only for disputed near-zero-drop leads
```

---

## 5a. Plan pressure-test (2026-06-30, checked against the code)

Before trusting the recommendation, its two load-bearing *empirical* assumptions were verified:

- **Cure A will NOT regress recall — but only if placed correctly.** `recall.test.ts:78-96`
  exercises the **detector predicates directly** (`pinsCreatedEx`, `createsFork`, `isSacrifice`,
  …); the composed comment and `pinSignificance` are **not on the recall path at all.**
  ⇒ **Hard constraint:** the grounding gate lives at **fact lead-selection / compose**, never
  inside the detector predicates. A demoted fact stays in `Fact[]` (falls to "explain more" or
  badge), so it can't headline a fake reason yet still fires for recall. Floors stay green by
  construction (fork 0.95, pin 0.75, sacrifice 0.8…). *Gate it in the detectors and recall
  breaks — this is the landmine.*
- **Cure C's signals are real, not perpetually `undefined`.** `engine.ts:137,152` sets `shallow`
  to the first multipv-1 info line and always returns `shallowEval` on a non-terminal search; the
  `onDepth` hook (`:122,140`) already fires per depth ⇒ the trajectory signal (Phase 1.4) needs
  no new plumbing.
- **One genuine unknown remains:** whether the lite WASM emits `wdl` under `UCI_ShowWDL`, and
  whether multipv ≥ 3 is configured (in `engine.ts` `optionCmds`) for the "no dominant idea"
  spread. Both are covered by the Phase 1.1 runtime-probe + a one-line config check.

**Verdict: no fatal flaw.** The gate-placement constraint is now baked into Phase 2.

---

## 6. The silence rule (dual-gate reject-option)

Compute an **internal confidence** per move (eval-only — never surfaced as prose, R1 stays
green). Speak a **cause** only when **both** gates pass:

- **Gate 1 — magnitude** *(exists)*: the win%-drop ladder. Below the inaccuracy floor on a
  balanced position there's nothing to flag.
- **Gate 2 — grounded ∧ dominant ∧ stable**: the lead fact must be **(i) grounded** (its
  square is on the engine's relevant PV), **(ii) dominant** (for concept claims, one
  concept-delta clearly leads, ≥ ~2× the second — DecodeChess/Kim), **(iii) stable**.

**Force SILENCE / badge-only when (Gate 2 fails):**
- **Eval instability** — `|shallowEval − deepEval|` > ~60-70cp, or a late-flipping per-depth
  trajectory ⇒ static features about to be overturned ⇒ too deep to name.
- **No tactic in the relevant PV** — bad move: no detector fires on the first ~3 refutation
  plies; good move: the fact's square is absent from the mover's best PV.
- **Diffuse multiPV spread** — PV1 ≈ PV2 ≈ PV3 within ε ("many good moves" / "no dominant
  idea") ⇒ naming one cause misleads.
- **Magnitude–concept incoherence** — the lead fact's intrinsic severity is far below what the
  `winDrop` implies (a tiny `invites_capture` "explaining" a 25-pt blunder) ⇒ suppress the
  specific cause, keep the badge.
- **Long horizon-to-payoff** — the only relevant divergence appears only deep in the PV ⇒
  prophylactic/positional squeeze ⇒ badge only.
- **High-draw WDL with cp ≈ 0** ⇒ genuinely equal ⇒ "nothing to say."

**Two distinct honest outputs (not one generic filler):**
1. **"Nothing to say"** — small drop / high-draw / truly equal → badge only, minimal/no line.
2. **"Too deep / no nameable cause"** — real `winDrop` *or* a real best move, but Gate 2 fails →
   badge + at most one principled marker ("a quiet, long-term improvement" / "the engine sees a
   problem here we can't name concretely"), **never an invented concrete reason**.

**Target metric: hold explanation PRECISION near 1.0 and accept whatever COVERAGE that
implies.** Never maximize coverage. The badge is the honest partial answer.

---

## 7. The phased, day-by-day backlog

Each block is one small, shippable, gate-green unit. Phases are ordered by dependency.

### Phase 0 — make the metric able to see honesty *(methodology FIRST)*
0.1 Add a paired **COVERAGE + PRECISION** metric to `score.ts`/`METRICS.md` (coverage =
   prose-explained / moves above inaccuracy; precision = correct explanations / emitted).
0.2 Add a first-class **badge-only / honest-silence** expected outcome to the `EvalCase` schema
   and **stop crediting the NEUTRAL filler 2/2** when badge-only was the honest call.
0.3 Make **GROUNDED a real signal**: a stated tactical cause must correspond to a fact whose
   square is on the engine PV — kill the free 1/2.
0.4 Author 3-4 engine+chessops-verified **aspiration cases for the fake-reason class**
   (coincidental pin/fork/"develops" on a near-zero-`winDrop` good move whose real cause is
   elsewhere), graded on the comment.

### Phase 1 — plumb the free engine signals *(data only, no behaviour change)*
1.1 Enable `UCI_ShowWDL`; parse the `wdl` triple onto `EngineLine`; **runtime-probe** the lite
   WASM actually emits it, fall back gracefully if not.
1.2 Thread `before.shallowEval` through `buildMoveReport` into `AnnotateContext` (dropped today
   at `report.ts:91-95`).
1.3 Stop discarding `after.lines[1..2]`; carry them alongside `replyPv`.
1.4 Capture a cheap **per-depth eval trajectory** (monotonic? last-flip depth?) by wiring the
   existing `onDepth` hook through the pool; pass the full before best-PV.

### Phase 2 — ground every spoken fact against the engine's line *(attack pain a)*
> **Placement constraint (from §5a):** every gate here acts on **fact lead-selection / compose**,
> never on the detector predicates the recall harness calls — a demoted fact stays in `Fact[]`.
2.1 **PV-grounding gate** for good "achieves"/positional leads: require the fact's square within
   N plies of the mover's own best PV, else it drops to "explain more" or is cut.
2.2 **Demote the ungrounded pin branches** (`annotate.ts:198-199`, `:231-236`) unless the pinned
   square also surfaces in the mover's best PV — the documented origin of fake "a pin."
2.3 **Gate bad-move causes on the refutation PV** (named concession in first ~3 plies of
   `replyPv`); assert uniqueness only when `after.lines[1]` is materially worse.
2.4 **Magnitude-coherence guard** in compose: if the lead bad-fact is too small to explain the
   `winDrop`, suppress the specific cause and fall to badge framing.

### Phase 3 — the silence/confidence layer *(attack pain b)*
3.1 Add a **confidence field** on `MoveReport` from volatility (`|shallow−deep|`), trajectory
   stability, depth reached.
3.2 Compute the **inverse-multiPV "no dominant idea"** signal (PV1≈PV2≈PV3 within ε) and a
   **high-draw-WDL "equal"** signal, threaded as facts/flags.
3.3 Add a **first-class badge-only `Comment` return**; route Gate-2 failures to it instead of
   the NEUTRAL pool.
3.4 Replace the position-blind NEUTRAL pool + ply-parity rotation with the **two honest
   outputs**, and deliberately close the accidental empty-string paths.

### Phase 4 — surgical counterfactual proof *(worst fake-reason class)*
4.1 Add a **budgeted SARFA-style single-probe verifier**: for a disputed near-zero-drop
   pin/fork lead, re-search with the key piece neutralised; keep the claim only if the eval/best
   collapses, else demote to badge.
4.2 **Re-verify ablated-position legality with chessops** before trusting it (LESSONS.md
   crafted-FEN burns); cap probes per game to protect budget + determinism.

### Phase 5 — optional grounded phrasing *(additive, never load-bearing)*
5.1 Detect WebGPU; prefetch a 1-3B 4-bit model in a worker; absence → templates unchanged.
5.2 **XGrammar JSON schema** whose `reason` is an enum of detected concept IDs + closed-world
   fact-list prompt + post-gen audit discarding any output citing a non-real fact (R1/R2 stay
   green).

---

## 8. Risks & open questions

**Risks**
- **Metric inversion** — fixing the pains lowers coverage; if Phase 0 is skipped the eval (which
  rewards filler 2/2) reads as a regression. *Phase 0 lands first or the work fails by its own laws.*
- **Unverified engine capabilities** — lite WASM may not emit WDL or a usable eval trace;
  runtime-probe before building. **SF16+ has no named-term eval breakdown** — concept attribution
  from detectors + PV + material only.
- **Determinism drift** — Phase 4 probes change hash carryover at fixed nodes and can flip
  borderline classifications of *other* moves; re-check the whole eval set after edits, ration hard.
- **On-PV ≠ load-bearing** — Phase 2 can still mis-narrate a co-occurring feature on the PV; only
  Phase 4 ablation truly proves causality, and it's budget-limited.
- **Threshold brittleness** — volatility (~60-70cp), multiPV-ε, dominance-2×, N-ply windows are
  device/node-tier sensitive; bad calibration over- or under-silences.
- **Recall/gate regression** — *recall is structurally protected* once the §5a placement
  constraint holds (the harness tests detectors, not the comment). The residual risk is the
  **e2e gate landmarks** (composed comments: delivers_mate, Qb8+ sac) — a too-aggressive silence
  layer could mute those, so re-run `gate.e2e` after every Phase 2-3 block.

**Open questions**
- Does the shipped lite WASM actually emit `wdl`, and any interpretable static `eval` trace?
  *(runtime probe — gates Phase 1.)*
- Per-game ablation **probe budget** that keeps full-game review responsive on a low-end device
  with one serialized engine? How many moves per game truly need it?
- Is on-PV sufficient to *speak*, with ablation reserved only for low-`winDrop` good-move
  pins/forks?
- Exact **calibration set** for the volatility / multiPV-ε / dominance thresholds, per node tier
  (75k/200k/500k), without overfitting the 18-case eval?
- Should the rubric **penalize a confident wrong reason more than it rewards a correct one**
  (asymmetric — a fake reason is the worst outcome)? By how much?
- Minimal truthful wording for the "too deep" output — badge alone, or badge + one fixed marker?
- Does switching the ladder to **WDL-drop** shift current classification/recall expectations?
- Is a **Maia-style human-frequency** "too deep for a human" oracle worth a later spike, or are
  eval-stability + multiPV-spread enough at $0?

---

## 9. Sources (with verification status)

`[V]` verified · `[U]` uncertain/partly unconfirmed · `[R]` claim as originally phrased was refuted
(direction still useful — see note).

- `[V]` Lichess uses **win%-drop not raw cp**; Stockfish's `win_rate_model` is a
  material-dependent cubic, not a simple cp sigmoid → prefer engine WDL.
  <https://lichess.org/page/accuracy> · <https://github.com/official-stockfish/WDL_model>
- `[R]` Exact Lichess thresholds/accuracy-formula constants (scale + coefficients) — **do not
  hardcode**; adopt WDL or re-derive. <https://github.com/lichess-org/lila/blob/master/modules/analyse/src/main/AccuracyPercent.scala>
- `[V]` chess.com Blunder (v2) wants a **concrete material/mate consequence**, not just an eval
  drop. <https://www.chess.com/news/view/chesscom-launches-game-review-v2>
- `[R]` chess.com Expected-Points also takes **player rating** as input (eval-only is
  insufficient) → we can't perfectly replicate the classes.
  <https://support.chess.com/en/articles/8572705>
- `[U]` chess.com "Brilliant narrow-path" 4th criterion — plausible, **not officially
  documented**. · `[U]` chess.com Coach implementation tech (template vs LLM) is **undocumented**.
  <https://support.chess.com/en/articles/8584089>
- DecodeChess — multi-probe, never emit an unprobeable claim. <https://decodechess.com/about/>
- Kim et al. 2025, *Concept-guided Chess Commentary* (concept-delta dominance, speak only when
  one concept clearly changes). <https://arxiv.org/html/2410.20811v1>
- SARFA, *Explain Your Move* (ICLR 2020) — black-box feature-ablation causal test.
  <https://arxiv.org/abs/1912.12191>
- *Acquisition of Chess Knowledge in AlphaZero* (PNAS 2022) — concepts are linearly decodable
  (white-box; not available for our WASM black box). <https://www.pnas.org/doi/10.1073/pnas.2206625119>
- Selective prediction / reject option — Chow; Geifman & El-Yaniv (NeurIPS 2017).
  <https://arxiv.org/abs/1705.08500>
- **SF16+ removed HCE** — `eval` trace is opaque PSQT+Positional; no named-concept attribution.
  <https://github.com/official-stockfish/Stockfish/discussions/4678>
- WebLLM feasibility (1-3B 4-bit, 40-180 tok/s) <https://arxiv.org/html/2412.15803v2> ·
  XGrammar enum-constrained decoding <https://arxiv.org/abs/2411.15100>
- Our own volatility signal: arXiv:2412.17948 (already cited in `engine.ts:63`).

*(Full per-agent findings, all 9 verified claims, and the 5 raw code audits are archived in the
workflow output for this run.)*
