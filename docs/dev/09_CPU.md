# 09 - CPU (first draft of the P7 figure)

Measured at the end of P4b on the final build (all line features wired: Listen / Chain, strikers, Hold, Follow, Pan, and the denormal guard of `07_P4B_LINES.md` 2.8), cmaj 1.0.3175, LLVM JIT, Linux container with 4 cores, nothing else running. The P7 measurement repeats this on the final build with the host's own engine; these numbers are `cmaj render`, not the Amorph host.

## Method

`cmaj render --input=<pink.wav> --output=<out.wav> --rate=<sr> <patch>` of continuous pink noise (-20 dBFS RMS, successive 2 s pieces of the same generator), stereo, 24-bit WAV in and out. The parameters are patched into the `init:` values of a copy of the plug-in (the `render_ci` init-patching trick), Mix 100, everything else default. Every configuration is rendered twice, 10 s and 70 s long; the **marginal cost** per audio second is `(T70 - T10) / 60`, so JIT compilation (1.5 - 3 s), process start-up and the fixed pre-roll cancel. `T` is the wall time of the render process (`time.perf_counter`) and, separately, the user + system CPU time of the child process (`resource.getrusage (RUSAGE_CHILDREN)`); the render is single-threaded, wall and CPU agree within noise (CPU is about 0.3 percentage points higher). **Percentage of one core** = 100 x marginal seconds per audio second; **realtime ratio** = 1 / that fraction. The figures include the render tool's file I/O and sample conversion (the "idle" row is the same render with every line off: the tool plus the always-on Splitter). **One run per cell: the run-to-run spread is about +-1 percentage point** (JIT time varies by +-0.5 s over a 60 s difference; the same configuration measured twice during this phase gave 3.9 and 4.4 % for A + B + C at 48 kHz, 9.1 and 10.2 % at 96 kHz).

Scripts: `/tmp/claude-0/-home-user/56398787-a593-57af-8ae9-3f0062939bf1/scratchpad/p4b/cpu_bench.py` (table 1), `cpu_split.py` (table 2), `cpu_tail3.py` (table 3), `cpu_cmp2.py` (table 4); results in `cpu_bench.json` next to them.

## Table 1: final build, pink noise, marginal cost

| configuration | 48 kHz % of one core (wall / CPU) | 48 kHz realtime | 96 kHz % of one core (wall / CPU) | 96 kHz realtime |
|---|---|---|---|---|
| idle: all lines off (tool I/O + Splitter) | 1.0 / 1.6 | 100x | 0.1 / 0.5 | > 100x |
| **Line A alone** (Clarinet, defaults) | **1.8 / 2.1** | 56x | **3.5 / 3.8** | 29x |
| **A + B + C enabled** (Clarinet, Bass Drum, Piano; B Transient, C Sustain; defaults) | **4.4 / 4.7** | 23x | **10.2 / 10.9** | 9.8x |
| **A + B + C, Follow 100 and Excite Breath on all three** | **7.2 / 7.8** | 14x | **11.2 / 12.1** | 8.9x |

Concept 20 section 16 states a target (not a ceiling) of 8 % of one core at 96 kHz for three lines. Three default lines measure 9.1 .. 10.2 % (two runs), with Follow on every line 11.2 %; the figure is above the target, about 1.3x, and the cost is the grid and the slot banks of the three lines (`05_LINE_A.md` section 7: 1.74 k flops per sample for a grid, 0.45 k per running slot body). Single-line figures are about twice the 48 kHz ones, as `05_LINE_A.md` expected.

## Table 2: what the P4b features cost (48 kHz, A + B + C, same stimulus, one run each)

| configuration | wall % | CPU % | change |
|---|---|---|---|
| A + B + C defaults | 4.76 | 5.19 | |
| + Follow 100 on all three (Excite Through) | 6.47 | 7.08 | **+1.7 pp**: the pitch tracker (one per plug-in, about 630 flops per sample, `20_analysis.cmajor` header) plus the glide re-voicing; paid only while a computed line has Follow > 0 |
| + Excite Breath on all three | 3.38 | 3.78 | -1.4 pp |
| + Excite Hammer on all three | 3.45 | 3.79 | -1.3 pp |
| + Hold on all three | 4.36 | 4.70 | -0.4 pp |

Strike modes are cheaper than Through with continuous noise because the bodies are excited by sparse bursts instead of a continuous contact (and Blend 0 does not inject the audio at all); the number is for pink noise, a rhythmic input sits between the two. Hold costs nothing extra (a frozen line stops re-voicing its modes and the energy meter is six multiply-adds per sample).

## Table 3: CPU after a sound stopped (the finding of this phase)

A 200 ms pink burst, then digital silence to the end of the render (Line A, Clarinet, defaults, 48 kHz), wall time of the whole render; pure silence renders in 2.8 .. 3.2 s (JIT).

| length of the render | P4a baseline (git HEAD) | P4b before the denormal guard | P4b final |
|---|---|---|---|
| 8 s | 3.97 s | 4.71 s | 3.34 s |
| 20 s | 6.51 s | 8.67 s | 3.20 s |
| 45 s | 11.56 s | 17.78 s | 3.65 s |

Before the guard the cost after the burst grew linearly for as long as the silence lasted: 0.21 s of CPU per audio second (21 % of a core) in the P4a build and 0.35 s (35 %) once the always-on Splitter was added. Cause and fix: `07_P4B_LINES.md` 2.8 (filter and follower states decay to the smallest denormal and stay there; the engines are never gated while a body has weight, so they keep running on denormal values). The P2 table (`05_LINE_A.md` section 7) was measured with noise bursts every 0.5 s and never saw it. The guard flushes every such state below 1e-20 at the control tick; the output is bit-identical to the baseline over 20 s tails. Whether the Amorph host runs the audio thread with flush-to-zero is not known; with the guard the plug-in does not depend on it for the states listed there. A P7 check in the host should repeat "burst, then silence" and watch the load (the same pattern in a DAW: stop the input, the CPU meter must fall to the idle level within a few seconds).

## Table 4: P4b against P4a, Line A alone, continuous pink (48 kHz, 4 repeats alternating the builds)

| build | wall % (min .. max) | CPU % |
|---|---|---|
| P4a baseline (git HEAD) | 2.05 (1.49 .. 2.77) | 2.29 |
| P4b final | 1.08 (-0.37 .. 2.18) | 1.28 |

The spread (more than +-1 pp) is larger than the effect: the always-on Splitter (about 210 flops per sample, `20_analysis.cmajor` header, 0.3 pp) and the per-line bookkeeping cannot be separated from noise with this method, and a line of the P4a build that has ever been quiet carries the denormal cost of Table 3 (the pink render has a 0.5 s lead of silence and a faded start). An earlier set before the guard gave 1.16 % for P4a and 1.72 % for P4b.

## Notes for P7

- Where the time goes (not profiled here): the grid at about 1.74 k flops per sample per line while anything rings, 0.45 k per running slot body, the loops 0.1 .. 0.35 k (`05_LINE_A.md` section 7). A line that is idle (disabled and drained) costs nothing; a held line (Hold frozen) costs its grid and slots until Hold is released or the energy has decayed below the flush level (about 127 s at T60 45 s from -30 dBFS).
- The Splitter could be skipped while no line listens to a band or to Transient / Sustain and the UI does not show `analysisViz` (it is always shown today): about 0.3 percentage points of one core at 48 kHz.
- Single modal poles inside a still-living lane are not flushed individually (`40_modal.cmajor` flushes whole lanes); the measured tail cost is zero after the lane is gone, but a body that rings for tens of seconds (Hold, long Decay) may carry some denormal work; check with a Hold render in the host.
- Compile time: the whole plug-in JIT-compiles in about 1.5 .. 3 s (the 10 s renders above take 2.8 .. 4.2 s wall).
