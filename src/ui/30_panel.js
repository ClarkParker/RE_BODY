// ---- Panel (v2, P6): markup, layout (21_UI_CONCEPT §1), tokens, line sets, tabs, copy, motion switch ---------------
// Carried-over rules keep the original class names and values (§11); the tag prefix is added by css().
// v2 adds: one-light tokens (--lx/--ly), lamp states (--lamp), baked grain + vignette, typography >= 10 px, dial v2 / morph hero looks.
const RAW_CSS = `*{box-sizing:border-box;margin:0;padding:0}
html,body{overflow:hidden;margin:0;padding:0}
::-webkit-scrollbar{width:0!important;height:0!important;display:none!important}
*{scrollbar-width:none}
@media(prefers-reduced-motion:reduce){${TAG} *,${TAG} *::before,${TAG} *::after{transition:none!important}}`;
const FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
const css = rules => rules.map(([sel, decl]) => sel.split(",").map(s => { s = s.trim(); return s.includes("&") ? s.replaceAll("&", TAG) : `${TAG} ${s}`; }).join(",") + `{${decl}}`).join("\n");

// Light model helpers (R11 R2): everything derives from --lx/--ly, painted once, never moved.
const away = d => `calc(var(--lx)*${-d}px) calc(var(--ly)*${-d}px)`;                                  // offset away from the light
const lit = (d, a, blur = 0, spread = 0) => `inset ${away(d)} ${blur}px ${spread}px rgba(255,255,255,${a})`;   // edge facing the light
const cast = (d, blur, a) => `${away(d)} ${blur}px rgba(0,0,0,${a})`;                                  // shadow on the far side
// Baked grain (R11 R9): one 128 px tile of fractal noise as an SVG data URI, rasterised once by the browser; a vignette sits above the backdrop.
const GRAIN_SVG = "<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'><filter id='g' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' seed='7' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 3 3 3 0 -4.5'/></filter><rect width='128' height='128' filter='url(#g)' opacity='.04'/></svg>";
const BACKDROP = `url("data:image/svg+xml,${encodeURIComponent(GRAIN_SVG)}") 0 0/128px 128px,radial-gradient(ellipse at 50% 45%,rgba(0,0,0,0) 58%,rgba(0,0,0,.32) 100%),radial-gradient(ellipse at 50% 42%,#181818,#090909 76%)`;
const BUTTON_FACE = `background-color:#111;background-image:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,0) 55%);border:1px solid #333;border-radius:4px;box-shadow:${lit(1, .09)},${cast(1, 2, .55)};color:#aaa`;
const BUTTONS = ".body-bypass,.body-enablebtn,.body-motionbtn,.body-segbtn";
const CHECKED = BUTTONS.split(",").map(b => `${b}[aria-checked="true"]`).join(",");
const SEG = "position:relative;height:28px;padding:0 10px;font-size:10px;font-weight:550;letter-spacing:.03em;white-space:nowrap";
const dialPx = kind => `width:${DIAL_PX[kind]}px;height:${DIAL_PX[kind]}px`;
const arcStroke = kind => `stroke-width:${unitsOf(kind, ARC_PX[kind])}`;
const STYLE = css([
    ["&", "display:flex;justify-content:center;align-items:center;width:100%;height:100%;overflow:hidden;background:transparent;user-select:none;-webkit-user-select:none"],
    ["&,& *,& *::before,& *::after", "box-sizing:border-box;margin:0;padding:0"],
    ["[hidden]", "display:none!important"],
    // tokens: ink / text greys (>= 4.5:1 on the lightest backdrop #181818), informational track (>= 3:1), the one light, the lamp
    [".body-panel", `--ink:#ededed;--muted:#969696;--text2:#a5a5a5;--text3:#8c8c8c;--track:#686868;--lx:${LIGHT_X};--ly:${LIGHT_Y};--lamp:.7;position:relative;flex:none;width:${CHASSIS_W}px;height:${CHASSIS_H}px;overflow:hidden;padding:12px 24px;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:36px ${FIELD_H}px 48px 100px 64px 64px;gap:6px;background:${BACKDROP};color:var(--ink);font:12px/1.3 ${FONT}`],
    [".body-panel[data-lamp=\"active\"]", "--lamp:1"],
    [".body-panel[data-lamp=\"idle\"]", "--lamp:.7"],
    [".body-panel[data-lamp=\"bypass\"]", "--lamp:.25"],
    // header: title + brand, line tabs, copy, state, utilities
    [".body-header", "grid-row:1;display:flex;align-items:center;gap:12px;min-width:0"],
    [".body-ident", "display:flex;flex-direction:column;align-items:flex-start;flex:none"],
    [".body-title", "font-size:23px;font-weight:750;letter-spacing:.075em;line-height:1"],
    [".body-maker", "margin-top:2px;font-size:10px;line-height:10px;letter-spacing:2.5px;color:#8f8f8f"],
    [".body-tabs", "display:flex;align-items:center;gap:6px;flex:none"],
    [".body-tab", `--lamp:0;--held:1;display:flex;align-items:center;gap:3px;height:30px;padding:0 8px 0 3px;border:1px solid #2c2c2c;border-radius:6px;background:#101010;box-shadow:${lit(1, .05)}`],
    [".body-tab[data-active=\"true\"]", "border-color:#ededed"],
    [".body-tab[data-hold=\"true\"]", "--held:.4"],
    [".body-tabname", "appearance:none;border:0;background:transparent;border-radius:4px;height:24px;min-width:26px;padding:0 6px;font-size:12px;font-weight:700;letter-spacing:.1em;color:#a5a5a5"],
    [".body-tab[data-active=\"true\"] .body-tabname", "color:#ededed"],
    [".body-enablebtn", "min-width:34px;height:24px;padding:0 6px;font-size:10px;font-weight:700;letter-spacing:.1em"],
    [".body-lamp", "flex:none;width:7px;height:7px;border-radius:50%;background:#ededed;opacity:calc((.2 + var(--lamp) * .8) * var(--held));box-shadow:0 0 calc(var(--lamp) * 6px) rgba(237,237,237,.5)"],
    [".body-tab[data-on=\"false\"] .body-lamp", "background:transparent;box-shadow:inset 0 0 0 1px #777;opacity:1"],
    [".body-copy", "display:flex;align-items:center;gap:4px;flex:none"],
    [".body-copy::before", "content:\"COPY\";margin-right:2px;font-size:10px;letter-spacing:.14em;color:#8c8c8c"],
    [".body-copybtn", "min-width:40px;min-height:24px;padding:4px 7px"],
    [".body-state", "display:flex;align-items:center;justify-content:center;gap:5px;flex:none;min-width:84px;font-size:10px;font-weight:600;letter-spacing:.12em;color:#a5a5a5"],
    [".body-state::before", "content:\"\";flex:none;width:6px;height:6px;border-radius:50%;background:#ededed;opacity:var(--lamp);transition:opacity .4s ease"],
    [".body-state[data-state=\"active\"]", "color:#ededed"],
    [".body-utilities", "display:flex;align-items:center;gap:12px;margin-left:auto"],
    ["button,input", "font:inherit;color:inherit"],
    ["button", "cursor:pointer"],
    // button vocabulary: the original Bypass look (:274-277) plus the light model (lit edge, cast shadow, pressed = 1 px down)
    [BUTTONS, `appearance:none;${BUTTON_FACE};transition:transform .05s ease,box-shadow .05s ease,border-color .12s ease`],
    [".body-bypass", "padding:5px 9px;font-size:10px"],
    [BUTTONS.split(",").map(b => `${b}:hover`).join(","), "border-color:#5c5c5c;color:#d6d6d6"],
    [BUTTONS.split(",").map(b => `${b}:active`).join(","), `transform:translateY(1px);box-shadow:${lit(1, .04)},${cast(.5, 1, .6)}`],
    [BUTTONS.split(",").map(b => `${b}[data-flash="true"]`).join(","), "border-color:#ededed"],
    [CHECKED, "background-color:#ededed;background-image:none;color:#111;border-color:#ededed;box-shadow:inset 0 -1px 0 rgba(0,0,0,.16)"],
    [BUTTONS.split(",").map(b => `${b}[aria-checked="true"]:hover`).join(","), "color:#111;border-color:#ededed"],
    [".body-motion", "display:flex;align-items:center;gap:5px"],
    [".body-motion-label", "font-size:10px;letter-spacing:.14em;color:#8c8c8c"],
    [".body-motionseg", "display:flex;gap:2px"],
    [".body-motionbtn", `${SEG};height:24px;padding:0 8px`],
    // field (P1 container; the depth field of the field worker replaces what is inside .body-field)
    [".body-field", "grid-row:2;min-width:0;min-height:0;position:relative;pointer-events:none"],
    [".body-object", `width:${FIELD_W}px;height:${FIELD_H}px;overflow:visible;display:block;pointer-events:none;transition:opacity .4s ease`],
    [".body-object path", "stroke:#d0d0d0;fill:none;stroke-width:1;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke"],
    [".body-object [data-contour=\"0\"]", "fill:#121212;stroke-width:1.65"],
    [".body-caption", `position:absolute;left:0;right:0;bottom:13px;height:17px;text-align:center;color:#c4c4c4;font:600 14px/17px ${FONT};letter-spacing:.05em`],
    [".body-follow", `position:absolute;left:0;right:0;bottom:0;height:13px;text-align:center;color:#a0a0a0;font:500 10px/13px ${FONT};letter-spacing:.1em`],
    [".body-scope", "position:absolute;left:0;top:0;width:156px;display:flex;flex-direction:column;gap:5px"],
    [".body-meter,.body-onset", "display:flex;align-items:center;gap:6px;height:10px"],
    [".body-meter-l", "flex:none;width:46px;font-size:10px;line-height:10px;letter-spacing:.14em;color:#8c8c8c"],
    [".body-meter-bar", "position:relative;flex:1;height:4px;border-radius:2px;background:var(--track)"],
    [".body-meter-bar i", "position:absolute;left:0;top:0;bottom:0;width:calc(var(--lv,0) * 100%);border-radius:2px;background:#ededed"],
    [".body-onset-lamp", "flex:none;width:8px;height:8px;border-radius:50%;background:#ededed;opacity:calc(.15 + var(--lv,0) * .85)"],
    [".body-bands", "position:absolute;right:0;top:0;display:flex;align-items:flex-end;gap:3px;height:34px"],
    [".body-bands i", "display:block;width:7px;height:calc(2px + var(--lv,0) * 32px);border-radius:1px;background:#ededed;opacity:.85"],
    // morph row hero (21 §5, R11 R4): label, slider over 11 anchor cells, Hold
    [".body-morphrow", "grid-row:3;display:flex;align-items:flex-start;gap:10px;min-width:0"],
    [".body-morph-heading", "flex:none;width:52px;font-size:10px;line-height:28px;letter-spacing:.14em;color:#8c8c8c"],
    [".body-morph", "flex:1 1 auto;min-width:0;position:relative"],
    [".body-hold", "flex:none;width:64px"],
    [".body-hold .body-bypass", "width:64px;height:28px;padding:0"],
    [".body-hold .body-bypass::before", "content:\"\";display:inline-block;width:6px;height:6px;margin-right:6px;border-radius:50%;background:currentColor;opacity:.3;vertical-align:1px"],
    [".body-hold[data-lit=\"true\"] .body-bypass::before", "opacity:1;box-shadow:0 0 6px currentColor"],
    [".body-hold[data-lit=\"true\"] .body-bypass", "box-shadow:0 0 9px rgba(237,237,237,.45)"],
    [".body-morph-slider", "height:28px;position:relative;cursor:ew-resize;touch-action:none;border-radius:4px;--morph:.7;margin:0 calc(100% / 22)"],
    [".body-morph-rail", `position:absolute;left:0;right:0;top:12px;height:3px;border-radius:2px;background:var(--track);box-shadow:inset 0 1px 1px rgba(0,0,0,.6),0 1px 0 rgba(255,255,255,.07);pointer-events:none`],
    [".body-morph-thumb", `position:absolute;left:calc(var(--morph) * 100%);top:-5.5px;width:14px;height:14px;border-radius:50%;background:radial-gradient(circle at calc(50% + var(--lx) * 24%) calc(50% + var(--ly) * 24%),#fff,#ededed 55%,#b4b4b4);transform:translateX(-50%);box-shadow:0 0 0 3px #151515,${cast(1.5, 3, .6)},0 0 9px rgba(237,237,237,.3);transition:box-shadow .08s ease`],
    [".body-morph-slider:hover .body-morph-thumb", "box-shadow:0 0 0 3px #151515,0 1px 3px rgba(0,0,0,.6),0 0 12px rgba(237,237,237,.45)"],
    [".body-morph-slider[data-dragging=\"true\"] .body-morph-thumb", "box-shadow:0 0 0 3px #151515,0 0 2px rgba(0,0,0,.6),0 0 15px rgba(237,237,237,.6)"],
    [".body-morph-tick", "position:absolute;left:calc(var(--anchor) / 10 * 100%);top:15px;width:1px;height:calc(4px + var(--near,0) * 5px);background:#a0a0a0;opacity:calc(.7 + var(--near,0) * .3);transform:translateX(-.5px)"],
    [".body-morph-bar", "position:absolute;left:calc(var(--anchor) / 10 * 100%);bottom:100%;width:1px;height:calc(var(--w,0) * 11px);background:#ededed;opacity:.9;transform:translateX(-.5px)"],
    [".body-morph-bracket", "position:absolute;left:100%;top:-9px;width:15px;height:7px;margin-left:-7px;border:1px solid #8c8c8c;border-bottom:0;border-radius:2px 2px 0 0;pointer-events:none"],
    [".body-anchor-row", "display:grid;grid-template-columns:repeat(11,minmax(0,1fr));gap:0"],
    [".body-anchor", "appearance:none;display:flex;align-items:center;justify-content:center;border:0;background:transparent;border-radius:3px;padding:3px 0;font-size:11px;line-height:12px;font-weight:550;letter-spacing:.015em;white-space:nowrap;color:#8c8c8c"],
    [".body-anchor:hover,.body-anchor[aria-pressed=\"true\"]", "color:#ededed"],
    // deck: line cluster | divider | globals
    [".body-deck", "grid-row:4;display:flex;align-items:flex-end;min-width:0;padding-top:4px"],
    [".body-deckline", "display:flex;align-items:flex-end;flex:none;width:624px"],
    [".body-deckdiv", "flex:none;width:32px;align-self:stretch;display:flex;justify-content:center"],
    [".body-deckdiv::before", "content:\"\";width:1px;margin:6px 0 14px;background:#2c2c2c"],
    [".body-deckglobal", "display:flex;align-items:flex-end;flex:none"],
    // controls: dial v2 (R11 R3): 70 / 40 / 28 px, lit conic cap with a static specular crescent, pressed and hover rims, fine ring
    [".body-control", "position:relative;display:flex;flex-direction:column;align-items:center;min-width:0"],
    [".body-control-dial", "width:112px"],
    [".body-control-small", "width:72px"],
    [".body-control-mini", "width:76px"],
    [".body-dial", "--norm:.5;position:relative;border-radius:50%;cursor:ns-resize;touch-action:none;flex-shrink:0"],
    [".body-control-dial .body-dial", dialPx("dial")],
    [".body-control-small .body-dial", dialPx("small")],
    [".body-control-mini .body-dial", dialPx("mini")],
    [".body-dial-graphic", "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible"],
    [".body-dial-track", `fill:none;stroke:var(--track);${arcStroke("dial")};stroke-linecap:round`],
    [".body-dial-grey", `fill:none;stroke:#2a2a2a;${arcStroke("dial")};stroke-linecap:round`],
    [".body-dial-arc", `fill:none;stroke:#ededed;${arcStroke("dial")};stroke-linecap:round;transition:opacity .4s ease`],
    [".body-dial-default", `fill:none;stroke:#d4d4d4;stroke-width:${unitsOf("dial", TICK_PX)};stroke-linecap:butt;pointer-events:none`],
    [".body-control-small .body-dial-track,.body-control-small .body-dial-arc,.body-control-small .body-dial-grey", arcStroke("small")],
    [".body-control-mini .body-dial-track,.body-control-mini .body-dial-arc,.body-control-mini .body-dial-grey", arcStroke("mini")],
    [".body-control-small .body-dial-default", `stroke-width:${unitsOf("small", TICK_PX)}`],
    [".body-control-mini .body-dial-default", `stroke-width:${unitsOf("mini", TICK_PX)}`],
    [".body-inner", `position:absolute;inset:12%;border:1px solid #303030;border-radius:50%;background:radial-gradient(circle at calc(50% + var(--lx) * 28%) calc(50% + var(--ly) * 28%),rgba(255,255,255,.09),rgba(255,255,255,0) 62%),conic-gradient(from 215deg,#171717,#1f1f1f 20%,#101010 45%,#1a1a1a 72%,#171717);display:flex;align-items:center;justify-content:center;pointer-events:none;box-shadow:${cast(2, 3, .65)},${lit(1.5, .5, 1, -1)};transition:transform .05s ease,box-shadow .05s ease,border-color .12s ease`],
    [".body-inner::after", "content:\"\";position:absolute;inset:3px;border:1px dashed rgba(237,237,237,.75);border-radius:50%;opacity:0;pointer-events:none"],
    [".body-control-mini .body-inner::after", "inset:2px"],
    [".body-dial:hover .body-inner", "border-color:#5a5a5a"],
    [".body-dial[data-dragging=\"true\"] .body-inner", `border-color:#ededed;transform:translateY(1px);box-shadow:${cast(1, 1, .75)},${lit(1.5, .3, 1, -1)}`],
    [".body-dial[data-flash=\"true\"] .body-inner", "border-color:#ededed"],
    [".body-dial[data-fine=\"true\"] .body-inner::after", "opacity:1"],
    [".body-pointer", "position:absolute;inset:0;transform:rotate(calc(var(--norm) * 270deg - 135deg));pointer-events:none"],
    [".body-pointer::after", "content:\"\";position:absolute;top:16%;left:calc(50% - .75px);width:1.5px;height:7%;background:#ededed"],
    [".body-label", "display:grid;margin-top:4px;font-size:10px;font-weight:600;letter-spacing:.12em;white-space:nowrap;color:#a5a5a5"],
    [".body-labtext,.body-labval", "grid-area:1/1;justify-self:center"],
    [".body-labval", "visibility:hidden;color:var(--ink);letter-spacing:.04em;font-variant-numeric:tabular-nums"],
    [".body-control-small .body-label", "margin-top:3px;letter-spacing:.08em"],
    [".body-control-mini .body-label", "margin-top:2px;letter-spacing:.06em"],
    [".body-control-mini:hover .body-labtext,.body-control-mini:focus-within .body-labtext,.body-control-mini[data-dragging=\"true\"] .body-labtext", "visibility:hidden"],
    [".body-control-mini:hover .body-labval,.body-control-mini:focus-within .body-labval,.body-control-mini[data-dragging=\"true\"] .body-labval", "visibility:visible"],
    [".body-value", "appearance:none;border:0;background:transparent;padding:5px 0;pointer-events:auto;font-size:13px;font-weight:550;font-variant-numeric:tabular-nums;white-space:nowrap;cursor:ns-resize;touch-action:none"],
    [".body-control-small .body-value", "padding:3px 0;font-size:10px;letter-spacing:-.02em"],
    [".body-control-mini .body-value,.body-control-mini .body-value:hover", "position:absolute;inset:0;width:100%;padding:0;font-size:10px;color:transparent;border-radius:50%"],
    [".body-value:hover", "color:#fff"],
    [".body-editor", "pointer-events:auto;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2;width:90%;min-width:52px;padding:3px 0;border:1px solid #777;border-radius:3px;background:#101010;color:#ededed;text-align:center;font-size:11px;font-variant-numeric:tabular-nums;user-select:text;-webkit-user-select:text"],
    [".body-control[data-lock=\"true\"]::after", "content:\"\";position:absolute;top:3px;left:calc(50% + 11.5px);width:5px;height:5px;border-radius:50%;background:#ededed;box-shadow:0 0 6px rgba(237,237,237,.7);pointer-events:none"],
    // strips: grouped, with headings
    [".body-strip1", "grid-row:5;display:flex;align-items:center;gap:16px;min-width:0"],
    [".body-strip2", "grid-row:6;display:flex;align-items:flex-end;gap:22px;min-width:0"],
    [".body-group", "display:flex;flex-direction:column;gap:3px;min-width:0"],
    [".body-grouprow", "display:flex"],
    [".body-grouphead", "display:flex;align-items:center;gap:6px;font-size:10px;line-height:12px;letter-spacing:.14em;color:#8c8c8c"],
    [".body-grouphead::after", "content:\"\";flex:1;height:1px;background:#2c2c2c"],
    [".body-seg", "display:flex;gap:2px"],
    [".body-segbtn", SEG],
    [".body-segmeter", "position:absolute;left:5px;bottom:2px;height:2px;border-radius:1px;background:currentColor;width:calc((100% - 10px) * var(--lv,0));pointer-events:none"],
    // process states, focus
    [".body-panel[data-process=\"bypass\"] .body-object,.body-panel[data-process=\"dry\"] .body-object", "opacity:.25"],
    [".body-panel[data-process=\"bypass\"] .body-dial-arc", "opacity:.3"],
    [".body-dial:focus-visible,.body-morph-slider:focus-visible,button:focus-visible,input:focus-visible", "outline:1px solid #ededed;outline-offset:3px"]
]);

// Layout of the line set (which keys go where); kinds come from spec.json `ui`.
const LAYOUT = {
    deckMain: ["Tune", "Decay", "Material"],
    deckSmall: ["Level", "Follow", "Blend", "Pan"],
    strip1: [["LISTEN", "Listen", "Sensitivity"], ["EXCITE", "Excite", "Touch"]],
    strip2: [["contact", ["Position", "Bright"]], ["body", ["Size", "Body", "Stretch"]], ["physics", ["Stiffness", "Coupling", "Air", "Reed"]]]
};
const MOTION_MODES = [["off", "Off"], ["calm", "Calm"], ["full", "Full"]];
const HOLD_TIP = "Hold sustains the body resonance; strings and bores ring out naturally";
const ctl = (line, key, opt) => Control.html(SPEC.get(LINE_IDS[line][key]), opt);
const glob = (key, opt) => Control.html(SPEC.get(GID[key]), opt);
const hid = line => line === LINES[0] ? "" : " hidden";
const lineSet = (cls, line, inner) => `<div class="${cls}" data-lineset="${line}"${hid(line)}>${inner}</div>`;
const group = (head, inner) => `<div class="body-group"><span class="body-grouphead">${head}</span>${inner}</div>`;

const PanelMethods = {
    panelHtml() {
        const tab = line => `<div class="body-tab" data-tab="${line}" data-active="${line === LINES[0]}" data-on="true"><button type="button" class="body-tabname" role="tab" aria-selected="${line === LINES[0]}" title="Line ${line} (key ${LINES.indexOf(line) + 1})">${line}</button>${ctl(line, "Enable", { caption: "ON", off: "OFF", on: "ON", btn: "body-enablebtn", cls: "body-enable" })}<span class="body-lamp" data-lamp="${line}" aria-hidden="true"></span></div>`;
        const copies = LINES.slice(1).map(dst => `<button type="button" class="body-bypass body-copybtn" data-copy="${dst}" aria-label="Copy line ${LINES[0]} to line ${dst}" title="Copy line ${LINES[0]} settings to line ${dst} (Enable and Hold excluded)">${LINES[0]}→${dst}</button>`).join("");
        const motion = MOTION_MODES.map(([m, t]) => `<button type="button" class="body-motionbtn" role="radio" aria-checked="false" data-motion="${m}">${t}</button>`).join("");
        const bands = Array.from({ length: 8 }, () => "<i></i>").join("");
        const strips = line => lineSet("body-strip1", line,
            LAYOUT.strip1.map(([head, seg, dial]) => group(head, ctl(line, seg, { meters: true })) + ctl(line, dial)).join(""));
        const mini = line => lineSet("body-strip2", line,
            LAYOUT.strip2.map(([head, keys]) => group(head.toUpperCase(), `<div class="body-grouprow">${keys.map(k => ctl(line, k)).join("")}</div>`)).join(""));
        return `<section class="body-panel" data-process="active" data-motion="calm" data-lamp="idle" data-dragging="false" aria-label="${TITLE} stereo effect">
<header class="body-header"><div class="body-ident"><h1 class="body-title">${TITLE}</h1><div class="body-maker">${BRAND}</div></div>
<div class="body-tabs" role="tablist" aria-label="Line">${LINES.map(tab).join("")}</div><div class="body-copy">${copies}</div>
<div class="body-state" data-state="idle">NO INPUT</div>
<div class="body-utilities body-globals globals" data-dock="header">${glob("Bypass", { caption: "Bypass" })}<div class="body-motion" role="radiogroup" aria-label="Motion"><span class="body-motion-label">MOTION</span><span class="body-motionseg">${motion}</span></div></div></header>
<section class="body-field" aria-label="Sounding body"><svg class="body-object" role="img" viewBox="0 0 ${FIELD_W} ${FIELD_H}" aria-label="illustration at rest"><title>One instrument outline morphs continuously. Tune runs from low to high; higher pitch reduces its dimensions; measured input and resonance energy gently move the geometry. Illustration, not a physical measurement.</title>${Array.from({ length: 10 }, (_, i) => `<path data-contour="${i}"/>`).join("")}</svg>
<div class="body-scope" aria-hidden="true"><div class="body-meter" data-meter="in"><span class="body-meter-l">IN</span><span class="body-meter-bar"><i></i></span></div><div class="body-meter" data-meter="wet"><span class="body-meter-l">WET</span><span class="body-meter-bar"><i></i></span></div><div class="body-onset"><span class="body-meter-l">ONSET</span><span class="body-onset-lamp"></span></div></div>
<div class="body-bands" aria-hidden="true" title="Wet energy in 8 log bands, 60 Hz to 7.7 kHz">${bands}</div>
<div class="body-caption" aria-hidden="true"></div><div class="body-follow" aria-hidden="true"></div></section>
${LINES.map(line => lineSet("body-morphrow", line, `<span class="body-morph-heading" aria-hidden="true">MORPH</span>${ctl(line, "Morph")}${ctl(line, "Hold", { caption: "Hold", cls: "body-hold", title: HOLD_TIP })}`)).join("")}
<div class="body-deck">${LINES.map(line => lineSet("body-deckline", line, LAYOUT.deckMain.map(k => ctl(line, k)).join("") + LAYOUT.deckSmall.map(k => ctl(line, k)).join(""))).join("")}<div class="body-deckdiv" aria-hidden="true"></div><div class="body-deckglobal body-globals globals" data-dock="deck">${glob("Mix")}${glob("Width")}${glob("LowCut")}</div></div>
${LINES.map(strips).join("")}
${LINES.map(mini).join("")}</section>`;
    },

    listen(node, type, fn, options) {
        node.addEventListener(type, fn, options);
        this.listeners.push([node, type, fn, options]);
    },

    // Build the DOM once, create one Control per [data-param], wire the view-level actions.
    buildPanel() {
        try { const m = localStorage.getItem(STORE_MOTION); if (MOTION_MODES.some(([k]) => k === m)) this.motionPref = m; } catch { /* storage may be blocked: default stays */ }
        this.motionPref ??= typeof this.motion === "string" ? this.motion : "calm";
        this.innerHTML = `<style>${RAW_CSS}\n${STYLE}</style>${this.panelHtml()}`;
        this.panel = this.querySelector(".body-panel");
        this.stateEl = this.querySelector(".body-state");
        this.sets = Object.fromEntries(LINES.map(l => [l, [...this.querySelectorAll(`[data-lineset="${l}"]`)]]));
        this.tabs = Object.fromEntries(LINES.map(l => [l, this.querySelector(`.body-tab[data-tab="${l}"]`)]));
        for (const node of this.querySelectorAll(".control[data-param]")) {
            const control = new Control(this, node);
            this.controls.set(control.spec.id, control);
        }
        for (const l of LINES) this.listen(this.tabs[l].querySelector(".body-tabname"), "click", () => this.setActiveLine(l));
        for (const node of this.querySelectorAll("[data-copy]")) this.listen(node, "click", () => this.copyLine(LINES[0], node.dataset.copy));
        for (const node of this.querySelectorAll(".body-motionbtn")) this.listen(node, "click", () => this.setMotion(node.dataset.motion));
        this.listen(this, "keydown", event => {
            if (event.ctrlKey || event.metaKey || event.altKey || event.target.closest?.("input")) return;
            const i = event.key.length === 1 ? "123".indexOf(event.key) : -1;
            if (i >= 0) this.setActiveLine(LINES[i]);
        });
        this.motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
        this.motionQuery?.addEventListener?.("change", this._onMotionQuery);
    },

    // ---- value access shared by controls, field and telemetry ---------------------------
    valueOf(id) { return this.values[id] ?? SPEC.get(id).init; },
    weightsOf(line) {
        const v = this.valueOf(LINE_IDS[line].Morph), c = this.weightCache[line];
        if (c && c.v === v) return c;
        const w = morphWeights(v);
        return (this.weightCache[line] = { v, w, pitched: w[0] + w[1] < .000001, map: null });
    },
    isPitched(line) { return this.weightsOf(line).pitched; },
    decayMap(line) {
        const c = this.weightsOf(line);
        return c.map ??= decayMapping(c.w);
    },

    // ---- host traffic ----------------------------------------------------------------------
    send(id, value) {
        this.sent.push({ id, value, t: performance.now() });
        if (this.sent.length > 32) this.sent.shift();
        this.pc.sendEventOrValue(id, value);
    },
    isEcho(id, value) {   // echo guard (03_UI_WEBCOMPONENT): our own recent send coming back must not repaint a control mid-drag
        const now = performance.now();
        for (let i = 0; i < this.sent.length; i++) {
            const s = this.sent[i];
            if (now - s.t > 750) { this.sent.splice(i--, 1); continue; }
            if (s.id === id && Math.abs(s.value - value) < 1e-4 * Math.max(1, Math.abs(value))) { this.sent.splice(i, 1); return true; }
        }
        return false;
    },
    onParam({ endpointID, value }) {
        const control = this.controls.get(endpointID);
        if (!control) return;
        const n = unpack(value)[0];
        if (!Number.isFinite(n) || this.isEcho(endpointID, n)) return;
        if (this.editorParam === endpointID) this.cancelEditor?.();
        control.setValue(n, false);
    },

    // ---- hooks for the field and its motion controller ------------------------------------------
    // Controls call setDragging(true) when a dial or the morph groove is grabbed and setDragging(false) when it is let go; the first
    // drag pauses and the last one resumes the motion controller (21 §3: tilt target and drift are held during control drags).
    setDragging(flag) {
        const was = (this.dragDepth || 0) > 0;
        this.dragDepth = Math.max(0, (this.dragDepth || 0) + (flag ? 1 : -1));
        const now = this.dragDepth > 0;
        if (this.panel) this.panel.dataset.dragging = String(now);
        if (now !== was) this.motion?.pause?.(now);
    },
    // Ghost-click callback of the field: 0..2 or "A".."C".
    selectLine(i) {
        const line = typeof i === "number" ? LINES[i] : String(i).toUpperCase();
        if (LINES.includes(line) && line !== this.activeLine) this.setActiveLine(line);
    },

    // ---- reactions ----------------------------------------------------------------------------
    controlChanged(control) {
        if (!this._ready) return;
        const { line, key } = control.spec;
        if (line === "G") {
            if (key === "Mix" || key === "Bypass") { this.refreshProcessing(); this.touchField(); }
            return;
        }
        if (key === "Enable") this.refreshTabs();
        else if (key === "Morph") this.refreshMorph(line);
        else if (line === this.activeLine && key === "Tune") this.touchField();
        else if (line === this.activeLine && (key === "Follow" || key === "Hold")) { this.refreshFollow(); this.readoutsDirty = true; this.kick(); }
    },
    // Only the active line's Tune / Decay / caption follow a morph move (F7); hidden sets refresh on a tab switch.
    refreshMorph(line) {
        const pitched = this.isPitched(line);
        const changed = pitched !== this.pitchedSeen[line];
        this.pitchedSeen[line] = pitched;
        if (line !== this.activeLine) return;
        const ids = LINE_IDS[line];
        if (changed) this.controls.get(ids.Tune)?.stopDrag();
        this.controls.get(ids.Tune)?.refresh();
        this.controls.get(ids.Decay)?.refresh();
        this.refreshCaption();
        this.readoutsDirty = true;   // weight bars follow the morph target while no telemetry is flowing
        this.touchField();
    },
    refreshProcessing() {
        if (!this.panel) return;
        this.panel.dataset.process = this.valueOf(GID.Bypass) >= .5 ? "bypass" : this.valueOf(GID.Mix) === 0 ? "dry" : "active";
        this.stateDirty = true;
        this.kick();
    },
    refreshTabs() {
        for (const l of LINES) {
            const tab = this.tabs[l], on = this.valueOf(LINE_IDS[l].Enable) >= .5;
            tab.dataset.active = String(l === this.activeLine);
            tab.dataset.on = String(on);
            tab.querySelector(".body-tabname").setAttribute("aria-selected", String(l === this.activeLine));
        }
    },
    refreshAll() {   // after the first host values: derived readouts of the active line (Tune note/%, Decay seconds, caption)
        this.refreshProcessing();
        this.refreshTabs();
        for (const l of LINES) this.pitchedSeen[l] = this.isPitched(l);
        this.refreshMorph(this.activeLine);
        this.refreshFollow();
        this.refreshMotion();
    },
    setActiveLine(line) {
        if (!LINES.includes(line)) return;
        this.cancelEditor?.();
        for (const control of this.controls.values()) if (control.dragging) control.stopDrag();
        this.activeLine = line;
        for (const l of LINES) for (const node of this.sets[l]) node.hidden = l !== line;
        const ids = LINE_IDS[line];
        this.controls.get(ids.Tune).refresh();
        this.controls.get(ids.Decay).refresh();
        this.refreshTabs();
        this.refreshCaption();
        this.refreshFollow();
        this.visualMorph = this.valueOf(ids.Morph);
        this.readoutsDirty = true;
        this.modesDirty = true;   // the field gets the new active line's mode energies on the next readout frame
        this.touchField();
    },
    // UI-only: writes the source line's values into the target line through ordinary parameter events,
    // one gesture per parameter; Enable and Hold stay as they are.
    copyLine(src, dst) {
        if (src === dst) return;
        const s = LINE_IDS[src], d = LINE_IDS[dst];
        for (const key of Object.keys(s)) {
            if (key === "Enable" || key === "Hold") continue;
            this.controls.get(d[key])?.commit(this.valueOf(s[key]), true);
        }
    },

    // ---- motion switch (UI-only). The setting lives in motionPref so that `this.motion` can be the field's motion controller. ----
    motionMode() { return this.motionQuery?.matches ? "off" : (this.motionPref ?? "calm"); },
    setMotion(mode) {
        if (!MOTION_MODES.some(([k]) => k === mode)) return;
        this.motionPref = mode;
        if (typeof this.motion === "string") this.motion = mode;   // old consumers that still read the string
        this.motion?.setState?.(mode);                              // the field's MotionController (60_motion.js) when it is attached
        try { localStorage.setItem(STORE_MOTION, mode); } catch { /* UI-only convenience; fine without storage */ }
        this.refreshMotion();
    },
    refreshMotion() {
        if (!this.panel) return;
        const mode = this.motionMode();
        this.panel.dataset.motion = mode;
        for (const node of this.querySelectorAll(".body-motionbtn")) node.setAttribute("aria-checked", String(node.dataset.motion === mode));
        this.touchField();
    }
};
