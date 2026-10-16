# 20 — RE·BODY DSP concept (v1 target architecture)

Status: concept, no code yet. Sources: `docs/index/01_BODY_ORIGINAL.md`, `docs/index/04_PHYSIFY.md`,
`docs/research/10_PM_BODY_RESEARCH.md` (cited as R10 §x), platform rules `docs/index/03_AMORPH_PLATFORM.md` (P03 §x).

## 0. Decisions in force (owner, 2026-10-16)
- Stays an Amorph **FX** (`Amorph_FX` binary): audio in → bodies → audio out. No MIDI.
- No provisional solutions: the seven original bodies get real body physics even if their sound changes; identity is kept through the same morph order, contact behaviour and loudness discipline.
- Parameter budget: up to 128 slots; use what the design needs (P03 §1). New parameters are appended, `param1..param5` keep their meaning.
- Telemetry: as many output events as the UI needs.
- CPU: no ceiling during design; measured at the end (cmaj JIT bench as in PHYSIFY `m0/BENCH.md`).
- Credit "based on BODY by Artists in DSP" in manifest description and README.
- Branding: manifest `manufacturer = "CLΞΛRPΞΛK"`, brand line in the UI header (DEV-Kit `docs/15_BRANDING.md`, 9ce8d6d). Rules and recipes from the newest kit branch `claude/vibrant-faraday-cmymob`.
- All bodies are specified individually in `22_BODIES.md`.

## 1. How the professionals do it: tables *and* formulas
The research (R10 §1-§2) shows three layers used together by every serious product and paper:
1. **Generator formulas** for idealised objects: membrane (Bessel ratios 1 : 1.594 : 2.136 …, air-loaded timpani 1 : 1.5 : 1.98 : 2.44), plate/soundboard (dense log-spaced sections, constant loss factor η), beam/bar, string (stretched partials), tube (cylinder = odd series, cone = full series). Corpus, Chromaphone, Rings and Faust `physmodels` are built this way (R10 B2, B3).
2. **Measured tables** for real instrument bodies: guitar signature modes 103/205/286/436 Hz with Q≈20, violin A0/CBR/B1−/B1+ corpus means, piano soundboard η≈2.3 % and 22 Hz mode spacing, bore cutoffs 0.8-1.5 kHz (R10 B4). Logic Sculpture, ToneDexter and Bank's parallel-filter method derive bodies from measured responses (R10 B1, B2).
3. **Laws with few parameters** on top: Aramaki damping α(ω)=αG+αR·ω ("Material"), position = cosine mode gains, brightness = upper-mode Q/gain tilt (Rings `resonator.cc`, R10 B3), size = log shift of fixed body resonances (Sculpture Formant Shift).
Nobody hard-codes per-mode literals the way BODY does today, and nobody interpolates filter coefficients directly (R10 B5).

**RE·BODY therefore uses a body *recipe* = generator + measured overrides + material law, compiled offline into flat tables.**

## 2. Signal architecture (per sample, kept from BODY where it is already right)
```
in → NaN guard, DC block, clamp, bypass fade                 (BODY:587-590, keep)
   → onset/novelty detector + "Touch" sensitivity              (BODY:591-594, keep, expose)
   → per-engine feed = f(morph weights), tail holding          (BODY:126-172, keep)
   → LINE engines (waveguides) → MODAL body bank → calibration
   → shared stereo balance, input-referenced protector, knee   (BODY:844-889, keep)
   → mix → out ; meters + telemetry events
```
Two engine families, both table-driven:
- **MODAL body bank** (one structure, N slots): drum heads and shells, snare rattle shell, piano soundboard, guitar/ukulele box (Helmholtz + plate pair + signature modes), fiddle body, sax brass body, oboe nasal cluster, air modes. Complex one-pole (phasor) modes as in BODY:604-613 — click-free under modulation by construction (R10 B1 Mathews/Smith, Laroche).
- **LINE engines** (fractional-delay loops): clarinet cylinder (BODY:636-656), sax and optionally oboe as truncated-cone "blowed string" with blow-point β and lattice cutoff as table values (BODY:768-826, R10 B1 Scavone), piano string pair with dispersion (BODY:658-677), ukulele string with pick comb (BODY:680-710).
- Coupling line → body is one-way (commuted-synthesis argument, R10 B1 Bank 2010 / Smith). The Obosaxolele coupling stays acyclic as in BODY:712-734. A passive 3-port bridge (PHYSIFY `DSP:2907-2955`) is reserved for a later "wolf" option.

## 3. Body recipe and table format
Offline tool `tools/bodytab.py` (Python, stdlib + numpy) turns `bodies/*.json` recipes into flat Cmajor arrays and a UI JSON mirror.
Recipe (per body):
```
name, generator (membrane|plate|box|bar|tube_body|cluster), nModes (≤48),
anchor: { root_hz_law: drum|note, decay_seconds_at_50 },         # keeps BODY's Tune/Decay feel
material: { alphaG, alphaR, eta },                                 # damping law anchors (R10 B4)
modes[]: { f (ratio or fixed Hz), fixed:bool, t60_mult or eta, gain, posL, posR, flex }
line: { kind: none|cylinder|cone|string|string_pair, beta, cutoff_hz, dispersion, reed:{...} }
contact: { sustain, novelty_power }                                # BODY per-body "sustain" (BODY:23,194-201)
calibration: { out_gain, energy_target }                           # BODY:831-843, :427
```
`fixed:true` marks resonances that do **not** follow Tune (real body resonances do not move with the played note, R10 B1 Woodhouse); `Size` (line block #11) scales them instead.
Emission strategy (to validate with `cmaj` first, PHYSIFY note on large literals): namespace-scope constant arrays, else processor members assigned at `main()` start. Manifest `externals` only if Amorph is shown to load them.
Capacity: 48 modes × ~11 bodies ≈ 530 complex stereo modes ≈ 1 % of one core at 48 kHz by PHYSIFY's bench (R10 §4 cost basis); tail-holding means every body can carry state, so the bank is sized for all bodies, not two.

## 4. Damping law and the Material axis
Per mode: `T60 = ln(1000) / (αG + αR·ω)` with per-body (αG, αR) presets, scaled by Decay (line block #2, log as BODY `anchorSeconds`) and tilted by Material (line block #10): 0 = damped/soft (αR high, soundboard-like η 3 %), 50 = recipe default, 100 = hard/ringing (αR low, metal/bell-like). Anchors: soundboard η≈2.3 % → T60≈96/f s; violin corpus ζ∝f^−0.45; membranes short, metal long (R10 B4, PHYSIFY `DSP:568-585`). Control rate only (one `exp` per mode per 32 samples, BODY's stepping idiom).

## 5. Parameters (append-only after the original five; line blocks, see §12)
Three identical **lines** A, B, C (§12). `param1..param5` keep BODY's meaning: Tune, Decay and Morph of **Line A**, Mix and Bypass global. Every other parameter is appended in fixed blocks so the scheme is mechanical for DSP, UI and tools.

**Global**
| id | name | range / init | meaning |
|---|---|---|---|
| param3 | Mix | 0..100 / 45 | dry/wet of the summed lines |
| param5 | Bypass | 0/1 | as BODY |
| param6 | Width | 0..100 / 50 | stereo: L/R mode-position offsets, all lines |

**Line block** (A: `param1`, `param2`, `param4` + `param7..param25`; B: `param26..param47`; C: `param48..param69`). Order inside a block:
| # | name | range / init | DSP meaning | UI |
|---|---|---|---|---|
| 1 | Tune | 0..100 / 58 | as BODY (drums size law, pitched note law C2..C5); ignored by `fixed` modes | main dial |
| 2 | Decay | 0..100 / 50 | global αG scale, log seconds per body | main dial |
| 3 | Morph | 0..10 / 7 | anchor position (22 §0); 7 = Clarinet = BODY's default stop | hero slider |
| 4 | Enable | Off/On / A On, B Off, C Off | line runs and sums; Off gates all its engines | button (in the line tab) |
| 5 | Level | −60..+6 dB / 0 | line wet level before the shared balance stage | small dial |
| 6 | Listen | All / Transient / Sustain / Low / Mid / High / Chain | which analysed component excites the line (§13); Chain = previous line's body output (A: falls back to All) | segmented buttons |
| 7 | Sensitivity | 0..100 / 50 | gain of the listened component into the contact stage | small dial |
| 8 | Excite | Through / Hammer / Pluck / Breath | Through = BODY contact; others = onset-triggered strikers (§14) | segmented buttons |
| 9 | Touch | 0..100 / 50 (= recipe default) | onset sensitivity vs sustained excitation; in Strike modes = velocity curve | advanced dial |
| 10 | Material | 0..100 / 50 | damping-vs-frequency law (§4) | main dial |
| 11 | Size | −100..100 / 0 | log shift of fixed-Hz resonances ±1 oct | advanced dial |
| 12 | Position | 0..100 / 50 (= recipe default) | excitation point (mode gains, pick/blow point β) | advanced dial |
| 13 | Bright | 0..100 / 50 | contact low-pass + upper-mode tilt | advanced dial |
| 14 | Body | 0..100 / 50 (= recipe default) | line engine ↔ modal body balance | advanced dial |
| 15 | Stretch | −100..100 / 0 | mode spacing around 1 kHz | advanced dial |
| 16 | Stiffness | 0..100 / 50 (= recipe default) | string dispersion, plate/bar inharmonicity (§15) | physics dial |
| 17 | Coupling | 0..100 / 50 (= recipe default) | string/bore → body feed, >50 adds bounded bridge reflection (§15) | physics dial |
| 18 | Air | 0..100 / 50 (= recipe default) | Helmholtz/air modes, air-loaded drum ratios, breath noise (§15) | physics dial |
| 19 | Reed | 0..100 / 50 (= recipe default) | reed stiffness/asymmetry, head tension, pick hardness (§15) | physics dial |
| 20 | Follow | 0..100 / 0 | Tune follows the tracked input pitch (0 = fixed Tune, 100 = full), 40 ms glide (§13) | small dial |
| 21 | Hold | Off/On / Off | linear freeze of the line's tails: injection muted, loop gains and modal radii → 1 − ε, no governor (§14) | button |
| 22 | Blend | 0..100 / 0 | in strike modes only: 0 = striker alone, 100 = Through alone, in between both excite the same body (§14) | small dial |
Display names carry the line letter (`A Tune`, `B Listen` …) so DAW automation lanes stay distinguishable; global names stay `Mix`, `Bypass`, `Width`. The machine-readable source of truth is `plugin/spec.json`.
69 parameters in total. All event handlers NaN/Inf-guarded and clamped (BODY:120-124); smoothing via BODY's 32-sample target stepping; ids exactly `paramN` (P03 §2a). Enum parameters use `text:` annotations and real buttons in the UI.

## 6. Morph
- Anchor order v1 (decided, see 22 §0): Bass Drum, Snare, Timpani, Piano, Guitar, Ukulele, Fiddle, Clarinet, Oboe, Sax, Obosaxolele. The hybrid segment is 9→10.
- Between two modal-bank bodies: **mode-level melt** — tables sorted by frequency, rank-paired *within the same class* (Tune-following modes with Tune-following, fixed-Hz with fixed-Hz; unmatched modes fade in/out by gain), polar interpolation of log f, log T60 and gain, stepped every 32 samples (R10 B5, PHYSIFY `CORE:148-165`).
- Between a line engine and anything: BODY's sqrt-weight energy crossfade with tail holding (BODY:147-172, :203-272).
- Hybrid segment: BODY's acyclic coupling (uke bridge → oboe cluster → sax bell) retained.
- Shared register/decay blending across active bodies as BODY:203-272.

## 7. Engine gating and loudness
- Skip a line or modal engine when its weight is 0 and all its states are below the flush threshold (BODY already flushes <1e-12).
- Loudness: generalise BODY's closed-form modal energy normalisation with cross terms (BODY:282-301) to every modal body, cached at control rate; per-body `out_gain` from the recipe; balance + protector + knee unchanged.
- Modal feedback never exceeds |r|<1 by construction; DC-block wet per channel (P03 §2c).
- Nyquist culling: modes and bore/formant targets above 0.45 × fs are skipped or clamped at every sample rate (PHYSIFY `DSP:625-634`, Rings `resonator.cc`); delay buffers sized for 96 kHz.

## 8. Telemetry (output events, ~30 Hz, host-rate meters, zero cost when idle)
| endpoint | type | content | UI use |
|---|---|---|---|
| bodyViz | float<4> | input, wet, L, R peaks (BODY compat) | lamp, breathing |
| bodyBands | float<8> | summed wet energy in 8 log bands (60 Hz-10 kHz) | layer vibration modes |
| bodyOnset | float | shared `onset` 0..1 (BODY:593) | strike push, ripple |
| lineStateA/B/C | float<16> | [wet, onset, listenEnergy, followHz, hold, engine0..engine10] per line | tabs, weight bars, silhouettes, captions |
| lineModesA/B/C | float<16> | energy of the 16 loudest modes of the line's dominant body | standing-wave markers |
| analysisViz | float<6> | transient, sustain, low, mid, high energies, pitch confidence | listen selector feedback |

## 9. Validation plan (ported from PHYSIFY tooling, R10 §4 rec. 8)
- `cmaj test`: tables finite and sorted, every |r|<1, row sums, recipe → coefficient round trip.
- Render tests (`cmaj render`, init-patching trick from `tools/golden_ci.py`): impulse and zero-mean noise per anchor at default and extreme Decay/Material → peak positions vs table, band T60, A0 peak for boxes, |DC|<0.01, finite decay, tri-rate 44.1/48/96 kHz.
- Loudness gate per anchor: pink noise at default settings, Mix 100 → wet within ±3 dB of dry (BS.1770 short-term, PHYSIFY `analyze.py`); no gain jumps > 2 dB across a full Morph sweep.
- Amorph `run_qa_probe` conditions (P03 §2c), then listening.
- CPU: bench at the end, JIT, 48 and 96 kHz, all bodies with tails active.

## 10. Milestones
See `docs/plan/30_DEV_PLAN.md` §1 (P1-P8). Line A is verified completely before B and C are enabled; the line structure exists from P1 on (enabling, not rebuilding).

## 11. Fine questions (later)
Per-body *(design)* values in 22; whether Stretch stays; hybrid anchor label.

## 12. Lines: three bodies listening to different parts of the input
A **line** = one complete BODY-style chain (feeds, engines, modal bank slots, calibration, tail holding) with its own parameter block (§5). Three lines run in parallel; each line's wet goes through Level, then the shared balance and protector stage (BODY:844-889), then Mix. The structure is an array of three identical line states in one processor; Line A alone reproduces BODY.
```
in → conditioning → ANALYSIS (transient/sustain split, 3-band split, onset, pitch) ─┬→ Line A ─┐
                                                                                   ├→ Line B ─┼→ Level → balance/protector → mix → out
                                                                                   └→ Line C ─┘
Chain: Line B may take Line A's body output instead of the analysis bus; C may take B's. Never backwards (acyclic, stable).
```
Loudness: per-line energy normalisation as today, the protector works on the sum against the input peak reference; Level is pre-balance so lines can be mixed without re-triggering the protector.
Cost: three banks ≈ 3 × (≈1 % core) at 48 kHz by PHYSIFY's bench; disabled lines cost nothing (engine gating §7).

## 13. Analysis stage (host rate, shared by the lines)
- **Transient / sustain split**: two envelope followers on the conditioned input (fast 1 ms / 20 ms, slow 20 ms / 150 ms); transient gain `g = clamp((fast − k·slow) / (fast + ε))` smoothed; `transient = x·g`, `sustain = x − transient`. Sum is exactly the input (complementary) *(design, classic transient-designer split)*.
- **Band split**: Linkwitz-Riley 2nd-order pairs at 200 Hz and 2 kHz → Low / Mid / High; LR2 sums flat only with the high-pass inverted, LR4 sums flat in phase: use LR4 (two cascaded Butterworth biquads per side) so Low + Mid + High equals the input in magnitude (allpass sum). Feed-forward, no stability concern.
- **Onset**: BODY's novelty detector (BODY:591-594) shared; each line scales it with Touch and gates its strikers (§14) with hysteresis and a 30 ms refractory time.
- **Pitch** (for Follow): decimated-by-4 copy (12 kHz), YIN-style difference function over lags for 40 Hz-1.2 kHz, window 512, hop 128, confidence gate, median of 3, output in semitones; glide 40 ms; runs only while any line has Follow > 0 *(design; cost ≈ 1-2 k flops/sample while active, measured in P7)*.
- `analysisViz` reports the five energies and the pitch confidence.

## 14. Excite modes, Chain and Hold
- **Through**: BODY's contact law `x·feed·(sustain + (1−sustain)·novelty)` per body.
- **Hammer**: onset triggers a Hertz-contact force pulse (PHYSIFY `DSP:913-1004`, `:2060-2131`), velocity from onset energy (log map, Touch = curve), 1-4 ms, into the line engine or modal input; the audio itself is not injected.
- **Pluck**: onset triggers a one-period displacement burst at the line's pitch with the position comb (BODY uke contact), for non-string bodies a position-filtered impulse.
- **Breath**: onset triggers a noise burst (20-80 ms envelope) through the reed shaping into bores, through the contact low-pass into modal bodies; while the listened component stays above threshold the burst sustains (breath follows the pad).
- Strikers live in `namespace strikers`, shared by the lines; velocity and position come from the line parameters.
- **Chain**: Listen = Chain feeds the previous line's body output (post-calibration, pre-Level) × Sensitivity into this line's contact stage; onsets for strikers are detected on that chained signal. If the source line is disabled or held, the chained signal is its (muted or frozen) output, nothing else.
- **Hold** (linear freeze): all injection into the line is muted, loop gains and modal radii move to `1 − ε` (T60 ≈ 60 s) via PHYSIFY's T60-exact loss maths (`CORE:79`), no governor and no nonlinearity in the path; the stored state rings on unchanged. Releasing restores the recipe decay and the injection with the 32-sample ramps (click-free). Rule: Hold off = the identical code path as without Hold. Playing *into* a held body is done with a second line in Chain mode fed by the held line.
- **Blend**: in strike modes the striker and the Through contact can excite the same body; Blend crossfades them (equal-power). At 0 the audio is not injected at all (pure striker).

## 15. Physics knobs: one meaning per knob, mapped per body
Each recipe carries a `physics_map` (22 §13) so the same knob is sensible on every anchor:
| knob | strings (piano, guitar, uke, fiddle) | drums (bass, snare, timpani) | bores (clarinet, oboe, sax) | modal-only bodies |
|---|---|---|---|---|
| Stiffness | dispersion allpass coefficient (BODY:70, :357-358) | mode-ratio stretch `r_k·√(1 + B·k²)` | slight bore dispersion | plate/bar inharmonicity |
| Coupling | string → body feed; >50: PHYSIFY 3-port bridge reflection ρ ≤ 0.25 (bounded ≤ 0.99) | head ↔ shell feed | bell reflection coefficient | body → body feed in Chain |
| Air | Helmholtz/air-mode gain and A0/T1 coupling | ideal ↔ air-loaded ratio blend, kettle mode | breath-noise amount | air-mode gain |
| Reed | pick/hammer hardness (contact low-pass) | head tension: glide depth and (0,1) damping | reed offset/slope, asymmetry | contact low-pass |
Not offered: editing single modes (that is Modalys, not BODY).
