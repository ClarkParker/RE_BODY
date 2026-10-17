// ---- Telemetry v2 (P6): all 10 declared output endpoints -> readouts. Painted at most 30 Hz; rAF runs only while something changes. ----
const READOUT_MS = 32;          // readout paint cap (30 Hz)
const STATE_HOLD_MS = 1500;     // caption stays ACTIVE this long after the last input
const WATCHDOG_MS = 500;        // no packet for this long = silence (as the original, index.js:333)
const EPS = 1e-5;
const SHOW_SOUND_READOUT = true;   // "A3 · 1.2 s" (lineState rootHz, t60) in front of HELD / FOLLOW under the caption: the one place for note and seconds (the field's caption shows only the instrument name)
// [endpoint, minimum floats, floats read, leading floats that are energies]. Energies decide `live` (the loop keeps running while they are non-zero);
// everything else (rootHz, t60, engines, pitchConfidence ...) needs one repaint when it changes, so steady telemetry lets the loop sleep.
const TELEMETRY = [["bodyViz", 4, 4, 4], ["bodyBands", 8, 8, 8], ["bodyOnset", 1, 1, 1], ["analysisViz", 6, 6, 5],
    ["lineStateA", 5, 20, 3], ["lineStateB", 5, 20, 3], ["lineStateC", 5, 20, 3], ["lineModesA", 16, 16, 16], ["lineModesB", 16, 16, 16], ["lineModesC", 16, 16, 16]];
// lineState float<24> field order (plugin/spec.json outputs): wet, onset, listenEnergy, followHz, hold, rootHz, t60, sustainEff, dominantBody, engine0..engine10, spare0..3.
const LS = { wet: 0, onset: 1, listen: 2, followHz: 3, hold: 4, rootHz: 5, t60: 6, sustainEff: 7, dominant: 8, engine0: 9 };
// MODE_IDS (identity of the 16 lineModes slots per body, anchor order) is generated into 00_header.js from plugin/bodies.json `modes` by tools/build_ui.py.
const lv = (el, v) => {   // write the --lv custom property only when it visibly changed
    const s = v.toFixed(3);
    if (el._lv !== s) { el._lv = s; el.style.setProperty("--lv", s); }
};
const newLineTel = () => ({ wet: 0, onset: 0, listen: 0, followHz: 0, hold: 0, rootHz: 0, t60: 0, sustainEff: 0, dominant: 0, engines: Array(NUM_ANCHORS).fill(0), modes: Array(16).fill(0) });

const TelemetryMethods = {
    resetTelemetry() {
        this.energy = [0, 0, 0, 0];
        this.targetEnergy = [0, 0, 0, 0];
        this.bandsTarget = Array(8).fill(0);
        this.bandLevel = Array(8).fill(0);
        this.analysis = Array(6).fill(0);
        this.listenLevel = Array(7).fill(0);
        this.exciteLevel = Array(4).fill(0);
        this.lineTel = Object.fromEntries(LINES.map(l => [l, newLineTel()]));   // read by the field too: wet (ghost brightness), onset, rootHz, t60, dominant, modes
        this.prevPacket = {};
        this.hadPackets = false;
        this.modesDirty = true;
        this.modeState = null;      // last { line, energies, identities } handed to the field (kept for a field that attaches later)
        this.lampLevel = { A: 0, B: 0, C: 0 };
        this.meterLevel = [0, 0];
        this.onsetTarget = 0;
        this.onsetLevel = 0;
        this.live = {};
        this.lastTelemetry = -Infinity;
        this.lastInput = -Infinity;
        this.lastReadout = 0;
        this.readoutsActive = false;
        this.readoutsDirty = true;
        this.stateDirty = true;
        this.stateText = "";
        this.followText = "";
        this.phase = 0;
        this.dirty = true;
        this.stale = false;
        this._raf = 0;
        this.prevTime = 0;
    },

    subscribeTelemetry() {
        const q = sel => [...this.querySelectorAll(sel)];
        this.meterBars = q("[data-meter] .body-meter-bar i");
        this.bandBars = q(".body-bands i");
        this.onsetLamp = this.querySelector(".body-onset-lamp");
        this.lamps = Object.fromEntries(LINES.map(l => [l, this.tabs[l]]));
        this.listenMeters = Object.fromEntries(LINES.map(l => [l, q(`[data-param="${LINE_IDS[l].Listen}"] .body-segmeter`)]));
        this.exciteMeters = Object.fromEntries(LINES.map(l => [l, q(`[data-param="${LINE_IDS[l].Excite}"] .body-segmeter`)]));
        this.followNodes = Object.fromEntries(LINES.map(l => [l, this.querySelector(`[data-param="${LINE_IDS[l].Follow}"]`)]));
        this.epListeners = [];
        for (const [id, min, max, live] of TELEMETRY) {
            if (!OUTPUTS.includes(id)) continue;   // declared endpoints only
            const spec = { min, max, live }, fn = packet => this.onPacket(id, spec, packet);
            this.pc.addEndpointListener(id, fn);
            this.epListeners.push([id, fn]);
        }
    },
    stopTelemetry() {
        for (const [id, fn] of this.epListeners || []) this.pc.removeEndpointListener(id, fn);
        this.epListeners = [];
    },
    onPacket(id, spec, packet) {
        const v = unpack(packet), n = Math.min(v.length, spec.max);
        if (n < spec.min) return;
        for (let i = 0; i < n; i++) if (!Number.isFinite(v[i])) return;
        let live = false;
        for (let i = 0; i < spec.live; i++) if (Math.abs(v[i]) > EPS) { live = true; break; }
        const prev = this.prevPacket[id];
        let changed = !prev || prev.length !== n;
        for (let i = 0; !changed && i < n; i++) if (Math.abs(v[i] - prev[i]) > 1e-4 * Math.max(1, Math.abs(v[i]))) changed = true;
        const now = performance.now(), was = this.live[id];
        this.lastTelemetry = now;
        this.hadPackets = true;
        this.live[id] = live;
        if (!live && !was && !changed) return;   // steady silence: only the watchdog stamp, no work and no wake-up
        this.prevPacket[id] = v.slice(0, n);
        if (id === "bodyViz") { this.targetEnergy = v.slice(0, 4).map(x => clamp(x, 0, 8)); if (v[0] > 1e-4) this.lastInput = now; }
        else if (id === "bodyBands") this.bandsTarget = v.slice(0, 8).map(x => clamp(x, 0, 8));
        else if (id === "bodyOnset") this.onsetTarget = Math.max(this.onsetTarget, clamp(v[0], 0, 1));
        else if (id === "analysisViz") this.analysis = v.slice(0, 6).map(x => clamp(x, 0, 8));
        else if (id.startsWith("lineState")) this.applyLineState(id.slice(-1), v);
        else this.applyLineModes(id.slice(-1), v);
        this.readoutsDirty = true;
        this.kick();
    },
    applyLineState(line, v) {
        const t = this.lineTel[line];
        t.wet = v[LS.wet]; t.onset = v[LS.onset]; t.listen = v[LS.listen]; t.followHz = v[LS.followHz]; t.hold = v[LS.hold];
        if (v.length > LS.dominant) {
            t.rootHz = v[LS.rootHz]; t.t60 = v[LS.t60]; t.sustainEff = v[LS.sustainEff];
            const dominant = clamp(Math.round(v[LS.dominant]), 0, NUM_ANCHORS - 1);
            if (dominant !== t.dominant && line === this.activeLine) this.modesDirty = true;
            t.dominant = dominant;
        }
        if (v.length >= LS.engine0 + NUM_ANCHORS) for (let i = 0; i < NUM_ANCHORS; i++) t.engines[i] = v[LS.engine0 + i];
    },
    applyLineModes(line, v) {
        this.lineTel[line].modes = v.slice(0, 16).map(x => Math.max(0, x));
        if (line === this.activeLine) this.modesDirty = true;
    },

    // ---- frame loop: re-armed only while something moves --------------------------------------
    kick() {
        if (this._raf || !this._mounted) return;
        if (this.resizing()) { this.stale = true; return; }   // 07 section 3: nothing is scheduled during a window drag; the settle timer re-kicks
        this.prevTime = performance.now() - 16;
        this._raf = requestAnimationFrame(this._tick);
    },
    touchField() { this.dirty = true; this.kick(); },
    animating(now) {
        const e = this.energy;
        return this.dirty || this.visualMorph !== this.valueOf(LINE_IDS[this.activeLine].Morph)
            || e[0] + e[1] + e[2] + e[3] > 0 || this.targetEnergy.some(x => x > EPS)
            || this.readoutsDirty || this.readoutsActive || this.stateDirty
            || Object.values(this.live).some(Boolean) || (this.stateText === "ACTIVE" && now - this.lastInput < STATE_HOLD_MS + 100);
    },
    tick(now) {
        this._raf = 0;
        if (!this._mounted) return;
        if (this.resizing()) { this.stale = true; return; }   // 07 section 3: no heavy work during a resize drag; the settle timer re-kicks
        const dt = clamp((now - this.prevTime) / 1000, 0, .1);
        this.prevTime = now;
        if (now - this.lastTelemetry > WATCHDOG_MS) this.silenceTelemetry();
        const before = this.energy[0] + this.energy[1];
        const target = this.valueOf(LINE_IDS[this.activeLine].Morph), delta = target - this.visualMorph;
        if (delta !== 0) {
            this.visualMorph = Math.abs(delta) < .000001 ? target : this.visualMorph + delta * (1 - Math.exp(-dt / .045));
            this.dirty = true;
        }
        this.energy = this.energy.map((v, i) => {
            const t = this.targetEnergy[i], next = v + (t - v) * (1 - Math.exp(-dt / (t > v ? .035 : .13)));
            return next < .000015 && t < .000015 ? 0 : next;
        });
        const energy = this.energy[0] + this.energy[1];
        if (energy > .000015 && this.motionMode() !== "off") this.phase += dt * (4 + Math.min(2, energy));
        if (this.dirty || before > 0 || energy > 0) this.drawField?.();
        this.dirty = false;
        if (now - this.lastReadout >= READOUT_MS && (this.readoutsDirty || this.readoutsActive || this.stateDirty || this.stateText === "ACTIVE")) {
            this.lastReadout = now;
            this.paintReadouts(now);
        }
        if (this.animating(now)) this._raf = requestAnimationFrame(this._tick);
    },
    // No packet for WATCHDOG_MS: every telemetry value falls back to silence once, then the loop may sleep.
    silenceTelemetry() {
        this.targetEnergy = [0, 0, 0, 0];
        this.bandsTarget.fill(0);
        this.analysis.fill(0);
        for (const l of LINES) this.lineTel[l] = Object.assign(newLineTel(), { dominant: this.lineTel[l].dominant });
        this.live = {};
        this.prevPacket = {};
        if (this.hadPackets) { this.hadPackets = false; this.readoutsDirty = true; this.modesDirty = true; }
    },

    // ---- readouts -----------------------------------------------------------------------------
    paintReadouts(now) {
        this.readoutsDirty = false;
        this.stateDirty = false;
        let active = false;
        const hold = (prev, target) => { const v = Math.max(target, prev * .85); return v < .003 ? 0 : v; };
        const line = this.activeLine, prev = LINES[LINES.indexOf(line) - 1], t = this.lineTel[line];
        // input / wet meters from the smoothed bodyViz peaks
        this.meterLevel = [log01(this.energy[0], 8), log01(this.energy[1], 10)];
        this.meterBars.forEach((bar, i) => { lv(bar, this.meterLevel[i]); if (this.meterLevel[i] > 0) active = true; });
        // 8 log bands of the wet signal
        this.bandLevel = this.bandLevel.map((p, i) => hold(p, log01(this.bandsTarget[i], 10)));
        this.bandBars.forEach((bar, i) => { lv(bar, this.bandLevel[i]); if (this.bandLevel[i] > 0) active = true; });
        // onset lamp: the endpoint is a peak-hold per frame, so each value is consumed once and then decays
        this.onsetLevel = this.onsetLevel * .8 < .01 && this.onsetTarget === 0 ? 0 : Math.max(this.onsetTarget, this.onsetLevel * .8);
        this.onsetTarget = 0;
        if (this.onsetLamp) lv(this.onsetLamp, this.onsetLevel);
        if (this.onsetLevel > 0) active = true;
        this.motion?.notifyAudio?.(this.onsetLevel, this.meterLevel[1]);   // audio push and breathing of the field's MotionController, at most 30 Hz
        // per-tab activity lamp from lineState*.listenEnergy; the lamp dims while that line is held (injection muted, 20 §14)
        for (const l of LINES) {
            this.lampLevel[l] = hold(this.lampLevel[l], log01(this.lineTel[l].listen, 8));
            const lamp = this.lamps[l], s = this.lampLevel[l].toFixed(3), held = String(this.lineTel[l].hold > .5);
            if (lamp._lamp !== s) { lamp._lamp = s; lamp.style.setProperty("--lamp", s); }
            if (lamp.dataset.hold !== held) lamp.dataset.hold = held;
            if (this.lampLevel[l] > 0) active = true;
            this.controls.get(LINE_IDS[l].Hold)?.setLit(this.lineTel[l].hold > .5);   // Hold button lit from lineState.hold
            const lock = String(this.valueOf(LINE_IDS[l].Follow) > 0 && this.analysis[5] > .5), node = this.followNodes[l];   // Follow lock lamp (pitchConfidence)
            if (node && node.dataset.lock !== lock) node.dataset.lock = lock;
        }
        // hairlines under the Listen buttons of the visible line (analysisViz; Chain = previous line's wet) and under Excite (Through = listenEnergy, strikers = onset)
        const a = this.analysis, all = Math.max(a[0], a[1], a[2], a[3], a[4]);
        const raw = [all, a[0], a[1], a[2], a[3], a[4], prev ? this.lineTel[prev].wet : all];
        this.listenLevel = this.listenLevel.map((p, i) => hold(p, log01(raw[i], 8)));
        this.listenMeters[line].forEach((el, i) => lv(el, this.listenLevel[i]));
        const excite = [t.listen, t.onset, t.onset, t.onset];
        this.exciteLevel = this.exciteLevel.map((p, i) => hold(p, log01(excite[i], 8)));
        this.exciteMeters[line].forEach((el, i) => lv(el, this.exciteLevel[i]));
        if (this.listenLevel.some(x => x > 0) || this.exciteLevel.some(x => x > 0)) active = true;
        // morph hero: weight bars from lineState engine0..10; before the DSP reports (or while it reports nothing) the morph position itself stands in
        const engines = t.engines.reduce((s, x) => s + Math.abs(x), 0) > 1e-4 ? t.engines : this.weightsOf(line).w;
        this.controls.get(LINE_IDS[line].Morph)?.setWeights(engines);
        // lineModes of the visible line go to the field (outline markers), once per change
        if (this.modesDirty) this.pushModes();
        else if (t.modes.some(x => x > EPS)) active = true;
        this.refreshFollow();
        this.paintState(now);
        this.readoutsActive = active;
    },
    // 16 slot-mode energies of the visible line's dominant body, identities from MODE_IDS (fixed recipe index order).
    pushModes() {
        this.modesDirty = false;
        const line = this.activeLine, t = this.lineTel[line], identities = MODE_IDS[clamp(t.dominant, 0, NUM_ANCHORS - 1)];
        this.modeState = { line, energies: t.modes, identities };
        this.field?.setModes?.(t.modes, identities, line);
    },
    paintState(now) {
        const text = this.valueOf(GID.Bypass) >= .5 ? "BYPASSED" : now - this.lastInput < STATE_HOLD_MS ? "ACTIVE" : "NO INPUT";
        if (text === this.stateText) return;
        this.stateText = text;
        this.stateEl.textContent = text;
        const state = text === "ACTIVE" ? "active" : text === "BYPASSED" ? "bypass" : "idle";
        this.stateEl.dataset.state = state;
        this.panel.dataset.lamp = state;   // --lamp 1 / 0.7 / 0.25 (R11 R7); the words stay in the caption, never colour alone
    },
    // Under the caption: "A3 · 1.2 s" (sounding note and T60 of the visible line), HELD and "FOLLOW ▸ note".
    refreshFollow() {
        if (!this.followNote) return;
        const ids = LINE_IDS[this.activeLine], t = this.lineTel[this.activeLine], parts = [];
        if (SHOW_SOUND_READOUT && t.rootHz > 0 && t.t60 > 0) parts.push(`${noteName(noteOfHz(t.rootHz))} · ${t.t60 >= 10 ? t.t60.toFixed(1) : t.t60.toFixed(2)} s`);
        if (this.valueOf(ids.Hold) >= .5 || t.hold > .5) parts.push("HELD");
        if (this.valueOf(ids.Follow) > 0 && t.followHz > 0) parts.push(`FOLLOW ▸ ${noteName(noteOfHz(t.followHz))}`);
        const text = parts.join("  ·  ");
        if (text === this.followText) return;
        this.followText = text;
        this.followNote.textContent = text;
    }
};
