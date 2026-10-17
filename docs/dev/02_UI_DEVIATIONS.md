# 02 — P1 UI deviations (original CSS and behaviour, 07_SCALING, upstream core-ui contract)

Scope: the P1 functional UI (`src/ui/*.js` -> `plugin/index.js`, built by `python3 tools/build_ui.py`); sections H-L extend the file for the P6 UI (panel, field, scaling, integration). Sources compared: `reference/body_original/index.js` (UI:line), kit `docs/07_SCALING.md` (07), kit `docs/03_UI_WEBCOMPONENT.md` (03), upstream `core-ui-contract.md` and `ui/fx.md` (upstream wins over kit captures, kit rule 9), `docs/concept/21_UI_CONCEPT.md` (21). Class names keep the original `body-*` vocabulary; only the element tag changes (`body-instrument-view` -> `re-body-view`), and `css()` in `30_panel.js` prefixes every rule with it.

## A. Original CSS, line by line (UI:267-310)
| UI line | before | after | reason |
|---|---|---|---|
| 267 reset | `body-instrument-view,… *{box-sizing;margin:0;padding:0}` | verbatim, new tag | — |
| (new, first) | scoped only | unscoped `*{box-sizing…}`, `html,body{overflow:hidden}`, `::-webkit-scrollbar{display:none}`, `*{scrollbar-width:none}` | upstream §5 "first CSS rules" and 03/07 host-wrapper fix; they must reach Amorph's wrapper elements |
| 268 host | `display:block;width:100%!important;height:100%!important;overflow:hidden` | `display:flex` centred, `width/height:100%` without `!important`, `background:transparent`; JS then writes inline px (§C) | 07 gotcha 1: Amorph ignores %, inline styles beat the sheet; `!important` dropped (21 §11) |
| 269 `[hidden]` | `display:none!important` | verbatim | line sets hide with it |
| 270 panel | `width/height:100%;padding:16px 22px 13px;grid-template-rows:27px 1fr 53px 78px;gap:3px` | fixed `960 × 600`, `padding:12px 24px`, rows `36 · 234 · 48 · 100 · 64 · 64`, `gap:6px`, scaled by `zoom` | 21 §1 row table (sum 600) |
| 271 header | `justify-content:space-between` | flex, `gap:14px`; holds ident (title + brand), tabs, copy, state, utilities | tabs / brand / Motion (21 §1) |
| 272 title | `.body-title` 23 px | verbatim; text `BODY` -> `RE·BODY` | — |
| 273 utilities | `gap:15px` | verbatim + `margin-left:auto` | right dock of the header |
| 274-277 | button reset, Bypass look and pressed state | verbatim; `.body-bypass` look is reused by Hold and Copy buttons | one button vocabulary |
| 278-279 field / svg | `pointer-events:none`; svg `width/height:100%` measured by observer | `grid-row:2`, svg fixed `912 × 234` px, view box = same constants | fixed chassis: nothing is measured (21 §2) |
| 280-281 contour | stroke / fill rules | verbatim | — |
| 282 caption | `bottom:0; 500 9px/12px` | `bottom:13px;height:17px; 500 13px/17px` plus new `.body-follow` (10 px/13 px) under it; drawing band 17 -> 30 px, `available` `max(24,H-20)/150` -> `max(24,H-33)/150` (1.43 -> 1.34 on 234 px) | 21 §2 caption 13 px; the follow note sits under the caption (brief) |
| 283-284 morph box / heading | heading centred above the slider, `#717171` | row: heading left, 52 px, `line-height:28px`, `#8c8c8c` | 21 §1; text contrast 3.6-4.0 -> 5.3-5.7 : 1 (R11 R1) |
| 285 slider | `height:22px; margin:0 calc(100%/16)` | `28px; calc(100%/22)` | ≥ 28 px hit height, 11 cells |
| 286 rail | `top:10px;height:1px` | `top:12px;height:3px;radius:2px` | groove (21 §5) |
| 287 thumb | 8 px | 14 px, `top:-5.5px` | 21 §5 |
| 288 tick | `left:calc(var(--anchor)/7*100%); 1×5` | `/10`; `top:-3px; 1×9` | 11 anchors, detents |
| 289 anchor row | `repeat(8,…)` | `repeat(11,…)` | 11 anchors |
| 290 anchor | 9 px | 11 px (the large-layout value 21 §11.1) | — |
| 291 anchor hover | verbatim | verbatim | — |
| 292 deck | `justify-content:center; gap:clamp(45px,12vw,110px)` | no gap; fixed cell widths 112 / 72 / 84, deck line 624, divider 32, globals 256 = 912 | viewport units deleted (D5), 21 §1 horizontal fit |
| 293 control column | verbatim | verbatim | — |
| 294 dial | `58px` | `70 / 44 / 34 px` by kind (`.body-control-dial/-small/-mini .body-dial`) | 21 §5 |
| 295, 298-301 | graphic, inner cap, dragging border, pointer | verbatim | dial look as base |
| 296-297 track / arc | `stroke-width:5` | `8.6 / 11.4 / 11.8` view-box units, same greys | B7: 3 / 2.5 / 2 px at the three sizes (original = 1.75 px at 70 px) |
| 302 label | 9 px | 10 px main (large-layout value), 9 px small, 8 px mini; unit appended to the label for dB / Hz on small and mini (`LEVEL dB`, `LOW CUT Hz`) | the inner circle of a 44 px dial cannot hold `-60.0 dB` |
| 303 value | 11 px, `padding:5px 0` | 13 px main (large-layout value), 10 px / `3px` small, 8 px / `2px` mini | fits the inner circles |
| 304 hover | verbatim | verbatim | — |
| 305 editor | `width:90%` in flow | `position:absolute`, centred on the dial, `min-width:52px`, `z-index:2` | small and mini inner circles are narrower than a usable input |
| 306-307 process | verbatim | verbatim | — |
| 308 focus ring | verbatim selector list | verbatim (covers all new buttons) | — |
| 309-310 media queries | `(max-width:540px),(max-height:280px)` and `(min-height:440px)` | deleted | D5: fixed chassis, zoom does the scaling |
| (new) | — | `.body-tab*`, `.body-enablebtn`, `.body-lamp`, `.body-copy*`, `.body-state`, `.body-motion*`, `.body-scope`, `.body-meter*`, `.body-onset*`, `.body-bands`, `.body-segbtn`, `.body-segmeter`, `.body-group*`, `.body-strip1/2`, `.body-morphrow`, `.body-hold`, `.body-deckline/-deckdiv/-deckglobal`, `.body-ident`, `.body-maker`, `.body-follow` | new surface, same type scale and greys |
| grey lift | `#717171` text only | `#8c8c8c`; all new small text ≥ `#8c8c8c`, brand `#8f8f8f` | ≥ 4.5 : 1 on the panel background; tracks (`#303030`, about 1.5 : 1) stay for U5 (dial v2) |

## B. Original behaviour (UI:5-433)
| item | before | after | reason |
|---|---|---|---|
| `BodyDial` (103-248) | 3 hard-coded dials, range 0..100, `toFixed(1)` rounding | `Control` (10_control.js): kinds dial / small / mini / slider / segmented / button; range, step, init from `data-min/max/step/init`; step quantising `min + round((v-min)/step)*step`; drag `Δ·range/240` (Shift `/1200`) done in normalised space | 73 parameters from one generated table |
| keys (165-177) | arrows ±1, Shift ±0.1, Page ±10, Home 0, End 100 | arrows ±1 %, Shift ±0.1 %, Page ±10 % of the (normalised) range, never below one `step`; Home / End = min / max; **Delete = reset (added)** | 21 §5, R11 R8 |
| wheel (178-183) | focus-gated ±1 | same, in normalised steps | — |
| note mode (186, 34-36) | `param1` only, 0..100 hard-coded | `Tune` of any line while its morph is pitched; MIDI 36..72 mapped over the control's own range; `aria-valuemin/max` 36/72 kept | per-line Tune |
| Decay seconds (21-27, 200) | 7-engine tables | `DECAY_BASE` / `DECAY_RATIO` for 11 anchors (22_BODIES §1-§11), morph-weighted as the original, hybrid = Oboe + Ukulele + Sax thirds; `build_ui.py` cross-checks them with `plugin/bodies.json` (all 10 plain anchors match) | TODO: generate from `bodies.json` |
| `setValue` (187-197) | called `refreshProcessing()` + `dirty` on every call | `setValue(v, notify, force)`; derived work goes through `view.controlChanged()` (no-op until the first mount is complete, then only what the changed parameter needs); `force` lets Copy resend equal values | 73 controls built once; F7 |
| init (184, 253) | `values` hard-coded | `Control` constructor paints `setValue(data-init, false)`; `view.valueOf(id)` falls back to the spec table | D2, 21 §5 |
| value editor (360-426) | percent / note / seconds | `Control.edit()`: same flow; note names for pitched Tune, seconds for Decay (a trailing `%` is taken as percent), `%`, `s`, `dB`, `Hz`, `kHz` stripped, clamp and step rounding from the range | generalised |
| morph slider (320-325, 341-345) | 0..7, dblclick -> 4 | kind `slider`, range from data (0..10), dblclick -> the line's init (A 7, B 0, C 3), Shift-drag = 10 % of the range (as before), Page ±1, arrows ±0.05 | 21 §5 |
| `morphWeights`, `morphDescription` (9-32) | 8 anchors, `engineOrder` | 11 anchors in the new order; last segment Sax -> Obosaxolele = thirds; captions use `anchorLabelsLong` | 22 §0, §11 |
| Bypass (326, 346-347) | special-cased | generic button `Control` (`role="switch"`); panel `data-process` via `controlChanged` | one code path |
| reduced motion (330) | query only | query forces Motion Off; Motion switch (Off / Calm / Full) is UI-only, stored in `localStorage` (try / catch); Calm and Full behave the same for now | brief |
| `bodyViz` listener (329) | 1 endpoint | `TELEMETRY` table: bodyViz, bodyBands, bodyOnset, analysisViz, lineStateA/B/C (7 of the 10 declared; lineModes* not drawn in P1); every packet through `unpack` + finite check | brief, 21 §4 |
| observer + `resize()` (332, 348) | measured the field | removed; fixed 912 × 234 view box | 21 §6 |
| rAF (333-338) | re-armed every frame | re-armed only while the morph eases, energies are non-zero, a readout decays, or telemetry has signal; readouts at most every 32 ms; the loop returns early while `resizing()` | 21 §3, 07 §3, brief |
| `disconnectedCallback` (427-429) | removed one endpoint listener | removes the all-parameter listener, all 7 endpoint listeners, the resize listener, three timers, the rAF, the media-query listener, pointer capture and open gestures of every control, every tracked listener; the editor is cancelled | brief |
| factory (431-433) | set `view.pc` only | also `view.patchConnection` (upstream) | upstream §1 |
| template build (78-82, 98-102) | at module evaluation | lazily, once, in `initField()` | no DOM access at import |
| `draw()` (349-359) | measured width / height, 8 templates | fixed 912 × 234; 11 anchors through `TEMPLATE_OF` (**Timpani -> bass drum, Guitar -> ukulele, Fiddle -> ukulele, marked TODO** in `00_header.js` and `20_field.js`); `scaleFor` Tune normalised by the spec range, anchors 0-1 = size law; flex unchanged; `aria-label` only written when it changed | brief |
| silhouettes `instrumentPaths`, `hybridPaths` | — | verbatim (also the unused `collapsed` helper) | 21 §11.4 |
| labels | `BODY stereo effect` | `RE·BODY stereo effect` | name |
| (new) echo guard | none | ring of 32 sent values; an incoming value equal to a recent send is dropped and consumed, entries expire after 750 ms | 03 mandatory pattern; expiry/consumption added so a dropped echo never swallows a later real automation value |
| (new) copy A -> B / A -> C | — | tab bar buttons; source fixed to A; 21 parameters per target (everything but Enable and Hold, Morph included), one gesture each, resent even if equal | 21 §10, brief (the undo snapshot is deferred) |
| (new) keys 1 / 2 / 3 | — | listener on the host element switches the line, ignored with a modifier or inside the editor | 21 §10 |

## C. 07_SCALING deviations (P1 state; the final list is section I)
| item | 07 | here | reason |
|---|---|---|---|
| resize observer | recipe observes `this` or the parent | **not used** | upstream §6 "never use ResizeObserver"; 21 §6 |
| host height | `plugin-ui{height:100vh}` | `width/height:100%` in CSS, inline px from `window.innerWidth/innerHeight` | kit rule 9, lint `no-vw-vh`; 07 gotcha 1 says Amorph ignores both anyway |
| zoom range | `0.5..2.0` (first recipe), `0.4..2.5` (gotcha code) | `0.5..2.0`, 0.05 steps | D16 |
| `_doScale` | one routine measures `eff` on every call | `rescale(measure)`: a resize event only rewrites the two host sizes with the cached `eff`; the full probe runs on the 190 ms settle, on first frame (`setTimeout 0` + synchronous) and every 250 ms (skipped while `resizing()`) | 07 §3 "even with cached eff" |
| resize suspension (§3) | 180 ms `resizing()`, zoom deferred, loops return early | all three kept (`RESIZE_QUIET_MS`, `SETTLE_MS`, rAF body); no canvas exists to suspend | — |
| wrapper walk-up | once in `connectedCallback` | on every probe (4 Hz) | 07: "the JS walk-up alone can be undone by a re-render" |
| `style.transform=''` | defensive clear | omitted (no transform is ever set on the chassis) | — |
| chassis | separate `.chassis` | `.body-panel` is the chassis (zoom target); host is the flex centre | one element less |
| unscoped CSS | `::-webkit-scrollbar`, `*` | added (§A) | host wrappers |
| diagnostic readout | optional | not included | — |
| window listener | — | `window.addEventListener('resize')` is the only window-level listener; the reduced-motion `change` listener sits on the `MediaQueryList` | required by 07; pointer events are element-level only |

## D. Upstream core-ui contract deviations
| upstream | here | reason |
|---|---|---|
| factory is the first declaration after the receipt comments | `export default function createPatchView` is the last statement of `90_export.js` (a hoisted declaration, so the behaviour is "factory first"); line 1 is a descriptive comment, not receipt comments | lead contract `00_P1_CONTRACTS.md`; the receipt format belongs to the Copy-Prompt flow; if a pasted-file checker needs it textually first, `build_ui.py` could be made to hoist it |
| < 8000 characters | ~160 KB (P1: ~82 KB) | "paste-flow budget, not a host limit" (kit 03); a 73-parameter panel cannot fit |
| host has no fixed px; fluid grid layout | fixed 960 × 600 chassis + `zoom`, host sized in px by JS | D4 (07 option 2); the other parameter-binding rules apply unchanged |
| 270° dial: `--angle` / `--arc` with a conic fill | `--norm` kept, pointer `rotate(calc(var(--norm)*270deg - 135deg))`, fill = original SVG arc (bipolar arcs start at zero) | original look is the base (21 §11); `--norm` audit min / mid / max still holds |
| subscribe requested outputs | 7 of 10 (P1); all 10 since section H2 | `lineModes*` are drawn by the field markers from P6 |
| one `HTMLElement` subclass, one helper class | `RebodyView` + `Control`; the view is assembled from method bags (`FieldMethods`, `PanelMethods`, `TelemetryMethods`, `ScalingMethods`) with `Object.assign` | the parts must concatenate, one class body cannot span files |
| `// END_AMORPH_UI` | present | harmless, keeps pasted-file tools happy |

## E. Not in P1 (concept items deferred, no source involved)
MORE collapse of strip 2; hover-label on mini dials; dial v2 extras (specular crescent, conic cap, default tick, fine-mode ring); Timpani greyed arc above C4; morph weight bars (`lineState*.engine0..10`); Follow lock lamp; Excite hairlines; `lineModes*` markers; Copy undo snapshot; the whole 11-layer depth field (z-table, fog, light, ghosts, chain thread, hit layer); Motion Calm / Full behaviour; new drawings for Timpani, Guitar, Fiddle. The hidden-control probe (D39) on the real host is the lead's P1 spike; here B and C sets are `hidden` (`display:none`), so they only exist in the DOM.

All of E is closed by P6 (sections H and J) except what J5 lists as open.

## F. Verification (this block)
`python3 tools/build_ui.py` (also `--check`) · kit `ui_lint.py --strict` and branding `ui_lint.py --strict`: 0 errors, 0 warnings, no disagreements · headless Chromium smoke test `/tmp/claude-0/-home-user/56398787-a593-57af-8ae9-3f0062939bf1/scratchpad/uitest/smoke.mjs` (`node smoke.mjs`): 49 checks (73 `data-param` once each, line-set `hidden` toggling, drag / Shift / keys / wheel / dblclick / editors, echo guard, morph, Copy, telemetry painting and the 30 Hz cap, idle = no rAF, teardown, zoom 0.5 / 1 / 2 and resize, no console errors). Screens: `docs/dev/screens/p1_ui_960.png`, `p1_ui_480.png`. Not verified: the real Amorph host (WebKit / WebView2 `zoom` behaviour, `eff` probe, hidden-control probe).

## G. Fertigmeldung (CLAUDE.md rule 7): each commissioned point, status, place in the UI
| point | status | place |
|---|---|---|
| `00_header.js`: line 1 comment, line 2 WINDOW SIZE, BRAND byte-exact, generated PARAMS block between markers | done | `plugin/index.js` lines 1-2; BRAND shown under the title (header, left) |
| `10_control.js`: `Control` with dial / small / mini / slider / segmented / button, capture, `touch-action:none`, Shift, dblclick, keys, wheel, typed editor (notes, seconds, ranges), `setValue(v, notify)`, ARIA / real buttons, `data-param` once | done | every control; editors: click a value; Tune of pitched bodies = note names, Decay = seconds |
| `20_field.js`: silhouettes, morph, Tune scale, energy flex, 11 anchors (Timpani / Guitar / Fiddle = TODO reuse), long-name caption | done (TODO marked) | field, 912 × 234, under the header |
| `30_panel.js`: header (title, brand, tabs A·B·C with ≥ 24 px Enable + lamp, state caption, Bypass, Motion), field, morph row (11 abbreviations + Hold), deck (Tune, Decay, Material, Mix; Level, Follow, Blend, Pan; Width, Low Cut), strip 1, strip 2 with contact / body / physics, three hidden-toggled line sets, globals once, Copy A→B / A→C | done | as listed; Copy next to the tabs |
| `40_telemetry.js`: IN / WET meters, 8 band bars, onset lamp, Listen hairlines, tab lamps, follow note | done | meters + onset top-left of the field, bands top-right, hairlines under Listen, lamps in the tabs, follow note under the caption |
| `50_scaling.js`: 07 zoom chassis with the logged deviations | done | whole panel; §C |
| `90_export.js`: element definition + factory | done | — |
| `tools/build_ui.py` | done | `python3 tools/build_ui.py [--check]` |
| `02_UI_DEVIATIONS.md` | done | this file |
| lint ×2, smoke test, two screenshots | done | §F |

## H. P6 panel (U3 telemetry, U4 morph hero, U5 Control v2 and panel): `10_control.js`, `30_panel.js`, `40_telemetry.js`
Original look stays the base (21 §11); this block adds only what 21 §5 / §10 and R11 R1-R4, R7-R9 name. Closes the §E items "dial v2 extras", "Timpani greyed arc", "morph weight bars", "Follow lock lamp", "Excite hairlines", "`lineModes*`". MORE collapse of strip 2 and the Copy undo snapshot are closed in section J.

### H1 look (UI:line = original CSS line)
| item | before (P1) | after (P6) | reason |
|---|---|---|---|
| dial sizes (:294) | 70 / 44 / 34 px | 70 / 40 / 28 px (`DIAL_PX`) | brief; mini keeps a >= 24 px target |
| arc stroke (:296-297) | 8.6 / 11.4 / 11.8 units | 8.6 / 12.5 / 14.3 units = 3 / 2.5 / 2 CSS px (`ARC_PX * 200 / DIAL_PX`, computed, not typed) | B7, R3 |
| track (:296) | `#303030`, 1.5:1 | `--track` `#686868`, 3.19:1 on the lightest backdrop `#181818` | informational >= 3:1 |
| cap (:298) | flat `#101010` | conic + sheen gradient, **static crescent** (inset highlight) and cast shadow from `--lx:-.6 / --ly:-.8` on `.body-panel`, painted once; border `#303030` kept | one light (R2, R3) |
| hover / pressed / fine | none (only the dragging border :298) | hover rim `#5a5a5a`; dragging: border `#ededed` (:298 verbatim) + cap `translateY(1px)` + shadow blur 3 -> 1 px; fine ring (dashed, inside the cap) while Shift is held (pointer or keyboard) | R3 |
| default tick | none | 1 px radial tick across the arc at `data-init` (note-quantised for pitched Tune), hidden at the arc ends | R3, R8 |
| Timpani | none | `.body-dial-grey` `#2a2a2a` above the morph-weighted `tuneNoteRange` ceiling (`TUNE_NOTE_MAX`, C4 for Timpani) while Tune is in note mode | 21 §5 (N7); visual only |
| values (:302-303) | small `50%`, mini 8 px inside the cap | small caps show the number without `%` (10 px; `-100%` does not fit a 28 px cap, unit stays in `aria-valuetext` and the editor); mini: value button transparent (hit zone), value replaces the name on hover / drag / focus | 21 §5 |
| typography | brand, heads, meter labels 8 px; labels 8-9; state / Enable 9 | every text >= 10 px; caption 13 -> 14 px / 600 / `#c4c4c4`; anchors `#858585` -> `#8c8c8c`; lowest text contrast 5.28:1 | R1 |
| buttons (:274-277) | flat | original Bypass look verbatim + lit top edge, cast shadow, sheen; hover border `#5c5c5c`; `:active` 1 px down; short flash on reset | R2, R8 |
| segment meter | `#ededed` (invisible on the lit segment) | `currentColor` | visibility |
| morph row (:286-289) | groove `#393939`, flat thumb, tick `#777` 9 px centred | groove `--track` + inset shadow (3 px); thumb radial-lit + glow, brighter glow while pressed; 11 detents below the groove, 4 -> 9 px by `--near` (1 stop = 5.7 px, >= 1.5 stops = 4 px), `#a0a0a0`; hairline weight bars above (`--w * 11 px`); bracket on the hybrid stop | R4 |
| Hold | text only | `::before` lamp (30 % off, 100 % + glow when `lineState.hold`) | 21 §10 |
| panel (:270) | radial `#181818 -> #090909` | + baked grain (128 px tile, SVG `feTurbulence` data URI, opacity .04, rasterised once by the browser, no CSS filter anywhere) + vignette layer; `--lamp` by `data-lamp` (1 / .7 / .25, 400 ms) on the state lamp before ACTIVE / NO INPUT / BYPASSED; tab lamps default `--lamp:0`, dim to 40 % while held | R7, R9 |
| strips | `Listen, Excite, Sensitivity, Touch`; heads 8 px | `LISTEN + Sensitivity | EXCITE + Touch`, heads with a hairline rule, strip 2 cell 84 -> 76 px | grouping |
| meter trough | `#262626` | `--track` | informational >= 3:1 |
| globals | `.body-globals` | + `.globals` on both docks (21 §1) | naming |
| reduced motion | none | CSS transitions off under `prefers-reduced-motion` | R7 |

### H2 behaviour
| item | before | after |
|---|---|---|
| reset keys | Delete on dials | Delete and Backspace on dial, morph slider, segmented groups and toggle buttons -> `data-init`; dblclick unchanged; 260 ms rim flash |
| `setDragging(bool)` | -- | counted (several pointers); first drag calls `this.motion?.pause?.(true)`, last release `pause(false)`; `panel[data-dragging]` |
| `selectLine(i)` | -- | index 0..2 or letter; field's ghost-click callback |
| Motion switch | `this.motion` was the mode string | mode in `motionPref` (query still forces Off); `this.motion` is free for the `MotionController`; `setMotion` also calls `this.motion?.setState?.(mode)` |
| telemetry endpoints | 7 (no `lineModes*`) | all 10; `lineState` reads 20 floats in spec order; `lineTel[l]` = `{wet, onset, listen, followHz, hold, rootHz, t60, sustainEff, dominant, engines[11], modes[16]}` (read by the field too) |
| loop wake-up | any non-zero lead float kept rAF alive | energies keep it alive; other values (rootHz, t60, engines, pitchConfidence) wake it once per change; steady telemetry lets it sleep (tested); watchdog zeroes in place once |
| weight bars | -- | `lineState<active>.engine0..10`; while all engines are 0 (no telemetry) `morphWeights()` of the morph position stands in |
| Hold / lamps | -- | Hold lit from `lineState.hold`; tab lamp dims while held; Follow dial lock lamp from `analysisViz.pitchConfidence` > .5 with Follow > 0 |
| `lineModes*` | not drawn | active line's 16 energies + `MODE_IDS[dominantBody]` go to `this.field?.setModes?.(energies, identities, line)` once per change, <= 30 Hz; also stored in `this.modeState`; handed over again on a tab switch |
| Listen / Excite hairlines | Listen only | + Excite: Through = `listenEnergy`, strikers = `onset` |
| under the caption | `HELD`, `FOLLOW ▸ note` | + `A3 · 0.90 s` (sounding note, T60 from `rootHz`, `t60`); `SHOW_SOUND_READOUT = false` if the field's caption shows it |
| audio -> field | -- | `this.motion?.notifyAudio?.(onsetLevel, wetLevel)` from the 30 Hz readout paint |

### H3 notes for the other workers and the lead
- `60_motion.js` writes `--lx/--ly` (pointer position, -1..1) onto its `light` element: pass the specular layer or the scene, **never** the panel or any ancestor of the controls (the panel root holds the static light `-.6 / -.8`).
- `MODE_IDS` (40_telemetry.js) is a generated copy of `bodies.json` `modes`; regenerate when recipes change (or move it into the generated block of `tools/build_ui.py`): `python3 -c "import json;b=json.load(open('plugin/bodies.json'));[print(json.dumps([0 if m is None else ['f',m['hz'],m['label']] if m['kind']=='feature' else ['r',m['ratio'],m['label']] for m in x['modes']],ensure_ascii=False,separators=(',',':'))) for x in b['bodies']]"` prints one row per body.
- `TUNE_NOTE_MAX` (10_control.js) mirrors `bodies.json` `tuneNoteRange` (Timpani 60); decay seconds still come from `DECAY_BASE` / `DECAY_RATIO` in the header, cross-checked by `build_ui.py`.

### H4 verification
`python3 tools/build_ui.py` on a scratch copy of `src/ui/` (also on the current repo parts incl. `15_silhouettes.js`, `60_motion.js`) · kit `ui_lint.py --strict` and branding `ui_lint.py --strict`: 0 errors, 0 warnings · eslint no-undef clean · extended smoke test `scratchpad/panel/uitest/smoke.mjs`: 93 checks (the 49 P1 checks with the endpoint count 7 -> 10, plus dial v2 geometry / states, Delete reset on all kinds, morph detents and bars, lamp states, grain, text and track contrast, typography, layout collisions, hooks, telemetry v2, loop sleep). Screens `docs/dev/screens/p6_panel_960.png`, `p6_panel_480.png`. Not verified: the real Amorph host.

### H5 Fertigmeldung (CLAUDE.md rule 7)
| point | status | place in the UI |
|---|---|---|
| Control v2: dial v2 geometry, crescent + rim, pressed / hover, fine ring, default tick, tracks >= 3:1, labels >= 4.5:1 | done | every dial: deck, strips 1-2, Mix / Width / Low Cut |
| Delete / Backspace reset, `touch-action:none`, typed editor (notes, seconds, dB, Hz, kHz) | done | focus a control and press Delete; click any value |
| segmented + toggle buttons with the same light model | done | Listen / Excite, Enable, Bypass, Hold, Copy, Motion |
| Morph hero: groove, growing detents, lit thumb, weight bars, hybrid bracket, Hold lamp | done | morph row (MORPH ... Hold) |
| Panel: typography pass, lamp states, grain + vignette, grouped strips, globals once, tab bar, Copy A->B/C | done | whole panel; lamp before the state word in the header |
| `setDragging(bool)`, `selectLine(i)` | done | view methods (no visible control) |
| Telemetry v2: 10 outputs, `lineModes*` -> field, Listen / Excite meters, Follow note, 30 Hz cap, idle loop | done | hairlines under Listen / Excite, line under the caption, tab lamps; markers wait for `field.setModes` |

## I. U7 scaling: final deviation list against 07_SCALING and the upstream contract (`50_scaling.js`, `60_motion.js`, `40_telemetry.js` kick)
Reviewed line by line against kit `docs/07_SCALING.md` (recipe, gotchas 1-2, §3 suspension, test checklist) and upstream `core-ui-contract.md` §5-§6 / `ui/fx.md` A.13 (upstream wins over the kit, kit rule 9). Section C above is the P1 state; this table is the final one.

### I1 against 07_SCALING
| item | 07 | here | reason |
|---|---|---|---|
| approach | option 2: fixed chassis + CSS `zoom` | same; `.body-panel` is the chassis, 960 x 600 = manifest `view` = `// WINDOW SIZE: 960x600` on line 2 of `plugin/index.js` (checked by `build_ui.py` and the smoke test), `view.resizable: true` | — |
| host CSS | `plugin-ui{display:flex;…;width:100%;height:100vh;min-width:0;min-height:0;overflow:hidden;background:transparent}` | `re-body-view{display:flex;justify-content:center;align-items:center;width:100%;height:100%;overflow:hidden;background:transparent}`; `100vh` -> `100%` (no vw / vh anywhere, lint `no-vw-vh`), the real px come from JS (next row); `min-*:0` dropped (the host is not a flex item) | kit rule 9, upstream |
| host size | gotcha 1: Amorph ignores `%` / `vh`; size the host in JS from `innerWidth` / `innerHeight` | same (`rescale`), inline px, compensated by the measured `eff` | — |
| effective scale | gotcha 2: probe `getBoundingClientRect().width / w`, bounds 0.3..3, compensate host and zoom, re-measure on resize and every ~250 ms | identical formula and bounds; the probe runs synchronously on mount, again at `setTimeout 0`, on every settle after a drag and every 250 ms (skipped while `resizing()`); a resize event itself only rewrites the two host sizes with the cached `eff` | 07 §3 "even with cached eff"; smoke test: a wrapper that renders the host at 0.9 gives `eff` 0.9, zoom 1.1, chassis fills the window; a later scale change without a resize event is found within 700 ms |
| zoom range / raster | `0.5..2.0` (first recipe), `0.4..2.5` (gotcha code); steps of 0.05 | `0.5..2.0`, 0.05 steps | D16 |
| `_doResize` | `ch.style.zoom = s; ch.style.transform = ''; this._chassisScale = s` | `panel.style.zoom = z` only: no transform is ever written, the scale is not stored (every geometry read uses `getBoundingClientRect`, which is zoom-aware; the code uses no `offset*` / `client*` for geometry, so the `currentCSSZoom` caveat does not apply) | — |
| wiring | window `resize` listener, synchronous first resize, optional `ResizeObserver` on the host or its parent (07 itself warns it must watch the wrapper, not `this`) | window listener and synchronous first resize; **no ResizeObserver** | upstream §6 "never use ResizeObserver"; `build_ui.py` and lint reject it; the smoke test counts constructions (0) |
| wrapper walk-up | once in `connectedCallback` | at every probe (4 Hz), plus the unscoped `::-webkit-scrollbar` / `*{scrollbar-width:none}` / `html,body{overflow:hidden}` rules as the first CSS | 07: "you need both", "the JS walk-up alone can be undone by a re-render"; tested with a wrapper that has `overflow:auto`, margin and padding |
| transparent host | `background:transparent` | CSS and inline `hs.background`; tested: around an off-aspect (1300 x 950) chassis the page background shows, no box, no scrollbars | 07 "visible background box" |
| chassis element | separate `.chassis` | the panel is the chassis | one element less |
| §3 suspension | `resizing()` = 180 ms since the last resize event; zoom deferred to a ~190 ms settle timer; canvas paints skipped; rAF bodies early-return; per event two style writes | all kept, made explicit because the field has 11 compositing layers: (1) per event only `lastResize`, `suspend(true)` and the two host style writes; (2) `kick()` schedules no frame while `resizing()` (it sets `stale`), `tick()` still returns early if a frame was already queued; (3) `MotionController.suspend(true)` cancels its pending frame, drops pointer input and freezes the drift clock; (4) no readout paint, no `d` rewrite, no meter write; (5) the 190 ms settle timer applies the zoom once, calls `suspend(false)` (one frame) and re-kicks the view loop when `stale`. No canvas exists. The brief's "250 ms settle" is the re-measure interval; the settle is the recipe's 190 ms (`SETTLE_MS`), the quiet time 180 ms (`RESIZE_QUIET_MS`) | 07 §3, smoke test (12 events 35 ms apart: 0 motion frames, 0 `d` writes, 0 rAF requests, zoom untouched; resume 190-210 ms after the last event) |
| `MotionController` option `isSuspended` (P6 field worker) | polled every frame (an idle rAF per frame) | replaced by `suspend(flag)` (no polling) | §3 "do nothing" |
| diagnostic readout | optional | not included | — |
| overlays | coordinate math under zoom | none; the value editor is in flow; the morph slider and the motion controller read `getBoundingClientRect()` directly | — |
| test checklist (7 items) | manual | 1 default size centred, no scrollbars; 2 shrink 700 x 600 -> 0.7, centred; 3 enlarge 1920 x 1200 -> clamp 2.0, 300 x 200 -> 0.5; 4 no overlays; 5 dial drag at zoom 0.5; 6 text sharp at 1.0: grid-aligned zoom steps; 7 1300 x 950 off-aspect: no box, no scrollbars | all in `tests/ui/smoke.mjs` |

### I2 against upstream core-ui contract (§5 layout, §6 canvas / animation)
| upstream | here | reason |
|---|---|---|
| `:host, .patch-root { display:block; width:100%; height:100%; overflow:hidden }` is "the ONLY correct form"; add the `patch-root` class | the class is added in `connectedCallback`; the rule is keyed on the tag selector (same element); `display:flex` (centres the fixed chassis), `width / height:100%` in CSS | 07 option 2 (D4) |
| "NEVER fixed px width / height on :host / .patch-root" | JS writes inline px (window size / `eff`) on the host; the chassis inside is fixed 960 x 600 | 07 gotcha 1: the host ignores `%` and `vh`; logged since P1 (section D) |
| first CSS rules reset sizing and scroll | verbatim first rules (`RAW_CSS`) | — |
| never `ResizeObserver`; no per-frame resize | none; per window event two style writes, the probe on settle and at 4 Hz | — |
| canvas backing size once | no canvas | — |
| pointer events | element level only; the single window-level listener is `resize` (07 requires it), spied in the smoke test on `window` and `document`; removed on teardown | — |
| `// WINDOW SIZE` on line 2 | yes, and it equals the manifest view | — |
| teardown | `stopScaling()` removes the listener and clears three timers, `stopField()` stops the motion controller (explicit call in `disconnectedCallback`, no longer a registered fake listener) | — |
Held unchanged: one ES module, no imports, light DOM (no `attachShadow`), no `backdrop-filter`, no vw / vh, selection disabled.

## J. P6 integration: merge and U6 (`15_silhouettes.js`, `20_field.js`, `30_panel.js`, `60_motion.js`, `90_export.js`, `tools/build_ui.py`)
### J1 merge of the three workers
| item | before | after |
|---|---|---|
| field patches in the panel | an inactive line's Morph / Tune / Enable did not redraw its ghost | `controlChanged`: Enable -> `refreshTabs()` + `touchField()`, Tune of any line -> `touchField()`, Listen -> `touchField()` (chain thread); `refreshMorph`: inactive line -> `touchField()` then return |
| teardown | the field registered a fake listener in `this.listeners` to be called by the teardown loop | `disconnectedCallback` calls `this.stopField?.()` and `this.clearUndo()` explicitly |
| fallback silhouettes | `FX_FALLBACK_Z`, `fxFallbackTemplates`, `TEMPLATE_OF` (8 drawings stand in) | deleted; `REBODY_TEMPLATES` (15_silhouettes.js) is the only source |
| `collapsed` helper | unused function in `15_silhouettes.js` | deleted (no behaviour change; eslint no-unused-vars clean) |
| depth data | literal z arrays in `15_silhouettes.js`, one value (Fiddle path 9: -420) differed from `plugin/bodies.json` zTable (+100, 22_BODIES §7 "scroll / pegs (8-9) +100") | `Z_TABLE` generated from `bodies.json` `zTable` into the header block; the silhouettes read it (one source, drift impossible) |
| generated tables | `MODE_IDS` (40_telemetry.js) and `TUNE_NOTE_MAX` (10_control.js) were hand copies of `bodies.json` | generated into the header block between `// BEGIN PARAMS (generated)` and `// END PARAMS` by `tools/build_ui.py` together with `Z_TABLE`; `--check` fails on drift; build dies when `bodies.json` is missing or malformed (11 bodies, 16 mode slots, `tuneNoteRange [36, top]`, 10 z values); `DECAY_BASE` / `DECAY_RATIO` stay hand tables with the existing cross-check |
| required parts | `build_ui.py` required 7 parts | also `15_silhouettes.js` and `60_motion.js` |
| flat P1 field | `<svg class="body-object">` placeholder and four `.body-object` CSS rules (replaced at runtime anyway) | removed; `.field` is created by `initField()`, its `data-contour`, `data-shape`, `data-morph`, `data-size` live on `.field` / its paths; `this.contourPaths` removed |
| sound readout | `SHOW_SOUND_READOUT` with a note "set false if the field's caption shows it" | the field's caption only ever shows the instrument name, so the telemetry line under it (`A3 · 0.90 s`, HELD, FOLLOW) is the one and only place: flag stays `true`; the smoke test counts exactly one occurrence in the view's text |
| layout | a second visible item in grid row 6 would open an implicit column | `.body-panel > * {grid-column:1}` |

### J2 U6 (21 §10)
| point | status | behaviour |
|---|---|---|
| chain thread | done | `fxChain()` in `20_field.js`: for line B and C, while `Listen = Chain` (6), one faint dotted quadratic arc (`stroke-dasharray 0.01 6` with round caps, fogged stroke of layer 3) in the ghost-near layer (no 12th layer, layer count stays 11) from the source line's silhouette edge facing the listener to the listener's edge facing the source: source ghost -> active body, active body -> ghost, ghost -> ghost; `data-from` / `data-to` name the lines; line A with Chain draws nothing (falls back to All, 20 §13); dimmer while the listening line is disabled; apex capped inside the field; `display="none"` and empty `d` otherwise; rewritten only when its signature (active line, Listen / Enable of B and C, morph, tune, ghost signatures) changes; pointer-events none |
| strip 2 MORE / LESS | done | button bottom right of row 6 (`[data-more]`, text LESS when expanded, MORE when collapsed, `aria-expanded`); collapsed = `hidden` on the three strip-2 line sets only, all controls stay in the DOM with their `data-param`; `applySets()` merges line-set and collapse state; UI-only (nothing is sent), stored in `localStorage` key `rebody.strip2` (`collapsed` / `expanded`, try / catch), default expanded; collapsing with focus inside strip 2 moves focus to the button, cancels the editor and open drags |
| Copy undo | done | `copyLine()` keeps `copySnap = { src, dst, values: 21 x [key, value] }` of the target before writing; an `UNDO` button (`[data-undo]`, 25 px high) appears in the copy group for 10 s (`UNDO_MS`), the `COPY` label hides while it shows (header budget; `.body-copy[data-undoable]`); UNDO writes the 21 values back through ordinary parameter events, one gesture each, resent even when equal; a second copy replaces the snapshot (one step); timer and snapshot are cleared on teardown |
| Enable >= 24 px | verified | Enable buttons 34 x 24 px, tab name buttons 26 x 24 px at the design size (smoke test) |
| keys 1 / 2 / 3 | done | keydown on the host element selects the tab, ignored with Ctrl / Alt / Meta and inside the editor input; the panel has `tabindex="-1"` (no outline) so a click on any empty area focuses it and the keys work without a focused control |

### J3 DOM and API contract after the merge (for the lead)
`.field` (perspective frame, `data-shape` / `data-morph` / `data-size`) > `.scene` > 11 `svg.layer[data-layer]`; contours are `path[data-contour="0..9"]`; chain paths `path.chain[data-chain="1|2"]` in `[data-layer="ghostNear"]`; panel hooks `view.motion` (MotionController: `start`, `stop`, `setState`, `pause`, `suspend`, `notifyAudio`, `snapshot`), `view.field.setModes`, `view.selectLine(i)`, `view.setStrip2Collapsed(flag)`, `view.copyLine(src, dst)` / `undoCopy()` / `clearUndo()`; storage keys `rebody.motion`, `rebody.strip2` (both UI-only per-viewer conveniences).

### J4 verification
`python3 tools/build_ui.py` and `--check` · kit `ui_lint.py --strict` and branding `ui_lint.py --strict` on `plugin/index.js`: 0 errors, 0 warnings · `node --check` · `check_sync.py plugin/dsp.cmajor plugin/index.js`: 73 / 73 · kit `manifest_check.py` on the patch · eslint (no-undef, no-unused-vars) clean · `node tests/ui/smoke.mjs` (see `tests/ui/README.md`): 194 checks, three consecutive runs 194/194 (about 3.3 min each, no flakes; one timing-sensitive comparison of a transition end state was made tolerant on the way) · screens `docs/dev/screens/p6_final_960.png`, `p6_final_480.png` (Clarinet, Calm, tilted, fake audio, B enabled and chained). Final module size 159,993 bytes in 2,254 lines (P1: 82,155 bytes). Not verified: the real Amorph host (WebKit / WebView2 `zoom`, `eff` probe, hidden-control probe, pointer delivery) and any DAW.

### J5 still open
Real-host probes (above); the ghost silhouettes and chain thread do not follow the tilt of their own depth exactly (the thread sits in layer 3 while a far ghost sits in layer 2: a few px of parallax difference, deliberate); `DECAY_BASE` / `DECAY_RATIO` are still hand tables (cross-checked, not generated); Motion Calm and Full differ only in tilt cap and idle drift (21 §3).

### J6 Fertigmeldung (CLAUDE.md rule 7): each commissioned point, status, place in the UI
| point | status | place in the UI |
|---|---|---|
| merge: three `30_panel.js` patches, explicit `stopField`, fallback block deleted, `collapsed` helper deleted, sound readout once, generated `MODE_IDS` / `TUNE_NOTE_MAX` (+ `Z_TABLE`) | done | field ghosts react to B / C Morph, Tune, Enable; line under the caption; module build |
| chain thread | done | field, layer 3: dotted arc between the silhouettes while a line's Listen = Chain (set Listen of B or C to Chain) |
| strip 2 MORE / LESS | done | button at the bottom right of the panel; Position ... Reed row |
| Copy A->B/C undo (21 values, 10 s) | done | header: UNDO button right of the copy buttons after a copy |
| Enable >= 24 px | verified | header tabs |
| keys 1 / 2 / 3 | done, verified | whole panel (focus anywhere inside it) |
| U7 review against 07 and upstream, section I | done | this file, section I; scaling is invisible except at resize |
| §3 suspension (motion controller paused, no field redraw while resizing, resume after the settle) | done | window resize drag: field and meters freeze, then catch up once |
| `// WINDOW SIZE: 960x600` on line 2, manifest matches | verified | `plugin/index.js` line 2, `plugin/RE_BODY.cmajorpatch` view |
| `tests/ui/smoke.mjs` + README, 3 runs | done | `tests/ui/` |
| lints, screenshots | done | J4 |
