# 20 — RE·BODY DSP concept (v1 target architecture)

Status: concept, no code yet. Sources: `docs/index/01_BODY_ORIGINAL.md`, `docs/index/04_PHYSIFY.md`,
`docs/research/10_PM_BODY_RESEARCH.md` (cited as R10 §x), platform rules `docs/index/03_AMORPH_PLATFORM.md` (P03 §x).

## 0. Decisions in force (owner, 2026-10-16)
- Stays an Amorph **FX** (`Amorph_FX` binary): audio in → bodies → audio out. No MIDI.
- No provisional solutions: the seven original bodies get real body physics even if their sound changes; identity is kept through the same morph order, contact behaviour and loudness discipline.
- Parameter budget: up to 128 slots; use what the design needs (P03 §1). New parameters are appended, `param1..param5` keep their meaning.
- Telemetry: as many output events as the UI needs.
- CPU: no ceiling during design; measured at the end (cmaj JIT bench as in PHYSIFY `m0/BENCH.md`).
- Credit "based on BODY by Artists in DSP" in manifest description and README.

## 1. How the professionals do it: tables *and* formulas
The research (R10 §1-§2) shows three layers used together by every serious product and paper:
1. **Generator formulas** for idealised objects: membrane (Bessel ratios 1 : 1.594 : 2.136 …, air-loaded timpani 1 : 1.5 : 1.98 : 2.44), plate/soundboard (dense log-spaced sections, constant loss factor η), beam/bar, string (stretched partials), tube (cylinder = odd series, cone = full series). Corpus, Chromaphone, Rings and Faust `physmodels` are built this way (R10 B2, B3).
2. **Measured tables** for real instrument bodies: guitar signature modes 103/205/286/436 Hz with Q≈20, violin A0/CBR/B1−/B1+ corpus means, piano soundboard η≈2.3 % and 22 Hz mode spacing, bore cutoffs 0.8-1.5 kHz (R10 B4). Logic Sculpture, ToneDexter and Bank's parallel-filter method derive bodies from measured responses (R10 B1, B2).
3. **Laws with few parameters** on top: Aramaki damping α(ω)=αG+αR·ω ("Material"), position = cosine mode gains, brightness = upper-mode Q/gain tilt (Rings `resonator.cc`, R10 B3), size = log shift of fixed body resonances (Sculpture Formant Shift).
Nobody hard-codes per-mode literals the way BODY does today, and nobody interpolates filter coefficients directly (R10 B5).

**RE·BODY therefore uses a body *recipe* = generator + measured overrides + material law, compiled offline into flat tables.**

## 2. Signal architecture (per sample, kept from BODY where it is already right)
```
in → NaN guard, DC block, clamp, bypass fade                 (BODY:587-590, keep)
   → onset/novelty detector + "Touch" sensitivity              (BODY:591-594, keep, expose)
   → per-engine feed = f(morph weights), tail holding          (BODY:126-172, keep)
   → LINE engines (waveguides) → MODAL body bank → calibration
   → shared stereo balance, input-referenced protector, knee   (BODY:844-889, keep)
   → mix → out ; meters + telemetry events
```
Two engine families, both table-driven:
- **MODAL body bank** (one structure, N slots): drum heads and shells, snare rattle shell, piano soundboard, guitar/ukulele box (Helmholtz + plate pair + signature modes), fiddle body, sax brass body, oboe nasal cluster, air modes. Complex one-pole (phasor) modes as in BODY:604-613 — click-free under modulation by construction (R10 B1 Mathews/Smith, Laroche).
- **LINE engines** (fractional-delay loops): clarinet cylinder (BODY:636-656), sax and optionally oboe as truncated-cone "blowed string" with blow-point β and lattice cutoff as table values (BODY:768-826, R10 B1 Scavone), piano string pair with dispersion (BODY:658-677), ukulele string with pick comb (BODY:680-710).
- Coupling line → body is one-way (commuted-synthesis argument, R10 B1 Bank 2010 / Smith). The Obosaxolele coupling stays acyclic as in BODY:712-734. A passive 3-port bridge (PHYSIFY `DSP:2907-2955`) is reserved for a later "wolf" option.

## 3. Body recipe and table format
Offline tool `tools/bodytab.py` (Python, stdlib + numpy) turns `bodies/*.json` recipes into flat Cmajor arrays and a UI JSON mirror.
Recipe (per body):
```
name, generator (membrane|plate|box|bar|tube_body|cluster), nModes (≤48),
anchor: { root_hz_law: drum|note, decay_seconds_at_50 },         # keeps BODY's Tune/Decay feel
material: { alphaG, alphaR, eta },                                 # damping law anchors (R10 B4)
modes[]: { f (ratio or fixed Hz), fixed:bool, t60_mult or eta, gain, posL, posR, flex }
line: { kind: none|cylinder|cone|string|string_pair, beta, cutoff_hz, dispersion, reed:{...} }
contact: { sustain, novelty_power }                                # BODY per-body "sustain" (BODY:23,194-201)
calibration: { out_gain, energy_target }                           # BODY:831-843, :427
```
`fixed:true` marks resonances that do **not** follow Tune (real body resonances do not move with the played note, R10 B1 Woodhouse); `Size` (param7) scales them instead.
Emission strategy (to validate with `cmaj` first, PHYSIFY note on large literals): namespace-scope constant arrays, else processor members assigned at `main()` start. Manifest `externals` only if Amorph is shown to load them.
Capacity: 48 modes × ~11 bodies ≈ 530 complex stereo modes ≈ 1 % of one core at 48 kHz by PHYSIFY's bench (R10 §4 cost basis); tail-holding means every body can carry state, so the bank is sized for all bodies, not two.

## 4. Damping law and the Material axis
Per mode: `T60 = ln(1000) / (αG + αR·ω)` with per-body (αG, αR) presets, scaled by Decay (param2, log as BODY `anchorSeconds`) and tilted by Material (param6): 0 = damped/soft (αR high, soundboard-like η 3 %), 50 = recipe default, 100 = hard/ringing (αR low, metal/bell-like). Anchors: soundboard η≈2.3 % → T60≈96/f s; violin corpus ζ∝f^−0.45; membranes short, metal long (R10 B4, PHYSIFY `DSP:568-585`). Control rate only (one `exp` per mode per 32 samples, BODY's stepping idiom).

## 5. Parameters (append-only after the original five)
| id | name | range / init | DSP meaning | UI |
|---|---|---|---|---|
| param1 | Tune | 0..100 / 58 | as BODY (drums continuous, pitched bodies note-quantised C2..C5) | main dial |
| param2 | Decay | 0..100 / 50 | global αG scale, log seconds as BODY | main dial |
| param3 | Mix | 0..100 / 45 | dry/wet | main dial |
| param4 | Morph | 0..N / 4 | body position; anchors table shared with UI | hero slider |
| param5 | Bypass | 0/1 | as BODY | switch |
| param6 | Material | 0..100 / 50 | damping-vs-frequency law (§4) | main dial |
| param7 | Size | −100..100 / 0 | log shift of fixed-Hz body resonances ±1 octave (Sculpture Formant Shift) | advanced |
| param8 | Position | 0..100 / per-body default | excitation point: cosine mode gains, string pick / cone blow point β | advanced |
| param9 | Bright | 0..100 / 50 | contact low-pass + upper-mode gain tilt (Rings brightness law) | advanced |
| param10 | Body | 0..100 / per-body | balance line engine ↔ modal body, air-mode amount for boxes | advanced |
| param11 | Width | 0..100 / 50 | stereo: L/R position offsets of mode gains | advanced |
| param12 | Touch | 0..100 / 50 | onset sensitivity vs sustained excitation (BODY per-body `sustain` made adjustable) | advanced |
| param13 | Stretch | −100..100 / 0 | mode spacing around 1 kHz (Sculpture Formant Stretch) | advanced |
All event handlers NaN/Inf-guarded and clamped (BODY:120-124); smoothing via BODY's 32-sample target stepping; ids exactly `paramN` (P03 §2a).

## 6. Morph
- Anchor order v1: Bass Drum, Snare, Piano, Ukulele, Clarinet, Oboe, Sax, **new bodies inserted here**, Obosaxolele last (hybrid "ends" the line as in BODY's title). Candidate new bodies: Guitar (measured signature modes + A0/T1 pair), Fiddle (violin corpus means), Timpani/Tom (air-loaded coupled heads). Final list and order = fine question.
- Between two modal-bank bodies: **mode-level melt** — tables sorted by frequency, rank-paired, polar interpolation of log f, log T60 and gain, stepped every 32 samples (R10 B5, PHYSIFY `CORE:148-165`).
- Between a line engine and anything: BODY's sqrt-weight energy crossfade with tail holding (BODY:147-172, :203-272).
- Hybrid segment: BODY's acyclic coupling (uke bridge → oboe cluster → sax bell) retained.
- Shared register/decay blending across active bodies as BODY:203-272.

## 7. Engine gating and loudness
- Skip a line or modal engine when its weight is 0 and all its states are below the flush threshold (BODY already flushes <1e-12).
- Loudness: generalise BODY's closed-form modal energy normalisation with cross terms (BODY:282-301) to every modal body, cached at control rate; per-body `out_gain` from the recipe; balance + protector + knee unchanged.
- Modal feedback never exceeds |r|<1 by construction; DC-block wet per channel (P03 §2c).

## 8. Telemetry (output events, ~30 Hz, all cheap host-rate meters)
| endpoint | type | content | UI use |
|---|---|---|---|
| bodyViz | float<4> | input, wet, L, R peaks (BODY compat) | lamp, breathing |
| bodyBands | float<8> | wet energy in 8 log bands (one-pole bank, 60 Hz-10 kHz) | layer vibration modes |
| bodyOnset | float | `onset` 0..1 (BODY:593) | strike push, ripple |
| bodyEngines | float<16> | wet energy per anchor body | morph slider weight bars |
| bodyModes | float<16> | energy of the 16 loudest modes of the dominant body | standing-wave markers on the contour |
| bodyRegister | float<2> | shared root Hz, shared T60 s | captions (note name, seconds) |

## 9. Validation plan (ported from PHYSIFY tooling, R10 §4 rec. 8)
- `cmaj test`: tables finite and sorted, every |r|<1, row sums, recipe → coefficient round trip.
- Render tests (`cmaj render`, init-patching trick from `tools/golden_ci.py`): impulse and zero-mean noise per anchor at default and extreme Decay/Material → peak positions vs table, band T60, A0 peak for boxes, |DC|<0.01, finite decay, tri-rate 44.1/48/96 kHz.
- Amorph `run_qa_probe` conditions (P03 §2c), then listening.
- CPU: bench at the end, JIT, 48 and 96 kHz, all bodies with tails active.

## 10. Milestones
M0 recipe format + `bodytab.py` + table emission validated in `cmaj` · M1 unified modal bank replacing BODY's modal parts with recipes that reproduce the original voicings · M2 damping law + Material/Size/Position/Bright/Body/Width/Touch/Stretch · M3 cones and lattice cutoffs, dense soundboard, box air modes · M4 new bodies · M5 telemetry · M6 tests, QA probe, CPU bench.

## 11. Fine questions (later)
New body list and anchor order; Oboe as cone or cluster; per-body Touch defaults; whether Stretch stays; Decay range in seconds per body.
