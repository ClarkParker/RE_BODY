# 22 — Body concepts: every morph anchor of RE·BODY v1

Companion to `20_DSP_CONCEPT.md` (recipe format §3, damping law §4, parameters §5). Numbers cite `docs/research/10_PM_BODY_RESEARCH.md`
(R10 B4 = measured data table) or the original source (`reference/body_original/dsp.cmajor`, cited BODY:line). Values marked *(design)* are
chosen by us where no open measurement exists; they are the first thing to tune by ear.

## 0. Common rules
- **Anchor order (param4 Morph 0..10):** 0 Bass Drum · 1 Snare · 2 Timpani · 3 Piano · 4 Guitar · 5 Ukulele · 6 Fiddle · 7 Clarinet · 8 Oboe · 9 Sax · 10 Obosaxolele (row label `OBOSAX·`, D14). BODY had seven engines plus the hybrid stop = 8 anchors; RE·BODY has 11. Drums, then strings, then reeds, the hybrid last as in BODY's title. Default Morph = 7 (Clarinet: BODY's init 4.0 in its series (0,1,3,6,2,4,5) is the Clarinet stop, see index.js:313 "Clarinet illustration at rest").
- **Tune (line block #1):** drums use BODY's continuous size law (BODY:177-178); timpani and all pitched bodies use the note law C2..C5 (BODY:179-180). Modes flagged `fixed` ignore Tune and follow Size (line block #11).
- **Decay (param2):** per-body `seconds = base × ratio^decay` exactly as BODY `anchorSeconds` (BODY:183-192) for the original seven; new bodies get the values below. Modal bodies additionally obey the damping law; `ρ = T60(2 kHz) / T60(200 Hz)` at Material 50 is given per body; Material 0 → ρ/4, Material 100 → min(1, 4ρ).
- **Contact:** `sustain` is BODY's per-body constant (BODY:23, :194-201), now the default of Touch (line block #9, 50 = recipe value). Position (line block #12) defaults are per body (50 = recipe value).
- **Loudness:** every modal body is energy-normalised with BODY's closed-form (BODY:282-301); `out_gain` starts from BODY's calibration constants (BODY:831-843) and is re-measured in M1.
- **Mode budget:** ≤48 modes per body, stereo; all bodies keep state (tail holding), see 20 §3.
- **Depth (UI):** z per path for the layer table in `21_UI_CONCEPT.md` §2, back (−) to front (+), at perspective 1600 px.
- **Validation:** each body lists the render-test assertions (impulse and noise excitation, `cmaj render`).

## 1. Bass Drum (anchor 0, BODY engine 0)
- Generator: membrane, two coupled heads with air load. Modes: batter (0,1) at root f0; coupled-head pair for (0,1): f0 × 0.94 and f0 × 1.07 (parallel / antiparallel motion of the two heads, R10 B4 snare/bass-drum rows; split *(design)*); (1,1) 1.594, (2,1) 2.136, (3,1) 2.653 (ideal membrane, BODY:41 uses 1.586/2.128/2.65). Shell: 2 fixed-Hz wood modes 310 and 520 Hz, Q 8 *(design)*. 9 modes.
- Root law: 120 Hz × 2^(−1.68·(1−size)) (BODY:177); onset pitch tightening +0.33 oct × onset kept (BODY:308).
- Decay 0.08 × 20^d (BODY:185); ρ 0.35 (membrane, HF dies first). Material 100 approaches a tight, ringing head.
- Contact: sustain 0.035 (strike only); Position 0.30 of radius → J-weighted mode gains (centre strike mutes (1,1), rim strike mutes (0,1)); contact low-pass 3·f0 + 170 Hz (BODY:326).
- Calibration: wet 1.5 × bass (BODY:856).
- Depth: rear shell (path 2) −300, batter head (1) −40, front hoop (0) 0, tension rods (6-9) +100, feet (5) +60.
- Validation: peaks at f0 × {0.94, 1.07, 1.59, 2.14, 2.65} ±2 %; T60 of (0,1) = Decay seconds ±10 %; |DC| < 0.01.

## 2. Snare (anchor 1, BODY engine 1)
- Generator: membrane pair + shell + rattle. Heads: batter (0,1) at root, coupled pair f0 × 0.92 / 1.10 *(design; literature puts the parallel (0,1) near 180-200 Hz for a 14" drum, R10 B4)*, (1,1) 1.594, (2,1) 2.136. Shell: 2 fixed-Hz modes 450 and 1100 Hz, Q 10 *(design)*. BODY's shell ratios 1.62/2.39 (BODY:41) are retired. 7 modes.
- Rattle: BODY's xorshift noise gated by the batter edge envelope, band 1.4-6.9 kHz, release 0.78 × decay (BODY:327-329, :615-634) kept unchanged; `rattleSustain` law (BODY:267-271) kept; Material also sets the rattle band width (hard = brighter).
- Root law: 310 Hz × 2^(−1.04·(1−size)) (BODY:178). Decay 0.08 × 12.5^d (BODY:186); ρ 0.30.
- Contact: sustain 0.035; Position 0.35 radius; snare wires respond to novelty only (no idle noise, BODY:615).
- Calibration: 1.4 × shell + 2.7 × rattle (BODY:856).
- Depth: shell (0) 0, top head (1) +10, snare wires (2) −60, lugs/rods (3-9) +80.
- Validation: head peaks ±2 %; rattle band energy present only after an onset; silence in → silence out.

## 3. Timpani (anchor 2, new)
- Generator: membrane over a kettle (air-loaded). Principal (1,1) at the note; ratios (1,1):(2,1):(3,1):(4,1):(5,1) = 1 : 1.50 : 1.98 : 2.44 : 2.91 (R10 B4 timpani); the (0,1) mode at 0.81 × (1,1) with a very short T60 (kettle damps it, *(design)* 0.08 s). 6 modes + 1 fixed-Hz kettle-shell mode ~ 160 Hz, Q 6 *(design)*.
- Root law: note law, playable range clamped C2..C4 (timpani compass D2-A3, R10 B4 context).
- Decay 0.5 × 8^d (0.5 s .. 4 s) *(design)*; ρ 0.40.
- Contact: sustain 0.03; Position 0.25 radius (orchestral beating spot favours (1,1)); onset tension glide +0.10 oct × onset *(design, same mechanism as bass drum)*.
- Calibration: via energy normalisation, `out_gain` measured in M1.
- Depth: kettle (2) −280, head (1) 0, counterhoop (0) +20, struts/pedal (6-9) +120.
- Validation: ratio set ±1.5 %; (1,1) at Tune note ±10 ct; (0,1) T60 < 0.15 s.

## 4. Piano (anchor 3, BODY engine 3)
- Line engine: two detuned (±0.09 ct) dispersive strings with hammer low-pass contact and bridge pickup comb, unchanged (BODY:349-366, :658-677); dispersion −0.86/−0.78 as table values.
- Body: soundboard as a dense fixed-Hz modal bank, 40 modes: the FEM low modes 84, 127, 194, 204, 229, 271, 301 Hz (R10 B4 piano) then log-spaced to 4 kHz (mean spacing ≈ 22 Hz below 1.1 kHz is approximated, not matched one by one). Loss factor η 2.3 % → T60 ≈ 96/f s (1.1 s at 85 Hz, 0.1 s at 1 kHz); Material scales η 4.6 % .. 1.15 %. Gains ∝ f^−0.5 with alternating signs; L/R position gains from bass-left/treble-right placement for Width.
- Decay 0.25 × 24^d for the strings (BODY:188); board T60 is physical and only scaled ×0.5..2 by Decay.
- Contact: sustain 0.045, hammer edge × novelty² (BODY:601); Position = hammer strike point 0.12 of string length (sets the pickup comb, BODY:486).
- Body (line block #14) recipe default 45 %: balance string direct vs soundboard.
- Calibration: 0.341 × (17 piano + 0.8 board) (BODY:832) as starting point.
- Depth: lid inner rim (1) −200, strings (3-5) −60, case rim (0) 0, keyboard (2, 6-9) +160.
- Validation: string pitch at note ±5 ct; board peaks at the FEM frequencies ±3 %; T60(1 kHz) 0.1 s ±20 %.

## 5. Guitar (anchor 4, new)
- Line engine: single string loop with pick-position comb (as the Ukulele, BODY:680-710) tuned to the note.
- Body: box = Helmholtz air mode + top plate as a coupled 2-DOF pair solved at control rate (plate 150 Hz, cavity 129 Hz → coupled ≈ 97 / 200 Hz, R10 B1 Christensen; Size shifts both), measured signature modes 103, 205, 286, 436 Hz with Q ≈ 20 (R10 B4 guitar; T60 = 2.2·Q/f → 0.41, 0.23, 0.17, 0.11 s), plus 12 log-spaced modes 500 Hz-3 kHz with η 3 % for the mid-range hump. All fixed-Hz. 18 modes.
- Decay 0.25 × 24^d (string); ρ 0.25 (η constant → T60 ∝ 1/f).
- Contact: sustain 0.045 with BODY's pluck-contrast law (BODY:685-687); Position 0.25 (pick point) → comb; Body recipe default 60 %.
- Depth: back and sides (2) −260, sound-hole cavity (1) −420, top (0) 0, strings (3-6) +40, bridge and pegs (7-9) +120.
- Validation: A0 peak 95-110 Hz, T1 peak 195-210 Hz; string pitch ±5 ct.

## 6. Ukulele (anchor 5, BODY engine 6)
- Line engine: BODY's short string + 0.32-period pick comb + transient contact unchanged (BODY:368-380, :680-710).
- Body: box pair A0 ≈ 230 Hz, T1 ≈ 290 Hz (soprano body resonance ≈ D4 −19 ct, builder data R10 B4 *(design-grade)*), T2 ≈ 480 Hz, plus 8 log-spaced modes 600 Hz-4 kHz; Q ≈ 12-15 (small body, more damped than a guitar but far less than BODY's Q ≈ 6/3.5 at 310/690 Hz, BODY:543-549). All fixed-Hz. 11 modes.
- Decay 0.07 × 12^d (BODY:191); ρ 0.30.
- Contact: sustain 0.025 (BODY: index 6 = 0.025), pluck-contrast law kept; Position 0.32; Body recipe default 50 %.
- Hybrid role: the bridge signal `picked`/wood body feeds the Obosaxolele (BODY:725-727) — keep the same tap.
- Depth: sound-hole cavity (1) −420, body (0) 0, strings (2-5) +40, frets/bridge (6-7) +90, pegs (8-9) +130.
- Validation: A0/T1 peaks ±5 %; pluck → body T60 at 290 Hz ≈ 0.1 s ±30 %.

## 7. Fiddle (anchor 6, new)
- Line engine: single string loop with high sustained feed (bowed character comes from the input, no bow model); Position = bridge-side pickup 0.1.
- Body: violin corpus means A0 275, CBR 407, B1− 475, B1+ 541, A1 469 Hz (R10 B4 violin), Q 30 at A0 *(design within typical range)* → T60 0.24 s; damping law ζ ∝ f^−0.45 (R10 B4) sets ρ; bridge hill: 10 log-spaced modes 1.8-4 kHz, η 4 %. All fixed-Hz. 15 modes.
- Decay 0.2 × 20^d *(design)*.
- Contact: sustain 0.6 (continuous input sustains the string); Body recipe default 70 %.
- Depth: f-hole cavity (1) −420, body (0) 0, strings (2-5) +60, fingerboard (6) +140, bridge (7) +120, scroll/pegs (8-9) +100.
- Validation: A0 and B1± peaks ±3 %; no self-oscillation (loop gain < 1 at all Decay).

## 8. Clarinet (anchor 7, BODY engine 2)
- Line engine: closed cylinder, negative half-period reflection (odd harmonics), reed low-pass + envelope-normalised soft clip, radiation tap half a period apart — unchanged (BODY:335-347, :444-455, :636-656). Lattice cutoff becomes a table value: 1.4 kHz default (measured 1150-1450 Hz, R10 B4; BODY used 1750).
- Body: bell radiation 3 fixed-Hz modes 1.5 / 2.5 / 3.6 kHz, Q 4 *(design)*.
- Decay 0.15 × 20^d (BODY:187); sustain 1.0 (continuous).
- Position: radiation tap offset (default half period).
- Depth: bell (1) −120, bore (0) 0, keys (6-9) +120, mouthpiece (2) +160.
- Validation: odd-harmonic ratio ≥ 12 dB over even at the note; pitch ±5 ct across C2..C5 (phase-delay compensation, BODY:338).

## 9. Oboe (anchor 8, BODY engine 4)
- Line engine (new): truncated-cone "blowed string" (R10 B1 Scavone), blow point β = 0.08 (short mouthpiece volume), lattice cutoff 1.5 kHz (R10 B4), double-reed excitation = BODY's reed shaping with stronger asymmetry *(design)*. Cone half-angle 0.71° is informative only.
- Body: BODY's 8-mode nasal cluster with Tune-following ratios 1, 2.73, 3.0, 3.29, 6.43, 7.0, 7.61, 10.57 (BODY:114-118) is **kept as the identity body**, including its float64 energy normalisation and the hybrid beating-pair reshaping (BODY:399-420). **Conscious deviation from physics:** real formants are fixed in Hz; therefore 4 fixed-Hz formant modes 1.1 / 1.4 / 2.8 / 3.2 kHz, Q 8 *(design)* are added and weighted by Body (line block #14). 12 modes.
- Decay 0.12 × 25^d (BODY:189); sustain 1.0.
- Depth: bell (1) −120, body (0) 0, keys (6-9) +120, reed (2) +170.
- Validation: cluster peaks at the ratios ±1 %; cone series contains even and odd harmonics; no blow-up at Material 100.

## 10. Sax (anchor 9, BODY engine 5)
- Line engine: BODY's positive full-period loop with output comb at 0.17 of the delay is already a cone approximation (R10 §3); β = 0.17 as table value (measured range 0.15-0.2); lattice cutoff 1.0 kHz default (tenor 760 ± 250, soprano 1340 ± 240 Hz, R10 B4; BODY used 6.6 kHz); asymmetric reed, breath noise and formant emphasis kept (BODY:768-826).
- Body: brass modes 780 and 1750 Hz (BODY:550-554) plus 1.2 / 2.4 / 3.3 / 4.2 kHz, Q 5-8 *(design)*, all fixed-Hz. 6 modes.
- Decay 0.15 × 20^d (BODY:190); sustain 0.78.
- Hybrid role: bell excitation accepts the oboe body (BODY:798-800) — keep the same injection point.
- Depth: rear tube (2) −260, body (0) 0, neck/mouthpiece (3) +140, keys (6-9) +180, bell rim (1) +220.
- Validation: full harmonic series at the note; cutoff visible as −6 dB/oct above 1 kHz in the impulse spectrum.

## 11. Obosaxolele (anchor 10, BODY segment 6→7)
- Coupling, not a new engine (BODY:712-734, :798-800, :836-843): Ukulele bridge → Oboe reed input → Sax bell; equal thirds of Oboe/Sax/Uke at the end stop; hybrid gesture from the pluck detector; held role gains while tails drain. All BODY constants (0.62, 0.95, 0.90, 0.60, 1.80, −15.6, 1.48, 3.20, 2.20, −3.30, −1.10) become table values with BODY's numbers as defaults.
- With the new morph order the hybrid segment is 9→10 (Sax → Obosaxolele); weights ease from pure Sax into thirds exactly as BODY:136-144.
- Depth: designed hybrid silhouette (UI:86-97): bell (1) +220, soundbox (0) 0, strings (2-5) +40, reed neck/pegs (6-9) +140.
- Validation: acyclic graph (no loop between the three engines); energy at the end stop within ±1 dB of the Sax stop for pink noise.

## 12. Still open (fine questions)
Whether Fiddle gets a mild bow-friction nonlinearity later; all *(design)* values are first-listen candidates. Decided: hybrid label `OBOSAX·`, timpani C2..C4 (00_DECISIONS D14, D15).

## 13. Physics map per anchor (20 §15) and striker defaults (20 §14)
| anchor | Stiffness | Coupling | Air | Reed | default Excite / striker target |
|---|---|---|---|---|---|
| Bass Drum | head mode stretch B 0..0.02 | head ↔ shell feed 0..0.4 | ideal → air-loaded ratios (1.59→1.50 …), pair split | head tension: glide 0..0.5 oct, (0,1) damping | Through; Hammer into the batter head |
| Snare | head stretch | heads ↔ shell, wires sensitivity | air between heads: pair split 0.92/1.10 ↔ 0.97/1.03 | tension; rattle band width | Through; Hammer |
| Timpani | ratio stretch | head ↔ kettle mode | kettle load: (0,1) damping, ratio set | tension glide 0..0.3 oct | Through; Hammer (mallet 0.25 radius) |
| Piano | string dispersion −0.6..−0.95 | string → board feed, >50 bridge ρ ≤ 0.25 | board air (low-mode gain) | hammer hardness (low-pass 4-12 kHz) | Through; Hammer |
| Guitar | dispersion | string → box, bridge ρ | A0/T1 coupling and gain | pick hardness | Through; Pluck |
| Ukulele | dispersion | string → box, bridge ρ | A0/T1 | pick hardness | Through; Pluck |
| Fiddle | dispersion | string → body, bridge ρ (wolf region near B1 when high) | A0 gain | contact low-pass (bow hair) | Through; Pluck |
| Clarinet | slight dispersion | bell reflection 0.8..0.98 | breath noise 0..0.3 | reed offset/slope | Through; Breath |
| Oboe | slight dispersion | bell reflection; cluster feed | breath noise | double-reed asymmetry 1..2 | Through; Breath |
| Sax | slight dispersion | bell reflection | breath noise (BODY `saxBreath`) | reed offset/slope (BODY asymmetry) | Through; Breath |
| Obosaxolele | Uke row | hybrid coupling gains (BODY 0.95/0.60) | Sax row | Oboe row | Through; Pluck into the uke bridge |

