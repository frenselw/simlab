"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const dir=__dirname,html=fs.readFileSync(path.join(dir,"index.html"),"utf8"),main=fs.readFileSync(path.join(dir,"main.js"),"utf8"),css=fs.readFileSync(path.join(dir,"styles.css"),"utf8");
for(const marker of ["data-sim-fullscreen-target","data-sim-fullscreen","id=\"checkButton\"","id=\"submitButton\"","id=\"motionSvg\"","data-case=\"coaxial\"","data-case=\"belt\""])assert.ok(html.includes(marker),marker);
for(const call of ["Scorm.loadAttempt(","Flow.startup(","Scorm.setDraftProvider(","Scorm.submitWithCallbacks(","Flow.submission(","Scorm.retryPending(","Scorm.quarantinePending("])assert.ok(main.includes(call),call);
for(const marker of ["overscroll-behavior:contain","touch-action:pan-y","min-height:44px","@media(max-height:380px)"])assert.ok(css.includes(marker),marker);
assert.ok(!/localStorage|sessionStorage|LMSSetValue|addEventListener\("pagehide"/.test(main));
console.log("Circular speed runtime wiring and phone layout contract passed");
