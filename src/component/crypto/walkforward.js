/* Walk forward testing.
 *
 * The replay in backtest.js measures every signal over the whole range, which
 * is in sample: it is scored on the same bars used to notice it. That number
 * is always the flattering one. Walk forward asks the harder question: pick
 * the rule using only the past, then score it on bars that came after, and see
 * how much of the edge survives.
 *
 * The series is split into blocks. Each block in turn is the test window, and
 * everything before it is the training window, so a decision is never taken
 * with data from its own test block or from the future.
 *
 * An embargo sits on each boundary. A training bar within `horizon` of the
 * split has an outcome that reaches past it, so it is dropped: without that,
 * the training window would already contain part of the answer.
 */
import { signalSeries, forwardReturns } from "./backtest";
import { NEUTRAL } from "./signals";

function rate(returns, indexes) {
  const samples = indexes.map((i) => returns[i]).filter((value) => value !== null);
  if (!samples.length) return { count: 0, upRate: null, meanReturn: null };
  const ups = samples.filter((value) => value > 0).length;
  return {
    count: samples.length,
    upRate: (ups / samples.length) * 100,
    meanReturn: samples.reduce((a, b) => a + b, 0) / samples.length,
  };
}

/* The bar ranges for each fold, given the number of test blocks wanted. */
export function folds(length, count, horizon) {
  const blocks = count + 1;
  const size = Math.floor(length / blocks);
  if (size <= horizon) return [];

  const out = [];
  for (let k = 1; k <= count; k++) {
    const splitIndex = size * k;
    const end = k === count ? length : size * (k + 1);
    out.push({
      // the embargo: a training bar this close to the split would have its
      // outcome inside the test window
      train: { from: 0, to: Math.max(0, splitIndex - horizon) },
      test: { from: splitIndex, to: end },
    });
  }
  return out;
}

const range = (from, to) => {
  const out = [];
  for (let i = from; i < to; i++) out.push(i);
  return out;
};

/* For every indicator and every fold: the edge it showed in the training
 * window, and the edge the same reading actually delivered in the test window
 * that followed. `held` is whether the direction of the edge survived. */
export function walkForward(
  { closes, candles = [], volumes = [] },
  { horizon = 7, count = 4, minimumSamples = 10 } = {}
) {
  const empty = { folds: [], rows: [], summary: null, horizon, count };
  if (!closes || closes.length < 120) return empty;

  const windows = folds(closes.length, count, horizon);
  if (!windows.length) return empty;

  const returns = forwardReturns(closes, horizon);
  const series = signalSeries({ closes, candles, volumes });

  const rows = [];

  Object.keys(series).forEach((label) => {
    const signals = series[label];

    windows.forEach((window, foldIndex) => {
      const trainAll = range(window.train.from, window.train.to);
      const testAll = range(window.test.from, window.test.to);
      if (!trainAll.length || !testAll.length) return;

      // the reading the rule is built on is whatever that indicator said at
      // the last bar of the training window
      const decidedAt = window.train.to - 1;
      const wanted = signals[decidedAt];
      if (!wanted || wanted === NEUTRAL) return;

      const trainBars = trainAll.filter((i) => signals[i] === wanted);
      const testBars = testAll.filter((i) => signals[i] === wanted);

      const trainStats = rate(returns, trainBars);
      const testStats = rate(returns, testBars);
      const trainBase = rate(returns, trainAll);
      const testBase = rate(returns, testAll);

      if (
        trainStats.count < minimumSamples ||
        testStats.count < minimumSamples ||
        trainStats.upRate === null ||
        testStats.upRate === null ||
        trainBase.upRate === null ||
        testBase.upRate === null
      ) {
        return;
      }

      const trainEdge = trainStats.upRate - trainBase.upRate;
      const testEdge = testStats.upRate - testBase.upRate;

      rows.push({
        label,
        fold: foldIndex + 1,
        signal: wanted,
        trainCount: trainStats.count,
        testCount: testStats.count,
        trainEdge,
        testEdge,
        // an edge too small to act on either way is not counted as holding
        held: Math.abs(trainEdge) >= 5 && Math.sign(trainEdge) === Math.sign(testEdge),
        decisive: Math.abs(trainEdge) >= 5,
      });
    });
  });

  const decisive = rows.filter((row) => row.decisive);
  const summary = decisive.length
    ? {
        tested: decisive.length,
        held: decisive.filter((row) => row.held).length,
        heldRate: (decisive.filter((row) => row.held).length / decisive.length) * 100,
        meanTrainEdge: decisive.reduce((t, row) => t + Math.abs(row.trainEdge), 0) / decisive.length,
        // signed against the direction the training window pointed, so a
        // reversal out of sample shows up as a negative number
        meanTestEdge:
          decisive.reduce((t, row) => t + Math.sign(row.trainEdge) * row.testEdge, 0) /
          decisive.length,
      }
    : null;

  return { folds: windows, rows, summary, horizon, count };
}

/* Plain wording for what the summary means. A rule picked at random holds its
 * direction about half the time, so that is the number to beat. */
export function verdict(summary) {
  if (!summary) {
    return {
      text: "not enough history to walk forward",
      detail: "there were too few occurrences in both the training and test windows to compare",
      tone: "muted",
    };
  }

  const kept = summary.meanTrainEdge === 0 ? 0 : (summary.meanTestEdge / summary.meanTrainEdge) * 100;

  if (summary.heldRate >= 65 && summary.meanTestEdge > 2) {
    return {
      text: "held up out of sample",
      detail: `the direction survived in ${summary.held} of ${summary.tested} tests, and about ${Math.round(kept)}% of the edge came with it`,
      tone: "good",
    };
  }
  if (summary.heldRate <= 40 || summary.meanTestEdge < -2) {
    return {
      text: "did not survive out of sample",
      detail: `the direction reversed more often than it held, in ${summary.tested - summary.held} of ${summary.tested} tests`,
      tone: "bad",
    };
  }
  return {
    text: "no better than chance",
    detail: `the direction held in ${summary.held} of ${summary.tested} tests, which is about what picking at random would give`,
    tone: "muted",
  };
}
