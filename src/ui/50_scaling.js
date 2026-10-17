// ---- Scaling: 07_SCALING fixed chassis + CSS zoom, observer-free ------------------------------------
// Kept from 07: JS host sizing from the window size with the measured `eff` probe, window resize listener, 250 ms re-measure,
// 0.05 zoom steps, transparent host, wrapper walk-up, and section 3 render suspension: every resize event stamps lastResize and
// does two style writes; while resizing() (180 ms quiet time) the zoom change is deferred, the frame loop of the view returns early
// (no field redraw, no readout paint) and the field's MotionController is suspended (no frames at all); the 190 ms settle timer
// applies the zoom once, resumes the controller and repaints. Dropped: the resize-observer API and the viewport-height host
// rule (docs/dev/02_UI_DEVIATIONS.md section I). Zoom range 0.5..2.0 (21_UI_CONCEPT D16) instead of the recipe's 0.4..2.5.
const ZOOM_MIN = .5, ZOOM_MAX = 2, RESIZE_QUIET_MS = 180, SETTLE_MS = 190, REMEASURE_MS = 250;

const ScalingMethods = {
    resizing() { return performance.now() - this.lastResize < RESIZE_QUIET_MS; },

    // Host wrappers inserted by Amorph must not scroll or add margins.
    walkWrappers() {
        let p = this.parentElement;
        while (p && p !== document.body) {
            p.style.overflow = "hidden";
            p.style.margin = "0";
            p.style.padding = "0";
            p = p.parentElement;
        }
    },
    // measure = true re-probes the host's effective scale (eff); a resize event reuses the cached value.
    rescale(measure) {
        const w = window.innerWidth, h = window.innerHeight;
        if (!(w > 0 && h > 0) || !this.panel) return;
        const hs = this.style;
        if (measure) {
            this.walkWrappers();
            hs.width = `${w}px`;   // probe
            hs.height = `${h}px`;
            let eff = this.getBoundingClientRect().width / w;
            if (!isFinite(eff) || eff < .3 || eff > 3) eff = 1;
            this.eff = eff;
        }
        const eff = this.eff;
        hs.width = `${w / eff}px`;   // compensate the host's own scale, inline styles beat the stylesheet
        hs.height = `${h / eff}px`;
        const z = Math.round(clamp(Math.min(w / CHASSIS_W, h / CHASSIS_H) / eff, ZOOM_MIN, ZOOM_MAX) * 20) / 20;
        if (z === this.zoomNow) return;
        if (this.zoomNow && this.resizing()) return;   // deferred: the settle timer applies it once the drag has ended
        this.zoomNow = z;
        this.panel.style.zoom = String(z);
        this.touchField();
    },
    startScaling() {
        const hs = this.style;
        hs.display = "flex"; hs.alignItems = "center"; hs.justifyContent = "center";
        hs.overflow = "hidden"; hs.boxSizing = "border-box"; hs.background = "transparent";
        this.lastResize = -Infinity;
        this.zoomNow = 0;
        this.eff = 1;
        this._onResize = () => {
            this.lastResize = performance.now();
            if (!this.motion?.suspended) this.motion?.suspend?.(true);   // 07 section 3: nothing renders while the drag lasts
            this.rescale(false);   // per event: two style writes, nothing else
            clearTimeout(this._settle);
            this._settle = setTimeout(() => {
                this._settle = 0;
                this.rescale(true);
                this.motion?.suspend?.(false);   // resume once, after the drag has ended
                if (this.stale) { this.stale = false; this.touchField(); }
            }, SETTLE_MS);
        };
        window.addEventListener("resize", this._onResize);
        this.rescale(true);
        this._first = setTimeout(() => this.rescale(true), 0);
        this._remeasure = setInterval(() => { if (!this.resizing()) this.rescale(true); }, REMEASURE_MS);
    },
    stopScaling() {
        window.removeEventListener("resize", this._onResize);
        clearTimeout(this._settle);
        this._settle = 0;
        this.stale = false;
        this.lastResize = -Infinity;
        clearTimeout(this._first);
        clearInterval(this._remeasure);
    }
};
