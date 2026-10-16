# 30 — Development plan RE·BODY v1

## 0. Ground rules
- Language: repository, documentation, code comments, plugin strings in English. Chat with the owner in German.
- **Concept freeze before code:** no DSP or UI source is written until the owner has approved `docs/concept/20`, `21`, `22` and this plan.
- Branches: this repo on `claude/gallant-mendel-xg901g`. Rules and recipes from the **newest** DEV-Kit branch `claude/vibrant-faraday-cmymob` (b4e7021, 2026-09-26: upstream-synced param binding, `.patch-root`, lint rules, `docs/07_SCALING.md`, `ai/amorph_official/CORE_*.md`), plus `docs/15_BRANDING.md` from `9ce8d6d`. Upstream authority `amorph-for-agents` (d84ae4e; canonical aece339 differs only by the Cmajor pin 1.0.3209). Re-check for newer branches at the start of every phase.
- Branding (owner decision): manifest `manufacturer = "CLΞΛRPΞΛK"` (raw UTF-8, Greek Ξ U+039E and Λ U+039B), UI shows the brand small, left-aligned, directly under the plugin name (15_BRANDING §1-2). Plugin name `RE·BODY`, identifier `RE_BODY`, ID `com.clearpeak.re_body` (ASCII), description credits "based on BODY by Artists in DSP".
- Kit rule 8: a kit recipe is adopted verbatim the first time (07_SCALING, 03 echo guard, 04 bypass rule, 06 oversampling if ever needed, 12 testing), then diffed line by line; every deviation is written down (e.g. 07 zoom chassis vs upstream fluid layout).
- Verification before every push: `preflight.py --strict`, `manifest_check.py --strict`, `cmaj generate`/`cmaj test`/`cmaj render` (compiler via `tools/get_cmaj.sh`, version from the kit pin), plus the manual checks the lint lacks (`let`, `Math.`, `skew`, `data-param` uniqueness). Verified intermediate states are committed and pushed immediately (kit rule 6).
- Live Amorph checks (`run_qa_probe`, `run_ui_probe`, `audition_patch`) can only run on the owner's machine: hand-over is always repo + branch + path (kit rule 4), never files.
- Reporting (kit rule 7): after each phase an explicit completion report, item by item, with the location in the repo or UI.
- Models: Fable for design decisions, reviews and integration; Opus for DSP maths that must be right the first time; Sonnet for code generation from a fixed spec, tooling and tests; Haiku for mechanical passes (renames, table emission checks, inventories).

## 1. Phases, deliverables, gates
| Phase | Deliverables | Gate (must pass) | Who |
|---|---|---|---|
| **P0 Concept freeze** | Owner review of 20/21/22 + this plan; fine questions answered (new-body labels, timpani compass, chassis size, Motion default) | Owner "Go" in chat; decisions appended to `docs/concept/00_DECISIONS.md` | Owner + Fable |
| **P1 Foundations (M0)** | Plugin skeleton: `plugin/RE_BODY.cmajorpatch`, `plugin/dsp.cmajor` (endpoints + stubs), `plugin/index.js` (shell per CORE_UI_CONTRACT); `bodies/*.json` recipes for all 11 anchors from 22; `tools/bodytab.py` (recipe → Cmajor tables + `bodies.json` for the UI); `tests/tables.cmajtest`; `docs/dev/01_TABLE_EMISSION.md` recording which emission form compiles (namespace constants vs `main()` assignment vs manifest externals) | `cmaj generate` clean on all three emission variants tried, chosen one documented; `cmaj test` passes; preflight strict passes | Sonnet (tooling), Fable (format), Haiku (checks) |
| **P2 DSP core (M1)** | Unified modal bank + four line engines ported from BODY into the recipe architecture; recipes that reproduce BODY's seven voicings; contact, feeds, register sharing, calibration, balance, protector as BODY; `tools/render_ci.py` ported from PHYSIFY `golden_ci.py` with body metrics | Render tests: per anchor, impulse and noise at default/extreme Decay → peaks vs tables, T60, |DC|<0.01, finite decay, tri-rate 44.1/48/96 kHz; A/B against the original renders within stated tolerances | Opus (bank + melt maths), Sonnet (port), Fable (review) |
| **P3 Physics (M2+M3)** | Damping law + Material; params 6-13 with smoothing; cone/lattice tables for Sax, Oboe, Clarinet; dense soundboard; box air modes (2-DOF) for Guitar/Ukulele; energy normalisation generalised | Render tests extended (Material 0/50/100, Size ±1 oct, Position sweep, no instability at any corner); QA-probe conditions emulated offline (440 Hz sine, silence, pink) | Opus, Sonnet |
| **P4 New bodies (M4)** | Timpani, Guitar, Fiddle recipes live; morph order 0..10; hybrid re-coupled at segment 9→10; engine gating | Render tests per new body (22 §3, §5, §7); mode-level melt click test (−100 dB sweep) | Sonnet, Opus for melt |
| **P5 Telemetry (M5)** | `bodyViz`, `bodyBands`, `bodyOnset`, `bodyEngines`, `bodyModes`, `bodyRegister` at 30 Hz | Event rate and ranges verified in `cmaj render` (console probe, kit 12); zero cost when idle | Sonnet |
| **P6 UI (U0-U6)** | U0 tokens/typography/lamp/grain/brand line · U1 field layer stack, z-table, fog, light · U2 motion sources, reduced motion, Motion switch · U3 telemetry binding · U4 morph hero + anchors from `bodies.json` · U5 dial v2, main deck, advanced strip · U6 07_SCALING chassis, manifest sizes, cleanup | `ui_lint.py --strict`, `check_sync.py` DSP↔UI, manual contract checklist (P03 §7 items 9-13), headless render in Chromium (Playwright) at zoom 0.5/1/2 for layout and frame time; reduced-motion snapshot | Sonnet (code), Fable (design review), Haiku (lint passes) |
| **P7 Integration + QA** | Owner's machine: Amorph MCP loop `create_project → edit_lines/generate_code → get_error none → run_qa_probe → run_ui_probe → task_complete → apply_draft`; pointer delivery and custom-endpoint delivery confirmed; listening pass per anchor; CPU bench (JIT, 48/96 kHz, all tails active) | QA probe green; `run_ui_probe` green; owner listening notes recorded; CPU figure in `docs/dev/09_CPU.md` | Owner + Fable |
| **P8 Release** | README, CHANGELOG, credits, share via Amorph "Share…" by the owner | Final completion report | Owner |

Order and parallelism: P1 → P2 → P3 → P4 → P5 strictly sequential (each builds on the previous tables and tests). P6 U0-U2 can start after P1 (endpoints and anchors are fixed by the concept); U3 needs P5; U4-U6 need only P1. P7 needs everything.

## 2. Repository layout (target)
```
RE_BODY/
  plugin/            RE_BODY.cmajorpatch · dsp.cmajor · index.js · bodies.json (generated)
  bodies/            one recipe JSON per anchor (00_bass_drum.json … 10_obosaxolele.json)
  tools/             bodytab.py · render_ci.py · bench.sh · (kit tools invoked from Amorph_DEV_KIt)
  tests/             *.cmajtest · golden/ (reference metrics, no audio in git)
  docs/index  docs/research  docs/concept  docs/plan  docs/dev (phase logs, measurements, deviations)
  reference/body_original/   unchanged baseline
```
Files named as the Amorph host expects (`dsp.cmajor`, `index.js`, as in BODY); the kit's `<Name>DSP.cmajor` convention is not used (P03 §6 last row: mapping unverified, BODY's naming is proven).

## 3. Risks and mitigations
| Risk | Mitigation |
|---|---|
| Table emission: large literals may fail (Cmajor #135), manifest `externals` unverified in Amorph | P1 tries all three forms; chosen form documented; tables chunked per body |
| `cmaj` download in the cloud container (proxy) | `tools/get_cmaj.sh` with the kit pin; fallback: owner runs the gate locally and reports |
| Re-coupling the hybrid after Oboe gets a cone and Uke/Sax get real bodies | Keep BODY's injection points and constants as defaults; render-compare the end stop against the original |
| Loudness drift when 2-10 modes become 11-48 | Energy normalisation per body + re-measured `out_gain`; protector unchanged |
| Pointer events not delivered in DAW WebViews | Idle and audio motion sources make depth visible without a pointer; verified in P7 |
| 16 compositing layers in WebView2/WebKit | Frame-time budget ≤4 ms measured headless in P6, in host in P7; layer count can drop to 10 by merging fittings |
| CPU unknown | No ceiling by decision; measured in P7; engine gating and control-rate maths keep the bank cheap |

## 4. Definition of done (v1)
All 11 anchors render-verified; `run_qa_probe` and `run_ui_probe` green on the owner's Amorph; parallax field with reduced-motion path; 13 parameters with `data-param` controls; brand line and credit present; CPU figure recorded; docs current.
