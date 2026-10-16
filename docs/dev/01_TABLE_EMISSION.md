# 01 — Table emission experiment (P1 gate, DSP worker)

Question (plan 30, P1 gate; review T4/T7): in which form should the compiled body tables (`bodytab.py` output, namespace `rebody::tables`) reach Cmajor? Plan risk: "large inline literals may fail (Cmajor #135), manifest `externals` unverified in Amorph". Each form was tried, each at the contract size and at 10 / 40 / 300 times that size.

**Recommendation: namespace-scope `const` arrays (`bodytab.py --emit namespace`, the default).** Fallback 1: `main` form. Fallback 2: `external` form. Never element-wise assignment. Details in section 5.

Environment: `cmaj` 1.0.3175 (`/root/.cache/cmaj/1.0.3175/cmaj-bin/linux/x64/cmaj`), Linux container, 4 cores, LLVM JIT as in the host. "generate" = `cmaj generate --target=cpp --output=FILE`, "JIT" = wall time of `cmaj render --length=N` (parse, compile with the LLVM engine, run). All times wall clock, single run for the large cases (the small cases repeat within ±20 %).

## 1. The synthetic table (P1 contract size)
26 arrays exactly as `00_P1_CONTRACTS.md` lists them: `gridHz[96]`, `gridGainL/R[1056]`, `featureCount[11]` (int), `featureHz/T60/GainL/GainR[88]`, `followCount[11]` (int), `followRatio/T60Mult/GainL/GainR[110]`, `alphaG/alphaR/decayBase/decayRatio/sustain[11]`, `rootLaw/lineKind[11]` (int), `loopLowpassHz/radiationHz/beta/dispersion/outGain/energyTarget[11]`: **3 165 elements** (3.2 k floats, about 50 KB of Cmajor text). Scale factor *n* multiplies every array longer than 11 (x10 = 30 165 elements, x40 = 120 165, x300 = 900 165). Values are random float32 printed with 9 significant digits.

Correctness is checked, not only compilation: a probe processor dumps **every element** through a `read(array, index)` function (so nothing can be eliminated) as two floats per frame, `cmaj render` writes the WAV, and the samples are compared with the generated values (exact float32 equality up to 1e-6). Every row marked "ok" below passed with 0 mismatches. (`cmaj render` emits about 20 480 leading silent frames, a render-tool latency documented in kit `12_TESTING.md`; the dump starts at frame 20 480.)

The experiment scripts (generator, runner, verifier) live in the session scratchpad, not in the repo; the forms are exactly the ones `tools/bodytab.py --emit namespace|main|external` produces.

## 2. Forms tried
| id | form | what the probe source looks like |
|---|---|---|
| a | namespace constants | `namespace rebody::tables { const float[1056] gridGainL = ( ... ); ... }` |
| a2 | processor member initialisers | `float[1056] gridGainL = ( ... );` in the processor (state initialiser) |
| b1 | `main()` element-wise | members `float[N] x;` and `x.at (0) = ...f; x.at (1) = ...f; ...` at the start of `main()` |
| b2 | `main()` literal | members `float[N] x;` and `x = ( ... );` at the start of `main()` (also: in a processor-scope `void load()` called from `main()`; also bodytab's struct `Tables` + `make*()` + `load (Tables&)`) |
| c | manifest `externals` | `external float[N] x;` and `"externals": { "T::x": [ ... ] }` in the `.cmajorpatch` |

## 3. Results at the contract size (3 165 elements)
| form | generate | C++ out | JIT | verified |
|---|---|---|---|---|
| a namespace const | 0.08 s | 75 KB | 0.12 s | ok |
| a2 member initialiser | 0.09 s | 75 KB | 0.14 s | ok |
| b2 `main()` literal | 0.06 s | 77 KB | 0.20 s | ok |
| b1 `main()` element-wise | 0.16 s | 204 KB | 0.73 s | ok |
| c external (inline manifest arrays) | 0.07 s | 75 KB | 0.14 s | ok |

All five forms are clean and fast at the real size. Nothing fails at 3 k elements; #135 does not bite here.

Generated C++ (inspected, `cmp`): forms a, a2 and c produce the **identical** C++ file at the contract size, with `const Array<float, N> g_name` globals outside the processor state (a never-written member is hoisted to a constant, and external values are resolved at compile time, so the runtime cannot tell them apart); form b2 keeps the arrays in the processor state (`_state.name`, 12 KB at this size) and copies the literal once when `main()` starts; b1 turns into thousands of stores.

## 4. Scaling and limits
| scale (elements) | a namespace | a2 member init | b2 main literal | b1 element-wise | c external |
|---|---|---|---|---|---|
| x10 (30 165) | 0.12 s gen, 0.15 s JIT | 0.10 / 0.16 | 0.09 / 0.36 | **4.5 s / 39.7 s** | 0.09 / 0.16 |
| x40 (120 165, about the 131 072-float guideline) | 0.24 / 0.28 | 0.21 / 0.29 | 0.22 / 0.42 | **60.9 s / 423.5 s** | 0.17 / 0.26 |
| x300 (900 165) | **error** | **error** | **error** | not run | 2.0 s / 1.1 s, ok |

- Element-wise assignment (b1) is super-linear and unusable above about 10 k elements (x10: 40 s of JIT, x40: 7 min). Do not emit it.
- Literal forms (a, a2, b2) stay under half a second up to 120 k elements. They fail at x300 because of a hard limit, bisected with single-array probes:
  `error: Initialiser list exceeds max length limit` — **65 536 elements per initialiser list** (largest accepted 65 536, first failing 65 537), identical for `const float[]`, `const int[]` and the `main()` array literal. That is Cmajor #135. The contract's largest array is 1 056 elements (62 x below the limit); a future per-register tuning LUT must still be chunked below 65 536 per literal.
- `external` has no list-size limit (a single 316 800-element array was accepted), but see its failure modes:
  - manifest without the key: `error: Failed to resolve external variable 'data'` (the whole patch fails to compile, so a host that does not supply externals cannot load the plugin);
  - manifest value given as a file name: `error: Cannot apply value of type 'string' to external variable 'data'` (only inline JSON arrays work for float arrays in 1.0.3175);
  - `external` may be declared inside a namespace (`namespace rebody::tables { external float[4] data; }`, manifest key `"rebody::tables::data"`), so consumer code stays source-compatible with the namespace form; `external` cannot be initialised (core-dsp rule), so every test harness must also supply the values.

## 5. Real tables through the real build
`src/dsp/10_tables.cmajor` as emitted by the recipe worker (11 recipes, about 48 KB) plus the P1 skeleton, `tools/build_dsp.py` wiring each form (scratch copy of the repo, `bodytab.py --emit FORM`):

| form | build_dsp wiring | generate | JIT | C++ out |
|---|---|---|---|---|
| namespace | none | 0.32 s | 0.52 s | 205 KB (tables unused in P1, culled) |
| main | `rebody::tables::Tables tables;` member and `load (tables)` at the start of `main()` | 0.36 s | 0.60 s | 253 KB |
| external | `externals` object merged into the manifest from `plugin/tables.externals.json`; manifest grows to 53 KB | 0.25 s | 0.48 s | 205 KB |

`build_dsp.py` reads the form from the header line `emission form: ...` of `10_tables.cmajor`, so switching form is `python3 tools/bodytab.py --emit FORM [--externals-json plugin/tables.externals.json]` followed by `python3 tools/build_dsp.py`; no source edit. The processor side is region-driven (`// BEGIN TABLES MEMBER` / `// BEGIN TABLES LOAD` in `90_main.cmajor`, rewritten by the builder), and for the external form the builder also rewrites the manifest.

## 6. Recommendation
1. **Emit namespace constants (form a), `bodytab.py --emit namespace`, as the project form.** Reasons: fastest and simplest (0.1 s at the real size, flat to 120 k elements); the only form that lives entirely inside `dsp.cmajor`, which is the one file the Amorph agent workflow certainly handles (P03 section 1: the host defines no `.cmajorpatch` field list, manifest `externals` loading is unverified, and a missing external is a hard compile error); no per-instance state copy; namespace helpers can read `rebody::tables::x` directly; `cmaj test` and `cmaj render` need nothing besides the file.
2. `bodytab.py` must support, as already implemented: `--emit namespace` (default, required), `--emit main` (`struct Tables`, `make*()` literal functions, `load (Tables&)`; the processor owns the instance) and `--emit external` (namespace-level `external` declarations plus the manifest object). Neither element-wise form (b1) nor a form with a single literal of 65 536 or more elements is acceptable; the tool should fail if one array would reach that limit.
3. Fallback order if the Amorph host ever rejects or stalls on big const literals: `main` first (self-contained in `dsp.cmajor`, array literals, 0.2 to 0.4 s), `external` only if Amorph is shown to load manifest externals (spike on the owner's Amorph).
4. Consumer convention for P2 so the fallbacks stay cheap: read tables in processor-scope control code (like `controlTick` in `90_main.cmajor`) and pass scalars or `const float[N]&` to the pure helpers in `rebody::modal` / `rebody::line`; do not scatter `rebody::tables::x` through the namespace helpers. In the `main` form the same reads become `tables.x`, a mechanical change confined to the processor.

## 7. P1 skeleton measurements (T4: full-size line state)
- Skeleton = 73 parameters, 10 output events, `Line[3] lines` with the final-size state: Line = 66.6 k floats (delay lines 61.4 k: bore 8 192 + sax 8 192 + shared string 8 192 + pick comb 4 096 + piano pair 32 768; grid, 198 slot modes and control state about 5 k), processor state 207 k floats = 830 KB (`sizeof` of the generated C++ class), above the 131 072-float guideline of core-dsp.
- **Cmajor #94 (struct array containing arrays): compiles and runs**, `rebody::line::Line[3] lines` is accepted (also `Line&` parameters, element references such as `stepMode (..., l.grid.re.at (3), ...)`, nested structs, `namespace a::b`). No fallback to `lineA/lineB/lineC` is needed; the fallback is documented in `90_main.cmajor`.
- Compile time of the skeleton: `cmaj generate --target=cpp` 0.27 s (3 runs: 0.27 to 0.29 s), 205 KB of C++; JIT/`cmaj play --dry-run --no-gui` 0.52 to 0.60 s; `llvm-x86_64` 0.63 s, `javascript` 0.64 s, `wast` 0.49 s. No compile stall at 207 k floats of state.

## 8. Skeleton checks run (P1 DSP gate)
```
python3 tools/build_dsp.py                     # regenerate regions, write plugin/dsp.cmajor
python3 tools/build_dsp.py --check             # stale-check (exit 1 if stale)
cmaj generate --target=cpp --output=/dev/null plugin/RE_BODY.cmajorpatch      # rc 0, no warnings
cmaj render --rate=48000 --input=sine440_48000.wav --output=out.wav plugin/RE_BODY.cmajorpatch
python3 <kit>/tools/cmajor_lint.py plugin/dsp.cmajor --strict                 # clean
python3 <kit>/tools/manifest_check.py plugin/RE_BODY.cmajorpatch --strict     # 1 warning, see below
```
`cmaj render` results (2 s inputs, float32 WAV, stereo; the first 20 480 output frames of every render are silence from the render tool and are excluded; stereo output, Mix 45 % default, wet silent in P1, so the expected output is 0.55 x input):

| case | rate | result |
|---|---|---|
| silence | 44.1 / 48 / 96 kHz | all frames exactly 0.0, finite |
| 440 Hz sine, 0.5 peak | 44.1 / 48 / 96 kHz | finite; least-squares gain 0.55000, residual rms 5e-9 (dry passes at Mix 45 %) |
| Mix 100 % (param3 init 100) | 48 kHz | output 0 (wet silent) |
| Mix 0 % | 48 kHz | gain 1.00000, residual 0 |
| Bypass On (param5 init 1) | 48 kHz | gain 1.00000, residual 0 |
| lines B, C enabled, Morph 2.5 / 9.5, Hold on | 48 kHz | gain 0.55000, finite |
| NaN, +/-Inf and a 100.0 sample in the input | 48 kHz | output finite (dry NaN-guarded; the 100.0 sample passes at 0.55 as in BODY, which only clamps the body input) |

Telemetry (printed through a scratch copy with `console <-`, since `cmaj render` does not print output events): frames every 1 600 samples at 48 kHz (`int(sr/30)`), `bodyViz` input peak 0.4986 for the 0.5 sine, wet 0 (silent), `bodyOnset` 0.89 at the sine start decaying to 0, `lineStateA/B/C` carry onset, hold, `dominantBody` and the anchor weights (Line A at init Morph 7: dominant 7, engine7 = 1; Morph 2.5: engine2 = engine3 = 0.5).

Kit tools: `cmajor_lint.py --strict` clean (0 errors, 0 warnings). `manifest_check.py --strict` reports one warning that is not fixed: `ID 'com.clearpeak.re_body' is not reverse-DNS style (lowercase, dot-separated)`. The kit regex `^[a-z0-9]+(\.[a-z0-9]+)+$` rejects the underscore; Cmajor accepts the ID and the manifest ID is fixed by `plugin/spec.json` and the P1 brief. If the lead prefers a green strict run, the id would change to `com.clearpeak.rebody` in `spec.json` and the manifest together (the id is the host's stable key, so this must be decided before the first release).
