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
  assert.equal(await H.evaluate(cdp, "document.getElementById('radiusPreview')"), null, 'No floating radius preview');
  assert.match(await H.evaluate(cdp, `document.querySelector('[data-radius-label="${side}"] [data-tex]').getAttribute('data-tex')`), /0\.30/, `${side}: radius is labelled directly in the apparatus`);
  const preview = await rect(cdp, `[data-radius-label="${side}"]`);
  for (const target of ['[data-assembly="A"] .weight-holder', '[data-assembly="B"] .weight-holder', selector]) {
    const r = await rect(cdp, target);
    assert.ok(preview.x + preview.width <= r.x || r.x + r.width <= preview.x || preview.y + preview.height <= r.y || r.y + r.height <= preview.y, `${side}: inline radius leaves apparatus and active handle visible`);
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
async function push(cdp, count=1) {
  await click(cdp,'.spin-segment');
  const direction=await H.evaluate(cdp,'window.__centripetalApp.getMotion().omega<0');
  for(let i=0;i<count;i++) await key(cdp,direction?'ArrowLeft':'ArrowRight');
  await pause(60);
}
async function brake(cdp, duration=1500, touch=true, cancel=false) {
  const r=await rect(cdp,'#brakeButton'),x=r.x+r.width/2,y=r.y+r.height/2;
  if(touch) await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:301,radiusX:1,radiusY:1,force:1}]});
  else await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1});
  await pause(duration);
  assert.ok(await H.evaluate(cdp,'window.__centripetalApp.getMotion().braking'),'hold owns brake: '+JSON.stringify(await H.evaluate(cdp,`({motion:window.__centripetalApp.getMotion(),target:document.elementFromPoint(${x},${y})?.outerHTML,events:window.__touchEvidence?.slice(-4)})`)));
  if(touch) await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});
  else await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});
}
async function reSpin(cdp) {
  let g=await H.evaluate(cdp,`(()=>{const m=document.getElementById('deviceSvg').getScreenCTM();return{x:300*m.a+m.e,y:230*m.d+m.f,r:213*m.a};})()`);
  const count=await H.evaluate(cdp,'window.__centripetalApp.getState().tasks[0].runs[0].q.length');
  const finger=a=>({x:g.x+g.r*Math.cos(a),y:g.y+g.r*Math.sin(a),id:411,radiusX:1,radiusY:1,force:1});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger(0)]});
  for(let i=1;i<=4;i++) {
    await pause(25);await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[finger(-i*.18)]});
    assert.equal(await H.evaluate(cdp,'window.__centripetalApp.getState().tasks[0].runs[0].q.length'),count,'held re-spin never samples');
  }
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await pause(100);
  assert.equal(await H.evaluate(cdp,'window.__centripetalApp.getMotion().measuring'),true,'true touch re-spin keeps measurement armed');
  assert.ok(await H.evaluate(cdp,'window.__centripetalApp.getState().tasks[0].runs[0].q.length')>count,'release resumes without pressing Start again');
}
async function threePoints(cdp) {
  await push(cdp,6); await click(cdp,'#measureButton'); await brake(cdp,1500);
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
  await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:width===1280?'reduce':'no-preference'}]});
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  await cdp.send("Page.navigate", { url: base + launch }); await ready(cdp);
  const folder = path.join(root, "output", "playwright"); fs.mkdirSync(folder, { recursive: true });
  for (let i = 0; i < 100 && !await H.evaluate(cdp, "Boolean(document.querySelector('[data-tex] svg'))"); i++) await pause(50);
  assert.ok(await H.evaluate(cdp, "Boolean(document.querySelector('[data-tex] svg'))"), `${label}: LaTeX quantities rendered`);
  assert.ok(await H.evaluate(cdp, "document.querySelector('#taskIntro').compareDocumentPosition(document.querySelector('#setupPanel')) & Node.DOCUMENT_POSITION_FOLLOWING"), `${label}: learning objective precedes apparatus settings`);
  assert.equal(await H.evaluate(cdp,"document.getElementById('rolesField').hidden"),true,'first experiment replaces generic variable quiz');
  assert.equal(await H.evaluate(cdp,"document.getElementById('inquiryField').hidden"),false,'comparison questions available');
  const columns = await H.evaluate(cdp, `[...document.querySelectorAll('.quantity-step')].map(row=>[...row.querySelectorAll('button')].map(e=>e.getBoundingClientRect().x))`);
  assert.ok(columns.every(pair=>pair.every((x,i)=>Math.abs(x-columns[0][i])<1)), `${label}: mass and radius buttons share fixed columns`);
  const trayBounds = await rect(cdp, '#weightTray'), washer = await rect(cdp, '.mass-token.tray .washer');
  assert.ok(washer.x > trayBounds.x + 2 && washer.y > trayBounds.y + 2 && washer.x + washer.width < trayBounds.x + trayBounds.width - 2 && washer.y + washer.height < trayBounds.y + trayBounds.height - 2, `${label}: weight icon has room inside its tray border`);
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
  await click(cdp, '#analyseView');
  assert.match(await H.evaluate(cdp, 'document.getElementById("graphSvg").textContent'), /本組尚未記錄數據/, `${label}: empty review does not ask for new measurements`);
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
  assert.match(await H.evaluate(cdp, 'document.getElementById("mAValue").textContent'), /空托座/);
  assert.ok(await H.evaluate(cdp, 'document.getElementById("mAValue").innerHTML.includes("0.040")'), `${label}: empty holder still explains its mass`);
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
  assert.equal(await H.evaluate(cdp, "document.querySelector('[data-assembly=\"A\"] .assembly-label').textContent"), 'A·3', `${label}: label shows all stacked weights`);
  assert.equal(await H.evaluate(cdp, "document.querySelectorAll('[data-assembly=\"A\"] circle.weight-plate').length"), 1, `${label}: top view shows only the top disc`);
  assert.equal(await H.evaluate(cdp, `document.querySelectorAll('[data-assembly="A"] .weight-count-mark[data-filled="true"]').length`), 3, `${label}: visible marks show each added weight`);
  for (let i = 0; i < 6; i++) await click(cdp, '[data-step="3:1"]');
  await touchTo(cdp, '.mass-token.placed.a', '.mass-token.placed.b');
  assert.deepEqual(await H.evaluate(cdp, 'window.__centripetalApp.getState().tasks[0].work.slice(2)'), [3, 8], `${label}: full holder rejects transfer without losing a weight`);
  const weightsScreenshot = await cdp.send('Page.captureScreenshot', {format:'png',captureBeyondViewport:false});
  fs.writeFileSync(path.join(folder, `centripetal-${label}-weights-${width}x${height}.png`), Buffer.from(weightsScreenshot.data, 'base64'));
  for (let i = 0; i < 6; i++) await click(cdp, '[data-step="3:-1"]');
  await touchTo(cdp, ".mass-token.placed.a", ".mass-token.tray");
  assert.equal(await H.evaluate(cdp, "window.__centripetalApp.getState().tasks[0].work[2]"), 2, `${label}: trusted mass removal; ${JSON.stringify(await H.evaluate(cdp, 'window.__touchEvidence'))}`);
  await click(cdp, "#startButton");
  const ringPoint = await H.evaluate(cdp, `(()=>{const m=document.getElementById('deviceSvg').getScreenCTM();return{x:300*m.a+m.e,y:17*m.d+m.f,scale:m.a};})()`);
  assert.equal(await H.evaluate(cdp, "document.querySelectorAll('.spin-segment').length"), 24, `${label}: continuous local ring targets`);
  const collectScreenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(path.join(folder, `centripetal-${label}-collect-${width}x${height}.png`), Buffer.from(collectScreenshot.data, "base64"));
  await touchAt(cdp, ringPoint.x, ringPoint.y, 55 * ringPoint.scale, 13 * ringPoint.scale);
  assert.equal(await H.evaluate(cdp, 'window.__centripetalApp.getState().tasks[0].runs[0].q.length'), 0, `${label}: dragging does not collect measurements`);
  const released = await H.evaluate(cdp, 'window.__centripetalApp.getMotion().omega');
  await pause(200);
  assert.equal(await H.evaluate(cdp, 'window.__centripetalApp.getMotion().omega'), released, `${label}: released turntable holds angular velocity steady`);
  await click(cdp, '#measureButton');
  data = await H.evaluate(cdp, "window.__centripetalApp.getState().tasks[0].runs[0].q.length");
  assert.ok(data >= 1, `${label}: trusted touch on visible gold ring records a real speed; ${JSON.stringify(await H.evaluate(cdp, `({target:document.elementFromPoint(${ringPoint.x},${ringPoint.y})?.outerHTML?.slice(0,180),events:window.__touchEvidence,motion:window.__centripetalApp.getMotion()})`))}`);
  assert.equal(await H.evaluate(cdp,"document.getElementById('measurementHint').dataset.status"),'added','a new point is acknowledged');
  assert.ok(await H.evaluate(cdp,"Boolean(document.querySelector('.new-point-ring'))"),'new sample is visibly highlighted');
  await pause(850);
  assert.equal(await H.evaluate(cdp,"Boolean(document.querySelector('.new-point-ring'))"),false,'new-point marker expires even with reduced motion');
  assert.equal(await H.evaluate(cdp,"document.getElementById('collectStatus').textContent.includes('/ 48')"),false,'capacity is not shown as a completion target');
  assert.match(await H.evaluate(cdp,"document.getElementById('samplingGuide').textContent"),/毋須收集48點/,'requirement is explicit before coverage is sufficient');
  await H.evaluate(cdp,"window.__samplingNodes={apparatus:document.querySelector('#rotatingAssembly'),option:document.querySelector('#law option'),select:document.querySelector('#law')}");
  const beforeBrake=await H.evaluate(cdp,'window.__centripetalApp.getMotion()');
  const beforeCount=await H.evaluate(cdp,'window.__centripetalApp.getState().tasks[0].runs[0].q.length');
  await brake(cdp,1500,width<900);
  const afterBrake=await H.evaluate(cdp,'window.__centripetalApp.getMotion()');
  assert.equal(await H.evaluate(cdp,"window.__samplingNodes.apparatus===document.querySelector('#rotatingAssembly')&&window.__samplingNodes.option===document.querySelector('#law option')&&window.__samplingNodes.select===document.querySelector('#law')"),true,'sampling keeps apparatus and answer DOM mounted');
  assert.ok(Math.abs(afterBrake.omega)<Math.abs(beforeBrake.omega),'holding brake reduces speed');
  assert.equal(afterBrake.measuring,true,'release keeps measurement active');
  await pause(150);
  assert.equal(await H.evaluate(cdp,'window.__centripetalApp.getMotion().omega'),afterBrake.omega,'release stops deceleration');
  // A slow initial spin can be replaced directly without stopping measurement.
  await reSpin(cdp);await brake(cdp,1500);
  assert.ok(await H.evaluate(cdp,'window.__centripetalApp.getState().tasks[0].runs[0].q.length')>beforeCount,'re-spin resumes same measurement');
  assert.equal(await H.evaluate(cdp,"document.querySelectorAll('#graphSvg .measured-point').length === window.__centripetalApp.getState().tasks[0].runs[0].q.length"),true,'live plot matches real samples');
  const apparatus=await rect(cdp,'#deviceSvg'),chart=await rect(cdp,'#graphSvg');
  assert.ok(apparatus.x+apparatus.width<=chart.x||apparatus.y+apparatus.height<=chart.y,'chart remains outside apparatus');
  const count=await H.evaluate(cdp,'window.__centripetalApp.getState().tasks[0].runs[0].q.length');
  await click(cdp,'#toggleGraph');await click(cdp,'#reverseButton');await brake(cdp,1500);
  assert.ok(await H.evaluate(cdp,'window.__centripetalApp.getState().tasks[0].runs[0].q.length')>count,'collapsed graph keeps recording');
  await click(cdp,'#toggleGraph');
  await H.evaluate(cdp, "document.getElementById('controlPanel').scrollTop=0");
  await pause(300);
  const movingAngle=await H.evaluate(cdp,'window.__centripetalApp.getMotion().angle');
  await pause(100);
  assert.notEqual(await H.evaluate(cdp,'window.__centripetalApp.getMotion().angle'),movingAngle,'apparatus continues rotating, including when crossing zero angle');
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
  await click(cdp, '#measureButton');
  data = await H.evaluate(cdp, "window.__centripetalApp.getState().tasks[0].runs[0].q.length");
  assert.ok(data >= 2, `${label}: trusted operation and keyboard create distinct measured points (${data})`);
  await click(cdp, "#analyseView"); await click(cdp, "#fitButton");
  assert.equal(await H.evaluate(cdp, "document.getElementById('deviceSvg').getBoundingClientRect().height > 0 && !document.getElementById('graphBody').hidden && Boolean(document.querySelector('.fit-curve'))"), true, `${label}: fitting keeps the apparatus visible`);
  await click(cdp, '#toggleGraph');
  assert.equal(await H.evaluate(cdp, 'document.getElementById("graphBody").hidden'), true, `${label}: analysis graph can collapse`);
  await click(cdp, '#toggleGraph');
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
    const goal = await rect(cdp, '#taskIntro');
    assert.ok(goal.y >= 0 && goal.y + goal.height <= height + 2, `Narrow phone first shows the learning goal: ${JSON.stringify(goal)}`);
    const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const folder = path.join(root, "output", "playwright"); fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, "centripetal-layout-320x500.png"), Buffer.from(screenshot.data, "base64"));
    for (let i = 0; i < 2; i++) { await click(cdp, '[data-step="0:-1"]'); await click(cdp, '[data-step="1:-1"]'); }
    const a = await rect(cdp, '.mass-token.placed.a'), b = await rect(cdp, '.mass-token.placed.b');
    assert.ok(b.x + b.width <= a.x + .5, 'Closest A/B holders have separate touch targets on a narrow phone');
    await click(cdp, '#startButton');
    const ring = await rect(cdp, '.spin-segment'), x = ring.x + ring.width / 2, y = ring.y + ring.height / 2;
    await cdp.send('Input.dispatchMouseEvent', {type:'mousePressed', x, y, button:'left', buttons:1, clickCount:1});
    await pause(60);
    await cdp.send('Input.dispatchMouseEvent', {type:'mouseMoved', x, y:y+.5, button:'left', buttons:1});
    const slow = await H.evaluate(cdp, `({omega:Math.abs(window.__centripetalApp.getMotion().omega),bounds:[...document.querySelectorAll('.readouts > span')].map(e=>{const r=e.getBoundingClientRect();return [r.left,r.right]})})`);
    assert.ok(slow.omega > 0 && slow.omega < .5, 'A tiny trusted ring movement produces slow rotation');
    assert.ok(slow.bounds.every(([left,right])=>left>=0 && right<=width), `Slow-rotation readouts stay inside the narrow viewport: ${JSON.stringify(slow)}`);
    await cdp.send('Input.dispatchMouseEvent', {type:'mouseReleased', x, y:y+.5, button:'left', clickCount:1});
    const radiusA = await rect(cdp, '[data-radius-label="A"]'), radiusB = await rect(cdp, '[data-radius-label="B"]');
    assert.ok(radiusA.x + radiusA.width < radiusB.x && radiusA.x >= 32 && radiusB.x + radiusB.width <= width - 32, 'Narrow rotating radius labels are separate and unclipped');
    await H.evaluate(cdp, 'document.getElementById("graphSvg").scrollIntoView({block:"nearest"})');
    const chart = await rect(cdp, '#graphSvg'), device = await rect(cdp, '#deviceSvg');
    assert.ok(chart.y + chart.height <= height + 1 && device.height > 0, 'Narrow panel scroll exposes the complete live graph and keeps the apparatus');
    await click(cdp, '#toggleGraph');
    assert.equal(await H.evaluate(cdp, 'document.getElementById("graphBody").hidden'), true, 'Narrow graph can collapse after scrolling');
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
    await click(cdp, '#measureButton');
    assert.ok(await H.evaluate(cdp, "window.__centripetalApp.getState().tasks[0].runs[0].q.length") >= 1, "Short-view ring still produces data");
  }
}
async function buttonOnly(cdp, base, launch, label) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 600, deviceScaleFactor: 1, mobile: false });
  await cdp.send("Page.navigate", { url: base + launch }); await ready(cdp);
  await click(cdp, '[data-step="2:1"]');
  assert.equal(await H.evaluate(cdp, "window.__centripetalApp.getState().tasks[0].work[2]"), 3, `${label}: add-weight button`);
  await click(cdp, "#startButton");
  await threePoints(cdp);
  assert.ok(await H.evaluate(cdp, "window.__centripetalApp.getState().tasks[0].runs[0].q.length") >= 3, `${label}: speed and measurement buttons record three speeds`);
  await click(cdp, "#analyseView"); await click(cdp, "#fitButton");
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
  await push(cdp);
  const live = await H.evaluate(cdp, "({force:Number(document.getElementById('forceARead').textContent),omega:Math.abs(window.__centripetalApp.getMotion().omega)})");
  assert.ok(Math.abs(live.force - .1 * .2 * live.omega ** 2) < .0001, `${label}: old run readout uses frozen configuration`);
  const frozenPlot = await H.evaluate(cdp, `(()=>{
    const t=window.__centripetalApp.getState().tasks[0], run=t.runs[0];
    const expected=CentripetalModel.points('radius',run), maxX=Math.max(.1,...expected.map(p=>p[0]))*1.12,maxY=Math.max(.1,...expected.map(p=>p[1]))*1.12;
    return [...document.querySelectorAll('#graphSvg .measured-point')].every((e,i)=>Math.abs(Number(e.getAttribute('cx'))-(66+expected[i][0]/maxX*265))<.01&&Math.abs(Number(e.getAttribute('cy'))-(120-expected[i][1]/maxY*95))<.01);
  })()`);
  assert.ok(frozenPlot, `${label}: live plot coordinates use the old run's frozen configuration`);
  await click(cdp, '#setupView'); await click(cdp, '#startButton');
  await threePoints(cdp);
  await click(cdp, '#analyseView'); await click(cdp, '#fitButton');
  await click(cdp, '#setupView'); await click(cdp, '[data-step="0:1"]');
  await click(cdp, '#restartRunButton');
  const redo = await H.evaluate(cdp, 'window.__centripetalApp.getState()');
  assert.equal(redo.view, 'collect'); assert.equal(redo.tasks[0].runs.length, 2);
  assert.deepEqual(redo.tasks[0].runs[0], saved, `${label}: redo preserves the other group`);
  assert.deepEqual(redo.tasks[0].runs[1], {cfg:[3,2,4,2],q:[],fit:false,a:[null,null,null]}, `${label}: redo clears only current data and uses new settings`);
  await threePoints(cdp);
  await click(cdp, '#analyseView'); await click(cdp, '#fitButton');
  assert.equal(await H.evaluate(cdp, 'window.__centripetalApp.getState().tasks[0].runs[1].fit'), true, `${label}: legal continuation after redo`);
  await click(cdp, '#checkButton'); await click(cdp, '#submitButton');
  assert.equal(await H.evaluate(cdp, 'document.getElementById("restartRunButton").hidden'), true, `${label}: submitted work has no redo action`);
}
async function signedMeasurements(cdp, base, launch, label) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {width:1280,height:800,deviceScaleFactor:1,mobile:false});
  await cdp.send('Page.navigate', {url:base+launch}); await ready(cdp);
  await click(cdp, '[data-page="2"]'); await click(cdp, '#startButton');
  assert.equal(await H.evaluate(cdp,"document.getElementById('rolesField').hidden"),false,'third experiment retains variable roles');
  await push(cdp,10); await click(cdp,'#measureButton'); await brake(cdp,2500);
  await click(cdp,'#reverseButton');await brake(cdp,2500);
  const run=await H.evaluate(cdp,'window.__centripetalApp.getState().tasks[2].runs[0]');
  assert.ok(run.q.some(q=>q<0)&&run.q.some(q=>q>0),'both rotation directions are sampled');
  assert.ok(run.q.length<48,'sufficient data is reached below storage capacity');
  assert.equal(await H.evaluate(cdp,"document.getElementById('samplingGuide').dataset.sufficient"),'true','UI uses the actual coverage rule');
  assert.match(await H.evaluate(cdp,"document.getElementById('samplingGuide').textContent"),/已達標/);
  const count=run.q.length;await pause(850);
  assert.equal(await H.evaluate(cdp,"document.getElementById('measurementHint').dataset.status"),'repeated','unchanged speed explains why no point is added');
  assert.match(await H.evaluate(cdp,"document.getElementById('measurementHint').textContent"),/已記錄/);
  assert.equal(await H.evaluate(cdp,'window.__centripetalApp.getState().tasks[2].runs[0].q.length'),count,'steady speed does not add duplicate points');
  const markerBefore=await H.evaluate(cdp,"document.getElementById('livePoint').getAttribute('transform')");
  const noAdd=await H.evaluate(cdp,'window.__centripetalApp.getState().tasks[2].runs[0].q.length');
  await brake(cdp,100);
  await pause(100);
  assert.notEqual(await H.evaluate(cdp,"document.getElementById('livePoint').getAttribute('transform')"),markerBefore,'live marker moves even between saved samples');
  assert.equal(await H.evaluate(cdp,'window.__centripetalApp.getState().tasks[2].runs[0].q.length'),noAdd,'live marker does not manufacture an extra saved point');
  const directions=await H.evaluate(cdp,"[...document.querySelectorAll('.measured-point')].map(e=>({direction:e.dataset.direction,fill:e.getAttribute('fill')}))");
  assert.ok(directions.some(p=>p.direction==='negative'&&p.fill==='none')&&directions.some(p=>p.direction==='positive'&&p.fill!=='none'),'opposite directions have different point styles');
  await brake(cdp,100,true,true);
  assert.equal(await H.evaluate(cdp,'window.__centripetalApp.getMotion().braking'),false,'touchcancel releases brake');
  assert.equal(await H.evaluate(cdp,'window.__centripetalApp.getMotion().measuring'),false,'cancel stops collection safely');
  await click(cdp, '#analyseView'); await click(cdp, '#fitButton');
  assert.equal(await H.evaluate(cdp, 'window.__centripetalApp.getState().tasks[2].runs[0].fit'), true);
  const plot = await H.evaluate(cdp, `({xs:[...document.querySelectorAll('.measured-point')].map(e=>Number(e.getAttribute('cx'))),curve:document.querySelector('.fit-curve').getAttribute('d')})`);
  assert.ok(Math.min(...plot.xs) < 198.5 && Math.max(...plot.xs) > 198.5, `${label}: graph includes both angular velocity directions`);
  assert.ok(Number(plot.curve.match(/^M([\d.]+)/)[1]) < 198.5, `${label}: fitted curve starts in the measured negative range`);
  assert.equal(await H.evaluate(cdp, '/e-\\d+/.test(document.getElementById("fitResult").innerHTML)'), false, `${label}: fitted formula does not display floating-point residue as raw e-notation`);
  const beforeSquare=await H.evaluate(cdp,'window.__centripetalApp.getState().tasks[2].runs[0]');
  await click(cdp,'#squareGraph');
  assert.equal(await H.evaluate(cdp,"document.getElementById('squareGraph').getAttribute('aria-pressed')"),'true');
  assert.deepEqual(await H.evaluate(cdp,'window.__centripetalApp.getState().tasks[2].runs[0]'),beforeSquare,'square plot preserves measurements and answers');
  assert.ok(await H.evaluate(cdp,"Boolean(document.querySelector('.fit-curve'))"),'square graph fits line');
  await click(cdp,'#squareGraph');
  fs.writeFileSync(path.join(root,'output/playwright',`centripetal-${label}-signed-1280x800.png`),Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
}
async function responsiveSpin(cdp,base,launch) {
  await cdp.send('Page.navigate',{url:base+launch});await ready(cdp);await click(cdp,'#startButton');
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
  let g=await H.evaluate(cdp,"(()=>{const m=document.getElementById('deviceSvg').getScreenCTM();return{x:300*m.a+m.e,y:230*m.d+m.f,r:213*m.a};})()");
  const finger=a=>({x:g.x+g.r*Math.cos(a),y:g.y+g.r*Math.sin(a),id:501,radiusX:1,radiusY:1,force:1});
  for(const sign of [1,-1]) {
    const before=await H.evaluate(cdp,'window.__centripetalApp.getMotion()');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger(0)]});
    await pause(30);await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[finger(-sign*.6)]});
    await pause(30);await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[finger(-sign*1.2)]});
    await pause(40);
    const held=await H.evaluate(cdp,'window.__centripetalApp.getMotion()');
    if(sign===1) assert.ok(held.angle>before.angle,'the animation clock advances during the stroke');
    assert.ok(sign*held.omega>6,'fast stroke exceeds the old 6 rad/s cap: '+JSON.stringify(held));
    await pause(300);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await pause(100);
    const released=await H.evaluate(cdp,'window.__centripetalApp.getMotion()');
    assert.ok(sign*(released.angle-held.angle)>.2,'touch release after a short hold continues on the first frames');
    assert.ok(Math.abs(released.omega-held.omega)<.01,'touch release preserves last moving velocity');
  }
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:false});
  await cdp.send('Page.navigate',{url:base+launch});await ready(cdp);await click(cdp,'#startButton');
  g=await H.evaluate(cdp,"(()=>{const m=document.getElementById('deviceSvg').getScreenCTM();return{x:300*m.a+m.e,y:230*m.d+m.f,r:213*m.a};})()");
  for(const sign of [1,-1]) {
    const mouse=async(type,a,buttons)=>{const p=finger(a);await cdp.send('Input.dispatchMouseEvent',{type,x:p.x,y:p.y,button:'left',buttons,clickCount:1});};
    await mouse('mousePressed',0,1);
    await pause(30);await mouse('mouseMoved',-sign*.6,1);
    await pause(30);await mouse('mouseMoved',-sign*1.2,1);
    const held=await H.evaluate(cdp,'window.__centripetalApp.getMotion()');
    assert.ok(sign*held.omega>6,'fast mouse stroke exceeds the old cap: '+JSON.stringify({sign,held,g}));
    await pause(300);await mouse('mouseMoved',-sign*1.2,1);
    await mouse('mouseReleased',-sign*1.2,0);await pause(100);
    const released=await H.evaluate(cdp,'window.__centripetalApp.getMotion()');
    assert.ok(sign*(released.angle-held.angle)>.2,'stationary mouse event and delayed release retain inertia');
    assert.ok(Math.abs(released.omega-held.omega)<.01,'mouse release preserves last moving velocity');
  }
  // Some devices deliver the final displacement only with pointerup.
  const p=finger(0),end=finger(-.8);
  await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',buttons:1,clickCount:1});
  await pause(30);
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:end.x,y:end.y,button:'left',buttons:0,clickCount:1});
  await pause(80);
  assert.ok((await H.evaluate(cdp,'window.__centripetalApp.getMotion().omega'))>6,'final pointerup displacement contributes to launch speed');
  await click(cdp,'#measureButton');await pause(100);
  assert.ok((await H.evaluate(cdp,'window.__centripetalApp.getState().tasks[0].runs[0].q')).some(q=>q>6000),'high-speed readings are saved');
}
async function continuousRelease(cdp, base, launch, label) {
  const reports=[];
  for(const rate of [1,4]) for(const measuring of [false,true]) for(const pointer of ["mouse","touch"]) {
    await cdp.send("Emulation.setCPUThrottlingRate",{rate});
    await cdp.send("Emulation.setDeviceMetricsOverride",{width:390,height:600,deviceScaleFactor:1,mobile:false});
    await cdp.send("Emulation.setTouchEmulationEnabled",{enabled:pointer==="touch",maxTouchPoints:2});
    await cdp.send("Page.navigate",{url:base+launch});await ready(cdp);await click(cdp,"#startButton");
    if(measuring){await push(cdp,2);await click(cdp,"#measureButton");}
    await H.evaluate(cdp,"CircuitMath.ready().then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))");
    await H.evaluate(cdp,`(()=>{
      window.__releaseFrames=[];window.__releaseInput=[];
      window.__axisGlyph=document.getElementById("graphNotation").firstElementChild;
      for(const type of ["pointermove","pointerup"])document.addEventListener(type,e=>{
        const m=window.__centripetalApp.getMotion();
        window.__releaseInput.push({type,t:performance.now(),eventTime:e.timeStamp,angle:m.angle,omega:m.omega});
      });
      const sample=()=>{
        const transform=document.getElementById("rotatingAssembly").getAttribute("transform");
        const angle=-Number(transform.match(/rotate\\(([^ ]+)/)[1])*Math.PI/180;
        window.__releaseFrames.push({t:performance.now(),angle});
        if(window.__releaseFrames.length<300)requestAnimationFrame(sample);
      };requestAnimationFrame(sample);
    })()`);
    const g=await H.evaluate(cdp,"(()=>{const m=document.getElementById('deviceSvg').getScreenCTM();return{x:300*m.a+m.e,y:230*m.d+m.f,r:213*m.a};})()");
    const input=async(type,a)=>{
      const x=g.x+g.r*Math.cos(a),y=g.y+g.r*Math.sin(a);
      if(pointer==="touch") await cdp.send("Input.dispatchTouchEvent",{type:{down:"touchStart",move:"touchMove",up:"touchEnd"}[type],touchPoints:type==="up"?[]:[{x,y,id:601,radiusX:1,radiusY:1,force:1}]});
      else await cdp.send("Input.dispatchMouseEvent",{type:{down:"mousePressed",move:"mouseMoved",up:"mouseReleased"}[type],x,y,button:"left",buttons:type==="up"?0:1,clickCount:1});
    };
    const sign=pointer==="touch"?-1:1;
    await input("down",0);
    for(let i=1;i<=12;i++){await pause(16);await input("move",-sign*i*.2);}
    await pause(900); // The animation must not wait for a delayed pointerup.
    await input("up",-sign*2.4);await pause(350);
    const data=await H.evaluate(cdp,"({frames:window.__releaseFrames,input:window.__releaseInput,axesReused:window.__axisGlyph===document.getElementById('graphNotation').firstElementChild})");
    const up=data.input.find(e=>e.type==="pointerup"),after=data.frames.filter(f=>f.t>=up.t);
    const lastMove=data.input.filter(e=>e.type==="pointermove").at(-1);
    const waiting=data.frames.filter(f=>f.t>lastMove.t+33 && f.t<up.t);
    assert.ok(waiting.length>=10,"observe the gap before the delayed release");
    for(let i=1;i<waiting.length;i++) assert.ok(sign*(waiting[i].angle-waiting[i-1].angle)>0,"rotation must continue while waiting for pointerup");
    assert.ok(sign*up.omega>1,"release has the gesture direction");
    assert.ok(after.length>=6,"observe consecutive painted transforms after release");
    assert.ok(sign*(after[0].angle-up.angle)>0,"the very first post-release frame advances");
    const firstMoveMs=after[0].t-up.t;
    assert.ok(firstMoveMs<50,"release has no multi-frame wait: "+JSON.stringify({rate,pointer,measuring,firstMoveMs}));
    for(let i=1;i<after.length;i++) assert.ok(sign*(after[i].angle-after[i-1].angle)>0,"no stationary rendered frame after release");
    assert.ok(data.axesReused,"sampling retains the fixed LaTeX axis glyphs");
    const last=after.at(-1),expected=up.angle+up.omega*(last.t-up.t)/1000;
    assert.ok(Math.abs(last.angle-expected)<Math.abs(up.omega)*.02,"displayed angle follows elapsed time across the handoff");
    const maxFrameMs=Math.max(...after.slice(1).map((f,i)=>f.t-after[i].t));
    reports.push({rate,pointer,measuring,waitingFrames:waiting.length,firstMoveMs,maxFrameMs,frames:after.length});
    if(rate===1 && pointer==="mouse" && !measuring) {
      await H.evaluate(cdp,"(()=>{const until=performance.now()+180;while(performance.now()<until){};})()");
      await pause(80);
      const f=await H.evaluate(cdp,"window.__releaseFrames.at(-1)");
      assert.ok(Math.abs(f.angle-(up.angle+up.omega*(f.t-up.t)/1000))<Math.abs(up.omega)*.02,"long task does not discard rotation time");
    }
    if(rate===1 && pointer==="mouse" && measuring) {
      const before=await H.evaluate(cdp,"window.__centripetalApp.getState().tasks[0].runs[0].q.length");
      await H.evaluate(cdp,"document.addEventListener('pointerup',()=>requestAnimationFrame(()=>window.dispatchEvent(new Event('blur'))),{once:true})");
      await input("down",0);await pause(20);await input("move",-1);await input("up",-1);await pause(100);
      assert.equal(await H.evaluate(cdp,"window.__centripetalApp.getState().tasks[0].runs[0].q.length"),before,"cancelling between the frame and queued sampling task records no point");
      assert.equal(await H.evaluate(cdp,"window.__centripetalApp.getMotion().measuring"),false);
    }
  }
  await cdp.send("Emulation.setCPUThrottlingRate",{rate:1});
  fs.writeFileSync(path.join(root,"output/playwright",`centripetal-${label}-release-frames.json`),JSON.stringify(reports,null,2));
  console.log(label+" release frames: "+JSON.stringify(reports));
}
async function lowSpeedFeedback(cdp, base, launch) {
  await cdp.send('Page.navigate',{url:base+launch});await ready(cdp);
  await click(cdp,'#startButton');await push(cdp,1);await click(cdp,'#measureButton');
  await brake(cdp,700);await pause(100);
  assert.equal(await H.evaluate(cdp,"document.getElementById('measurementHint').dataset.status"),'slow');
  assert.match(await H.evaluate(cdp,"document.getElementById('measurementHint').textContent"),/轉速太低/);
  assert.equal(await H.evaluate(cdp,'window.__centripetalApp.getMotion().measuring'),true,'low speed does not disarm measurement');
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
    await continuousRelease(cdp,sourceBase,`/sim/${slug}/index.html`,"source");
    await responsiveSpin(cdp, sourceBase, `/sim/${slug}/index.html`);
    await scenario(cdp, sourceBase, `/sim/${slug}/index.html`, "source", 1280, 800);
    await scenario(cdp, sourceBase, `/sim/${slug}/index.html`, "source", 390, 600);
    await buttonOnly(cdp, sourceBase, `/sim/${slug}/index.html`, "source");
    await signedMeasurements(cdp, sourceBase, `/sim/${slug}/index.html`, "source");
    await lowSpeedFeedback(cdp, sourceBase, `/sim/${slug}/index.html`);
    for (const [width, height] of [[320,500],[390,500],[390,844],[480,320],[320,225]]) await layoutOnly(cdp, sourceBase, `/sim/${slug}/index.html`, width, height);
    await H.closeServer(server); server = null;
    const extracted = H.buildAndExtractPackage(tempRoot, { slug }); packageDirectory = extracted.packageDirectory;
    server = H.createServer(packageDirectory); await H.listenServer(server);
    await continuousRelease(cdp,`http://127.0.0.1:${server.address().port}`,extracted.activityPath,"package");
    await scenario(cdp, `http://127.0.0.1:${server.address().port}`, extracted.activityPath, "package", 390, 600);
    await buttonOnly(cdp, `http://127.0.0.1:${server.address().port}`, extracted.activityPath, "package");
    await signedMeasurements(cdp, `http://127.0.0.1:${server.address().port}`, extracted.activityPath, "package");
    await lowSpeedFeedback(cdp, `http://127.0.0.1:${server.address().port}`, extracted.activityPath);
    await responsiveSpin(cdp, `http://127.0.0.1:${server.address().port}`, extracted.activityPath);
    await layoutOnly(cdp, `http://127.0.0.1:${server.address().port}`, extracted.activityPath, 320, 500);
    await layoutOnly(cdp, `http://127.0.0.1:${server.address().port}`, extracted.activityPath, 320, 225);
    assert.deepEqual(errors, [], `Browser exceptions: ${errors.join("\n")}`);
    console.log("Centripetal source and extracted-package browser regression passed");
  } finally {
    await H.cleanupResources({ chrome, cdp, server, profileDirectory: profile, packageDirectory, tempRoot });
  }
}
if (require.main === module) main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
