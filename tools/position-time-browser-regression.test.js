"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const path = require("node:path");
const fs = require('node:fs'), os = require('node:os');
const {
  CdpClient,
  devToolsPort,
  childHasExited,
  cleanupResources,
  resolvePackageFile,
  resolveScoLaunchPath,
  saveBrowserFailure,
  stopChrome,
  validateOwnedDirectory,
  validateOwnedProfile,
  waitForChildExit,
  waitForCondition,
  withTimeout
} = require("./position-time-browser-regression.js");

(async function () {
const portFixture=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'simlab-devtools-test-'));
const portFile=path.join(portFixture,'DevToolsActivePort'),originalRead=fs.readFileSync;
try {
  fs.writeFileSync(portFile,'12345\n/browser-fixture');let reads=0;
  fs.readFileSync=function(file,...args){if(file===portFile&&reads++===0){const error=new Error('temporary lock');error.code='EBUSY';throw error;}return originalRead.call(fs,file,...args);};
  assert.equal(await devToolsPort(portFixture,{exitCode:null}),12345);assert.equal(reads,2,'transient Windows lock retries the same port file');
  fs.readFileSync=function(file,...args){if(file===portFile){const error=new Error('permission');error.code='EACCES';throw error;}return originalRead.call(fs,file,...args);};
  await assert.rejects(devToolsPort(portFixture,{exitCode:null}),error=>error.code==='EACCES');
  const originalTimeout=global.setTimeout;
  try {
    let lateReads=0;
    global.setTimeout=callback=>{queueMicrotask(callback);return 0;};
    fs.readFileSync=function(file,...args){if(file===portFile&&lateReads++<240){const error=new Error('Chrome is still starting');error.code='ENOENT';throw error;}return originalRead.call(fs,file,...args);};
    assert.equal(await devToolsPort(portFixture,{exitCode:null}),12345,'a slow Chrome launch can become ready beyond the former startup limit');
    await assert.rejects(devToolsPort(portFixture,{exitCode:1}),/Chrome exited before CDP became ready/,'an exited browser still fails immediately');
    await assert.rejects(devToolsPort(portFixture,{exitCode:null,signalCode:'SIGTRAP'}),/signal SIGTRAP/,'a fatal sandbox signal fails immediately instead of waiting for a missing port');
  } finally {global.setTimeout=originalTimeout;}
} finally {fs.readFileSync=originalRead;const safe=validateOwnedDirectory(portFixture,os.tmpdir(),/^simlab-devtools-test-[A-Za-z0-9]+$/,'startup test fixture');fs.rmSync(safe,{recursive:true,force:false});}
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

let conditionCalls=0;
await waitForCondition(async()=>++conditionCalls===3,'initialization',1000,1);
assert.equal(conditionCalls,3,'unready checks can become ready');
const navigationError=new Error('Runtime.evaluate: Cannot find context with specified id');
conditionCalls=0;
await waitForCondition(async()=>{if(++conditionCalls===1)throw navigationError;return true;},'navigation',1000,1);
assert.equal(conditionCalls,2,'navigation context replacement is transient');
for(const message of ['CDP Runtime.evaluate timed out after 15000 ms.','Chrome DevTools WebSocket closed.','TypeError: broken activity','AssertionError: wrong answer']){
  const fatal=new Error(message);conditionCalls=0;
  await assert.rejects(waitForCondition(async()=>{conditionCalls++;throw fatal;},'fatal',1000,1),error=>error===fatal);
  assert.equal(conditionCalls,1,'fatal errors are not polled or replaced');
}
await assert.rejects(waitForCondition(()=>new Promise(()=>{}),'hung evaluation',20,1),/hung evaluation timed out/,'one hung evaluation cannot exceed the overall deadline');
conditionCalls=0;
await assert.rejects(waitForCondition(async()=>{conditionCalls++;await new Promise(r=>setTimeout(r,15));return false;},'slow evaluation',40,1),/slow evaluation timed out/);
assert(conditionCalls<=3,'evaluation time counts towards the deadline');
await assert.rejects(waitForCondition(async()=>{throw navigationError;},'navigation never finished',20,1),error=>/navigation never finished timed out/.test(error.message)&&error.cause===navigationError,'the last navigation error is preserved at the deadline');

const failureDirectory=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'simlab-failure-test-'));
try {
  const originalFailure=new Error('Expected check mode, got edit'),details={source:'zip',selector:'#check'};
  const failureCdp={async send(method){return method==='Runtime.evaluate'?{result:{value:{mode:'edit',events:['pointerup']}}}:{data:Buffer.from('screenshot fixture').toString('base64')};}};
  await saveBrowserFailure(failureCdp,failureDirectory,originalFailure,details,'fixture');
  let saved=JSON.parse(fs.readFileSync(path.join(failureDirectory,'failure.json'),'utf8'));
  assert(saved.error.includes(originalFailure.message));assert.deepEqual(saved.details,details);
  assert.equal(saved.state.mode,'edit');assert.equal(saved.screenshot,'failure.png');assert.deepEqual(saved.diagnosticErrors,[]);
  assert.equal(fs.readFileSync(path.join(failureDirectory,'failure.png'),'utf8'),'screenshot fixture');
  await saveBrowserFailure({async send(method){if(method==='Runtime.evaluate')throw Error('context gone');return failureCdp.send(method);}},failureDirectory,originalFailure,details,'fixture');
  saved=JSON.parse(fs.readFileSync(path.join(failureDirectory,'failure.json'),'utf8'));
  assert(saved.error.includes(originalFailure.message)&&saved.diagnosticErrors.some(e=>e.includes('context gone'))&&saved.screenshot,'one failed probe keeps the original assertion and other evidence');
  await saveBrowserFailure({send:()=>new Promise(()=>{})},failureDirectory,originalFailure,details,'fixture');
  saved=JSON.parse(fs.readFileSync(path.join(failureDirectory,'failure.json'),'utf8'));
  assert.equal(saved.diagnosticErrors.length,2);assert(saved.diagnosticErrors.every(e=>e.includes('timed out after 2000 ms')));
  assert(saved.error.includes(originalFailure.message));assert.equal(saved.screenshot,undefined,'an older screenshot is never attributed to this failed capture');
  const originalConsole=console.error;let diagnostic;
  try{console.error=(...args)=>{diagnostic=args.join(' ');};await saveBrowserFailure(failureCdp,path.join(failureDirectory,'missing'),originalFailure,details,'fixture');}
  finally{console.error=originalConsole;}
  assert(diagnostic.includes('Could not save browser failure evidence'),'artifact write failure is reported without throwing over the original assertion');
} finally {
  const safe=validateOwnedDirectory(failureDirectory,os.tmpdir(),/^simlab-failure-test-[A-Za-z0-9]+$/,'failure diagnostic fixture');fs.rmSync(safe,{recursive:true,force:false});
}

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

const eventClient = new CdpClient("ws://test", FakeWebSocket, 100);
FakeWebSocket.instance.readyState = 1;
FakeWebSocket.instance.emit("open");
let consoleEvent;
eventClient.on("Runtime.consoleAPICalled", (params) => { consoleEvent = params; });
FakeWebSocket.instance.emit("message", JSON.stringify({ method: "Runtime.consoleAPICalled", params: { type: "error" } }));
assert.deepEqual(consoleEvent, { type: "error" }, "CDP event listeners receive browser console/page events");
eventClient.close();

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
