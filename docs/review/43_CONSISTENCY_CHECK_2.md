| # | file:line | check | expected | found | severity |
|---|---|---|---|---|---|
| 1 | README.md:12 | parameter count in file description | 73 (plugin/spec.json params; docs/concept/00_DECISIONS.md:33 D29) | 69 | error |
| 2 | README.md:13 | file list vs `find docs plugin -type f` | docs/review/40_CONCEPT_REVIEW.md, 41_CONSISTENCY_CHECK.md, 42_REVIEW_TRIAGE.md listed (other dirs list every file) | directory-level entry only | warn |
| 3 | docs/concept/00_DECISIONS.md:20 | D16 chassis vs spec view height | plugin/spec.json:14 height 540 (note at :16: "pending owner Q1", 460 alternative) | 720 × 460 as decided | warn |
| 4 | docs/concept/00_DECISIONS.md:24 | D20 line-block offsets | A from param8, B from param28, C from param51 (spec; D29 at :33) | A from param7, B from param26, C from param48; not marked superseded | warn |
| 5 | docs/concept/00_DECISIONS.md:25 | D21 parameter count | 73 (D29, spec) | 69 | warn |
| 6 | docs/concept/00_DECISIONS.md:37 | D33 hand-over form | repo, branch and path (docs/plan/30_DEV_PLAN.md:18; kit rule 4) | repo path | warn |
| 7 | docs/concept/20_DSP_CONCEPT.md:179 | §14 Hold wording vs D26 (00_DECISIONS.md:30) | D26 text only; D23 sentence "Hold off is the identical code path" and 32-sample release ramps are not in D26 | both sentences present in §14 | warn |
| 8 | docs/concept/20_DSP_CONCEPT.md:62-63; docs/concept/22_BODIES.md:13 | damping rule wording | one rule; rho bound 0.1 and Material clamp stated in both (pass) | 20 uses q = αR·ω/αG and rho = (1+q)/(1+10q); 22 uses share s and rho = 1/(1+9s); equivalent (q = s/(1−s)) but worded differently | warn |
| 9 | docs/concept/22_BODIES.md:14, 56, 66, 86; docs/concept/20_DSP_CONCEPT.md:94 | Body / Position default meaning | init 50 = recipe default for every anchor (spec init 50; 20:94) | Body defaults per body: piano 45 (:56), guitar 60 (:66), fiddle 70 (:86); 22:14 says Position defaults are per body while 50 = recipe value | warn |
| 10 | docs/concept/22_BODIES.md:44 | timpani compass | C2..C4 (00_DECISIONS.md:19 D15; 22:129) | "timpani compass D2-A3" (R10 B4) in the same clause as the C2..C4 clamp | warn |
| 11 | docs/concept/22_BODIES.md:82 | Fiddle A1 T60 from the body law | 0.19 s (6.908 / (18.3 + 5.82e-3·2π·469) = 0.1949 s) | 0.20 s | warn |
| 12 | docs/plan/30_DEV_PLAN.md:53 | line-state memory figure vs 20 §16 | same figure as docs/concept/20_DSP_CONCEPT.md:195 (≈184 k for three lines, delay/engine memory), or scope of 381 k stated | 381 k floats of line state, scope not stated | warn |
| 13 | docs/plan/30_DEV_PLAN.md:17 | P0 open questions vs decisions | labels (D34), timpani compass (D15), Motion default (D17) recorded as decided | listed as fine questions still to answer in P0 | warn |
| 14 | docs/concept/21_UI_CONCEPT.md:14, 74, 93 | chassis size | plugin/spec.json:14 540 (pending Q1); D16 460 | 720 × 460; also "WINDOW SIZE: 720x460" at :14 | pending 21 rewrite |
| 15 | docs/concept/21_UI_CONCEPT.md:15, 93 | row heights | §11.2: original rows keep 30 / 63 / 92 px | §1: header 36, morph 44, deck 110 px | pending 21 rewrite |
| 16 | docs/concept/21_UI_CONCEPT.md:78 | U-step list | docs/plan/30_DEV_PLAN.md:18, :24: U0 in P1; U1-U7 in P6 (U4 incl. Hold button, U6 line tabs, U7 chassis and cleanup) | U0-U6; no U0 functional UI, no line-tab step, chassis in U6, no cleanup step | pending 21 rewrite |
| 17 | docs/concept/21_UI_CONCEPT.md:57 | lineModes semantics | plugin/spec.json lineModes note and 20_DSP_CONCEPT.md:128: first 16 slot modes of the dominant body, fixed recipe index order | 16 loudest modes of the active line | pending 21 rewrite |
| 18 | docs/concept/21_UI_CONCEPT.md:97 | anchor labels (§11 item 6) | 00_DECISIONS.md:38 D34 and plugin/spec.json anchorLabels (abbreviations, OBOSAX·) | eight original labels keep their text; original text (reference/body_original/index.js:6) is BASS DRUM, UKULELE, CLARINET, OBOSAXOLELE | pending 21 rewrite |
| 19 | docs/concept/21_UI_CONCEPT.md:15, 63 | control placement | every spec control placed: Pan (param27/50/73, small), Low Cut (param7, small) | Pan and Low Cut absent; Width placed in deck at :63 but deck row at :15 omits it | pending 21 rewrite |
| 20 | docs/concept/21_UI_CONCEPT.md:27-36 | layer order | back to front by z (heading at :27) | L14 (+320, :34) listed before L15 (+60, :36) | pending 21 rewrite |
| 21 | docs/concept/21_UI_CONCEPT.md:30-36, 89 | layer budget vs U1 gate | docs/plan/30_DEV_PLAN.md:24 U1 gate ≤ 12 layers; :50 render budget (N12) ≤ 12 | 16 layers in the active stack (L0-L15), 19 compositing layers in total (:89) | pending 21 rewrite |

Totals: 21 findings (1 error, 12 warn, 8 pending 21 rewrite).
