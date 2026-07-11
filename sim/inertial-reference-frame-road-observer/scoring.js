(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined") module.exports = api;
  if (root) root.ReferenceFrameScoring = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const CANDIDATES = ["R", "A", "B", "C"];
  const PASSING_SCORE = 60;
  const LAYOUT_COUNT = 4;
  const ROUND_GROUPS = [
    ["foundation-road", "foundation-two-forward"],
    ["equal-motion", "equal-motion-road"],
    ["core-lower-middle", "core-lower-both-forward"],
    ["core-upper-middle", "core-middle-three-signs"],
    ["core-transfer", "core-transfer-road"]
  ];
  const ROUND_ORDER = ROUND_GROUPS.map((group) => group[0]);
  const PATTERNS = {
    "foundation-road": {
      weight: 10,
      classes: { A: 1, B: 2, C: 3 },
      conditions: [
        { object: "roadside", state: "stationary" },
        { object: "C", state: "up" }
      ],
      accepted: ["R"]
    },
    "foundation-two-forward": {
      weight: 10,
      classes: { A: 1, B: 2, C: 3 },
      conditions: [
        { object: "A", state: "up" },
        { object: "B", state: "up" }
      ],
      accepted: ["R"]
    },
    "equal-motion": {
      weight: 15,
      classes: { A: 2, B: 2, C: 3 },
      conditions: [
        { object: "A", state: "stationary" },
        { object: "B", state: "stationary" }
      ],
      accepted: ["A", "B"]
    },
    "equal-motion-road": {
      weight: 15,
      classes: { A: 1, B: 1, C: 3 },
      conditions: [
        { object: "A", state: "stationary" },
        { object: "C", state: "up" },
        { object: "roadside", state: "down" }
      ],
      accepted: ["A", "B"]
    },
    "core-lower-middle": {
      weight: 25,
      classes: { A: 1, B: 2, C: 3 },
      conditions: [
        { object: "B", state: "up" },
        { object: "roadside", state: "down" }
      ],
      accepted: ["A"]
    },
    "core-lower-both-forward": {
      weight: 25,
      classes: { A: 1, B: 2, C: 3 },
      conditions: [
        { object: "B", state: "up" },
        { object: "C", state: "up" },
        { object: "roadside", state: "down" }
      ],
      accepted: ["A"]
    },
    "core-upper-middle": {
      weight: 25,
      classes: { A: 1, B: 2, C: 3 },
      conditions: [
        { object: "C", state: "up" },
        { object: "A", state: "down" }
      ],
      accepted: ["B"]
    },
    "core-middle-three-signs": {
      weight: 25,
      classes: { A: 1, B: 2, C: 3 },
      conditions: [
        { object: "roadside", state: "down" },
        { object: "A", state: "down" },
        { object: "C", state: "up" }
      ],
      accepted: ["B"]
    },
    "core-transfer": {
      weight: 25,
      classes: { A: 3, B: 1, C: 2 },
      conditions: [
        { object: "A", state: "up" },
        { object: "B", state: "down" }
      ],
      accepted: ["C"]
    },
    "core-transfer-road": {
      weight: 25,
      classes: { A: 3, B: 1, C: 2 },
      conditions: [
        { object: "A", state: "up" },
        { object: "B", state: "down" },
        { object: "roadside", state: "down" }
      ],
      accepted: ["C"]
    }
  };

  function shuffledWithRandom(items, random) {
    const result = items.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }

  function generateAttemptSpec(random) {
    if (typeof random !== "function") throw new Error("Attempt generator requires a random function");
    const sampled = ROUND_GROUPS.map((group) => group[Math.floor(random() * group.length)]);
    const roundOrder = shuffledWithRandom(sampled, random);
    return {
      roundOrder,
      permutations: roundOrder.map(() => shuffledWithRandom(["A", "B", "C"], random).join("")),
      layouts: roundOrder.map(() => Math.floor(random() * LAYOUT_COUNT))
    };
  }

  function permutationMap(permutation) {
    const value = String(permutation || "ABC").toUpperCase();
    if (value.length !== 3 || new Set(value).size !== 3 || /[^ABC]/.test(value)) {
      throw new Error("Invalid vehicle permutation");
    }
    return { A: value[0], B: value[1], C: value[2] };
  }

  function referenceClass(round, candidate) {
    return candidate === "R" ? 0 : round.classes[candidate];
  }

  function objectClass(round, object) {
    return object === "roadside" ? 0 : round.classes[object];
  }

  function relation(objectVelocityClass, referenceVelocityClass) {
    if (objectVelocityClass === referenceVelocityClass) return "stationary";
    return objectVelocityClass > referenceVelocityClass ? "up" : "down";
  }

  function conditionCandidates(round, condition) {
    return CANDIDATES.filter((candidate) => {
      return relation(objectClass(round, condition.object), referenceClass(round, candidate)) === condition.state;
    });
  }

  function acceptedFromConditions(round) {
    return CANDIDATES.filter((candidate) => {
      return round.conditions.every((condition) => conditionCandidates(round, condition).includes(candidate));
    });
  }

  function instantiateRound(id, permutation, layout) {
    const pattern = PATTERNS[id];
    if (!pattern) throw new Error(`Unknown reference-frame pattern: ${id}`);
    const map = permutationMap(permutation);
    const classes = { A: 0, B: 0, C: 0 };
    Object.keys(pattern.classes).forEach((role) => {
      classes[map[role]] = pattern.classes[role];
    });
    const swapObject = (object) => (object === "roadside" ? object : map[object]);
    return {
      id,
      weight: pattern.weight,
      permutation: String(permutation || "ABC").toUpperCase(),
      layout: Number.isInteger(layout) ? layout : 0,
      classes,
      conditions: pattern.conditions.map((condition) => ({
        object: swapObject(condition.object),
        state: condition.state
      })),
      accepted: pattern.accepted.map((candidate) => (candidate === "R" ? "R" : map[candidate]))
    };
  }

  function instantiateAttempt(permutations, layouts, roundOrder) {
    const ids = Array.isArray(roundOrder) ? roundOrder : ROUND_ORDER;
    return ids.map((id, index) => {
      const permutation = Array.isArray(permutations) ? permutations[index] : permutations;
      return instantiateRound(id, permutation, (layouts || [])[index] || 0);
    });
  }

  function scoreAttempt(rounds, answers) {
    const detail = rounds.map((round, index) => {
      const answer = answers[index] || null;
      const correct = Boolean(answer && round.accepted.includes(answer));
      return {
        id: round.id,
        answer,
        accepted: round.accepted.slice(),
        correct,
        score: correct ? round.weight : 0,
        maxScore: round.weight
      };
    });
    const score = detail.reduce((total, item) => total + item.score, 0);
    return {
      score: Math.max(0, Math.min(100, score)),
      maxScore: 100,
      passed: score >= PASSING_SCORE,
      completed: detail.every((item) => item.answer),
      detail
    };
  }

  function validateRound(round) {
    const derived = acceptedFromConditions(round);
    return (
      round.accepted.length > 0 &&
      round.accepted.every((candidate) => derived.includes(candidate)) &&
      derived.every((candidate) => round.accepted.includes(candidate))
    );
  }

  function validateAttempt(rounds) {
    if (!Array.isArray(rounds) || rounds.length !== ROUND_GROUPS.length) return false;
    const groupIndexes = rounds.map((round) => ROUND_GROUPS.findIndex((group) => group.includes(round.id)));
    try {
      return (
        groupIndexes.every((index) => index >= 0) &&
        new Set(groupIndexes).size === ROUND_GROUPS.length &&
        rounds.reduce((total, round) => total + round.weight, 0) === 100 &&
        rounds.every((round) => validateRound(round)) &&
        rounds.every((round) => Number.isInteger(round.layout) && round.layout >= 0 && round.layout < LAYOUT_COUNT) &&
        rounds.every((round) => Boolean(permutationMap(round.permutation)))
      );
    } catch (error) {
      return false;
    }
  }

  function snapshotRound(round) {
    return {
      p: round.id,
      c: [round.classes.A, round.classes.B, round.classes.C],
      m: round.permutation,
      l: round.layout
    };
  }

  function roundFromSnapshot(saved) {
    if (!saved || typeof saved !== "object") throw new Error("Invalid saved round");
    if (!Number.isInteger(saved.l) || saved.l < 0 || saved.l >= LAYOUT_COUNT) {
      throw new Error("Invalid saved layout");
    }
    const round = instantiateRound(saved.p, saved.m, saved.l);
    if (!Array.isArray(saved.c) || saved.c.length !== 3) throw new Error("Missing saved velocity classes");
    if (round.classes.A !== saved.c[0] || round.classes.B !== saved.c[1] || round.classes.C !== saved.c[2]) {
      throw new Error("Saved round does not match its pattern");
    }
    return round;
  }

  function validateAnswers(answers, count) {
    return Array.isArray(answers) && answers.length === count && answers.every((answer) => CANDIDATES.includes(answer));
  }

  return {
    CANDIDATES,
    PASSING_SCORE,
    LAYOUT_COUNT,
    ROUND_GROUPS,
    ROUND_ORDER,
    PATTERNS,
    generateAttemptSpec,
    relation,
    referenceClass,
    objectClass,
    conditionCandidates,
    acceptedFromConditions,
    instantiateRound,
    instantiateAttempt,
    scoreAttempt,
    validateRound,
    validateAttempt,
    snapshotRound,
    roundFromSnapshot,
    validateAnswers
  };
});
