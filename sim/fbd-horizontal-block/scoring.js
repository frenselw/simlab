(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.FbdScoring = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const FORCE_TYPES = {
    weight: { label: "重力", symbol: "G", expectedAngle: 90, direction: "向下" },
    normal: { label: "支持力", symbol: "N", expectedAngle: -90, direction: "向上" },
    applied: { label: "外力", symbol: "F", expectedAngle: 0, direction: "向右" },
    friction: { label: "摩擦力", symbol: "f", expectedAngle: 180, direction: "向左" },
    tension: { label: "拉力", symbol: "T" }
  };
  const REQUIRED_TYPES = ["weight", "normal", "applied", "friction"];
  const DIRECTION_TOLERANCE = 10;
  const MIN_ARROW_LENGTH = 40;
  const TYPE_POINTS = 5;
  const DIRECTION_POINTS = 12.5;
  const PLACEMENT_POINTS = 3.75;
  const CLEAN_POINTS = 15;
  const OTHER_EXTRA_PENALTY = 10;

  function normalizeAngle(angle) {
    let value = angle % 360;
    if (value > 180) value -= 360;
    if (value <= -180) value += 360;
    return value;
  }

  function angleDistance(a, b) {
    return Math.abs(normalizeAngle(a - b));
  }

  function arrowAngle(arrow) {
    return normalizeAngle(
      Math.atan2(arrow.end.y - arrow.start.y, arrow.end.x - arrow.start.x) *
        180 /
        Math.PI
    );
  }

  function arrowLength(arrow) {
    return Math.hypot(arrow.end.x - arrow.start.x, arrow.end.y - arrow.start.y);
  }

  function isUsableArrow(arrow) {
    return Boolean(FORCE_TYPES[arrow.type]) && arrowLength(arrow) >= MIN_ARROW_LENGTH;
  }

  function isPlacedOnBlock(arrow, block) {
    const pad = 18;
    return (
      arrow.start.x >= block.x - pad &&
      arrow.start.x <= block.x + block.width + pad &&
      arrow.start.y >= block.y - pad &&
      arrow.start.y <= block.y + block.height + pad
    );
  }

  function bestArrow(arrows, type) {
    const expected = FORCE_TYPES[type].expectedAngle;
    return arrows
      .filter((arrow) => arrow.type === type)
      .sort(
        (a, b) =>
          angleDistance(arrowAngle(a), expected) -
          angleDistance(arrowAngle(b), expected)
      )[0];
  }

  function scoreDiagram(arrows, block) {
    const usableArrows = arrows.filter(isUsableArrow);
    const tooShortArrows = arrows.filter(
      (arrow) => FORCE_TYPES[arrow.type] && arrowLength(arrow) < MIN_ARROW_LENGTH
    );
    const presentTypes = new Set(usableArrows.map((arrow) => arrow.type));
    const missingTypes = REQUIRED_TYPES.filter((type) => !presentTypes.has(type));
    const correctDirections = REQUIRED_TYPES.filter((type) => {
      const arrow = bestArrow(usableArrows, type);
      return (
        arrow &&
        angleDistance(arrowAngle(arrow), FORCE_TYPES[type].expectedAngle) <=
          DIRECTION_TOLERANCE
      );
    });
    const correctPlacements = REQUIRED_TYPES.filter((type) => {
      const arrow = bestArrow(usableArrows, type);
      return arrow && isPlacedOnBlock(arrow, block);
    });
    const extraArrows = findExtraArrows(usableArrows);
    const allExtraArrows = extraArrows.concat(tooShortArrows);

    const typeScore = (REQUIRED_TYPES.length - missingTypes.length) * TYPE_POINTS;
    const directionScore = correctDirections.length * DIRECTION_POINTS;
    const placementScore = correctPlacements.length * PLACEMENT_POINTS;
    const extraPenalty = allExtraArrows.reduce(
      (total, arrow) =>
        total + extraPenaltyForArrow(arrow, presentTypes, correctDirections, correctPlacements),
      0
    );
    const score = Math.max(
      0,
      Math.round(typeScore + directionScore + placementScore + CLEAN_POINTS - extraPenalty)
    );
    const feedbackItems = buildFeedbackItems(
      usableArrows,
      arrows.filter((arrow) => FORCE_TYPES[arrow.type]),
      missingTypes,
      correctDirections,
      extraArrows,
      tooShortArrows
    );
    const summary = "物體保持靜止，表示合力為零；向右外力應由向左摩擦力平衡。";

    return {
      score,
      maxScore: 100,
      passed: score >= 60,
      completed: true,
      feedback: feedbackItems.map((item) => item.text).concat(summary).join(" "),
      feedbackItems,
      summary,
      detail: {
        missingTypes,
        correctDirections,
        correctPlacements,
        extraCount: allExtraArrows.length,
        extraTypes: extraArrows.map((arrow) => arrow.type),
        tooShortCount: tooShortArrows.length
      }
    };
  }

  function extraPenaltyForArrow(arrow, presentTypes, correctDirections, correctPlacements) {
    if (!REQUIRED_TYPES.includes(arrow.type) || !presentTypes.has(arrow.type)) {
      return OTHER_EXTRA_PENALTY;
    }
    return (
      TYPE_POINTS +
      (correctDirections.includes(arrow.type) ? DIRECTION_POINTS : 0) +
      (correctPlacements.includes(arrow.type) ? PLACEMENT_POINTS : 0)
    );
  }

  function findExtraArrows(arrows) {
    const seenRequired = new Set();
    return arrows.filter((arrow) => {
      if (!REQUIRED_TYPES.includes(arrow.type)) return true;
      if (seenRequired.has(arrow.type)) return true;
      seenRequired.add(arrow.type);
      return false;
    });
  }

  function buildFeedbackItems(
    arrows,
    labelArrows,
    missingTypes,
    correctDirections,
    extraArrows,
    tooShortArrows
  ) {
    const items = REQUIRED_TYPES.map((type) => {
      const force = FORCE_TYPES[type];
      const title = `${force.symbol} ${force.label}`;
      if (missingTypes.includes(type)) {
        return {
          status: "missing",
          text: missingText(type, title, force.direction)
        };
      }
      if (correctDirections.includes(type)) {
        return {
          status: "correct",
          text: `${title}：正確，方向${force.direction}。`
        };
      }
      return {
        status: "wrong",
        text: `${title}：方向錯誤，應${force.direction}。`
      };
    });

    tooShortArrows.forEach((arrow) => {
      const force = FORCE_TYPES[arrow.type];
      items.push({
        status: "wrong",
        text: `${labelForArrow(arrow, labelArrows)} ${force.label}：箭頭太短，未能代表一個明確的力。`
      });
    });

    extraArrows.forEach((arrow) => {
      const force = FORCE_TYPES[arrow.type];
      items.push({
        status: "extra",
        text: `${labelForArrow(arrow, labelArrows)} ${force.label}：此題不需要。`
      });
    });

    return items;
  }

  function missingText(type, title, direction) {
    if (type === "friction") {
      return `${title}：缺少。物體受向右外力但保持靜止，所以摩擦力應${direction}。`;
    }
    return `${title}：缺少，應加入方向${direction}的力。`;
  }

  function labelForArrow(arrow, arrows) {
    const sameType = arrows
      .filter((item) => item.type === arrow.type)
      .sort((a, b) => Number(a.slot || 0) - Number(b.slot || 0));
    const symbol = FORCE_TYPES[arrow.type].symbol;
    if (sameType.length === 1) return symbol;
    return `${symbol}${subscriptNumber(sameType.indexOf(arrow) + 1)}`;
  }

  function subscriptNumber(number) {
    return String(number).replace(/[0-9]/g, (digit) => "₀₁₂₃₄₅₆₇₈₉"[Number(digit)]);
  }

  return {
    FORCE_TYPES,
    REQUIRED_TYPES,
    scoreDiagram,
    arrowAngle,
    arrowLength,
    angleDistance
  };
});
