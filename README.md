# RE·BODY

**RE·BODY** (technical identifier `RE_BODY`) is an audio effect for the Amorph plug-in host. Audio goes in, and instrument bodies that do not exist ring out: a bass drum shell that is also a clarinet, an oboe that turns into a ukulele and a sax. It is a new version of the Amorph plug-in *BODY*, rebuilt on physically modelled bodies and dressed in a layered depth UI.

- Version: **0.9.0** (all offline gates green, host test pending; see [`docs/dev/08_STATUS.md`](docs/dev/08_STATUS.md))
- Manufacturer: `CLΞΛRPΞΛK` (manifest `manufacturer`, brand line under the plug-in name)
- Plug-in ID `com.clearpeak.rebody`, Cmajor patch format, Amorph FX, window 960 x 600 (resizable, zoom 0.5 - 2.0)
- Naming rule: `RE·BODY` (U+00B7 middle dot) for every user-facing string (GUI header, DAW metadata); `RE_BODY` (ASCII underscore) for code identifiers, targets, folders and binaries.

## Credit
RE·BODY is based on **BODY by [Artists in DSP](https://artistsindsp.com)**, an experiment the authors shared with the Amorph developer group ("curious what you do with it"). The original, unmodified, is kept as the baseline in `reference/body_original/` (see its `PROVENANCE.md`) and is rendered as the golden reference of the A/B gates. The authors' announcement credits the two Reddit ideas behind BODY and HONE: nizzernammer and Electus93. Host rules and recipes come from the Amorph DEV-Kit and the upstream `amorph-for-agents` documents.

## What RE·BODY adds to BODY
- **Recipes instead of constants.** Every body is one JSON recipe in `bodies/` (generator formulas, measured mode tables, one damping rule, calibration, depth for the UI); `tools/bodytab.py` turns them into the Cmajor tables and the UI data.
- **11 bodies on one Morph row:** Bass Drum, Snare, Timpani, Piano, Guitar, Ukulele, Fiddle, Clarinet, Oboe, Sax and the Obosaxolele hybrid. Fixed-Hz bodies share a 96-pole modal grid (gain-vector morph, tails keep ringing), the exact modes sit in per-body slots; strings, bores and the piano pair keep BODY's loops.
- **Three independent lines (A, B, C).** Each line has its own body (Morph), Tune, Decay, Material, Level and Pan; **Listen** picks All / Transient / Sustain / Low / Mid / High or **Chain** (the previous line's body output); **Excite** is Through or a striker (Hammer, Pluck, Breath) with a **Blend** dial; **Follow** retunes a line to the played pitch; **Hold** freezes the body resonance while strings and bores ring out. Line A alone behaves like BODY.
- **Physics knobs per line:** Touch, Position, Bright, Size, Body, Stretch, Stiffness, Coupling, Air, Reed (plus global Mix, Width, Low Cut, Bypass); 73 parameters in total (`plugin/spec.json`).
- **Depth UI.** BODY's panel, extended: an 11-layer perspective instrument field (the sounding body and the other lines as ghosts at depth, chain thread, light and fog), dial v2, morph hero with weight bars, live telemetry from 10 output endpoints, Motion Off / Calm / Full, reduced-motion path, 07_SCALING zoom chassis.

## Repository layout
```
plugin/         RE_BODY.cmajorpatch (manifest) · dsp.cmajor and index.js (generated, what Amorph loads)
                bodies.json (generated, for the UI) · spec.json (single source of truth: 73 parameters, 10 outputs, anchors)
src/dsp/        DSP parts, concatenated in filename order into plugin/dsp.cmajor:
                00_header · 10_tables (generated) · 20_analysis · 30_strikers · 40_modal · 50_line · 90_main
src/ui/         UI parts, concatenated into plugin/index.js:
                00_header · 10_control · 15_silhouettes · 20_field · 30_panel · 40_telemetry · 50_scaling · 60_motion · 90_export
bodies/         one recipe per anchor, 00_bass_drum.json .. 10_obosaxolele.json
tools/          bodytab.py · build_dsp.py · build_ui.py · render_ci.py · golden/ (reference metrics of BODY and the latest runs, no audio)
tests/          *.cmajtest (analysis, helpers, lines, modal, strikers, tables), helpers.cmajor, tables_data.cmajor (generated), ui/ (headless smoke test)
reference/      body_original/ (unmodified BODY and its provenance)
docs/concept/   00_DECISIONS (D1 .. D45), 20_DSP_CONCEPT, 21_UI_CONCEPT, 22_BODIES
docs/plan/      30_DEV_PLAN (phases, gates, status)
docs/dev/       phase logs and measurements: 00_HOST_SPIKE (owner's host test), 00_P1_CONTRACTS, 01 .. 07 phase logs, 08_STATUS, 09_CPU, screens/
docs/index/     research index of the source material (original BODY, LALAFY, Amorph platform, PHYSIFY)
docs/research/  physical-modelling bodies and UI/UX research
docs/review/    concept review, consistency checks, triage
```
The generated files (`plugin/dsp.cmajor`, `plugin/index.js`, `plugin/bodies.json`, `src/dsp/10_tables.cmajor`, `tests/tables_data.cmajor`) are committed; edit the sources, never the products.

## Build
Python 3, standard library only, run from the repository root, in this order:
```sh
python3 tools/bodytab.py       # bodies/*.json -> src/dsp/10_tables.cmajor, plugin/bodies.json, tests/tables_data.cmajor
python3 tools/build_dsp.py     # spec.json regions + src/dsp/*.cmajor -> plugin/dsp.cmajor      (--check: verify only)
python3 tools/build_ui.py      # generated header block + src/ui/*.js -> plugin/index.js        (--check: verify only)
```
Load `plugin/RE_BODY.cmajorpatch` with `cmaj generate --target=cpp --output=/dev/null plugin/RE_BODY.cmajorpatch` for a compile check (cmaj 1.0.3175, installed with the DEV-Kit's `tools/get_cmaj.sh`).

## Test
```sh
cmaj test tests/*.cmajtest                          # unit tests of tables, modal engine, analysis, strikers, lines
python3 tools/render_ci.py selftest                 # the measuring code itself (no cmaj needed)
python3 tools/render_ci.py run                      # 165 renders: 11 anchors x 5 stimuli x 44.1 / 48 / 96 kHz
python3 tools/render_ci.py compare --gate           # A/B against the original BODY (D44)
python3 tools/render_ci.py check hold-stability --gate        # also: three-line-protector, split-complementary
node tests/ui/smoke.mjs                             # 194 UI checks in headless Chromium (see tests/ui/README.md)
```
Kit lints (`preflight.py plugin --strict`, `manifest_check.py`, `check_sync.py`, `ui_lint.py`) come from the Amorph DEV-Kit. `render_ci.py` is documented in `docs/dev/04_RENDER_CI.md`. The live Amorph checks (`run_qa_probe`, `run_ui_probe`, listening, CPU in a DAW) only run on a machine with Amorph: `docs/dev/00_HOST_SPIKE.md`.

## Status
Version 0.9.0: the DSP (11 bodies, three lines, physics knobs, strikers, Hold, Follow, telemetry) and the UI are complete and pass every offline gate; the host spike, the two probes, the listening pass and the DAW CPU figure are pending on the owner's Amorph. Checklist, gate numbers, CPU table and known deviations: [`docs/dev/08_STATUS.md`](docs/dev/08_STATUS.md). Phase table: [`docs/plan/30_DEV_PLAN.md`](docs/plan/30_DEV_PLAN.md) section 5. History: [`CHANGELOG.md`](CHANGELOG.md).

## Licence
To be decided by the owner. Before the plug-in is shared through Amorph's "Share..." dialog (License and Tags fields) the licence has to be chosen and the attribution to Artists in DSP, the author of BODY, cleared with them.

Related repositories (same owner, branch `claude/gallant-mendel-xg901g`): `Amorph_DEV_KIt` (rules and recipes), `amorph-for-agents` (upstream host docs), `lalafy-cmajor`, `PHYSIFY`.
