// ---- Telemetry: declared output endpoints -> readouts. Painted at most 30 Hz; rAF runs only while something changes. ----
const READOUT_MS = 32;          // readout paint cap (30 Hz)
const STATE_HOLD_MS = 1500;     // caption stays ACTIVE this long after the last input
const WATCHDOG_MS = 500;        // no packet for this long = silence (as the original, index.js:333)
const EPS = 1e-5;
// [endpoint, number of leading floats needed]. lineModes* are declared but not drawn in P1, so they are not subscribed.
const TELEMETRY = [["bodyViz", 4], ["bodyBands", 8], ["bodyOnset", 1], ["analysisViz", 6], ["lineStateA", 5], ["lineStateB", 5], ["lineStateC", 5]];
const lv = (el, v) => {   // write the --lv custom property only when it visibly changed
    const s = v.toFixed(3);
    if (el._lv !== s) { el._lv = s; el.style.setProperty("--lv", s); }
};

const TelemetryMethods = {
    resetTelemetry() {
        this.energy = [0, 0, 0, 0];
        this.targetEnergy = [0, 0, 0, 0];
        this.bandsTarget = Array(8).fill(0);
        this.bandLevel = Array(8).fill(0);
        this.analysis = Array(6).fill(0);
        this.listenLevel = Array(7).fill(0);
        this.lineTel = Object.fromEntries(LINES.map(l => [l, { wet: 0, onset: 0, listen: 0, followHz: 0, hold: 0 }]));
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
        this.epListeners = [];
        for (const [id, need] of TELEMETRY) {
            if (!OUTPUTS.includes(id)) continue;   // declared endpoints only
            const fn = packet => this.onPacket(id, need, packet);
            this.pc.addEndpointListener(id, fn);
            this.epListeners.push([id, fn]);
        }
    },
    stopTelemetry() {
        for (const [id, fn] of this.epListeners || []) this.pc.removeEndpointListener(id, fn);
        this.epListeners = [];
    },
    onPacket(id, need, packet) {
        const v = unpack(packet);
        if (v.length < need) return;
        let live = false;
        for (let i = 0; i < need; i++) {
            if (!Number.isFinite(v[i])) return;
            if (Math.abs(v[i]) > EPS) live = true;
        }
        const now = performance.now();
        this.lastTelemetry = now;
        if (id === "bodyViz") { this.targetEnergy = v.slice(0, 4).map(x => clamp(x, 0, 8)); if (v[0] > 1e-4) this.lastInput = now; }
        else if (id === "bodyBands") this.bandsTarget = v.slice(0, 8).map(x => clamp(x, 0, 8));
        else if (id === "bodyOnset") this.onsetTarget = Math.max(this.onsetTarget, clamp(v[0], 0, 1));
        else if (id === "analysisViz") this.analysis = v.slice(0, 6).map(x => clamp(x, 0, 8));
        else Object.assign(this.lineTel[id.slice(-1)], { wet: v[0], onset: v[1], listen: v[2], followHz: v[3], hold: v[4] });
        const was = this.live[id];
        this.live[id] = live;
        this.readoutsDirty = true;
        if (live || was) this.kick();   // silence after silence does not wake the loop
    },

    // ---- frame loop: re-armed only while something moves --------------------------------------
    kick() {
        if (this._raf || !this._mounted) return;
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
        if (now - this.lastTelemetry > WATCHDOG_MS) {
            this.targetEnergy = [0, 0, 0, 0];
            this.bandsTarget.fill(0);
            this.analysis.fill(0);
            for (const t of Object.values(this.lineTel)) Object.assign(t, { wet: 0, onset: 0, listen: 0, followHz: 0 });
            this.live = {};
        }
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
        if (this.dirty || before > 0 || energy > 0) this.drawField();
        this.dirty = false;
        if (now - this.lastReadout >= READOUT_MS && (this.readoutsDirty || this.readoutsActive || this.stateDirty || this.stateText === "ACTIVE")) {
            this.lastReadout = now;
            this.paintReadouts(now);
        }
        if (this.animating(now)) this._raf = requestAnimationFrame(this._tick);
    },

    // ---- readouts -----------------------------------------------------------------------------
    paintReadouts(now) {
        this.readoutsDirty = false;
        this.stateDirty = false;
        let active = false;
        const hold = (prev, target) => { const v = Math.max(target, prev * .85); return v < .003 ? 0 : v; };
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
        // per-tab activity lamp from lineState*.listenEnergy
        for (const l of LINES) {
            this.lampLevel[l] = hold(this.lampLevel[l], log01(this.lineTel[l].listen, 8));
            const lamp = this.lamps[l], s = this.lampLevel[l].toFixed(3);
            if (lamp._lamp !== s) { lamp._lamp = s; lamp.style.setProperty("--lamp", s); }
            if (this.lampLevel[l] > 0) active = true;
        }
        // hairlines under the Listen buttons of the visible line (analysisViz; Chain = previous line's wet)
        const a = this.analysis, line = this.activeLine, prev = LINES[LINES.indexOf(line) - 1];
        const all = Math.max(a[0], a[1], a[2], a[3], a[4]);
        const raw = [all, a[0], a[1], a[2], a[3], a[4], prev ? this.lineTel[prev].wet : all];
        this.listenLevel = this.listenLevel.map((p, i) => hold(p, log01(raw[i], 8)));
        this.listenMeters[line].forEach((el, i) => lv(el, this.listenLevel[i]));
        if (this.listenLevel.some(x => x > 0)) active = true;
        this.refreshFollow();
        this.paintState(now);
        this.readoutsActive = active;
    },
    paintState(now) {
        const text = this.valueOf(GID.Bypass) >= .5 ? "BYPASSED" : now - this.lastInput < STATE_HOLD_MS ? "ACTIVE" : "NO INPUT";
        if (text === this.stateText) return;
        this.stateText = text;
        this.stateEl.textContent = text;
        this.stateEl.dataset.state = text === "ACTIVE" ? "active" : text === "BYPASSED" ? "bypass" : "idle";
    },
    // Under the caption: HELD and "FOLLOW ▸ note" for the visible line.
    refreshFollow() {
        if (!this.followNote) return;
        const ids = LINE_IDS[this.activeLine], t = this.lineTel[this.activeLine], parts = [];
        if (this.valueOf(ids.Hold) >= .5) parts.push("HELD");
        if (this.valueOf(ids.Follow) > 0 && t.followHz > 0) parts.push(`FOLLOW ▸ ${noteName(noteOfHz(t.followHz))}`);
        const text = parts.join("  ·  ");
        if (text === this.followText) return;
        this.followText = text;
        this.followNote.textContent = text;
    }
};
