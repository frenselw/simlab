async page => {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const wait = milliseconds => page.waitForTimeout(milliseconds);
  const origin = page.url().match(/^https?:\/\/[^/]+/)?.[0] || "";
  const scope = await page.evaluate(() => new URL(location.href).searchParams.get("scope")) || globalThis.process?.env?.FOD_SCOPE || "all";
  assert(origin.startsWith("http://127.0.0.1:"), `unexpected origin: ${origin}`);
  await page.addInitScript(() => {
    if (new URL(location.href).searchParams.get("playwright-reset") === "1") {
      localStorage.removeItem("simlab:force-orthogonal-decomposition:checkpoint");
    }
  });
  const errors = [];
  const progress = label => console.log("[force-orthogonal] " + label);
  page.on("console", message => { if (message.type() === "error" && !message.text().includes("Failed to load resource")) errors.push(message.text()); });
  page.on("response", response => { if (response.status() >= 400 && !response.url().endsWith("/favicon.ico")) errors.push(`${response.status()} ${response.url()}`); });
  page.on("pageerror", error => errors.push(error.message));
  const cdp = await page.context().newCDPSession(page);
  let touchId = 23000;
  let lastDrag = null;

  const appState = () => page.evaluate(() => window.__forceOrthogonalApp.getState());
  const appRuntime = () => page.evaluate(() => window.__forceOrthogonalApp.getRuntimeState());
  const assertThetaTypography = async (context, label) => {
    const sizes = await context.evaluate(() => {
      const screenSize = node => {
        const matrix = node?.getScreenCTM();
        return matrix ? parseFloat(getComputedStyle(node).fontSize) * Math.hypot(matrix.a, matrix.b) : null;
      };
      const hit = document.querySelector("#thetaHit");
      const active = !hit.hidden && getComputedStyle(hit).visibility !== "hidden";
      const box = hit.getBoundingClientRect();
      return {
        force: screenSize(document.querySelector('#diagram [data-label="original-force"]')),
        theta: active ? parseFloat(getComputedStyle(hit).fontSize) : screenSize(document.querySelector('#diagram [data-label="student-theta"]')),
        active, width: box.width, height: box.height,
        extraP: [...document.querySelectorAll("#diagram text")].some(node => node.textContent === "P")
      };
    });
    assert(sizes.force > 0 && sizes.theta > 0 && Math.abs(sizes.theta - sizes.force) < .1,
      `${label}: theta and force symbols have equal screen font sizes ${JSON.stringify(sizes)}`);
    assert(!sizes.active || (sizes.width === 56 && sizes.height === 56), `${label}: theta retains its full 56px hit target`);
    assert(!sizes.extraP, `${label}: no P label is drawn at the force arrowhead`);
  };
  const telemetry = context => context.evaluate(() => window.__forceOrthogonalApp.getTouchTelemetry());
  const assertTrustedPointerTransaction = async (context, before, label) => {
    const events = (await telemetry(context)).slice(before);
    assert(events.some(event => event.type === "pointerdown"), label + ": trusted pointerdown observed " + JSON.stringify(events));
    assert(events.some(event => event.type === "pointermove"), label + ": trusted pointermove observed " + JSON.stringify(events));
    assert(events.some(event => event.type === "pointerup"), label + ": trusted pointerup observed " + JSON.stringify(events));
    assert(!events.some(event => event.type === "pointercancel"), label + ": no pointercancel observed");
    assert(events.every(event => event.isTrusted), label + ": every pointer event is trusted");
  };
  const semanticState = () => page.evaluate(() => {
    const state = window.__forceOrthogonalApp.getState();
    return { phase: state.phase, directions: state.directions.map(item => ({ key: item.key, unit: item.unit, axisKey: item.axisKey || item.axis || null })), perpendiculars: state.perpendiculars, components: state.components, theta: state.theta, formulas: state.formulas };
  });
  const waitForApp = async (label = "app") => {
    try { await page.waitForFunction(() => Boolean(window.__forceOrthogonalApp?.getState())); }
    catch (error) { throw new Error(`${label}: app wait failed url=${page.url()} state=${JSON.stringify(await page.evaluate(() => ({ hasApp: Boolean(window.__forceOrthogonalApp), runtime: window.__forceOrthogonalApp?.getRuntimeState?.() })))}: ${error.message}`); }
  };
  const click = async locator => { await locator.click(); await wait(60); };
  const center = async locator => {
    const box = await locator.boundingBox();
    assert(box, "target has a box");
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const diagramPoint = async point => {
    const box = await page.locator("#diagram").boundingBox();
    assert(box, "diagram has a box");
    const frame = await page.evaluate(() => {
      const diagram = document.querySelector("#diagram");
      const viewBox = diagram.viewBox.baseVal;
      const scene = window.__forceOrthogonalApp.getState().scenarioId;
      const origin = scene === "horizontal-vertical" ? { x: 120, y: 280 } : { x: 170, y: 225 };
      return { viewBox: { x: viewBox.x, y: viewBox.y, width: viewBox.width, height: viewBox.height }, origin };
    });
    const scale = Math.min(box.width / frame.viewBox.width, box.height / frame.viewBox.height);
    return { x: box.x + (box.width - frame.viewBox.width * scale) / 2 + (frame.origin.x + point.x - frame.viewBox.x) * scale, y: box.y + (box.height - frame.viewBox.height * scale) / 2 + (frame.origin.y - point.y - frame.viewBox.y) * scale };
  };
  const touchPoint = point => ({ ...point, id: touchId, radiusX: 1, radiusY: 1, force: 1 });
  const touchDrag = async (start, end, duringDrag = null) => {
    touchId += 1;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touchPoint(start)] });
    for (let index = 1; index <= 12; index += 1) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [touchPoint({ x: start.x + (end.x - start.x) * index / 12, y: start.y + (end.y - start.y) * index / 12 })] });
      await wait(10);
      if (duringDrag && (index === 6 || index === 12)) await duringDrag(index);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await wait(100);
  };
  const touchTap = async locator => {
    touchId += 1;
    const point = await center(locator);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touchPoint(point)] });
    await wait(80);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await wait(120);
  };
  const mouseDrag = async (start, end) => {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    for (let index = 1; index <= 12; index += 1) await page.mouse.move(start.x + (end.x - start.x) * index / 12, start.y + (end.y - start.y) * index / 12);
    assert(await page.locator("#touchPreview").isHidden(), "mouse dragging does not open the touch preview");
    await page.mouse.up();
    await wait(100);
  };
  const dragTarget = async (selector, end, mode) => {
    const start = await center(page.locator(selector));
    const target = await diagramPoint(end);
    lastDrag = { selector, end, start, target, state: await appState() };
    if (mode === "touch") await touchDrag(start, target); else await mouseDrag(start, target);
  };
  const frameDiagramPoint = async (frame, point) => {
    const box = await frame.locator("#diagram").evaluate(node => node.getBoundingClientRect().toJSON());
    const iframe = await page.locator("iframe").boundingBox();
    assert(box && iframe, "embedded diagram and iframe have boxes");
    const frameData = await frame.evaluate(() => {
      const diagram = document.querySelector("#diagram");
      const viewBox = diagram.viewBox.baseVal;
      const scene = window.__forceOrthogonalApp.getState().scenarioId;
      const origin = scene === "horizontal-vertical" ? { x: 120, y: 280 } : { x: 170, y: 225 };
      return { viewBox: { x: viewBox.x, y: viewBox.y, width: viewBox.width, height: viewBox.height }, origin };
    });
    const scale = Math.min(box.width / frameData.viewBox.width, box.height / frameData.viewBox.height);
    const raw = {
      x: box.x + (box.width - frameData.viewBox.width * scale) / 2 + (frameData.origin.x + point.x - frameData.viewBox.x) * scale,
      y: box.y + (box.height - frameData.viewBox.height * scale) / 2 + (frameData.origin.y - point.y - frameData.viewBox.y) * scale
    };
    const inset = 2;
    const x = Math.max(box.x + inset, Math.min(box.x + box.width - inset, raw.x));
    const y = Math.max(box.y + inset, Math.min(box.y + box.height - inset, raw.y));
    return { x: iframe.x + x, y: iframe.y + y };
  };
  const frameTouchTarget = async (frame, selector, end, label, diagram = true) => {
    await frame.evaluate(() => window.__forceOrthogonalApp.clearTouchTelemetry());
    const before = 0;
    const startBox = await frame.locator(selector).evaluate(node => node.getBoundingClientRect().toJSON());
    const iframe = await page.locator("iframe").boundingBox();
    assert(startBox && iframe, label + ": target " + selector + " has a box");
    const start = { x: iframe.x + startBox.x + startBox.width / 2, y: iframe.y + startBox.y + startBox.height / 2 };
    const target = diagram ? await frameDiagramPoint(frame, end) : end;
    await wait(100);
    const beforeMetrics = await embeddedTargetMetrics(frame);
    const savedAnswer = await frame.evaluate(() => JSON.stringify(window.__forceOrthogonalApp.getActivityState()));
    await touchDrag(start, target, async step => {
      await assertTouchPreview(frame, label);
      assert(await frame.evaluate(() => JSON.stringify(window.__forceOrthogonalApp.getActivityState())) === savedAnswer,
        label + ": preview does not change the saved answer before release");
      await assertEmbeddedTargetMetricsStable(frame, beforeMetrics, label + " during drag");
      if (step === 12 && label.endsWith("component 0")) {
        const variant = frame.url().includes("/packaged/") ? "packaged" : "source";
        await page.screenshot({ path: `output/playwright/force-orthogonal-preview-${variant}-${Math.round(iframe.width)}.png` });
      }
    });
    await assertTrustedPointerTransaction(frame, before, label);
    await assertEmbeddedTargetMetricsStable(frame, beforeMetrics, label);
    assert(await frame.locator("#touchPreview").isHidden(), label + ": preview closes on release");
    assert(await frame.locator("#touchPreviewSvg > *").count() === 0, label + ": transient preview is discarded");
  };
  const assertTouchPreview = async (context, label) => {
    const preview = await context.evaluate(() => {
      const panel = document.querySelector("#touchPreview");
      const svg = document.querySelector("#touchPreviewSvg");
      const diagram = document.querySelector("#diagram");
      const box = panel.getBoundingClientRect();
      const stage = document.querySelector("#stage").getBoundingClientRect();
      const drag = window.__forceOrthogonalApp.getDragPreview();
      const layout = window.__forceOrthogonalApp.getLayoutMetrics();
      const focus = svg.querySelector(".touch-preview-focus");
      const focusPoint = focus ? { x: focus.cx.baseVal.value - layout.origin.x, y: layout.origin.y - focus.cy.baseVal.value } : null;
      const kind = drag?.kind;
      const selector = kind === "theta" ? ".theta-arc" : drag?.editIndex != null
        ? `[data-${kind}-index="${drag.editIndex}"]` : `[data-preview="${kind}"]`;
      const original = diagram.querySelector(selector);
      const copy = svg.querySelector(selector);
      const view = svg.viewBox.baseVal;
      return {
        hidden: panel.hidden, pointerEvents: getComputedStyle(panel).pointerEvents,
        zoom: svg.getBoundingClientRect().width / view.width / layout.diagramScale,
        insideStage: box.left >= stage.left && box.top >= stage.top && box.right <= stage.right && box.bottom <= stage.bottom,
        coversFinger: drag && drag.clientX >= box.left && drag.clientX <= box.right && drag.clientY >= box.top && drag.clientY <= box.bottom,
        focusVisible: focus && focus.cx.baseVal.value >= view.x && focus.cx.baseVal.value <= view.x + view.width &&
          focus.cy.baseVal.value >= view.y && focus.cy.baseVal.value <= view.y + view.height,
        originalForce: svg.querySelector('[data-kind="original"]')?.getAttribute("d") === diagram.querySelector('[data-kind="original"]')?.getAttribute("d"),
        liveGeometry: original && original.outerHTML === copy?.outerHTML,
        hasForbiddenNodes: Boolean(svg.querySelector("[id], [tabindex], button, a")),
        thetaGlyph: svg.querySelector('[data-label="student-theta"]')?.textContent,
        thetaFont: parseFloat(getComputedStyle(svg.querySelector('[data-label="student-theta"]') || svg).fontSize),
        forceFont: parseFloat(getComputedStyle(svg.querySelector('[data-label="original-force"]')).fontSize),
        kind, valid: Boolean(drag?.preview?.valid || kind === "theta"),
        focusPoint, expectedEndpoint: kind === "theta" ? drag.point : drag?.preview?.point,
        corner: panel.dataset.corner
      };
    });
    const details = label + ": " + JSON.stringify(preview);
    assert(!preview.hidden && preview.pointerEvents === "none", details + " inert preview is visible during touch");
    assert(preview.insideStage && !preview.coversFinger, details + " fixed-corner preview stays in stage and away from the finger");
    assert(Math.abs(preview.zoom - 2) < .01 && preview.focusVisible, details + " active point is visible at 2x scale");
    assert(preview.originalForce && !preview.hasForbiddenNodes, details + " scene is copied without duplicate IDs or interactive controls");
    if (preview.valid && preview.kind !== "theta") assert(preview.liveGeometry, details + " preview matches the live geometry including snapping");
    if (preview.kind === "theta") {
      assert(preview.thetaGlyph === "θ" && preview.thetaFont === preview.forceFont, details + " magnified theta retains the force symbol's font size");
      await assertThetaTypography(context, label + " while dragging");
    }
    if (preview.expectedEndpoint) assert(Math.hypot(preview.focusPoint.x - preview.expectedEndpoint.x, preview.focusPoint.y - preview.expectedEndpoint.y) < .01,
      details + " focus follows the snapped endpoint or theta location");
    return preview;
  };
  const exercisePreviewCancellation = async (frame, label) => {
    for (const cancellation of ["touchCancel", "lostCapture"]) {
      // Let the preceding question-button click finish its panel scroll before
      // measuring the gesture (the drag itself must not move any scroll owner).
      await wait(100);
      await frame.evaluate(() => window.__forceOrthogonalApp.clearTouchTelemetry());
      const original = await frame.evaluate(() => JSON.stringify(window.__forceOrthogonalApp.getActivityState()));
      const beforeMetrics = await embeddedTargetMetrics(frame);
      const iframe = await page.locator("iframe").boundingBox();
      const hit = await frame.locator("#originHit").evaluate(node => node.getBoundingClientRect().toJSON());
      const start = { x: iframe.x + hit.x + hit.width / 2, y: iframe.y + hit.y + hit.height / 2 };
      touchId += 1;
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touchPoint(start)] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [touchPoint({ x: start.x + 55, y: start.y - 45 })] });
      const first = await assertTouchPreview(frame, label + " initial preview");
      const lens = await frame.locator("#touchPreview").evaluate(node => node.getBoundingClientRect().toJSON());
      // Deliberately approach the preview's current corner with a trusted touch.
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [touchPoint({ x: iframe.x + lens.x + lens.width / 2, y: iframe.y + lens.y + lens.height / 2 })] });
      const moved = await assertTouchPreview(frame, label + " edge avoidance");
      assert(moved.corner !== first.corner, label + ": preview changes corner only when approached");
      if (cancellation === "touchCancel") {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
      } else {
        await frame.evaluate(() => {
          const drag = window.__forceOrthogonalApp.getDragPreview();
          document.querySelector("#originHit").releasePointerCapture(drag.pointerId);
        });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      }
      assert(await frame.locator("#touchPreview").isHidden(), label + ": " + cancellation + " hides preview");
      assert(await frame.evaluate(() => JSON.stringify(window.__forceOrthogonalApp.getActivityState())) === original,
        label + ": " + cancellation + " does not save transient geometry");
      await assertEmbeddedTargetMetricsStable(frame, beforeMetrics, label + " " + cancellation);
    }
    await frame.locator("#originHit").focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowRight");
    assert(await frame.locator("#touchPreview").isHidden(), label + ": keyboard preview does not open magnifier");
    await page.keyboard.press("Escape");
  };
  const embeddedTargetMetrics = async frame => ({
    host: await page.evaluate(() => {
      const vv = window.visualViewport;
      return { scrollY: window.scrollY, docScrollTop: document.documentElement.scrollTop, visualViewport: vv ? { offsetTop: vv.offsetTop, pageTop: vv.pageTop, width: vv.width, height: vv.height } : null };
    }),
    iframe: await page.locator("iframe").boundingBox(),
    activity: await frame.evaluate(() => {
      const vv = window.visualViewport;
      const stage = document.querySelector("#stage").getBoundingClientRect();
      const panel = document.querySelector("#forcePanel");
      return {
        docScrollTop: document.documentElement.scrollTop,
        visualViewport: vv ? { offsetTop: vv.offsetTop, pageTop: vv.pageTop, width: vv.width, height: vv.height } : null,
        stage: { x: stage.x, y: stage.y, width: stage.width, height: stage.height },
        panelScrollTop: panel.scrollTop
      };
    })
  });
  const assertEmbeddedTargetMetricsStable = async (frame, before, label) => {
    const after = await embeddedTargetMetrics(frame);
    const details = JSON.stringify({ before, after, events: await telemetry(frame) });
    assert(JSON.stringify(before.host) === JSON.stringify(after.host), label + ": host and host visual viewport stay fixed " + details);
    assert(JSON.stringify(before.iframe) === JSON.stringify(after.iframe), label + ": iframe rectangle stays fixed " + details);
    assert(JSON.stringify(before.activity) === JSON.stringify(after.activity), label + ": activity document, viewport, stage and panel stay fixed " + details);
  };
  const scenePlan = () => page.evaluate(() => {
    const state = window.__forceOrthogonalApp.getState();
    const M = window.ForceOrthogonalDecompositionModel;
    const scene = M.getScenario(state.scenarioId);
    const feet = scene.axes.map(axis => M.projectionFoot(scene.forceHead, axis, scene));
    return { id: scene.id, head: scene.forceHead, directions: scene.axes.map(axis => M.add(scene.origin, M.scale(axis.unit, 180))), feet };
  });
  const constructQuestion = async (mode, keyboardFormula = false) => {
    const plan = await scenePlan();
    const advanceStage = async () => mode === "touch" ? touchTap(page.locator("#stageNextButton")) : click(page.locator("#nextButton"));
    const assertGravityHit = async (selector, label) => {
      if (plan.id !== "inclined-gravity") return;
      const metrics = await page.evaluate(targetSelector => {
        const stage = document.querySelector("#stage").getBoundingClientRect();
        const node = document.querySelector(targetSelector);
        const box = node?.getBoundingClientRect();
        const force = document.querySelector('[data-kind="original"]')?.getBoundingClientRect();
        const state = window.__forceOrthogonalApp.getState();
        const M = window.ForceOrthogonalDecompositionModel;
        const scene = M.getScenario(state.scenarioId);
        const body = document.querySelector(".inclined-body");
        const bodyPoints = body ? body.getAttribute("points").trim().split(/\s+/).map(pair => {
          const [x, y] = pair.split(",").map(Number);
          return { x, y };
        }) : [];
        const planePoint = M.add(scene.origin, M.scale(scene.axes[1].unit, -scene.plane.bodyOffset));
        const bodyPlaneDistance = bodyPoints.length ? Math.min(...bodyPoints.map(point => Math.abs(M.dot(M.subtract(point, planePoint), scene.axes[1].unit)))) : null;
        const givenArc = document.querySelector(".given-theta-arc");
        const givenReference = document.querySelector(".given-theta-reference");
        const expectedVertex = M.add(planePoint, M.scale(scene.axes[0].unit, -180));
        const givenVertex = givenArc ? { x: Number(givenArc.getAttribute("data-theta-vertex-x")), y: Number(givenArc.getAttribute("data-theta-vertex-y")) } : null;
        return { stage: stage.toJSON(), box: box?.toJSON(), hidden: node?.hidden, force: force?.toJSON(), viewBox: document.querySelector("#diagram")?.getAttribute("viewBox"), state, correct: M.isCorrectDecomposition(state), givenThetaArcCount: document.querySelectorAll(".given-theta-arc").length, givenThetaLabelCount: document.querySelectorAll('[data-label="given-slope-theta"]').length, givenThetaKey: givenArc?.getAttribute("data-theta-key"), givenReferenceCount: document.querySelectorAll(".given-theta-reference").length, givenVertex, expectedVertex, givenVertexError: givenVertex ? M.distance(givenVertex, expectedVertex) : null, bodyPlaneDistance };
      }, selector);
      assert(metrics.box && !metrics.hidden, `${plan.id}: ${label} target is visible ${JSON.stringify(metrics)}`);
      assert(metrics.givenThetaArcCount === 1 && metrics.givenThetaLabelCount === 1 && metrics.givenReferenceCount === 1 && metrics.givenThetaKey === "given-slope-theta" && metrics.givenVertexError < 0.1, `${plan.id}: the fixed slope-angle mark is missing or not on the surface ${JSON.stringify(metrics)}`);
      assert(metrics.bodyPlaneDistance != null && metrics.bodyPlaneDistance < 0.1, `${plan.id}: inclined body is not seated on the plane ${JSON.stringify(metrics)}`);
      assert(metrics.box.left >= metrics.stage.left - 1 && metrics.box.right <= metrics.stage.right + 1 && metrics.box.top >= metrics.stage.top - 1 && metrics.box.bottom <= metrics.stage.bottom + 1, `${plan.id}: ${label} 52px target is inside the narrow stage ${JSON.stringify(metrics)}`);
      if (metrics.force) assert(metrics.force.left >= metrics.stage.left - 1 && metrics.force.right <= metrics.stage.right + 1 && metrics.force.top >= metrics.stage.top - 1 && metrics.force.bottom <= metrics.stage.bottom + 1, `${plan.id}: full force is inside the narrow stage ${JSON.stringify(metrics)}`);
    };
    await assertGravityHit("#originHit", "directions origin");
    for (const direction of plan.directions) await dragTarget("#originHit", direction, mode);
    assert((await appState()).directions.length === 2, `${plan.id}: two directions created with ${mode}`);
    await advanceStage();
    await assertGravityHit("#pointHit", "perpendicular origin");
    for (const foot of plan.feet) await dragTarget("#pointHit", foot, mode);
    assert((await appState()).perpendiculars.length === 2, `${plan.id}: two perpendiculars created with ${mode}`);
    await advanceStage();
    await assertGravityHit("#originHit", "component origin");
    for (const foot of plan.feet) await dragTarget("#originHit", foot, mode);
    assert((await appState()).components.length === 2, `${plan.id}: two components created with ${mode} ${JSON.stringify({ state: await appState(), lastDrag })}`);
    await advanceStage();
    assert((await appState()).phase === "angle", `${plan.id}: angle phase reached`);
    await assertGravityHit("#thetaHit", "given theta");
    await assertThetaTypography(page, plan.id + " unplaced theta");
    const thetaChoice = page.locator("[data-theta-choice]").first();
    assert(await thetaChoice.count() === 1, `${plan.id}: theta choice rendered`);
    await click(thetaChoice);
    await assertThetaTypography(page, plan.id + " placed theta");
    await advanceStage();
    assert((await appState()).phase === "formulas", `${plan.id}: formula phase reached`);
    const expectations = await page.evaluate(() => window.ForceOrthogonalDecompositionModel.formulaExpectations(window.__forceOrthogonalApp.getState()));
    for (const [index, expectation] of expectations.entries()) {
      const token = page.locator(`[data-formula-token="${expectation.value}"]`);
      const slot = page.locator(`[data-formula-slot="${expectation.key}"]`);
      if (keyboardFormula && index === 0) {
        await token.focus();
        await page.keyboard.press("Enter");
        await slot.focus();
        await page.keyboard.press("Enter");
      } else {
        await click(token);
        await click(slot);
      }
    }
    assert((await appState()).formulas.F1 && (await appState()).formulas.F2, `${plan.id}: formula inputs placed`);
    const formulaActivity = await page.evaluate(() => window.__forceOrthogonalApp.getActivityState());
    const formulaNextLabel = await page.locator("#nextButton").textContent();
    const formulaPrompt = await page.locator("#stepPrompt").textContent();
    if (formulaActivity.currentQuestion < 2) {
      assert(formulaNextLabel.trim() === "下一題", `${plan.id}: completed formula step exposes 下一題`);
      assert(formulaPrompt.includes("第 5 步") && formulaPrompt.includes("下一題"), `${plan.id}: completed formula step prompt is explicit`);
      await click(page.locator("#nextButton"));
      const nextQuestion = await page.evaluate(() => window.__forceOrthogonalApp.getActivityState());
      assert(nextQuestion.currentQuestion === formulaActivity.currentQuestion + 1 && nextQuestion.questions[nextQuestion.currentQuestion].phase === "directions", `${plan.id}: 下一題 opens the next question`);
      await click(page.locator(`[data-question-index="${formulaActivity.currentQuestion}"]`));
      const returnedQuestion = await page.evaluate(() => window.__forceOrthogonalApp.getActivityState());
      assert(returnedQuestion.currentQuestion === formulaActivity.currentQuestion, `${plan.id}: returning to the completed formula question remains available`);
    } else {
      assert(formulaNextLabel.trim() === "完成本題，前往檢查", `${plan.id}: final completed formula step exposes the summary action`);
    }
    assert(await page.locator("#checkFormulasButton").count() === 0, `${plan.id}: per-question formula check must not be exposed`);
    assert(await page.locator(".formula-slot[data-result]").count() === 0, `${plan.id}: formula correctness must remain hidden before final submission`);
  };
  const exerciseDirectEditing = async () => {
    // Exercise both stage navigation controls with trusted touch taps. The
    // capture-phase stage-drag guard must leave ordinary button clicks intact.
    await touchTap(page.locator("#stageBackButton"));
    assert((await appState()).phase === "angle", "touch stage back button changes phase");
    await touchTap(page.locator("#stageNextButton"));
    assert((await appState()).phase === "formulas", "touch stage next button changes phase");
    for (let index = 0; index < 4; index += 1) await click(page.locator("#backButton"));
    const original = await page.evaluate(() => {
      const state = window.__forceOrthogonalApp.getState();
      const scene = window.ForceOrthogonalDecompositionModel.getScenario(state.scenarioId);
      return {
        directions: state.directions.map(item => ({ x: scene.origin.x + item.unit.x * 120, y: scene.origin.y + item.unit.y * 120 })),
        perpendiculars: state.perpendiculars.map(item => item.end),
        components: state.components.map(item => item.end)
      };
    });
    const sceneOrigin = await page.evaluate(() => window.ForceOrthogonalDecompositionModel.getScenario(window.__forceOrthogonalApp.getState().scenarioId).origin);
    const nudge = (point, selector) => {
      if (!selector.includes("directionEdit")) return { x: point.x + 65, y: point.y - 45 };
      const dx = point.x - sceneOrigin.x;
      const dy = point.y - sceneOrigin.y;
      return { x: sceneOrigin.x + dx * Math.cos(Math.PI / 10) - dy * Math.sin(Math.PI / 10), y: sceneOrigin.y + dx * Math.sin(Math.PI / 10) + dy * Math.cos(Math.PI / 10) };
    };
    const editAndRestore = async (selector, point, label) => {
      const before = await semanticState();
      const start = await center(page.locator(selector));
      await mouseDrag(start, await diagramPoint(nudge(point, selector)));
      const changed = await semanticState();
      assert(JSON.stringify(changed) !== JSON.stringify(before), label + ": edit completed");
      const persisted = await page.evaluate(() => {
        const raw = localStorage.getItem("simlab:force-orthogonal-decomposition:checkpoint");
        if (!raw) return null;
        const bundle = JSON.parse(raw);
        const snapshot = bundle?.["cmi.suspend_data"] ? JSON.parse(bundle["cmi.suspend_data"]) : null;
        return snapshot?.answer?.questions?.[0] || null;
      });
      assert(persisted && JSON.stringify({ phase: persisted.phase, directions: persisted.directions, perpendiculars: persisted.perpendiculars, components: persisted.components, theta: persisted.theta, formulas: persisted.formulas }) === JSON.stringify(changed), label + ": completed edit was persisted immediately");
      const restoreStart = await center(page.locator(selector));
      await mouseDrag(restoreStart, await diagramPoint(point));
    };
    for (let index = 0; index < 2; index += 1) await editAndRestore("#directionEdit" + index, original.directions[index], "direction edit " + index);
    await click(page.locator("#nextButton"));
    for (let index = 0; index < 2; index += 1) await editAndRestore("#perpendicularEdit" + index, original.perpendiculars[index], "perpendicular edit " + index);
    await click(page.locator("#nextButton"));
    for (let index = 0; index < 2; index += 1) await editAndRestore("#componentEdit" + index, original.components[index], "component edit " + index);
    const keyboardBefore = await semanticState();
    await page.locator("#componentEdit0").focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    assert(JSON.stringify((await semanticState()).components) !== JSON.stringify(keyboardBefore.components), "keyboard edit changes a component");
    const keyboardRestore = await center(page.locator("#componentEdit0"));
    await mouseDrag(keyboardRestore, await diagramPoint(original.components[0]));
    await click(page.locator("#nextButton"));
    await click(page.locator("[data-theta-choice]").first());
    await click(page.locator("#nextButton"));
    assert((await appState()).phase === "formulas", "edited question returns to formulas after repair and re-angle");
  };
  const layoutContract = async (label, width, height) => {
    await page.setViewportSize({ width, height });
    await wait(80);
    const metrics = await page.evaluate(() => {
      const app = document.querySelector("#app");
      const shell = document.querySelector(".force-shell");
      const stage = document.querySelector("#stage");
      const panel = document.querySelector("#forcePanel");
      return { app: app.getBoundingClientRect().toJSON(), shell: shell.getBoundingClientRect().toJSON(), stage: stage.getBoundingClientRect().toJSON(), panel: panel.getBoundingClientRect().toJSON(), layout: window.__forceOrthogonalApp.getLayoutMetrics(), panelScrollHeight: panel.scrollHeight, panelClientHeight: panel.clientHeight, docScrollHeight: document.documentElement.scrollHeight, innerHeight };
    });
    assert(metrics.app.height <= height + 1, `${label}: app is bounded to the viewport`);
    assert(metrics.docScrollHeight <= height + 1, `${label}: activity document is not a third scroll owner ${JSON.stringify(metrics)}`);
    assert(metrics.panel.height >= 95 && metrics.panel.bottom <= height + 1, `${label}: at least 96px of controls remains inside the viewport ${JSON.stringify(metrics)}`);
    assert(metrics.panelScrollHeight > metrics.panelClientHeight, `${label}: controls panel has an independent scroll range`);
    const expected = {
      left: metrics.layout.viewBox.x - metrics.layout.origin.x,
      right: metrics.layout.viewBox.x + metrics.layout.viewBox.width - metrics.layout.origin.x,
      bottom: metrics.layout.origin.y - metrics.layout.viewBox.y - metrics.layout.viewBox.height,
      top: metrics.layout.origin.y - metrics.layout.viewBox.y
    };
    for (const key of ["left", "right", "bottom", "top"]) assert(Math.abs(metrics.layout.worldBounds[key] - expected[key]) < 1e-8, `${label}: scene world bounds follow the scene viewBox on ${key} edge ${JSON.stringify(metrics.layout)}`);
    assert(metrics.layout.editingBounds.left > metrics.layout.worldBounds.left && metrics.layout.editingBounds.right < metrics.layout.worldBounds.right && metrics.layout.editingBounds.bottom > metrics.layout.worldBounds.bottom && metrics.layout.editingBounds.top < metrics.layout.worldBounds.top, `${label}: editing bounds keep hit targets inside the visible scene ${JSON.stringify(metrics.layout)}`);
    const before = await page.locator("#stage").boundingBox();
    await page.mouse.move(metrics.panel.x + metrics.panel.width / 2, metrics.panel.y + metrics.panel.height / 2);
    await page.mouse.wheel(0, 700);
    await wait(80);
    const after = await page.locator("#stage").boundingBox();
    assert(Math.abs(before.y - after.y) < 1 && Math.abs(before.height - after.height) < 1, `${label}: stage stays fixed while panel scrolls`);
    assert(await page.locator("#forcePanel").evaluate(node => node.scrollTop > 0), `${label}: panel consumed the wheel gesture`);
    await page.locator("#forcePanel").evaluate(node => { node.scrollTop = 0; });
  };
  const openFresh = async (path, label) => {
    // Clear only after the outgoing page's draft/pagehide save. Clearing before
    // navigation races that save and can silently reuse the preceding fixture.
    await page.goto(`${origin}${path}?playwright=${encodeURIComponent(label)}-${Date.now()}&playwright-reset=1`);
    await waitForApp();
    await page.evaluate(() => { const url = new URL(location.href); url.searchParams.delete("playwright-reset"); history.replaceState(null, "", url); });
    assert(await appRuntime() === "editable", `${label}: editable startup`);
  };
  const verifyMissingRuntime = async () => {
    for (const missing of ["scorm", "activity-flow"]) {
      const label = `missing ${missing} runtime`;
      await page.goto(`${origin}/sim/force-orthogonal-decomposition/index.html?missing-runtime=${missing}&playwright=${encodeURIComponent(label)}`);
      await waitForApp(label);
      const safety = await page.evaluate(() => {
        const selectors = ["#originHit", "#pointHit", "#thetaHit", "#directionEdit0", "#perpendicularEdit0", "#componentEdit0"];
        return {
          runtime: window.__forceOrthogonalApp.getRuntimeState(),
          standalone: Boolean(window.SimScorm?.isStandalone?.()),
          practiceVisible: !document.querySelector("#practicePanel")?.classList.contains("is-hidden"),
          summaryVisible: !document.querySelector("#summaryPanel")?.classList.contains("is-hidden"),
          technicalVisible: !document.querySelector("#technicalPanel")?.classList.contains("is-hidden"),
          stageTargets: selectors.map(selector => {
            const node = document.querySelector(selector);
            return { selector, hidden: Boolean(node?.hidden), disabled: Boolean(node?.disabled) };
          }),
          navigation: ["#goSummary", "#submitAttempt"].map(selector => ({ selector, disabled: Boolean(document.querySelector(selector)?.disabled) }))
        };
      });
      assert(safety.runtime === "load-error", `${label}: missing dependency did not lock the runtime ${JSON.stringify(safety)}`);
      assert(!safety.standalone && !safety.practiceVisible && !safety.summaryVisible && safety.technicalVisible, `${label}: missing dependency exposed an editable or standalone route ${JSON.stringify(safety)}`);
      assert(safety.stageTargets.every(item => item.hidden && item.disabled), `${label}: stage target remained active ${JSON.stringify(safety.stageTargets)}`);
      assert(safety.navigation.every(item => item.disabled), `${label}: answer/submit control remained active ${JSON.stringify(safety.navigation)}`);
    }
  };
  const touchStageNavigation = async (path, label) => {
    await openFresh(path, `${label} touch navigation`);
    await page.setViewportSize({ width: 320, height: 500 });
    for (const index of [0, 1, 2]) {
      await click(page.locator(`[data-question-index="${index}"]`));
      const plan = await scenePlan();
      for (const direction of plan.directions) await dragTarget("#originHit", direction, "touch");
      assert((await appState()).directions.length === 2, `${label}: touch navigation setup created two directions`);
      await touchTap(page.locator("#stageNextButton"));
      assert((await appState()).phase === "perpendiculars", `${label}: real touch tap activates stage next button`);
      assert(await page.locator('#diagram [data-label="force-head"]').count() === 0, `${label}: no extra P label is drawn at the force arrowhead`);
      assert((await page.locator("#pointHit").getAttribute("aria-label")).includes("原力箭嘴頂點開始畫垂線"), `${label}: the unlabeled arrowhead retains a descriptive interaction name`);
      const unobstructed = await page.evaluate(() => {
        const nav = document.querySelector(".stage-navigation").getBoundingClientRect();
        const caption = document.querySelector(".stage-caption").getBoundingClientRect();
        const canvas = document.querySelector("#stageCanvas").getBoundingClientRect();
        const target = document.querySelector("#pointHit").getBoundingClientRect();
        const button = document.querySelector("#stageBackButton");
        const rect = button.getBoundingClientRect();
        return caption.right <= nav.left && nav.bottom <= canvas.top && target.top >= canvas.top - 1 &&
          document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === button;
      });
      assert(unobstructed, `${label}: question ${index + 1} caption, point hit and back button occupy separate regions`);
      await touchTap(page.locator("#stageBackButton"));
      assert((await appState()).phase === "directions", `${label}: real touch tap activates stage back button`);
    }
  };
  const runDirect = async (path, label, firstMode) => {
    await touchStageNavigation(path, label);
    await openFresh(path, label);
    await layoutContract(`${label} 390x600`, 390, 600);
    await layoutContract(`${label} 320x500`, 320, 500);
    await layoutContract(`${label} short iframe 390x320`, 390, 320);
    await layoutContract(`${label} short iframe 520x320`, 520, 320);
    await layoutContract(`${label} landscape 667x375`, 667, 375);
    await layoutContract(`${label} 320x500 restored height`, 320, 500);
    await click(page.locator("#goSummary"));
    assert(await page.locator("#summaryWarning").textContent().then(text => text.includes("仍有未作答項目")), `${label}: empty summary identifies incomplete work`);
    assert(!(await page.locator("#summaryList").textContent()).includes("/100"), `${label}: pre-submit summary does not reveal scores`);
    await page.evaluate(() => {
      window.__incompleteConfirmMessage = "";
      window.confirm = message => { window.__incompleteConfirmMessage = String(message); return false; };
    });
    await click(page.locator("#submitAttempt"));
    const incompleteConfirmMessage = await page.evaluate(() => window.__incompleteConfirmMessage);
    assert(incompleteConfirmMessage.includes("仍有未作答項目") && await appRuntime() === "editable" && await page.locator("#summaryPanel").isVisible(), `${label}: incomplete final submission requires an explicit confirmation`);
    await click(page.locator('#summaryList [data-edit-question="0"]'));
    for (const index of [0, 1, 2]) {
      await click(page.locator(`[data-question-index="${index}"]`));
      const layout = await page.evaluate(() => window.__forceOrthogonalApp.getLayoutMetrics());
      const expected = {
        left: layout.viewBox.x - layout.origin.x,
        right: layout.viewBox.x + layout.viewBox.width - layout.origin.x,
        bottom: layout.origin.y - layout.viewBox.y - layout.viewBox.height,
        top: layout.origin.y - layout.viewBox.y
      };
      assert(["left", "right", "bottom", "top"].every(key => Math.abs(layout.worldBounds[key] - expected[key]) < 1e-8), `${label}: scene ${layout.sceneId} four-edge bounds are viewBox-derived`);
      assert(layout.editingBounds.left > layout.worldBounds.left && layout.editingBounds.right < layout.worldBounds.right && layout.editingBounds.bottom > layout.worldBounds.bottom && layout.editingBounds.top < layout.worldBounds.top, `${label}: scene ${layout.sceneId} controls remain reachable at 320px`);
    }
    await page.setViewportSize({ width: 1100, height: 760 });
    await wait(80);
    for (const index of [0, 1, 2]) {
      await click(page.locator(`[data-question-index="${index}"]`));
      const layout = await page.evaluate(() => window.__forceOrthogonalApp.getLayoutMetrics());
      assert(layout.editingBounds.left > layout.worldBounds.left && layout.editingBounds.right < layout.worldBounds.right && layout.editingBounds.bottom > layout.worldBounds.bottom && layout.editingBounds.top < layout.worldBounds.top, `${label}: scene ${layout.sceneId} controls remain reachable after zoom/resize`);
    }
    await page.setViewportSize({ width: 320, height: 500 });
    await wait(80);
    await click(page.locator('[data-question-index="2"]'));
    await constructQuestion("touch", false);
    assert((await appState()).scenarioId === "inclined-gravity" && (await appState()).phase === "formulas", `${label}: gravity construction did not complete at 320x500`);
    await openFresh(path, `${label} after narrow gravity`);
    assert(await appRuntime() === "editable", `${label}: narrow gravity verification reset to editable startup`);
    await page.setViewportSize({ width: 1100, height: 760 });
    await wait(80);
    await constructQuestion(firstMode, true);
    await exerciseDirectEditing();
    await click(page.locator('[data-question-index="1"]'));
    await constructQuestion("touch", false);
    await click(page.locator('[data-question-index="2"]'));
    await constructQuestion("mouse", false);
    for (const [width, height] of [[390, 844], [320, 500], [390, 320], [667, 375], [1100, 760]]) {
      await page.setViewportSize({ width, height });
      await wait(80);
      for (const index of [0, 1, 2]) {
        await click(page.locator(`[data-question-index="${index}"]`));
        await assertThetaTypography(page, `${label} question ${index + 1} ${width}x${height}`);
      }
    }
    const savedQuestions = JSON.stringify(await page.evaluate(() => window.__forceOrthogonalApp.getActivityState().questions.map(question => ({
      scenarioId: question.scenarioId,
      phase: question.phase,
      directions: question.directions.map(item => ({ key: item.key, unit: item.unit, axisKey: item.axisKey || item.axis || null })),
      perpendiculars: question.perpendiculars,
      components: question.components,
      theta: question.theta,
      formulas: question.formulas
    }))));
    await page.reload();
    await waitForApp();
    const restoredQuestions = JSON.stringify(await page.evaluate(() => window.__forceOrthogonalApp.getActivityState().questions.map(question => ({
      scenarioId: question.scenarioId,
      phase: question.phase,
      directions: question.directions.map(item => ({ key: item.key, unit: item.unit, axisKey: item.axisKey || item.axis || null })),
      perpendiculars: question.perpendiculars,
      components: question.components,
      theta: question.theta,
      formulas: question.formulas
    }))));
    assert(restoredQuestions === savedQuestions, label + ": reload restores all three authoritative questions " + JSON.stringify({ saved: savedQuestions, restored: restoredQuestions }));
    await click(page.locator("#goSummary"));
    assert(await page.locator("#summaryPanel").isVisible(), `${label}: summary is visible`);
    await assertThetaTypography(page, label + " summary");
    await click(page.locator("#submitAttempt"));
    try { await page.waitForFunction(() => window.__forceOrthogonalApp.getRuntimeState() === "review"); }
    catch (error) { throw new Error(`${label}: review wait failed state=${JSON.stringify(await appState())} runtime=${await appRuntime()}: ${error.message}`); }
    assert((await page.locator("#reviewCompletion").textContent()).includes("形成性"), `${label}: final review is explicit formative feedback`);
    await assertThetaTypography(page, label + " review");
    await page.reload();
    await waitForApp();
    assert(await appRuntime() === "review", `${label}: finished reload stays review-only`);
    assert(await page.locator("#reviewPanel").isVisible(), `${label}: review panel survives reload`);
    const assertCompletedLocked = async suffix => {
      assert(await appRuntime() === "review", `${label}: ${suffix} stays in review`);
      assert(await page.locator("#reviewActions button").count() === 0, `${label}: ${suffix} has no clear/restart action`);
      assert(!/清除本機紀錄|重新開始/.test(await page.locator("#reviewPanel").innerText()), `${label}: ${suffix} does not offer a reset route`);
      assert(await page.locator("#practicePanel").isHidden(), `${label}: ${suffix} keeps practice controls hidden`);
      assert(await page.locator("#touchPreview").isHidden(), `${label}: ${suffix} does not retain a touch preview`);
      const before = await page.evaluate(() => JSON.stringify(window.__forceOrthogonalApp.getActivityState()));
      await page.evaluate(() => window.__forceOrthogonalApp.reset());
      assert(await page.evaluate(() => JSON.stringify(window.__forceOrthogonalApp.getActivityState())) === before,
        `${label}: ${suffix} reset handler cannot alter a completed answer`);
    };
    await assertCompletedLocked("complete review");

    // A low score must not provide a shortcut to delete the completed attempt.
    await openFresh(path, label + " incomplete submission");
    await click(page.locator("#goSummary"));
    await page.evaluate(() => { window.confirm = () => true; });
    await click(page.locator("#submitAttempt"));
    await page.waitForFunction(() => window.__forceOrthogonalApp.getRuntimeState() === "review");
    assert((await page.locator("#reviewScore").textContent()).trim() === "0 / 100", `${label}: incomplete attempt receives a real non-perfect score`);
    await assertCompletedLocked("zero-score review");
    const completedCheckpoint = await page.evaluate(() => localStorage.getItem("simlab:force-orthogonal-decomposition:checkpoint"));
    await click(page.locator('#reviewQuestionNavigation [data-question-index="1"]'));
    await assertCompletedLocked("zero-score question switch");
    await page.reload();
    await waitForApp();
    await assertCompletedLocked("zero-score reload");
    assert((await page.locator("#reviewScore").textContent()).trim() === "0 / 100", `${label}: reload retains the score`);
    assert(await page.evaluate(() => localStorage.getItem("simlab:force-orthogonal-decomposition:checkpoint")) === completedCheckpoint,
      `${label}: question switching and reload preserve the exact completed checkpoint`);

    // A malformed standalone checkpoint must expose the same explicit recovery
    // route as the LMS draft path instead of trapping the learner in reload.
    const invalidStandaloneSnapshot = await page.evaluate(() => {
      const P = window.ForceOrthogonalDecompositionPersistence;
      const snapshot = P.makeSnapshot("draft", P.freshDraft());
      const question = snapshot.answer.questions[2];
      const scene = window.ForceOrthogonalDecompositionModel.getScenario("inclined-gravity");
      question.phase = "perpendiculars";
      question.directions = scene.axes.map((axis, index) => ({ key: `D${index + 1}`, unit: { ...axis.unit }, axisKey: axis.key }));
      question.perpendiculars = [{ key: "P1", end: { ...scene.forceHead }, targetKey: null }];
      return JSON.stringify(snapshot);
    });
    const recoveryPage = await page.context().newPage();
    await recoveryPage.addInitScript(snapshotJson => {
      const seedKey = "simlab:force-orthogonal-decomposition:invalid-seed";
      if (sessionStorage.getItem(seedKey) === "1") return;
      sessionStorage.setItem(seedKey, "1");
      localStorage.setItem("simlab:force-orthogonal-decomposition:checkpoint", JSON.stringify({
        "cmi.suspend_data": snapshotJson,
        "cmi.core.lesson_status": "incomplete",
        "cmi.core.score.raw": ""
      }));
    }, invalidStandaloneSnapshot);
    await recoveryPage.goto(`${origin}/sim/force-orthogonal-decomposition/index.html?playwright=${encodeURIComponent(label)}-invalid-standalone`);
    const waitForStandaloneRuntime = async expected => {
      try { await recoveryPage.waitForFunction(runtime => window.__forceOrthogonalApp?.getRuntimeState() === runtime, expected, { timeout: 5000 }); }
      catch (error) {
        const debug = await recoveryPage.evaluate(() => ({
          runtime: window.__forceOrthogonalApp?.getRuntimeState?.(),
          standalone: window.SimScorm?.isStandalone?.(),
          storage: window.SimScorm?.getStandaloneStorageStatus?.(),
          message: document.querySelector("#technicalMessage")?.textContent,
          actionText: document.querySelector('[data-action="reset-invalid-draft"]')?.textContent,
          bundle: localStorage.getItem("simlab:force-orthogonal-decomposition:checkpoint")
        }));
        throw new Error(`${label}: standalone recovery expected ${expected}: ${JSON.stringify(debug)}: ${error.message}`);
      }
    };
    await waitForStandaloneRuntime("load-error");
    assert((await recoveryPage.locator("#technicalMessage").textContent()).includes("perpendiculars-2"), `${label}: standalone decoder reason is shown`);
    assert(await recoveryPage.locator('[data-action="reset-invalid-draft"]').count() === 1, `${label}: standalone recovery action is shown`);
    await recoveryPage.evaluate(() => { window.confirm = () => true; });
    await recoveryPage.locator('[data-action="reset-invalid-draft"]').click();
    await waitForStandaloneRuntime("editable");
    const standaloneRecovered = await recoveryPage.evaluate(() => ({
      state: window.__forceOrthogonalApp.getActivityState(),
      bundle: JSON.parse(localStorage.getItem("simlab:force-orthogonal-decomposition:checkpoint") || "null")
    }));
    assert(standaloneRecovered.state.phase === "practice" && standaloneRecovered.state.currentQuestion === 0 && standaloneRecovered.state.questions[2].perpendiculars.length === 0, `${label}: standalone recovery starts a fresh editable attempt`);
    assert(!standaloneRecovered.bundle?.["cmi.suspend_data"], `${label}: standalone recovery does not retain the invalid draft checkpoint`);
    await recoveryPage.close();
  };

  if (scope === "all" || scope === "direct") {
    progress("missing runtime start");
    await verifyMissingRuntime();
    progress("missing runtime done");
    progress("direct source start");
    await runDirect("/sim/force-orthogonal-decomposition/index.html", "source", "mouse");
    progress("direct source done");
    await runDirect("/packaged/force-orthogonal-decomposition/index.html", "extracted", "mouse");
    progress("direct extracted done");
  }

  // Shared SCORM can structurally parse a pending envelope before the
  // activity validates its nested authoritative answer. The production page
  // must quarantine that case instead of enabling a retry.
  if (scope === "all" || scope === "direct") {
    const invalidPendingPage = await page.context().newPage();
    await invalidPendingPage.addInitScript(() => {
      const review = { version: 1, activity: "force-orthogonal-decomposition", kind: "review", answer: { schemaVersion: 1, questions: [] }, score: 100, passed: true };
      const pending = { version: 1, activity: "force-orthogonal-decomposition", kind: "pending-final", payload: { reviewJson: JSON.stringify(review), score: 100, maxScore: 100, passed: true } };
      localStorage.setItem("simlab:force-orthogonal-decomposition:checkpoint", JSON.stringify({ "cmi.suspend_data": JSON.stringify(pending), "cmi.core.lesson_status": "incomplete", "cmi.core.score.raw": "" }));
    });
    progress("invalid pending start");
    await invalidPendingPage.goto(`${origin}/sim/force-orthogonal-decomposition/index.html?playwright=invalid-pending`);
    await invalidPendingPage.waitForFunction(() => window.__forceOrthogonalApp?.getRuntimeState() === "quarantined");
    assert(await invalidPendingPage.locator("#technicalActions button").count() === 0, "invalid pending startup has no retry action");
    await invalidPendingPage.close();
  }

  const frameSemanticState = frame => frame.evaluate(() => {
    const state = window.__forceOrthogonalApp.getState();
    return {
      phase: state.phase,
      directions: state.directions.map(item => ({ key: item.key, unit: item.unit, axisKey: item.axisKey || item.axis || null })),
      perpendiculars: state.perpendiculars,
      components: state.components,
      theta: state.theta,
      formulas: state.formulas
    };
  });
  const frameScenePlan = frame => frame.evaluate(() => {
    const state = window.__forceOrthogonalApp.getState();
    const M = window.ForceOrthogonalDecompositionModel;
    const scene = M.getScenario(state.scenarioId);
    return { sceneId: scene.id, directions: scene.axes.map(axis => M.add(scene.origin, M.scale(axis.unit, 180))), feet: scene.axes.map(axis => M.projectionFoot(scene.forceHead, axis, scene)) };
  });
  const frameClick = async (frame, selector) => {
    await frame.locator(selector).click();
    await wait(60);
  };
  const frameTouchLocator = async (frame, sourceSelector, targetSelector, label) => {
    await frame.evaluate(() => window.__forceOrthogonalApp.clearTouchTelemetry());
    const sourceStatus = await frame.locator(sourceSelector).evaluate(node => ({ disabled: node.disabled, hidden: node.hidden, rect: node.getBoundingClientRect().toJSON(), phase: window.__forceOrthogonalApp.getState().phase }));
    assert(!sourceStatus.disabled && !sourceStatus.hidden, label + ": source is enabled and visible " + JSON.stringify(sourceStatus));
    const source = await frame.locator(sourceSelector).evaluate(node => node.getBoundingClientRect().toJSON());
    const target = await frame.locator(targetSelector).evaluate(node => node.getBoundingClientRect().toJSON());
    const iframe = await page.locator("iframe").boundingBox();
    assert(source && target && iframe, label + ": formula target boxes exist");
    const beforeMetrics = await embeddedTargetMetrics(frame);
    await touchDrag(
      { x: iframe.x + source.x + source.width / 2, y: iframe.y + source.y + source.height / 2 },
      { x: iframe.x + target.x + target.width / 2, y: iframe.y + target.y + target.height / 2 },
      async () => assert(await frame.locator("#touchPreview").isHidden(), label + ": formula drag uses its existing token preview only")
    );
    await assertTrustedPointerTransaction(frame, 0, label + " boxes=" + JSON.stringify({ source, target }));
    await assertEmbeddedTargetMetricsStable(frame, beforeMetrics, label);
  };
  const exerciseEmbeddedTargets = async (frame, child, label) => {
    await frameClick(frame, '[data-question-index="1"]');
    await exercisePreviewCancellation(frame, label);
    const plan = await frameScenePlan(frame);
    for (let index = 0; index < plan.directions.length; index += 1) await frameTouchTarget(frame, "#originHit", plan.directions[index], label + " direction " + index);
    assert((await frameSemanticState(frame)).directions.length === 2, label + ": directions created");
    await frameClick(frame, "#nextButton");
    for (let index = 0; index < plan.feet.length; index += 1) await frameTouchTarget(frame, "#pointHit", plan.feet[index], label + " perpendicular " + index);
    assert((await frameSemanticState(frame)).perpendiculars.length === 2, label + ": perpendiculars created");
    await frameClick(frame, "#nextButton");
    for (let index = 0; index < plan.feet.length; index += 1) await frameTouchTarget(frame, "#originHit", plan.feet[index], label + " component " + index);
    assert((await frameSemanticState(frame)).components.length === 2, label + ": components created");
    await frameClick(frame, "#nextButton");
    const firstTheta = await frame.evaluate(() => window.ForceOrthogonalDecompositionModel.thetaCandidates(window.__forceOrthogonalApp.getState().directions, window.ForceOrthogonalDecompositionModel.getScenario(window.__forceOrthogonalApp.getState().scenarioId))[0]);
    await frameTouchTarget(frame, "#thetaHit", firstTheta.center, label + " docked theta");
    assert((await frameSemanticState(frame)).theta === firstTheta.key, label + ": docked theta placed");
    await frameClick(frame, "#nextButton");
    await frame.evaluate(() => {
      const panel = document.querySelector("#forcePanel");
      const source = document.querySelector("#formulaSin");
      const panelBox = panel.getBoundingClientRect();
      const sourceBox = source.getBoundingClientRect();
      // Keep the palette and both slots inside the independently scrolling
      // panel viewport; scrolling past them would put the touch point back on
      // the fixed stage underneath the panel.
      panel.scrollTop = Math.max(0, panel.scrollTop + sourceBox.top - panelBox.top - 8);
    });
    await wait(80);
    const expectations = await frame.evaluate(() => window.ForceOrthogonalDecompositionModel.formulaExpectations(window.__forceOrthogonalApp.getState()));
    for (const expectation of expectations) {
      const token = expectation.value === "sin" ? "#formulaSin" : "#formulaCos";
      const wrong = expectation.value === "sin" ? "#formulaCos" : "#formulaSin";
      const slot = "#formulaSlot" + expectation.key;
      await frameTouchLocator(frame, wrong, slot, label + " wrong formula " + expectation.key);
      const wrongState = await frameSemanticState(frame);
      assert(wrongState.formulas[expectation.key] === (expectation.value === "sin" ? "cos" : "sin"), label + ": formula answer changes before repair " + JSON.stringify({ expectation, state: wrongState, source: wrong, slot, telemetry: await telemetry(frame), boxes: await frame.evaluate(({ sourceSelector, slotSelector }) => ({ iframeDocument: { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight }, stage: document.querySelector("#stage").getBoundingClientRect().toJSON(), panel: document.querySelector("#forcePanel").getBoundingClientRect().toJSON(), source: document.querySelector(sourceSelector).getBoundingClientRect().toJSON(), slot: document.querySelector(slotSelector).getBoundingClientRect().toJSON() }), { sourceSelector: wrong, slotSelector: slot }), iframe: await page.locator("iframe").boundingBox() }));
      await frameTouchLocator(frame, token, slot, label + " correct formula " + expectation.key);
    }
    assert((await frameSemanticState(frame)).formulas.F1 && (await frameSemanticState(frame)).formulas.F2, label + ": formula tokens dropped into slots");
    await frameClick(frame, "#backButton");
    const upperTheta = await frame.evaluate(() => {
      const state = window.__forceOrthogonalApp.getState();
      const scene = window.ForceOrthogonalDecompositionModel.getScenario(state.scenarioId);
      return window.ForceOrthogonalDecompositionModel.thetaCandidates(state.directions, scene).find(item => item.key === "theta-head-parallel");
    });
    assert(upperTheta, label + ": free-angle upper P theta exists");
    await frameTouchTarget(frame, "#thetaHit", upperTheta.center, label + " placed upper-P theta");
    assert((await frameSemanticState(frame)).theta === "theta-head-parallel", label + ": placed theta moved to upper P angle");
    await frameClick(frame, "#nextButton");
    const original = await frame.evaluate(() => {
      const state = window.__forceOrthogonalApp.getState();
      const scene = window.ForceOrthogonalDecompositionModel.getScenario(state.scenarioId);
      return {
        directions: state.directions.map(item => ({ x: scene.origin.x + item.unit.x * 120, y: scene.origin.y + item.unit.y * 120 })),
        perpendiculars: state.perpendiculars.map(item => item.end),
        components: state.components.map(item => item.end)
      };
    });
    for (let index = 0; index < 4; index += 1) await frameClick(frame, "#backButton");
    const sceneOrigin = await frame.evaluate(() => window.ForceOrthogonalDecompositionModel.getScenario(window.__forceOrthogonalApp.getState().scenarioId).origin);
    const nudge = (point, selector) => {
      if (!selector.includes("directionEdit")) return { x: point.x + 65, y: point.y - 45 };
      const dx = point.x - sceneOrigin.x;
      const dy = point.y - sceneOrigin.y;
      return { x: sceneOrigin.x + dx * Math.cos(Math.PI / 10) - dy * Math.sin(Math.PI / 10), y: sceneOrigin.y + dx * Math.sin(Math.PI / 10) + dy * Math.cos(Math.PI / 10) };
    };
    const editAndRestore = async (selector, point, editLabel) => {
      const before = await frameSemanticState(frame);
      await frameTouchTarget(frame, selector, nudge(point, selector), editLabel + " changed");
      const changed = await frameSemanticState(frame);
      assert(JSON.stringify(changed) !== JSON.stringify(before), editLabel + ": semantic state changed " + JSON.stringify({ selector, point, nudge: nudge(point, selector), before, changed, telemetry: await telemetry(frame) }));
      await frameTouchTarget(frame, selector, point, editLabel + " restored");
    };
    for (let index = 0; index < 2; index += 1) await editAndRestore("#directionEdit" + index, original.directions[index], label + " direction edit " + index);
    await frameClick(frame, "#nextButton");
    for (let index = 0; index < 2; index += 1) await editAndRestore("#perpendicularEdit" + index, original.perpendiculars[index], label + " perpendicular edit " + index);
    await frameClick(frame, "#nextButton");
    for (let index = 0; index < 2; index += 1) await editAndRestore("#componentEdit" + index, original.components[index], label + " component edit " + index);
    await frameClick(frame, "#nextButton");
    const repairedTheta = await frame.evaluate(() => window.ForceOrthogonalDecompositionModel.thetaCandidates(window.__forceOrthogonalApp.getState().directions, window.ForceOrthogonalDecompositionModel.getScenario(window.__forceOrthogonalApp.getState().scenarioId))[0]);
    await frameTouchTarget(frame, "#thetaHit", repairedTheta.center, label + " re-angle after edit");
    await frameClick(frame, "#nextButton");
    assert((await frameSemanticState(frame)).phase === "formulas", label + ": edits return to formula phase");
    await frame.evaluate(() => { const panel = document.querySelector("#forcePanel"); panel.scrollTop = 0; });
    const finalState = await frameSemanticState(frame);
    assert(finalState.directions.length === 2 && finalState.perpendiculars.length === 2 && finalState.components.length === 2, label + ": every production target retained its answer");
  };
  const embed = async (activityPath, width = 390, height = 500) => {
    progress("embedded start " + activityPath + " " + width + "x" + height);
    await page.setViewportSize({ width: Math.max(width, 390), height: Math.max(700, height + 160) });
    await page.goto(origin + "/tools/force-orthogonal-decomposition-embedded-host.html?src=" +
      encodeURIComponent(activityPath + "?embedded=" + Date.now()) + "&w=" + width + "&h=" + height);
    let frame = null;
    for (let attempt = 0; attempt < 20 && !frame; attempt += 1) {
      frame = page.frames().find(item => item !== page.mainFrame() && item.url().includes("force-orthogonal-decomposition/index.html")) || null;
      if (!frame) await wait(100);
    }
    assert(frame, `embedded activity frame loaded: ${page.frames().map(item => item.url()).join(" | ")}`);
    try { await frame.waitForFunction(() => Boolean(window.__forceOrthogonalApp?.getState())); }
    catch (error) { throw new Error(`${activityPath} ${width}x${height}: frame app wait failed url=${frame.url()}: ${error.message}`); }
    progress("embedded frame ready " + activityPath + " " + width + "x" + height);
    const child = selector => frame.locator(selector);
    const parentScroll = () => page.evaluate(() => window.scrollY);
    const combinedMetrics = async () => {
      const iframe = await page.locator("iframe").boundingBox();
      const host = await page.evaluate(() => {
        const node = document.querySelector("iframe");
        const rect = node.getBoundingClientRect();
        const vv = window.visualViewport;
        return {
          scrollY: window.scrollY,
          docScrollTop: document.documentElement.scrollTop,
          docScrollHeight: document.documentElement.scrollHeight,
          visualViewport: vv ? { offsetTop: vv.offsetTop, pageTop: vv.pageTop, height: vv.height, width: vv.width } : null,
          iframe: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        };
      });
      const activity = await frame.evaluate(() => {
        const vv = window.visualViewport;
        const stage = document.querySelector("#stage").getBoundingClientRect();
        const panel = document.querySelector("#forcePanel");
        return {
          docScrollTop: document.documentElement.scrollTop,
          docScrollHeight: document.documentElement.scrollHeight,
          visualViewport: vv ? { offsetTop: vv.offsetTop, pageTop: vv.pageTop, height: vv.height, width: vv.width } : null,
          stage: { x: stage.x, y: stage.y, width: stage.width, height: stage.height },
          panelScrollTop: panel.scrollTop,
          panelScrollHeight: panel.scrollHeight,
          panelClientHeight: panel.clientHeight
        };
      });
      const localStage = activity.stage;
      assert(iframe && localStage, "iframe and stage metrics have boxes");
      return {
        host,
        activity: {
          ...activity,
          stagePage: { x: iframe.x + localStage.x, y: iframe.y + localStage.y, width: localStage.width, height: localStage.height }
        }
      };
    };
    const assertUnchanged = (before, after, label, includePanel = false) => {
      assert(before.host.scrollY === after.host.scrollY, label + ": host scroll fixed");
      assert(before.host.docScrollTop === after.host.docScrollTop, label + ": host document scroll fixed");
      assert(JSON.stringify(before.host.visualViewport) === JSON.stringify(after.host.visualViewport), label + ": host visual viewport fixed");
      assert(JSON.stringify(before.host.iframe) === JSON.stringify(after.host.iframe), label + ": iframe rectangle fixed");
      assert(before.activity.docScrollTop === after.activity.docScrollTop, label + ": activity document scroll fixed");
      assert(JSON.stringify(before.activity.visualViewport) === JSON.stringify(after.activity.visualViewport), label + ": activity visual viewport fixed");
      assert(JSON.stringify(before.activity.stage) === JSON.stringify(after.activity.stage), label + ": local stage rectangle fixed");
      assert(JSON.stringify(before.activity.stagePage) === JSON.stringify(after.activity.stagePage), label + ": page stage rectangle fixed");
      if (includePanel) assert(before.activity.panelScrollTop === after.activity.panelScrollTop, label + ": panel scroll fixed");
    };
    const touchInPage = async (start, end) => {
      touchId += 1;
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touchPoint(start)] });
      for (let index = 1; index <= 12; index += 1) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [touchPoint({ x: start.x + (end.x - start.x) * index / 12, y: start.y + (end.y - start.y) * index / 12 })] });
        await wait(10);
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await wait(100);
    };
    const childDiagramPoint = async point => {
      const box = await child("#diagram").boundingBox();
      const scale = Math.min(box.width / 560, box.height / 360);
      const frameOrigin = await frame.evaluate(() => window.__forceOrthogonalApp.getState().scenarioId === "horizontal-vertical" ? { x: 120, y: 280 } : { x: 170, y: 225 });
      const target = { x: box.x + (box.width - 560 * scale) / 2 + (frameOrigin.x + point.x) * scale, y: box.y + (box.height - 360 * scale) / 2 + (frameOrigin.y - point.y) * scale };
      return target;
    };
    await page.evaluate(() => scrollTo(0, 0));
    const iframeBox = await page.locator("iframe").boundingBox();
    const stageLocal = await child("#stage").evaluate(node => node.getBoundingClientRect().toJSON());
    const stage = stageLocal;
    const stagePage = iframeBox && stageLocal ? { x: iframeBox.x + stageLocal.x, y: iframeBox.y + stageLocal.y, width: stageLocal.width, height: stageLocal.height } : null;
    assert(stage && stagePage, "embedded stage has a page-level box");
    const stageStart = { x: stagePage.x + stagePage.width * .82, y: stagePage.y + stagePage.height * .72 };
    const beforeStageMetrics = await combinedMetrics();
    await touchInPage(stageStart, { x: stageStart.x, y: stageStart.y - 210 });
    const afterStageMetrics = await combinedMetrics();
    assert(afterStageMetrics.host.scrollY > beforeStageMetrics.host.scrollY, "embedded blank-stage touch scrolls the enclosing host " + JSON.stringify({ before: beforeStageMetrics, after: afterStageMetrics, stage, iframeBox }));
    assert(afterStageMetrics.activity.docScrollTop === beforeStageMetrics.activity.docScrollTop, "stage owner keeps activity document fixed");
    assert(JSON.stringify(afterStageMetrics.activity.visualViewport) === JSON.stringify(beforeStageMetrics.activity.visualViewport), "stage owner keeps activity visual viewport fixed");
    assert(Math.abs((afterStageMetrics.activity.stagePage.y - beforeStageMetrics.activity.stagePage.y) - (afterStageMetrics.host.iframe.y - beforeStageMetrics.host.iframe.y)) < 1, "stage and iframe move with the enclosing host");
    await page.evaluate(() => scrollTo(0, 0));
    const panelLocal = await child("#forcePanel").evaluate(node => node.getBoundingClientRect().toJSON());
    const panel = panelLocal;
    const panelPage = iframeBox && panelLocal ? { x: iframeBox.x + panelLocal.x, y: iframeBox.y + panelLocal.y, width: panelLocal.width, height: panelLocal.height } : null;
    assert(panel && panelPage, "embedded panel has a page-level box");
    await child("#forcePanel").evaluate(node => { node.scrollTop = 0; });
    const beforePanelTop = await combinedMetrics();
    await touchInPage({ x: panelPage.x + panelPage.width / 2, y: panelPage.y + panelPage.height * .2 }, { x: panelPage.x + panelPage.width / 2, y: panelPage.y + panelPage.height * .82 });
    const afterPanelTop = await combinedMetrics();
    assert(afterPanelTop.activity.panelScrollTop === 0, "panel top boundary keeps panel at top");
    assertUnchanged(beforePanelTop, afterPanelTop, "panel top boundary", true);
    await touchInPage({ x: panelPage.x + panelPage.width / 2, y: panelPage.y + panelPage.height * .78 }, { x: panelPage.x + panelPage.width / 2, y: panelPage.y + panelPage.height * .2 });
    const afterPanelScroll = await combinedMetrics();
    assert(afterPanelScroll.activity.panelScrollTop > 0, "embedded panel touch scrolls only the panel");
    assertUnchanged(beforePanelTop, afterPanelScroll, "panel range", false);
    await child("#forcePanel").evaluate(node => { node.scrollTop = node.scrollHeight; });
    const beforePanelBottom = await combinedMetrics();
    await touchInPage({ x: panelPage.x + panelPage.width / 2, y: panelPage.y + panelPage.height * .55 }, { x: panelPage.x + panelPage.width / 2, y: panelPage.y + panelPage.height * .1 });
    const afterPanelBottom = await combinedMetrics();
    assert(Math.abs(afterPanelBottom.activity.panelScrollTop - (afterPanelBottom.activity.panelScrollHeight - afterPanelBottom.activity.panelClientHeight)) < 1, "panel bottom boundary keeps panel at bottom");
    assertUnchanged(beforePanelBottom, afterPanelBottom, "panel bottom boundary", true);
    await child("#forcePanel").evaluate(node => { node.scrollTop = 0; });
    await exerciseEmbeddedTargets(frame, child, "embedded " + width + "x" + height);
    progress("embedded targets done " + activityPath + " " + width + "x" + height);
    for (const selector of ["#stage", "#originHit", "#pointHit", "#thetaHit", "#directionEdit0", "#directionEdit1", "#perpendicularEdit0", "#perpendicularEdit1", "#componentEdit0", "#componentEdit1", "#formulaSin", "#formulaCos", "#formulaSlotF1", "#formulaSlotF2", "#forcePanel"]) {
      assert(await child(selector).count() === 1, `embedded target ${selector} exists`);
    }
    const touchStyles = await frame.evaluate(() => ({ stage: getComputedStyle(document.querySelector("#stage")).touchAction, origin: getComputedStyle(document.querySelector("#originHit")).touchAction, formula: getComputedStyle(document.querySelector("#formulaSin")).touchAction, panel: getComputedStyle(document.querySelector("#forcePanel")).overscrollBehaviorY }));
    assert(touchStyles.stage === "pan-y" && touchStyles.origin === "none" && touchStyles.formula === "none" && touchStyles.panel === "contain", "embedded touch ownership styles are explicit");
  };
  const shortEmbeddedLayout = async activityPath => {
    for (const [width, height] of [[390, 320], [520, 320], [667, 375]]) {
      await page.setViewportSize({ width: Math.max(width, 390), height: 700 });
      await page.goto(origin + "/tools/force-orthogonal-decomposition-embedded-host.html?src=" + encodeURIComponent(activityPath) + "&w=" + width + "&h=" + height);
      const frame = page.frames().find(item => item !== page.mainFrame() && item.url().includes("force-orthogonal-decomposition/index.html"));
      await frame.waitForFunction(() => Boolean(window.__forceOrthogonalApp?.getState()));
      await wait(100);
      const dimensions = await frame.evaluate(() => ({ height: innerHeight, panel: document.querySelector("#forcePanel").getBoundingClientRect().toJSON(), scrollHeight: document.documentElement.scrollHeight }));
      assert(dimensions.height === height && dimensions.panel.height >= 95 && dimensions.panel.bottom <= height + 1 && dimensions.scrollHeight <= height + 1, `short embedded ${activityPath}: usable panel ${JSON.stringify(dimensions)}`);
      await frame.locator("#goSummary").scrollIntoViewIfNeeded();
      await wait(100);
      await touchTap(frame.locator("#goSummary"));
      assert(await frame.locator("#summaryPanel").isVisible(), `short embedded ${activityPath} ${width}x${height}: trusted touch reaches pre-submit overview`);
      await frame.locator("#submitAttempt").scrollIntoViewIfNeeded();
      const reachable = await frame.locator("#submitAttempt").evaluate(node => { const r = node.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && !node.disabled; });
      assert(reachable, "short embedded: final submission button is reachable in the actual iframe viewport");
      await frame.locator("#returnToPractice").scrollIntoViewIfNeeded();
      await wait(100);
      await touchTap(frame.locator("#returnToPractice"));
      assert(await frame.locator("#practicePanel").isVisible(), "short embedded: return action is reachable");
      // On the shortest canvas, the first gravity arrow's enlarged edit hit
      // overlaps O. Both editing F1 and creating F2 must remain selectable.
      if (width === 390) {
        await frameClick(frame, '[data-question-index="2"]');
        const plan = await frameScenePlan(frame);
        for (const point of plan.directions) await frameTouchTarget(frame, "#originHit", point, "short gravity direction");
        await frameClick(frame, "#nextButton");
        for (const point of plan.feet) await frameTouchTarget(frame, "#pointHit", point, "short gravity perpendicular");
        await frameClick(frame, "#nextButton");
        await frameTouchTarget(frame, "#originHit", plan.feet[0], "short gravity first component");
        const before = await frameSemanticState(frame);
        await frameTouchTarget(frame, "#componentEdit0", { x: plan.feet[0].x - 140, y: plan.feet[0].y }, "short gravity edit first component");
        assert(JSON.stringify((await frameSemanticState(frame)).components[0]) !== JSON.stringify(before.components[0]), "short gravity: first component can still be edited");
        await frameTouchTarget(frame, "#componentEdit0", plan.feet[0], "short gravity repair first component");
        await frameTouchTarget(frame, "#originHit", plan.feet[1], "short gravity second component");
        assert((await frameSemanticState(frame)).components.length === 2 && await frame.evaluate(() => window.__forceOrthogonalApp.isCorrectDecomposition()), "short gravity: overlapping handles permit both correctly placed components");
        await frameClick(frame, "#nextButton");
        await frameClick(frame, '[data-theta-choice="theta-incline"]');
        const thetaVisible = () => frame.evaluate(() => {
          const canvas = document.querySelector("#stageCanvas").getBoundingClientRect();
          const target = document.querySelector("#thetaHit").getBoundingClientRect();
          return target.top >= canvas.top - 1 && target.bottom <= canvas.bottom + 1 && target.left >= canvas.left - 1 && target.right <= canvas.right + 1;
        });
        assert(await thetaVisible(), "short gravity: selected theta and its entire target stay inside the canvas");
        await assertThetaTypography(frame, "short gravity selected theta");
        const saved = await frameSemanticState(frame);
        await frame.evaluate(() => location.reload());
        await frame.waitForFunction(() => window.__forceOrthogonalApp?.getState()?.theta === "theta-incline");
        assert(await thetaVisible(), "short gravity: restored selected theta stays visible");
        await assertThetaTypography(frame, "short gravity restored theta");
        await frameClick(frame, "#goSummary");
        assert(await frame.locator('#diagram [data-label="student-theta"]').count() === 1, "short gravity: summary draws theta exactly once");
        await assertThetaTypography(frame, "short gravity summary theta");
        await frameClick(frame, "#returnToPractice");
        assert(await thetaVisible() && JSON.stringify(await frameSemanticState(frame)) === JSON.stringify(saved), "short gravity: return to editing preserves the visible theta and answer");
      }
    }
  };
  if (scope === "short") {
    await shortEmbeddedLayout("/sim/force-orthogonal-decomposition/index.html");
    await shortEmbeddedLayout("/packaged/force-orthogonal-decomposition/index.html");
  }
  if (scope === "all" || scope === "embedded" || scope === "embedded-source") {
    await embed("/sim/force-orthogonal-decomposition/index.html", 390, 500);
    await embed("/sim/force-orthogonal-decomposition/index.html", 320, 500);
    await shortEmbeddedLayout("/sim/force-orthogonal-decomposition/index.html");
  }
  if (scope === "all" || scope === "embedded" || scope === "embedded-packaged") {
    await embed("/packaged/force-orthogonal-decomposition/index.html", 390, 500);
    await embed("/packaged/force-orthogonal-decomposition/index.html", 320, 500);
    await shortEmbeddedLayout("/packaged/force-orthogonal-decomposition/index.html");
  }

  if (errors.length) throw new Error(`browser console errors: ${errors.join(" | ")}`);
  return { ok: true, message: "force orthogonal source/extracted responsive and trusted-touch checks passed" };
}
