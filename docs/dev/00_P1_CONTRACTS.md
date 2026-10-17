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

## P2 additions (2026-10-17)
File ownership P2: modal worker (Opus) owns `src/dsp/40_modal.cmajor` and `tests/modal.cmajtest`; integration worker (Sonnet) owns `src/dsp/20_analysis.cmajor`, `50_line.cmajor`, `90_main.cmajor` and `docs/dev/05_LINE_A.md`; CI worker (Sonnet) owns `tools/render_ci.py`, `tools/golden/` (reference metrics JSON, no audio in git) and `docs/dev/04_RENDER_CI.md`. The original BODY can be rendered as the golden reference via `reference/body_original/BODY.cmajorpatch` (added by the lead; compiles with cmaj 1.0.3175).

Modal API (behavioural contract; the modal worker fixes the exact signatures and documents them in the header comment of 40_modal.cmajor):
- Grid bank per line: 96 shared poles (`tables::gridHz`), stereo, phasor/coupled form in `float<8>` lanes; control-rate `setLaw(sr, alphaG, alphaR, decayScale, sizeShiftOct, holdFlag)` computes radius/angle targets; per-sample `step(excitation float<2>, gainL[96], gainR[96]) -> float<2>` with BODY's 32-sample linear stepping and snap; gains are the morph-interpolated per-body vectors supplied by the caller; Nyquist culling above 0.45·sr; flush at control rate; Hold = radii for T60 45 s with float64 coefficients.
- Slot bank per line: 11 bodies × (8 feature + 10 following) stereo modes; control-rate `setBody(body, rootHz, decaySeconds, material, sizeShiftOct, positionGain[], holdFlag)`; per-sample `step(body, excitation) -> float<2>`; tail holding (a body with weight 0 keeps its last coefficients and keeps ringing); energy normalisation per body with cross terms (BODY:282-301 generalised to ≤ 18 modes), cached per (root, decay, material, size).
- Damping rule exactly as 20 §4 (one formula, ρ bound 0.1); T60 → radius `exp(-6.907755/(sr·T60))`; per-mode drive `norm·gain·sqrt(2(1-r²))` as BODY:320.

## P6 additions (2026-10-17) — UI runs in parallel with the DSP phases
File ownership P6: silhouette worker owns `src/ui/15_silhouettes.js` (new); field worker owns `src/ui/20_field.js` and `src/ui/60_motion.js` (new); panel worker owns `src/ui/10_control.js`, `src/ui/30_panel.js`, `src/ui/40_telemetry.js`; later a tabs/scaling worker owns `src/ui/50_scaling.js`, `src/ui/90_export.js` and the inactive-line silhouettes. `src/ui/00_header.js` is lead-owned (the PARAMS block is generated by `tools/build_ui.py`). `plugin/index.js` is a build product: every worker rebuilds it for its own checks, conflicts there are irrelevant, the lead rebuilds at the end. For smoke tests while other workers are mid-edit, copy `src/ui/` to a scratch folder, replace your own files there and build from the copy.

Silhouette contract: `15_silhouettes.js` defines `const REBODY_TEMPLATES = [ /* 11 entries, anchor order from spec.json */ ];` where each entry is `{ name, paths: [10 SVG path strings], closed: [10 booleans], depth: [10 z values in px] }` following the original's convention (index.js:42-97: path 0 outer contour closed, path 1 opening/membrane closed, paths 2-5 strings/seams, 6-9 fittings; same coordinate space, instrument centred at 0,0, roughly 280 wide × 150 high; missing details collapse to a point, never fade). The eight original templates are copied verbatim from the original (`instrumentPaths` + `hybridPaths`), the three new ones (Timpani, Guitar, Fiddle) are drawn in the same style. Depth per path comes from `plugin/bodies.json` (`ui.depth`) where present; otherwise the worker sets values per 21 §2. Both the P1 field (nearest-template fallback) and the P6 depth field read this array; the field worker must not duplicate path data.

## P4b additions (2026-10-17)
File ownership P4b: striker/tracker worker (Opus) owns `src/dsp/30_strikers.cmajor`, `src/dsp/20_analysis.cmajor` (extend; keep existing helpers used by 50_line), `tests/strikers.cmajtest`, `tests/analysis.cmajtest`; wiring worker (Sonnet) owns `src/dsp/50_line.cmajor`, `src/dsp/90_main.cmajor`, `docs/dev/07_P4B_LINES.md`, recipe fields it needs (`bodies/*.json` + `tools/bodytab.py` regeneration). Nobody touches `src/ui/`.
API contract (the striker worker fixes signatures and documents them in the file headers; the wiring worker codes against the headers):
- `namespace rebody::strikers`: `struct StrikerState` (small, per line); `void trigger (StrikerState& s, int kind, float velocity01, float position01, float sr)` for kind 1 Hammer (Hertz-contact force pulse 1-4 ms, velocity log-mapped), 2 Pluck (one-period displacement burst at `hz` with the position comb; a position-filtered impulse for non-string bodies), 3 Breath (noise burst 20-80 ms through a reed-style shaping; sustains while `hold01 > 0`); `float step (StrikerState& s, int kind, float hz, float hold01, float sr)` per sample returning a mono excitation that is DC-blocked and energy-normalised to unit velocity (so Blend 50 is a real half/half against a unit-RMS Through signal); `bool active (StrikerState&)`.
- `namespace rebody::analysis`: `struct Splitter` with `void prepare (Splitter&, float sr)` and `void step (Splitter&, float<2> x)` producing fields `transient`, `sustain` (complementary: transient + sustain == x), `low`, `mid`, `high` (LR4 at 200 Hz / 2 kHz, allpass-complementary sum), all `float<2>`; `struct PitchTracker` with `prepare (sr)`, `push (float mono)` (decimate ×4 inside), `void work (PitchTracker&)` called every 32 samples spreading the YIN difference over the hop (window 512, lags for 40 Hz-1.2 kHz at 12 kHz, parabolic interpolation, confidence gate, median of 3), `float hz (PitchTracker&)`, `float confidence (PitchTracker&)`, `bool enabled` flag (no work while false).
Semantics for the wiring worker (20 §5, §12-§14): Listen selects the Splitter field (All = x; Chain = previous line's body output pre-Level × Sensitivity); Sensitivity 50 = 0 dB, ±24 dB; per-line novelty on the listened signal; Excite Through = BODY contact; strikers triggered by the line's novelty (hysteresis 0.15, refractory 30 ms, velocity from onset peak log-mapped, Touch shapes the curve); Blend equal-power between striker and Through; Hold v2 per 20 §14 (modal freeze via the modal API hold flag, loops ring out, injection muted while held energy > −60 dB, armed capture 200 ms otherwise); Follow: Tune target = tracked note × Follow amount with 40 ms glide, tracker enabled only while any line has Follow > 0; Pan = balance with unity at 0; Enable = summed and computed (chained-from lines computed even when disabled, gate after tails drain); telemetry fields followHz, hold, listenEnergy, analysisViz real.
