// ---- Silhouettes: eleven ten-path drawings, one per morph anchor (anchor order = plugin/spec.json) -----------
// Contract (docs/dev/00_P1_CONTRACTS.md, P6 additions): REBODY_TEMPLATES[anchor] = { name, paths[10], closed[10], depth[10] }.
//   paths  : SVG path strings in the original's convention (centred at 0,0, about 280 wide x 150 high, strokes only):
//            0 outline (closed), 1 opening / membrane (closed), 2 rear part, 3-5 strings or seams, 6-9 fittings.
//            Missing details contract to a point (collapsed), their opacity never changes.
//   closed : [true, true, false x 8], the original's `closed: index < 2` (the field resamples with getPointAtLength).
//   depth  : z in px at perspective 1600 per path (negative = back), the `zTable` of plugin/bodies.json = 22_BODIES.md "Depth".
// The eight originals (index.js:42-97) are copied verbatim, including their ellipse(...) expressions; Timpani, Guitar and
// Fiddle are drawn in the same style. The helpers live inside the IIFE so they never collide with other parts.
const REBODY_TEMPLATES = (() => {
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

    // Timpani: copper kettle seen from the side and front. Counterhoop and skin head on top, kettle bowl as the rear part,
    // a mallet lying across the head, two seam highlights, tension rods, the stand and the pedal.
    const timpaniPaths=[
     ellipse(0,-36,116,32),
     ellipse(0,-36,106,28),
     'M -116 -36 C -116 11 -52 49 0 49 C 52 49 116 11 116 -36',
     'M -72 -22 L 62 -41 A 8 8 0 1 1 78 -43 A 8 8 0 1 1 62 -41',
     'M -96 -16 C -95 6 -66 28 -34 34',
     'M 96 -16 C 95 6 66 28 34 34',
     'M -74 -16 L -74 22 L -68 22 L -68 28',
     'M 74 -16 L 74 22 L 68 22 L 68 28',
     'M -62 72 L -12 72 L -7 51 L 7 51 L 12 72 L 62 72',
     'M 10 63 L 76 63 L 76 58 L 102 58 L 102 68 L 76 68 L 76 63'
    ];

    // Classical guitar: figure-eight body with neck and slotted headstock, sound hole, back-and-sides edge, six strings carried
    // two per path (joined at the bridge), frets, bridge and the two rows of tuning posts.
    const guitarPaths=[
     'M -140 0 C -140 -36 -124 -63 -96 -63 C -70 -63 -62 -37 -50 -37 C -38 -37 -36 -49 -20 -49 C -2 -49 11 -30 10 -9 L 106 -8 L 112 -14 L 140 -14 L 140 14 L 112 14 L 106 8 L 10 9 C 11 30 -2 49 -20 49 C -36 49 -38 37 -50 37 C -62 37 -70 63 -96 63 C -124 63 -140 36 -140 0 Z',
     ellipse(-38,0,19,19),
     'M 2.5 8.1 C 3.4 27 -8.3 44.1 -24.5 44.1 C -38.9 44.1 -40.7 33.3 -51.5 33.3 C -62.3 33.3 -69.5 56.7 -92.9 56.7 C -118.1 56.7 -132.5 32.4 -132.5 0 C -132.5 -32.4 -118.1 -56.7 -92.9 -56.7 C -69.5 -56.7 -62.3 -33.3 -51.5 -33.3 C -40.7 -33.3 -38.9 -44.1 -24.5 -44.1 C -8.3 -44.1 3.4 -27 2.5 -8.1',
     'M 128 -4.8 L -92 -8.5 L -92 -5.1 L 128 -2.9',
     'M 128 -1 L -92 -1.7 L -92 1.7 L 128 1',
     'M 128 2.9 L -92 5.1 L -92 8.5 L 128 4.8',
     'M 95 -8.1 L 95 8.1 L 85 8.2 L 85 -8.2 L 75.5 -8.3 L 75.5 8.3 L 66.5 8.4 L 66.5 -8.4 L 58 -8.5 L 58 8.5 L 50 8.6 L 50 -8.6 L 42 -8.7 L 42 8.7 L 35 8.7 L 35 -8.7 L 28 -8.8 L 28 8.8',
     'M -98 -16 L -86 -16 L -86 16 L -98 16 Z',
     'M 114 -14 L 114 -19 L 118 -19 L 118 -14 L 124 -14 L 124 -19 L 128 -19 L 128 -14 L 134 -14 L 134 -19 L 138 -19 L 138 -14',
     'M 114 14 L 114 19 L 118 19 L 118 14 L 124 14 L 124 19 L 128 19 L 128 14 L 134 14 L 134 19 L 138 19 L 138 14'
    ];

    // Fiddle: violin body with waist and corners, one f-hole as the opening and the other as the last fitting (it keeps the
    // cavity depth), four strings, fingerboard, bridge and the scroll.
    const fiddlePaths=[
     'M -140 0 C -140 -27 -126 -54 -98 -54 C -86 -54 -79 -51 -73 -47 C -68 -40 -63 -28 -52 -28 C -42 -28 -37 -33 -32 -39 C -27 -43 -19 -44 -6 -44 C 10 -44 22 -30 25 -9 L 31 -7 L 88 -6 L 98 -9 L 116 -10 C 130 -16 146 -10 146 0 C 146 10 130 16 116 10 L 98 9 L 88 6 L 31 7 L 25 9 C 22 30 10 44 -6 44 C -19 44 -27 43 -32 39 C -37 33 -42 28 -52 28 C -63 28 -68 40 -73 47 C -79 51 -86 54 -98 54 C -126 54 -140 27 -140 0 Z',
     'M -45.8 -12.9 C -46.4 -12.5 -47.4 -13.9 -48.3 -14.4 C -49.1 -14.9 -49.9 -15.5 -50.7 -15.9 C -51.6 -16.3 -52.4 -16.5 -53.3 -16.7 C -54.2 -16.9 -55.1 -17 -56 -17.1 C -56.8 -17.2 -57.7 -17.3 -58.6 -17.3 C -59.5 -17.3 -60.4 -17.3 -61.3 -17.3 C -62.1 -17.3 -63 -17.2 -64 -17.2 C -64.9 -17.1 -65.8 -17 -66.7 -17 C -67.6 -17 -68.5 -17 -69.4 -17 C -70.4 -17 -71.3 -17.1 -72.2 -17.2 C -73.2 -17.3 -74.1 -17.4 -75 -17.6 C -76 -17.8 -76.9 -18 -77.9 -18.1 C -78.9 -18.2 -79.9 -18.2 -80.9 -18.2 C -81.9 -18.3 -83.7 -17.8 -83.9 -18.6 C -84.1 -19.5 -82.8 -22.9 -82.1 -23.4 C -81.4 -23.9 -80.5 -22.3 -79.7 -21.8 C -78.9 -21.2 -78.1 -20.6 -77.3 -20.2 C -76.4 -19.7 -75.6 -19.5 -74.7 -19.3 C -73.8 -19.1 -72.9 -19 -72 -18.9 C -71.2 -18.8 -70.3 -18.7 -69.4 -18.7 C -68.5 -18.7 -67.6 -18.7 -66.7 -18.7 C -65.9 -18.7 -65 -18.8 -64 -18.8 C -63.1 -18.9 -62.2 -19 -61.3 -19 C -60.4 -19 -59.5 -19 -58.6 -19 C -57.6 -19 -56.7 -18.9 -55.8 -18.8 C -54.8 -18.7 -53.9 -18.6 -53 -18.4 C -52 -18.2 -51.1 -18 -50.1 -17.9 C -49.2 -17.7 -48.1 -17.7 -47.2 -17.6 C -46.2 -17.4 -44.5 -17.8 -44.2 -17.1 C -44 -16.3 -45.1 -13.4 -45.8 -12.9 Z',
     'M 112 -3.3 L 92 -4.4 L -64 -7.5 L -118 -3.6',
     'M 112 -1.1 L 92 -1.5 L -64 -2.5 L -118 -1.2',
     'M 112 1.1 L 92 1.5 L -64 2.5 L -118 1.2',
     'M 112 3.3 L 92 4.4 L -64 7.5 L -118 3.6',
     'M 90 -5.5 L -40 -9.5 Q -45 0 -40 9.5 L 90 5.5 Z',
     'M -67 -15 L -61 -15 Q -59 0 -61 15 L -67 15 Q -65 0 -67 -15 Z',
     'M 139 -6 C 130 -13 119 -4 124 4 C 128 10 138 6 136 -1 C 134 -6 128 -3 130 1',
     'M -44.2 17.1 C -44.5 17.8 -46.2 17.4 -47.2 17.6 C -48.1 17.7 -49.2 17.7 -50.1 17.9 C -51.1 18 -52 18.2 -53 18.4 C -53.9 18.6 -54.8 18.7 -55.8 18.8 C -56.7 18.9 -57.6 19 -58.6 19 C -59.5 19 -60.4 19 -61.3 19 C -62.2 19 -63.1 18.9 -64 18.8 C -65 18.8 -65.9 18.7 -66.7 18.7 C -67.6 18.7 -68.5 18.7 -69.4 18.7 C -70.3 18.7 -71.2 18.8 -72 18.9 C -72.9 19 -73.8 19.1 -74.7 19.3 C -75.6 19.5 -76.4 19.7 -77.3 20.2 C -78.1 20.6 -78.9 21.2 -79.7 21.8 C -80.5 22.3 -81.4 23.9 -82.1 23.4 C -82.8 22.9 -84.1 19.5 -83.9 18.6 C -83.7 17.8 -81.9 18.3 -80.9 18.2 C -79.9 18.2 -78.9 18.2 -77.9 18.1 C -76.9 18 -76 17.8 -75 17.6 C -74.1 17.4 -73.2 17.3 -72.2 17.2 C -71.3 17.1 -70.4 17 -69.4 17 C -68.5 17 -67.6 17 -66.7 17 C -65.8 17 -64.9 17.1 -64 17.2 C -63 17.2 -62.1 17.3 -61.3 17.3 C -60.4 17.3 -59.5 17.3 -58.6 17.3 C -57.7 17.3 -56.8 17.2 -56 17.1 C -55.1 17 -54.2 16.9 -53.3 16.7 C -52.4 16.5 -51.6 16.3 -50.7 15.9 C -49.9 15.5 -49.1 14.9 -48.3 14.4 C -47.4 13.9 -46.4 12.5 -45.8 12.9 C -45.1 13.4 -44 16.3 -44.2 17.1 Z'
    ];

    const ordered=[
        ['Bass Drum', instrumentPaths[0], [0, -40, -300, 92, 92, 60, 100, 100, 100, 100]],
        ['Snare', instrumentPaths[1], [0, 10, -60, 80, 80, 80, 80, 80, 80, 80]],
        ['Timpani', timpaniPaths, [20, 0, -280, 120, 120, 120, 120, 120, 120, 120]],
        ['Piano', instrumentPaths[2], [0, -200, 160, -60, -60, -60, 160, 160, 160, 160]],
        ['Guitar', guitarPaths, [0, -420, -260, 40, 40, 40, 40, 120, 120, 120]],
        ['Ukulele', instrumentPaths[3], [0, -420, 40, 40, 40, 40, 90, 90, 130, 130]],
        ['Fiddle', fiddlePaths, [0, -420, 60, 60, 60, 60, 140, 120, 100, -420]],
        ['Clarinet', instrumentPaths[4], [0, -120, 160, 120, 120, 120, 120, 120, 120, 120]],
        ['Oboe', instrumentPaths[5], [0, -120, 170, 120, 120, 120, 120, 120, 120, 120]],
        ['Sax', instrumentPaths[6], [0, 220, -260, 140, 172, 172, 180, 180, 180, 180]],
        ['Obosaxolele', hybridPaths, [0, 220, 40, 40, 40, 40, 140, 140, 140, 140]]
    ];
    return ordered.map(([name, paths, depth]) => ({ name, paths, closed: paths.map((_, i) => i < 2), depth }));
})();
