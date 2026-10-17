// ---- The field: layered parallax instrument (21_UI_CONCEPT sections 2-4, P6 U1 + U2) ---------------------------------
// DOM:  .field (perspective 1600 px, overflow hidden = the only clip)  >  .scene (preserve-3d, one transform per frame from
// MotionController, 60_motion.js)  >  11 leaf <svg class="layer"> elements, each translateZ(z) with the scale factor (P - z) / P, so that all
// layers coincide at rest. The caption stays plain DOM beside the field (.body-caption / .body-follow of the panel).
// Nothing on .scene or between it and .field may flatten preserve-3d: no overflow, opacity, filter, mask, clip-path, isolation,
// mix-blend-mode or contain:paint; only the leaf layers use opacity (fog, brightness, 250 ms line cross-fade).
// Layer order (back to front): back, ghost far, ghost near, hit, floor, rear (path 2), opening (path 1), outline (path 0),
// detail (paths 3-9 merged), specular, air. Paths are laid out per template; each path's z is interpolated with the same
// (a, b, t) as its geometry and a layer sits at the mean z of its paths; z, fog and `d` are rewritten only on morph steps.
// Energy response: opening, detail (strings) and outline are the only layers whose `d` is rewritten by audio, at most 30 Hz;
// every other layer is transform / opacity only. Silhouettes come from REBODY_TEMPLATES (15_silhouettes.js).
// Chain thread (21 section 10, U6): while a line's Listen = Chain (B listens to A's output, C to B's; A falls back to All) a faint dotted arc
// is drawn in the ghost-near layer (layer 3) between the two silhouettes, source edge to listener edge; hidden otherwise (fxChain).
// Hooks with the other parts: view.motion (MotionController: setState / pause / suspend / notifyAudio are called by the panel, scaling and telemetry),
// view.field (setModes, called by telemetry with the active line's lineModes), view.onSelectLine (ghost click, goes to the panel's selectLine).
// Morph / scale / flex maths are the original's (index.js:349-359, resampling :78-82, :98-102).
const FX_NS = "http://www.w3.org/2000/svg";
const FX_P = 1600;                                              // perspective in px
const FX_OX = FIELD_W / 2, FX_OY = FIELD_H * .45;               // perspective-origin 50% 45%
const FX_CX = FIELD_W / 2, FX_CY = (FIELD_H - FIELD_BAND) / 2;  // instrument centre, as the P1 field
const FX_AVAIL = Math.min(FIELD_W / 330, Math.max(24, FIELD_H - FIELD_BAND - 3) / 150);   // index.js:355, constant in the fixed field
const FX_FLOOR_Y = FX_CY + 74 * FX_AVAIL;
const FX_Z = { back: -900, ghostFar: -750, ghostNear: -600, hit: -590, floor: -450, specular: 260, air: 320 };
const FX_SIDE_PAD = 32;                                         // overscan of specular and air: their parallax shift at 5 deg is 320 * sin 5 deg = 28 px
const FX_INK = 208, FX_BG = 16;                                 // stroke grey (#d0d0d0) and field background for the fog mix
const FX_GHOST_K = .55, FX_GHOST_DX = .34 * FIELD_W;
const FX_RATIO = [1, 1.62, 2.31], FX_DELTA = [0, 1.9, 4.1], FX_THETA = [.3, 1.1, 2];   // contour modes: inharmonic phase ratios (design)
const FX_AIR = 40, FX_STEP_MS = 32;                             // air circles, 30 Hz cap for `d` and particle rewrites
const FX_AIR_FLOW = true, FX_OUTLINE_VIBRATES = true;           // spike switches: freeze the air circles / drop the outline from the audio vibration
const FX_OPENING_W = [1, 1, 1, .5, .5, .5, .5, .5, .5, .5, .5]; // vibration weight of path 1 per anchor: heads 1.0, other openings 0.5
const FX_STRING_W = .8, FX_BODY_W = .4, FX_VIB_PATHS = [0, 1, 3, 4, 5];
const FX_CHAIN = 6;                                             // Listen enum value "Chain" (spec.json param10 text, index 6)
const FX_STROKE_OPACITY = [.95, .72, .65, .65, .65, .65, .65, .65, .65, .65];   // as the P1 field
const FX_WIDTH = [1.65, 1, 1, 1, 1, 1, 1, 1, 1, 1];
let fxUid = 0;

const fxScale = z => (FX_P - z) / FX_P;
const fxTransform = z => { const r = Math.round(z * 10) / 10, k = fxScale(r).toFixed(5); return `translateZ(${r.toFixed(1)}px) scale3d(${k},${k},1)`; };   // scale from the written z, so the pair is exact
const fxFog = z => clamp((320 - z) / 1220, 0, 1);               // 21 section 2: baked per path, never an animated filter
const fxHex = v => { const h = Math.round(clamp(v, 0, 255)).toString(16); return h.length < 2 ? "0" + h : h; };
const fxAttr = (el, name, value) => { const k = "_" + name; if (el[k] !== value) { el[k] = value; el.setAttribute(name, value); } };
const fxStroke = (el, z, base) => {
    const f = fxFog(z), c = fxHex(FX_INK - (FX_INK - FX_BG) * .75 * f);
    fxAttr(el, "stroke", `#${c}${c}${c}`);
    fxAttr(el, "stroke-opacity", (base * (1 - .4 * f)).toFixed(3));
};
const fxOpacity = (el, v) => { const s = clamp(v, 0, 1).toFixed(2); if (el._o !== s) { el._o = s; el.style.opacity = s; } };
const fxD = (xy, n, closed, stride = 1) => {
    let s = `M${xy[0].toFixed(2)},${xy[1].toFixed(2)}`;
    for (let j = stride; j < n; j += stride) s += `L${xy[2 * j].toFixed(2)},${xy[2 * j + 1].toFixed(2)}`;
    return closed ? s + "Z" : s;
};
const fxScaleFor = (tune, spec) => {   // index.js:353, indexed for 11 anchors
    const norm = (tune - spec.min) / (spec.max - spec.min), midi = 36 + Math.round(norm * 36);
    return i => i < DRUM_ANCHORS ? 1 - norm * .22 : .78 + (1 - (midi - 36) / 36) * .22;
};
// Interpolated contour of one path between anchors a and b (index.js:353-354), centred at (cx, cy), into `out` (x, y pairs).
const fxMorph = (T, index, a, b, t, sa, sb, k, cx, cy, out) => {
    const P = T[a].paths[index], Q = T[b].paths[index].xy, ka = sa * (1 - t) * k, kb = sb * t * k, xy = P.xy;
    for (let j = 0; j < 2 * P.n; j += 2) { out[j] = cx + xy[j] * ka + Q[j] * kb; out[j + 1] = cy + xy[j + 1] * ka + Q[j + 1] * kb; }
    return P.n;
};
// Three contour modes (1, 2, 3 half-waves) per sample count: standing waves, sin(k pi u) on open paths, cos(2 pi k u + theta) on closed ones.
const fxTables = new Map();
const fxModeTable = (n, closed) => {
    const key = n * 2 + (closed ? 1 : 0);
    let table = fxTables.get(key);
    if (!table) {
        table = [0, 1, 2].map(k => Float32Array.from({ length: n }, (_, j) => { const u = j / (n - 1); return closed ? Math.cos(2 * Math.PI * (k + 1) * u + FX_THETA[k]) : Math.sin(Math.PI * (k + 1) * u); }));
        fxTables.set(key, table);
    }
    return table;
};
const fxNormals = (xy, n, closed) => {   // unit normals of the resampled contour; collapsed paths get (0, 0)
    const out = new Float32Array(2 * n), last = n - 1;
    for (let j = 0; j < n; j++) {
        const i0 = closed ? (j === 0 ? last - 1 : j - 1) : Math.max(0, j - 1), i1 = closed ? (j === last ? 1 : j + 1) : Math.min(last, j + 1);
        const tx = xy[2 * i1] - xy[2 * i0], ty = xy[2 * i1 + 1] - xy[2 * i0 + 1], len = Math.hypot(tx, ty);
        if (len > 1e-6) { out[2 * j] = ty / len; out[2 * j + 1] = -tx / len; }
    }
    return out;
};

// Resampled templates: { name, depth: Float64Array(10), paths: [{ closed, n, xy: Float64Array }] x 10 } x 11, built once, lazily.
let fxTemplateCache = null;
const fxTemplates = () => {
    if (fxTemplateCache) return fxTemplateCache;
    const source = REBODY_TEMPLATES;   // 15_silhouettes.js: 11 entries in anchor order
    const probe = document.createElementNS(FX_NS, "path");
    fxTemplateCache = source.map((tpl, anchor) => ({
        name: tpl.name || ANCHOR_NAMES[anchor],
        depth: Float64Array.from({ length: 10 }, (_, i) => Number.isFinite(tpl.depth?.[i]) ? tpl.depth[i] : 0),
        paths: tpl.paths.map((d, i) => {
            probe.setAttribute("d", d);
            const length = probe.getTotalLength(), steps = i === 0 ? 192 : i === 1 ? 96 : 48, xy = new Float64Array((steps + 1) * 2);
            for (let k = 0; k <= steps; k++) { const p = probe.getPointAtLength(length * k / steps); xy[2 * k] = p.x; xy[2 * k + 1] = p.y; }
            return { closed: tpl.closed ? !!tpl.closed[i] : i < 2, n: steps + 1, xy };
        })
    }));
    return fxTemplateCache;
};

// ---- markup, style ---------------------------------------------------------------------------------------------------
const FX_CSS = [
    [".field", `position:relative;flex:none;display:block;width:${FIELD_W}px;height:${FIELD_H}px;overflow:hidden;perspective:${FX_P}px;perspective-origin:50% 45%;pointer-events:none;transition:opacity .4s ease`],
    [".field .scene", "position:absolute;left:0;top:0;width:100%;height:100%;transform-style:preserve-3d;transform-origin:50% 45%;will-change:transform;pointer-events:none"],
    [".field .layer", "position:absolute;display:block;overflow:visible;pointer-events:none"],
    [".field .layer *", "pointer-events:none"],
    [".field .layer path", "stroke-linecap:round;stroke-linejoin:round"],
    [".field .layer[data-layer=\"hit\"] rect", "pointer-events:all;cursor:pointer"],
    [".field .markers circle", "transition:fill-opacity 160ms linear"],
    [".body-panel[data-process=\"bypass\"] .field,.body-panel[data-process=\"dry\"] .field", "opacity:.25"]
].map(([sel, decl]) => `${TAG} ${sel}{${decl}}`).join("\n");
const fxLayerHtml = (name, z, inner, pad = 0, fixed = true) =>
    `<svg class="layer" data-layer="${name}" aria-hidden="true" focusable="false" viewBox="${-pad} ${-pad} ${FIELD_W + 2 * pad} ${FIELD_H + 2 * pad}" style="left:${-pad}px;top:${-pad}px;width:${FIELD_W + 2 * pad}px;height:${FIELD_H + 2 * pad}px;transform-origin:${FX_OX + pad}px ${FX_OY + pad}px${fixed ? `;transform:${fxTransform(z)}` : ""}">${inner}</svg>`;
const fxStops = (...stops) => stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join("");
// Back layer: vignette and horizon line (the panel's own backdrop already carries the grain; a second grain here showed as a seam at the field edge). Its overscan follows the tilt cap of the state, so Off / Calm do not pay for the Full overscan.
const fxBackPad = mode => Math.ceil(-FX_Z.back * Math.sin((MOTION_TILT[mode] + (mode === "full" ? MOTION_DRIFT_DEG : 0)) * Math.PI / 180)) + 4;
const fxBackHtml = (u, P) => {
    const W = FIELD_W, H = FIELD_H, ref = id => `url(#${u}-${id})`;
    return `<defs><radialGradient id="${u}-vig" cx="50%" cy="45%" r="78%">${fxStops([.42, "#000", 0], [1, "#000", .6])}</radialGradient>
<linearGradient id="${u}-hz" x1="0" y1="0" x2="1" y2="0">${fxStops([0, "#fff", 0], [.5, "#fff", .14], [1, "#fff", 0])}</linearGradient>
</defs>
<rect x="${-P}" y="${-P}" width="${W + 2 * P}" height="${H + 2 * P}" fill="${ref("vig")}"/><rect x="${-P}" y="${H * .62}" width="${W + 2 * P}" height="1" fill="${ref("hz")}"/>`;
};
const fxSizeBack = (fx, pad) => {
    const el = fx.layers.back, st = el.style;
    el.setAttribute("viewBox", `${-pad} ${-pad} ${FIELD_W + 2 * pad} ${FIELD_H + 2 * pad}`);
    st.left = `${-pad}px`; st.top = `${-pad}px`; st.width = `${FIELD_W + 2 * pad}px`; st.height = `${FIELD_H + 2 * pad}px`;
    st.transformOrigin = `${FX_OX + pad}px ${FX_OY + pad}px`;
    el.innerHTML = fxBackHtml(fx.uid, pad);
};
const fxMarkup = (u, air, pad) => {
    const W = FIELD_W, H = FIELD_H, ref = id => `url(#${u}-${id})`;
    const contour = (i, fill = 'fill="none"') => `<path data-contour="${i}" data-d="${i}" ${fill} stroke-width="${FX_WIDTH[i]}"/>`;
    return [
        fxLayerHtml("back", FX_Z.back, fxBackHtml(u, pad), pad),
        fxLayerHtml("ghostFar", FX_Z.ghostFar, `<path class="ghost" data-slot="1" fill="none" stroke-width="1.1"/>`),
        fxLayerHtml("ghostNear", FX_Z.ghostNear, `<path class="ghost" data-slot="0" fill="none" stroke-width="1.1"/><path class="chain" data-chain="1" fill="none" stroke-width="1.6" stroke-dasharray="0.01 6" display="none"/><path class="chain" data-chain="2" fill="none" stroke-width="1.6" stroke-dasharray="0.01 6" display="none"/>`),
        fxLayerHtml("hit", FX_Z.hit, `<rect data-slot="0" x="0" y="0" width="0" height="0" fill="none"/><rect data-slot="1" x="0" y="0" width="0" height="0" fill="none"/>`),
        fxLayerHtml("floor", FX_Z.floor, `<defs><radialGradient id="${u}-floor">${fxStops([0, "#fff", .2], [1, "#fff", 0])}</radialGradient>
<linearGradient id="${u}-fl" x1="0" y1="0" x2="1" y2="0">${fxStops([0, "#fff", 0], [.5, "#fff", .3], [1, "#fff", 0])}</linearGradient></defs>
<ellipse class="floor-ellipse" cx="${FX_CX}" cy="${FX_FLOOR_Y}" rx="150" ry="9" fill="${ref("floor")}"/><rect x="${W * .14}" y="${FX_FLOOR_Y - .5}" width="${W * .72}" height="1" fill="${ref("fl")}"/>`),
        fxLayerHtml("rear", 0, contour(2), 0, false),
        fxLayerHtml("opening", 0, `<defs><linearGradient id="${u}-lit" x1="0" y1="0" x2="1" y2="1">${fxStops([0, "#fff", 0], [.55, "#fff", .08], [1, "#fff", .6])}</linearGradient></defs>
<path class="cavity" data-d="1" fill="#050505" fill-opacity=".85" stroke="none"/>${contour(1)}<path class="lit" data-d="1" fill="none" stroke="${ref("lit")}" stroke-width="1.2"/>`, 0, false),
        fxLayerHtml("outline", 0, `<defs><linearGradient id="${u}-edge" x1="0" y1="0" x2="1" y2="1">${fxStops([0, "#fff", .9], [.45, "#fff", .25], [1, "#fff", 0])}</linearGradient></defs>
<path class="glow" data-d="0" fill="none" stroke="#fff" stroke-opacity=".04" stroke-width="9"/><path class="glow" data-d="0" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width="4.5"/>
${contour(0, 'fill="#121212" fill-opacity=".6"')}<path class="edge" data-d="0" fill="none" stroke="${ref("edge")}" stroke-width="1.4"/>
<g class="markers">${Array.from({ length: 16 }, () => `<circle r="1.7" fill="#fff" fill-opacity="0"/>`).join("")}</g>`, 0, false),
        fxLayerHtml("detail", 0, Array.from({ length: 7 }, (_, k) => contour(k + 3)).join(""), 0, false),
        fxLayerHtml("specular", FX_Z.specular, `<defs><radialGradient id="${u}-spec">${fxStops([0, "#fff", .16], [.55, "#fff", .05], [1, "#fff", 0])}</radialGradient></defs>
<circle cx="${W * .36}" cy="${H * .3}" r="170" fill="${ref("spec")}"/>`, FX_SIDE_PAD),
        fxLayerHtml("air", FX_Z.air, air.map(p => `<circle r="${p.r.toFixed(2)}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" fill="#fff" fill-opacity="${p.a.toFixed(2)}"/>`).join(""), FX_SIDE_PAD)
    ].join("\n");
};
const fxFlow = (x, y, t) => (Math.sin(x * .011 + t * .23) + Math.sin(y * .017 - t * .19) + Math.sin((x + y) * .007 + t * .11)) / 3 * Math.PI * 1.5;   // slow flow-field angle

// ---- per-frame pieces ------------------------------------------------------------------------------------------------
// Light: the pre-painted specular layer is moved by translate3d (0.25 W / 0.25 H at the host edge), never repainted. An inline transform on purpose:
// a CSS custom property written on or above the layer re-rasterised it on every update (12 raster tasks per frame in the trace).
const fxLight = (el, x, y) => {
    const k = fxScale(FX_Z.specular).toFixed(4), s = `translate3d(${(x * .25 * FIELD_W).toFixed(1)}px,${(y * .25 * FIELD_H).toFixed(1)}px,${FX_Z.specular}px) scale3d(${k},${k},1)`;
    if (el._t !== s) { el._t = s; el.style.transform = s; }
};
const fxLayerZ = (el, z) => { const s = fxTransform(z); if (el._t !== s) { el._t = s; el.style.transform = s; } };
// d of contour i, displaced along its normals by the current contour-mode superposition when the path vibrates.
const fxCompose = (fx, i) => {
    const base = fx.base[i], n = fx.n[i], w = fx.weight[i];
    let pts = base;
    if (w > 0 && fx.vibActive) {
        const nor = fx.norm[i] ??= fxNormals(base, n, fx.closed[i]), T = fxModeTable(n, fx.closed[i]), [c0, c1, c2] = fx.coef, out = fx.scratch[i];
        for (let j = 0; j < n; j++) {
            const d = w * (c0 * T[0][j] + c1 * T[1][j] + c2 * T[2][j]);
            out[2 * j] = base[2 * j] + nor[2 * j] * d;
            out[2 * j + 1] = base[2 * j + 1] + nor[2 * j + 1] * d;
        }
        pts = out;
    }
    fx.cur[i] = pts;
    return fxD(pts, n, fx.closed[i]);
};
const fxSetD = (fx, i) => { const d = fxCompose(fx, i); for (const el of fx.targets[i]) fxAttr(el, "d", d); };
const fxMarkerPos = fx => {   // the lineModes markers ride on contour 0, wherever vibration has put it
    const pts = fx.cur[0], n = fx.n[0];
    fx.markers.forEach((m, i) => { const j = Math.round((i + .5) / fx.markers.length * (n - 1)); fxAttr(m, "cx", pts[2 * j].toFixed(1)); fxAttr(m, "cy", pts[2 * j + 1].toFixed(1)); });
};
// lineModes of the active line (16 slot-mode energies, fixed recipe index order) light the markers: opacity from mode energy, the CSS
// transition carries the decay. Called by the telemetry part through view.field.setModes(energies, identities, line).
const fxSetModes = (fx, energies, identities) => {
    if (!fx || !energies) return;
    fx.markers.forEach((m, i) => {
        const e = Number.isFinite(energies[i]) ? clamp(energies[i], 0, 8) : 0, id = identities && identities[i];
        fxAttr(m, "fill-opacity", (Math.round(log01(e, 12) * .8 * 25) / 25).toFixed(2));
        fxAttr(m, "data-mode", id ? String(id[2]) : "");
    });
};
// One morph step: z, scale compensation, fog, `d` of every contour (paths, lit edges, cavity), floor width.
const fxGeometry = (fx, T, ids, position, tune) => {
    fx.geometry = false; fx.position = position; fx.tune = tune;
    const a = Math.floor(position), b = Math.min(NUM_ANCHORS - 1, a + 1), t = position - a;
    const scaleFor = fxScaleFor(tune, SPEC.get(ids.Tune)), sa = scaleFor(a), sb = scaleFor(b);
    for (let i = 0; i < 10; i++) {
        fxMorph(T, i, a, b, t, sa, sb, FX_AVAIL, FX_CX, FX_CY, fx.base[i]);
        fx.closed[i] = T[a].paths[i].closed;
        fx.zp[i] = T[a].depth[i] * (1 - t) + T[b].depth[i] * t;
        fx.norm[i] = null;
    }
    const body = fx.base[0], bn = fx.n[0];
    let bx0 = Infinity, bx1 = -Infinity;
    for (let j = 0; j < 2 * bn; j += 2) { if (body[j] < bx0) bx0 = body[j]; if (body[j] > bx1) bx1 = body[j]; }
    fx.bx0 = bx0; fx.bx1 = bx1;   // rest extent of the active body, for the chain thread
    fx.weight[0] = fx.outlineOn ? FX_BODY_W : 0;
    fx.weight[1] = FX_OPENING_W[a] * (1 - t) + FX_OPENING_W[b] * t;
    fx.weight[3] = fx.weight[4] = fx.weight[5] = FX_STRING_W;
    let detail = 0;
    for (let i = 3; i < 10; i++) detail += fx.zp[i];
    fxLayerZ(fx.layers.outline, fx.zp[0]);
    fxLayerZ(fx.layers.opening, fx.zp[1]);
    fxLayerZ(fx.layers.rear, fx.zp[2]);
    fxLayerZ(fx.layers.detail, detail / 7);
    for (let i = 0; i < 10; i++) { fxStroke(fx.contour[i], fx.zp[i], FX_STROKE_OPACITY[i]); fxSetD(fx, i); }
    fxMarkerPos(fx);
    fxAttr(fx.floorEllipse, "rx", (96 * FX_AVAIL * (sa * (1 - t) + sb * t)).toFixed(1));
};
// Audio vibration of opening, strings and outline: at most 30 Hz, drive 0 writes the flat contour once.
const fxVibrate = (fx, phase, drive, bands, kick) => {
    const t0 = performance.now();
    if (drive > 0) {
        const low = (bands[0] + bands[1] + bands[2]) / 3, mid = (bands[3] + bands[4] + bands[5]) / 3, high = (bands[6] + bands[7]) / 2;
        const w = [.25 + .75 * low, .15 + .85 * mid, .1 + .9 * high], norm = 1 / Math.max(1, w[0] + w[1] + w[2]);
        const amp = FX_AVAIL * (1.5 + 1.5 * drive) * clamp(drive / .15, 0, 1) * (1 + .6 * kick) * norm;   // 1.5-3 px x available, onset kick on top
        fx.coef = [0, 1, 2].map(k => amp * w[k] * Math.cos(phase * FX_RATIO[k] + FX_DELTA[k]));
        fx.vibActive = true;
    } else {
        fx.coef = [0, 0, 0];
        fx.vibActive = false;
    }
    for (const i of FX_VIB_PATHS) if (fx.weight[i] > 0) fxSetD(fx, i);
    fxMarkerPos(fx);
    fx.cost = fx.cost * .9 + (performance.now() - t0) * .1;
    if (drive > 0 && fx.outlineOn && ++fx.costN > 30 && fx.cost > 1.5) {   // budget missed: the outline is dropped first (21 section 4)
        fx.outlineOn = false;
        fx.weight[0] = 0;
        fxSetD(fx, 0);
        fxMarkerPos(fx);
    }
};
const fxAir = (fx, tail, now) => {
    if (now - fx.airAt < FX_STEP_MS) return;
    const step = Math.min(.1, (now - fx.airAt) / 1000), span = FIELD_W + 2 * FX_SIDE_PAD, high = FIELD_H + 2 * FX_SIDE_PAD, speed = 5 + 28 * tail;
    fx.airAt = now;
    fx.airT += step;
    for (const p of fx.air) {
        const angle = fxFlow(p.x, p.y, fx.airT);
        p.x += Math.cos(angle) * speed * step;
        p.y += Math.sin(angle) * speed * step;
        if (p.x < -FX_SIDE_PAD) p.x += span; else if (p.x > FIELD_W + FX_SIDE_PAD) p.x -= span;
        if (p.y < -FX_SIDE_PAD) p.y += high; else if (p.y > FIELD_H + FX_SIDE_PAD) p.y -= high;
        fxAttr(p.el, "cx", p.x.toFixed(1));
        fxAttr(p.el, "cy", p.y.toFixed(1));
    }
};
// The two inactive lines as flat silhouettes (contour 0 of their own morph), plus the bounding boxes of the hit layer.
const fxGhosts = (view, fx, T) => {
    const others = LINES.filter(l => l !== view.activeLine);
    others.forEach((line, slot) => {
        const ids = LINE_IDS[line], g = fx.ghost[slot];
        const morph = view.valueOf(ids.Morph), tune = view.valueOf(ids.Tune), enabled = view.valueOf(ids.Enable) >= .5;
        const sig = `${line}|${morph}|${tune}|${enabled}`;
        if (sig !== g.sig) {
            g.sig = sig;
            g.base = enabled ? 1 : .5;
            const position = clamp(morph, 0, NUM_ANCHORS - 1), a = Math.floor(position), b = Math.min(NUM_ANCHORS - 1, a + 1), t = position - a;
            const scaleFor = fxScaleFor(tune, SPEC.get(ids.Tune)), cx = FX_CX + (slot === 0 ? -1 : 1) * FX_GHOST_DX;
            const n = fxMorph(T, 0, a, b, t, scaleFor(a), scaleFor(b), FX_AVAIL * FX_GHOST_K, cx, FX_CY, g.xy);
            fxAttr(g.path, "d", fxD(g.xy, n, T[a].paths[0].closed, 2));
            fxAttr(g.path, "stroke-width", enabled ? "1.1" : ".7");
            let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
            for (let j = 0; j < 2 * n; j += 2) { x0 = Math.min(x0, g.xy[j]); x1 = Math.max(x1, g.xy[j]); y0 = Math.min(y0, g.xy[j + 1]); y1 = Math.max(y1, g.xy[j + 1]); }
            g.x0 = x0; g.x1 = x1;
            const pad = 10;
            fxAttr(g.hit, "x", (x0 - pad).toFixed(1)); fxAttr(g.hit, "y", (y0 - pad).toFixed(1));
            fxAttr(g.hit, "width", (x1 - x0 + 2 * pad).toFixed(1)); fxAttr(g.hit, "height", (y1 - y0 + 2 * pad).toFixed(1));
            g.hit.dataset.index = String(LINES.indexOf(line));
        }
        const glow = .8 + .2 * log01(view.lineTel[line].wet, 10);   // breathes with the line's own wet signal
        fxOpacity(g.layer, g.base * glow * (fx.hover === slot ? 1.25 : 1));
    });
};
// Chain thread: one dotted quadratic arc per chained line (B <- A, C <- B), between the silhouettes: from the source's edge facing the listener to
// the listener's edge facing the source. Extents: the active body's rest outline, or the ghost's resampled contour. Rewritten only when something it depends on changed.
const fxChain = (view, fx) => {
    const active = view.activeLine, ghosts = LINES.filter(l => l !== active);
    const chained = [1, 2].map(i => view.valueOf(LINE_IDS[LINES[i]].Listen) === FX_CHAIN);
    const enabled = LINES.map(l => view.valueOf(LINE_IDS[l].Enable) >= .5);
    const sig = `${active}|${chained}|${enabled}|${fx.position}|${fx.tune}|${fx.ghost[0].sig}|${fx.ghost[1].sig}`;
    if (sig === fx.chainSig) return;
    fx.chainSig = sig;
    const span = line => { const g = fx.ghost[ghosts.indexOf(line)]; return line === active ? [fx.bx0, fx.bx1] : [g.x0, g.x1]; };
    fx.chain.forEach((el, k) => {
        const i = k + 1, from = LINES[i - 1], to = LINES[i];
        fxAttr(el, "display", chained[k] ? "inline" : "none");
        if (!chained[k]) { fxAttr(el, "d", ""); return; }
        const [a0, a1] = span(from), [b0, b1] = span(to), rightward = a0 + a1 < b0 + b1;
        const xs = rightward ? a1 : a0, xe = rightward ? b0 : b1, y = FX_CY - 4, lift = Math.min(12 + .2 * Math.abs(xe - xs), y - 16);   // apex stays inside the field
        fxAttr(el, "d", `M${xs.toFixed(1)},${y.toFixed(1)}Q${((xs + xe) / 2).toFixed(1)},${(y - 2 * lift).toFixed(1)} ${xe.toFixed(1)},${y.toFixed(1)}`);
        fxStroke(el, FX_Z.ghostNear, enabled[i] ? .85 : .42);   // dimmer while the listening line is switched off
        el.dataset.from = from; el.dataset.to = to;
    });
};
const fxFade = fx => {   // 250 ms line cross-fade: compositor-only opacity, geometry stays
    for (const name of ["ghostFar", "ghostNear", "rear", "opening", "outline", "detail"]) {
        try { fx.layers[name].animate([{ opacity: .15 }], { duration: 250, easing: "ease-out" }); } catch { /* no Web Animations: the change simply happens at once */ }
    }
};

const FieldMethods = {
    // Called once per mounted view (after the markup exists). Replaces the panel's flat <svg class="body-object"> by the depth field.
    initField() {
        this.stopField?.();
        const T = fxTemplates(), u = `rbf${++fxUid}`, mode0 = this.motionMode(), pad = fxBackPad(mode0);
        const seed = { s: 7919 };
        const rnd = () => (seed.s = (Math.imul(seed.s, 1664525) + 1013904223) >>> 0) / 4294967296;
        const air = Array.from({ length: FX_AIR }, () => ({ x: -FX_SIDE_PAD + rnd() * (FIELD_W + 2 * FX_SIDE_PAD), y: -FX_SIDE_PAD + rnd() * (FIELD_H + 2 * FX_SIDE_PAD), r: .7 + rnd() * 1.3, a: .25 + rnd() * .35 }));
        const holder = this.querySelector(".body-field") || this.panel || this;
        const html = `<style>${FX_CSS}</style><div class="field" role="img" aria-label="illustration at rest" aria-describedby="${u}-desc"><div class="scene">${fxMarkup(u, air, pad)}</div></div>`
            + `<span id="${u}-desc" hidden>One instrument outline morphs continuously. Tune runs from low to high; higher pitch reduces its dimensions; measured input and resonance energy gently move the geometry. Illustration, not a physical measurement.</span>`;
        const old = holder.querySelector(".body-object");
        if (old) { old.insertAdjacentHTML("beforebegin", html); old.remove(); } else holder.insertAdjacentHTML("afterbegin", html);
        const root = holder.querySelector(".field"), scene = root.querySelector(".scene");
        const layers = Object.fromEntries([...root.querySelectorAll(".layer")].map(el => [el.dataset.layer, el]));
        const sizes = T[0].paths.map(p => p.n);
        const fx = this.fx = {
            root, scene, layers, T, uid: u, mode: mode0, pad,
            contour: Array.from({ length: 10 }, (_, i) => root.querySelector(`[data-contour="${i}"]`)),
            targets: Array.from({ length: 10 }, (_, i) => [...root.querySelectorAll(`[data-d="${i}"]`)]),
            markers: [...root.querySelectorAll(".markers circle")],
            floorEllipse: root.querySelector(".floor-ellipse"),
            base: sizes.map(n => new Float64Array(2 * n)), scratch: sizes.map(n => new Float64Array(2 * n)),
            n: sizes, cur: [], norm: [], closed: Array(10).fill(false), weight: Array(10).fill(0), zp: new Float64Array(10),
            coef: [0, 0, 0], vibActive: false, vibAt: -Infinity, cost: 0, costN: 0, outlineOn: FX_OUTLINE_VIBRATES,
            geometry: true, position: NaN, tune: NaN, line: this.activeLine,
            ghost: [0, 1].map(slot => ({ sig: "", base: 1, xy: new Float64Array(2 * sizes[0]), layer: layers[slot === 0 ? "ghostNear" : "ghostFar"], path: layers[slot === 0 ? "ghostNear" : "ghostFar"].querySelector("path"), hit: layers.hit.querySelectorAll("rect")[slot] })),
            hover: -1, chain: [1, 2].map(i => layers.ghostNear.querySelector(`[data-chain="${i}"]`)), chainSig: "", bx0: 0, bx1: 0,
            air: air.map((p, i) => ({ ...p, el: layers.air.querySelectorAll("circle")[i] })), airAt: -Infinity, airT: 0,
            motion: null
        };
        fxStroke(fx.ghost[0].path, FX_Z.ghostNear, 1);
        fxStroke(fx.ghost[1].path, FX_Z.ghostFar, 1);
        this.caption = this.querySelector(".body-caption");
        this.followNote = this.querySelector(".body-follow");
        this.visualMorph = this.valueOf(LINE_IDS[this.activeLine].Morph);
        this.lastAria = "";
        // clicks on a ghost select its line through the transparent hit layer; the panel can override onSelectLine(index)
        const hit = layers.hit;
        this.listen(hit, "click", event => { const r = event.target.closest?.("rect"); if (r && r.dataset.index !== undefined) this.onSelectLine(Number(r.dataset.index)); });
        fx.ghost.forEach((g, slot) => {
            this.listen(g.hit, "pointerenter", () => { fx.hover = slot; this.touchField(); });
            this.listen(g.hit, "pointerleave", () => { if (fx.hover === slot) { fx.hover = -1; this.touchField(); } });
        });
        // motion: tilt, drift, push, breathe on the scene; the light position goes to the specular layer through onLight
        // `this.motion` is the controller the panel and telemetry talk to: setState (Motion switch), pause (control drags), notifyAudio (readouts, 30 Hz)
        fx.motion = this.motion = new MotionController({ host: this, scene, onLight: (x, y) => fxLight(layers.specular, x, y), state: this.motionPref ?? this.motionMode() });
        fx.motion.start();
        // `this.field` is what the telemetry part feeds with the active line's lineModes
        this.field = { fx, setModes: (energies, identities) => fxSetModes(this.fx, energies, identities) };
        this.drawField();
    },
    stopField() {
        const fx = this.fx;
        if (!fx) return;
        this.fx = null;
        fx.motion?.stop();
        if (this.motion === fx.motion) this.motion = this.motionPref ?? "calm";   // back to the plain string the constructor starts with
        if (this.field && this.field.fx === fx) this.field = null;
    },
    // A click on a ghost silhouette (index into LINES) goes to the panel's selectLine(i), else straight to setActiveLine; either can be replaced.
    onSelectLine(index) {
        if (!(index >= 0 && index < LINES.length) || LINES[index] === this.activeLine) return;
        if (this.selectLine) this.selectLine(index); else this.setActiveLine?.(LINES[index]);
    },
    // One frame of the field. Cheap unless something changed: geometry on morph / tune / line steps, `d` of three layers at 30 Hz on
    // audio, opacity on the rest. Everything else is transform and opacity that the compositor moves.
    drawField() {
        const fx = this.fx;
        if (!fx) return;
        const now = performance.now(), ids = LINE_IDS[this.activeLine], T = fx.T;
        const tune = this.valueOf(ids.Tune), morph = this.valueOf(ids.Morph);
        const mode = this.motionMode(), reduced = mode === "off";
        const [input, wet] = this.energy;
        const active = !(this.valueOf(GID.Bypass) >= .5) && this.valueOf(GID.Mix) > 0;
        const excite = active ? log01(input, 8) : 0, tail = active ? log01(wet, 10) : 0;
        const position = clamp(Number.isFinite(this.visualMorph) ? this.visualMorph : morph, 0, NUM_ANCHORS - 1);
        if (mode !== fx.mode) { fx.mode = mode; const pad = fxBackPad(mode); if (pad !== fx.pad) { fx.pad = pad; fxSizeBack(fx, pad); } }
        if (fx.line !== this.activeLine) { fx.line = this.activeLine; fx.geometry = true; fx.hover = -1; if (!reduced) fxFade(fx); }
        if (fx.geometry || position !== fx.position || tune !== fx.tune) fxGeometry(fx, T, ids, position, tune);
        fxGhosts(this, fx, T);
        fxChain(this, fx);
        // audio vibration of the opening, strings and outline (30 Hz), flat once the drive is gone or Motion is Off
        const drive = reduced ? 0 : clamp(tail * .8 + excite * .7, 0, 1.25);
        const kick = active && input + wet > 0 ? clamp(Math.max(this.onsetTarget, this.onsetLevel), 0, 1) : 0;
        if (drive > .004) { if (now - fx.vibAt >= FX_STEP_MS) { fx.vibAt = now; fxVibrate(fx, this.phase, drive, this.bandLevel, kick); } }
        else if (fx.vibActive) fxVibrate(fx, this.phase, 0, this.bandLevel, 0);
        // brightness follows wet in every state (Off included); opacity is compositor-only
        fxOpacity(fx.layers.floor, .4 + .6 * tail);
        fxOpacity(fx.layers.specular, .6 + .4 * tail);
        fxOpacity(fx.layers.air, .18 + .82 * tail);
        if (FX_AIR_FLOW && !reduced && tail > .002) fxAir(fx, tail, now);
        // ARIA and data attributes as the P1 field
        const pitched = this.isPitched(this.activeLine), a = Math.floor(position), t = position - a;
        const ts = SPEC.get(ids.Tune), midiTune = 36 + Math.round((tune - ts.min) / (ts.max - ts.min) * 36);
        const state = active && wet > .0001 ? "resonating" : active && input > .0001 ? "excited by audio" : "at rest";
        const shape = t < .000001 ? ANCHOR_NAMES[a].toLowerCase().replaceAll(" ", "-") : "hybrid";
        const root = fx.root;
        if (root.dataset.morph !== String(this.visualMorph)) root.dataset.morph = String(this.visualMorph);
        if (root.dataset.shape !== shape) root.dataset.shape = shape;
        if (root.dataset.size !== String(tune)) root.dataset.size = String(tune);
        fx.motion.setState(this.motionPref ?? mode);   // idempotent; re-reads the OS reduced-motion preference after the panel's change handler
        const aria = `${morphDescription(morph)} illustration, Tune ${pitched ? noteName(midiTune) : `${tune}%`}, ${state}`;
        if (aria !== this.lastAria) { this.lastAria = aria; root.setAttribute("aria-label", aria); }
    },
    // Caption (long anchor names, 11-anchor wording of index.js:28-32) of the active line.
    refreshCaption() {
        if (this.caption) this.caption.textContent = morphDescription(this.valueOf(LINE_IDS[this.activeLine].Morph));
    }
};
