// ---- Control: the one generic helper for every parameter widget (v2, P6) -----------------------
// kinds: dial (70 px) / small (40) / mini (28) / slider (Morph hero) / segmented / button. Logic reused from the original
// BodyDial (index.js:103-248) and the morph handlers (index.js:320-345), generalised to the ranges in data-min/max/step/init.
// v2 (21 §5, R11 R2/R3/R4/R8): dial geometry in view-box units, one-light tokens, pressed / hover / fine-mode states, default tick,
// Delete / Backspace reset, Timpani ceiling, morph weight bars + detents that grow near the thumb, Hold lamp.
const BIPOLAR = new Set(["Size", "Stretch", "Pan"]);   // arc starts at zero
const LOG_TAPER = new Set(["LowCut"]);                  // UI-only log mapping for the 20..500 Hz high-pass
const UNIT_WORDS = { "%": "percent", dB: "decibels", Hz: "hertz" };
// Dial v2 geometry. The view box is 200 units; arc stroke = CSS px * 200 / size: main 3 px = 8.6, small 2.5 px = 12.5, mini 2 px = 14.3.
const DIAL_PX = { dial: 70, small: 40, mini: 28 };
const ARC_PX = { dial: 3, small: 2.5, mini: 2 };
const TICK_PX = 1;                                       // default tick width on the arc
const unitsOf = (kind, px) => Number((px * 200 / DIAL_PX[kind]).toFixed(1));
const ARC_RADIUS = 91;                                   // as index.js:39-40
// One light, top-left (R11 R2): unit-ish vector from the object towards the light; every highlight and shadow derives from it.
const LIGHT_X = -.6, LIGHT_Y = -.8;
// TUNE_NOTE_MAX (generated block in 00_header.js, from plugin/bodies.json): Timpani stops at C4, so its Tune arc is greyed above that.
const polar = (angle, r) => { const t = (angle - 90) * Math.PI / 180; return [100 + r * Math.cos(t), 100 + r * Math.sin(t)]; };
const arcPath = (from, to) => {
    if (Math.abs(to - from) < .001) return "";
    const a = polar(from, ARC_RADIUS), b = polar(to, ARC_RADIUS);
    return `M ${a[0]} ${a[1]} A ${ARC_RADIUS} ${ARC_RADIUS} 0 ${Math.abs(to - from) > 180 ? 1 : 0} ${to >= from ? 1 : 0} ${b[0]} ${b[1]}`;
};
const TICK_EXT_PX = 1.8;                                 // how far the default tick sticks out of the track on each side
const tickPath = (norm, kind) => {   // radial default tick across the track, longer than the stroke on both sides
    const half = unitsOf(kind, ARC_PX[kind]) / 2 + unitsOf(kind, TICK_EXT_PX), angle = -135 + norm * 270, a = polar(angle, ARC_RADIUS - half), b = polar(angle, ARC_RADIUS + half);
    return `M ${a[0].toFixed(2)} ${a[1].toFixed(2)} L ${b[0].toFixed(2)} ${b[1].toFixed(2)}`;
};
const DIAL_TIP = "Drag vertically. Shift-drag for fine adjustment. Double-click or Delete to reset. Click value to type.";
const RESET_KEYS = ["Delete", "Backspace"];

class Control {
    // Markup for one control wrapper. opt: meters (segmented hairlines), caption/off/on/cls/btn/title (button).
    static html(spec, opt = {}) {
        const kind = KIND_OF_UI[spec.ui], label = labelOf(spec);
        const data = `data-param="${spec.id}" data-min="${spec.min}" data-max="${spec.max}" data-step="${spec.step}" data-init="${spec.init}" data-control="${kind}" data-line="${spec.line}"`;
        const aria = `aria-label="${spec.name}" aria-valuemin="${spec.min}" aria-valuemax="${spec.max}" aria-valuenow="${spec.init}"`;
        if (kind === "segmented") {
            const buttons = spec.text.split("|").map((t, i) => `<button type="button" class="body-segbtn" role="radio" aria-checked="false" data-v="${i}">${t}${opt.meters ? '<i class="body-segmeter"></i>' : ""}</button>`).join("");
            return `<div class="control body-seg" ${data} role="radiogroup" aria-label="${spec.name}">${buttons}</div>`;
        }
        if (kind === "button") {
            const caption = opt.caption ?? label;
            return `<div class="control body-btn ${opt.cls || ""}" ${data}><button type="button" class="knob ${opt.btn || "body-bypass"}" role="switch" aria-label="${spec.name}" aria-checked="false" data-off="${opt.off ?? caption}" data-on="${opt.on ?? caption}"${opt.title ? ` title="${opt.title}"` : ""}>${opt.off ?? caption}</button></div>`;
        }
        if (kind === "slider") {
            const ticks = ANCHOR_NAMES.map((_, i) => `<span class="body-morph-tick" style="--anchor:${i}"></span>`).join("");
            const bars = ANCHOR_NAMES.map((_, i) => `<i class="body-morph-bar" style="--anchor:${i}"></i>`).join("");
            const anchors = ANCHOR_LABELS.map((n, i) => `<button type="button" class="body-anchor" data-anchor="${i}" aria-pressed="false" title="Go to ${ANCHOR_NAMES[i].toLowerCase()}${i === NUM_ANCHORS - 1 ? " (hybrid stop: Ukulele + Oboe + Sax)" : ""}">${n}</button>`).join("");
            return `<div class="control body-morph" ${data}><div class="knob body-morph-slider" role="slider" tabindex="0" ${aria} aria-orientation="horizontal" title="Move continuously through the instruments. Shift-drag for fine adjustment. Double-click or Delete to reset."><span class="body-morph-rail">${ticks}${bars}<span class="body-morph-bracket"></span><span class="body-morph-thumb"></span></span></div><div class="body-anchor-row">${anchors}</div></div>`;
        }
        const unit = kind !== "dial" && spec.unit && spec.unit !== "%" ? ` ${spec.unit}` : "";
        const mini = kind === "mini" ? '<span class="body-labval" aria-hidden="true"></span>' : "";
        const tune = spec.key === "Tune" ? '<path class="body-dial-grey" d=""/>' : "";
        return `<div class="control body-control body-control-${kind}" ${data}><div class="knob body-dial" role="slider" tabindex="0" ${aria} aria-orientation="vertical" title="${DIAL_TIP}"><svg class="body-dial-graphic" viewBox="0 0 200 200" aria-hidden="true"><path class="body-dial-track" d="${arcPath(-135, 135)}"/>${tune}<path class="body-dial-arc" d=""/><path class="body-dial-default" d=""/></svg><span class="body-inner"><button type="button" class="value-label body-value" aria-label="Type ${label.toLowerCase()} value"></button></span><span class="body-pointer"></span></div><span class="body-label"><span class="body-labtext">${label.toUpperCase()}${unit}</span>${mini}</span></div>`;
    }

    constructor(view, node) {
        this.view = view;
        this.pc = view.pc;
        this.node = node;
        this.spec = SPEC.get(node.dataset.param);
        this.line = this.spec.line;
        this.kind = node.dataset.control;
        this.min = Number(node.dataset.min);
        this.max = Number(node.dataset.max);
        this.step = Number(node.dataset.step) || 1;
        this.init = Number(node.dataset.init);
        this.range = this.max - this.min;
        this.decimals = decimalsOf(this.step);
        this.log = LOG_TAPER.has(this.spec.key) && this.min > 0;
        this.bipolar = BIPOLAR.has(this.spec.key);
        this.value = this.init;
        this.listeners = [];
        this.pointer = null;
        this.dragging = false;
        this.gestureOpen = false;
        this.flashTimer = 0;
        this.lastText = "";
        if (this.kind === "segmented") this.wireSegmented();
        else if (this.kind === "button") this.wireButton();
        else if (this.kind === "slider") this.wireSlider();
        else this.wireDial();
        this.setValue(this.init, false);   // init painted here from data-init (D2), never left as "--"
    }

    listen(el, type, fn, options) {
        el.addEventListener(type, fn, options);
        this.listeners.push([el, type, fn, options]);
    }

    // ---- value model ------------------------------------------------------------------
    get isNote() { return this.spec.key === "Tune" && this.view.isPitched(this.line); }
    get isDecay() { return this.spec.key === "Decay"; }
    normOf(v) { return this.log ? Math.log(v / this.min) / Math.log(this.max / this.min) : (v - this.min) / this.range; }
    valueOfNorm(n) { n = clamp(n, 0, 1); return this.log ? this.min * Math.pow(this.max / this.min, n) : this.min + n * this.range; }
    midi(v) { return 36 + Math.round(clamp(this.normOf(v), 0, 1) * 36); }
    noteValue(note) { return this.quantize(this.min + (clamp(note, 36, 72) - 36) / 36 * this.range); }
    quantize(v) {
        const c = clamp(v, this.min, this.max);
        return clamp(Number((this.min + Math.round((c - this.min) / this.step) * this.step).toFixed(this.decimals)), this.min, this.max);
    }
    stepBy(sign, fraction) {
        const next = this.quantize(this.valueOfNorm(this.normOf(this.value) + sign * fraction));
        return next === this.value ? this.quantize(this.value + sign * this.step) : next;   // never stall below one step
    }
    setValue(value, notify, force) {
        if (!Number.isFinite(value)) return;
        const next = this.quantize(value), changed = next !== this.value;
        this.value = next;
        this.view.values[this.spec.id] = next;
        this.refresh();
        this.view.controlChanged(this);
        if (notify && (changed || force)) this.view.send(this.spec.id, next);
    }
    begin() {
        if (this.gestureOpen) return;
        this.gestureOpen = true;
        this.pc.sendParameterGestureStart?.(this.spec.id);
    }
    end() {
        if (!this.gestureOpen) return;
        this.gestureOpen = false;
        this.pc.sendParameterGestureEnd?.(this.spec.id);
    }
    commit(value, force) {
        const open = this.gestureOpen;
        if (!open) this.begin();
        try { this.setValue(value, true, force); } finally { if (!open) this.end(); }
    }
    // Double-click, Delete and Backspace (R11 R8): back to the generated init, with a short flash of the rim as feedback.
    reset() {
        this.commit(this.init);
        this.flash();
    }
    flash() {
        const target = this.knob || this.btn;
        if (!target) return;
        target.dataset.flash = "true";
        clearTimeout(this.flashTimer);
        this.flashTimer = setTimeout(() => { this.flashTimer = 0; target.dataset.flash = "false"; }, 260);
    }
    // Shift held = fine mode: an inner ring appears on the cap (pointer events carry shiftKey, keyboard events cover focus).
    setFine(flag) {
        if (!this.knob) return;
        const s = flag ? "true" : "false";
        if (this.knob.dataset.fine !== s) this.knob.dataset.fine = s;
    }
    setPressed(flag) {   // dragging state on the control, the knob and the view (pause hook for the field's motion controller)
        const s = String(flag);
        this.knob.dataset.dragging = s;
        this.node.dataset.dragging = s;
        this.view.setDragging?.(flag);
    }
    stopDrag() {
        if (this.kind === "slider") return this.stopSlide();
        if (!this.dragging) return;
        this.dragging = false;
        this.setPressed(false);
        this.setFine(false);
        const pointer = this.pointer, captureNode = this.captureNode;
        this.suppressClick = this.pointerMoved;
        this.pointer = null;
        this.captureNode = null;
        if (captureNode?.hasPointerCapture(pointer)) captureNode.releasePointerCapture(pointer);
        this.end();
    }

    // ---- display ----------------------------------------------------------------------
    format(v, short) {
        const s = this.spec;
        if (this.isNote) return noteName(this.midi(v));
        if (this.isDecay) {
            const m = this.view.decayMap(this.line), sec = m.base * Math.exp(m.logRatio * this.normOf(v));
            return `${sec >= 10 ? sec.toFixed(1) : sec.toFixed(2)} s`;
        }
        const n = Number(v.toFixed(this.decimals));
        if (s.unit === "%") return short ? String(n) : `${n}%`;   // the small caps (28 px) have no room for "-100%"; the unit stays in aria-valuetext and the typed entry
        return short || !s.unit ? String(n) : `${n} ${s.unit}`;
    }
    refresh() {
        if (this.kind === "segmented") return this.refreshSegmented();
        if (this.kind === "button") return this.refreshButton();
        if (this.kind === "slider") return this.refreshSlider();
        const v = this.value, note = this.isNote, midi = note ? this.midi(v) : 0, full = this.format(v, false);
        this.valueEl.textContent = this.kind === "dial" ? full : this.format(v, true);
        if (this.labVal) this.labVal.textContent = full;   // mini dials show the value in the label slot on hover / drag / focus
        this.knob.setAttribute("aria-valuemin", note ? "36" : String(this.min));
        this.knob.setAttribute("aria-valuemax", note ? "72" : String(this.max));
        this.knob.setAttribute("aria-valuenow", String(note ? midi : v));
        this.knob.setAttribute("aria-valuetext", note ? `${full}, ${(440 * 2 ** ((midi - 69) / 12)).toFixed(1)} hertz` : full);
        const norm = note ? (midi - 36) / 36 : this.normOf(v);
        this.knob.style.setProperty("--norm", String(norm));
        const from = this.bipolar ? this.normOf(0) : 0;
        this.arc.setAttribute("d", arcPath(-135 + Math.min(from, norm) * 270, -135 + Math.max(from, norm) * 270));
        const initNorm = note ? (this.midi(this.init) - 36) / 36 : this.normOf(this.init);   // default tick: hidden at the very ends
        const tick = initNorm > .004 && initNorm < .996 ? tickPath(initNorm, this.kind) : "";
        if (this.tickD !== tick) { this.tickD = tick; this.tick.setAttribute("d", tick); }
        if (this.grey) this.refreshGrey(note);
    }
    // Timpani ceiling: the morph-weighted top note of the line's body; the arc above it is drawn greyed (N7).
    refreshGrey(note) {
        let hi = 72;
        if (note) { const w = this.view.weightsOf(this.line).w; hi = 0; for (let i = 0; i < NUM_ANCHORS; i++) hi += w[i] * TUNE_NOTE_MAX[i]; }
        const d = note && hi < 71.5 ? arcPath(-135 + (hi - 36) / 36 * 270, 135) : "";
        if (this.greyD !== d) { this.greyD = d; this.grey.setAttribute("d", d); }
    }

    // ---- dial / small / mini ----------------------------------------------------------
    wireDial() {
        this.knob = this.node.querySelector(".body-dial");
        this.valueEl = this.node.querySelector(".body-value");
        this.arc = this.node.querySelector(".body-dial-arc");
        this.tick = this.node.querySelector(".body-dial-default");
        this.grey = this.node.querySelector(".body-dial-grey");
        this.labVal = this.node.querySelector(".body-labval");
        const knob = this.knob;
        this.listen(knob, "pointerdown", event => {
            if (event.button !== 0 || this.dragging || event.target.closest("input")) return;
            event.preventDefault();
            this.view.cancelEditor?.();
            knob.focus({ preventScroll: true });
            // The value button shares the dial's drag; capture on it keeps its normal click when the pointer stays still.
            this.captureNode = event.target.closest(".body-value") || knob;
            this.captureNode.setPointerCapture(event.pointerId);
            this.pointer = event.pointerId;
            this.startX = event.clientX;
            this.startY = event.clientY;
            this.previousY = event.clientY;
            this.dragNorm = clamp(this.normOf(this.value), 0, 1);
            this.pointerMoved = false;
            this.suppressClick = false;
            this.dragging = true;
            this.setPressed(true);
            this.setFine(event.shiftKey);
            this.begin();
        });
        this.listen(knob, "pointermove", event => {
            this.setFine(event.shiftKey);
            if (!this.dragging || event.pointerId !== this.pointer) return;
            if (!this.pointerMoved) {
                if (Math.hypot(event.clientX - this.startX, event.clientY - this.startY) < 3) return;
                this.pointerMoved = true;
            }
            const delta = this.previousY - event.clientY;
            this.previousY = event.clientY;
            this.dragNorm = clamp(this.dragNorm + delta / (event.shiftKey ? 1200 : 240), 0, 1);
            this.setValue(this.isNote ? this.noteValue(36 + Math.round(this.dragNorm * 36)) : this.valueOfNorm(this.dragNorm), true);
        });
        this.listen(knob, "pointerleave", () => { if (!this.dragging) this.setFine(false); });
        for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) this.listen(knob, type, event => {
            if (event.pointerId === this.pointer) this.stopDrag();
        });
        // A completed drag may still produce a click; consume it before it reaches the value editor (keyboard click, detail 0, stays).
        this.listen(knob, "click", event => {
            if (event.detail !== 0 && this.suppressClick) {
                this.suppressClick = false;
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        }, true);
        this.listen(this.valueEl, "click", () => this.edit());
        this.listen(knob, "dblclick", event => {
            if (event.target.closest("button, input")) return;
            event.preventDefault();
            this.reset();
        });
        this.listen(knob, "keyup", event => { if (event.key === "Shift") this.setFine(false); });
        this.listen(knob, "blur", () => this.setFine(false));
        this.listen(knob, "keydown", event => {
            if (event.key === "Shift") this.setFine(true);
            if (event.target !== knob || this.dragging) return;
            if (event.key === "Enter") { event.preventDefault(); this.edit(); return; }
            const keys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End", ...RESET_KEYS];
            if (!keys.includes(event.key)) return;
            event.preventDefault();
            if (event.key === "Home") return this.commit(this.min);
            if (event.key === "End") return this.commit(this.max);
            if (RESET_KEYS.includes(event.key)) return this.reset();
            const sign = ["ArrowUp", "ArrowRight", "PageUp"].includes(event.key) ? 1 : -1, page = event.key.startsWith("Page");
            if (this.isNote) this.commit(this.noteValue(this.midi(this.value) + sign * (page ? 12 : 1)));
            else this.commit(this.stepBy(sign, page ? .1 : event.shiftKey ? .001 : .01));
        });
        this.listen(knob, "wheel", event => {
            if (document.activeElement !== knob || this.dragging || !event.deltaY) return;
            event.preventDefault();
            const sign = Math.sign(-event.deltaY);
            this.commit(this.isNote ? this.noteValue(this.midi(this.value) + sign) : this.stepBy(sign, event.shiftKey ? .001 : .01));
        }, { passive: false });
    }

    // Typed value editor (index.js:360-426) generalised: note names for pitched Tune, seconds for Decay,
    // unit stripping (% s dB Hz kHz), clamp + step rounding from the control's own range.
    parseEntry(text, isNote, map) {
        text = text.trim().replace(",", ".");
        if (isNote) {
            const m = /^([a-g])([#♯b♭]?)(-?\d)$/i.exec(text);
            if (!m) return NaN;
            const offset = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1].toUpperCase()];
            const accidental = /[#♯]/.test(m[2]) ? 1 : /[b♭]/.test(m[2]) ? -1 : 0;
            return this.noteValue((Number(m[3]) + 1) * 12 + offset + accidental);
        }
        const u = /\s*(%|khz|hz|db|seconds|sec|s)\s*$/i.exec(text), unit = u ? u[1].toLowerCase() : "";
        const numeric = u ? text.slice(0, u.index) : text;
        let value = numeric.length ? Number(numeric) : NaN;
        if (!Number.isFinite(value)) return NaN;
        if (unit === "khz") value *= 1000;
        if (map && unit !== "%") value = this.min + this.range * Math.log(clamp(value, map.base, map.base * Math.exp(map.logRatio)) / map.base) / map.logRatio;
        else if (map) value = this.min + this.range * value / 100;
        return value;
    }
    edit() {
        const view = this.view;
        view.cancelEditor?.();
        this.stopDrag();
        const isNote = this.isNote, isDecay = this.isDecay, map = isDecay ? { ...view.decayMap(this.line) } : null;
        const input = document.createElement("input");
        input.className = "body-editor";
        input.type = "text";
        input.inputMode = isNote ? "text" : "decimal";
        input.autocomplete = "off";
        input.spellcheck = false;
        input.value = isNote ? noteName(this.midi(this.value)) : isDecay ? (map.base * Math.exp(map.logRatio * this.normOf(this.value))).toFixed(2) : String(Number(this.value.toFixed(this.decimals)));
        input.setAttribute("aria-label", isNote ? "Tune, C2 through C5" : isDecay ? "Decay in seconds" : `${labelOf(this.spec)} in ${UNIT_WORDS[this.spec.unit] || "units"}`);
        let list;
        if (isNote) {
            list = document.createElement("datalist");
            view.noteListID ??= `body-notes-${Math.random().toString(36).slice(2)}`;   // per-view id keeps several views independent
            list.id = view.noteListID;
            list.innerHTML = Array.from({ length: 37 }, (_, i) => `<option value="${noteName(36 + i)}"></option>`).join("");
            input.setAttribute("list", list.id);
            this.node.append(list);
        }
        this.valueEl.hidden = true;
        this.valueEl.parentElement.append(input);
        this.node.dataset.editing = "true";
        view.editorParam = this.spec.id;
        let done = false;
        const finish = save => {
            if (done) return;
            done = true;
            view.editorParam = null;
            view.cancelEditor = null;
            const value = this.parseEntry(input.value, isNote, map);
            if (save && Number.isFinite(value)) this.commit(value);
            input.remove();
            list?.remove();
            this.valueEl.hidden = false;
            this.node.dataset.editing = "false";
            this.refresh();
        };
        input.addEventListener("blur", () => finish(true));
        input.addEventListener("keydown", event => {
            event.stopPropagation();
            if (!["Enter", "Escape"].includes(event.key)) return;
            event.preventDefault();
            finish(event.key === "Enter");
            this.valueEl.focus({ preventScroll: true });
        });
        view.cancelEditor = () => finish(false);
        input.focus({ preventScroll: true });
        input.select();
    }

    // ---- morph slider hero (index.js:320-325, :341-345) over data-min..data-max --------------
    wireSlider() {
        this.knob = this.node.querySelector(".body-morph-slider");
        this.rail = this.node.querySelector(".body-morph-rail");
        this.anchors = [...this.node.querySelectorAll(".body-anchor")];
        this.ticks = [...this.node.querySelectorAll(".body-morph-tick")];
        this.bars = [...this.node.querySelectorAll(".body-morph-bar")];
        this.near = this.ticks.map(() => "");
        this.weightText = this.bars.map(() => "");
        const knob = this.knob;
        this.anchors.forEach((node, i) => this.listen(node, "click", () => this.commit(i)));
        this.listen(knob, "pointerdown", event => {
            if (event.button !== 0 || this.pointer != null) return;
            event.preventDefault();
            this.view.cancelEditor?.();
            knob.focus({ preventScroll: true });
            this.pointer = event.pointerId;
            this.previousX = event.clientX;
            knob.setPointerCapture(event.pointerId);
            this.setPressed(true);
            this.begin();
            if (!event.shiftKey) this.slideTo(event);
        });
        this.listen(knob, "pointermove", event => { if (event.pointerId === this.pointer) this.slideTo(event); });
        for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) this.listen(knob, type, event => {
            if (event.pointerId === this.pointer) this.stopSlide();
        });
        this.listen(knob, "dblclick", event => { event.preventDefault(); this.reset(); });
        this.listen(knob, "keydown", event => {
            if (this.pointer != null || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown", ...RESET_KEYS].includes(event.key)) return;
            event.preventDefault();
            if (RESET_KEYS.includes(event.key)) return this.reset();
            const sign = ["ArrowUp", "ArrowRight", "PageUp"].includes(event.key) ? 1 : -1;
            this.commit(event.key === "Home" ? this.min : event.key === "End" ? this.max : this.value + sign * (event.key.startsWith("Page") ? 1 : event.shiftKey ? .001 : .05));
        });
        this.listen(knob, "wheel", event => {
            if (document.activeElement !== knob || !event.deltaY || this.pointer != null) return;
            event.preventDefault();
            this.commit(this.value + Math.sign(-event.deltaY) * (event.shiftKey ? .001 : .05));
        }, { passive: false });
    }
    slideTo(event) {
        const rect = this.rail.getBoundingClientRect();
        if (!(rect.width > 0)) return;
        const value = event.shiftKey ? this.value + (event.clientX - this.previousX) / rect.width * this.range * .1 : this.min + (event.clientX - rect.left) / rect.width * this.range;
        this.previousX = event.clientX;
        this.setValue(value, true);
    }
    stopSlide() {
        if (this.pointer == null) return;
        const pointer = this.pointer;
        this.pointer = null;
        this.setPressed(false);
        if (this.knob.hasPointerCapture(pointer)) this.knob.releasePointerCapture(pointer);
        this.end();
    }
    refreshSlider() {
        const v = this.value, text = morphDescription(v);
        this.knob.style.setProperty("--morph", String(this.normOf(v)));
        this.knob.setAttribute("aria-valuenow", String(v));
        this.knob.setAttribute("aria-valuetext", text);
        this.anchors.forEach((node, i) => node.setAttribute("aria-pressed", String(v === i)));
        // Detents grow as the thumb approaches (R11 R4): --near is 1 on the thumb and 0 one and a half stops away.
        const at = this.max > this.min ? v / this.range * (NUM_ANCHORS - 1) : 0;
        this.ticks.forEach((tick, i) => {
            const s = Math.max(0, 1 - Math.abs(at - i) / 1.5).toFixed(2);
            if (this.near[i] !== s) { this.near[i] = s; tick.style.setProperty("--near", s); }
        });
    }
    // Hairline weight bars (engine0..10 of lineState, anchor order); weights are 0..1, written only when they visibly change.
    setWeights(weights) {
        if (!this.bars) return;
        this.bars.forEach((bar, i) => {
            const s = clamp(weights[i] || 0, 0, 1).toFixed(2);
            if (this.weightText[i] !== s) { this.weightText[i] = s; bar.style.setProperty("--w", s); }
        });
    }

    // ---- segmented (Listen, Excite) and switches (Enable, Hold, Bypass) -------------------
    wireSegmented() {
        this.buttons = [...this.node.querySelectorAll(".body-segbtn")];
        this.buttons.forEach((b, i) => this.listen(b, "click", () => this.commit(i)));
        this.listen(this.node, "keydown", event => {
            if (RESET_KEYS.includes(event.key)) {
                event.preventDefault();
                this.reset();
                this.buttons[this.init]?.focus({ preventScroll: true });
                return;
            }
            const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
            if (!dir) return;
            const next = clamp(this.value + dir, this.min, this.max);
            event.preventDefault();
            this.commit(next);
            this.buttons[next]?.focus({ preventScroll: true });
        });
    }
    refreshSegmented() {
        this.buttons.forEach((b, i) => {
            b.setAttribute("aria-checked", String(i === this.value));
            b.tabIndex = i === this.value ? 0 : -1;
        });
    }
    wireButton() {
        this.btn = this.node.querySelector("button");
        this.offText = this.btn.dataset.off;
        this.onText = this.btn.dataset.on;
        this.listen(this.btn, "click", () => this.commit(this.value >= .5 ? 0 : 1));
        this.listen(this.btn, "keydown", event => {
            if (!RESET_KEYS.includes(event.key)) return;
            event.preventDefault();
            this.reset();
        });
    }
    refreshButton() {
        const on = this.value >= .5;
        this.btn.setAttribute("aria-checked", String(on));
        this.btn.textContent = on ? this.onText : this.offText;
    }
    // Hold lamp (lineState.hold): the DSP's own state, shown beside the parameter state.
    setLit(flag) {
        const s = String(flag);
        if (this.node.dataset.lit !== s) this.node.dataset.lit = s;
    }

    destroy() {
        this.stopDrag();
        this.end();
        clearTimeout(this.flashTimer);
        for (const [el, type, fn, options] of this.listeners) el.removeEventListener(type, fn, options);
        this.listeners = [];
    }
}
