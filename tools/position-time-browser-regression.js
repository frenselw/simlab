#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const simRoot = fs.realpathSync(path.join(root, "sim"));
const activityPath = "/sim/position-time-graph-motion-lab/index.html";
const profileNamePattern = /^simlab-position-time-chrome-[A-Za-z0-9]+$/;
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

function resolveSimFile(pathname, options = {}) {
  const repositoryRoot = options.root || root;
  const allowedRoot = options.simRoot || simRoot;
  const realpath = options.realpathSync || fs.realpathSync;
  if (!pathname.startsWith("/sim/")) return { status: 403 };
  const requested = path.resolve(repositoryRoot, `.${pathname}`);
  if (!requested.startsWith(`${path.join(repositoryRoot, "sim")}${path.sep}`)) return { status: 403 };
  let actual;
  try { actual = realpath(requested); }
  catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return { status: 404 };
    throw error;
  }
  if (!actual.startsWith(`${allowedRoot}${path.sep}`)) return { status: 403 };
  return { status: 200, filePath: actual };
}

function createServer() {
  return http.createServer((request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname); }
    catch { response.writeHead(400).end("Bad request"); return; }
    let resolved;
    try { resolved = resolveSimFile(pathname); }
    catch { response.writeHead(500).end("File resolution failed"); return; }
    if (resolved.status !== 200) { response.writeHead(resolved.status).end(resolved.status === 404 ? "Not found" : "Forbidden"); return; }
    fs.readFile(resolved.filePath, (error, content) => {
      if (error) { response.writeHead(error.code === "ENOENT" ? 404 : 500).end("Not found"); return; }
      response.writeHead(200, { "content-type": contentType(resolved.filePath), "cache-control": "no-store" });
      response.end(content);
    });
  });
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
  const resolvedTemp = fileSystem.realpathSync(tempRoot);
  const resolvedProfile = fileSystem.realpathSync(profileDirectory);
  const stat = fileSystem.lstatSync(profileDirectory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Refusing to remove a Chrome profile that is not a real directory.");
  if (path.dirname(resolvedProfile) !== resolvedTemp || path.resolve(profileDirectory) !== resolvedProfile || !profileNamePattern.test(path.basename(resolvedProfile))) {
    throw new Error(`Refusing to remove unowned Chrome profile path: ${profileDirectory}`);
  }
  return resolvedProfile;
}

function removeOwnedProfile(profileDirectory, tempRoot) {
  if (!profileDirectory || !fs.existsSync(profileDirectory)) return;
  const exactProfile = validateOwnedProfile(profileDirectory, tempRoot);
  fs.rmSync(exactProfile, { recursive: true, force: false, maxRetries: 3, retryDelay: 100 });
  if (fs.existsSync(exactProfile)) throw new Error(`Chrome profile cleanup did not remove ${exactProfile}`);
}

function closeServer(server) {
  if (!server?.listening) return Promise.resolve();
  return withTimeout(new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())), 3000, "HTTP server close");
}

async function cleanupResources(resources, operations = {}) {
  const stop = operations.stopChrome || stopChrome;
  const close = operations.closeServer || closeServer;
  const remove = operations.removeOwnedProfile || removeOwnedProfile;
  const errors = [];
  try { await stop(resources.chrome, resources.cdp); } catch (error) { errors.push(error); }
  try { resources.cdp?.close(); } catch (error) { errors.push(error); }
  try { await close(resources.server); } catch (error) { errors.push(error); }
  try { remove(resources.profileDirectory, resources.tempRoot); } catch (error) { errors.push(error); }
  if (errors.length) throw new AggregateError(errors, "Browser regression cleanup failed.");
}

class CdpClient {
  constructor(webSocketUrl, WebSocketClass = WebSocket, commandTimeout = 5000) {
    this.nextId = 1;
    this.pending = new Map();
    this.commandTimeout = commandTimeout;
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
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result);
    });
    this.socket.addEventListener("close", () => this.rejectPending(new Error("Chrome DevTools WebSocket closed.")));
    this.socket.addEventListener("error", () => this.rejectPending(new Error("Chrome DevTools WebSocket failed.")));
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

async function runViewport(cdp, baseUrl, width, height) {
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
      const handle = document.querySelector('.velocity-handle');
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
        velocity: Number(document.querySelector('[data-quantity="velocity"]').value),
        x0: Number(document.querySelector('[data-quantity="x0"]').value)
      };
    })()`);
    assert.ok(setup.styles.some((href) => href.endsWith("/sim/position-time-graph-motion-lab/styles.css")), `${width}px: production activity stylesheet loaded`);
    assert.ok(setup.scripts.some((src) => src.endsWith("/sim/position-time-graph-motion-lab/main.js")), `${width}px: production main.js loaded`);
    assert.ok(parseFloat(setup.hitStrokeWidth) >= 44, `${width}px: production CSS provides the enlarged velocity hit target`);
    assert.equal(setup.top, "velocity:A", `${width}px v=${initialVelocity}: elementFromPoint must hit the velocity target`);
    assert.equal(setup.velocity, initialVelocity, `${width}px v=${initialVelocity}: setup velocity rendered`);
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: setup.x, y: setup.y });
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: setup.x, y: setup.y, button: "left", buttons: 1, clickCount: 1 });
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
  return `${width}px (${cases.join(", ")})`;
}

async function main() {
  let server;
  let profileDirectory;
  let chrome;
  let cdp;
  let browserErrors = "";
  let failure;
  let summary;
  const tempRoot = fs.realpathSync(os.tmpdir());
  try {
    const browser = findBrowser();
    if (!browser) throw new Error("Chrome/Chromium is required for this browser regression. Install Chrome/Chromium or set CHROME_PATH to its executable.");
    server = createServer();
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
    const desktop = await runViewport(cdp, baseUrl, 1280, 900);
    const narrow = await runViewport(cdp, baseUrl, 320, 700);
    summary = `Position-time real-browser regression passed: ${desktop}; ${narrow}`;
  } catch (error) {
    if (browserErrors.trim()) error.message += `\nChrome stderr:\n${browserErrors.trim()}`;
    failure = error;
  }
  try { await cleanupResources({ chrome, cdp, server, profileDirectory, tempRoot }); }
  catch (cleanupError) { failure = new AggregateError(failure ? [failure, cleanupError] : [cleanupError], "Browser regression cleanup failed."); }
  if (failure) throw failure;
  console.log(summary);
}

module.exports = { CdpClient, childHasExited, cleanupResources, closeServer, contentType, createServer, findBrowser, listenServer, removeOwnedProfile, resolveSimFile, stopChrome, validateOwnedProfile, waitForChildExit, withTimeout };

if (require.main === module) {
  main().catch((error) => {
    console.error(formatError(error));
    process.exitCode = 1;
  });
}
