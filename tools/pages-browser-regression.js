#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');
const H = require('./position-time-browser-regression');
const {build, directory, activities} = require('./build-pages');

async function main() {
  const output = path.resolve(__dirname, '../output/playwright/pages');
  fs.mkdirSync(output, {recursive: true});
  const temp = fs.realpathSync(os.tmpdir());
  const profile = fs.mkdtempSync(path.join(temp, 'simlab-pages-chrome-'));
  const remote = process.env.SIMLAB_PAGES_URL;
  const errors = [], evidence = [];
  let server, chrome, cdp, failure, current;
  try {
    if (!remote) {
      build();
      server = H.createServer(path.dirname(directory));
      await H.listenServer(server);
    }
    const base = remote || 'http://127.0.0.1:' + server.address().port + '/pages/';
    const args = ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--no-first-run', '--disable-background-networking', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'];
    if (process.platform !== 'win32' && process.getuid?.() === 0) args.unshift('--no-sandbox');
    chrome = spawn(H.findBrowser(), args, {stdio: ['ignore', 'ignore', 'pipe']});
    const spawnFailure = new Promise((_, reject) => chrome.once('error', reject));
    chrome.stderr.on('data', () => {});
    const port = await Promise.race([H.withTimeout(H.devToolsPort(profile, chrome), 35000, 'Chrome startup'), spawnFailure]);
    const {body: target} = await H.fetchJson('http://127.0.0.1:' + port + '/json/new?about:blank', {method: 'PUT'});
    cdp = new H.CdpClient(target.webSocketDebuggerUrl, WebSocket, 30000);
    for (const domain of ['Runtime', 'Page', 'Network']) await cdp.send(domain + '.enable');
    cdp.on('Runtime.exceptionThrown', event => errors.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text));
    cdp.on('Network.responseReceived', ({response}) => {
      // Chrome probes this undeclared origin-level icon outside the Pages project.
      if (response.status >= 400 && new URL(response.url).pathname !== '/favicon.ico') errors.push(response.status + ' ' + response.url);
    });
    cdp.on('Network.loadingFailed', event => { if (!event.canceled) errors.push(event.errorText); });
    const evaluate = code => H.evaluate(cdp, code);
    const screenshot = async name => {
      const result = await cdp.send('Page.captureScreenshot', {format: 'png'});
      fs.writeFileSync(path.join(output, (remote ? 'live-' : 'local-') + name + '.png'), Buffer.from(result.data, 'base64'));
    };
    const apis = ['CircuitWorkbench', 'CircuitACWorkbench', 'CircuitHouseholdWorkbench', '__rocketApp'];
    for (const [width, height, touch] of [[1280, 900, false], [320, 500, true]]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: touch});
      await cdp.send('Emulation.setTouchEmulationEnabled', {enabled: touch, maxTouchPoints: 1});
      for (const [index, slug] of activities.entries()) {
        current = {slug, width, height, base};
        await cdp.send('Page.navigate', {url: new URL('index.html', base).href});
        await H.waitForCondition(() => evaluate('document.readyState === "complete" && !!document.querySelector("nav a")'), 'Homepage');
        assert.deepEqual(await evaluate('[...document.querySelectorAll("nav a")].map(a=>a.getAttribute("href"))'), activities.map(slug => slug + '/index.html'));
        assert.equal(await evaluate('document.querySelector("h1").textContent'), 'SimLab · 互動模擬');
        await evaluate('Promise.all([...document.images].map(img=>img.decode()))');
        assert(await evaluate('document.images.length === 4 && [...document.images].every(img=>img.naturalWidth>0 && !!img.alt && img.getBoundingClientRect().width <= innerWidth)'), 'Four readable screenshot previews');
        assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Homepage horizontal overflow');
        if (index === 0) await screenshot('home-' + width);
        const point = await H.controlPoint(cdp, 'a[href="' + slug + '/index.html"]');
        if (touch) {
          await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{...point, id: 1, radiusX: 2, radiusY: 2, force: 1}]});
          await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
        } else {
          await cdp.send('Input.dispatchMouseEvent', {type: 'mousePressed', ...point, button: 'left', buttons: 1, clickCount: 1});
          await cdp.send('Input.dispatchMouseEvent', {type: 'mouseReleased', ...point, button: 'left', buttons: 0, clickCount: 1});
        }
        const api = apis[index];
        await H.waitForCondition(() => evaluate('!!window.' + api), slug + ' initialization');
        const rocket = api === '__rocketApp';
        if (rocket) {
          assert(await evaluate(api + '.getScene() && ' + api + '.diagnostics().scene.webgl2'), 'Rocket WebGL initialization');
          assert.equal(await evaluate(api + '.controller.mode'), 'edit');
          assert.equal(await evaluate(api + '.getState().phase'), 'workshop');
          for (const action of [{type:'part',stage:0,part:'engine',value:0},{type:'part',stage:0,part:'large',value:2},{type:'capsule'},{type:'launch'}]) assert(await evaluate(api + '.command(' + JSON.stringify(action) + ')'), 'Legal rocket assembly action');
          await H.waitForCondition(() => evaluate(api + '.getState().phase === "pad" && ' + api + '.diagnostics().scene.renderCount > 0'), 'Assembled rocket on launchpad');
          assert(await evaluate('document.getElementById("renderFault").hidden'), 'Rocket renderer error');
        } else {
          await evaluate('if (typeof ' + api + '.setPlayback === "function") ' + api + '.setPlayback({paused:true})');
          assert(await evaluate(api + '.getDocument().components.length > 0'), 'Missing initial circuit');
        }
        await evaluate('document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))');
        assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), slug + ' horizontal overflow');
        const state = api + (rocket ? '.getState()' : '.getDocument()');
        const fullscreen = rocket ? '#fullscreenButton' : '[data-circuit-id="fullscreenButton"]';
        const before = await evaluate('JSON.stringify(' + state + ')');
        await H.clickControl(cdp, fullscreen, 'window', touch);
        await H.waitForCondition(() => evaluate('!!document.fullscreenElement'), 'Enter fullscreen');
        assert(await evaluate('document.fullscreenElement.contains(document.querySelector(' + JSON.stringify(fullscreen) + '))'));
        await H.clickControl(cdp, fullscreen, 'window', touch);
        await H.waitForCondition(() => evaluate('!document.fullscreenElement'), 'Exit fullscreen');
        assert.equal(await evaluate('JSON.stringify(' + state + ')'), before, 'Fullscreen changed simulation state');
        await screenshot(slug + '-' + width);
        if (rocket) {
          await cdp.send('Page.reload');
          await H.waitForCondition(() => evaluate('!!window.__rocketApp && document.readyState === "complete" && __rocketApp.getState().phase === "workshop"'), 'Rocket standalone refresh');
          assert(await evaluate('__rocketApp.getState().phase === "workshop" && __rocketApp.getState().flight === null && __rocketApp.getState().craft.stages[0].engine === null'), 'Standalone refresh must start fresh');
        }
        assert.deepEqual(errors, [], 'Browser or network errors');
        evidence.push({...current, previewsLoaded: true, fullscreen: true, statePreserved: true, ...(rocket ? {webgl: true, assembly: true, refreshFresh: true} : {})});
      }
    }
    fs.writeFileSync(path.join(output, (remote ? 'live-' : 'local-') + 'report.json'), JSON.stringify({evidence, errors}, null, 2) + '\n');
  } catch (error) {
    failure = error;
    console.error('Pages browser failure:', current, errors);
    if (cdp) {
      try {
        const {data} = await cdp.send('Page.captureScreenshot', {format: 'png'});
        fs.writeFileSync(path.join(output, 'failure.png'), Buffer.from(data, 'base64'));
      } catch {}
    }
  }
  const cleanup = [];
  try { await H.stopChrome(chrome, cdp); } catch (error) { cleanup.push(error); }
  try { cdp?.close(); await H.closeServer(server); } catch (error) { cleanup.push(error); }
  try {
    const owned = H.validateOwnedDirectory(profile, temp, /^simlab-pages-chrome-[A-Za-z0-9]+$/, 'Pages browser profile');
    fs.rmSync(owned, {recursive: true, force: false, maxRetries: 3, retryDelay: 100});
  } catch (error) { cleanup.push(error); }
  if (failure || cleanup.length) throw new AggregateError([failure, ...cleanup].filter(Boolean), 'Pages browser verification failed');
  console.log('Pages browser checks passed: ' + evidence.length + ' simulation/viewport cases, four screenshot links, native fullscreen, state preservation and rocket WebGL/assembly/refresh (' + (remote || 'local project subpath') + ').');
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
