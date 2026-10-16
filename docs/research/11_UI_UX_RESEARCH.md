# 11 - RE·BODY UI/UX research: "wertiger" under Amorph's sandbox (2026-10-16)
Goal: make BODY's UI feel premium (parallax, depth, light, interaction) while staying minimalist, monochrome, sandbox-safe. Reader: the developer of the single-file ES-module view. Citations `[S#]` = URL in section 7; `[own]` = owner repo/doc path.

## 0. Method
- **Buckets** B1 premium plugin design language, B2 depth/parallax techniques, B3 control interaction, B4 resonance/energy visualisation, B5 guidelines/constraints. Rule applied: >=3 candidates per bucket from different source types (trade press, primary docs, GitHub code+licence, forums, owner docs), then compared in section 2. Nothing adopted on first hit.
- **Evidence tags**: `[V]` page text or file opened and read (curl via agent proxy; WebFetch summaries were often empty, key pages were re-fetched raw); `[S]` search snippet only, not opened; `(inf.)` my inference; `[own]` owner docs. Search mode "extended" was used for B1, B2 (SVG perf), B3 (knob research), B4 (Plasmonic), B5 (WebView CPU) where standard results were thin.
- **Constraints re-read** (03_AMORPH_PLATFORM 2d/2e/5 [own]): one ES module, light DOM, no imports/remote assets/web fonts/backdrop-filter/vw/vh, element-only pointer events with setPointerCapture, canvas sized once, no ResizeObserver (v1), reduced-motion, teardown, `data-param`, <=128 params.
- **Exclusions**: backdrop-filter / frosted glass (field-tested glitch in Amorph's WebView, kit docs/05 [own]) so Voger glassmorphism [S80, snippet only], LALAFY LIGHTING sec.3 and HUD_FILLER A.5 are not used; WebGL/three.js/Houdini/React/bundler libs (kit docs/08 marks them incompatible [own]); visionOS/Liquid Glass specifics (system blur); marketing blogs without design content (Voger UX post [V] only lists five generic principles).
- **Gaps (honest)**: no primary design write-up retrieved for u-he GUI, Soundtoys, NI; Arturia page text yielded no UI statement [V]; Plasmonic visuals unknown [S]; no WebKit-specific benchmark for SVG lighting filters (only anecdote [S19]); no numeric CPU budget for plugin WebViews exists in Amorph docs [own 03 2b]; which web engine Amorph embeds per OS is undocumented, so design for the weakest, WebKit (inf.).
- **Owner prior art reused, not repeated** ($SCRATCH/lalafy/LALAFY): LIGHTING_RESEARCH_v1 already gives one central light model (`keyLight/backLight/layerDepthIntensity`, Zusammenfassung), stacked-shadow edge light (sec.1), specular points (sec.5), per-layer falloff with "UI must stay readable" (sec.4). HUD_FILLER_v2 gives spotlight mask via `--mouse-x/--mouse-y` (B.2), 3 s breathing sine (A.7), "critical status must never be hover-only" (B.3). HUD_LAYER_v1 gives 3-7 layers typical and non-linear depth-to-speed (Observations 3-4). 02_LALAFY sec.5 gives perf budget (<=15 translateZ layers, 16 ms). **New here**: sandbox verdicts (those docs assume backdrop-filter, Three.js, GSAP), WebKit pitfalls, WCAG/HIG/Fluent evidence, control conventions, resonance visuals, and a measured critique of index.js.

## 1. Findings per bucket
### B1 Premium plugin design language
| Candidate | Source | Key idea | Fits sandbox? | Cost | Verdict |
|---|---|---|---|---|---|
| FabFilter | [S1][S2][S3] | "Traditionally plugin interfaces have been a recreation of analogue hardware... break out of that way of thinking" [V S2]; plugins "focus on the task you're performing... expose the features you need, when you need them" [V S1]; mouse-first, informative displays [V S3]; Pro-Q 4 adds Scaling that scales text and controls, plus a more "sombre" colour scheme [V S3] | principles yes | none | ADOPT: feedback displays, progressive disclosure |
| Baby Audio Crystalline | [S4] | "sparseness of its design... 12 square control blocks... each do something readily apparent"; "sleek" UI gets results quickly [V] | yes | none | ADOPT: sparse, grouped, no ornament |
| Minimal Audio Rift | [S5] | Two-tier Play/Advanced view; central scope shows engine shape plus live output waveform; a red line gives feedback for a knob [V] | yes | low | ADOPT: static shape plus live signal in one view (BODY outline already does this) |
| Kilohearts Phase Plant | [S6] | one space divided into generators/effects/modulators, praised for simplicity vs multi-page power synths; also "Complex patches get a little cluttered" [V] | n/a (BODY is small) | - | REFERENCE only |
| u-he | [S7] | Heckmann holds a degree in industrial design [V]; no GUI-principle statement found | - | - | NO VERDICT (gap) |
| Teenage Engineering | [S8][S9] | "minimalist industrial design with a quirky, almost childlike" UI; OP-1 cow visualises delay [V S8]; designers still use OP-1 photos as "modern" reference [V S13]; "constraint is the point" is the third-party author's reading [V S9] | spirit yes | none | ADOPT spirit: illustration as feedback (BODY silhouettes already are this, inf.) |
| Mutable Instruments | [S10][S11] | Rings: two buttons set everything, "no hidden mysteries" [V]; panel graphics done by others [V S11, text garbled] | n/a (hardware) | - | restraint reference |
| Ableton Live | [S12] | "flat" design principles and famously clean look [V] | yes | none | restraint + consistency; note: flat = no depth (see C1) |
| Industry trend | [S13] | "Everybody's eventually getting back to simplicity of aesthetics"; move away from skeuomorphism; "as few choices as possible but in a powerful way" [V] | yes | none | supports monochrome minimalism |
| Arturia / NI / Soundtoys | [S14] | no UI statement in retrieved text | - | - | NO VERDICT (gap) |

**Recurring principles** (my synthesis, inf.): (1) feedback-first displays, (2) sparseness, (3) progressive disclosure, (4) software-native not hardware mimicry, (5) consistency. Spacing, typography and motion: no retrieved source states measurable rules; the concrete data points are Crystalline's uniform square blocks [S4], Rift's two-tier disclosure [S5] and Pro-Q's text-and-controls Scaling [S3] (a consistent grid and type scale are implied, inf.). **Important**: none of the retrieved trade-press sources names depth, parallax or lighting as the source of "premium"; they name clarity, responsiveness and restraint (inf.). Depth is therefore an enhancement that must pay for itself in hierarchy.

### B2 Depth and parallax without assets
| Technique | Source / code (licence) | Key idea | Fits? | Cost, GPU layer, WebKit/WebView2 pitfalls | Verdict |
|---|---|---|---|---|---|
| Pointer parallax, layered, CSS custom props | [S26] Jhey Tompkins, CodePen embeds (public pens MIT [V S18]); [S27] Parallax.js (MIT [V]) options `hoverOnly`, `relativeInput`, per-layer depth multiplier | two custom props `--ratio-x/y`, per layer `translate` multiplier | yes, if rewritten | only `transform`/`opacity` are compositor-only; each promoted layer costs memory [V S22]; `will-change` is last resort, overuse slows [V S23]; demo binds `document` `pointermove` (forbidden here); a transform on an ancestor becomes containing block for `position:fixed` [own kit 05] | ADOPT (3-4 layers, <=5 px) |
| CSS 3D tilt + glare | [S28] vanilla-tilt (MIT [V]), [S29] Atropos (MIT [V]) | rotateX/Y with `perspective`, glare layer | partly | `preserve-3d` is forced flat by overflow other than visible/clip, opacity<1, filter, clip-path, isolation, mask-image, mix-blend-mode, `contain:paint` [V S15]; 3D-rotated controls blur text and distort hit math (inf.) | LIMIT: decor only, <=2 deg, never on controls |
| One light + layered shadows | [S21] Comeau; Fluent [S70] | same shadow ratio everywhere reads as one light; bigger/softer = higher; key+ambient pair [V]; inset shadows and 1 px top highlights give rim light (inf.) | yes | static = painted once | ADOPT (foundation) |
| SVG lighting filters (`feSpecularLighting`, `feDiffuseLighting`) | [S16] MDN; pen [S17] (MIT [S]); kit docs/08 "usable" [own] | alpha as bump map, Phong specular, point/spot light follows cursor | yes but costly | animating a filter repaints each frame (inf. from S22); iOS Safari: animated feTurbulence "really sluggish", tab crash, "SVG filters are pretty horrific for performance" [V S19]; cost grows with numOctaves [V S20]; no WebKit benchmark [gap] | STATIC ONLY, bake once; never animate light |
| Baked grain / vignette | [S30] CSS-Tricks; [S35] | feTurbulence noise under gradient; hides banding (only partly on long soft gradients [S35]) | yes | one-time raster; re-raster on zoom (inf.); canvas ImageData tile to data URL as alternative (inf.) | ADOPT static, 3-5 % |
| Canvas 2D additive glow | [S24] MDN; kit docs/08 [own] | pre-render sprite on offscreen canvas, avoid `shadowBlur`, integer coords, layered canvases, `{alpha:false}` [V]; kit suggests `lighter`+`shadowBlur` (conflicts, prefer sprite) | yes | N `drawImage` per frame; canvas sized once; DPR changes with page zoom [V S33] so blur after zoom (inf.) | OPTIONAL (concept C) |
| Easing | [S25] Driscoll | frame-rate-independent damping, `1-pow(smoothing,dt)` form, same as `1-exp(-k*dt)` [V] | yes | trivial | KEEP (index.js:335-336 already does it) |
| Pointer light (spotlight) | HUD_FILLER B.2 [own] | `mask-image: radial-gradient(...var(--mouse-x)...)` | adapt | masked layer repaints per move (inf.); `mask-image` also flattens 3D [V S15]; use a pre-painted gradient layer moved by `translate3d` instead (inf. from S22) | ADAPT |
| `contain` / `@property` | [S31][S32] | `contain` limits layout/paint to a subtree [V]; `@property` Baseline only since Jul 2024 [V] | contain yes | `contain:paint` kills `preserve-3d` [V S15]; `@property` may be missing on older WKWebView (inf.) | contain ADOPT on non-3D boxes; `@property` AVOID |

WebView2 is Chromium and web.dev's compositor guidance is Chromium-centric [V S22]; I found no WebView2-specific pitfall, so WKWebView is the risk surface (inf.). Working code with licence: parallax [S26][S27], tilt [S28][S29] and pens [S18] are MIT; CSS-Tricks grain [S30], Comeau [S21], MDN canvas [S24] are articles without a stated code licence (read, reimplement).

Reduced motion for all of the above: `matchMedia('(prefers-reduced-motion: reduce)')` [V S34]; scaling/panning large objects are vestibular triggers [V S34]; WCAG 2.3.3 names parallax explicitly [V S65]. index.js zeroes only the flex (:330, :351, :356).

### B3 Interaction patterns for plugin controls
| Candidate (quality / licence) | Source | Key idea | Fits? | Verdict |
|---|---|---|---|---|
| BODY `BodyDial` (A- / Artists in DSP) | [own] index.js:103-248 | pointer capture, 3 px dead zone, Shift fine, dblclick reset, keys, focus-gated wheel, typed entry incl. note names, gesture start/end, ARIA value/valuetext | yes (is the reference) | KEEP as is; add only Delete/Backspace reset |
| Cmajor `cmaj-parameter-controls.js` Knob (B- / ISC [V]) | [S37] | vertical drag via `movementY` (+ browser-bug workaround), Shift 0.25x vs 1.5x, dblclick reset, power mapping; window listeners, no ARIA [V] | ideas only | reference |
| webaudio-controls (C+ / Apache-2.0 [V]) | [S39] | vertical+horizontal combined drag, Shift 4x finer, wheel, keyboard; mouse/touch events, window listeners, `attachShadow`, no ARIA [V] | no (shadow DOM, 73 KB) | reference |
| NexusUI Dial (? / MIT per npm [V]) | [S40] | `interaction: radial/vertical/horizontal`, `mode: absolute/relative` [V]; repo "maintainers wanted" [S] | no | reference for relative-vs-absolute option |
| JUCE 8 WebView demo + Slider API (ISC header [V]) | [S41][S42] | native-web relay pattern (`WebSliderRelay`); native Slider offers velocity mode, `RotaryHorizontalVerticalDrag` [V] | conventions | reference |
| Ableton Live 12 | [S45] | Shift = finer drag, Delete = default, type-in value, arrows step, Shift+arrows fine [V] | yes | ADOPT Delete reset |
| Developer forums | [S46][S47] | circular drag jumps and is hard; relative-circular fixes the jump; Shift-fine "costs a hand" yet "works at any knob size"; VCV: Ctrl+Shift finer [V, anecdotal] | yes | keep vertical drag; keep wheel/keys/typed as non-modifier fine paths |
| WAI-ARIA slider + WCAG 2.5.7 | [S48][S61] | arrows +-step, Home/End, optional PageUp; `aria-valuetext`; dragging needs a non-drag alternative [V] | yes | already satisfied; keep |
| Web-UI templates (tomduncalf MIT [V S43]; srvb-plugin-svelte MIT [S44, snippet only]) | [S43][S44] | React/Svelte WebView UIs are common | no (bundlers) | evidence only. Do not copy from the Cmajor repo itself (GPLv3/commercial [V S38]); the three `cmaj_api` JS files I opened are ISC-headed [V] |

Quality grades are my judgement from the code I read (inf.). Host note: Cmajor documents `getScaleFactorLimits()` for auto-scaling [V S36], but kit docs/05 says Amorph does not reliably honour it [own].

### B4 Visualising resonance and energy
| Candidate | Source | Key idea | Fits? | Cost | Verdict |
|---|---|---|---|---|---|
| Mutable Rings | [S10] | no screen; two mode LEDs [V] | - | - | minimal-state reference |
| Ableton Corpus | [S50] | seven physical resonator types in a chooser, Tune/LFO/Filter/Bleed/Dry-Wet, limiter LED [V]; no body graphic described | - | - | BODY's silhouette is richer; the type chooser maps to the anchor row |
| Logic Sculpture | [S51] | circular Material Pad in the centre shapes the string; objects excite it [V]; Morph Pad with up to 5 points on iPad [S] | idea | - | precedent: make the morph the hero control |
| AAS Chromaphone 3 | [S52] | two resonators coupled, amount set by a Balance slider; layers colour-coded [V] | colour N/A | - | analogy for per-engine weights |
| FabFilter Pro-R | [S53] | frequency-dependent decay edited as an EQ-like curve; "EQ-like interface makes it feel immediately familiar" [V] | yes | low | ADOPT idea: energy shown in a familiar curve language |
| Minimal Audio Rift | [S5] | shape plus live waveform [V] | yes | low | ADOPT (see B1) |
| Plasmonic | [S54] | single resizable panel; no resonator graphic found [S] | - | - | excluded |
| Modal superposition on the outline | [S55][S56] | any membrane vibration is a sum of normal modes; Chladni patterns show nodal regions [V] | yes, pure JS | ~700 points x 3 sin per frame, index.js already does 672 pts (inf.) | ADOPT |
| Flow-field drift | [S57] | angle grid from continuous noise gives smooth non-crossing curves; ~0.1-0.5 % step [V] | yes | grid lookups | OPTIONAL |
| Ridgeline stack | [S58] | stacked curves with fill-under occlusion (Craft 1970) [S] | yes | ~12 polylines | OPTIONAL, may read as analyser (inf.) |
| Chladni demo | [S59] | interactive; licence not stated [V] | read only | - | do not copy |

Subtlety guard: "When animated feedback is brief and precise, it tends to feel lightweight and unobtrusive" [V S67].

### B5 Guidelines and constraints
| Guideline | Source | Requirement | Consequence for RE·BODY |
|---|---|---|---|
| WCAG 2.5.7 | [S61] | any drag action needs a single-pointer alternative | typed entry, keys, anchors satisfy it |
| WCAG 2.5.8 | [S62] | targets >=24x24 CSS px or spacing exception | morph slider 22 px high (:285), anchors ~18 px high (:290, inf.) are borderline |
| WCAG 1.4.11 / 1.4.3 | [S63][S64] | UI components/states 3:1; text 4.5:1 | my calc from CSS values: dial track 1.35-1.51:1 (:296), rail 1.54-1.72:1 (:286), "MORPH" 3.64-4.08:1 (:284) |
| WCAG 2.3.3 / 2.2.2 | [S65][S66] | interaction-triggered motion must be disableable, parallax named; auto-moving content >5 s needs pause | idle drift is decoration: avoid; energy motion is information |
| Apple HIG Motion/Materials | [S67][S68] | "Add motion purposefully", "Make motion optional", brief precise feedback; materials create depth/hierarchy, legibility first [V] | depth encodes hierarchy only |
| Microsoft Learn / Fluent 2 | [S69][S70][S71] | shadows "purposeful rather than aesthetic", too many reduce focus, limit for performance; consistent direction = one light; crisp = near, soft = far; key+ambient; motion physical and purposeful [V] | max 3 elevations, one light |
| Performance | [S72][S22][S23] | 16.66 ms/frame, own work within ~10 ms; animate transform/opacity only; layers cost memory; will-change last resort [V]; kit: pause hidden CSS animations, rAF throttled in background [own] | draw only when dirty (index.js:337 already); no always-on idle loop |
| Hidden WebView | [S73][S74] | JUCE replaces the page with a blank one when hidden unless `withKeepPageLoadedWhenBrowserIsHidden` [V]; WebKit process-throttler crash report [S]; Amorph's host stack is undocumented, so treat as indicative (inf.) | rebuild state from `requestParameterValue` (:331 already) |
| HiDPI/zoom | [S33] | page zoom changes DPR [V] | canvas sized once blurs after zoom (inf.): SVG/CSS for hairlines, canvas only for soft glow |
| Amorph/Cmajor UI guidance | [S76][S77][S78][S36] | "readable and distinct controls... communicate signal flow"; flat grid of identical knobs "never acceptable"; paste flow: complete simple UI beats ambitious incomplete one; view = default-export function returning HTMLElement [V]. Amorph positions itself as "not a replacement for FabFilter..." [V S76], so the premium bar is the owner's | no Amorph rule forbids depth; rules forbid ResizeObserver/window listeners |

## 2. Cross-bucket comparison
**Agreement**: (1) hierarchy and feedback beat decoration [S2][S3][S4][S5] with [S67][S69]; (2) one light, consistent direction, few elevations [S21][S70] with owner's LightingMaster; (3) animate only transform/opacity [S22] with [S72]; (4) motion purposeful and optional [S67][S65][S34]; (5) controls: vertical drag, Shift fine, dblclick/Delete reset, typed entry [S45][S37][S39] with kit docs/08.
**Conflicts and resolutions**
- C1 depth vs restraint: trade press equates premium with sparseness, Ableton/Baby Audio are flat [S4][S12]; depth techniques add layers. Resolve: depth only to encode hierarchy (floor / field / controls), never behind text (inf.).
- C2 parallax vs reduced-motion: parallax is the owner's ask and WCAG's textbook trigger [S65]. Resolve: hover-only, <=5 px, off under reduce and while dragging a control; energy-driven motion stays (information) at lower amplitude. OS flag is invisible inside a DAW, so offer an in-UI motion switch (localStorage convenience) (inf.).
- C3 real lighting vs sandbox: SVG lighting is the "correct" tool but animating it is the known slow path [S19]; LALAFY lighting assumes banned APIs. Resolve: painted gradients + static filters.
- C4 `preserve-3d` vs `contain:paint`/overflow/opacity/mask [S15]: choose 2D layers, no 3D.
- C5 kit docs/08 `lighter + shadowBlur` vs MDN "avoid shadowBlur" [S24]: use pre-rendered sprites.
- C6 Shift-fine vs forum objection (loses a hand) [S46]: keep wheel, arrows, typed entry as modifier-free paths.
- C7 dim premium chrome vs WCAG 3:1 [S63]: lift only informational strokes (track, rail, ticks); decorative hairlines may stay dim (WCAG exempts decoration, inf.).
- C8 resizable vs fixed canvas: original uses ResizeObserver (:332) but v1 bans it [own 03]; decides canvas strategy (Q1).

## 3. Critique of the current BODY UI (index.js)
**Strong (keep)**: (1) palette discipline: one ink #ededed (15-17:1 on the panel, my calc) plus a short grey ramp (:270, :284-302). (2) The corresponding-point silhouette morph (:42-102, :357) is the signature; `vector-effect:non-scaling-stroke` hairlines stay crisp at any DPR (:280). (3) Interaction completeness: capture + dead zone (:124-140), Shift fine (:145), dblclick (:160), keys (:165-177), focus-gated wheel (:179), typed entry with note names (:360-426), gesture begin/end (:135, :218), ARIA with valuetext (:205-209), `touch-action:none` (:285, :294, :303), full teardown (:427-429). (4) Honest states: bypass/dry dim the field and arcs (:306-307) and update aria-label (:358). (5) Frame-rate-independent smoothing (:335-336) and log-compressed energy (:352). (6) Reduced-motion check exists (:330, :356). (7) Decay readout in seconds mirrors the DSP mapping (:200-201).
**Weak**
- W1 hierarchy inverted: the current instrument name is a 9 px caption (:282, set at :341) while "BODY" is 23 px (:272); "MORPH" heading 8 px #717171 (:284) is 3.6-4.1:1; anchor labels 9 px (:290).
- W2 hero starved: rows 27/1fr/53/78 + padding 16/13 + 3 gaps leave the field 144 of 340 px (:270); `available = min(w/330,(h-20)/150)` (:355) gives scale 0.83, widest body about 230 of 576 px (inf.). Controls take 131 px.
- W3 dials: 58 px (:294); arc stroke 5 in a 200 viewBox renders about 1.45 px (:260, :296-297); pointer tick 1.5x4 px (:301); track 1.35-1.51:1 (:296); value text sits in a 44 px inner disc (:298) and doubles as drag zone and edit button (:124, :303); only feedback is border colour while dragging (:299), no hover/pressed light.
- W4 morph slider is the primary parameter but the weakest element: 1 px rail at 1.5-1.7:1 (:286), 8 px thumb (:287), 1x5 px ticks (:288), 22 px hit height (:285), no detent feedback, blend only as 9 px text (:341); the weight vector (:9-20) is never drawn; the hybrid stop looks like any other.
- W5 energy is almost invisible: flex amplitude <=0.75 px in y and <=0.36 px in x (:357: flex<=1.5, x0.5 and x0.2, not scaled by `available`); phase runs 4-6 rad/s regardless of pitch (:337); contour opacities are constant (:357); telemetry is only 4 floats at 30 Hz (dsp.cmajor:893); the DSP `onset` (dsp.cmajor:593) is never sent.
- W6 no depth or light: flat strokes, flat #121212 fill (:281), one radial backdrop (:270), no floor, no focus or hover light.
- W7 state communication: no wording for Mix=0 or no-signal (only aria, :358); bypass button text 10 px (:276).
- W8 contract debts for v1: ResizeObserver (:332, :428) and `clamp(45px,12vw,110px)` uses vw (:292) both banned [own 03 2d].
- W9 cost: `draw()` rebuilds 10 paths, 672 points as strings per active frame (:357); fine but unmeasured.

## 4. Ranked proposals (value / (effort x risk); information before decoration, inf.)
None adds a parameter or leaves the 2d/2e contract; items marked verify need `run_ui_probe` on the real build. Snippets after the list are illustrative only.
- **R1 Typography re-weight** (S, risk low, telemetry none). What: instrument name to 13-14 px hero caption, MORPH/anchors >=10 px, all text >=4.5:1. Why: B1 feedback/hierarchy [S2][S4], WCAG [S64], W1. How: CSS only, system stack as :270. Watch: "OBOSAXOLELE" at 10 px is about 72 px, equal to the 72 px anchor cell (inf.), so abbreviate or stagger.
- **R2 One-light and elevation tokens** (S, low, none). What: `--lx/--ly`, three elevations (floor, field, controls) with key+ambient pair, light rim edges instead of dark shadows (shadows vanish on #090909, inf.). Why: [S21][S70][S69] and owner LightingMaster. How: layered `box-shadow`/inset highlights, painted once.
- **R3 Dial v2** (M, low-med, none). What: 64-72 px, 3 px arc, conic-gradient cap [own kit 08], static specular crescent from R2, pressed = cap drops 1 px and shadow tightens (crisp = near [S70]), hover rim, fine-mode inner ring, informational track >=3:1, default tick on the arc. Why: W3, [S63][S67][S4]. How: SVG + CSS vars, no filters. Watch: keep value button as separate hit zone.
- **R4 Morph slider as hero** (M, med, optional `bodyEngines` float<7>). What: 3 px engraved groove, 8 detents that grow as the thumb nears, 14 px lit thumb, >=28 px hit height, 7 hairline weight bars from `morphWeights` (:9-20), bracket on the hybrid stop. Why: W4, [S51][S52][S48][S62]. How: CSS vars from `visualMorph`. Per-engine DSP weights only if the true sounding mix is wanted.
- **R5 Field rim light and floor** (S-M, low, none). What: under-glow via two extra low-alpha wide strokes on contour 0, static linear-gradient stroke facing the light, floor ellipse + 1 px floor line, opacity breathing tied to `wet`. Why: owner LIGHTING sec.1 edge-light stacks; avoid `shadowBlur` [S24]; avoid animated filters [S19]. How: SVG strokes/gradients only.
- **R6 Energy response v2** (M, low-med, optional new events). What: 3-mode superposition along the contour (1/2/3 half-waves, inharmonic phase ratios, inf.), amplitude 1.5-3 px scaled by `available`, decays with `tail`, onset kick, brightness (not motion) carries info under reduce. Why: W5, [S55][S56][S5][S67]. How: same point arrays, no extra DOM. Telemetry (optional): `output event float<8> bodyBands` (wet energy, 8 log bands, 30 Hz) and `output event float bodyOnset` (from `onset`, dsp:593). Without them use the existing 4 floats. Viz endpoint delivery is unresolved upstream [own 03 sec.1]; the original already listens to `bodyViz` (:329) so custom endpoints likely work (inf.), verify with `run_ui_probe`.
- **R7 State as lamp** (S, low, none). What: `--lamp` 1 active, 0.7 no input, 0.25 bypass, wet layers off at Mix=0, 400 ms ease; text state in caption ("BYPASSED", "NO INPUT"), never colour alone. Why: W7, [S70] elevation/contour changes state, [S67]. How: extend `data-process` (:306, :347).
- **R8 Micro-interaction polish** (S, low, none). What: Delete/Backspace resets focused control [S45], dblclick flash, default tick, light-style focus ring >=3:1, wheel stays focus-gated. Why: B3, [S61].
- **R9 Baked grain and vignette** (S, low, none). What: 128 px monochrome noise tile drawn once on a canvas, used as inline `data:` background at 3-5 % over the backdrop and dial caps. Why: [S30][S35] banding on dark gradients. Cost: one-off (offscreen canvas, never in layout, so the size-once rule is untouched).
- **R10 Pointer parallax and light follow** (M, med, none). What: 3 layers (backdrop 0.3, field 0.6, chrome 0), <=5 px, exp smoothing tau about 120 ms, `translate3d` only; light moves a pre-painted highlight layer. How: `pointermove`/`pointerleave` on the host element only, no capture, rAF only while moving, off under reduce and during control drags. Why: [S26][S27][S65]. Risks: hover delivery in DAW hosts unverified and element-only listener vs core-ui rule needs `run_ui_probe`; overscan layers need `overflow:hidden` (host wrapper has `overflow:auto`, kit docs/05); no transform on the chassis.
- **R11 Re-proportion layout** (M, med, none). What: merge MORPH + anchors into one 44 px row, dials to 68 px, field >=55 % height. Why: W2, FabFilter display-fills-window [S3]. Risk: departs from the original layout the owner likes.
- **R12 Ambient air layer** (L, med-high, optional `bodyBands`). What: <=40 additive glow sprites on a flow field [S57], brightness follows `wet`, frozen under reduce, paused when idle. Why: B4 "living". Risk: CPU x instances, canvas sized once blurs at zoom, can tip into noisy.

Illustrative snippets (not final code):
```js
// R10: host-element hover, no capture; schedule rAF only while the offset still moves
const k = 1 - Math.exp(-dt / 0.12);                 // same form as index.js:335
px += (tx - px) * k;  py += (ty - py) * k;
for (const l of layers) l.node.style.transform = `translate3d(${px*l.d}px,${py*l.d}px,0)`;
```
```html
<!-- R5: fake bloom without filters, three strokes of the same path d -->
<path class="glow2" d="..." stroke-width="7" opacity=".05"/><path class="glow1" d="..." stroke-width="3.5" opacity=".10"/><path class="edge" d="..." stroke="url(#litEdge)"/>
```

## 5. Three concept directions
**A Conservative polish** (R1, R2, R3, R7, R8, R9): same layout and silhouettes, typographic hierarchy, one lamp and elevation model, lit dials with real pressed/hover states, grain; no pointer-linked motion, no DSP change, safest, and the substrate (tokens, `--lamp`) for B and C.
**B Parallax depth panel** (A + R4, R5, R10, optional R11): the panel becomes three light-linked planes; the cursor tilts the light and shifts layers by a few pixels while the controls stay still; morph slider and field get rim light. Still UI-only; highest motion-comfort and host-input risk.
**C Living instrument field** (A + R4, R5, R6, optional R12, optional `bodyBands`/`bodyOnset`): the field is the hero; the outline vibrates in modes driven by real band energy, strikes ripple on onsets, a faint air layer breathes with the wet signal; parallax limited to the field. Needs two DSP outputs for full effect. My inference: ship A, then C's R6 (information) before B's R10 (decoration).

## 6. Open questions for the owner
1. Fixed 620x340 chassis (CSS-scaled, canvas blurs at zoom) or resizable (needs the zoom recipe or fluid layout; ResizeObserver banned in v1)?
2. May RE·BODY add DSP telemetry (`bodyBands`, `bodyOnset`, `bodyEngines`) or must the UI live on the existing `bodyViz` float<4>?
3. How much pointer-driven motion is acceptable inside a DAW, and do you want an in-UI "Motion" switch beside the OS flag?
4. May secondary greys and informational tracks be lifted to 4.5:1 / 3:1 (brighter than the HONE-dim look)?
5. How far may the layout depart from the original (R11) given the credit to Artists in DSP?

## 7. Sources
- S1 https://www.fabfilter.com/about
- S2 https://www.musicradar.com/news/tech/meet-the-programmers-fabfilter-574996
- S3 https://www.soundonsound.com/reviews/fabfilter-pro-q-4
- S4 https://www.soundonsound.com/reviews/baby-audio-crystalline
- S5 https://www.soundonsound.com/reviews/minimal-audio-rift
- S6 https://www.musicradar.com/reviews/kilohearts-phase-plant
- S7 https://www.attackmagazine.com/features/interview/we-do-it-because-we-want-to-not-because-we-see-commercial-opportunities-urs-heckmann/
- S8 https://www.highsnobiety.com/p/teenage-engineering-interview/
- S9 https://blakecrosley.com/guides/design/teenage-engineering (third-party essay)
- S10 https://pichenette.readthedocs.io/en/latest/modules/rings/manual/
- S11 https://en.clockfacemodular.com/blogs/waveguide/interview-with-designers-emilie-gillet-mutable-instruments
- S12 https://new.tapeop.com/reviews/gear/160/live-12-suite
- S13 https://www.yahoo.com/entertainment/articles/predicting-future-evolution-plugin-design-162500921.html (MusicRadar, Adam Douglas, 2025-07-03)
- S14 https://musicradar.com/news/how-arturia-plugins-are-made
- S15 https://developer.mozilla.org/en-US/docs/Web/CSS/transform-style
- S16 https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feSpecularLighting
- S17 https://codepen.io/iflyit/pen/NWMGmPy
- S18 https://blog.codepen.io/documentation/licensing/
- S19 https://gsap.com/community/forums/topic/33075-gsap-and-feturbulence-mobile-performance/
- S20 https://bugzilla.mozilla.org/show_bug.cgi?id=422371
- S21 https://www.joshwcomeau.com/css/designing-shadows/
- S22 https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count
- S23 https://developer.mozilla.org/en-US/docs/Web/CSS/will-change
- S24 https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
- S25 https://www.rorydriscoll.com/2016/03/07/frame-rate-independent-damping-using-lerp/
- S26 https://dev.to/jh3y/parallax-powered-by-css-custom-properties-3p83
- S27 https://github.com/wagerfield/parallax
- S28 https://github.com/micku7zu/vanilla-tilt.js
- S29 https://github.com/nolimits4web/atropos
- S30 https://css-tricks.com/grainy-gradients/
- S31 https://developer.mozilla.org/en-US/docs/Web/CSS/contain
- S32 https://developer.mozilla.org/en-US/docs/Web/CSS/@property
- S33 https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
- S34 https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- S35 https://instantgradient.com/blog/grainy-gradients
- S36 https://cmajor.dev/docs/PatchFormat
- S37 https://github.com/cmajor-lang/cmajor/blob/master/javascript/cmaj_api/cmaj-parameter-controls.js
- S38 https://github.com/cmajor-lang/cmajor/blob/master/LICENSE.md
- S39 https://github.com/g200kg/webaudio-controls
- S40 https://cdn.jsdelivr.net/npm/nexusui@2.1.6/lib/interfaces/dial.js (licence: https://registry.npmjs.org/nexusui/latest)
- S41 https://github.com/juce-framework/JUCE/blob/master/examples/Plugins/WebViewPluginDemo.h
- S42 https://docs.juce.com/master/classSlider.html
- S43 https://github.com/tomduncalf/tomduncalf_juce_web_ui
- S44 https://github.com/cristianvogel/srvb-plugin-svelte
- S45 https://www.ableton.com/en/live-manual/12/live-keyboard-shortcuts/
- S46 https://www.kvraudio.com/forum/viewtopic.php?t=415328
- S47 https://community.vcvrack.com/t/idea-for-better-dragging-behaviour/2838
- S48 https://www.w3.org/WAI/ARIA/apg/patterns/slider/
- S50 https://www.ableton.com/en/live-manual/12/live-audio-effect-reference/
- S51 https://help.apple.com/logicpro/mac/9.1.6/en/logicpro/instruments/chapter_14_section_1.html
- S52 https://applied-acoustics.com/chromaphone-3/manual
- S53 https://www.soundonsound.com/reviews/fabfilter-pro-r
- S54 https://synthanatomy.com/2020/12/rhizomatic-plasmonic-mpe-physical-modeling-synth-from-the-absynth-developer.html
- S55 https://en.wikipedia.org/wiki/Vibrations_of_a_circular_membrane
- S56 https://en.wikipedia.org/wiki/Chladni_figure
- S57 https://www.tylerxhobbs.com/words/flow-fields
- S58 https://www.scientificamerican.com/article/the-pulsar-chart-that-became-a-pop-icon-turns-50-joy-division-rsquo-s-unknown-pleasures
- S59 https://bit-101.com/2017/?p=1143
- S61 https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html
- S62 https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- S63 https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- S64 https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- S65 https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
- S66 https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html
- S67 https://developer.apple.com/design/human-interface-guidelines/motion
- S68 https://developer.apple.com/design/human-interface-guidelines/materials
- S69 https://learn.microsoft.com/en-us/windows/apps/design/layout/depth-shadow
- S70 https://fluent2.microsoft.design/elevation
- S71 https://fluent2.microsoft.design/motion
- S72 https://web.dev/articles/rendering-performance
- S73 https://docs.juce.com/master/classWebBrowserComponent_1_1Options.html
- S74 https://forum.juce.com/t/webkit-processthrottler-crash-in-juce-8-webview-plugin-macos/68055
- S76 https://artistsindsp.com/llms.txt
- S77 https://raw.githubusercontent.com/Artists-in-DSP/amorph-for-agents/main/context-src/v1/shared/core-ui-contract.md
- S78 https://raw.githubusercontent.com/Artists-in-DSP/amorph-for-agents/main/docs/paste-context/ui/UI_REF_FX.md
- S80 https://vogerdesign.com/blog/glassmorphism-audio-plugin-ui/ (search result only [S], excluded: backdrop-filter style)
Owner docs: /home/user/RE_BODY/docs/index/{01_BODY_ORIGINAL,02_LALAFY,03_AMORPH_PLATFORM}.md; /home/user/RE_BODY/reference/body_original/{index.js,dsp.cmajor}; /home/user/Amorph_DEV_KIt/docs/{05_AMORPH_NOTES,08_UI_RENDERING}.md (stale main, see 03 sec.0); LALAFY research under $SCRATCH/lalafy/LALAFY/.
