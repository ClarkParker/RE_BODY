| # | file:line | check | expected | found | severity (error/warn) |
|---|---|---|---|---|---|
| 1 | docs/concept/20_DSP_CONCEPT.md:51 | param id, A Size | param14 (spec.json A Size) | param7 (A Enable) | error |
| 2 | docs/concept/20_DSP_CONCEPT.md:56 | param id, A Material | param13 (spec.json A Material) | param6 (Width, global) | error |
| 3 | docs/concept/21_UI_CONCEPT.md:11 | telemetry name | lineStateA/B/C, lineModesA/B/C (spec outputs) | bodyEngines, bodyModes, bodyRegister | error |
| 4 | docs/concept/21_UI_CONCEPT.md:36 | telemetry name, caption | lineStateA/B/C.followHz | bodyRegister | error |
| 5 | docs/concept/21_UI_CONCEPT.md:57 | telemetry name | lineModesA/B/C | bodyModes | error |
| 6 | docs/concept/21_UI_CONCEPT.md:58 | telemetry name | lineStateA/B/C.engine0..engine10 | bodyEngines | error |
| 7 | docs/concept/21_UI_CONCEPT.md:61 | telemetry name | lineStateA/B/C.engine0..engine10 | bodyEngines | error |
| 8 | docs/concept/21_UI_CONCEPT.md:78 | telemetry names, U3 step | lineModesA/B/C, lineStateA/B/C.engine*, followHz | modes, engines, register | error |
| 9 | docs/concept/22_BODIES.md:9 | param id, A Size | param14 | param7 (A Enable) | error |
| 10 | docs/concept/22_BODIES.md:11 | param id, A Position | param15 | param8 (A Level) | error |
| 11 | docs/concept/22_BODIES.md:49 | param id, A Body | param17 | param10 (A Sensitivity) | error |
| 12 | docs/concept/22_BODIES.md:89 | param id, A Body | param17 | param10 (A Sensitivity) | error |
| 13 | docs/concept/20_DSP_CONCEPT.md:74 | UI column, A Enable | button (spec.json ui, params 7/29/51) | tab lamp | warn |
| 14 | docs/concept/20_DSP_CONCEPT.md:79 | init, A Touch | 50 (spec.json param12) | per body | warn |
| 15 | docs/concept/20_DSP_CONCEPT.md:82 | init, A Position | 50 (spec.json param15) | per body | warn |
| 16 | docs/concept/20_DSP_CONCEPT.md:84 | init, A Body | 50 (spec.json param17) | per body | warn |
| 17 | docs/concept/20_DSP_CONCEPT.md:86 | init, A Stiffness | 50 (spec.json param19) | per body | warn |
| 18 | docs/concept/20_DSP_CONCEPT.md:87 | init, A Coupling | 50 (spec.json param20) | per body | warn |
| 19 | docs/concept/20_DSP_CONCEPT.md:88 | init, A Air | 50 (spec.json param21) | per body | warn |
| 20 | docs/concept/20_DSP_CONCEPT.md:89 | init, A Reed | 50 (spec.json param22) | per body | warn |
| 21 | docs/concept/20_DSP_CONCEPT.md:115 | field name, lineStateA/B/C | hold (spec.json outputs lineStateA) | holdFlag | warn |
| 22 | docs/concept/21_UI_CONCEPT.md:63 | ui class, Width | small (spec.json param6) | advanced strip | warn |
| 23 | docs/concept/21_UI_CONCEPT.md:74 | chassis size | 720x460 (spec.json view; 00 D16) | 720x420 | warn |
| 24 | docs/concept/21_UI_CONCEPT.md:97 | anchor label, hybrid | original text OBOSAXOLELE (reference/body_original/index.js:6) | OBOSAX· (spec.json:42) | warn |
| 25 | docs/concept/22_BODIES.md:8 | anchor label, index 10 | OBOSAX· (spec.json:42; 00 D14) | Obosaxolele | warn |
| 26 | docs/concept/22_BODIES.md:10 | count of original anchors | 8 incl. hybrid (21:95, 21:97; index.js:6) | seven (also 20:8, 00:8) | warn |
| 27 | docs/concept/22_BODIES.md:49,58,66,75 | Body default, % scale | 45, 60, 50, 70 (spec unit %, 0..100) | 0.45, 0.6, 0.5, 0.7 | warn |
| 28 | docs/plan/30_DEV_PLAN.md:18 | endpoint count, P1 | 69 parameters + 10 output endpoints | all 69 endpoints | warn |
| 29 | docs/plan/30_DEV_PLAN.md:19 | table cell count, P2 | 4 cells | 6 cells (pipe characters in DC notation) | warn |
| 30 | docs/plan/30_DEV_PLAN.md:21-22 | table cell count, P4/P4b | 4 cells per row incl. Gate and Who | P4 has 2 cells; P4b has 6 (P4 gate and owner sit in line 22) | warn |
| 31 | docs/plan/30_DEV_PLAN.md:24 | step list | U0-U6, U6 = 07_SCALING chassis (21:78) | U0-U7, U6 = line tabs, U7 = 07_SCALING | warn |
| 32 | README.md:10 | file list | plugin/spec.json listed | not listed (no plugin/ entry) | warn |
| 33 | README.md:11 | file list | reference/body_original/PROVENANCE.md listed | not listed | warn |
| 34 | plugin/spec.json:117 | group key | G (params line, spec.json:178,206,220) | global (lines key) | warn |
| 35 | plugin/spec.json:202 | note vs source | range 0..7, 8 anchors (reference/body_original/index.js:314 data-max=7) | range 0..10 (11 anchors) | warn |
| 36 | plugin/spec.json:1130,1136 | outputs fields | list of 16 field names | "same as lineStateA" (string) | warn |
| 37 | plugin/spec.json:1142,1148,1154 | outputs fields | list of 16 field names | prose or "same" (not countable) | warn |

Totals: 37 findings (12 error, 25 warn).
