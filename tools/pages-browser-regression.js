#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');
const H = require('./position-time-browser-regression');
const {build, directory, workbenches} = require('./build-pages');

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
    const args = ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--no-first-run', '--disable-background-networking', 'about:blank'];
    if (process.platform !== 'win32' && process.getuid?.() === 0) args.unshift('--no-sandbox');
    chrome = spawn(H.findBrowser(), args, {stdio: ['ignore', 'ignore', 'pipe']});
    const spawnFailure = new Promise((_, reject) => chrome.once('error', reject));
    chrome.stderr.on('data', () => {});
    const port = await Promise.race([H.withTimeout(H.devToolsPort(profile, chrome), 35000, 'Chrome startup'), spawnFailure]);
    const {body: target} = await H.fetchJson('http://127.0.0.1:' + port + '/json/new?about:blank', {method: 'PUT'});
    cdp = new H.CdpClient(target.webSocketDebuggerUrl, WebSocket, 30000);
    for (const domain of ['Runtime', 'Page', 'Network']) await cdp.send(domain + '.enable');
    cdp.on('Runtime.exceptionThrown', event => errors.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text));
    cdp.on('Network.responseReceived', ({response}) => { if (response.status >= 400) errors.push(response.status + ' ' + response.url); });
    cdp.on('Network.loadingFailed', event => { if (!event.canceled) errors.push(event.errorText); });
    const evaluate = code => H.evaluate(cdp, code);
    const screenshot = async name => {
      const result = await cdp.send('Page.captureScreenshot', {format: 'png'});
      fs.writeFileSync(path.join(output, (remote ? 'live-' : 'local-') + name + '.png'), Buffer.from(result.data, 'base64'));
    };
    const apis = ['CircuitWorkbench', 'CircuitACWorkbench', 'CircuitHouseholdWorkbench'];
    for (const [width, height, touch] of [[1280, 900, false], [320, 500, true]]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: touch});
      await cdp.send('Emulation.setTouchEmulationEnabled', {enabled: touch, maxTouchPoints: 1});
      for (const [index, slug] of workbenches.entries()) {
        current = {slug, width, height, base};
        await cdp.send('Page.navigate', {url: new URL('index.html', base).href});
        await H.waitForCondition(() => evaluate('document.readyState === "complete" && !!document.querySelector("nav a")'), 'Homepage');
        assert.deepEqual(await evaluate('[...document.querySelectorAll("nav a")].map(a=>a.getAttribute("href"))'), workbenches.map(slug => slug + '/index.html'));
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
        await evaluate('if (typeof ' + api + '.setPlayback === "function") ' + api + '.setPlayback({paused:true})');
        assert(await evaluate(api + '.getDocument().components.length > 0'), 'Missing initial circuit');
        assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'), slug + ' horizontal overflow');
        const before = await evaluate('JSON.stringify(' + api + '.getDocument())');
        await H.clickControl(cdp, '[data-circuit-id="fullscreenButton"]', 'window', touch);
        await H.waitForCondition(() => evaluate('!!document.fullscreenElement'), 'Enter fullscreen');
        assert(await evaluate('document.fullscreenElement.contains(document.querySelector("[data-circuit-id=fullscreenButton]"))'));
        await H.clickControl(cdp, '[data-circuit-id="fullscreenButton"]', 'window', touch);
        await H.waitForCondition(() => evaluate('!document.fullscreenElement'), 'Exit fullscreen');
        assert.equal(await evaluate('JSON.stringify(' + api + '.getDocument())'), before, 'Fullscreen changed circuit');
        await screenshot(slug + '-' + width);
        assert.deepEqual(errors, [], 'Browser or network errors');
        evidence.push({...current, fullscreen: true, circuitPreserved: true});
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
  console.log('Pages browser checks passed: ' + evidence.length + ' workbench/viewport cases, homepage links, loading, native fullscreen and circuit preservation (' + (remote || 'local project subpath') + ').');
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
