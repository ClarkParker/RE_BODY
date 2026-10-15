// BODY — seven sounding bodies, ending in their Obosaxolele hybrid.
// WINDOW SIZE: 620x340
// HONE-inspired monochrome panel. Instrument outlines are illustrative;
// motion follows measured audio energy, not simulated physical measurements.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const modes = ['BASS DRUM','SNARE','PIANO','UKULELE','CLARINET','OBOE','SAX','OBOSAXOLELE'];
const engineOrder = [0,1,3,6,2,4,5];
const decayBases = [.08,.08,.15,.25,.12,.15,.07], decayRatios = [20,12.5,20,24,25,20,12];
const morphWeights = value => {
    const position = clamp(value, 0, 7), weights = Array(7).fill(0);
    if (position >= 6) {
        // The last stop is an equal blend of existing Oboe, Sax and Ukulele engines.
        const t = position - 6;
        weights[4] = t / 3; weights[6] = t / 3; weights[5] = 1 - 2 * t / 3;
        return weights;
    }
    const a = Math.floor(position), b = Math.min(6, a + 1), t = position - a;
    weights[engineOrder[a]] += 1-t; weights[engineOrder[b]] += t;
    return weights;
};
const decayMapping = weights => {
    const hybrid = weights[4] > 0 && weights[6] > 0 ? clamp(3 * Math.min(weights[4], weights[6]), 0, 1) : 0;
    const aftermath = hybrid * hybrid * (3 - 2 * hybrid);
    return { base:Math.exp(weights.reduce((s,w,i)=>s+w*Math.log(decayBases[i]),0)) * Math.max(1, .30 + 2.20 * aftermath),
        logRatio:weights.reduce((s,w,i)=>s+w*Math.log(decayRatios[i]),0) };
};
const decaySeconds = (value, weights) => { const m=decayMapping(weights); return m.base*Math.exp(m.logRatio*value/100); };
const morphDescription = value => {
    const position=clamp(value,0,7), a=Math.floor(position), t=position-a;
    if (a===7) return 'OBOSAXOLELE · OBOE + SAX + UKULELE';
    return t<.0005 ? modes[a] : `${modes[a]} ${Math.round((1-t)*100)}%  /  ${modes[a+1]} ${Math.round(t*100)}%`;
};
const noteNames=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const midiNote=value=>36+Math.round(value*.36);
const noteName=note=>noteNames[note%12]+(Math.floor(note/12)-1);
const noteValue=note=>Number(((clamp(note,36,72)-36)/.36).toFixed(1));
const unpack=packet=>typeof packet==='number'?[packet]:Array.isArray(packet)||ArrayBuffer.isView(packet)?Array.from(packet):packet&&typeof packet==='object'?unpack(packet.value??packet.data??packet.values):[];
const specs=[{id:'param1',name:'Tune',init:58},{id:'param2',name:'Decay',init:50},{id:'param3',name:'Mix',init:45}];
const point=angle=>{const t=(angle-90)*Math.PI/180;return [100+91*Math.cos(t),100+91*Math.sin(t)];};
const arcPath=(from,to)=>{if(Math.abs(to-from)<.001)return '';const a=point(from),b=point(to);return `M ${a[0]} ${a[1]} A 91 91 0 ${Math.abs(to-from)>180?1:0} ${to>=from?1:0} ${b[0]} ${b[1]}`;};

// All instrument shapes share ten paths with identical point counts and winding.
// Outer edges, openings, strings/seams, and fittings move between corresponding
// locations. Missing details contract to a point; their opacity never changes.
const ellipse=(x,y,rx,ry)=>`M ${x-rx} ${y} A ${rx} ${ry} 0 1 1 ${x+rx} ${y} A ${rx} ${ry} 0 1 1 ${x-rx} ${y} Z`;
const collapsed=(x,y)=>`M ${x} ${y} L ${x} ${y}`;
const instrumentPaths=[
    // Bass drum: full circular front, rear shell, four tension rods and feet.
    ['M -70 0 C -70 -39 -40 -66 0 -66 C 40 -66 70 -39 70 0 C 70 39 40 66 0 66 C -40 66 -70 39 -70 0 Z',
     ellipse(0,0,61,58), 'M 10 -65 Q 96 -62 96 0 Q 96 62 10 65','M 65 -25 L 89 -25','M 65 25 L 89 25','M -42 52 L -57 69',
     'M -54 -36 L -46 -31','M 46 -31 L 54 -36','M -54 36 L -46 31','M 46 31 L 54 36'],
    // Snare: shallow shell, elliptical membrane and snare wires.
    ['M -106 -12 C -106 -30 -60 -43 0 -43 C 60 -43 106 -30 106 -12 L 106 26 C 106 45 60 55 0 55 C -60 55 -106 45 -106 26 Z',
     ellipse(0,-12,106,31),'M -103 26 C -78 61 78 61 103 26','M -92 4 L -92 34','M 92 4 L 92 34','M -34 41 L 47 51',
     'M -60 15 L -60 47','M -22 19 L -22 51','M 22 19 L 22 51','M 60 15 L 60 47'],
    // Grand piano: long straight rim, curved tail and clear keyboard.
    ['M -96 58 L -96 -54 C -96 -65 -74 -70 -49 -67 C 2 -62 17 -28 41 -19 C 57 -14 86 -15 100 6 C 109 23 110 45 110 58 Z',
     'M -85 29 L -85 -50 Q -48 -72 -3 -30 Q 24 -6 62 -4 Q 91 -1 96 29 Z',
     'M -96 32 L 110 32','M -73 -49 L -73 27','M -41 -49 L -41 27','M -9 -30 L -9 27',
     'M -66 32 L -66 58 L -38 58 L -38 32','M -10 32 L -10 58 L 18 58 L 18 32','M 46 32 L 46 58 L 74 58 L 74 32','M 96 32 L 96 58'],
    // Ukulele: lower bout, pronounced waist, upper bout, neck and headstock.
    ['M -133 0 C -133 -41 -115 -58 -89 -55 C -67 -53 -68 -34 -50 -34 C -34 -34 -35 -52 -13 -46 C 8 -41 14 -23 11 -11 L 91 -11 L 98 -17 L 127 -17 L 136 -10 L 136 10 L 127 17 L 98 17 L 91 11 L 11 11 C 14 23 8 41 -13 46 C -35 52 -34 34 -50 34 C -68 34 -67 53 -89 55 C -115 58 -133 41 -133 0 Z',
     ellipse(-36,0,17,17),'M -92 -4 L 129 -4','M -92 -1.3 L 129 -1.3','M -92 1.3 L 129 1.3','M -92 4 L 129 4',
     'M -92 -14 L -92 14','M 30 -11 L 30 11 L 49 11 L 49 -11','M 66 -11 L 66 11 L 81 11 L 81 -11','M 105 -17 L 105 -24 L 121 -24 L 121 -17'],
    // Clarinet: beak mouthpiece, straight bore, joint rings and flared bell.
    ['M -140 -5 L -119 -10 L -111 -15 L 72 -15 C 94 -15 101 -27 119 -36 L 137 -36 L 137 36 L 119 36 C 101 27 94 15 72 15 L -111 15 L -119 10 L -140 5 Z',
     ellipse(135,0,6,36),'M -107 -15 L -107 15','M -29 -15 L -29 15','M 53 -15 L 53 15','M -80 7 L 75 7',
     ellipse(-81,-4,4,4),ellipse(-52,-4,4,4),ellipse(0,-4,4,4),ellipse(30,-4,4,4)],
    // Oboe: exposed slender reed and gently conical body with small bell.
    ['M -140 -2 L -113 -2 L -106 -6 L -92 -8 L 101 -16 L 123 -22 L 139 -22 L 139 22 L 123 22 L 101 16 L -92 8 L -106 6 L -113 2 L -140 2 Z',
     ellipse(137,0,4,22),'M -93 -8 L -93 8','M -20 -11 L -20 11','M 58 -14 L 58 14','M -75 5 L 111 8',
     ellipse(-71,-3,3,3),ellipse(-43,-3,3,3),ellipse(8,-4,3,3),ellipse(38,-4,3,3)],
    // Saxophone: curved neck, descending tube, U-bow and upward opening bell.
    ['M -85 -55 L -58 -67 Q -29 -80 -24 -51 L -3 27 Q 3 49 24 48 Q 41 46 48 22 L 56 -16 L 36 -33 L 105 -45 L 89 -19 L 73 30 Q 62 71 25 71 Q -18 72 -30 34 L -48 -45 Q -52 -55 -65 -43 Z',
     'M 36 -33 Q 66 -57 105 -45 Q 85 -24 36 -33 Z','M -37 -42 L -14 32 Q -6 60 23 60 Q 53 60 62 24','M 46 20 L 64 25','M -43 -22 L -21 -27','M -30 25 L -8 20',
     ellipse(-30,-17,4,4),ellipse(-26,-2,4,4),ellipse(-22,13,4,4),ellipse(-17,28,4,4)]
];
const bodyTemplates=instrumentPaths.map(paths=>paths.map((d,index)=>{
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',d);
    const length=path.getTotalLength(), steps=index===0?192:index===1?96:48;
    return {closed:index<2, points:Array.from({length:steps+1},(_,i)=>{const p=path.getPointAtLength(length*i/steps);return[p.x,p.y];})};
}));
// A designed hybrid illustration: reed neck, flared bell and a waisted
// four-string soundbox. The audio endpoint remains the same equal three-body
// blend. Ten corresponding paths deform into this silhouette without fading.
const hybridPaths=[
    "M -123 -59 L -105 -67 L -98 -61 L -72 -72 Q -42 -84 -32 -57 L -25 -38 C -8 -42 7 -32 7 -18 C 7 -4 -11 0 -15 11 C -18 23 -2 29 7 39 Q 25 53 42 36 Q 53 24 56 0 L 59 -13 L 42 -31 L 119 -44 L 96 -15 L 88 25 C 84 53 67 71 36 72 L -38 72 C -80 74 -108 52 -91 28 C -81 14 -66 8 -72 -3 C -83 -15 -88 -30 -78 -42 C -67 -54 -52 -52 -49 -44 L -49 -52 Q -54 -65 -66 -60 L -98 -48 L -105 -54 L -121 -48 Z",
    "M 42 -31 Q 77 -58 119 -44 Q 96 -19 42 -31 Z",
    "M -52 -35 L -58 52 L -50 52",
    "M -46 -36 L -51 52 L -43 52",
    "M -40 -35 L -44 52 L -36 52",
    "M -34 -34 L -37 52 L -29 52",
    "M -60 13 A 14 14 0 1 1 -32 13 A 14 14 0 1 1 -60 13 Z",
    "M -67 -64 A 3 3 0 1 1 -61 -64 A 3 3 0 1 1 -67 -64 Z",
    "M -53 -64 A 3 3 0 1 1 -47 -64 A 3 3 0 1 1 -53 -64 Z",
    "M -42 -50 A 3 3 0 1 1 -36 -50 A 3 3 0 1 1 -42 -50 Z"
];
bodyTemplates.push(hybridPaths.map((d,index)=>{
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',d);
    const length=path.getTotalLength(), steps=index===0?192:index===1?96:48;
    return {closed:index<2, points:Array.from({length:steps+1},(_,i)=>{const p=path.getPointAtLength(length*i/steps);return[p.x,p.y];})};
}));
class BodyDial {
    constructor(view, spec) {
        this.view = view;
        this.pc = view.pc;
        this.spec = spec;
        this.node = view.querySelector(`[data-param="${spec.id}"]`);
        this.knob = this.node.querySelector('.body-dial');
        this.label = this.node.querySelector('.body-value');
        this.arc = this.node.querySelector('.body-dial-arc');
        this.listeners = [];
        const listen = (type, fn, options) => {
            this.knob.addEventListener(type, fn, options);
            this.listeners.push([type, fn, options]);
        };
        listen('pointerdown', event => {
            if (event.button !== 0 || this.dragging || event.target.closest('input')) return;
            event.preventDefault();
            this.view.cancelEditor?.();
            this.knob.focus({ preventScroll:true });
            // Let the value button share the dial's drag gesture. Keeping capture
            // on that button preserves its normal click when the pointer stays still.
            this.captureNode = event.target.closest('.body-value') || this.knob;
            this.captureNode.setPointerCapture(event.pointerId);
            this.pointer = event.pointerId;
            this.startX = event.clientX;
            this.startY = event.clientY;
            this.previousY = event.clientY;
            this.dragValue = this.value;
            this.pointerMoved = false;
            this.suppressClick = false;
            this.dragging = true;
            this.knob.dataset.dragging = 'true';
            this.begin();
        });
        listen('pointermove', event => {
            if (!this.dragging || event.pointerId !== this.pointer) return;
            if (!this.pointerMoved) {
                if (Math.hypot(event.clientX - this.startX, event.clientY - this.startY) < 3) return;
                this.pointerMoved = true;
            }
            const delta = this.previousY - event.clientY;
            this.previousY = event.clientY;
            this.dragValue = clamp(this.dragValue + delta * 100 / (event.shiftKey ? 1200 : 240), 0, 100);
            this.setValue(this.isNote ? noteValue(midiNote(this.dragValue)) : this.dragValue, true);
        });
        for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(type, event => {
            if (event.pointerId === this.pointer) this.stopDrag();
        });
        // A completed drag may still produce a click. Consume it before it reaches
        // the value editor; keyboard activation (detail 0) remains available.
        listen('click', event => {
            if (event.detail !== 0 && this.suppressClick) {
                this.suppressClick = false;
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        }, true);
        listen('dblclick', event => {
            if (event.target.closest('button, input')) return;
            event.preventDefault();
            this.commit(spec.init);
        });
        listen('keydown', event => {
            if (event.target !== this.knob || this.dragging) return;
            if (event.key === 'Enter') { event.preventDefault(); this.view.edit(this); return; }
            const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'];
            if (!keys.includes(event.key)) return;
            event.preventDefault();
            if (event.key === 'Home') return this.commit(0);
            if (event.key === 'End') return this.commit(100);
            const sign = ['ArrowUp', 'ArrowRight', 'PageUp'].includes(event.key) ? 1 : -1;
            const page = event.key.startsWith('Page');
            if (this.isNote) this.commit(noteValue(midiNote(this.value) + sign * (page ? 12 : 1)));
            else this.commit(this.value + sign * (page ? 10 : event.shiftKey ? .1 : 1));
        });
        listen('wheel', event => {
            if (document.activeElement !== this.knob || this.dragging || !event.deltaY) return;
            event.preventDefault();
            const sign = Math.sign(-event.deltaY);
            this.commit(this.isNote ? noteValue(midiNote(this.value) + sign) : this.value + sign * (event.shiftKey ? .1 : 1));
        }, { passive:false });
        this.setValue(view.values[spec.id], false);
    }
    get isNote() { return this.spec.id === 'param1' && this.view.isPitched; }
    setValue(value, notify) {
        if (!Number.isFinite(value)) return;
        const next = Number((Math.round(clamp(value, 0, 100) * 10) / 10).toFixed(1));
        const changed = next !== this.value;
        this.value = next;
        this.view.values[this.spec.id] = next;
        this.refresh();
        this.view.refreshProcessing();
        this.view.dirty = true;
        if (notify && changed) this.pc.sendEventOrValue(this.spec.id, next);
    }
    refresh() {
        const id = this.spec.id, note = midiNote(this.value);
        const formatted = this.isNote ? noteName(note) : id === 'param2'
            ? `${decaySeconds(this.value, this.view.weights).toFixed(2)} s` : `${Number(this.value.toFixed(1))}%`;
        const name = this.spec.name;
        this.label.textContent = formatted;
        this.label.setAttribute('aria-label', `Type ${name.toLowerCase()} value`);
        this.knob.setAttribute('aria-label', name);
        this.knob.setAttribute('aria-valuemin', this.isNote ? '36' : '0');
        this.knob.setAttribute('aria-valuemax', this.isNote ? '72' : '100');
        this.knob.setAttribute('aria-valuenow', String(this.isNote ? note : this.value));
        this.knob.setAttribute('aria-valuetext', this.isNote ? `${formatted}, ${(440 * 2 ** ((note - 69) / 12)).toFixed(1)} hertz` : formatted);
        this.node.querySelector('.body-label').textContent = name.toUpperCase();
        const norm = this.isNote ? (note - 36) / 36 : this.value / 100;
        this.knob.style.setProperty('--norm', String(norm));
        this.arc.setAttribute('d', arcPath(-135, -135 + norm * 270));
    }
    begin() {
        if (this.gesture) return;
        this.gesture = true;
        this.pc.sendParameterGestureStart?.(this.spec.id);
    }
    end() {
        if (!this.gesture) return;
        this.gesture = false;
        this.pc.sendParameterGestureEnd?.(this.spec.id);
    }
    commit(value) {
        const open = this.gesture;
        if (!open) this.begin();
        try { this.setValue(value, true); } finally { if (!open) this.end(); }
    }
    stopDrag() {
        if (!this.dragging) return;
        this.dragging = false;
        this.knob.dataset.dragging = 'false';
        const pointer = this.pointer;
        const captureNode = this.captureNode;
        this.suppressClick = this.pointerMoved;
        this.pointer = null;
        this.captureNode = null;
        if (captureNode?.hasPointerCapture(pointer)) captureNode.releasePointerCapture(pointer);
        this.end();
    }
    destroy() {
        this.stopDrag();
        this.end();
        for (const [type, fn, options] of this.listeners) this.knob.removeEventListener(type, fn, options);
        this.listeners = [];
    }
}


class BodyInstrumentView extends HTMLElement {
    constructor() {
        super(); this.values={param1:58,param2:50,param3:45,param4:4,param5:0};
        this.weights=morphWeights(4);this.visualMorph=4;this.isPitched=true;
        this.controls=new Map();this.listeners=[];this.energy=[0,0,0,0];this.targetEnergy=[0,0,0,0];this.phase=0;this.dirty=true;
    }
    dial(spec) {
        return `<div class="control body-control" data-param="${spec.id}" data-min="0" data-max="100" data-step="0.1" data-init="${spec.init}">
            <div class="knob body-dial" role="slider" tabindex="0" aria-label="${spec.name}" aria-orientation="vertical" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${spec.init}" title="Drag vertically. Shift-drag for fine adjustment. Double-click to reset. Click value to type.">
              <svg class="body-dial-graphic" viewBox="0 0 200 200" aria-hidden="true"><path class="body-dial-track" d="${arcPath(-135,135)}"/><path class="body-dial-arc" d=""/></svg>
              <span class="body-inner"><button type="button" class="value-label body-value" aria-label="Type ${spec.name.toLowerCase()} value"></button></span><span class="body-pointer"></span>
            </div><span class="body-label">${spec.name.toUpperCase()}</span></div>`;
    }
    connectedCallback() {
        if(this.connected)return;this.connected=true;this.style.width='100%';this.style.height='100%';
        this.innerHTML=`<style>
body-instrument-view,body-instrument-view *,body-instrument-view *::before,body-instrument-view *::after{box-sizing:border-box;margin:0;padding:0}
body-instrument-view{display:block;width:100%!important;height:100%!important;overflow:hidden;user-select:none;-webkit-user-select:none}
body-instrument-view [hidden]{display:none!important}
body-instrument-view .body-panel{--ink:#ededed;--muted:#969696;position:relative;width:100%;height:100%;overflow:hidden;padding:16px 22px 13px;display:grid;grid-template-rows:27px minmax(0,1fr) 53px 78px;gap:3px;background:radial-gradient(ellipse at 50% 42%,#181818,#090909 76%);color:var(--ink);font:12px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
body-instrument-view .body-header{display:flex;align-items:flex-start;justify-content:space-between}
body-instrument-view .body-title{font-size:23px;font-weight:750;letter-spacing:.075em;line-height:1}
body-instrument-view .body-utilities{display:flex;align-items:center;gap:15px}
body-instrument-view button,body-instrument-view input{font:inherit;color:inherit}
body-instrument-view button{cursor:pointer}
body-instrument-view .body-bypass{appearance:none;background:#111;border:1px solid #333;border-radius:4px;padding:5px 9px;font-size:10px;color:#aaa}
body-instrument-view .body-bypass[aria-checked="true"]{background:#ededed;color:#111;border-color:#ededed}
body-instrument-view .body-field{min-width:0;min-height:0;position:relative;pointer-events:none}
body-instrument-view .body-object{width:100%;height:100%;overflow:visible;display:block;pointer-events:none}
body-instrument-view .body-object path{stroke:#d0d0d0;fill:none;stroke-width:1;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
body-instrument-view .body-object [data-contour="0"]{fill:#121212;stroke-width:1.65}
body-instrument-view .body-caption{position:absolute;left:0;right:0;bottom:0;text-align:center;color:#969696;font:500 9px/12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.055em}
body-instrument-view .body-morph{min-width:0;position:relative;padding-top:2px}
body-instrument-view .body-morph-heading{text-align:center;font-size:8px;line-height:10px;letter-spacing:.17em;color:#717171}
body-instrument-view .body-morph-slider{height:22px;position:relative;cursor:ew-resize;touch-action:none;border-radius:4px;--morph:.571429;margin:0 calc(100% / 16)}
body-instrument-view .body-morph-rail{position:absolute;left:0;right:0;top:10px;height:1px;background:#393939;pointer-events:none}
body-instrument-view .body-morph-thumb{position:absolute;left:calc(var(--morph) * 100%);top:-3px;width:8px;height:8px;border-radius:50%;background:#ededed;transform:translateX(-50%);box-shadow:0 0 0 3px #151515}
body-instrument-view .body-morph-tick{position:absolute;left:calc(var(--anchor) / 7 * 100%);top:-2px;width:1px;height:5px;background:#777}
body-instrument-view .body-anchor-row{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:0}
body-instrument-view .body-anchor{appearance:none;display:flex;align-items:center;justify-content:center;border:0;background:transparent;border-radius:3px;padding:3px 0;font-size:9px;line-height:12px;font-weight:550;letter-spacing:.015em;white-space:nowrap;color:#858585}
body-instrument-view .body-anchor:hover,body-instrument-view .body-anchor[aria-pressed="true"]{color:#ededed}
body-instrument-view .body-deck{display:flex;justify-content:center;gap:clamp(45px,12vw,110px);align-items:flex-end;padding-top:4px}
body-instrument-view .body-control{display:flex;flex-direction:column;align-items:center;min-width:0}
body-instrument-view .body-dial{--norm:.5;position:relative;width:58px;height:58px;border-radius:50%;cursor:ns-resize;touch-action:none;flex-shrink:0}
body-instrument-view .body-dial-graphic{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
body-instrument-view .body-dial-track{fill:none;stroke:#303030;stroke-width:5;stroke-linecap:round}
body-instrument-view .body-dial-arc{fill:none;stroke:#ededed;stroke-width:5;stroke-linecap:round}
body-instrument-view .body-inner{position:absolute;inset:12%;border:1px solid #303030;border-radius:50%;background:#101010;display:flex;align-items:center;justify-content:center;pointer-events:none}
body-instrument-view .body-dial[data-dragging="true"] .body-inner{border-color:#ededed}
body-instrument-view .body-pointer{position:absolute;inset:0;transform:rotate(calc(var(--norm) * 270deg - 135deg));pointer-events:none}
body-instrument-view .body-pointer::after{content:"";position:absolute;top:16%;left:calc(50% - .75px);width:1.5px;height:7%;background:#ededed}
body-instrument-view .body-label{margin-top:4px;font-size:9px;font-weight:600;letter-spacing:.13em;color:#a5a5a5}
body-instrument-view .body-value{appearance:none;border:0;background:transparent;padding:5px 0;pointer-events:auto;font-size:11px;font-weight:550;font-variant-numeric:tabular-nums;white-space:nowrap;cursor:ns-resize;touch-action:none}
body-instrument-view .body-value:hover{color:#fff}
body-instrument-view .body-editor{pointer-events:auto;width:90%;min-width:0;padding:3px 0;border:1px solid #777;border-radius:3px;background:#101010;color:#ededed;text-align:center;font-size:11px;font-variant-numeric:tabular-nums;user-select:text;-webkit-user-select:text}
body-instrument-view .body-panel[data-process="bypass"] .body-object,body-instrument-view .body-panel[data-process="dry"] .body-object{opacity:.25}
body-instrument-view .body-panel[data-process="bypass"] .body-dial-arc{opacity:.3}
body-instrument-view .body-dial:focus-visible,body-instrument-view .body-morph-slider:focus-visible,body-instrument-view button:focus-visible,body-instrument-view input:focus-visible{outline:1px solid #ededed;outline-offset:3px}
@media(max-width:540px),(max-height:280px){body-instrument-view .body-panel{padding:12px 15px 9px;grid-template-rows:24px minmax(0,1fr) 50px 67px;gap:2px}body-instrument-view .body-title{font-size:21px}body-instrument-view .body-dial{width:50px;height:50px}body-instrument-view .body-value{font-size:10px}body-instrument-view .body-anchor{font-size:8px}body-instrument-view .body-caption{font-size:8px}body-instrument-view .body-deck{padding-top:2px}}
@media(min-height:440px){body-instrument-view .body-panel{padding:21px 30px 20px;grid-template-rows:30px minmax(0,1fr) 63px 92px;gap:5px}body-instrument-view .body-dial{width:70px;height:70px}body-instrument-view .body-value{font-size:13px}body-instrument-view .body-label{font-size:10px}body-instrument-view .body-anchor{font-size:11px}body-instrument-view .body-caption{font-size:10px}}
</style><section class="body-panel" data-process="active" aria-label="BODY stereo effect">
<header class="body-header"><h1 class="body-title">BODY</h1><div class="body-utilities"><div class="control" data-param="param5" data-min="0" data-max="1" data-step="1" data-init="0"><button type="button" class="knob body-bypass" role="switch" aria-label="Bypass" aria-checked="false">Bypass</button></div></div></header>
<section class="body-field" aria-label="Sounding body"><svg class="body-object" role="img" aria-label="Clarinet illustration at rest"><title>One instrument outline morphs continuously. Tune runs from low to high; higher pitch reduces its dimensions; measured input and resonance energy gently move the geometry. Illustration, not a physical measurement.</title>${bodyTemplates[0].map((_,i)=>`<path data-contour="${i}"/>`).join('')}</svg><div class="body-caption" aria-hidden="true"></div></section>
<div class="control body-morph" data-param="param4" data-min="0" data-max="7" data-step="0.001" data-init="4"><div class="body-morph-heading" aria-hidden="true">MORPH</div><div class="knob body-morph-slider" role="slider" tabindex="0" aria-label="Morph" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="7" aria-valuenow="4" title="Move continuously through the instruments. Shift-drag for fine adjustment. Double-click to reset."><span class="body-morph-rail">${modes.map((_,i)=>`<span class="body-morph-tick" style="--anchor:${i}"></span>`).join('')}<span class="body-morph-thumb"></span></span></div><div class="body-anchor-row">${modes.map((name,i)=>`<button type="button" class="body-anchor" data-anchor="${i}" aria-pressed="false" title="Go to ${name.toLowerCase()}">${name}</button>`).join('')}</div></div>
<div class="body-deck">${specs.map(s=>this.dial(s)).join('')}</div></section>`;
        const listen=(node,type,fn,options)=>{node.addEventListener(type,fn,options);this.listeners.push([node,type,fn,options]);};
        this.panel=this.querySelector('.body-panel');this.field=this.querySelector('.body-field');this.svg=this.querySelector('.body-object');this.contourPaths=[...this.svg.querySelectorAll('[data-contour]')];this.caption=this.querySelector('.body-caption');this.bypass=this.querySelector('.body-bypass');this.morphSlider=this.querySelector('.body-morph-slider');this.anchors=[...this.querySelectorAll('.body-anchor')];
        for(const spec of specs){const dial=new BodyDial(this,spec);this.controls.set(spec.id,dial);listen(dial.label,'click',()=>this.edit(dial));}
        for(const [i,node] of this.anchors.entries())listen(node,'click',()=>this.commitMorph(i));
        listen(this.morphSlider,'pointerdown',event=>{if(event.button!==0||this.morphPointer!=null)return;event.preventDefault();this.cancelEditor?.();this.morphSlider.focus({preventScroll:true});this.morphPointer=event.pointerId;this.previousX=event.clientX;this.morphSlider.setPointerCapture(event.pointerId);this.pc.sendParameterGestureStart?.('param4');if(!event.shiftKey)this.updateMorphFromPointer(event);});
        listen(this.morphSlider,'pointermove',event=>{if(event.pointerId===this.morphPointer)this.updateMorphFromPointer(event);});
        for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(this.morphSlider,type,event=>{if(event.pointerId===this.morphPointer)this.stopMorphDrag();});
        listen(this.morphSlider,'dblclick',event=>{event.preventDefault();this.commitMorph(4);});
        listen(this.morphSlider,'keydown',event=>{if(this.morphPointer!=null||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(event.key))return;event.preventDefault();const sign=['ArrowUp','ArrowRight','PageUp'].includes(event.key)?1:-1;this.commitMorph(event.key==='Home'?0:event.key==='End'?7:this.values.param4+sign*(event.key.startsWith('Page')?1:event.shiftKey?.001:.05));});
        listen(this.morphSlider,'wheel',event=>{if(document.activeElement!==this.morphSlider||!event.deltaY||this.morphPointer!=null)return;event.preventDefault();this.commitMorph(this.values.param4+Math.sign(-event.deltaY)*(event.shiftKey?.001:.05));},{passive:false});
        listen(this.bypass,'click',()=>{const value=this.values.param5?0:1;this.gesture('param5',value);this.setBypass(value);});
        this.paramListener=({endpointID,value})=>{const number=unpack(value)[0];if(!Number.isFinite(number))return;if(this.editorParam===endpointID)this.cancelEditor?.();if(endpointID==='param4')this.setMorph(number);else if(endpointID==='param5')this.setBypass(number>=.5?1:0);else this.controls.get(endpointID)?.setValue(number,false);this.refreshProcessing();};
        this.pc.addAllParameterListener(this.paramListener);
        this.vizListener=packet=>{const values=unpack(packet);if(values.length<4||!values.slice(0,4).every(Number.isFinite))return;this.targetEnergy=values.slice(0,4).map(v=>clamp(v,0,8));this.lastTelemetry=performance.now();};this.lastTelemetry=-Infinity;this.pc.addEndpointListener('bodyViz',this.vizListener);
        this.motionQuery=window.matchMedia('(prefers-reduced-motion: reduce)');this.motionListener=()=>{this.dirty=true;};this.motionQuery.addEventListener?.('change',this.motionListener);
        this.refreshMorph();this.setBypass(this.values.param5);for(const id of Object.keys(this.values))this.pc.requestParameterValue(id);
        this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.field);this.resize();this.previousTime=performance.now();
        const tick=now=>{if(!this.connected)return;const dt=clamp((now-this.previousTime)/1000,0,.1);this.previousTime=now;if(now-this.lastTelemetry>500)this.targetEnergy=[0,0,0,0];const before=this.energy[0]+this.energy[1];
            const delta=this.values.param4-this.visualMorph;
            if(delta!==0){this.visualMorph=Math.abs(delta)<.000001?this.values.param4:this.visualMorph+delta*(1-Math.exp(-dt/.045));this.dirty=true;}
            this.energy=this.energy.map((v,i)=>{const t=this.targetEnergy[i],next=v+(t-v)*(1-Math.exp(-dt/(t>v?.035:.13)));return next<.000015&&t<.000015?0:next;});
            const energy=this.energy[0]+this.energy[1];if(energy>.000015&&!this.motionQuery.matches)this.phase+=dt*(4+Math.min(2,energy));if(this.dirty||before>0||energy>0)this.draw();this.dirty=false;this.raf=requestAnimationFrame(tick);};
        this.draw();this.raf=requestAnimationFrame(tick);
    }
    gesture(id,value){this.pc.sendParameterGestureStart?.(id);try{this.pc.sendEventOrValue(id,value);}finally{this.pc.sendParameterGestureEnd?.(id);}}
    refreshMorph(){this.weights=morphWeights(this.values.param4);const pitched=this.weights[0]+this.weights[1]<.000001;if(pitched!==this.isPitched)this.controls.get('param1')?.stopDrag();this.isPitched=pitched;this.caption.textContent=morphDescription(this.values.param4);this.morphSlider.style.setProperty('--morph',String(this.values.param4/7));this.morphSlider.setAttribute('aria-valuenow',String(this.values.param4));this.morphSlider.setAttribute('aria-valuetext',morphDescription(this.values.param4));this.anchors.forEach((node,i)=>node.setAttribute('aria-pressed',String(this.values.param4===i)));for(const dial of this.controls.values())dial.refresh();this.dirty=true;}
    setMorph(value){const next=Number(clamp(value,0,7).toFixed(3));if(next===this.values.param4)return false;this.cancelEditor?.();this.values.param4=next;this.refreshMorph();return true;}
    commitMorph(value){if(this.setMorph(value))this.gesture('param4',this.values.param4);}
    updateMorphFromPointer(event){const rect=this.morphSlider.querySelector('.body-morph-rail').getBoundingClientRect();const value=event.shiftKey?this.values.param4+(event.clientX-this.previousX)/rect.width*.7:(event.clientX-rect.left)/rect.width*7;this.previousX=event.clientX;if(this.setMorph(value))this.pc.sendEventOrValue('param4',this.values.param4);}
    stopMorphDrag(){if(this.morphPointer==null)return;const pointer=this.morphPointer;this.morphPointer=null;if(this.morphSlider.hasPointerCapture(pointer))this.morphSlider.releasePointerCapture(pointer);this.pc.sendParameterGestureEnd?.('param4');}
    setBypass(value){this.values.param5=value;this.bypass.setAttribute('aria-checked',String(!!value));this.refreshProcessing();}
    refreshProcessing(){if(this.panel)this.panel.dataset.process=this.values.param5?'bypass':this.values.param3===0?'dry':'active';}
    resize(){this.width=Math.max(1,this.field.clientWidth);this.height=Math.max(1,this.field.clientHeight);this.svg.setAttribute('viewBox',`0 0 ${this.width} ${this.height}`);this.dirty=true;this.draw();}
    draw(){
        if(!this.width||!this.height)return;
        const [input,wet,left,right]=this.energy,active=!this.values.param5&&this.values.param3>0,reduced=this.motionQuery?.matches;
        const excite=active?clamp(Math.log1p(input*8)/Math.log(9),0,1):0,tail=active?clamp(Math.log1p(wet*10)/Math.log(11),0,1):0,stereo=(left-right)/(left+right+.0001);
        const position=clamp(this.visualMorph,0,7),a=Math.floor(position),b=Math.min(7,a+1),t=position-a;
        const scaleFor=i=>i<2?1-this.values.param1/100*.22:.78+(1-(midiNote(this.values.param1)-36)/36)*.22;
        const available=Math.min(this.width/330,Math.max(24,this.height-20)/150),sa=scaleFor(a),sb=scaleFor(b),cx=this.width/2,cy=(this.height-17)/2;
        const motion=reduced?0:(tail*.8+excite*.7);
        this.contourPaths.forEach((path,index)=>{const template=bodyTemplates[a][index];const points=template.points.map((p,j)=>{const q=bodyTemplates[b][index].points[j],u=j/(template.points.length-1);const x=(p[0]*sa*(1-t)+q[0]*sb*t)*available,y=(p[1]*sa*(1-t)+q[1]*sb*t)*available;const flex=motion*(template.closed?1:Math.sin(u*Math.PI))*Math.sin(this.phase+u*Math.PI*2+index*.41);return [cx+x+flex*.2*(1+stereo*.2),cy+y+flex*.5];});path.setAttribute('d',points.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(3)},${y.toFixed(3)}`).join(' ')+(template.closed?' Z':''));path.style.opacity=String(index===0?.95:index===1?.72:.65);});
        this.svg.dataset.morph=String(this.visualMorph);this.svg.dataset.shape=t<.000001?modes[a].toLowerCase().replaceAll(' ','-'):'hybrid';this.svg.dataset.size=String(this.values.param1);this.svg.setAttribute('aria-label',`${morphDescription(this.values.param4)} illustration, Tune ${this.isPitched?noteName(midiNote(this.values.param1)):`${this.values.param1}%`}, ${active&&wet>.0001?'resonating':active&&input>.0001?'excited by audio':'at rest'}`);
    }
    edit(dial) {
        this.cancelEditor?.();
        dial.stopDrag();
        const weights = this.weights.slice(), isNote = dial.isNote, isDecay = dial.spec.id === 'param2';
        const input = document.createElement('input');
        input.className = 'body-editor';
        input.type = 'text';
        input.inputMode = isNote ? 'text' : 'decimal';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.value = isNote ? noteName(midiNote(dial.value)) : isDecay ? decaySeconds(dial.value, weights).toFixed(2) : String(dial.value);
        input.setAttribute('aria-label', isNote ? 'Tune, C2 through C5' : isDecay ? 'Decay in seconds' : `${dial.spec.name} in percent`);
        let list;
        if (isNote) {
            list = document.createElement('datalist');
            // Per-view ID keeps multiple Amorph views independent in the light DOM.
            this.noteListID ??= `body-notes-${Math.random().toString(36).slice(2)}`;
            list.id = this.noteListID;
            list.innerHTML = Array.from({ length:37 }, (_, index) => `<option value="${noteName(36 + index)}"></option>`).join('');
            input.setAttribute('list', list.id);
            dial.node.append(list);
        }
        dial.label.hidden = true;
        dial.label.parentElement.append(input);
        this.editorParam = dial.spec.id;
        let done = false;
        const finish = save => {
            if (done) return;
            done = true;
            this.editorParam = null;
            this.cancelEditor = null;
            const text = input.value.trim().replace(',', '.');
            let value = NaN;
            if (isNote) {
                const match = /^([a-g])([#♯b♭]?)(-?\d)$/i.exec(text);
                if (match) {
                    const offset = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 }[match[1].toUpperCase()];
                    const accidental = /[#♯]/.test(match[2]) ? 1 : /[b♭]/.test(match[2]) ? -1 : 0;
                    value = noteValue((Number(match[3]) + 1) * 12 + offset + accidental);
                }
            } else {
                const numeric = text.replace(/\s*(%|s|sec|seconds)\s*$/i, '');
                value = numeric.length ? Number(numeric) : NaN;
                if (Number.isFinite(value) && isDecay) {
                    const map = decayMapping(weights);
                    value = Math.log(clamp(value, map.base, map.base * Math.exp(map.logRatio)) / map.base) / map.logRatio * 100;
                }
            }
            if (save && Number.isFinite(value)) dial.commit(value);
            input.remove();
            list?.remove();
            dial.label.hidden = false;
            dial.refresh();
            this.refreshProcessing();
        };
        input.addEventListener('blur', () => finish(true));
        input.addEventListener('keydown', event => {
            event.stopPropagation();
            if (!['Enter', 'Escape'].includes(event.key)) return;
            event.preventDefault();
            finish(event.key === 'Enter');
            dial.label.focus({ preventScroll:true });
        });
        this.cancelEditor = () => finish(false);
        input.focus({ preventScroll:true });
        input.select();
    }
    disconnectedCallback() {
        if(!this.connected)return;this.connected=false;cancelAnimationFrame(this.raf);this.cancelEditor?.();this.stopMorphDrag();this.resizeObserver?.disconnect();this.motionQuery?.removeEventListener?.('change',this.motionListener);this.pc.removeAllParameterListener(this.paramListener);this.pc.removeEndpointListener('bodyViz',this.vizListener);for(const dial of this.controls.values())dial.destroy();this.controls.clear();for(const [node,type,fn,options]of this.listeners)node.removeEventListener(type,fn,options);this.listeners=[];this.energy=[0,0,0,0];this.targetEnergy=[0,0,0,0];this.width=this.height=0;this.dirty=true;
    }
}
export default function createPatchView(patchConnection) {
    const tag='body-instrument-view';if(!customElements.get(tag))customElements.define(tag,BodyInstrumentView);const view=document.createElement(tag);view.pc=patchConnection;return view;
}