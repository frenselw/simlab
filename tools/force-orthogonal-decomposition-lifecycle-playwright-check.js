async page => {
const assert = (value, message) => { if (!value) throw new Error(message); };
const wait = milliseconds => page.waitForTimeout(milliseconds);
const origin = page.url().match(/^https?:\/\/[^/]+/)?.[0] || "";
assert(origin.startsWith("http://127.0.0.1:"), `unexpected origin: ${origin}`);

const activityPath = "/sim/force-orthogonal-decomposition/index.html";
const hostPath = "/tools/force-orthogonal-decomposition-embedded-host.html";
await page.waitForFunction(() => Boolean(window.ForceOrthogonalDecompositionModel && window.ForceOrthogonalDecompositionPersistence && window.ForceOrthogonalDecompositionScoring));
await page.addInitScript(() => {
  const query = new URL(location.href).searchParams;
  if (location.pathname.endsWith("/sim/force-orthogonal-decomposition/index.html") && query.get("storage") === "denied") {
    try {
      Object.defineProperty(window, "localStorage", {
        configurable: false,
        get() { throw new DOMException("localStorage denied for test", "SecurityError"); }
      });
    } catch (_) { /* the browser may expose a non-configurable storage property */ }
  }
});
const completeDraftJson = await page.evaluate(() => {
  const M = window.ForceOrthogonalDecompositionModel;
  const P = window.ForceOrthogonalDecompositionPersistence;
  const draft = P.freshDraft();
  draft.phase = "summary";
  draft.questions = draft.questions.map((original, index) => {
    const scene = M.getScenario(original.scenarioId);
    const directions = scene.axes.map((axis, axisIndex) => ({ key: `D${axisIndex + 1}`, unit: { ...axis.unit }, axis: axis.key, axisKey: axis.key }));
    const perpendiculars = scene.axes.map((axis, axisIndex) => ({ key: `P${axisIndex + 1}`, end: M.projectionFoot(scene.forceHead, axis, scene), targetKey: `D${axisIndex + 1}` }));
    const intersections = M.visibleIntersections(perpendiculars, directions, scene);
    const components = scene.axes.map((axis, axisIndex) => {
      const match = intersections.find(item => item.directionKey === `D${axisIndex + 1}`);
      return { key: `F${axisIndex + 1}`, end: { ...match.point }, targetKey: match.key };
    });
    const theta = M.thetaCandidates(directions, scene)[0]?.key || null;
    const question = { ...original, phase: "formulas", directions, perpendiculars, components, theta, formulas: { F1: null, F2: null } };
    const expectations = M.formulaExpectations(question);
    question.formulas = Object.fromEntries(expectations.map(item => [item.key, item.value]));
    return question;
  });
  return JSON.stringify(P.makeSnapshot("draft", draft));
});
const freeThetaDraftJson = await page.evaluate(draftJson => {
  const draft = JSON.parse(draftJson);
  draft.answer.questions[0].theta = null;
  draft.answer.questions[0].thetaPoint = { x: 120, y: -40 };
  return JSON.stringify(draft);
}, completeDraftJson);
const noThetaDraftJson = await page.evaluate(draftJson => {
  const draft = JSON.parse(draftJson);
  // The third question keeps its fixed incline θ, but has no student theta
  // key and no free thetaPoint. Review must not invent a second label.
  draft.answer.questions[2].theta = null;
  draft.answer.questions[2].thetaPoint = null;
  return JSON.stringify(draft);
}, completeDraftJson);
const frameForHost = async label => {
  let frame = null;
  for (let attempt = 0; attempt < 30 && !frame; attempt += 1) {
    frame = page.frames().find(item => item !== page.mainFrame() && item.url().includes("force-orthogonal-decomposition/index.html")) || null;
    if (!frame) await wait(100);
  }
  assert(frame, `${label}: production activity iframe did not load`);
  try { await frame.waitForFunction(() => Boolean(window.__forceOrthogonalApp?.getState()), { timeout: 10000 }); }
  catch (error) { throw new Error(`${label}: production app startup failed url=${frame.url()}: ${error.message}`); }
  return frame;
};
const runtime = frame => frame.evaluate(() => window.__forceOrthogonalApp.getRuntimeState());
const appState = frame => frame.evaluate(() => window.__forceOrthogonalApp.getState());
const parentState = () => page.evaluate(() => ({ data: { ...window.__lmsMock.data }, commitCount: window.__lmsMock.commitCount, finishCount: window.__lmsMock.finishCount }));
const reloadActivityFrame = async () => { await page.locator("iframe").evaluate(node => { node.src = node.src; }); await wait(120); };
const click = async (frame, selector) => {
  const locator = frame.locator(selector).first();
  try { await locator.scrollIntoViewIfNeeded(); await locator.click(); await wait(80); }
  catch (error) {
    throw new Error(`production click ${selector} failed runtime=${await runtime(frame)} activity=${JSON.stringify(await frame.evaluate(() => window.__forceOrthogonalApp.getActivityState?.()))} state=${JSON.stringify(await appState(frame))} dom=${JSON.stringify(await frame.evaluate(sel => { const node = document.querySelector(sel); const panel = document.querySelector("#forcePanel"); const summary = document.querySelector("#summaryPanel"); return { node: node ? { hidden: node.hidden, disabled: node.disabled, rect: node.getBoundingClientRect().toJSON(), display: getComputedStyle(node).display } : null, panel: panel?.getBoundingClientRect().toJSON(), panelScrollTop: panel?.scrollTop, summaryVisible: !summary?.classList.contains("is-hidden"), summaryRect: summary?.getBoundingClientRect().toJSON() }; }, selector))}: ${error.message}`);
  }
};
const waitForRuntime = async (frame, expected, label) => {
  try { await frame.waitForFunction(value => window.__forceOrthogonalApp?.getRuntimeState() === value, expected, { timeout: 10000 }); }
  catch (error) { throw new Error(`${label}: expected runtime ${expected}, actual ${await runtime(frame)}, state=${JSON.stringify(await appState(frame))}: ${error.message}`); }
};

async function openHost(mode = "success", seed = "", lifecycleSeed = null, label = `${mode}/${seed || "none"}`, storageDenied = false) {
  // The fixture consumes one deterministic seed from the parent session
  // storage before it creates the parent LMS mock. This avoids relying on
  // init-script ordering across repeated scenario navigations.
  await page.evaluate(seedJson => {
    if (seedJson) sessionStorage.setItem("simlab:lifecycle-seed", seedJson);
    else sessionStorage.removeItem("simlab:lifecycle-seed");
  }, JSON.stringify(lifecycleSeed));
  const src = `${activityPath}?lifecycle=${Date.now()}-${Math.random()}${storageDenied ? "&storage=denied" : ""}`;
  const query = `src=${encodeURIComponent(src)}&mode=${encodeURIComponent(mode)}&w=390&h=500${seed ? `&seed=${encodeURIComponent(seed)}` : ""}`;
  await page.goto(`${origin}${hostPath}?${query}`);
  return frameForHost(label);
}

const submitPopulated = async (frame, label) => {
  const activity = await frame.evaluate(() => window.__forceOrthogonalApp.getActivityState());
  assert(activity.phase === "summary", `${label}: seeded production activity did not restore summary phase`);
  await frame.evaluate(() => {
    const panel = document.querySelector("#forcePanel");
    const button = document.querySelector("#submitAttempt");
    if (panel && button) panel.scrollTop = Math.max(0, button.offsetTop - 8);
  });
  assert(await frame.locator("#submitAttempt").count() === 1, `${label}: submit button is missing`);
  assert(await frame.locator("#submitAttempt").isEnabled(), `${label}: submit button is disabled`);
  await frame.locator("#submitAttempt").click();
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const state = await runtime(frame);
    if (["review", "frozen", "editable", "quarantined"].includes(state)) return state;
    await wait(50);
  }
  throw new Error(`${label}: submit did not reach a rendered lifecycle state`);
};
const assertReviewLock = async (frame, label) => {
  assert(await runtime(frame) === "review", `${label}: runtime is not review-only`);
  assert(await frame.locator("#reviewPanel").isVisible(), `${label}: review panel is not visible`);
  assert(!(await frame.locator("#practicePanel").isVisible()), `${label}: practice panel remained editable`);
  assert(!(await frame.locator("#summaryPanel").isVisible()), `${label}: summary panel remained active`);
  await assertStageLocked(frame, label);
};
const assertStageLocked = async (frame, label) => {
  const before = await appState(frame);
  const lock = await frame.evaluate(() => {
    const selectors = ["#originHit", "#pointHit", "#thetaHit", "#directionEdit0", "#directionEdit1", "#perpendicularEdit0", "#perpendicularEdit1", "#componentEdit0", "#componentEdit1"];
    const controls = selectors.map(selector => {
      const node = document.querySelector(selector);
      return { selector, hidden: Boolean(node?.hidden), disabled: Boolean(node?.disabled) };
    });
    const navigation = ["#stageBackButton", "#stageNextButton", "#backButton", "#redrawButton", "#nextButton", "#resetButton", "#goSummary"]
      .map(selector => ({ selector, disabled: Boolean(document.querySelector(selector)?.disabled) }));
    const targets = selectors.map(selector => document.querySelector(selector)).filter(Boolean);
    targets.forEach(target => {
      target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 77, pointerType: "mouse", button: 0, clientX: 120, clientY: 120 }));
      target.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 77, pointerType: "mouse", clientX: 260, clientY: 220 }));
      target.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 77, pointerType: "mouse", button: 0, clientX: 260, clientY: 220 }));
    });
    document.querySelector("#stageNextButton")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return { controls, navigation, runtimeState: document.querySelector("#stage")?.dataset.runtimeState };
  });
  await wait(80);
  const after = await appState(frame);
  assert(lock.runtimeState === "review" || lock.runtimeState === "frozen" || lock.runtimeState === "quarantined", `${label}: stage runtime lock marker is missing`);
  assert(lock.controls.every(item => item.hidden && item.disabled), `${label}: a stage drag target remained active: ${JSON.stringify(lock.controls)}`);
  assert(lock.navigation.every(item => item.disabled), `${label}: a stage navigation control remained active: ${JSON.stringify(lock.navigation)}`);
  assert(JSON.stringify(after) === JSON.stringify(before), `${label}: stage interaction changed the locked answer`);
};

// Success and review-lock persistence.
let frame = await openHost("success", "complete-draft", { suspendData: completeDraftJson, status: "incomplete", score: "" }, "success");
assert((await submitPopulated(frame, "success")) === "review", "success: production submit did not finish");
await assertReviewLock(frame, "success");
assert((await frame.locator("#reviewCompletion").textContent()).includes("已提交"), "success: rendered completion status is missing");
assert(await frame.locator('#diagram [data-label="student-theta"]').count() === 1, "success: submitted theta label remains visible in review");
assert(await frame.locator("#thetaHit").isHidden(), "success: interactive theta hit target is hidden in review");
assert((await frame.locator("#sceneTitle").textContent()).includes("水平／垂直分解"), "success: review stage title matches the first submitted question");
assert((await frame.locator("#sceneKind").textContent()).includes("固定原力"), "success: review stage context matches the first submitted question");
assert((await frame.locator("#stageStepLabel").textContent()).trim() === "唯讀", "success: review stage step is labelled read-only");
await click(frame, '#reviewQuestionNavigation [data-question-index="2"]');
assert((await frame.locator("#sceneTitle").textContent()).includes("斜面上的重力"), "success: switching review question updates the stage title");
assert((await frame.locator("#sceneKind").textContent()).includes("斜面傾角 θ 已給定"), "success: switching review question updates the stage context");
assert(await frame.locator('#diagram [data-label="student-theta"]').count() === 1, "success: switched review question retains its theta label");
const successData = await parentState();
assert(successData.data["cmi.core.lesson_status"] === "passed", "success: LMS status was not passed");
await reloadActivityFrame();
frame = await frameForHost("success reload");
await assertReviewLock(frame, "success reload");

// A free, unsnapped thetaPoint is also learner data. Review must render its
// label even though there is no matching arc candidate or interactive button.
frame = await openHost("success", "complete-draft", { suspendData: freeThetaDraftJson, status: "incomplete", score: "" }, "free theta review");
assert((await submitPopulated(frame, "free theta review")) === "review", "free theta review: production submit did not finish");
await assertReviewLock(frame, "free theta review");
assert(await frame.locator('#diagram [data-label="student-theta"]').count() === 1, "free theta review: free thetaPoint label remains visible");
assert(await frame.locator("#thetaHit").isHidden(), "free theta review: interactive theta hit target is hidden");

// A submitted third question without any learner theta must keep only the
// fixed incline marker. It must not render a fabricated student-theta label.
frame = await openHost("success", "complete-draft", { suspendData: noThetaDraftJson, status: "incomplete", score: "" }, "missing third-question theta review");
// Bypass the browser-native confirmation in this intentionally incomplete
// fixture. The assertion below is about the persisted/reviewed geometry, not
// about the confirmation dialog itself.
await frame.evaluate(() => { window.confirm = () => true; });
assert((await submitPopulated(frame, "missing third-question theta review")) === "review", "missing third-question theta review: production submit did not finish");
await assertReviewLock(frame, "missing third-question theta review");
await click(frame, '#reviewQuestionNavigation [data-question-index="2"]');
assert(await frame.locator('#diagram [data-label="student-theta"]').count() === 0, "missing third-question theta review: no student theta is fabricated");
assert(await frame.locator('[data-label="given-slope-theta"]').count() === 1, "missing third-question theta review: fixed incline theta remains visible");

// localStorage is intentionally denied in this LMS-frame scenario. The SCORM
// API still commits the draft, so the UI must report an LMS save rather than a
// standalone memory-only attempt.
frame = await openHost("success", "complete-draft", { suspendData: completeDraftJson, status: "incomplete", score: "" }, "SCORM save with denied localStorage", true);
const deniedStorageStatus = await frame.locator("#attemptStatus").textContent();
assert(!deniedStorageStatus.includes("只保留本頁") && !deniedStorageStatus.includes("本機儲存不可用"), "SCORM save with denied localStorage: status does not falsely claim memory-only persistence");
await click(frame, '#summaryList [data-edit-question="0"]');
assert((await frame.locator("#attemptStatus").textContent()).includes("草稿已保存"), "SCORM save with denied localStorage: successful LMS draft save is reported");
assert((await parentState()).data["cmi.suspend_data"].includes('"kind":"draft"'), "SCORM save with denied localStorage: LMS draft checkpoint was committed");

// Repeated LMSFinish failures remain a committed, review-locked result. The
// finish-only retry survives review-question navigation and eventually
// succeeds without rewriting the committed payload or score/status.
frame = await openHost("committed", "complete-draft", { suspendData: completeDraftJson, status: "incomplete", score: "" }, "committed finish failure");
assert((await submitPopulated(frame, "committed")) === "review", "committed: review was not rendered");
assert(await frame.locator("#reviewActions button").count() === 1, "committed: finish retry action is missing");
assert((await frame.locator("#reviewActions button").textContent()).includes("重試完成"), "committed: finish retry label is missing");
const committedData = await parentState();
await click(frame, '#reviewQuestionNavigation [data-question-index="1"]');
assert(await frame.locator("#reviewActions button").count() === 1, "committed: finish retry was lost during review navigation");
await click(frame, "#reviewActions button");
await wait(100);
assert(await runtime(frame) === "review", "committed: repeated finish failure left review lock");
assert(await frame.locator("#reviewActions button").count() === 1, "committed: finish-only retry was lost after repeated failure");
assert((await parentState()).finishCount === 2, "committed: LMSFinish was not retried twice");
const afterSecondFinishFailure = await parentState();
for (const key of ["cmi.suspend_data", "cmi.core.lesson_status", "cmi.core.score.raw"]) {
  assert(afterSecondFinishFailure.data[key] === committedData.data[key], `committed: ${key} changed during finish-only retry`);
}
await click(frame, '#reviewQuestionNavigation [data-question-index="2"]');
assert(await frame.locator("#reviewActions button").count() === 1, "committed: finish retry was lost during second review navigation");
await click(frame, "#reviewActions button");
await wait(100);
assert(await frame.locator("#reviewActions button").count() === 0, "committed: finish retry did not clear after LMSFinish succeeded");
assert((await parentState()).finishCount === 3, "committed: LMSFinish did not succeed on the third attempt");

// Final LMSCommit failure freezes the immutable pending submission; reload
// restores the same pending state, and only the rendered retry can finish it.
frame = await openHost("frozen", "complete-draft", { suspendData: completeDraftJson, status: "incomplete", score: "" }, "frozen final commit");
assert((await submitPopulated(frame, "frozen")) === "frozen", "frozen: final commit failure did not render frozen state");
assert((await frame.locator("#technicalTitle").textContent()).includes("提交狀態未確認"), "frozen: technical title is missing");
await assertStageLocked(frame, "frozen");
assert(await frame.locator("#technicalActions button").count() === 1, "frozen: retry action is missing");
assert((await parentState()).data["cmi.suspend_data"].includes("pending-final"), "frozen: durable pending envelope was not preserved");
await reloadActivityFrame();
frame = await frameForHost("frozen reload");
await waitForRuntime(frame, "frozen", "frozen reload");
await click(frame, "#technicalActions button");
await waitForRuntime(frame, "review", "frozen retry");
await assertReviewLock(frame, "frozen retry");

// Retryable precommit failure: the pending checkpoint itself fails once and
// is retried from the production technical action.
frame = await openHost("retryable", "complete-draft", { suspendData: completeDraftJson, status: "incomplete", score: "" }, "retryable precommit");
assert((await submitPopulated(frame, "retryable")) === "frozen", "retryable: failed checkpoint did not freeze");
await click(frame, "#technicalActions button");
await waitForRuntime(frame, "review", "retryable checkpoint retry");
await assertReviewLock(frame, "retryable checkpoint retry");

// Non-retryable preflight result keeps the learner editable and renders the
// preflight message; it must not be presented as a failed or submitted score.
frame = await openHost("success", "complete-draft", { suspendData: completeDraftJson, status: "incomplete", score: "" }, "nonretryable preflight");
assert((await frame.evaluate(() => window.__forceOrthogonalApp.getActivityState())).phase === "summary", "nonretryable preflight: seeded summary was not restored");
await frame.evaluate(() => {
  const panel = document.querySelector("#forcePanel");
  const button = document.querySelector("#submitAttempt");
  if (panel && button) panel.scrollTop = Math.max(0, button.offsetTop - 8);
});
await frame.evaluate(() => {
  window.SimScorm.submitWithCallbacks = () => ({ ok: false, retryable: false, committed: false, frozen: false, activityState: "retry", reason: "preflight" });
});
await frame.locator("#submitAttempt").click();
assert(await runtime(frame) === "editable", "nonretryable preflight: activity did not remain editable");
assert(await frame.locator("#summaryPanel").isVisible(), "nonretryable preflight: summary was hidden");
assert(await frame.locator("#submitAttempt").isEnabled(), "nonretryable preflight: submit remained locked");
assert((await frame.locator("#submitStatus").textContent()).includes("提交前檢查"), "nonretryable preflight: rendered message is missing");

// Structurally parseable but activity-invalid pending data is quarantined on
// startup. Reload and unload do not expose a retry or commit it.
frame = await openHost("success", "invalid-pending", null, "invalid nested pending");
await waitForRuntime(frame, "quarantined", "invalid nested pending");
await assertStageLocked(frame, "invalid nested pending");
assert(await frame.locator("#technicalActions button").count() === 0, "invalid nested pending: retry action was exposed");
const invalidBefore = await parentState();
await reloadActivityFrame();
frame = await frameForHost("invalid nested pending reload");
await waitForRuntime(frame, "quarantined", "invalid nested pending reload");
await assertStageLocked(frame, "invalid nested pending reload");
assert(await frame.locator("#technicalActions button").count() === 0, "invalid nested pending reload: retry action was exposed");
assert((await parentState()).commitCount === invalidBefore.commitCount, "invalid nested pending: unload/reload committed quarantined data");

// Finished attempts without a score and with a mismatching valid review show
// only the safe recorded summary and remain review-only.
frame = await openHost("success", "finished-missing", null, "finished missing score");
await waitForRuntime(frame, "review", "finished missing score");
assert((await frame.locator("#reviewCompletion").textContent()).includes("只顯示已記錄摘要"), "finished missing score: safe summary label is missing");
assert((await frame.locator("#reviewScore").textContent()).trim() === "--", "finished missing score: missing score was not rendered as unknown");
await assertReviewLock(frame, "finished missing score");

const mismatchedReview = JSON.parse(successData.data["cmi.suspend_data"]);
mismatchedReview.score = mismatchedReview.score === 100 ? 99 : mismatchedReview.score + 1;
mismatchedReview.passed = !mismatchedReview.passed;
frame = await openHost("success", "finished-mismatch", { suspendData: JSON.stringify(mismatchedReview), score: successData.data["cmi.core.score.raw"] }, "finished mismatch");
await waitForRuntime(frame, "review", "finished mismatch");
assert((await frame.locator("#reviewCompletion").textContent()).includes("只顯示已記錄摘要"), "finished mismatch: safe summary label is missing");
assert((await frame.locator("#reviewTrustNote").textContent()).includes("摘要"), "finished mismatch: trust warning is missing");
await assertReviewLock(frame, "finished mismatch");

console.log("force orthogonal production lifecycle browser checks passed: success, committed, frozen/reload, retryable precommit, nonretryable preflight, invalid pending quarantine, finished fallback, and review lock");
}
