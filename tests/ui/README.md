# tests/ui — UI smoke test

Headless Chromium against `plugin/index.js` with a mock `patchConnection` (`page.html`). It needs `plugin/index.js`, `plugin/spec.json`, `plugin/bodies.json` (build first) and Playwright with a Chromium binary.

```sh
python3 tools/build_ui.py            # plugin/index.js from src/ui/*.js (the test also runs `build_ui.py --check`)
node tests/ui/smoke.mjs              # about 3 min, exit code 0 = all checks passed
node tests/ui/smoke.mjs --shots      # also writes docs/dev/screens/p6_final_960.png and p6_final_480.png
node tests/ui/smoke.mjs --long       # adds the 25 s Full-motion drift test
```

Environment (defaults match the dev container): `PLAYWRIGHT` = path of `playwright/index.mjs` (`/opt/node-tools/node_modules/playwright/index.mjs`), `CHROMIUM` = browser executable (`/opt/pw-browsers/chromium`).

What it covers (about 190 checks, one `PASS` / `FAIL` line each, final line `SMOKE: n/m checks passed`):

| area | checks |
|---|---|
| P1 functional | 73 `data-param` once each, line sets, drag / Shift / keys / wheel / dblclick / editors, echo guard, morph, Copy, telemetry painting and its 30 Hz cap, idle = no rAF, teardown, zoom 0.5 / 1 / 2 and resize |
| P6 panel | dial v2 geometry and states, Delete reset on all kinds, default tick, morph hero (detents, weight bars, Hold lamp), lamps, grain, contrast, typography, layout, telemetry v2 (10 endpoints, `lineModes*`) |
| P6 field and motion | 11 leaf layers and flatteners, z-table and scale pairing, morph steps, hit layer, tilt per Off / Calm / Full, reduced motion, energy response (`d` written on 3 layers only), rAF accounting, zoom x perspective, frame time, re-mount, teardown |
| U6 | chain thread (both directions, ghost to ghost, hidden otherwise), strip 2 MORE / LESS (stored, `hidden` on strip 2 only), Copy undo (21 values, 10 s), Enable >= 24 px, keys 1 / 2 / 3 |
| U7 | `// WINDOW SIZE: 960x600` and manifest, window-level listeners (`resize` only), no ResizeObserver, transparent host, off-aspect window, measured `eff`, wrapper walk-up, 07 section 3 render suspension during a resize drag |
| merge | generated block current, fallback templates gone, depth = `bodies.json` zTable, ghosts follow inactive lines, sound readout once, no console errors |

The test starts its own static server on a free port and writes nothing unless `--shots` is given.
