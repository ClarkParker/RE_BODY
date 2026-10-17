# 07 - P4b lines (DSP wiring)

Owner: wiring worker (P4b). Files: `src/dsp/50_line.cmajor`, `src/dsp/90_main.cmajor` (hand-written parts), `tests/lines.cmajtest`, this file, `docs/dev/09_CPU.md`, and the recipe field `calibration.strike_gain` (`bodies/*.json`, `tools/bodytab.py`, generated `src/dsp/10_tables.cmajor`, `tests/tables_data.cmajor`, `plugin/bodies.json`, `plugin/dsp.cmajor`). Inputs: the striker module (`30_strikers.cmajor`), the analysis stage (`20_analysis.cmajor`: Splitter, PitchTracker), the modal API (`40_modal.cmajor`: hold flag), concept `20_DSP_CONCEPT.md` sections 5, 8, 12-14. Nothing in `src/ui/`, `30`, `20` or `40` was touched; no API was missing (the pinch weights read two public state fields of the slot bank, see 2.7).

This document supersedes the "Known gaps" of `05_LINE_A.md` section 8 for Listen, Chain, Excite / Blend, Follow, Hold, Pan, analysisViz and the pinch weights; Touch, Position .. Reed are as in `06_P3_PHYSICS.md`.

## 0. Status per item (UI location)

| # | item | status | where in the UI | where in the code |
|---|---|---|---|---|
| 1 | Listen All / Transient / Sustain / Low / Mid / High | done | segmented buttons "Listen" of each line (strip 1); feedback hairlines under them from `analysisViz` | `90_main.cmajor:443` (one shared Splitter on the conditioned input), `:460` (`listened`), `50_line.cmajor:2760` (`process`: novelty on the listened signal x Sensitivity) |
| 1b | Chain (previous line's body output x Sensitivity; Line A falls back to All) | done | last Listen button | `90_main.cmajor:463`; source = `l.bodyOut`, `50_line.cmajor:3120` (after the loudness stage, before Level) |
| 1c | Sensitivity 50 = 0 dB, +-24 dB | done (P2 mapping kept, now on the selected signal) | small dial "Sens" | `50_line.cmajor:2760`, `rampNext (l.sens)` |
| 1d | chained-from lines computed when disabled | done | Enable button of the earlier line stays "off", its sound is not in the mix | `90_main.cmajor:274` (`updateRouting`), `50_line.cmajor:289`, `:1669`, `:2613`, `:2140` (all use `computed`) |
| 2 | Excite Through / Hammer / Pluck / Breath | done | segmented buttons "Excite" | `50_line.cmajor:2706` (`strikeStep`), `:2687` (`fireStriker`), `:2555` (`updateStrikeControls`), injection `:2834` .. `:3028` |
| 2b | Blend (0 = striker only, 100 = Through only, equal power, strike modes only) | done | small dial "Blend" | `50_line.cmajor:2555` (targets), `:2706` (per-sample slew), `:2778` (`through`) |
| 2c | Touch in strike modes = velocity curve | done | dial "Touch" (advanced) | `50_line.cmajor:2555` (exponent), `:2687` |
| 3 | Hold v2 (modal freeze, loops ring out, injection mute above -60 dB, armed / capture 200 ms, 32-sample release) | done | button "Hold" + lamp (`lineState.hold`: 0 off, 0.25 armed, 0.5 capture, 1 frozen), caption "HELD" | `50_line.cmajor:2517` (`updateHold`), `:2140` (`updateModal`, `:2185` grid, `:2284` slots), `:2660` (injection gain), `:3077`, `:3108` (energy), `:2111` (`voiceBody`) |
| 4 | Follow (tracker only while a computed line has Follow > 0, glide 40 ms) | done | small dial "Follow", caption "FOLLOW > A3" from `followHz` | `90_main.cmajor:274`, `:331`, `:398`, `50_line.cmajor:813` (`followRoot`), `:832` .. `:920` (target blend and glide), `:2600` (`updateFollow`) |
| 5 | Pan (balance, unity at 0, equal power) after Level | done | small dial "Pan" | `50_line.cmajor:2393` |
| 5b | Enable (summed and computed; fade 12 ms; gate after the tails drained) | done | button "Enable" | `50_line.cmajor:2613` .. `:2647`, `:3120` ff. |
| 5c | analysisViz real (transient, sustain, low, mid, high RMS, pitch confidence), listenEnergy per line | done | hairlines under Listen, tab lamp | `90_main.cmajor:513`, `50_line.cmajor:2764` ff. |
| 6 | Obosaxolele pinch weights (BODY:755-764) | done, small effect (T60@2k 0.114 -> 0.132 s, BODY 0.351 s) | Morph 9 -> 10 (no control) | `50_line.cmajor:74` (weights), `:2679` (`pinchDelta`), `:3007` |
| 7 | gates | section 3 | | `tests/lines.cmajtest`, scratch scripts (section 6) |
| 8 | CPU | `09_CPU.md` | | |
| 9 | denormal guard (CPU after a sound stopped) | done | none | `50_line.cmajor` `flushLine` (called at the start of `tick`), `90_main.cmajor` `flushAnalysis` and the input conditioning, section 2.8 |

## 1. Signal path per sample (what changed against `05_LINE_A.md` section 4)

```
in -> conditioning (NaN guard, DC block, clamp, bypass fade)
   -> Splitter.step (transient, sustain, low, mid, high; always on, ~0.2 k flops)  + tracker.push (only while enabled)
   -> per line k:  heard = Listen 0..5: Splitter field | Listen 6 (Chain): line k-1 bodyOut (k = 0: All)
        x = heard x Sensitivity ; novelty on x (own detector)
        strike = strikeStep (novelty)     striker fired by the novelty, contact signal after the Blend gain
        through = x x Blend-through gain  (= x exactly in Through mode)
        every contact point:  (through x contact law + strike x strikeScale[body]) x feed
        ... engines, grid, slots as P2/P3, modal injection x Hold gain ...
        loudness stage -> bodyOut (Chain source) -> Level -> Pan -> Enable fade -> sum
```
Through mode is the old code path bit for bit: `throughNow` is exactly 1, `strike` exactly 0, the added terms are `+ 0`. Verified by rendering the git-HEAD build and this build on pink noise (Morph 0, 3, 7: maximum difference 0.0; Morph 9.5 and 10 differ by the pinch weights, A + B + C by the new Listen defaults of B and C).

## 2. Semantics as built

### 2.1 Listen, Chain, Enable
- One `Splitter` and one `PitchTracker` for the plug-in, host rate, in the processor (`90_main`). Listen 0..5 pick `listened (splitter, listen)`; the line's `process` receives it as `lineIn`, scales it by Sensitivity (`x`), and its novelty detector (T9) runs on `x`. The balance AGC still reads the signal before Sensitivity (as P2).
- Chain: `lines.at (k - 1).bodyOut` of the same sample (lines run in order, so no delay and never a cycle). Line A with Chain listens to All (`listened (splitter, 6)` returns `all`).
- `computed = enabled || chainedFrom`, `chainedFrom` of line i = line i + 1 is computed and listens to Chain, evaluated from i = 2 down at every control tick from the host targets (`updateRouting`), so a chain B -> A and C -> B computes A, B, C. Everything that decided "runs" in P2 (`process` source, engine gating, slot feeding, dormancy) uses `computed`; the contribution to the sum still follows `enabled` (12 ms fade), so a disabled chained-from line is computed and silent in the mix, and goes dormant only after the chain flag is gone and the tails have drained (tested).

### 2.2 Excite and Blend
- **Detection** (per line, on its novelty): fires when the novelty rises above 0.30 while armed; re-arms when it falls below 0.15 (hysteresis 0.15); refractory 30 ms after a fire; the onset peak (`onset.peak`) is read 3 ms after the crossing so the velocity sees the real peak of the first attack. Stationary pink noise reaches novelty 0.25 at most (measured on the detector), so 0.30 does not false-trigger on noise or pads; a -30 dBFS click (peak 0.03) is the quietest hit that fires at Sensitivity 50 (the detector's own absolute gate), Sensitivity moves that threshold.
- **Velocity** = (20 log10 peak + 50) / 50 clamped to 0..1 (-50 dBFS -> 0, 0 dBFS -> 1), shaped by Touch: v^e with e = 2^((50 - Touch) / 25) (Touch 50 = identity, 0 = exponent 4, 100 = exponent 1/4). The striker module maps velocity to level (-22 dB at 0, dB linear in velocity).
- **Kinds**: Hammer = Hertz contact pulse; Pluck = one-period displacement burst at the line's current root with the Position comb (`positionValue`, beta in periods) when the dominant body is a string (lineKind 3 or 4: Piano, Guitar, Ukulele, Fiddle, Obosaxolele), else the body impulse (position = Position knob); Breath = noise burst through the reed shaping, sustaining with `hold01` = listened peak between -50 and -30 dBFS (0 below, 1 above); Excite switched away from Breath releases it.
- **Blend** (strike modes only): `strikeGain (blend)` / `throughGain (blend)` equal power, 0 = striker only (the audio is not injected at all), 100 = Through only, 50 = 0.707 each; both gains slew per sample (12 ms) so switching Excite or moving Blend does not click. Excite Through = (1, 0) whatever Blend says.
- **Injection**: the same points as the audio, scaled by the per-body `strikeGain` table (see 4): bass drum and timpani contact (low-pass at 3 f0 + 170 Hz), snare shell and rattle (the striker's edge drives the rattle envelope as the audio edge does), piano hammer low-pass, shared string contact (Hammer and Breath go through the pick comb, a string Pluck joins after it because the striker already carries its own comb), oboe reed contact, sax and clarinet reed input. All are multiplied by the body's feed (the morph weight), so a striker excites every active body of a morph like the audio does. In the hybrid segment the three ingredients blend toward the Obosaxolele gain (log domain) because the same strike drives a coupled chain.

### 2.3 Hold v2 (20 section 14)
- State machine once per tick (`updateHold`): Off; Armed (Hold on, held energy below -60 dB: the next excitation is captured); Capture (200 ms = 300 ticks at 48 kHz, injection open); Frozen (injection muted). Off -> Frozen at once when Hold is pressed while the modal part is above -60 dB; Capture -> Frozen when something was taken in (energy above -60 dB), else back to Armed; Frozen -> Armed when the energy fell below -60 dB; any state -> Off on release. After a project load the energy is 0, so Hold starts Armed.
- **Held energy** = power of the modal part of the line (grid and slots, after calibration and the balance AGC, before Level), 110 ms smoother, threshold 1e-6 (-60 dB re full scale). Excitation while armed = listened peak above -70 dBFS or a striker output above -70 dBFS.
- **Freeze**: the hold flag of the modal API is on in every state but Off: grid and all slot bodies get the T60 45 s radii (float64 coefficients, drive unchanged, so Hold never changes the normalisation); bodies that are not fed but still ringing are re-voiced once with the flag (`voiceBody`). While Frozen nothing of the grid or the slots is re-voiced (Tune, Material, Size .. do not move a frozen body; a body fed for the first time while frozen is voiced once). Line engines (strings, bores, the shared string, the piano pair) and the snare rattle keep their recipe decay and keep listening ("Hold sustains the body resonance; strings and bores ring out naturally").
- **Injection mute**: every modal excitation (`stepBodySlots` and the grid sum) is multiplied by `inject.now`, a linear ramp over one tick (32 samples) to 0 when Frozen, back to 1 on every other state. Release: the flag goes off, the modal API ramps radii and drives over 32 samples, the injection ramps back over 32 samples. Hold off = the same code with the multiplier 1.0 (exact).
- Telemetry `hold`: 0 / 0.25 / 0.5 / 1.0 for Off / Armed / Capture / Frozen (the UI lights its lamp above 0.5).

### 2.4 Follow (20 section 13)
- The tracker runs only while a computed line has Follow > 0 (`updateRouting`, narrower than "any line" on purpose: a disabled line does not need the pitch); `work` once per control tick, `push` of (L + R) / 2 of the conditioned input every sample.
- Tune target of a body = log-blend of the Tune knob root and the tracked pitch folded by octaves into that body's Tune range (`followRoot`: the pitch class is kept; clamp to the range ends), amount = Follow / 100 (0 = knob, 100 = tracked); continuous in Hz, not quantised to semitones. The line's shared register is the weight blend of its active bodies' targets as before. With no voiced estimate yet, Follow acts as 0.
- Glide: a linear 40 ms (60 ticks) glide of the shared log root toward the goal; a jump of more than 5 ct (or Follow switching on) starts a new glide, smaller changes are absorbed into the running one, and after it a 40 ms one-pole smooths the tracker's jitter. Without Follow the register slews as in P2 (55 ms).
- The loops keep **linear interpolation** for fractional delays (BODY:444-448); the Lagrange-3 reads named in 20 section 13 are not built (the glide is 40 ms and the retune ramps per tick; the fraction-dependent low-pass of linear reads is the known side effect; it was neither measured nor listened to). Listed in section 5.
- `followHz` telemetry = the tracked pitch in Hz while Follow > 0 and voiced, else 0.

### 2.5 Pan, Enable, telemetry
- Pan: balance after Level, unity at 0; for Pan > 0 the left gain is cos (pi / 2 x Pan / 100) and the right stays 1 (mirror for < 0), so +-100 is full right / left and the taper is equal power.
- `analysisViz` = `analysisFrame (splitter, tracker)`: RMS (110 ms) of transient, sustain, low, mid, high and the tracker confidence (0 while the tracker is off). `listenEnergy` per line = peak envelope (110 ms) of the listened signal after Sensitivity (the P2 definition, now on the selected signal).

### 2.6 What `lineState` reports now
`followHz` (3), `hold` (4) are real; `listenEnergy` (2) follows Listen / Chain; all other fields as before.

### 2.7 Obosaxolele pinch (BODY:755-764)
The modal API has no per-mode output gain. The weights act on stored state too in BODY, so they are applied to the output of the two oboe banks (the oboe cluster and the reshaped cluster, slot body 8 and 10) from their Tune-following lane: `pinchDelta` returns the sum of `amount x pinch[pair] x re` over the eight modes of lane 1 (read after the bank stepped, as BODY reads `oboReal` after its update), `amount` = `oboHybrid x hybridGesture`, `pinch` = (-0.28, -0.28, -0.10, -0.10, 0.45, 0.45, 1.05, 1.05); the plain bank sum already carries the 1. It reads `reL` / `reR` of `SlotBody`, which are public struct fields, so no change in `40_modal.cmajor`. The pinched sum also feeds the sax bell (BODY:798-800), as `l.oboRaw` did.
Result (impulse, 48 kHz, octave-band T60 from `render_ci`): 125 .. 8 kHz 1.17 / 1.13 / 1.03 / 0.806 / **0.114** / 0.052 / 0.023 s before, 1.19 / 1.15 / 1.04 / 0.777 / **0.132** / 0.052 / 0.023 s after; BODY 1.18 / .. / .. / 0.737 / **0.351** s. The 2 kHz band moves 16 % toward BODY and stays 62 % below it; scaling the weights x2 / x4 gives 0.148 / 0.192 s, so the weights are not the lever. The band is carried in RE-BODY by the grid and the oboe slots at the damping law (D44, `05_LINE_A.md` 9.2); `energy_target` 0.4496 would give 0.19 s at dLUFS +1.3 dB, 0.2 is the P2 compromise and was left. Pink-noise loudness is unchanged (the pluck gesture is 0 on noise): `compare --gate` dLUFS +0.22 dB at 48 kHz.

### 2.8 Denormal guard (found while measuring CPU, fixed here)
After any sound the plug-in kept costing CPU in silence: a 200 ms noise burst followed by silence cost the P4a build 0.21 s of CPU per audio second (21 % of a core, linear in the length of the silence: 45 s render 11.9 s against 2.8 s for pure silence) and this build before the guard 0.35 s per second. Cause: a one-pole or peak follower that decays toward 0 stops at the smallest denormal (`v - a v` rounds back to `v`; the DC blocker of the input conditioning, `x = dry - previous + r dcState`, does the same), and every sample that touches such a state runs at denormal speed for ever; the engines are never gated while a body has weight (`wanted`), so their filters keep running. P2 measured with noise bursts every 0.5 s and never saw it. `cmaj render` has no flush-to-zero; whether the Amorph host sets FTZ / DAZ is not known, so the plug-in no longer depends on it.
Fix, in the two files of this worker, all at the control tick except the first: the conditioned input is flushed below 1e-20 (`90_main.cmajor`, conditioning), `flushLine` sets every filter, follower and gate state of a line below 1e-20 to 0 (`50_line.cmajor`, called at the start of `tick`), `flushAnalysis` does the same for the Splitter and the octave meters (`90_main.cmajor`). 1e-20 is -400 dB, far above the denormal range and far below anything audible. Result (30 s render, burst then silence): P4b 3.2 .. 3.6 s for every length from 8 to 45 s (flat, = the fixed JIT cost), P4a baseline 3.8 s growing to 11.9 s; the output is bit-identical to the git-HEAD build over 20 s tails of five bodies (maximum difference 0.0 at 24 bit), and the Through defaults are still bit-exact. Not covered: single modal poles inside a lane that is still alive (the modal engine flushes whole lanes below 1e-20 energy, `40_modal.cmajor`, not mine); after the slowest pole of a lane is gone the cost is zero (measured above).

## 3. Gates (P4b row of the plan)

| gate | result |
|---|---|
| transient + sustain = input, -100 dB | PASS: `tests/analysis.cmajtest` `splitterIsComplementary` (residual <= 1e-6 = -120 dB on click + pad, stereo) and `tests/lines.cmajtest` `listenedTransientPlusSustainIsTheInput` through the `listened()` call the processor uses (<= 1e-5 asserted; All and Chain return the input exactly) |
| 3-band split flat +-0.2 dB | PASS: `tests/analysis.cmajtest` `bandSumIsAllpass` at 44.1 / 48 / 96 kHz |
| Chain acyclic, no runaway | PASS: A -> B (Chain) -> C (Chain), 60 s continuous pink, 48 kHz: finite, peak -9.9 dBFS (input -5.2), RMS per 10 s -27.3 / -27.5 / -27.2 / -27.3 / -27.6 / -27.4 dB; 96 kHz: -27.5 .. -27.8 dB. A disabled with B chained: B alive at -36.6 dBFS RMS and different from B listening to All (the disabled A is computed). Line A with Listen Chain is bit-identical to Listen All |
| strikers finite and velocity-monotonic | PASS: clicks at -30 / -20 / -10 dBFS, Blend 0, 6 bodies (Bass Drum, Piano, Guitar, Clarinet, Oboe, Obosaxolele) x Hammer / Pluck / Breath: wet peak and RMS rise with the click level in all 18 cases, all finite (48 and 96 kHz); `lines.cmajtest` `strikersDriveTheLine` (Bass Drum, three kinds) |
| strike detection | PASS: `lines.cmajtest` `strikeDetectionHysteresisAndRefractory` (one fire per rise, 3 ms settle, no re-fire without falling to 0.15, no fire inside 30 ms) |
| Hold: modal T60 >= 30 s | PASS: 44.8 .. 45.1 s at 48 kHz (anchors 0, 2, 8 x Material 0 / 50 / 100, Hold init 1, 2 s pink then silence to 62 s), 44.8 .. 45.5 s at 96 kHz (Material 50) |
| Hold: level drift < 0.5 dB per 10 s | **see note**: deviation of the six 10 s levels from their straight-line fit 0.00 .. 0.17 dB at 48 kHz, 0.01 .. 0.39 dB at 96 kHz (PASS); the difference between neighbouring windows is 13.4 dB, which is exactly the T60 45 s law (60 dB x 10 / 45 = 13.3 dB). `render_ci.py check hold-stability` computes drift as that window difference and therefore FAILS by design; "T60 >= 30 s" and "< 0.5 dB per 10 s" as neighbouring-window differences exclude each other (0.5 dB / 10 s is T60 1200 s). I read the gate as the straight-line residual and left `render_ci.py` alone (not my file). D26 fixes T60 45 s |
| Hold: abs(DC) < 0.01 | PASS: <= 9e-6 (48 kHz), <= 6.3e-5 (96 kHz) |
| Hold: held spectrum within 1 dB per mode | PASS: 200 ms pink strike at 0.3 s, Hold engaged at 0.62 s (0.12 s after the strike ended, modal energy above -60 dB), held spectrum at +8 s against the held spectrum right after the engage, 2 s FFT windows, band power (+-2 Hz) of every peak within 30 dB of the strongest (it does not depend on the beat phase of close modes; peak magnitudes of weak beating modes wander by +-1.5 dB with the window): per-mode deviation 0.83 / 0.12 / 0.04 dB at 48 kHz and 0.86 / 0.18 / 0.18 dB at 96 kHz (Bass Drum, Timpani, Oboe), common decay -10.6 .. -10.7 dB = T60 45 s over 8 s. On the states: `lines.cmajtest` `holdFreezesEveryMode` (every grid pole and every slot mode of a ringing Bass Drum, per-mode energy change over 3 s within 0.3 dB of its mean, mean -4.0 +- 0.3 dB, at 48 and at 96 kHz; the same body without Hold spreads by more than 3 dB). The held and the un-held renders are identical up to the engage (difference 0.0 before it); after it the un-held modes keep decaying at their recipe rates, the held ones at T60 45 s |
| Follow locks within 150 ms +-10 ct | PASS: Guitar, Follow 100, 440 Hz sine from 0.5 s: root within +-10 ct 76.7 ms after the tone starts (96 kHz 77.3 ms), error after 0.5 s +0.04 ct (+0.08 ct); other bodies 76.7 .. 87.3 ms. Free ring after the tone: f0 439.99 Hz (-0.1 ct, confidence 0.98); a 330 Hz tone (not a partial of the A3 string) gives 330.00 Hz with Follow 100 and the Tune string 220.16 Hz with Follow 0. `lines.cmajtest` `followGlidesIn40ms` (60 ticks to within 1 ct, monotonic) |
| 3-line protector reduction < 3 dB | PASS: `render_ci.py check three-line-protector --gate`: estimated reduction -0.45 dB at 48 kHz, -0.22 dB at 96 kHz (B Transient, C Sustain, defaults), A + B + C peak -10.2 dBFS against an input peak of -7.5 dBFS |
| `run --quick` + `compare --gate` at defaults | PASS (48 kHz, all 8 mapped anchors and the 3 new ones; Clarinet dLUFS -0.19 dB, f0 +0.0 ct) |
| `run` full, three rates + `compare --gate` | PASS: all 165 renders without flags, `compare --gate` exit 0, 44 lines PASS (8 mapped anchors and 3 new ones at 44.1 / 48 / 96 kHz); Clarinet dLUFS -0.11 / -0.19 / -0.21 dB, Obosaxolele +0.22 dB at 48 kHz |
| silence after a sound costs nothing | PASS after the guard of 2.8: 45 s render (200 ms burst then silence) 3.4 s against 2.8 .. 3.2 s for pure silence; P4a baseline 11.9 s, P4b before the guard 17.8 s |
| `cmaj test` all files | PASS: analysis, helpers, lines (new), modal, strikers, tables |
| `preflight.py plugin --strict` (kit worktree) | PASS: 0 errors, 0 warnings, All clear |

## 4. Strike calibration (`calibration.strike_gain`)

A short strike excites the loops and slots much less than a sustained audio contact, and the families differ by 20 dB, so one reference level could not match Through. The contact amplitude of a velocity 1 striker is a recipe field per body (new, required, > 0, `tables::strikeGain`), chosen so a strike-only line (Blend 0) sits within about 3 dB of Through on decaying noise hits (peak -12 dBFS, tau 40 ms, 4 hits, RMS over 0.75 s after each hit; velocity 0.76 at Touch 50). Measured, 48 kHz, dB re Through (Hammer / Pluck / Breath, Breath after its -4 dB trim `breathTrim`):

| body | strike_gain | Hammer | Pluck | Breath |
|---|---|---|---|---|
| Bass Drum | 0.0282 | 0.0 | -1.4 | -6.2 |
| Snare | 0.213 | -2.3 | -2.7 | +6.3 |
| Timpani | 0.0137 | -0.7 | -1.1 | -0.4 |
| Piano | 0.0216 | -1.5 | +0.5 | +1.5 |
| Guitar | 0.0172 | -1.4 | -0.9 | +1.7 |
| Ukulele | 0.0221 | -1.5 | -0.6 | +1.1 |
| Fiddle | 0.0809 | -0.7 | +1.2 | +5.0 |
| Clarinet | 0.1318 | -0.4 | -1.5 | +2.4 |
| Oboe | 0.2266 | -2.4 | -2.4 | +4.9 |
| Sax | 0.404 | -2.0 | -2.6 | +4.8 |
| Obosaxolele | 0.0199 | -1.4 | +0.1 | +1.4 |

Hammer and Pluck are within -2.7 .. +1.2 dB of Through; Breath spreads -6 .. +6 dB because it is a sustained burst whose level depends on the body's low-pass (bass) or reed (snare, oboe, sax); one `breathTrim` constant is all the calibration it got. These are *(design)* values to adjust by ear (P7); `tools/bodytab.py` validates the field and emits the table.

## 5. Approximated or left

- **Lagrange-3 for Follow**: loops keep linear interpolation (see 2.4).
- **Hold gate wording**: see the table above; the CI tool needs "drift = deviation from the fit" to pass; I did not change `tools/render_ci.py`.
- **Hold and the loops / rattle**: they ring out and keep listening, as D26 says; a held body next to a live string is the intended sound.
- **Hold energy is pre-protector**: -60 dB is re full scale of the line's modal output after its balance AGC, not of the final mix; a line whose modal energy stays below that (very quiet input) stays Armed and re-captures every excitation (D26: below -60 dB Hold is armed).
- **Tracker enabling**: only for computed lines with Follow > 0 (the concept says "any line").
- **Strike level** depends on the body only through the table; the balance AGC of the pitched bodies adds its own compensation (target -8 dB re the listened power), so the ratios in section 4 hold for hits of that kind, not for every input.
- **Breath hold01** uses the 60 ms peak follower of the novelty detector (-50 .. -30 dBFS ramp), not a separate envelope; a pad that never has an onset after the first never re-triggers a released Breath.
- **Pinch**: applied to both oboe banks; effect on T60@2k is small (2.7).
- **Splitter is always on** (analysisViz needs it): about 0.3 percentage points of one core at 48 kHz (estimate from its 210 flops per sample; below the +-1 pp noise of the `09_CPU.md` measurements).
- The B and C defaults (Listen Transient / Sustain) now really listen differently, so the `three-line-protector` and Line B / C renders differ from P2 on purpose.

## 6. How the gates were run (scratch, not in the repo)

Scripts in `/tmp/claude-0/-home-user/56398787-a593-57af-8ae9-3f0062939bf1/scratchpad/p4b/` (`lib.py` = render helpers on top of `tools/render_ci.py`; `gates.py` chain / strikers / follow; `t_hold.py` stability and spectrum; `t_calib2.py` strike calibration; `t_pinch.py` pinch sensitivity; `cpu_bench.py`, `cpu_cmp.py`). The Hold spectrum test engages Hold mid-render with a scratch copy of `plugin/` whose `main()` sets `paramTarget.at (24)` from a sample counter (the renderer discards the first 20480 input frames, which the counter must subtract); the Follow lock time reads the line root through a scratch copy whose output is `rootHz / 1000`. Regression against git HEAD: `base_plugin/` = `git show HEAD:plugin/dsp.cmajor`.
