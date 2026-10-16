# 00 — P1 host spike (to be run by the owner on Amorph, results recorded here)

Purpose: verify on the real host what the cloud session cannot (decision D33, review 40 §D1/D7/D8/D13/F8). Hand-over: repository `ClarkParker/RE_BODY`, branch `claude/gallant-mendel-xg901g`, folder `plugin/` (files `RE_BODY.cmajorpatch`, `dsp.cmajor`, `index.js`).

## Steps (Amorph FX, MCP loop or the Build tab)
1. `get_host_status` → `create_project` "RE_BODY" → put `dsp.cmajor` and `index.js` into the project (`edit_lines`/paste) → `get_error` must be none. Record the compile time the host shows (cloud JIT: 0.5-0.6 s; state ≈ 207 k floats).
2. Play audio through it: Mix 45 % must pass the input at −5.2 dB (gain 0.55), Bypass On must be dry, Mix 0 dry, Mix 100 silent (wet is still empty in P1).
3. `run_qa_probe` → record the full result (silence, NaN/Inf, stereo, DC).
4. `run_ui_probe` → record whether it complains about hidden controls (lines B and C are in the DOM with `hidden`). This decides tabs vs the fallback strip (D39).
5. In the UI: switch tabs A/B/C, move dials, type values; confirm the host sees automation (Enable B on → `lineStateB` activity lamp). Record whether the custom output events (`bodyViz`, `bodyBands`, `bodyOnset`, `analysisViz`, `lineStateA/B/C`) reach the UI: the IN/WET meters and the onset lamp must move with audio.
6. Move the mouse over the panel inside the DAW: note whether hover/pointermove is delivered (the Motion switch has no effect yet; this only tests delivery for P6).
7. Resize the plugin window to half and double size: layout must scale without scrollbars; note any text that becomes unreadable.
8. Note the DAW, OS, Amorph version, sample rate and buffer size.

## Results (fill in)
| item | result |
|---|---|
| compile time / errors | |
| audio pass-through | |
| run_qa_probe | |
| run_ui_probe (hidden controls) | |
| output events delivered | |
| pointermove delivered | |
| resize behaviour | |
| environment | |
