# 06 - P3 physics knobs (DSP)

Owner: DSP worker (P3). Files: `src/dsp/50_line.cmajor` (updatePhysics, buildShape, the retune and step functions), `src/dsp/90_main.cmajor` (hands the smoothed global Width to the lines), `src/dsp/40_modal.cmajor` (additive: `stretchHz`, `setLawShaped`, `setBodyShaped`), `bodies/*.json` (new `physics` block), `tools/bodytab.py` (schema, tables, `bodies.json` mirror), generated `src/dsp/10_tables.cmajor`, `tests/tables_data.cmajor`, `plugin/bodies.json`, `plugin/dsp.cmajor`. Inputs: concept `20_DSP_CONCEPT.md` sections 4, 5, 15, `22_BODIES.md` sections 0 and 13, `05_LINE_A.md` (what was inert), R10 B1 (Helmholtz 2-DOF) and B3 (Rings resonator), `04_PHYSIFY.md` section 2 (stiff string pair, banded, reed).

All ten knobs and the in-body part of Width are read from the line's parameter block (`l.control`, already smoothed 55 ms per tick) at the 32-sample control tick (BODY:579). Gains move as `analysis::Ramp` (linear over the tick, snap at the next), filter coefficients and shaping constants are set per tick, slot-body shapes are rebuilt only when a knob, the root, the seconds, Material or Size changed (`knobEpoch`). Nothing was added to the sample loop that is not behind a knob test, except the always-present bore dispersion allpass (section 9).

## 0. Status per item (task block, UI location)

UI location: Touch = small dial in strip 1; Position, Bright (contact group), Size, Body, Stretch (body group), Stiffness, Coupling, Air, Reed (physics group) = mini dials in strip 2 behind MORE; Width = small global dial. Parameter ids: line A `param13 / 16 / 17 / 18 / 19 / 20 / 21 / 22 / 23` (Touch, Position, Bright, Body, Stretch, Stiffness, Coupling, Air, Reed), line B +23, line C +46; Width `param6`.

| # | item | status | where it acts |
|---|---|---|---|
| 1 | Touch | done | `touchSustain` in `updateBodyControls`: sustain of every body (contact law, rattle, string, reed) |
| 2 | Position | done | strings: pick comb / piano pickup tap; drums: Bessel gains; bores: radiation tap; oboe and hybrid cluster: cosine gains |
| 3 | Bright | done | contact low-pass (drums, strings, clarinet, sax) and the +-6 dB/oct tilt on slots and grid |
| 4 | Body | done | equal-power direct / body balance per body (`bodyBalance`, ramps `engMul`, `slotMul`, `gridMul`) |
| 5 | Stretch | done | grid poles (`setLawShaped`), feature slots and following ratios (`setBodyShaped` multipliers) |
| 6 | Stiffness | done | string and piano dispersion, drum / cluster ratios, bore dispersion allpass |
| 7 | Coupling | done | feed multiplier string / bore / head into the body; bores: radiation mix |
| 8 | Air | done | boxes 2-DOF, drum ratio blend, piano / fiddle low-mode gain, sax / clarinet / oboe breath |
| 9 | Reed | done | bore reed shaping, drum head tension, string and piano contact hardness, oboe contact formant |
| 10 | Width | done | string and piano L/R detune, bore tap L/R offset (above 50), plus the existing mid/side on the sum |
| 11 | Obosaxolele out / engine / body gain | done | section 6 |
| 12 | gating, loudness, calibration intact | done | section 7 (gate at defaults, A/B renders), section 8 (sweeps) |

## 1. Rules of the mapping

- Every physics knob is 0..100 with 50 = the recipe value (Stretch -100..100, 0 = recipe). `map3 (k, lo, mid, hi)` (piecewise linear) and `map3Log` (geometric) return exactly `mid` at 50, so with every knob at rest the P2 numbers are reproduced bit for bit (section 7). Ranges are recipe data (`physics` block), not literals in the DSP.
- Where a recipe has no value for a quantity (bores have no dispersion, the sax has no reed low-pass, the clarinet has no breath) the default is the neutral value and the knob acts on one side of 50 only; those cases are listed in section 9.
- Position and Bright move energy between the slots; `buildShape` rescales the knob-driven gains so the energy of the body is kept (`sqrt (E_recipe / E_shaped)`, clamped 0.25 .. 4), the grid is normalised after the tilt anyway. Air and Coupling change level on purpose.
- One-way coupling stays (D31): no bridge reflection anywhere.

## 2. Mapping table: knob x body family

`k` = knob 0..100, `m3` = `map3`, `m3L` = `map3Log`. "50" = recipe value.

| knob | strings (piano, guitar, uke, fiddle) | drums (bass, snare, timpani) | bores (clarinet, sax) | modal-only: oboe, hybrid cluster |
|---|---|---|---|---|
| **Touch** | sustain `s0` of the body: `s0 * 0.1^((50-k)/50)` for k < 50, `s0 * (1/s0)^((k-50)/50)` for k > 50 (0 = strike only, 100 = always on); enters x * feed * (s + (1-s) * novelty), the snare rattle floor and the string contact | same | same (clarinet, sax recipe sustain 1.0 / 0.78: 0 gives 0.1 / 0.078) | same |
| **Position** | pick comb / pickup tap beta = `m3 (k, 0.05, beta0, 0.5)` periods (beta0: piano 0.11, guitar 0.25, uke 0.32, fiddle 0.10): comb `contact - 0.92 * contact(z^-beta T)` (BODY:376, :689-690), piano tap `tap - 0.58 * tap(beta d)` (BODY:675); the shared string blends the rows by weight | following-mode gains `J_m (j_mn r) / J_m (j_mn r0)` (clamped +-4), `r = m3 (k, 0.05, r0, 0.9)`, r0 = 0.30 / 0.35 / 0.25 (22 s1-s3, tables `followBesselOrder`, `followBesselZero`); energy compensated | clarinet: radiation tap offset `m3 (k, 0.1, 0.5, 0.9)` periods behind the loop read (BODY:345); sax: pickup tap `m3 (k, 0.05, 0.17, 0.5)` of the delay (BODY:501) | cosine gains `abs (cos (pi n (p - p0)))`, n = 0-based index of the slot in its group (feature / following), `p = m3 (k, 0.15, p0, 1)`, p0 = 0.5 (0.32 hybrid); energy compensated (Rings `resonator.cc`); the range is asymmetric on purpose, `abs (cos)` is symmetric about p0 and a symmetric range would give the same gains at 0 and at 100 |
| **Bright** | pick / hammer low-pass = Reed base x `m3L (k, 0.357, 1, 2.857)` (+-1.5 oct), clamped 2 .. 16 kHz; upper-mode tilt of the slots and the grid, `+-6 dB/oct` above 1 kHz at 100 / 0 (gain factor clamped 0.063 .. 15.8) | bass / timpani contact low-pass `(3 f0 + 170 Hz)` (BODY:326) x `m3L (k, 0.5, 1, 2)`; snare: both rattle band edges (BODY:327-328) x the same; tilt on the grid (the head modes are below 1 kHz) | clarinet reed low-pass 2.5 kHz x `m3L (k, 0.5, 1, 2)`; sax: new reed contact low-pass `20 kHz * 0.075^((50-k)/50)` below 50 (1.5 kHz at 0), none at >= 50; tilt on slots and grid | tilt only (the contact formant is Reed's) |
| **Body** | equal-power balance `cos / sin` of `b = m3 (k, 0, b0, 1) pi/2` between the engine pickup (direct) and the modal body (slots and grid), each normalised to its recipe value (b0 = `bodyDefault`: piano 0.45, guitar 0.6, uke 0.5, fiddle 0.7); 0 = engine only, 100 = body only | direct = the slot modes (heads, shells), body = the grid (shell air); the snare rattle is not balanced | clarinet: engine pickup vs grid; sax: pickup + breath vs slots + grid | direct = cluster and formant slots, body = grid |
| **Stretch** | features: `f' = 1000 (f / 1000)^(1+s)`, `s = k/100 * 0.3` (k in -100..100); the grid poles the same (`setLawShaped`) | grid and shell feature slots as left; following ratios `r^(1+s)` (the root stays) | grid; the sax also its two brass feature slots (780 / 1750 Hz) | grid, formant features around 1 kHz, cluster ratios `r^(1+s)` |
| **Stiffness** | dispersion allpass coefficient `m3 (k, lo, a0, hi)`: piano -0.60 / -0.86 / -0.95 (the second string keeps the +0.08 spread), guitar 0 / -0.30 / -0.75, uke 0 / 0 / -0.85, fiddle 0 / -0.15 / -0.60; delay compensated by `allpassPhaseDelay` | following ratios `r sqrt ((1 + B r^2) / (1 + B))` (the tuned mode stays), `B = m3 (k, -0.008, 0, 0.02)` | allpass in the loop `m3 (k, +0.8, 0, -0.8)` (+ = flat upper partials like a real bore, - = sharp), delay compensated | cluster ratios, `B = m3 (k, -0.0008, 0, 0.002)` |
| **Coupling** | feed multiplier `m3 (k, 0, 1, 2)` on the engine pickup that excites slots and grid (`exc`) | feature (shell, kettle) slot gain and the head feed into the grid `m3 (k, 0, 1, 2)` | feed multiplier as strings, and the radiation mix: below 50 the direct comb pickup is mixed in (`out = rad + (1 - k/50) (comb - rad)`), above 50 the radiation filter cutoff falls to x 0.36 (log) | formant slot gain and grid feed `m3 (k, 0, 1, 2)` |
| **Air** | guitar, uke: 2-DOF plate / Helmholtz solve, kappa x `m3 (k, 0, 1, 2)` (section 3); piano: gain of the 3 lowest FEM slots `m3 (k, 0.25, 1, 2)`; fiddle: A0 gain the same | following ratios `r (alt / r)^t`, `t = m3 (k, -0.5, 0, 1)` towards the alternate (air-loaded or ideal) set in the recipe, pair split included | sax: breath noise x `m3 (k, 0, 1, 2.5)` (BODY:777-790); clarinet: breath noise on the reed input `m3 (k, 0, 0, 0.3)` x 3 x (band-passed noise x reed envelope) | breath noise on the reed contact `m3 (k, 0, 0, 0.3)` |
| **Reed** | contact low-pass base `m3L (k, 2000, 5600, 12000)` Hz (piano 4000 / 8200 / 12000), Bright tilts it | head tension: onset glide `m3 (k, 0, g0, g1)` oct (bass 0 / 0.33 / 0.5, snare 0 / 0 / 0.25, timpani 0 / 0.1 / 0.3) and the T60 of the (0,1) batter mode x `m3 (k, 0.6, 1, 1.7)` | clarinet: soft-clip strength `m3L (k, 0.3, 0.9, 2.5)` (BODY:649) and asymmetry `m3 (k, 0, 0, 0.15)`; sax: reed slope `m3L (k, 0.15, 0.6, 1.6)` and asymmetry `m3 (k, 0, 0.12, 0.35)` (BODY:790) | reed-contact formant `m3 (k, 1, 2.1, 3) x f0` (BODY:396) |
| **Width** (above 50, `u = (W - 50) / 50`) | L / R delay of the string and piano loops x `2^(+-3 ct u / 1200)` | - | tap L / R offset `+-0.12 u` of the radiation tap | - |
| **Width**, modal part of every body (above 50) | odd / even mode split of the slots (even slots left, odd right: drive L x (1 + 0.5 u), R x (1 - 0.5 u)) and of the grid poles (the same on even / odd poles, before the normalisation) | same | same | same |

Precedents: Touch BODY:23, :194-201; Position BODY:376, :486, :501, R10 B3 (cosine mode gains), PHYSIFY pickup comb `DSP:3019-3037`; Bright BODY:326, R10 B3 (brightness = upper-mode tilt); Stretch Sculpture Formant Stretch; Stiffness BODY:70, :357-358, PHYSIFY StifKarp chain `DSP:1071-1093`; Air R10 B1 (Christensen & Vistisen), BODY sax breath BODY:777-790; Reed BODY:649, :790, :396, STK reed (PHYSIFY `DSP:2777-2814`); Width concept 20 s5.

## 3. Air of the boxes: the 2-DOF solve

`helmholtzModes (fp, fh, kappa, rad)` at control rate, in float64: with `S = fp^2 + fh^2`, `D = sqrt ((fp^2 - fh^2)^2 + 4 kappa^2 fp^2 fh^2)` the coupled frequencies are `f-^2 = (S - D) / 2` (A0) and `f+^2 = (S + D) / 2` (T1); `phi = 0.5 atan2 (-2 kappa fp fh, fp^2 - fh^2)` gives the eigenvectors in (plate, cavity), upper `(cos phi, sin phi)` (anti-phase), lower `(-sin phi, cos phi)` (in phase). The string drives the plate, the output is plate + `rad` x cavity, so a mode has gain `up (up + rad uh)`. `helmholtzShape` evaluates this at the recipe kappa and at `kappa * m3 (Air, 0, 1, 2)` and returns the ratios, which go into slot 0 and 1 as frequency multipliers (`hzMul`) and gain multipliers: Air 50 is exactly the recipe A0 / T1, Air 0 uncouples the cavity (the A0 gain falls to 0 because the string no longer drives it), Air 100 doubles kappa (guitar: A0 down to 83 Hz with its gain x 1.9, T1 up to 214 Hz with its gain x 0.76). Because the sum of omega^2 is conserved by this form, the R10 example (plate 150 Hz, cavity 129 Hz -> 97 / 200 Hz) cannot be reproduced; the recipe therefore stores the uncoupled pair that lands on the recipe modes: guitar plate 201.376 Hz, cavity 109.916 Hz, kappa 0.3 -> 103 / 205 Hz; ukulele plate 283.5 Hz, cavity 237.965 Hz, kappa 0.15 -> 230 / 290 Hz (`physics.air`, `cavity_radiation` 0.8, design values).

## 4. Recipe schema additions (`rebody.recipe/1`, `physics` block, required for all 11 recipes)

```
"physics": {
  "touch":     {"strike_factor": 0.1},
  "position":  {"kind": "bessel|cosine|comb|pickup|bore_tap", "min": .., "max": ..},       // 50 = contact.position
  "bright":    {"tilt_db_oct": 6, "pivot_hz": 1000, "lp_scale": [lo, hi], "lp_clamp_hz": [2000, 16000], "lp_base_hz": ..},
  "stretch":   {"max": 0.3},
  "stiffness": {"kind": "membrane|dispersion|bore|cluster", "min": .., "default": .., "max": .., "spread_b": ..},
  "coupling":  {"kind": "feed", "min": 0, "default": 1, "max": 2, "radiation_direct_at_0": .., "radiation_cut_scale_at_100": ..},
  "air":       {"kind": "ratio_blend|helmholtz_2dof|mode_gain|breath_noise", "min": .., "default": .., "max": ..,
                "alt_ratios": [..], "plate_hz": .., "cavity_hz": .., "kappa": .., "cavity_radiation": .., "low_modes": n},
  "reed":      {"kind": .., "min": .., "default": .., "max": .., "aux_min": .., "aux_default": .., "aux_max": ..},
  "width":     {"detune_ct": 3, "tap_offset": 0.12, "split": 0.5}
}
```
`bodytab.py` (generator 1.1.0) validates the block (`validate_physics`: kinds, `stiffness.default == line.dispersion`, `spread_b == dispersion_b - dispersion`, `contact.position` inside the position range, one alternate ratio per following mode for `ratio_blend`, kappa < 0.95) and emits these extension tables, all indexed by body: `touchStrike`, `posKind` (int: 0 none, 1 comb, 2 pickup, 3 bore tap, 4 Bessel, 5 cosine), `posLo`, `posHi`, `brightTilt`, `brightPivotHz`, `brightLpLo`, `brightLpHi`, `brightClampLo`, `brightClampHi`, `brightBaseHz`, `stretchMax`, `stiffLo`, `stiffMid`, `stiffHi`, `stiffSpread`, `coupLo`, `coupHi`, `coupRadDirect`, `coupRadCut`, `airKind` (int: 0 none, 1 ratio blend, 2 helmholtz, 3 mode gain, 4 breath), `airLo`, `airMid`, `airHi`, `airPlateHz`, `airCavityHz`, `airKappa`, `airCavityRad`, `airLowModes` (int), `airAltRatio[body * 10 + i]`, `reedLo`, `reedMid`, `reedHi`, `reedAuxLo`, `reedAuxMid`, `reedAuxHi`, `widthDetuneCt`, `widthSplit`, `widthTapOffset`. `plugin/bodies.json` carries the numeric `physics` of every body (without the `src` strings) for the UI. The meaning of lo / mid / hi per family is the table of section 2; `physics_map` (strings) stays as the documentation per anchor.

Modal API additions (additive, `setLaw` and `setBody` unchanged and delegating): `stretchHz (hz, s)`, `setLawShaped (..., stretch, hold)`, `setBodyShaped (..., hzMul[18], t60Mul[18], positionGain[18], spread[18], hold)`. The multipliers enter the cached slot normalisation through a checksum key; `positionGain` and `spread` (L drive x (1 + s), R drive x (1 - s)) are applied after it as before. `tests/modal.cmajtest` got three tests (stretch law, grid stretch 0 = `setLaw` and stretch moves the poles, shaped body with unit multipliers = `setBody`, frequency / T60 multipliers and the L/R spread act): 25 functions pass (22 + 3).

## 5. Table row semantics that need a remark

- `bodyDefault` is now read (P2 took the balance as 1): the Body knob balances around it, and at 50 every multiplier is exactly 1, so the calibration of P2 (`out_gain`, `engine_gain`, `body_gain`) is untouched.
- The recipe `line.dispersion` of the clarinet and the sax (-0.05) was never read by the P2 engines and still is not: the bore allpass is 0 at Stiffness 50 (`stiffMid` 0), the recipe value stays documentation of the "slight dispersion" range.
- `tables::onsetGlideOct` is superseded by `reedMid` for the three drums (they are equal), the Reed knob moves it.

## 6. Obosaxolele: its own out_gain / engine_gain / body_gain (open item of 05 section 9.1, item 11)

Before: the three values of the row were not read anywhere (the end stop ran on the constituents' terms; render bit-identical for `out_gain` 0.25 / 0.6 / 1.0). Now `updatePhysics` forms `hybrid = smoothstep01 (Morph - 9)` (the hybrid ramp), `hybridEngine = 1 + hybrid (out_gain engine_gain - 1)` and `hybridBody = 1 + hybrid (out_gain body_gain - 1)`. `hybridEngine` multiplies the engine terms of the ingredients that live in the hybrid (string pluck / wood / picked held role through `engMul` of the Ukulele, sax pickup, breath and warm through `engMul` of the Sax), `hybridBody` multiplies their body terms (oboe slots and the remaining slot banks through `slotMul`, the grid share through `gridMul`). At the recipe values 1 / 1 / 1 both factors are exactly 1 (the render at the default is the P2 render), at Morph 10 they are exactly the row values, in between they follow the hybrid amount.

Re-check of the Obosaxolele (48 kHz, Morph 10, recipe copies, pink LUFS and impulse metrics; BODY: LUFS -26.6, T60@2k 0.351 s, peak -7.6 dBFS):

| out / engine / body | pink LUFS | impulse peak dBFS | T60@125 / 250 / 500 / 1k / 2k / 4k / 8k s |
|---|---|---|---|
| 1 / 1 / 1 (recipe) | -26.43 | -10.97 | 1.167 / 1.133 / 1.030 / 0.806 / **0.114** / 0.052 / 0.023 |
| 1 / 1 / 2 | -25.60 | -6.41 | 1.153 / 1.123 / 1.028 / 0.791 / 0.118 / 0.052 / 0.026 |
| 1 / 1 / 4 | -24.91 | -0.97 | 1.146 / 1.116 / 1.027 / 0.791 / 0.118 / 0.052 / 0.026 |
| 1 / 0.5 / 1 | -26.55 | -12.43 | 1.153 / 1.123 / 1.028 / 0.791 / 0.118 / 0.052 / 0.026 |
| 1 / 0.3 / 1 | -26.59 | -12.89 | 1.147 / 1.117 / 1.027 / 0.793 / 0.118 / 0.052 / 0.026 |
| 0.8 / 1 / 3 | -25.47 | -5.21 | 1.149 / 1.118 / 1.028 / 0.794 / 0.118 / 0.052 / 0.026 |

The three values now act (level and the engine / body balance move the pink LUFS by 1.7 dB and the impulse peak by 12 dB over the range), but **T60 at 2 kHz is not a function of them**: 0.114 .. 0.118 s over every combination against BODY's 0.351 s. The 2 kHz ring of BODY comes from the time-varying pair radiation weights (BODY:755-764), which the modal API still cannot express (per-mode output gains over time) and which P2 left unported; `energy_target` is the only calibration that moves it (0.4496 gives 0.191 s at +1.3 dB LUFS, 05 section 9.2). The recipe values were therefore **not changed** (1 / 1 / 1, LUFS gate +0.22 dB at 48 kHz as before); the item stays open for the pair-weight port (P4b / M1).

## 7. Calibration intact: the gate at defaults and A/B renders against P2 (item 12)

`python3 tools/bodytab.py && python3 tools/build_dsp.py && cmaj generate --target=cpp --output=/dev/null plugin/RE_BODY.cmajorpatch` (Loaded: RE-BODY), `python3 tools/render_ci.py run --quick` and `compare --gate` (48 kHz, passed), then the full `python3 tools/render_ci.py run` (165 renders, 3 rates, 2 min) and `python3 tools/render_ci.py compare --gate`: **exit 0, every anchor PASS at 44.1 / 48 / 96 kHz**, no render flags. dLUFS re BODY at 44.1 / 48 / 96 kHz (P2 value of 05 section 9.1 in brackets where it differs by more than 0.005):

| anchor | dLUFS 44.1 / 48 / 96 k | ring f0 vs BODY, ct |
|---|---|---|
| Bass Drum | +0.29 / -0.11 / -0.20 | +0.4 / +0.4 / +0.5 |
| Snare | +0.05 / -0.06 / -0.18 | n/a |
| Piano | +0.06 / +0.40 / +0.04 | n/a |
| Ukulele | -0.30 / -0.35 / +0.29 | +3.6 / +3.6 / +4.0 |
| Clarinet | -0.11 / -0.19 / -0.21 | -0.8 / -0.8 / -0.9 |
| Oboe | +0.06 / +0.05 / +0.05 | -2.1 / -2.0 / -2.0 |
| Sax | -0.41 / -0.47 / -0.44 | -0.7 / -0.8 / -0.7 |
| Obosaxolele | -0.21 / +0.22 / +0.24 (-0.23 / +0.21 / +0.24) | -0.6 / -0.5 / -0.4 |
| Timpani, Guitar, Fiddle (vs the mapped mean) | -1.66 / -1.75 / -1.94, -1.88 / -1.94 / -1.60, +1.18 / +1.09 / +0.88 | - |

The numbers are those of P2 (the Obosaxolele moves by 0.02 dB through the bore allpass, below the +-0.1 dB limit). `cmaj test tests/modal.cmajtest tests/tables.cmajtest tests/helpers.cmajtest`: 3 files pass (modal: the 22 functions of P2 plus 3 new); `preflight.py plugin --strict` (kit worktree): 0 errors, 0 warnings, All clear. `python3 tools/render_ci.py check three-line-protector --gate` (lines B and C enabled with line A): PASS, loudness reduction -0.06 dB (its stored result was still the P1 "wet silent" stub). `tools/golden/re_body_latest.json`, `tools/golden/re_body_checks.json` and the generated blocks of `04_RENDER_CI.md` were regenerated by these runs.

A/B against the P2 build (scratch script, same patch with the P2 `dsp.cmajor`, every knob at its default, pink noise and unit impulse at 48 kHz, pink noise at 44.1 and 96 kHz, 44 render pairs): Bass Drum, Snare, Timpani, Piano, Guitar, Ukulele and Oboe are **bit-identical** (28 pairs, maximum difference 0.0). Clarinet, Sax and the Obosaxolele differ in the float rounding of the bore loops (the allpass is now always in the loop, section 9): RMS change -0.0005 .. +0.046 dB (impulse) and -0.0003 .. +0.018 dB (pink). The Fiddle differs by -82 dB RMS (peak 1.7e-6 on the impulse) only through the Clarinet: in the render the patch starts with the Morph default 7 and glides to 6, a small Clarinet weight is still left at the strike and its loop leaks into the Fiddle render at -67 dB (also in the P2 build). The bore pickup is read at the loop delay, which is now one sample shorter on the first pass (the allpass sits in the feedback path, its delay is taken out of the read delay), so the leak is one sample earlier. With the Clarinet forced off in both builds the Fiddle renders are bit-identical (impulse and pink).


## 8. Sweep results

Scratch scripts `sweep.py`, `report.py` (session scratchpad `p3/`, not in the repo; they use `tools/render_ci.py`: stimuli, lead-in, `analyze`): every anchor (Morph 0..10, Decay 50, Material 50, Mix 100), pink noise (2 s, -20 dBFS RMS, then 2 s silence) and the unit impulse (at 0.5 s, 4 s) at 48 kHz, each of the ten knobs at 0 and 100 (Stretch -100 / +100, Width 0 / 100) with all others at their defaults, plus the all-default render: 462 renders. Asserted for every render: finite, no NaN, peak below 0 dBFS (strictly), |DC| < 0.01, decaying (impulse: RMS of the last 0.5 s of the 4 s render below half of the first 0.5 s after the strike; pink: RMS of the last 0.5 s below half of the 2 s active part). **Result: 462 renders, 0 assertion failures (largest peak 0.9999 = -0.00 dBFS, the unit impulse through the protector knee, largest |DC| 9.8e-05).**

Effect metric per cell (knob at 0 against 100, the cell shows the metric with the largest change in units of its threshold, `tag value@0 > value@100`): `c` spectral centroid of the impulse response, first second (Hz, threshold 0.02 octave), `p` spectral centroid of the pink output (Hz, 0.02 octave), `L` pink LUFS (dB, 0.3 dB), `i` impulse RMS (dBFS, 0.3 dB), `r` L/R correlation (0.02), `Tn` octave-band T60 at n Hz (ms, 5 %), `f` shift of the largest matched spectral peak of the impulse response (Hz, 10 ct; peaks of the whole spectrum and of 30 .. 1000 Hz). A cell counts as measurable when its largest change reaches the threshold.

| knob | Bass | Snare | Timp | Piano | Guitar | Uke |
|---|---|---|---|---|---|---|
| Touch | L -32.8>-15.5 | p 4650>1169 | L -30.8>-16.1 | L -38.9>-21.0 | L -35.2>-21.1 | L -36.5>-22.0 |
| Position | p 98>148 | p 2907>3894 | c 172>231 | p 690>314 | p 1649>652 | p 3603>867 |
| Bright | p 89>103 | p 1502>5000 | T8000 1>276 | p 397>602 | p 523>1043 | p 436>2339 |
| Body | c 90>173 | p 2361>6041 | c 237>172 | p 1093>231 | p 973>531 | p 2152>295 |
| Stretch | f 104>90 | p 2957>3215 | c 260>170 | f 187>210 | f 1986>2204 | c 410>260 |
| Stiffness | f 230>219 | T250 289>285 (none) | p 191>188 | c 758>471 | f 3980>4033 | f 3101>2974 |
| Coupling | f 235>208 | p 3606>2370 | i -47.4>-39.3 | p 1094>325 | p 977>604 | p 2145>565 |
| Air | f 242>219 | p 3082>2875 | f 254>229 | f 1788>2017 | c 435>356 | p 1629>955 |
| Reed | f 208>229 | T250 275>412 | f 136>144 | p 432>551 | p 530>936 | p 455>1790 |
| Width | r 1.00>0.52 | r 1.00>-0.59 | r 1.00>0.22 | r 1.00>-0.16 | r 1.00>-0.41 | r 1.00>-0.14 |

| knob | Fiddle | Clar | Oboe | Sax | Obosax |
|---|---|---|---|---|---|
| Touch | L -40.9>-25.1 | L -39.0>-27.4 | L -27.6>-22.7 | L -31.5>-24.7 | L -36.9>-22.3 |
| Position | c 935>400 | f 1676>1553 | f 724>674 | c 543>275 | p 828>357 |
| Bright | p 939>1885 | i -75.2>-79.5 | p 1282>1923 | i -77.6>-89.8 | p 336>562 |
| Body | i -60.9>-70.9 | T2000 109>72 | f 598>676 | i -91.7>-89.2 | p 640>359 |
| Stretch | f 1760>1542 | T4000 40>78 | c 874>2698 | c 389>405 | f 388>440 |
| Stiffness | f 3744>3316 | f 1998>2040 | f 1392>1470 | f 2200>2002 | f 2217>2496 |
| Coupling | i -67.8>-63.5 | i -82.5>-74.6 | i -57.3>-52.0 | p 1192>446 | i -61.8>-48.7 |
| Air | f 710>684 | T8000 22>683 | i -55.1>-29.9 | f 2201>1981 | c 384>636 |
| Reed | p 912>1648 | i -76.5>-78.1 | f 1019>968 | i -85.6>-91.2 | p 346>413 |
| Width | r 1.00>-0.25 | r 1.00>0.23 | r 1.00>-0.01 | r 1.00>0.73 | r 1.00>-0.05 |

**109 of 110 cells show a measurable effect** by these metrics. The one cell without is Stiffness x Snare (largest change: band T60 at 250 Hz 289 > 285 ms): the noise rattle of the snare masks its head modes in the spectral metrics, the waveform of the impulse response below 700 Hz differs by -16.4 dB between Stiffness 0 and 100 (the (1,1) and (2,1) ratios move by +1.5 % and +3.4 %), so the knob acts, 110 of 110 counting that difference. Cells marked `r` for Width measure the L/R correlation of the render (1.00 = mono-identical channels): below 50 the sum's mid/side narrows to mono, above 50 the engine detune, tap offset and mode split open the image. Knobs that act on one side of 50 only (Ukulele Stiffness, Clarinet Air, Oboe Air, section 9) are compared 0 against 100 like the rest.

### Combined extremes at 44.1 / 48 / 96 kHz

All ten knobs at 0 (Stretch -100) and all ten at 100 (Stretch +100, Width 100), pink noise and unit impulse, every anchor, line A: 132 renders, 0 assertion failures (finite, no NaN, peak below 0 dBFS, |DC| < 0.01, decaying, as above). Cell: loudest peak of the two stimuli in dBFS / largest |DC| (all finite).

| anchor | 44.1 k all 0: peak / DC | 44.1 k all 100 | 48 k all 0 | 48 k all 100 | 96 k all 0 | 96 k all 100 |
|---|---|---|---|---|---|---|
| Bass Drum | -10.8 dBFS / 5e-05 | -7.6 dBFS / 6e-05 | -10.2 dBFS / 5e-06 | -7.5 dBFS / 3e-05 | -8.8 dBFS / 4e-05 | -6.5 dBFS / 3e-04 |
| Snare | -0.0 dBFS / 3e-06 | -0.0 dBFS / 2e-05 | -1.2 dBFS / 2e-06 | -0.0 dBFS / 2e-05 | -2.0 dBFS / 4e-06 | -0.0 dBFS / 5e-05 |
| Timpani | -10.8 dBFS / 4e-06 | -6.2 dBFS / 7e-05 | -10.2 dBFS / 1e-05 | -6.9 dBFS / 3e-05 | -12.3 dBFS / 1e-05 | -6.5 dBFS / 7e-05 |
| Piano | -12.0 dBFS / 9e-11 | -7.6 dBFS / 4e-05 | -11.4 dBFS / 4e-11 | -7.5 dBFS / 4e-05 | -17.5 dBFS / 3e-11 | -6.5 dBFS / 8e-05 |
| Guitar | -4.8 dBFS / 1e-11 | -0.0 dBFS / 4e-05 | -5.5 dBFS / 1e-11 | -0.0 dBFS / 8e-06 | -8.7 dBFS / 1e-11 | -5.0 dBFS / 5e-06 |
| Ukulele | -3.5 dBFS / 1e-13 | -0.0 dBFS / 1e-05 | -2.2 dBFS / 2e-13 | -0.0 dBFS / 2e-06 | -9.7 dBFS / 1e-13 | -4.4 dBFS / 9e-06 |
| Fiddle | -19.4 dBFS / 1e-12 | -9.1 dBFS / 2e-06 | -19.1 dBFS / 1e-12 | -9.2 dBFS / 2e-06 | -25.2 dBFS / 1e-12 | -7.5 dBFS / 9e-07 |
| Clarinet | -39.3 dBFS / 1e-14 | -15.5 dBFS / 3e-12 | -39.8 dBFS / 1e-13 | -16.1 dBFS / 3e-12 | -39.7 dBFS / 6e-14 | -16.3 dBFS / 1e-12 |
| Oboe | -16.0 dBFS / 1e-12 | -0.0 dBFS / 3e-06 | -16.3 dBFS / 3e-13 | -0.0 dBFS / 2e-06 | -11.1 dBFS / 4e-14 | -1.4 dBFS / 2e-07 |
| Sax | -24.3 dBFS / 3e-13 | -14.2 dBFS / 2e-12 | -24.0 dBFS / 2e-13 | -15.1 dBFS / 3e-12 | -24.1 dBFS / 4e-13 | -14.6 dBFS / 1e-12 |
| Obosaxolele | -14.8 dBFS / 8e-13 | -0.0 dBFS / 2e-05 | -15.5 dBFS / 3e-14 | -0.0 dBFS / 1e-05 | -21.3 dBFS / 3e-13 | -1.2 dBFS / 3e-06 |


## 9. Left inert, approximated or different from the task text

- **Lower half of Clarinet / Oboe Air and of Ukulele Stiffness is inert**: BODY has no breath noise on these bodies and the ukulele string has no dispersion, so the recipe default is the neutral value (0) and the knob acts from 50 up. Sax Air, guitar / piano / fiddle Stiffness and every other knob act on both sides.
- **Bore dispersion allpass is always in the loop** (clarinet and sax; at coefficient 0 it is a one-sample delay that `allpassPhaseDelay` takes out of the loop delay, exactly as the string engine does). Result: the clarinet, sax and hybrid renders at defaults differ from P2 in the float rounding of the tail (A/B: Clarinet, Sax and Obosaxolele within 0.05 dB RMS, Fiddle -82 dB RMS through the Clarinet weight of the 7 -> 6 morph at the start of the render, bit-identical with the Clarinet forced off), all other anchors are bit-identical.
- **Stiffness of the bores and of the ukulele has a larger range than the task text** (bores 0..0.1, ukulele -0.5): a first-order allpass at +-0.1 moves the 7th partial of a 220 Hz bore by 0.03 ct and the sweep measured peak positions identical to 0.1 Hz, so the ranges are +-0.8 for clarinet and sax (7th partial +27 ct at 100 for the clarinet, sax 8th partial +16 Hz, f0 stays within 8 ct) and -0.85 for the ukulele (as the piano). The sign follows real bores: positive coefficient = flat upper partials (knob 0), negative = sharp (knob 100).
- **Drum Stiffness** uses `r sqrt ((1 + B r^2) / (1 + B))` with the mode's ratio as wavenumber (ideal membrane: j_mn / j_01 equals the ratio) instead of an index k; the tuned mode keeps its pitch and the pair split stays; B reaches slightly negative values below 50 (-0.008) so that the lower half of the dial acts too.
- **Air of the boxes**: R10's example (plate 150 / cavity 129 Hz -> 97 / 200 Hz) cannot be produced by the omega^2-conserving form of the task text; the recipe stores the pair that lands on the recipe A0 / T1 (section 3). The cavity radiation ratio 0.8 is a design value. Signs of the two slots stay the recipe's (both positive); only a sign flip of the eigenvector gain at very strong coupling would change them (clamped to +-3 x).
- **Air of the drums**: the alternate ratio sets are design values (22 s13 only names the direction): Bass / Snare ideal -> air-loaded (1.594 -> 1.50, 2.136 -> 2.00, ...; pair 0.94 / 1.064 and 0.92 / 1.10 -> 0.97 / 1.03), Timpani recipe (air-loaded) -> ideal membrane. Knob 0 extrapolates half-way away from the alternate set. The (0,1) damping by the kettle is part of Reed (T60 multiplier of the batter mode), not of Air.
- **Reed of the snare** has no "rattle band width": Bright scales the rattle bands (the only place where the hard / soft head acts on the wires); Reed gives the snare the head-tension glide (0 .. 0.25 oct) and the (0,1) damping like the other drums.
- **Body of the snare** balances heads / shell slots against the grid; the rattle (the snare's engine term) is not balanced. Modal-only bodies read "direct" = slots, "body" = grid.
- **Coupling of bores** does two things: the feed multiplier into the grid / slots (0 .. 2 x) and the radiation mix (direct comb pickup below 50, radiation cutoff x 0.36 at 100). The loop gain stays Decay's (concept 15).
- **Width** acts in the bodies only above 50 (detune +-3 ct, tap offset +-12 %, odd / even mode split 0.5, all linear in (W - 50) / 50); below 50 the existing mid/side on the sum makes the image narrower (0 = mono, exactly). The mid/side on the sum (side x 2 at 100) is unchanged. The mode split was added so that drums and the oboe, whose recipes are L/R symmetric, have a Width at all (concept 20 s5: "modal parts via a Rings-style odd/even mode split").
- **Air of the oboe** is the breath noise of 22 section 13 (the oboe sits with the bores in 20 section 15); a formant-slot "air-mode gain" for modal-only bodies was not added, the mode-gain law is carried by the piano (3 low FEM modes) and the fiddle (A0).
- **Position for strings** acts on the comb / tap only; their box slots are not position-weighted (the plate is driven at the bridge).
- **Stretch** additionally maps the following (Tune-following) modes as `r^(1+s)` around the root (concept 15 says "Tune-following modes", the task text said grid and fixed-Hz slots): the pitch of the tuned mode never moves.
- **Touch** in strike modes (velocity curve) arrives with the strikers (P4b); `Follow`, `Hold`, `Excite`, `Blend` and `Listen` are as in P2.
- Energy compensation of Position and Bright is clamped to 0.25 .. 4 and ignores cross terms between neighbouring modes (the cached slot normalisation is untouched); a very off-centre Bessel position therefore changes loudness a little.
- CPU (rough, P7 measures the target): the P3 additions are control-rate work behind knob tests (the Body balance is cached, slot shapes are rebuilt only when a knob, the root or Size moves), about 36 more ramp reads and a few multiplications per sample and line, one allpass per bore sample, and the L/R reads of the loops only above Width 50. Marginal CPU of one core per second of audio at 48 kHz, line A alone, noise bursts every 0.5 s, 60 s render minus 5 s render (as 05 section 7, render tool included), P2 -> P3: Bass Drum 1.4 -> 1.9 %, Piano 1.6 -> 1.4 % (noise level), Clarinet 1.9 -> 2.2 %, Obosaxolele 2.3 -> 2.8 %, i.e. about +0.3 .. 0.5 percentage points per line.
- The 2-DOF values, the alternate ratios, the breath scalings (x 3 on the band-passed noise) and all range ends are first-listen design values like the other *(design)* numbers of 22.
