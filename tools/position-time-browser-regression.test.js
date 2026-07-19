"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const path = require("node:path");
const {
  CdpClient,
  childHasExited,
  cleanupResources,
  resolvePackageFile,
  resolveScoLaunchPath,
  stopChrome,
  validateOwnedDirectory,
  validateOwnedProfile,
  waitForChildExit,
  withTimeout
} = require("./position-time-browser-regression.js");

(async function () {
const fakePackageRoot = path.resolve(path.sep, "extracted-package");
const launchPath = path.join(fakePackageRoot, "position-time-graph-motion-lab", "index.html");
const actual = resolvePackageFile("/position-time-graph-motion-lab/index.html", {
  packageRoot: fakePackageRoot,
  realpathSync: () => launchPath
});
assert.equal(actual.status, 200, "activity launch file is resolved inside the extracted package root");
assert.equal(actual.filePath, launchPath);
assert.equal(resolvePackageFile("/../README.md", { packageRoot: fakePackageRoot, realpathSync: (value) => value }).status, 403, "HTTP scope rejects lexical traversal");
assert.equal(resolvePackageFile("/not-present.js", {
  packageRoot: fakePackageRoot,
  realpathSync: () => { const error = new Error("missing"); error.code = "ENOENT"; throw error; }
}).status, 404, "missing package files are reported as missing");

const escaped = resolvePackageFile("/link.js", {
  packageRoot: fakePackageRoot,
  realpathSync: () => path.resolve(path.sep, "outside", "secret.js")
});
assert.equal(escaped.status, 403, "package realpath containment rejects a symlink escape");

const manifest = (resources) => `<manifest xmlns:adlcp="urn:adlcp"><resources>${resources}</resources></manifest>`;
const resource = (href, type = "sco") => `<resource adlcp:scormtype="${type}" href="${href}"></resource>`;
const launchFile = path.join(fakePackageRoot, "custom", "launch.html");
const launchOptions = {
  realpathSync: () => launchFile,
  lstatSync: () => ({ isFile: () => true, isSymbolicLink: () => false })
};
assert.deepEqual(resolveScoLaunchPath(fakePackageRoot, manifest(resource("custom/launch.html")), launchOptions), {
  href: "custom/launch.html",
  filePath: launchFile,
  urlPath: "/custom/launch.html"
}, "browser navigation comes from the unique SCO manifest href");
for (const unsafeHref of ["../launch.html", "/launch.html", "https://example.test/launch.html", "custom\\launch.html", "custom/%2e%2e/launch.html", "custom/launch.html?mode=test"]) {
  assert.throws(() => resolveScoLaunchPath(fakePackageRoot, manifest(resource(unsafeHref)), launchOptions), /Unsafe SCO launch href/, `unsafe SCO href is rejected: ${unsafeHref}`);
}
assert.throws(() => resolveScoLaunchPath(fakePackageRoot, manifest(resource("missing.html")), {
  realpathSync: () => { const error = new Error("missing"); error.code = "ENOENT"; throw error; },
  lstatSync: launchOptions.lstatSync
}), /does not exist/, "missing SCO launch file fails the artifact gate");
assert.throws(() => resolveScoLaunchPath(fakePackageRoot, manifest(`${resource("one.html")}${resource("two.html")}`), launchOptions), /exactly one SCO resource; found 2/, "ambiguous SCO resources fail the artifact gate");
assert.throws(() => resolveScoLaunchPath(fakePackageRoot, manifest(resource("asset.html", "asset")), launchOptions), /exactly one SCO resource; found 0/, "manifest without a SCO resource fails the artifact gate");
assert.throws(() => resolveScoLaunchPath(fakePackageRoot, manifest('<resource adlcp:scormtype="sco"></resource>'), launchOptions), /non-empty href/, "SCO resource without href fails the artifact gate");
assert.throws(() => resolveScoLaunchPath(fakePackageRoot, manifest(resource("custom/launch.html")), {
  ...launchOptions,
  lstatSync: () => ({ isFile: () => false, isSymbolicLink: () => false })
}), /not a regular file/, "SCO href must resolve to a regular file");

const fakeTemp = path.resolve(path.sep, "safe-temp");
const ownedProfile = path.join(fakeTemp, "simlab-position-time-chrome-Ab12cd");
const directoryStat = { isDirectory: () => true, isSymbolicLink: () => false };
const fakeFileSystem = { realpathSync: (value) => path.resolve(value), lstatSync: () => directoryStat };
assert.equal(validateOwnedProfile(ownedProfile, fakeTemp, fakeFileSystem), ownedProfile, "exact generated profile is accepted");
assert.throws(() => validateOwnedProfile(path.join(fakeTemp, "some-other-profile"), fakeTemp, fakeFileSystem), /Refusing to remove unowned/, "unrelated temp directory is rejected");
assert.throws(() => validateOwnedProfile(path.join(fakeTemp, "nested", "simlab-position-time-chrome-Ab12cd"), fakeTemp, fakeFileSystem), /Refusing to remove unowned/, "nested broad target is rejected");
assert.throws(() => validateOwnedProfile(ownedProfile, fakeTemp, { ...fakeFileSystem, lstatSync: () => ({ isDirectory: () => true, isSymbolicLink: () => true }) }), /not a real directory/, "symlink profile target is rejected");
const ownedPackage = path.join(fakeTemp, "simlab-position-time-package-Xy98zz");
assert.equal(validateOwnedDirectory(ownedPackage, fakeTemp, /^simlab-position-time-package-[A-Za-z0-9]+$/, "SCORM package", fakeFileSystem), ownedPackage, "exact generated package directory is accepted");
assert.throws(() => validateOwnedDirectory(path.join(fakeTemp, "other-package"), fakeTemp, /^simlab-position-time-package-[A-Za-z0-9]+$/, "SCORM package", fakeFileSystem), /unowned SCORM package/, "unrelated package directory is rejected");

await assert.rejects(withTimeout(new Promise(() => {}), 10, "test operation"), /test operation timed out/, "bounded operations cannot hang forever");

class FakeWebSocket {
  constructor() {
    this.readyState = 0;
    this.listeners = new Map();
    this.sent = [];
    FakeWebSocket.instance = this;
  }
  addEventListener(type, handler) { (this.listeners.get(type) || this.listeners.set(type, []).get(type)).push(handler); }
  emit(type, data) { for (const handler of this.listeners.get(type) || []) handler({ data }); }
  send(message) { this.sent.push(JSON.parse(message)); }
  close() { this.readyState = 3; this.emit("close"); }
}

const closedClient = new CdpClient("ws://test", FakeWebSocket, 100);
FakeWebSocket.instance.readyState = 1;
FakeWebSocket.instance.emit("open");
const pendingOnClose = closedClient.send("Runtime.evaluate");
await new Promise(setImmediate);
FakeWebSocket.instance.readyState = 3;
FakeWebSocket.instance.emit("close");
await assert.rejects(pendingOnClose, /WebSocket closed/, "socket close rejects pending CDP commands");

const erroredClient = new CdpClient("ws://test", FakeWebSocket, 100);
FakeWebSocket.instance.readyState = 1;
FakeWebSocket.instance.emit("open");
const pendingOnError = erroredClient.send("Page.navigate");
await new Promise(setImmediate);
FakeWebSocket.instance.emit("error");
await assert.rejects(pendingOnError, /WebSocket failed/, "socket error rejects pending CDP commands");

const timedClient = new CdpClient("ws://test", FakeWebSocket, 10);
FakeWebSocket.instance.readyState = 1;
FakeWebSocket.instance.emit("open");
await assert.rejects(timedClient.send("Page.enable"), /CDP Page.enable timed out/, "every CDP command has a bounded timeout");
timedClient.close();

class FakeChild extends EventEmitter {
  constructor() { super(); this.exitCode = null; this.signalCode = null; this.kills = []; }
  kill(signal) { this.kills.push(signal); return true; }
}
const gracefulChild = new FakeChild();
const gracefulCdp = { calls: [], async send(method) { this.calls.push(method); gracefulChild.exitCode = 0; gracefulChild.emit("exit", 0); } };
await stopChrome(gracefulChild, gracefulCdp);
assert.deepEqual(gracefulCdp.calls, ["Browser.close"], "cleanup first requests CDP Browser.close");
assert.deepEqual(gracefulChild.kills, [], "graceful browser exit needs no kill fallback");
assert.equal(childHasExited(gracefulChild), true);

const fallbackChild = new FakeChild();
fallbackChild.kill = function (signal) { this.kills.push(signal); this.signalCode = signal; return true; };
let fallbackWaits = 0;
await stopChrome(fallbackChild, { async send() { throw new Error("CDP unavailable"); } }, {
  waitForExit: async (child) => {
    fallbackWaits += 1;
    if (fallbackWaits === 1) throw new Error("graceful timeout");
    assert.equal(childHasExited(child), true);
  }
});
assert.deepEqual(fallbackChild.kills, ["SIGTERM"], "failed graceful close uses bounded terminate fallback");

const cleanupCalls = [];
const cleanupCdp = { close() { cleanupCalls.push("cdp-close"); } };
await assert.rejects(cleanupResources({ chrome: {}, cdp: cleanupCdp, server: {}, profileDirectory: "/exact-profile", tempRoot: "/temp" }, {
  async stopChrome() { cleanupCalls.push("chrome-stop"); throw new Error("stop failed"); },
  async closeServer() { cleanupCalls.push("server-close"); },
  removeOwnedProfile() { cleanupCalls.push("profile-remove"); },
  removeOwnedPackage() { cleanupCalls.push("package-remove"); }
}), (error) => error instanceof AggregateError && /cleanup failed/.test(error.message), "cleanup failures are surfaced as a failed gate");
assert.deepEqual(cleanupCalls, ["chrome-stop", "cdp-close", "server-close", "profile-remove", "package-remove"], "cleanup continues through every owned resource after one failure");

const hangingChild = new FakeChild();
await assert.rejects(waitForChildExit(hangingChild, 10), /timed out/, "child exit wait is bounded");
assert.equal(hangingChild.listenerCount("exit"), 0, "timed-out child wait removes exit listener");
assert.equal(hangingChild.listenerCount("error"), 0, "timed-out child wait removes error listener");

console.log("Position-time browser regression helper checks passed");
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
