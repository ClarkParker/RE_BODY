# 00 - Host test and spike for the final build (to be run by the owner on Amorph, results recorded here)

Purpose: verify on the real host what no cloud session can (decisions D33, D42): compile, the two probes, hidden controls, pointer and endpoint delivery, WebKit / WebView2 behaviour of the depth field, what the instrument sounds like, and the CPU in a DAW. Everything else is already green offline (`docs/dev/08_STATUS.md`). Fill the results table at the end as you go (a line per item is enough); notes in German are fine.

## Hand-over line (kit rule 4: repo, branch, folder, never a ZIP)
**Repository `ClarkParker/RE_BODY`, branch `claude/gallant-mendel-xg901g`, folder `plugin/` (files `RE_BODY.cmajorpatch`, `dsp.cmajor`, `index.js`; built from `src/`, do not edit by hand).** Check that the checkout is on that branch and not on `main`; the manifest must read `"version": "0.9.0"`. Send the results back by filling the table below in this file (or paste it into chat) and say "host test done".

## Steps (Amorph FX; MCP loop or the Build tab)

### 1. Create the project and paste the files
1. `get_host_status`, then `create_project` "RE_BODY".
2. Manifest fields, exactly as in `plugin/RE_BODY.cmajorpatch` (copy, do not retype; raw UTF-8, no escapes): name `RE·BODY` (middle dot U+00B7), ID `com.clearpeak.rebody` (no underscore, D41), version `0.9.0`, manufacturer `CLΞΛRPΞΛK` (Greek Ξ U+039E and Λ U+039B), category `effect`, `isInstrument` false, source `dsp.cmajor`, view `index.js`, **960 x 600, resizable true**. Check afterwards that the host shows the name with the dot and the manufacturer unmangled.
3. Paste `plugin/dsp.cmajor` (7,386 lines, 357 KB) and `plugin/index.js` (2,254 lines, 160 KB; line 2 is `// WINDOW SIZE: 960x600`). If the host or the edit tool refuses a paste of this size, note the limit and the message, and use chunked `edit_lines` / `generate_code`; the size is not a design limit (the upstream 8,000-character figure is a paste-flow budget).

### 2. Compile and pass-through
1. `get_error` must be none. **Record the compile time** the host shows (offline JIT: 1.5 .. 3 s; state about 205 k floats in three `struct Line`, Cmajor issue #94 check) and any warning text.
2. Play any stereo audio: defaults are Mix 45, Bypass Off, Line A on (Clarinet), B and C off. Mix 0 must be the dry input, Mix 100 wet only, Bypass On dry. Silence in gives silence out.

### 3. `run_qa_probe`
Record the full result (RMS, peak, NaN / Inf, silence, clipping, DC, stereo correlation and width, phase cancel). Expected: green (offline: finite for every anchor and rate, DC far below the 0.01 limit, silence in exactly silence out). If it complains about stereo width or correlation, note it: the default Clarinet is dual-mono on a mono input by design (Width 50 = BODY's image).

### 4. `run_ui_probe` (the hidden-control question, D39)
Lines B and C controls live in the DOM inside `hidden` tab panels, and the strip-2 MORE / LESS button hides the contact, body and physics rows (`hidden`, all `data-param` stay in the DOM). **Record whether the probe reports hidden or zero-geometry controls, and the exact text.**
- Probe silent about them (or only an informational line): the tabs stay (D39).
- Probe fails on hidden controls: the fallback is the compact always-visible strip for B and C instead of tabs (D39, plan risk table); tell the lead, nothing else changes.
Also record anything it says about the 73 `data-param` ids, geometry, subscribed endpoints (10 declared) or the echo behaviour.

### 5. Controls, automation and telemetry delivery
1. Switch the tabs A / B / C (and keys 1 / 2 / 3), enable B, move dials, type values (click a value), Delete resets a control, Morph slider across all 11 anchors. Parameters must follow DAW automation both ways without echo or jumping.
2. Telemetry: with audio running the IN and WET meters, the 8 band bars, the onset lamp, the Listen hairlines, the tab lamps and the weight bars above the Morph row must move; the caption line `A3 · 0.90 s` and the state word (ACTIVE / NO INPUT / BYPASSED) must change. All 10 outputs (`bodyViz`, `bodyBands`, `bodyOnset`, `analysisViz`, `lineStateA/B/C`, `lineModesA/B/C`) are subscribed; note any that stay dead. This is the only check of the event rate (about 30 Hz) and ranges.

### 6. Listening checklist per anchor
Use Line A alone, Excite Through, defaults (Tune 58, Decay 50, Material 50), a short pitched or percussive input (drum loop, plucked guitar, vocal) and pink noise. Expected character from `docs/concept/22_BODIES.md`; mark OK or write what is wrong (too quiet, wrong pitch, harsh, dead, clicks).

| # | anchor | expected character | result |
|---|---|---|---|
| 0 | Bass Drum | round shell boom around 74 Hz at Tune 58 (Tune is size here), slightly beating head, T60 about 0.36 s at Decay 50; Material 100 = tight ringing head | |
| 1 | Snare | shell 450 Hz / 1.1 kHz plus noisy rattle that follows hits and sustained input, silent for silent input, T60 about 0.28 s | |
| 2 | Timpani | pitched drum, Tune = note (dial greys above C4), body at the Tune note, kettle hum near 160 Hz, T60 about 1.4 s at Decay 50, short damped thump, small upward pitch glide on hard hits | |
| 3 | Piano | hammer and a detuned string pair (slow beating), soundboard cloud with low modes 84 .. 301 Hz, bright hammer | |
| 4 | Guitar | plucked string, pick-position comb, wooden box resonances near 103 / 205 Hz, a dip between them | |
| 5 | Ukulele | short bright string (BODY's), small box near 230 / 290 Hz, T60 short (0.07 s x 12^d) | |
| 6 | Fiddle | sustained string tone from the input (no bow model), nasal bridge-hill brightness 1.8 .. 4 kHz | |
| 7 | Clarinet (default) | hollow odd-harmonic bore, radiation roll-off above about 1.4 kHz, pitch at the Tune note | |
| 8 | Oboe | nasal formant cluster 1.1 .. 3.2 kHz, reed edge, no waveguide | |
| 9 | Sax | full harmonic series, brass resonances 780 / 1750 Hz, breath noise, darker radiation above 1 kHz | |
| 10 | Obosaxolele | the three at once (ukulele pluck into oboe reed into sax bell); the segment 9 -> 10 morphs smoothly; its 2 kHz ring is shorter than BODY's (known, `08_STATUS.md` §4) | |
| - | Morph sweep 0 -> 10 on sustained input | no clicks, tails keep ringing across the stops | |
| - | physics knobs (strip 2) | Position, Bright, Body, Stretch, Stiffness, Coupling, Air, Reed each audibly change the sound; note any that do nothing at an anchor (known inert lower halves: Clarinet Air, Oboe Air, Ukulele Stiffness below 50) | |

### 7. Three-line test
1. Input: a drum loop. Line A stays Clarinet / Through. **Enable B** (Bass Drum, Listen Transient by default), set **Excite Hammer**, Blend 0 then 50: one thump per hit, no double triggers, softer hits softer (Touch shapes the curve); Blend 100 = the audio itself excites the body.
2. Input: a pad. **Enable C** (Piano, Listen Sustain by default), Excite Through: the pad rings through the board; B silent on a pad (no transients).
3. A, B and C together on a full mix: Pan per line, Level per line, Width, Low Cut; the output must not pump or clip (protector reduction offline: -0.45 dB), no runaway after stopping the input. Note the DAW CPU meter.

### 8. Chain, Hold, Follow, Blend quick tests
- **Chain**: set B Listen to Chain (last button): B is excited by A's body output; the dotted thread between the silhouettes appears. Switch A Enable off: B must keep sounding while A is silent in the mix (A is still computed). Line A with Chain behaves as All.
- **Hold** on A with a short hit: the body resonance freezes (T60 about 45 s, lamp lit, caption HELD), strings and bores ring out naturally; release without a click; Hold on silence = Armed (lamp not lit yet), the next excitation is captured for about 200 ms, then frozen; save and reload the project with Hold on: not silent. Tune, Material and Size do not move a frozen body.
- **Follow** on A at 100 with a monophonic melody (voice or bass): the body retunes to the played notes within about 100 ms, caption `FOLLOW ▸ note`, lock lamp lights; Follow 0 is the Tune knob again; no zipper noise in the glide.
- **Blend** (with Excite Hammer, Pluck or Breath): 0 = striker only (input not injected), 50 = half and half, 100 = Through only; switching Excite or moving Blend is click-free.

### 9. Motion Off / Calm / Full in the DAW (pointer delivery, frame feel)
1. Move the pointer over the panel with Motion **Calm** (default, tilt 1.5 degrees, motion follows audio) and **Full** (tilt 4 degrees plus idle drift of about 1 degree): record whether `pointermove` / hover reaches the view inside the DAW. **Off** = static depth. The depth must read in all three states (light, rim, fog, shadow).
2. With no pointer movement, Calm must still move with the audio (vibration on at most three layers, 30 Hz). Switch the OS to "reduce motion": Motion must be forced Off.
3. Frame feel: smooth tilt and meters, no stutter while dragging dials or while the DAW plays; note dropped frames or lag of the DAW's own UI.

### 10. Resize 50 % and 200 %
Resize the plug-in window to half (480 x 300, or the smallest size the host allows) and double (1920 x 1200) and an off-aspect size (for example 1300 x 950): the chassis scales (zoom 0.5 .. 2.0), is centred, no scrollbars, no box around it, text stays readable, dials and the Morph slider still hit correctly. During a drag the field and meters freeze and catch up once after about 200 ms (resize suspension, `02_UI_DEVIATIONS.md` §I). Note any size where the scale is wrong or flickers.

### 11. WebKit (macOS) specifics (on Windows: the same checks in WebView2)
- **Stroke weight across layers**: the contours, strings and fittings sit on 11 layers at different depths; hairlines must not vanish or turn thick on some layers; compare front and rear layers at zoom 1.0 and 2.0.
- **Hit-testing through `preserve-3d`**: click an inactive line's ghost silhouette (it selects that line); clicks anywhere on the controls must never be eaten by the field; the instrument centre must not be a hit target.
- **Perspective x zoom**: the depth looks the same at zoom 0.5 / 1 / 2, nothing is clipped at the field edges, no blur of text and dials at the grid-aligned zoom steps, grain and vignette stay unchanged.
- The `eff` probe: the chassis fills the window exactly (no gap, no overflow) in the plug-in window and when the window is moved to another display scale.

### 12. CPU in the DAW (48 and 96 kHz, one and three lines)
Read the DAW's per-plug-in meter (or Amorph's own) with continuous pink noise or a full mix at -20 dBFS RMS, UI open, all lines at defaults (A Clarinet; B Bass Drum Transient; C Piano Sustain). Offline reference (`cmaj render`, % of one core, `09_CPU.md`): 48 kHz 1.8 % / 4.4 %, 96 kHz 3.5 % / 10.2 % (target note 8 %, not a ceiling, D9). Then **stop the input** (burst, then silence): the meter must fall to the idle level within a few seconds (denormal check). Optionally set Follow 100 and Excite Breath on all three lines (offline 7.2 % at 48 kHz, 11.2 % at 96 kHz).

### 13. Environment
Note DAW and version, OS, CPU model, Amorph version, WebView engine (WebKit or WebView2), sample rate, buffer size.

## Results (fill in)

| item | expected | result |
|---|---|---|
| 1 manifest and project (name with dot, manufacturer, ID, 960 x 600) | shown unmangled | |
| 1 paste of dsp.cmajor and index.js | accepted | |
| 2 compile time / errors / warnings | `get_error` none, about 1.5 .. 3 s | |
| 2 audio pass-through (Mix 0, Mix 100, Bypass, silence) | dry / wet only / dry / silence | |
| 3 run_qa_probe | green | |
| 4 run_ui_probe (hidden controls: tabs or fallback strip, D39) | no hidden-control complaint | |
| 5 parameters, automation, echo | both ways, no echo | |
| 5 output events delivered (10 outputs) | all alive at about 30 Hz | |
| 6 listening pass, anchors 0 .. 10 | notes per row above | |
| 7 three-line test | clean, no pumping | |
| 8 Chain / Hold / Follow / Blend | as described | |
| 9 pointermove delivered (Calm, Full) | yes | |
| 9 Motion Off / Calm / Full, audio motion, reduced motion | as described | |
| 9 frame feel | smooth | |
| 10 resize 50 % / 200 % / off-aspect | scales, centred, no scrollbars | |
| 11 stroke weight across layers | even | |
| 11 hit-testing through preserve-3d | ghosts select lines, controls never blocked | |
| 11 perspective x zoom | stable at 0.5 / 1 / 2 | |
| 12 CPU 48 kHz: 1 line / 3 lines | about 1.8 % / 4.4 % | |
| 12 CPU 96 kHz: 1 line / 3 lines | about 3.5 % / 10.2 % | |
| 12 burst, then silence | falls to idle in seconds | |
| 13 environment | | |
