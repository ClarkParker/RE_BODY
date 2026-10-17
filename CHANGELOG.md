# Changelog

RE·BODY, newest first. Versions group the git history by phase (`git log --oneline`; on 2026-10-17 the history interleaves P2, P6 and P3); the manifest carries 0.9.0. Phase table: `docs/plan/30_DEV_PLAN.md` §5, state and gate numbers: `docs/dev/08_STATUS.md`.

## 0.9.0 - release preparation (host test pending)
- Phases P4b and P6 complete; every offline gate green (`docs/dev/08_STATUS.md`).
- **D45:** the Hold gate is the straight-line fit of the held tail (T60 >= 30 s, residual <= 0.5 dB, no growth, abs(DC) < 0.01); `tools/render_ci.py check hold-stability` rewritten accordingly (it failed by design before), 5 new self-checks, `--fit-window`.
- Docs: `docs/dev/08_STATUS.md` (definition of done, gates, CPU, deviations), `docs/dev/00_HOST_SPIKE.md` rewritten as the owner's host test, `docs/dev/00_P1_CONTRACTS.md` synced to the final files, plan §5 status table, `README.md`, this file. Manifest version 0.9.0.
- Pending on the owner's Amorph: host spike, `run_qa_probe`, `run_ui_probe`, listening pass, CPU in a DAW.

## 0.8.0 - P4b / P5: lines B and C wired (df604a3)
- Listen splits (All / Transient / Sustain / Low / Mid / High) and Chain, Excite Through / Hammer / Pluck / Breath with Blend, Touch as velocity curve, Hold v2 (modal freeze, armed / capture), Follow, Pan, Enable semantics (chained-from lines computed when disabled).
- Real telemetry on all 10 outputs, Obosaxolele pinch weights, per-body `strike_gain` tables, denormal guard (silence after a sound no longer costs CPU), first CPU figures (`docs/dev/09_CPU.md`).
- Gates: split complementary, Chain acyclic, strikers monotonic, Follow lock 77 ms, 3-line protector -0.45 dB, Hold T60 45 s (`docs/dev/07_P4B_LINES.md`).

## 0.7.0 - P4b: strikers and analysis (ccaa579, 16a57d3)
- Strikers Hammer, Pluck (+ PluckBody) and Breath, DC-blocked and unit-RMS normalised; analysis stage: transient / sustain splitter, LR4 bands, YIN pitch tracker with spread work; `tests/strikers.cmajtest`, `tests/analysis.cmajtest`.

## 0.6.0 - P6: UI integration, U6 / U7 (8286e19, 8f109e5)
- Merged UI module, chain thread, MORE / LESS, Copy A -> B / C with undo, keys 1 / 2 / 3, 07_SCALING chassis with resize suspension, generated `MODE_IDS` / `Z_TABLE`; `tests/ui/smoke.mjs` (194 checks); `docs/dev/02_UI_DEVIATIONS.md` §I-J.
- Fiddle gets its second f-hole (silhouette path 9).

## 0.5.0 - P3: physics knobs (994d80a)
- Touch, Position, Bright, Body, Stretch, Stiffness, Coupling, Air (2-DOF box modes), Reed and Width live on every line; 110 of 110 knob x anchor cells effective, 462-render sweep and combined extremes finite at three rates, P2 gate unchanged (`docs/dev/06_P3_PHYSICS.md`).

## 0.4.0 - P6: panel, field, motion (3cb834f, 714a86d, 2bc5555, cfead57)
- Silhouette templates for all 11 anchors (originals verbatim, Timpani / Guitar / Fiddle new).
- Panel: dial v2, morph hero with weight bars and Hold lamp, grouped strips, lamp states, grain, telemetry v2 on all 10 outputs.
- Field: 11-layer perspective depth stack with per-path z morph, light cues, ghost lines with a hit layer; motion controller Off / Calm / Full with audio push and reduced-motion path.

## 0.3.0 - P2: Line A integrated, gate passed (bbf33ab, 07c2f16, 1fe288a)
- BODY's engines ported into the recipe architecture, 11-anchor morph, shared register, per-line novelty, loudness chain, telemetry.
- D44: A/B gate = loudness and pitch identity (LUFS within ±0.5 dB, ring f0 within ±4 ct at 44.1 / 48 / 96 kHz, new anchors within ±2 dB), band T60 reported (`docs/dev/05_LINE_A.md` §9).

## 0.2.0 - P2: modal engine and render CI (9e119f4, 244108b, 9d87fa7, be8cd51, 89760aa)
- Original BODY packaged as the golden reference (D42: owner-side tests at the end); modal engine (96-pole grid in `float<8>` lanes, per-body slot banks, one damping rule, energy normalisation, Hold, Nyquist culling) with 22 unit tests; `plugin/dsp.cmajor` rebuilt.
- `tools/render_ci.py` (cmaj render harness, BS.1770 LUFS, band T60, peaks, f0, gates) and the golden metrics of BODY; D43: MIDI pitch input deferred to v1.1.

## 0.1.0 - P1: skeleton (cb09858, ffee483, c9c3374, a7fb4e0, ca88422)
- Concept freeze (D40, chassis 960 x 600), `plugin/spec.json` with 73 parameters and 10 outputs, shared contracts.
- Recipes for all 11 anchors and `tools/bodytab.py` (tables, `bodies.json`); table emission as namespace constants (D41, plugin ID `com.clearpeak.rebody`), `docs/dev/01_TABLE_EMISSION.md`.
- DSP skeleton (73 parameters, 10 outputs, three `Line` structs), manifest, `tools/build_dsp.py`, helper tests; U0 functional UI (all 73 controls, tabs, readouts, zoom chassis), `tools/build_ui.py`; host-spike protocol.

## Before 0.1.0 (2026-10-15 .. 16): research and concept
Baseline of the original BODY and its provenance (Artists in DSP), research index, physical-modelling and UI/UX research, DSP / UI / bodies concepts, adversarial review and triage (D26 - D34), owner answers Q1 - Q5 (D35 - D39), decision log D1 - D44.
