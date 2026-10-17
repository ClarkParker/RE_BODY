# 04 — Render CI (`tools/render_ci.py`)

P2 deliverable of the CI worker: render a patch with `cmaj render`, measure it, and hold RE·BODY against the original BODY. Python 3 + numpy only (no scipy), run from the repo root, nothing but JSON and markdown is written into the repo (audio lives in a scratch dir). Ported from PHYSIFY `tools/golden_ci.py` (init patching, f0, tri-rate) and `plugin/analyze.py` (autocorrelation f0, T60, BS.1770), extended with body metrics. Decision records and gates: `docs/plan/30_DEV_PLAN.md` rows P2 to P4b, `docs/concept/20_DSP_CONCEPT.md` §9.

**State (2026-10-17, P2 skeleton):** the RE·BODY wet path is silent, so `run` reports `wet silent` for every anchor, and `compare --gate` fails until the modal bank makes sound (`--allow-silent` turns that into SKIP). The golden of the original BODY is real: `tools/golden/body_original.json`.

## 1. Run it

```
export RENDER_CI_WORK=<scratch dir>        # stimuli, patched copies, renders, metrics cache (default <tmp>/render_ci)
export CMAJ=/root/.cache/cmaj/1.0.3175/cmaj-bin/linux/x64/cmaj     # default if unset

python3 tools/render_ci.py selftest                    # 26 numpy-only checks of the measuring code, no cmaj needed
python3 tools/render_ci.py golden-original             # 8 anchors x 5 stimuli x 3 rates = 120 renders, about 30 s on 4 cores
python3 tools/render_ci.py run                         # 11 anchors x 5 x 3 = 165 renders
python3 tools/render_ci.py run --quick                 # 48 kHz only, no burst train
python3 tools/render_ci.py run --anchors 3,7 --rates 48000 --decay 100 --material 100 --set "A Touch=70"
python3 tools/render_ci.py compare [--gate] [--allow-silent]
python3 tools/render_ci.py check three-line-protector|hold-stability|split-complementary|all [--gate]
```

| Mode | Writes | Exit code |
|---|---|---|
| `golden-original [--rates --decay --jobs --no-cache --keep --ir-seconds]` | `tools/golden/body_original.json` (25 kB), blocks `golden-summary` and `mapping` of this file | 0, 2 on a render error |
| `run [--anchors 0..10 --rates --quick --decay --material --set 'Name=value' --patch --out --no-doc ...]` | `tools/golden/re_body_latest.json` (28 kB; always the latest run, a partial run replaces it), blocks `run-report` and `mapping` of this file | 0, 2 on a render or compile error |
| `compare [--gate --allow-silent --anchors --rates --re-json --orig-json]` | stdout only | with `--gate`: 1 on any failing anchor |
| `check NAME [--gate --allow-silent --rate --anchor --anchors --materials --seconds --max-reduction --debug-patch --patch --out --jobs]` | `tools/golden/re_body_checks.json` (merged per check name) | with `--gate`: 1 on `fail`, and on `wet silent` unless `--allow-silent` |
| `selftest` | nothing | 1 on a failed self-check |

- `--patch X.cmajorpatch` renders an experimental build instead of `plugin/RE_BODY.cmajorpatch` (parameter names must match), `--out` and `--no-doc` keep such runs away from the committed goldens.
- Results are cached per render in `<work>/cache` by a hash of (patch folder, parameter values, stimulus, rate, lead-in, cmaj version, `METRICS_VERSION`). Bump `METRICS_VERSION` in the tool when a metric definition changes; `--no-cache` forces everything.
- Only the generated blocks of this file (between the `BEGIN/END GENERATED` markers) are rewritten by the tool, the prose is edited by hand.
- Typical P2 loop: `python3 tools/build_dsp.py && python3 tools/render_ci.py run && python3 tools/render_ci.py compare --gate`.

## 2. `cmaj render` command line (cmaj 1.0.3175)

Exact command used for every render (one per anchor, stimulus and rate):

```
cmaj render --input=<lead-in + stimulus.wav> --output=<out.wav> --rate=<sr> <patched copy>/<Patch>.cmajorpatch
```

Flags of `cmaj render [opts] <file>` as printed by `cmaj help`: `--length=<frames>` (optional when an input file is given), `--rate=<rate>` (optional with an input file), `--channels=<num>` (output channels, default 2; the split hook uses 4), `--blockSize=<size>`, `--output=<file>`, `--input=<file>`, `--midi=<file>`. Global options before the command: `-O0..4`, `--debug`, `--eventBufferSize=n`, `--engine=<llvm|webview|cpp>`, `--simd` / `--no-simd` / `--simd-only`.

- Only the `--name=value` form works: `--rate 48000` fails with a bare `stoll`, `--output file` with `File does not exist: file` (the word is taken as the patch), `--input file` with `Expected a .cmajorpatch file`. `cmaj render --help` is not supported (it answers `Expected argument: '--output'`), the flags come from `cmaj help`.
- With `--input` the output has exactly the input's frame count (no `--length` needed). The output is a 32-bit float WAV, `WAVE_FORMAT_EXTENSIBLE` with a `JUNK` chunk first: Python's `wave` cannot read it, the tool has its own RIFF reader (also 16/24/32-bit PCM). Input is read as 24-bit PCM without trouble.
- Output events (`bodyViz`, `lineState*`, ...) are not captured, parameters cannot be set (see §5), no `LD_LIBRARY_PATH` is needed here (PHYSIFY needed `/opt/cmajlibs`).
- Cost: about 0.5 to 1 s per render for compile and start, plus real time of the patch (original BODY: 0.9 s for a 2 s file).

## 3. Pre-roll handling

Measured with an impulse train (one frame in 8, from frame 0) through the original BODY at Bypass = 1 (an exact pass-through, `result = dry` at `dsp.cmajor:890`): the first non-zero output frame is **20480 at 44.1, 48 and 96 kHz** (default block size). Everything the input holds before that is discarded for good, not delayed: a click at 0.3 s gives no output at all, not even a tail after the pre-roll, and a noise or sine stimulus that starts at frame 0 loses its first 0.43 s. Later frames stay time-aligned, nothing is shifted. The count is 20000 frames rounded up to whole render blocks (block size 32 gives 20000, 64 gives 20032, 256 gives 20224, 512 to 4096 give 20480, 8192 gives 24576). It is frames, not seconds: 0.464 s at 44.1 kHz, 0.427 s at 48 kHz, 0.213 s at 96 kHz. This is the "~0.43 s / 20480 leading silent frames" pitfall of `docs/index/04_PHYSIFY.md` §6, now pinned down.

Handling in the tool:
- Every stimulus file is **0.5 s of digital silence + the stimulus** (22050 / 24000 / 48000 frames, always more than the pre-roll). The first 0.5 s of every output are cut before analysis, so all times in the metrics are relative to the stimulus start.
- `calibrate_preroll(sr)` re-measures the pre-roll (cached per cmaj version) and aborts if `pre-roll + 1024 frames > lead-in`, so a longer pre-roll in a future cmaj cannot silently eat a stimulus. The calibration runs on the original BODY because its bypass is exactly dry; a patch's own wet latency (original Clarinet: 2.19 ms) is not pre-roll and is reported separately as `onset_ms`.
- Event timing: all parameters come from `init:` at start, no events are sent while rendering, so the PHYSIFY note-off race (shaker bimodality) does not apply.

## 4. Stimuli

All dual-mono (L = R, so the stereo correlation of the output shows what the patch does to a mono input), 24-bit PCM, generated at the render rate, deterministic (numpy PCG64, seed 20261017), 0.5 s lead-in in front (§3). Times below are stimulus-relative.

| Name | Content | Length |
|---|---|---|
| `silence` | zeros | 2 s |
| `impulse` | one unit impulse (1.0) at 0.5 s, then silence (`--ir-seconds`, default 4 s, for long Decay) | 4 s |
| `pink` | pink noise (1/f power from 20 Hz, FFT-shaped), **-20 dBFS RMS** over 2 s with 5 ms fades, then 2 s silence; input loudness -16.54 LUFS | 4 s |
| `sine` | 440 Hz, **-12 dBFS peak**, 5 ms fades | 2 s |
| `bursts` | 5 clicks 0.3 s apart (0.2, 0.5, 0.8, 1.1, 1.4 s): 4 ms white-noise burst with 1 ms exponential decay, -6 dBFS peak | 2.5 s |

## 5. Parameter patching

`cmaj render` cannot set parameters, but it applies the `init:` value of every event input at start. The tool copies the patch folder to the scratch dir and rewrites the first match of `name:\s*"<exact name>"[^\]]*?init:\s*<number>` in the DSP source named by the manifest (`"Morph"` never matches `"A Morph"`). A missing required name aborts the render; optional names are skipped when the plugin lacks them.

| Role | original BODY (`reference/body_original/BODY.cmajorpatch`) | RE·BODY (`plugin/RE_BODY.cmajorpatch`) |
|---|---|---|
| anchor | `Morph` 0..7 | `A Morph` 0..10 |
| Decay | `Decay` 50 | `A Decay` 50 (`--decay`) |
| Material | none | `A Material` 50 (`--material`) |
| wet only | `Mix` 100 | `Mix` 100 |
| Bypass | `Bypass` 0 | `Bypass` 0 |
| Line A alone | none | `A Enable` 1, `B Enable` 0, `C Enable` 0 (optional) |
| Hold | none | `A Hold` 0 (optional; 1 in `hold-stability`) |

Everything else stays at its manifest default (Tune 58, Touch 50, Size 0, Level 0 dB, Width 50, Low Cut 20 Hz, ...). `--set "Name=value"` (repeatable) patches any other `init:` by its exact name.

## 6. Metrics (per render, stimulus-relative times)

| Key | Definition |
|---|---|
| `fin` | all samples finite (otherwise flag `nonfinite`, samples zeroed for the rest) |
| `peak`, `rms` | sample peak and RMS over both channels, dBFS (floor -200) |
| `lufs` | BS.1770 integrated loudness of the whole render: K-weighting (stage 1 high shelf, stage 2 RLB high-pass, coefficients computed for the render rate; at 48 kHz equal to the ITU table), 400 ms blocks, 75 % overlap, absolute gate -70 LUFS, relative gate -10 LU, L and R weight 1.0; `null` when everything is gated away. The IIR runs through its exact digital frequency response with FFT (causal, 0.5 s zero padding). Self-test: EBU Tech 3341 stereo 1 kHz at -23 dBFS reads -22.99 / -22.99 / -23.01 LUFS at 44.1 / 48 / 96 kHz |
| `dc` | largest `abs(mean)` of the two channels over the whole render; gate `< 0.01`, flag `dc>0.01` |
| `corr` | Pearson correlation L/R, `null` if a channel is constant |
| silence in, silence out | `silence` render with `rms < -90 dBFS`, else flag `silence-leak`; `wet silent` = no other stimulus exceeds -90 dBFS |
| `peaks` (impulse) | top 12 spectral peaks `[Hz, dB re the strongest]` of the impulse response: FFT of the first 1 s after the strike, **falling half-Hann window** (1 at the strike, 0 at 1 s; a full Hann would zero the first 0.5 s and bury short-lived modes), 4x zero padding, power sum of both channels, local maxima 30 Hz to min(20 kHz, 0.45 sr), minimum spacing max(4 Hz, 2 %), nothing below -70 dB re the strongest, parabolic interpolation. `peak_abs` = amplitude of the strongest peak, dB re full scale. A mode with T60 0.1 s has an 11 Hz wide line, its peak is biased by about 2 Hz |
| `t60` (impulse) | octave bands 125, 250, 500, 1k, 2k, 4k, 8k Hz: 8th-order Butterworth band-pass (fc/sqrt2 to fc*sqrt2, applied causally), energy `L^2 + R^2` from the impulse, Schroeder backward integral (energy decay curve), straight-line fit between **-5 and -35 dB**, `T60 = -60 / slope`, seconds. `band_db` = band energy re total (dB). `t60_trunc` lists bands still ringing within 40 dB of their peak at the end of the render (T60 biased low). `t60_bb` = broadband. Self-test on noise with a known envelope: error under 6 % for T60 of 0.6 s and more, under 12 % at 0.15 s (the band filter's own ringing biases fast bands high; the same bias applies to the original and to RE·BODY, so `compare` stays fair) |
| `f0`, `f0_conf` (sine) | normalised autocorrelation of 0.5 to 1.9 s of the sine response, both channels summed; first peak after the first zero crossing that reaches 0.9 x the maximum of the lag range 30 Hz to 2 kHz (no octave-down picks), parabolic lag interpolation; `null` below confidence 0.3 |
| `f0_ir`, `f0_ir_conf` (impulse) | the same estimator on 20 to 500 ms after the strike: the tuned ring pitch. The sine response is dominated by the forced 440 Hz, so it only proves the pass-through, the ring pitch carries the tuning |
| `onset_ms` | time of the first output sample above -60 dB re the impulse-response peak |
| `rms_active`, `rms_tail`, `lufs_in`, `gain_lufs` (pink) | RMS over the 2 s of noise, RMS from 2.5 s on, input LUFS, output minus input LUFS |
| `click_peaks` (bursts) | peak dBFS in the 0.3 s after each of the 5 clicks (hook for the per-line novelty gate, T9) |

## 7. JSON layout

```
{"meta": {tool, metrics_version, target, patch, cmaj, generated, settings, extra_params, rates, stimuli,
          preroll_frames, lead_frames, ir_seconds, lead_seconds, cmd, bands_hz, notes},
 "results": {"<anchor>": {"<rate>": {"<stimulus>": {metrics as in §6, "flags": [...], or {"error": "..."}}}}}}
```
The original's anchor is the Morph value 0..7, RE·BODY's the `A Morph` value 0..10. One compact line per stimulus. No audio, ever.

## 8. `compare` (RE·BODY anchors against the original)

Mapping (generated from the constants of the tool):

<!-- BEGIN GENERATED: mapping -->
| RE-BODY anchor (A Morph) | RE-BODY body | original Morph | original body |
|---|---|---|---|
| 0 | Bass Drum | 0 | Bass Drum |
| 1 | Snare | 1 | Snare |
| 3 | Piano | 2 | Piano |
| 5 | Ukulele | 3 | Ukulele |
| 7 | Clarinet | 4 | Clarinet |
| 8 | Oboe | 5 | Oboe |
| 9 | Sax | 6 | Sax |
| 10 | Obosaxolele | 7 | Obosaxolele |

Not compared (no counterpart in BODY): 2 Timpani, 4 Guitar, 6 Fiddle.
<!-- END GENERATED: mapping -->

Checked per mapped anchor and per rate present in both JSON files, tolerances of the plan (N4, T2):
- **f0 ±5 ct** on the sine response; and on the impulse ring pitch (`f0_ir`) where the original is a usable reference: confidence >= 0.75 at that rate and the same within 5 ct at every rendered rate (this skips the snare and the piano, whose ring pitch is not stable in the original itself).
- **Band T60 ±15 %** for every octave band where the original has a T60 and the band holds at least -40 dB of the total energy; RE·BODY without a T60 in such a band fails.
- **LUFS ±1 dB** on the pink-noise response (the T2 gate "Line A at defaults within ±1.5 dB of the original" is the anchor 7 / Morph 4 line, covered by the stricter ±1 dB).
- `wet silent` is a FAIL (`--allow-silent`: SKIP). An anchor passes when all its rates pass.

Output format (the numbers are the measured deviations):
```
RE anchor  7 Clarinet   vs original Morph 4 Clarinet    : PASS
    48000: PASS (dLUFS +0.31 dB, df0 +0.4 ct, dring -0.2 ct, max dT60 +6 %)
```
The golden is rendered per rate on purpose: the original is not fully sample-rate invariant (§12).

## 9. Named gates (`check NAME`, P3 / P4b switch them on with `--gate`)

**`three-line-protector`** (P4b: "with B and C enabled at defaults the protector reduction stays < 3 dB", T2). Pink at the render rate, Line A morph `--anchor` (default 7, the default Morph). Four renders: A alone, B alone, C alone (the other lines disabled by `Enable`) and A+B+C with B and C `Enable` init 1 and everything else default. Reported: peak, RMS, LUFS of each; `delta_peak_db` (A+B+C minus A alone); `reduction_est_db` = power sum of the three single-line RMS levels minus the measured A+B+C RMS (the gain reduction itself is not observable from a render, this is its estimate and assumes uncorrelated lines). Gate: `reduction_est_db < 3` (`--max-reduction`) and A+B+C peak not above the input peak (+0.1 dB).

**`hold-stability`** (P4b Hold v2, T3). `A Hold` init 1, Material 0 / 50 / 100 (`--materials`), anchors 0, 2, 8 by default (the purely modal bodies, `--anchors`), 2 s pink then silence up to 62 s (`--seconds`). Level (RMS dBFS) in six 10 s windows after the pink. Gates: drift between neighbouring windows `< 0.5 dB per 10 s`, modal T60 from the straight-line fit of the window levels `>= 30 s`, `abs(DC) < 0.01`, finite. Not yet covered: "held modal spectrum within 1 dB per mode of the un-held tail at 1 s" (needs a second render without Hold and a mode list from the recipe).

**`split-complementary`** (P4b analysis gates: transient + sustain sums to the input at -100 dB, 3-band split flat ±0.2 dB, T7). Needs a debug patch, which the analysis stage's author provides: a normal patch with `input stream float<2> in` and `output stream float<4> out` where `out[0..1]` is the transient + sustain bus (L, R) and `out[2..3]` the low + mid + high bus (L, R). Found through `--debug-patch`, the environment variable `RE_BODY_SPLIT_PATCH`, or `plugin/debug/RE_BODY_SPLIT.cmajorpatch` / `tests/debug/RE_BODY_SPLIT.cmajorpatch`; without one the check reports `skipped`. Rendered with `--channels=4`: pink gives the residual `out[0] - in` (fixed latency up to ±256 frames is searched and reported as `ts_lag_frames`), gate `<= -100 dB`; the impulse gives the magnitude of `out[2]`, gate: ripple 20 Hz to 20 kHz within ±0.2 dB (0.4 dB peak to peak). Tested here with a mock probe patch (pass-through, -120 dB residual, 0.0 dB ripple).

## 10. Plan gates against the tool

| Gate (`docs/plan/30_DEV_PLAN.md`) | Tool |
|---|---|
| P2 render tests per anchor: impulse and noise, default and extreme Decay, T60, `abs(DC) < 0.01`, finite decay, tri-rate | `run --decay 50`, `--decay 0`, `--decay 100` (use `--out` for the extremes): `peaks`, `t60`, `dc`, flags `nonfinite` / `dc>0.01` / `t60_trunc`, rates 44.1 / 48 / 96 kHz |
| P2 peaks against the tables | data is in the JSON (`peaks`); the assertion needs expected frequencies per anchor (table below), not coded yet |
| P2 A/B against the legacy renders: f0 ±5 ct, band T60 ±15 %, LUFS ±1 dB (N4) | `compare --gate` |
| P2 loudness within ±1.5 dB LUFS of the original on the same pink noise (T2) | `compare`, line of anchor 7 (`dLUFS`) |
| P2 radiation-filter response on the pickup (T6, T7) | not measurable from the stereo output; needs a debug patch exposing the pickup, same hook idea as `split-complementary` |
| P3 Material 0 / 50 / 100 at constant T60(200 Hz), Size ±1 oct, Position and Coupling sweeps, no instability at any corner | `run --material 0\|50\|100 --out X --no-doc`, `--set "A Size=-100"`, `--set "A Position=..."`; stability = flags and `peak`; QA-probe conditions (440 Hz sine, silence, pink) are the stimuli |
| P4 morph click test at -100 dB | not possible with init patching (no parameter sweep during a render); needs a debug patch that automates Morph |
| P4b Hold, protector with three lines, split / band flatness | `check hold-stability`, `check three-line-protector`, `check split-complementary` |
| P4b per-line novelty, one trigger per onset | `bursts` render gives `click_peaks`; the striker count needs a debug tap |
| P4b Follow lock within 150 ms ±10 ct | not covered (needs the pitch tracker output over time) |
| `lhs_fuzz` in CI (N13) | PHYSIFY `tools/lhs_fuzz.py`, separate |

Assertions of `docs/concept/22_BODIES.md` and the metric that carries them (data in the JSON, no automatic assertion yet):

| Anchor | Assertion | Metric |
|---|---|---|
| 0 Bass Drum | peaks at f0 × {0.94, 1.00, 1.07, 1.59, 2.14, 2.30, 2.65} ±2 % (f0 73.6 Hz at Tune 58); T60 of (0,1) = Decay seconds ±10 %; `abs(DC) < 0.01` | `peaks`, `t60_bb` (the 125 Hz octave band starts at 88 Hz, above f0), `dc` |
| 1 Snare | head peaks ±2 %; rattle follows onsets and sustained input, exactly zero for silent input | `peaks`, `click_peaks`, `silence`, `corr` |
| 2 Timpani | ratio set ±1.5 %; (1,1) at the Tune note ±10 ct; (0,1) T60 < 0.15 s | `peaks`, `f0_ir`, `t60` |
| 3 Piano | string pair at the note ±5 ct; feature peaks at 84, 127, 194, 204, 229, 271, 301 Hz ±3 %; T60(1 kHz) 0.1 s ±20 % | `f0_ir`, `peaks`, `t60[3]` |
| 4 Guitar | A0 95 to 110 Hz, T1 195 to 210 Hz, dip between them 6 dB or more; string ±5 ct | `peaks` (the dip needs the full spectrum, not stored), `f0_ir` |
| 5 Ukulele | A0 / T1 ±5 % with the dip; T60 at 290 Hz 0.1 s ±30 % | `peaks`, `t60[1]` |
| 6 Fiddle | A0 and B1± peaks ±3 %; no self-oscillation at any Decay | `peaks`, `run --decay 100` flags, `t60_trunc` |
| 7 Clarinet | odd harmonics 12 dB over even; pitch ±5 ct across C2 to C5; radiation cutoff | `peaks`, `f0_ir` with `--set "A Tune=..."` |
| 8 Oboe | cluster peaks at the ratios ±1 %, formants ±3 %, no blow-up at Material 100 | `peaks`, `run --material 100` flags |
| 9 Sax | full harmonic series; radiation cutoff; pitch ±5 ct | `peaks`, `f0_ir` |
| 10 Obosaxolele | end-stop energy within ±1 dB of the Sax stop on pink | `lufs` of anchors 10 and 9 in the same JSON |

## 11. Golden of the original BODY

<!-- BEGIN GENERATED: golden-summary -->
Generated by `golden-original` on 2026-10-17T08:04Z with cmaj 1.0.3175 (Decay 50, Mix 100, renderer pre-roll 20480 frames, lead-in 0.5 s). Peaks: Hz (dB re strongest peak) of the impulse response; T60 in seconds; f0 sine = autocorrelation f0 of the 440 Hz sine response, f0 ring = of the impulse response (20-500 ms after the strike) with its confidence.

| Morph | Anchor | SR | LUFS pink | top 3 peaks (Hz, dB) | T60 250 Hz | T60 1 kHz | T60 4 kHz | f0 sine (Hz) | f0 ring (Hz, conf) |
|---|---|---|---|---|---|---|---|---|---|
| 0 | Bass Drum | 44.1 k | -27.4 | 81.5 (+0.0); 71 (-14.7); 142.8 (-15.1) | 0.247 | 0.004 | 0.001 | 440.0 | 81.2 (0.77) |
| 0 | Bass Drum | 48 k | -27.3 | 81.5 (+0.0); 71 (-14.7); 142.8 (-15.2) | 0.247 | 0.004 | 0.001 | 440.0 | 81.2 (0.77) |
| 0 | Bass Drum | 96 k | -27.7 | 81.4 (+0.0); 70.9 (-14.8); 142.9 (-15.3) | 0.248 | 0.004 | 0.001 | 440.0 | 81.1 (0.77) |
| 1 | Snare | 44.1 k | -29.4 | 1207.8 (+0.0); 3588.8 (-1.2); 3432.4 (-2.0) | 0.219 | 0.247 | 0.237 | 440.3 | - |
| 1 | Snare | 48 k | -29.5 | 5535.9 (+0.0); 3978.8 (-0.2); 3478.2 (-0.4) | 0.248 | 0.230 | 0.236 | 439.6 | - |
| 1 | Snare | 96 k | -31.7 | 1941.2 (+0.0); 4393.5 (-1.7); 1837.2 (-1.8) | 0.222 | 0.230 | 0.237 | 440.1 | - |
| 2 | Piano | 44.1 k | -28.7 | 1110.2 (+0.0); 887.2 (-0.8); 660.4 (-1.1) | 1.26 | 1.04 | 0.532 | 440.0 | 225.3 (0.80) |
| 2 | Piano | 48 k | -29.5 | 659.6 (+0.0); 886.7 (-0.3); 438.4 (-1.0) | 1.24 | 1.10 | 0.534 | 440.0 | 225.0 (0.80) |
| 2 | Piano | 96 k | -28.9 | 656.9 (+0.0); 885 (-0.1); 437.6 (-1.3) | 1.21 | 1.08 | 0.558 | 440.0 | 222.1 (0.87) |
| 3 | Ukulele | 44.1 k | -31.0 | 220 (+0.0); 440 (-0.7); 1102.4 (-5.1) | 0.237 | 0.123 | 0.035 | 440.0 | 220.5 (0.84) |
| 3 | Ukulele | 48 k | -31.2 | 220 (+0.0); 440.1 (-0.8); 1102.5 (-5.3) | 0.248 | 0.124 | 0.035 | 440.0 | 220.5 (0.84) |
| 3 | Ukulele | 96 k | -32.2 | 220.1 (+0.0); 440 (-0.7); 1102.4 (-5.4) | 0.224 | 0.121 | 0.037 | 440.0 | 220.5 (0.84) |
| 4 | Clarinet | 44.1 k | -27.2 | 220 (+0.0); 660.9 (-9.0); 1104.2 (-15.6) | 0.501 | 0.168 | 0.029 | 440.0 | 220.3 (0.92) |
| 4 | Clarinet | 48 k | -27.2 | 220 (+0.0); 660.9 (-9.0); 1104.2 (-15.6) | 0.502 | 0.168 | 0.029 | 440.0 | 220.3 (0.92) |
| 4 | Clarinet | 96 k | -26.7 | 220 (+0.0); 660.9 (-9.0); 1104.3 (-15.5) | 0.502 | 0.169 | 0.029 | 440.0 | 220.4 (0.92) |
| 5 | Oboe | 44.1 k | -22.8 | 1540 (+0.0); 1414.3 (-4.0); 1674.6 (-4.8) | 0.166 | 0.290 | 0.267 | 440.0 | 1542.3 (0.90) |
| 5 | Oboe | 48 k | -22.7 | 1540 (+0.0); 1414.3 (-4.0); 1674.6 (-4.8) | 0.166 | 0.290 | 0.267 | 440.0 | 1542.4 (0.90) |
| 5 | Oboe | 96 k | -22.8 | 1540 (+0.0); 1414.3 (-4.0); 1674.6 (-4.8) | 0.166 | 0.290 | 0.268 | 440.0 | 1542.3 (0.90) |
| 6 | Sax | 44.1 k | -24.8 | 219.9 (+0.0); 440 (-0.1); 660 (-0.2) | 0.660 | 0.575 | 0.298 | 440.0 | 220.1 (0.92) |
| 6 | Sax | 48 k | -24.7 | 660.1 (+0.0); 219.9 (-0.6); 440 (-1.0) | 0.659 | 0.571 | 0.298 | 440.0 | 220.1 (0.92) |
| 6 | Sax | 96 k | -24.9 | 660 (+0.0); 219.9 (-0.5); 440 (-0.8) | 0.660 | 0.587 | 0.301 | 440.0 | 220.1 (0.93) |
| 7 | Obosaxolele | 44.1 k | -26.7 | 439.6 (+0.0); 221.7 (-5.1); 1105 (-6.1) | 1.18 | 0.736 | 0.056 | 440.0 | 220.8 (0.95) |
| 7 | Obosaxolele | 48 k | -26.6 | 439.6 (+0.0); 221.7 (-5.1); 1105 (-6.1) | 1.18 | 0.737 | 0.060 | 440.0 | 220.8 (0.95) |
| 7 | Obosaxolele | 96 k | -27.2 | 439.6 (+0.0); 221.7 (-5.1); 1105 (-6.3) | 1.18 | 0.745 | 0.085 | 440.0 | 220.8 (0.95) |
<!-- END GENERATED: golden-summary -->

## 12. What the golden shows

- Silence in gives exactly zero out for all 8 anchors and 3 rates; DC stays below 4.2e-4; nothing is non-finite or clipped; no T60 is truncated.
- The 440 Hz sine response is 440 Hz for every anchor (forced response; 439.6 to 440.3 Hz for the snare), so `f0 sine` mostly proves the pass-through. The tuned ring pitch is in `f0 ring`: 220.1 to 220.8 Hz for the pitched anchors (Ukulele 220.5, Clarinet 220.3, Sax 220.1, hybrid 220.8), the Oboe cluster rings at 1542 Hz, the bass drum at 81.2 Hz (confidence 0.77), the piano is ambiguous (222 to 225 Hz, confidence 0.80 to 0.87, a detuned string pair), the snare has none (noise rattle, decorrelated L/R: correlation about 0 for impulse and clicks, 0.60 for pink, 0.91 for the sine, while the other anchors are mono: 1.0, and 0.97 to 1.0 for the Sax).
- Loudness: pink noise at -20 dBFS RMS (-16.5 LUFS) comes out between -22.7 LUFS (Oboe) and -31.2 LUFS (Ukulele) at 48 kHz, i.e. 6.2 to 14.7 LU below the input; Clarinet (the default Morph) -27.2 LUFS.
- The original is not fully sample-rate invariant: Snare 96 kHz is 2.2 LU quieter than 48 kHz (noise rattle), Ukulele 1.0 LU, and the Obosaxolele T60 at 4 kHz is 0.056 / 0.060 / 0.085 s at 44.1 / 48 / 96 kHz. `compare` therefore uses the golden of the same rate.
- Snare impulse peaks differ from rate to rate (noise), only its T60 (0.22 to 0.25 s in all bands) is stable.
- Pre-roll 20480 frames at all three rates, lead-in 0.5 s (§3).

## 13. Latest RE·BODY run

<!-- BEGIN GENERATED: run-report -->
Generated by `run` on 2026-10-17T08:48Z with cmaj 1.0.3175; settings {"decay": 50.0, "mix": 100.0, "bypass": 0.0, "material": 50.0, "enableA": 1.0, "enableB": 0.0, "enableC": 0.0, "hold": 0.0}; extra {}; stimuli silence, impulse, pink, sine. Peak = worst case over the stimuli, DC = largest |mean| over the stimuli, LUFS = pink noise, peaks/T60/f0 as in the golden table (T60 bands 125 / 250 / 500 / 1k / 2k / 4k / 8k Hz).

| Anchor | SR | peak dBFS | LUFS pink | DC | top 3 peaks (Hz, dB) | band T60 s | f0 sine (Hz) | f0 ring | flags |
|---|---|---|---|---|---|---|---|---|---|
| 0 Bass Drum | 48 k | -10.2 | -33.4 | 5.9e-06 | 87.3 (+0.0); 78.4 (-1.5); 138 (-9.8) | 0.403 / 0.314 / 0.276 / 0.215 / 0.152 / 0.092 / 0.049 | 440.0 | 80.6 (0.43) | ok |
| 1 Snare | 48 k | 0.0 | -30.0 | 3.8e-06 | 5535.9 (+0.0); 3978.8 (-0.2); 3478.2 (-0.4) | 0.313 / 0.284 / 0.243 / 0.230 / 0.230 / 0.236 / 0.236 | 439.5 | - | ok |
| 2 Timpani | 48 k | -12.9 | -31.8 | 1.1e-06 | 186.4 (+0.0); 220.1 (-0.1); 196.5 (-0.6) | 1.55 / 1.39 / 1.27 / 1.06 / 0.783 / 0.516 / 0.284 | 440.0 | 111.6 (0.34) | ok |
| 3 Piano | 48 k | -8.1 | -29.1 | 1.4e-05 | 221.4 (+0.0); 882.5 (-3.6); 659.6 (-4.4) | 1.28 / 1.31 / 1.17 / 1.10 / 0.784 / 0.543 / 0.246 | 440.0 | 224.8 (0.82) | ok |
| 4 Guitar | 48 k | -18.4 | -41.1 | 1.5e-05 | 439.8 (+0.0); 219.9 (-5.5); 660 (-6.5) | 1.06 / 0.956 / 0.779 / 0.580 / 0.234 / 0.107 / 0.034 | 440.0 | 220.1 (0.93) | ok |
| 5 Ukulele | 48 k | 0.0 | -30.4 | 9.8e-06 | 222.9 (+0.0); 438.2 (-6.9); 880.8 (-9.8) | 0.260 / 0.260 / 0.220 / 0.134 / 0.080 / 0.039 / 0.023 | 440.0 | 221.1 (0.87) | ok |
| 6 Fiddle | 48 k | -12.1 | -26.3 | 4.9e-06 | 880 (+0.0); 1320.3 (-0.7); 440 (-2.6) | 0.863 / 0.829 / 0.715 / 0.529 / 0.388 / 0.146 / 0.059 | 440.1 | 220.1 (0.92) | ok |
| 7 Clarinet | 48 k | -15.8 | -26.1 | 9.5e-06 | 220 (+0.0); 660.9 (-11.4); 1104.3 (-18.8) | 0.502 / 0.502 / 0.448 / 0.171 / 0.080 / 0.037 / 0.022 | 440.0 | 220.2 (0.93) | ok |
| 8 Oboe | 48 k | -10.2 | -22.8 | 4.2e-06 | 1540.1 (+0.0); 1674.7 (-5.9); 1414.9 (-6.0) | 0.260 / 0.220 / 0.188 / 0.264 / 0.274 / 0.144 / 0.106 | 440.0 | 1537.2 (0.59) | ok |
| 9 Sax | 48 k | -12.0 | -25.2 | 3.6e-05 | 219.9 (+0.0); 440 (-2.5); 660 (-3.7) | 0.662 / 0.660 / 0.624 / 0.576 / 0.444 / 0.321 / 0.314 | 440.0 | 220.0 (0.94) | ok |
| 10 Obosaxolele | 48 k | -7.4 | -24.9 | 4.2e-05 | 439.8 (+0.0); 221.6 (-0.7); 660.4 (-13.1) | 1.21 / 1.14 / 0.958 / 0.989 / 0.231 / 0.052 / 0.023 | 440.0 | 220.6 (0.95) | ok |
<!-- END GENERATED: run-report -->

## 14. Limits and follow-ups

- The lowest T60 band is 125 Hz (88 to 177 Hz); a bass-drum root below 88 Hz needs the peak list or `t60_bb`. A 63 Hz band is a one-line addition to `BAND_CENTRES` if P3 needs it (bump `METRICS_VERSION`).
- Peak lists are measurements, not assertions: the per-anchor expected-frequency tables of §10 belong to the phases that fix the recipes (P2 modal bank, P3).
- Debug-patch hooks (split, radiation pickup, Morph automation, striker counts) share one idea: a normal patch that exposes an internal signal as extra output channels, rendered with `--channels=N`. Only the split hook exists.
- Block size is cmaj's default; other block sizes change the pre-roll (§3) but not the measured responses (not exercised).
