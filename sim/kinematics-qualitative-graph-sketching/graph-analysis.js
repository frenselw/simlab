(function (root, factory) {
  const model = typeof module === "object" && module.exports ? require("./graph-model.js") : root.KinematicsGraphModel;
  const api = factory(model);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.KinematicsGraphAnalysis = api;
})(typeof window !== "undefined" ? window : globalThis, function (Model) {
  "use strict";

  const ANALYSIS_BINS = 24;
  const LOCAL_WINDOWS = Object.freeze([
    [0, 0.28], [0.14, 0.42], [0.28, 0.56],
    [0.44, 0.72], [0.58, 0.86], [0.72, 1]
  ]);
  const ZERO_BAND = 0.08;

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function median(values) {
    if (!values.length) return null;
    const sorted = values.slice().sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function percentile(values, percentileValue) {
    if (!values.length) return null;
    const sorted = values.slice().sort((left, right) => left - right);
    const position = clamp(percentileValue, 0, 1) * (sorted.length - 1);
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
  }

  function normalizedY(byte, graphType) {
    const base = byte / Model.MAX_VALUE;
    return graphType === "xt" ? base : base - 0.5;
  }

  function drawValues(trace, graphType, startBin = 0, endBin = Model.DRAW_BINS) {
    if (!Model.isTrace(trace) || !["xt", "vt", "at"].includes(graphType)) return null;
    const start = clamp(Math.floor(startBin), 0, Model.DRAW_BINS);
    const end = clamp(Math.ceil(endBin), start, Model.DRAW_BINS);
    return Array.from(trace.slice(start, end), (value) => value === Model.EMPTY ? null : normalizedY(value, graphType));
  }

  function aggregate(values) {
    const result = Array(ANALYSIS_BINS).fill(null);
    for (let index = 0; index < ANALYSIS_BINS; index += 1) {
      const start = Math.floor(index * values.length / ANALYSIS_BINS);
      const end = Math.max(start + 1, Math.floor((index + 1) * values.length / ANALYSIS_BINS));
      result[index] = median(values.slice(start, end).filter((value) => value != null));
    }
    return result;
  }

  function fillSingleGaps(values) {
    const output = values.slice();
    for (let index = 1; index < output.length - 1; index += 1) {
      if (output[index] == null && output[index - 1] != null && output[index + 1] != null) {
        output[index] = (output[index - 1] + output[index + 1]) / 2;
      }
    }
    return output;
  }

  function medianFilter(values) {
    return values.map((value, index) => {
      if (value == null) return null;
      if (index === 0 || index === values.length - 1 ||
          values[index - 1] == null || values[index + 1] == null) return value;
      return median([values[index - 1], value, values[index + 1]]);
    });
  }

  function movingAverage(values) {
    return values.map((value, index) => {
      if (value == null) return null;
      const around = [value];
      for (let distance = 1; distance <= 2; distance += 1) {
        const left = index - distance;
        const right = index + distance;
        if (left < 0 || right >= values.length) break;
        let connected = true;
        for (let cursor = left; cursor <= right; cursor += 1) {
          if (values[cursor] == null) connected = false;
        }
        if (connected) {
          around.push(values[left], values[right]);
        } else {
          break;
        }
      }
      return around.reduce((sum, entry) => sum + entry, 0) / around.length;
    });
  }

  function linearFit(points) {
    if (!Array.isArray(points) || points.length < 2) return null;
    const n = points.length;
    const meanX = points.reduce((sum, point) => sum + point.x, 0) / n;
    const meanY = points.reduce((sum, point) => sum + point.y, 0) / n;
    const denominator = points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
    if (!(denominator > 1e-12)) return null;
    const slope = points.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0) / denominator;
    const intercept = meanY - slope * meanX;
    const sse = points.reduce((sum, point) => sum + (point.y - intercept - slope * point.x) ** 2, 0);
    return { slope, intercept, sse, rmse: Math.sqrt(sse / n), n };
  }

  function solve3(matrix, vector) {
    const work = matrix.map((row, index) => row.concat(vector[index]));
    for (let column = 0; column < 3; column += 1) {
      let pivot = column;
      for (let row = column + 1; row < 3; row += 1) {
        if (Math.abs(work[row][column]) > Math.abs(work[pivot][column])) pivot = row;
      }
      if (Math.abs(work[pivot][column]) < 1e-12) return null;
      [work[column], work[pivot]] = [work[pivot], work[column]];
      const divisor = work[column][column];
      for (let item = column; item <= 3; item += 1) work[column][item] /= divisor;
      for (let row = 0; row < 3; row += 1) {
        if (row === column) continue;
        const factor = work[row][column];
        for (let item = column; item <= 3; item += 1) work[row][item] -= factor * work[column][item];
      }
    }
    return work.map((row) => row[3]);
  }

  function quadraticFit(points) {
    if (!Array.isArray(points) || points.length < 6) return null;
    const sums = [0, 0, 0, 0, 0];
    let y = 0, xy = 0, x2y = 0;
    for (const point of points) {
      let power = 1;
      for (let index = 0; index < sums.length; index += 1) {
        sums[index] += power;
        power *= point.x;
      }
      y += point.y;
      xy += point.x * point.y;
      x2y += point.x * point.x * point.y;
    }
    const coefficients = solve3(
      [[sums[0], sums[1], sums[2]], [sums[1], sums[2], sums[3]], [sums[2], sums[3], sums[4]]],
      [y, xy, x2y]
    );
    if (!coefficients) return null;
    const [intercept, linear, quadratic] = coefficients;
    const sse = points.reduce((sum, point) => {
      const predicted = intercept + linear * point.x + quadratic * point.x * point.x;
      return sum + (point.y - predicted) ** 2;
    }, 0);
    return { intercept, linear, quadratic, sse, rmse: Math.sqrt(sse / points.length), n: points.length };
  }

  function bic(sse, n, parameters) {
    return n * Math.log(Math.max(sse / n, 1e-8)) + parameters * Math.log(n);
  }

  function averageRanks(values) {
    const indexed = values.map((value, index) => ({ value, index })).sort((left, right) => left.value - right.value);
    const ranks = Array(values.length);
    for (let start = 0; start < indexed.length;) {
      let end = start + 1;
      while (end < indexed.length && indexed[end].value === indexed[start].value) end += 1;
      const rank = ((start + 1) + end) / 2;
      for (let index = start; index < end; index += 1) ranks[indexed[index].index] = rank;
      start = end;
    }
    return ranks;
  }

  function spearman(values) {
    if (!Array.isArray(values) || values.length < 2) return null;
    const xRanks = averageRanks(values.map((_, index) => index));
    const yRanks = averageRanks(values);
    const points = xRanks.map((x, index) => ({ x, y: yRanks[index] }));
    const fit = linearFit(points);
    if (!fit) return 0;
    const meanX = xRanks.reduce((sum, value) => sum + value, 0) / xRanks.length;
    const meanY = yRanks.reduce((sum, value) => sum + value, 0) / yRanks.length;
    const numerator = points.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0);
    const denominator = Math.sqrt(
      points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0) *
      points.reduce((sum, point) => sum + (point.y - meanY) ** 2, 0)
    );
    return denominator ? numerator / denominator : 0;
  }

  function pointsFrom(values, start = 0, end = 1) {
    return values.flatMap((value, index) => {
      const time = values.length === 1 ? 0 : index / (values.length - 1);
      return value != null && time >= start - 1e-9 && time <= end + 1e-9 ? [{ x: time, y: value }] : [];
    });
  }

  function edgeCoverage(values) {
    const valid = values.flatMap((value, index) => value == null ? [] : [index / (values.length - 1)]);
    if (!valid.length) return 0;
    const start = valid[0];
    const end = valid[valid.length - 1];
    const startScore = start <= 0.08 ? 1 : start >= 0.20 ? 0 : (0.20 - start) / 0.12;
    const endScore = end >= 0.92 ? 1 : end <= 0.80 ? 0 : (end - 0.80) / 0.12;
    return Math.min(startScore, endScore);
  }

  function endpointY(values, side) {
    const end = Math.ceil(values.length * 0.125);
    const segment = side === "start" ? values.slice(0, end) : values.slice(-end);
    const valid = segment.filter((value) => value != null);
    if (valid.length < 2) return null;
    return median(side === "start" ? valid.slice(0, 3) : valid.slice(-3));
  }

  function localSlopes(values) {
    const output = LOCAL_WINDOWS.map(([start, end]) => {
      const fit = linearFit(pointsFrom(values, start, end));
      return fit && fit.n >= 3 ? fit.slope : null;
    });
    const valid = output.filter((value) => value != null);
    const early = valid.length >= 2 ? median(valid.slice(0, 2)) : null;
    const late = valid.length >= 2 ? median(valid.slice(-2)) : null;
    return {
      values: output,
      validCount: valid.length,
      early,
      late,
      delta: early != null && late != null ? late - early : null,
      rho: valid.length >= 4 ? spearman(valid) : null
    };
  }

  function slopeRatios(values) {
    let positive = 0, negative = 0, considered = 0;
    for (let index = 1; index < values.length; index += 1) {
      if (values[index] == null || values[index - 1] == null) continue;
      const slope = (values[index] - values[index - 1]) * (values.length - 1);
      if (Math.abs(slope) < 0.04) continue;
      considered += 1;
      if (slope > 0) positive += 1;
      else negative += 1;
    }
    return {
      positive: considered ? positive / considered : 0,
      negative: considered ? negative / considered : 0,
      considered
    };
  }

  function roughness(values) {
    const residuals = [];
    for (let index = 1; index < values.length - 1; index += 1) {
      if ([values[index - 1], values[index], values[index + 1]].some((value) => value == null)) continue;
      residuals.push(Math.abs(values[index] - (values[index - 1] + values[index + 1]) / 2));
    }
    return percentile(residuals, 0.8) || 0;
  }

  function oscillations(values) {
    let previousSign = 0;
    let count = 0;
    for (let index = 1; index < values.length; index += 1) {
      if (values[index] == null || values[index - 1] == null) {
        previousSign = 0;
        continue;
      }
      const difference = values[index] - values[index - 1];
      if (Math.abs(difference) < 0.025) continue;
      const sign = Math.sign(difference);
      if (previousSign && sign !== previousSign) count += 1;
      previousSign = sign;
    }
    return count;
  }

  function pathLengthRatio(values) {
    let length = 0;
    let first = null;
    let last = null;
    const deltaTime = 1 / (values.length - 1);
    for (let index = 0; index < values.length; index += 1) {
      if (values[index] == null) continue;
      if (first == null) first = index;
      last = index;
      if (index > 0 && values[index - 1] != null) {
        length += Math.sqrt(deltaTime ** 2 + (values[index] - values[index - 1]) ** 2);
      }
    }
    if (first == null || last === first) return Infinity;
    return length / ((last - first) * deltaTime);
  }

  function maxGap(values) {
    let maximum = 0, current = 0;
    for (const value of values) {
      if (value == null) {
        current += 1;
        maximum = Math.max(maximum, current);
      } else current = 0;
    }
    return maximum / values.length;
  }

  function analyzeRange(trace, graphType, options = {}) {
    const startBin = options.startBin == null ? 0 : options.startBin;
    const endBin = options.endBin == null ? Model.DRAW_BINS : options.endBin;
    const rawDraw = drawValues(trace, graphType, startBin, endBin);
    if (!rawDraw) return { structuralInvalid: true, reason: "invalid-trace" };
    const aggregated = aggregate(rawDraw);
    const coverage = aggregated.filter((value) => value != null).length / ANALYSIS_BINS;
    const filtered = movingAverage(medianFilter(fillSingleGaps(aggregated)));
    const points = pointsFrom(filtered);
    const line = linearFit(points);
    const quadratic = quadraticFit(points);
    const validY = filtered.filter((value) => value != null);
    const startY = endpointY(filtered, "start");
    const endY = endpointY(filtered, "end");
    const slopes = localSlopes(filtered);
    const startFit = linearFit(pointsFrom(filtered, 0, 0.22));
    const endFit = linearFit(pointsFrom(filtered, 0.78, 1));
    const region = {
      positive: validY.length ? validY.filter((value) => value > ZERO_BAND).length / validY.length : 0,
      negative: validY.length ? validY.filter((value) => value < -ZERO_BAND).length / validY.length : 0,
      zero: validY.length ? validY.filter((value) => Math.abs(value) <= ZERO_BAND).length / validY.length : 0,
      zeroP80: percentile(validY.map((value) => Math.abs(value)), 0.8)
    };
    const ratios = slopeRatios(filtered);
    const rough = roughness(filtered);
    const oscillationCount = oscillations(filtered);
    const lengthRatio = pathLengthRatio(filtered);
    const derived = [
      coverage, rough, oscillationCount, lengthRatio,
      line?.slope, line?.rmse, quadratic?.quadratic, quadratic?.rmse,
      slopes.delta, slopes.rho, startFit?.slope, endFit?.slope
    ].filter((value) => value != null);
    return {
      structuralInvalid: derived.some((value) => !Number.isFinite(value)),
      raw: aggregated,
      values: filtered,
      validAnalysisCount: validY.length,
      coverage,
      maxGapFraction: maxGap(aggregated),
      edgeCoverage: edgeCoverage(aggregated),
      startY,
      endY,
      overallChange: startY != null && endY != null ? endY - startY : null,
      region,
      line,
      quadratic,
      deltaBIC: line && quadratic ? bic(line.sse, line.n, 2) - bic(quadratic.sse, quadratic.n, 3) : null,
      localSlopes: slopes,
      startSlope: startFit && startFit.n >= 4 ? startFit.slope : null,
      endSlope: endFit && endFit.n >= 4 ? endFit.slope : null,
      positiveSlopeRatio: ratios.positive,
      negativeSlopeRatio: ratios.negative,
      slopeDifferenceCount: ratios.considered,
      roughness: rough,
      oscillationCount,
      pathLengthRatio: lengthRatio,
      horizontalSpan: points.length > 1 ? points[points.length - 1].x - points[0].x : 0
    };
  }

  function boundaryMetric(trace, graphType, boundaryIndex) {
    const values = drawValues(trace, graphType);
    if (!values || ![1, 2, 3].includes(boundaryIndex)) return null;
    const boundary = boundaryIndex * Model.DRAW_BINS / 4;
    const leftValues = values.slice(Math.max(0, boundary - 4), boundary).filter((value) => value != null).slice(-2);
    const rightValues = values.slice(boundary, Math.min(Model.DRAW_BINS, boundary + 4)).filter((value) => value != null).slice(0, 2);
    const leftStart = Math.floor(boundary - Model.DRAW_BINS / 4 * 0.22);
    const leftPoints = values.slice(leftStart, boundary).flatMap((value, offset) =>
      value == null ? [] : [{ x: (leftStart + offset) / (Model.DRAW_BINS - 1), y: value }]
    );
    const rightEnd = Math.ceil(boundary + Model.DRAW_BINS / 4 * 0.22);
    const rightPoints = values.slice(boundary, rightEnd).flatMap((value, offset) =>
      value == null ? [] : [{ x: (boundary + offset) / (Model.DRAW_BINS - 1), y: value }]
    );
    const leftFit = linearFit(leftPoints);
    const rightFit = linearFit(rightPoints);
    return {
      yLeft: leftValues.length >= 2 ? median(leftValues) : null,
      yRight: rightValues.length >= 2 ? median(rightValues) : null,
      yJump: leftValues.length >= 2 && rightValues.length >= 2 ? Math.abs(median(rightValues) - median(leftValues)) : null,
      slopeLeft: leftFit && leftFit.n >= 4 ? leftFit.slope : null,
      slopeRight: rightFit && rightFit.n >= 4 ? rightFit.slope : null,
      slopeJump: leftFit && rightFit && leftFit.n >= 4 && rightFit.n >= 4
        ? Math.abs(rightFit.slope - leftFit.slope) : null
    };
  }

  function analyzeTrace(trace, graphType, options = {}) {
    const full = analyzeRange(trace, graphType);
    if (!options.composite) return full;
    return {
      ...full,
      phases: Array.from({ length: 4 }, (_, index) => analyzeRange(trace, graphType, {
        startBin: index * Model.DRAW_BINS / 4,
        endBin: (index + 1) * Model.DRAW_BINS / 4
      })),
      boundaries: [1, 2, 3].map((index) => boundaryMetric(trace, graphType, index))
    };
  }

  return {
    ANALYSIS_BINS,
    ZERO_BAND,
    LOCAL_WINDOWS,
    median,
    percentile,
    normalizedY,
    aggregate,
    fillSingleGaps,
    medianFilter,
    movingAverage,
    linearFit,
    quadraticFit,
    bic,
    spearman,
    analyzeRange,
    analyzeTrace,
    boundaryMetric
  };
});
