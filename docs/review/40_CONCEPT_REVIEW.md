# 40 — Adversarial concept review: RE·BODY (DSP + UI)

Base: branch `claude/gallant-mendel-xg901g` @ `8c5494f` (after the mechanical pass `41_CONSISTENCY_CHECK.md`; its 37 findings are not repeated).
Cites: `20:`/`21:`/`22:`/`30:` = concept/plan files (line), `BODY:` = reference/body_original/dsp.cmajor, `UI:` = reference/body_original/index.js,
`core-ui` / `core-dsp` / `fx.md` = upstream `context-src/v1/shared/core-ui-contract.md`, `shared/core-dsp-foundations.md`, `dsp/fx.md` (kit copies identical),
`07:` = kit `docs/07_SCALING.md`, `04K` = kit `docs/04_PARAMETERS.md`, `R10`/`R11` = research files. Numbers come from a scratch calculation
(one-pole loop responses, YIN sizing, layout sums, perspective geometry). *(inf)* = inference. Decision-log entries are written `dec.Dn`; plain `Dn` = finding in section D. Severity: BLOCK > HIGH > MED > LOW.

## A. Logic errors and contradictions (ranked)
| # | Sev | Where | What is wrong | Fix |
|---|---|---|---|---|
| A1 | BLOCK | 20:35, 20:53, 20:29, 20:98, 22:13 | Two incompatible modal architectures. §2/§3 size "one structure" for all ~11 bodies (≈530 stereo modes per line) so every body keeps its own ringing tail (BODY tail holding, BODY:226-243); §6 "melts" rank-paired modes by interpolating log f/T60/gain. If every body owns slots, a melt has no owner mid-morph (both neighbours half-melted = doubled, phasing energy). If one melted slot set is used, stored tails are retuned while ringing (no tail holding) and capacity is 48/line, not 530. | Decide before P2 (recommended hybrid: G2); then rewrite 20 §3 capacity, §6, §7 gating and P2. |
| A2 | BLOCK | 20:75, 20:136, 20:140 | Level sits "before the shared balance stage", but BODY's balance is a slow AGC on the pitched sum (target −8 dB re input power, clamp −18..+12 dB, slews 0.25/0.9 s, BODY:845-855): any Level change on pitched bodies is undone within ~1 s; drums bypass it (BODY:856). A balance "shared" by three lines has no defined `pitchedWeight` (BODY:844). | Per-line balance + drum calibration inside each line (as BODY) → Level → sum → shared protector/knee. Redraw 20:136. |
| A3 | BLOCK | dec.D23, 20:91, 20:157, 30:22 | Hold is not a "linear freeze that rings on unchanged" for line engines (numbers E1), and "playing into a held body = second line in Chain mode" does not do that: the Chain line listens to the held line's output; live input never reaches the held body. Muting injection itself is justified: a sine exactly on a held mode gains 2/√ε ≈ +62 dB with BODY's drive law (BODY:320). | Rewrite Hold (G3); drop the Chain claim; replace the P4b gate with measurable ones (modal T60 ≥ 30 s, drift < 0.5 dB/10 s, DC < 0.01). |
| A4 | HIGH | 21:14-15, 21:93, dec.D16 | "Field ≥ 50 % height" is impossible: rows 36+44+110+34+34, padding 21+20, 5 gaps × 5 px leave 136 px = 30 % of 460; with §11.2's original rows (30/63/92) 141 px = 31 %. BODY gives 144 px at 340 and 199 px in its own ≥440 px layout (UI:270, :310): the hero field shrinks. 21:15 and 21:93 also disagree on row sizes, and 720×460 (1.57) is not "620×340 proportions" (1.82). | Chassis ≈ 720×540 or strips beside the deck; one row table. |
| A5 | HIGH | 21:15 vs 21:63 | Strip 2 is 34 px but hosts 40 px dials with label and value (≥ 66 px); strip 1 holds the Sensitivity dial in 34 px. | Strips ≥ 64 px, or 24-28 px mini-dials. |
| A6 | HIGH | 21:62-63, 21:85 | Mix (global) is a deck dial and Width "sits in the deck", but deck and strips "exist three times" → three `.control[data-param]` for param3/param6 (core-ui §2 "exactly once"). | Globals (Mix, Width, Bypass, Motion) in one non-triplicated zone. |
| A7 | HIGH | 30:18, 30:19, 30:22, 22:100, 20:122, 20:145 | Gates that cannot pass or are undefined: (a) "complementary splits sum to input (−100 dB)": an LR4 3-band sum is an allpass, abs(1 − sum) reaches 2.0; 20:145 "LR4 sums flat in phase" is wrong (flat magnitude only; without low-band allpass compensation a −0.11 dB dip); (b) Hold "no colouration" (E1); (c) "cutoff visible as −6 dB/oct" — a one-pole inside a loop gives peak heights ∝ 1/(1 − g·abs(H)), far steeper; (d) "A/B within stated tolerances" — none stated; (e) "clean on all three emission variants" — the trial exists because some fail; (f) loudness "wet within ±3 dB of dry" contradicts BODY's balance target of −8 dB power (0.158, BODY:853). | (a) magnitude flatness ±0.2 dB or subtractive splits; (c) measure the loop filter; (d) f0 ±5 ct, band T60 ±15 %, LUFS ±1 dB; (e) "each tried, ≥ 1 clean"; (f) pick −8 or 0 dB and align the balance. |
| A8 | MED | 22:18, 22:24, 22:57, 22:46 vs 22:10 | Bass Drum "9 modes" lists 8 and its validation omits the f0 peak; Guitar "ρ 0.25 (η constant → T60 ∝ 1/f)" — constant η gives ρ = 200/2000 = 0.10; Piano Material scales η ×2..÷2, which leaves ρ unchanged, against the common rule Material 0 → ρ/4 … 4ρ. | Fix counts; one Material law (G9). |
| A9 | MED | 20:37 vs 20:165, 22:117-120, 22:121 | v1 scope: §2 reserves the 3-port bridge for "later" (one-way coupling, R10:172 deprioritised), §15/22 §13 put bridge reflection ρ ≤ 0.25 on Coupling > 50 — a bidirectional loop that also voids the Hold/linearity arguments. Bore Coupling = "bell reflection 0.8..0.98" is the loop gain Decay already sets (BODY:339). | Remove bridge reflection from v1 or scope it with PHYSIFY's passivity bound; bore Coupling = radiation mix, not loop gain. |
| A10 | MED | 20:72, 20:56, 22:10 | Decay is "global αG scale" and also "log seconds per body (anchorSeconds)"; with T60 = 6.9/(αG+αR·ω), scaling αG alone changes ρ, so Decay and Material interact. | Decay scales (αG, αR) jointly; Material sets αR/αG at constant T60(f_ref). |
| A11 | MED | 20:146 vs 20:156, 20:76 | Strikers use the shared full-band onset, yet Listen selects Low/Mid/High/Transient and Chain says "onsets detected on the chained signal": a Low-listening Hammer line fires on hi-hats. | One novelty detector per line on its listened signal (3 × BODY:591-594). |
| A12 | MED | 20:74, 20:156 | Enable Off "gates all its engines": a line chained from a disabled line gets silence, and gating a ringing line cuts its tail. | Enable = "summed"; compute a line while enabled or chained-from; fade, gate after tails drain. |
| A13 | MED | 20:9, 20:133, 30:19 | "param1..5 keep BODY's meaning" / "Line A alone reproduces BODY" are false: param4 0..7 → 0..10, value 4 Clarinet → Guitar; dec.D4 changes voicings. P2's "recipes that reproduce BODY's seven voicings" exist nowhere (22 holds target recipes). | State "no preset compatibility"; add a `legacy` recipe set (BODY constants) as the P2 golden. |
| A14 | MED | 20:66, 20:77, spec param6/param10 | Width 50 and Sensitivity 50 have no defined meaning; Line A at defaults must equal BODY's unity contact; BODY has no width control. | Sensitivity 50 = 0 dB (±24 dB); Width 50 = BODY image, defined for line engines (G11). |
| A15 | MED | 20:116, spec lineModes*, 21:36, 21:57 | lineModes carry 16 energies without mode identity → markers cannot be placed; "dominant body" flips mid-morph; caption seconds "computed as the original does" cannot mirror Material, damping law or Hold; bodyOnset sampled at 30 Hz drops short peaks. | G10. |
| A16 | LOW | 20:130, 30:50, 21:78 vs 30:24, 30:18 vs 30:24, 21:97, 21:92, dec.D19 | Stale: Stretch/label "fine questions" already decided (dec.D18, dec.D14); risk row "16 layers … drop to 10"; steps U0-U6 vs U0-U7 and "U0" = functional UI (P1) vs tokens (P6); "eight original labels keep their text" vs `OBOSAX·`; "anchor 9 → ≥ 10 px" though the base layout already uses 11 px and 11 cells force smaller text; dec.D19 "ideas, not obligations" vs committed P4b. | Sync. |
| A17 | LOW | 22:37, UI:36 | Timpani clamp C2..C4 leaves the top third of Tune dead on that anchor; the note editor accepts 36..72. | Per-body dial mapping or visible clamp. |
| A18 | LOW | spec param26-28, param48-50 | B/C default to A's body and tune; enabling B duplicates A coherently (+6 dB) into the protector. | Distinct defaults (B Bass Drum/Transient, C Piano/Sustain). |

## B. Claims about the original that are wrong
| # | Concept claim | What the original says |
|---|---|---|
| B1 | 22:45, 01:40 "two detuned (±0.09 ct) strings" | BODY:353 `pow(2, ±0.09/12)` = ±0.09 semitone = **±9 ct**. |
| B2 | 22:64 "BODY's Q ≈ 6/3.5 at 310/690 Hz (BODY:543-549)" (copied from R10:121) | BODY:544-545: 690 Hz, T60 0.025 s → Q = f·T60/2.2 ≈ **7.8** (310 Hz: 6.1 is right). |
| B3 | 22:48 "Position = hammer strike point 0.12 … (sets the pickup comb, BODY:486)" | BODY:486 is an output pickup tap at **0.11**·delay; the hammer enters at the loop input (BODY:670); there is no strike-point comb. |
| B4 | 22:30 "snare wires respond to novelty only (BODY:615)" | Drive = edge·(rattleSustain + (1−rattleSustain)·novelty), rattleSustain ≥ 0.08 (BODY:620, :269): sustained input rattles too. |
| B5 | 20:29 "tail holding (BODY:126-172)" | Those lines are weights and feeds; tail holding is BODY:226-266 (cited correctly at 20:99). |
| B6 | 20:157, dec.D23 "no nonlinearity in the path … rings on unchanged" | Every BODY loop has a saturating reflection (BODY:650 ×0.014, :669 ×0.002, :706 ×0.003, :794 ×0.020) and a loop low-pass (BODY:520, :524, :526, :530). |
| B7 | 21:92 "dial arc 5 → 3 px (:294-297)" | stroke-width 5 is in a 200-unit viewBox (UI:260, :296) ≈ 1.75 px at 70 px; "3" thins it to ≈ 1 px, the opposite of R11 R3 (3 CSS px ≈ 8.6 units). |
| B8 | 21:51 "rAF runs only while something moves, as the original already gates its draw (UI:333-338)" | UI:337 re-requests rAF every frame unconditionally; only `draw()` is gated. |
| B9 | 21:92 CSS "carried over verbatim … changed only in five places" | The block contains `gap:clamp(45px,12vw,110px)` (UI:292), viewport media queries (UI:309-310) and 8-anchor constants (UI:285 margin 100%/16, :288 /7, :289 repeat(8)) that must change for 11 anchors: ≥ 9 changes. |
| B10 | 21:94 "BodyDial … taken over as code; extensions wrap or subclass" | BodyDial hard-codes 0..100 (UI:145, :171-172, :189, :206-207), note mode only for `param1` (UI:186), seconds only for `param2` (UI:200); the view hard-codes initial values (UI:253) and uses ResizeObserver (UI:332), banned by 21:70. Core edits are unavoidable. |
| B11 | 22:19 "+0.33 oct × onset (BODY:308)" | ×onset×feed[0]: the glide fades with morph weight (keep that). |

Spot-checked correct: BODY:120-124, :177-201, :282-301, :313-329, :338, :399-420, :501/:804, :520/:530, :543-554, :587-594, :604-613, :636-734, :831-889; UI:47-102, :103-248, :310, :313, :320-325, :341-345, :349-359, :360-426.

## C. Research coverage matrix
| Recommendation / verdict | Status | Where | Comment (add?) |
|---|---|---|---|
| R10 §4.1 data tables, one bank, fixed-Hz flag (24-32 modes) | applied (48) | 20 §3 | 48 > 24-32: only affordable active-only (E6/E7). |
| R10 §4.2 damping law + Material | applied, inconsistent | 20 §4, 22 §0 | A8, A10. |
| R10 §4.3 Helmholtz/plate 2-DOF (uke, guitar), fiddle data | partial | 22 §5-7 | Guitar double-counts A0/T1 (E10); uke has no 2-DOF although 30:20 says so. |
| R10 §4.4 dense soundboard | applied | 22 §4 | — |
| R10 §4.5 cone/lattice table values (clarinet "keep 1.75 kHz", R10:156) | deviated | 22 §8-10 | 1.4 kHz clarinet and 1.0 kHz sax inside the loop detune partials (E3). |
| R10 §4.6 melt + crossfade fallback | applied, undefined | 20 §6 | A1, E4. |
| R10 §4.7 coupled head pairs, Tune-dependent air-loaded ratios | partial | 22 §1-3, §13 | Pairs only for (0,1); air load on Air knob; (0,2) missing (E11). |
| R10 §4.8 gating + CI (golden_ci, lhs_fuzz, tri-rate) | partial | 20 §7, §9 | lhs_fuzz absent — add; 1e-12 gate too late (E8). |
| B1 Bank 2007 fixed-pole parallel — **Top** | missing as method | 20 §1 text only | Add as shared pole grid (G2); IR-fit import (B3 parfilt) in v1.1, else dec.D4's "measured tables" are mostly *(design)* values. |
| B1 Bank 2010 one-way coupling — High | applied | 20:37 | Contradicted by Coupling > 50 (A9). |
| B1 Maestre 2017 shared admittance bank — High (coupled) | not used | — | Fine while coupling is one-way. |
| B1 Christensen 2-DOF — High | partial | 22 §5 | See §4.3. |
| B1 Avanzini drums — High | applied | 22 §1-3 | Tension glide kept. |
| B1 Scavone blowed string — High | applied | 20:36, 22 §9-10 | With audio-in, β is only a comb (E12). |
| B1 phasor modes — Keep | applied | 20:35 | Float64 coefficients for Hold (E2). |
| B3 Rings `resonator.cc` — Read first | partial | 20 §5/§7 | Position, Bright, Nyquist used; odd/even → L/R stereo split unused (G11). |
| B5 polar pole interpolation — Use | applied | 20:98 | — |
| B5 fixed shared pole grid, morph numerators — Use for measured bodies | missing | — | Add (G2): solves A1 for 8 of 11 bodies. |
| B5 energy crossfade — Keep as fallback | applied | 20:99 | — |
| B5 formant shift/stretch — Expose as Size/Stretch | applied | 20 §5 #11/#15 | Stretch on Tune-following modes undefined; overlaps Stiffness. |
| R11 R1 typography | applied | 21:66, 21:92 | 55 px anchor cells force abbreviations (F9). |
| R11 R2 one light, 3 elevations | partial | 21:40 | Light repainted (F3); elevations unspecified. |
| R11 R3 dial v2 | applied, unit error | 21:62, 21:92 | B7. |
| R11 R4 morph hero | applied | 21:61 | Hybrid-stop bracket missing. |
| R11 R5 rim light, floor | applied | 21:30-31, 21:40 | — |
| R11 R6 energy response | applied | 21:54-58 | Path rewrites in 3D layers (F2). |
| R11 R7 lamp + text state / R8 Delete reset | applied | 21:64-65 | — |
| R11 R9 grain | applied | 21:67 | R9 bakes via canvas, 21:16 says "no canvas": use an SVG `feTurbulence` data URI, say so. |
| R11 R10 parallax: 3 layers, ≤ 5 px, translate3d, rAF only while moving | deviated | 21 §2-3 | 16-19 layers, ±5° ≈ 50 px back-layer shift, idle drift (F1, F6); dec.D6 may override, but log the motion budget. |
| R11 R11 44 px morph row, field ≥ 55 % | contradicted | 21:15 vs 21:93 | A4. |
| R11 R12 air layer | applied | 21:35 | Must freeze under reduce/Calm (F6). |
| B2 compositor-only transform/opacity; layer memory; will-change last | partial | 21 §2 | Light repaint, path rewrites, memory (F1-F3). |
| B2 preserve-3d flatteners incl. clip-path, isolation, mix-blend-mode | partial | 21:25 | Add the three missing ones. |
| B2 3D tilt ≤ 2°, decor only, never on controls/text | violated | 21:48, 21:36 | ±5°; caption text inside the scene (F4). |
| B2 pointer light = pre-painted layer moved by translate3d; SVG lighting static | violated / applied | 21:40 | F3. |
| B2 `contain` on non-3D boxes; avoid `@property` | missing / ok | — | Add `contain: layout paint` to header, deck, strips. |
| B5 WCAG 2.5.8 targets ≥ 24 px | partial | 21:61, 21:84 | Enable "dot" in tabs and 55 px anchor cells: specify ≥ 24×24. |
| B5 WCAG 2.3.3/2.2.2, "idle drift is decoration: avoid", no always-on loop | violated | 21:49-51 | F6. |
| B5 contrast 1.4.3/1.4.11; rebuild from requestParameterValue | applied | 21:66, 21:70 | — |
| B5 Amorph: no flat grid of identical knobs; no ResizeObserver | at risk / contradicted | 21:63, 21:70 | D14, D3. |

## D. Platform-rule conflicts
| # | Rule (quoted) | Concept item | Consequence / fix |
|---|---|---|---|
| D1 | core-ui §2: "Every `.control[data-param]` must have nonzero visible geometry and contain a visible interactive widget" | 21:85 two of three line sets `hidden`; 21:63 MORE collapses 10 controls; 21:96 Classic hides tabs (Enable) and strips | Up to 52 of 69 controls invisible. Whether `run_ui_probe` ("compare `[data-param]` controls with compiled DSP endpoints", TOOLS.md:56) checks visibility is undocumented → verify in the P1 spike (G1); fallback: always-visible mini-controls for inactive lines, Classic without hiding. |
| D2 | core-ui §3: "Initialize with `setValue(init, false)`; do not leave `--` visible" (UI_REF_FX §I.3) | 21:70 "value labels painted `--` until the first host value arrives" | Regression vs UI:184/:253; paint init in the constructor, `--` only in the template. |
| D3 | core-ui §6: "Never use `ResizeObserver`"; P03 2d "no vw/vh"; kit rule 8 (verbatim adoption) | 21:10, 21:70 "no ResizeObserver (host sizing per 07_SCALING instead)" | 07 itself uses `height:100vh` (07:63), a window resize listener (07:105), ResizeObserver (07:107-110, :227-229), a 250 ms re-measure timer (07:226-227) and a wrapper walk-up (07:156-162); 07 §3 "suspend all heavy rendering during resize" (07:236-262) is absent from 21. Write the deviation list (keep resize + timer + §3, drop RO and vh). |
| D4 | core-ui §5: "Do not set fixed pixel dimensions on `:host` … grid/flex, `%`, and `fr`" | 720×460 zoom chassis (21:14) | Allowed by 07 option 2 but must be logged as an upstream deviation in `docs/dev`. |
| D5 | P03 2d "no vw/vh" | 21:92 verbatim CSS incl. UI:292 `12vw`, UI:309-310 media queries | Media queries read the real window, not the zoomed chassis → layout jumps while resizing; delete both. |
| D6 | core-ui §1: "Include one plain JavaScript control helper class and exactly one class that extends `HTMLElement`" | 21:94 subclassed/wrapped BodyDial plus segmented, morph and tab helpers | Paste-flow rule, low risk for MCP-authored files; prefer one generic `Control` helper with kinds. |
| D7 | core-dsp: "A multi-stage reverb normally keeps the sum near or below `131072` floats … can cause a host compile stall" | 3 lines × (BODY's 77,824 floats + 3 new `float<2>[8192]` loops) ≈ 381,000 floats (20:107) | 4096-sample buffers suffice (C2 @ 96 kHz = 1468, 40 Hz Follow = 2400); one string engine per line shared by Guitar/Ukulele/Fiddle; measure compile time in P1. |
| D8 | fx.md A5: "local `State& s` aliases are invalid … `&` is legal only in function parameters"; 04_PHYSIFY:89 "multi-dim struct arrays bug (#94)" | 20:133 "array of three identical line states" holding large arrays | Exactly the #94 shape: P1 must compile the real line struct × 3, else per-line members or three processor nodes. |
| D9 | fx.md A15: "Verify the algorithm cannot reduce to `wetL == wetR` for every sample" | Default Clarinet line processes L/R identically (BODY:640-653); Width only moves modal positions (20:66) | A mono QA probe yields an almost mono wet; define Width for line engines (G11). |
| D10 | core-dsp Mix row: "use linear only for intended level interaction, otherwise equal-power" | Mix "as BODY" = linear (BODY:890) | Keep linear on purpose (peak-referenced wet) and document, or switch and re-run the loudness gate. |
| D11 | core-dsp: "Probe impulse and zero-mean noise at default and extreme damping/brightness … un-clamped finite decaying response"; "Do not put `tanh` or a clamp inside the loop to excuse an over-unity row" | 20:121 omits Bright extremes; Hold On never decays; loop soft-clips (B6) would mask compensated gains > 1 (E1) | Add Bright/Hold corners; prove stability without the reflection soft-clip. |
| D12 | 04K: "do **not** push a stored bypass value … or the plugin can come up silent" | Hold is an automatable param (spec param24/46/68) that mutes injection | A project saved with Hold On reloads empty and muted → silent line. Auto-release when held energy < −60 dB, or ignore Hold until the line has energy. |
| D13 | fx.md F: "visualization also requires Amorph endpoint forwarding" (P03 §1 UNRESOLVED) | 10 outputs drive U3/U4/§10; verified only in P7 (30:25) | Too late: verify in the P1 spike. |
| D14 | core-ui §5: "Do not return a generic flat grid of identical knobs" | Strip 2: ten identical 40 px dials (21:63) | Group contact / body / physics with headings and sizes. |

Compliant: ids `param1..param69` sequential, 69 ≤ 128, append-only after BODY's five, enums with `text:` + step 1 + integer ranges, FX endpoints, declared-only subscriptions.

## E. Physics and DSP engineering risks
- **E1 Hold on loop engines (BLOCK).** With loop gain exactly 1, only the loop low-pass decays the tail: clarinet A3, LP 1.75 kHz → T60 h1 2.0 s, h3 0.24 s, h5 0.09 s (1.4 kHz: 1.3/0.16 s); new sax LP 1 kHz → h1 1.3 s, h3 0.17 s; uke A4 (1.65 kHz) 0.46 s; piano strings (11.5 kHz) 207 s. "T60 ≈ 60 s, unchanged" holds only for modal parts and piano. Compensating at f0 (PHYSIFY `lossComp`) sets DC loop gain g/|H(f0)| > 1 in every positive-reflection loop (sax, strings, uke, guitar, fiddle, oboe cone) — BODY has no in-loop DC blocker → exponential DC growth. Same trap for "T60-exact" decay generally: uke A4 above Decay ≈ 76 %, new sax A3 above ≈ 73 %. Fix: keytracked in-loop DC blocker (PHYSIFY CORE:43-53) + `lossCompSafe` = 1/sup|H| (PHYSIFY DSP:1174-1185); Hold freezes modal parts, loops either decay or flatten their LP with simultaneous delay recompensation. Note 20:157 cites CORE:79, which is the uncompensated formula.
- **E2 Hold numerics.** 1−r for T60 60 s = 2.4e-6 at 48 kHz = 40 float32 ulps below 1; 10 ulps at 192 kHz → ±5-10 % decay error and rounding bias. Compute (R, I) in float64 (BODY casts to float32, BODY:317-319); float64 state for held low modes (04_PHYSIFY:70).
- **E3 Lattice cutoff as an in-loop one-pole.** Delay is compensated at f0 only (BODY:338), so partials go sharp: sax 1 kHz at C5 h2 +22 ct, h3 +42 ct, h4 +58 ct (BODY 6.6 kHz: < 1 ct); clarinet 1.4 kHz at C5 h3 +45 ct, h5 +84 ct (BODY 1.75 kHz: +27/+55). Keep BODY's loop LPs as defaults, model the cutoff outside the loop (radiation filter / fixed-Hz modes), add a tuning LUT (PHYSIFY `tuneCorr`, 04_PHYSIFY:86).
- **E4 Melt mechanics.** (a) Melted tails glide audibly (stored energy is retuned), contradicting tail holding; (b) "fade by gain" must be output gain, else unmatched tails ring on at stale frequencies; (c) most neighbour pairs degenerate to crossfades: Timpani (6 tune + 1 fixed) → Piano (40 fixed) pairs 1 mode, fades 45; Piano → Guitar pairs 18, fades 22; only drum↔drum and box↔box truly melt. (d) Fixed-Hz bodies are better served by one shared pole grid with per-body gain vectors (R10 B5, G2).
- **E5 Loudness with three lines.** Identical lines sum +6/+9.5 dB (2/3 lines), uncorrelated +3/+4.8 dB, all into a protector whose ceiling is the input peak (BODY:874-889) → gain riding. 20:122 tests Line A only. Add a 3-line gate (protector reduction < 3 dB on pink noise at defaults).
- **E6 Energy normalisation cost.** 48² = 2304 float64 pair terms (≈ 46 kflop) per body; the cache is invalidated every tick by the onset glide (BODY:308), Follow and Morph → 33 bodies ≈ 2.3 GFLOP/s, active-only ≈ 0.6 GFLOP/s. Restrict to active bodies, prune cross terms to neighbours within ~5 bandwidths, cache the fixed-Hz block per Size/Material/Decay.
- **E7 Modal CPU.** PHYSIFY's bench is `float<8>`-vectorised and at 48 kHz flattered by modes folding above Nyquist (m0/BENCH.md: 512 modes 0.48 % @ 48 kHz, 3.45 % @ 96 kHz). Per line ≈ 1060 mono modes → ≈ 7 % @ 96 kHz, three lines ≈ 21 % even vectorised. BODY's scalar idiom adds per-mode per-channel flush branches (BODY:611) and per-sample stepping + snap (BODY:606-607): ≈ 1600 modes × 3 adds + branches per sample. Use SIMD lanes, no coefficient updates or stepping for weight-0 bodies (they keep their last voicing anyway, BODY:228), flush at control rate (JIT has FTZ, 04_PHYSIFY:90), staggered recompute.
- **E8 Gating threshold.** 1e-12 (20:104) = −240 dB re full scale: a 4 s timpani tail gates after ≈ 16 s. Use a per-body −120 dB relative gate.
- **E9 Pitch tracker.** YIN needs W + τmax = 812 samples @ 12 kHz = 68 ms before the first estimate; + hop 10.7 ms + median-of-3 ≈ 21 ms + 40 ms glide → > 100 ms: the P4b gate "locks within 100 ms" fails. Lag resolution 65 ct @ 440 Hz, 182 ct @ 1.2 kHz → parabolic interpolation mandatory (or decimate by 2). 153.6 k MAC per hop must be spread over the hop. Cost ≈ 600 flop/sample (20:147's 1-2 k is conservative). Follow glides delay lengths; BODY's linear interpolation (BODY:446-448) gives fraction-dependent low-pass flutter → Lagrange-3 (04_PHYSIFY:86).
- **E10 Guitar box.** The 2-DOF pair 97/200 Hz and the measured 103/205 Hz (22:56) are the same A0/T1 modes → double peaks beating at ≈ 6/5 Hz. Use one of them; take signed gains from the eigenvectors (the A0-T1 dip depends on it). Product check 97·200 ≈ 150·129 is fine.
- **E11 Membrane tables.** (0,2) at 2.296 is missing (22:18, 22:27): for a 0.30 R strike J0(5.52·0.3) ≈ 0.42 vs (3,1) J3(1.91) ≈ 0.12, so the omitted mode dominates the listed one. "Rim strike mutes (0,1)" (22:21): the rim is a node of every mode.
- **E12 Oboe cone.** β = 0.08 notches harmonics 12.5, 25 … — above the 1.5 kHz loop LP for f0 ≥ 233 Hz; with audio-in and no reed in the loop, the "blowed string" is a plain positive loop plus a comb (comb position commutes in an LTI loop). The identity stays in the cluster; a third waveguide per line buys little.
- **E13 Strikers.** Hammer force pulses are unipolar → DC into positive loops and low modes (PHYSIFY needed DC blocking after pulses, 04_PHYSIFY:85). Blend crossfades a log-velocity striker and an input-proportional contact with equal power but no calibration → Blend 50 is not "half/half"; normalise striker energy to the listened envelope.
- **E14 Analysis split.** `transient = x·g` amplitude-modulates at 1-20 ms rates (broadband sidebands) — acceptable as an exciter, not as a clean split. Nyquist is no issue: highest mode ≈ 12.7 kHz (oboe 10.57 × 1.2 kHz Follow) < 0.45·44.1 kHz.
- **E15 Tail memory.** ≈ 381 k floats of loop state per instance stays resident and is touched every sample while tails ring; together with D7 this argues for shared string engines and 4096-sample buffers.

## F. UI engineering risks
- **F1 Layer count and motion size.** 19 compositing layers exceed LALAFY's own budget (≤ 15 translateZ layers, 02_LALAFY:133) and R11 R10 (3 layers, ≤ 5 px); R11 C4 resolved "choose 2D layers, no 3D" (11:98). At P = 1600, ±5° yaw shifts the z −900 layer ≈ 50 px and the +320 layer ≈ 35 px the other way (≈ 85 px relative); idle drift ±1° alone gives ≈ 17 px. Memory *(inf)*: a full-field `inset:0` SVG per layer at zoom 2 × DPR 2 ≈ 6.5 MB; scale compensation (s = 1.56 at z −900) inflates back layers ×2.4 → ≈ 150 MB upper bound per instance before empty-tile culling.
- **F2 Path morphing inside 3D layers.** Rewriting `d` on 10 contour layers per frame (UI:357 pattern) re-rasters each promoted layer at zoomed, scale-compensated resolution, exactly when audio moves the field; the ≤ 4 ms target (21:74) is doubtful in WebKit *(inf)*. Vibrate ≤ 3 layers at 30 Hz, the rest transform-only.
- **F3 Light repaint.** 21:40 repaints gradients on every pointer move; R11 B2: never animate light, move a pre-painted layer with translate3d.
- **F4 Text and hits in the scene.** Caption L15 inside the rotated scene blurs (R11 B2 "never on controls/text"). Clickable silhouettes (21:86) need pointer events in a field that is `pointer-events:none` (UI:278-279), with L13/L14 full-size overlays set to none.
- **F5 zoom × perspective** *(inf)*: WebKit's legacy `zoom` and Chromium's standardised zoom may scale `perspective`/`translateZ` differently → parallax size and scale compensation differ per engine and zoom; test 0.5/1/2 in both (21:74 lists zoom 2 only).
- **F6 Idle motion.** Idle drift (21:49) keeps rAF alive forever, contradicting 21:51 and "0 when idle" (21:74), R11 B5 and WCAG 2.2.2; "Calm" (dec.D17) is undefined; the L14 particles are not in the reduced-motion freeze list (21:52).
- **F7 DOM churn.** 3 sets ≈ 51 dials × 10 listeners (UI:113-183, :318) ≈ 510 listeners and ≈ 800 nodes are fine, but `refreshMorph` refreshes every dial (UI:341): 69 × ~8 attribute writes per morph pointermove. Refresh only the active line's Tune/Decay.
- **F8 Host input.** Pointer and custom-endpoint delivery are checked only in P7 (30:25) while the field depends on both; spike in P1 (G1).
- **F9 Anchor row.** 11 cells in 660 px minus the Hold button ≈ 55 px; "BASS DRUM" ≈ 65 px and "CLARINET" ≈ 58 px at 11 px *(inf from R11:119 widths)* → abbreviations collide with 21:97.
- **F10 Hidden controls.** Tabs, MORE and Classic all hide `data-param` controls (D1); hidden sets still receive refresh writes.
- **F11 Resize.** 07 §3 (suspend heavy rendering during resize drags) is missing; with 19 layers it is the first thing to adopt.

## G. Improvements (ranked by value / effort)
1. **P1 host spike on the owner's Amorph (1 day)**: stub DSP with 69 params + 10 outputs and full-size line buffers; UI with three hidden sets, MORE and Classic. Record `run_ui_probe` on hidden controls, endpoint delivery, pointermove delivery, 19-layer preserve-3d frame time at zoom 1/2, compile time. Make it a P1 gate (30:18). Resolves D1, D7, D8, D13, F8.
2. **Modal architecture (A1, E4)**: one shared log pole grid per line (e.g. 64 poles 60 Hz-8 kHz, Bank 2007) for all fixed-Hz bodies with per-body gain vectors (morph = gain interpolation, Size = grid shift, Material = per-pole T60 law, tails kept per pole), plus a 16-slot rank-paired melt bank only for Tune-following drum/cluster modes. Constant cost; pairing problems vanish for 8 of 11 bodies.
3. **Hold v2 (A3, E1, E2, D12)**: modal freeze with float64 coefficients and T60 30-60 s; loops decay or freeze with flattened LP + recompensated delay + in-loop DC blocker + `lossCompSafe`; auto-release on empty state; honest wording.
4. **Loudness chain (A2, E5)**: per-line balance and drum calibration → Level → sum → protector/knee; 3-line loudness gate.
5. **Lattice cutoff outside the loop (E3)**: keep BODY's loop LPs (R10:156 "keep 1.75 kHz"), add cutoff as radiation filter or fixed-Hz modes, plus a per-register tuning LUT.
6. **Per-line onset and calibrated strikers (A11, E13)**: BODY's novelty law per listened signal; velocity = log peak; striker energy normalised to the input envelope; DC-blocked pulses.
7. **Layout (A4-A6, F9)**: chassis ≈ 720×540, globals in a fixed zone, strips 64 px with grouped mini-dials, Enable as ≥ 24 px tab buttons, abbreviations listed in 22 §0.
8. **Render budget (F1-F6, F11)**: ≤ 12 layers (merge fittings/strings), vibration on ≤ 3 layers at 30 Hz, light as a moved pre-painted layer, tilt ≤ 2°, no idle drift in Calm, rAF stops, 07 §3 resize suspension.
9. **Damping law (A8, A10)**: Decay scales (αG, αR) jointly; Material = ratio at constant T60(f_ref); piano η path expressed in the same ρ rule.
10. **Telemetry v2 (A15)**: lineModes in fixed recipe index order + dominant body id; lineState gets root Hz, T60 at root, effective sustain; bodyOnset as peak-hold since last frame.
11. **Stereo (D9, A14)**: Width for line engines via L/R pickup/radiation offsets or ≤ 3 ct L/R detune; Rings-style odd/even mode split for modal parts (R10 B3).
12. **Pro expectations still missing**: per-line Pan (+3 params), a wet low-cut/tilt (Corpus Filter/Bleed, R10 B2), output trim, preset/A-B via stored state (04K), PHYSIFY `lhs_fuzz` in CI, distinct B/C defaults (A18), copy line A → B.

## H. Preservation check (21 §11)
Still changed versus the original GUI, beyond the "five documented places" (21:92):
- **Proportions and field**: 620×340 media-query panel → 720×460 zoom chassis; the field shrinks from 144-199 px to 136-141 px (A4) while dec.D6 makes it the focus.
- **Morph row**: 8 → 11 anchors, new order (Ukulele and Clarinet move), 1 px rail/8 px thumb → 3 px groove/14 px lit thumb/detents/weight bars, Hold button, abbreviations; `OBOSAXOLELE` → `OBOSAX·` (dec.D14) against 21:97.
- **Deck**: 3 dials → 4 main + 4 small; dial v2 (conic cap, crescent, pressed/hover states) changes every dial's look; Material becomes a main dial.
- **Header**: title + Bypass → title, brand, three tabs, caption, Bypass, Motion in 36 px (original 30 px).
- **Field**: flat outline → 16-layer tilted 3D stack with fog, floor, particles, idle drift, standing-wave markers; the original's "illustration, not a physical measurement" stance (UI:313) blurs.
- **Behaviour**: BodyDial core edits (B10), ResizeObserver and media queries removed (D3, D5), rAF loop changed (B8), three new silhouettes (Timpani, Guitar, Fiddle) to be drawn.
- **Classic toggle** cannot restore the original: it may not hide controls (D1) and the deck keeps Material.
Alternatives: (1) Classic as a *skin* (original 1 px rail, original dials, flat field) over the same always-visible controls; (2) keep the main deck Tune/Decay/Mix as in BODY and move Material to the strip; (3) show lines B/C as a compact always-visible "lines" strip instead of tabs; (4) cap depth at ≈ 6 layers in Classic.

## I. Verdict
**Not ready to implement.** The parameter scheme, anchors, platform basics and most BODY citations are sound; the architecture has gaps that would be expensive to discover in P2-P6.
Blocking (fix in the documents before P1 code):
1. Choose the modal architecture: per-body banks vs melt bank vs shared pole grid (A1, E4, G2).
2. Loudness chain: per-line balance, Level after balance, 3-line gate (A2, E5).
3. Redefine Hold for loops and persistence; rewrite its gate (A3, E1, E2, D12).
4. Add the P1 host spike: hidden-control audit, endpoint forwarding, pointer delivery, 3D frame time, compile with full state (D1, D7, D8, D13, F8).
5. Fix layout arithmetic, strip heights and global-control placement (A4, A5, A6).
6. Loop filters: in-loop DC blockers wherever gain is compensated; lattice cutoff outside the loop (E1, E3).
7. Make every gate achievable and specified (A7).
8. UI contract items: init painting instead of `--`, 07_SCALING deviation list, remove `vw`/media queries from the verbatim CSS (D2, D3, D5).
9. Per-line onset detection for Listen/Chain strikers (A11).
10. Prescribe the CPU-relevant DSP layout (active-only updates, SIMD lanes, pruned normalisation) — dec.D9 sets no ceiling, but 3 lines at 96 kHz already cost ≈ 21 % vectorised (E6, E7).
Non-blocking: A8-A18, all of B (correct before the text is reused), E8-E15, F1-F11 (resolve during U1-U2 after the spike), G7-G12, H alternatives.
