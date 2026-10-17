// ---- The one HTMLElement subclass and the factory ---------------------------------------------------------
class RebodyView extends HTMLElement {
    constructor() {   // state only: no DOM, no host calls
        super();
        this.values = {};
        this.controls = new Map();
        this.listeners = [];
        this.sent = [];
        this.weightCache = {};
        this.pitchedSeen = {};
        this.activeLine = LINES[0];
        this.motion = "calm";
        this.visualMorph = 0;
        this.editorParam = null;
        this.cancelEditor = null;
        this.epListeners = [];
        this._mounted = false;
        this._ready = false;
        this._onParam = this.onParam.bind(this);
        this._tick = this.tick.bind(this);
        this._onMotionQuery = () => this.refreshMotion();
        this.resetTelemetry();
    }
    connectedCallback() {
        if (this._mounted) return;
        this._mounted = true;
        this.classList.add("patch-root");
        this.buildPanel();                                     // markup + one Control per [data-param], init painted in each constructor
        this.initField();
        this.pc.addAllParameterListener(this._onParam);        // listener first ...
        for (const p of PARAMS) this.pc.requestParameterValue(p.id);   // ... then ask for every value
        this.subscribeTelemetry();
        this._ready = true;
        this.refreshAll();
        this.startScaling();
        this.kick();
    }
    disconnectedCallback() {
        if (!this._mounted) return;
        this._mounted = false;
        this._ready = false;
        cancelAnimationFrame(this._raf);
        this._raf = 0;
        this.cancelEditor?.();
        this.clearUndo();                                      // copy-undo timer and snapshot
        this.stopScaling();
        this.stopField?.();                                    // motion controller, field state
        this.stopTelemetry();
        this.pc.removeAllParameterListener(this._onParam);
        for (const control of this.controls.values()) control.destroy();   // releases pointer capture and open gestures
        this.controls.clear();
        for (const [node, type, fn, options] of this.listeners) node.removeEventListener(type, fn, options);
        this.listeners = [];
        this.motionQuery?.removeEventListener?.("change", this._onMotionQuery);
        this.resetTelemetry();
    }
}
Object.assign(RebodyView.prototype, FieldMethods, PanelMethods, TelemetryMethods, ScalingMethods);
if (!customElements.get(TAG)) customElements.define(TAG, RebodyView);

export default function createPatchView(patchConnection) {
    const view = document.createElement(TAG);
    view.pc = patchConnection;
    view.patchConnection = patchConnection;
    return view;
}
// END_AMORPH_UI
