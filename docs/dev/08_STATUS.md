# 08 - Status of RE·BODY 0.9.0 (2026-10-17)

State in one line: every gate that can be run offline (cmaj generate / test / render, kit lints, headless Chromium) is green; the host spike, the QA and UI probes, the listening pass and the DAW CPU figure need the owner's Amorph and are listed in section 5 (D42). Plan table: `docs/plan/30_DEV_PLAN.md` §5. History: `CHANGELOG.md`.

## 1. Definition of done (`docs/plan/30_DEV_PLAN.md` §4)

| # | item | status | evidence / where |
|---|---|---|---|
| 1 | All 11 anchors render-verified on Line A | **done** | impulse, silence, 440 Hz sine, pink at 44.1 / 48 / 96 kHz without flags (`05_LINE_A.md` §9); `compare --gate` PASS (§2.1); 462-render knob sweep and 132 combined-extreme renders (`06_P3_PHYSICS.md` §8) |
| 2 | Lines B and C verified with Chain, strikers, Hold v2, Follow | **done** | `07_P4B_LINES.md` §3 (gates in §2.3 below), `tests/lines.cmajtest`, `tests/strikers.cmajtest`, `tests/analysis.cmajtest` |
| 3 | Host spike recorded in `00_HOST_SPIKE.md` | **pending owner** | protocol and results table in `00_HOST_SPIKE.md` (D33, D42) |
| 4 | `run_qa_probe` and `run_ui_probe` green on the owner's Amorph | **pending owner** | `00_HOST_SPIKE.md` steps 3 and 4 |
| 5 | Parallax field with lines at depth and a reduced-motion path | **done offline**, host feel pending owner | 11-layer perspective field, inactive lines as ghosts at depth, chain thread, Motion Off / Calm / Full, `prefers-reduced-motion` forces Off (`02_UI_DEVIATIONS.md` §H-J, 194 smoke checks, `docs/dev/screens/p6_final_960.png`); pointer delivery and frame time in the real WebView: `00_HOST_SPIKE.md` step 9 |
| 6 | 73 parameters with `data-param` controls | **done** | each of the 73 ids exactly once in the DOM (smoke test), `check_sync.py` 73 / 73, preflight consistent (§2.4); the lines B and C controls are in the DOM behind `hidden` tabs, the probe question is `00_HOST_SPIKE.md` step 4 |
| 7 | Hold wording in the UI | **done** | tooltip of the Hold button in the morph row: "Hold sustains the body resonance; strings and bores ring out naturally" (`HOLD_TIP`, `src/ui/30_panel.js`) |
| 8 | Mode-level melt not required | **deferred to v1.1** | D27 |
| 9 | Brand line and credit present | **done** | brand `CLΞΛRPΞΛK` small under the title (header, left; `BRAND` in `src/ui/00_header.js`) and as manifest `manufacturer`; credit "Based on BODY by Artists in DSP" in the manifest description and in `README.md` (as 20 §0 specifies, the UI panel itself carries no credit text) |
| 10 | CPU figure recorded | **recorded offline, above the target note**; DAW figure pending owner | §3: three lines at 96 kHz 10.2 % of one core (`cmaj render`); the 8 % target note is not a ceiling (D9) |
| 11 | Docs current | **done**, two known exceptions | README, CHANGELOG, this file, `00_HOST_SPIKE.md`, `00_P1_CONTRACTS.md` synced in this release prep; `04_RENDER_CI.md` §9 and `07_P4B_LINES.md` §3 / §5 still describe the pre-D45 hold-stability computation (the tool and D45 are authoritative, §2.3) |

## 2. Gate results

### 2.1 P2 loudness and pitch against the original BODY (`render_ci.py compare --gate`, exit 0)
Hard gates of D44: pink-noise LUFS within ±1 dB per mapped anchor, ring f0 within ±5 ct where BODY's own ring is stable, sine f0 within ±5 ct, new anchors within ±3 dB of the mapped mean. 165 renders (11 anchors x 5 stimuli x 3 rates), no render flags, all 11 anchors PASS at 44.1 / 48 / 96 kHz.

| anchor | dLUFS 44.1 / 48 / 96 kHz | ring f0 vs BODY, ct |
|---|---|---|
| Bass Drum | +0.29 / -0.11 / -0.20 | +0.4 / +0.4 / +0.5 |
| Snare | +0.05 / -0.06 / -0.18 | n/a (noise rattle) |
| Piano | +0.06 / +0.40 / +0.04 | n/a (BODY's detuned pair) |
| Ukulele | -0.30 / -0.35 / +0.29 | +3.6 / +3.6 / +4.0 |
| Clarinet (default Morph) | -0.11 / -0.19 / -0.21 | -0.8 / -0.8 / -0.9 |
| Oboe | +0.06 / +0.05 / +0.05 | -2.1 / -2.0 / -2.0 |
| Sax | -0.41 / -0.47 / -0.44 | -0.7 / -0.8 / -0.7 |
| Obosaxolele | -0.19 / +0.22 / +0.24 | -0.7 / -0.6 / -0.5 |
| Timpani, Guitar, Fiddle (no counterpart, dB re the mapped mean) | -1.66 / -1.75 / -1.94, -1.88 / -1.94 / -1.60, +1.18 / +1.09 / +0.88 | - |

Largest |dLUFS| 0.47 dB (Sax, 48 kHz), largest ring f0 deviation 4.0 ct (Ukulele, 96 kHz), sine f0 within ±0.4 ct for every anchor and rate. Band T60 is reported, not gated (D44); deviations over 15 %: Bass Drum +20 % / +27 % at 125 / 250 Hz and far above BODY from 500 Hz (BODY's bands there hold only skirts), Snare +29 % / +16 %, Clarinet +30 % / +41 % at 4 / 8 kHz, Oboe +28 % at 250 Hz and -34 % / -46 % at 4 / 8 kHz, Obosaxolele -62 % at 2 kHz; Piano, Ukulele and Sax within ±15 %. Causes per anchor: `05_LINE_A.md` §9.2.

### 2.2 P3 physics (`06_P3_PHYSICS.md` §7-§8)
- Defaults bit-identical to P2 for Bass Drum, Snare, Timpani, Piano, Guitar, Ukulele and Oboe (28 render pairs, maximum difference 0.0); Clarinet, Sax and Obosaxolele within 0.05 dB RMS (the bore allpass is always in the loop).
- Knob sweep: 11 anchors x 10 knobs at 0 and 100 plus defaults, pink and impulse, 48 kHz: **462 renders, 0 assertion failures** (finite, peak below 0 dBFS, |DC| < 0.01, decaying; largest |DC| 9.8e-5). **109 of 110 knob x anchor cells measurably effective, 110 of 110** counting the waveform difference of Stiffness x Snare.
- Combined extremes (all ten knobs at 0 and at 100): **132 renders at 44.1 / 48 / 96 kHz, 0 failures.**

### 2.3 P4b lines (`07_P4B_LINES.md` §3; the unit tests, the Hold fit, the protector check, `compare` and the UI smoke test were re-run on this tree, the render scripts for Chain, strikers, Follow and the Hold spectrum are the scratch scripts of that document)
| gate | result |
|---|---|
| transient + sustain = input, -100 dB | PASS (residual <= -120 dB, `analysis.cmajtest`, `lines.cmajtest`) |
| 3-band split flat ±0.2 dB | PASS at 44.1 / 48 / 96 kHz (`analysis.cmajtest`) |
| Chain acyclic, no runaway | PASS (A -> B -> C on 60 s pink, 48 and 96 kHz, finite, RMS per 10 s steady within 0.4 dB) |
| strikers finite, velocity-monotonic | PASS (6 bodies x Hammer / Pluck / Breath, 48 and 96 kHz) |
| per-line novelty: one fire per onset, none inside 30 ms | PASS (`lines.cmajtest`) |
| **Hold (D45)**: T60 from the straight-line fit >= 30 s, residual <= 0.5 dB, slope <= 0, abs(DC) < 0.01 | **PASS** (`render_ci.py check hold-stability --gate`, anchors 0 / 2 / 8 x Material 0 / 50 / 100, 62 s render): 48 kHz T60 44.7 .. 45.1 s, residual <= 0.04 dB, slope -1.33 .. -1.34 dB/s, DC <= 8.9e-6; 96 kHz T60 44.8 .. 45.5 s, residual <= 0.25 dB, DC <= 6.3e-5. The old wording ("drift < 0.5 dB per 10 s" between neighbouring windows) excluded T60 >= 30 s and failed by design; it is replaced in the tool and the plan (D45). Shorter windows show the beating of close Bass Drum modes at 96 kHz (1 s windows 2.0 dB, sliding 10 s 0.51 dB) which is not drift, hence the consecutive 10 s windows |
| Hold: held spectrum within 1 dB per mode | PASS (0.83 / 0.12 / 0.04 dB at 48 kHz, 0.86 / 0.18 / 0.18 dB at 96 kHz; Bass Drum, Timpani, Oboe; scratch script, plus `lines.cmajtest` `holdFreezesEveryMode` on every pole and slot) |
| Follow locks within 150 ms ±10 ct | PASS (76.7 ms, error +0.04 ct; 96 kHz 77.3 ms) |
| 3-line protector reduction < 3 dB | PASS (`check three-line-protector --gate`: -0.45 dB at 48 kHz, -0.22 dB at 96 kHz) |
| silence after a sound costs nothing | PASS after the denormal guard (`09_CPU.md` Table 3) |

### 2.4 Builds, lints, tests, UI (run on this tree)
| check | result |
|---|---|
| `python3 tools/build_dsp.py --check` | up to date |
| `python3 tools/build_ui.py --check` | up to date, `node --check` ok |
| `python3 tools/bodytab.py --check --strict` | 11 recipes, tables and `bodies.json` current |
| `cmaj test tests/*.cmajtest` (cmaj 1.0.3175) | 6 files (analysis, helpers, lines, modal, strikers, tables), 7 tests passed, 0 failed |
| `cmaj generate` on `plugin/RE_BODY.cmajorpatch` | loads |
| `preflight.py plugin --strict` | 0 errors, 0 warnings, all clear |
| `manifest_check.py plugin/RE_BODY.cmajorpatch --strict` | clean |
| `check_sync.py plugin/dsp.cmajor plugin/index.js` | 73 / 73 parameters consistent |
| `render_ci.py selftest` | 35 checks pass (30 measurement checks + 5 for the Hold fit) |
| `node tests/ui/smoke.mjs` (headless Chromium, mock `patchConnection`) | **194 / 194 checks passed** (about 3.3 min; three earlier runs 194 / 194, no flakes) |
| kit `ui_lint.py plugin/index.js --strict` (kit and branding versions) | both clean: 0 errors, 0 warnings |

Sizes: `plugin/dsp.cmajor` 7,386 lines (357 KB), `plugin/index.js` 2,254 lines (160 KB); state about 68 k floats per line, 205 k for three (`05_LINE_A.md` §7); JIT compile 1.5 .. 3 s (`cmaj`, not the host).

## 3. CPU (`09_CPU.md`, `cmaj render`, 4-core Linux container, marginal cost of 60 s of pink noise at -20 dBFS RMS, one run per cell, spread about ±1 percentage point)

| configuration | 48 kHz, % of one core (wall / CPU) | 96 kHz, % of one core (wall / CPU) |
|---|---|---|
| idle: all lines off (tool I/O + Splitter) | 1.0 / 1.6 | 0.1 / 0.5 |
| Line A alone (Clarinet, defaults) | 1.8 / 2.1 | 3.5 / 3.8 |
| **A + B + C** (Clarinet, Bass Drum, Piano; B Transient, C Sustain) | **4.4 / 4.7** | **10.2 / 10.9** |
| A + B + C, Follow 100 and Excite Breath on all three | 7.2 / 7.8 | 11.2 / 12.1 |

**96 kHz with three lines is above the 8 % target note** (10.2 % wall, 9.1 .. 10.2 % over two runs, about 1.3x; with Follow on every line 11.2 %). By D9 the target is a note, not a ceiling, and the heaviest case measured still runs 8.9x realtime. The cost is the grid (1.74 k flops per sample per line while anything rings) and the slot banks (0.45 k per running slot body). v1.1 optimisation candidates: SIMD slot banks, the pitch-tracker cost (+1.7 percentage points at 48 kHz while a line has Follow > 0), the always-on Splitter at 2x the control rate (0.3 percentage points today). A line that is idle costs nothing, silence after a sound costs nothing (denormal guard, `07_P4B_LINES.md` §2.8). The DAW figure at 48 and 96 kHz with one and three lines is part of `00_HOST_SPIKE.md` (step 12).

## 4. Known deviations and open items

| item | state and reason |
|---|---|
| **Obosaxolele T60 at 2 kHz** | 0.13 s against BODY's 0.35 s (-62 %), reported not gated (D44). BODY's 2 kHz ring comes from the time-varying radiation weights of the oboe pair modes (BODY:755-764); the modal API has no per-mode output gain over time. The pinch weights are applied to the oboe banks (0.114 -> 0.132 s), scaling them x2 / x4 gives only 0.148 / 0.192 s, `energy_target` 0.4496 gives 0.19 s but +1.3 dB LUFS, so 0.2 stays (`05_LINE_A.md` §9.2, `07_P4B_LINES.md` §2.7). Loudness and pitch of the end stop are within the gates |
| **Linear delay reads instead of Lagrange-3** | the loops and the Follow glide use linear interpolation as BODY does (the glide is 40 ms and the retune ramps per tick); the fraction-dependent low-pass of linear reads is a known side effect, neither measured nor listened to (`07_P4B_LINES.md` §2.4) |
| **Lower halves of some physics knobs are inert** | Clarinet Air and Oboe Air (BODY has no breath noise there), Ukulele Stiffness (the string has no dispersion): the recipe default is the neutral value, so the knob acts from 50 up; all other cells act on both sides (`06_P3_PHYSICS.md` §9) |
| **Deferred to v1.1** | mode-level melt (D27), Oboe cone waveguide (D30), bridge reflection and two-way Coupling (D31), MIDI pitch input (D43: the Amorph FX binary has no MIDI upstream; verify MIDI delivery in the host) |
| **Host spike pending (D42)** | hidden controls and the probe (D39: tabs vs fallback strip), custom-endpoint and pointer delivery, WebKit stroke weight, hit-testing through `preserve-3d`, perspective x zoom, frame feel, compile time of the three-line state: nothing of this was run in a real host |
| Telemetry event rate and ranges | `cmaj render` does not capture output events; the 10 outputs are emitted every max(1, int(sr / 30)) samples in the code and painted by the UI in the mock-connection smoke test; the host check is `00_HOST_SPIKE.md` step 5 |
| Per-register tuning LUT (D31, plan P3 row) | not built: `tune_lut_cents` is `null` in all recipes; the loops take the loop low-pass and dispersion phase delay out analytically, pitch was verified at A3 (ring f0 220.0 .. 221.1 Hz, within 4 ct of BODY, `05_LINE_A.md` §2 and §2.1 above) and with the forced 440 Hz sine, not swept over C2 .. C5 |
| P4 morph click test at -100 dB, `lhs_fuzz` in CI (N13) | not automated (they need a Morph-automation debug patch and the PHYSIFY tool respectively); replaced by a 20 s Morph sweep and run-time jumps (finite, `05_LINE_A.md` §9), the 462-render sweep and the combined extremes |
| Strike calibration, Fiddle, grid floors | `strike_gain` per body and all `(design)` values of 22 are first-listen values: Hammer and Pluck within -2.7 .. +1.2 dB of Through, Breath -6 .. +6 dB (`07_P4B_LINES.md` §4); Fiddle keeps its placeholder calibration (+1.09 dB re the mapped mean, inside the window) |
| Hold details | held energy is measured before the protector; a very quiet line stays Armed and re-captures; a frozen body ignores Tune / Material / Size changes; loops and the snare rattle ring out by design (D26) |
| Follow | the tracker runs only for computed lines with Follow > 0 (the concept said any line) |
| Denormals in the host | the guard flushes filter and follower states below 1e-20 at the control tick; whether the host sets flush-to-zero is unknown; single modal poles inside a living lane are not flushed individually: repeat "burst, then silence" in the DAW (`00_HOST_SPIKE.md` step 12) |
| Documents older than D45 | `04_RENDER_CI.md` §9 (hold-stability paragraph) and `07_P4B_LINES.md` §3 / §5 (Hold rows) still say the check fails by design; superseded by D45 |
| `plugin/spec.json` | `plugin.version` still reads 0.1.0 and `view.note` predates D40; the manifest (0.9.0, 960 x 600) is authoritative, align the spec at the next edit of that file |

## 5. What the owner must test

Everything that needs the real host is in **`docs/dev/00_HOST_SPIKE.md`**: steps for the Amorph MCP loop, the two probes, the listening checklist per anchor, the three-line test, Chain / Hold / Follow / Blend, Motion and resize, WebKit specifics, CPU in the DAW, a results table and the exact hand-over line. Its outcome decides D39 (tabs or the always-visible strip) and closes items 3, 4, 5 and 10 of section 1.

## 6. Evidence index
`01_TABLE_EMISSION.md` (table form) · `02_UI_DEVIATIONS.md` (UI, 07_SCALING, upstream contract) · `03_RECIPES.md` (recipes, tables) · `04_RENDER_CI.md` (tool, golden of BODY) · `05_LINE_A.md` (Line A, P2 gate, calibration log) · `06_P3_PHYSICS.md` (knobs, sweeps) · `07_P4B_LINES.md` (lines, Hold, Follow, strikers) · `09_CPU.md` (CPU) · `00_P1_CONTRACTS.md` (file ownership, build) · `tests/ui/README.md` (smoke test) · `docs/concept/00_DECISIONS.md` (D1 .. D45).
