# 05 - Line A (P2 integration)

Owner: integration worker (P2). Files: `src/dsp/20_analysis.cmajor` (helpers, band meters), `src/dsp/50_line.cmajor` (the line: morph, register, engines, modal control, loudness stage, telemetry, protector), `src/dsp/90_main.cmajor` (hand-written parts: conditioning, staggered control ticks, sum of lines, Mix, telemetry frames). Inputs: `40_modal.cmajor` (modal API), `10_tables.cmajor` (recipes), concept `20_DSP_CONCEPT.md` sections 2-7, 12-13, and the original `reference/body_original/dsp.cmajor` (BODY:n).
Line A is complete; B and C run the identical code (`Line[3]`, Enable Off by default, dormant = zero cost until enabled). Everything is rebuilt by `python3 tools/build_dsp.py`; the generated endpoint, handler and table regions were not touched.

## 1. Port map (BODY line -> RE-BODY code)
| BODY | what | RE-BODY (`rebody::line` unless noted) |
|---|---|---|
| :587-590 | NaN guard, DC block, clamp, bypass fade | `90_main` loop, unchanged |
| :591-594 | peak / slow peak / novelty / onset | `analysis::onsetStep`, one detector per line on its listened signal (T9) inside `process` |
| :126-146 | morph weights over the series | `updateMorphWeights`, series order = anchor order 0..9, hybrid segment 9 -> 10 with BODY's thirds easing (oboe p, sax 1 - 2p, uke p, p = t / 3); anchor 10 carries t |
| :147-172 | sqrt feeds, correlated-reed normalisation, hybrid calibration | `updateMorphWeights`: normalise when Morph > 8 (BODY: > 5, the oboe stop), calibration 1 + hybridConst[12] x smoothstep |
| :174-192 | anchorRoot, anchorSeconds | `anchorRoot` (tables rootLaw / rootBaseHz / rootSizeOct / tuneMin / tuneMax: drums the size law, pitched the note law with the per-body range, timpani clamp C4), `anchorSeconds` (decayBase x decayRatio^d) |
| :203-272 | shared register, decay, sustain, held hybrid roles | `updateBodyControls` generalised to 11 bodies; slew and exact-convergence idiom as BODY |
| :282-301 | closed-form modal energy | slots: `modal::setBody` (cached); grid: `gridNormalisation` (section 6) |
| :304-334 | drum update: contact low-pass, snare bands, rattle release | `updateOutputStage` (3 f0 + 170 Hz, 6900/1400 Hz bands, 0.78 x decay), onset glide in `updateModal` / `updateOutputStage` (tables onsetGlideOct) |
| :335-347, :444-455, :520-523, :636-656 | clarinet cylinder | `retuneBore`, `stepClarinet`; loop low-pass from `loopLowpassHz`, radiation comb tap at `beta` periods, radiation filter `radiationHz` outside the loop |
| :382-390, :477-504, :530-538, :768-826 | sax loop, beta pickup, asymmetric reed, breath, formants | `retuneSax`, `stepSax`; radiation filter ahead of the formant emphasis; hybrid bell input (BODY:798-800) |
| :368-380, :470-475, :492-497, :526-529, :680-710 | ukulele string, pick comb | `retuneString`, `stepString`: one engine for Guitar, Ukulele, Fiddle, parameters blended by weight |
| :349-366, :457-468, :484-490, :524-525, :658-677 | piano string pair, dispersion, hammer | `retunePiano`, `stepPiano`; buffers 8192 |
| :396-420, :729-741 | oboe reed contact and cluster | reed contact in `process`; the cluster is slot body 8 (formants + nasal ratios), the reshaped cluster is slot body 10 |
| :543-554 | uke wood pair, sax brass pair | brass pair: feature modes of body 9; wood pair: hidden tap in `stepString` (hybrid coupling only) |
| :598 | bass contact low-pass | `process` (bass drum and, same law, timpani) |
| :600, :615-634 | snare contact and rattle | `process`, rattle = engine term of the snare |
| :712-734, :798-800, :836-843 | hybrid gesture, bridge, bell, held roles | `process`, constants from `tables::hybridConst` |
| :844-855 | balance AGC | `process` (powers, gain slews) + `updateOutputStage` (target, once per tick) |
| :856 | drum / pitched calibration | `modalCal`, `engineCal` from `outGain`, `engineGain`, `bodyGain` |
| :857-889 | protector, knee | `protectStep` (the P1 file only had the state struct) |
| :890, :893 | linear Mix, viz | `90_main` |

## 2. What changed against BODY, and why
- **Tables instead of constants.** Roots, seconds, sustain, loop low-pass, pick/pickup position, dispersion, calibration come from `rebody::tables`; the code has no per-body literals except BODY's contact and reed shaping constants (comments cite BODY lines).
- **Radiation filter outside the loop (T6).** Clarinet: one-pole `radiationHz[7]` on the half-period comb; sax: `radiationHz[9]` on the beta comb, ahead of BODY's formant emphasis. The loops keep BODY's low-pass for tuning (phase delay compensated), so pitch stays exact: f0 of the impulse ring at A3 (220 Hz) is Clarinet 220.2, Sax 220.0, Guitar 220.1, Fiddle 220.1, Ukulele 221.1, Obosaxolele 220.6 Hz (BODY 220.1-220.8); the Piano pair reads 223.5 (BODY 225.0, the same autocorrelation effect of the +-9 ct unison).
- **One shared string engine.** Guitar, Ukulele and Fiddle share one loop; at a morph between two of them the table rows are blended by weight (low-pass in log), the register and decay are the shared ones. A first-order dispersion allpass is always in the loop and its exact phase delay (one sample at d = 0) is part of the tuning. The modal bodies of the three get a sqrt share of the same pickup.
- **Per-line novelty (T9).** Listen = All and Sensitivity (-24..+24 dB, 50 = unity) scale the input before the detector, so Sensitivity moves the onset thresholds as it should. The balance AGC reads the component before Sensitivity (otherwise the AGC would undo it); `Listen` other than All and Chain still return the conditioned input (stub in `20_analysis`).
- **Modal bodies replace BODY's hard-wired mode sets.** Per body 18 slots (`setBody` at control rate, root = shared register x onset glide, seconds = shared decay, Material, Size) and one shared grid per line (`setLaw`, `setGains` with `gainVectorBlend` of the two neighbouring anchors; in the hybrid segment the fraction reproduces BODY's weights because the Obosaxolele grid row is the sum of its constituents).
- **Modal excitation.** Modal-only bodies (drums, oboe): BODY's contact signal. Bodies behind a loop: the loop's pickup times `engineGain`, i.e. on the calibration scale of the bracket (otherwise the piano board, calibrated on the hammer signal, would be 20 dB down); the table `bodyDefault` balance is therefore taken as 1 until the Body knob is wired (P3). The grid is excited by the sum of all bodies' modal excitations.
- **Energy: one target per body.** `energyTarget` is read as the energy of the whole body. The slots are normalised to the whole target by the modal engine, so they are scaled to their share of the recipe gains through `positionGain` (`slotScale`), and the grid vector is normalised, cross terms included, to the remaining share. Because the target follows the morph weights and the vector is renormalised, the grid level neither dips nor bumps across a morph (concept 7 "grid normalisation"). Without it the grid was 12-16 dB above the slots and the pitched AGC sat on its -18 dB clamp for Clarinet, Oboe, Sax and the hybrid.
- **Hybrid.** BODY reshaped the oboe cluster continuously; here the oboe cluster (slot body 8, positionGain sqrt(1 - oboHybrid)) hands over to the reshaped cluster (slot body 10, excitation sqrt(oboHybrid)) by an equal-power crossfade, with BODY's energy cut (1 - 0.85 h), role gain (1 + 1.8 h) and all `hybridConst` couplings. Not ported: the time-varying pair "pinch" radiation weights (BODY:755-764), they need per-mode output gains the modal API does not offer.
- **Timpani** takes the bass-drum rules (contact low-pass 3 f0 + 170 Hz, onset glide 0.10 oct, `onsetGlideOct`). It is in `pitchedWeight`, as the table comment says (all but Bass Drum and Snare).
- **Telemetry `t60`**: modal-only bodies report the law T60 at the root (mirrors Material); bodies behind a loop report the loop's decay seconds. `engine0..10` are the anchor weights (concept 8, the UI draws weight bars); they are NOT multiplied by the wet level. `hold` and `followHz` report 0. `lineModes` uses the padded slot layout (k 0-7 feature, 8-15 following).
- **Sum of lines**: Width (mid/side on the wet sum, 0 = mono, 50 = BODY's image, 100 = side x 2), Low Cut (float64 Butterworth 12 dB/oct, 20 Hz = off), wet DC block (5 Hz), then BODY's protector and knee with the input-peak reference, then linear Mix.

## 3. Control-rate schedule
Every line runs `tick()` every 32 samples (BODY:579); the three lines are staggered at samples 11 k of the 32-sample period, the global controls (Width, Low Cut) at sample 0. A disabled, drained line returns at once.
1. `controlLine`: block parameters towards the host values (Tune and Decay are taken as they are, the register slews them; Morph 25 ms, others 55 ms per tick as BODY; discrete parameters switch at once).
2. `updateMorphWeights`: weights, grid vector pair and fraction, dominant body, feed / hybrid / pitchedWeight ramp targets.
3. `updateBodyControls`: shared log root, log seconds, sustain slew toward the active bodies' weight blend; withdrawn bodies keep their last values; held roles (oboe, uke, sax) and rattle sustain.
4. `updateEngines`: gate, wake-up snap, retune (delay, gain, drive, radiation / pick delay, dispersion) as ramps.
5. `updateModal`: grid law blend and the weight-log-blend of Decay factors, `setLaw` + `gridNormalisation` + `setGains` only when the law, vector or fraction changed; `setBody` for fed bodies only when root, seconds, Material, Size, scale or crossfade changed; `flush`; run flags from `isSilent`.
6. `updateOutputStage`: calibration blends, string shares and feed, drum filters and rattle bands, oboe contact filter, Level / Sensitivity / Pan ramps, AGC target (once per tick, only while the line is excited), telemetry summary.
Per sample everything that changes across a tick moves linearly (`analysis::Ramp`, snap at the next tick) and the engines read their ramped values.

## 4. Per-sample order (`process`)
listened signal and onset -> feed ramps -> drum contacts (bass, timpani low-pass; snare contact and rattle) -> piano -> shared string (pluck, pick comb, hidden wood tap) -> hybrid gesture -> oboe reed contact and slots 8 and 10 -> sax (bell takes the oboe slots in the hybrid) -> clarinet -> held hybrid roles -> remaining slot banks -> grid (sum of all modal excitations) -> AGC on the pitched part -> NaN / range guard -> Level, Pan, Enable.

## 5. Gating
- Slot body: runs while fed (weight > 0 and line enabled) or while `isSilent` is false; a body that is idle gets no call and costs nothing; excitation arriving mid-tick wakes it.
- Grid: runs while not silent or while its summed excitation is non-zero.
- Loops (clarinet, sax, string, piano): `wanted` = enabled and a body that needs it has weight > 0. When not wanted, the engine keeps its last tuning and rings out; once its 100 ms envelope has stayed below 1e-6 of its own peak (-120 dB relative) for 0.5 s it goes idle and its buffers are cleared at that tick. Waking up snaps to the new tuning.
- Rattle and the oboe reed filters run only while there is input or state.
- Line: Enable fades the contribution (12 ms); a disabled line gets zero input and drains; when grid, slots, loops and rattle are all silent it becomes dormant and `process` is not called. B and C start dormant. A line enabled later runs its first tick as an initial tick (snap) and fades in.
- Flush at control rate: modal lanes below 1e-20 energy (modal engine), per-sample 1e-12 flush in the loops and contacts (BODY:611).

## 6. Loudness
Per body the BODY bracket `outGain x (engineGain x engine + bodyTerm x modal)` is kept: drums (Bass Drum, Snare) go straight to the sum, everything else through the line's balance AGC (target -8 dB re the line input power x its own `pitchedWeight`, gain 0.125..4, slews 0.25 s down / 0.9 s up, held while the input is silent) with `pitchedWeight` = summed weight of Timpani .. Sax. `bodyTerm` is the table `bodyGain` (piano 0.8, ukulele 0.72, drums and oboe as BODY) and 1 for clarinet and sax, whose brass and bell resonances were part of the pickup in BODY. Sax breath keeps BODY's 1.10 term. Then Level (-60 dB = off), Pan (unity at 0, the opposite channel attenuated), the sum, Width, Low Cut, DC block, protector + knee (peak reference held through ringout, re-armed after 0.5 s below -140 dB), linear Mix.
`gridNormalisation`: sqrt(target / E), E the impulse energy of the blended gain vector with the exact cross terms of neighbouring poles (|i - j| <= 8, float64, `modal::pairCorrelation`).

## 7. State and cost per line
State (floats): delay lines 61 440 (bore 8 192, sax 8 192, string 8 192 + pick comb 4 096, piano 32 768), modal 5 965 (grid 1 642, 11 slot bodies 4 323), control and engine scalars about 0.8 k: about 68 k per line, 205 k for three (about 0.8 MB). The JIT of the whole plugin takes about 1.5-2 s (render of a 10 s file: 1.7-2.1 s wall).
Per-sample work (stereo flops, estimate): common part (onset, ramps, AGC, level) about 0.15 k; clarinet 0.12 k, sax 0.3 k, string 0.25 k, piano 0.35 k; grid 1.74 k (+0.38 k during a 32-sample ramp); each running slot body 0.45 k. Typical: Clarinet 2.0 k, Piano 2.7 k, Bass Drum about 3 k (two drum bodies ring in a morph), full hybrid 4.3 k.
Control-rate work happens only while something changes (cached `setLaw`, `setBody`, normalisation): an estimate of about 60 us per tick while a morph or Decay sweep runs on one line (the measured sweep render shows no visible cost).
Measured (`cmaj render`, 48 kHz stereo, noise bursts every 0.5 s, time difference between a 130 s and a 10 s render, so JIT and start-up are excluded; includes the render tool's file I/O):
| configuration | marginal CPU, one core |
|---|---|
| Line A Clarinet | 1.3 % |
| Line A Bass Drum | 1.1 % |
| Line A Piano | 1.7 % |
| Line A Ukulele | 1.8 % |
| Line A Sax | 1.7 % |
| Line A Obosaxolele (everything running) | 2.4 % |
| A Clarinet + B + C enabled (Bass Drum, Piano) | 3.5 % |
| A Morph 9.5 + B + C enabled | 4.3 % |
Expect about twice that at 96 kHz (not measured here; P7 measures the target of 8 % for three lines).

## 8. Known gaps (P3 / P4b)
Inert (read, no effect): Position (positionGain is 1 except the slot energy share and the oboe crossfade), Bright, Stretch, Stiffness, Coupling, Air, Reed, Touch, Body (fixed recipe balance), Excite / Blend (strikers return silence), Follow (followHz 0, no pitch tracker), Hold (the flag passed to `setLaw` / `setBody` is false, no arming or injection mute, telemetry hold 0), Listen other than All and Chain (`listenComponent` returns the input), Width inside the bodies (only mid/side on the sum). Also missing: Lagrange-3 reads for Follow glides, the per-register tuning LUT, the hybrid pinch radiation weights, an energy law over the register for pitched bodies (BODY's oboe law; the AGC hides it), analysisViz splits (all five report the input peak, pitch confidence 0), the 03 table `bodyDefault` as a real Body balance.
Calibration items for M1 (tables, recipe worker): Guitar and Fiddle have `outGain` = `engineGain` = 1 while the Ukulele engine term is 0.447 x 18 = 8.0 on the same string pickup, so Guitar is about 18 dB below Ukulele before the AGC and its AGC sits on the +12 dB clamp (pink LUFS -41 against -30); recommend engineGain about 18 and outGain about 0.45 for both. The Bass Drum sits 6.1 dB below BODY (pink -33.4 LUFS against -27.3) because BODY's drum modes are not energy-normalised and `energyTarget` 0.4496 is; measured with the table changed: `energyTarget` 1.0 gives -27.4 LUFS (within 0.1 dB), the Snare is already within 0.5 dB and stays. Timpani and Fiddle placeholders as in 03.

## 9. Render checks (`cmaj render`, Mix 100, unit impulse, `check.py` scratch, 4 s)
All 11 anchors, three sample rates, unit impulse at 0.5 s (peak over both channels, DC = largest |mean| of a channel, decaying = RMS of the last 0.5 s of the 4 s render below half the RMS of the first 0.5 s after the strike; every row finite and non-silent). Silence in, 2 s: output RMS -240 dBFS (exactly zero) at 44.1, 48 and 96 kHz. 440 Hz sine (-12 dBFS), 2 s: finite and wet present for every anchor and rate checked (column 5: RMS of the 48 kHz output, Mix 100).

| Anchor | 44.1 k peak / DC / decay | 48 k peak / DC / decay | 96 k peak / DC / decay | sine 48 k rms |
| 0 Bass Drum | -24.82 / 0.0000 / yes | -25.56 / 0.0000 / yes | -31.64 / 0.0000 / yes | -42.1 dBFS finite |
| 1 Snare | -0.00 / 0.0000 / yes | -0.00 / 0.0000 / yes | -0.00 / 0.0000 / yes | -36.0 dBFS finite |
| 2 Timpani | -25.40 / 0.0000 / yes | -26.15 / 0.0000 / yes | -32.20 / 0.0000 / yes | -33.6 dBFS finite |
| 3 Piano | -7.41 / 0.0000 / yes | -8.08 / 0.0000 / yes | -7.95 / 0.0000 / yes | -24.3 dBFS finite |
| 4 Guitar | -22.33 / 0.0000 / yes | -20.17 / 0.0000 / yes | -24.57 / 0.0000 / yes | -23.3 dBFS finite |
| 5 Ukulele | -0.00 / 0.0000 / yes | -0.00 / 0.0000 / yes | -2.02 / 0.0000 / yes | -24.7 dBFS finite |
| 6 Fiddle | -18.15 / 0.0000 / yes | -22.84 / 0.0000 / yes | -23.22 / 0.0000 / yes | -21.6 dBFS finite |
| 7 Clarinet | -36.02 / 0.0000 / yes | -36.78 / 0.0000 / yes | -42.62 / 0.0000 / yes | -42.4 dBFS finite |
| 8 Oboe | -9.72 / 0.0000 / yes | -10.40 / 0.0000 / yes | -16.11 / 0.0000 / yes | -22.7 dBFS finite |
| 9 Sax | -58.18 / 0.0000 / yes | -58.72 / 0.0000 / yes | -65.33 / 0.0000 / yes | -16.2 dBFS finite |
| 10 Obosaxolele | -6.81 / 0.0000 / yes | -7.38 / 0.0000 / yes | -12.47 / 0.0000 / yes | -15.8 dBFS finite |

A peak of -0.00 dBFS is the protector's knee: the unit impulse is the loudest possible input, the wet peak is bounded to just below the input peak (strictly below 0 dBFS in every run). Further checks that passed (same scratch scripts): extremes of Decay, Material, Size and Tune and two combined extremes, all 11 anchors, impulse and pink noise at 48 kHz, no flags (finite, no clip, DC < 0.01); fractional Morph 0.5 ... 9.999 (every segment, hybrid 9.25 / 9.5 / 9.75) finite, pink LUFS within 1 dB over the hybrid segment (-24.5 ... -25.3); a 20 s Morph sweep 0 -> 10 on pink noise finite, peak -8.9 dBFS; Enable A off = exact silence, B on alone = the Bass Drum, A + B + C finite; run-time automation inside a scratch copy (A Enable off / on, B Enable on / off, Morph jumps 7 -> 3 -> 9 during noise-burst input): finite, A off drains to -113 dBFS, B alone is the Bass Drum, peak -2.4 dBFS; unit tests `cmaj test tests/helpers|modal|tables.cmajtest` unchanged and passing; `preflight.py plugin` clean (one pre-existing `hardcoded-sr` warning, the modal level reference 48000).

`python3 tools/render_ci.py run --quick` (48 kHz, silence / impulse / pink / sine, 11 anchors): 44 renders in 22 s, every anchor ok (no flags). `compare` against the mapped original anchors (informational, `--gate` is the lead's): Piano, Ukulele, Sax PASS; Snare, Clarinet, Oboe, Obosaxolele and Bass Drum FAIL on single metrics: Bass Drum LUFS -6.1 dB and its upper-band T60 (the recipe's slots instead of BODY's raw modes), Snare T60@125 +28 %, Clarinet LUFS +1.1 dB and T60@4k/8k +30/+41 %, Oboe T60@4k/8k -46 % (BODY's oboe is brighter-ringing, ours has the formant slots), Obosaxolele LUFS +1.7 dB and T60@1k/2k +/-34 %. Ring f0 against BODY: Piano -0.1 ct, Sax -1.0, Clarinet -0.9, Obosaxolele -1.4, Ukulele +4.9, Oboe -5.9, Bass Drum -12.0 (coupled-head modes of the recipe).

Pink-noise loudness against the golden BODY (`tools/golden/body_original.json`, LUFS at 48 kHz, Decay 50; mapped anchors):
| anchor | RE-BODY | BODY | delta |
|---|---|---|---|
| 0 Bass Drum | -33.4 | -27.3 | -6.1 |
| 1 Snare | -30.0 | -29.5 | -0.5 |
| 3 Piano | -29.1 | -29.5 | +0.4 |
| 5 Ukulele | -30.4 | -31.2 | +0.8 |
| 7 Clarinet | -26.1 | -27.2 | +1.1 |
| 8 Oboe | -22.8 | -22.7 | -0.1 |
| 9 Sax | -25.2 | -24.7 | -0.5 |
| 10 Obosaxolele | -24.9 | -26.6 | +1.7 |
Without a BODY counterpart: Timpani -31.8, Guitar -41.1 (see the calibration items), Fiddle -26.3. The pitched AGC sits inside its range for all of them except Guitar and the Timpani near the +12 dB clamp (AGC targets over 1-1.9 s of pink: Piano 1.7-2.4, Ukulele 2.2-3.0, Clarinet 0.56-0.80, Oboe 0.33, Sax 0.54-0.61, hybrid 0.43-0.51; BODY: Piano 1.8-4.0, Ukulele 1.6-4.0, Clarinet 1.2-1.65, Oboe 0.34-0.40, Sax 0.78-0.86; before the grid normalisation Oboe, Sax and the hybrid sat on the 0.125 clamp).
