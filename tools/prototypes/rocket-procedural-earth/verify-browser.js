const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const H = require('../../position-time-browser-regression');
const root = path.resolve(__dirname, '../../..');
const out = path.join(root, 'output/playwright/rocket-procedural-earth');
const temporary = fs.realpathSync(os.tmpdir());
const report = {completed: false, views: [], errors: []};

(async () => {
  fs.mkdirSync(out, {recursive: true});
  const profile = fs.mkdtempSync(path.join(temporary, 'simlab-procedural-preview-'));
  let browser, cdp, server;
  try {
    server = H.createServer(root);
    const original = server.listeners('request')[0]; server.removeListener('request', original);
    server.on('request', (req, res) => {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/tools/prototypes/rocket-procedural-earth/') && url.pathname.endsWith('.mjs')) {
        const file = path.join(__dirname, path.basename(url.pathname));
        res.writeHead(200, {'Content-Type': 'text/javascript'}); res.end(fs.readFileSync(file));
      } else original(req, res);
    });
    await H.listenServer(server);
    browser = spawn(H.findBrowser(), ['--headless=new', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', '--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], {stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true});
    browser.stderr.resume();
    const port = await H.devToolsPort(profile, browser);
    const {body: tab} = await H.fetchJson('http://127.0.0.1:' + port + '/json/new?about:blank', {method: 'PUT'});
    cdp = new H.CdpClient(tab.webSocketDebuggerUrl, WebSocket, 30000);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable');
    cdp.on('Runtime.exceptionThrown', e => report.errors.push(e.exceptionDetails?.text));
    cdp.on('Runtime.consoleAPICalled', e => {if (e.type === 'error') report.errors.push(e.args.map(a => a.value || a.description).join(' '));});
    let urls = [];
    cdp.on('Network.requestWillBeSent', e => {if (!e.request.url.endsWith('favicon.ico')) urls.push(e.request.url);});
    for (const [label, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
      await cdp.send('Network.emulateNetworkConditions', {offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1});
      await cdp.send('Network.clearBrowserCache'); urls = [];
      await cdp.send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: label === 'mobile'});
      await cdp.send('Emulation.setTouchEmulationEnabled', {enabled: label === 'mobile', maxTouchPoints: 2});
      await cdp.send('Page.navigate', {url: 'http://127.0.0.1:' + server.address().port + '/tools/prototypes/rocket-procedural-earth/index.html'});
      await H.waitForCondition(() => H.evaluate(cdp, 'Boolean(window.preview?.diagnostics.ready)'), 'procedural globe', 45000);
      const globe = await H.evaluate(cdp, 'preview.diagnostics.globe');
      assert.equal(globe.width, label === 'desktop' ? 2048 : 1024);
      assert.equal(globe.height * 2, globe.width);
      assert(globe.coastalSamples > 0 && globe.coastalSamples < globe.width * globe.height / 4);
      assert(!urls.some(url => /\/assets\/|https:/.test(url)), JSON.stringify(urls));
      const requests = [...new Set(urls)];
      const sourceBytes = requests.reduce((sum, url) => sum + fs.statSync(path.join(root, new URL(url).pathname)).size, 0);
      await cdp.send('Network.emulateNetworkConditions', {offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1});
      for (const view of ['globe', 'mountains', 'forest', 'desert']) {
        const position = await H.evaluate(cdp, '(()=>{const r=document.querySelector(' + JSON.stringify('[data-view="' + view + '"]') + ').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
        await cdp.send('Input.dispatchMouseEvent', {type: 'mousePressed', button: 'left', clickCount: 1, ...position});
        await cdp.send('Input.dispatchMouseEvent', {type: 'mouseReleased', button: 'left', clickCount: 1, ...position});
        await H.delay(100);
        const result = await cdp.send('Page.captureScreenshot', {format: 'png'});
        fs.writeFileSync(path.join(out, label + '-' + view + '.png'), Buffer.from(result.data, 'base64'));
        const state = await H.evaluate(cdp, '({diagnostics:preview.diagnostics,width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight})');
        assert(state.width <= width && state.height <= height);
        report.views.push({label, view, ...state, sourceBytes, requests});
        if (label === 'desktop' && view === 'globe') {
          await H.evaluate(cdp, 'document.getElementById("clouds").click()');
          for (const [coast, dx] of [['africa', 0], ['americas', 308], ['asia-pacific', -628]]) {
            if (dx) {
              await cdp.send('Input.dispatchMouseEvent', {type: 'mousePressed', button: 'left', clickCount: 1, x: 720, y: 480});
              await cdp.send('Input.dispatchMouseEvent', {type: 'mouseMoved', buttons: 1, x: 720 + dx, y: 480});
              await cdp.send('Input.dispatchMouseEvent', {type: 'mouseReleased', button: 'left', clickCount: 1, x: 720 + dx, y: 480});
            }
            const shot = await cdp.send('Page.captureScreenshot', {format: 'png'});
            fs.writeFileSync(path.join(out, 'desktop-coasts-' + coast + '.png'), Buffer.from(shot.data, 'base64'));
          }
        }
      }
      if (label === 'mobile') {
        const before = await H.evaluate(cdp, 'preview.camera');
        await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: 160, y: 350, id: 1}]});
        await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: 210, y: 380, id: 1}]});
        await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
        const after = await H.evaluate(cdp, 'preview.camera');
        assert.notEqual(before.yaw, after.yaw);
        report.trustedTouch = {before, after};
        const points = [{x: 120, y: 340, id: 1}, {x: 230, y: 340, id: 2}];
        await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: points});
        await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: 105, y: 370, id: 1}, {x: 275, y: 370, id: 2}]});
        await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
        const pinch = await H.evaluate(cdp, 'preview.camera');
        assert(pinch.distance < after.distance);
        assert.notDeepEqual(pinch.target, after.target);
        report.trustedPinch = {before: after, after: pinch};
      }
      assert.equal(urls.length, requests.length, 'No additional requests while exploring offline');
    }
    assert.deepEqual(report.errors, []); report.completed = true;
    console.log(JSON.stringify({completed: true, views: report.views.map(({label, view, sourceBytes, diagnostics}) => ({label, view, sourceBytes, generationMs: diagnostics.generationMs, region: diagnostics.regions[view]}))}));
  } finally {
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    await H.stopChrome(browser, cdp); cdp?.close(); if (server) await H.closeServer(server);
    fs.rmSync(H.validateOwnedDirectory(profile, temporary, /^simlab-procedural-preview-[A-Za-z0-9]+$/, 'procedural preview'), {recursive: true, maxRetries: 5, retryDelay: 200});
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
