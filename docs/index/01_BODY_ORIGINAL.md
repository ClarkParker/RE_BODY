# 01 — BODY (original plugin) — baseline analysis

Source files (as uploaded by the owner, copied to `reference/body_original/`):
- `dsp.cmajor` — 896 lines, single `processor BODYFree`, no graph, no namespaces, no imports.
- `index.js` — 433 lines, web component `body-instrument-view`, `export default function createPatchView(patchConnection)`.
- Manifest (`.cmajorpatch`) was NOT supplied.

## 1. Identity
"BODY: instrument-inspired stereo bodies excited by incoming audio." (dsp.cmajor:1-4)
Stereo audio FX. Input audio excites seven exploratory instrument bodies. One continuous Morph (0..7)
travels Bass Drum → Snare → Piano → Ukulele → Clarinet → Oboe → Sax → "Obosaxolele" (coupled Oboe+Sax+Uke hybrid).
Explicitly "exploratory models, not acoustic instrument emulations".

## 2. Endpoints / parameters (dsp.cmajor:7-14)
| id | name | range | init | unit | notes |
|---|---|---|---|---|---|
| in | stream float<2> | | | | stereo input |
| out | stream float<2> | | | | stereo output |
| param1 | Tune | 0..100 step 0.1 | 58 | % | drums: continuous size; pitched bodies: quantised to MIDI note 36..72 (C2..C5) via `anchorRoot` (:174-181) |
| param2 | Decay | 0..100 step 0.1 | 50 | % | per-body log-mapped seconds via `anchorSeconds` (:183-192) |
| param3 | Mix | 0..100 step 0.1 | 45 | % | dry/wet (:890) |
| param4 | Morph | 0..7 step 0.001 | 4 | | continuous instrument position |
| param5 | Bypass | 0/1 | 0 | text Off|On | smoothed, audio-rate crossfade (:581-590) |
| bodyViz | output event float<4> | | | | (inputMeter, wetMeter, leftMeter, rightMeter) at ~30 Hz (:559, :893) |

Param events are NaN/Inf-guarded and clamped (:120-124).

## 3. Internal engine indices vs. morph order
Engine index (arrays of 7): 0 BassDrum, 1 Snare, 2 Clarinet(bore), 3 Piano(strings), 4 Oboe(modal), 5 Sax(bore), 6 Ukulele.
Morph series `(0,1,3,6,2,4,5)` (:19) → UI anchors 0..6. Segment 6→7: Sax eases into equal thirds Oboe/Sax/Uke (:136-144); no 8th engine exists — the hybrid is a *coupling* of existing engines.

## 4. Signal architecture (per sample, `main()` :506-896)
1. Input conditioning: NaN guard, DC blocker (20 Hz), hard clamp ±4, bypass fade (:587-590).
2. Onset/"novelty" detector: fast peak vs slow peak → `onset` 0..1 (:591-594). Each body has a `sustain` (contact sensitivity, :23/:194-201): excitation = x·feed·(sustain + (1−sustain)·novelty).
3. Per-body feed = sqrt(weight), normalised ≥ morph 5, calibrated in hybrid (:147-172).
4. Engines:
   - **Bass drum + snare shell + piano soundboard**: 10 complex one-pole modal resonators (ratios/weights/times :41-43, update :313-325, run :604-613). Bass has onset-driven pitch tightening (:308) and a contact lowpass.
   - **Snare rattle**: xorshift noise × edge envelope, band-limited (low−high), only when excited (:615-634).
   - **Clarinet**: closed-bore waveguide, 4096 buffer, negative half-period reflection (odd harmonics), reed lowpass + envelope-normalised soft clip, radiation tap half period apart (:444-455, :636-656).
   - **Piano**: two detuned (±0.09 ct) dispersive strings (8192 buffers, 1st-order allpass dispersion −0.86/−0.78), hammer lowpass excitation, bridge pickup comb (:457-490, :658-677).
   - **Ukulele**: single string (8192), transient-sensitive pluck contact, pick-position comb (0.32 period), 2 wood body modes 310/690 Hz (:470-497, :680-710).
   - **Oboe**: 8 fixed-ratio modal resonators (nasal cluster, :114-118), energy-normalised in float64 with cross terms (:282-301), hybrid reshapes modes into beating pairs (:399-420).
   - **Sax**: positive full-period bore (8192), asymmetric reed shaping, breath noise, formant emphasis, 2 brass body modes 780/1750 Hz (:477-504, :768-826).
   - **Hybrid (6→7)**: acyclic coupling uke bridge → oboe reed → sax bell (:712-727, :733-734, :798-800), gesture envelope from pluck detector.
5. Shared register/decay: active bodies slew to a weight-blended log root / log seconds / sustain; withdrawn bodies keep their last voicing while tails drain (:203-272).
6. Control rate: coefficient targets recomputed every 32 samples, linearly stepped per sample, snapped at block end (:573-579, pattern `x+=step; if(counter==0) x=target`).
7. Output stage: fixed per-engine calibration constants (:831-843), slow auto stereo balance from input/output power ratio (:844-855), peak protector relative to the input peak reference with hold/release (:856-877), C1 emergency knee (:880-889), dry/wet mix (:890), meters + bodyViz (:892-893).
8. Denormals: manual flush-to-zero on every state (`<1e-12`), no `processor.frequency`-dependent allocations; all buffers static.

## 5. Techniques worth keeping (style contract of the original)
- One flat processor, all state as members, `loop { … advance(); }`.
- Smoothing idiom: `v += slew*(target−v); if (v==prev || abs(v−target)<1e-6) v=target;` (converges exactly, no denormal drift).
- `float(exp(-6.907755f/(sr*seconds)))` = T60-style radius from seconds (−60 dB).
- Sample-rate normalisation `norm=sqrt(48000/sr)` on modal drives (:312).
- Comments explain acoustic intent in one or two lines; no magic without a sentence.

## 6. UI (index.js)
- Web component, light DOM, all CSS inline in a `<style>` inside the element (:266-310). Window hint `// WINDOW SIZE: 620x340` (:2). Monochrome "HONE-inspired" panel.
- Layout: header (title BODY + Bypass switch) / SVG instrument field / Morph slider with 8 anchor buttons / deck of 3 dials (Tune, Decay, Mix).
- Instrument illustration: 8 templates (7 instruments + designed hybrid) of 10 SVG paths with identical point counts, resampled via `getPointAtLength` (:47-102), linearly morphed and scaled by Tune, flexed by `bodyViz` energy (:349-359). Reduced-motion respected.
- Dial class `BodyDial` (:103-248): pointer drag (shift = fine), dblclick reset, keyboard (arrows/page/home/end), wheel, typed value editor incl. note names for pitched bodies (:360-426). Decay dial displays seconds using the same mapping as the DSP (`decayMapping` :21-27 mirrors `anchorSeconds`).
- Host API used: `sendEventOrValue`, `sendParameterGestureStart/End`, `addAllParameterListener`, `removeAllParameterListener`, `addEndpointListener('bodyViz')`, `removeEndpointListener`, `requestParameterValue`.
- UI mirrors DSP maths (`morphWeights`, `decayMapping`, `midiNote`) — any DSP change to these must be ported to the UI.

## 7. Observations / hooks for RE·BODY
- The "8th stop" (hybrid) is a coupling, not a new engine; adding a true new body (e.g. a vocal tract) means extending `series`, weights arrays [7]→[8], `anchorRoot/Seconds/Sustain`, `updateFeeds`, output calibration, and the UI `modes`, `engineOrder`, `decayBases/Ratios`, `instrumentPaths`.
- Engines are not isolated functions; state and per-sample code are inlined in `main()`. A refactor into helper functions/structs is possible but changes the author's style.
- CPU: 4 waveguides (≤8192), 10+8+2+2 modal resonators, all stereo, per sample. Cheap.
- No oversampling; nonlinearities are mild soft-clips.
