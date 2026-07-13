(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.MirrorRayScoring = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_BUNDLES = 4;
  const PASSING_SCORE = 60;
  const ANGLE_TOLERANCE_DEG = 5;
  const MIN_RAY_LENGTH = 35;
  const MIRROR_HIT_TOLERANCE_PX = 10;
  const SOURCE_TOLERANCE_PX = 12;
  const IMAGE_X_TOLERANCE_PX = 14;
  const IMAGE_Y_TOLERANCE_PX = 14;
  const IMAGE_HEIGHT_TOLERANCE_RATIO = 0.08;
  const DISTINCT_HIT_TOLERANCE_PX = 20;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeAngle(angle) {
    let value = angle % 360;
    if (value > 180) value -= 360;
    if (value <= -180) value += 360;
    return value;
  }

  function angleDistance(a, b) {
    return Math.abs(normalizeAngle(a - b));
  }

  function vectorAngle(vector) {
    return normalizeAngle(Math.atan2(vector.y, vector.x) * 180 / Math.PI);
  }

  function incidentAngleToNormal(source, mirrorPoint) {
    return Math.atan2(Math.abs(mirrorPoint.y - source.y), Math.abs(mirrorPoint.x - source.x)) *
      180 /
      Math.PI;
  }

  function pointDistance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function segmentLength(segment) {
    if (!segment) return 0;
    return pointDistance(segment.start, segment.end);
  }

  function sourcePoint(scene, source) {
    const half = scene.objectHeight / 2;
    return {
      x: scene.objectX,
      y: scene.objectY + (source === "bottom" ? half : -half)
    };
  }

  function correctImage(scene) {
    const half = scene.objectHeight / 2;
    return {
      x: 2 * scene.mirrorX - scene.objectX,
      topY: scene.objectY - half,
      bottomY: scene.objectY + half
    };
  }

  function imageEndpoints(image) {
    if (!image) return null;
    if (Number.isFinite(image.topY) && Number.isFinite(image.bottomY)) {
      return {
        top: { x: image.x, y: image.topY },
        bottom: { x: image.x, y: image.bottomY },
        height: Math.abs(image.bottomY - image.topY)
      };
    }
    const half = image.height / 2;
    const radians = (image.angle || 0) * Math.PI / 180;
    return {
      top: {
        x: image.x - Math.sin(radians) * half,
        y: image.y - Math.cos(radians) * half
      },
      bottom: {
        x: image.x + Math.sin(radians) * half,
        y: image.y + Math.cos(radians) * half
      },
      height: image.height
    };
  }

  function isOnReflectingSide(point, scene) {
    return (point.x - scene.mirrorX) * scene.reflectingSide > 0;
  }

  function isBehindMirror(point, scene) {
    return (point.x - scene.mirrorX) * scene.reflectingSide < 0;
  }

  function isOnMirror(point, scene) {
    return (
      Math.abs(point.x - scene.mirrorX) <= MIRROR_HIT_TOLERANCE_PX &&
      point.y >= scene.mirrorTop - MIRROR_HIT_TOLERANCE_PX &&
      point.y <= scene.mirrorBottom + MIRROR_HIT_TOLERANCE_PX
    );
  }

  function expectedReflectedAngle(bundle, scene) {
    const source = sourcePoint(scene, bundle.source);
    const mirrorPoint = bundle.incident ? bundle.incident.end : source;
    const incidentVector = {
      x: mirrorPoint.x - source.x,
      y: mirrorPoint.y - source.y
    };
    return vectorAngle({ x: -incidentVector.x, y: incidentVector.y });
  }

  function expectedExtensionAngle(bundle, scene) {
    const source = sourcePoint(scene, bundle.source);
    const mirrorPoint = bundle.incident ? bundle.incident.end : source;
    const incidentVector = {
      x: mirrorPoint.x - source.x,
      y: mirrorPoint.y - source.y
    };
    return vectorAngle({ x: incidentVector.x, y: -incidentVector.y });
  }

  function segmentAngle(segment) {
    return vectorAngle({
      x: segment.end.x - segment.start.x,
      y: segment.end.y - segment.start.y
    });
  }

  function isIncidentCorrect(bundle, scene) {
    if (!bundle.incident) return false;
    const source = sourcePoint(scene, bundle.source);
    return (
      pointDistance(bundle.incident.start, source) <= SOURCE_TOLERANCE_PX &&
      segmentLength(bundle.incident) >= MIN_RAY_LENGTH &&
      isOnReflectingSide(bundle.incident.start, scene) &&
      isOnMirror(bundle.incident.end, scene)
    );
  }

  function isReflectedCorrect(bundle, scene) {
    if (!isIncidentCorrect(bundle, scene) || !bundle.reflected) return false;
    return (
      pointDistance(bundle.reflected.start, bundle.incident.end) <= MIRROR_HIT_TOLERANCE_PX &&
      segmentLength(bundle.reflected) >= MIN_RAY_LENGTH &&
      isOnReflectingSide(bundle.reflected.end, scene) &&
      angleDistance(segmentAngle(bundle.reflected), expectedReflectedAngle(bundle, scene)) <=
        ANGLE_TOLERANCE_DEG
    );
  }

  function isExtensionCorrect(bundle, scene) {
    if (!isReflectedCorrect(bundle, scene) || !bundle.extension) return false;
    return (
      pointDistance(bundle.extension.start, bundle.incident.end) <= MIRROR_HIT_TOLERANCE_PX &&
      segmentLength(bundle.extension) >= MIN_RAY_LENGTH &&
      isBehindMirror(bundle.extension.end, scene) &&
      angleDistance(segmentAngle(bundle.extension), expectedExtensionAngle(bundle, scene)) <=
        ANGLE_TOLERANCE_DEG
    );
  }

  function completeBundleCount(bundles) {
    return bundles.filter((bundle) => bundle.incident && bundle.reflected && bundle.extension).length;
  }

  function duplicatePathCount(bundles) {
    let count = 0;
    for (let i = 0; i < bundles.length; i += 1) {
      for (let j = i + 1; j < bundles.length; j += 1) {
        if (
          bundles[i].source === bundles[j].source &&
          bundles[i].incident &&
          bundles[j].incident &&
          pointDistance(bundles[i].incident.end, bundles[j].incident.end) < DISTINCT_HIT_TOLERANCE_PX
        ) count += 1;
      }
    }
    return count;
  }

  function imageScore(answer, scene) {
    const image = answer.image;
    const endpoints = imageEndpoints(image);
    if (!endpoints) return { score: 0, detail: [] };
    const expected = correctImage(scene);
    const centerX = (endpoints.top.x + endpoints.bottom.x) / 2;
    const height = endpoints.height;
    const expectedHeight = scene.objectHeight;
    const heightOk =
      Math.abs(height - expectedHeight) <= expectedHeight * IMAGE_HEIGHT_TOLERANCE_RATIO;
    const verticalOk = Math.abs(endpoints.top.x - endpoints.bottom.x) <= IMAGE_X_TOLERANCE_PX;
    const checks = [
      {
        name: "imageX",
        score: Math.abs(centerX - expected.x) <= IMAGE_X_TOLERANCE_PX ? 10 : 0
      },
      {
        name: "topY",
        score: heightOk && Math.abs(endpoints.top.y - expected.topY) <= IMAGE_Y_TOLERANCE_PX ? 4 : 0
      },
      {
        name: "bottomY",
        score: heightOk && Math.abs(endpoints.bottom.y - expected.bottomY) <= IMAGE_Y_TOLERANCE_PX ? 4 : 0
      },
      {
        name: "upright",
        score: endpoints.bottom.y > endpoints.top.y && heightOk && verticalOk ? 2 : 0
      }
    ];
    return {
      score: checks.reduce((total, check) => total + check.score, 0),
      detail: checks
    };
  }

  function scoreDiagram(answer, scene) {
    const bundles = answer.bundles || [];
    const usableBundles = bundles.slice(0, MAX_BUNDLES);
    const incidentCorrect = usableBundles.filter((bundle) => isIncidentCorrect(bundle, scene));
    const reflectedCorrect = usableBundles.filter((bundle) => isReflectedCorrect(bundle, scene));
    const extensionCorrect = usableBundles.filter((bundle) => isExtensionCorrect(bundle, scene));
    const extraCount = Math.max(0, bundles.length - MAX_BUNDLES);
    const imageTypeScore = answer.imageChoice === "virtual" ? 10 : 0;
    const placedImage = imageScore(answer, scene);
    const completed = completeBundleCount(usableBundles);
    const duplicates = duplicatePathCount(usableBundles);
    const cleanScore =
      completed === MAX_BUNDLES &&
      reflectedCorrect.length === MAX_BUNDLES &&
      extensionCorrect.length === MAX_BUNDLES &&
      duplicates === 0
        ? Math.max(0, 10 - extraCount * 5)
        : 0;
    const rawScore =
      incidentCorrect.length * 5 +
      reflectedCorrect.length * 6 +
      extensionCorrect.length * 4 +
      imageTypeScore +
      placedImage.score +
      cleanScore;
    const score = clamp(Math.round(rawScore), 0, 100);
    const feedbackItems = buildFeedbackItems({
      incidentCorrect,
      reflectedCorrect,
      extensionCorrect,
      imageTypeScore,
      placedImage,
      completed,
      extraCount,
      duplicates
    });
    const summary = "平面鏡成像為正立虛像，像距等於物距，像的大小與物相同。";

    return {
      score,
      maxScore: 100,
      passed: score >= PASSING_SCORE,
      completed: true,
      feedback: feedbackItems.map((item) => item.text).concat(summary).join(" "),
      feedbackItems,
      summary,
      detail: {
        incidentCorrect: incidentCorrect.length,
        reflectedCorrect: reflectedCorrect.length,
        extensionCorrect: extensionCorrect.length,
        imageTypeCorrect: imageTypeScore === 10,
        imageChecks: placedImage.detail,
        completeBundles: completed,
        extraCount,
        duplicatePathCount: duplicates
      }
    };
  }

  function buildFeedbackItems(detail) {
    const items = [
      segmentFeedback("入射光線", detail.incidentCorrect.length, 4),
      segmentFeedback("反射光線", detail.reflectedCorrect.length, 4),
      segmentFeedback("延長線", detail.extensionCorrect.length, 4),
      {
        status: detail.imageTypeScore === 10 ? "correct" : "wrong",
        text: detail.imageTypeScore === 10 ? "像的性質：正確，平面鏡成虛像。" : "像的性質：應選虛像。"
      },
      {
        status: detail.placedImage.score === 20 ? "correct" : "wrong",
        text:
          detail.placedImage.score === 20
            ? "像的位置和大小：正確。"
            : "像的位置和大小：應在鏡後等距、正立且等大。"
      }
    ];
    if (detail.completed < MAX_BUNDLES) {
      items.push({
        status: "missing",
        text: "完整性：仍未完成四組入射、反射和延長線。"
      });
    } else if (detail.duplicates > 0) {
      items.push({
        status: "wrong",
        text: "完整性：同一物點需要兩條不同的入射路徑，鏡面入射點不可重疊。"
      });
    } else if (detail.extraCount > 0) {
      items.push({
        status: "extra",
        text: "完整性：有多餘光線。"
      });
    } else {
      items.push({
        status: "correct",
        text: "完整性：四組光線已完成。"
      });
    }
    return items;
  }

  function segmentFeedback(label, count, total) {
    if (count === total) {
      return { status: "correct", text: `${label}：${total} 條正確。` };
    }
    if (count === 0) {
      return { status: "missing", text: `${label}：未能取得正確分。` };
    }
    return { status: "wrong", text: `${label}：${count}/${total} 條正確。` };
  }

  function restoreAnswer(answer) {
    const finitePoint = (point) => point && Number.isFinite(point.x) && Number.isFinite(point.y);
    const segmentOk = (segment) => !segment || (finitePoint(segment.start) && finitePoint(segment.end));
    const scene = answer?.scene;
    const response = answer?.response;
    if (!scene || !["mirrorX", "mirrorTop", "mirrorBottom", "reflectingSide", "objectX", "objectY", "objectHeight"].every((key) => Number.isFinite(scene[key])) || scene.objectHeight <= 0 || ![-1, 1].includes(scene.reflectingSide)) return null;
    if (!response || !Array.isArray(response.bundles) || response.bundles.length > 4 || response.bundles.some((bundle, index) =>
      bundle?.source !== (index < 2 ? "top" : "bottom") || !bundle.incident || !segmentOk(bundle.incident) ||
      !segmentOk(bundle.reflected) || !segmentOk(bundle.extension) || (bundle.extension && !bundle.reflected))) return null;
    const imageChoice = response.imageChoice ?? null;
    const image = response.image ?? null;
    if (![null, "real", "virtual"].includes(imageChoice) || (image && (!["x", "y", "height", "angle"].every((key) => Number.isFinite(image[key])) || image.height <= 0)) || Boolean(imageChoice) !== Boolean(image)) return null;
    if (image && response.bundles.length === 0) return null;
    return {
      scene: { ...scene },
      bundles: response.bundles.map((bundle, index) => ({ ...bundle, id: index + 1 })),
      imageChoice,
      image: image ? { ...image } : null
    };
  }

  return {
    ANGLE_TOLERANCE_DEG,
    MIN_RAY_LENGTH,
    MIRROR_HIT_TOLERANCE_PX,
    SOURCE_TOLERANCE_PX,
    IMAGE_X_TOLERANCE_PX,
    IMAGE_Y_TOLERANCE_PX,
    IMAGE_HEIGHT_TOLERANCE_RATIO,
    DISTINCT_HIT_TOLERANCE_PX,
    PASSING_SCORE,
    sourcePoint,
    correctImage,
    imageEndpoints,
    incidentAngleToNormal,
    expectedReflectedAngle,
    expectedExtensionAngle,
    angleDistance,
    vectorAngle,
    pointDistance,
    isIncidentCorrect,
    isReflectedCorrect,
    isExtensionCorrect,
    restoreAnswer,
    scoreDiagram
  };
});
