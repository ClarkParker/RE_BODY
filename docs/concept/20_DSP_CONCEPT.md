# 20 — RE·BODY DSP concept (v1 target architecture)

Status: concept, no code yet; revised by the review triage (`docs/review/42_REVIEW_TRIAGE.md`, items cited T1-T10, N1-N13). Sources: `docs/index/01_BODY_ORIGINAL.md`, `docs/index/04_PHYSIFY.md`,
`docs/research/10_PM_BODY_RESEARCH.md` (R10 §x), platform rules `docs/index/03_AMORPH_PLATFORM.md` (P03 §x). `BODY:n` = line n of `reference/body_original/dsp.cmajor`; `plugin/spec.json` is the source of truth for parameters and endpoints.

## 0. Decisions in force (owner, 2026-10-16)
- Stays an Amorph **FX** (`Amorph_FX` binary): audio in → bodies → audio out. No MIDI.
- No provisional solutions: the seven original bodies get real body physics even if their sound changes; identity is kept through the same morph order, contact behaviour and loudness discipline. No preset compatibility with BODY: Morph runs 0..10 and the voicings differ (N4).
- Parameters: 73 of 128 slots (P03 §1). BODY's ids `param1..param5` are reused for the same roles (Tune, Decay, Mix, Morph, Bypass); all others are appended in fixed blocks (§5).
- Telemetry: ten output endpoints (§8), as many as the UI needs.
- CPU: no ceiling by decision; target note ≤ 8 % of one core at 96 kHz for three lines, measured in P7 (§16).
- Credit "based on BODY by Artists in DSP" in manifest description and README.
- Branding: manifest `manufacturer = "CLΞΛRPΞΛK"`, brand line in the UI header (DEV-Kit `docs/15_BRANDING.md`, 9ce8d6d). Rules and recipes from the newest kit branch `claude/vibrant-faraday-cmymob`.
- All bodies are specified individually in `22_BODIES.md`.

## 1. How the professionals do it: tables *and* formulas
The research (R10 §1-§2) shows three layers used together by every serious product and paper:
1. **Generator formulas** for idealised objects: membrane (Bessel ratios 1 : 1.594 : 2.136 …, air-loaded timpani 1 : 1.5 : 1.98 : 2.44), plate/soundboard (dense log-spaced sections, constant loss factor η), beam/bar, string (stretched partials), tube (cylinder = odd series, cone = full series). Corpus, Chromaphone, Rings and Faust `physmodels` are built this way (R10 B2, B3).
2. **Measured tables** for real instrument bodies: guitar signature modes 103/205/286/436 Hz with Q≈20, violin A0/CBR/B1−/B1+ corpus means, piano soundboard η≈2.3 % and 22 Hz mode spacing, bore cutoffs 0.8-1.5 kHz (R10 B4). Logic Sculpture, ToneDexter and Bank's parallel-filter method derive bodies from measured responses (R10 B1, B2); Bank's fixed-pole parallel bank is the method behind the shared pole grid (§2).
3. **Laws with few parameters** on top: Aramaki damping α(ω)=αG+αR·ω (§4: Decay scales it, Material tilts it), position = cosine mode gains, brightness = upper-mode Q/gain tilt (Rings `resonator.cc`, R10 B3), size = log shift of fixed body resonances (Sculpture Formant Shift).
Nobody hard-codes per-mode literals the way BODY does today, and nobody interpolates filter coefficients directly (R10 B5): morphs interpolate gains or crossfade energy, never coefficients.

**RE·BODY therefore uses a body *recipe* = generator + measured overrides + material law, compiled offline into flat tables.**

## 2. Signal architecture (per sample, kept from BODY where it is already right)
```
in → NaN guard, DC block, clamp, bypass fade                              (BODY:587-590, keep)
   → ANALYSIS, shared (§13): transient/sustain split, LR4 3-band split, pitch
   → per LINE A, B, C (§12), each:
        listened signal = Listen component × Sensitivity (Chain = previous line)
        → its own novelty detector → Touch, strikers                       (BODY:591-594, ×3)
        → per-body feeds, sqrt-weight crossfade, tail holding              (BODY:147-172, :226-266)
        → LINE engines (loops) ─┬─ pickup → radiation filter (outside the loop) ───────┐
                                └─ one-way feed × Coupling ─┐                         │
          contact feed (modal-only bodies) ─────────────────┴→ GRID + SLOTS ─────────┴→ line output
        → loudness stage: drum calibration + pitched balance AGC           (BODY:844-856)
        → Level → Pan
   → Σ lines → Low Cut → shared protector + knee, input-peak ceiling       (BODY:857-889)
   → Mix (linear, as BODY on purpose) → out                                (BODY:890); meters + telemetry (§8)
```
- **Modal architecture = grid + per-body slots, no melt in v1 (T1).** Per line, (a) one shared log **pole grid** (96 poles, 60 Hz-8 kHz, spacing ≤ 1/12 oct) carries the dense fixed-Hz body response: soundboard, box hump, bridge hill, bell and brass radiation. Each body owns a signed L/R gain vector over the grid; Size shifts the grid, Material and Decay set the per-pole T60 law (§4) blended across the active bodies. (b) **Per-body slots** hold the few exact modes: ≤ 8 fixed-Hz feature modes (A0/T1, B1±, FEM low modes, shell modes) and ≤ 10 Tune-following modes (drum heads, oboe cluster), with BODY-style tail holding and sqrt-weight energy crossfade. Modes are complex one-pole (phasor, coupled-form) sections as BODY:604-613: click-free under modulation by construction (R10 B1 Mathews/Smith, Laroche).
- **LINE engines** (fractional-delay loops, BODY's idioms): clarinet cylinder (BODY:636-656), sax positive bore (BODY:768-826), piano string pair with dispersion (BODY:658-677), and **one shared string engine per line** for Guitar, Ukulele and Fiddle (BODY:680-710 with pick comb; same physical object, retuned by the shared register). Oboe has no waveguide in v1 (N10): nasal cluster + fixed formant modes + BODY's reed shaping (BODY:732-741); a cone stays a v1.1 option.
- **Loop filters (T6).** The loops keep BODY's low-pass values as defaults for tuning integrity (clarinet 1.75 kHz BODY:520, sax 6.6 kHz BODY:530). The lattice cutoff is modelled **outside** the loop as a radiation filter on the pickup (clarinet 1.4 kHz, sax 1.0 kHz) plus fixed-Hz radiation modes on the grid; a per-register tuning LUT (PHYSIFY `tuneCorr`, 04_PHYSIFY:86) corrects residual pitch error. A keytracked in-loop DC blocker is added only if a later phase compensates loop gain.
- **Coupling is one-way** (commuted-synthesis argument, R10 B1 Bank 2010 / Smith): string or bore → body, no bridge reflection in v1 (§15). The Obosaxolele coupling stays acyclic (BODY:712-727, :733-734, :798-800).
- **Loudness chain (T2).** Inside each line BODY's complete stage (drum calibration, pitched balance AGC with the line's own `pitchedWeight`, BODY:844-856) → line **Level** → sum of lines → one shared protector + knee referenced to the input peak (BODY:857-889) → **Mix, linear as BODY on purpose** (peak-referenced wet, BODY:890). Details §7.
- **One novelty detector per line (T9)** on that line's listened signal (3 × BODY:591-594), see §13.

## 3. Body recipe and table format
Offline tool `tools/bodytab.py` (Python, stdlib + numpy) turns `bodies/*.json` recipes into flat Cmajor arrays and a UI JSON mirror (`bodies.json`). A recipe (per body) holds:
- `name`, `generator` (membrane|plate|box|bar|tube_body|cluster), `anchor` (root Hz law drum|note, decay seconds at Decay 50: keeps BODY's Tune/Decay feel), `material` (ρ at Material 50, optional η, §4).
- `grid`: the body's **gain vector over the 96 grid poles** (signed L/R gains, 60 Hz-8 kHz, spacing ≤ 1/12 oct), compiled from the dense response; empty for bodies without a dense fixed-Hz part.
- `features[]` ≤ 8 fixed-Hz modes and `tuned[]` ≤ 10 Tune-following modes: f (Hz or ratio), t60_mult or eta, gain, posL, posR, flex. Fixed-Hz modes (grid and features) do not follow Tune (real body resonances do not move with the played note, R10 B1 Woodhouse); `Size` (line block #11) shifts them.
- `line`: kind (none|cylinder|bore|string|string_pair), loop low-pass Hz (BODY default), radiation Hz (outside the loop), pickup/pick position β, dispersion, reed shaping, per-register `tune_lut`. `contact`: sustain, novelty power (BODY:23, :194-201). `calibration`: out_gain, energy_target (BODY:831-843, :427).
- **Tail holding:** the slot states of a body with weight 0 keep their last voicing and ring out (BODY:226-266); grid poles are shared and fixed, so their stored energy keeps ringing through any morph.
- **Capacity:** per line 96 grid poles + 11 bodies × (8 + 10) slots ≈ 294 stereo modes (was 530).
- **Buffers:** delay lines 4096 samples (C2 at 96 kHz = 1468; Follow floor 40 Hz = 2400), except the piano pair at 8192; one shared string engine per line for Guitar/Ukulele/Fiddle (T10, §16).
Emission strategy (to validate with `cmaj` first, PHYSIFY note on large literals): namespace-scope constant arrays, else processor members assigned at `main()` start. Manifest `externals` only if Amorph is shown to load them.

## 4. Damping law and the Material axis
One rule for every body (N2). Per mode or grid pole at frequency f, T60 = ln(1000) / (αG + αR·2πf).
- **Decay** scales (αG, αR) jointly: every T60(f) is multiplied by one factor (log law per body as BODY `anchorSeconds`, BODY:183-192, shared across active bodies as BODY:210-217; at Material 50 the root mode has the anchor seconds).
- **Material** sets only the ratio q = αR·ω_ref / αG at constant T60 at f_ref = 200 Hz, so it never changes the 200 Hz decay time. 0 = damped/soft (αR high), 50 = recipe default, 100 = hard/ringing (αR low).
- **ρ** = T60(2 kHz) / T60(200 Hz) = (1 + q) / (1 + 10·q) follows from this rule for every body and lies in [0.1, 1] since αG, αR ≥ 0. `22` lists ρ per body at Material 50; Material moves ρ log-linearly from max(0.1, ρ/4) at 0 to min(1, 4ρ) at 100, and q follows by inversion.
- Anchors: soundboard η≈2.3 % → T60≈96/f s (ρ = 0.1, the pure-αR limit); violin corpus ζ∝f^−0.45; membranes short, metal long (R10 B4, PHYSIFY `DSP:568-585`). Per-mode `t60_mult` multiplies the curve. The grid uses the same law with the shared log-blended T60 and the weight-blended ρ of the active bodies.
- Control rate only: one `exp` per active mode per 32-sample tick (BODY:579, :606-607), staggered (§16).

## 5. Parameters (append-only after the original five; line blocks, see §12)
Three identical **lines** A, B, C (§12). Globals are `param3`, `param5`, `param6`, `param7`; Line A = `param1`, `param2`, `param4` + `param8..param27`; B = `param28..param50`; C = `param51..param73`. Each line block has 23 entries in the order below, so the scheme is mechanical for DSP, UI and tools.

**Global**
| id | name | range / init | meaning |
|---|---|---|---|
| param3 | Mix | 0..100 / 45 | dry/wet of the summed lines, linear as BODY on purpose (§2) |
| param5 | Bypass | Off/On / Off | as BODY |
| param6 | Width | 0..100 / 50 | stereo width inside the bodies: 50 = BODY's image; line engines via L/R pickup offsets (±3 ct L/R detune for strings), modal parts via a Rings-style odd/even mode split to L/R (R10 B3); below 50 toward mono *(design)* |
| param7 | Low Cut | 20..500 Hz / 20 | 12 dB/oct high-pass on the wet sum, placed ahead of the protector so the ceiling still holds *(design)*; 20 = off |

**Line block** (23 entries; ids `A / B / C`)
| # | name | ids | range / init | DSP meaning | UI |
|---|---|---|---|---|---|
| 1 | Tune | 1 / 28 / 51 | 0..100 / 58 | as BODY (drum size law, pitched note law C2..C5); ignored by fixed-Hz modes and the grid | main dial |
| 2 | Decay | 2 / 29 / 52 | 0..100 / 50 | scales (αG, αR) jointly, log seconds per body (§4) | main dial |
| 3 | Morph | 4 / 30 / 53 | 0..10 / A 7, B 0, C 3 | anchor position (22 §0); 7 = Clarinet = BODY's default stop; B = Bass Drum, C = Piano | hero slider |
| 4 | Enable | 8 / 31 / 54 | Off/On / A On, B Off, C Off | line is summed and computed (§12) | button (line tab) |
| 5 | Level | 9 / 32 / 55 | −60..+6 dB / 0 | after the line's own loudness stage, before the sum (§2, §12) | small dial |
| 6 | Listen | 10 / 33 / 56 | All / Transient / Sustain / Low / Mid / High / Chain; A All, B Transient, C Sustain | analysed component that excites the line (§13); Chain = previous line's body output (A: falls back to All) | segmented buttons |
| 7 | Sensitivity | 11 / 34 / 57 | 0..100 / 50 | gain of the listened component into the contact stage; 50 = 0 dB, ±24 dB | small dial |
| 8 | Excite | 12 / 35 / 58 | Through / Hammer / Pluck / Breath; init Through | Through = BODY contact; others = onset-triggered strikers (§14) | segmented buttons |
| 9 | Touch | 13 / 36 / 59 | 0..100 / 50 (= recipe default) | onset sensitivity vs sustained excitation; in strike modes = velocity curve | advanced dial |
| 10 | Material | 14 / 37 / 60 | 0..100 / 50 | ratio αR/αG at constant T60(200 Hz) (§4) | main dial |
| 11 | Size | 15 / 38 / 61 | −100..100 / 0 | log shift of the grid and fixed-Hz feature modes, ±1 oct | advanced dial |
| 12 | Position | 16 / 39 / 62 | 0..100 / 50 (= recipe default) | excitation/pickup point (mode gains, pick and pickup β) | advanced dial |
| 13 | Bright | 17 / 40 / 63 | 0..100 / 50 | contact low-pass + upper-mode tilt | advanced dial |
| 14 | Body | 18 / 41 / 64 | 0..100 / 50 (= recipe default) | line engine ↔ modal body balance | advanced dial |
| 15 | Stretch | 19 / 42 / 65 | −100..100 / 0 | mode spacing around 1 kHz (Tune-following modes) | advanced dial |
| 16 | Stiffness | 20 / 43 / 66 | 0..100 / 50 (= recipe default) | string dispersion, plate/bar inharmonicity (§15) | physics dial |
| 17 | Coupling | 21 / 44 / 67 | 0..100 / 50 (= recipe default) | one-way string/bore → body feed amount; bores: radiation mix (§15) | physics dial |
| 18 | Air | 22 / 45 / 68 | 0..100 / 50 (= recipe default) | Helmholtz/air modes, air-loaded drum ratios, breath noise (§15) | physics dial |
| 19 | Reed | 23 / 46 / 69 | 0..100 / 50 (= recipe default) | reed stiffness/asymmetry, head tension, pick hardness (§15) | physics dial |
| 20 | Follow | 24 / 47 / 70 | 0..100 / 0 | Tune follows the tracked input pitch (0 = fixed Tune, 100 = full), 40 ms glide (§13) | small dial |
| 21 | Hold | 25 / 48 / 71 | Off/On / Off | modal freeze: grid and slots held, loops ring out (§14) | button |
| 22 | Blend | 26 / 49 / 72 | 0..100 / 0 | strike modes only: 0 = striker alone, 100 = Through alone, between both excite the same body (§14) | small dial |
| 23 | Pan | 27 / 50 / 73 | −100..100 / 0 | line balance in the stereo field after Level; 0 = unity | small dial |
Display names carry the line letter (`A Tune`, `B Listen` …) so DAW automation lanes stay distinguishable; global names stay `Mix`, `Bypass`, `Width`, `Low Cut`. Lines B and C default to distinct bodies and listeners (Bass Drum/Transient, Piano/Sustain; both Enable Off), so enabling one does not simply duplicate Line A.
73 parameters in total (4 global + 3 × 23), ids exactly `paramN` (P03 §2a), sequential. All event handlers NaN/Inf-guarded and clamped (BODY:120-124); smoothing via BODY's 32-sample target stepping; enum parameters use `text:` annotations and real buttons in the UI.

## 6. Morph
- Anchor order v1 (decided, see 22 §0): Bass Drum, Snare, Timpani, Piano, Guitar, Ukulele, Fiddle, Clarinet, Oboe, Sax, Obosaxolele. The hybrid segment is 9→10.
- **Grid bodies** (fixed-Hz responses): morph = interpolation of the gain vectors by the morph weights. The poles are fixed, so nothing glides and stored tails keep ringing; Size, Material and Decay act on the shared grid, not per body.
- **Per-body slots and line engines**: BODY's sqrt-weight energy crossfade with tail holding and register sharing (BODY:147-172, :203-272, :226-266). A body at weight 0 keeps its last voicing and rings out; active bodies share the blended root, time and contact response.
- **No mode-level melt in v1.** Melt (rank-paired modes, polar interpolation of log f, log T60, gain; PHYSIFY `CORE:148-165`) is deferred to v1.1 as an experiment for drum↔drum only.
- Hybrid segment: BODY's acyclic coupling (uke bridge → oboe cluster → sax bell, BODY:712-727, :733-734, :798-800). The bass-drum onset glide (+0.33 oct × onset, BODY:308) fades with the morph weight (× feed[0]).

## 7. Engine gating and loudness
- **Gating:** a body, engine or line is skipped when its weight is 0 and its energy is 120 dB below its own peak since the last excitation (−120 dB relative). BODY's absolute flush at 1e-12 (BODY:611) is −240 dB and lets a 4 s timpani tail run for about 16 s. Flush to zero at control rate, not per mode and sample.
- **Loudness chain (T2):** per line BODY's complete stage: drum calibration (1.5 × bass, 1.4 × shell, 2.7 × rattle, BODY:856) and the pitched balance AGC (target −8 dB re the line's input power, gain clamp −18..+12 dB, slews 0.25 s down / 0.9 s up, BODY:844-855, :557-558) with the line's own `pitchedWeight` = summed morph weight of the pitched bodies (all but Bass Drum and Snare) *(design)*. Then Level, sum of lines, shared protector + knee against the input peak (BODY:857-889), then linear Mix. Per-body `out_gain` comes from the recipe (BODY:831-843).
- **Normalisation:** BODY's closed-form modal energy with cross terms (BODY:282-301) for the **per-body slots only** (≤ 18 modes, ≤ 18² terms per body, float64, control rate, active bodies only). The grid normalisation is cached per Size/Material/Decay and does not depend on Morph or Tune.
- Modal feedback never exceeds |r|<1 by construction; DC-block wet per channel (P03 §2c).
- Nyquist culling: modes, grid poles and bore/formant targets above 0.45 × fs are skipped or clamped at every sample rate (PHYSIFY `DSP:625-634`, Rings `resonator.cc`); delay buffers sized for 96 kHz (§3).

## 8. Telemetry (output events, 30 Hz, host-rate meters, zero cost when idle)
| endpoint | type | content | UI use |
|---|---|---|---|
| bodyViz | float<4> | input, wet, left, right peaks (BODY compat, BODY:893) | lamp, breathing |
| bodyBands | float<8> | summed wet energy in 8 octave bands b60 … b7680 | layer vibration modes |
| bodyOnset | float | strongest onset of the enabled lines (each BODY:593 on its listened signal, T9; = BODY's onset for Line A at Listen All), **peak-hold since the last frame** (N6) *(design: max over lines)* | strike push, ripple |
| lineStateA/B/C | float<24> | [wet, onset (line detector), listenEnergy, followHz, hold, **rootHz, t60 (at the root), sustainEff (effective contact sustain), dominantBody** (anchor index 0..10 of the largest weight), engine0..engine10 (per-anchor weight, anchor order), 4 spare] | tabs, weight bars, silhouettes, captions |
| lineModesA/B/C | float<16> | energy of the first 16 slot modes of the dominant body in **fixed recipe index order**; identity from `bodies.json` + `dominantBody` | standing-wave markers |
| analysisViz | float<6> | transient, sustain, low, mid, high energies, pitch confidence | listen selector feedback |
Grid poles are not reported individually (they show up in `bodyBands`). Caption seconds come from `rootHz`/`t60`, so they mirror Material, the damping law and Hold.

## 9. Validation plan (ported from PHYSIFY tooling, R10 §4 rec. 8)
- `cmaj test`: tables finite and sorted, every |r|<1, mode counts within the caps (96 / ≤ 8 / ≤ 10), recipe → coefficient and gain-vector round trip.
- Render tests (`cmaj render`, init-patching trick from `tools/golden_ci.py`): impulse and zero-mean noise per anchor at default and extreme Decay/Material → peak positions vs table, band T60, A0 peak for boxes, |DC|<0.01, finite decay, tri-rate 44.1/48/96 kHz. Morph sweep over all ten segments: no gain jump > 2 dB, click test at −100 dB for gain-vector interpolation and crossfades.
- **Legacy golden (N4):** a `legacy` recipe set with BODY's constants (BODY:41-43, :174-201, :831-843) is the P2 golden reference for A/B renders against the original.
- **Gates (T2, T3, T7; 30 P1-P4b):**
  - Loudness (T2): Line A at defaults within ±1.5 dB LUFS of the original BODY render on the same pink noise; with B and C enabled at defaults the protector reduction stays < 3 dB.
  - Hold (T3): modal T60 ≥ 30 s, level drift < 0.5 dB per 10 s, abs(DC) < 0.01, held modal spectrum within 1 dB per mode of the un-held tail at t = 1 s.
  - Analysis and A/B (T7): transient/sustain split sums to the input (−100 dB); 3-band split magnitude-flat ±0.2 dB; radiation filter response measured on the pickup; A/B vs the legacy renders: f0 ±5 ct, band T60 ±15 %, LUFS ±1 dB; emission "each form tried, at least one clean, chosen form documented"; loudness per T2.
  - Follow (N8): lock within 150 ms ±10 ct on a 440 Hz sine. Width: 50 = BODY's image; away from 50 a mono input yields L ≠ R for line engines too (fx.md A15).
- **`lhs_fuzz` in CI (N13)** (PHYSIFY `tools/lhs_fuzz.py`): Latin-hypercube parameter sets over all 73 parameters, asserts finite output, bounded peak, decay after input stops.
- Amorph `run_qa_probe` conditions (P03 §2c), then listening. CPU bench per §16.

## 10. Milestones
See `docs/plan/30_DEV_PLAN.md` §1 (P1-P8). P1 includes the host spike (T4): stub DSP with 73 parameters, ten outputs and the full-size line state compiled as `struct Line` × 3. Line A is verified completely before B and C are enabled; the line structure exists from P1 on (enabling, not rebuilding).

## 11. Open questions (later)
Per-body *(design)* values in 22 are the first thing to tune by ear (P3/P4). The owner questions Q1-Q5 in `docs/review/42_REVIEW_TRIAGE.md` are UI-side and do not block the DSP. Deferred to v1.1: mode-level melt (drum↔drum), oboe cone waveguide, bridge reflection (3-port bridge, PHYSIFY `DSP:2907-2955`), keytracked in-loop DC blocker with loop-gain compensation, Hold for loops.

## 12. Lines: three bodies listening to different parts of the input
A **line** = one complete BODY-style chain (listened signal, own novelty detector, feeds, engines, grid and slots, loudness stage, tail holding) with its own parameter block (§5). Three lines run in parallel as an array of three identical line states in one processor; Line A alone has BODY's structure (not its presets, N4).
```
in → conditioning → ANALYSIS (transient/sustain, 3-band, pitch) ─┬→ Line A ─ loudness ─ Level ─ Pan ─┐
                                                                  ├→ Line B ─ loudness ─ Level ─ Pan ─┼→ Σ → Low Cut → protector/knee → Mix → out
                                                                  └→ Line C ─ loudness ─ Level ─ Pan ─┘
Chain: Line B may take Line A's body output instead of the analysis bus; C may take B's. Never backwards (acyclic, stable).
```
- **Enable (N3)** = "summed and computed". A line that is chained-from is computed even when disabled. Disabling fades its contribution to the sum and gates its engines only after their tails have drained (§7).
- **Level (T2)** sits after the line's own loudness stage (so the balance AGC cannot undo it) and before the sum; the shared protector acts on the sum. **Pan** is a balance after Level: unity at 0, the opposite channel attenuated *(design)*.
- Same body on two lines excites the same modes coherently (+6 dB); distinct defaults and the 3-line loudness gate (§9) cover it. "Copy line A → B/C" is a UI-only action (N13).
- Cost: see §16; a disabled line costs nothing once its tails have drained.

## 13. Analysis stage (host rate, shared by the lines)
- **Listened signal** per line: Listen picks All (conditioned input), Transient, Sustain, Low, Mid, High or Chain; Sensitivity scales it linearly in dB: 0 → −24 dB, 50 → 0 dB (unity, so Line A at defaults has BODY's contact level), 100 → +24 dB.
- **Transient / sustain split**: two envelope followers on the conditioned input (fast 1 ms / 20 ms, slow 20 ms / 150 ms); transient gain g = (fast − k·slow) / (fast + ε), limited to 0..1 and smoothed; transient = x·g, sustain = x − transient. The sum equals the input by construction; the split amplitude-modulates at 1-20 ms rates, fine as an exciter, not a clean separation *(design, classic transient-designer split)*.
- **Band split**: Linkwitz-Riley 4th-order pairs at 200 Hz and 2 kHz (two cascaded Butterworth biquads per side) → Low / Mid / High. The sum is an allpass: magnitude-flat within ±0.2 dB (gate §9), not phase-flat, which does not matter because the bands only excite. Feed-forward, no stability concern.
- **Onset (T9)**: one novelty detector per line on its listened signal (3 × BODY:591-594, each with its own peak/slow-peak/onset state; with Chain it runs on the chained signal). Each line scales it with Touch and triggers its strikers (§14) with hysteresis and a 30 ms refractory time, so a Low-listening Hammer line does not fire on hi-hats.
- **Pitch** (for Follow, N8): decimated copy (≈ 12 kHz), YIN-style difference function over lags for 40 Hz-1.2 kHz, window 512, hop 128, confidence gate, median of 3, output in semitones. **Parabolic interpolation of the lag** (65 ct resolution at 440 Hz without it), **work spread over the hop** (≈ 154 k MAC per hop, ≈ 600 flop/sample at 48 kHz while active, measured in P7). First estimate ≈ 68 ms; **gate: lock within 150 ms ±10 ct**. Runs only while any line has Follow > 0. Follow glides (40 ms) read the delay lines with **Lagrange-3** (04_PHYSIFY:86), not BODY's linear interpolation (BODY:446-448), whose fraction-dependent low-pass causes flutter.
- `analysisViz` reports the five energies and the pitch confidence.

## 14. Excite modes, Chain and Hold
- **Through**: BODY's contact law x · feed · (sustain + (1 − sustain) · novelty) per body, with the line's own novelty.
- **Hammer**: onset triggers a Hertz-contact force pulse (PHYSIFY `DSP:913-1004`, `:2060-2131`), velocity from onset energy (log map, Touch = curve), 1-4 ms, into the loop input of the line engine (as BODY's hammer, BODY:670) or the modal input; the audio itself is not injected.
- **Pluck**: onset triggers a one-period displacement burst at the line's pitch with the position comb (BODY's uke pick comb, BODY:376, :689-690), for non-string bodies a position-filtered impulse.
- **Breath**: onset triggers a noise burst (20-80 ms envelope) through the reed shaping into bores (BODY:642-649), through the contact low-pass into modal bodies; while the listened component stays above threshold the burst sustains (breath follows the pad).
- **Strikers (N11)** are one shared module used by all lines; velocity and position come from the line parameters. Every striker output is **DC-blocked** (unipolar force pulses inject DC, 04_PHYSIFY:85) and **energy-normalised to the listened envelope**, so Blend 50 is a real half/half.
- **Blend**: in strike modes the striker and the Through contact can excite the same body; Blend crossfades them (equal-power). At 0 the audio is not injected at all (pure striker).
- **Chain**: Listen = Chain feeds the previous line's body output (after its loudness stage, before Level) × Sensitivity into this line's contact stage; this line's novelty detector runs on that chained signal. A chained-from line is computed even when disabled (N3).
- **Hold v2 = modal freeze, loops ring out (T3, decision D26 replaces D23).** Hold freezes the grid and the per-body slots (float64 coefficients, T60 45 s, float64 state for poles below 200 Hz). Line engines (strings, bores) keep their recipe decay; the wording is "Hold sustains the body resonance; strings and bores ring out naturally". Injection is muted only while held energy > −60 dB; below that (and after a project load) Hold is *armed*: the next excitation is captured for 200 ms, then frozen. No gain compensation inside loops, hence no in-loop DC risk in v1. Releasing restores the recipe decay and the injection with 32-sample ramps (click-free); Hold off is the identical code path as without Hold. The earlier Chain claim ("play into a held body") is dropped.

## 15. Physics knobs: one meaning per knob, mapped per body
Each recipe carries a `physics_map` (22 §13) so the same knob is sensible on every anchor:
| knob | strings (piano, guitar, uke, fiddle) | drums (bass, snare, timpani) | bores (clarinet, oboe, sax) | modal-only bodies |
|---|---|---|---|---|
| Stiffness | dispersion allpass coefficient (BODY:70, :357-358) | mode-ratio stretch r_k·√(1 + B·k²) | slight bore dispersion | plate/bar inharmonicity |
| Coupling (T6) | string → body feed amount, one-way (no bridge reflection in v1) | head ↔ shell feed | radiation mix (the loop gain is set by Decay, BODY:339) | body → body feed in Chain |
| Air | Helmholtz/air-mode gain and A0/T1 coupling | ideal ↔ air-loaded ratio blend, kettle mode | breath-noise amount | air-mode gain |
| Reed | pick/hammer hardness (contact low-pass) | head tension: glide depth and (0,1) damping | reed offset/slope, asymmetry | contact low-pass |
Not offered: editing single modes (that is Modalys, not BODY), bridge reflection (v1.1, §11).

## 16. CPU layout (T10)
- **SIMD:** modal banks as `float<8>` lanes in PHYSIFY's coupled form (`DSP:606-677`, `:2503-2527`): the grid is 12 vectors, each body's slots 3 vectors (8 feature + 10 Tune-following, padded).
- **Active only:** coefficient updates and stepping only for bodies with weight > 0 or ringing tails (weight-0 bodies keep their last voicing, BODY:228); flush at control rate (the JIT has FTZ, 04_PHYSIFY:90); **staggered recompute**, one body per control tick (32 samples, BODY:579).
- **Normalisation** only for per-body slots (≤ 18² terms) plus the grid normalisation cached per Size/Material/Decay (§7); gating at −120 dB relative per body (§7).
- **Memory:** delay buffers 4096 (piano pair 8192) and one shared string engine per line: ≈ 61 k floats per line (bore 8 k, piano pair 32 k, shared string 8 k, sax 8 k, pick comb 4 k), ≈ 184 k for three lines, above core-dsp's 131 072-float guideline for a compile stall, so P1 measures compile time (T4).
- **Target note, not a ceiling:** ≤ 8 % of one core at 96 kHz for three lines, measured in P7 (`docs/dev/09_CPU.md`). Basis *(estimate)*: PHYSIFY's bench `m0/BENCH.md` gives 3.45 % per 512 mono modes at 96 kHz, so 294 stereo modes with everything ringing ≈ 4 % per line; the active-only layout is what keeps typical load below the target.
