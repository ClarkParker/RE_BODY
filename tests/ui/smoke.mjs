// RE·BODY UI smoke test: plugin/index.js in headless Chromium against a mock patchConnection (tests/ui/page.html).
// Merges the P1 functional test, the P6 panel test (dial v2, morph hero, telemetry v2), the P6 field / motion test and the
// P6 integration checks (chain thread, MORE / LESS, Copy undo, keys 1 / 2 / 3, resize suspension, scaling).
//   node tests/ui/smoke.mjs [--shots] [--long]        (see tests/ui/README.md)
// --shots writes docs/dev/screens/p6_final_960.png and p6_final_480.png; --long adds the 25 s Full-motion drift test.
// Environment: PLAYWRIGHT (path of playwright/index.mjs), CHROMIUM (browser executable).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const PLAYWRIGHT = process.env.PLAYWRIGHT || '/opt/node-tools/node_modules/playwright/index.mjs';
const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium';
const { chromium } = await import(pathToFileURL(PLAYWRIGHT).href);
const args = process.argv.slice(2);
const LONG = args.includes('--long'), SHOTS = args.includes('--shots');

const files = {
  '/page.html': [path.join(HERE, 'page.html'), 'text/html; charset=utf-8'],
  '/index.js': [path.join(ROOT, 'plugin/index.js'), 'text/javascript; charset=utf-8'],
  '/spec.json': [path.join(ROOT, 'plugin/spec.json'), 'application/json; charset=utf-8'],
};
const server = http.createServer((req, res) => {
  const f = files[req.url.split('?')[0]];
  if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  if (!f) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': f[1], 'cache-control': 'no-store' }); res.end(fs.readFileSync(f[0]));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

const bodies = JSON.parse(fs.readFileSync(path.join(ROOT, 'plugin/bodies.json'), 'utf8'));
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'plugin/spec.json'), 'utf8'));
const source = fs.readFileSync(path.join(ROOT, 'plugin/index.js'), 'utf8');
const ZT = bodies.zTable;
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  [' + info + ']' : ''}`); };
const browser = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox'] });
const errors = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const NAMES = ['back', 'ghostFar', 'ghostNear', 'hit', 'floor', 'rear', 'opening', 'outline', 'detail', 'specular', 'air'];
const STATIC_Z = { back: -900, ghostFar: -750, ghostNear: -600, hit: -590, floor: -450, specular: 260, air: 320 };

// One page per section. opts: w, h, dpr, reduced (prefers-reduced-motion), motion (stored Motion preference), overrides (host values by id).
// window.__raf counts requestAnimationFrame calls from the first script on.
async function fopen(opts = {}) {
  const { w = 960, h = 600, dpr = 1, reduced = false, motion, overrides } = opts;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${w}x${h} console.${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`${w}x${h} pageerror: ${e.message}`));
  await page.addInitScript(({ motion, overrides }) => {
    if (motion) try { localStorage.setItem('rebody.motion', motion); } catch { /* ignore */ }
    window.__hostOverrides = overrides || undefined;
    const raw = window.requestAnimationFrame.bind(window);
    window.__raf = { n: 0, last: 0 };
    window.requestAnimationFrame = cb => { window.__raf.n++; window.__raf.last = performance.now(); return raw(cb); };
    // window / document level listeners and ResizeObserver construction, for the sandbox-rule checks
    window.__lis = [];
    for (const [name, target] of [['window', window], ['document', document]]) {
      const add = target.addEventListener.bind(target), rem = target.removeEventListener.bind(target);
      target.addEventListener = (type, fn, o) => { window.__lis.push(['add', name, type]); return add(type, fn, o); };
      target.removeEventListener = (type, fn, o) => { window.__lis.push(['remove', name, type]); return rem(type, fn, o); };
    }
    window.__ro = 0;
    if (window.ResizeObserver) { const RO = window.ResizeObserver; window.ResizeObserver = class extends RO { constructor(...a) { window.__ro++; super(...a); } }; }
  }, { motion, overrides });
  await page.goto(`http://127.0.0.1:${port}/page.html`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 10000 });
  await page.waitForTimeout(450);   // first-frame timers
  return { ctx, page };
}
const open = (width, height, overrides) => fopen({ w: width, h: height, overrides });

// in-page helpers
const layerInfo = page => page.evaluate(() => [...document.querySelectorAll('.field .scene > .layer')].map(el => {
  const m = new DOMMatrix(getComputedStyle(el).transform);
  return { name: el.dataset.layer, tag: el.tagName, z: m.m43, s: m.m11, s2: m.m22, inline: el.style.transform };
}));
const sceneAngles = page => page.evaluate(() => {
  const t = document.querySelector('.field .scene').style.transform;
  const y = /rotateY\(([-\d.]+)deg\)/.exec(t), x = /rotateX\(([-\d.]+)deg\)/.exec(t);
  return { yaw: y ? +y[1] : NaN, pitch: x ? +x[1] : NaN, t };
});
const ds = page => page.evaluate(() => { const o = {}; for (const el of document.querySelectorAll('.field .layer')) o[el.dataset.layer] = [...el.querySelectorAll('path[d]')].map(p => p.getAttribute('d')); return o; });
const feed = (page, ms, opts = {}) => page.evaluate(({ ms, opts }) => new Promise(res => {
  const t0 = performance.now(); let k = 0;
  const id = setInterval(() => {
    const t = (performance.now() - t0) / 1000, a = opts.level ?? 1;
    window.mock.emit('bodyViz', [0.25 * a, 0.3 * a, 0.2 * a, 0.2 * a]);
    window.mock.emit('bodyBands', [0.6, 0.5, 0.4, 0.3 + .2 * Math.sin(t * 5), 0.2, 0.15, 0.1 + .1 * Math.sin(t * 9), 0.05].map(x => x * a));
    window.mock.emit('bodyOnset', (k++ % 20 === 0) ? 0.9 : 0);
    window.mock.emit('lineModesA', Array.from({ length: 16 }, (_, i) => (i % 3 === 0 ? 0.5 : 0.05) * a * (1 + Math.sin(t * 4 + i) * .3)));
    window.mock.emit('lineStateA', [0.2 * a, 0, 0.2 * a, 0, 0]);
    window.mock.emit('lineStateB', [0.15 * a, 0, 0.1 * a, 0, 0]);
  }, 33);
  setTimeout(() => { clearInterval(id); window.mock.emit('bodyViz', [0, 0, 0, 0]); window.mock.emit('bodyBands', Array(8).fill(0)); window.mock.emit('bodyOnset', 0); window.mock.emit('lineModesA', Array(16).fill(0)); window.mock.emit('lineStateA', [0, 0, 0, 0, 0]); window.mock.emit('lineStateB', [0, 0, 0, 0, 0]); res(); }, ms);
}), { ms, opts });
const rafN = page => page.evaluate(() => window.__raf.n);
const hostSet = (page, id, v) => page.evaluate(([id, v]) => window.mock.host(id, v), [id, v]);
const waitMorph = (page, target) => page.waitForFunction(t => { const v = document.querySelector('re-body-view'); return Math.abs(v.visualMorph - t) < 1e-4; }, target, { timeout: 4000 });
const finite = s => !/NaN|Infinity|undefined/.test(s);
// a 1 px translateY as the computed matrix, tolerant of the last transition step (0.999999)
const ty1 = t => { const m = /^matrix\(1, 0, 0, 1, 0, ([\d.e-]+)\)$/.exec(t); return !!m && Math.abs(Number(m[1]) - 1) < .01; };
// Spy on the real MotionController: record the calls and still forward them.
const spyHooks = page => page.evaluate(() => {
  const m = window.view.motion, calls = window.__calls = { pause: [], setState: [], notifyAudio: [], suspend: [] };
  for (const name of Object.keys(calls)) { const orig = m[name].bind(m); m[name] = (...a) => { calls[name].push(a); return orig(...a); }; }
});

// ================================================================ P1 functional checks @ 960 x 600
// ---------------------------------------------------------------- 960 x 600
{
  const { ctx, page } = await open(960, 600, { param1: 40, param4: 9.5, param25: 1 });
  const info = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('[data-param]')];
    const ids = nodes.map(n => n.dataset.param);
    const want = Array.from({ length: 73 }, (_, i) => 'param' + (i + 1));
    const missing = want.filter(id => !ids.includes(id));
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    const noMeta = nodes.filter(n => !['min', 'max', 'step', 'init'].every(k => n.dataset[k] !== undefined)).map(n => n.dataset.param);
    const ctl = nodes.filter(n => !n.classList.contains('control')).map(n => n.dataset.param);
    const nested = nodes.filter(n => n.querySelector('[data-param]')).length;
    const dashes = [...document.querySelectorAll('re-body-view .body-value, re-body-view .body-state')].filter(n => n.textContent.trim() === '' || n.textContent.includes('--')).length;
    const vis = id => { const r = document.querySelector(`[data-param="${id}"]`).getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const hiddenSets = ['A', 'B', 'C'].map(l => [...document.querySelectorAll(`[data-lineset="${l}"]`)].map(n => n.hidden));
    const enableVisible = ['param8', 'param31', 'param54'].map(vis);
    const globalsVisible = ['param3', 'param5', 'param6', 'param7'].map(vis);
    const aVisible = ['param1', 'param2', 'param4', 'param25', 'param9', 'param10', 'param12', 'param13', 'param14', 'param15', 'param27'].map(vis);
    const bInvisible = ['param28', 'param33', 'param49'].map(vis);
    const hostUsed = { tune: document.querySelector('[data-param=param1] .body-value').textContent, morphNow: document.querySelector('[data-param=param4] .body-morph-slider').getAttribute('aria-valuenow'), hold: document.querySelector('[data-param=param25] button').getAttribute('aria-checked'), caption: document.querySelector('.body-caption').textContent, follow: document.querySelector('.body-follow').textContent };
    const panel = document.querySelector('.body-panel');
    const rect = panel.getBoundingClientRect();
    const brand = document.querySelector('.body-maker'), title = document.querySelector('.body-title');
    const br = brand.getBoundingClientRect(), tr = title.getBoundingClientRect();
    const hostEl = document.querySelector('re-body-view');
    return { count: nodes.length, missing, dup, noMeta, ctl, nested, dashes, hiddenSets, enableVisible, globalsVisible, aVisible, bInvisible, hostUsed, zoom: panel.style.zoom, rect: [rect.width, rect.height], brandUnderTitle: br.top >= tr.bottom - 1 && Math.abs(br.left - tr.left) < 1.5, brandText: brand.textContent, hostW: hostEl.getBoundingClientRect().width, hasPc: !!hostEl.pc && hostEl.pc === hostEl.patchConnection, patchRoot: hostEl.classList.contains('patch-root'), scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight, tag: hostEl.tagName };
  });
  check('73 [data-param] controls, each exactly once', info.count === 73 && !info.missing.length && !info.dup.length, `count=${info.count} missing=${info.missing} dup=${info.dup}`);
  check('every control has data-min/max/step/init, is a .control wrapper, none nested', !info.noMeta.length && !info.ctl.length && info.nested === 0, `${info.noMeta} ${info.ctl} nested=${info.nested}`);
  check('no empty / "--" value texts after mount', info.dashes === 0, `bad=${info.dashes}`);
  check('line sets: A shown, B and C hidden', info.hiddenSets[0].every(h => !h) && info.hiddenSets[1].every(h => h) && info.hiddenSets[2].every(h => h), JSON.stringify(info.hiddenSets.map(a => a.length)));
  check('Enable x3 and globals visible, A set visible, B set not rendered', info.enableVisible.every(Boolean) && info.globalsVisible.every(Boolean) && info.aVisible.every(Boolean) && info.bInvisible.every(v => !v), '');
  check('host values painted (Tune 40% -> note, Morph 9.5, Hold on, caption)', info.hostUsed.morphNow === '9.5' && info.hostUsed.hold === 'true' && /SAX .*OBOSAXOLELE/.test(info.hostUsed.caption) && /^[A-G][♯]?\d$/.test(info.hostUsed.tune), JSON.stringify(info.hostUsed));
  check('chassis 960x600 at zoom 1, window not scrolled', info.zoom === '1' && info.rect[0] === 960 && info.rect[1] === 600 && info.scrollW <= 960 && info.scrollH <= 600, `zoom=${info.zoom} rect=${info.rect} scroll=${info.scrollW}x${info.scrollH}`);
  check('brand directly under title, left aligned, exact string', info.brandUnderTitle && info.brandText === 'CLΞΛRPΞΛK', info.brandText);
  check('factory sets pc + patchConnection; host has patch-root class', info.hasPc && info.patchRoot && info.tag === 'RE-BODY-VIEW', '');

  // requestParameterValue after addAllParameterListener, for every param
  const order = await page.evaluate(() => ({ requested: window.mock.requested.length, uniq: new Set(window.mock.requested).size }));
  check('requestParameterValue called once for each of the 73 params', order.requested === 73 && order.uniq === 73, JSON.stringify(order));

  // Tab switching
  await page.click('.body-tabname[aria-selected="false"] >> nth=0');   // tab B
  await page.waitForTimeout(60);
  let tabs = await page.evaluate(() => ({
    A: [...document.querySelectorAll('[data-lineset="A"]')].every(n => n.hidden),
    B: [...document.querySelectorAll('[data-lineset="B"]')].every(n => !n.hidden),
    C: [...document.querySelectorAll('[data-lineset="C"]')].every(n => n.hidden),
    sel: [...document.querySelectorAll('.body-tabname')].map(n => n.getAttribute('aria-selected')),
    vis: ['param28', 'param33', 'param49'].every(id => document.querySelector(`[data-param="${id}"]`).getBoundingClientRect().width > 0),
    aGone: document.querySelector('[data-param="param1"]').getBoundingClientRect().width === 0,
    enableStill: ['param8', 'param31', 'param54'].every(id => document.querySelector(`[data-param="${id}"]`).getBoundingClientRect().width > 0),
    caption: document.querySelector('.body-caption').textContent
  }));
  check('tab B: B set unhidden, A and C hidden, Enable buttons stay', tabs.A && tabs.B && tabs.C && tabs.vis && tabs.aGone && tabs.enableStill && tabs.sel.join() === 'false,true,false', JSON.stringify(tabs));
  check('caption follows the active line (B morph 0 = BASS DRUM)', tabs.caption === 'BASS DRUM', tabs.caption);
  await page.keyboard.press('Control+a');   // modifier keys must not switch
  await page.focus('.body-tabname >> nth=0'); await page.keyboard.press('3'); await page.waitForTimeout(40);
  tabs = await page.evaluate(() => ({ C: [...document.querySelectorAll('[data-lineset="C"]')].every(n => !n.hidden), B: [...document.querySelectorAll('[data-lineset="B"]')].every(n => n.hidden), caption: document.querySelector('.body-caption').textContent }));
  check('key 3 on the host element activates line C (morph 3 = PIANO)', tabs.C && tabs.B && tabs.caption === 'PIANO', JSON.stringify(tabs));
  await page.keyboard.press('1'); await page.waitForTimeout(40);

  // Dial drag with the mouse sends values with gestures
  await page.evaluate(() => { window.mock.sent.length = 0; window.mock.gestures.length = 0; });
  const box = await page.locator('[data-param="param14"] .body-dial').boundingBox();   // Material A (dial, 70 px)
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy - 22); await page.mouse.down(); await page.mouse.move(cx, cy - 52, { steps: 6 }); await page.mouse.up();
  const drag = await page.evaluate(() => ({ sent: window.mock.sent.filter(s => s.id === 'param14'), gest: window.mock.gestures.filter(g => g[1] === 'param14').map(g => g[0]), text: document.querySelector('[data-param="param14"] .body-value').textContent, valuenow: document.querySelector('[data-param="param14"] .body-dial').getAttribute('aria-valuenow') }));
  check('dragging Material up sends increasing values inside one gesture', drag.sent.length > 1 && drag.sent.at(-1).v > 50 && drag.sent.every((s, i, a) => !i || s.v >= a[i - 1].v) && drag.gest.join() === 'start,end', JSON.stringify({ n: drag.sent.length, last: drag.sent.at(-1), gest: drag.gest, text: drag.text }));
  check('value label and ARIA follow the drag', drag.text === `${Number(drag.valuenow)}%`, `${drag.text} / ${drag.valuenow}`);

  // Echo guard: our own value coming back must not be re-applied; a different host value must be
  await page.evaluate(() => { window.__before = document.querySelector('[data-param="param14"] .body-value').textContent; });
  const echo = await page.evaluate(() => { const last = window.mock.sent.filter(s => s.id === 'param14').at(-1).v; window.mock.host('param14', last); const same = document.querySelector('[data-param="param14"] .body-value').textContent === window.__before; window.mock.host('param14', 10); const moved = document.querySelector('[data-param="param14"] .body-value').textContent; return { same, moved, resent: window.mock.sent.filter(s => s.id === 'param14').length }; });
  check('host update repaints without echoing back (no send on setValue(v,false))', echo.moved === '10%' && echo.resent === drag.sent.length, JSON.stringify(echo));

  // Keyboard, dblclick reset, wheel (focus-gated)
  await page.evaluate(() => window.mock.sent.length = 0);
  await page.focus('[data-param="param14"] .body-dial'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Shift+ArrowDown'); await page.keyboard.press('Home'); await page.keyboard.press('End');
  const keys = await page.evaluate(() => window.mock.sent.filter(s => s.id === 'param14').map(s => s.v));
  check('keyboard: ArrowUp +1%, Shift+Down -0.1%, Home min, End max', keys.length === 4 && Math.abs(keys[0] - 11) < 1e-6 && Math.abs(keys[1] - 10.9) < 1e-6 && keys[2] === 0 && keys[3] === 100, JSON.stringify(keys));
  await page.evaluate(() => window.mock.sent.length = 0);
  await page.locator('[data-param="param14"] .body-dial').dblclick({ position: { x: 6, y: 35 } });
  const dbl = await page.evaluate(() => window.mock.sent.filter(s => s.id === 'param14').map(s => s.v));
  check('double-click resets to data-init (50)', dbl.at(-1) === 50, JSON.stringify(dbl));

  // Shift = fine drag (about 1/5 of a normal drag), wheel only when focused
  await page.evaluate(() => window.mock.sent.length = 0);
  const sbox = await page.locator('[data-param="param14"] .body-dial').boundingBox();
  await page.keyboard.down('Shift');
  await page.mouse.move(sbox.x + sbox.width / 2, sbox.y + sbox.height / 2 - 20); await page.mouse.down(); await page.mouse.move(sbox.x + sbox.width / 2, sbox.y + sbox.height / 2 - 50, { steps: 6 }); await page.mouse.up();
  await page.keyboard.up('Shift');
  const fine = await page.evaluate(() => window.mock.sent.filter(s => s.id === 'param14').map(s => s.v));
  check('Shift-drag is fine (30 px moves ~2.5%, a plain drag moves 12.5%)', fine.length > 0 && fine.at(-1) - 50 > 1.5 && fine.at(-1) - 50 < 3.5, JSON.stringify(fine));
  await page.evaluate(() => { window.mock.sent.length = 0; document.activeElement?.blur?.(); });
  await page.mouse.move(sbox.x + sbox.width / 2, sbox.y + sbox.height / 2); await page.mouse.wheel(0, -100);
  const wheelUnfocused = await page.evaluate(() => window.mock.sent.length);
  await page.focus('[data-param="param14"] .body-dial'); await page.mouse.wheel(0, -100);
  const wheelFocused = await page.evaluate(() => window.mock.sent.filter(s => s.id === 'param14').map(s => s.v));
  check('wheel is ignored until the dial has focus, then steps 1%', wheelUnfocused === 0 && wheelFocused.length === 1 && Math.abs(wheelFocused[0] - (fine.at(-1) + 1)) < 1e-6, JSON.stringify({ wheelUnfocused, wheelFocused, base: fine.at(-1) }));
  await page.locator('[data-param="param14"] .body-dial').dblclick({ position: { x: 6, y: 35 } });

  // Value editor: note names for Tune of a pitched body, seconds for Decay, Hz for Low Cut
  await page.evaluate(() => window.mock.sent.length = 0);
  await page.click('[data-param="param1"] .body-value');
  await page.fill('.body-editor', 'C3'); await page.keyboard.press('Enter');
  const tuneSent = await page.evaluate(() => ({ s: window.mock.sent.filter(s => s.id === 'param1').map(s => s.v), t: document.querySelector('[data-param="param1"] .body-value').textContent }));
  check('Tune editor accepts note names (C3 -> 33.3 -> C3)', tuneSent.s.at(-1) === 33.3 && tuneSent.t === 'C3', JSON.stringify(tuneSent));
  await page.click('[data-param="param2"] .body-value');
  const ed = await page.inputValue('.body-editor'); await page.fill('.body-editor', '1.0 s'); await page.keyboard.press('Enter');
  const dec = await page.evaluate(() => ({ s: window.mock.sent.filter(s => s.id === 'param2').map(s => s.v), t: document.querySelector('[data-param="param2"] .body-value').textContent }));
  check('Decay editor works in seconds (1.0 s -> ~1.00 s)', dec.s.length === 1 && /^1\.0\d s$/.test(dec.t) && /^\d+\.\d\d$/.test(ed), JSON.stringify({ ed, dec }));
  await page.click('[data-param="param7"] .body-value'); await page.fill('.body-editor', '120 Hz'); await page.keyboard.press('Enter');
  const lc = await page.evaluate(() => window.mock.sent.filter(s => s.id === 'param7').map(s => s.v));
  check('Low Cut editor strips Hz and respects the 20..500 range', lc.at(-1) === 120, JSON.stringify(lc));
  await page.click('[data-param="param7"] .body-value'); await page.fill('.body-editor', '9999'); await page.keyboard.press('Enter');
  const lc2 = await page.evaluate(() => window.mock.sent.filter(s => s.id === 'param7').map(s => s.v));
  check('Low Cut editor clamps to max 500', lc2.at(-1) === 500, JSON.stringify(lc2));

  await page.click('.body-tabname >> nth=1');
  await page.evaluate(() => window.mock.sent.length = 0);
  const bTune = await page.evaluate(() => document.querySelector('[data-param="param28"] .body-value').textContent);
  await page.click('[data-param="param28"] .body-value'); await page.fill('.body-editor', '42'); await page.keyboard.press('Enter');
  const bTune2 = await page.evaluate(() => ({ s: window.mock.sent.map(s => `${s.id}=${s.v}`), t: document.querySelector('[data-param="param28"] .body-value').textContent, listid: document.querySelector('datalist') }));
  check('Tune on a drum (line B = bass drum) shows % and its editor takes a percent', bTune === '58%' && bTune2.s.join() === 'param28=42' && bTune2.t === '42%' && !bTune2.listid, JSON.stringify({ bTune, bTune2 }));
  await page.click('.body-tabname >> nth=0');

  // Morph slider: click on anchor, drag along the groove
  await page.evaluate(() => window.mock.sent.length = 0);
  await page.click('[data-param="param4"] .body-anchor[data-anchor="2"]');
  const rail = await page.locator('[data-param="param4"] .body-morph-rail').boundingBox();
  await page.mouse.move(rail.x + rail.width * 0.55, rail.y + 1); await page.mouse.down(); await page.mouse.move(rail.x + rail.width * 0.75, rail.y + 1, { steps: 5 }); await page.mouse.up();
  const morph = await page.evaluate(() => ({ s: window.mock.sent.filter(s => s.id === 'param4').map(s => s.v), cap: document.querySelector('.body-caption').textContent, shape: document.querySelector('.field').dataset.shape }));
  check('morph: anchor click sends 2, groove drag ends near 7.5 (Clarinet/Oboe)', morph.s[0] === 2 && Math.abs(morph.s.at(-1) - 7.5) < 0.12, JSON.stringify({ first: morph.s[0], last: morph.s.at(-1), cap: morph.cap }));
  const anchors = await page.evaluate(() => [...document.querySelectorAll('[data-param="param4"] .body-anchor')].map(b => b.textContent).join(' '));
  check('11 abbreviated anchors in the row', anchors === 'BASS SNARE TIMP PIANO GUITAR UKE FIDDLE CLAR OBOE SAX OBOSAX·', anchors);

  // Copy A -> B
  await page.evaluate(() => { window.mock.sent.length = 0; window.mock.gestures.length = 0; });
  await page.click('[data-copy="B"]');
  const copy = await page.evaluate(() => ({ ids: window.mock.sent.map(s => s.id), starts: window.mock.gestures.filter(g => g[0] === 'start').length, ends: window.mock.gestures.filter(g => g[0] === 'end').length, n: window.mock.sent.length, hasEnableOrHold: window.mock.sent.some(s => ['param31', 'param48'].includes(s.id)), morphB: window.mock.sent.find(s => s.id === 'param30')?.v }));
  const bIds = Array.from({ length: 23 }, (_, i) => 'param' + (28 + i)).filter(id => id !== 'param31' && id !== 'param48');
  check('Copy A->B sends the 21 B params (no Enable/Hold), one gesture each', copy.n === 21 && bIds.every(id => copy.ids.includes(id)) && !copy.hasEnableOrHold && copy.starts === 21 && copy.ends === 21 && copy.morphB === 7.5, JSON.stringify({ n: copy.n, starts: copy.starts, morphB: copy.morphB }));

  // Enable button in the tab
  await page.evaluate(() => window.mock.sent.length = 0);
  await page.click('[data-param="param31"] button');
  const en = await page.evaluate(() => ({ s: window.mock.sent, text: document.querySelector('[data-param="param31"] button').textContent, w: document.querySelector('[data-param="param31"] button').getBoundingClientRect() }));
  check('Enable B is a >=24 px button bound to param31', en.s.length === 1 && en.s[0].id === 'param31' && en.s[0].v === 1 && en.text === 'ON' && en.w.height >= 24 && en.w.width >= 24, JSON.stringify({ s: en.s, h: en.w.height, w: en.w.width }));

  // Segmented Listen / Excite
  await page.evaluate(() => window.mock.sent.length = 0);
  await page.click('[data-param="param10"] .body-segbtn[data-v="3"]'); await page.click('[data-param="param12"] .body-segbtn[data-v="2"]');
  const seg = await page.evaluate(() => ({ s: window.mock.sent.map(s => `${s.id}=${s.v}`), listen: [...document.querySelectorAll('[data-param="param10"] .body-segbtn')].map(b => b.getAttribute('aria-checked')).join(), n: document.querySelectorAll('[data-param="param10"] .body-segbtn').length, m: document.querySelectorAll('[data-param="param12"] .body-segbtn').length, isButtons: [...document.querySelectorAll('[data-param="param10"] .body-segbtn')].every(b => b.tagName === 'BUTTON') }));
  check('Listen (7) and Excite (4) are real buttons and send enum values', seg.s.join() === 'param10=3,param12=2' && seg.n === 7 && seg.m === 4 && seg.isButtons && seg.listen === 'false,false,false,true,false,false,false', JSON.stringify(seg));

  // Telemetry
  await page.evaluate(() => {
    window.mock.host('param24', 60);   // Follow on line A
    const m = window.mock;
    window.__tele = setInterval(() => {
      m.emit('bodyViz', [0.5, 0.35, 0.4, 0.3]);
      m.emit('bodyBands', [0.05, 0.2, 0.4, 0.3, 0.2, 0.1, 0.05, 0.01]);
      m.emit('bodyOnset', [1]);
      m.emit('analysisViz', [0.6, 0.3, 0.2, 0.4, 0.1, 0.7]);
      const A = new Array(24).fill(0); A[0] = 0.4; A[1] = 1; A[2] = 0.5; A[3] = 220; A[4] = 0; A[5] = 220; A[6] = 0.8; A[8] = 7; m.emit('lineStateA', A);
      const B = new Array(24).fill(0); B[2] = 0.05; m.emit('lineStateB', B);
      m.emit('lineStateC', new Array(24).fill(0));
    }, 33);
  });
  await page.waitForTimeout(500);
  const tel = await page.evaluate(() => {
    const lv = el => Number(el.style.getPropertyValue('--lv') || 0);
    const meters = [...document.querySelectorAll('[data-meter] .body-meter-bar i')].map(lv);
    const bands = [...document.querySelectorAll('.body-bands i')].map(lv);
    const lamps = ['A', 'B', 'C'].map(l => Number(document.querySelector(`.body-tab[data-tab="${l}"]`).style.getPropertyValue('--lamp') || 0));
    const listen = [...document.querySelectorAll('[data-param="param10"] .body-segmeter')].map(lv);
    return { meters, bands, lamps, listen, onset: lv(document.querySelector('.body-onset-lamp')), state: document.querySelector('.body-state').textContent, follow: document.querySelector('.body-follow').textContent, d: document.querySelector('.field [data-contour="0"]').getAttribute('d').length };
  });
  check('input/wet meters painted from bodyViz', tel.meters.length === 2 && tel.meters.every(v => v > 0.3), JSON.stringify(tel.meters));
  check('8 band bars painted from bodyBands, ordered by energy', tel.bands.length === 8 && tel.bands[2] > tel.bands[0] && tel.bands[7] > 0, JSON.stringify(tel.bands));
  check('onset lamp lit by bodyOnset', tel.onset > 0.1, String(tel.onset));
  check('per-tab lamps from lineState listenEnergy (A bright, B dim, C off)', tel.lamps[0] > tel.lamps[1] && tel.lamps[1] > 0 && tel.lamps[2] === 0, JSON.stringify(tel.lamps));
  check('analysisViz hairlines under Listen buttons (All = max, Chain = A falls back to All)', tel.listen.length === 7 && tel.listen[0] > 0 && tel.listen[1] > 0 && tel.listen[6] === tel.listen[0], JSON.stringify(tel.listen));
  check('state caption ACTIVE and follow note under the caption', tel.state === 'ACTIVE' && /FOLLOW ▸ A3/.test(tel.follow), `${tel.state} | ${tel.follow}`);
  await page.waitForTimeout(100);

  // Painting cap: count --lv writes over 600 ms while 30 Hz packets arrive
  const writes = await page.evaluate(() => new Promise(resolve => {
    let n = 0; const target = document.querySelector('[data-meter] .body-meter-bar i');
    const mo = new MutationObserver(() => n++); mo.observe(target, { attributes: true, attributeFilter: ['style'] });
    const m = window.mock; let i = 0;
    const t = setInterval(() => { i++; m.emit('bodyViz', [0.2 + (i % 7) * 0.1, 0.2 + (i % 5) * 0.1, 0.3, 0.3]); }, 4);
    setTimeout(() => { clearInterval(t); mo.disconnect(); resolve(n); }, 1000);
  }));
  check('readouts painted at most 30 Hz (250 Hz packets -> <= ~33 writes/s)', writes > 5 && writes <= 36, `writes in 1 s: ${writes}`);

  // Silence: loop stops (no more field draws) and state returns to NO INPUT
  await page.evaluate(() => { clearInterval(window.__tele); });
  await page.waitForTimeout(2300);
  const idle = await page.evaluate(() => new Promise(resolve => {
    const r0 = window.__raf.n;
    const field = document.querySelector('.field [data-contour="0"]');
    let n = 0; const mo = new MutationObserver(() => n++); mo.observe(field, { attributes: true, attributeFilter: ['d'] });
    setTimeout(() => { mo.disconnect(); resolve({ draws: n, raf: window.__raf.n - r0, state: document.querySelector('.body-state').textContent, meters: [...document.querySelectorAll('[data-meter] .body-meter-bar i')].map(e => Number(e.style.getPropertyValue('--lv') || 0)) }); }, 600);
  }));
  check('idle: no field redraws and no rAF requests for 600 ms, meters 0, state NO INPUT (rAF stops)', idle.draws === 0 && idle.raf === 0 && idle.state === 'NO INPUT' && idle.meters.every(v => v === 0), JSON.stringify(idle));

  // Bypass / Mix reflect on the panel
  await page.evaluate(() => window.mock.sent.length = 0);
  await page.click('[data-param="param5"] button');
  const byp = await page.evaluate(() => ({ s: window.mock.sent, process: document.querySelector('.body-panel').dataset.process }));
  await page.waitForTimeout(80);
  const bypState = await page.evaluate(() => document.querySelector('.body-state').textContent);
  check('Bypass sends param5=1, panel data-process=bypass, caption BYPASSED', byp.s.length === 1 && byp.s[0].id === 'param5' && byp.process === 'bypass' && bypState === 'BYPASSED', JSON.stringify({ byp, bypState }));
  await page.click('[data-param="param5"] button');

  // Motion switch (UI-only)
  await page.evaluate(() => window.mock.sent.length = 0);
  await page.click('[data-motion="off"]');
  const motion = await page.evaluate(() => ({ stored: localStorage.getItem('rebody.motion'), pressed: [...document.querySelectorAll('.body-motionbtn')].map(b => b.getAttribute('aria-checked')).join(), sent: window.mock.sent.length, hasParam: !!document.querySelector('[data-motion][data-param], [data-param] [data-motion]') }));
  check('Motion switch: UI-only (no param sent, no data-param), stored in localStorage', motion.stored === 'off' && motion.pressed === 'true,false,false' && motion.sent === 0 && !motion.hasParam, JSON.stringify(motion));
  await page.click('[data-motion="calm"]');

  await page.evaluate(() => { document.activeElement?.blur?.(); });

  // Teardown removes every listener
  const before = await page.evaluate(() => ({ all: window.mock.allListeners.size, ep: window.mock.endpointCount() }));
  await page.evaluate(() => window.view.remove());
  const after = await page.evaluate(() => ({ all: window.mock.allListeners.size, ep: window.mock.endpointCount() }));
  check('disconnectedCallback removes the all-parameter listener and all endpoint listeners', before.all === 1 && before.ep === 10 && after.all === 0 && after.ep === 0, JSON.stringify({ before, after }));
  const declared = await page.evaluate(() => window.mock.spec.outputs.map(o => o.id));
  const subscribed = before.ep;
  check('only declared output endpoints subscribed (10 of 10, lineModes included)', subscribed === 10 && declared.length === 10, `declared=${declared.length}`);
  // Re-attach rebuilds cleanly
  await page.evaluate(() => document.body.appendChild(window.view));
  await page.waitForTimeout(200);
  const again = await page.evaluate(() => ({ n: document.querySelectorAll('[data-param]').length, all: window.mock.allListeners.size }));
  check('re-attach rebuilds once (73 controls, one listener)', again.n === 73 && again.all === 1, JSON.stringify(again));
  await ctx.close();
}

// ---------------------------------------------------------------- 480 x 300 (zoom 0.5)
{
  const { ctx, page } = await open(480, 300);
  const info = await page.evaluate(() => {
    const panel = document.querySelector('.body-panel'), r = panel.getBoundingClientRect(), host = document.querySelector('re-body-view').getBoundingClientRect();
    return { zoom: panel.style.zoom, r: [Math.round(r.width), Math.round(r.height), Math.round(r.left), Math.round(r.top)], host: [Math.round(host.width), Math.round(host.height)], count: document.querySelectorAll('[data-param]').length, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight };
  });
  check('480x300 window: zoom 0.5, chassis fills 480x300, no scrollbars', info.zoom === '0.5' && info.r[0] === 480 && info.r[1] === 300 && info.host[0] === 480 && info.host[1] === 300 && info.sw <= 480 && info.sh <= 300 && info.count === 73, JSON.stringify(info));
  // drag still works under zoom
  const box = await page.locator('[data-param="param3"] .body-dial').boundingBox();
  await page.evaluate(() => window.mock.sent.length = 0);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 40, { steps: 5 }); await page.mouse.up();
  const z = await page.evaluate(() => window.mock.sent.filter(s => s.id === 'param3').map(s => s.v));
  check('dial drag works under zoom 0.5 (Mix rises)', z.length > 1 && z.at(-1) > 45, JSON.stringify(z.slice(-3)));
  // resize 480x300 -> 960x600: zoom follows after the settle
  await page.setViewportSize({ width: 960, height: 600 }); await page.waitForTimeout(500);
  const big = await page.evaluate(() => ({ zoom: document.querySelector('.body-panel').style.zoom }));
  check('window resize to 960x600 re-zooms to 1 (resize listener + settle)', big.zoom === '1', JSON.stringify(big));
  await page.setViewportSize({ width: 1920, height: 1200 }); await page.waitForTimeout(500);
  const huge = await page.evaluate(() => document.querySelector('.body-panel').style.zoom);
  check('1920x1200 clamps at zoom 2.0', huge === '2', huge);
  await page.setViewportSize({ width: 300, height: 200 }); await page.waitForTimeout(500);
  const tiny = await page.evaluate(() => document.querySelector('.body-panel').style.zoom);
  check('300x200 clamps at zoom 0.5', tiny === '0.5', tiny);
  await page.setViewportSize({ width: 480, height: 300 }); await page.waitForTimeout(500);
  await ctx.close();
}

// ================================================================ P6 panel checks (dial v2, controls, morph hero, lamps, grain, contrast, telemetry v2)
// ================================================================ P6 panel checks (dial v2, controls, morph hero, lamps, grain, contrast, telemetry v2)
{
  const { ctx, page } = await open(960, 600, { param1: 40, param4: 4, param25: 0, param24: 40 });
  await spyHooks(page);
  const $ = sel => `[data-param="${sel}"]`;
  const settle = ms => page.waitForTimeout(ms);

  // ---- dial v2 geometry in view-box units (3 CSS px at 70 px = 8.6 units) --------------------------------------
  const geo = await page.evaluate(() => {
    const out = {};
    for (const [kind, id, px, arcPx] of [['dial', 'param14', 70, 3], ['small', 'param9', 40, 2.5], ['mini', 'param16', 28, 2]]) {
      const dial = document.querySelector(`[data-param="${id}"] .body-dial`), r = dial.getBoundingClientRect();
      const arc = dial.querySelector('.body-dial-arc'), track = dial.querySelector('.body-dial-track');
      const sw = parseFloat(getComputedStyle(arc).strokeWidth), tw = parseFloat(getComputedStyle(track).strokeWidth);
      out[kind] = { w: r.width, h: r.height, sw, tw, px: sw * r.width / 200, want: arcPx, ctl: dial.closest('.control').dataset.control };
    }
    return out;
  });
  check('dial v2 sizes 70 / 40 / 28 px, arc widths in view-box units equal 3 / 2.5 / 2 CSS px (8.6 / 12.5 / 14.3)',
    geo.dial.w === 70 && geo.small.w === 40 && geo.mini.w === 28 && Math.abs(geo.dial.sw - 8.6) < .05 && Math.abs(geo.small.sw - 12.5) < .05 && Math.abs(geo.mini.sw - 14.3) < .05
    && ['dial', 'small', 'mini'].every(k => Math.abs(geo[k].px - geo[k].want) < .06 && geo[k].tw === geo[k].sw), JSON.stringify(geo));

  // ---- one light: tokens, static crescent, rim, no filters anywhere ---------------------------------------------
  const light = await page.evaluate(() => {
    const panel = document.querySelector('.body-panel'), cs = getComputedStyle(panel);
    const inner = getComputedStyle(document.querySelector('[data-param="param14"] .body-inner'));
    const bs = inner.boxShadow;
    const crescent = /inset/.test(bs) && /rgba?\(255, 255, 255/.test(bs);
    const offs = [...bs.matchAll(/rgba?\([^)]*\)\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+(-?[\d.]+)px)?\s*(inset)?|(inset)?\s*rgba?\([^)]*\)\s+(-?[\d.]+)px\s+(-?[\d.]+)px/g)].length;
    const filters = [...document.querySelectorAll('re-body-view *')].filter(n => { const c = getComputedStyle(n); return (c.filter && c.filter !== 'none') || (c.backdropFilter && c.backdropFilter !== 'none'); }).length;
    return { lx: cs.getPropertyValue('--lx').trim(), ly: cs.getPropertyValue('--ly').trim(), crescent, bs, filters, bg: cs.backgroundImage.length };
  });
  check('one light: --lx/--ly tokens on the panel, cap has a lit inset crescent + cast shadow derived from them, no CSS filter / backdrop-filter on any element',
    light.lx === '-0.6' && light.ly === '-0.8' && light.crescent && /rgba\(0, 0, 0/.test(light.bs) && light.filters === 0, JSON.stringify({ lx: light.lx, ly: light.ly, bs: light.bs, filters: light.filters }));
  const shadowOffsets = await page.evaluate(() => { const bs = getComputedStyle(document.querySelector('[data-param="param14"] .body-inner')).boxShadow; return bs; });
  const cast = /rgba\(0, 0, 0, 0\.65\)\s+(-?[\d.]+)px\s+(-?[\d.]+)px/.exec(shadowOffsets), spec = /rgba\(255, 255, 255, 0\.5\)\s+(-?[\d.]+)px\s+(-?[\d.]+)px/.exec(shadowOffsets);
  check('cast shadow falls away from the light (+x, +y), crescent inset sits on the lit side (+x, +y inset = top-left edge)',
    cast && Number(cast[1]) > 0 && Number(cast[2]) > 0 && spec && Number(spec[1]) > 0 && Number(spec[2]) > 0, shadowOffsets);

  // ---- hover rim, pressed (cap 1 px down, shadow tightens), fine ring with Shift ----------------------------------
  const box = await page.locator($('param14') + ' .body-dial').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const innerState = () => page.evaluate(() => { const i = document.querySelector('[data-param="param14"] .body-inner'), c = getComputedStyle(i), a = getComputedStyle(i, '::after'); return { border: c.borderTopColor, tf: c.transform, shadow: c.boxShadow, ring: a.opacity, dragging: document.querySelector('[data-param="param14"] .body-dial').dataset.dragging, ctl: document.querySelector('[data-param="param14"]').dataset.dragging, panel: document.querySelector('.body-panel').dataset.dragging }; });
  await page.mouse.move(5, 5); await settle(180);
  const rest = await innerState();
  await page.mouse.move(cx, cy - 24); await settle(220);
  const hover = await innerState();
  check('hover state: cap rim lifts from #303030 to #5a5a5a', rest.border === 'rgb(48, 48, 48)' && hover.border === 'rgb(90, 90, 90)', `${rest.border} -> ${hover.border}`);
  await page.evaluate(() => { window.__calls.pause.length = 0; });
  await page.mouse.down(); await page.mouse.move(cx, cy - 34, { steps: 3 }); await settle(220);
  const pressed = await innerState();
  const shadowBlur = s => Number((/rgba\(0, 0, 0, [\d.]+\)\s+-?[\d.]+px\s+-?[\d.]+px\s+([\d.]+)px/.exec(s) || [])[1]);
  check('pressed state: cap drops 1 px (translateY 1), cast shadow tightens (blur and offset smaller), rim fully lit, dragging flags on dial / control / panel',
    ty1(pressed.tf) && shadowBlur(pressed.shadow) < shadowBlur(rest.shadow) && pressed.border === 'rgb(237, 237, 237)' && pressed.dragging === 'true' && pressed.ctl === 'true' && pressed.panel === 'true', JSON.stringify({ tf: pressed.tf, blur: [shadowBlur(rest.shadow), shadowBlur(pressed.shadow)], b: pressed.border, d: [pressed.dragging, pressed.ctl, pressed.panel] }));
  const during = await page.evaluate(() => window.__calls.pause.map(a => a[0]));
  await page.mouse.up(); await settle(220);
  const released = await innerState();
  const after = await page.evaluate(() => ({ calls: window.__calls.pause.map(a => a[0]), panel: document.querySelector('.body-panel').dataset.dragging }));
  check('setDragging: first drag pauses the motion controller (motion.pause(true)), release resumes it (pause(false)); panel[data-dragging] follows',
    during.join() === 'true' && after.calls.join() === 'true,false' && after.panel === 'false' && released.tf === 'none', JSON.stringify({ during, after, tf: released.tf }));

  await page.keyboard.down('Shift'); await page.mouse.move(cx + 1, cy - 23); await settle(60);
  const fine = await innerState();
  await page.keyboard.up('Shift'); await page.mouse.move(cx, cy - 24); await settle(60);
  const fine2 = await innerState();
  check('fine mode: inner ring appears on the cap while Shift is held over the dial and goes away after release', fine.ring === '1' && fine2.ring === '0' && rest.ring === '0', `${rest.ring} / ${fine.ring} / ${fine2.ring}`);
  await page.mouse.move(5, 5);

  // keyboard fine mode (Shift on the focused dial) and the morph groove drag pauses the motion controller
  await page.focus($('param14') + ' .body-dial'); await page.keyboard.down('Shift');
  const kfine = await page.evaluate(() => document.querySelector('[data-param="param14"] .body-dial').dataset.fine);
  await page.keyboard.up('Shift');
  const kfine2 = await page.evaluate(() => document.querySelector('[data-param="param14"] .body-dial').dataset.fine);
  await page.evaluate(() => document.activeElement?.blur?.());
  check('fine mode also follows Shift on the keyboard-focused dial', kfine === 'true' && kfine2 === 'false', `${kfine} / ${kfine2}`);
  await page.evaluate(() => { window.__calls.pause.length = 0; });
  const gr = await page.locator($('param4') + ' .body-morph-rail').boundingBox();
  await page.mouse.move(gr.x + gr.width * .4, gr.y + 1); await page.mouse.down(); await settle(200);
  const slideOn = await page.evaluate(() => ({ d: document.querySelector('[data-param="param4"] .body-morph-slider').dataset.dragging, shadow: getComputedStyle(document.querySelector('[data-param="param4"] .body-morph-thumb')).boxShadow, calls: window.__calls.pause.map(a => a[0]) }));
  await page.mouse.up(); await settle(60);
  const slideOff = await page.evaluate(() => ({ d: document.querySelector('[data-param="param4"] .body-morph-slider').dataset.dragging, calls: window.__calls.pause.map(a => a[0]) }));
  await page.evaluate(() => { window.mock.host('param4', 4); });
  check('morph groove drag: thumb glow rises while pressed, setDragging pauses (true) and resumes (false) the motion controller', slideOn.d === 'true' && /15px/.test(slideOn.shadow) && slideOn.calls.join() === 'true' && slideOff.d === 'false' && slideOff.calls.join() === 'true,false', JSON.stringify({ slideOn, slideOff }));

  // ---- default tick on the arc --------------------------------------------------------------------------------------------
  const ticks = await page.evaluate(() => {
    const read = id => {
      const g = document.querySelector(`[data-param="${id}"]`), d = g.querySelector('.body-dial-default').getAttribute('d'), n = (d.match(/-?\d+\.?\d*/g) || []).map(Number);
      if (n.length < 4) return { d, angle: null };
      const mx = (n[0] + n[2]) / 2, my = (n[1] + n[3]) / 2, ang = Math.atan2(mx - 100, 100 - my) * 180 / Math.PI;   // 0 = up, clockwise
      return { d, angle: ang, len: Math.hypot(n[2] - n[0], n[3] - n[1]), sw: parseFloat(getComputedStyle(g.querySelector('.body-dial-default')).strokeWidth) };
    };
    return { mix: read('param3'), level: read('param9'), pan: read('param27'), lowcut: read('param7'), tune: read('param1') };
  });
  const want = n => -135 + 270 * n;
  check('default tick: Mix (init 45%) at 45% of the arc, Level (0 dB) near the end, Pan (bipolar) at the top, Low Cut (init = min) has none, 1 px wide',
    Math.abs(ticks.mix.angle - want(.45)) < 1.5 && Math.abs(ticks.level.angle - want(60 / 66)) < 1.5 && Math.abs(ticks.pan.angle) < 1.5 && ticks.lowcut.d === '' && Math.abs(ticks.mix.sw * 70 / 200 - 1) < .05, JSON.stringify(ticks));

  // ---- Delete / Backspace reset every control kind ---------------------------------------------------------------------
  const sentFor = id => page.evaluate(i => window.mock.sent.filter(s => s.id === i).map(s => s.v), id);
  await page.evaluate(() => window.mock.sent.length = 0);
  await page.focus($('param14') + ' .body-dial'); await page.keyboard.press('End'); await page.keyboard.press('Delete');
  await page.keyboard.press('Home'); await page.keyboard.press('Backspace');
  const matK = await sentFor('param14');
  check('dial: Delete and Backspace reset to init (50) after End / Home', matK.join() === '100,50,0,50', matK.join());
  await page.focus($('param4') + ' .body-morph-slider'); await page.keyboard.press('End'); await page.keyboard.press('Delete');
  const morphK = await sentFor('param4');
  check('morph slider: Delete resets to the line init (A = 7)', morphK.join() === '10,7', morphK.join());
  await page.click($('param10') + ' .body-segbtn[data-v="4"]'); await page.focus($('param10') + ' .body-segbtn[data-v="4"]'); await page.keyboard.press('Backspace');
  const segK = await sentFor('param10');
  check('segmented Listen: Backspace resets to init (All = 0) and moves focus there', segK.join() === '4,0' && await page.evaluate(() => document.activeElement.dataset.v) === '0', segK.join());
  await page.click($('param25') + ' button'); await page.focus($('param25') + ' button'); await page.keyboard.press('Delete');
  const holdK = await sentFor('param25');
  check('toggle Hold: Delete resets to off', holdK.join() === '1,0', holdK.join());
  await page.focus($('param16') + ' .body-dial'); await page.keyboard.press('End'); await page.keyboard.press('Delete');
  const miniK = await sentFor('param16');
  check('mini dial (Position): Delete resets to 50', miniK.join() === '100,50', miniK.join());

  // ---- touch-action, target sizes, informational contrast of tracks --------------------------------------------------------
  const touch = await page.evaluate(() => ({
    dial: getComputedStyle(document.querySelector('.body-dial')).touchAction, value: getComputedStyle(document.querySelector('.body-value')).touchAction, morph: getComputedStyle(document.querySelector('.body-morph-slider')).touchAction,
    mini: document.querySelector('[data-param="param16"] .body-dial').getBoundingClientRect().height, enable: document.querySelector('[data-param="param8"] button').getBoundingClientRect().height,
    slider: document.querySelector('.body-morph-slider').getBoundingClientRect().height, seg: document.querySelector('.body-segbtn').getBoundingClientRect().height, hold: document.querySelector('[data-param="param25"] button').getBoundingClientRect().height }));
  check('touch-action:none on dial, value button and morph slider; targets: Enable >= 24, mini >= 24, slider >= 28, segments 28', touch.dial === 'none' && touch.value === 'none' && touch.morph === 'none' && touch.enable >= 24 && touch.mini >= 24 && touch.slider >= 28 && touch.seg >= 28 && touch.hold >= 28, JSON.stringify(touch));

  // ---- contrast, numerically (WCAG 2.x relative luminance) ------------------------------------------------------------------
  const contrast = await page.evaluate(() => {
    const parse = s => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; };
    const lum = ([r, g, b]) => .2126 * f(r) + .7152 * f(g) + .0722 * f(b);
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
    const BACK = [0x18, 0x18, 0x18], CAP = [0x2a, 0x2a, 0x2a];   // lightest backdrop colour, lightest cap colour (conic + specular overlay)
    const bgOf = el => { for (let n = el; n && !n.classList?.contains('body-panel'); n = n.parentElement) { if (n.classList?.contains('body-inner')) return CAP; const c = getComputedStyle(n).backgroundColor, m = c.match(/[\d.]+/g); if (m && (m.length < 4 || Number(m[3]) >= .99)) return parse(c); } return BACK; };
    const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
    const rows = [];
    const add = (name, sel, pseudo) => { const els = [...document.querySelectorAll(sel)].filter(vis); if (!els.length) { rows.push({ name, ratio: null }); return; } let min = 99; for (const el of els) min = Math.min(min, ratio(parse(getComputedStyle(el, pseudo).color), bgOf(el))); rows.push({ name, ratio: Number(min.toFixed(2)), n: els.length }); };
    add('title', '.body-title'); add('brand', '.body-maker'); add('tab name', '.body-tabname'); add('tab name (active)', '.body-tab[data-active="true"] .body-tabname');
    add('enable', '.body-enablebtn'); add('COPY label', '.body-copy', '::before'); add('copy buttons', '.body-copybtn'); add('state', '.body-state'); add('MOTION label', '.body-motion-label');
    add('bypass', '[data-param="param5"] button'); add('motion buttons', '.body-motionbtn'); add('segments', '.body-segbtn'); add('MORPH heading', '.body-morph-heading');
    add('anchors', '.body-anchor'); add('dial labels', '.body-label .body-labtext'); add('group heads', '.body-grouphead'); add('caption', '.body-caption'); add('follow note', '.body-follow');
    add('meter labels', '.body-meter-l'); add('dial values', '.body-control-dial .body-value, .body-control-small .body-value'); add('mini value in label slot', '.body-labval', null);
    add('hold', '[data-param="param25"] button'); add('editor', '.body-editor');
    // non-text: informational tracks >= 3:1 against the lightest backdrop
    const trackColor = parse(getComputedStyle(document.querySelector('.body-dial-track')).stroke), groove = parse(getComputedStyle(document.querySelector('.body-morph-rail')).backgroundColor), tickC = parse(getComputedStyle(document.querySelector('.body-morph-tick')).backgroundColor);
    return { rows, track: Number(ratio(trackColor, BACK).toFixed(2)), groove: Number(ratio(groove, BACK).toFixed(2)), tick: Number(ratio(tickC, BACK).toFixed(2)), trackRGB: trackColor };
  });
  const textRows = contrast.rows.filter(r => r.ratio != null);
  check('text contrast >= 4.5:1 for every label / caption / value / button class on the lightest backdrop (min over all instances)', textRows.length >= 20 && textRows.every(r => r.ratio >= 4.5), textRows.map(r => `${r.name} ${r.ratio}`).join('; '));
  check('informational tracks >= 3:1: dial track, morph groove, detent ticks', contrast.track >= 3 && contrast.groove >= 3 && contrast.tick >= 3, JSON.stringify({ track: contrast.track, groove: contrast.groove, tick: contrast.tick, rgb: contrast.trackRGB }));

  // ---- typography: nothing visible below 10 px, caption 13-14 px ---------------------------------------------------------------
  const type = await page.evaluate(() => {
    const small = [], seen = new Set();
    for (const el of document.querySelectorAll('re-body-view *')) {
      if (['STYLE', 'TITLE', 'path', 'svg', 'datalist', 'option'].includes(el.tagName) || el.closest('svg')) continue;
      const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      const r = el.getBoundingClientRect();
      if (!own || !(r.width > 0)) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 10) small.push(`${el.className || el.tagName}:${fs}`);
      seen.add(el.className);
    }
    const cap = parseFloat(getComputedStyle(document.querySelector('.body-caption')).fontSize);
    return { small, cap, classes: seen.size };
  });
  check('typography: every visible text >= 10 px, caption (instrument name) 13-14 px', type.small.length === 0 && type.cap >= 13 && type.cap <= 14 && type.classes > 15, JSON.stringify(type));

  // ---- no label collisions, header fits, values fit inside their caps ---------------------------------------------------------------
  await page.evaluate(() => { window.mock.host('param9', -60); window.mock.host('param27', -100); window.mock.host('param15', -100); });
  await settle(60);
  const fit = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('.body-label')].filter(n => n.getBoundingClientRect().width > 0).map(n => { const t = n.querySelector('.body-labtext').getBoundingClientRect(); return [t.left, t.right, t.top, t.bottom, n.textContent]; });
    const clash = [];
    for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) { const a = labels[i], b = labels[j]; if (a[0] < b[1] && b[0] < a[1] && a[2] < b[3] && b[2] < a[3]) clash.push(a[4] + '|' + b[4]); }
    const hdr = document.querySelector('.body-header'), over = [...hdr.children].map(c => c.getBoundingClientRect()).sort((a, b) => a.left - b.left);
    let headerOverlap = 0; for (let i = 1; i < over.length; i++) if (over[i].left < over[i - 1].right - .5) headerOverlap++;
    const caps = [...document.querySelectorAll('.body-control-dial .body-value, .body-control-small .body-value')].filter(n => n.getBoundingClientRect().width > 0).map(n => [n.scrollWidth, n.closest('.body-inner').clientWidth, n.textContent]);
    return { labels: labels.length, clash, headerOverlap, hdrW: [hdr.scrollWidth, hdr.clientWidth], badCaps: caps.filter(c => c[0] > c[1] + 1), capsN: caps.length };
  });
  check('layout: no label overlaps another, header children do not overlap and fit, extreme values (-60 dB, -100%) fit inside the caps', fit.clash.length === 0 && fit.headerOverlap === 0 && fit.hdrW[0] <= fit.hdrW[1] && fit.badCaps.length === 0 && fit.labels >= 15, JSON.stringify(fit));
  await page.evaluate(() => { window.mock.host('param9', 0); window.mock.host('param27', 0); window.mock.host('param15', 0); });

  // ---- mini dials: value replaces the label on hover / drag / focus; typed editor with units -------------------------------------------
  const mini = await page.locator($('param16') + ' .body-dial').boundingBox();
  await page.mouse.move(5, 5); await settle(40);
  const vis = () => page.evaluate(() => { const n = document.querySelector('[data-param="param16"]'); return { text: getComputedStyle(n.querySelector('.body-labtext')).visibility, val: getComputedStyle(n.querySelector('.body-labval')).visibility, v: n.querySelector('.body-labval').textContent }; });
  await page.evaluate(() => document.activeElement?.blur?.());
  const miniRest = await vis();
  await page.mouse.move(mini.x + mini.width / 2, mini.y + mini.height / 2); await settle(40);
  const miniHover = await vis();
  await page.mouse.move(5, 5); await settle(40);
  check('mini dial: name at rest, value in the label slot on hover', miniRest.text === 'visible' && miniRest.val === 'hidden' && miniHover.text === 'hidden' && miniHover.val === 'visible' && miniHover.v === '50%', JSON.stringify({ miniRest, miniHover }));
  await page.evaluate(() => window.mock.sent.length = 0);
  await page.click($('param16') + ' .body-value'); await page.fill('.body-editor', '75'); await page.keyboard.press('Enter');
  await page.click($('param9') + ' .body-value'); await page.fill('.body-editor', '-12 dB'); await page.keyboard.press('Enter');
  await page.click($('param7') + ' .body-value'); await page.fill('.body-editor', '0.2 kHz'); await page.keyboard.press('Enter');
  const typed = await page.evaluate(() => window.mock.sent.map(s => `${s.id}=${s.v}`));
  check('typed entry on a mini dial (75), in dB (-12 dB) and kHz-to-Hz (0.2 kHz -> 200)', typed.join() === 'param16=75,param9=-12,param7=200', typed.join());
  await page.evaluate(() => { window.mock.host('param16', 50); window.mock.host('param9', 0); window.mock.host('param7', 20); });

  // ---- Timpani ceiling and note names ----------------------------------------------------------------------------------------------------
  const greyOf = () => page.evaluate(() => document.querySelector('[data-param="param1"] .body-dial-grey').getAttribute('d'));
  const g7 = await greyOf();
  await page.evaluate(() => window.mock.host('param4', 2)); await settle(60);
  const g2 = await greyOf(), tuneTxt = await page.evaluate(() => document.querySelector('[data-param="param1"] .body-value').textContent);
  await page.evaluate(() => window.mock.host('param4', 4));
  check('Timpani greys the Tune arc above C4 (only while the body is Timpani)', g7 === '' && /^M /.test(g2) && /^[A-G]/.test(tuneTxt), JSON.stringify({ g7, g2: g2.slice(0, 30), tuneTxt }));

  // ---- segmented + toggle buttons share the light model ------------------------------------------------------------------------------------
  const btn = await page.evaluate(() => { const g = sel => getComputedStyle(document.querySelector(sel)); const mk = sel => ({ sh: g(sel).boxShadow, img: g(sel).backgroundImage }); return { seg: mk('.body-segbtn[aria-checked="false"]'), byp: mk('[data-param="param5"] button'), en: mk('[data-param="param31"] button'), mo: mk('.body-motionbtn[aria-checked="false"]') }; });
  check('segmented, Bypass, Enable and Motion buttons: lit top edge + cast shadow + sheen from the same tokens', ['seg', 'byp', 'en', 'mo'].every(k => /inset/.test(btn[k].sh) && /rgba\(0, 0, 0/.test(btn[k].sh) && /linear-gradient/.test(btn[k].img)), JSON.stringify(btn.seg));
  const press = await page.evaluate(async () => { const b = document.querySelectorAll('.body-segbtn')[1]; return getComputedStyle(b).transform; });
  const sb = await page.locator('.body-segbtn >> nth=1').boundingBox();
  await page.mouse.move(sb.x + 8, sb.y + 8); await page.mouse.down(); await settle(120);
  const down = await page.evaluate(() => getComputedStyle(document.querySelectorAll('.body-segbtn')[1]).transform);
  await page.mouse.up(); await page.evaluate(() => window.mock.host('param10', 0)); await page.mouse.move(5, 5);
  check('buttons: pressed state moves the face 1 px down', press === 'none' && ty1(down), `${press} -> ${down}`);

  // ---- morph row hero ---------------------------------------------------------------------------------------------------------------------------------
  const hero = await page.evaluate(() => {
    const r = sel => document.querySelector(sel).getBoundingClientRect();
    const rail = r('[data-param="param4"] .body-morph-rail'), thumb = r('[data-param="param4"] .body-morph-thumb'), slider = r('[data-param="param4"] .body-morph-slider');
    const ticks = [...document.querySelectorAll('[data-param="param4"] .body-morph-tick')].map(t => ({ x: t.getBoundingClientRect().left + .5, h: t.getBoundingClientRect().height }));
    const br = r('[data-param="param4"] .body-morph-bracket'), anchors = [...document.querySelectorAll('[data-param="param4"] .body-anchor')].map(a => a.getBoundingClientRect());
    const cells = anchors.map(a => a.width);
    return { grooveH: rail.height, thumbW: thumb.width, thumbH: thumb.height, sliderH: slider.height, ticks: ticks.length, tickH: ticks.map(t => Number(t.h.toFixed(1))), bracketX: br.left + br.width / 2, tick10: ticks[10].x, thumbX: thumb.left + thumb.width / 2, tick4: ticks[4].x, cells: cells.length, cell: cells[0], anchorFont: parseFloat(getComputedStyle(document.querySelector('.body-anchor')).fontSize), railShadow: getComputedStyle(document.querySelector('.body-morph-rail')).boxShadow };
  });
  check('morph hero: 3 px groove, 14 px thumb centred on the stop, >= 28 px hit height, 11 detents, anchors 11 px in 11 cells',
    hero.grooveH === 3 && hero.thumbW === 14 && hero.thumbH === 14 && hero.sliderH >= 28 && hero.ticks === 11 && hero.cells === 11 && hero.anchorFont >= 10 && Math.abs(hero.thumbX - hero.tick4) < 1 && /inset/.test(hero.railShadow), JSON.stringify(hero));
  check('detents grow near the thumb (9 px on the thumb, 6.8 / 4 px at 1 / 2+ stops away)', hero.tickH[4] === 9 && hero.tickH[3] > 5.5 && hero.tickH[3] < 8 && hero.tickH[3] === hero.tickH[5] && hero.tickH[2] === 4 && hero.tickH[0] === 4 && hero.tickH[10] === 4, hero.tickH.join(','));
  check('bracket sits on the hybrid stop (last detent)', Math.abs(hero.bracketX - hero.tick10) < 1.5, `${hero.bracketX} vs ${hero.tick10}`);
  // weight bars: stand-in from the morph position without telemetry, then from lineState engine0..10
  await settle(100);
  const barsNone = await page.evaluate(() => [...document.querySelectorAll('[data-param="param4"] .body-morph-bar')].map(b => Number(b.style.getPropertyValue('--w') || 0)));
  await page.evaluate(() => {
    const m = window.mock, A = new Array(24).fill(0); A[0] = .3; A[2] = .2; A[5] = 220; A[6] = .8; A[8] = 7; A[9 + 7] = .6; A[9 + 8] = .4;
    window.__tel = setInterval(() => { m.emit('lineStateA', A); }, 33);
  });
  await settle(160);
  const barsLive = await page.evaluate(() => [...document.querySelectorAll('[data-param="param4"] .body-morph-bar')].map(b => ({ w: Number(b.style.getPropertyValue('--w') || 0), h: Number(b.getBoundingClientRect().height.toFixed(1)) })));
  check('weight bars: morph position stands in without telemetry (stop 4 = 1.0), then lineState engine0..10 drive them (0.6 / 0.4 -> 6.6 / 4.4 px hairlines)',
    barsNone[4] === 1 && barsNone.filter(x => x > 0).length === 1 && barsLive[7].w === .6 && barsLive[8].w === .4 && barsLive[4].w === 0 && Math.abs(barsLive[7].h - 6.6) < .2 && Math.abs(barsLive[8].h - 4.4) < .2, JSON.stringify({ barsNone, live: barsLive.map(b => b.w) }));
  // Hold lamp
  await page.evaluate(() => { clearInterval(window.__tel); const m = window.mock, A = new Array(24).fill(0); A[0] = .3; A[2] = .2; A[4] = 1; A[5] = 220; A[6] = .8; A[8] = 7; A[9 + 7] = 1; window.__tel = setInterval(() => m.emit('lineStateA', A), 33); });
  await settle(160);
  const holdLit = await page.evaluate(() => ({ lit: document.querySelector('[data-param="param25"]').dataset.lit, checked: document.querySelector('[data-param="param25"] button').getAttribute('aria-checked'), tab: document.querySelector('.body-tab[data-tab="A"]').dataset.hold, follow: document.querySelector('.body-follow').textContent, glow: getComputedStyle(document.querySelector('[data-param="param25"] button')).boxShadow, lampOp: getComputedStyle(document.querySelector('.body-tab[data-tab="A"] .body-lamp')).opacity }));
  check('Hold button lit from lineState.hold (parameter unchanged), tab lamp dimmed, HELD in the caption band, sound readout A3 · 0.80 s',
    holdLit.lit === 'true' && holdLit.checked === 'false' && holdLit.tab === 'true' && /HELD/.test(holdLit.follow) && /^A3 · 0\.80 s/.test(holdLit.follow) && /rgba\(237, 237, 237, 0\.45\)/.test(holdLit.glow), JSON.stringify(holdLit));
  await page.evaluate(() => { clearInterval(window.__tel); const m = window.mock, A = new Array(24).fill(0); A[5] = 220; A[6] = .8; window.__tel = setInterval(() => m.emit('lineStateA', A), 33); });
  await settle(160);
  const holdOff = await page.evaluate(() => ({ lit: document.querySelector('[data-param="param25"]').dataset.lit, tab: document.querySelector('.body-tab[data-tab="A"]').dataset.hold }));
  check('Hold lamp goes out when lineState.hold returns to 0', holdOff.lit === 'false' && holdOff.tab === 'false', JSON.stringify(holdOff));
  await page.evaluate(() => clearInterval(window.__tel));

  // ---- lamp states: --lamp 1 / 0.7 / 0.25 with the words in the caption -------------------------------------------------------------------------------
  await settle(2300);
  const lampOf = () => page.evaluate(() => { const p = document.querySelector('.body-panel'), st = document.querySelector('.body-state'); return { lamp: getComputedStyle(p).getPropertyValue('--lamp').trim(), text: st.textContent, op: getComputedStyle(st, '::before').opacity, attr: p.dataset.lamp }; });
  const lampIdle = await lampOf();
  await page.evaluate(() => { window.__tel = setInterval(() => window.mock.emit('bodyViz', [.4, .3, .3, .3]), 33); });
  await settle(900);
  const lampActive = await lampOf();
  await page.evaluate(() => clearInterval(window.__tel));
  await page.click($('param5') + ' button'); await settle(700);
  const lampByp = await lampOf();
  await page.click($('param5') + ' button'); await settle(120);
  check('lamp states: NO INPUT = 0.7, ACTIVE = 1, BYPASSED = 0.25; each carries its words in the caption (never colour alone); lamp eases over 400 ms',
    lampIdle.lamp === '.7' && lampIdle.text === 'NO INPUT' && lampActive.lamp === '1' && lampActive.text === 'ACTIVE' && lampByp.lamp === '.25' && lampByp.text === 'BYPASSED'
    && Math.abs(Number(lampByp.op) - .25) < .02 && /0\.4s|400ms/.test(await page.evaluate(() => getComputedStyle(document.querySelector('.body-state'), '::before').transitionDuration)), JSON.stringify({ lampIdle, lampActive, lampByp }));

  // ---- baked grain + vignette ----------------------------------------------------------------------------------------------------------------------------
  const grain = await page.evaluate(() => {
    const bg = getComputedStyle(document.querySelector('.body-panel')).backgroundImage;
    const m = /url\("data:image\/svg\+xml,([^"]+)"\)/.exec(bg), svg = m ? decodeURIComponent(m[1]) : '';
    return { layers: (bg.match(/gradient\(/g) || []).length, svg: svg.slice(0, 40), turb: /feTurbulence/.test(svg), opacity: Number((/opacity='([.\d]+)'/.exec(svg) || [])[1]), size: getComputedStyle(document.querySelector('.body-panel')).backgroundSize, anim: [...document.querySelectorAll('re-body-view *')].filter(n => getComputedStyle(n).animationName !== 'none').length };
  });
  const noise = async withGrain => {
    if (!withGrain) await page.addStyleTag({ content: 're-body-view .body-panel{background:radial-gradient(ellipse at 50% 42%,#181818,#090909 76%)!important}' });
    const buf = await page.screenshot({ clip: { x: 330, y: 62, width: 300, height: 36 } });
    return page.evaluate(async b64 => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; let s = 0, n = 0; for (let y = 0; y < c.height; y++) for (let i = 1; i < c.width; i++) { const o = (y * c.width + i) * 4; s += Math.abs(d[o] - d[o - 4]) + Math.abs(d[o + 1] - d[o - 3]) + Math.abs(d[o + 2] - d[o - 2]); n += 3; } return s / n; }, buf.toString('base64'));
  };
  const withNoise = await noise(true), withoutNoise = await noise(false);
  check('grain + vignette: baked SVG feTurbulence data-URI tile at 3-5 % opacity as the panel background (3 layers), no filter in the DOM, no animations; measurable, subtle noise (mean pixel step grain vs flat > 0.25 levels, < 5)',
    grain.turb && grain.opacity >= .03 && grain.opacity <= .05 && grain.layers >= 2 && /128px/.test(grain.size) && light.filters === 0 && grain.anim === 0 && withNoise - withoutNoise > .25 && withNoise < 5, JSON.stringify({ ...grain, withNoise: Number(withNoise.toFixed(2)), flat: Number(withoutNoise.toFixed(2)) }));

  // ---- strips: grouped with headings, globals once -----------------------------------------------------------------------------------------------------
  const groups = await page.evaluate(() => ({ heads: [...document.querySelectorAll('[data-lineset="A"] .body-grouphead')].map(n => n.textContent), globalsOnce: ['param3', 'param5', 'param6', 'param7'].map(id => document.querySelectorAll(`[data-param="${id}"]`).length), docks: [...document.querySelectorAll('.body-globals')].map(n => n.dataset.dock), inGlobals: [...document.querySelectorAll('.body-globals [data-param]')].map(n => n.dataset.param).sort().join(), inLine: document.querySelectorAll('[data-lineset] .body-globals').length }));
  check('strips grouped with headings (LISTEN, EXCITE, CONTACT, BODY, PHYSICS); globals once, in the two docks, never inside a line set', groups.heads.join() === 'LISTEN,EXCITE,CONTACT,BODY,PHYSICS' && groups.globalsOnce.every(n => n === 1) && groups.docks.join() === 'header,deck' && groups.inLine === 0 && groups.inGlobals === 'param3,param5,param6,param7', JSON.stringify(groups));

  // ---- hooks and telemetry v2 ------------------------------------------------------------------------------------------------------------------------------
  await page.evaluate(() => { window.__modes = []; const f = window.view.field, orig = f.setModes; f.setModes = (e, ids, line) => { window.__modes.push({ e, ids, line }); return orig(e, ids, line); }; });
  const sel = await page.evaluate(() => { window.view.selectLine(1); const b = [...document.querySelectorAll('[data-lineset="B"]')].every(n => !n.hidden); window.view.selectLine('C'); const c = [...document.querySelectorAll('[data-lineset="C"]')].every(n => !n.hidden); window.view.selectLine(0); const a = [...document.querySelectorAll('[data-lineset="A"]')].every(n => !n.hidden); return { b, c, a }; });
  check('selectLine(i) (ghost-click callback) activates line B / C / A by index or letter', sel.a && sel.b && sel.c, JSON.stringify(sel));
  const mc = await page.evaluate(() => new Promise(resolve => {
    const calls = window.__calls; calls.setState.length = 0; calls.notifyAudio.length = 0;
    document.querySelector('[data-motion="full"]').click();
    const m = window.mock, t = setInterval(() => { m.emit('bodyViz', [.4, .3, .3, .3]); m.emit('bodyOnset', 1); }, 4);
    setTimeout(() => { clearInterval(t); resolve({ s: calls.setState.map(x => x[0]), n: calls.notifyAudio.length, last: calls.notifyAudio.at(-1), mode: window.view.motionMode(), pref: window.view.motionPref, ctl: window.view.motion.state, isCtl: window.view.motion === window.view.fx.motion }); }, 1000);
  }));
  await page.evaluate(() => { document.querySelector('[data-motion="calm"]').click(); });
  check('motion controller hooks: Motion switch calls motion.setState(mode); telemetry calls motion.notifyAudio(onset, wet) at most ~30 Hz; the mode lives in motionPref while view.motion is the controller',
    mc.s[0] === 'full' && mc.ctl === 'full' && mc.isCtl && mc.mode === 'full' && mc.pref === 'full' && mc.n > 5 && mc.n <= 36 && mc.last[0] > 0 && mc.last[1] > 0, JSON.stringify(mc));
  await page.evaluate(() => {
    const m = window.mock, E = new Array(16).fill(0); E[0] = .5; E[2] = .25; E[9] = .1;
    const A = new Array(24).fill(0); A[0] = .3; A[2] = .3; A[5] = 220; A[6] = .8; A[8] = 3;
    window.__modeTimer = setInterval(() => { m.emit('lineStateA', A); m.emit('lineModesA', E); m.emit('lineModesB', new Array(16).fill(.9)); }, 33);
  });
  await settle(300);
  const modes = await page.evaluate(() => ({ n: window.__modes.length, last: window.__modes.at(-1), stored: window.view.modeState?.line, bLeaks: window.__modes.some(c => c.e[0] === .9) }));
  check('lineModes -> field.setModes(energies, identities): active line only, identities from bodies.json of the dominant body (Piano: FEM 84, FEM 127 ...), modeState stored',
    modes.n > 2 && modes.last.e[0] === .5 && modes.last.e[9] === .1 && modes.last.ids[0].join() === 'f,84,FEM 84' && modes.last.ids[2].join() === 'f,194,FEM 194' && modes.last.ids[7] === 0 && modes.last.line === 'A' && modes.stored === 'A' && !modes.bLeaks, JSON.stringify({ n: modes.n, e: modes.last?.e.slice(0, 3), id0: modes.last?.ids[0] }));
  await page.evaluate(() => { window.__modes.length = 0; window.view.selectLine(1); });
  await settle(140);
  const tabModes = await page.evaluate(() => ({ n: window.__modes.length, first: window.__modes[0] }));
  check('switching to line B hands B\'s mode energies to the field', tabModes.n >= 1 && tabModes.first.line === 'B' && tabModes.first.e[0] === .9, JSON.stringify({ n: tabModes.n, line: tabModes.first?.line }));
  await page.evaluate(() => window.view.selectLine(0));
  // 30 Hz cap on setModes with 250 Hz packets
  const modeRate = await page.evaluate(() => new Promise(resolve => { clearInterval(window.__modeTimer); window.__modes.length = 0; const m = window.mock; let i = 0; const t = setInterval(() => { i++; const E = new Array(16).fill(.2 + (i % 5) * .1); m.emit('lineModesA', E); }, 4); setTimeout(() => { clearInterval(t); resolve(window.__modes.length); }, 1000); }));
  check('setModes is called at most ~30 Hz for 250 Hz packets', modeRate > 5 && modeRate <= 36, `calls in 1 s: ${modeRate}`);
  // no field attached: stored for later
  await page.evaluate(() => { window.__field = window.view.field; delete window.view.field; window.mock.emit('lineModesA', new Array(16).fill(.4)); });
  await settle(120);
  check('without a field the mode state is stored for later (view.modeState)', await page.evaluate(() => window.view.modeState?.energies?.[0] === .4 && window.view.modeState.identities.length === 16), '');
  await page.evaluate(() => { window.view.field = window.__field; });

  // Listen / Excite hairlines, Follow lock lamp, steady telemetry lets the loop sleep
  await page.evaluate(() => { clearInterval(window.__modeTimer); const m = window.mock; window.__tel = setInterval(() => { m.emit('analysisViz', [.5, .3, .2, .4, .1, .9]); const A = new Array(24).fill(0); A[1] = 1; A[2] = .4; A[3] = 220; m.emit('lineStateA', A); }, 33); });
  await settle(400);
  const hair = await page.evaluate(() => ({ excite: [...document.querySelectorAll('[data-param="param12"] .body-segmeter')].map(e => Number(e.style.getPropertyValue('--lv') || 0)), lock: document.querySelector('[data-param="param24"]').dataset.lock, lockLamp: getComputedStyle(document.querySelector('[data-param="param24"]'), '::after').width, follow: document.querySelector('.body-follow').textContent }));
  check('Excite hairlines (Through = listenEnergy, strikers = onset), Follow lock lamp from analysisViz.pitchConfidence, FOLLOW note while Follow > 0',
    hair.excite[0] > 0 && hair.excite[1] > 0 && hair.excite[1] === hair.excite[2] && hair.lock === 'true' && hair.lockLamp === '5px' && /FOLLOW ▸ A3/.test(hair.follow), JSON.stringify(hair));
  await page.evaluate(() => { window.mock.host('param24', 0); });
  await settle(80);
  const followOff = await page.evaluate(() => ({ lock: document.querySelector('[data-param="param24"]').dataset.lock, follow: document.querySelector('.body-follow').textContent }));
  check('Follow = 0 removes the FOLLOW note and the lock lamp', followOff.lock === 'false' && !/FOLLOW/.test(followOff.follow), JSON.stringify(followOff));
  await page.evaluate(() => { clearInterval(window.__tel); });
  await settle(2400);
  // steady, all-zero telemetry on all 10 endpoints: the loop must sleep (no rAF, no field redraw)
  const sleep = await page.evaluate(() => new Promise(resolve => {
    const m = window.mock, Z = new Array(24).fill(0); Z[5] = 220; Z[6] = .8;   // rootHz / t60 are non-zero in steady state; they must not keep the loop alive
    const send = () => { m.emit('bodyViz', [0, 0, 0, 0]); m.emit('bodyBands', new Array(8).fill(0)); m.emit('bodyOnset', 0); m.emit('analysisViz', [0, 0, 0, 0, 0, .5]); for (const l of 'ABC') m.emit('lineState' + l, Z); for (const l of 'ABC') m.emit('lineModes' + l, new Array(16).fill(0)); };
    send(); const t = setInterval(send, 33);
    setTimeout(() => {
      const r0 = window.__raf.n;
      const field = document.querySelector('.field [data-contour="0"]'); let n = 0; const mo = new MutationObserver(() => n++); mo.observe(field, { attributes: true, attributeFilter: ['d'] });
      setTimeout(() => { mo.disconnect(); clearInterval(t); resolve({ raf: window.__raf.n - r0, draws: n }); }, 700);
    }, 900);
  }));
  check('steady telemetry on all 10 endpoints (silence, constant rootHz / t60 / pitchConfidence) keeps rAF asleep for 700 ms', sleep.raf === 0 && sleep.draws === 0, JSON.stringify(sleep));
  // a change (rootHz) wakes it exactly for one repaint
  const wake = await page.evaluate(() => new Promise(resolve => {
    const m = window.mock, Z = new Array(24).fill(0); Z[5] = 261.6; Z[6] = 1.5; const r0 = window.__raf.n;
    m.emit('lineStateA', Z);
    setTimeout(() => { resolve({ raf: window.__raf.n - r0, text: document.querySelector('.body-follow').textContent }); }, 400);
  }));
  check('a changed rootHz / t60 wakes the loop for a repaint only (C4 · 1.50 s, a handful of frames)', wake.raf >= 1 && wake.raf < 12 && /^C4 · 1\.50 s/.test(wake.text), JSON.stringify(wake));
  await ctx.close();
}

// =========================================================================================================== structure
{
  const { ctx, page } = await fopen({ motion: 'calm' });
  const info = await page.evaluate(() => {
    const v = document.querySelector('re-body-view'), root = document.querySelector('.field'), scene = root.querySelector('.scene');
    const cs = el => getComputedStyle(el);
    const flat = el => { const c = cs(el); return { overflow: c.overflow, opacity: c.opacity, filter: c.filter, backdrop: c.backdropFilter, mask: c.maskImage, clip: c.clipPath, iso: c.isolation, blend: c.mixBlendMode, contain: c.contain, ts: c.transformStyle }; };
    return { scene: flat(scene), field: flat(root), fieldCss: { persp: cs(root).perspective, po: cs(root).perspectiveOrigin, pos: cs(root).position, w: root.offsetWidth, h: root.offsetHeight },
      parentOfScene: scene.parentElement === root, layers: scene.children.length, svgs: [...scene.children].every(c => c.tagName.toLowerCase() === 'svg' && c.classList.contains('layer')),
      layerCss: [...scene.children].map(c => { const s = cs(c); return [c.dataset.layer, s.position, s.overflow, s.pointerEvents, c.getAttribute('viewBox')]; }),
      sceneChildFlatteners: [...scene.children].map(c => { const s = cs(c); return [c.dataset.layer, s.filter, s.maskImage, s.clipPath, s.isolation, s.mixBlendMode, s.contain]; }).filter(r => r.slice(1).some(x => x !== 'none' && x !== 'auto' && x !== 'normal')),
      hasBodyObject: !!document.querySelector('.body-object'), caption: document.querySelector('.body-caption').textContent, caption2: !!document.querySelector('.body-follow'),
      captionInScene: !!scene.querySelector('.body-caption'), textInScene: [...scene.querySelectorAll('text, foreignObject')].length,
      contourCount: root.querySelectorAll('[data-contour]').length, circles: root.querySelector('[data-layer=air]').querySelectorAll('circle').length,
      dataset: { ...root.dataset }, aria: root.getAttribute('aria-label'), role: root.getAttribute('role'), tag: v.tagName };
  });
  check('.field: perspective 1600px, origin 50% 45%, relative, 912x234, overflow hidden (the only clip)', info.fieldCss.persp === '1600px' && /^456px 105\.(29|30)\d*px$/.test(info.fieldCss.po) && info.fieldCss.pos === 'relative' && info.fieldCss.w === 912 && info.fieldCss.h === 234 && info.field.overflow === 'hidden', JSON.stringify(info.fieldCss));
  check('.scene is a direct child of .field, preserve-3d, no flattener (overflow/opacity/filter/mask/clip/isolation/blend/contain)', info.parentOfScene && info.scene.ts === 'preserve-3d' && info.scene.overflow === 'visible' && info.scene.opacity === '1' && info.scene.filter === 'none' && info.scene.mask !== 'x' && (info.scene.mask === 'none' || info.scene.mask === '') && info.scene.clip === 'none' && info.scene.iso === 'auto' && info.scene.blend === 'normal' && (info.scene.contain === 'none') && info.scene.backdrop === 'none', JSON.stringify(info.scene));
  check('.scene has 11 leaf <svg class="layer"> children, none with filter/mask/clip/isolation/blend/contain', info.layers === 11 && info.svgs && info.sceneChildFlatteners.length === 0, JSON.stringify(info.sceneChildFlatteners));
  check('layers: absolute, overflow visible, pointer-events none except hit rects; no text/foreignObject/caption inside the scene', info.layerCss.every(([n, pos, ov, pe]) => pos === 'absolute' && ov === 'visible' && pe === 'none') && !info.captionInScene && info.textInScene === 0, JSON.stringify(info.layerCss.slice(0, 2)));
  check('caption stays plain DOM outside the field (.body-caption / .body-follow), P1 .body-object replaced', !info.hasBodyObject && info.caption === 'CLARINET' && info.caption2, info.caption);
  check('10 contours exist (data-contour 0..9), 40 air circles, dataset + role + aria on .field', info.contourCount === 10 && info.circles === 40 && info.dataset.shape === 'clarinet' && info.role === 'img' && /CLARINET illustration, Tune/.test(info.aria), JSON.stringify(info.dataset) + info.aria);
  const L = await layerInfo(page);
  check('11 layers in order back..air', L.map(l => l.name).join() === NAMES.join(), L.map(l => l.name).join());
  const bad = [];
  const clar = ZT[7]; const exp = { ...STATIC_Z, outline: clar[0], opening: clar[1], rear: clar[2], detail: clar.slice(3).reduce((a, b) => a + b, 0) / 7 };
  for (const l of L) {
    const e = exp[l.name], s = (1600 - e) / 1600;
    if (Math.abs(l.z - e) > .06 || Math.abs(l.s - s) > 2e-5 || Math.abs(l.s2 - s) > 2e-5) bad.push(`${l.name} z=${l.z} want ${e}, s=${l.s} want ${s.toFixed(5)}`);
  }
  check('layer transforms: translateZ(z) + scale (1600-z)/1600 (computed matrix), z from the Clarinet z-table, specular via translate3d', bad.length === 0, bad.join(' | ') || L.map(l => `${l.name}:${l.z}`).join(' '));
  const ds0 = await ds(page);
  check('all path d strings finite at rest, outline has 193 points, opening 97, strings 49', Object.values(ds0).flat().every(finite) && ds0.outline.some(d => (d.match(/L/g) || []).length === 192) && ds0.opening.some(d => (d.match(/L/g) || []).length === 96) && ds0.detail.every(d => (d.match(/L/g) || []).length === 48), '');
  // hit layer
  const hit = await page.evaluate(() => {
    const v = document.querySelector('re-body-view'), g = v.fx.ghost.map(g => { const r = g.hit.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, r.width, r.height, g.hit.dataset.index]; });
    const top = (x, y) => { const e = document.elementFromPoint(x, y); return e ? (e.closest('.layer')?.dataset.layer || e.className || e.tagName) : null; };
    const r = document.querySelector('.field').getBoundingClientRect();
    return { g, ghost0: top(g[0][0], g[0][1]), ghost1: top(g[1][0], g[1][1]), centre: top(r.x + r.width / 2, r.y + 105), field: [r.x, r.y, r.width, r.height], rects: [...document.querySelectorAll('.field [data-layer=hit] rect')].map(r => getComputedStyle(r).pointerEvents) };
  });
  check('hit layer: transparent rects over both ghosts only (pointer-events all), instrument centre is not a hit target', hit.ghost0 === 'hit' && hit.ghost1 === 'hit' && hit.centre !== 'hit' && hit.rects.every(p => p === 'all'), JSON.stringify(hit));
  // click a ghost at rest -> onSelectLine -> setActiveLine
  const before = await page.evaluate(() => document.querySelector('re-body-view').activeLine);
  await page.mouse.click(hit.g[0][0], hit.g[0][1]);
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => ({ line: document.querySelector('re-body-view').activeLine, tab: document.querySelector('.body-tab[data-active=true]').dataset.tab, cap: document.querySelector('.body-caption').textContent, sets: ['A', 'B', 'C'].map(l => document.querySelector(`[data-lineset="${l}"]`).hidden) }));
  check('click on ghost near selects that line through onSelectLine (A -> B), tab + control set + caption follow', before === 'A' && after.line === 'B' && after.tab === 'B' && after.cap === 'BASS DRUM' && after.sets.join() === 'true,false,true', JSON.stringify(after));
  await page.waitForTimeout(500);
  const L2 = await layerInfo(page); const exp2 = ZT[0];
  check('after the line change the layers show B (Bass Drum) z values (outline 0, opening -40, rear -300, detail mean)', Math.abs(L2.find(l => l.name === 'opening').z - exp2[1]) < .06 && Math.abs(L2.find(l => l.name === 'rear').z - exp2[2]) < .06, L2.filter(l => ['outline', 'opening', 'rear', 'detail'].map(String).includes(l.name)).map(l => `${l.name}:${l.z}`).join(' '));
  // tilted click: ghosts of A and C now; tilt first, then click the far ghost
  await page.mouse.move(930, 40, { steps: 8 }); await page.waitForTimeout(700);
  const hit2 = await page.evaluate(() => { const v = document.querySelector('re-body-view'); const g = v.fx.ghost.map(g => { const r = g.hit.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }); const e = document.elementFromPoint(g[1][0], g[1][1]); return { g, hit: e?.closest('.layer')?.dataset.layer, idx: v.fx.ghost[1].hit.dataset.index }; });
  await page.mouse.click(hit2.g[1][0], hit2.g[1][1]); await page.waitForTimeout(150);
  const line2 = await page.evaluate(() => document.querySelector('re-body-view').activeLine);
  check('hit test works under tilt (calm, pointer top-right): click on the far ghost selects its line', hit2.hit === 'hit' && String(['A', 'B', 'C'].indexOf(line2)) === hit2.idx, JSON.stringify({ hit2, line2 }));
  await ctx.close();
}
// =========================================================================================================== morph steps
{
  const { ctx, page } = await fopen({ motion: 'calm' });
  const bad = [], seen = [];
  for (let p = 0; p <= 10.0001; p += .5) {
    await hostSet(page, 'param4', p);
    await waitMorph(page, p);
    await page.waitForTimeout(60);
    const r = await page.evaluate(() => {
      const v = document.querySelector('re-body-view'), L = {};
      for (const el of document.querySelectorAll('.field .scene > .layer')) { const m = new DOMMatrix(getComputedStyle(el).transform); L[el.dataset.layer] = [m.m43, m.m11]; }
      const depth = v.fx.T.map(t => [...t.depth]);
      const d = [...document.querySelectorAll('.field path')].map(p => p.getAttribute('d') || '');
      const attrs = [...document.querySelectorAll('.field [stroke]')].map(e => e.getAttribute('stroke') + e.getAttribute('stroke-opacity'));
      return { depth, L, dOk: d.every(s => !/NaN|Infinity/.test(s)), dLen: d.filter(Boolean).length, attrs, tr: [...document.querySelectorAll('.field .layer')].map(e => e.style.transform).join(), zp: [...v.fx.zp], shape: document.querySelector('.field').dataset.shape, cap: document.querySelector('.body-caption').textContent };
    });
    const a = Math.floor(p + 1e-9), b = Math.min(10, a + 1), t = p - a, za = r.depth[a], zb = r.depth[b];
    const z = i => za[i] * (1 - t) + zb[i] * t, detail = [3, 4, 5, 6, 7, 8, 9].reduce((s, i) => s + z(i), 0) / 7;
    const want = { outline: z(0), opening: z(1), rear: z(2), detail };
    for (const k of Object.keys(want)) if (Math.abs(r.L[k][0] - want[k]) > .08) bad.push(`p=${p} ${k} z=${r.L[k][0].toFixed(2)} want ${want[k].toFixed(2)}`);
    if (!r.dOk || !finite(r.tr) || !r.attrs.every(finite) || r.zp.some(x => !Number.isFinite(x))) bad.push(`p=${p} NaN somewhere`);
    for (const k of Object.keys(r.L)) if (Math.abs(r.L[k][1] - (1600 - r.L[k][0]) / 1600) > 1e-5) bad.push(`p=${p} ${k} scale mismatch`);
    seen.push([p, r.shape, +r.L.outline[0].toFixed(0), +r.L.opening[0].toFixed(0), +r.L.rear[0].toFixed(0), +r.L.detail[0].toFixed(0)]);
  }
  check('morph 0..10 in 0.5 steps: paths finite, z interpolated like the geometry (a,b,t) for outline/opening/rear/detail, s = (1600-z)/1600 each step', bad.length === 0, bad.slice(0, 4).join(' | '));
  console.log('      z per step [p, shape, outline, opening, rear, detail]: ' + JSON.stringify(seen.filter((_, i) => i % 2 === 0)));
  const diff = await page.evaluate(zt => { const v = document.querySelector('re-body-view'); return v.fx.T.map((t, i) => [i, [...t.depth]]).filter(([i, d]) => JSON.stringify(d) !== JSON.stringify(zt[i])).map(([i, d]) => `anchor ${i} ${JSON.stringify(d)} vs bodies.json ${JSON.stringify(zt[i])}`); }, ZT);
  console.log('      depth data vs plugin/bodies.json zTable: ' + (diff.length ? 'DIFF ' + diff.join(' ; ') : 'identical'));
  // Tune extremes + hybrid shape change with the path d actually changing
  const d1 = await ds(page); await hostSet(page, 'param1', 5); await page.waitForTimeout(150); const d2 = await ds(page);
  check('Tune change rewrites the geometry (scale law) without NaN', JSON.stringify(d1.outline) !== JSON.stringify(d2.outline) && Object.values(d2).flat().every(finite), '');
  await ctx.close();
}
// =========================================================================================================== motion: tilt per state
const corners = [[1, 1], [958, 1], [1, 598], [958, 598], [480, 300]];
async function tiltMax(page, extraWait = 900) {
  let max = { yaw: 0, pitch: 0 };
  for (const [x, y] of corners) { await page.mouse.move(x, y, { steps: 6 }); await page.waitForTimeout(extraWait); const a = await sceneAngles(page); max = { yaw: Math.max(max.yaw, Math.abs(a.yaw)), pitch: Math.max(max.pitch, Math.abs(a.pitch)) }; }
  return max;
}
{
  const { ctx, page } = await fopen({ motion: 'calm' });
  const rest = await page.evaluate(() => [...document.querySelectorAll('.field .scene > .layer')].map(el => { const r = el.getBoundingClientRect(); return [el.dataset.layer, r.x + r.width / 2, r.y + r.height / 2]; }));
  const m = await tiltMax(page);
  check('Calm: pointer tilt reaches the 1.5 deg cap at the host edge and never exceeds it', m.yaw <= 1.5 + 1e-6 && m.yaw > 1.4 && m.pitch <= 1.5 + 1e-6 && m.pitch > 1.4, JSON.stringify(m));
  // parallax: tilt into a corner and compare layer shifts (preserve-3d must be effective: back and air move in opposite directions)
  await page.mouse.move(958, 598, { steps: 6 }); await page.waitForTimeout(900);
  const tilted = await page.evaluate(() => [...document.querySelectorAll('.field .scene > .layer')].map(el => { const r = el.getBoundingClientRect(); return [el.dataset.layer, r.x + r.width / 2, r.y + r.height / 2]; }));
  const sh = Object.fromEntries(tilted.map(([n, x, y], i) => [n, [+(x - rest[i][1]).toFixed(1), +(y - rest[i][2]).toFixed(1)]]));
  check('Calm parallax is real 3D: back (z -900) and air (z +320) shift in opposite directions, back by ~23 px at 1.5 deg', Math.sign(sh.back[0]) !== Math.sign(sh.air[0]) && Math.abs(sh.back[0]) > 15 && Math.abs(sh.back[0]) < 32 && Math.abs(sh.back[0]) > Math.abs(sh.outline[0]) * 3, JSON.stringify({ back: sh.back, ghostNear: sh.ghostNear, outline: sh.outline, specular: sh.specular, air: sh.air }));
  const light = await page.evaluate(() => { const s = document.querySelector('[data-layer=specular]'); const m = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px,\s*260px\)/.exec(s.style.transform); return m ? [+m[1], +m[2], s.style.transform] : null; });
  check('light follows the pointer: specular layer moved by translate3d only (pointer bottom-right: +0.25 W, +0.25 H = 228 / 58.5 px)', light && light[0] > 220 && light[0] <= 228.1 && light[1] > 55 && light[1] <= 58.6, JSON.stringify(light));
  // pointer leave -> back to 0
  await page.evaluate(() => document.querySelector('re-body-view').dispatchEvent(new PointerEvent('pointerleave'))); await page.waitForTimeout(1000);
  const left = await sceneAngles(page);
  check('pointerleave returns the tilt to 0', Math.abs(left.yaw) < .011 && Math.abs(left.pitch) < .011, JSON.stringify(left));
  // drag held: button down moves are ignored; pause(true) holds
  await page.mouse.move(480, 300, { steps: 3 }); await page.waitForTimeout(800);
  const before = await sceneAngles(page);
  await page.mouse.down(); await page.mouse.move(900, 500, { steps: 6 }); await page.waitForTimeout(500); await page.mouse.up();
  const dragged = await sceneAngles(page);
  check('pointer moves with a button held (control / morph drags) do not tilt', Math.abs(dragged.yaw - before.yaw) < .02 && Math.abs(dragged.pitch - before.pitch) < .02, JSON.stringify({ before, dragged }));
  await page.mouse.move(100, 100, { steps: 3 }); await page.waitForTimeout(700);
  await page.evaluate(() => document.querySelector('re-body-view').fx.motion.pause(true));
  const held0 = await sceneAngles(page); await page.mouse.move(900, 500, { steps: 6 }); await page.waitForTimeout(500); const held1 = await sceneAngles(page);
  await page.evaluate(() => document.querySelector('re-body-view').fx.motion.pause(false));
  check('motion.pause(true) ignores the pointer and holds the tilt target', held0.t === held1.t, held0.t);
  // no capture: no setPointerCapture calls from the motion code
  await ctx.close();
}
{
  const { ctx, page } = await fopen({ motion: 'off' });
  const r0 = await rafN(page); await sleep(300); const r1 = await rafN(page); const base = r1 - r0;
  const m = await tiltMax(page, 300);
  const a = await sceneAngles(page); const r2 = await rafN(page);
  check('Off: pointer does not tilt at all (rotateY/X exactly 0) and requests no frames', m.yaw === 0 && m.pitch === 0 && /translate3d\(0px,\s*0px,\s*0px\)/.test(a.t), JSON.stringify({ m, base, t: a.t }));
  const motionSwitch = await page.evaluate(() => document.querySelector('.body-motionbtn[aria-checked=true]')?.dataset.motion);
  check('Off: Motion switch shows Off', motionSwitch === 'off', motionSwitch);
  await ctx.close();
}
{
  const { ctx, page } = await fopen({ motion: 'full' });
  await page.waitForTimeout(1500);
  let max = { yaw: 0, pitch: 0 };
  for (const [x, y] of corners) { await page.mouse.move(x, y, { steps: 6 }); await page.waitForTimeout(900); const a = await sceneAngles(page); max = { yaw: Math.max(max.yaw, Math.abs(a.yaw)), pitch: Math.max(max.pitch, Math.abs(a.pitch)) }; }
  check('Full: pointer tilt reaches 4 deg at the edge; with the idle drift (+-1 deg) the total stays <= 5 deg', max.yaw > 3.5 && max.yaw <= 5.0001 && max.pitch > 3.5 && max.pitch <= 5.0001, JSON.stringify(max));
  // idle drift: leave, drift keeps rotating the scene while within the 20 s window
  await page.evaluate(() => document.querySelector('re-body-view').dispatchEvent(new PointerEvent('pointerleave')));
  const samples = []; for (let i = 0; i < 6; i++) { await page.waitForTimeout(500); samples.push((await sceneAngles(page)).yaw); }
  const snap = await page.evaluate(() => document.querySelector('re-body-view').fx.motion.snapshot());
  check('Full: idle drift is alive (scene still moves, |yaw| <= 1 deg, loop running)', Math.max(...samples) - Math.min(...samples) > .02 && samples.every(y => Math.abs(y) <= 1.0001) && snap.running, JSON.stringify({ samples: samples.map(x => +x.toFixed(3)), running: snap.running, gain: snap.gain }));
  await ctx.close();
}
{
  const { ctx, page } = await fopen({ motion: 'full', reduced: true });
  const sw = await page.evaluate(() => document.querySelector('.body-motionbtn[aria-checked=true]')?.dataset.motion);
  const r0 = await rafN(page); const m = await tiltMax(page, 250); const a = await sceneAngles(page); await sleep(500); const r1 = await rafN(page);
  const snap = await page.evaluate(() => document.querySelector('re-body-view').fx.motion.snapshot());
  check('prefers-reduced-motion forces Off: switch shows Off, no tilt, no drift, effective state off (stored preference kept)', sw === 'off' && m.yaw === 0 && m.pitch === 0 && snap.effective === 'off' && snap.state === 'full', JSON.stringify({ sw, m, eff: snap.effective, pref: snap.state }));
  await ctx.close();
  const o = await fopen({ motion: 'full' });
  await o.page.mouse.move(900, 500, { steps: 5 }); await o.page.waitForTimeout(900);
  const tiltedA = await sceneAngles(o.page);
  await o.page.emulateMedia({ reducedMotion: 'reduce' }); await o.page.waitForTimeout(300);
  const afterA = await sceneAngles(o.page);
  const snap2 = await o.page.evaluate(() => document.querySelector('re-body-view').fx.motion.snapshot());
  check('emulating reduced motion at runtime snaps a tilted Full scene back to exactly 0', Math.abs(tiltedA.yaw) > 1 && afterA.yaw === 0 && afterA.pitch === 0 && !snap2.running, JSON.stringify({ tiltedA: tiltedA.yaw, afterA: afterA.yaw, running: snap2.running }));
  await o.page.emulateMedia({ reducedMotion: 'no-preference' }); await o.page.mouse.move(800, 100, { steps: 5 }); await o.page.waitForTimeout(900);
  const back = await sceneAngles(o.page);
  check('leaving reduced motion re-enables the tilt', Math.abs(back.yaw) > 1, JSON.stringify(back));
  await o.ctx.close();
}
// =========================================================================================================== energy response
{
  const { ctx, page } = await fopen({ motion: 'calm' });
  const before = { d: await ds(page), L: (await layerInfo(page)).map(l => l.inline) };
  const airBefore = await page.evaluate(() => [...document.querySelectorAll('[data-layer=air] circle')].map(c => c.getAttribute('cx') + ',' + c.getAttribute('cy')).join('|'));
  await page.evaluate(() => {
    window.__mut = {}; const root = document.querySelector('.field');
    new MutationObserver(list => { for (const m of list) { const l = m.target.closest('.layer')?.dataset.layer ?? (m.target.classList.contains('scene') ? 'SCENE' : 'other'); const k = `${l}:${m.attributeName}`; window.__mut[k] = (window.__mut[k] || 0) + 1; } }).observe(root, { subtree: true, attributes: true });
  });
  const r0 = await rafN(page); const t0 = Date.now();
  await feed(page, 1500);
  const during = await page.evaluate(() => ({ ...window.__mut }));
  const after = { d: await ds(page), L: (await layerInfo(page)).map(l => l.inline) };
  const same = k => JSON.stringify(before.d[k]) === JSON.stringify(after.d[k]);
  const mark = await page.evaluate(() => [...document.querySelectorAll('.field .markers circle')].map(c => +c.getAttribute('fill-opacity')));
  const dKeys = Object.keys(during).filter(k => k.endsWith(':d')).map(k => k.split(':')[0]).sort();
  check('audio events (bodyViz, bodyBands, bodyOnset, lineModesA) rewrite `d` on exactly 3 layers: opening, detail, outline', JSON.stringify(dKeys) === JSON.stringify(['detail', 'opening', 'outline']), JSON.stringify(Object.fromEntries(Object.entries(during).filter(([k]) => k.endsWith(':d')))));
  check('rear, ghosts, floor, specular, air, back, hit: path d untouched', ['rear', 'ghostNear', 'ghostFar', 'floor', 'specular', 'air', 'back', 'hit'].every(same) && !['rear', 'ghostNear', 'ghostFar', 'floor', 'specular', 'air', 'back', 'hit'].some(n => during[`${n}:d`]), '');
  check('detail: only the strings (paths 3-5) move, fittings (6-9) keep their d; outline and opening differ from rest', after.d.detail.slice(0, 3).some((d, i) => d !== before.d.detail[i]) && after.d.detail.slice(3).every((d, i) => d === before.d.detail[i + 3]) , '');
  check('layer transforms (translateZ / scale) untouched by audio: transform-only layers keep their matrix, motion writes only on .scene', before.L.join('|') === after.L.join('|') && during['SCENE:style'] > 0 && Object.keys(during).filter(k => k.endsWith(':transform')).length === 0, `scene writes=${during['SCENE:style']}`);
  const markersLit = await (async () => { const p2 = await fopen({ motion: 'calm' }); const lit = await p2.page.evaluate(() => new Promise(res => { const t = setInterval(() => window.mock.emit('lineModesA', Array.from({ length: 16 }, (_, i) => (i % 2 ? 0.6 : 0.02))), 33); setTimeout(() => { const o = [...document.querySelectorAll('.field .markers circle')].map(c => +c.getAttribute('fill-opacity')); clearInterval(t); window.mock.emit('lineModesA', Array(16).fill(0)); setTimeout(() => res({ o, off: [...document.querySelectorAll('.field .markers circle')].map(c => +c.getAttribute('fill-opacity')) }), 400); }, 500); }));
    const onCont = await p2.page.evaluate(() => { const v = document.querySelector('re-body-view'); const pts = v.fx.cur[0], n = v.fx.n[0]; return v.fx.markers.every((m, i) => { const j = Math.round((i + .5) / 16 * (n - 1)); return Math.abs(+m.getAttribute('cx') - pts[2 * j]) < .06 && Math.abs(+m.getAttribute('cy') - pts[2 * j + 1]) < .06; }); });
    await p2.ctx.close(); return { ...lit, onCont }; })();
  check('lineModesA markers: odd markers lit (> 0.3), even dim, all return to 0 after silence, and sit on contour 0', markersLit.o.filter((_, i) => i % 2).every(x => x > .3) && markersLit.o.filter((_, i) => i % 2 === 0).every(x => x < .1) && markersLit.off.every(x => x === 0) && markersLit.onCont, JSON.stringify(markersLit.o.slice(0, 4)) + ' off:' + markersLit.off.slice(0, 3));
  const airAfter = await page.evaluate(() => [...document.querySelectorAll('[data-layer=air] circle')].map(c => c.getAttribute('cx') + ',' + c.getAttribute('cy')).join('|'));
  console.log(`      air: particle flow rewrote cx/cy ${during['air:cx'] || 0}+${during['air:cy'] || 0} times (air changed: ${airBefore !== airAfter}); attribute writes by layer: ` + JSON.stringify(Object.fromEntries(Object.entries(during).filter(([k]) => !k.endsWith(':cx') && !k.endsWith(':cy') && !k.endsWith(':d')))));
  const snapAudio = await page.evaluate(() => document.querySelector('re-body-view').fx.motion.snapshot());
  console.log('      motion after audio:', JSON.stringify({ push: +snapAudio.push.toFixed(3), breathe: snapAudio.breathe, frames: snapAudio.frames, running: snapAudio.running }));
  // rAF stops after audio stops
  await sleep(300); let n0 = await rafN(page), lastR = await page.evaluate(() => window.__raf.last), waitedAt = 0;
  for (let i = 0; i < 40; i++) { await sleep(250); const n1 = await rafN(page); if (n1 === n0) { waitedAt = (i + 1) * 250; break; } n0 = n1; }
  const quiet = await rafN(page); await sleep(600); const quiet2 = await rafN(page);
  check('rAF stops after the audio ends (no frame requests in a 600 ms window)', quiet === quiet2, `loop quiet ${waitedAt + 300} ms after the last event`);
  const flat = await ds(page);
  check('after silence the vibrating contours are flat again (d equals the rest geometry)', JSON.stringify(flat.outline) === JSON.stringify(before.d.outline) && JSON.stringify(flat.opening) === JSON.stringify(before.d.opening) && JSON.stringify(flat.detail) === JSON.stringify(before.d.detail), '');
  await ctx.close();
}
{   // Off: audio changes brightness only; nothing moves
  const { ctx, page } = await fopen({ motion: 'off' });
  const before = await ds(page);
  await feed(page, 1200);
  const after = await ds(page);
  const op = await page.evaluate(() => ({ floor: document.querySelector('[data-layer=floor]').style.opacity, air: document.querySelector('[data-layer=air]').style.opacity }));
  const sc = await sceneAngles(page);
  check('Off + audio: no path rewrites, no push / breathe (scene stays at identity), brightness (opacity) still set', JSON.stringify(before) === JSON.stringify(after) && /translate3d\(0px,\s*0px,\s*0px\) scale3d\(1,\s*1,\s*1\)/.test(sc.t) && op.floor !== '' && op.air !== '', JSON.stringify(op));
  await ctx.close();
}
// =========================================================================================================== rAF accounting
{
  const { ctx, page } = await fopen({ motion: 'calm' });
  await sleep(800); const a = await rafN(page); await sleep(700); const b = await rafN(page);
  check('idle at rest: no rAF requests over 700 ms', a === b, `${b - a}`);
  await page.mouse.move(100, 100); await page.mouse.move(700, 500, { steps: 10 }); const tMove = Date.now();
  await sleep(1000); const c = await rafN(page); await sleep(600); const d = await rafN(page);
  check('rAF stops within 1 s after the last pointer move (Calm)', c === d, `frames in [1.0 s,1.6 s] = ${d - c}`);
  const snap = await page.evaluate(() => document.querySelector('re-body-view').fx.motion.snapshot());
  check('motion loop reports not running when idle', !snap.running, '');
  // drag with button: view loop untouched
  await ctx.close();
}
if (LONG) {
  const { ctx, page } = await fopen({ motion: 'full' });
  await page.mouse.move(500, 300, { steps: 4 });
  await sleep(5000); const run = await page.evaluate(() => document.querySelector('re-body-view').fx.motion.snapshot().running);
  const n0 = await rafN(page); await sleep(500); const n1 = await rafN(page);
  check('Full: drift loop runs while the 20 s window is open', run && n1 - n0 > 10, `${n1 - n0} frames in 500 ms`);
  await sleep(18500);   // 24 s after the last activity
  const g = await page.evaluate(() => document.querySelector('re-body-view').fx.motion.snapshot());
  const m0 = await rafN(page); await sleep(700); const m1 = await rafN(page);
  check('Full: 20 s after the last activity the drift has eased out (gain 0) and the loop has ended', g.gain === 0 && !g.running && m0 === m1, JSON.stringify({ gain: g.gain, running: g.running, d: m1 - m0 }));
  await page.mouse.move(520, 320, { steps: 3 }); await sleep(600);
  const g2 = await page.evaluate(() => document.querySelector('re-body-view').fx.motion.snapshot());
  check('Full: pointer activity restarts the drift', g2.gain > 0 && g2.running, JSON.stringify({ gain: g2.gain }));
  await ctx.close();
}
// =========================================================================================================== zoom x perspective (F5)
{
  const shift = async zoomViewport => {
    const { ctx, page } = await fopen({ w: zoomViewport[0], h: zoomViewport[1], motion: 'calm' });
    const rect = n => page.evaluate(n => { const r = document.querySelector(`[data-layer=${n}]`).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, n);
    const rest = { back: await rect('back'), air: await rect('air') };
    await page.mouse.move(zoomViewport[0] - 2, zoomViewport[1] / 2, { steps: 6 }); await page.waitForTimeout(900);
    const t = { back: await rect('back'), air: await rect('air') };
    const z = await page.evaluate(() => document.querySelector('.body-panel').style.zoom);
    await ctx.close();
    return { zoom: +z, back: t.back[0] - rest.back[0], air: t.air[0] - rest.air[0] };
  };
  const a = await shift([960, 600]), b = await shift([1920, 1200]), c = await shift([480, 300]);
  check('zoom x perspective (Chromium): parallax shift scales with zoom (back layer shift at zoom 2 = 2 x zoom 1, at zoom 0.5 = 0.5 x)', Math.abs(b.back / a.back - 2) < .12 && Math.abs(c.back / a.back - .5) < .06 && Math.sign(a.back) !== Math.sign(a.air), JSON.stringify({ z1: a, z2: b, z05: c }));
}
// =========================================================================================================== line cross-fade
{
  const { ctx, page } = await fopen({ motion: 'calm' });
  const n = await page.evaluate(() => new Promise(res => { const v = document.querySelector('re-body-view'); v.setActiveLine('B'); requestAnimationFrame(() => requestAnimationFrame(() => res(document.getAnimations().filter(a => a.effect?.target?.closest?.('.field') && a.playState === 'running').length))); }));
  check('line change starts a 250 ms opacity cross-fade on the field layers (Web Animations, compositor-only property)', n >= 4, `${n} running`);
  await ctx.close();
}
// =========================================================================================================== hooks with panel and telemetry
{
  const { ctx, page } = await fopen({ motion: 'calm' });
  const h = await page.evaluate(() => { const v = document.querySelector('re-body-view'); return { motionIsController: v.motion === v.fx.motion && typeof v.motion.pause === 'function' && typeof v.motion.setState === 'function' && typeof v.motion.notifyAudio === 'function' && typeof v.motion.start === 'function' && typeof v.motion.stop === 'function', field: typeof v.field?.setModes, sel: typeof v.selectLine, onSel: typeof v.onSelectLine }; });
  check('hooks: view.motion is the MotionController (start/stop/setState/notifyAudio/pause), view.field.setModes exists, ghost click uses selectLine', h.motionIsController && h.field === 'function' && h.sel === 'function' && h.onSel === 'function', JSON.stringify(h));
  // panel drag hook pauses the controller
  const p = await page.evaluate(() => { const v = document.querySelector('re-body-view'); v.setDragging(true); const a = v.motion.paused; v.setDragging(false); return [a, v.motion.paused]; });
  check('panel setDragging(true/false) pauses / resumes the controller', p[0] === true && p[1] === false, JSON.stringify(p));
  // telemetry feeds the controller: onset push and wet breathing
  await page.mouse.move(480, 300);
  const pushed = await page.evaluate(() => new Promise(res => { const t = setInterval(() => { window.mock.emit('bodyViz', [0.4, 0.5, 0.3, 0.3]); window.mock.emit('bodyOnset', 0.95); }, 33); setTimeout(() => { const s = document.querySelector('re-body-view').motion.snapshot(); clearInterval(t); res({ push: s.push, breathe: s.breathe, tr: s.transform }); }, 500); }));
  check('telemetry notifyAudio drives push (translateZ(-push) up to 6 px) and breathe (1 + 0.004 wet) on the scene', pushed.push > 3 && pushed.push <= 6.001 && pushed.breathe > 1.001 && pushed.breathe <= 1.0041 && /translate3d\(0px,0px,-[\d.]+px\)/.test(pushed.tr), JSON.stringify({ push: +pushed.push.toFixed(2), breathe: +pushed.breathe.toFixed(5) }));
  await sleep(1500);
  // Motion switch in the panel -> controller
  await page.mouse.move(900, 500, { steps: 5 }); await page.waitForTimeout(800);
  const tiltedCalm = await sceneAngles(page);
  await page.click('.body-motionbtn[data-motion=off]'); await page.waitForTimeout(150);
  const afterOff = await sceneAngles(page); const stOff = await page.evaluate(() => document.querySelector('re-body-view').motion.state);
  await page.mouse.move(100, 100, { steps: 5 }); await page.waitForTimeout(500); const stillOff = await sceneAngles(page);
  await page.click('.body-motionbtn[data-motion=full]'); await page.mouse.move(900, 100, { steps: 5 }); await page.waitForTimeout(900);
  const asFull = await sceneAngles(page); const stFull = await page.evaluate(() => document.querySelector('re-body-view').motion.snapshot());
  check('Motion switch in the panel drives the controller: Calm tilt -> Off snaps to 0 and stays 0 -> Full tilts again (> 1.5 deg)', Math.abs(tiltedCalm.yaw) > 1 && afterOff.yaw === 0 && stOff === 'off' && stillOff.yaw === 0 && Math.abs(asFull.yaw) > 2 && stFull.state === 'full', JSON.stringify({ tiltedCalm: tiltedCalm.yaw, afterOff: afterOff.yaw, asFull: asFull.yaw }));
  await ctx.close();
}
{   // re-mount of the same element
  const { ctx, page } = await fopen({ motion: 'calm' });
  const r = await page.evaluate(() => new Promise(res => {
    const v = document.querySelector('re-body-view'); const parent = v.parentElement; v.remove();
    setTimeout(() => { parent.appendChild(v); setTimeout(() => res({ layers: document.querySelectorAll('.field .scene > .layer').length, fields: document.querySelectorAll('.field').length, bodyObject: document.querySelectorAll('.body-object').length, motion: v.motion === v.fx.motion, styles: document.querySelectorAll('re-body-view style').length }), 400); }, 100);
  }));
  await page.mouse.move(900, 500, { steps: 5 }); await page.waitForTimeout(800); const a = await sceneAngles(page);
  check('re-mount (remove + append the same element): one field, 11 layers, controller works again', r.layers === 11 && r.fields === 1 && r.bodyObject === 0 && r.motion && Math.abs(a.yaw) > 1, JSON.stringify(r) + ' yaw ' + a.yaw);
  await ctx.close();
}
// =========================================================================================================== bypass, teardown
{
  const { ctx, page } = await fopen({ motion: 'calm' });
  await hostSet(page, 'param5', 1); await page.waitForTimeout(700);
  const op = await page.evaluate(() => getComputedStyle(document.querySelector('.field')).opacity);
  check('bypass dims the field (opacity .25 on .field, the perspective element only)', op === '0.25', op);
  await hostSet(page, 'param5', 0);
  const td = await page.evaluate(() => new Promise(res => {
    const v = document.querySelector('re-body-view'), mock = window.mock;
    const eps = mock.endpointCount();
    v.remove();
    setTimeout(() => { const n = window.__raf.n; setTimeout(() => { v.dispatchEvent(new PointerEvent('pointermove', { clientX: 700, clientY: 400 })); setTimeout(() => res({ eps, epsAfter: mock.endpointCount(), fx: v.fx, raf: window.__raf.n - n }), 200); }, 300); }, 50);
  }));
  check('teardown: field state released, all endpoint listeners removed (incl. lineModes*), no frames afterwards', td.fx === null && td.epsAfter === 0 && td.raf === 0, JSON.stringify({ eps: td.eps, after: td.epsAfter, raf: td.raf }));
  await ctx.close();
}
// =========================================================================================================== frame time
async function frameTime(w, h, withAudio) {
  const { ctx, page } = await fopen({ w, h, motion: 'calm' });
  const cdp = await ctx.newCDPSession(page); await cdp.send('Performance.enable');
  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  if (withAudio) await page.evaluate(() => { window.__feed = setInterval(() => { const t = performance.now() / 1000; window.mock.emit('bodyViz', [0.25, 0.3, 0.2, 0.2]); window.mock.emit('bodyBands', [0.6, 0.5, 0.4, 0.3 + .2 * Math.sin(t * 5), 0.2, 0.15, 0.1, 0.05]); window.mock.emit('bodyOnset', Math.random() < .05 ? .9 : 0); window.mock.emit('lineModesA', Array.from({ length: 16 }, (_, i) => i % 3 ? .1 : .5)); }, 33); });
  const run = frames => page.evaluate(frames => new Promise(res => {
    const host = document.querySelector('re-body-view'), r = host.getBoundingClientRect(), times = []; let k = 0;
    const step = ts => { const a = k * .09; host.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + r.width * (.5 + .45 * Math.cos(a)), clientY: r.top + r.height * (.5 + .45 * Math.sin(a * 1.3)), pointerType: 'mouse' })); times.push(ts); if (++k <= frames) requestAnimationFrame(step); else res(times); };
    requestAnimationFrame(step);
  }), frames);
  await run(40);
  const m0 = await metrics(); const times = await run(120); const m1 = await metrics();
  const dts = times.slice(1).map((t, i) => t - times[i]).sort((a, b) => a - b);
  const task = (m1.TaskDuration - m0.TaskDuration) / 120 * 1000, script = (m1.ScriptDuration - m0.ScriptDuration) / 120 * 1000, lay = (m1.LayoutDuration - m0.LayoutDuration) / 120 * 1000, rec = (m1.RecalcStyleDuration - m0.RecalcStyleDuration) / 120 * 1000;
  const zoom = await page.evaluate(() => document.querySelector('.body-panel').style.zoom);
  await ctx.close();
  return { zoom, medianInterval: dts[Math.floor(dts.length / 2)], p95: dts[Math.floor(dts.length * .95)], mainThreadMsPerFrame: task, scriptMs: script, layoutMs: lay, styleMs: rec };
}
const FT = {};
for (const [w, h] of [[960, 600], [1920, 1200]]) for (const audio of [false, true]) { const r = await frameTime(w, h, audio); FT[`${w}x${h}${audio ? '+audio' : ''}`] = r; console.log(`      frame time ${w}x${h} zoom ${r.zoom}${audio ? ' + audio feed' : ''} (tilting, 120 frames): median interval ${r.medianInterval.toFixed(2)} ms, p95 ${r.p95.toFixed(2)} ms; main thread ${r.mainThreadMsPerFrame.toFixed(2)} ms/frame (script ${r.scriptMs.toFixed(2)}, layout ${r.layoutMs.toFixed(2)}, style ${r.styleMs.toFixed(2)})`); }
check('frame time while tilting: main-thread work per frame <= 4 ms at zoom 1 and 2', FT['960x600'].mainThreadMsPerFrame <= 4 && FT['1920x1200'].mainThreadMsPerFrame <= 4, JSON.stringify(Object.fromEntries(Object.entries(FT).map(([k, v]) => [k, +v.mainThreadMsPerFrame.toFixed(2)]))));

// ================================================================ P6 integration: merge consistency (fallback gone, single sources, ghosts follow their lines)
{
  // build output is current: PARAMS / MODE_IDS / TUNE_NOTE_MAX / Z_TABLE are generated, never hand-edited
  const { execFileSync } = await import('node:child_process');
  let built = '', ok = true;
  try { built = execFileSync('python3', [path.join(ROOT, 'tools/build_ui.py'), '--check'], { cwd: ROOT, encoding: 'utf8' }); } catch (e) { ok = false; built = String(e.stderr || e.message); }
  check('tools/build_ui.py --check: plugin/index.js and the generated block (PARAMS, TUNE_NOTE_MAX, Z_TABLE, MODE_IDS) are up to date', ok, built.trim().split('\n').pop());
  check('fallback templates are gone, REBODY_TEMPLATES is the only silhouette source; no ResizeObserver, import, shadow DOM, backdrop-filter or viewport units in the module',
    !/fxFallbackTemplates|BEGIN FALLBACK|FX_FALLBACK_Z|TEMPLATE_OF/.test(source) && /const REBODY_TEMPLATES = /.test(source)
    && !/ResizeObserver|attachShadow|^\s*import\s|backdrop-filter|\d(vw|vh)\b/m.test(source.replace(/\/\/[^\n]*/g, '')), '');
  check('the generated tables sit once in the header block and nowhere else (MODE_IDS, TUNE_NOTE_MAX, Z_TABLE)',
    ['const MODE_IDS = ', 'const TUNE_NOTE_MAX = ', 'const Z_TABLE = '].every(k => source.split(k).length === 2), '');
  const { ctx, page } = await fopen({ motion: 'calm' });
  const T = await page.evaluate(() => { const v = document.querySelector('re-body-view'); return { n: v.fx.T.length, depth: v.fx.T.map(t => [...t.depth]), names: v.fx.T.map(t => t.name) }; });
  check('11 silhouettes in anchor order, depth of every path equals plugin/bodies.json zTable (single source)', T.n === 11 && JSON.stringify(T.depth) === JSON.stringify(ZT) && T.names.join() === bodies.bodies.map(b => b.name).join(), T.names.join());
  // ghosts follow their own line without any other event (field worker patches in the panel)
  const ghost = () => page.evaluate(() => { const v = document.querySelector('re-body-view'), g = v.fx.ghost[0]; return { d: g.path.getAttribute('d'), w: g.path.getAttribute('stroke-width'), line: g.hit.dataset.index }; });
  const g0 = await ghost();
  await hostSet(page, 'param30', 7); await sleep(150);   // line B (ghost slot 0) morph: Bass Drum -> Clarinet
  const g1 = await ghost();
  await hostSet(page, 'param28', 5); await sleep(150);   // line B Tune
  const g2 = await ghost();
  await hostSet(page, 'param31', 1); await sleep(150);   // line B Enable on: full stroke
  const g3 = await ghost();
  check('inactive line B: Morph, Tune and Enable move its ghost at once (touchField for inactive lines)', g0.line === '1' && g1.d !== g0.d && g2.d !== g1.d && g0.w === '.7' && g3.w === '1.1', JSON.stringify({ w: [g0.w, g3.w], same: [g1.d === g0.d, g2.d === g1.d] }));
  // the sound readout (note, seconds) appears exactly once, under the caption
  await page.evaluate(() => { window.__tel = setInterval(() => { const A = new Array(24).fill(0); A[0] = .2; A[2] = .2; A[5] = 220; A[6] = .8; window.mock.emit('lineStateA', A); window.mock.emit('bodyViz', [.3, .3, .2, .2]); }, 33); });
  await sleep(400);
  const once = await page.evaluate(() => ({ n: (document.querySelector('re-body-view').textContent.match(/A3 · 0\.80 s/g) || []).length, caption: document.querySelector('.body-caption').textContent, under: document.querySelector('.body-follow').textContent, capBottom: document.querySelector('.body-caption').getBoundingClientRect().bottom, followTop: document.querySelector('.body-follow').getBoundingClientRect().top }));
  check('note and seconds ("A3 · 0.80 s") appear exactly once, in the line under the caption; the caption itself keeps only the instrument name', once.n === 1 && once.under.startsWith('A3 · 0.80 s') && !/\d/.test(once.caption) && once.followTop >= once.capBottom - 1, JSON.stringify(once));
  await page.evaluate(() => clearInterval(window.__tel));
  await ctx.close();
}

// ================================================================ U6: chain thread in the field (layer 3 = ghost near)
{
  const { ctx, page } = await fopen({ motion: 'calm', overrides: { param31: 1, param54: 1 } });
  const thread = () => page.evaluate(() => {
    const v = document.querySelector('re-body-view'), fx = v.fx, out = {};
    for (const el of document.querySelectorAll('.field .chain')) {
      const m = /^M([\d.-]+),([\d.-]+)Q([\d.-]+),([\d.-]+) ([\d.-]+),([\d.-]+)$/.exec(el.getAttribute('d') || '');
      out[el.dataset.chain] = { shown: getComputedStyle(el).display !== 'none', d: el.getAttribute('d') || '', from: el.dataset.from, to: el.dataset.to, pts: m ? m.slice(1).map(Number) : null, so: el.getAttribute('stroke-opacity'), layer: el.closest('.layer').dataset.layer, pe: getComputedStyle(el).pointerEvents };
    }
    return { out, body: [fx.bx0, fx.bx1], ghosts: fx.ghost.map(g => [g.x0, g.x1]), active: v.activeLine, layers: document.querySelectorAll('.field .scene > .layer').length };
  });
  let t = await thread();
  check('no chain thread while no line listens to Chain (both paths hidden, no geometry)', Object.keys(t.out).length === 2 && !t.out[1].shown && !t.out[2].shown && t.out[1].d === '' && t.out[2].d === '', JSON.stringify(t.out));
  await hostSet(page, 'param10', 6); await sleep(150);   // line A Listen = Chain: A has no source, it falls back to All
  t = await thread();
  check('Listen = Chain on line A draws nothing (no previous line, falls back to All)', !t.out[1].shown && !t.out[2].shown, JSON.stringify(t.out));
  await hostSet(page, 'param10', 0);
  await hostSet(page, 'param33', 6); await sleep(150);   // B Listen = Chain, A active: thread from the active body to the ghost of B (slot 0, left)
  t = await thread();
  const [b0, b1] = t.body, [gb0, gb1] = t.ghosts[0], p1 = t.out[1].pts;
  check('B listens to Chain, A active: faint dotted arc in layer 3 (ghost near) from the active body (A) to the B ghost; line C stays hidden',
    t.out[1].shown && !t.out[2].shown && t.out[1].layer === 'ghostNear' && t.out[1].from === 'A' && t.out[1].to === 'B' && p1 && p1.every(Number.isFinite)
    && p1[0] >= b0 - .2 && p1[0] <= b1 + .2 && p1[4] >= gb0 - .2 && p1[4] <= gb1 + .2 && p1[3] < p1[1] && p1[3] >= 0 && t.out[1].pe === 'none' && t.layers === 11, JSON.stringify({ pts: p1, body: t.body, ghost: t.ghosts[0], layers: t.layers }));
  const so1 = Number(t.out[1].so);
  await hostSet(page, 'param31', 0); await sleep(150);   // B disabled: the thread gets dimmer
  t = await thread();
  check('the thread is dimmer while the listening line is switched off', Number(t.out[1].so) < so1 && Number(t.out[1].so) > 0, `${so1} -> ${t.out[1].so}`);
  await hostSet(page, 'param31', 1);
  await hostSet(page, 'param56', 6); await sleep(150);   // C also chained: B -> C between the two ghosts
  t = await thread();
  const q = t.out[2].pts;
  check('C listens to Chain too (A active): second arc from the B ghost to the C ghost (ghost to ghost), apex stays inside the field',
    t.out[2].shown && t.out[2].from === 'B' && t.out[2].to === 'C' && q && q[0] >= t.ghosts[0][0] - .2 && q[0] <= t.ghosts[0][1] + .2 && q[4] >= t.ghosts[1][0] - .2 && q[4] <= t.ghosts[1][1] + .2 && (q[1] + q[3]) / 2 >= 8, JSON.stringify(q));
  await page.click('.body-tabname >> nth=1'); await sleep(200);   // B active: the thread now comes from the A ghost into the active B body; C <- B goes out to the C ghost
  t = await thread();
  const ghostA = t.ghosts[0], ghostC = t.ghosts[1], pa = t.out[1].pts, pc = t.out[2].pts;
  check('B active and chained: thread from the ghost of A (slot 0) into the active body; C chained from the active body to the C ghost (slot 1)',
    t.active === 'B' && t.out[1].from === 'A' && t.out[1].to === 'B' && pa[0] >= ghostA[0] - .2 && pa[0] <= ghostA[1] + .2 && pa[4] >= t.body[0] - .2 && pa[4] <= t.body[1] + .2
    && t.out[2].from === 'B' && t.out[2].to === 'C' && pc[0] >= t.body[0] - .2 && pc[0] <= t.body[1] + .2 && pc[4] >= ghostC[0] - .2 && pc[4] <= ghostC[1] + .2, JSON.stringify({ pa, pc, body: t.body, ghosts: t.ghosts }));
  await hostSet(page, 'param33', 1); await hostSet(page, 'param56', 2); await sleep(150);
  t = await thread();
  check('threads disappear again when Listen leaves Chain (host automation)', !t.out[1].shown && !t.out[2].shown && t.out[1].d === '' && t.out[2].d === '', JSON.stringify(t.out));
  // follows the active body while the morph moves
  await page.click('.body-tabname >> nth=0'); await hostSet(page, 'param33', 6); await sleep(120);
  const before = (await thread()).out[1].pts[0];
  await hostSet(page, 'param4', 0); await sleep(500);   // A morphs Clarinet -> Bass Drum: the body outline (and the thread end) move
  const after = (await thread()).out[1].pts[0];
  check('the thread end follows the active body when its morph / size changes', Math.abs(after - before) > 10, `${before} -> ${after}`);
  await ctx.close();
}

// ================================================================ U6: strip 2 MORE / LESS (UI-only, stored preference, default expanded)
{
  const { ctx, page } = await fopen({ motion: 'calm' });
  const state = () => page.evaluate(() => {
    const sets = [...document.querySelectorAll('.body-strip2')], rect = id => document.querySelector(`[data-param="${id}"]`).getBoundingClientRect();
    const hiddenOther = [...document.querySelectorAll('[data-lineset]')].filter(n => !n.classList.contains('body-strip2') && n.hidden && n.dataset.lineset === 'A').length;
    const btn = document.querySelector('[data-more]');
    return { strip2Hidden: sets.map(n => n.hidden), aOthersHidden: hiddenOther, text: btn.textContent, expanded: btn.getAttribute('aria-expanded'), pos: rect('param16').width > 0, dial: rect('param14').width > 0, params: document.querySelectorAll('[data-param]').length, ids: new Set([...document.querySelectorAll('[data-param]')].map(n => n.dataset.param)).size,
      stored: (() => { try { return localStorage.getItem('rebody.strip2'); } catch { return 'blocked'; } })(), sent: window.mock.sent.length, hasParam: btn.closest('[data-param]') !== null || btn.hasAttribute('data-param'), h: btn.getBoundingClientRect().height, bottom: btn.getBoundingClientRect().bottom };
  });
  let s = await state();
  check('strip 2 is expanded by default: MORE / LESS button reads LESS (aria-expanded true), contact / body / physics visible', s.strip2Hidden.join() === 'false,true,true' && s.text === 'LESS' && s.expanded === 'true' && s.pos && s.stored === null, JSON.stringify(s));
  const s0 = s;
  await page.click('[data-more]'); await sleep(60);
  s = await state();
  check('collapsed: `hidden` on strip 2 only (all three line sets), deck / strip 1 / globals stay, button reads MORE, 73 data-param still in the DOM exactly once, nothing sent to the host, preference stored',
    s.strip2Hidden.join() === 'true,true,true' && !s.pos && s.dial && s.text === 'MORE' && s.expanded === 'false' && s.params === 73 && s.ids === 73 && s.stored === 'collapsed' && s.sent === 0 && !s.hasParam && s.aOthersHidden === 0, JSON.stringify(s));
  const hiddenNow = await page.evaluate(() => [...document.querySelectorAll('[data-lineset]')].filter(n => n.hidden).map(n => n.className.split(' ')[0] + ':' + n.dataset.lineset).sort().join());
  check('line sets hidden = the inactive lines plus strip 2 of line A; morph row, deck and strip 1 of A stay', hiddenNow.split(',').includes('body-strip2:A') && !/body-(morphrow|deckline|strip1):A/.test(hiddenNow) && hiddenNow.split(',').length === 9, hiddenNow);
  await page.click('.body-tabname >> nth=1'); await sleep(60);
  const tabB = await page.evaluate(() => ({ strip2: [...document.querySelectorAll('.body-strip2')].map(n => n.hidden).join(), deckB: !document.querySelector('.body-deckline[data-lineset="B"]').hidden }));
  check('switching to line B while collapsed keeps strip 2 hidden and shows the rest of the B set', tabB.strip2 === 'true,true,true' && tabB.deckB, JSON.stringify(tabB));
  await page.click('.body-tabname >> nth=0');
  // stored preference survives a reload (new page in the same browser context)
  const page2 = await ctx.newPage();
  page2.on('pageerror', e => errors.push('page2 pageerror: ' + e.message));
  await page2.goto(`http://127.0.0.1:${port}/page.html`); await page2.waitForFunction(() => window.ready === true); await sleep(300);
  const reload = await page2.evaluate(() => ({ hidden: [...document.querySelectorAll('.body-strip2')].map(n => n.hidden).join(), text: document.querySelector('[data-more]').textContent }));
  check('the collapsed state is a stored preference: a fresh load starts collapsed (MORE)', reload.hidden === 'true,true,true' && reload.text === 'MORE', JSON.stringify(reload));
  await page2.click('[data-more]'); await sleep(60);
  const expanded = await page2.evaluate(() => ({ hidden: [...document.querySelectorAll('.body-strip2')].map(n => n.hidden).join(), stored: localStorage.getItem('rebody.strip2'), pos: document.querySelector('[data-param="param16"]').getBoundingClientRect().width > 0 }));
  check('MORE then LESS: clicking expands again, strip 2 is back and the stored preference follows', expanded.hidden === 'false,true,true' && expanded.stored === 'expanded' && expanded.pos, JSON.stringify(expanded));
  // keyboard: Enter on the focused button toggles; collapsing while focus is inside strip 2 moves focus to the button
  await page2.focus('[data-more]'); await page2.keyboard.press('Enter'); await sleep(40);
  const kb = await page2.evaluate(() => document.querySelector('[data-more]').textContent);
  await page2.keyboard.press('Enter'); await sleep(40);
  await page2.focus('[data-param="param16"] .body-dial');
  await page2.evaluate(() => window.view.setStrip2Collapsed(true)); await sleep(40);
  const focus = await page2.evaluate(() => ({ active: document.activeElement.dataset.more !== undefined, hidden: document.querySelector('.body-strip2').hidden }));
  check('keyboard: Enter toggles the focused MORE / LESS button; collapsing with focus inside strip 2 hands focus to the button', kb === 'MORE' && focus.active && focus.hidden, JSON.stringify({ kb, focus }));
  check('MORE / LESS button: >= 24 px high and inside the chassis', s0.h >= 24 && s0.bottom <= 600, `${s0.h} / ${s0.bottom}`);
  await page2.close();
  await ctx.close();
}

// ================================================================ U6: Copy A -> B / C with one-step undo, Enable targets, keys 1 / 2 / 3
{
  const { ctx, page } = await fopen({ motion: 'calm', overrides: { param28: 70, param29: 20, param30: 5, param37: 10, param31: 1, param48: 1 } });
  const Bkeys = Array.from({ length: 23 }, (_, i) => 'param' + (28 + i)).filter(id => id !== 'param31' && id !== 'param48');
  const sentIds = () => page.evaluate(() => window.mock.sent.map(s => s.id));
  const undo = () => page.evaluate(() => { const b = document.querySelector('[data-undo]'), r = b.getBoundingClientRect(); return { hidden: b.hidden, h: r.height, w: r.width, text: b.textContent, label: b.getAttribute('aria-label'), copyLabel: getComputedStyle(b.parentElement, '::before').display }; });
  check('UNDO is not shown before any copy', (await undo()).hidden === true, '');
  await page.evaluate(() => { window.mock.sent.length = 0; window.mock.gestures.length = 0; });
  await page.click('[data-copy="B"]');
  const copy = await page.evaluate(() => ({ sent: window.mock.sent.length, starts: window.mock.gestures.filter(g => g[0] === 'start').length, snap: window.view.copySnap && { dst: window.view.copySnap.dst, n: window.view.copySnap.values.length, tune: window.view.copySnap.values.find(v => v[0] === 'Tune')[1], decay: window.view.copySnap.values.find(v => v[0] === 'Decay')[1], morph: window.view.copySnap.values.find(v => v[0] === 'Morph')[1], hasEnable: window.view.copySnap.values.some(v => ['Enable', 'Hold'].includes(v[0])) } }));
  const u = await undo();
  check('Copy A->B keeps a snapshot of B\'s 21 values (no Enable / Hold) and shows an UNDO button (>= 24 px, labelled for the copy)',
    copy.sent === 21 && copy.starts === 21 && copy.snap.dst === 'B' && copy.snap.n === 21 && copy.snap.tune === 70 && copy.snap.decay === 20 && copy.snap.morph === 5 && !copy.snap.hasEnable && !u.hidden && u.text === 'UNDO' && u.h >= 24 && u.w >= 24 && /copy of line A to line B/.test(u.label), JSON.stringify({ copy, u }));
  const hdr = await page.evaluate(() => { const hd = document.querySelector('.body-header'), kids = [...hd.children].map(c => c.getBoundingClientRect()).sort((a, b) => a.left - b.left); let overlap = 0; for (let i = 1; i < kids.length; i++) if (kids[i].left < kids[i - 1].right - .5) overlap++; return { overlap, right: kids.at(-1).right, limit: hd.getBoundingClientRect().right, scroll: [hd.scrollWidth, hd.clientWidth] }; });
  check('header with UNDO visible: children do not overlap and end inside the content width (the COPY label makes room)', hdr.overlap === 0 && hdr.right <= hdr.limit + .5 && hdr.scroll[0] <= hdr.scroll[1] && u.copyLabel === 'none', JSON.stringify({ hdr, label: u.copyLabel }));
  await page.evaluate(() => { window.mock.sent.length = 0; window.mock.gestures.length = 0; });
  await page.click('[data-undo]'); await sleep(60);
  const un = await page.evaluate(() => ({ sent: window.mock.sent.map(s => [s.id, s.v]), starts: window.mock.gestures.filter(g => g[0] === 'start').length, ends: window.mock.gestures.filter(g => g[0] === 'end').length, vals: Object.fromEntries(['param28', 'param29', 'param30', 'param37'].map(id => [id, window.mock.sent.find(s => s.id === id)?.v])), snap: window.view.copySnap }));
  const u2 = await undo();
  check('UNDO writes B\'s 21 old values back (Tune 70, Decay 20, Morph 5, Material 10), one gesture each, resent even where equal; the button goes away; Enable / Hold untouched',
    un.sent.length === 21 && un.starts === 21 && un.ends === 21 && un.vals.param28 === 70 && un.vals.param29 === 20 && un.vals.param30 === 5 && un.vals.param37 === 10 && !un.sent.some(([id]) => ['param31', 'param48'].includes(id)) && Bkeys.every(id => un.sent.some(([i]) => i === id)) && u2.hidden && un.snap === null, JSON.stringify({ n: un.sent.length, vals: un.vals, hidden: u2.hidden }));
  // one step only: a second copy replaces the snapshot
  await page.click('[data-copy="B"]'); await page.click('[data-copy="C"]');
  const two = await page.evaluate(() => ({ dst: window.view.copySnap.dst, n: window.view.copySnap.values.length }));
  check('undo is one step: a second Copy (A->C) replaces the snapshot, UNDO now restores C only', two.dst === 'C' && two.n === 21 && !(await undo()).hidden, JSON.stringify(two));
  await page.evaluate(() => { window.mock.sent.length = 0; });
  await page.click('[data-undo]'); await sleep(40);
  const ids = await sentIds();
  check('UNDO after A->C touches only line C (param51..73 without Enable / Hold)', ids.length === 21 && ids.every(id => Number(id.slice(5)) >= 51 && !['param54', 'param71'].includes(id)), ids.join());
  // 10 s timer
  await page.click('[data-copy="B"]'); const t0 = Date.now();
  await sleep(8500);
  const still = (await undo()).hidden;
  await page.waitForFunction(() => document.querySelector('[data-undo]').hidden === true, null, { timeout: 4000 });
  const gone = Date.now() - t0;
  const snapGone = await page.evaluate(() => window.view.copySnap);
  check('UNDO stays for 10 s and then goes away by itself (still visible at 8.5 s, gone between 9.8 and 10.8 s, snapshot dropped)', still === false && gone >= 9800 && gone <= 10800 && snapGone === null, `gone after ${gone} ms`);
  // teardown clears the timer
  await page.click('[data-copy="B"]');
  const timer = await page.evaluate(() => { const v = window.view; v.remove(); return { t: v._undoTimer, snap: v.copySnap }; });
  check('teardown clears the undo timer and the snapshot', timer.t === 0 && timer.snap === null, JSON.stringify(timer));
  await ctx.close();
}
{
  const { ctx, page } = await fopen({ motion: 'calm', overrides: { param31: 1 } });
  // Enable buttons >= 24 px, tabs name buttons >= 24 px, at the design size
  const targets = await page.evaluate(() => ({ enable: ['param8', 'param31', 'param54'].map(id => { const r = document.querySelector(`[data-param="${id}"] button`).getBoundingClientRect(); return [r.width, r.height]; }), tab: [...document.querySelectorAll('.body-tabname')].map(b => { const r = b.getBoundingClientRect(); return [r.width, r.height]; }), copy: [...document.querySelectorAll('.body-copybtn:not([hidden])')].map(b => b.getBoundingClientRect().height) }));
  check('Enable buttons (x3) and tab name buttons are >= 24 x 24 px, Copy buttons >= 24 px high', targets.enable.every(([w, h]) => w >= 24 && h >= 24) && targets.tab.every(([w, h]) => w >= 24 && h >= 24) && targets.copy.every(h => h >= 24), JSON.stringify(targets));
  const active = () => page.evaluate(() => ({ line: document.querySelector('re-body-view').activeLine, sel: [...document.querySelectorAll('.body-tabname')].map(n => n.getAttribute('aria-selected')).join(), sets: ['A', 'B', 'C'].map(l => [...document.querySelectorAll(`[data-lineset="${l}"]`)].every(n => !n.hidden || n.classList.contains('body-strip2'))).join() }));
  await page.focus('[data-param="param14"] .body-dial');
  await page.keyboard.press('2'); await sleep(40); let a = await active();
  check('key 2 with a dial focused selects tab B (aria-selected, B set shown)', a.line === 'B' && a.sel === 'false,true,false' && a.sets === 'false,true,false', JSON.stringify(a));
  await page.keyboard.press('3'); await sleep(40); a = await active();
  check('key 3 selects tab C', a.line === 'C' && a.sel === 'false,false,true', JSON.stringify(a));
  await page.keyboard.press('1'); await sleep(40); a = await active();
  check('key 1 selects tab A again', a.line === 'A' && a.sel === 'true,false,false', JSON.stringify(a));
  for (const combo of ['Control+2', 'Alt+3', 'Meta+2']) await page.keyboard.press(combo);
  await sleep(40); a = await active();
  check('keys with Ctrl / Alt / Meta do not switch lines', a.line === 'A', JSON.stringify(a));
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.mouse.click(8, 300); await sleep(30);   // empty panel margin: the panel (tabindex -1) takes focus, so the keys work after any click
  const foc = await page.evaluate(() => document.activeElement.className);
  await page.keyboard.press('2'); await sleep(40); a = await active();
  check('a click on empty panel area focuses the panel (tabindex -1) and key 2 still selects B', /body-panel/.test(foc) && a.line === 'B', `${foc} -> ${a.line}`);
  await page.keyboard.press('1');
  await page.click('[data-param="param1"] .body-value'); await page.keyboard.type('2'); await sleep(40);
  a = await active();
  const typed = await page.inputValue('.body-editor');
  await page.keyboard.press('Escape');
  check('typing 2 inside the value editor does not switch lines', a.line === 'A' && /2$/.test(typed), `${a.line} ${typed}`);
  await ctx.close();
}

// ================================================================ U7: scaling against 07_SCALING and the upstream sandbox rules
{
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'plugin/RE_BODY.cmajorpatch'), 'utf8'));
  const lines = source.split('\n');
  check('// WINDOW SIZE: 960x600 is line 2 of plugin/index.js and matches the manifest view and spec.json (960 x 600, resizable)',
    lines[1] === '// WINDOW SIZE: 960x600' && manifest.view.width === 960 && manifest.view.height === 600 && manifest.view.resizable === true && manifest.view.src === 'index.js' && spec.plugin.view.width === 960 && spec.plugin.view.height === 600, `${lines[1]} | ${JSON.stringify(manifest.view)}`);
  check('module is one ES module: ends with // END_AMORPH_UI, exactly one export default createPatchView(patchConnection), no import / require', source.trimEnd().endsWith('// END_AMORPH_UI') && source.split('export default function createPatchView(patchConnection)').length === 2 && !/^\s*import\b|\brequire\s*\(/m.test(source), '');
  const { ctx, page } = await fopen({ motion: 'calm' });
  const lis = await page.evaluate(() => ({ lis: window.__mountLis.slice(), ro: window.__ro, classes: document.querySelector('re-body-view').className, shadow: !!document.querySelector('re-body-view').shadowRoot }));
  const adds = lis.lis.filter(l => l[0] === 'add' && (l[1] === 'window' || l[1] === 'document'));   // the slice recorded during the synchronous mount (the test harness's own listeners are not in it)
  check('sandbox: the only window / document level listener is `resize` (documented); no ResizeObserver is ever constructed; light DOM with the patch-root class on the host', adds.length === 1 && adds[0][1] === 'window' && adds[0][2] === 'resize' && lis.ro === 0 && /patch-root/.test(lis.classes) && !lis.shadow, JSON.stringify({ adds, ro: lis.ro, cls: lis.classes }));
  const css = await page.evaluate(() => { const h = document.querySelector('re-body-view'), cs = getComputedStyle(h), p = getComputedStyle(document.querySelector('.body-panel')); return { bg: cs.backgroundColor, display: cs.display, overflow: cs.overflow, w: h.style.width, hh: h.style.height, panelPos: p.position, panelOverflow: p.overflow, htmlOverflow: getComputedStyle(document.documentElement).overflow, bodyOverflow: getComputedStyle(document.body).overflow, sbw: getComputedStyle(document.documentElement, '::-webkit-scrollbar').width, zoomProp: document.querySelector('.body-panel').style.zoom, transform: document.querySelector('.body-panel').style.transform }; });
  check('07 chassis: host is a transparent flex centre sized in px by JS (overflow hidden), the chassis is position:relative with `zoom` and no transform, html / body overflow hidden, scrollbars hidden',
    css.bg === 'rgba(0, 0, 0, 0)' && css.display === 'flex' && css.overflow === 'hidden' && css.w === '960px' && css.hh === '600px' && css.panelPos === 'relative' && css.panelOverflow === 'hidden' && css.htmlOverflow === 'hidden' && css.bodyOverflow === 'hidden' && css.zoomProp === '1' && css.transform === '' && css.sbw === '0px', JSON.stringify(css));
  // teardown removes the resize listener (and only that one)
  const rem = await page.evaluate(() => { const m = window.__lis.length; window.view.remove(); return window.__lis.slice(m).filter(l => l[0] === 'remove' && (l[1] === 'window' || l[1] === 'document')); });
  check('teardown removes the window resize listener', rem.length === 1 && rem[0][1] === 'window' && rem[0][2] === 'resize', JSON.stringify(rem));
  await ctx.close();
}
{
  // off-aspect window (07 checklist 7): no visible box around the chassis, no scrollbars, centred; shrink and enlarge keep the proportion
  const { ctx, page } = await fopen({ w: 1300, h: 950, motion: 'calm' });
  const m = await page.evaluate(() => { const p = document.querySelector('.body-panel'), r = p.getBoundingClientRect(), h = document.querySelector('re-body-view').getBoundingClientRect(); return { zoom: p.style.zoom, rect: [r.left, r.top, r.width, r.height], host: [h.left, h.top, h.width, h.height], sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, cw: document.documentElement.clientWidth, ch: document.documentElement.clientHeight }; });
  const pix = async (x, y) => {
    const buf = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });
    return page.evaluate(async b64 => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = 1; c.height = 1; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return [...x.getImageData(0, 0, 1, 1).data].slice(0, 3); }, buf.toString('base64'));
  };
  const outside = await pix(650, 20), outsideBottom = await pix(650, 940);
  check('off-aspect 1300x950: zoom 1.35, chassis 1296 x 810 centred, host fills the window, no scrollbars', m.zoom === '1.35' && Math.abs(m.rect[2] - 1296) < 1 && Math.abs(m.rect[3] - 810) < 1 && Math.abs(m.rect[0] - 2) < 1 && Math.abs(m.rect[1] - 70) < 1 && m.host[2] === 1300 && m.host[3] === 950 && m.sw <= m.cw && m.sh <= m.ch && m.cw === 1300, JSON.stringify(m));
  check('off-aspect: the unused area is the page background (#222), not a host box (transparent host, 07 "visible background box")', outside.join() === '34,34,34' && outsideBottom.join() === '34,34,34', `${outside} / ${outsideBottom}`);
  await page.setViewportSize({ width: 700, height: 600 }); await sleep(450);
  const narrow = await page.evaluate(() => {
    const p = document.querySelector('.body-panel'), r = p.getBoundingClientRect();
    const out = [...document.querySelectorAll('.control:not([hidden] *)')].filter(c => c.getBoundingClientRect().width > 0 && (c.getBoundingClientRect().left < 0 || c.getBoundingClientRect().right > innerWidth || c.getBoundingClientRect().top < 0 || c.getBoundingClientRect().bottom > innerHeight)).length;
    return { zoom: p.style.zoom, cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height, clipped: out, sw: document.documentElement.scrollWidth };
  });
  check('shrinking horizontally: proportional (zoom 0.729 -> 0.75 on the 0.05 raster), centred; the rounding overshoot (<= 2.5 %) only eats the chassis padding: no control is clipped, no scrollbar',
    narrow.zoom === '0.75' && Math.abs(narrow.cx - 350) < 1 && Math.abs(narrow.cy - 300) < 1 && Math.abs(narrow.w - 720) < 1 && Math.abs(narrow.h - 450) < 1 && narrow.clipped === 0 && narrow.sw <= 700, JSON.stringify(narrow));
  await ctx.close();
}
{
  // measured effective zoom (07 gotcha 2) and the wrapper walk-up (07 host-wrapper cleanup), with a stand-in for Amorph's wrapper
  const { ctx, page } = await fopen({ motion: 'calm' });
  await page.evaluate(() => {
    const v = window.view, w = document.createElement('div');
    w.id = 'wrap'; w.style.cssText = 'position:absolute;left:0;top:0;width:960px;height:600px;transform:scale(.9);transform-origin:0 0;overflow:auto;margin:5px;padding:3px';
    document.body.appendChild(w); w.appendChild(v);   // moves the element: disconnect + connect, one clean remount inside the wrapper
  });
  await sleep(500);
  const e = await page.evaluate(() => { const v = window.view, w = document.getElementById('wrap'), r = v.panel.getBoundingClientRect(); return { eff: v.eff, zoom: v.panel.style.zoom, hostW: parseFloat(v.style.width), vis: r.width, visH: r.height, wrap: [w.style.overflow, w.style.margin, w.style.padding], fits: r.width <= 960.5 && r.height <= 600.5 }; });
  check('measured eff: with a wrapper that renders the host at 0.9 the probe finds eff 0.9, host px and zoom are compensated (zoom 1.1) and the chassis still fills the window (>= 98 %)',
    Math.abs(e.eff - .9) < .01 && e.zoom === '1.1' && Math.abs(e.hostW - 960 / .9) < 1 && e.vis >= 940 && e.fits, JSON.stringify(e));
  check('wrapper walk-up: the wrapper between body and host gets overflow hidden, margin 0 and padding 0', e.wrap.join() === 'hidden,0px,0px', e.wrap.join());
  await page.evaluate(() => { document.getElementById('wrap').style.transform = 'scale(1)'; });   // host-zoom changes without a resize event
  await sleep(700);
  const e2 = await page.evaluate(() => ({ eff: window.view.eff, zoom: window.view.panel.style.zoom }));
  check('the 250 ms re-measure notices a host scale change without any resize event (eff back to 1, zoom 1)', Math.abs(e2.eff - 1) < .01 && e2.zoom === '1', JSON.stringify(e2));
  await ctx.close();
}
{
  // 07 section 3 (render suspension during resize drags, with 11 compositing layers): a drag of 12 resize events 35 ms apart
  const { ctx, page } = await fopen({ motion: 'full', overrides: {} });
  await page.evaluate(() => {
    window.__level = .2;
    window.__feed = setInterval(() => {
      const a = window.__level, t = performance.now() / 1000;
      window.mock.emit('bodyViz', [a, a, .2 * a, .2 * a]);
      window.mock.emit('bodyBands', [.6, .5, .4, .3 + .2 * Math.sin(t * 5), .2, .15, .1, .05].map(x => x * a));
      window.mock.emit('lineModesA', Array.from({ length: 16 }, (_, i) => (i % 3 === 0 ? .5 : .05) * a * (1 + Math.sin(t * 4 + i) * .3)));
    }, 33);
    window.__draws = 0; window.__writes = { panel: 0, host: 0 };
    new MutationObserver(l => { window.__draws += l.length; }).observe(document.querySelector('.field [data-contour="0"]'), { attributes: true, attributeFilter: ['d'] });
    new MutationObserver(l => { window.__writes.panel += l.length; }).observe(window.view.panel, { attributes: true, attributeFilter: ['style'] });
    new MutationObserver(l => { window.__writes.host += l.length; }).observe(window.view, { attributes: true, attributeFilter: ['style'] });
    window.addEventListener('resize', () => { window.__lastEv = performance.now(); });
  });
  await page.mouse.move(700, 200, { steps: 4 });
  await sleep(500);
  const snap = () => page.evaluate(() => { const v = window.view; return { frames: v.motion.frames, susp: v.motion.suspended, rafPending: v.motion._raf, resizing: v.resizing(), zoom: v.panel.style.zoom, hostW: parseFloat(v.style.width), draws: window.__draws, raf: window.__raf.n, writes: { ...window.__writes }, meter: v.querySelector('[data-meter] .body-meter-bar i').style.getPropertyValue('--lv'), stale: v.stale }; });
  const s0 = await snap();
  let s1 = null, s2 = null;
  for (let i = 1; i <= 12; i++) {
    if (i === 1) await page.evaluate(() => { window.__level = .9; });   // the signal changes during the drag: the meters must wait for the settle
    await page.setViewportSize({ width: 960 + 40 * i, height: 600 + 25 * i });
    if (i === 3) s1 = await snap();
    await sleep(35);
  }
  s2 = await snap();
  check('during a resize drag the motion controller is suspended: no frame is requested, none is rendered (frames and pending rAF stay put)', s0.susp === false && s1.susp === true && s2.susp === true && s2.frames === s1.frames && s2.rafPending === 0, JSON.stringify({ s0: s0.frames, s1: s1.frames, s2: s2.frames, susp: [s1.susp, s2.susp] }));
  check('during the drag the field is not redrawn (no `d` rewrite, no rAF request) although telemetry keeps arriving at 30 Hz, and the meters do not move', s2.draws === s1.draws && s2.raf === s1.raf && s2.meter === s1.meter && s2.stale === true, JSON.stringify({ draws: [s1.draws, s2.draws], raf: [s1.raf, s2.raf], meter: [s1.meter, s2.meter] }));
  check('per resize event only the host size is written (inline px follow the window), the chassis zoom is not touched until the settle', s2.resizing === true && s2.zoom === '1' && s2.hostW === 960 + 40 * 12 && s2.writes.panel === s1.writes.panel && s2.writes.host > s1.writes.host, JSON.stringify({ zoom: s2.zoom, hostW: s2.hostW, writes: [s1.writes, s2.writes] }));
  await page.waitForFunction(() => window.view.motion.suspended === false, null, { timeout: 3000 });
  const resumeAfter = await page.evaluate(() => performance.now() - window.__lastEv);
  await sleep(250);
  const s3 = await snap();
  check('after the last resize event the settle timer (190 ms) resumes the controller once: zoom applied (1.5), field redrawn, meters repainted, motion frames flow again',
    resumeAfter >= 150 && resumeAfter <= 450 && s3.zoom === '1.5' && s3.draws > s2.draws && s3.meter !== s2.meter && s3.frames > s2.frames && s3.susp === false && s3.stale === false, JSON.stringify({ resumeAfter: Math.round(resumeAfter), zoom: s3.zoom, draws: [s2.draws, s3.draws], meter: [s2.meter, s3.meter], frames: [s2.frames, s3.frames] }));
  await page.evaluate(() => clearInterval(window.__feed));
  await ctx.close();
}

// ================================================================ screenshots (--shots): Clarinet, Calm, tilted, fake audio; B enabled and chained so the thread shows
async function shot(width, height, file) {
  const { ctx, page } = await fopen({ w: width, h: height, motion: 'calm', overrides: { param2: 62, param24: 40, param15: 25, param18: 70, param27: -30, param9: -6, param12: 3, param31: 1, param33: 6, param54: 1 } });
  await page.evaluate(() => {
    const m = window.mock; let t = 0;
    window.__tele = setInterval(() => {
      t += 0.1;
      const pulse = 0.5 + 0.5 * Math.sin(t);
      m.emit('bodyViz', [0.35 * pulse + 0.1, 0.25 * pulse + 0.05, 0.3, 0.25]);
      m.emit('bodyBands', [0.1, 0.3 * pulse, 0.5, 0.35, 0.25 * pulse, 0.12, 0.06, 0.02]);
      m.emit('bodyOnset', [pulse > 0.95 ? 1 : 0]);
      m.emit('analysisViz', [0.3 * pulse, 0.4, 0.3, 0.35, 0.15, 0.8]);
      const A = new Array(24).fill(0); A[0] = 0.3; A[1] = 0.4 * pulse; A[2] = 0.25 * pulse + 0.1; A[3] = 220; A[5] = 220; A[6] = 0.9; A[8] = 7; A[9 + 7] = 1; m.emit('lineStateA', A);
      const B = new Array(24).fill(0); B[0] = 0.1; B[2] = 0.15 * pulse; m.emit('lineStateB', B); m.emit('lineStateC', new Array(24).fill(0));
      m.emit('lineModesA', Array.from({ length: 16 }, (_, i) => i < 4 ? 0.5 * pulse / (1 + i) : 0));
    }, 33);
  });
  await page.mouse.move(width * .9, height * .22, { steps: 8 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: file });
  await ctx.close();
}
if (SHOTS) {
  fs.mkdirSync(path.join(ROOT, 'docs/dev/screens'), { recursive: true });
  await shot(960, 600, path.join(ROOT, 'docs/dev/screens/p6_final_960.png'));
  await shot(480, 300, path.join(ROOT, 'docs/dev/screens/p6_final_480.png'));
  console.log('screenshots written: docs/dev/screens/p6_final_960.png, p6_final_480.png');
}

// ================================================================ console
check('no console errors / warnings / page errors in the whole run', errors.length === 0, errors.slice(0, 5).join(' | '));
await browser.close(); server.close();
const failed = results.filter(r => !r.ok);
console.log(`\nSMOKE: ${results.length - failed.length}/${results.length} checks passed${failed.length ? '; FAILED: ' + failed.map(f => f.name.slice(0, 80)).join(' ; ') : ''}`);
process.exit(failed.length ? 1 : 0);
