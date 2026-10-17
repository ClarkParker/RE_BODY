// ---- Motion model (21_UI_CONCEPT section 3, decision D38) ---------------------------------------------------------
// One controller owns everything that moves the depth field as a whole: pointer tilt, idle drift, audio push, breathing.
// It applies exactly ONE transform to the scene element per frame and keeps its own frame loop that exists only while
// something differs from its target by more than MOTION_EPS (no always-on loop, review F6).
//
//   state   off  : no tilt, no drift, no audio motion (static depth, light, fog)
//           calm : tilt cap 1.5 deg, audio motion, no idle drift          (default, D17)
//           full : tilt cap 4 deg, audio motion, idle drift +-1 deg Lissajous 0.05 / 0.07 Hz, stops 20 s after the
//                  last pointer or audio activity and eases to 0 over 2 s, then the loop ends
//   yaw   = T * px + D * g * sin(2 pi 0.05 t)          pitch = T * py + D * g * sin(2 pi 0.07 t)   (g = drift gain 0..1; Full worst case 4 + 1 = 5 deg)
//   Sign convention: the hovered side comes toward the viewer (rotateY(-yaw) rotateX(+pitch)).
//   push  = 6 px * env(onset)  (attack 60 ms, release 400 ms) as translateZ(-push);  breathe = 1 + 0.004 * wet
//   v += (target - v) * (1 - exp(-dt / 0.12))  for yaw, pitch, wet and the light position
//
// Pointer input: pointermove / pointerleave on the host element only, no capture, no document listeners. A move with a
// button held is a control or morph drag (the controls capture the pointer themselves), so it is ignored and the
// target is held; the panel can also call pause(true) explicitly. The effective state is `off` while the OS asks for
// reduced motion (query and change listener as the original, index.js:330).
// suspend(true) is the 07 section 3 pause for window-resize drags: no frame is requested, pointer input is dropped and the drift clock stands
// still until suspend(false), which the scaling part calls from its settle timer.
const MOTION_STATES = ["off", "calm", "full"];
const MOTION_TILT = { off: 0, calm: 1.5, full: 4 };   // degrees at the host edge
const MOTION_DRIFT_DEG = 1, MOTION_DRIFT_HZ = [0.05, 0.07];
const MOTION_IDLE_MS = 20000, MOTION_DRIFT_EASE_S = 2;
const MOTION_TAU = 0.12, MOTION_ATTACK = 0.06, MOTION_RELEASE = 0.4;
const MOTION_PUSH_PX = 6, MOTION_BREATHE = 0.004;
const MOTION_EPS = 0.01;      // a target counts as reached when it is closer than this (degrees, or 0..1 for push / wet / light)
const MOTION_LIGHT_MS = 33;   // onLight is called at most 30 Hz
const MOTION_ACTIVITY = 0.02; // onset / wet above this counts as audio activity (keeps the Full drift alive)

class MotionController {
    // host: element that receives pointermove / pointerleave. scene: the element that gets the transform.
    // onLight(x, y): optional callback with the smoothed pointer position (-1..1) at most 30 Hz, so the light layer can be moved with an inline
    // transform (a CSS custom property on or above that layer would repaint it, measured: re-raster on every write).
    // state: 'off' | 'calm' | 'full'; when omitted it is read from localStorage (key STORE_MOTION, default calm).
    constructor({ host, scene, onLight = null, state = null } = {}) {
        this.host = host;
        this.scene = scene;
        this.onLight = onLight;
        this.state = MOTION_STATES.includes(state) ? state : MotionController.storedState();
        this.mq = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
        this.reduced = !!(this.mq && this.mq.matches);   // cached: reading mq.matches every frame can swallow the change event in Chromium
        // smoothed current state
        this.yaw = 0; this.pitch = 0; this.push = 0; this.wet = 0; this.lightX = 0; this.lightY = 0;
        // targets
        this.px = 0; this.py = 0;          // pointer position over the host, -1..1
        this.onset = 0; this.wetTarget = 0;
        this.gain = 0;                     // drift gain 0..1 (ramps over MOTION_DRIFT_EASE_S)
        this.t = 0;                        // drift clock in seconds, advances only while the loop runs and is not paused
        this.activity = 0;
        this.paused = false;
        this.suspended = false;            // window-resize drag in progress (07 section 3)
        this.running = false;
        this.frames = 0;                   // frames rendered by the loop (diagnostics)
        this.written = "";
        this.rect = null; this.rectAt = -Infinity;
        this.lightWrote = -Infinity; this.lightText = "";
        this.appliedEff = null;
        this._raf = 0; this._last = 0;
        this._tick = this._frame.bind(this);
        this._onMove = this._move.bind(this);
        this._onLeave = this._leave.bind(this);
        this._onQuery = event => { this.reduced = !!event.matches; this.appliedEff = null; this.setState(this.state); };
    }
    static storedState() {
        try { const m = localStorage.getItem(STORE_MOTION); if (MOTION_STATES.includes(m)) return m; } catch { /* storage may be blocked: default stays */ }
        return "calm";
    }
    // The state that actually applies: the OS reduced-motion preference always wins.
    effective() { return this.reduced ? "off" : this.state; }

    start() {
        if (this.running || !this.host || !this.scene) return;
        this.running = true;
        this.host.addEventListener("pointermove", this._onMove, { passive: true });
        this.host.addEventListener("pointerleave", this._onLeave, { passive: true });
        this.mq?.addEventListener?.("change", this._onQuery);
        this.activity = performance.now();
        this.appliedEff = null;
        this.setState(this.state);
        this.write(true);
        this.kick();
    }
    stop() {
        this.running = false;
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = 0;
        this.host?.removeEventListener("pointermove", this._onMove);
        this.host?.removeEventListener("pointerleave", this._onLeave);
        this.mq?.removeEventListener?.("change", this._onQuery);
    }
    setState(state) {
        if (!MOTION_STATES.includes(state)) return;
        this.state = state;
        if (this.mq) this.reduced = this.mq.matches;   // also re-reads the OS preference, so a missed change event cannot leave a stale value
        const eff = this.effective();
        if (eff === this.appliedEff) return;
        this.appliedEff = eff;
        if (eff === "off") {   // Off is static depth: snap to neutral at once, nothing eases
            this.yaw = this.pitch = this.push = this.wet = this.lightX = this.lightY = 0;
            this.px = this.py = this.gain = 0;
            this.onset = this.wetTarget = 0;
            this.write(true);
            this.writeLight(performance.now(), true);
        } else {
            this.activity = performance.now();
            this.kick();
        }
    }
    // Audio push and breathing: onset 0..1 (bodyOnset envelope), wet 0..1 (bodyViz wet, log-scaled by the caller).
    notifyAudio(onset, wet) {
        const o = clamp(Number.isFinite(onset) ? onset : 0, 0, 1), w = clamp(Number.isFinite(wet) ? wet : 0, 0, 1);
        if (this.effective() === "off") return;
        this.onset = o; this.wetTarget = w;
        if (o > MOTION_ACTIVITY || w > MOTION_ACTIVITY) this.activity = performance.now();
        if (Math.abs(o - this.push / MOTION_PUSH_PX) > MOTION_EPS || Math.abs(w - this.wet) > MOTION_EPS || this.driftWanted(performance.now())) this.kick();
    }
    // Held during control and morph drags: pointer input is ignored and the tilt target and the drift clock stand still.
    pause(paused) {
        this.paused = !!paused;
        if (!this.paused) this.kick();
    }
    // Window-resize drags (07 section 3): while suspended nothing renders and no frame is requested; the settle timer resumes it.
    suspend(suspended) {
        const was = this.suspended;
        this.suspended = !!suspended;
        if (this.suspended && this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
        if (was && !this.suspended) { this.rect = null; this.kick(); }   // the host box moved: re-read it on the next pointer move
    }
    snapshot() {
        return { state: this.state, suspended: this.suspended, effective: this.effective(), yaw: this.yaw, pitch: this.pitch, push: this.push, breathe: 1 + MOTION_BREATHE * this.wet,
            px: this.px, py: this.py, gain: this.gain, running: this._raf !== 0, frames: this.frames, transform: this.written };
    }

    // ---- input ----------------------------------------------------------------------------------------------------
    _move(event) {
        if (!this.running || this.paused || this.suspended || event.buttons || event.pointerType === "touch" || this.effective() === "off") return;
        const now = performance.now();
        if (!this.rect || now - this.rectAt > 250) { this.rect = this.host.getBoundingClientRect(); this.rectAt = now; }   // zoom-aware box of the host
        const r = this.rect;
        if (!(r.width > 0 && r.height > 0)) return;
        this.px = clamp((event.clientX - r.left) / r.width * 2 - 1, -1, 1);
        this.py = clamp((event.clientY - r.top) / r.height * 2 - 1, -1, 1);
        this.activity = now;
        this.kick();
    }
    _leave() {
        if (!this.running) return;
        this.rect = null;
        this.px = this.py = 0;   // Full: back to the drift
        this.kick();
    }

    // ---- frame loop: exists only while something moves ------------------------------------------------------------
    kick() {
        if (this._raf || !this.running || this.suspended) return;
        this._last = performance.now() - 16.7;
        this._raf = requestAnimationFrame(this._tick);
    }
    driftWanted(now) { return this.effective() === "full" && now - this.activity < MOTION_IDLE_MS; }
    _frame(now) {
        this._raf = 0;
        if (!this.running || this.suspended) return;
        const dt = clamp((now - this._last) / 1000, 0, 0.1);
        this._last = now;
        const eff = this.effective(), full = eff === "full", T = MOTION_TILT[eff];
        const smooth = 1 - Math.exp(-dt / MOTION_TAU);
        if (!this.paused) {
            this.t += dt;
            const want = this.driftWanted(performance.now()) ? 1 : 0;
            this.gain = clamp(this.gain + Math.sign(want - this.gain) * Math.min(Math.abs(want - this.gain), dt / MOTION_DRIFT_EASE_S), 0, 1);
        }
        const D = full ? MOTION_DRIFT_DEG * this.gain : 0;
        const ty = T * this.px + D * Math.sin(2 * Math.PI * MOTION_DRIFT_HZ[0] * this.t);
        const tp = T * this.py + D * Math.sin(2 * Math.PI * MOTION_DRIFT_HZ[1] * this.t);
        const tpush = eff === "off" ? 0 : this.onset, twet = eff === "off" ? 0 : this.wetTarget;
        const tlx = eff === "off" ? 0 : this.px, tly = eff === "off" ? 0 : this.py;
        this.yaw += (ty - this.yaw) * smooth;
        this.pitch += (tp - this.pitch) * smooth;
        this.wet += (twet - this.wet) * smooth;
        const env = this.push / MOTION_PUSH_PX;
        this.push = MOTION_PUSH_PX * (env + (tpush - env) * (1 - Math.exp(-dt / (tpush > env ? MOTION_ATTACK : MOTION_RELEASE))));
        this.lightX += (tlx - this.lightX) * smooth;
        this.lightY += (tly - this.lightY) * smooth;
        const driftLive = full && (this.gain > 0 || this.driftWanted(now));
        const moving = driftLive || Math.abs(ty - this.yaw) > MOTION_EPS || Math.abs(tp - this.pitch) > MOTION_EPS
            || Math.abs(tpush - this.push / MOTION_PUSH_PX) > MOTION_EPS || Math.abs(twet - this.wet) > MOTION_EPS
            || Math.abs(tlx - this.lightX) > MOTION_EPS || Math.abs(tly - this.lightY) > MOTION_EPS;
        if (!moving) {   // arrived: snap exactly onto the targets and let the loop end
            this.yaw = ty; this.pitch = tp; this.wet = twet; this.push = MOTION_PUSH_PX * tpush; this.lightX = tlx; this.lightY = tly;
        }
        this.frames++;
        this.write(false);
        this.writeLight(now, !moving);
        if (moving) this._raf = requestAnimationFrame(this._tick);
    }
    // The one transform of the scene: translateZ(-push), breathe factor, rotateY(yaw), rotateX(pitch); scale3d leaves z untouched.
    write(force) {
        if (!this.scene) return;
        const text = `translate3d(0px,0px,${(-this.push).toFixed(2)}px) scale3d(${(1 + MOTION_BREATHE * this.wet).toFixed(5)},${(1 + MOTION_BREATHE * this.wet).toFixed(5)},1) rotateY(${(-this.yaw).toFixed(3)}deg) rotateX(${this.pitch.toFixed(3)}deg)`;
        if (force || text !== this.written) { this.written = text; this.scene.style.transform = text; }
    }
    writeLight(now, force) {
        if (!this.onLight || (!force && now - this.lightWrote < MOTION_LIGHT_MS)) return;
        const text = `${this.lightX.toFixed(3)} ${this.lightY.toFixed(3)}`;
        if (text === this.lightText) return;
        this.lightWrote = now; this.lightText = text;
        this.onLight(this.lightX, this.lightY);
    }
}
