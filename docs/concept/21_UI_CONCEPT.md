# 21 — RE·BODY UI concept: the original panel with a layered, parallax instrument field

Status: concept, no code yet. Sources: `reference/body_original/index.js` (cited as UI:line), `docs/research/11_UI_UX_RESEARCH.md` (R11 §x),
LALAFY prototype v0.71 (`styles.css:55-137`, `js/08-main.js:95-99`), platform rules `docs/index/03_AMORPH_PLATFORM.md` (P03 §2d/2e/5).

## 0. Decisions in force (owner, 2026-10-16)
- The original GUI stays: header, instrument field, morph row, dial deck, monochrome, system font stack.
- Depth and parallax come from LALAFY's technique: a perspective frame, layers with `translateZ(z) scale(s)`, the scene tilted a few degrees by the pointer, atmospheric perspective per layer.
- Focus is the graphic in the middle: many layers, real depth; the rest of the panel gains the new functions and a quality pass, not a redesign.
- Resizable window via the DEV-Kit scaling recipe (`docs/07_SCALING.md`, kit rule 8); the deviation from the upstream fluid-layout rule is documented (R11 §2, P03 §6).
- Telemetry from the DSP is available: `bodyViz`, `bodyBands`, `bodyOnset`, `analysisViz`, `lineStateA/B/C`, `lineModesA/B/C` (see `20_DSP_CONCEPT.md` §8, `plugin/spec.json` outputs).

## 1. Chassis and layout
Design chassis 720 × 460 (original 620 × 340 proportions, field enlarged to ≥50 % height, R11 §3 W2; +40 px for the line tabs and the physics dials), scaled with CSS `zoom` per 07_SCALING; manifest `view.resizable: true`, `// WINDOW SIZE: 720x460` on line 2.
Rows: header 36 px (title `RE·BODY` with the brand `CLΞΛRPΞΛK` small, left-aligned directly beneath it per kit `docs/15_BRANDING.md`; **line tabs A · B · C** with activity lamps; state caption; Bypass; Motion switch) · field (flex) · morph row 44 px (slider + anchors merged, Hold button at its end, R11 R4/R11) · deck 110 px (4 main dials + Level/Follow/Blend small) · strip 1 34 px (Listen and Excite segmented buttons, Sensitivity) · strip 2 34 px (advanced + physics dials, collapsible).
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
| L15 | caption | +60 | instrument name (13-14 px, R11 R1), note name and decay seconds computed from the line's Tune/Decay/Morph as the original does (index.js:21-36), tracked pitch from `lineState*.followHz` while Follow > 0 | 0.2 |

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
- `lineModesA/B/C` (16 loudest modes of the active line) draw faint standing-wave markers along contour 0, fading with mode energy.
- `lineState*.engine0..engine10` feed the morph slider's weight bars (§5).

## 5. Controls: the original, extended
- **Morph row as hero** (R11 R4): 3 px engraved groove, detents that grow when the thumb approaches, 14 px lit thumb, ≥28 px hit height, hairline weight bars from `lineState*.engine0..engine10`, anchors ≥10 px with abbreviations where the name is wider than its cell; anchor list and order come from the shared anchors table (11 anchors, `22_BODIES.md` §0), generated into `plugin/bodies.json`.
- **Deck**: four main dials Tune, Decay, Material, Mix as dial v2 (R11 R3: 64-72 px, 3 px arc, static specular crescent, pressed/hover states, default tick, typed entry as in UI:360-426).
- **Advanced strip**: Size, Position, Bright, Body, Touch, Stretch and the four physics dials as 40 px dials (Width sits in the deck as a small dial), collapsible via a "MORE" button; collapsed state stored UI-only.
- Bypass switch and state lamp (R11 R7): `--lamp` 1 active, 0.7 no input, 0.25 bypass, text state in the caption, never colour alone.
- Keyboard, wheel, dblclick reset, Shift fine, ARIA slider semantics as in the original `BodyDial` (UI:103-248); Delete resets the focused control (R11 R8).
- Typography pass (R11 R1): all text ≥4.5:1, tracks ≥3:1; the HONE-dim greys are lifted only where readability needs it.
- Grain and vignette baked once as an inline data URI (R11 R9).

## 6. Sandbox compliance
Single ES module, default export `createPatchView`, light DOM with `classList.add("patch-root")` on the host, one HTMLElement subclass with `customElements.get` guard, mount once in `connectedCallback` (idempotent), set both `view.pc` and `view.patchConnection`, no imports/remote assets/web fonts, no `backdrop-filter`, no `vw/vh`, `touch-action: none` on every drag control, pointer events on the element with `setPointerCapture` for drags only, value labels painted `--` until the first host value arrives, `.control[data-param]` once per parameter with `data-min/max/init`, `addAllParameterListener` → `requestParameterValue` order, full teardown in `disconnectedCallback` (listeners, rAF, capture), no ResizeObserver (host sizing per 07_SCALING instead), only declared output endpoints subscribed (P03 §2d, §7).

## 7. Verification
- `run_ui_probe` on the real Amorph build: `data-param` audit, custom endpoint delivery, pointermove delivery inside a DAW.
- Frame time with up to 19 compositing layers at 720×460 and at zoom 2.0 in WebKit and WebView2; target ≤4 ms per frame while moving, 0 when idle.
- Reduced-motion and Motion-switch states reviewed visually; contrast checked numerically.

## 8. Steps
U0 tokens, typography, lamp, grain · U1 field: layer stack, z-table, scale compensation, fog, light · U2 motion sources, smoothing, reduced motion, Motion switch · U3 telemetry binding (bodyBands, bodyOnset, analysisViz, lineState*, lineModes*) · U4 morph hero and anchors table · U5 dial v2, main deck, advanced strip · U6 07_SCALING chassis, manifest, probes.

## 9. Fine questions (later)
Whether strip 2 starts collapsed; exact grey levels; tab placement left or right of the title.

## 10. Lines in the UI (20 §12)
- **Tabs A · B · C** in the header select the *active line*. Each tab has a small lamp driven by `lineState*.listenEnergy` and a dot for Enable. Keyboard: 1/2/3.
- **One control per parameter, always in the DOM.** The morph row, deck and strips exist three times (one set per line) and only the active set is visible (`hidden` on the others). Every `paramN` keeps exactly one `.control[data-param]`, so the host's `run_ui_probe` audit and preset recall work regardless of the selected tab (P03 §2d).
- **Field = lines at depth.** The active line owns the full 16-layer stack in the light. The two other lines appear as one flat silhouette each (their own morph shape, no inner layers) at z −600 and −750, dimmer and foggier, breathing with their own `lineState*.wet`; clicking a silhouette activates that line (then the stacks swap with a 250 ms cross-fade of fog and light, geometry stays). A line with Enable Off is drawn as a thin ghost.
- **Chain** is drawn as a faint curved thread from the source silhouette to the chained body; **Follow** shows the tracked note under the caption; **Hold** lights the morph-row button, freezes the energy breathing of that line's silhouette and dims its listen lamp (injection muted).
- **Listen feedback**: the segmented Listen buttons carry hairline meters from `analysisViz` (transient, sustain, low, mid, high), so the user sees what each choice would hear before choosing.
- Layer count stays 16 + 2 (inactive silhouettes) + 1 (chain thread) ≤ 19 compositing layers.

## 11. Preservation contract: the original GUI stays, RE·BODY only extends it
1. **Stylesheet base = the original.** The CSS block of `index.js:266-310` is carried over verbatim as the base stylesheet (same class names, same values). RE·BODY adds tokens and new selectors; existing rules are changed only in the five documented places below, each with before/after and the research reason: track/arc contrast to ≥3:1 (`:296`, `:286`), caption 9 → 13 px (`:282`), dial arc 5 → 3 px with 64-72 px dials (`:294-297`), anchor font 9 → ≥10 px (`:290`), light-style focus ring (`:308`).
2. **Geometry base = the original's own large layout.** The `min-height: 440px` media query (`:310`: padding 21/30/20, rows 30 / 1fr / 63 / 92 px, 70 px dials, 11 px anchors, 10 px caption) is the base layout at 720 × 460; the four original rows keep their sizes, the field takes the surplus; new rows (tabs in the header, strips under the deck) are inserted, nothing is moved.
3. **Behaviour reused, not re-implemented.** `BodyDial` (`:103-248`), the typed value editor with note names (`:360-426`), morph slider pointer/keyboard/wheel logic (`:320-325`, `:341-345`), anchors, bypass, `refreshProcessing`, the reduced-motion query and the `bodyViz` listener are taken over as code; extensions wrap or subclass them.
4. **Silhouettes reused.** `instrumentPaths` and `hybridPaths` (`:47-97`) stay the geometry of the eight original templates; the three new bodies follow the same ten-path convention and the same resampling (`:78-82`); the morph/scale/flex maths (`:349-359`) stays, depth is added around the paths.
5. **Classic view.** With strips collapsed and only Line A enabled, the panel is the original composition plus the brand line and the tabs. A UI-only **Classic** toggle (stored state) hides tabs, strips and the inactive-line silhouettes, so the original look is one click away.
6. **Wording.** The eight original anchor labels, `MORPH`, `TUNE`, `DECAY`, `MIX`, `Bypass` keep their text; new labels use the same typographic style.
7. Every deviation from 1-6 is logged in `docs/dev/02_UI_DEVIATIONS.md` with before/after.
