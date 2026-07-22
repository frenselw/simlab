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
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname); }
    catch { response.writeHead(400).end("Bad request"); return; }
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
        hitStrokeWidth: getComputedStyle(document.querySelector('[data-drag="velocity:A"]')).strokeWidth,
        styles: Array.from(document.styleSheets, (sheet) => sheet.href).filter(Boolean),
        scripts: Array.from(document.scripts, (script) => script.src).filter(Boolean),
        runtimeReady: Boolean(window.SimScorm && window.SimActivityFlow && window.PositionTimeScoring && window.PositionTimeGenerator),
        upperOverflowY: getComputedStyle(document.getElementById('labUpperScroll')).overflowY,
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
      assert.equal(setup.upperOverflowY, "auto", `${width}px: header, road, and graph share the upper scroll owner`);
      assert.equal(setup.stageOverflowY, "visible", `${width}px: the stage is not a nested vertical scroller`);
    }
    if (width >= 820) {
      assert.ok(setup.desktopRects.header.bottom <= setup.desktopRects.panel.top + 1, `${width}px: desktop panel starts below the full-width header`);
      assert.ok(setup.desktopRects.header.bottom <= setup.desktopRects.stage.top + 1, `${width}px: desktop stage starts below the full-width header`);
      assert.ok(setup.desktopRects.panel.right <= setup.desktopRects.stage.left + 1, `${width}px: desktop panel remains to the left of the stage`);
    }
    if (width <= 420) assert.equal(setup.phaseDisplay, "none", `${width}px: duplicate header phase badge is hidden on phones`);
    assert.ok(parseFloat(setup.hitStrokeWidth) >= 44, `${width}px: production CSS provides the enlarged velocity hit target`);
    assert.equal(setup.top, "velocity:A", `${width}px v=${initialVelocity}: elementFromPoint must hit the velocity target`);
    assert.equal(setup.velocity, initialVelocity, `${width}px v=${initialVelocity}: setup velocity rendered`);
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: setup.x, y: setup.y });
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: setup.x, y: setup.y, button: "left", buttons: 1, clickCount: 1 });
    if (width < 820) {
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: setup.x, y: setup.y, deltaX: 0, deltaY: 140 });
      await delay(50);
      const activeDrag = await evaluate(cdp, `({
        locked: document.getElementById('labUpperScroll').classList.contains('is-dragging'),
        scrollTop: document.getElementById('labUpperScroll').scrollTop
      })`);
      assert.equal(activeDrag.locked, true, `${width}px v=${initialVelocity}: direct manipulation marks the upper scroller as locked`);
      assert.equal(activeDrag.scrollTop, setup.upperScrollTop, `${width}px v=${initialVelocity}: a wheel gesture during handle drag does not pan the upper region`);
    }
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: setup.x + 30, y: setup.y, button: "left", buttons: 1 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: setup.x + 30, y: setup.y, button: "left", buttons: 0, clickCount: 1 });
    const after = await evaluate(cdp, `({
      velocity: Number(document.querySelector('[data-quantity="velocity"]').value),
      x0: Number(document.querySelector('[data-quantity="x0"]').value),
      dragLocked: document.getElementById('labUpperScroll').classList.contains('is-dragging')
    })`);
    assert.notEqual(after.velocity, initialVelocity, `${width}px v=${initialVelocity}: real mouse drag must change velocity`);
    assert.equal(after.x0, setup.x0, `${width}px v=${initialVelocity}: velocity drag must not change x0`);
    assert.equal(after.dragLocked, false, `${width}px v=${initialVelocity}: releasing a handle restores upper-region scrolling`);
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
    assert.ok(upperScrolled.upper > 0, `${width}px: non-interactive stage space scrolls the complete upper region`);
    assert.equal(upperScrolled.panel, 0, `${width}px: upper-region scrolling does not move the control panel`);

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
    assert.equal(panelScrolled.upper, upperScrolled.upper, `${width}px: control-panel scrolling leaves the upper region fixed`);
  }
  return `${width}px (${cases.join(", ")})`;
}

async function runTouchViewport(cdp, baseUrl, activityPath, width, height) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: true });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await cdp.send("Page.navigate", { url: `${baseUrl}${activityPath}?touch-regression=${width}x${height}` });
  await waitForActivity(cdp);

  const blank = await evaluate(cdp, `(() => {
    const upper = document.getElementById('labUpperScroll');
    const panel = document.getElementById('labPanel');
    upper.scrollTop = (upper.scrollHeight - upper.clientHeight) / 2;
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
      upperScrollable: upper.scrollHeight > upper.clientHeight,
      panelScrollable: panel.scrollHeight > panel.clientHeight
    };
  })()`);
  assert.equal(blank.drag, null, `${width}x${height} touch: blank swipe starts outside every drag target`);
  assert.equal(blank.svg, "graphSvg", `${width}x${height} touch: blank swipe starts on non-interactive graph space`);
  assert.equal(blank.upperScrollable, true, `${width}x${height} touch: upper region has reachable overflow`);
  assert.equal(blank.panelScrollable, true, `${width}x${height} touch: control panel has reachable overflow`);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: blank.x, y: blank.y, id: 1, radiusX: 1, radiusY: 1, force: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: blank.x, y: blank.y - 90, id: 1, radiusX: 1, radiusY: 1, force: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await delay(150);
  const afterBlank = await evaluate(cdp, `({ upper: document.getElementById('labUpperScroll').scrollTop, panel: document.getElementById('labPanel').scrollTop })`);
  assert.ok(afterBlank.upper > blank.upperBefore, `${width}x${height} touch: blank graph swipe scrolls the complete upper region`);
  assert.equal(afterBlank.panel, blank.panelBefore, `${width}x${height} touch: blank upper swipe leaves the panel fixed`);

  await evaluate(cdp, `(() => {
    document.getElementById('confirmStart').click();
    document.getElementById('nextMission').click();
  })()`);
  await delay(100);
  const graphDrag = await evaluate(cdp, `(async () => {
    const handle = document.querySelector('[data-drag="graph:xStart"]');
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
      target: document.elementFromPoint(centre.x, centre.y)?.closest('[data-drag]')?.dataset.drag || null,
      start: Number(handle.getAttribute('aria-valuenow')),
      other: Number(document.querySelector('[data-drag="graph:xEnd"]').getAttribute('aria-valuenow')),
      upper: document.getElementById('labUpperScroll').scrollTop
    };
  })()`);
  assert.equal(graphDrag.target, "graph:xStart", `${width}x${height} touch: graph-point centre resolves to its production drag target`);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: graphDrag.x, y: graphDrag.y, id: 2, radiusX: 1, radiusY: 1, force: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: graphDrag.x, y: graphDrag.y - 55, id: 2, radiusX: 1, radiusY: 1, force: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await delay(100);
  const graphAfter = await evaluate(cdp, `({
    value: Number(document.querySelector('[data-drag="graph:xStart"]').getAttribute('aria-valuenow')),
    other: Number(document.querySelector('[data-drag="graph:xEnd"]').getAttribute('aria-valuenow')),
    upper: document.getElementById('labUpperScroll').scrollTop,
    locked: document.getElementById('labUpperScroll').classList.contains('is-dragging')
  })`);
  assert.notEqual(graphAfter.value, graphDrag.start, `${width}x${height} touch: graph-point drag changes that point`);
  assert.equal(graphAfter.other, graphDrag.other, `${width}x${height} touch: graph-point drag leaves the other point unchanged`);
  assert.equal(graphAfter.upper, graphDrag.upper, `${width}x${height} touch: graph-point drag does not pan its background`);
  assert.equal(graphAfter.locked, false, `${width}x${height} touch: graph-point release restores upper scrolling`);

  const cancelSetup = await evaluate(cdp, `(() => {
    const handle = document.querySelector('[data-drag="graph:xEnd"]');
    const svg = handle.ownerSVGElement;
    const point = svg.createSVGPoint();
    point.x = Number(handle.getAttribute('cx'));
    point.y = Number(handle.getAttribute('cy'));
    const centre = point.matrixTransform(svg.getScreenCTM());
    return {
      x: centre.x, y: centre.y,
      start: Number(handle.getAttribute('aria-valuenow')),
      saves: window.SimScorm.getLocalLog().filter((entry) => entry.key === 'cmi.suspend_data').length
    };
  })()`);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cancelSetup.x, y: cancelSetup.y, id: 3, radiusX: 1, radiusY: 1, force: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: cancelSetup.x, y: cancelSetup.y + 45, id: 3, radiusX: 1, radiusY: 1, force: 1 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await delay(100);
  const cancelled = await evaluate(cdp, `({
    value: Number(document.querySelector('[data-drag="graph:xEnd"]').getAttribute('aria-valuenow')),
    saves: window.SimScorm.getLocalLog().filter((entry) => entry.key === 'cmi.suspend_data').length,
    locked: document.getElementById('labUpperScroll').classList.contains('is-dragging')
  })`);
  assert.notEqual(cancelled.value, cancelSetup.start, `${width}x${height} touch: cancelled graph drag retains its last visible point value`);
  assert.ok(cancelled.saves > cancelSetup.saves, `${width}x${height} touch: cancelled graph drag persists its last visible state`);
  assert.equal(cancelled.locked, false, `${width}x${height} touch: cancelled graph drag releases the upper lock`);

  const bottoms = await evaluate(cdp, `(() => {
    const result = {};
    for (const [key, id] of [['upper', 'labUpperScroll'], ['panel', 'labPanel']]) {
      const element = document.getElementById(id);
      element.scrollTop = element.scrollHeight;
      result[key] = { scrollTop: element.scrollTop, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight };
    }
    return result;
  })()`);
  for (const [name, dimensions] of Object.entries(bottoms)) {
    assert.ok(dimensions.scrollTop + dimensions.clientHeight >= dimensions.scrollHeight - 1, `${width}x${height} touch: ${name} region reaches its true bottom`);
  }
  return `${width}x${height} touch, graph drag/cancel, both bottoms reachable`;
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
    const shortTouch = await runTouchViewport(cdp, baseUrl, activityPath, 390, 500);
    await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    const generated = await runGeneratedPaperChecks(cdp, baseUrl, activityPath);
    summary = `Position-time real-browser regression passed: ${desktop}; ${narrow}; ${shortTouch}; ${generated}`;
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
