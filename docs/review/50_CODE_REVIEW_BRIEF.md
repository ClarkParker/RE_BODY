# 50 — Code review brief (for an independent reviewer session)

Repository `ClarkParker/RE_BODY`, branch **`claude/gallant-mendel-xg901g`** (not `main`), state 0.9.0 (commit 68545ce or later). Rules for every session are in the DEV-Kit's `CLAUDE.md` (repo `ClarkParker/Amorph_DEV_KIt`, newest branch `claude/vibrant-faraday-cmymob`); work in English in the repo, German in chat. Nothing has run on the real Amorph host yet (decision D42); the review precedes that test.

## What to review (in this order)
1. **DSP** `src/dsp/*.cmajor` → built into `plugin/dsp.cmajor` by `tools/build_dsp.py` (never edit the built file). Files: `00_header` (constants, generated params tables), `10_tables` (generated from `bodies/*.json` by `tools/bodytab.py`), `20_analysis` (splitter, pitch tracker, helpers), `30_strikers`, `40_modal` (grid bank, slot banks, damping rule, normalisation, Hold), `50_line` (line engines, morph, register, loudness chain, wiring of all 73 parameters, telemetry; the largest file), `90_main` (processor, generated endpoint/handler blocks between markers).
2. **UI** `src/ui/*.js` → `plugin/index.js` by `tools/build_ui.py` (generated PARAMS/MODE_IDS/Z_TABLE blocks). Files: `00_header`, `10_control`, `15_silhouettes`, `20_field`, `30_panel`, `40_telemetry`, `50_scaling`, `60_motion`, `90_export`.
3. **Tools and tests**: `tools/bodytab.py`, `tools/render_ci.py`, `tests/*.cmajtest`, `tests/ui/smoke.mjs`.
4. **Recipes** `bodies/*.json` against `docs/concept/22_BODIES.md`.

## Contracts the code must satisfy
- Cmajor subset and Amorph FX rules: `docs/index/03_AMORPH_PLATFORM.md` §2a-2c and §7; upstream `amorph-for-agents/context-src/v1/dsp/fx.md`, `shared/core-dsp-foundations.md` (no `let`, no `double`, `float(...)` wraps, fixed arrays with `.at()`, one `advance()` per loop, handlers set targets only, divisors nonzero, modal rows passive, DC-blocked wet, no hardcoded sample rate).
- UI contract: `docs/index/03_AMORPH_PLATFORM.md` §2d-2e; upstream `shared/core-ui-contract.md`, `ui/fx.md`; kit `docs/07_SCALING.md`, `docs/15_BRANDING.md`; the logged deviations in `docs/dev/02_UI_DEVIATIONS.md` are deliberate, everything else is a finding.
- Design intent: `docs/concept/20_DSP_CONCEPT.md`, `21_UI_CONCEPT.md`, `22_BODIES.md`, decisions `00_DECISIONS.md` (D1-D45). Original baseline: `reference/body_original/dsp.cmajor` and `index.js` (BODY by Artists in DSP), golden metrics in `tools/golden/body_original.json`.
- Phase reports with known gaps: `docs/dev/05_LINE_A.md`, `06_P3_PHYSICS.md`, `07_P4B_LINES.md`, `08_STATUS.md` (§4 lists what is open), `09_CPU.md`.

## How to run the gates (compiler path in `docs/dev/00_P1_CONTRACTS.md`)
```
python3 tools/bodytab.py && python3 tools/build_dsp.py && python3 tools/build_ui.py
cmaj generate --target=cpp --output=/dev/null plugin/RE_BODY.cmajorpatch
for t in tests/*.cmajtest; do cmaj test $t; done
python3 tools/render_ci.py run --quick && python3 tools/render_ci.py compare --gate
python3 tools/render_ci.py check all
node tests/ui/smoke.mjs
<kit>/tools/preflight.py plugin --strict ; <kit>/tools/manifest_check.py plugin/RE_BODY.cmajorpatch --strict ; <kit>/tools/check_sync.py plugin/dsp.cmajor plugin/index.js ; <kit>/tools/ui_lint.py plugin/index.js --strict
```

## Review questions
A. Correctness: real bugs with a concrete failure path (sample-rate dependence, buffer bounds, denormals, NaN paths, parameter smoothing races, control-rate scheduling, stereo state separation, Hold/Enable/Chain state machines, telemetry rates). B. Contract violations (list above). C. Fidelity to the concept where it matters for sound (damping rule, normalisation, morph, loudness chain) and to the original where the concept says "as BODY". D. CPU: avoidable per-sample work, especially at 96 kHz with three lines (10.2 % of one core measured). E. UI: sandbox risks for the WebKit/WebView2 host, teardown, hidden-control audit, motion/reduced-motion, scaling. F. Tests and tooling: what the gates do not catch. G. Maintainability: generated blocks, duplication across lines, naming, comments that lie.

## Deliverable
Write findings to `docs/review/51_CODE_REVIEW_FINDINGS.md` on the same branch: table with severity (BLOCK / HIGH / MED / LOW), file:line, failure scenario, proposed fix; a verdict; do not modify source files. Cheap models are fine for mechanical passes (lint re-runs, cross-checks); use a strong model for the DSP logic. The lead session triages the findings afterwards exactly as in `docs/review/42_REVIEW_TRIAGE.md`.
