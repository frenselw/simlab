#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const AdmZip = require("adm-zip");
const { XMLParser } = require("fast-xml-parser");

const root = path.resolve(__dirname, "..");
const slug = "position-time-graph-motion-lab";
const profileNamePattern = /^simlab-position-time-chrome-[A-Za-z0-9]+$/;
const packageNamePattern = /^simlab-position-time-package-[A-Za-z0-9]+$/;
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function withTimeout(promise, milliseconds, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${milliseconds} ms.`)), milliseconds);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function formatError(error, indent = "") {
  const own = `${indent}${error.stack || error.message || String(error)}`;
  if (!(error instanceof AggregateError)) return own;
  return `${own}\n${Array.from(error.errors, (nested) => formatError(nested, `${indent}  `)).join("\n")}`;
}

function commandPath(command) {
  const lookup = spawnSync(process.platform === "win32" ? "where" : "which", [command], { encoding: "utf8" });
  return lookup.status === 0 ? lookup.stdout.split(/\r?\n/).find(Boolean) : null;
}

function findBrowser() {
  const explicit = process.env.CHROME_PATH;
  const candidates = explicit ? [explicit] : process.platform === "darwin" ? [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    path.join(os.homedir(), "Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
  ] : process.platform === "win32" ? [
    path.join(process.env.PROGRAMFILES || "", "Google/Chrome/Application/chrome.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "", "Google/Chrome/Application/chrome.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe"),
    path.join(process.env.PROGRAMFILES || "", "Chromium/Application/chrome.exe")
  ] : [
    commandPath("google-chrome"),
    commandPath("google-chrome-stable"),
    commandPath("chromium"),
    commandPath("chromium-browser"),
    "/usr/bin/google-chrome",
    "/usr/bin/chromium"
  ];
  return candidates.filter(Boolean).find((candidate) => fs.existsSync(candidate)) || null;
}

function contentType(filePath) {
  return ({ ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml" })[path.extname(filePath)] || "application/octet-stream";
}

function resolveScoLaunchPath(packageRoot, manifestSource, options = {}) {
  let parsed;
  try { parsed = new XMLParser({ ignoreAttributes: false }).parse(manifestSource); }
  catch (error) { throw new Error(`Extracted imsmanifest.xml is invalid: ${error.message}`); }
  const resources = [].concat(parsed.manifest?.resources?.resource || []);
  const scoResources = resources.filter((resource) => String(resource?.["@_adlcp:scormtype"] || "").toLowerCase() === "sco");
  if (scoResources.length !== 1) throw new Error(`Extracted imsmanifest.xml must declare exactly one SCO resource; found ${scoResources.length}.`);
  const href = scoResources[0]["@_href"];
  if (typeof href !== "string" || !href || href !== href.trim()) throw new Error("The SCO resource must declare a non-empty href.");
  if (href.includes("\\") || href.includes("%") || href.includes("?") || href.includes("#") || href.startsWith("/") || /^[A-Za-z][A-Za-z\d+.-]*:/.test(href)) throw new Error(`Unsafe SCO launch href: ${href}`);
  const segments = href.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) throw new Error(`Unsafe SCO launch href: ${href}`);
  const requested = path.resolve(packageRoot, ...segments);
  if (!requested.startsWith(`${packageRoot}${path.sep}`)) throw new Error(`Unsafe SCO launch href: ${href}`);
  const realpath = options.realpathSync || fs.realpathSync;
  const lstat = options.lstatSync || fs.lstatSync;
  let actual;
  try { actual = realpath(requested); }
  catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") throw new Error(`SCO launch file does not exist: ${href}`);
    throw error;
  }
  if (!actual.startsWith(`${packageRoot}${path.sep}`)) throw new Error(`SCO launch href escapes the extracted package: ${href}`);
  const stat = lstat(actual);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`SCO launch href is not a regular file: ${href}`);
  return { href, filePath: actual, urlPath: `/${segments.map(encodeURIComponent).join("/")}` };
}

function resolvePackageFile(pathname, options = {}) {
  const packageRoot = options.packageRoot;
  const realpath = options.realpathSync || fs.realpathSync;
  if (!packageRoot || !pathname.startsWith("/")) return { status: 403 };
  const requested = path.resolve(packageRoot, `.${pathname}`);
  if (requested !== packageRoot && !requested.startsWith(`${packageRoot}${path.sep}`)) return { status: 403 };
  let actual;
  try { actual = realpath(requested); }
  catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return { status: 404 };
    throw error;
  }
  if (actual !== packageRoot && !actual.startsWith(`${packageRoot}${path.sep}`)) return { status: 403 };
  return { status: 200, filePath: actual };
}

function createServer(packageRoot) {
  return http.createServer((request, response) => {
    let requestUrl;
    let pathname;
    try {
      requestUrl = new URL(request.url, "http://127.0.0.1");
      pathname = decodeURIComponent(requestUrl.pathname);
    }
    catch { response.writeHead(400).end("Bad request"); return; }
    if (pathname === "/__embed-scroll-test.html") {
      const src = requestUrl.searchParams.get("src") || "";
      let srcPath;
      try { srcPath = decodeURIComponent(new URL(src, "http://127.0.0.1").pathname); }
      catch { response.writeHead(400).end("Bad iframe source"); return; }
      const source = resolvePackageFile(srcPath, { packageRoot });
      if (source.status !== 200 || path.extname(source.filePath) !== ".html") { response.writeHead(403).end("Forbidden"); return; }
      const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0} .spacer{height:300px} iframe{display:block;width:100%;height:500px;border:0} .after{height:1200px}</style><div class="spacer"></div><iframe id="activity" title="embedded activity"></iframe><div class="after"></div><script>const values={"cmi.core.lesson_status":"not attempted"};window.API={LMSInitialize:()=>"true",LMSGetValue:(key)=>values[key]||"",LMSSetValue:(key,value)=>(values[key]=String(value),"true"),LMSCommit:()=>"true",LMSFinish:()=>"true",LMSGetLastError:()=>"0",LMSGetErrorString:()=>"No error",LMSGetDiagnostic:()=>""};document.getElementById("activity").src=${JSON.stringify(src)};<\/script>`;
      response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      response.end(html);
      return;
    }
    let resolved;
    try { resolved = resolvePackageFile(pathname, { packageRoot }); }
    catch { response.writeHead(500).end("File resolution failed"); return; }
    if (resolved.status !== 200) { response.writeHead(resolved.status).end(resolved.status === 404 ? "Not found" : "Forbidden"); return; }
    fs.readFile(resolved.filePath, (error, content) => {
      if (error) { response.writeHead(error.code === "ENOENT" ? 404 : 500).end("Not found"); return; }
      response.writeHead(200, { "content-type": contentType(resolved.filePath), "cache-control": "no-store" });
      response.end(content);
    });
  });
}

function buildAndExtractPackage(tempRoot, options = {}) {
  const activitySlug = options.slug || slug;
  const packagePrefix = options.packagePrefix || "simlab-position-time-package-";
  const ownedPackagePattern = options.packageNamePattern || packageNamePattern;
  const packaged = spawnSync(process.execPath, [path.join(root, "tools/package-scorm.js"), activitySlug], { cwd: root, encoding: "utf8" });
  if (packaged.status !== 0) throw new Error(`SCORM packaging failed.\n${packaged.stdout || ""}${packaged.stderr || ""}`.trim());
  const zipPath = path.join(root, "output", `${activitySlug}-scorm.zip`);
  if (!fs.existsSync(zipPath)) throw new Error(`SCORM packager did not create ${zipPath}`);
  const packageDirectory = fs.mkdtempSync(path.join(tempRoot, packagePrefix));
  try {
    validateOwnedDirectory(packageDirectory, tempRoot, ownedPackagePattern, "SCORM package");
    const zip = new AdmZip(zipPath);
    for (const entry of zip.getEntries()) {
      const normalized = entry.entryName.replace(/\\/g, "/");
      if (path.posix.isAbsolute(normalized) || normalized.split("/").includes("..")) throw new Error(`Unsafe SCORM ZIP entry: ${entry.entryName}`);
    }
    zip.extractAllTo(packageDirectory, true);
    const manifestPath = path.join(packageDirectory, "imsmanifest.xml");
    if (!fs.existsSync(manifestPath) || !fs.lstatSync(manifestPath).isFile()) throw new Error("Extracted SCORM package has no root imsmanifest.xml.");
    const resolvedPackage = fs.realpathSync(packageDirectory);
    const launch = resolveScoLaunchPath(resolvedPackage, fs.readFileSync(manifestPath, "utf8"));
    return { packageDirectory: resolvedPackage, activityPath: launch.urlPath };
  } catch (error) {
    if (fs.existsSync(packageDirectory)) {
      const exactDirectory = validateOwnedDirectory(packageDirectory, tempRoot, ownedPackagePattern, "SCORM package");
      fs.rmSync(exactDirectory, { recursive: true, force: false, maxRetries: 3, retryDelay: 100 });
    }
    throw error;
  }
}

function listenServer(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function devToolsPort(profileDirectory, chrome) {
  const activePortFile = path.join(profileDirectory, "DevToolsActivePort");
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (chrome.exitCode !== null) throw new Error(`Chrome exited before CDP became ready (exit ${chrome.exitCode}).`);
    try {
      const [port] = fs.readFileSync(activePortFile, "utf8").trim().split(/\r?\n/);
      if (Number(port) > 0) return Number(port);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await delay(50);
  }
  throw new Error("Timed out waiting for Chrome DevToolsActivePort.");
}

function childHasExited(child) {
  return Boolean(child.__simlabSpawnError) || child.exitCode !== null || child.signalCode !== null;
}

function waitForChildExit(child, milliseconds = 3000) {
  if (childHasExited(child)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      child.off("exit", onExit);
      child.off("error", onError);
    };
    const onExit = () => { cleanup(); resolve(); };
    const onError = (error) => { cleanup(); reject(error); };
    const timer = setTimeout(() => { cleanup(); reject(new Error(`Chrome process exit timed out after ${milliseconds} ms.`)); }, milliseconds);
    child.once("exit", onExit);
    child.once("error", onError);
  });
}

async function stopChrome(chrome, cdp, options = {}) {
  if (!chrome) return;
  const waitForExit = options.waitForExit || waitForChildExit;
  const gracefulMs = options.gracefulMs ?? 2500;
  const terminateMs = options.terminateMs ?? 2000;
  const forceMs = options.forceMs ?? 2000;
  if (!childHasExited(chrome) && cdp) {
    try { await cdp.send("Browser.close"); } catch {}
  }
  try { await waitForExit(chrome, gracefulMs); return; } catch {}
  if (!childHasExited(chrome)) chrome.kill("SIGTERM");
  try { await waitForExit(chrome, terminateMs); return; } catch {}
  if (!childHasExited(chrome)) chrome.kill("SIGKILL");
  await waitForExit(chrome, forceMs);
}

function validateOwnedProfile(profileDirectory, tempRoot = fs.realpathSync(os.tmpdir()), fileSystem = fs) {
  return validateOwnedDirectory(profileDirectory, tempRoot, profileNamePattern, "Chrome profile", fileSystem);
}

function validateOwnedDirectory(directory, tempRoot, namePattern, label, fileSystem = fs) {
  const resolvedTemp = fileSystem.realpathSync(tempRoot);
  const resolvedDirectory = fileSystem.realpathSync(directory);
  const stat = fileSystem.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Refusing to remove a ${label} that is not a real directory.`);
  if (path.dirname(resolvedDirectory) !== resolvedTemp || path.resolve(directory) !== resolvedDirectory || !namePattern.test(path.basename(resolvedDirectory))) {
    throw new Error(`Refusing to remove unowned ${label} path: ${directory}`);
  }
  return resolvedDirectory;
}

function removeOwnedProfile(profileDirectory, tempRoot) {
  if (!profileDirectory || !fs.existsSync(profileDirectory)) return;
  const exactProfile = validateOwnedProfile(profileDirectory, tempRoot);
  fs.rmSync(exactProfile, { recursive: true, force: false, maxRetries: 3, retryDelay: 100 });
  if (fs.existsSync(exactProfile)) throw new Error(`Chrome profile cleanup did not remove ${exactProfile}`);
}

function removeOwnedPackage(packageDirectory, tempRoot) {
  if (!packageDirectory || !fs.existsSync(packageDirectory)) return;
  const exactDirectory = validateOwnedDirectory(packageDirectory, tempRoot, packageNamePattern, "SCORM package");
  fs.rmSync(exactDirectory, { recursive: true, force: false, maxRetries: 3, retryDelay: 100 });
  if (fs.existsSync(exactDirectory)) throw new Error(`SCORM package cleanup did not remove ${exactDirectory}`);
}

function closeServer(server) {
  if (!server?.listening) return Promise.resolve();
  return withTimeout(new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())), 3000, "HTTP server close");
}

async function cleanupResources(resources, operations = {}) {
  const stop = operations.stopChrome || stopChrome;
  const close = operations.closeServer || closeServer;
  const remove = operations.removeOwnedProfile || removeOwnedProfile;
  const removePackage = operations.removeOwnedPackage || removeOwnedPackage;
  const errors = [];
  try { await stop(resources.chrome, resources.cdp); } catch (error) { errors.push(error); }
  try { resources.cdp?.close(); } catch (error) { errors.push(error); }
  try { await close(resources.server); } catch (error) { errors.push(error); }
  try { remove(resources.profileDirectory, resources.tempRoot); } catch (error) { errors.push(error); }
  try { removePackage(resources.packageDirectory, resources.tempRoot); } catch (error) { errors.push(error); }
  if (errors.length) throw new AggregateError(errors, "Browser regression cleanup failed.");
}

class CdpClient {
  constructor(webSocketUrl, WebSocketClass = WebSocket, commandTimeout = 5000) {
    this.nextId = 1;
    this.pending = new Map();
    this.commandTimeout = commandTimeout;
    this.eventListeners = new Map();
    this.socket = new WebSocketClass(webSocketUrl);
    const opening = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", () => reject(new Error("Could not open the Chrome DevTools WebSocket.")), { once: true });
      this.socket.addEventListener("close", () => reject(new Error("Chrome DevTools WebSocket closed before opening.")), { once: true });
    });
    this.ready = withTimeout(opening, commandTimeout, "Chrome DevTools WebSocket open");
    this.socket.addEventListener("message", (event) => {
      let message;
      try { message = JSON.parse(String(event.data)); }
      catch (error) { this.rejectPending(new Error(`Invalid Chrome DevTools message: ${error.message}`)); return; }
      if (!message.id) {
        for (const handler of this.eventListeners.get(message.method) || []) handler(message.params || {});
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result);
    });
    this.socket.addEventListener("close", () => this.rejectPending(new Error("Chrome DevTools WebSocket closed.")));
    this.socket.addEventListener("error", () => this.rejectPending(new Error("Chrome DevTools WebSocket failed.")));
  }

  on(method, handler) {
    const listeners = this.eventListeners.get(method) || [];
    listeners.push(handler);
    this.eventListeners.set(method, listeners);
    return () => this.eventListeners.set(method, listeners.filter((item) => item !== handler));
  }

  rejectPending(error) {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    const result = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject, method }));
    try { this.socket.send(JSON.stringify({ id, method, params })); }
    catch (error) {
      this.pending.delete(id);
      throw error;
    }
    try { return await withTimeout(result, this.commandTimeout, `CDP ${method}`); }
    finally { this.pending.delete(id); }
  }

  close() {
    this.rejectPending(new Error("Chrome DevTools client closed."));
    if (this.socket.readyState < 2) this.socket.close();
  }
}

async function fetchJson(url, options = {}, milliseconds = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Fetch ${url} timed out after ${milliseconds} ms.`)), milliseconds);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body = await withTimeout(response.json(), milliseconds, `Read ${url}`);
    return { response, body };
  } finally {
    clearTimeout(timer);
  }
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}

async function waitForActivity(cdp) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const ready = await evaluate(cdp, "document.readyState === 'complete' && Boolean(document.querySelector('[data-drag=\"velocity:A\"]'))");
    if (ready) return;
    await delay(50);
  }
  throw new Error("Activity did not finish rendering its production velocity control.");
}

async function runViewport(cdp, baseUrl, activityPath, width, height) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  await cdp.send("Page.navigate", { url: `${baseUrl}${activityPath}?browser-regression=${width}` });
  await waitForActivity(cdp);
  const cases = [];
  for (const initialVelocity of [0, 0.5, -0.5]) {
    const setup = await evaluate(cdp, `(async () => {
      const input = document.querySelector('[data-quantity="velocity"]');
      input.value = ${initialVelocity};
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const handle = document.querySelector('[data-drag="velocity:A"]');
      handle.scrollIntoView({ block: 'center', inline: 'center' });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const svg = handle.ownerSVGElement;
      const point = svg.createSVGPoint();
      point.x = Number(handle.getAttribute('cx'));
      point.y = Number(handle.getAttribute('cy'));
      const centre = point.matrixTransform(svg.getScreenCTM());
      return {
        x: centre.x,
        y: centre.y,
        top: document.elementFromPoint(centre.x, centre.y)?.closest('[data-drag]')?.dataset.drag || null,
        hitBounds: (() => { const bounds = handle.getBoundingClientRect(); return { width: bounds.width, height: bounds.height }; })(),
        styles: Array.from(document.styleSheets, (sheet) => sheet.href).filter(Boolean),
        scripts: Array.from(document.scripts, (script) => script.src).filter(Boolean),
        runtimeReady: Boolean(window.SimScorm && window.SimActivityFlow && window.PositionTimeScoring && window.PositionTimeGenerator),
        upperOverflowY: getComputedStyle(document.getElementById('labUpperScroll')).overflowY,
        upperTouchAction: getComputedStyle(document.getElementById('labUpperScroll')).touchAction,
        stageOverflowY: getComputedStyle(document.querySelector('.lab-stage')).overflowY,
        phaseDisplay: getComputedStyle(document.getElementById('phaseBadge')).display,
        upperScrollTop: document.getElementById('labUpperScroll').scrollTop,
        desktopRects: (() => {
          const rect = (element) => { const value = element.getBoundingClientRect(); return { left: value.left, right: value.right, top: value.top, bottom: value.bottom }; };
          return { header: rect(document.querySelector('.compact-header')), panel: rect(document.getElementById('labPanel')), stage: rect(document.querySelector('.lab-stage')) };
        })(),
        velocity: Number(document.querySelector('[data-quantity="velocity"]').value),
        x0: Number(document.querySelector('[data-quantity="x0"]').value)
      };
    })()`);
    assert.ok(setup.styles.some((href) => href.endsWith("/position-time-graph-motion-lab/styles.css")), `${width}px: packaged activity stylesheet loaded`);
    assert.ok(setup.scripts.some((src) => src.endsWith("/position-time-graph-motion-lab/main.js")), `${width}px: packaged production main.js loaded`);
    assert.ok(setup.scripts.some((src) => src.endsWith("/position-time-graph-motion-lab/generator.js")), `${width}px: packaged generator.js loaded`);
    assert.ok(setup.scripts.some((src) => src.endsWith("/shared/scorm.js")), `${width}px: packaged shared SCORM runtime loaded`);
    assert.ok(setup.scripts.some((src) => src.endsWith("/shared/activity-flow.js")), `${width}px: packaged shared activity flow loaded`);
    assert.equal(setup.runtimeReady, true, `${width}px: packaged runtime executed successfully`);
    if (width < 820) {
      assert.equal(setup.upperOverflowY, "hidden", `${width}px: the complete visual region is fixed`);
      assert.equal(setup.upperTouchAction, "pan-y", `${width}px: blank visual-region swipes remain available to the embedding page`);
      assert.equal(setup.stageOverflowY, "hidden", `${width}px: the stage is not a nested vertical scroller`);
    }
    if (width >= 820) {
      assert.ok(setup.desktopRects.header.bottom <= setup.desktopRects.panel.top + 1, `${width}px: desktop panel starts below the full-width header`);
      assert.ok(setup.desktopRects.header.bottom <= setup.desktopRects.stage.top + 1, `${width}px: desktop stage starts below the full-width header`);
      assert.ok(setup.desktopRects.panel.right <= setup.desktopRects.stage.left + 1, `${width}px: desktop panel remains to the left of the stage`);
    }
    if (width <= 420) assert.equal(setup.phaseDisplay, "none", `${width}px: duplicate header phase badge is hidden on phones`);
    assert.ok(setup.hitBounds.width >= 51.5 && setup.hitBounds.height >= 51.5, `${width}px: production SVG provides a real CTM-aware 52px velocity hit target`);
    assert.equal(setup.top, "velocity:A", `${width}px v=${initialVelocity}: elementFromPoint must hit the velocity target`);
    assert.equal(setup.velocity, initialVelocity, `${width}px v=${initialVelocity}: setup velocity rendered`);
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: setup.x, y: setup.y });
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: setup.x, y: setup.y, button: "left", buttons: 1, clickCount: 1 });
    if (width < 820) {
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: setup.x, y: setup.y, deltaX: 0, deltaY: 140 });
      await delay(50);
      const activeDrag = await evaluate(cdp, `({ scrollTop: document.getElementById('labUpperScroll').scrollTop })`);
      assert.equal(activeDrag.scrollTop, setup.upperScrollTop, `${width}px v=${initialVelocity}: a wheel gesture during handle drag does not pan the upper region`);
    }
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: setup.x + 30, y: setup.y, button: "left", buttons: 1 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: setup.x + 30, y: setup.y, button: "left", buttons: 0, clickCount: 1 });
    const after = await evaluate(cdp, `({
      velocity: Number(document.querySelector('[data-quantity="velocity"]').value),
      x0: Number(document.querySelector('[data-quantity="x0"]').value)
    })`);
    assert.notEqual(after.velocity, initialVelocity, `${width}px v=${initialVelocity}: real mouse drag must change velocity`);
    assert.equal(after.x0, setup.x0, `${width}px v=${initialVelocity}: velocity drag must not change x0`);
    cases.push(`${initialVelocity}->${after.velocity}`);
  }
  if (width < 820) {
    const upperPoint = await evaluate(cdp, `(() => {
      const upper = document.getElementById('labUpperScroll');
      const graph = document.getElementById('graphSvg').getBoundingClientRect();
      const bounds = upper.getBoundingClientRect();
      upper.scrollTop = 0;
      document.getElementById('labPanel').scrollTop = 0;
      return { x: graph.left + graph.width / 2, y: Math.min(graph.bottom - 8, bounds.bottom - 8) };
    })()`);
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: upperPoint.x, y: upperPoint.y });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: upperPoint.x, y: upperPoint.y, deltaX: 0, deltaY: 160 });
    await delay(100);
    const upperScrolled = await evaluate(cdp, `({
      upper: document.getElementById('labUpperScroll').scrollTop,
      panel: document.getElementById('labPanel').scrollTop
    })`);
    assert.equal(upperScrolled.upper, 0, `${width}px: non-interactive stage space cannot scroll the fixed visual region`);
    assert.equal(upperScrolled.panel, 0, `${width}px: gestures over the fixed visual region do not move the control panel`);

    const panelPoint = await evaluate(cdp, `(() => {
      const bounds = document.getElementById('labPanel').getBoundingClientRect();
      return { x: bounds.left + bounds.width / 2, y: bounds.top + Math.min(80, bounds.height / 2) };
    })()`);
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: panelPoint.x, y: panelPoint.y });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: panelPoint.x, y: panelPoint.y, deltaX: 0, deltaY: 160 });
    await delay(100);
    const panelScrolled = await evaluate(cdp, `({
      upper: document.getElementById('labUpperScroll').scrollTop,
      panel: document.getElementById('labPanel').scrollTop
    })`);
    assert.ok(panelScrolled.panel > 0, `${width}px: the lower control panel scrolls independently`);
    assert.equal(panelScrolled.upper, 0, `${width}px: control-panel scrolling leaves the visual region fixed`);
  }
  return `${width}px (${cases.join(", ")})`;
}

async function runTouchViewport(cdp, baseUrl, activityPath, width, height) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await cdp.send("Page.navigate", { url: `${baseUrl}${activityPath}?touch-regression=${width}x${height}` });
  await waitForActivity(cdp);

  async function dragRoadControl(kind, pointerId, label) {
    const setup = await evaluate(cdp, `(() => {
      const target = Array.from(document.querySelectorAll('[data-drag]')).find((element) => element.dataset.drag === ${JSON.stringify(kind)});
      if (!target) throw new Error('Missing road target ${kind}');
      const svg = document.getElementById('roadSvg');
      const point = svg.createSVGPoint();
      point.x = Number(target.dataset.focusX);
      point.y = Number(target.dataset.focusY);
      const centre = point.matrixTransform(svg.getScreenCTM());
      const label = ${JSON.stringify(kind)}.split(':')[1];
      const car = Array.from(document.querySelectorAll('[data-drag]')).find((element) => element.dataset.drag === 'car:' + label);
      const velocity = Array.from(document.querySelectorAll('[data-drag]')).find((element) => element.dataset.drag === 'velocity:' + label);
      const road = svg.getBoundingClientRect();
      const group = document.querySelector('[data-road-car="' + label + '"]');
      const magnitudeLabel = group?.querySelector('.velocity-magnitude-label');
      const magnitudeBounds = magnitudeLabel?.getBoundingClientRect();
      const velocitySymbol = group?.querySelector('.velocity-arrowhead, .velocity-zero-marker')?.getBoundingClientRect();
      const body = group?.querySelector('.car-body')?.getBoundingClientRect();
      const overlaps = (first, second) => Boolean(first && second && first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top);
      const inside = (rect) => Boolean(rect && rect.left >= road.left - 1 && rect.right <= road.right + 1 && rect.top >= road.top - 1 && rect.bottom <= road.bottom + 1);
      const stage = document.querySelector('.lab-stage');
      const upper = document.getElementById('labUpperScroll');
      return {
        x: centre.x,
        y: centre.y,
        domTarget: document.elementFromPoint(centre.x, centre.y)?.closest('[data-drag]')?.dataset.drag || null,
        value: Number(target.getAttribute('aria-valuenow')),
        x0: Number(car?.getAttribute('aria-valuenow')),
        velocity: Number(velocity?.getAttribute('aria-valuenow')),
        magnitudeText: magnitudeLabel?.textContent,
        magnitudeVisible: inside(magnitudeBounds),
        magnitudeOverlapsVelocity: overlaps(magnitudeBounds, velocitySymbol),
        magnitudeOverlapsCar: overlaps(magnitudeBounds, body),
        saves: window.SimScorm.getLocalLog().filter((entry) => entry.key === 'cmi.suspend_data').length,
        upper: upper.scrollTop,
        upperScrollHeight: upper.scrollHeight,
        stageScrollHeight: stage.scrollHeight
      };
    })()`);
    assert.match(setup.magnitudeText, /^\|v\|=(?:\?|[0-2]\.[05]) m\/s$/, `${width}x${height} touch: ${label} shows the current speed magnitude and units beside the arrow`);
    assert.equal(setup.magnitudeVisible, true, `${width}x${height} touch: ${label} speed-magnitude label remains inside the road viewport`);
    assert.equal(setup.magnitudeOverlapsVelocity, false, `${width}x${height} touch: ${label} speed-magnitude label does not cover the arrow tip`);
    assert.equal(setup.magnitudeOverlapsCar, false, `${width}x${height} touch: ${label} speed-magnitude label does not cover its car`);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: setup.x, y: setup.y, id: pointerId, radiusX: 1, radiusY: 1, force: 1 }] });
    await delay(40);
    const preview = await evaluate(cdp, `(() => {
      const source = document.getElementById('roadLayer');
      const shown = document.querySelector('.road-magnifier');
      const clone = shown?.querySelector('.road-magnifier-source');
      const expected = source.cloneNode(true);
      expected.querySelectorAll('.road-drag-hit, .drag-hit, .car-hit').forEach((element) => element.remove());
      expected.querySelectorAll('*').forEach((element) => Array.from(element.attributes).forEach((attribute) => {
        if (['id', 'data-drag', 'tabindex', 'role', 'focusable'].includes(attribute.name) || attribute.name.startsWith('aria-')) element.removeAttribute(attribute.name);
      }));
      const host = document.getElementById('roadTouchPreviewHost');
      const hostBounds = host.getBoundingClientRect();
      const stage = document.querySelector('.lab-stage');
      const stageBounds = stage.getBoundingClientRect();
      const upper = document.getElementById('labUpperScroll');
      const target = Array.from(document.querySelectorAll('[data-drag]')).find((element) => element.dataset.drag === ${JSON.stringify(kind)});
      const viewBox = shown?.getAttribute('viewBox').split(/\\s+/).map(Number);
      const focus = [Number(target?.dataset.focusX), Number(target?.dataset.focusY)];
      const carLabel = ${JSON.stringify(kind)}.split(':')[1];
      const visualSelector = ${JSON.stringify(kind)}.startsWith('car:') ? '[data-road-car="' + carLabel + '"] .car-body' : '[data-road-car="' + carLabel + '"] .velocity-arrowhead, [data-road-car="' + carLabel + '"] .velocity-zero-marker';
      const cloneVisual = clone?.querySelector(visualSelector)?.getBoundingClientRect();
      const visualVisible = cloneVisual ? cloneVisual.right > hostBounds.left && cloneVisual.left < hostBounds.right && cloneVisual.bottom > hostBounds.top && cloneVisual.top < hostBounds.bottom : false;
      return {
        exists: Boolean(shown),
        exactSourceMarkup: clone?.innerHTML === expected.innerHTML,
        sameText: clone?.textContent === expected.textContent,
        interactions: clone?.querySelectorAll('[data-drag], [tabindex], [role], [aria-label], [id]').length,
        children: shown ? Array.from(shown.children).map((child) => ({ tag: child.tagName.toLowerCase(), className: child.getAttribute('class') })) : [],
        pointerEvents: [getComputedStyle(host).pointerEvents, shown ? getComputedStyle(shown).pointerEvents : null],
        bounds: { left: hostBounds.left, top: hostBounds.top, right: hostBounds.right, bottom: hostBounds.bottom, width: hostBounds.width, height: hostBounds.height },
        stage: { left: stageBounds.left, top: stageBounds.top, right: stageBounds.right, bottom: stageBounds.bottom },
        contained: hostBounds.left >= stageBounds.left - 1 && hostBounds.right <= stageBounds.right + 1 && hostBounds.top >= stageBounds.top - 1 && hostBounds.bottom <= stageBounds.bottom + 1,
        viewBox,
        focus,
        focusInCrop: viewBox ? focus[0] >= viewBox[0] && focus[0] <= viewBox[0] + viewBox[2] && focus[1] >= viewBox[1] && focus[1] <= viewBox[1] + viewBox[3] : false,
        visualVisible,
        stageScrollHeight: stage.scrollHeight,
        upperScrollHeight: upper.scrollHeight
      };
    })()`);
    assert.equal(preview.exists, true, `${width}x${height} touch: ${label} shows a real road magnifier`);
    assert.equal(preview.exactSourceMarkup, true, `${width}x${height} touch: ${label} magnifier exactly clones the sanitized live road`);
    assert.equal(preview.sameText, true, `${width}x${height} touch: ${label} magnifier adds no text or physical readout`);
    assert.equal(preview.interactions, 0, `${width}x${height} touch: ${label} road clone has no interaction, focus, ID, or ARIA target`);
    assert.deepEqual(preview.children, [{ tag: "g", className: "road-magnifier-source" }], `${width}x${height} touch: ${label} magnifier contains only the real road source group`);
    assert.deepEqual(preview.pointerEvents, ["none", "none"], `${width}x${height} touch: ${label} road magnifier cannot intercept dragging`);
    assert.equal(preview.contained, true, `${width}x${height} touch: ${label} road magnifier is fully visible inside the complete stage overlay`);
    assert.ok(preview.bounds.width >= Math.min(width * 0.52, 184) - 2 && preview.bounds.height >= 65, `${width}x${height} touch: ${label} road magnifier keeps a non-clipped readable size`);
    assert.equal(preview.focusInCrop, true, `${width}x${height} touch: ${label} controlled visual focus lies inside the road crop (${JSON.stringify(preview)})`);
    assert.equal(preview.visualVisible, true, `${width}x${height} touch: ${label} controlled car or arrow is visibly rendered in the magnifier viewport`);
    assert.equal(preview.stageScrollHeight, setup.stageScrollHeight, `${width}x${height} touch: ${label} overlay does not change stage scroll height`);
    assert.equal(preview.upperScrollHeight, setup.upperScrollHeight, `${width}x${height} touch: ${label} overlay does not change upper-region scroll height`);
    const dragDelta = setup.value >= (kind.startsWith("velocity:") ? 2 : 8) ? -28 : 28;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: setup.x + dragDelta, y: setup.y, id: pointerId, radiusX: 1, radiusY: 1, force: 1 }] });
    await delay(40);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await delay(70);
    const after = await evaluate(cdp, `(() => {
      const target = Array.from(document.querySelectorAll('[data-drag]')).find((element) => element.dataset.drag === ${JSON.stringify(kind)});
      const label = ${JSON.stringify(kind)}.split(':')[1];
      const car = Array.from(document.querySelectorAll('[data-drag]')).find((element) => element.dataset.drag === 'car:' + label);
      const velocity = Array.from(document.querySelectorAll('[data-drag]')).find((element) => element.dataset.drag === 'velocity:' + label);
      const magnitudeLabel = document.querySelector('[data-road-car="' + label + '"] .velocity-magnitude-label');
      return {
        value: Number(target?.getAttribute('aria-valuenow')),
        x0: Number(car?.getAttribute('aria-valuenow')),
        velocity: Number(velocity?.getAttribute('aria-valuenow')),
        magnitudeText: magnitudeLabel?.textContent,
        saves: window.SimScorm.getLocalLog().filter((entry) => entry.key === 'cmi.suspend_data').length,
        preview: Boolean(document.querySelector('.road-magnifier')),
        upper: document.getElementById('labUpperScroll').scrollTop
      };
    })()`);
    assert.notEqual(after.value, setup.value, `${width}x${height} touch: ${label} drag changes only its authoritative control value (${setup.value}->${after.value})`);
    assert.equal(kind.startsWith("car:") ? after.velocity : after.x0, kind.startsWith("car:") ? setup.velocity : setup.x0, `${width}x${height} touch: ${label} nearest-focus arbitration leaves the other road quantity unchanged`);
    const expectedMagnitude = kind.startsWith("velocity:") ? `|v|=${Math.abs(after.velocity).toFixed(1)} m/s` : setup.magnitudeText;
    assert.equal(after.magnitudeText, expectedMagnitude, `${width}x${height} touch: ${label} speed label stays synchronized with the authoritative velocity`);
    assert.equal(after.saves, setup.saves + 1, `${width}x${height} touch: ${label} drag saves exactly once on release`);
    assert.equal(after.preview, false, `${width}x${height} touch: ${label} road magnifier clears on release`);
    assert.equal(after.upper, setup.upper, `${width}x${height} touch: ${label} drag leaves the fixed visual region stationary`);
  }

  async function dragInitialPoint(pointerId, label) {
    const setup = await evaluate(cdp, `(() => {
      const target = document.querySelector('[data-drag="initial:x0"]');
      if (!target) throw new Error('Missing mission initial-position graph target');
      const svg = document.getElementById('graphSvg');
      const point = svg.createSVGPoint();
      point.x = Number(target.dataset.pointCx);
      point.y = Number(target.dataset.pointCy);
      const centre = point.matrixTransform(svg.getScreenCTM());
      return {
        x: centre.x,
        y: centre.y,
        value: Number(target.getAttribute('aria-valuenow')),
        velocity: Number(document.querySelector('[data-drag="velocity:A"]')?.getAttribute('aria-valuenow')),
        hit: target.getBoundingClientRect().toJSON(),
        saves: window.SimScorm.getLocalLog().filter((entry) => entry.key === 'cmi.suspend_data').length,
        upper: document.getElementById('labUpperScroll').scrollTop
      };
    })()`);
    assert.ok(setup.hit.width >= 51.5 && setup.hit.height >= 51.5, `${width}x${height} touch: ${label} has a real 52 CSS px hit geometry`);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: setup.x, y: setup.y, id: pointerId, radiusX: 1, radiusY: 1, force: 1 }] });
    await delay(40);
    const preview = await evaluate(cdp, `(() => {
      const source = document.getElementById('graphLayer');
      const shown = document.querySelector('.graph-magnifier');
      const clone = shown?.querySelector('.graph-magnifier-source');
      const expected = source.cloneNode(true);
      expected.querySelectorAll('.drag-hit').forEach((element) => element.remove());
      expected.querySelectorAll('*').forEach((element) => Array.from(element.attributes).forEach((attribute) => {
        if (['id', 'data-drag', 'tabindex', 'role', 'focusable'].includes(attribute.name) || attribute.name.startsWith('aria-')) element.removeAttribute(attribute.name);
      }));
      return {
        exists: Boolean(shown),
        exactSourceMarkup: clone?.innerHTML === expected.innerHTML,
        sameText: clone?.textContent === expected.textContent,
        interactions: clone?.querySelectorAll('[data-drag], [tabindex], [role], [aria-label], [id]').length,
        selected: document.querySelector('[data-graph-point="initial"]')?.classList.contains('is-dragging')
      };
    })()`);
    assert.equal(preview.exists, true, `${width}x${height} touch: ${label} shows the real graph magnifier`);
    assert.equal(preview.exactSourceMarkup, true, `${width}x${height} touch: ${label} magnifier exactly clones the sanitized live graph`);
    assert.equal(preview.sameText, true, `${width}x${height} touch: ${label} graph preview adds no content`);
    assert.equal(preview.interactions, 0, `${width}x${height} touch: ${label} graph clone has no interactions or duplicate semantics`);
    assert.equal(preview.selected, true, `${width}x${height} touch: ${label} highlights the source point during drag`);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: setup.x, y: setup.y - 34, id: pointerId, radiusX: 1, radiusY: 1, force: 1 }] });
    await delay(40);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await delay(70);
    const after = await evaluate(cdp, `(() => ({
      value: Number(document.querySelector('[data-drag="initial:x0"]')?.getAttribute('aria-valuenow')),
      velocity: Number(document.querySelector('[data-drag="velocity:A"]')?.getAttribute('aria-valuenow')),
      saves: window.SimScorm.getLocalLog().filter((entry) => entry.key === 'cmi.suspend_data').length,
      preview: Boolean(document.querySelector('.graph-magnifier')),
      upper: document.getElementById('labUpperScroll').scrollTop
    }))()`);
    assert.notEqual(after.value, setup.value, `${width}x${height} touch: ${label} changes x0`);
    assert.equal(after.velocity, setup.velocity, `${width}x${height} touch: ${label} leaves velocity unchanged`);
    assert.equal(after.saves, setup.saves + 1, `${width}x${height} touch: ${label} saves exactly once on release`);
    assert.equal(after.preview, false, `${width}x${height} touch: ${label} magnifier clears on release`);
    assert.equal(after.upper, setup.upper, `${width}x${height} touch: ${label} does not pan the fixed stage`);
  }

  const blank = await evaluate(cdp, `(() => {
    const upper = document.getElementById('labUpperScroll');
    const panel = document.getElementById('labPanel');
    upper.scrollTop = 0;
    panel.scrollTop = 0;
    const bounds = upper.getBoundingClientRect();
    const graph = document.getElementById('graphSvg').getBoundingClientRect();
    const candidates = [0.25, 0.5, 0.75].map((fraction) => ({
      x: graph.left + graph.width * fraction,
      y: Math.min(bounds.bottom - 12, Math.max(bounds.top + 12, graph.top + 18))
    }));
    const point = candidates.find(({ x, y }) => !document.elementFromPoint(x, y)?.closest('[data-drag]'));
    if (!point) throw new Error('No visible non-interactive graph point found');
    return {
      ...point,
      drag: document.elementFromPoint(point.x, point.y)?.closest('[data-drag]')?.dataset.drag || null,
      svg: document.elementFromPoint(point.x, point.y)?.closest('svg')?.id || null,
      upperBefore: upper.scrollTop,
      panelBefore: panel.scrollTop,
      upperFits: upper.scrollHeight <= upper.clientHeight + 1,
      panelScrollable: panel.scrollHeight > panel.clientHeight,
      upperTouchAction: getComputedStyle(upper).touchAction,
      graphTouchAction: getComputedStyle(document.getElementById('graphSvg')).touchAction
    };
  })()`);
  assert.equal(blank.drag, null, `${width}x${height} touch: blank swipe starts outside every drag target`);
  assert.equal(blank.svg, "graphSvg", `${width}x${height} touch: blank swipe starts on non-interactive graph space`);
  assert.equal(blank.upperFits, true, `${width}x${height} touch: complete visual content fits its fixed region`);
  assert.equal(blank.panelScrollable, true, `${width}x${height} touch: control panel has reachable overflow`);
  assert.equal(blank.upperTouchAction, "pan-y", `${width}x${height} touch: fixed visual region passes vertical gestures outward`);
  assert.equal(blank.graphTouchAction, "pan-y", `${width}x${height} touch: blank graph space passes vertical gestures outward`);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: blank.x, y: blank.y, id: 1, radiusX: 1, radiusY: 1, force: 1 }] });
  await delay(50);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: blank.x, y: blank.y - 90, id: 1, radiusX: 1, radiusY: 1, force: 1 }] });
  await delay(50);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await delay(150);
  const afterBlank = await evaluate(cdp, `({ upper: document.getElementById('labUpperScroll').scrollTop, panel: document.getElementById('labPanel').scrollTop })`);
  assert.equal(afterBlank.upper, blank.upperBefore, `${width}x${height} touch: blank graph swipe cannot move the fixed visual region`);
  assert.equal(afterBlank.panel, blank.panelBefore, `${width}x${height} touch: blank visual-region swipe leaves the panel fixed`);

  await dragRoadControl("car:A", 20, "exploration A car");
  await dragRoadControl("velocity:A", 21, "exploration A velocity");
  const roadNoPreview = await evaluate(cdp, `(() => {
    const target = document.querySelector('[data-drag="velocity:A"]');
    const svg = document.getElementById('roadSvg');
    const point = svg.createSVGPoint(); point.x = Number(target.dataset.focusX); point.y = Number(target.dataset.focusY);
    const centre = point.matrixTransform(svg.getScreenCTM());
    return { x: centre.x, y: centre.y };
  })()`);
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: roadNoPreview.x, y: roadNoPreview.y, button: "left", buttons: 1, clickCount: 1 });
  assert.equal(await evaluate(cdp, `Boolean(document.querySelector('.road-magnifier'))`), false, `${width}x${height} mouse: road drag does not show a touch magnifier`);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: roadNoPreview.x, y: roadNoPreview.y, button: "left", buttons: 0, clickCount: 1 });
  const roadLostSetup = await evaluate(cdp, `(() => {
    const target = document.querySelector('[data-drag="velocity:A"]');
    const svg = document.getElementById('roadSvg');
    svg.addEventListener('pointerdown', (event) => { window.__roadLostPointer = event.pointerId; }, { once: true });
    const point = svg.createSVGPoint(); point.x = Number(target.dataset.focusX); point.y = Number(target.dataset.focusY);
    const centre = point.matrixTransform(svg.getScreenCTM());
    return { x: centre.x, y: centre.y, saves: window.SimScorm.getLocalLog().filter((entry) => entry.key === 'cmi.suspend_data').length };
  })()`);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: roadLostSetup.x, y: roadLostSetup.y, id: 25, radiusX: 1, radiusY: 1, force: 1 }] });
  await delay(30);
  const roadLost = await evaluate(cdp, `(() => {
    document.getElementById('roadSvg').dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: window.__roadLostPointer, pointerType: 'touch' }));
    return { preview: Boolean(document.querySelector('.road-magnifier')), saves: window.SimScorm.getLocalLog().filter((entry) => entry.key === 'cmi.suspend_data').length };
  })()`);
  assert.equal(roadLost.preview, false, `${width}x${height} touch: road lost capture before movement clears preview`);
  assert.equal(roadLost.saves, roadLostSetup.saves, `${width}x${height} touch: road lost capture before semantic movement does not save`);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

  await evaluate(cdp, `document.getElementById('confirmStart').click()`);
  await delay(100);
  assert.match(await evaluate(cdp, `document.getElementById('taskKicker').textContent`), /1 \/ 5/, `${width}x${height} touch: assessment starts at mission 1`);
  const initialJitter = await evaluate(cdp, `(() => {
    const target = document.querySelector('[data-drag="initial:x0"]');
    const svg = document.getElementById('graphSvg');
    const point = svg.createSVGPoint(); point.x = Number(target.dataset.pointCx); point.y = Number(target.dataset.pointCy);
    const centre = point.matrixTransform(svg.getScreenCTM());
    return { x: centre.x, y: centre.y, saves: window.SimScorm.getLocalLog().filter((entry) => entry.key === 'cmi.suspend_data').length };
  })()`);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: initialJitter.x, y: initialJitter.y, id: 26, radiusX: 1, radiusY: 1, force: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: initialJitter.x, y: initialJitter.y - 2, id: 26, radiusX: 1, radiusY: 1, force: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await delay(60);
  const initialJitterAfter = await evaluate(cdp, `({ unanswered: Boolean(document.querySelector('[data-set-quantity="x0"]')), saves: window.SimScorm.getLocalLog().filter((entry) => entry.key === 'cmi.suspend_data').length, preview: Boolean(document.querySelector('.graph-magnifier')) })`);
  assert.equal(initialJitterAfter.unanswered, true, `${width}x${height} touch: two-pixel initial-point jitter keeps x0 absent`);
  assert.equal(initialJitterAfter.saves, initialJitter.saves, `${width}x${height} touch: two-pixel initial-point jitter creates no save`);
  assert.equal(initialJitterAfter.preview, false, `${width}x${height} touch: initial-point jitter clears preview on release`);
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: initialJitter.x, y: initialJitter.y, button: "left", buttons: 1, clickCount: 1 });
  assert.equal(await evaluate(cdp, `Boolean(document.querySelector('.graph-magnifier'))`), false, `${width}x${height} mouse: mission initial point does not show a touch magnifier`);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: initialJitter.x, y: initialJitter.y, button: "left", buttons: 0, clickCount: 1 });
  const initialLostSetup = await evaluate(cdp, `(() => {
    const target = document.querySelector('[data-drag="initial:x0"]');
    const svg = document.getElementById('graphSvg');
    svg.addEventListener('pointerdown', (event) => { window.__initialLostPointer = event.pointerId; }, { once: true });
    const point = svg.createSVGPoint(); point.x = Number(target.dataset.pointCx); point.y = Number(target.dataset.pointCy);
    const centre = point.matrixTransform(svg.getScreenCTM());
    return { x: centre.x, y: centre.y, value: Number(target.getAttribute('aria-valuenow')), saves: window.SimScorm.getLocalLog().filter((entry) => entry.key === 'cmi.suspend_data').length };
  })()`);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: initialLostSetup.x, y: initialLostSetup.y, id: 27, radiusX: 1, radiusY: 1, force: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: initialLostSetup.x, y: initialLostSetup.y - 34, id: 27, radiusX: 1, radiusY: 1, force: 1 }] });
  await delay(40);
  const initialLost = await evaluate(cdp, `(() => {
    document.getElementById('graphSvg').dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: window.__initialLostPointer, pointerType: 'touch' }));
    const target = document.querySelector('[data-drag="initial:x0"]');
    return { value: Number(target?.getAttribute('aria-valuenow')), saves: window.SimScorm.getLocalLog().filter((entry) => entry.key === 'cmi.suspend_data').length, preview: Boolean(document.querySelector('.graph-magnifier')) };
  })()`);
  assert.notEqual(initialLost.value, initialLostSetup.value, `${width}x${height} touch: initial-point lost capture retains the last semantic movement`);
  assert.equal(initialLost.saves, initialLostSetup.saves + 1, `${width}x${height} touch: initial-point lost capture after movement saves exactly once`);
  assert.equal(initialLost.preview, false, `${width}x${height} touch: initial-point lost capture clears preview`);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await dragRoadControl("car:A", 22, "mission 1 A car");
  await dragRoadControl("velocity:A", 23, "mission 1 A velocity");
  await dragInitialPoint(24, "mission 1 initial-position point");
  await evaluate(cdp, `document.getElementById('nextMission').click()`);
  await delay(100);
  assert.match(await evaluate(cdp, `document.getElementById('taskKicker').textContent`), /2 \/ 5/, `${width}x${height} touch: graph drag check reaches mission 2`);
  const graphDrag = await evaluate(cdp, `(async () => {
    const handle = document.querySelector('[data-drag="graph:xStart"]');
    handle.scrollIntoView({ block: 'center', inline: 'center' });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const svg = handle.ownerSVGElement;
    const point = svg.createSVGPoint();
    point.x = Number(handle.dataset.pointCx);
    point.y = Number(handle.dataset.pointCy);
    const centre = point.matrixTransform(svg.getScreenCTM());
    const hit = handle.getBoundingClientRect();
    const endHit = document.querySelector('[data-drag="graph:xEnd"]').getBoundingClientRect();
    const graph = svg.getBoundingClientRect();
    const blockElement = document.querySelector('.graph-block');
    const block = blockElement.getBoundingClientRect();
    const upper = document.getElementById('labUpperScroll');
    const axisPoint = svg.createSVGPoint();
    axisPoint.x = Number(handle.dataset.pointCx);
    axisPoint.y = 60;
    const axisTop = axisPoint.matrixTransform(svg.getScreenCTM());
    axisPoint.y = 390;
    const axisBottom = axisPoint.matrixTransform(svg.getScreenCTM());
    return {
      x: centre.x,
      y: centre.y,
      target: document.elementFromPoint(centre.x, centre.y)?.closest('[data-drag]')?.dataset.drag || null,
      start: Number(handle.getAttribute('aria-valuenow')),
      other: Number(document.querySelector('[data-drag="graph:xEnd"]').getAttribute('aria-valuenow')),
      saves: window.SimScorm.getLocalLog().filter((entry) => entry.key === 'cmi.suspend_data').length,
      upper: document.getElementById('labUpperScroll').scrollTop,
      hitWidth: hit.width,
      hitHeight: hit.height,
      endHitWidth: endHit.width,
      endHitHeight: endHit.height,
      graph: { left: graph.left, top: graph.top, right: graph.right, bottom: graph.bottom },
      block: { left: block.left, top: block.top, right: block.right, bottom: block.bottom, width: block.width, height: block.height, scrollHeight: blockElement.scrollHeight },
      upperScrollHeight: upper.scrollHeight,
      expectedCorner: (centre.y < graph.top + graph.height / 2 ? 'bottom' : 'top') + '-' + (centre.x < graph.left + graph.width / 2 ? 'right' : 'left'),
      axisTopY: axisTop.y,
      axisBottomY: axisBottom.y
    };
  })()`);
  assert.equal(graphDrag.target, "graph:xStart", `${width}x${height} touch: graph-point centre resolves to its production drag target`);
  assert.ok(graphDrag.hitWidth >= 51.5 && graphDrag.hitHeight >= 51.5, `${width}x${height} touch: x0 has a real 52 CSS px hit geometry within subpixel tolerance`);
  assert.ok(graphDrag.endHitWidth >= 51.5 && graphDrag.endHitHeight >= 51.5, `${width}x${height} touch: x6 has a real 52 CSS px hit geometry within subpixel tolerance`);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: graphDrag.x, y: graphDrag.y, id: 2, radiusX: 1, radiusY: 1, force: 1 }] });
  await delay(50);
  const previewStart = await evaluate(cdp, `(() => {
    const preview = document.querySelector('.graph-magnifier');
    const source = document.getElementById('graphLayer');
    const clone = preview?.querySelector('.graph-magnifier-source');
    const host = document.getElementById('graphTouchPreviewHost');
    const bounds = host.getBoundingClientRect();
    const blockElement = document.querySelector('.graph-block');
    const block = blockElement.getBoundingClientRect();
    const upper = document.getElementById('labUpperScroll');
    const sourceLine = source.querySelector('[data-graph-answer-line]');
    const cloneLine = clone?.querySelector('[data-graph-answer-line]');
    const sourcePoint = source.querySelector('[data-graph-point="P0"] .graph-handle');
    const clonePoint = clone?.querySelector('[data-graph-point="P0"] .graph-handle');
    const expectedSource = source.cloneNode(true);
    expectedSource.querySelectorAll('.drag-hit').forEach((element) => element.remove());
    expectedSource.querySelectorAll('*').forEach((element) => Array.from(element.attributes).forEach((attribute) => {
      if (['id', 'data-drag', 'tabindex', 'role', 'focusable'].includes(attribute.name) || attribute.name.startsWith('aria-')) element.removeAttribute(attribute.name);
    }));
    return {
      exists: Boolean(preview),
      viewBox: preview?.getAttribute('viewBox').split(/\\s+/).map(Number),
      directChildren: Array.from(preview?.children || []).map((element) => ({ tag: element.tagName.toLowerCase(), className: element.getAttribute('class') })),
      exactSourceMarkup: clone?.innerHTML === expectedSource.innerHTML,
      corner: (host.classList.contains('is-top') ? 'top' : 'bottom') + '-' + (host.classList.contains('is-left') ? 'left' : 'right'),
      sameText: clone?.textContent === source.textContent,
      gridCount: [source.querySelectorAll('.plot-grid').length, clone?.querySelectorAll('.plot-grid').length],
      lineGeometry: ['x1', 'y1', 'x2', 'y2'].map((name) => [sourceLine?.getAttribute(name), cloneLine?.getAttribute(name)]),
      pointGeometry: ['cx', 'cy', 'r'].map((name) => [sourcePoint?.getAttribute(name), clonePoint?.getAttribute(name)]),
      pointStyles: ['fill', 'stroke', 'stroke-width'].map((name) => [getComputedStyle(sourcePoint).getPropertyValue(name), getComputedStyle(clonePoint).getPropertyValue(name)]),
      gridStyles: ['stroke', 'stroke-width'].map((name) => [getComputedStyle(source.querySelector('.plot-grid')).getPropertyValue(name), getComputedStyle(clone?.querySelector('.plot-grid')).getPropertyValue(name)]),
      clonedInteractions: clone?.querySelectorAll('[data-drag], [tabindex], [role], [aria-label], [aria-valuenow], [aria-valuemin], [aria-valuemax]').length,
      addedSummaryElements: preview?.querySelectorAll('.graph-touch-preview-title, .graph-touch-preview-value, .graph-touch-preview-mini, .graph-touch-preview-point').length,
      highlighted: document.querySelector('[data-graph-point="P0"]')?.classList.contains('is-dragging') || false,
      bounds: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom, width: bounds.width, height: bounds.height },
      block: { left: block.left, top: block.top, right: block.right, bottom: block.bottom, width: block.width, height: block.height, scrollHeight: blockElement.scrollHeight },
      upperScrollHeight: upper.scrollHeight,
      hostPosition: getComputedStyle(host).position,
      pointerEvents: [getComputedStyle(host).pointerEvents, getComputedStyle(preview).pointerEvents]
    };
  })()`);
  assert.equal(previewStart.exists, true, `${width}x${height} touch: x0 drag immediately shows a real graph magnifier`);
  assert.deepEqual(previewStart.viewBox, [0, 135, 280, 180], `${width}x${height} touch: x0 magnifier crops the source graph around the live endpoint`);
  assert.deepEqual(previewStart.directChildren, [{ tag: "g", className: "graph-magnifier-source" }], `${width}x${height} touch: magnifier has exactly one source group and no sibling graphic or text`);
  assert.equal(previewStart.exactSourceMarkup, true, `${width}x${height} touch: magnifier source exactly equals an independently sanitized source-graph clone`);
  assert.equal(previewStart.sameText, true, `${width}x${height} touch: magnifier adds no text beyond the source x-t graph`);
  assert.equal(previewStart.gridCount[0], previewStart.gridCount[1], `${width}x${height} touch: magnifier clones the complete source grid`);
  assert.ok(previewStart.lineGeometry.every(([source, clone]) => source === clone), `${width}x${height} touch: answer-line geometry is cloned from the source graph`);
  assert.ok(previewStart.pointGeometry.every(([source, clone]) => source === clone), `${width}x${height} touch: selected handle geometry is cloned from the source graph`);
  assert.ok(previewStart.pointStyles.every(([source, clone]) => source === clone), `${width}x${height} touch: cloned handle keeps the source graph styling`);
  assert.ok(previewStart.gridStyles.every(([source, clone]) => source === clone), `${width}x${height} touch: cloned grid keeps the source graph styling`);
  assert.equal(previewStart.clonedInteractions, 0, `${width}x${height} touch: magnifier clone has no focus, ARIA, or drag targets`);
  assert.equal(previewStart.addedSummaryElements, 0, `${width}x${height} touch: old title/value/mini-axis/point summary UI is absent`);
  assert.equal(previewStart.highlighted, true, `${width}x${height} touch: selected x0 point is highlighted`);
  assert.equal(previewStart.corner, graphDrag.expectedCorner, `${width}x${height} touch: magnifier chooses the graph corner farthest from drag-start`);
  assert.ok(Math.abs(previewStart.bounds.width - Math.min(width * 0.52, 184)) <= 2, `${width}x${height} touch: magnifier keeps its readable CSS width`);
  assert.ok(previewStart.bounds.height >= 100, `${width}x${height} touch: magnifier keeps a readable crop height`);
  assert.equal(previewStart.hostPosition, "absolute", `${width}x${height} touch: magnifier is removed from normal graph layout`);
  assert.deepEqual(previewStart.pointerEvents, ["none", "none"], `${width}x${height} touch: magnifier cannot intercept the drag`);
  assert.ok(previewStart.bounds.left >= previewStart.block.left - 1 && previewStart.bounds.right <= previewStart.block.right + 1 && previewStart.bounds.top >= previewStart.block.top - 1 && previewStart.bounds.bottom <= previewStart.block.bottom + 1, `${width}x${height} touch: magnifier is contained by the graph block rather than the road/stage`);
  assert.equal(previewStart.block.height, graphDrag.block.height, `${width}x${height} touch: showing magnifier does not change graph-block layout height`);
  assert.equal(previewStart.block.scrollHeight, graphDrag.block.scrollHeight, `${width}x${height} touch: showing magnifier does not create graph-block overflow`);
  assert.equal(previewStart.upperScrollHeight, graphDrag.upperScrollHeight, `${width}x${height} touch: showing magnifier does not change fixed-stage scrollHeight`);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: graphDrag.x, y: graphDrag.axisTopY, id: 2, radiusX: 1, radiusY: 1, force: 1 }] });
  await delay(50);
  const previewMoved = await evaluate(cdp, `(() => {
    const preview = document.querySelector('.graph-magnifier');
    const host = document.getElementById('graphTouchPreviewHost').getBoundingClientRect();
    const hostElement = document.getElementById('graphTouchPreviewHost');
    const sourcePoint = document.querySelector('#graphLayer [data-graph-point="P0"] .graph-handle');
    const clonePoint = preview?.querySelector('[data-graph-point="P0"] .graph-handle');
    const sourceLine = document.querySelector('#graphLayer [data-graph-answer-line]');
    const cloneLine = preview?.querySelector('[data-graph-answer-line]');
    const source = document.getElementById('graphLayer');
    const clone = preview?.querySelector('.graph-magnifier-source');
    const expectedSource = source.cloneNode(true);
    expectedSource.querySelectorAll('.drag-hit').forEach((element) => element.remove());
    expectedSource.querySelectorAll('*').forEach((element) => Array.from(element.attributes).forEach((attribute) => {
      if (['id', 'data-drag', 'tabindex', 'role', 'focusable'].includes(attribute.name) || attribute.name.startsWith('aria-')) element.removeAttribute(attribute.name);
    }));
    const viewBox = preview?.getAttribute('viewBox').split(/\\s+/).map(Number);
    return {
      value: Number(document.querySelector('[data-drag="graph:xStart"]').getAttribute('aria-valuenow')),
      corner: (hostElement.classList.contains('is-top') ? 'top' : 'bottom') + '-' + (hostElement.classList.contains('is-left') ? 'left' : 'right'),
      bounds: { left: host.left, top: host.top, right: host.right, bottom: host.bottom },
      viewBox,
      exactSourceMarkup: clone?.innerHTML === expectedSource.innerHTML,
      pointY: [Number(sourcePoint?.getAttribute('cy')), Number(clonePoint?.getAttribute('cy'))],
      lineY: [Number(sourceLine?.getAttribute('y1')), Number(cloneLine?.getAttribute('y1'))]
    };
  })()`);
  assert.equal(previewMoved.value, 20, `${width}x${height} touch: source graph reaches the +20 m endpoint`);
  assert.equal(previewMoved.corner, previewStart.corner, `${width}x${height} touch: magnifier remains in its initially chosen far corner`);
  assert.deepEqual(previewMoved.bounds, { left: previewStart.bounds.left, top: previewStart.bounds.top, right: previewStart.bounds.right, bottom: previewStart.bounds.bottom }, `${width}x${height} touch: magnifier position does not jump while the finger moves`);
  assert.deepEqual(previewMoved.viewBox, [0, 0, 280, 180], `${width}x${height} touch: magnifier crop follows P0 to the +20 m graph boundary`);
  assert.equal(previewMoved.exactSourceMarkup, true, `${width}x${height} touch: moved magnifier remains an exact independently sanitized live-source clone`);
  assert.deepEqual(previewMoved.pointY, [60, 60], `${width}x${height} touch: magnifier clones the live +20 m handle geometry`);
  assert.deepEqual(previewMoved.lineY, [60, 60], `${width}x${height} touch: magnifier clones the live +20 m answer-line endpoint`);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: graphDrag.x, y: graphDrag.axisBottomY, id: 2, radiusX: 1, radiusY: 1, force: 1 }] });
  await delay(50);
  const previewBottom = await evaluate(cdp, `(() => {
    const preview = document.querySelector('.graph-magnifier');
    const point = preview?.querySelector('[data-graph-point="P0"] .graph-handle');
    return {
      value: Number(document.querySelector('[data-drag="graph:xStart"]').getAttribute('aria-valuenow')),
      viewBox: preview?.getAttribute('viewBox').split(/\\s+/).map(Number),
      pointY: Number(point?.getAttribute('cy'))
    };
  })()`);
  assert.equal(previewBottom.value, -20, `${width}x${height} touch: source graph reaches the −20 m endpoint`);
  assert.deepEqual(previewBottom.viewBox, [0, 260, 280, 180], `${width}x${height} touch: magnifier crop follows P0 to the −20 m graph boundary without clipping`);
  assert.equal(previewBottom.pointY, 390, `${width}x${height} touch: magnifier clone contains the live −20 m handle`);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await delay(100);
  const graphAfter = await evaluate(cdp, `({
    value: Number(document.querySelector('[data-drag="graph:xStart"]').getAttribute('aria-valuenow')),
    other: Number(document.querySelector('[data-drag="graph:xEnd"]').getAttribute('aria-valuenow')),
    saves: window.SimScorm.getLocalLog().filter((entry) => entry.key === 'cmi.suspend_data').length,
    upper: document.getElementById('labUpperScroll').scrollTop,
    preview: Boolean(document.querySelector('.graph-magnifier'))
  })`);
  assert.notEqual(graphAfter.value, graphDrag.start, `${width}x${height} touch: graph-point drag changes that point`);
  assert.equal(graphAfter.other, graphDrag.other, `${width}x${height} touch: graph-point drag leaves the other point unchanged`);
  assert.equal(graphAfter.saves, graphDrag.saves + 1, `${width}x${height} touch: completed graph drag writes exactly one SCORM draft`);
  assert.equal(graphAfter.upper, graphDrag.upper, `${width}x${height} touch: graph-point drag does not pan its background`);
  assert.equal(graphAfter.preview, false, `${width}x${height} touch: pointer up hides the x0 magnifier`);

  const cancelSetup = await evaluate(cdp, `(() => {
    const handle = document.querySelector('[data-drag="graph:xEnd"]');
    const svg = handle.ownerSVGElement;
    const point = svg.createSVGPoint();
    point.x = Number(handle.dataset.pointCx);
    point.y = Number(handle.dataset.pointCy);
    const centre = point.matrixTransform(svg.getScreenCTM());
    const graph = svg.getBoundingClientRect();
    return {
      x: centre.x, y: centre.y,
      start: Number(handle.getAttribute('aria-valuenow')),
      saves: window.SimScorm.getLocalLog().filter((entry) => entry.key === 'cmi.suspend_data').length,
      expectedCorner: (centre.y < graph.top + graph.height / 2 ? 'bottom' : 'top') + '-' + (centre.x < graph.left + graph.width / 2 ? 'right' : 'left')
    };
  })()`);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cancelSetup.x, y: cancelSetup.y, id: 3, radiusX: 1, radiusY: 1, force: 1 }] });
  await delay(50);
  const cancelPreviewStart = await evaluate(cdp, `(() => {
    const preview = document.querySelector('.graph-magnifier');
    const host = document.getElementById('graphTouchPreviewHost');
    const bounds = host.getBoundingClientRect();
    const point = preview?.querySelector('[data-graph-point="P6"] .graph-handle');
    return {
      viewBox: preview?.getAttribute('viewBox').split(/\\s+/).map(Number),
      pointX: Number(point?.getAttribute('cx')),
      corner: (host.classList.contains('is-top') ? 'top' : 'bottom') + '-' + (host.classList.contains('is-left') ? 'left' : 'right'),
      bounds: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom }
    };
  })()`);
  assert.deepEqual(cancelPreviewStart.viewBox.slice(0, 1), [520], `${width}x${height} touch: x6 magnifier crops the real graph at its right endpoint`);
  assert.equal(cancelPreviewStart.pointX, 760, `${width}x${height} touch: x6 magnifier contains the original P6 handle geometry`);
  assert.equal(cancelPreviewStart.corner, cancelSetup.expectedCorner, `${width}x${height} touch: x6 magnifier uses the far corner from its drag-start`);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: cancelSetup.x, y: cancelSetup.y + 45, id: 3, radiusX: 1, radiusY: 1, force: 1 }] });
  await delay(50);
  const cancelPreviewMoved = await evaluate(cdp, `(() => {
    const host = document.getElementById('graphTouchPreviewHost');
    const bounds = host.getBoundingClientRect();
    return { corner: (host.classList.contains('is-top') ? 'top' : 'bottom') + '-' + (host.classList.contains('is-left') ? 'left' : 'right'), bounds: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom } };
  })()`);
  assert.equal(cancelPreviewMoved.corner, cancelPreviewStart.corner, `${width}x${height} touch: x6 magnifier keeps its selected corner`);
  assert.deepEqual(cancelPreviewMoved.bounds, cancelPreviewStart.bounds, `${width}x${height} touch: x6 magnifier remains spatially stable`);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await delay(100);
  const cancelled = await evaluate(cdp, `({
    value: Number(document.querySelector('[data-drag="graph:xEnd"]').getAttribute('aria-valuenow')),
    saves: window.SimScorm.getLocalLog().filter((entry) => entry.key === 'cmi.suspend_data').length,
    preview: Boolean(document.querySelector('.graph-magnifier'))
  })`);
  assert.notEqual(cancelled.value, cancelSetup.start, `${width}x${height} touch: cancelled graph drag retains its last visible point value`);
  assert.equal(cancelled.saves, cancelSetup.saves + 1, `${width}x${height} touch: cancelled graph drag persists its last visible state exactly once`);
  assert.equal(cancelled.preview, false, `${width}x${height} touch: pointer cancel hides the x6 magnifier`);

  const tapSetup = await evaluate(cdp, `(() => {
    const handle = document.querySelector('[data-drag="graph:xStart"]');
    const hit = handle.getBoundingClientRect();
    const pointX = Number(handle.dataset.pointCx);
    const pointY = Number(handle.dataset.pointCy);
    const svgPoint = handle.ownerSVGElement.createSVGPoint();
    svgPoint.x = pointX;
    svgPoint.y = pointY;
    const visual = svgPoint.matrixTransform(handle.ownerSVGElement.getScreenCTM());
    const x = visual.x;
    const y = Math.min(hit.bottom - 2, hit.top + 2);
    return { x, y, target: document.elementFromPoint(x, y)?.closest('[data-drag]')?.dataset.drag, value: Number(handle.getAttribute('aria-valuenow')), saves: window.SimScorm.getLocalLog().filter((entry) => entry.key === 'cmi.suspend_data').length };
  })()`);
  assert.equal(tapSetup.target, "graph:xStart", `${width}x${height} touch: x0 enlarged hit-area edge remains selectable`);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: tapSetup.x, y: tapSetup.y, id: 7, radiusX: 1, radiusY: 1, force: 1 }] });
  await delay(30);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await delay(80);
  const tapped = await evaluate(cdp, `({ value: Number(document.querySelector('[data-drag="graph:xStart"]').getAttribute('aria-valuenow')), saves: window.SimScorm.getLocalLog().filter((entry) => entry.key === 'cmi.suspend_data').length, preview: Boolean(document.querySelector('.graph-magnifier')) })`);
  assert.equal(tapped.value, tapSetup.value, `${width}x${height} touch: tap-only at an enlarged-target edge does not jump x0`);
  assert.equal(tapped.saves, tapSetup.saves, `${width}x${height} touch: tap-only graph interaction does not save or commit`);
  assert.equal(tapped.preview, false, `${width}x${height} touch: tap-only release clears magnifier`);

  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: tapSetup.x, y: tapSetup.y, id: 8, radiusX: 1, radiusY: 1, force: 1 }] });
  await delay(30);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: tapSetup.x + 2, y: tapSetup.y, id: 8, radiusX: 1, radiusY: 1, force: 1 }] });
  await delay(40);
  assert.equal(await evaluate(cdp, `Number(document.querySelector('[data-drag="graph:xStart"]').getAttribute('aria-valuenow'))`), tapSetup.value, `${width}x${height} touch: first edge-grab move preserves the point-to-finger offset`);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await delay(60);

  const lostSetup = await evaluate(cdp, `(() => {
    const handle = document.querySelector('[data-drag="graph:xEnd"]');
    const svg = handle.ownerSVGElement;
    svg.addEventListener('pointerdown', (event) => { window.__positionTimePointerId = event.pointerId; }, { once: true });
    const point = svg.createSVGPoint();
    point.x = Number(handle.dataset.pointCx);
    point.y = Number(handle.dataset.pointCy);
    const centre = point.matrixTransform(svg.getScreenCTM());
    return { x: centre.x, y: centre.y, saves: window.SimScorm.getLocalLog().filter((entry) => entry.key === 'cmi.suspend_data').length };
  })()`);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: lostSetup.x, y: lostSetup.y, id: 9, radiusX: 1, radiusY: 1, force: 1 }] });
  await delay(30);
  const lost = await evaluate(cdp, `(() => {
    document.getElementById('graphSvg').dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: window.__positionTimePointerId, pointerType: 'touch' }));
    return { preview: Boolean(document.querySelector('.graph-magnifier')), saves: window.SimScorm.getLocalLog().filter((entry) => entry.key === 'cmi.suspend_data').length };
  })()`);
  assert.equal(lost.preview, false, `${width}x${height} touch: lost pointer capture clears magnifier`);
  assert.equal(lost.saves, lostSetup.saves, `${width}x${height} touch: lost capture before movement does not save`);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await delay(60);

  const mouseSetup = await evaluate(cdp, `(() => {
    const handle = document.querySelector('[data-drag="graph:xStart"]');
    const svg = handle.ownerSVGElement;
    const point = svg.createSVGPoint();
    point.x = Number(handle.dataset.pointCx);
    point.y = Number(handle.dataset.pointCy);
    const centre = point.matrixTransform(svg.getScreenCTM());
    return { x: centre.x, y: centre.y };
  })()`);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: mouseSetup.x, y: mouseSetup.y });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: mouseSetup.x, y: mouseSetup.y, button: "left", buttons: 1, clickCount: 1 });
  assert.equal(await evaluate(cdp, `Boolean(document.querySelector('.graph-magnifier'))`), false, `${width}x${height} mouse: graph drag does not show a touch magnifier`);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: mouseSetup.x, y: mouseSetup.y, button: "left", buttons: 0, clickCount: 1 });

  const keyboardPreview = await evaluate(cdp, `(() => {
    const handle = document.querySelector('[data-drag="graph:xStart"]');
    handle.focus();
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    return Boolean(document.querySelector('.graph-magnifier'));
  })()`);
  assert.equal(keyboardPreview, false, `${width}x${height} keyboard: endpoint adjustment does not show a touch magnifier`);

  await evaluate(cdp, `document.getElementById('nextMission').click()`);
  await delay(80);
  assert.match(await evaluate(cdp, `document.getElementById('taskKicker').textContent`), /3 \/ 5/, `${width}x${height} touch: advanced to mission 3`);
  await evaluate(cdp, `document.getElementById('nextMission').click()`);
  await delay(80);
  assert.match(await evaluate(cdp, `document.getElementById('taskKicker').textContent`), /4 \/ 5/, `${width}x${height} touch: advanced to mission 4`);
  await dragRoadControl("car:A", 30, "mission 4 A car");
  await dragRoadControl("velocity:A", 31, "mission 4 A velocity");
  await dragInitialPoint(32, "mission 4 initial-position point");
  const initialKeyboard = await evaluate(cdp, `(() => {
    const handle = document.querySelector('[data-drag="initial:x0"]');
    const before = Number(handle.getAttribute('aria-valuenow'));
    handle.focus();
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    return {
      before,
      after: Number(document.activeElement?.getAttribute('aria-valuenow')),
      focus: document.activeElement?.dataset.drag,
      preview: Boolean(document.querySelector('.graph-magnifier'))
    };
  })()`);
  assert.equal(initialKeyboard.after, initialKeyboard.before - 1, `${width}x${height} keyboard: mission initial point supports one-metre Arrow adjustment`);
  assert.equal(initialKeyboard.focus, "initial:x0", `${width}x${height} keyboard: mission initial point restores semantic focus after rerender`);
  assert.equal(initialKeyboard.preview, false, `${width}x${height} keyboard: mission initial point does not show a touch magnifier`);

  await evaluate(cdp, `document.getElementById('nextMission').click()`);
  await delay(80);
  assert.match(await evaluate(cdp, `document.getElementById('taskKicker').textContent`), /5 \/ 5/, `${width}x${height} touch: advanced to mission 5`);
  const twoCarLayout = await evaluate(cdp, `(() => {
    const road = document.getElementById('roadSvg').getBoundingClientRect();
    const groupA = document.querySelector('[data-road-car="A"]');
    const groupB = document.querySelector('[data-road-car="B"]');
    const bodyA = groupA.querySelector('.car-body').getBoundingClientRect();
    const bodyB = groupB.querySelector('.car-body').getBoundingClientRect();
    const labelA = groupA.querySelector('.car-body').parentElement.querySelector('text').getBoundingClientRect();
    const labelB = groupB.querySelector('.car-body').parentElement.querySelector('text').getBoundingClientRect();
    const velocityA = groupA.querySelector('.velocity-line, .velocity-zero-marker').getBoundingClientRect();
    const velocityB = groupB.querySelector('.velocity-line, .velocity-zero-marker').getBoundingClientRect();
    const speedLabelAElement = groupA.querySelector('.velocity-magnitude-label');
    const speedLabelBElement = groupB.querySelector('.velocity-magnitude-label');
    const speedLabelA = speedLabelAElement.getBoundingClientRect();
    const speedLabelB = speedLabelBElement.getBoundingClientRect();
    const velocityTipA = groupA.querySelector('.velocity-arrowhead, .velocity-zero-marker').getBoundingClientRect();
    const velocityTipB = groupB.querySelector('.velocity-arrowhead, .velocity-zero-marker').getBoundingClientRect();
    const overlaps = (first, second) => first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
    const inside = (rect) => rect.left >= road.left - 1 && rect.right <= road.right + 1 && rect.top >= road.top - 1 && rect.bottom <= road.bottom + 1;
    return {
      bodyOverlap: overlaps(bodyA, bodyB),
      aVelocityOverlapsB: overlaps(velocityA, bodyB),
      bVelocityOverlapsA: overlaps(velocityB, bodyA),
      labelsVisible: inside(labelA) && inside(labelB),
      velocitiesVisible: inside(velocityA) && inside(velocityB),
      speedLabelsVisible: inside(speedLabelA) && inside(speedLabelB),
      speedLabelsOverlapCars: [speedLabelA, speedLabelB].some((speedLabel) => overlaps(speedLabel, bodyA) || overlaps(speedLabel, bodyB)),
      speedLabelsOverlapTips: overlaps(speedLabelA, velocityTipA) || overlaps(speedLabelB, velocityTipB),
      speedLabelsOverlapEachOther: overlaps(speedLabelA, speedLabelB),
      speedLabelTexts: [speedLabelAElement.textContent, speedLabelBElement.textContent],
      roadBounds: { left: road.left, right: road.right, top: road.top, bottom: road.bottom },
      bodiesVisible: inside(bodyA) && inside(bodyB),
      aDraggable: Boolean(document.querySelector('[data-drag="car:A"], [data-drag="velocity:A"]')),
      bCar: Boolean(document.querySelector('[data-drag="car:B"]')),
      bVelocity: Boolean(document.querySelector('[data-drag="velocity:B"]'))
    };
  })()`);
  assert.equal(twoCarLayout.bodyOverlap, false, `${width}x${height} mission 5: A and B cars occupy distinct visual lanes`);
  assert.equal(twoCarLayout.aVelocityOverlapsB, false, `${width}x${height} mission 5: A velocity does not overlap B car`);
  assert.equal(twoCarLayout.bVelocityOverlapsA, false, `${width}x${height} mission 5: B velocity does not overlap A car`);
  assert.equal(twoCarLayout.labelsVisible, true, `${width}x${height} mission 5: both A and B labels remain inside the road viewport`);
  assert.equal(twoCarLayout.bodiesVisible, true, `${width}x${height} mission 5: both cars remain inside the road viewport`);
  assert.equal(twoCarLayout.velocitiesVisible, true, `${width}x${height} mission 5: both velocity visuals remain inside the road viewport`);
  assert.match(twoCarLayout.speedLabelTexts[0], /^\|v\|=[0-2]\.[05] m\/s$/, `${width}x${height} mission 5: authoritative A shows its current numeric speed magnitude`);
  assert.equal(twoCarLayout.speedLabelTexts[1], "|v|=? m/s", `${width}x${height} mission 5: incomplete B clearly marks its speed as unset`);
  assert.equal(twoCarLayout.speedLabelsVisible, true, `${width}x${height} mission 5: both speed labels remain inside the road viewport (${JSON.stringify(twoCarLayout)})`);
  assert.equal(twoCarLayout.speedLabelsOverlapCars, false, `${width}x${height} mission 5: speed labels do not cover either car`);
  assert.equal(twoCarLayout.speedLabelsOverlapTips, false, `${width}x${height} mission 5: speed labels do not cover their arrow tips`);
  assert.equal(twoCarLayout.speedLabelsOverlapEachOther, false, `${width}x${height} mission 5: A and B speed labels remain separated`);
  assert.equal(twoCarLayout.aDraggable, false, `${width}x${height} mission 5: authoritative A car and velocity remain fixed`);
  assert.equal(twoCarLayout.bCar, true, `${width}x${height} mission 5: B car remains touch draggable`);
  assert.equal(twoCarLayout.bVelocity, true, `${width}x${height} mission 5: B velocity remains touch draggable`);
  await dragRoadControl("car:B", 33, "mission 5 B car");
  await dragRoadControl("velocity:B", 34, "mission 5 B velocity");

  const bottoms = await evaluate(cdp, `(() => {
    const upper = document.getElementById('labUpperScroll');
    const panel = document.getElementById('labPanel');
    panel.scrollTop = panel.scrollHeight;
    return {
      upper: { scrollTop: upper.scrollTop, clientHeight: upper.clientHeight, scrollHeight: upper.scrollHeight },
      panel: { scrollTop: panel.scrollTop, clientHeight: panel.clientHeight, scrollHeight: panel.scrollHeight }
    };
  })()`);
  assert.equal(bottoms.upper.scrollTop, 0, `${width}x${height} touch: fixed visual region remains at scrollTop zero`);
  assert.ok(bottoms.upper.scrollHeight <= bottoms.upper.clientHeight + 1, `${width}x${height} touch: fixed visual region has no clipped overflow`);
  assert.ok(bottoms.panel.scrollTop + bottoms.panel.clientHeight >= bottoms.panel.scrollHeight - 1, `${width}x${height} touch: control panel reaches its true bottom`);
  return `${width}x${height} touch, fixed visual region, graph drag/cancel, panel bottom reachable`;
}

async function runEmbeddedScrollViewport(cdp, baseUrl, activityPath, width, height) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await cdp.send("Page.navigate", { url: `${baseUrl}/__embed-scroll-test.html?src=${encodeURIComponent(`${activityPath}?embedded-scroll=1`)}` });
  let embeddedState;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    embeddedState = await evaluate(cdp, `(() => {
      const frame = document.getElementById('activity');
      return { ready: Boolean(frame?.contentDocument?.querySelector('[data-drag="velocity:A"]')), src: frame?.src, state: frame?.contentDocument?.readyState, title: frame?.contentDocument?.title, text: frame?.contentDocument?.body?.textContent?.slice(0, 120) };
    })()`);
    if (embeddedState.ready) break;
    if (attempt === 99) throw new Error(`Embedded activity did not finish rendering: ${JSON.stringify(embeddedState)}`);
    await delay(50);
  }
  const gesture = await evaluate(cdp, `(async () => {
    window.scrollTo(0, 200);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const frame = document.getElementById('activity');
    const frameRect = frame.getBoundingClientRect();
    const inner = frame.contentDocument;
    const upper = inner.getElementById('labUpperScroll');
    const panel = inner.getElementById('labPanel');
    const graph = inner.getElementById('graphSvg').getBoundingClientRect();
    const candidates = [0.25, 0.5, 0.75].map((fraction) => ({ x: graph.left + graph.width * fraction, y: graph.top + 18 }));
    const point = candidates.find(({ x, y }) => !inner.elementFromPoint(x, y)?.closest('[data-drag]'));
    if (!point) throw new Error('No embedded blank graph point found');
    return {
      x: frameRect.left + point.x,
      y: frameRect.top + point.y,
      outerBefore: window.scrollY,
      upperBefore: upper.scrollTop,
      panelBefore: panel.scrollTop
    };
  })()`);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: gesture.x, y: gesture.y, id: 4, radiusX: 1, radiusY: 1, force: 1 }] });
  await delay(50);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: gesture.x, y: gesture.y - 100, id: 4, radiusX: 1, radiusY: 1, force: 1 }] });
  await delay(50);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await delay(150);
  const after = await evaluate(cdp, `({
    outer: window.scrollY,
    upper: document.getElementById('activity').contentDocument.getElementById('labUpperScroll').scrollTop,
    panel: document.getElementById('activity').contentDocument.getElementById('labPanel').scrollTop
  })`);
  assert.ok(after.outer > gesture.outerBefore, `${width}x${height} embedded touch: blank visual-region swipe scrolls the Moodle-like outer page`);
  assert.equal(after.upper, gesture.upperBefore, `${width}x${height} embedded touch: fixed visual region does not scroll internally`);
  assert.equal(after.panel, gesture.panelBefore, `${width}x${height} embedded touch: outer-page swipe does not move the control panel`);

  async function embeddedRoadDrag(kind, pointerId, label) {
    const setup = await evaluate(cdp, `(async () => {
      window.scrollTo(0, 200);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const frame = document.getElementById('activity');
      const inner = frame.contentDocument;
      const target = Array.from(inner.querySelectorAll('[data-drag]')).find((element) => element.dataset.drag === ${JSON.stringify(kind)});
      if (!target) throw new Error('Missing embedded road target ${kind}');
      const svg = inner.getElementById('roadSvg');
      const point = svg.createSVGPoint();
      point.x = Number(target.dataset.focusX);
      point.y = Number(target.dataset.focusY);
      const start = point.matrixTransform(svg.getScreenCTM());
      const frameRect = frame.getBoundingClientRect();
      const stage = inner.querySelector('.lab-stage');
      const upper = inner.getElementById('labUpperScroll');
      const label = ${JSON.stringify(kind)}.split(':')[1];
      const car = Array.from(inner.querySelectorAll('[data-drag]')).find((element) => element.dataset.drag === 'car:' + label);
      const velocity = Array.from(inner.querySelectorAll('[data-drag]')).find((element) => element.dataset.drag === 'velocity:' + label);
      const road = svg.getBoundingClientRect();
      const group = inner.querySelector('[data-road-car="' + label + '"]');
      const magnitudeLabel = group?.querySelector('.velocity-magnitude-label');
      const magnitudeBounds = magnitudeLabel?.getBoundingClientRect();
      const velocitySymbol = group?.querySelector('.velocity-arrowhead, .velocity-zero-marker')?.getBoundingClientRect();
      const body = group?.querySelector('.car-body')?.getBoundingClientRect();
      const overlaps = (first, second) => Boolean(first && second && first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top);
      const inside = (rect) => Boolean(rect && rect.left >= road.left - 1 && rect.right <= road.right + 1 && rect.top >= road.top - 1 && rect.bottom <= road.bottom + 1);
      return {
        x: frameRect.left + start.x, y: frameRect.top + start.y,
        value: Number(target.getAttribute('aria-valuenow')), x0: Number(car?.getAttribute('aria-valuenow')), velocity: Number(velocity?.getAttribute('aria-valuenow')),
        magnitudeText: magnitudeLabel?.textContent, magnitudeVisible: inside(magnitudeBounds),
        magnitudeOverlapsVelocity: overlaps(magnitudeBounds, velocitySymbol), magnitudeOverlapsCar: overlaps(magnitudeBounds, body),
        outer: window.scrollY, upper: upper.scrollTop, stageScrollHeight: stage.scrollHeight, upperScrollHeight: upper.scrollHeight
      };
    })()`);
    assert.match(setup.magnitudeText, /^\|v\|=(?:\?|[0-2]\.[05]) m\/s$/, `${width}x${height} embedded touch: ${label} shows speed magnitude with units`);
    assert.equal(setup.magnitudeVisible, true, `${width}x${height} embedded touch: ${label} speed label stays inside the road viewport`);
    assert.equal(setup.magnitudeOverlapsVelocity, false, `${width}x${height} embedded touch: ${label} speed label does not cover the arrow tip`);
    assert.equal(setup.magnitudeOverlapsCar, false, `${width}x${height} embedded touch: ${label} speed label does not cover its car`);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: setup.x, y: setup.y, id: pointerId, radiusX: 1, radiusY: 1, force: 1 }] });
    await delay(40);
    const preview = await evaluate(cdp, `(() => {
      const inner = document.getElementById('activity').contentDocument;
      const source = inner.getElementById('roadLayer');
      const shown = inner.querySelector('.road-magnifier');
      const clone = shown?.querySelector('.road-magnifier-source');
      const expected = source.cloneNode(true);
      expected.querySelectorAll('.road-drag-hit, .drag-hit, .car-hit').forEach((element) => element.remove());
      expected.querySelectorAll('*').forEach((element) => Array.from(element.attributes).forEach((attribute) => {
        if (['id', 'data-drag', 'tabindex', 'role', 'focusable'].includes(attribute.name) || attribute.name.startsWith('aria-')) element.removeAttribute(attribute.name);
      }));
      const host = inner.getElementById('roadTouchPreviewHost');
      const hostBounds = host.getBoundingClientRect();
      const stage = inner.querySelector('.lab-stage');
      const stageBounds = stage.getBoundingClientRect();
      const upper = inner.getElementById('labUpperScroll');
      const target = Array.from(inner.querySelectorAll('[data-drag]')).find((element) => element.dataset.drag === ${JSON.stringify(kind)});
      const viewBox = shown?.getAttribute('viewBox').split(/\\s+/).map(Number);
      const focus = [Number(target?.dataset.focusX), Number(target?.dataset.focusY)];
      const carLabel = ${JSON.stringify(kind)}.split(':')[1];
      const visualSelector = ${JSON.stringify(kind)}.startsWith('car:') ? '[data-road-car="' + carLabel + '"] .car-body' : '[data-road-car="' + carLabel + '"] .velocity-arrowhead, [data-road-car="' + carLabel + '"] .velocity-zero-marker';
      const visual = clone?.querySelector(visualSelector)?.getBoundingClientRect();
      return {
        exists: Boolean(shown), exact: clone?.innerHTML === expected.innerHTML, sameText: clone?.textContent === expected.textContent,
        interactions: clone?.querySelectorAll('[data-drag], [tabindex], [role], [aria-label], [id]').length, outer: window.scrollY,
        contained: hostBounds.left >= stageBounds.left - 1 && hostBounds.right <= stageBounds.right + 1 && hostBounds.top >= stageBounds.top - 1 && hostBounds.bottom <= stageBounds.bottom + 1,
        size: [hostBounds.width, hostBounds.height],
        focusInCrop: focus[0] >= viewBox[0] && focus[0] <= viewBox[0] + viewBox[2] && focus[1] >= viewBox[1] && focus[1] <= viewBox[1] + viewBox[3],
        visualVisible: Boolean(visual && visual.right > hostBounds.left && visual.left < hostBounds.right && visual.bottom > hostBounds.top && visual.top < hostBounds.bottom),
        stageScrollHeight: stage.scrollHeight, upperScrollHeight: upper.scrollHeight
      };
    })()`);
    assert.equal(preview.exists, true, `${width}x${height} embedded touch: ${label} shows a road magnifier`);
    assert.equal(preview.exact, true, `${width}x${height} embedded touch: ${label} magnifier is the exact sanitized road source`);
    assert.equal(preview.sameText, true, `${width}x${height} embedded touch: ${label} magnifier adds no content`);
    assert.equal(preview.interactions, 0, `${width}x${height} embedded touch: ${label} clone has no interactions or duplicate semantics`);
    assert.equal(preview.outer, setup.outer, `${width}x${height} embedded touch: ${label} preview does not scroll Moodle`);
    assert.equal(preview.contained, true, `${width}x${height} embedded touch: ${label} magnifier is fully contained in the visible stage`);
    assert.ok(preview.size[0] >= 160 && preview.size[1] >= 65, `${width}x${height} embedded touch: ${label} magnifier is not clipped to the road row`);
    assert.equal(preview.focusInCrop, true, `${width}x${height} embedded touch: ${label} focus lies inside the road crop`);
    assert.equal(preview.visualVisible, true, `${width}x${height} embedded touch: ${label} controlled visual is visibly rendered in the preview`);
    assert.equal(preview.stageScrollHeight, setup.stageScrollHeight, `${width}x${height} embedded touch: ${label} preview does not change stage scroll height`);
    assert.equal(preview.upperScrollHeight, setup.upperScrollHeight, `${width}x${height} embedded touch: ${label} preview does not change upper scroll height`);
    const dragDelta = setup.value >= (kind.startsWith("velocity:") ? 2 : 8) ? -28 : 28;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: setup.x + dragDelta, y: setup.y, id: pointerId, radiusX: 1, radiusY: 1, force: 1 }] });
    await delay(40);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await delay(80);
    const done = await evaluate(cdp, `(() => {
      const inner = document.getElementById('activity').contentDocument;
      const target = Array.from(inner.querySelectorAll('[data-drag]')).find((element) => element.dataset.drag === ${JSON.stringify(kind)});
      const label = ${JSON.stringify(kind)}.split(':')[1];
      const car = Array.from(inner.querySelectorAll('[data-drag]')).find((element) => element.dataset.drag === 'car:' + label);
      const velocity = Array.from(inner.querySelectorAll('[data-drag]')).find((element) => element.dataset.drag === 'velocity:' + label);
      const magnitudeText = inner.querySelector('[data-road-car="' + label + '"] .velocity-magnitude-label')?.textContent;
      return { value: Number(target?.getAttribute('aria-valuenow')), x0: Number(car?.getAttribute('aria-valuenow')), velocity: Number(velocity?.getAttribute('aria-valuenow')), magnitudeText, outer: window.scrollY, upper: inner.getElementById('labUpperScroll').scrollTop, preview: Boolean(inner.querySelector('.road-magnifier')) };
    })()`);
    assert.notEqual(done.value, setup.value, `${width}x${height} embedded touch: ${label} changes its value`);
    assert.equal(kind.startsWith("car:") ? done.velocity : done.x0, kind.startsWith("car:") ? setup.velocity : setup.x0, `${width}x${height} embedded touch: ${label} changes only its nearest semantic road target`);
    const expectedMagnitude = kind.startsWith("velocity:") ? `|v|=${Math.abs(done.velocity).toFixed(1)} m/s` : setup.magnitudeText;
    assert.equal(done.magnitudeText, expectedMagnitude, `${width}x${height} embedded touch: ${label} speed label stays synchronized`);
    assert.equal(done.outer, setup.outer, `${width}x${height} embedded touch: ${label} active drag locks Moodle scrolling`);
    assert.equal(done.upper, setup.upper, `${width}x${height} embedded touch: ${label} leaves the stage fixed`);
    assert.equal(done.preview, false, `${width}x${height} embedded touch: ${label} preview clears on release`);
  }

  async function embeddedInitialDrag(pointerId, label) {
    const setup = await evaluate(cdp, `(async () => {
      window.scrollTo(0, 200);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const frame = document.getElementById('activity');
      const inner = frame.contentDocument;
      const target = inner.querySelector('[data-drag="initial:x0"]');
      const svg = inner.getElementById('graphSvg');
      const point = svg.createSVGPoint();
      point.x = Number(target.dataset.pointCx); point.y = Number(target.dataset.pointCy);
      const centre = point.matrixTransform(svg.getScreenCTM());
      const frameRect = frame.getBoundingClientRect();
      return { x: frameRect.left + centre.x, y: frameRect.top + centre.y, value: Number(target.getAttribute('aria-valuenow')), outer: window.scrollY, upper: inner.getElementById('labUpperScroll').scrollTop };
    })()`);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: setup.x, y: setup.y, id: pointerId, radiusX: 1, radiusY: 1, force: 1 }] });
    await delay(40);
    const preview = await evaluate(cdp, `(() => {
      const inner = document.getElementById('activity').contentDocument;
      const shown = inner.querySelector('.graph-magnifier');
      const source = inner.getElementById('graphLayer');
      const clone = shown?.querySelector('.graph-magnifier-source');
      const expected = source.cloneNode(true);
      expected.querySelectorAll('.drag-hit').forEach((element) => element.remove());
      expected.querySelectorAll('*').forEach((element) => Array.from(element.attributes).forEach((attribute) => {
        if (['id', 'data-drag', 'tabindex', 'role', 'focusable'].includes(attribute.name) || attribute.name.startsWith('aria-')) element.removeAttribute(attribute.name);
      }));
      return { exists: Boolean(shown), exact: clone?.innerHTML === expected.innerHTML, sameText: clone?.textContent === expected.textContent, outer: window.scrollY };
    })()`);
    assert.equal(preview.exists, true, `${width}x${height} embedded touch: ${label} shows a graph magnifier`);
    assert.equal(preview.exact, true, `${width}x${height} embedded touch: ${label} magnifier is the exact sanitized graph source`);
    assert.equal(preview.sameText, true, `${width}x${height} embedded touch: ${label} magnifier adds no content`);
    assert.equal(preview.outer, setup.outer, `${width}x${height} embedded touch: ${label} preview leaves Moodle fixed`);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: setup.x, y: setup.y - 34, id: pointerId, radiusX: 1, radiusY: 1, force: 1 }] });
    await delay(40);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await delay(80);
    const done = await evaluate(cdp, `(() => {
      const inner = document.getElementById('activity').contentDocument;
      return { value: Number(inner.querySelector('[data-drag="initial:x0"]')?.getAttribute('aria-valuenow')), outer: window.scrollY, upper: inner.getElementById('labUpperScroll').scrollTop, preview: Boolean(inner.querySelector('.graph-magnifier')) };
    })()`);
    assert.notEqual(done.value, setup.value, `${width}x${height} embedded touch: ${label} changes x0`);
    assert.equal(done.outer, setup.outer, `${width}x${height} embedded touch: ${label} drag locks Moodle scrolling`);
    assert.equal(done.upper, setup.upper, `${width}x${height} embedded touch: ${label} leaves the stage fixed`);
    assert.equal(done.preview, false, `${width}x${height} embedded touch: ${label} preview clears on release`);
  }

  const blankRoad = await evaluate(cdp, `(async () => {
    window.scrollTo(0, 200);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const frame = document.getElementById('activity');
    const inner = frame.contentDocument;
    const svg = inner.getElementById('roadSvg');
    const frameRect = frame.getBoundingClientRect();
    const focuses = Array.from(inner.querySelectorAll('#roadLayer [data-drag]')).map((target) => {
      const point = svg.createSVGPoint(); point.x = Number(target.dataset.focusX); point.y = Number(target.dataset.focusY);
      return point.matrixTransform(svg.getScreenCTM());
    });
    const candidates = [];
    for (const focus of focuses) for (const [dx, dy] of [[32, 0], [-32, 0], [0, 32], [0, -32], [25, 25], [-25, 25]]) candidates.push({ x: focus.x + dx, y: focus.y + dy });
    const road = svg.getBoundingClientRect();
    const point = candidates.find(({ x, y }) => x > road.left + 2 && x < road.right - 2 && y > road.top + 2 && y < road.bottom - 2 && !inner.elementFromPoint(x, y)?.closest('[data-drag]') && focuses.every((focus) => Math.hypot(x - focus.x, y - focus.y) > 28));
    if (!point) throw new Error('No blank road point just outside semantic target radius');
    return { x: frameRect.left + point.x, y: frameRect.top + point.y, outer: window.scrollY };
  })()`);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: blankRoad.x, y: blankRoad.y, id: 39, radiusX: 1, radiusY: 1, force: 1 }] });
  await delay(30);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: blankRoad.x, y: blankRoad.y - 80, id: 39, radiusX: 1, radiusY: 1, force: 1 }] });
  await delay(30);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await delay(120);
  const blankRoadAfter = await evaluate(cdp, `({ outer: window.scrollY, preview: Boolean(document.getElementById('activity').contentDocument.querySelector('.road-magnifier')) })`);
  assert.ok(blankRoadAfter.outer > blankRoad.outer, `${width}x${height} embedded touch: blank road swipe outside semantic radius scrolls the Moodle-like page`);
  assert.equal(blankRoadAfter.preview, false, `${width}x${height} embedded touch: blank road swipe starts no drag or preview`);

  await embeddedRoadDrag("car:A", 40, "exploration A car");
  await embeddedRoadDrag("velocity:A", 41, "exploration A velocity");

  await evaluate(cdp, `(async () => {
    const frame = document.getElementById('activity');
    const inner = frame.contentDocument;
    inner.getElementById('confirmStart').click();
    await new Promise((resolve) => setTimeout(resolve, 100));
  })()`);
  await embeddedRoadDrag("car:A", 42, "mission 1 A car");
  await embeddedRoadDrag("velocity:A", 43, "mission 1 A velocity");
  await embeddedInitialDrag(44, "mission 1 initial point");
  await evaluate(cdp, `(async () => {
    const inner = document.getElementById('activity').contentDocument;
    inner.getElementById('nextMission').click();
    await new Promise((resolve) => setTimeout(resolve, 100));
  })()`);
  for (const [index, endpoint] of ["xStart", "xEnd"].entries()) {
    const drag = await evaluate(cdp, `(async () => {
      window.scrollTo(0, 200);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const frame = document.getElementById('activity');
      const inner = frame.contentDocument;
      const handle = inner.querySelector('[data-drag="graph:${endpoint}"]');
      const svg = handle.ownerSVGElement;
      const point = svg.createSVGPoint();
      point.x = Number(handle.dataset.pointCx);
      point.y = Number(handle.dataset.pointCy);
      const centre = point.matrixTransform(svg.getScreenCTM());
      const frameRect = frame.getBoundingClientRect();
      return {
        x: frameRect.left + centre.x,
        y: frameRect.top + centre.y,
        value: Number(handle.getAttribute('aria-valuenow')),
        outerBefore: window.scrollY,
        upperBefore: inner.getElementById('labUpperScroll').scrollTop
      };
    })()`);
    const pointerId = 5 + index;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: drag.x, y: drag.y, id: pointerId, radiusX: 1, radiusY: 1, force: 1 }] });
    await delay(50);
    const embeddedPreview = await evaluate(cdp, `(() => {
      const inner = document.getElementById('activity').contentDocument;
      const preview = inner.querySelector('.graph-magnifier');
      const source = inner.getElementById('graphLayer');
      const clone = preview?.querySelector('.graph-magnifier-source');
      const bounds = inner.getElementById('graphTouchPreviewHost').getBoundingClientRect();
      return {
        exists: Boolean(preview),
        viewBox: preview?.getAttribute('viewBox').split(/\\s+/).map(Number),
        width: bounds.width,
        height: bounds.height,
        sameText: clone?.textContent === source.textContent,
        interactions: clone?.querySelectorAll('[data-drag], [tabindex], [role], [aria-label]').length,
        outer: window.scrollY
      };
    })()`);
    assert.equal(embeddedPreview.exists, true, `${width}x${height} embedded touch: ${endpoint} shows a real graph magnifier`);
    assert.equal(embeddedPreview.viewBox[0], endpoint === "xStart" ? 0 : 520, `${width}x${height} embedded touch: ${endpoint} magnifier crops the correct source-graph edge`);
    assert.ok(embeddedPreview.width >= 160 && embeddedPreview.height >= 100, `${width}x${height} embedded touch: magnifier retains readable CSS dimensions inside iframe`);
    assert.equal(embeddedPreview.sameText, true, `${width}x${height} embedded touch: magnifier adds no content beyond the source graph`);
    assert.equal(embeddedPreview.interactions, 0, `${width}x${height} embedded touch: magnifier clone has no interactions or duplicate ARIA`);
    assert.equal(embeddedPreview.outer, drag.outerBefore, `${width}x${height} embedded touch: showing magnifier does not scroll the Moodle-like page`);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: drag.x, y: drag.y + 40, id: pointerId, radiusX: 1, radiusY: 1, force: 1 }] });
    await delay(50);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await delay(150);
    const dragged = await evaluate(cdp, `(() => {
      const inner = document.getElementById('activity').contentDocument;
      return {
        value: Number(inner.querySelector('[data-drag="graph:${endpoint}"]').getAttribute('aria-valuenow')),
        outer: window.scrollY,
        upper: inner.getElementById('labUpperScroll').scrollTop,
        preview: Boolean(inner.querySelector('.graph-magnifier'))
      };
    })()`);
    const label = endpoint === "xStart" ? "x0" : "x6";
    assert.notEqual(dragged.value, drag.value, `${width}x${height} embedded touch: dragging ${label} changes that graph point`);
    assert.equal(dragged.outer, drag.outerBefore, `${width}x${height} embedded touch: dragging ${label} does not scroll the Moodle-like outer page`);
    assert.equal(dragged.upper, drag.upperBefore, `${width}x${height} embedded touch: dragging ${label} does not move the fixed visual region`);
    assert.equal(dragged.preview, false, `${width}x${height} embedded touch: releasing ${label} clears its magnifier`);
  }
  await evaluate(cdp, `(async () => {
    const inner = document.getElementById('activity').contentDocument;
    inner.getElementById('nextMission').click();
    await new Promise((resolve) => setTimeout(resolve, 80));
    inner.getElementById('nextMission').click();
    await new Promise((resolve) => setTimeout(resolve, 80));
  })()`);
  await embeddedRoadDrag("car:A", 47, "mission 4 A car");
  await embeddedRoadDrag("velocity:A", 48, "mission 4 A velocity");
  await embeddedInitialDrag(49, "mission 4 initial point");
  await evaluate(cdp, `(async () => {
    const inner = document.getElementById('activity').contentDocument;
    inner.getElementById('nextMission').click();
    await new Promise((resolve) => setTimeout(resolve, 80));
  })()`);
  const embeddedTwoCarLayout = await evaluate(cdp, `(() => {
    const inner = document.getElementById('activity').contentDocument;
    const road = inner.getElementById('roadSvg').getBoundingClientRect();
    const groupA = inner.querySelector('[data-road-car="A"]');
    const groupB = inner.querySelector('[data-road-car="B"]');
    const bodyA = groupA.querySelector('.car-body').getBoundingClientRect();
    const bodyB = groupB.querySelector('.car-body').getBoundingClientRect();
    const labelA = groupA.querySelector('.car-body').parentElement.querySelector('text').getBoundingClientRect();
    const labelB = groupB.querySelector('.car-body').parentElement.querySelector('text').getBoundingClientRect();
    const velocityA = groupA.querySelector('.velocity-line, .velocity-zero-marker').getBoundingClientRect();
    const velocityB = groupB.querySelector('.velocity-line, .velocity-zero-marker').getBoundingClientRect();
    const speedLabelAElement = groupA.querySelector('.velocity-magnitude-label');
    const speedLabelBElement = groupB.querySelector('.velocity-magnitude-label');
    const speedLabelA = speedLabelAElement.getBoundingClientRect();
    const speedLabelB = speedLabelBElement.getBoundingClientRect();
    const velocityTipA = groupA.querySelector('.velocity-arrowhead, .velocity-zero-marker').getBoundingClientRect();
    const velocityTipB = groupB.querySelector('.velocity-arrowhead, .velocity-zero-marker').getBoundingClientRect();
    const overlaps = (first, second) => first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
    const inside = (rect) => rect.left >= road.left - 1 && rect.right <= road.right + 1 && rect.top >= road.top - 1 && rect.bottom <= road.bottom + 1;
    return {
      bodyOverlap: overlaps(bodyA, bodyB),
      velocityOverlap: overlaps(velocityA, bodyB) || overlaps(velocityB, bodyA),
      labelsVisible: inside(labelA) && inside(labelB),
      velocitiesVisible: inside(velocityA) && inside(velocityB),
      speedLabelsVisible: inside(speedLabelA) && inside(speedLabelB),
      speedLabelsOverlapCars: [speedLabelA, speedLabelB].some((speedLabel) => overlaps(speedLabel, bodyA) || overlaps(speedLabel, bodyB)),
      speedLabelsOverlapTips: overlaps(speedLabelA, velocityTipA) || overlaps(speedLabelB, velocityTipB),
      speedLabelsOverlapEachOther: overlaps(speedLabelA, speedLabelB),
      speedLabelTexts: [speedLabelAElement.textContent, speedLabelBElement.textContent],
      aDraggable: Boolean(inner.querySelector('[data-drag="car:A"], [data-drag="velocity:A"]')),
      bCar: Boolean(inner.querySelector('[data-drag="car:B"]')),
      bVelocity: Boolean(inner.querySelector('[data-drag="velocity:B"]'))
    };
  })()`);
  assert.equal(embeddedTwoCarLayout.bodyOverlap, false, `${width}x${height} embedded mission 5: car lanes do not overlap`);
  assert.equal(embeddedTwoCarLayout.velocityOverlap, false, `${width}x${height} embedded mission 5: velocity visuals do not overlap the other car`);
  assert.equal(embeddedTwoCarLayout.labelsVisible, true, `${width}x${height} embedded mission 5: both car labels remain visible`);
  assert.equal(embeddedTwoCarLayout.velocitiesVisible, true, `${width}x${height} embedded mission 5: both velocity visuals remain visible`);
  assert.match(embeddedTwoCarLayout.speedLabelTexts[0], /^\|v\|=[0-2]\.[05] m\/s$/, `${width}x${height} embedded mission 5: authoritative A shows its numeric speed magnitude`);
  assert.equal(embeddedTwoCarLayout.speedLabelTexts[1], "|v|=? m/s", `${width}x${height} embedded mission 5: incomplete B clearly marks its speed as unset`);
  assert.equal(embeddedTwoCarLayout.speedLabelsVisible, true, `${width}x${height} embedded mission 5: both speed labels remain fully visible`);
  assert.equal(embeddedTwoCarLayout.speedLabelsOverlapCars, false, `${width}x${height} embedded mission 5: speed labels do not cover either car`);
  assert.equal(embeddedTwoCarLayout.speedLabelsOverlapTips, false, `${width}x${height} embedded mission 5: speed labels do not cover their arrow tips`);
  assert.equal(embeddedTwoCarLayout.speedLabelsOverlapEachOther, false, `${width}x${height} embedded mission 5: speed labels remain separated`);
  assert.equal(embeddedTwoCarLayout.aDraggable, false, `${width}x${height} embedded mission 5: A remains authoritative and fixed`);
  assert.equal(embeddedTwoCarLayout.bCar, true, `${width}x${height} embedded mission 5: B car is draggable`);
  assert.equal(embeddedTwoCarLayout.bVelocity, true, `${width}x${height} embedded mission 5: B velocity is draggable`);
  await embeddedRoadDrag("car:B", 50, "mission 5 B car");
  await embeddedRoadDrag("velocity:B", 51, "mission 5 B velocity");
  return `${width}x${height} embedded outer scrolling with real road/graph magnifiers and isolated mission drags`;
}

async function runGeneratedPaperChecks(cdp, baseUrl, activityPath) {
  async function startWithSeed(seed, label) {
    const seedWords = [0, 8, 16, 24].map((offset) => Number.parseInt(seed.slice(offset, offset + 8), 16) >>> 0);
    const cryptoStub = await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
      const fixed = ${JSON.stringify(seedWords)};
      Object.defineProperty(window.crypto, 'getRandomValues', { configurable: true, value(array) {
        if (!(array instanceof Uint32Array) || array.length !== 4) throw new Error('Unexpected random request');
        array.set(fixed);
        return array;
      }});
    })();` });
    let result;
    try {
      await cdp.send("Page.navigate", { url: `${baseUrl}${activityPath}?generated-regression=${label}` });
      await waitForActivity(cdp);
      result = await evaluate(cdp, `(async () => {
        document.getElementById('confirmStart').click();
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const entry = window.SimScorm.getLocalLog().filter((item) => item.key === 'cmi.suspend_data').at(-1);
        const snapshot = JSON.parse(entry.value);
        const target = document.querySelector('.target-line');
        return {
          snapshot,
          phase: document.getElementById('phaseBadge').textContent,
          task: document.getElementById('taskTitle').textContent,
          targetGeometry: ['x1', 'y1', 'x2', 'y2'].map((key) => target.getAttribute(key)).join(','),
          generatorReady: Boolean(window.PositionTimeGenerator),
          valid: window.PositionTimeGenerator.validateGeneratedPaper({ version: snapshot.answer.g.v, missions: snapshot.answer.g.q }),
          fingerprint: window.PositionTimeGenerator.fingerprint({ version: snapshot.answer.g.v, missions: snapshot.answer.g.q })
        };
      })()`);
    } finally {
      await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: cryptoStub.identifier });
    }
    assert.equal(result.generatorReady, true, `${label}: packaged generator is available`);
    assert.equal(result.valid, true, `${label}: browser-generated paper validates`);
    assert.match(result.phase, /任務 1 \/ 5/, `${label}: generated assessment opens mission 1`);
    assert.equal(result.task, "根據目標圖設定運動", `${label}: generated assessment renders production mission UI`);
    return result;
  }

  const first = await startWithSeed("0123456789abcdeffedcba9876543210", "seed-a");
  const second = await startWithSeed("fedcba98765432100123456789abcdef", "seed-b");
  assert.notEqual(first.fingerprint, second.fingerprint, "two fixed browser seeds produce different learner papers");

  const preload = await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
    const values = {
      'cmi.core.lesson_status': 'incomplete',
      'cmi.suspend_data': ${JSON.stringify(JSON.stringify(first.snapshot))},
      'cmi.core.score.raw': ''
    };
    window.__simlabReloadValues = values;
    window.API = {
      LMSInitialize: () => 'true', LMSFinish: () => 'true', LMSCommit: () => 'true',
      LMSGetValue: (key) => values[key] || '', LMSSetValue: (key, value) => { values[key] = String(value); return 'true'; },
      LMSGetLastError: () => '0', LMSGetErrorString: () => ''
    };
  })();` });
  try {
    await cdp.send("Page.navigate", { url: `${baseUrl}${activityPath}?generated-regression=reload` });
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const ready = await evaluate(cdp, "document.readyState === 'complete' && document.getElementById('phaseBadge').textContent.includes('任務 1 / 5')");
      if (ready) break;
      if (attempt === 99) throw new Error("Generated draft did not restore after browser reload.");
      await delay(50);
    }
    const restored = await evaluate(cdp, `(() => {
      const target = document.querySelector('.target-line');
      const input = document.querySelector('[data-quantity="x0"]');
      const changedX0 = Number(input.value) === 8 ? -8 : 8;
      input.value = String(changedX0);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      const snapshot = JSON.parse(window.__simlabReloadValues['cmi.suspend_data']);
      return {
        fingerprint: window.PositionTimeGenerator.fingerprint({ version: snapshot.answer.g.v, missions: snapshot.answer.g.q }),
        phase: document.getElementById('phaseBadge').textContent,
        task: document.getElementById('taskTitle').textContent,
        targetGeometry: ['x1', 'y1', 'x2', 'y2'].map((key) => target.getAttribute(key)).join(','),
        savedX0: snapshot.answer.a.ans.m1.x0,
        changedX0
      };
    })()`);
    assert.equal(restored.fingerprint, first.fingerprint, "browser reload restores the exact saved generated paper");
    assert.equal(restored.targetGeometry, first.targetGeometry, "browser reload redraws the same learner-facing target geometry from restored production state");
    assert.equal(restored.savedX0, restored.changedX0, "a legal post-reload edit is saved by production with the restored paper");
    assert.match(restored.phase, /任務 1 \/ 5/, "browser reload remains in the saved mission phase");
    assert.equal(restored.task, "根據目標圖設定運動", "browser reload renders the restored paper instead of exploration");
  } finally {
    await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: preload.identifier });
  }
  return "two fixed generated seeds differ; saved draft reload is stable";
}

async function main() {
  let server;
  let profileDirectory;
  let packageDirectory;
  let activityPath;
  let chrome;
  let cdp;
  let browserErrors = "";
  let failure;
  let summary;
  const tempRoot = fs.realpathSync(os.tmpdir());
  try {
    const browser = findBrowser();
    if (!browser) throw new Error("Chrome/Chromium is required for this browser regression. Install Chrome/Chromium or set CHROME_PATH to its executable.");
    const extracted = buildAndExtractPackage(tempRoot);
    packageDirectory = extracted.packageDirectory;
    activityPath = extracted.activityPath;
    server = createServer(packageDirectory);
    await withTimeout(listenServer(server), 3000, "HTTP server listen");
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    profileDirectory = fs.mkdtempSync(path.join(tempRoot, "simlab-position-time-chrome-"));
    validateOwnedProfile(profileDirectory, tempRoot);
    const args = ["--headless=new", "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0", `--user-data-dir=${profileDirectory}`, "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-component-update", "--disable-sync", "--metrics-recording-only", "about:blank"];
    if (process.platform !== "win32" && typeof process.getuid === "function" && process.getuid() === 0) args.unshift("--no-sandbox");
    chrome = spawn(browser, args, { stdio: ["ignore", "ignore", "pipe"] });
    const spawnFailure = new Promise((_, reject) => chrome.once("error", (error) => {
      chrome.__simlabSpawnError = error;
      reject(new Error(`Could not spawn Chrome: ${error.message}`));
    }));
    chrome.stderr.on("data", (chunk) => { browserErrors = `${browserErrors}${chunk}`.slice(-4000); });
    const port = await Promise.race([withTimeout(devToolsPort(profileDirectory, chrome), 12000, "Chrome DevTools startup"), spawnFailure]);
    const { response: targetResponse, body: target } = await fetchJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
    if (!targetResponse.ok) throw new Error(`Could not create Chrome target (${targetResponse.status}).`);
    cdp = new CdpClient(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    const desktop = await runViewport(cdp, baseUrl, activityPath, 1280, 900);
    const narrow = await runViewport(cdp, baseUrl, activityPath, 320, 700);
    const narrowTouch = await runTouchViewport(cdp, baseUrl, activityPath, 320, 700);
    const shortTouch = await runTouchViewport(cdp, baseUrl, activityPath, 390, 500);
    const embeddedTouch = await runEmbeddedScrollViewport(cdp, baseUrl, activityPath, 390, 500);
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    const generated = await runGeneratedPaperChecks(cdp, baseUrl, activityPath);
    summary = `Position-time real-browser regression passed: ${desktop}; ${narrow}; ${narrowTouch}; ${shortTouch}; ${embeddedTouch}; ${generated}`;
  } catch (error) {
    if (browserErrors.trim()) error.message += `\nChrome stderr:\n${browserErrors.trim()}`;
    failure = error;
  }
  try { await cleanupResources({ chrome, cdp, server, profileDirectory, packageDirectory, tempRoot }); }
  catch (cleanupError) { failure = new AggregateError(failure ? [failure, cleanupError] : [cleanupError], "Browser regression cleanup failed."); }
  if (failure) throw failure;
  console.log(summary);
}

module.exports = { CdpClient, buildAndExtractPackage, childHasExited, cleanupResources, closeServer, contentType, createServer, delay, devToolsPort, evaluate, fetchJson, findBrowser, listenServer, removeOwnedPackage, removeOwnedProfile, resolvePackageFile, resolveScoLaunchPath, stopChrome, validateOwnedDirectory, validateOwnedProfile, waitForChildExit, withTimeout };

if (require.main === module) {
  main().catch((error) => {
    console.error(formatError(error));
    process.exitCode = 1;
  });
}
