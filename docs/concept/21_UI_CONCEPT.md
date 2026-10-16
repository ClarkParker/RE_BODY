# 21 — RE·BODY UI concept: the original panel with a layered, parallax instrument field

Status: concept, no code yet. Sources: `reference/body_original/index.js` (cited as UI:line), `docs/research/11_UI_UX_RESEARCH.md` (R11 §x),
LALAFY prototype v0.71 (`styles.css:55-137`, `js/08-main.js:95-99`), platform rules `docs/index/03_AMORPH_PLATFORM.md` (P03 §2d/2e/5).

## 0. Decisions in force (owner, 2026-10-16)
- The original GUI stays: header, instrument field, morph row, dial deck, monochrome, system font stack.
- Depth and parallax come from LALAFY's technique: a perspective frame, layers with `translateZ(z) scale(s)`, the scene tilted a few degrees by the pointer, atmospheric perspective per layer.
- Focus is the graphic in the middle: many layers, real depth; the rest of the panel gains the new functions and a quality pass, not a redesign.
- Resizable window via the DEV-Kit scaling recipe (`docs/07_SCALING.md`, kit rule 8); the deviation from the upstream fluid-layout rule is documented (R11 §2, P03 §6).
- Telemetry from the DSP is available: `bodyViz`, `bodyBands`, `bodyOnset`, `bodyEngines`, `bodyModes`, `bodyRegister` (see `20_DSP_CONCEPT.md` §8).

## 1. Chassis and layout
Design chassis 720 × 420 (original 620 × 340 proportions, field enlarged to ≥55 % height, R11 §3 W2), scaled with CSS `zoom` per 07_SCALING; manifest `view.resizable: true`, `// WINDOW SIZE: 720x420` on line 2.
Rows: header 28 px (title `RE·BODY`, state caption, Bypass, Motion switch) · field (flex) · morph row 44 px (slider + anchors merged, R11 R4/R11) · deck 110 px (4 main dials) · advanced strip 34 px (7 small dials, collapsible).
Everything is SVG or DOM; no canvas, so zoom stays crisp (R11 §6 Q1).

## 2. The field: depth model
```
.field        perspective: 1600px; perspective-origin: 50% 45%; overflow: hidden   ← clipping only here
  .scene      transform-style: preserve-3d; transform: rotateY(yaw) rotateX(pitch)  ← no overflow/opacity/filter here
    <svg class="layer" style="--z:-900px">…</svg>   one SVG per layer, position:absolute; inset:0
    …
```
`preserve-3d` is flattened by overflow, opacity, filter, mask or `contain:paint` on the scene (R11 B2), so transparency and fog live on the leaf SVGs only. 3D transforms are not available on SVG groups, hence one stacked `<svg>` per layer (R11 B2). Scale compensation keeps everything the same size at rest: `scale = (P − z) / P` for perspective P (LALAFY `styles.css:118-137` uses the same pairing).

Layers, back to front (z in px at P = 1600):
| # | layer | z | content | motion share |
|---|---|---|---|---|
| L0 | vignette / floor glow | −900 | radial gradient, horizon line | 1.0 |
| L1 | floor shadow | −700 | soft ellipse under the body, size follows Tune | 0.9 |
| L2 | cavity | −420 | dark interior behind sound hole, drum head, bell: becomes visible when tilted | 0.6 |
| L3…L12 | contour paths 0…9 | per instrument, −300…+220 | the ten morphing paths of the original, one per layer | from z |
| L13 | specular | +260 | one soft highlight that follows the light position | from z |
| L14 | air | +320 | ≤40 faint particles (SVG circles) on a slow flow field, brightness from wet energy | from z |
| L15 | caption | +60 | instrument name (13-14 px, R11 R1), note / seconds from `bodyRegister` | 0.2 |

**Depth table.** `zTable[template][path]` (8 original templates + new bodies × 10 paths). Examples: bass drum rear shell (path 2) −300, front hoop (path 0) 0, tension rods (6-9) +120; piano rim (0) 0, lid inner rim (1) −200, keyboard (2-5) +160; sax rear tube (2) −260, bell rim (1) +220, keys (6-9) +180. During a morph the z of each path is interpolated with the same `t` as its geometry (UI:353-357), so depth morphs with the instrument.
**Atmospheric perspective.** Stroke colour and opacity per layer are baked from z (far = darker, lower contrast; near = full white), applied once per morph step, never via animated filters (R11 B2).
**Light.** One light position `--lx/--ly` (default top-left). Rim-light gradient strokes on contour 0 (two wide low-alpha strokes + a lit edge, R11 R5), floor ellipse and the specular layer are repainted when the light moves; the pointer moves the light in the same gesture that tilts the scene.

## 3. Motion model (three sources, one smoothing)
```
yaw   = kPointer·px + idleX(t) + 0                    pitch = kPointer·py + idleY(t)
zPush = onsetPush(t)                                  breathe = 1 + 0.004·wet
tilt smoothing: v += (target − v)·(1 − exp(−dt/0.12))  (same form as UI:335)
```
- Pointer: ±5° at the frame edges (LALAFY uses 0.4 × head angle; the field here is smaller, so the cap is lower). `pointermove`/`pointerleave` on the host element only, no capture, no document listeners (P03 §2d). On leave the tilt eases back to idle.
- Idle: Lissajous drift ±1°, 0.05 / 0.07 Hz, so depth is visible even without a pointer (pointer delivery in DAW WebViews is unverified, R11 R10).
- Audio: `bodyOnset` pushes the scene back by up to 6 px (attack 60 ms, release 400 ms); `bodyViz` wet energy scales the scene by ≤0.4 %.
- rAF runs only while something still moves (energy, tilt delta, morph delta), as the original already gates its draw (UI:333-338).
- Paused during dial or slider drags; `prefers-reduced-motion` and the in-UI **Motion** switch (Off / Calm / Full, UI-only stored state, `localStorage` in try/catch) freeze tilt and push but keep static depth, light and fog.

## 4. Energy response of the silhouette
- Per-layer vibration amplitude table: membrane/head 1.0, strings 0.8, openings 0.5, body 0.4, fittings 0.15 (physically plausible: fittings do not flex).
- Deformation = superposition of three contour modes (1, 2, 3 half-waves, inharmonic phase ratios) driven by `bodyBands` low/mid/high groups; amplitude 1.5-3 px scaled by the field size (R11 R6), onset kick from `bodyOnset`, decay with the wet tail. Under reduced motion brightness carries the information instead of motion.
- `bodyModes` (16 loudest modes) draw faint standing-wave markers along contour 0, fading with mode energy.
- `bodyEngines` feeds the morph slider's weight bars (§5).

## 5. Controls: the original, extended
- **Morph row as hero** (R11 R4): 3 px engraved groove, detents that grow when the thumb approaches, 14 px lit thumb, ≥28 px hit height, hairline weight bars from `bodyEngines`, anchors ≥10 px with abbreviations where the name is wider than its cell; anchor list and order come from the shared anchors table (`20_DSP_CONCEPT.md` §6).
- **Deck**: four main dials Tune, Decay, Material, Mix as dial v2 (R11 R3: 64-72 px, 3 px arc, static specular crescent, pressed/hover states, default tick, typed entry as in UI:360-426).
- **Advanced strip**: Size, Position, Bright, Body, Width, Touch, Stretch as 40 px dials, collapsible via a "MORE" button; collapsed state stored UI-only.
- Bypass switch and state lamp (R11 R7): `--lamp` 1 active, 0.7 no input, 0.25 bypass, text state in the caption, never colour alone.
- Keyboard, wheel, dblclick reset, Shift fine, ARIA slider semantics as in the original `BodyDial` (UI:103-248); Delete resets the focused control (R11 R8).
- Typography pass (R11 R1): all text ≥4.5:1, tracks ≥3:1; the HONE-dim greys are lifted only where readability needs it.
- Grain and vignette baked once as an inline data URI (R11 R9).

## 6. Sandbox compliance
Single ES module, default export `createPatchView`, light DOM, one HTMLElement subclass with `customElements.get` guard, no imports/remote assets/web fonts, no `backdrop-filter`, no `vw/vh`, pointer events on the element with `setPointerCapture` for drags only, `.control[data-param]` once per parameter with `data-min/max/init`, `addAllParameterListener` → `requestParameterValue` order, full teardown in `disconnectedCallback` (listeners, rAF, capture), no ResizeObserver (host sizing per 07_SCALING instead), only declared output endpoints subscribed (P03 §2d, §7).

## 7. Verification
- `run_ui_probe` on the real Amorph build: `data-param` audit, custom endpoint delivery, pointermove delivery inside a DAW.
- Frame time with 16 compositing layers at 720×420 and at zoom 2.0 in WebKit and WebView2; target ≤4 ms per frame while moving, 0 when idle.
- Reduced-motion and Motion-switch states reviewed visually; contrast checked numerically.

## 8. Steps
U0 tokens, typography, lamp, grain · U1 field: layer stack, z-table, scale compensation, fog, light · U2 motion sources, smoothing, reduced motion, Motion switch · U3 telemetry binding (bands, onset, modes, engines, register) · U4 morph hero and anchors table · U5 dial v2, main deck, advanced strip · U6 07_SCALING chassis, manifest, probes.

## 9. Fine questions (later)
Final chassis size; Motion switch default (Calm?); abbreviations for anchor labels; whether the advanced strip starts collapsed; exact grey levels.
