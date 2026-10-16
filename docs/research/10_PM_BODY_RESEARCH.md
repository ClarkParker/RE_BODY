# 10 - Physically modelled instrument bodies excited by arbitrary audio (RE·BODY research)

Compiled 2026-10-16. English. Every claim carries a source number `[n]` (section 6) or is tagged *(inf)* = my inference.
`P` = primary (paper, official manual, source code, patent); `S` = secondary (review, press, forum, earlier PHYSIFY research).
`full` = full text read (PDF extracted locally); `abs` = only abstract / search summary / docs page read.
Local baselines: BODY = `reference/body_original/dsp.cmajor` (cited `BODY:line`), PHYSIFY = `docs/index/04_PHYSIFY.md` (cited `PHY:file:line`).

## 0. Method

- **Buckets** (as briefed): B1 academic, B2 commercial audio-in bodies, B3 open code, B4 measured data, B5 morphing.
  Per bucket ≥3 candidates from different sources, then cross-bucket comparison (s2) and ranking (s4).
- **Volume**: ~40 web searches (standard + extended), ~35 fetches, 9 PDFs text-extracted (Bank 2007/2010, Ege 2013,
  Bissinger 2008, Penttinen 2000, Scavone 2002, Chen sax, Cook 1998, Acoustics Today drums), GitHub code search over `extension:cmajor`.
- **Not repeated** (already in PHYSIFY research 01/02/04/06/14): product landscape at large, nonlinear plates/gongs, friction,
  vocal tract/KL, EM sustain, Aramaki material law (only cross-checked), granular. Cited as `[S: PHYSIFY nn]` when used.
- **Excluded and why**: full FDTD/NESS bodies and 3D air (offline/GPU class, wrong CPU tier for an FX) [25]; neural/differentiable
  capture (PHYSIFY 07 verdict "watch"); products without external-audio excitation (Plasmonic: internal oscillators/impulses only [38];
  Prism/Kontour/Atoms/Anukari are instruments [40]); Unfiltered Audio (no resonator/body product found; only a vinyl model);
  paywalled JASA full texts (Rossing 1992 snare, Fletcher & Bassett 1978 bass drum, Christensen & Vistisen 1980) - abstracts only.

## 1. Findings per bucket

### B1 - Academic (body models, coupling, stability)
| Candidate | Src | Core idea | Relevance to audio-excited bodies | Cost / stability | Verdict |
|---|---|---|---|---|---|
| Fixed-pole parallel 2nd-order sections (Bank 2007) | [2][3] P full | Poles on a log (or warped) grid, numerators by linear LS fit to a measured IR | Turns any measured body IR into a "modal" bank; guitar body: FIR needs ≥1000 taps, IIR 500-1000, warped IIR 100-200, parallel ~4x lower order than IIR; 25 log sections (order 50) to 100 (order 200) shown | LS fit has unique optimum; same poles for several outputs; morphing and size/decay edits by moving pole angle/radius are explicitly supported | **Top** (data path for measured bodies) |
| Modal piano incl. soundboard (Bank, Zambon, Fontana 2010) | [4] P full | Strings as 2nd-order resonators; soundboard as FFT convolution or parallel filter; 5-10 extra resonators for beating | Soundboard impedance ~1000x string, so coupling "only" shifts string mode freq/decay -> one-way coupling is defensible | FFT conv of 20000-tap board, N=128: 633 flops/sample; parallel filter = "fully modal" alternative | **High** |
| Warped-filter body + one-parameter size modulation (Penttinen, Härmä, Karjalainen 2000) | [5] P full | Run a warped body filter with a "wrong" λ -> similar smaller/larger body (Lansky & Steiglitz); real-time pedal effect on guitar pickup signal | Exactly an audio-in body effect with continuous size morph | Warped structures costlier per order; high orders stay stable | Medium (in modal form, scaling mode freqs is cheaper *(inf)*) |
| Morphing instrument body models (Penttinen, Karjalainen, Härmä 2001) | [6] P abs | Low body resonances as 2nd-order IIR, rest as 100th-order WIIR; interpolate reflection coeffs or log-area ratios | Guitar->violin morph; LAR also extrapolates; lowest mode moves 104 Hz -> >270 Hz | Direct coefficient interpolation is not stable; RC/LAR keep every step stable | Medium (B5 reference) |
| Joint bridge admittance + radiativity on one shared resonator bank (Maestre, Scavone, Smith 2017) | [7] P abs | Modal decomposition of measured admittance; reflectance and radiation from the same passive resonator bank | The template for a body that both talks back to a string/bore and radiates, at modal cost | Passivity is a design goal of the method | High for coupled bodies |
| Guitar pluck synthesis by admittance coupling (Woodhouse 2004) | [8][9] P/S full-ish | Rigid connection: 1/Ycoup = 1/Ystring + 1/Ybody; frequency-domain or modal synthesis; veering when a string mode meets a body mode | Body-string coupling matters near coincidences (wolf/veering); damping handling is "central" | Frequency domain = offline; modal route "fiddly" | Medium (justifies one-way default) |
| Helmholtz air mode + top-plate 2-DOF (Christensen & Vistisen 1980) | [12] P abs, [11] S | Two lowest guitar peaks = coupled plate + cavity; params from 3 measured frequencies | Missing in BODY: uke has only 2 fixed wood modes (BODY:543-549) | Linear 2-DOF, solve once at control rate; example 150 Hz plate + 129 Hz cavity -> 97/200 Hz [11] | **High** (cheap, characteristic) |
| Modular membranes + lumped air coupling + tension modulation (Avanzini & Marogna 2010) | [15] P abs | Modal membrane, two heads coupled via enclosed air, pitch glide from tension modulation | Supports BODY's onset pitch-tightening (BODY:308) and suggests coupled-head pairs | Real-time modal class | High for drums |
| Conical bores: "blowed string" (Scavone 2002); bowed-string analogy (Ollivier et al. 2004); idealized conical models (Kergomard et al. 2016) | [16] P full, [17][18] P abs | Truncated cone ≈ string excited off-centre; truncation length plays bow position; blow point at 1/n removes harmonics n,2n..; mouthpiece volume = missing cone | Cheapest robust sax/oboe bore; truncated-cone waveguides have inharmonic modes and instabilities [16] | "Most computationally efficient, exceptionally robust" [16]: 2 interpolated delays + 1-pole + reed function | **High** (BODY Sax already close, s3) |
| Phasor / coupled-form resonators under modulation (Mathews & Smith 2003; Laroche 2007) | [19] P, [20] P abs | Complex-multiply resonator: abrupt freq/decay changes give no audible transients (200 filters tested); coupled form is stable time-varying if poles inside unit circle; direct forms are not | BODY's complex one-pole modes (BODY:610) are this family -> morph-safe by construction | 1 complex MAC + 2 real mults/mode/sample [22] | **Keep** (foundation) |
| Modal reverberator architecture (Abel et al.; Abel & Werner DAFx-15) | [22] P | Thousands of parallel complex modes from measured IRs; per-mode pitch shift/decay edits | Proves per-mode manipulation of measured bodies at scale | 1 complex MAC + 2 mults + 6 samples state per mode | Medium (cost anchor) |
| Commuted synthesis (Smith; Karjalainen et al.) | [23] P | LTI string and body commute; body IR folded into excitation table | In an FX the input *is* the excitation, so the body filter can sit before or after a linear string loop with identical result *(inf)* | Breaks with nonlinear/bidirectional coupling [23][S: PHYSIFY 04 A8] | Low (insight only) |
| Port-Hamiltonian / passive guaranteed schemes (Falaize & Hélie; Lopes et al.) | [24] P abs | Power-balanced state space + structure-preserving discretisation | Needed only if RE·BODY adds nonlinear or bidirectional couplings | Explicit 2nd-order passive schemes exist [24] | Low for v1 (PHYSIFY bound suffices) |
| Hybrid/"unreal" instruments: NESS modular networks; smart instruments (active modal control) | [25] P, [26] P abs | User-designed bores/membranes with virtual pickups; real guitars whose body modes are altered by feedback control | Evidence that re-tuning body modes and string-body coupling is musically meaningful | NESS = offline-class | Context only |

### B2 - Commercial products that put a resonant body on incoming audio
| Product | Src | Body types | Exposed user params (core) | Morph / hybrid | Praise / criticism | Verdict |
|---|---|---|---|---|---|---|
| Ableton Corpus (AAS) | [30] P, [39] S | Beam, Marimba, String, Membrane, Plate, Pipe, Tube; 2 resonators (L/R) | Decay, Material (damping across freq), Radius (tubes), Ratio (membrane/plate), Bright, Inharm, Hit, Pos L/R, Tune/Spread, Bleed | Type chooser only; Spread detunes L/R pair | De-facto "drums into marimba"; criticised for gain jumps, mono MIDI tuning [39] | Param vocabulary reference |
| AAS Chromaphone 3 (instrument, two coupled resonators) | [31] P/S | String, open/closed tube, plate, drumhead, membrane, bar, marimba bar, manual | Decay, material, position, density/inharmonicity, tone; tubes only Decay/Release/Radius [31] | Coupled vs uncoupled resonator pair | CPU complaints [S: PHYSIFY 01] | Coupling precedent |
| AAS Objeq Delay 2 (Apr 2026) | [32] P/S | Membrane, drumhead, plate, string, beam, marimba | Resonator + filter + 4 delay topologies, inversion | **Morph between resonator types**, automatable | No independent test of morph quality found | Closest morph precedent |
| Mutable Rings (audio IN) | [33] P, [41] P | Modal, sympathetic strings, inharmonic string | Structure, Brightness, Damping, Position | Continuous structure (stiffness) | "Guitar/drums through Rings" genre; mono in [S: PHYSIFY 02] | Benchmark for musicality |
| Logic Sculpture Body EQ | [34] P | Body models derived from IRs of real instrument bodies | Formant Intensity (0 = flat, <0 inverts), Formant Shift (log, ±0.3 = 1 oct), Formant Stretch (spacing around 1 kHz), Fine Structure | Shift/stretch = continuous size morph | Fine Structure "CPU intensive" [34] | **Param model to copy** |
| Audio Damage Tessera (Jul 2026) | [35] S | 11 models: KS string, bowed WG, banded WG bars/glass/bells/bowls/membranes/plates/tubes; 12 voices | Decay, damping, brightness, spread; chord/scale tuning | Not mentioned | New, no reviews | Shows banded WG as body alternative |
| reFX Rippler / RipplerX | [36] S, [46] P | 9-12 Chromaphone-like models | Material, Inharmonicity, Ratio, Tone | Serial/parallel coupling of 2 resonators | Sidechain excitation is a selling point | Open twin in B3 |
| ToneDexter / Fishman Aura (piezo -> mic body) | [37] S | Learned per-instrument IR ("WaveMap") applied by convolution | Preset slots only | None | Praised realism; trained with mic + pickup for ~2 min | Proof that a *measured* body IR on live audio sells |
| Physical Audio Preparation 2, lmdsp Superchord, Supermodal, Moodal | [39] S | FDTD strings/rattle; 12 sympathetic strings; 27 modal models; up to 1000 filters | - ; per-string tuning; Decay/Damping/Partials/XY; drawn decay-vs-freq curves | Supermodal XY morph; Moodal decay/gain-vs-freq curves | See PHYSIFY 02 | Already covered |

### B3 - Open implementations worth reading
| Code | Src / licence | Language | Algorithm | Approx. cost | Verdict |
|---|---|---|---|---|---|
| Mutable Rings `resonator.cc`, `part.cc` | [41] P, MIT | C++ | Up to 64 band-pass modes; partial i ≈ (i+1)·f0·stretch(stiffness); Q_i = 1 + f_i·q·Π(q_loss) (brightness lowers upper-mode Q); position = cosine-oscillator mode gains; odd/even modes to out/aux; modes above 0.49 fs skipped; resolution = 64/polyphony − 4 | Coefficients per block, LUTs | **Read first** (damping/position law in 6 lines) |
| Faust `physmodels.lib` | [42] P, LGPL-2.1 + exception | Faust (-> Cmajor backend [S: PHYSIFY 09]) | `modeFilter(f,t60,g)` SVF mode (~3 mults); `modeInterpRes`: 9 measured 3D-printed bodies, ≤40 modes, **index-paired bilinear interpolation** of f/gain/T60 over shape×scale; `violinBody` = one `resonbp(500,...)`; `guitarBody` "not implemented" | ≤40 SVF modes | Good morph reference, weak bodies |
| STK `Bowed`, `Mandolin`, `Saxofony` | [43][44][45] P, file header carries waveguide patent notice (licence not checked here) | C++ | Bowed: violin body = cascade of 6 biquads (Maestre 2011 coefficients); Mandolin: commuted synthesis, 12 body IR files, body size = IR playback rate; Saxofony: "blowed string", blow position 0.2, reed table offset 0.7/slope 0.3 | 6 biquads; trivial | Body-filter and cone references |
| RipplerX | [46] P, GPL-3.0 | C++/JUCE | Chromaphone-like 9 models, ≤64 partials, serial/parallel coupling, audio input via keys | ~2x64 modes | Read for model formulas (GPL: no code reuse) |
| Csound `streson`; SC `DWGSoundBoard` | [47][48] P | C | streson: comb + LP + allpass string resonator on audio input; DWGSoundBoard: 8 delays (199..241 samples) FDN-type board, undocumented | Trivial | Low (FDN board = reverb-like, not modal) |
| chalkwalk-physical | [49] P, MIT | C++17 | Modal bars/plates, WG with 5th-order Lagrange, in-loop DC blocker with phase-delay compensation | - | Low-medium |
| Cmajor ecosystem | [50][51][52] P | Cmajor | GitHub code search `extension:cmajor`: 0 hits for waveguide/modal/karplus, 4 for "resonator" (Everither: 12 integer-delay combs/channel, feedback ≤0.98·amount); Amorph QA fixture `modal_resonator_dc_safe` = tanh + DC blocker only | - | **No prior Cmajor PM body art beyond BODY/PHYSIFY** |
| Bank `parfilt` tools | [3] P | MATLAB | Offline LS design of fixed-pole parallel filters (guitar admittance example) | Offline | **Tooling for B4 import** |

### B4 - Measured data you can cite with numbers
| Body | Src | Numbers | Use in RE·BODY |
|---|---|---|---|
| Classical guitar | [10] S(Woodhouse) ,[64] P, [11] S | Signature modes 103, 205, 286, 436 Hz; A0 between ~82-110 Hz; body-mode Q 19.4 and 21.8 (two guitars); 2-DOF example -> 97/200 Hz | Guitar body table; A0/T1 pair |
| Violin (17 instruments) | [14] P full | A0 275±9, CBR 407±31, B1− 475±16, B1+ 541±22, A1 469±19 Hz; A1/A0 = 1.71±0.05; total damping ζ ∝ f^x, x ≈ −0.40..−0.45 (corpus), plates x≈0; mode freqs and damping are **not** quality indicators | New "fiddle" body; damping-law anchor |
| Upright piano soundboard | [13] P full | Loss factor η 1-3 % (mean 2.3 %, 55 modes, ≤1.2 kHz); lowest 4 modes rim-dominated; mean spacing 22 Hz (21 lowest); density → 0.06 modes/Hz below 1.1 kHz; overlap 30 % @150 Hz -> 100 % @1 kHz; FEM modes 84, 127, 194, 204, 229, 271, 301 Hz | Constant-η law: T60 ≈ ln(1000)/(π η f) ≈ 96/f s at η=2.3 % *(inf, arithmetic)* |
| Timpani / toms / snare / bass drum | [60] S, [61][62][63] P abs, [70] S | Timpani (1,1)..(5,1) = 1.00:1.50:1.98:2.44:2.91; toms tunable to ~1:1.5:2 via coupled heads; ideal membrane (1,1)/(0,1) 1.594, (2,1) 2.136; snare: coupled head pairs, parallel (0,1) ~180-200 Hz; bass drum components 40-1000 Hz, frequencies fall as amplitude decays (no open per-mode table found) | Drum tables; onset glide justified |
| Ukulele | [65] S | No peer-reviewed table found. Builders: soprano body resonance ≈ D4 −19 ct (~290 Hz); top resonance +25 % when it equals the Helmholtz frequency | Treat uke modes as design values *(inf)* |
| Clarinet / oboe / bassoon / sax | [69] S abs, [66][67] S, [68] P full | Lattice cutoff: clarinet ~1150-1450 Hz; oboe ~1.5 kHz; bassoon ~0.6 kHz; tenor sax 760±250 Hz, soprano 1340±240 Hz. Cone half-angle: oboe 0.71°, bassoon 0.41°, tenor sax 1.52°, soprano 1.74°. Double reeds: low harmonics may exceed the fundamental; bassoon formants 440-500 and 1220-1280 Hz | Loop low-pass / formant anchors |

### B5 - Morphing between bodies
| Strategy | Src | What is interpolated | Clicks / stability | Verdict |
|---|---|---|---|---|
| Polar pole interpolation in phasor/coupled-form banks (rank/index paired) | [19][20], [42] P, PHY:CORE:148-165 | log f, log T60 (r), gain per paired mode | Stable if both endpoints |r|<1 and per-sample/32-sample ramps [20]; mode crossing when tables differ in order *(inf)* | **Use** (BODY+PHYSIFY already do parts) |
| Fixed shared pole grid, morph numerators only | [2][4] P | Only feed-forward coefficients | Trivially stable (poles fixed) *(inf from structure)*; size/decay need pole moves | **Use for measured bodies** |
| Energy crossfade of two running banks (Modalys mix-hybrid; BODY today) | [21] P, BODY:147-172 | Excitation share by position | No pairing artifacts; 2x cost mid-morph; "two bodies" sound | Keep as fallback |
| Mode-level melt (Modalys melt-hybrid) | [21] P | Modal data of two objects, 0..1 | Works across classes ("string into air column") | Same as row 1 |
| RC / log-area-ratio interpolation of high-order body IIR | [6] P abs | Lattice coefficients | Stable each step, LAR extrapolates | Too heavy for v1 |
| Warping coefficient λ as size | [5] P | One allpass parameter | Continuous, stable for |λ|<1 | Superseded by mode scaling *(inf)* |
| Formant shift/stretch on a body EQ | [34] P | Log shift, spacing | Product-proven | **Expose as Size/Stretch** |
| Optimal-transport / unequal-feature partial matching | [71][72] P abs | Pairing of unequal partial sets | Real-time OT exists; best without sharp attacks [71] | Offline pairing tool only |
| Learned/measured modal parameter maps | [73] P abs, [53] P | f and power vary smoothly with location -> interpolate instead of crossfading IRs | Manual mode matching in practice [53] | Supports row 1 |

## 2. Cross-bucket comparison

- **Modal vs waveguide for bodies - agreement.** Academia models bodies as parallel 2nd-order resonators [2][4][7][22]; products use modal
  banks for bodies [30][31][32][46] and reserve waveguides for strings/tubes (Tessera adds banded WG for bars/bowls [35]); open code agrees
  (Rings, Faust `modeFilter`, STK body biquads [41][42][43]). Waveguides win only where the body *is* a 1-D bore (sax/clarinet) [16].
- **Mode count - disagreement.** Measured-fidelity work needs 50-200 sections for a guitar or soundboard [2][4]; products and open code
  run 2-64 idealised modes [41][42][46]; BODY runs 2-10 per body (BODY:41-43, :114-118, :543-554). The euphonics data says shifting the
  band-averaged formant is clearly audible while moving individual resonances is subtle [10], and violin mode frequencies/damping do not
  separate good from bad instruments [14] -> envelope + damping regime matter more than exact mode positions *(inf from [10][14])*.
- **How "material / size / decay" are parametrised - convergence.** Corpus: Decay + Material (damping across frequency) + Bright + Inharm
  + Hit/Pos [30]; Rings: Damping + Brightness + Structure + Position [41]; Tessera: decay, damping, brightness [35]; Sculpture: material pad
  + body formant shift/stretch [34]. This is the Aramaki two-parameter law α(ω)=αG+αR·ω plus a stiffness and a position term
  [27][S: PHYSIFY 14]. Measured laws fit inside it: soundboard ≈ constant η (αR-dominated) [13], violin corpus ζ ∝ f^−0.45 [14].
  BODY exposes Tune/Decay/Morph only; its per-body `times` vectors (BODY:43, :118) are fixed -> no material axis.
- **Morph strategies.** Products morph *types* (Objeq 2 [32]), XY between models (Supermodal [39]) or shift/stretch one body (Sculpture [34]);
  academia interpolates poles/LAR [6] or fixes poles [2]; open code interpolates paired modal parameters [42]. All avoid direct-form
  coefficient interpolation, which is not stability-safe [6][20].
- **Audio-in specifics - products differ from academia.** Academic body models assume a known bridge force [8][13]; FX products face unknown
  input and solve loudness (Corpus has an output limiter and Bleed [30]; Corpus users still report gain jumps [39]); ToneDexter learns the
  IR [37]. None of the inspected products shapes excitation by input *transients*; BODY's onset/novelty contact (BODY:591-594) is unusual
  *(inf: absent in [30][32][33][35] docs)*.
- **Stability.** Agreement: complex/coupled-form resonators for anything modulated [19][20][S: PHYSIFY 09]; passive or acyclic coupling
  [7][S: PHYSIFY 04]; Amorph platform rule row-sum ≤0.98 and DC-blocked wet [L4 s2c].

## 3. Gap analysis

| Topic | BODY original | PHYSIFY | Evidence | Gap for RE·BODY |
|---|---|---|---|---|
| Click-free modulated modes | Complex one-pole modes, 32-sample linear coefficient steps (BODY:313-325, :604-613) | Coupled form + 10 ms ramps (PHY s2) | [19][20] | None - keep |
| Audio-in contact shaping | Onset/novelty, per-body sustain, uke pluck contrast (BODY:591-594, :682-688) | Sidechain as gesture only | [S: PHYSIFY 02] | BODY's strength |
| Loudness | Closed-form modal energy norm with cross terms (BODY:282-301), input-referenced protector + knee (BODY:856-889) | LUFS-calibrated presets, autoG | [39] | BODY's strength |
| Damping law | Fixed per-mode multipliers, one log-seconds per body (BODY:43, :183-192) | Aramaki αG/αR with η anchors (PHY:DSP:568-585) | [13][14][27] | **Missing in BODY** |
| Air / Helmholtz modes | None; uke 310/690 Hz wood modes, Q≈6/3.5 *(inf: Q=T60·f/2.2 from 43/25 ms)* (BODY:543-549) | None (abstract archetypes) | [10][11][12][64] guitar Q≈20 | **Missing in both** |
| Piano soundboard | 3 modes at 185 Hz×(1,1.82,2.74), T60 95/59/38 ms (BODY:41-43, :316-317) | none | [13]: η≈2.3 % -> T60≈0.5 s at 185 Hz; ~22 Hz spacing | **Too sparse and ~5x too short** *(inf)* |
| Drum tables | Ideal Bessel ratios 1,1.586,2.128,2.65; snare 1,1.62,2.39; onset pitch glide (BODY:41, :308) | membrane table, mode-shape gains (PHY:CORE:104-145) | [60][63][15] | Coupled-head pairs, air-loaded ratios missing |
| Body-string coupling | Acyclic hybrid uke->oboe->sax only (BODY:712-734); pickup combs | 3-port bridge, |ρ|≤0.99 (PHY s2) | [4] one-way OK for piano; [8] veering for guitar | Optional; PHYSIFY has the tool |
| Conical bore | Sax = positive full-period loop + output comb at 0.17·delay (BODY:499-504, :804) ≈ blowed string with pickup point | none (cylindrical STK only) | [16][17][18] | BODY close; make β a table value |
| Lattice cutoff | Clarinet loop LP 1750 Hz (BODY:520) ≈ data 1150-1500; Sax loop LP 6600 Hz (BODY:530), body modes 780/1750 Hz | STK Tonehole 2-port | [68][69] | Sax cutoff should sit ~0.8-1.3 kHz *(inf from [68])* |
| Oboe | 8 fixed-ratio modes scaled with Tune (BODY:114-118) - a nasal formant cluster, no bore | none | [66][67]: conical 0.71°, cutoff ~1.5 kHz | Double reed + cone missing in both |
| Morph | sqrt-weight feed crossfade + shared log register, withdrawn bodies keep voicing (BODY:126-172, :203-272) | rank-paired log bilinear 4-corner `morphMode` | [21][42] | BODY lacks mode-level melt; PHYSIFY lacks >4 corners |
| Measured-table import | Hard-coded literals | Format proposed only (PHYSIFY 07) | [2][3] | **Missing in both** |
| Validation | none in repo | golden_ci, lhs_fuzz, tri-rate (PHY s6) | [L4 s2c] | Port to RE·BODY |
| CPU gating | All engines run every sample regardless of weight (BODY:604-826) *(inf from loop structure)* | staggered recompute, Nyquist culling | [41] skip >0.49 fs | Cheap win |

## 4. Ranked recommendations for RE·BODY v1
Cost basis: one complex/coupled-form mode ≈ 1 complex MAC + 2 real mults [22] ≈ 8 flops/channel, ~16-22 flops per stereo sample incl.
ramps *(inf)*; PHYSIFY measured 512 modes @48 kHz = 0.48 % of one core in cmaj JIT (PHY s1), i.e. ~0.001 %/mono mode.

1. **Data-driven body tables in one modal bank.** What: replace the hard-coded per-body literals with a table format
   (ratio or Hz, T60 multiplier or η, gain, L/R position gains, "fixed-Hz vs follows-Tune" flag) feeding one complex-mode bank of 24-32
   modes per channel per active body. Why: products/academia agree bodies are modal (s2); fixed-Hz flag matters because real body
   resonances do not follow the played note [10]. Evidence: [2][22][41][42], PHYSIFY 07 "format first". Cost: 32 modes ≈ 550-700 flops
   per stereo sample per active body (~0.06 % core). Risk: re-calibration of the fixed per-engine output constants (BODY:831-843).
   Builds on BODY:41-43, :313-325, :604-613 and PHY:CORE:104-165.
2. **Two-parameter damping law per body (+ optional Material param).** What: per-body (αG, αR) presets anchored on data - soundboard
   η≈2.3 % (T60≈96/f s) [13], corpus ζ ∝ f^−0.45 [14], membrane short, metal long [S: PHYSIFY 14]; Decay scales globally.
   Why: the one axis every product exposes (s2). Cost: control rate only (~1 exp per mode per 32 samples). Risk: low; changes tail colour
   of existing presets. Builds on BODY:183-192 (anchorSeconds) and PHY:DSP:568-585, :639-641.
3. **Helmholtz + top-plate coupled pair for Ukulele (and a new Guitar/Fiddle body).** What: compute the two coupled normal modes from
   cavity/plate frequencies and coupling (2-DOF quadratic [11]) at control rate, run them as two modes with Q≈20 class damping [64];
   Fiddle body from Bissinger signature modes [14]. Why: A0/T1 is the defining low-frequency body signature [10][12]. Cost: +2-5 modes
   (~50-110 flops). Risk: low; uke data is builder-grade only [65]. Builds on BODY:540-549, :694-701.
4. **Denser piano soundboard.** What: 24-48 fixed log-spaced sections (Bank) with constant-η decay, low edge ~85 Hz [13]. Why: 3 modes at
   95 ms cannot represent a board with ~22 Hz spacing and η 1-3 % [13]. Evidence: [2][4]. Cost: 24 sections ≈ 0.5 k flops, 48 ≈ 1 k
   (vs 633 flops/sample for 20000-tap FFT convolution + latency [4]). Risk: body becomes reverberant - tie T60 to Decay. Builds on BODY
   modes 7-9 (BODY:41-43) and Bank `parfilt` offline [3].
5. **Cone and lattice as table values for Sax/Clarinet (option: Oboe as cone).** What: make the existing Sax output-comb ratio (0.17,
   BODY:501) and loop low-pass explicit "β" and "cutoff" per body: Sax β≈0.15-0.2, cutoff 0.8-1.3 kHz [16][68]; Clarinet keep 1.75 kHz
   (matches [69]); optional Oboe = blowed-string cone with small β + ~1.5 kHz cutoff [66]. Cost: ≤1 fractional tap + 1 one-pole
   per channel (~20 flops). Risk: Oboe identity change - owner decision (s5). Builds on BODY:499-504, :520, :530, :768-826; STK Saxofony [44].
6. **Mode-level melt between adjacent bodies, energy crossfade as fallback.** What: when both neighbours use the unified bank, interpolate
   rank-paired log f / log T60 / gain (polar), keep BODY's 32-sample ramps; across incompatible engines keep today's sqrt-weight
   crossfade and tail holding. Why: matches Modalys melt and Faust practice [21][42]; stable for coupled form [20]. Cost: control rate
   (N cos/sin/exp per 32 samples); saves the 2x mid-morph bank *(inf)*. Risk: mode crossing - sort tables by frequency, pair by rank
   (PHYSIFY recipe). Builds on BODY:126-172, :203-272 and PHY:CORE:148-165.
7. **Drum upgrade: coupled-head pairs and air-loaded ratio option.** What: split (0,1)/(1,1) into parallel/antiparallel pairs [60][62],
   offer timpani-like 1:1.5:1.98:2.44 ratios as a Tune-dependent blend [60]; keep onset pitch glide (supported by [63][15]).
   Cost: +4 modes (~90 flops). Risk: low. Builds on BODY:41-43, :305-325.
8. **Tail-aware engine gating + measurement CI.** What: skip an engine when its weight is 0 and all its states are flushed (BODY already
   zeroes states <1e-12); port PHYSIFY `golden_ci`/`lhs_fuzz` with body metrics (peak positions vs table, band T60, A0 peak, |DC|, QA probe
   impulse+noise at default/extreme damping [L4 s2c]). Cost: negative (saves up to ~5/7 of engine time between two anchors *(inf)*).
   Risk: state-flush must be exact or tails click. Builds on BODY flush idiom (e.g. BODY:610-611) and PHY s6 tools.

Deprioritised for v1: bidirectional body-string bridge (piano coupling is effectively one-way [4]; use PHYSIFY's bounded junction later if
a guitar "wolf" is wanted [8]); warped/LAR body filters [5][6]; FDTD bodies [25]; port-Hamiltonian schemes (no nonlinear coupling planned) [24].

## 5. Open questions for the owner
1. Realism vs "exploratory bodies": may tables move BODY's existing seven toward measured data (s3), or only add new bodies?
2. Is a sixth parameter (Material = damping law, or Size/Stretch à la Sculpture [34]) acceptable, or must it stay 5 params?
3. Oboe: keep the abstract nasal modal cluster or rebuild as a conical double-reed bore?
4. Which new bodies first (Guitar, Fiddle, Timpani/Tom, Soundboard-only "Harp"?) and how many Morph anchors may the UI carry?
5. CPU ceiling: the platform gives no number [L4 s2b]; is "≤2x BODY original" the target?

## 6. Sources
B1 - [1] Karjalainen & Smith, Body modeling techniques..., ICMC 1996 (bibliographic) https://www.dsprelated.com/freebooks/pasp/Bibliography.html ·
[2] Bank, Direct design of parallel second-order filters for instrument body modeling, ICMC 2007 https://home.mit.bme.hu/~bank/publist/icmc07.pdf ·
[3] Bank, parfilt tools https://home.mit.bme.hu/~bank/parfilt/ · [4] Bank, Zambon, Fontana, A modal-based real-time piano synthesizer, IEEE TASLP 2010
https://home.mit.bme.hu/~bank/publist/taslp10.pdf · [5] Penttinen, Härmä, Karjalainen, Digital guitar body mode modulation..., DAFx-00
https://www.dafx.de/paper-archive/2000/pdf/dafx00_henripenttinen.pdf · [6] Penttinen, Karjalainen, Härmä, Morphing instrument body models, DAFx-01
https://citeseerx.ist.psu.edu/document?repid=rep1&type=pdf&doi=f1ff47921d54df0f4e3b41ef447e8f25e9d86c31 · [7] Maestre, Scavone, Smith, Joint modeling of bridge
admittance and body radiativity..., IEEE/ACM TASLP 2017 https://caml.music.mcgill.ca/doku.php?id=projects%3Apms · [8] Woodhouse, On the synthesis of guitar plucks,
Acta Acustica 2004 https://euphonics.org/wp-content/uploads/2022/03/Guitar_I.pdf · [9] Euphonics 5.4 https://euphonics.org/5-3-synthesising-plucked-strings/ ·
[10] Euphonics 5.3 signature modes https://euphonics.org/5-3-signature-modes-and-formants/ · [11] Euphonics 4.2.2 Helmholtz + body mode
https://euphonics.org/4-2-2-coupling-of-a-helmholtz-resonator-and-a-body-mode/ · [12] Christensen & Vistisen, JASA 68 (1980)
https://orbit.dtu.dk/en/publications/simple-model-for-low-frequency-guitar-function/ · [13] Ege, Boutillon, Rébillat, JSV 332 (2013) https://arxiv.org/pdf/1212.2323 ·
[14] Bissinger, Structural acoustics of good and bad violins, JASA 2008 http://strad3d.org/files/bissinger/JASA%202008%20Struct%20Acoust%20good%20bad%20violins.pdf ·
[15] Avanzini & Marogna, IEEE TASLP 18(4) 2010 https://avanzini.di.unimi.it/downloads/publications/avanzini_taslp10.pdf · [16] Scavone, Time-domain synthesis of
conical bore instrument sounds, ICMC 2002 https://ccrma.stanford.edu/~gary/papers/icmc2002a.pdf · [17] Ollivier, Dalmont, Kergomard, Acta Acustica 90 (2004)
https://www.researchgate.net/publication/233507722_Idealized_Models_of_Reed_Woodwinds_Part_I_Analogy_with_the_Bowed_String · [18] Kergomard et al., JASA 2016
https://hal.archives-ouvertes.fr/hal-01255920 · [19] Mathews & Smith, SMAC-03 https://ccrma.stanford.edu/~jos/smac03maxjos/ · [20] Laroche, JAES 55(6) 2007
https://www.aes.org/e-lib/download.cfm?ID=14168 · [21] Modalys Hybrid Objects https://support.ircam.fr/docs/Modalys/current/Objects/ObjectHybrids/index.html ·
[22] Modal reverberation patent https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9805704 ; Abel & Werner DAFx-15
https://dafx.de/paper-archive/details/Od6MkqdCBAhGwJSXGPqJzw · [23] J.O. Smith, PASP Commuted Synthesis https://ccrma.stanford.edu/~jos/pasp/Commuted_Synthesis.html ·
[24] Falaize & Hélie, port-Hamiltonian audio https://www.researchgate.net/publication/308530031_Passive_Guaranteed_Simulation_of_Analog_Audio_Circuits_A_Port-Hamiltonian_Approach ·
[25] Bilbao et al., The NESS project, CMJ 2019 https://www.ness.music.ed.ac.uk/wp-content/uploads/2019/11/cmj_ness_aam.pdf · [26] Benacchio et al., JASA 2016
https://hal.sorbonne-universite.fr/hal-01314828v1 · [27] Aramaki et al., IEEE TASLP 2011 (via PHYSIFY 14) https://hal.science/hal-00465085 ·
[28] Välimäki et al., Rep. Prog. Phys. 2006 (review, background) https://www.ece.uvic.ca/~bctill/papers/numacoust/V%c3%a4lim%c3%a4ki_etal_2006.pdf

B2 - [30] Ableton Live manual, Corpus https://www.ableton.com/en/manual/live-audio-effect-reference/ · [31] Chromaphone 3 manual
https://www.applied-acoustics.com/chromaphone-3/manual/ ; SOS https://www.soundonsound.com/reviews/aas-chromaphone · [32] Objeq Delay 2
https://www.applied-acoustics.com/press/aas-objeq-delay-2-press-release/ ; https://cdm.link/aas-objeq-delay-2/ · [33] Rings docs
https://pichenettes.github.io/mutable-instruments-documentation/modules/rings/ · [34] Apple, Sculpture Body EQ https://support.apple.com/guide/logicpro-ipad/lpipe6fa2300/ipados ;
https://support.apple.com/ar-kw/guide/logicpro/lgsia1339b0/mac · [35] Tessera https://www.synthtopia.com/?p=154099 · [36] Rippler
https://www.attackmagazine.com/news/refx-releases-rippler-a-dual-layer-physical-modelling-synthesiser/ · [37] SOS ToneDexter https://www.soundonsound.com/reviews/audio-sprockets-tonedexter ·
[38] Plasmonic https://synthanatomy.com/2020/12/rhizomatic-plasmonic-mpe-physical-modeling-synth-from-the-absynth-developer.html · [39] /home/user/PHYSIFY/docs/research/02_pm_effects.md ·
[40] /home/user/PHYSIFY/docs/research/01_pm_instruments.md

B3 - [41] Rings source https://github.com/pichenettes/eurorack/blob/master/rings/dsp/resonator.cc ; https://raw.githubusercontent.com/pichenettes/eurorack/master/rings/dsp/part.cc ;
licence https://raw.githubusercontent.com/pichenettes/eurorack/master/rings/dsp/dsp.h · [42] Faust physmodels.lib https://github.com/grame-cncm/faustlibraries/blob/master/physmodels.lib ;
https://faustlibraries.grame.fr/libs/physmodels/ · [43] https://github.com/thestk/stk/blob/master/src/Bowed.cpp · [44] https://github.com/thestk/stk/blob/master/src/Saxofony.cpp ·
[45] https://github.com/thestk/stk/blob/master/src/Mandolin.cpp · [46] https://github.com/tiagolr/ripplerx · [47] https://csound.com/manual/opcodes/streson/ ·
[48] https://depts.washington.edu/dxscdoc/Help/Classes/DWGSoundBoard.html · [49] https://github.com/chalkwalk/chalkwalk-physical ·
[50] https://raw.githubusercontent.com/Everither/resonator/main/resonator.cmajor · [51] /home/user/amorph-for-agents/tests/fixtures/cmajor/modal_resonator_dc_safe.cmajor ·
[52] GitHub code search `extension:cmajor resonator` / `extension:cmajor waveguide OR modal OR karplus` (2026-10-16) · [53] https://github.com/rmichon/modeMorphing

B4 - [60] Scott & Morrison, Acoustics Today 2022 https://acousticstoday.org/wp-content/uploads/2022/11/The-Acoustics-of-the-Modern-Jazz-Drum-Kit-E.-K.-Ellington-Scott-and-Andrew-Morrison.pdf ·
[61] Zhao & Rossing abstract https://pubs.aip.org/asa/jasa/article/85/S1/S33/730120/Modes-of-vibration-and-sound-radiation-from-a · [62] Rossing et al. 1992
https://www.semanticscholar.org/paper/Acoustics-of-snare-drums-Rossing-Bork/5542d42613d7c2b08c398a2059c82498c16fb9d1 · [63] Fletcher & Bassett 1978
https://www.semanticscholar.org/paper/Some-experiments-with-the-bass-drum-Fletcher-Bassett/e4fd231dd691ce296219c9708088463be2f2ac85 · [64] Sensors 24(16) 2024, classical guitar body mode
https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11360423/ · [65] https://forum.ukuleleunderground.com/threads/helmholtz-resonance-values-for-ukes.10150/ ;
https://ukuleles.com/applying-technology-to-building/understanding-controlling-instrument-resonances/working-with-basic-instrument-resonances/ · [66] UNSW double reeds
https://www.phys.unsw.edu.au/jw/double-reed-acoustics.html · [67] UNSW bore angles https://newt.phys.unsw.edu.au/jw/bore-angle.html · [68] Chen, Smith, Wolfe, sax JASA
https://newt.phys.unsw.edu.au/jw/reprints/SaxJASA.pdf · [69] Clarinet cutoff, Acta Acustica 2020 https://acta-acustica.edpsciences.org/articles/aacus/full_html/2020/05/aacus200020/aacus200020.html ·
[70] Euphonics 3.6 tuned drums https://euphonics.org/3-6-tuned-drums/

B5 - [71] Henderson & Solomon, Audio Transport, DAFx-19 https://arxiv.org/abs/1906.06763 · [72] Tellman, Haken, Holloway, JAES 43(9) 1995 https://www.hakenaudio.com/lippoldpubs ·
[73] Modal interpolation for scraping/rolling https://arxiv.org/pdf/2112.08984 · [74] Cook, Toward the perfect audio morph? (background) https://ccrma.stanford.edu/~serafin/UVA/MUSI445/Cook98.pdf

Local - [L4] /home/user/RE_BODY/docs/index/03_AMORPH_PLATFORM.md · BODY = /home/user/RE_BODY/reference/body_original/dsp.cmajor · PHY = /home/user/RE_BODY/docs/index/04_PHYSIFY.md
