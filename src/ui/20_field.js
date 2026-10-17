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
// every other layer is transform / opacity only. Silhouettes come from REBODY_TEMPLATES (15_silhouettes.js); without it the
// original eight drawings stand in (fxFallbackTemplates below, to be removed once 15_silhouettes.js is merged).
// Hooks with the other parts: view.motion (MotionController: setState / pause / notifyAudio are called by the panel and telemetry), view.field
// (setModes, called by telemetry with the active line's lineModes), view.onSelectLine (ghost click, goes to the panel's selectLine).
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
    let source = typeof REBODY_TEMPLATES !== "undefined" ? REBODY_TEMPLATES : null;
    if (!Array.isArray(source) || source.length < NUM_ANCHORS) source = fxFallbackTemplates();
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

// BEGIN FALLBACK (delete this block and fxFallbackTemplates together with the check above once 15_silhouettes.js is merged)
// z per path as shipped in plugin/bodies.json `zTable`, 11 anchors x 10 paths (22_BODIES.md "Depth").
const FX_FALLBACK_Z = [[0, -40, -300, 92, 92, 60, 100, 100, 100, 100], [0, 10, -60, 80, 80, 80, 80, 80, 80, 80], [20, 0, -280, 120, 120, 120, 120, 120, 120, 120],
    [0, -200, 160, -60, -60, -60, 160, 160, 160, 160], [0, -420, -260, 40, 40, 40, 40, 120, 120, 120], [0, -420, 40, 40, 40, 40, 90, 90, 130, 130],
    [0, -420, 60, 60, 60, 60, 140, 120, 100, 100], [0, -120, 160, 120, 120, 120, 120, 120, 120, 120], [0, -120, 170, 120, 120, 120, 120, 120, 120, 120],
    [0, 220, -260, 140, 172, 172, 180, 180, 180, 180], [0, 220, 40, 40, 40, 40, 140, 140, 140, 140]];
const fxFallbackTemplates = () => {
const ellipse=(x,y,rx,ry)=>`M ${x-rx} ${y} A ${rx} ${ry} 0 1 1 ${x+rx} ${y} A ${rx} ${ry} 0 1 1 ${x-rx} ${y} Z`;
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
    const drawings = [...instrumentPaths, hybridPaths];   // bass, snare, piano, ukulele, clarinet, oboe, sax, hybrid: the nearest drawing stands in for Timpani, Guitar, Fiddle
    return ANCHOR_NAMES.map((name, i) => { const paths = drawings[TEMPLATE_OF[i]]; return { name, paths, closed: paths.map((_, k) => k < 2), depth: FX_FALLBACK_Z[i] }; });
};
// END FALLBACK

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
        fxLayerHtml("ghostNear", FX_Z.ghostNear, `<path class="ghost" data-slot="0" fill="none" stroke-width="1.1"/>`),
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
            const pad = 10;
            fxAttr(g.hit, "x", (x0 - pad).toFixed(1)); fxAttr(g.hit, "y", (y0 - pad).toFixed(1));
            fxAttr(g.hit, "width", (x1 - x0 + 2 * pad).toFixed(1)); fxAttr(g.hit, "height", (y1 - y0 + 2 * pad).toFixed(1));
            g.hit.dataset.index = String(LINES.indexOf(line));
        }
        const glow = .8 + .2 * log01(view.lineTel[line].wet, 10);   // breathes with the line's own wet signal
        fxOpacity(g.layer, g.base * glow * (fx.hover === slot ? 1.25 : 1));
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
            hover: -1,
            air: air.map((p, i) => ({ ...p, el: layers.air.querySelectorAll("circle")[i] })), airAt: -Infinity, airT: 0,
            motion: null
        };
        this.contourPaths = fx.contour;   // P1 name, kept
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
        fx.motion = this.motion = new MotionController({ host: this, scene, onLight: (x, y) => fxLight(layers.specular, x, y), state: this.motionPref ?? this.motionMode(), isSuspended: () => this.resizing?.() === true });
        fx.motion.start();
        // `this.field` is what the telemetry part feeds with the active line's lineModes
        this.field = { fx, setModes: (energies, identities) => fxSetModes(this.fx, energies, identities) };
        // teardown without touching the export part: the panel's teardown loop calls removeEventListener on every registered node
        this.listeners.push([{ removeEventListener: (_type, fn) => fn() }, "teardown", () => this.stopField()]);
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
