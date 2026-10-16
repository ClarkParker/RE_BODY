# 00 — Decision log (owner decisions, binding for the concept)

| # | Date | Decision |
|---|---|---|
| D1 | 2026-10-15 | Plugin name `RE·BODY` (UI, metadata), identifier `RE_BODY` (code, files, targets). |
| D2 | 2026-10-15 | Source of BODY: Artists in DSP, given to a closed developer group; no deadline, no formal rules; credit the author. |
| D3 | 2026-10-16 | RE·BODY stays an Amorph **FX** (audio excites bodies). |
| D4 | 2026-10-16 | No provisional solutions: bodies built the professional way (generator formulas + measured tables + damping laws); the original seven may change in sound. |
| D5 | 2026-10-16 | Parameter budget up to 128; use what the design needs. |
| D6 | 2026-10-16 | UI: keep the original panel, make it good in one go; parallax technique from LALAFY, focus on the instrument graphic with many depth layers. |
| D7 | 2026-10-16 | DSP may emit as many telemetry events as the UI needs. |
| D8 | 2026-10-16 | Window resizable (DEV-Kit scaling recipe). |
| D9 | 2026-10-16 | No CPU ceiling during design; measure at the end. |
| D10 | 2026-10-16 | From LALAFY only graphic ideas; DSP direction = physical modelling on the PHYSIFY lineage. |
| D11 | 2026-10-16 | Manufacturer `CLΞΛRPΞΛK` (manifest + brand line under the plugin name). |
| D12 | 2026-10-16 | Always use the newest branches (DEV-Kit `claude/vibrant-faraday-cmymob` + `15_BRANDING.md` from 9ce8d6d). |
| D13 | 2026-10-16 | Repository, docs and plugin in English; chat in German. Concept freeze before any code. |
| D14 | 2026-10-16 | Hybrid anchor label `OBOSAX·` in the morph row, full name in the caption. |
| D15 | 2026-10-16 | Timpani compass C2..C4. |
| D16 | 2026-10-16 | Design chassis 720 × 460 (superseded by D35: 960 × 600). |
| D17 | 2026-10-16 | Motion switch default **Calm**. |
| D18 | 2026-10-16 | Stretch stays as a parameter. |
| D19 | 2026-10-16 | Concept extended by multi-line architecture (Lines A/B/C, Listen, Excite, Follow, Chain, Hold, physics knobs); details in 20 §12-§15, 21 §10, 22 §13. Owner's framing: ideas, not obligations; to be discussed after the extension. |
| D20 | 2026-10-16 | Parameter scheme: `param1/2/4` = Line A Tune/Decay/Morph, `param3/5` global Mix/Bypass; line blocks appended (offsets at the time: A from param7, B from param26, C from param48; superseded by D29). |
| D21 | 2026-10-16 | Strike modes stay pure; a per-line **Blend** dial mixes striker and Through into the same body (69 parameters at the time; 73 since D29). Different bodies or sources for strike and sustain = second line. |
| D22 | 2026-10-16 | Breath striker sustains while the listened component stays above threshold. |
| D23 | 2026-10-16 | **Superseded by D26 (Hold v2).** Former text: **Hold = linear freeze**: injection muted, radii → 1 − ε, no governor; Hold off is the identical code path as without Hold. Playing into a held body = second line in Chain mode. |
| D24 | 2026-10-16 | Original GUI is preserved and only extended: preservation contract 21 §11 (stylesheet and large layout of the original as base, behaviour and silhouettes reused, Classic toggle (removed by D37)). |
| D25 | 2026-10-16 | Default Morph = Clarinet (anchor 7), as in BODY. |
| D26 | 2026-10-16 | **Hold v2 = modal freeze, loops ring out, armed/capture behaviour; replaces D23.** Hold off is the identical code path as without Hold; release uses the 32-sample ramps. Hold freezes the pole grid and the per-body slots (float64 coefficients, T60 45 s, float64 state for poles below 200 Hz); line engines (strings, bores) keep their recipe decay. UI wording: "Hold sustains the body resonance; strings and bores ring out naturally". Injection is muted only while held energy > −60 dB; below that, and after a project load, Hold is *armed*: the next excitation is captured for 200 ms, then frozen (no silent line after a reload). No gain compensation inside loops, hence no in-loop DC risk in v1; the Chain claim of D23 is dropped. Gate: modal T60 ≥ 30 s, level drift < 0.5 dB per 10 s, abs(DC) < 0.01, held modal spectrum within 1 dB per mode of the un-held tail at t = 1 s (review 40 A3, E1, E2, D12; triage 42 T3). |
| D27 | 2026-10-16 | **Modal architecture = Grid + per-body slots; mode-level melt deferred to v1.1.** Per line: (a) one shared log pole grid (96 poles, 60 Hz-8 kHz, 1/12 oct) for the dense fixed-Hz body response; each body owns a signed L/R gain vector over the grid; morph between fixed-Hz bodies = gain-vector interpolation (poles fixed, no glide, tails keep ringing); Size shifts the grid, Material/Decay set the per-pole T60 law blended across active bodies. (b) Per-body slots for the few exact modes: ≤ 8 fixed-Hz feature modes and ≤ 10 Tune-following modes per body, BODY-style tail holding and sqrt-weight energy crossfade. Capacity per line ≈ 96 + 11 × 18 = 294 stereo modes (was 530). Mode-level melt stays a v1.1 experiment for drum↔drum (review A1, E4, E6, E7, G2; triage 42 T1). |
| D28 | 2026-10-16 | **Loudness chain per T2, with linear Mix on purpose.** Inside each line BODY's complete stage (drum calibration, pitched balance AGC with the line's own `pitchedWeight`, BODY:844-856) → line Level → sum of lines → shared protector + knee referenced to the input peak (BODY:857-889) → Mix. Mix stays linear as in BODY (peak-referenced wet) and is documented as an intended deviation from the equal-power default. Gates: Line A at defaults within ±1.5 dB LUFS of the original BODY render on the same pink noise; with B and C enabled at defaults the protector reduction stays < 3 dB (review A2, E5, A7f, D10; triage 42 T2). |
| D29 | 2026-10-16 | **Parameters now 73** (was 69): per-line **Pan** (line block #23, param27/50/73) and a global **Low Cut** on the wet sum (param7) are added; line blocks now start at param8 (A), param28 (B), param51 (C); `plugin/spec.json` is authoritative. Updates the counts and offsets of D20/D21. `lhs_fuzz` runs in CI; "copy line A → B/C" is a UI-only action; presets and A/B via stored state later (P8) (review G12; triage 42 N13). |
| D30 | 2026-10-16 | **Oboe without cone waveguide in v1:** cluster + fixed formant modes + BODY's reed shaping; this saves a third waveguide per line. The cone stays a v1.1 option (review E12; triage 42 N10). |
| D31 | 2026-10-16 | **Bridge reflection is out of v1; Coupling is one-way:** string/bore → body feed amount, for bores the radiation mix. BODY's loop low-pass values stay as defaults (clarinet 1.75 kHz, sax 6.6 kHz); the lattice cutoff is modelled outside the loop as a radiation filter on the pickup (clarinet 1.4 kHz, sax 1.0 kHz) plus fixed-Hz radiation modes on the grid; a per-register tuning LUT (PHYSIFY `tuneCorr`) corrects residual tuning error. A keytracked in-loop DC blocker is added only if a later phase compensates loop gain (review E1, E3, A9; triage 42 T6). |
| D32 | 2026-10-16 | **No preset compatibility with BODY** (Morph range and voicings differ). A `legacy` recipe set with BODY's constants is the golden reference for A/B renders from P2 on (f0 ±5 ct, band T60 ±15 %, LUFS ±1 dB) (review A13; triage 42 N4, T7). |
| D33 | 2026-10-16 | **The host spike is a P1 gate:** stub DSP with 73 parameters, 10 outputs and full-size line state compiled as `struct Line` × 3 (Cmajor #94 check); UI with three hidden control sets, MORE, MORE, custom-endpoint delivery, pointermove delivery, frame time at zoom 0.5/1/2 in the host WebView, compile time. Results in `docs/dev/00_HOST_SPIKE.md`; hand-over = repo, branch and path, the owner runs it on Amorph. Proposed fallback if hidden controls fail the probe: compact always-visible strip for lines B and C (owner question Q5) (review G1, D1, D7, D8, D13, F8; triage 42 T4). |
| D34 | 2026-10-16 | **Anchor abbreviations as in `plugin/spec.json`** (`anchorLabels`): BASS, SNARE, TIMP, PIANO, GUITAR, UKE, FIDDLE, CLAR, OBOE, SAX, `OBOSAX·` (D14 stays for the hybrid; full names in the caption) (review A4-A6; triage 42 T5). |

D26-D34 are lead decisions from `docs/review/42_REVIEW_TRIAGE.md`, applied 2026-10-16; the owner questions Q1-Q5 of that file remain open.
| D35 | 2026-10-16 | Design chassis **960 × 600** (16:10), zoom 0.5-2.0, min width 640 (supersedes D16; lead proposal after owner's Q1, to be confirmed). |
| D36 | 2026-10-16 | Material is the fourth main dial (Tune, Decay, Material, Mix). |
| D37 | 2026-10-16 | **No Classic view.** Removed entirely (supersedes D24's Classic toggle; the rest of the preservation contract stands). |
| D38 | 2026-10-16 | Motion budget: Off = static depth; Calm (default) = tilt 1.5°, audio motion, no idle drift; Full = tilt 4° + idle drift ±1°. Depth must read strongly in every state through light (rim, fog, shadow, specular); parallax adds to it. |
| D39 | 2026-10-16 | Lines B/C as tabs; if the host spike shows hidden controls fail the probe, fallback = compact always-visible strip. |
