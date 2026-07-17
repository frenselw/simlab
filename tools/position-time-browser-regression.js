#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const activityPath = "/sim/position-time-graph-motion-lab/index.html";
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

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

function startServer() {
  const server = http.createServer((request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname); }
    catch { response.writeHead(400).end("Bad request"); return; }
    const filePath = path.resolve(root, `.${pathname}`);
    if (!filePath.startsWith(`${root}${path.sep}`)) { response.writeHead(403).end("Forbidden"); return; }
    fs.readFile(filePath, (error, content) => {
      if (error) { response.writeHead(error.code === "ENOENT" ? 404 : 500).end("Not found"); return; }
      response.writeHead(200, { "content-type": contentType(filePath), "cache-control": "no-store" });
      response.end(content);
    });
  });
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

class CdpClient {
  constructor(webSocketUrl) {
    this.nextId = 1;
    this.pending = new Map();
    this.socket = new WebSocket(webSocketUrl);
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", () => reject(new Error("Could not open the Chrome DevTools WebSocket.")), { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result);
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    const result = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject, method }));
    this.socket.send(JSON.stringify({ id, method, params }));
    return result;
  }

  close() { this.socket.close(); }
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
  const browser = findBrowser();
  if (!browser) {
    throw new Error("Chrome/Chromium is required for this browser regression. Install Chrome/Chromium or set CHROME_PATH to its executable.");
  }
  const server = await startServer();
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const profileDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "simlab-position-time-chrome-"));
  const args = ["--headless=new", "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0", `--user-data-dir=${profileDirectory}`, "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-component-update", "--disable-sync", "--metrics-recording-only", "about:blank"];
  if (process.platform !== "win32" && typeof process.getuid === "function" && process.getuid() === 0) args.unshift("--no-sandbox");
  const chrome = spawn(browser, args, { stdio: ["ignore", "ignore", "pipe"] });
  let browserErrors = "";
  chrome.stderr.on("data", (chunk) => { browserErrors = `${browserErrors}${chunk}`.slice(-4000); });
  let cdp;
  try {
    const port = await devToolsPort(profileDirectory, chrome);
    const targetResponse = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
    if (!targetResponse.ok) throw new Error(`Could not create Chrome target (${targetResponse.status}).`);
    const target = await targetResponse.json();
    cdp = new CdpClient(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    const desktop = await runViewport(cdp, baseUrl, 1280, 900);
    const narrow = await runViewport(cdp, baseUrl, 320, 700);
    console.log(`Position-time real-browser regression passed: ${desktop}; ${narrow}`);
  } catch (error) {
    if (browserErrors.trim()) error.message += `\nChrome stderr:\n${browserErrors.trim()}`;
    throw error;
  } finally {
    cdp?.close();
    chrome.kill();
    await new Promise((resolve) => server.close(resolve));
    try { fs.rmSync(profileDirectory, { recursive: true, force: true, maxRetries: 3 }); } catch {}
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
