# LALAFY — summary for reuse decision (written 2026-10-15)

Path aliases. **R** = /home/user/lalafy-cmajor (git, branch claude/gallant-mendel-xg901g, HEAD b6ee674 "v0.84.0").
**Z** = $S/lalafy_full/LALAFY_v0.83.1_full (extracted zip). **E** = $S/lalafy/LALAFY/LALAFY_v0.83.2_full (compiled web export).
**ROOT** = $S/lalafy/LALAFY. $S = $SCRATCH.
Line refs are in R unless prefixed. Docs are German; code comments English. Nothing from the archive was executed
(only unzip, grep, text extraction with `python3 -I`); I did run R's own `node src/g2p/g2p-en.test.js` (30 passed, 0 failed).

## 1. What LALAFY is, and which source is primary
LALAFY is a Cmajor/JS plugin (VST3/AU via the Amorph host) meant as a singing/speaking voice synthesizer: a source-filter
model (Rosenberg glottal pulse + aspiration noise -> 4 parallel formant bandpasses) with a Three.js 3D-head UI planned
(ICT-FaceKit). Today it is a "Vowel EQ" contest effect (formant bank on input audio) extended with an additive,
default-bypassed voice-source stage (CONTEXT.md:3-57, ADR-0001/0010, dsp.cmajor:1-42). Only DSP + a 13-dial SVG UI exist
as working code; the 3D head is a separate v0.80 mockup in `reference/ui-v080/`, not wired to audio.

**Primary source decision (three lines of development, not two):**
- **R (v0.84.0, 2026-06-06) = primary for readable source + docs.** diff -rq vs Z: no file exists only in Z; R adds
  CHANGELOG.md, ADR-0011..0016, `reference/{REFERENCES.md,ui-v080,vendor}`, full git history; R's dsp.cmajor/UI/patch/
  DSP_RESEARCH/HANDOFF/SESSION_LOG are newer. Z = v0.83.1 = strict ancestor in files, BUT see divergence below.
- **Divergence Z vs R:** Z's "Session 07" (Z SESSION_LOG:7-59) added `sourceGain=0.35` headroom trim + SR-compensated DC blocker.
  R's lineage never got those (its own "Session 07" is a different entry, SESSION_LOG:79-116; the two logs collide on the
  name). R v0.84.0 replaced the DC blocker by a flow derivative and uses `glottalSourceGain=0.08` (dsp.cmajor:133) —
  level over the F0 range was NOT re-measured (see §2/§7).
- **E (manifest "0.89.0", UI header 2026-06-14, file mtime Jun 19) is the NEWEST functional state but compiled-only.**
  `E/LalafyUI.js` (577 lines) + `E/cmaj_Lalafy.js` (WASM+JS wrapper, 159 KB). Its DSP source `dsp.cmajor`, `src/speak/*`,
  ADR-0017 and Spec v1.3 are in NEITHER R nor Z (grep-confirmed). E's folder name "v0.83.2" contradicts its manifest.
  E differs from R: `isInstrument:true`, new `midiIn` event input + `noteTrigger` float event output, param4 renamed
  "Voice Level" (init 0.8, no more dry/wet), param13 "Reuse" (init 0; 1 = vocoder), new param14 "Dynamics" (init 1;
  "gates on input"), SPEAK row in UI (E/LalafyUI.js:146-~245, 443). (E/cmaj_Lalafy.js:27-38, 196-230.)
- Rule applied: newest wins -> use **R for all source/docs/ADRs**, and treat **E as a spec of where the project went**
  (features v0.85-v0.89) whose DSP would have to be re-derived; ask the owner for the missing branch/commits if needed.
- Other ROOT items (not read in depth, listed for completeness): LALAFY.zip/Phase_Kit1_2.zip/LALAFY_PROJECT_v0.81_r5.zip
  (older phase-1 kits, same docs as ROOT *.md), `lalafyv0.83.1.bundle` (head 0f1d405 NOT in R; = Z lineage),
  `lalafycmajor.bundle` (= R's 15e90b4), wavs (by filename: espeak/piper/lalafy_*/VOCODE_* comparison renders), lalafy_v0xx.html mockups, TEST/, zBackups/ (empty).

## 2. Version state
- **Latest in R: 0.84.0** (Lalafy.cmajorpatch:4; dsp.cmajor:4; LalafyUI.js header; CHANGELOG.md:9). Latest anywhere: 0.89.0 (E, compiled).
- **Verified (cmaj v1.0.3159, offline `render`):** CHANGELOG.md:22-24, SESSION_LOG:17-21 — compiles clean; default+noise -1.4 dB
  (old Chamberlin -1.5 dB); default+silence fully silent; Source Mix=0 -> voice -6.3 dB, autocorr 220.2 Hz = A3 for F0=57 st
  (0.1 % err). Earlier: M1 v0.82 compile+render (SESSION_LOG:144-153); Z v0.83.1 default path byte-identical to original (cmp).
- **UNVERIFIED / not recorded anywhere:**
  1. By-ear sign-off in Amorph or the WebAudio bundle (SESSION_LOG:36-38; HANDOFF.md:63-68). `.amorph` export never produced,
     format unspecified (Z SESSION_LOG:39-40,47 says only the IDE can export).
  2. Loudness/clipping across F0 36..84 st with the v0.84 gain (ADR-0012:49-51 demands it; only F0=57 st was measured). Z's
     measurement of the OLD chain: pure synth peaked +7..+12 dBFS over A2-G5 (Z SESSION_LOG:19-22) — high-Q bank on harmonic source.
  3. Aliasing after derivative + 2x OS (ADR-0012:47-48), exact-tuning sweep (ADR-0011:58-60), jitter SR-invariance 44.1/48/96 (ADR-0013:62-64).
  4. Git history marks ab51d37 "[UNVERIFIED]" (superseded by b6ee674). No CI, no persistent compiler (HANDOFF.md:37-57, ~10 min build).
- **Stale status labels:** ADR-0011/0012/0013 headers still say "Umsetzung + cmaj-Verify ausstehend" (0011:8-10, 0012:10, 0013:9-11)
  though implemented in 0.84.0; STRATEGY.md:41 M0 "Verify offen"; ADR-0010:51-52 "Verify offen"; HANDOFF.md:1 says v0.83.0/4x OS;
  AMORPH_CONVENTIONS.md:75-77 TODO "adopt 4x" (now 2x).
- **Open milestones (STRATEGY.md:39-49):** M1.5 done (not in table). M2 SPEAK (EN G2P -> ARPABET -> vowel targets, fixed-rate
  sequencer, RMS envelope, dry/wet) — in R only g2p-en.js + tests exist, unwired; E shows it implemented JS-side. M3 analysis suite in
  Cmajor (YIN pitch, spectral-flux onset, CQT chroma, formants; ADR-0004) — not in R. M4 SOLO + pitch modes + melisma; M5 phoneme
  triggers (host-sync/onset/pitch); M6 CHOIR polyphony (= full demo); M7 reuse modes a/c/d; M8+ PCA voices, ICT-FaceKit visemes,
  plugin wrap. Also pending: LF glottal model (ADR-0012:45-46, DSP_RESEARCH:14), CMUdict as main lexicon (:35), Hillenbrand
  female/child formants (:59), HANDOFF next steps 1-4 (compile in Amorph, tune by ear, .amorph export, then M2).

## 3. DSP architecture (R src/Lalafy/dsp.cmajor, 416 lines, no imports, no std:: — only intrinsics tan/sin/cos/pow/tanh/exp/floor)
**Graph:** `graph VowelEffect [[main]]` (376-415) wraps `node core = VowelEffectCore * 2` (395) = 2x per-node oversampling
(Cmajor sinc-interpolates streams; events pass through; inside core `processor.frequency` = 2x rate, so all coefficients scale).
Annotations are mirrored by hand on graph (381-393) and core (51-65) — must be kept in sync (HANDOFF.md:70-72).
**Processors:** only one: `processor VowelEffectCore` (44-360). No namespaces, no sub-processors, no meters.
**Endpoints:** `input stream float<2> in` (46,378), `output stream float<2> out` (47,379), 13 `input event float paramN` (51-65).
No MIDI input, no event/stream outputs, no transport, no sidechain (E adds midiIn + noteTrigger). Voice source is mono, copied
to L/R (303-304); filters run per channel (8 SVF states, 141-142). Continuous drone: no note gating yet (HANDOFF "known behavior").
Declaration order is frozen: param1,2,3,5,4,6..13 (PARAM_CONTRACT.md:6-8); param5 is named "Pitch" but is a formant shift.

| id | name | type/range | init | controls (code) |
|---|---|---|---|---|
| param1 | Vowel Morph | float 0..4 | 0 | position across a,e,i,o,u; linear interp of F/Q/amp tables (312-315,326-329,341-344) |
| param2 | Brightness | 0.5..2.0 | 1.0 | boosts amps of F2/F3/F4 (324,342-344) |
| param3 | Resonance | 3.5..20 | 8 | scales all formant Q by /8 (325-329) |
| param5 | "Pitch" | 0.5..2.0 | 1.0 | formant shift: multiplies F1-F4 (317-322) — NOT pitch |
| param4 | Dry/Wet | 0..1 | 0.5 | `out = in + mix*(wet-in)` linear (353-354); dry is ALWAYS the live input |
| param6 | Soft Clip | 0..1 | 0 | tanh blend on wet, identity at 0 (177-182,350-351) |
| param7 | F0 | 36..84 st (MIDI) | 57 | `440*2^((s-69)/12)` (273); clamp 20 Hz..0.45*sr (275) |
| param8 | Vibrato Depth | 0..1 | 0 | +-1 semitone at 1.0 (265) |
| param9 | Vibrato Rate | 0..1 | 0.4 | 3 + v*5 Hz (261) |
| param10 | Jitter | 0..1 | 0 | up to 30 cents, smoothed LCG noise (267-270) |
| param11 | Tension | 0..1 | 0.5 | Rosenberg Tp/Tn via lerp3: Tp .45/.40/.34, Tn .35/.16/.10 (278-279) |
| param12 | Breath | 0..1 | 0.15 | constant-power glottal<->noise crossfade (298-300) |
| param13 | Source Mix | 0..1 | 1.0 | 1.0 = 100 % input into formants (classic Vowel EQ); 0 = pure synth (303-304) |
Every param goes through a 20 ms one-pole smoother, alpha computed once before the loop (controlSmoothTimeSec 131, 226, 235-247).
Defaults reproduce the original contest patch (bypass by Source Mix=1, Soft Clip=0; ADR-0010) — but the source stage is still
computed every sample (259-304 has no bypass branch).

**Key algorithms**
- Glottal source: Rosenberg model B, `g=0.5(1-cos(pi*ph/Tp))` open, `cos(pi*(ph-Tp)/(2Tn))` close, 0 closed (277-289); float64 phase
  (145,287-289). Output = flow *derivative* `(g-glottalPrev)/phaseStep` (291-295; ADR-0012) = lip radiation + DC removal, level
  independent of F0; fixed gain 0.08 (133,300).
- Vocal tract: 4 parallel TPT/Cytomic SVF bandpasses (136-139, 186-206; ADR-0011), tan prewarp, Q clamp 0.2..24, cutoff clamp
  0.49*sr; Hillenbrand 1995 adult-male F1-F4 + per-vowel Q and amp tables (114-127); table lerp `getInterpolatedFormant` (208-219);
  BPF outputs summed with amp weights (341-347). Slow +-1 % formant "drift" LFO at 0.15 Hz (307-317). Formants are PARALLEL, not Klatt cascade.
- Noise: integer LCG, Numerical-Recipes constants, int64 mod 2^32 (147,170-174; ADR-0013 says uint32 — code differs); white, not
  pulse-synchronous; used for jitter AND aspiration (268,300).
- Vibrato/jitter: sin LFO phase float64 (260-265); jitter = LCG noise one-pole smoothed with SR-correct `jitterAlpha` (227,269);
  both modulate f0hz via 2 `pow()` per sample (273-274).
- Oversampling: 2x graph wrapper only (395); ADR-0011 argued 4x->2x is enough with exact TPT tuning (362-374).
- Soft clip: `x + amt*(tanh(x*d)/tanh(d) - x)`, d=1+9*amt (177-182).
- g2p / phoneme sequencing: NOT in the DSP. JS only: `src/g2p/g2p-en.js` (184 lines, 7.9 KB, UMD, no deps): ~40-word exception dict
  (31-76) + letter-to-sound rules (78-96) + magic-e (100-143) -> ARPABET w/o stress (wordToPhonemes 145, textToPhonemes 159);
  test file 99 lines, 30/30 pass. Sequencer + phoneme->vowel-morph mapping only exist in E's UI (E/LalafyUI.js:195 MORPH table
  AA/AH/AE/AW/AY/ER=0, EH/EY=1, IY/IH=2, OH/OW/AO/OY=3, UW/UH=4; :214 createSequencer; consonants are ignored — only vowels
  drive param1). Planned per ADR-0002/0004: modes = source-mixer configs, analysis in Cmajor (none implemented).
- Not present: LF model, pitch/onset analysis, MIDI, polyphony, meters, per-voice state, denormal guards, bypass of idle source.

## 4. UI architecture
- `src/Lalafy/LalafyUI.js`, 351 lines / 16.2 KB (R). **Light-DOM custom element** `lalafy-ui` (216, 345) + exported
  `createPatchView(patchConnection)` (347); **SVG dials** (class `Dial` 117-214: 270-degree arc path + needle, pointer-drag 200 px = full
  range, wheel, dblclick = reset to init); CSS in a template string (76-115); no canvas, no Three.js, no libs, no imports (Amorph single-file rule).
- Layout: stage 760x440 closed / 760x660 open (61-64; manifest Lalafy.cmajorpatch:11-16 width 760 height 440 resizable). Central Vowel dial 160 px
  + pentagon of 5 "petal" dials (67-74) = param2,5,4,6,3; double-click on badge unfolds the voice-source row (param7-13) (easter egg, ADR-0010);
  open state in localStorage `lalafy.sourceOpen` (64,260,303,310). Resize = CSS `zoom` clamp 0.4..2.0 in 0.05 steps via ResizeObserver (326-342).
- Patch contract used: ONLY params. `sendEventOrValue` (wrapped for echo guard 238-247, `_send` 315), `addParameterListener`/`removeParameterListener`
  (255-256), `requestParameterValue` (257). No `addEndpointListener`, no MIDI, no meters. Echo guard = value cache + 48-entry ring buffer + per-pid
  drag lock (317-324). Teardown in `disconnectedCallback` (264-269).
- `src/Lalafy/LalafyView.js`, 129 lines: STUB adapter (ADR-0009) for the unchanged v0.80 3D mockup; `_mountMockup` only renders a placeholder (95-103);
  BINDINGS table (22-39) has one active entry (`.drywet`->param4). Not referenced by the patch manifest.
- 3D head mockup (`reference/ui-v080/`, 16 files, 388 KB; 13 JS modules ~2.0k lines + 64 KB CSS + 179 KB standalone HTML): Three.js r128 + GSAP 3.13 from
  CDN (index.html:525-528), procedural low-poly head + Fresnel halo (02-head-mesh.js:1-10), visemes (03), 4-state motion machine (04), saccades/blinks (05),
  spotlight/morph HUD (10,11). Phase-2 plan: swap in ICT-FaceKit mesh (ADR-0015). Not audio-connected.
- E's UI v0.89.0 (577 lines) adds: SPEAK row (text field, RATE/NOTE modes; `addEndpointListener('noteTrigger')` E:490), inlined g2p+sequencer (146-~245),
  `touch-action:none` on dials (E:98-100, fixes pointercancel mid-drag), guarded `customElements.define` (E:573), `data-endpoint-id` hook for the Amorph IDE (E:254).

## 5. Research docs (ROOT/*.md unless noted)
- DSP_RESEARCH.md (77 l; R `docs/DSP_RESEARCH.md` is the newer 106-line superset): licensed techniques per stage (LF glottal model, Pink Trombone/Voc, CMUdict, YIN/MPM, Hillenbrand
  female/child) + Session-07 code review (TPT SVF, GFD, LCG, klatt-syn). **Reusable: yes** (generic voice-synthesis shortlist with licenses).
- HUD_LAYER_RESEARCH_v1.md (385 l): how HUD layers are grouped (Fagerholt 4-type model, aviation/games/CSS sources). Reusable only as UI-design background.
- HUD_FILLER_REVEAL_RESEARCH_v2.md (538 l): decorative filler layers (radial/conic gradients, clip-path, backdrop-filter) + spotlight "reveal" / progressive disclosure CSS. Reusable as CSS recipes, medium-low.
- LIGHTING_RESEARCH_v1.md (400 l): fake-lighting style master (edge light, rim, frosted glass, falloff, specular, haze) as CSS conventions. Reusable as a style recipe; LALAFY look.
- LALAFY_SPEC_v1.2.md (305 l): product spec — FX plugin analysing input then singing text; 4 modes, analysis list (YIN/RMS/flux/CQT/LPC), reuse modes, pitch/phoneme modes, 4 voices, phases 1-5.
  LALAFY-specific; §12 source->mixer->4xSVF engine is the only reusable idea. (Spec v1.3 referenced by E does not exist in the archive; v1.1 is superseded.)
- LALAFY_UI_KONZEPT_v043_FINAL.md (382 l): "morphing UI" principle, 12 layers, tiers, spotlight, retro look, perf budget (<=200 Three.js lines, <=15 translateZ layers, <100 KB UI, 16 ms). LALAFY-specific; perf budget generic.
- LALAFY_UI_TAXONOMIE_v1.md (272 l): faceted (3-axis) classification of UI elements. Method generic, content LALAFY-only.
- LALAFY_ELEMENT_KATALOG_v048.md (234 l): Z-axis inventory of the 3D cockpit elements + depth problems. Not reusable.
- Repo-only docs worth knowing: ARCHITEKTUR_KONZEPT_v1 (signal-flow, partly superseded: banner l.6), MATERIAL_INDEX_v1 (inventory of the 4 phase-1/toolkit packages incl. Cmajor Plugin Dev Toolkit, mattpocock skills, karpathy),
  AMORPH_CONVENTIONS.md (Abyssify graph/params/UI bridge patterns), ADR-0001..0016 (decisions; 0007 param table, 0008 Rosenberg pseudocode, 0010 frozen contract, 0016 header/versioning).

## 6. Reusable building blocks for a resonant instrument *body* plugin (all Cmajor in R unless stated; no external deps)
| # | Block | Where | Note (cost / deps) |
|---|---|---|---|
| 1 | TPT/Cytomic SVF bandpass + `SVFState` | dsp.cmajor:136-139,186-206 | Pure math, stable under fast modulation. Calls `tan()` every sample per filter (8/sample) — cache g/a1-a3 at control rate for N modes. Output `v1` looks un-normalised (peak ~Q, my reading) -> needs per-mode gain (cf. amps 341-344). |
| 2 | Parallel resonator bank driven by morphable mode tables (freq/Q/amp) | 114-127, 208-219, 312-347 | Directly generalisable to "body presets" (guitar/violin/etc. as mode tables) and morph position (param1). 12 table lerps/sample (floor each): move to control rate. |
| 3 | Body-size / damping / tilt macros | 317-329, 342-344 | formantShift = global mode-frequency scale (size), Resonance = global Q scale (damping), Brightness = upper-mode gain tilt. Cheap, musically useful, keep. |
| 4 | "Living" drift on all resonances | 307-317 | 0.15 Hz sin, +-1 % — one sin/sample; trivial to reuse for body wobble. |
| 5 | Rosenberg-B glottal pulse + flow-derivative excitation | 277-295 (+160-166 lerp3) | 1 cos/sample; tension->(Tp,Tn). Good as pitched excitation (bow/reed/voice). Aliasing masked only by 2x OS, never measured. float64 phase (145). |
| 6 | LCG noise + constant-power tonal/noise crossfade | 168-174, 297-300 | Tiny cost. White only, not synced to pulse; add shaping for bow/breath textures. |
| 7 | Excitation-vs-external-input mixer | 302-304 | Core trick for "body as resonator for incoming audio" (Source Mix=1 is exactly that); E's Reuse param generalises it. |
| 8 | Vibrato + jitter F0 modulation | 260-275 | 2 `pow()` per sample at 2x rate — replace with exp-of-sum or control-rate update. SR-correct smoothing pattern at 227,269 is reusable. |
| 9 | Graph-wrapper oversampling idiom | 362-415 | `node core = X * 2`; Cmajor sinc cost grows roughly with N; annotation mirroring burden. Keep OS only on the nonlinear/exciter part if possible. |
| 10 | Control smoothing + soft clip | 131,226-247 ; 177-182 | One-pole alpha computed once; soft clip computes 4 `tanh` per sample even at amt=0 (add early-out). |
| 11 | Estimated total cost of current core | whole `main` | ~19 transcendental calls per core sample (tan x8, pow x2, sin x3, cos x2, tanh x4) ~ 38 per host sample at 2x, plus 8 SVFs; ALL evaluated even when source is bypassed. Not benchmarked. |
| 12 | SVG dial + echo-safe bridge UI | LalafyUI.js:117-214, 226-262, 315-324 | 350 lines, no deps, Amorph-compatible (single file, light DOM, teardown). Apply E's fixes (touch-action, guarded define, data-endpoint-id) and see §7 UI bugs. |
| 13 | g2p-en + vowel-morph sequencer | g2p/g2p-en.js (184 l); E/LalafyUI.js:146-245 | JS only, zero audio cost. Only worth it if the new plugin morphs body presets from text/phonemes; tiny lexicon + heuristic L2S. |
| 14 | Param-contract discipline + header/versioning | PARAM_CONTRACT.md, ADR-0010, ADR-0016, AMORPH_CONVENTIONS.md | Frozen param order for recall; version mirrored in 3 places; cmaj `render`-based verify recipe (HANDOFF.md:43-57; tests: silence/noise/tone). |
| 15 | Vendored physical-model references (MIT, read-only snapshots, pinned) | reference/vendor/klatt-syn/src/Klatt.ts (Resonator 138, AntiResonator 235, cascade/parallel TF 840-884); voc/{tract.w 493 l, glottis.w 222 l}; Modular-Pink-Trombone/src/pink_trombone_processor.js (TractProcessor 314-770) | Klatt resonators = textbook body-mode filters (2-pole, per-mode freq/BW) incl. anti-resonators (zeros). voc/Pink Trombone = 44-segment Kelly-Lochbaum tube waveguide: truer "body" physics but much heavier and a port job. Project rule: read method, reimplement (DSP_RESEARCH:6). ICT-FaceKit is metadata only (387 MB obj not vendored; full model has a separate USC licence). |
| 16 | Hillenbrand data | dsp.cmajor:112-127 | Adult-male vowels only; no female/child sets in repo. |
Not reusable as-is: LalafyView.js (stub), v0.80 3D head (CDN deps, no audio link), anything of E's DSP (source missing).

## 7. Known problems, technical debt, pitfalls (from docs and from reading the code)
DSP / signal
- Level/headroom: formant bank is high-Q and un-normalised; harmonic source can clip hard (+7..+12 dBFS in Z's measurement, Z SESSION_LOG:19-22). R's `glottalSourceGain=0.08`
  was tuned at one F0 only (CHANGELOG.md:22-24). Zip's 0.35 trim + SR-correct DC blocker were never merged into R.
- Dry/Wet default 0.5 means the live input always leaks into the "pure synth" (353-354) — E replaced it with Voice Level.
- Per-sample `tan`/`pow`/`tanh` and always-on source stage = avoidable CPU; ADR-0011:51-55 promised control-rate coefficient caching, not implemented. ADR-0007:60-61 smoothing note done (226-227).
- Aliasing: derivative boosts HF, only 2x OS, no measurement; ADR-0008:84 originally allowed ignoring it.
- Continuous drone, no note on/off or envelope (HANDOFF "known behavior"); no denormal guards; noise is white and not glottal-synchronous; consonants cannot be produced by the vowel-only bank (DSP_RESEARCH:27).
- Param naming debt: param5 "Pitch" is formant shift (CONTEXT.md:73, ADR-0010:39-42); param order frozen by recall; ADR-0007:33 formula uses `semi-9` while :44 and the code use 69 (inconsistent doc).
- Annotations duplicated on core and graph, version duplicated in 3 files (ADR-0016:48) — manual drift risk. ADR-0013 spec says uint32 LCG, code uses int64+mod (147,172).
UI
- LalafyUI.js (R): `customElements.define` unguarded (345; second load throws, E guards it at E:573); `localStorage` not wrapped in try/catch (260,303,310 — can throw in sandboxed/private hosts);
  `sendEventOrValue` is monkey-patched on every connect and never restored (238-247 -> double wrapping on reconnect); no `touch-action:none` on dials (pointercancel mid-drag in WebViews, fixed in E);
  echo guard drops any host/automation value within 1e-4 of the last 48 sent values (317-324), so legitimate automation echoes can be ignored.
- 3D head: CDN-loaded Three.js/GSAP (ADR-0009:32-33 offline plugin sandbox risk); mockup mounts globally with `requestAnimationFrame`, needs teardown (ADR-0009:34); ICT-FaceKit full model licence + 387 MB not in repo (ADR-0015:48-53).
Process / docs
- Cmajor is poorly known by LLMs: always compile (AGENTS.md:9; MATERIAL_INDEX:17). Compiler must be rebuilt each session (~10 min, HANDOFF.md:43-57); no CI.
- Two diverged histories (R vs Z/bundle `0f1d405`) with colliding "Session 07"; E/v0.89 branch unrecoverable from archive; folder/manifest version mismatch (v0.83.2 vs 0.89.0).
- Stale docs listed in §2 (ADR statuses, HANDOFF v0.83.0, STRATEGY M0 row). STRATEGY.md milestones (M0-M8+) differ from ARCHITEKTUR_KONZEPT (M0-M6) — banner l.6 says STRATEGY wins.
- Scope risk: ADR-0006 commits to the full Spec §16 MVP (4 modes, full analysis suite, all pitch/phoneme modes) before a first demo; owner explicitly accepted a late demo (ADR-0006:10).
- Amorph-specific: single-file UI, no imports; `.amorph` export format undocumented (Z SESSION_LOG:39-40,47).
