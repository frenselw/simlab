async page => {
const assert = (value, message) => { if (!value) throw new Error(message); };
const wait = milliseconds => page.waitForTimeout(milliseconds);
const origin = page.url().match(/^https?:\/\/[^/]+/)?.[0] || "";
assert(origin.startsWith("http://127.0.0.1:"), `unexpected origin: ${origin}`);

const activityPath = await page.evaluate(() => location.pathname.startsWith("/packaged/")
  ? "/packaged/force-orthogonal-decomposition/index.html" : "/sim/force-orthogonal-decomposition/index.html");
const hostPath = "/tools/force-orthogonal-decomposition-embedded-host.html";
await page.waitForFunction(() => Boolean(window.ForceOrthogonalDecompositionModel && window.ForceOrthogonalDecompositionPersistence && window.ForceOrthogonalDecompositionScoring));
await page.addInitScript(() => {
  const query = new URL(location.href).searchParams;
  if (location.pathname.endsWith("/force-orthogonal-decomposition/index.html") && query.get("storage") === "denied") {
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
const incompleteDraftJson = await page.evaluate(draftJson => {
  const snapshot = JSON.parse(draftJson);
  const question = snapshot.answer.questions[1];
  question.phase = "directions";
  question.directions = [];
  question.perpendiculars = [];
  question.components = [];
  question.theta = null;
  question.thetaPoint = null;
  question.formulas = { F1: null, F2: null };
  return JSON.stringify(snapshot);
}, completeDraftJson);
const wrongFormulaDraftJson = await page.evaluate(draftJson => {
  const M = window.ForceOrthogonalDecompositionModel;
  const draft = JSON.parse(draftJson);
  const question = draft.answer.questions[0];
  const expectation = M.formulaExpectations(question)[0];
  question.formulas[expectation.key] = expectation.value === "sin" ? "cos" : "sin";
  return JSON.stringify(draft);
}, completeDraftJson);
const freeThetaDraftJson = await page.evaluate(draftJson => {
  const draft = JSON.parse(draftJson);
  draft.answer.questions[0].theta = null;
  draft.answer.questions[0].thetaPoint = { x: 120, y: -40 };
  return JSON.stringify(draft);
}, completeDraftJson);
const freeGravityThetaDraftJson = await page.evaluate(draftJson => {
  const draft = JSON.parse(draftJson);
  draft.answer.questions[2].theta = null;
  draft.answer.questions[2].thetaPoint = { x: 120, y: 20 };
  return JSON.stringify(draft);
}, completeDraftJson);
const missingGravityThetaDraftJson = await page.evaluate(draftJson => {
  const draft = JSON.parse(draftJson);
  draft.answer.questions[2].theta = null;
  draft.answer.questions[2].thetaPoint = null;
  return JSON.stringify(draft);
}, completeDraftJson);
const narrowPerpendicularDraftJson = await page.evaluate(() => {
  const M = window.ForceOrthogonalDecompositionModel;
  const P = window.ForceOrthogonalDecompositionPersistence;
  const draft = P.freshDraft();
  const scene = M.getScenario("inclined-external-force");
  draft.currentQuestion = 1;
  draft.questions[1] = {
    ...M.createQuestionState(scene.id),
    phase: "perpendiculars",
    directions: [
      { key: "D1", unit: { x: Math.cos(M.radians(95)), y: Math.sin(M.radians(95)) }, axisKey: null },
      { key: "D2", unit: { x: Math.cos(M.radians(28)), y: Math.sin(M.radians(28)) }, axisKey: null }
    ],
    perpendiculars: [{ key: "P1", end: { x: 270, y: 140 }, targetKey: null }]
  };
  return JSON.stringify(P.makeSnapshot("draft", draft));
});
const invalidEditableDraftJson = await page.evaluate(draftJson => {
  const snapshot = JSON.parse(draftJson);
  const scene = window.ForceOrthogonalDecompositionModel.getScenario("inclined-gravity");
  // This is the persisted shape produced by the old narrow-stage bug: the
  // second gravity perpendicular was saved at P itself.  Keep the envelope
  // parseable so the activity decoder, rather than the shared runtime, owns
  // the recovery decision.
  snapshot.answer.questions[2].perpendiculars[1].end = { ...scene.forceHead };
  snapshot.answer.questions[2].perpendiculars[1].targetKey = null;
  return JSON.stringify(snapshot);
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
const frameDiagramPoint = async (frame, point) => {
  const diagram = await frame.locator("#diagram").evaluate(node => {
    const viewBox = node.viewBox.baseVal;
    const scenarioId = window.__forceOrthogonalApp.getState().scenarioId;
    const origin = scenarioId === "horizontal-vertical" ? { x: 120, y: 280 } : { x: 170, y: 225 };
    return { box: node.getBoundingClientRect().toJSON(), viewBox: { x: viewBox.x, y: viewBox.y, width: viewBox.width, height: viewBox.height }, origin };
  });
  const iframe = await page.locator("iframe").boundingBox();
  assert(diagram && iframe, "narrow edit diagram has a box");
  const scale = Math.min(diagram.box.width / diagram.viewBox.width, diagram.box.height / diagram.viewBox.height);
  return {
    x: iframe.x + diagram.box.x + (diagram.box.width - diagram.viewBox.width * scale) / 2 + (diagram.origin.x + point.x - diagram.viewBox.x) * scale,
    y: iframe.y + diagram.box.y + (diagram.box.height - diagram.viewBox.height * scale) / 2 + (diagram.origin.y - point.y - diagram.viewBox.y) * scale
  };
};
const mouseDragFrameTarget = async (frame, selector, point, label) => {
  const target = await frame.locator(selector).evaluate(node => node.getBoundingClientRect().toJSON());
  const iframe = await page.locator("iframe").boundingBox();
  assert(target && iframe && target.width > 0 && target.height > 0, `${label}: target has a box`);
  const start = { x: iframe.x + target.x + target.width / 2, y: iframe.y + target.y + target.height / 2 };
  const end = await frameDiagramPoint(frame, point);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let index = 1; index <= 12; index += 1) {
    await page.mouse.move(start.x + (end.x - start.x) * index / 12, start.y + (end.y - start.y) * index / 12);
  }
  await page.mouse.up();
  await wait(120);
};

async function openHost(mode = "success", seed = "", lifecycleSeed = null, label = `${mode}/${seed || "none"}`, storageDenied = false, viewportWidth = 390, viewportHeight = 500) {
  // The fixture consumes one deterministic seed from the parent session
  // storage before it creates the parent LMS mock. This avoids relying on
  // init-script ordering across repeated scenario navigations.
  await page.evaluate(seedJson => {
    if (seedJson) sessionStorage.setItem("simlab:lifecycle-seed", seedJson);
    else sessionStorage.removeItem("simlab:lifecycle-seed");
  }, JSON.stringify(lifecycleSeed));
  const src = `${activityPath}?lifecycle=${Date.now()}-${Math.random()}${storageDenied ? "&storage=denied" : ""}`;
  const query = `src=${encodeURIComponent(src)}&mode=${encodeURIComponent(mode)}&w=${viewportWidth}&h=${viewportHeight}${seed ? `&seed=${encodeURIComponent(seed)}` : ""}`;
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
  await frame.evaluate(() => { window.confirm = () => true; });
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
  assert(await frame.evaluate(() => window.__forceOrthogonalApp.getDragPreview() === null), `${label}: an interaction preview survived the review lock`);
  assert(await frame.locator("#touchPreview").isHidden(), `${label}: touch magnifier survived the review lock`);
  const symbols = await frame.evaluate(() => {
    const theta = document.querySelector('#diagram [data-label="student-theta"]');
    const force = document.querySelector('#diagram [data-label="original-force"]');
    return { theta: theta && getComputedStyle(theta).fontSize, force: force && getComputedStyle(force).fontSize,
      hasP: [...document.querySelectorAll("#diagram text")].some(node => node.textContent === "P") };
  });
  assert(!symbols.theta || symbols.theta === symbols.force, `${label}: submitted snapped/free theta shares the force symbol font size`);
  assert(!symbols.hasP, `${label}: submitted drawings do not restore a P label`);
  assert(!/清除|重新開始/.test(await frame.locator("#reviewActions").innerText()), `${label}: review offers a clear/restart action`);
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
  assert(await frame.locator("#touchPreview").isHidden(), `${label}: locked stage opened a touch preview`);
  assert(JSON.stringify(after) === JSON.stringify(before), `${label}: stage interaction changed the locked answer`);
};
const reviewFormulaRows = async (frame, label) => {
  assert(await frame.locator("#reviewFormulaSummary").isVisible(), `${label}: trusted review did not show the formula summary`);
  const rows = await frame.locator("#reviewFormulaRows .review-formula-row").evaluateAll(nodes => nodes.map(node => ({
    key: node.dataset.formulaReviewKey,
    result: node.dataset.result,
    text: node.textContent.trim()
  })));
  assert(rows.length === 2, `${label}: review did not render both submitted formulas ${JSON.stringify(rows)}`);
  assert(rows.every(row => row.text.includes("θ")), `${label}: review formula is not shown in full ${JSON.stringify(rows)}`);
  return rows;
};

// Every saved construction step restores phase-appropriate instructions and
// still has a legal continuation, including a return from the overview.
for (const [index, phase] of ["directions", "perpendiculars", "components", "angle", "formulas"].entries()) {
  const saved = JSON.parse(completeDraftJson);
  saved.answer.phase = "practice";
  saved.answer.fromReview = true;
  saved.answer.currentQuestion = index % 3;
  saved.answer.questions[index % 3].phase = phase;
  const restoredFrame = await openHost("success", "complete-draft", { suspendData: JSON.stringify(saved), status: "incomplete", score: "" }, `restore ${phase}`);
  assert((await appState(restoredFrame)).phase === phase, `restore ${phase}: active step is preserved`);
  const message = await restoredFrame.locator("#interactionStatus").textContent();
  assert(message.includes(`已恢復第 ${index % 3 + 1} 題草稿`) && !message.includes("第 1 條方向虛線"), `restore ${phase}: stale first-step hint ${message}`);
  await click(restoredFrame, phase === "directions" ? "#nextButton" : "#backButton");
  assert((await appState(restoredFrame)).phase !== phase, `restore ${phase}: a legal continuation succeeds`);
}

// Success and review-lock persistence.
let frame = await openHost("success", "complete-draft", { suspendData: incompleteDraftJson, status: "incomplete", score: "" }, "summary mobile layout");
assert(await frame.locator("#summaryPanel").isVisible(), "summary theta: seeded overview is visible");
const incompleteSummaryLayout = await frame.locator("#summaryList .summary-item").nth(1).evaluate(row => {
  const heading = row.querySelector("strong")?.getBoundingClientRect();
  const status = row.querySelector(".summary-pending")?.getBoundingClientRect();
  const edit = row.querySelector("button")?.getBoundingClientRect();
  return {
    columns: getComputedStyle(row).gridTemplateColumns,
    rowWidth: row.getBoundingClientRect().width,
    headingWidth: heading?.width || 0,
    statusWidth: status?.width || 0,
    editWidth: edit?.width || 0,
    editHeight: edit?.height || 0,
    horizontalOverflow: row.scrollWidth > row.clientWidth
  };
});
assert(incompleteSummaryLayout.columns.split(" ").length === 1, `summary mobile layout: incomplete card did not collapse to one column ${JSON.stringify(incompleteSummaryLayout)}`);
assert(incompleteSummaryLayout.headingWidth > 100, `summary mobile layout: question title was squeezed ${JSON.stringify(incompleteSummaryLayout)}`);
assert(incompleteSummaryLayout.editWidth > 60 && incompleteSummaryLayout.editHeight < 70, `summary mobile layout: return button became a vertical strip ${JSON.stringify(incompleteSummaryLayout)}`);
assert(!incompleteSummaryLayout.horizontalOverflow, `summary mobile layout: incomplete card overflows horizontally ${JSON.stringify(incompleteSummaryLayout)}`);

frame = await openHost("success", "complete-draft", { suspendData: incompleteDraftJson, status: "incomplete", score: "" }, "summary desktop layout", false, 1200, 700);
assert(await frame.locator("#summaryPanel").isVisible(), "summary desktop layout: overview is visible");
const desktopSummaryLayout = await frame.locator("#summaryList .summary-item").nth(1).evaluate(row => {
  const heading = row.querySelector("strong")?.getBoundingClientRect();
  const edit = row.querySelector("button")?.getBoundingClientRect();
  return {
    columns: getComputedStyle(row).gridTemplateColumns,
    headingWidth: heading?.width || 0,
    editWidth: edit?.width || 0,
    editHeight: edit?.height || 0,
    horizontalOverflow: row.scrollWidth > row.clientWidth
  };
});
assert(desktopSummaryLayout.columns.split(" ").length === 1, `summary desktop layout: incomplete card retained a squeezed multi-column grid ${JSON.stringify(desktopSummaryLayout)}`);
assert(desktopSummaryLayout.headingWidth > 100, `summary desktop layout: question title was squeezed ${JSON.stringify(desktopSummaryLayout)}`);
assert(desktopSummaryLayout.editWidth > 60 && desktopSummaryLayout.editHeight < 70, `summary desktop layout: return button became a vertical strip ${JSON.stringify(desktopSummaryLayout)}`);
assert(!desktopSummaryLayout.horizontalOverflow, `summary desktop layout: incomplete card overflows horizontally ${JSON.stringify(desktopSummaryLayout)}`);

frame = await openHost("success", "complete-draft", { suspendData: completeDraftJson, status: "incomplete", score: "" }, "success");
assert(await frame.locator("#summaryPanel").isVisible(), "summary theta: seeded overview is visible");
assert(await frame.locator('#diagram [data-label="student-theta"]').count() === 1, "summary theta: attached theta label is visible in the overview");
assert(await frame.locator("#thetaHit").isHidden(), "summary theta: attached theta hit target is hidden in the overview");
await reloadActivityFrame();
frame = await frameForHost("summary theta reload");
assert(await frame.locator('#diagram [data-label="student-theta"]').count() === 1, "summary theta: attached label survives overview reload");
await click(frame, '#summaryList [data-edit-question="0"]');
assert(await frame.locator("#practicePanel").isVisible(), "summary theta: returning to edit reopens practice controls");
assert(await frame.locator("#thetaHit").isVisible(), "summary theta: attached theta remains an interactive edit target after returning");
assert(await frame.locator('#diagram [data-label="student-theta"]').count() === 0, "summary theta: editable mode does not duplicate the SVG label");
await click(frame, "#goSummary");
assert(await frame.locator('#diagram [data-label="student-theta"]').count() === 1, "summary theta: returning to overview redraws one attached label");
assert((await submitPopulated(frame, "success")) === "review", "success: production submit did not finish");
await assertReviewLock(frame, "success");
const successFormulaRows = await reviewFormulaRows(frame, "success formula review");
assert(successFormulaRows.every(row => row.result === "correct"), `success formula review: correct formulas were not marked correct ${JSON.stringify(successFormulaRows)}`);
assert(await frame.locator("#practicePanel").isHidden(), "success formula review: practice formula workbench stayed hidden");
assert((await frame.locator("#reviewCompletion").textContent()).includes("已提交"), "success: rendered completion status is missing");
assert(await frame.locator('#diagram [data-label="student-theta"]').count() === 1, "success: submitted theta label remains visible in review");
assert(await frame.locator("#thetaHit").isHidden(), "success: interactive theta hit target is hidden in review");
assert((await frame.locator("#sceneTitle").textContent()).includes("水平／垂直分解"), "success: review stage title matches the first submitted question");
assert((await frame.locator("#sceneKind").textContent()).includes("原力 F 固定"), "success: review stage context matches the first submitted question");
assert((await frame.locator("#stageStepLabel").textContent()).trim() === "唯讀", "success: review stage step is labelled read-only");
await click(frame, '#reviewQuestionNavigation [data-question-index="2"]');
assert((await frame.locator("#sceneTitle").textContent()).includes("斜面上的重力"), "success: switching review question updates the stage title");
assert((await frame.locator("#sceneKind").textContent()).includes("斜面傾角 θ 已給定"), "success: switching review question updates the stage context");
assert(await frame.locator('#diagram [data-label="student-theta"]').count() === 1, "success: switched review question retains its theta label");
assert(await frame.locator('#diagram [data-label="given-slope-theta"]').count() === 1, "success: the third-question given theta remains a separate scene annotation");
const successData = await parentState();
assert(successData.data["cmi.core.lesson_status"] === "passed", "success: LMS status was not passed");
await reloadActivityFrame();
frame = await frameForHost("success reload");
await assertReviewLock(frame, "success reload");

// The summary is a review checkpoint, not another editable stage. A stale
// keyboard event must not create an unsubmitted preview that can leak into
// the final locked rendering.
frame = await openHost("success", "complete-draft", { suspendData: completeDraftJson, status: "incomplete", score: "" }, "summary stage lock");
const summaryBefore = await frame.evaluate(() => window.__forceOrthogonalApp.getActivityState());
const summaryProbe = await frame.evaluate(() => {
  const selectors = ["#originHit", "#pointHit", "#thetaHit", "#directionEdit0", "#perpendicularEdit0", "#componentEdit0"];
  const target = document.querySelector("#componentEdit0");
  target?.focus();
  target?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  target?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
  return {
    state: window.__forceOrthogonalApp.getActivityState(),
    preview: window.__forceOrthogonalApp.getDragPreview(),
    controls: selectors.map(selector => {
      const node = document.querySelector(selector);
      return { selector, hidden: Boolean(node?.hidden), disabled: Boolean(node?.disabled) };
    })
  };
});
assert(summaryProbe.state.phase === "summary", "summary stage lock: seeded activity left the summary");
assert(summaryProbe.preview === null, "summary stage lock: keyboard editing started from the summary");
assert(summaryProbe.controls.every(item => item.hidden && item.disabled), `summary stage lock: a stage target remained active: ${JSON.stringify(summaryProbe.controls)}`);
assert(JSON.stringify(summaryProbe.state) === JSON.stringify(summaryBefore), "summary stage lock: keyboard events changed the saved answer");
assert((await submitPopulated(frame, "summary stage lock")) === "review", "summary stage lock: final submit did not finish");
await assertReviewLock(frame, "summary stage lock review");

// A free, unsnapped thetaPoint is also learner data. Review must render its
// label even though there is no matching arc candidate or interactive button.
frame = await openHost("success", "complete-draft", { suspendData: freeThetaDraftJson, status: "incomplete", score: "" }, "free theta review");
assert(await frame.locator('#diagram [data-label="student-theta"]').count() === 1, "summary free theta: free thetaPoint label is visible in the overview");
await reloadActivityFrame();
frame = await frameForHost("summary free theta reload");
assert(await frame.locator('#diagram [data-label="student-theta"]').count() === 1, "summary free theta: free thetaPoint label survives overview reload");
await click(frame, '#summaryList [data-edit-question="0"]');
assert(await frame.locator("#thetaHit").isVisible(), "summary free theta: free thetaPoint remains editable after returning");
assert(await frame.locator('#diagram [data-label="student-theta"]').count() === 0, "summary free theta: editable mode does not duplicate the free label");
await click(frame, "#goSummary");
assert(await frame.locator('#diagram [data-label="student-theta"]').count() === 1, "summary free theta: returning to overview redraws one free label");
assert((await submitPopulated(frame, "free theta review")) === "review", "free theta review: production submit did not finish");
await assertReviewLock(frame, "free theta review");
assert(await frame.locator('#diagram [data-label="student-theta"]').count() === 1, "free theta review: free thetaPoint label remains visible");
assert(await frame.locator("#thetaHit").isHidden(), "free theta review: interactive theta hit target is hidden");

// Review the third question with a free θ, then with no learner θ at all. The
// fixed incline annotation must remain visible, but an unplaced learner θ
// must not be invented by the review renderer.
frame = await openHost("success", "complete-draft", { suspendData: freeGravityThetaDraftJson, status: "incomplete", score: "" }, "free gravity theta review");
assert((await submitPopulated(frame, "free gravity theta review")) === "review", "free gravity theta review: production submit did not finish");
await assertReviewLock(frame, "free gravity theta review");
await click(frame, '#reviewQuestionNavigation [data-question-index="2"]');
assert(await frame.locator('#diagram [data-label="student-theta"]').count() === 1, "free gravity theta review: free student theta remains visible");
assert(await frame.locator('#diagram [data-label="given-slope-theta"]').count() === 1, "free gravity theta review: given slope theta remains visible");

frame = await openHost("success", "complete-draft", { suspendData: missingGravityThetaDraftJson, status: "incomplete", score: "" }, "missing gravity theta review");
assert((await submitPopulated(frame, "missing gravity theta review")) === "review", "missing gravity theta review: production submit did not finish");
await assertReviewLock(frame, "missing gravity theta review");
await click(frame, '#reviewQuestionNavigation [data-question-index="2"]');
assert(await frame.locator('#diagram [data-label="student-theta"]').count() === 0, "missing gravity theta review: no student theta is rendered when θ was never placed");
assert(await frame.locator('#diagram [data-label="given-slope-theta"]').count() === 1, "missing gravity theta review: given slope theta remains visible without student theta");

// A valid review snapshot is still only a safe summary when the finished LMS
// attempt exposes no usable score. The computed snapshot score must not fill
// in the missing LMS field, and review formula details remain hidden.
const finishedReviewSeed = { suspendData: successData.data["cmi.suspend_data"], status: "passed", score: "" };
frame = await openHost("success", "finished-valid-review", finishedReviewSeed, "finished valid review missing score");
await waitForRuntime(frame, "review", "finished valid review missing score");
assert((await frame.locator("#reviewCompletion").textContent()).includes("只顯示已記錄摘要"), "finished valid review missing score: safe summary label is missing");
assert((await frame.locator("#reviewScore").textContent()).trim() === "--", "finished valid review missing score: computed snapshot score replaced missing LMS score");
assert((await frame.locator("#reviewTrustNote").textContent()).includes("沒有提供可用"), "finished valid review missing score: missing-score explanation is missing");
assert(await frame.locator("#reviewFormulaSummary").isHidden(), "finished valid review missing score: untrusted formula details were exposed");
await assertReviewLock(frame, "finished valid review missing score");

frame = await openHost("success", "finished-valid-review", { ...finishedReviewSeed, score: "not-a-number" }, "finished valid review invalid score");
await waitForRuntime(frame, "review", "finished valid review invalid score");
assert((await frame.locator("#reviewCompletion").textContent()).includes("只顯示已記錄摘要"), "finished valid review invalid score: safe summary label is missing");
assert((await frame.locator("#reviewScore").textContent()).trim() === "--", "finished valid review invalid score: invalid LMS score was not rendered as unknown");
assert(await frame.locator("#reviewFormulaSummary").isHidden(), "finished valid review invalid score: untrusted formula details were exposed");
await assertReviewLock(frame, "finished valid review invalid score");

// Trusted review detail uses the submitted snapshot and the per-formula
// scoring items, so a one-right/one-wrong question identifies the exact slot.
frame = await openHost("success", "complete-draft", { suspendData: wrongFormulaDraftJson, status: "incomplete", score: "" }, "wrong formula review");
assert((await submitPopulated(frame, "wrong formula review")) === "review", "wrong formula review: production submit did not finish");
await assertReviewLock(frame, "wrong formula review");
await click(frame, '#reviewQuestionNavigation [data-question-index="0"]');
const wrongFormulaRows = await reviewFormulaRows(frame, "wrong formula review");
assert(wrongFormulaRows.map(row => row.result).sort().join(",") === "correct,incorrect", `wrong formula review: per-slot status is missing ${JSON.stringify(wrongFormulaRows)}`);
assert(wrongFormulaRows.some(row => row.text.includes("錯誤")), `wrong formula review: wrong formula status is not visible ${JSON.stringify(wrongFormulaRows)}`);

// Re-marking theta after a single bad component must not mark the other,
// still-correct formula wrong. The submitted snapshot must retain that result.
const partialFormulaDraftJson = await frame.evaluate(draftJson => {
  const snapshot = JSON.parse(draftJson);
  const M = window.ForceOrthogonalDecompositionModel;
  const q = snapshot.answer.questions[0];
  snapshot.answer.questions[0] = { ...M.editGeometry(q, "component", 0, { x: 185, y: 45 }, { scene: M.getScenario(q.scenarioId) }).editedState, phase: "angle", theta: q.theta };
  return JSON.stringify(snapshot);
}, completeDraftJson);
frame = await openHost("success", "complete-draft", { suspendData: partialFormulaDraftJson, status: "incomplete", score: "" }, "independent formula review");
await frame.evaluate(() => { window.confirm = () => true; });
assert((await submitPopulated(frame, "independent formula review")) === "review", "independent formula review: submission finishes");
await click(frame, '#reviewQuestionNavigation [data-question-index="0"]');
const independentRows = await reviewFormulaRows(frame, "independent formula review");
assert(independentRows.map(row => row.result).sort().join(",") === "correct,unavailable", `independent formula review: unaffected formula lost credit ${JSON.stringify(independentRows)}`);
assert(independentRows.some(row => row.text.includes("未能判斷")), "independent formula review: unavailable geometry is explained");
await reloadActivityFrame();
frame = await frameForHost("independent formula review reload");
await click(frame, '#reviewQuestionNavigation [data-question-index="0"]');
assert((await reviewFormulaRows(frame, "independent formula review reload")).map(row => row.result).sort().join(",") === "correct,unavailable", "independent formula review: reload preserves per-formula result");
assert((await parentState()).data["cmi.core.score.raw"] === "93", "new rubric retains independent formula credit");
assert(JSON.parse((await parentState()).data["cmi.suspend_data"]).answer.scoringVersion === 2, "new submissions record their grading version");

const legacySubmission = await frame.evaluate(draftJson => {
  const P = window.ForceOrthogonalDecompositionPersistence, S = window.ForceOrthogonalDecompositionScoring;
  const draft = P.decodeSnapshot(JSON.parse(draftJson), "draft");
  const result = S.score(draft, { scoringVersion: 1 });
  const review = P.makeSnapshot("review", draft, result);
  delete review.answer.scoringVersion;
  return { reviewJson: JSON.stringify(review), pendingJson: JSON.stringify(P.pendingEnvelope(review, result)), score: result.score };
}, partialFormulaDraftJson);
assert(legacySubmission.score === 90, "legacy reproduction retains the old 90-point result");
const assertLegacyReviewTabs = async (reviewFrame, label) => {
  for (const [index, score] of [70, 100, 100].entries()) {
    const tab = reviewFrame.locator(`#reviewQuestionNavigation [data-question-index="${index}"]`);
    assert((await tab.textContent()).includes(`（${score}/100）`), `${label}: question ${index + 1} tab preserves its original score`);
    assert((await tab.getAttribute("aria-label")).endsWith(`，${score} 分`), `${label}: question ${index + 1} accessible label preserves its original score`);
    await click(reviewFrame, `#reviewQuestionNavigation [data-question-index="${index}"]`);
    assert((await tab.textContent()).includes(`（${score}/100）`), `${label}: switching questions does not regrade the tab`);
  }
};
frame = await openHost("success", "finished-valid-review", { suspendData: legacySubmission.reviewJson, status: "passed", score: "90" }, "legacy finished review");
await waitForRuntime(frame, "review", "legacy finished review");
assert((await frame.locator("#reviewScore").textContent()).includes("90 / 100"), "legacy review is not regraded");
assert(await frame.locator("#reviewFormulaSummary").isVisible(), "legacy review retains trusted submitted answer details");
assert((await frame.locator("#reviewTrustNote").textContent()).includes("舊版規則"), "legacy grading is explained");
await assertReviewLock(frame, "legacy finished review");
await assertLegacyReviewTabs(frame, "legacy finished review");
frame = await openHost("success", "complete-draft", { suspendData: legacySubmission.pendingJson, status: "incomplete", score: "" }, "legacy pending retry");
await waitForRuntime(frame, "frozen", "legacy pending retry");
await click(frame, "#technicalActions button");
await waitForRuntime(frame, "review", "legacy pending retry completed");
await assertLegacyReviewTabs(frame, "legacy pending retry completed");
const retriedLegacy = await parentState();
assert(retriedLegacy.data["cmi.core.score.raw"] === "90" && retriedLegacy.data["cmi.suspend_data"] === legacySubmission.reviewJson, "legacy pending retry writes exactly its immutable original result and review bytes");
await reloadActivityFrame();
frame = await frameForHost("legacy pending retry reload");
assert(await frame.locator("#reviewFormulaSummary").isVisible(), "legacy retried submission still restores trusted details");
await assertLegacyReviewTabs(frame, "legacy pending retry reload");

// At the narrow 320px stage, edit an existing perpendicular through the
// previously clipped-normal case from the audit. The taller drawing canvas
// now accommodates that normal, so first verify it snaps without collapsing
// onto P. Then move outside its snap range and preserve the free endpoint
// through the LMS checkpoint, iframe reload, and final review submission.
frame = await openHost("success", "complete-draft", { suspendData: narrowPerpendicularDraftJson, status: "incomplete", score: "" }, "narrow perpendicular edit", false, 320, 500);
const narrowBefore = await frame.evaluate(() => window.__forceOrthogonalApp.getActivityState());
assert(narrowBefore.currentQuestion === 1 && narrowBefore.questions[1].phase === "perpendiculars", "narrow perpendicular edit: seeded second question is on the perpendicular step");
await mouseDragFrameTarget(frame, "#perpendicularEdit0", { x: 250, y: 177 }, "narrow perpendicular edit");
const narrowSnapped = await frame.evaluate(() => {
  const M = window.ForceOrthogonalDecompositionModel;
  const question = window.__forceOrthogonalApp.getState();
  const end = question.perpendiculars[0].end;
  const vector = M.subtract(end, M.getScenario(question.scenarioId).forceHead);
  return { length: M.length(vector), normalDot: M.dot(vector, question.directions[0].unit) };
});
assert(narrowSnapped.length >= 12 && Math.abs(narrowSnapped.normalDot) < 1e-6, "narrow perpendicular edit: an in-bounds normal snaps without collapsing onto P");
await mouseDragFrameTarget(frame, "#perpendicularEdit0", { x: 250, y: 140 }, "narrow free perpendicular edit");
const narrowAfter = await frame.evaluate(() => window.__forceOrthogonalApp.getActivityState());
const narrowEnd = narrowAfter.questions[1].perpendiculars[0].end;
assert(Math.hypot(narrowEnd.x - 150, narrowEnd.y - 180) >= 12, "narrow perpendicular edit: endpoint is not collapsed onto P");
assert(Math.abs(narrowEnd.x - 250) < 1 && Math.abs(narrowEnd.y - 140) < 1, "narrow perpendicular edit: learner free endpoint is retained");
const narrowSaved = JSON.parse((await parentState()).data["cmi.suspend_data"]);
assert(Math.abs(narrowSaved.answer.questions[1].perpendiculars[0].end.x - narrowEnd.x) < 1e-8 && Math.abs(narrowSaved.answer.questions[1].perpendiculars[0].end.y - narrowEnd.y) < 1e-8, "narrow perpendicular edit: LMS checkpoint contains the edit immediately");
await reloadActivityFrame();
frame = await frameForHost("narrow perpendicular edit reload");
const narrowReloaded = await frame.evaluate(() => window.__forceOrthogonalApp.getActivityState());
assert(Math.abs(narrowReloaded.questions[1].perpendiculars[0].end.x - narrowEnd.x) < 1e-8 && Math.abs(narrowReloaded.questions[1].perpendiculars[0].end.y - narrowEnd.y) < 1e-8, "narrow perpendicular edit: reload restores the edited endpoint");
await click(frame, "#goSummary");
await frame.evaluate(() => { window.confirm = () => true; });
await click(frame, "#submitAttempt");
await waitForRuntime(frame, "review", "narrow perpendicular edit submit");
await click(frame, '#reviewQuestionNavigation [data-question-index="1"]');
const narrowReviewed = await frame.evaluate(() => window.__forceOrthogonalApp.getActivityState());
assert(Math.abs(narrowReviewed.questions[1].perpendiculars[0].end.x - narrowEnd.x) < 1e-8 && Math.abs(narrowReviewed.questions[1].perpendiculars[0].end.y - narrowEnd.y) < 1e-8, "narrow perpendicular edit: final review keeps the edited endpoint");

// An old editable draft can contain the zero-length P2 that the current model
// no longer creates.  Keep strict decoder validation, but expose an explicit
// recovery action so a reload does not loop forever on the same bad checkpoint.
frame = await openHost("success", "complete-draft", { suspendData: invalidEditableDraftJson, status: "incomplete", score: "" }, "invalid editable draft recovery");
await waitForRuntime(frame, "load-error", "invalid editable draft recovery");
assert((await frame.locator("#technicalMessage").textContent()).includes("perpendiculars-2"), "invalid editable draft recovery: decoder reason is shown");
assert(await frame.locator('[data-action="reset-invalid-draft"]').count() === 1, "invalid editable draft recovery: explicit reset action is shown");
await frame.evaluate(() => { window.confirm = () => true; });
await click(frame, '[data-action="reset-invalid-draft"]');
await waitForRuntime(frame, "editable", "invalid editable draft recovery reload");
const recoveredDraft = await frame.evaluate(() => window.__forceOrthogonalApp.getActivityState());
assert(recoveredDraft.phase === "practice" && recoveredDraft.currentQuestion === 0 && recoveredDraft.questions[2].perpendiculars.length === 0, "invalid editable draft recovery: a fresh editable attempt starts after explicit reset");
assert(JSON.parse((await parentState()).data["cmi.suspend_data"]).kind === "draft", "invalid editable draft recovery: LMS now stores a fresh draft checkpoint");

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
frame = await openHost("success", "finished-mismatch", { suspendData: JSON.stringify(mismatchedReview), status: "passed", score: "40" }, "finished mismatch");
await waitForRuntime(frame, "review", "finished mismatch");
assert((await frame.locator("#reviewCompletion").textContent()).includes("只顯示已記錄摘要"), "finished mismatch: safe summary label is missing");
assert((await frame.locator("#reviewScore").textContent()).trim() === "40 / 100", "finished mismatch: recorded LMS score was not rendered");
assert((await frame.locator("#reviewTrustNote").textContent()).includes("摘要"), "finished mismatch: trust warning is missing");
assert(await frame.locator("#reviewQuestionNavigation").isHidden(), "finished mismatch: question navigation remained visible for untrusted data");
assert(await frame.locator("#reviewQuestionNavigation [data-question-index]").count() === 0, "finished mismatch: per-question navigation was rendered for untrusted data");
assert((await frame.locator("#reviewFeedback").textContent()).trim() === "", "finished mismatch: computed per-question feedback was rendered for untrusted data");
await assertReviewLock(frame, "finished mismatch");

console.log("force orthogonal production lifecycle browser checks passed: success, committed, frozen/reload, retryable precommit, nonretryable preflight, invalid editable draft recovery, invalid pending quarantine, finished fallback, and review lock");
}
