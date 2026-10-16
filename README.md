# RE·BODY

Working repository for **RE·BODY** (technical identifier `RE_BODY`), a new version of the
Amorph plugin *BODY* by Artists in DSP, rebuilt on physically modelled bodies (PHYSIFY lineage)
with a layered parallax UI (LALAFY lineage). Manufacturer: `CLΞΛRPΞΛK`.

Naming rule: `RE·BODY` (U+00B7 middle dot) for every user-facing string (GUI header, DAW
metadata); `RE_BODY` (ASCII underscore) for code identifiers, targets, folders and binaries.

## Layout
- `reference/body_original/` — the unmodified original BODY (`dsp.cmajor`, `index.js`). Baseline, never edited.
- `docs/index/` — the research index built before concept work:
  - `00_MATERIAL_INDEX.md` — inventory of the LALAFY archive export (versions, duplicates, newest state)
  - `01_BODY_ORIGINAL.md` — architecture of the original plugin
  - `02_LALAFY.md` — LALAFY voice synth: DSP, UI, reusable blocks
  - `03_AMORPH_PLATFORM.md` — Amorph host rules, DEV-Kit recipes, submission checklist
  - `04_PHYSIFY.md` — PHYSIFY physical-modelling blocks worth reusing
- `docs/research/` — web research, bucket method with sources:
  - `10_PM_BODY_RESEARCH.md` — physically modelled bodies: papers, products, open code, measured data, morphing
  - `11_UI_UX_RESEARCH.md` — premium plugin UI, depth/parallax techniques, interaction, visualisation
- `docs/concept/` — the agreed target design:
  - `00_DECISIONS.md` — owner decision log
  - `20_DSP_CONCEPT.md` — recipe-driven modal bank + line engines, damping law, parameters, morph, telemetry
  - `21_UI_CONCEPT.md` — original panel with a layered parallax instrument field, motion model, controls
  - `22_BODIES.md` — every morph anchor: generators, measured modes, line engines, contact, depth, validation
- `docs/plan/30_DEV_PLAN.md` — phases, gates, branches, branding, risks, definition of done

Related repositories (same owner, branch `claude/gallant-mendel-xg901g`):
`Amorph_DEV_KIt` (rules + recipes), `amorph-for-agents` (upstream host docs), `lalafy-cmajor`, `PHYSIFY`.
