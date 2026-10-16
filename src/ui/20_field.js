// ---- The field: the original silhouettes, morphed, scaled by Tune, flexed by energy -----------------
// Drawings are the original's, verbatim (index.js:42-97). Resampling (index.js:78-82, :98-102) is built lazily,
// the first time the field mounts, instead of at module evaluation.
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

// Eight drawings, resampled once; the 11 anchors point at them through TEMPLATE_OF (00_header.js).
// TODO(U-step): Timpani, Guitar and Fiddle still reuse the nearest drawing (bass drum, ukulele, ukulele); they need their own ten-path drawings.
let bodyTemplates = null;
const getTemplates = () => {
    if (bodyTemplates) return bodyTemplates;
    const resample = paths => paths.map((d, index) => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", d);
        const length = path.getTotalLength(), steps = index === 0 ? 192 : index === 1 ? 96 : 48;
        return { closed: index < 2, points: Array.from({ length: steps + 1 }, (_, i) => { const p = path.getPointAtLength(length * i / steps); return [p.x, p.y]; }) };
    });
    bodyTemplates = instrumentPaths.map(resample);
    bodyTemplates.push(resample(hybridPaths));
    return bodyTemplates;
};

const FieldMethods = {
    // Called once per mounted view (after the markup exists).
    initField() {
        getTemplates();
        this.svg = this.querySelector(".body-object");
        this.contourPaths = [...this.svg.querySelectorAll("[data-contour]")];
        this.caption = this.querySelector(".body-caption");
        this.followNote = this.querySelector(".body-follow");
        this.visualMorph = this.valueOf(LINE_IDS[this.activeLine].Morph);
        this.lastAria = "";
    },
    // One frame of the field (index.js:349-359) with a fixed 912 x 234 view box: nothing is measured.
    drawField() {
        if (!this.svg) return;
        const T = getTemplates(), ids = LINE_IDS[this.activeLine];
        const tune = this.valueOf(ids.Tune), morph = this.valueOf(ids.Morph);
        const [input, wet, left, right] = this.energy;
        const active = !(this.valueOf(GID.Bypass) >= .5) && this.valueOf(GID.Mix) > 0, reduced = this.motionMode() === "off";
        const excite = active ? log01(input, 8) : 0, tail = active ? log01(wet, 10) : 0, stereo = (left - right) / (left + right + .0001);
        const position = clamp(this.visualMorph, 0, NUM_ANCHORS - 1), a = Math.floor(position), b = Math.min(NUM_ANCHORS - 1, a + 1), t = position - a;
        const ts = SPEC.get(ids.Tune), tuneNorm = (tune - ts.min) / (ts.max - ts.min), midiTune = 36 + Math.round(tuneNorm * 36);
        const scaleFor = i => i < DRUM_ANCHORS ? 1 - tuneNorm * .22 : .78 + (1 - (midiTune - 36) / 36) * .22;
        const available = Math.min(FIELD_W / 330, Math.max(24, FIELD_H - FIELD_BAND - 3) / 150), sa = scaleFor(a), sb = scaleFor(b);
        const cx = FIELD_W / 2, cy = (FIELD_H - FIELD_BAND) / 2, ta = T[TEMPLATE_OF[a]], tb = T[TEMPLATE_OF[b]];
        const motion = reduced ? 0 : (tail * .8 + excite * .7);
        this.contourPaths.forEach((path, index) => {
            const template = ta[index], other = tb[index].points;
            const points = template.points.map((p, j) => {
                const q = other[j], u = j / (template.points.length - 1);
                const x = (p[0] * sa * (1 - t) + q[0] * sb * t) * available, y = (p[1] * sa * (1 - t) + q[1] * sb * t) * available;
                const flex = motion * (template.closed ? 1 : Math.sin(u * Math.PI)) * Math.sin(this.phase + u * Math.PI * 2 + index * .41);
                return [cx + x + flex * .2 * (1 + stereo * .2), cy + y + flex * .5];
            });
            path.setAttribute("d", points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(3)},${y.toFixed(3)}`).join(" ") + (template.closed ? " Z" : ""));
            path.style.opacity = String(index === 0 ? .95 : index === 1 ? .72 : .65);
        });
        const pitched = this.isPitched(this.activeLine), state = active && wet > .0001 ? "resonating" : active && input > .0001 ? "excited by audio" : "at rest";
        this.svg.dataset.morph = String(this.visualMorph);
        this.svg.dataset.shape = t < .000001 ? ANCHOR_NAMES[a].toLowerCase().replaceAll(" ", "-") : "hybrid";
        this.svg.dataset.size = String(tune);
        const aria = `${morphDescription(morph)} illustration, Tune ${pitched ? noteName(midiTune) : `${tune}%`}, ${state}`;
        if (aria !== this.lastAria) { this.lastAria = aria; this.svg.setAttribute("aria-label", aria); }
    },
    // Caption (long anchor names, 11-anchor wording of index.js:28-32) of the active line.
    refreshCaption() {
        if (this.caption) this.caption.textContent = morphDescription(this.valueOf(LINE_IDS[this.activeLine].Morph));
    }
};
