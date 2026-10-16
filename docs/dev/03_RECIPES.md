# 03 - Body recipes, `bodytab.py`, tables

Owner: recipe worker (P1). Files: `bodies/*.json` (source of truth), `tools/bodytab.py`, generated `src/dsp/10_tables.cmajor`,
`plugin/bodies.json`, `tests/tables_data.cmajor`, `tests/tables.cmajtest`. Concept: `docs/concept/22_BODIES.md` (values and citations),
`20_DSP_CONCEPT.md` section 3 (recipe format) and section 4 (damping rule), contract `00_P1_CONTRACTS.md` (table API).

## 1. Run it
```
python3 tools/bodytab.py                          # validate, write 10_tables.cmajor + plugin/bodies.json + tests/tables_data.cmajor
python3 tools/bodytab.py --emit namespace --check # summary table + "up to date" report, writes nothing (--strict: exit 1 if stale)
python3 tools/bodytab.py --check --write          # summary and write
python3 tools/bodytab.py --emit main              # struct Tables + literal functions + load(): processor member form
python3 tools/bodytab.py --emit external --externals-json plugin/tables.externals.json   # external declarations + manifest object
cmaj test tests/tables.cmajtest                   # pure-function tests
```
Python 3, standard library only, deterministic (sorted JSON keys, `%.6g` floats, recipe hashes in the header, no clock). Errors exit 1
with one line per finding (schema, counts, ranges, damping consistency, Bessel law). Defaults: `--emit namespace`.

`--check` columns: feature and following counts, grid energy (sum over poles of (gL^2 + gR^2) / 2), alphaG, alphaR x1e-3, rho, T200,
decay seconds at Decay 50, line kind.

## 2. Emission forms (all three compile; the DSP worker's `01_TABLE_EMISSION.md` picks one)
| form | what is emitted | verified here |
|---|---|---|
| `namespace` (default) | `namespace rebody::tables { const int ...; const float[N] name = (...); }`, one block per table, one row (body) per line group | `cmaj generate --target=cpp` clean; included by a real `cmaj test` (1056-element arrays fine); `cmajor_lint.py --strict` clean; concatenated with the DSP worker's parts still compiles |
| `main` | `struct Tables`, one `float[N] makeName() { return (...); }` per table, `void load (Tables& t)`; processor owns `rebody::tables::Tables tables;` and calls `load (tables)` once at the start of `main()` | generate clean; `cmaj test` testProcessor ran `load` and read the values back |
| `external` | `external float[N] name;` declarations in the namespace and, between `EXTERNALS-JSON-BEGIN/END` markers at the end of the file (or `--externals-json FILE`), the `"externals"` object keyed `rebody::tables::name` | generate clean with the object pasted into a scratch `.cmajorpatch`; Amorph loading of manifest externals is unverified |
`tests/tables_data.cmajor` is always the namespace form, so `tests/tables.cmajtest` stays valid whichever form the build uses
(`--emit namespace` gives the same table content as `src/dsp/10_tables.cmajor`; the test also passed against that file directly).

## 3. Table API (what the DSP consumes)
All flat, `[body * stride + i]`, body 0..10 in `spec.json` anchor order, strides grid 96 / feature 8 / follow 10. Counts and the codes
`rootLaw`, `lineKind` are `int`, everything else `float`; units Hz and seconds.
- **Contract arrays** (26): `gridHz`, `gridGainL/R`, `featureCount/Hz/T60/GainL/GainR`, `followCount/Ratio/T60Mult/GainL/GainR`, `alphaG`, `alphaR`,
  `decayBase`, `decayRatio`, `sustain`, `rootLaw`, `lineKind`, `loopLowpassHz`, `radiationHz`, `beta`, `dispersion`, `outGain`, `energyTarget`,
  plus the constants `numBodies 11`, `gridPoles 96`, `featureStride 8`, `followStride 10`.
- **alphaR is in seconds**: T60(f) = ln(1000) / (alphaG + alphaR * 2 pi f); 22 lists alphaR x1e-3 (bass 3.65e-3 is stored 0.00365).
- **followT60Mult** multiplies the damping-law T60 at `ratio * root` (20 section 4). **featureT60** is seconds at Material 50 and Decay 50.
- **Unused slots** hold benign values (feature 1000 Hz / 0.01 s, ratio 1, mult 1) with gain exactly 0, so a lane stepped without a mask stays finite.
- **rootLaw** 0 = drum size law (unpitched: pitchedWeight sums bodies with rootLaw 1), 1 = note law.
- **Extensions** (17, optional, same file): `followBesselOrder` (int, -1 = none) and `followBesselZero` (drum mode gain = J_m(j_mn r) at Position r, so the
  P3 Position knob can rescale the stored default-Position gains), `rootBaseHz`/`rootSizeOct` (drum law `base * 2^(oct * (1 - size))`), `tuneMinNote`/`tuneMaxNote`
  (36..72, timpani 60), `onsetGlideOct`, `positionDefault`, `bodyDefault`, `decayScaleLo/Hi` (Decay factor range for a body behind a loop, 0/0 = anchor seconds law),
  `dispersionB` (piano second string), `engineGain`/`bodyGain` (the two terms inside BODY's calibration bracket), `hybridConst[14]` (the 11 constants of 22 section 11 in
  that order, then gesture 0.70, feed trim 0.50, oboe energy 0.85), `hybridCentre[4]`, `hybridSplitHz[4]`, and `hybridBodyUke/Oboe/Sax` = 5/8/9.
- `plugin/bodies.json` (UI): anchors, labels, `labelsLong`, `zTable[11][10]` (also per body), per body rootLaw, default root, Tune range, decay base/ratio/seconds at 50,
  sustain, damping (alphaG, alphaR, rho, T200), counts, line summary, position and body defaults, `physicsMap`, and the slot-mode identities:
  `modes[16]` = padded layout (k 0-7 feature slot k, k 8-15 following slot k-8, null = unused), `modesCompact[16]` = the same modes without gaps.
  **Open for P5:** which of the two packings `lineModes*` telemetry uses; the DSP worker's flat slot layout (`feature b*8+k`, `follow 88+b*10+k`) matches `modes`.

## 4. Recipe schema (`rebody.recipe/1`, 20 section 3 extended)
File `bodies/NN_name.json`, `NN` = anchor index. Every value that 22 marks (design) carries `"design": true` on its object or on its section.
| key | content |
|---|---|
| `name`, `anchor_index`, `id`, `generator` | must equal `spec.json` `anchors[i]`; generator membrane / plate / box / tube_body / cluster (20 section 3) |
| `anchor` | `root_law` drum\|note, `root_base_hz`, `root_size_oct` (drum law), `default_tune` 58, `default_root_hz` (73.6 / 229 / 220), `tune_clamp_midi` (timpani [36,60]), `onset_glide_oct` |
| `material` | `rho` (reference at Material 50, rho is derived from alphas), `eta` (pure-eta bodies: requires alphaG 0 and alphaR = eta/2) |
| `grid_profile` | see 4.1; Obosaxolele: `from_constituents` |
| `feature_modes[]` (max 8) | `label`, `hz`, exactly one of `t60` (s) / `q` (T60 = ln1000 * Q / (pi f), 22 writes 2.2 Q/f) / `t60_law` (from the body's alphas), `gain_db`, `sign` (+-1), `pan`, `src`, `design` |
| `following_modes[]` (max 10) | `label`, `ratio`, exactly one of `t60_mult` / `t60_rel` (x decay seconds at Decay 50) / `t60_abs` (s at the default Tune), `mn` ([m,n] drum mode for the Bessel law), `gain_db`, `sign`, `pan`, `src`, `design`; bodytab converts rel/abs to the table multiplier against the law at `ratio * default_root_hz` |
| `damping` | `alphaG` [1/s], `alphaR` [s], `rho_ref`/`t200_ref` (22's stated rho and T200, checked within 3 %), `decay_scale` {lo, hi}, `derive` |
| `decay` | `base`, `ratio` (seconds = base * ratio^d, d = Decay/100, BODY `anchorSeconds`) |
| `contact` | `sustain`, `novelty_power` (law in text), `position` (Position knob 50), `body_default` (Body knob 50) |
| `line` | `kind` none\|cylinder\|cone\|string\|string_pair, `loop_lowpass_hz`, `radiation_hz` (outside the loop), `beta`, `dispersion`, `dispersion_b`, `tune_lut_cents` (null until P3 measures it) |
| `calibration` | `out_gain`, `energy_target`, `engine_gain`, `body_gain`, `terms` (BODY's bracket), `energy_law` (oboe) |
| `physics_map` | 22 section 13 text: stiffness, coupling, air, reed, excite |
| `ui` | `label`, `label_long` (must equal spec), `depth.z[10]` (path 0..9, 22 "Depth" lines), `depth.filled_paths` |
| Obosaxolele only | `constituents[]` (recipe, weight 1/3 each at the end stop), `hybrid.constants[]` (11 named BODY constants + 3 related), `hybrid.pairs` (BODY:105-110) |

### 4.1 `grid_profile` (parametric, evaluated per pole)
For pole k at f = gridHz[k] (60 Hz * (8000/60)^(k/95), 0.074 oct spacing):
`dB(f) = floor_db + envelope(f) + sum_i gain_db_i * exp(-4 ln2 (log2(f / hz_center_i) / width_oct_i)^2)`; `envelope` is a list of `{hz, db}` points,
piecewise-linear in log2 f, held outside the end points (this is how "-6 dB/oct above 250 Hz" is written exactly). `width_oct` is the full width at half maximum of the
dB bump (a Q-bump uses 2 asinh(1/2Q)/ln2). Bump `gain_db` is dB above the local floor (the clarinet's "+6 dB over a floor 12 dB lower" is floor -24 and bump +18, i.e. reference -12).
`pan(f) = clamp(lr(f) + sum_i pan_i * w_i(f))`, `lr` a `{hz, pan}` list (same interpolation), `w_i` the bump's normalised shape. `sign` positive or alternating (alternating = (-1)^k).
**Pan law everywhere:** `A = 10^(gain_db/20)`, `L = sign * A * (1 - pan)`, `R = sign * A * (1 + pan)`, mean (L+R)/2 = A: piano 1.15/0.85 is pan -0.15.
The Obosaxolele grid is the weighted sum of the Uke, Oboe and Sax vectors (1/3 each, BODY:140-143 at the end stop).

### 4.2 Derived Obosaxolele row (22 section 11: each constituent's own damping at its weight)
`damping`, `decay` and `contact.sustain` carry `derive: "constituents"`. Rule: decay base and ratio are log-blended (BODY:210-217), sustain is the weight mean,
T200 is log-blended and rho weight-blended (the way the DSP blends a shared law, 20 section 4) and (alphaG, alphaR) follow by inverting 22 section 0
(alphaG 47.2, alphaR 10.7e-3, rho 0.333, T200 0.114 s, 0.46 s at Decay 50). Its eight following modes are BODY's reshaped beating pairs
(BODY:399-420) expanded at the 220 Hz default root (ratio = (centre +- split/2) / root, split = min(0.045 centre, 3.2 / 5.1 / 7.7 / 11.3 Hz)), weights
0.60 .. 0.58 and times 2.5 .. 0.675 x decay seconds; that makes `followT60Mult` 10-16 because the pairs ring far longer than the blended law (as in BODY).

## 5. Provenance per body
L = literature or measured table (R10 B4), B = BODY constant (BODY:n), D = design value (22 marks it, first thing to tune by ear), d = derived by bodytab.
| # | body | grid | feature modes | following modes | alphaG/alphaR | decay | contact / Position | line | calibration |
|---|---|---|---|---|---|---|---|---|---|
| 0 | Bass Drum | D | D (310/520 Hz, Q 8) | L ratios (membrane, coupled pair) + D (pair split, skew); gains J_m(j r) at 0.30 | B-fit (BODY:185 seconds) | B | B / 0.30 | none | B 1.5 |
| 1 | Snare | D | D (450/1100, Q 10) | L + D (pair 0.92/1.10); J at 0.35 | B-fit | B | B / 0.35, rattle B | none (rattle B) | B 1.4 + 2.7 |
| 2 | Timpani | D | D (160 Hz, Q 6) | L (R10 B4 set) + D ((0,1) pinned 0.08 s); J at 0.25 | D | D | D / 0.25 | none | D placeholder 1.0 |
| 3 | Piano | D | L (FEM 84..301, T60 = 96/f) | none | L (eta 2.3 %) | B | B / 0.11 | B (pair, 11.5 kHz, -0.86/-0.78) | B 0.341 x (17, 0.8) |
| 4 | Guitar | D | L (103/205/286/436, Q 20) + D gains | none | L (Q 20) | D | B law / 0.25 | D (loop 2.6 kHz, -0.30) | D placeholder 1.0 |
| 5 | Ukulele | D | D (230/290/480, Q 13.5) | none | D (eta 7.4 %) | B | B / 0.32 | B (1.65 kHz, comb 0.32) | B 0.447 x (18, 0.72) |
| 6 | Fiddle | D | L (violin means) + D (Q, gains) | none | L (zeta ~ f^-0.45) | D | D / 0.10 | D (loop 4.2 kHz, -0.15) | D placeholder 1.0 |
| 7 | Clarinet | D | none | none | D (Q 4) | B | B / 0.5 | B (1.75 kHz) + L (radiation 1.4 kHz) | B 0.149 x 3.8 |
| 8 | Oboe | D | D (formants, x1.20 weight) | B (BODY cluster) | B-fit (BODY times) | B | B | none (reed shaping B) | B 1.754 x 0.95 |
| 9 | Sax | D | B (780/1750 Hz, 11 / 6.5 ms) | none | D (Q 5) | B | B / 0.17 | B (6.6 kHz) + L (radiation 1.0 kHz) | B 0.826 x 0.22 x (3.3, 1.10) |
| 10 | Obosaxolele | d (sum of constituents) | none | B (BODY:399-420, 105-110) | d | d | d | uke string + sax bell | D placeholder 1.0, hybrid constants B |
BODY-value starting points for `out_gain` stay starting points (22 section 4/6 say so); all `energy_target` are the BODY oboe law value at 220 Hz (0.4496) except as noted below.

## 6. Interpretations where 22 is silent or ambiguous (change them in the recipe, not in the tool)
1. Grid absolute levels: only bass and snare are stated (20 dB below the batter modes, -21 dB). Others: guitar/uke/fiddle/piano floor -12 dB, timpani -22, oboe -12, sax -15, clarinet -24 (peaks about -6 dB).
2. "L/R +-5 %" (guitar, uke) and "+-8 % toward the treble side" (fiddle) are read as a linear-in-log-f tilt from -0.05/-0.08 (low) to +0.05/+0.08 (high), like the piano.
3. Roll-off slopes not given (clarinet and sax above 5 kHz): -12 dB/oct. Oboe shelf ramps 0 to +3 dB between 500 and 900 Hz. Fiddle plateau ramps in over 1.5-1.8 kHz.
4. Guitar and ukulele A0/T1 gains (+0.70/+0.55, +0.70/+0.50) stand in for the 2-DOF eigenvectors until P3; 286 Hz and 436 Hz gains are 22's.
5. Oboe formant gains = 22's 0.45/-0.40/0.30/-0.25 times the strongest cluster weight 1.20.
6. Drum coupled-pair modes carry the (0,1) gain with a -0.2/+0.2 pan skew (22 states it for the bass drum; copied to the snare, marked design).
7. Following gains are stored at the recipe Position (bass 0.30, snare 0.35, timpani 0.25); `followBesselOrder/Zero` let P3 recompute them. `bodytab` checks every stored drum gain against J_m(j_mn r) within 0.012.
8. `ui.depth`: paths 22 does not mention (bass 3-4, timpani 3-5, clarinet 3-5, oboe 3-5, sax 4-5) get the mean of the stated detail paths 3-9 so layer 9's mean is unchanged (`filled_paths` lists them).
9. Piano `Position` default 0.11 is the pickup tap (BODY:486); clarinet 0.5 is half a period (BODY:345); oboe 0.5 is a placeholder (no line engine).
10. Decay seconds at Decay 50 reproduce the drum root T60 within 1 %: bass 0.358 / 0.358 s, snare 0.283 / 0.283 s, timpani 1.414 / 1.414 s (checked, warns above 3 %).

## 7. Tests (`tests/tables.cmajtest`, 35 checks in one `testFunction()` block)
Finite values; `gridHz` finite, strictly increasing, 60 Hz .. 8 kHz, spacing <= 1/12 oct, below 0.45 fs; grid gains finite and |g| <= 4, every body non-zero; counts <= 8 / <= 10 and equal to 22;
every feature T60 > 0, feature Hz in 20 Hz .. 0.45 * 44.1 kHz; unused slots silent and finite; pole radius exp(-6.907755 / (sr T60)) strictly inside (0,1) at 44.1 / 48 / 96 / 192 kHz for every feature
and every following mode at the default Tune; following modes below Nyquist at the highest root; alphaG, alphaR >= 0 and not both 0; rho in [0.1, 1] and the documented rho values; drum root T60 = Decay seconds;
decay law, sustain, out_gain, energy_target, codes, line scalars; Bessel law of 18 drum modes; BODY's hybrid constants; documented Q/law T60s (guitar, piano 96/f, sax 11 / 6.5 ms).
Mutation-checked: zeroing a T60, breaking gridHz order, a negative alpha, a count of 9, a huge multiplier, a bad sustain, a changed hybrid constant and an unused-slot gain each fail the named function.

## 8. Open calibration items
- `out_gain` placeholders 1.0 for timpani, guitar, fiddle and obosaxolele (M1 measures); BODY starting points elsewhere.
- `energy_target`: 0.4496 for every body (design); only the oboe has BODY's law `clamp(0.28 (f/130)^0.9, 0.14, 0.55)` (recipe `calibration.energy_law`), the table holds its value at 220 Hz. P2 decides whether the law applies to all pitched bodies.
- Grid floors versus slot levels (item 1 above): tune by ear and by M1 loudness; the grid normalisation is the DSP's, the tables only fix relative shape and level.
- Guitar/ukulele 2-DOF eigenvector gains, ukulele A0/T1/T2 Hz, fiddle Q and gains, oboe formants, timpani alpha values and (0,1) pin, all design values of 22.
- Guitar and fiddle loop low-pass (2.6 / 4.2 kHz) and dispersion (-0.30 / -0.15), clarinet/sax dispersion -0.05; per-register `tune_lut_cents` is null until P3 measures it.
- Obosaxolele: the derived row (4.2), the `followT60Mult` of 10-16 against that law, and the end-stop calibration (BODY 2x and feed x1.5 sit in `hybridConst`).
- Slot telemetry packing (padded `modes` or `modesCompact`) and the UI fill values for unstated depth paths: P5/P6 confirm.
- Manifest `externals` loading in Amorph is unverified; `--emit external` is ready if the DSP worker's experiment prefers it.
