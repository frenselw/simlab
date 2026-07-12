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
  const BALANCE_LENGTH_RATIO = 0.8;
  const MIN_ARROW_LENGTH = 40;
  const TYPE_POINTS = 5;
  const DIRECTION_POINTS = 10;
  const PLACEMENT_POINTS = 3.75;
  const BALANCE_PAIR_POINTS = 5;
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

  function isBalancedPair(firstArrow, secondArrow) {
    if (!firstArrow || !secondArrow) return false;
    const firstLength = arrowLength(firstArrow);
    const secondLength = arrowLength(secondArrow);
    return Math.min(firstLength, secondLength) / Math.max(firstLength, secondLength) >=
      BALANCE_LENGTH_RATIO;
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
    const balancedPairs = [
      { key: "vertical", types: ["normal", "weight"] },
      { key: "horizontal", types: ["applied", "friction"] }
    ].filter(({ types }) =>
      types.every((type) => correctDirections.includes(type)) &&
      isBalancedPair(bestArrow(usableArrows, types[0]), bestArrow(usableArrows, types[1]))
    );
    const extraArrows = findExtraArrows(usableArrows);
    const allExtraArrows = extraArrows.concat(tooShortArrows);

    const typeScore = (REQUIRED_TYPES.length - missingTypes.length) * TYPE_POINTS;
    const directionScore = correctDirections.length * DIRECTION_POINTS;
    const placementScore = correctPlacements.length * PLACEMENT_POINTS;
    const balanceScore = balancedPairs.length * BALANCE_PAIR_POINTS;
    const extraPenalty = allExtraArrows.reduce(
      (total, arrow) =>
        total + extraPenaltyForArrow(arrow, presentTypes, correctDirections, correctPlacements),
      0
    );
    const cleanScore = missingTypes.length === 0 && allExtraArrows.length === 0 ? CLEAN_POINTS : 0;
    const score = Math.max(
      0,
      Math.round(
        typeScore + directionScore + placementScore + balanceScore + cleanScore - extraPenalty
      )
    );
    const feedbackItems = buildFeedbackItems(
      usableArrows,
      arrows.filter((arrow) => FORCE_TYPES[arrow.type]),
      missingTypes,
      correctDirections,
      extraArrows,
      tooShortArrows,
      balancedPairs
    );
    const summary = balancedPairs.length === 2
      ? "兩組相反方向的力大小大致相等，符合物體合力為零、保持靜止。"
      : "物體保持靜止，兩組相反方向的力應各自大小大致相等，使合力為零。";

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
        balancedPairs: balancedPairs.map((pair) => pair.key),
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
    tooShortArrows,
    balancedPairs
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

    const balancedPairKeys = new Set(balancedPairs.map((pair) => pair.key));
    if (!missingTypes.includes("normal") && !missingTypes.includes("weight")) {
      const directionsCorrect = ["normal", "weight"].every((type) =>
        correctDirections.includes(type)
      );
      items.push({
        status: balancedPairKeys.has("vertical") ? "correct" : "wrong",
        text: balancedPairKeys.has("vertical")
          ? "支持力與重力：箭頭長度大致相等，垂直方向平衡。"
          : directionsCorrect
            ? "支持力與重力：箭頭長度相差太大，應調整至大致相等。"
            : "支持力與重力：請先修正箭頭方向，使兩個力方向相反，再比較長度。"
      });
    }
    if (!missingTypes.includes("applied") && !missingTypes.includes("friction")) {
      const directionsCorrect = ["applied", "friction"].every((type) =>
        correctDirections.includes(type)
      );
      items.push({
        status: balancedPairKeys.has("horizontal") ? "correct" : "wrong",
        text: balancedPairKeys.has("horizontal")
          ? "外力與摩擦力：箭頭長度大致相等，水平方向平衡。"
          : directionsCorrect
            ? "外力與摩擦力：箭頭長度相差太大，應調整至大致相等。"
            : "外力與摩擦力：請先修正箭頭方向，使兩個力方向相反，再比較長度。"
      });
    }

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
    angleDistance,
    BALANCE_LENGTH_RATIO
  };
});
