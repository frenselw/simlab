#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path"), { spawn } = require("node:child_process");
const H = require("./position-time-browser-regression.js");
const root = path.resolve(__dirname, ".."), slug = "centripetal-force-investigation-lab", tempRoot = os.tmpdir();
const pause = H.delay;
async function ready(cdp) {
  for (let i = 0; i < 100; i++) {
    if (await H.evaluate(cdp, "Boolean(window.__centripetalApp?.getState()?.tasks)") ) return;
    await pause(50);
  }
  throw Error("Activity did not start");
}
async function rect(cdp, selector) {
  return H.evaluate(cdp, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing ${selector}');const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})()`);
}
async function click(cdp, selector) {
  await H.evaluate(cdp, `document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest'})`);
  const r = await rect(cdp, selector), x = r.x + r.width / 2, y = r.y + r.height / 2;
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}
async function touchDrag(cdp, selector, dx, dy) {
  const r = await rect(cdp, selector), x = r.x + r.width / 2, y = r.y + r.height / 2;
  await touchAt(cdp, x, y, dx, dy);
}
async function touchAt(cdp, x, y, dx, dy) {
  const point = (tx, ty) => ({ x: tx, y: ty, id: 101, radiusX: 1, radiusY: 1, force: 1 });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(x, y)] });
  for (let i = 1; i <= 5; i++) {
    await pause(30);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point(x + dx * i / 5, y + dy * i / 5)] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
async function touchTo(cdp, from, to) {
  const a = await rect(cdp, from), b = await rect(cdp, to);
  await touchDrag(cdp, from, b.x + b.width / 2 - a.x - a.width / 2, b.y + b.height / 2 - a.y - a.height / 2);
}
async function radiusFollow(cdp, side, scale, mouse = false) {
  const selector = `.radius-handle[data-side="${side}"]`, holder = `[data-assembly="${side}"] .weight-holder`;
  const field = side === 'A' ? 0 : 1, direction = side === 'A' ? 1 : -1;
  const initial = await rect(cdp, selector), body = await rect(cdp, holder);
  const x = initial.x + initial.width / 2 + 8, y = initial.y + initial.height / 2 + 6;
  const input = async (type, px = x, py = y) => {
    if (mouse) await cdp.send('Input.dispatchMouseEvent', {type:{start:'mousePressed',move:'mouseMoved',end:'mouseReleased'}[type],x:px,y:py,button:'left',buttons:type === 'end' ? 0 : 1,clickCount:1});
    else await cdp.send('Input.dispatchTouchEvent', {type:{start:'touchStart',move:'touchMove',end:'touchEnd',cancel:'touchCancel'}[type],touchPoints:['end','cancel'].includes(type) ? [] : [{x:px,y:py,id:131,radiusX:1,radiusY:1,force:1}]});
    await pause(25);
  };
  await H.evaluate(cdp, `window.__heldRadius=document.querySelector(${JSON.stringify(selector)})`);
  await input('start');
  assert.ok(Math.abs((await rect(cdp, selector)).x - initial.x) < .1, `${side}: off-centre grab does not jump`);
  for (const distance of [27, 29, 43]) {
    await input('move', x + direction * distance * scale, y + 28);
    const handle = await rect(cdp, selector), movedBody = await rect(cdp, holder);
    assert.ok(Math.abs(handle.x - initial.x - direction * distance * scale) < 1, `${side}: handle follows every horizontal move before release`);
    assert.ok(Math.abs(movedBody.x - body.x - direction * distance * scale) < 1, `${side}: apparatus follows the finger before release`);
    assert.equal(await H.evaluate(cdp, `window.__centripetalApp.getState().tasks[0].work[${field}]`), 2, `${side}: preview does not save partial drag`);
    assert.ok(await H.evaluate(cdp, `window.__heldRadius===document.querySelector(${JSON.stringify(selector)})`), `${side}: captured handle stays mounted`);
  }
  assert.match(await H.evaluate(cdp, `document.getElementById('r${side}Value').innerHTML`), /0\.30/, `${side}: radius readout updates while held`);
  const preview = await rect(cdp, '#radiusPreview');
  for (const target of ['[data-assembly="A"] .weight-holder', '[data-assembly="B"] .weight-holder', selector]) {
    const r = await rect(cdp, target);
    assert.ok(preview.x + preview.width <= r.x || r.x + r.width <= preview.x || preview.y + preview.height <= r.y || r.y + r.height <= preview.y, `${side}: preview leaves apparatus and active handle visible`);
  }
  fs.writeFileSync(path.join(root, 'output/playwright', `centripetal-held-${side}-${mouse ? 'mouse' : 'touch'}.png`), Buffer.from((await cdp.send('Page.captureScreenshot', {format:'png',captureBeyondViewport:false})).data, 'base64'));
  await input('end', x + direction * 43 * scale, y + 28);
  assert.equal(await H.evaluate(cdp, `window.__centripetalApp.getState().tasks[0].work[${field}]`), 4, `${side}: diagonal release snaps to the nearest tick`);
  if (mouse) return;
  const settled = await rect(cdp, holder);
  await input('start', x + direction * 43 * scale, y);
  await input('move', x - direction * 9 * scale, y + 28);
  await input('cancel');
  assert.ok(Math.abs((await rect(cdp, holder)).x - settled.x) < .1, `${side}: cancellation restores visible apparatus`);
  assert.equal(await H.evaluate(cdp, `window.__centripetalApp.getState().tasks[0].work[${field}]`), 4, `${side}: cancellation preserves saved radius`);
  // A tiny horizontal movement still follows continuously, then settles back to the same tick.
  await input('start', x + direction * 43 * scale, y);
  await input('move', x + direction * 45 * scale, y + 28);
  assert.ok(Math.abs((await rect(cdp, holder)).x - settled.x - direction * 2 * scale) < 1);
  await input('end', x + direction * 45 * scale, y + 28);
  assert.ok(Math.abs((await rect(cdp, holder)).x - settled.x) < .1, `${side}: unchanged tick clears fractional preview`);
  const bounds = await rect(cdp, '#stageContent');
  for (const [endX, expected] of [[direction > 0 ? bounds.x + bounds.width - 1 : bounds.x + 1, 6], [bounds.x + bounds.width / 2 - direction * 20, 0]]) {
    const handle = await rect(cdp, selector), startX = handle.x + handle.width / 2;
    await input('start', startX, y); await input('move', endX, y + 28); await input('end', endX, y + 28);
    assert.equal(await H.evaluate(cdp, `window.__centripetalApp.getState().tasks[0].work[${field}]`), expected, `${side}: clamp stays on its own rail`);
  }
  for (let i = 0; i < 4; i++) await click(cdp, `[data-step="${field}:1"]`);
}
async function key(cdp, name) {
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: name, code: name, windowsVirtualKeyCode: 39 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: name, code: name, windowsVirtualKeyCode: 39 });
}
async function fullscreen(cdp, expected, label) {
  for (let i = 0; i < 50; i++) {
    const value = await H.evaluate(cdp, `({active:Boolean(document.fullscreenElement),busy:document.getElementById('fullscreenButton').disabled})`);
    if (value.active === expected && !value.busy) return;
    await pause(20);
  }
  throw Error(`${label}: fullscreen did not settle`);
}
async function scenario(cdp, base, launch, label, width, height) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  await cdp.send("Page.navigate", { url: base + launch }); await ready(cdp);
  const folder = path.join(root, "output", "playwright"); fs.mkdirSync(folder, { recursive: true });
  for (let i = 0; i < 100 && !await H.evaluate(cdp, "Boolean(document.querySelector('[data-tex] svg'))"); i++) await pause(50);
  assert.ok(await H.evaluate(cdp, "Boolean(document.querySelector('[data-tex] svg'))"), `${label}: LaTeX quantities rendered`);
  assert.ok(await H.evaluate(cdp, "document.querySelector('#setupPanel').compareDocumentPosition(document.querySelector('#rolesField')) & Node.DOCUMENT_POSITION_FOLLOWING"), `${label}: apparatus controls precede assessment questions`);
  const firstScreenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(path.join(folder, `centripetal-${label}-setup-${width}x${height}.png`), Buffer.from(firstScreenshot.data, "base64"));
  const layout = await H.evaluate(cdp, `(()=>({root:document.documentElement.scrollHeight-document.documentElement.clientHeight,panel:document.getElementById('controlPanel').clientHeight,fullscreen:!!document.getElementById('fullscreenButton'),stage:getComputedStyle(document.getElementById('stage')).touchAction}))()`);
  assert.ok(layout.root < 3 && layout.panel >= 96 && layout.fullscreen && layout.stage === "pan-y", `${label} layout: ${JSON.stringify(layout)}`);
  await click(cdp, "#fullscreenButton");
  await fullscreen(cdp, true, `${label} entry`);
  await click(cdp, "#fullscreenButton");
  await fullscreen(cdp, false, `${label} exit`);
  await click(cdp, "#checkButton"); await click(cdp, "#submitButton");
  let data = await H.evaluate(cdp, `({score:document.getElementById('scorePanel').textContent,locked:document.getElementById('taskPanel').hidden})`);
  assert.match(data.score, /0 \/ 100/); assert.equal(data.locked, false, "review keeps read-only tasks visible");
  await cdp.send("Page.reload", { ignoreCache: true }); await ready(cdp);
  data = await H.evaluate(cdp, `({view:window.__centripetalApp.getState().view,runs:window.__centripetalApp.getState().tasks[0].runs.length})`);
  assert.deepEqual(data, { view: "setup", runs: 0 }, "standalone refresh starts fresh");
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  await H.evaluate(cdp, `(()=>{window.__touchEvidence=[];document.addEventListener('pointerdown',event=>window.__touchEvidence.push({trusted:event.isTrusted,type:event.pointerType,target:event.target.className}),true);return true;})()`);
  await click(cdp, '[data-step="2:1"]');
  assert.equal(await H.evaluate(cdp, "window.__centripetalApp.getState().tasks[0].work[2]"), 3, `${label}: visible add-weight button`);
  await click(cdp, '[data-step="2:-1"]');
  assert.equal(await H.evaluate(cdp, "window.__centripetalApp.getState().tasks[0].work[2]"), 2, `${label}: visible remove-weight button`);
  for (let i = 0; i < 2; i++) await click(cdp, '[data-step="2:-1"]');
  assert.equal(await H.evaluate(cdp, "document.querySelectorAll('[data-assembly=\"A\"] .weight-plate').length"), 0, `${label}: zero weights leaves an empty holder`);
  for (let i = 0; i < 2; i++) await click(cdp, '[data-step="2:1"]');
  const tray = await rect(cdp, ".mass-token.tray"), tx = tray.x + tray.width / 2, ty = tray.y + tray.height / 2;
  const finger = (x, y) => ({ x, y, id: 119, radiusX: 1, radiusY: 1, force: 1 });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [finger(tx, ty)] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [finger(tx + 28, ty - 28)] });
  assert.equal(await H.evaluate(cdp, "document.querySelector('.mass-token.tray').classList.contains('dragging')"), true, `${label}: weight follows the finger`);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  assert.equal(await H.evaluate(cdp, "document.querySelector('.mass-token.tray').classList.contains('dragging')"), false, `${label}: released weight returns to tray`);
  const scale = await H.evaluate(cdp, 'document.getElementById("deviceSvg").getScreenCTM().a');
  await radiusFollow(cdp, 'A', scale);
  await radiusFollow(cdp, 'B', scale, width > 900);
  for (let i = 0; i < 2; i++) await click(cdp, '[data-step="1:-1"]');
  data = await H.evaluate(cdp, "window.__centripetalApp.getState().tasks[0].work[0]");
  assert.equal(data, 4, `${label}: trusted radius drag changes one side`);
  await touchTo(cdp, ".mass-token.tray", '.mass-token.placed.a');
  assert.equal(await H.evaluate(cdp, "window.__centripetalApp.getState().tasks[0].work[2]"), 3, `${label}: trusted mass placement`);
  assert.equal(await H.evaluate(cdp, "document.querySelector('[data-assembly=\"A\"] .assembly-label').textContent"), 'A 3塊', `${label}: label shows all stacked weights`);
  assert.equal(await H.evaluate(cdp, "document.querySelectorAll('[data-assembly=\"A\"] circle.weight-plate').length"), 1, `${label}: top view shows only the top disc`);
  for (let i = 0; i < 6; i++) await click(cdp, '[data-step="3:1"]');
  await touchTo(cdp, '.mass-token.placed.a', '.mass-token.placed.b');
  assert.deepEqual(await H.evaluate(cdp, 'window.__centripetalApp.getState().tasks[0].work.slice(2)'), [3, 8], `${label}: full holder rejects transfer without losing a weight`);
  const weightsScreenshot = await cdp.send('Page.captureScreenshot', {format:'png',captureBeyondViewport:false});
  fs.writeFileSync(path.join(folder, `centripetal-${label}-weights-${width}x${height}.png`), Buffer.from(weightsScreenshot.data, 'base64'));
  for (let i = 0; i < 6; i++) await click(cdp, '[data-step="3:-1"]');
  await touchTo(cdp, ".mass-token.placed.a", ".mass-token.tray");
  assert.equal(await H.evaluate(cdp, "window.__centripetalApp.getState().tasks[0].work[2]"), 2, `${label}: trusted mass removal; ${JSON.stringify(await H.evaluate(cdp, 'window.__touchEvidence'))}`);
  await click(cdp, "#startButton");
  const ringPoint = await H.evaluate(cdp, `(()=>{const r=document.getElementById('stageContent').getBoundingClientRect(),s=Math.min(r.width/600,r.height/460);return{x:r.left+(r.width-600*s)/2+300*s,y:r.top+(r.height-460*s)/2+17*s,scale:s};})()`);
  assert.equal(await H.evaluate(cdp, "document.querySelectorAll('.spin-segment').length"), 24, `${label}: continuous local ring targets`);
  const collectScreenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(path.join(folder, `centripetal-${label}-collect-${width}x${height}.png`), Buffer.from(collectScreenshot.data, "base64"));
  await touchAt(cdp, ringPoint.x, ringPoint.y, 55 * ringPoint.scale, 13 * ringPoint.scale);
  data = await H.evaluate(cdp, "window.__centripetalApp.getState().tasks[0].runs[0].q.length");
  assert.ok(data >= 1, `${label}: trusted touch on visible gold ring records a real speed; ${JSON.stringify(await H.evaluate(cdp, `({target:document.elementFromPoint(${ringPoint.x},${ringPoint.y})?.outerHTML?.slice(0,180),events:window.__touchEvidence,motion:window.__centripetalApp.getMotion()})`))}`);
  const beforePush = await H.evaluate(cdp, "Math.abs(window.__centripetalApp.getMotion().omega)");
  await click(cdp, "#pushButton");
  assert.ok(await H.evaluate(cdp, "Math.abs(window.__centripetalApp.getMotion().omega)") > beforePush, `${label}: visible push button accelerates`);
  await pause(300);
  assert.ok(Math.abs(await H.evaluate(cdp, 'window.__centripetalApp.getMotion().angle')) > .1, `${label}: inspect a rotated apparatus`);
  assert.equal(await H.evaluate(cdp, "document.querySelectorAll('#deviceSvg ellipse,#deviceSvg linearGradient').length"), 0, `${label}: rotating view has no side-view weights or directional shading`);
  assert.ok(await H.evaluate(cdp, "[...document.querySelectorAll('.assembly-label')].every(e=>e.getAttribute('transform')?.startsWith('rotate('))"), `${label}: count labels stay upright`);
  fs.writeFileSync(path.join(folder, `centripetal-${label}-rotating-${width}x${height}.png`), Buffer.from((await cdp.send('Page.captureScreenshot', {format:'png',captureBeyondViewport:false})).data, 'base64'));
  const touchEvidence = await H.evaluate(cdp, "window.__touchEvidence");
  assert.ok(touchEvidence.filter(event => event.trusted && event.type === "touch").length >= 4, `${label}: drag targets received trusted touch pointer events`);
  const ring = await rect(cdp, ".spin-segment"), x = ring.x + ring.width / 2, y = ring.y + ring.height / 2;
  const fingerTwo = (id, fx, fy) => ({ id, x: fx, y: fy, radiusX: 1, radiusY: 1, force: 1 });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [fingerTwo(201, x, y)] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [fingerTwo(201, x - 5, y + 8)] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [fingerTwo(201, x - 5, y + 8), fingerTwo(202, x - 28, y)] });
  assert.equal(await H.evaluate(cdp, "window.__centripetalApp.getMotion().running"), false, `${label}: second finger safely pauses collection`);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await click(cdp, "#resumeButton");
  await click(cdp, ".spin-segment");
  for (let i = 0; i < 6; i++) await key(cdp, "ArrowRight");
  data = await H.evaluate(cdp, "window.__centripetalApp.getState().tasks[0].runs[0].q.length");
  assert.ok(data >= 2, `${label}: trusted operation and keyboard create distinct measured points (${data})`);
  await click(cdp, "#stopButton"); await click(cdp, "#fitButton");
  data = await H.evaluate(cdp, "window.__centripetalApp.getState().tasks[0].runs[0].fit");
  assert.equal(data, true, `${label}: fit uses real points`);
  await click(cdp, "#checkButton"); await click(cdp, "#submitButton");
  data = await H.evaluate(cdp, `({locked:!document.getElementById('startButton').disabled,review:document.getElementById('resultPanel').hidden,score:document.getElementById('scorePanel').textContent})`);
  assert.equal(data.locked, false); assert.equal(data.review, false); assert.match(data.score, /\/ 100/);
  await click(cdp, "#fullscreenButton");
  await fullscreen(cdp, true, `${label} review entry`);
  await click(cdp, "#fullscreenButton");
  await fullscreen(cdp, false, `${label} review exit`);
  const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(path.join(folder, `centripetal-${label}-${width}x${height}.png`), Buffer.from(screenshot.data, "base64"));
  return { label, width, height, samples: data, layout };
}
async function layoutOnly(cdp, base, launch, width, height) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  await cdp.send("Page.navigate", { url: base + launch }); await ready(cdp);
  const layout = await H.evaluate(cdp, `(()=>{const panel=document.getElementById('controlPanel').getBoundingClientRect(),stage=document.getElementById('stage').getBoundingClientRect();return {root:document.documentElement.scrollHeight-document.documentElement.clientHeight,panelHeight:panel.height,panelBottom:panel.bottom,stageHeight:stage.height,stageBottom:stage.bottom,viewport:innerHeight,button:getComputedStyle(document.getElementById('startButton')).fontSize};})()`);
  assert.ok(layout.root < 3 && layout.panelHeight >= 96 && layout.panelBottom <= height + 2 && layout.stageHeight >= 35,
    `${width}x${height} bounded layout: ${JSON.stringify(layout)}`);
  if (width === 320 && height === 500) {
    const addWeight = await rect(cdp, '[data-step="2:1"]');
    assert.ok(addWeight.y >= 0 && addWeight.y + addWeight.height <= height + 2, `Narrow phone exposes A add-weight button: ${JSON.stringify(addWeight)}`);
    const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const folder = path.join(root, "output", "playwright"); fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, "centripetal-layout-320x500.png"), Buffer.from(screenshot.data, "base64"));
    for (let i = 0; i < 2; i++) { await click(cdp, '[data-step="0:-1"]'); await click(cdp, '[data-step="1:-1"]'); }
    const a = await rect(cdp, '.mass-token.placed.a'), b = await rect(cdp, '.mass-token.placed.b');
    assert.ok(b.x + b.width <= a.x + .5, 'Closest A/B holders have separate touch targets on a narrow phone');
  }
  if (width === 320 && height === 225) {
    const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const folder = path.join(root, "output", "playwright"); fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, `centripetal-layout-320x225.png`), Buffer.from(screenshot.data, "base64"));
    await click(cdp, "#startButton");
    const ring = await rect(cdp, ".spin-segment");
    assert.ok(ring.y >= 56 && ring.y + ring.height <= 56 + layout.stageHeight + 2, "Short-view ring remains touchable inside stage");
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
    await touchDrag(cdp, ".spin-segment", -5, 12);
    assert.ok(await H.evaluate(cdp, "window.__centripetalApp.getState().tasks[0].runs[0].q.length") >= 1, "Short-view ring still produces data");
  }
}
async function buttonOnly(cdp, base, launch, label) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 600, deviceScaleFactor: 1, mobile: false });
  await cdp.send("Page.navigate", { url: base + launch }); await ready(cdp);
  await click(cdp, '[data-step="2:1"]');
  assert.equal(await H.evaluate(cdp, "window.__centripetalApp.getState().tasks[0].work[2]"), 3, `${label}: add-weight button`);
  await click(cdp, "#startButton");
  for (let i = 0; i < 3; i++) await click(cdp, "#pushButton");
  assert.ok(await H.evaluate(cdp, "window.__centripetalApp.getState().tasks[0].runs[0].q.length") >= 3, `${label}: push button alone records three speeds`);
  await click(cdp, "#stopButton"); await click(cdp, "#fitButton");
  assert.equal(await H.evaluate(cdp, "window.__centripetalApp.getState().tasks[0].runs[0].fit"), true, `${label}: button-only measurements fit`);
  const saved = await H.evaluate(cdp, "window.__centripetalApp.getState().tasks[0].runs[0]");
  await H.evaluate(cdp, "document.getElementById('controlPanel').scrollTop=10000");
  const back = await rect(cdp, '#setupView'), panel = await rect(cdp, '#controlPanel');
  assert.ok(back.y >= panel.y && back.y + back.height <= panel.y + panel.height, `${label}: return-to-setup stays visible while scrolling`);
  await click(cdp, '#setupView');
  assert.deepEqual(await H.evaluate(cdp, "window.__centripetalApp.getState().tasks[0].runs[0]"), saved, `${label}: returning preserves measurements and answers`);
  assert.equal(await H.evaluate(cdp, "document.querySelector('#rotatingAssembly').getAttribute('transform')"), 'rotate(0 300 230)', `${label}: setup restores the aligned apparatus pose`);
  await click(cdp, '[data-step="2:1"]');
  assert.equal(await H.evaluate(cdp, "document.querySelector('[data-assembly=\"A\"]').dataset.count"), '4', `${label}: setup shows working masses`);
  await click(cdp, '#collectView');
  assert.equal(await H.evaluate(cdp, "document.querySelector('[data-assembly=\"A\"]').dataset.count"), '3', `${label}: old run shows its frozen masses`);
  await click(cdp, '#pushButton');
  const live = await H.evaluate(cdp, "({force:Number(document.getElementById('forceARead').textContent),omega:Math.abs(window.__centripetalApp.getMotion().omega)})");
  assert.ok(Math.abs(live.force - .1 * .2 * live.omega ** 2) < .0001, `${label}: old run readout uses frozen configuration`);
  await click(cdp, '#setupView'); await click(cdp, '#startButton');
  for (let i = 0; i < 3; i++) await click(cdp, '#pushButton');
  await click(cdp, '#stopButton'); await click(cdp, '#fitButton');
  await click(cdp, '#setupView'); await click(cdp, '[data-step="0:1"]');
  await click(cdp, '#restartRunButton');
  const redo = await H.evaluate(cdp, 'window.__centripetalApp.getState()');
  assert.equal(redo.view, 'collect'); assert.equal(redo.tasks[0].runs.length, 2);
  assert.deepEqual(redo.tasks[0].runs[0], saved, `${label}: redo preserves the other group`);
  assert.deepEqual(redo.tasks[0].runs[1], {cfg:[3,2,4,2],q:[],fit:false,a:[null,null,null]}, `${label}: redo clears only current data and uses new settings`);
  for (let i = 0; i < 3; i++) await click(cdp, '#pushButton');
  await click(cdp, '#stopButton'); await click(cdp, '#fitButton');
  assert.equal(await H.evaluate(cdp, 'window.__centripetalApp.getState().tasks[0].runs[1].fit'), true, `${label}: legal continuation after redo`);
  await click(cdp, '#checkButton'); await click(cdp, '#submitButton');
  assert.equal(await H.evaluate(cdp, 'document.getElementById("restartRunButton").hidden'), true, `${label}: submitted work has no redo action`);
}
async function main() {
  const browser = H.findBrowser(); if (!browser) throw Error("Chrome/Chromium not found");
  const profile = fs.mkdtempSync(path.join(tempRoot, "simlab-position-time-chrome-"));
  let chrome, cdp, server, packageDirectory;
  try {
    chrome = spawn(browser, ["--headless=new", "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
    const port = await H.withTimeout(H.devToolsPort(profile, chrome), 35000, "Chrome startup");
    const target = await H.fetchJson(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
    cdp = new H.CdpClient(target.body.webSocketDebuggerUrl); await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
    const errors = []; cdp.on("Runtime.exceptionThrown", event => errors.push(event.exceptionDetails?.exception?.description || event.exceptionDetails?.text));
    server = H.createServer(root); await H.listenServer(server);
    const sourceBase = `http://127.0.0.1:${server.address().port}`;
    await scenario(cdp, sourceBase, `/sim/${slug}/index.html`, "source", 1280, 800);
    await scenario(cdp, sourceBase, `/sim/${slug}/index.html`, "source", 390, 600);
    await buttonOnly(cdp, sourceBase, `/sim/${slug}/index.html`, "source");
    for (const [width, height] of [[320,500],[390,500],[390,844],[480,320],[320,225]]) await layoutOnly(cdp, sourceBase, `/sim/${slug}/index.html`, width, height);
    await H.closeServer(server); server = null;
    const extracted = H.buildAndExtractPackage(tempRoot, { slug }); packageDirectory = extracted.packageDirectory;
    server = H.createServer(packageDirectory); await H.listenServer(server);
    await scenario(cdp, `http://127.0.0.1:${server.address().port}`, extracted.activityPath, "package", 390, 600);
    await buttonOnly(cdp, `http://127.0.0.1:${server.address().port}`, extracted.activityPath, "package");
    await layoutOnly(cdp, `http://127.0.0.1:${server.address().port}`, extracted.activityPath, 320, 225);
    assert.deepEqual(errors, [], `Browser exceptions: ${errors.join("\n")}`);
    console.log("Centripetal source and extracted-package browser regression passed");
  } finally {
    await H.cleanupResources({ chrome, cdp, server, profileDirectory: profile, packageDirectory, tempRoot });
  }
}
if (require.main === module) main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
