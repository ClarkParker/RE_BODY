# 22 — Body concepts: every morph anchor of RE·BODY v1

Companion to `20_DSP_CONCEPT.md` (recipe format §3, damping law §4, parameters §5). Numbers cite `docs/research/10_PM_BODY_RESEARCH.md`
(R10 B4 = measured data table) or the original source (`reference/body_original/dsp.cmajor`, cited BODY:line; every kept line re-checked). Values marked *(design)*
are chosen by us where no open measurement exists; they are the first thing to tune by ear. Decisions applied: `docs/review/42_REVIEW_TRIAGE.md` T1, T5, T6, T10, N1, N2, N7, N9-N11.

## 0. Common rules
- **Anchor order (param4 Morph 0..10) and row labels** (`plugin/spec.json` `anchorLabels`): 0 Bass Drum `BASS` · 1 Snare `SNARE` · 2 Timpani `TIMP` · 3 Piano `PIANO` · 4 Guitar `GUITAR` · 5 Ukulele `UKE` · 6 Fiddle `FIDDLE` · 7 Clarinet `CLAR` · 8 Oboe `OBOE` · 9 Sax `SAX` · 10 Obosaxolele `OBOSAX·`. BODY had seven engines plus the hybrid stop = 8 anchors; RE·BODY has 11: drums, strings, reeds, the hybrid last as in BODY's title. Default Morph = 7 (Clarinet: BODY's init 4.0 in its series (0,1,3,6,2,4,5) is the Clarinet stop, see index.js:313 "Clarinet illustration at rest").
- **Per-body template** (§1-§11 state these fields in this order): *Grid profile / Feature modes (fixed Hz) / Following modes / Line engine / Damping (αG, αR at Material 50, ρ) / Contact / Calibration / Depth / Validation* (Contact and Calibration share a bullet).
- **Modal architecture (T1, no melt in v1):** each line has one shared **grid** of 96 poles (60 Hz-8 kHz) for the dense fixed-Hz response (soundboard, box hump, bridge hill, bell/brass radiation); a body owns a signed L/R gain vector over it, its *Grid profile* is that vector's shape in one sentence. Morph between fixed-Hz bodies = gain-vector interpolation (poles fixed, no glide, tails keep ringing); Size shifts the grid; Material/Decay set the per-pole T60 law blended over the active bodies. Exact modes sit in per-body slots: **Feature modes** ≤ 8 fixed-Hz (Hz, T60 or Q, signed gains written `gL/gR`) and **Following modes** ≤ 10 Tune-following (ratios to the root), with BODY's tail holding (BODY:226-266) and sqrt-weight energy crossfade (BODY:147-172). Capacity per line ≈ 96 + 11 × 18 = 294 stereo modes. Mode-level melt (drum↔drum) is a v1.1 experiment.
- **Tune (line block #1):** drums use BODY's continuous size law (BODY:177-178); timpani and all pitched bodies use the note law C2..C5 (BODY:179-180). The grid and Feature modes ignore Tune and follow Size (line block #11). Default Tune 58 (BODY:22): bass 73.6 Hz, snare 229 Hz, pitched A3 (220 Hz).
- **Decay (param2):** per-body `seconds = base × ratio^decay` exactly as BODY `anchorSeconds` (BODY:183-192) for the original seven (T60 of the root mode or loop); new bodies get the values below.
- **Damping, one rule (N2):** `T60(f) = ln 1000 / (αG + αR·2πf)`. Decay scales (αG, αR) **jointly** (drums, oboe cluster and loops: the full `anchorSeconds` range; a body behind a loop: ×0.5..2 over the dial). Material only moves the share s = αR·ω200 / (αG + αR·ω200) at **constant T60(200 Hz)**, so `ρ = T60(2 kHz) / T60(200 Hz) = 1/(1 + 9s)` is derived, never set on its own (bounds 0.10 at αG = 0 .. 1). Material 0 → max(0.10, ρ/4), 100 → min(1, 4ρ), 50 = recipe; pure-η bodies (ρ = 0.10) therefore react only above 50. Each body lists αG [s⁻¹] and αR [×10⁻³] at Decay 50 / Material 50 (αG = (1−s)·6.908/T200, αR = s·6.908/(T200·ω200)); grid poles and modes without own values use them, Feature/Following modes with own T60/Q keep it at Material 50 and follow the Decay factor and the Material tilt.
- **Contact:** `sustain` is BODY's per-body constant (BODY:23, :194-201), now the default of Touch (line block #9, 50 = recipe value). Position (line block #12) defaults are per body (50 = recipe value). Strikers (Hammer/Pluck/Breath, 20 §14) are DC-blocked and energy-normalised to the listened envelope, so Blend 50 is a real half/half (N11). Coupling (block #17) = one-way string/bore → body feed, for bores the radiation mix; **no bridge reflection in v1** (T6).
- **Loudness (T2):** per-body slots are energy-normalised with BODY's closed form (BODY:282-301; ≤ 18² terms, active bodies only), the grid once per Size/Material/Decay (cached). Each line runs BODY's complete stage (calibration constants BODY:831-856, balance AGC with the line's own `pitchedWeight`, BODY:844-856) before line Level (20 §7); re-measured in M1.
- **Line engines (T10, T6):** one shared string engine per line serves Guitar, Ukulele and Fiddle (one physical object retuned by the shared register; anchors only swap table values); the other engines are the piano pair, the clarinet bore and the sax loop; drums and oboe are modal. Delay buffers 4096 (C2 at 96 kHz = 1468 samples, Follow floor 40 Hz = 2400), piano pair 8192 (BODY:64). Loop low-pass defaults stay BODY's (clarinet 1.75 kHz BODY:520, uke 1.65 kHz BODY:526, sax 6.6 kHz BODY:530); the lattice cutoff is a one-pole **radiation filter outside the loop** on the pickup, and a per-register tuning LUT (PHYSIFY `tuneCorr`) trims the residual pitch error.
- **Depth (UI):** z per path for the layer table in `21_UI_CONCEPT.md` §2, back (−) to front (+), at perspective 1600 px.
- **Validation:** each body lists the render-test assertions (impulse and noise excitation, `cmaj render`).

## 1. Bass Drum `BASS` (anchor 0, BODY engine 0)
- **Grid profile:** shell air-load background, centred: flat 60-250 Hz, −6 dB/oct above, 20 dB below the batter modes *(design)*.
- **Feature modes (2):** wood shell 310 Hz (+0.30/+0.30) and 520 Hz (−0.20/−0.20), Q 8 *(design)*.
- **Following modes (7):** batter (0,1) 1.000; coupled-head pair 0.94 and 1.07 (parallel / antiparallel head motion, R10 B4; split *(design)*, ∓0.2 L/R skew, both carry the (0,1) gain); (1,1) 1.594, (2,1) 2.136, (0,2) 2.296, (3,1) 2.653 (ideal membrane; BODY:41 uses 1.586/2.128/2.65). Gains J_m(j_mn·r), r = Position: at 0.30 → 0.87 / 0.48 / 0.24 / 0.42 / 0.12 for (0,1) / (1,1) / (2,1) / (0,2) / (3,1), so (0,2) matters more than (3,1). 7 + 2 = 9 modes.
- **Line engine:** none (modal, as BODY). Root law 120 Hz × 2^(−1.68·(1−size)) (BODY:177); onset pitch tightening +0.33 oct × onset × feed, which fades with the morph weight (BODY:308).
- **Damping:** Decay 0.08 × 20^d (BODY:185) = T60 of (0,1) at default Tune; αG 17.6, αR 3.65, ρ 0.35 (T200 0.31 s; membrane, HF dies first). Material 100 approaches a tight, ringing head.
- **Contact:** sustain 0.035 (strike only); Position 0.30 of radius (a centre strike leaves only the (0,n) modes); contact low-pass 3·f0 + 170 Hz (BODY:326). **Calibration:** wet 1.5 × bass (BODY:856).
- **Depth:** rear shell (path 2) −300, batter head (1) −40, front hoop (0) 0, tension rods (6-9) +100, feet (5) +60.
- **Validation:** peaks at f0 × {0.94, 1.00, 1.07, 1.59, 2.14, 2.30, 2.65} ±2 % (the f0 peak included); T60 of (0,1) = Decay seconds ±10 %; |DC| < 0.01.

## 2. Snare `SNARE` (anchor 1, BODY engine 1)
- **Grid profile:** shell and snare-bed air plateau 200-800 Hz, −6 dB/oct above 1 kHz, −12 dB/oct below 150 Hz, centred *(design)*.
- **Feature modes (2):** shell 450 Hz (+0.35/+0.35) and 1100 Hz (−0.25/−0.25), Q 10 *(design)*; BODY's shell ratios 1.62/2.39 (BODY:41) are retired.
- **Following modes (5):** batter (0,1) 1.000; coupled pair 0.92 / 1.10 *(design; literature puts the parallel (0,1) near 180-200 Hz for a 14" drum, R10 B4)*; (1,1) 1.594, (2,1) 2.136; J gains at Position 0.35 → 0.83 / 0.53 / 0.31. 7 modes.
- **Line engine:** rattle = BODY's xorshift noise (BODY:624-625) × input-edge envelope (BODY:619-622), band 1.4-6.9 kHz (BODY:327-328), release 0.78 × decay (BODY:329), kept; Material also sets the band width (hard = brighter). Root law 310 Hz × 2^(−1.04·(1−size)) (BODY:178).
- **Damping:** Decay 0.08 × 12.5^d (BODY:186); αG 17.4, αR 4.86, ρ 0.30 (T200 0.29 s).
- **Contact:** sustain 0.035; Position 0.35 radius; rattle drive = edge × (rattleSustain + (1−rattleSustain)·novelty), rattleSustain 0.08..1 (BODY:620, :267-271), so sustained input rattles too (floor 0.08); no idle noise (BODY:615). **Calibration:** 1.4 × shell + 2.7 × rattle (BODY:856).
- **Depth:** shell (0) 0, top head (1) +10, snare wires (2) −60, lugs/rods (3-9) +80.
- **Validation:** head peaks ±2 %; rattle band energy follows onsets and sustained input (floor 0.08) and is exactly zero for silent input.

## 3. Timpani `TIMP` (anchor 2, new)
- **Grid profile:** kettle air-cavity hump 90-250 Hz (+4 dB), −9 dB/oct above 400 Hz, centred *(design)*.
- **Feature modes (1):** kettle-shell mode 160 Hz (+0.40/+0.40), Q 6 *(design)*.
- **Following modes (6):** (0,1) at 0.81 × (1,1) with T60 pinned to 0.08 s (the kettle damps it, *(design)*); (1,1) 1.00, (2,1) 1.50, (3,1) 1.98, (4,1) 2.44, (5,1) 2.91 (R10 B4 timpani); J-weighted gains, centred. 7 modes.
- **Line engine:** none (modal). Root law: note law, playable range clamped C2..C4 (timpani compass D2-A3, R10 B4); the Tune dial shows the clamp as a greyed C4-C5 range (N7). Onset tension glide +0.10 oct × onset × feed *(design, same mechanism as bass drum, fades with the morph weight)*.
- **Damping:** Decay 0.5 × 8^d (0.5 s .. 4 s) *(design)* = T60 of (1,1) at default Tune (220 Hz); αG 4.0, αR 0.64, ρ 0.40 (T200 1.44 s).
- **Contact:** sustain 0.03; Position 0.25 radius (orchestral beating spot favours (1,1)). **Calibration:** via energy normalisation, `out_gain` measured in M1.
- **Depth:** kettle (2) −280, head (1) 0, counterhoop (0) +20, struts/pedal (6-9) +120.
- **Validation:** ratio set ±1.5 %; (1,1) at Tune note ±10 ct; (0,1) T60 < 0.15 s.

## 4. Piano `PIANO` (anchor 3, BODY engine 3)
- **Grid profile:** soundboard, dense: gains ∝ f^−0.5 (re 84 Hz) with alternating sign per pole, −12 dB/oct above 4 kHz; L/R tilt bass-left / treble-right (1.15/0.85 at 84 Hz → 0.85/1.15 at 4 kHz) for Width *(design)*. The 22 Hz mean spacing below 1.1 kHz is approximated, not matched mode by mode.
- **Feature modes (7):** FEM low modes 84, 127, 194, 204, 229, 271, 301 Hz (R10 B4 piano), T60 = 96/f s (η 2.3 %: 1.14 s at 84 Hz); gains +1.00, −0.81, +0.66, −0.64, +0.61, −0.56, +0.53 (∝ f^−0.5, alternating), same L/R tilt.
- **Following modes:** none.
- **Line engine:** two dispersive strings detuned ±9 ct (BODY:353, `pow(2, ±0.09/12)`; dispersion −0.86/−0.78, BODY:70), hammer low-pass contact (BODY:525, :601-602), output pickup comb (BODY:675), buffers 8192; otherwise unchanged (BODY:349-366, :658-677).
- **Damping:** strings 0.25 × 24^d (BODY:188); board αG 0, αR 11.5 (η 2.3 %), ρ 0.10 (T200 0.48 s, T60(1 kHz) 0.096 s), Decay ×0.5..2; Material 100 → ρ 0.40.
- **Contact:** sustain 0.045 (BODY:197), hammer edge × novelty² (BODY:601); Position = output pickup tap at 0.11 of the delay (BODY:486; 50 = 0.11), the hammer force enters at the loop input (BODY:670), there is no strike-point comb; Body (line block #14) default 45 %. **Calibration:** 0.341 × (17 piano + 0.8 board) (BODY:832) as starting point.
- **Depth:** lid inner rim (1) −200, strings (3-5) −60, case rim (0) 0, keyboard (2, 6-9) +160.
- **Validation:** string-pair centre at the note ±5 ct (the ±9 ct unison beating is intended); Feature peaks at the FEM frequencies ±3 %; T60(1 kHz) 0.1 s ±20 %.

## 5. Guitar `GUITAR` (anchor 4, new)
- **Grid profile:** top-plate mid hump: bell 500 Hz-3 kHz peaking ≈ +6 dB at 1.2 kHz, −6 dB/oct below 500 Hz, −12 dB/oct above 3 kHz, alternating sign, L/R ±5 % *(design)*.
- **Feature modes (4):** measured signature modes only: 103, 205, 286, 436 Hz, Q ≈ 20 (R10 B4; T60 = 2.2·Q/f = 0.43, 0.21, 0.15, 0.10 s). Signed gains: 103 (A0) and 205 (T1) from the 2-DOF eigenvectors (same sign), 286 Hz −0.35, 436 Hz +0.25 *(design)*. The 2-DOF solver (plate 150 Hz, cavity 129 Hz → coupled ≈ 97 / 200 Hz, R10 B1 Christensen; Size/Air/Coupling move its inputs and shift 103/205 by the eigenvalue ratio) provides the A0/T1 coupling dip near 150 Hz, not a second pair of peaks.
- **Following modes:** none.
- **Line engine:** shared string engine (Guitar/Ukulele/Fiddle, buffer 4096): single string loop with pick-position comb (as the Ukulele, BODY:680-710), tuned to the note.
- **Damping:** string 0.25 × 24^d; body αG 0, αR 25.0 (η 5 %, Q 20), ρ 0.10 (T200 0.22 s; constant η → T60 ∝ 1/f), Decay ×0.5..2.
- **Contact:** sustain 0.045 with BODY's pluck-contrast law (BODY:685-687); Position 0.25 (pick point) → comb; Body recipe default 60 %. **Calibration:** energy normalisation, `out_gain` measured in M1.
- **Depth:** back and sides (2) −260, sound-hole cavity (1) −420, top (0) 0, strings (3-6) +40, bridge and pegs (7-9) +120.
- **Validation:** A0 peak 95-110 Hz, T1 peak 195-210 Hz, the dip between them ≥ 6 dB below both *(design)*, no further double peaks; string pitch ±5 ct.

## 6. Ukulele `UKE` (anchor 5, BODY engine 6)
- **Grid profile:** small-box hump 600 Hz-4 kHz peaking ≈ +4 dB at 1.5 kHz, −12 dB/oct below 200 Hz, −9 dB/oct above 4 kHz, alternating sign, L/R ±5 % *(design)*.
- **Feature modes (3):** A0 230 Hz and T1 290 Hz (design values; soprano body resonance ≈ D4 −19 ct, builder data R10 B4, design-grade) with the same 2-DOF treatment as the Guitar (eigenvector signed gains, coupling dip between), T2 480 Hz (−0.30/−0.30); Q 13.5 (T60 = 29.7/f = 0.13, 0.10, 0.06 s): more damped than a guitar, less than BODY's Q ≈ 6.1 / 7.8 at 310 / 690 Hz (T60 0.043 / 0.025 s, BODY:544-545).
- **Following modes:** none.
- **Line engine:** shared string engine at the Ukulele table: BODY's short string, 0.32-period pick comb (BODY:376, :689-690), loop low-pass 1.65 kHz (BODY:526), transient contact unchanged (BODY:368-380, :680-710). Hybrid role: the bridge signal `picked` plus BODY's wood pair (one-poles BODY:528-529, modes 310/690 Hz BODY:543-549) stays as a hidden tap for the Obosaxolele (BODY:725-727), outside the body bank.
- **Damping:** string 0.07 × 12^d (BODY:191); body αG 0, αR 37.0 (η 7.4 %), ρ 0.10 (T200 0.15 s), Decay ×0.5..2.
- **Contact:** sustain 0.025 (BODY:23 index 6), pluck-contrast law kept; Position 0.32; Body recipe default 50 %. **Calibration:** BODY 0.447 × (18 pluck + 0.72 wood) (BODY:835) as starting point.
- **Depth:** sound-hole cavity (1) −420, body (0) 0, strings (2-5) +40, frets/bridge (6-7) +90, pegs (8-9) +130.
- **Validation:** A0/T1 peaks ±5 % with the dip between; pluck → body T60 at 290 Hz ≈ 0.1 s ±30 %.

## 7. Fiddle `FIDDLE` (anchor 6, new)
- **Grid profile:** bridge hill: plateau 1.8-4 kHz (+6 dB), −6 dB/oct below 1.5 kHz, −12 dB/oct above 4.5 kHz, alternating sign, L/R ±8 % toward the treble side *(design)*.
- **Feature modes (5):** violin corpus means A0 275, CBR 407, B1− 475, B1+ 541, A1 469 Hz (R10 B4 violin), Q 30 at A0 *(design within typical range)*; T60 0.24 / 0.21 / 0.19 / 0.18 / 0.20 s from the law; gains +1.00/+0.90, −0.45/−0.50, +0.70/+0.80, −0.80/−0.85, +0.50/+0.55 *(design)*.
- **Following modes:** none.
- **Line engine:** shared string engine (buffer 4096): single string loop with high sustained feed (bowed character comes from the input, no bow model); Position = bridge-side pickup tap 0.1.
- **Damping:** string 0.2 × 20^d *(design)*; body αG 18.3, αR 5.82, ρ 0.28 (T200 0.27 s; ζ ∝ f^−0.45 → T60 ∝ f^−0.55, R10 B4), Decay ×0.5..2.
- **Contact:** sustain 0.6 (continuous input sustains the string); Body recipe default 70 %. **Calibration:** energy normalisation, `out_gain` measured in M1.
- **Depth:** f-hole cavity (1) −420, body (0) 0, strings (2-5) +60, fingerboard (6) +140, bridge (7) +120, scroll/pegs (8-9) +100.
- **Validation:** A0 and B1± peaks ±3 %; no self-oscillation (loop gain < 1 at all Decay).

## 8. Clarinet `CLAR` (anchor 7, BODY engine 2)
- **Grid profile:** bell radiation: three broad bumps at 1.5 / 2.5 / 3.6 kHz, Q 4 (+6 / +4 / +2 dB) over a floor 12 dB lower, rolled off above 5 kHz, all positive, centred *(design)*.
- **Feature modes:** none (the bell bumps live on the grid). **Following modes:** none.
- **Line engine:** closed cylinder, negative half-period reflection (odd harmonics), reed low-pass + envelope-normalised soft clip, radiation tap half a period apart (BODY:335-347, :444-455, :636-656), buffer 4096 (BODY:55). Loop low-pass stays 1.75 kHz (BODY:520); the lattice cutoff 1.4 kHz (measured 1150-1450 Hz, R10 B4) is a one-pole radiation filter on the pickup (BODY:655) outside the loop; tuning LUT per register.
- **Damping:** bore 0.15 × 20^d (BODY:187); bell bumps αG 0, αR 125 (Q 4 flat), ρ 0.10 (T200 0.044 s).
- **Contact:** sustain 1.0 (continuous, BODY:196); Position = radiation tap offset (default half period, BODY:345); Coupling = radiation mix, the loop gain stays Decay's. **Calibration:** 0.149 × (3.8 × boreRadiation) (BODY:831).
- **Depth:** bell (1) −120, bore (0) 0, keys (6-9) +120, mouthpiece (2) +160.
- **Validation:** odd-harmonic ratio ≥ 12 dB over even at the note; pitch ±5 ct across C2..C5 (phase-delay compensation, BODY:338, plus LUT); radiation cutoff visible as −6 dB/oct above 1.4 kHz at the pickup.

## 9. Oboe `OBOE` (anchor 8, BODY engine 4)
- **Grid profile:** nasal skirt: +3 dB shelf 0.9-3.5 kHz, −12 dB/oct below 500 Hz and above 4 kHz, centred *(design)*.
- **Feature modes (4):** fixed formants 1.1 / 1.4 / 2.8 / 3.2 kHz, Q 8 *(design)* (T60 16 / 13 / 6 / 5 ms), gains +0.45, −0.40, +0.30, −0.25 of the strongest cluster weight (1.20, BODY:115), weighted by Body (line block #14). Real formants are fixed in Hz, the cluster is not: a conscious deviation from physics.
- **Following modes (8):** BODY's nasal cluster with Tune-following ratios 1, 2.73, 3.0, 3.29, 6.43, 7.0, 7.61, 10.57 (BODY:114-118) is kept as the identity body: weights/times, float64 energy normalisation (BODY:282-301) and the hybrid beating-pair reshaping (BODY:399-420).
- **Line engine:** none in v1 (N10): no cone waveguide. BODY's reed shaping only: DC-blocked reed contact minus a formant low-pass at min(4.2 kHz, 2.1·f0) (BODY:396-398, :729-741) feeds cluster and formants. The truncated-cone "blowed string" (R10 B1 Scavone; β 0.08, lattice 1.5 kHz) is a v1.1 option.
- **Damping:** Decay 0.12 × 25^d (BODY:189); cluster keeps BODY's per-mode times × Decay at Material 50 (BODY:116, :401); law fitted to them: αG 37.3, αR 0.85, ρ 0.80 (T200 0.18 s); formants Q 8.
- **Contact:** sustain 1.0 (BODY:196). **Calibration:** 1.754 × (0.95 × oboBody) (BODY:833).
- **Depth:** bell (1) −120, body (0) 0, keys (6-9) +120, reed (2) +170.
- **Validation:** cluster peaks at the ratios ±1 %; formant peaks ±3 %; no blow-up at Material 100; the line holds no waveguide for this anchor.

## 10. Sax `SAX` (anchor 9, BODY engine 5)
- **Grid profile:** brass radiation: broad bumps at 1.2 / 2.4 / 3.3 / 4.2 kHz, Q 5-8 (+4 / +3 / +2 / +1 dB) over a floor 9 dB lower, −12 dB/oct above 5 kHz, centred *(design)*.
- **Feature modes (2):** BODY's brass modes 780 Hz (T60 11 ms, Q ≈ 3.9, +0.85/+0.85) and 1750 Hz (T60 6.5 ms, Q ≈ 5.2, +0.65/+0.65) (BODY:550-554).
- **Following modes:** none.
- **Line engine:** BODY's positive full-period loop (BODY:768-826), buffer 4096; output comb at 0.17 of the delay (BODY:501, :804) is already a cone approximation (R10 §3), β = 0.17 as table value (measured 0.15-0.2). Loop low-pass stays 6.6 kHz (BODY:530); the lattice cutoff 1.0 kHz (tenor 760 ± 250, soprano 1340 ± 240 Hz, R10 B4) is a one-pole radiation filter on the pickup outside the loop; tuning LUT. Asymmetric reed, breath noise and formant emphasis kept (BODY:778-790, :807-810). Hybrid role: bell excitation accepts the oboe body (BODY:798-800), same injection point.
- **Damping:** Decay 0.15 × 20^d (BODY:190); radiation bumps αG 0, αR 100 (Q 5 flat), ρ 0.10 (T200 0.055 s).
- **Contact:** sustain 0.78 (BODY:198). **Calibration:** 0.826 × 0.22 × (3.3 pickup + 1.10 breath) (BODY:834).
- **Depth:** rear tube (2) −260, body (0) 0, neck/mouthpiece (3) +140, keys (6-9) +180, bell rim (1) +220.
- **Validation:** full harmonic series at the note; radiation cutoff visible as −6 dB/oct above 1 kHz at the pickup while the loop stays at 6.6 kHz; pitch ±5 ct C2..C5 with LUT.

## 11. Obosaxolele `OBOSAX·` (anchor 10, BODY segment 6→7)
- **Grid profile:** sum of its constituents' gain vectors at BODY's weights (oboe p, sax 1−2p, uke p, p = (morph − 9)/3, BODY:140-143): Uke hump + Sax radiation + Oboe skirt, equal thirds at the end stop.
- **Feature modes:** none of its own; the constituents' slots run at their weights (Uke A0/T1/T2, Sax 780/1750 Hz, Oboe formants), each body within its ≤ 8. **Following modes:** the Oboe cluster with the hybrid beating-pair reshaping (BODY:399-420, :755-764).
- **Line engine:** coupling, not a new engine (BODY:712-734, :798-800, :836-843): shared string engine at the Uke table → Oboe reed input → Sax bell, acyclic and one-way. All BODY constants (0.62, 0.95, 0.90, 0.60, 1.80, −15.6, 1.48, 3.20, 2.20, −3.30, −1.10) become table values with BODY's numbers as defaults. With the new morph order the hybrid segment is 9→10; weights ease from pure Sax into thirds exactly as BODY:136-144.
- **Damping:** each constituent's own (αG, αR, ρ) at its weight.
- **Contact:** hybrid gesture from the line's pluck detector (BODY:717-722, uke contrast law :685-686); held role gains while tails drain. **Calibration:** BODY's 2× endpoint calibration (BODY:839-843) and feed trim ×1.5 (BODY:167-170).
- **Depth:** designed hybrid silhouette (UI:86-97): bell (1) +220, soundbox (0) 0, strings (2-5) +40, reed neck/pegs (6-9) +140.
- **Validation:** acyclic graph (no loop between the three engines); energy at the end stop within ±1 dB of the Sax stop for pink noise.

## 12. Still open (fine questions)
Whether Fiddle gets a mild bow-friction nonlinearity later; the oboe cone and mode-level melt are v1.1 experiments; all *(design)* values are first-listen candidates. Decided: hybrid label `OBOSAX·`, timpani C2..C4 (00_DECISIONS D14, D15).

## 13. Physics map per anchor (20 §15) and striker defaults (20 §14)
Coupling = one-way feed or radiation mix, no bridge reflection (T6). Strikers are DC-blocked and energy-normalised (N11); defaults unchanged.

| anchor | Stiffness | Coupling | Air | Reed | default Excite / striker target |
|---|---|---|---|---|---|
| Bass Drum | head mode stretch B 0..0.02 | head → shell feed 0..0.4 | ideal → air-loaded ratios (1.59→1.50 …), pair split | head tension: glide 0..0.5 oct, (0,1) damping | Through; Hammer into the batter head |
| Snare | head stretch | heads → shell feed, wires sensitivity | air between heads: pair split 0.92/1.10 ↔ 0.97/1.03 | tension; rattle band width | Through; Hammer |
| Timpani | ratio stretch | head → kettle mode feed | kettle load: (0,1) damping, ratio set | tension glide 0..0.3 oct | Through; Hammer (mallet 0.25 radius) |
| Piano | string dispersion −0.6..−0.95 | string → board feed | board air (low-mode gain) | hammer hardness (low-pass 4-12 kHz) | Through; Hammer |
| Guitar | dispersion | string → box feed | A0/T1 coupling and gain | pick hardness | Through; Pluck |
| Ukulele | dispersion | string → box feed | A0/T1 | pick hardness | Through; Pluck |
| Fiddle | dispersion | string → body feed | A0 gain | contact low-pass (bow hair) | Through; Pluck |
| Clarinet | slight dispersion | radiation mix (loop gain stays Decay's) | breath noise 0..0.3 | reed offset/slope | Through; Breath |
| Oboe | cluster ratio stretch | radiation mix; cluster feed | breath noise | reed-contact formant 1..3 × f0 (BODY 2.1, :396) | Through; Breath |
| Sax | slight dispersion | radiation mix | breath noise (BODY `saxBreath`) | reed offset/slope (BODY asymmetry) | Through; Breath |
| Obosaxolele | Uke row | hybrid coupling gains (BODY 0.95/0.60), one-way chain | Sax row | Oboe row | Through; Pluck into the uke bridge |
