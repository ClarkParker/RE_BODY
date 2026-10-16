# 00 — P1 contracts shared by the parallel workers

## File ownership (P1)
- DSP worker: `plugin/RE_BODY.cmajorpatch`, `src/dsp/00_header.cmajor`, `src/dsp/20_analysis.cmajor`, `src/dsp/30_strikers.cmajor`, `src/dsp/40_modal.cmajor`, `src/dsp/50_line.cmajor`, `src/dsp/90_main.cmajor`, `tools/build_dsp.py`, `docs/dev/01_TABLE_EMISSION.md`.
- Recipe worker: `bodies/*.json`, `tools/bodytab.py`, `src/dsp/10_tables.cmajor` (generated), `plugin/bodies.json` (generated), `tests/tables.cmajtest`, `docs/dev/03_RECIPES.md`.
- UI worker: `src/ui/*.js`, `tools/build_ui.py`, `plugin/index.js` (generated), `docs/dev/02_UI_DEVIATIONS.md`.
Nobody commits; the lead commits. Nobody edits another worker's files or the concept documents.

## Build
`python3 tools/build_dsp.py` concatenates `src/dsp/*.cmajor` in filename order into `plugin/dsp.cmajor` (Cmajor has no imports; namespaces may be split across files, the concatenation is the single compilation unit). `python3 tools/build_ui.py` concatenates `src/ui/*.js` in filename order into `plugin/index.js`, with `// WINDOW SIZE: 960x600` guaranteed on line 2 and a single `export default function createPatchView(patchConnection)` at the end. Both builders are stdlib-only Python, run from the repo root, and fail loudly on missing parts.

## Compiler
`cmaj` 1.0.3175 at `/root/.cache/cmaj/1.0.3175/cmaj-bin/linux/x64/cmaj` (installed via the kit's `tools/get_cmaj.sh`). Check a patch with `cmaj generate --target=cpp --output=/dev/null plugin/RE_BODY.cmajorpatch` and unit tests with `cmaj test tests/<file>.cmajtest`. Kit tools: newest kit worktree `/tmp/claude-0/-home-user/56398787-a593-57af-8ae9-3f0062939bf1/scratchpad/kit_new` (`tools/preflight.py`, `cmajor_lint.py`, `ui_lint.py`, `manifest_check.py`, `check_sync.py`, `docs/07_SCALING.md`, `ai/amorph_official/CORE_*.md`) and the branding worktree `.../scratchpad/kit_brand` (`docs/15_BRANDING.md`, `tools/ui_lint.py` with the BRAND check).

## Table API (namespace `rebody::tables`, consumed by `40_modal.cmajor` / `50_line.cmajor` from P2 on)
Flat arrays indexed `[body * stride + i]`, body 0..10 in anchor order (spec.json `anchors`). Strides: grid 96, feature 8, follow 10.
```
numBodies = 11, gridPoles = 96, featureStride = 8, followStride = 10
gridHz[96]                       // log-spaced 60 Hz .. 8 kHz, shared by all bodies
gridGainL[11*96], gridGainR[11*96]   // signed gains per body (0 = unused pole)
featureCount[11]; featureHz[11*8]; featureT60[11*8]; featureGainL[11*8]; featureGainR[11*8]
followCount[11]; followRatio[11*10]; followT60Mult[11*10]; followGainL[11*10]; followGainR[11*10]
alphaG[11]; alphaR[11]            // damping law at Material 50 (20 §4)
decayBase[11]; decayRatio[11]     // seconds = base * ratio^decay (22 §0)
sustain[11]; rootLaw[11]          // contact default; 0 = drum size law, 1 = note law
lineKind[11]                      // 0 none, 1 cylinder, 2 cone, 3 string, 4 string pair
loopLowpassHz[11]; radiationHz[11]; beta[11]; dispersion[11]
outGain[11]; energyTarget[11]
```
All floats are `float`, counts are `int`. The emission *form* (namespace constants vs processor members assigned in `main()` vs manifest externals) is decided by the DSP worker's experiment (`docs/dev/01_TABLE_EMISSION.md`); `bodytab.py --emit namespace|main|external` must produce all three so the chosen one is a flag, not a rewrite.

## Parameter and endpoint source of truth
`plugin/spec.json` (73 parameters, 10 outputs, anchors, labels, view 960×600). Annotations: `[[ name, min, max, init, step, unit? , text? ]]`, ids exactly `paramN`; enum params carry `text:` and step 1. Output events: `bodyViz float<4>`, `bodyBands float<8>`, `bodyOnset float`, `analysisViz float<6>`, `lineStateA/B/C float<24>`, `lineModesA/B/C float<16>`, all emitted every `max(1, int(sr/30))` samples.

## Cmajor rules that bite (P03 §2a)
No `let`, no `double` (use `float64`), wrap `sin/cos/tan/pow/exp/log/sqrt` results in `float(...)`, fixed-size arrays with `.at(i)`, no runtime sizing, one `advance()` per loop iteration, DSP only in `main()`, handlers only set targets, every divisor provably nonzero, `float(processor.frequency)`, nothing named `input`/`output`/`stream`, ASCII identifiers.
