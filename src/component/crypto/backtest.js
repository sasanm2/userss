/* Replays the indicators over the history on screen and measures what price
 * actually did afterwards.
 *
 * This is not a forecast. It answers one narrow question: on this coin, over
 * this range, when an indicator last read the way it reads now, how often was
 * the price higher some number of points later, and by how much on average.
 *
 * Two things keep the numbers honest.
 *
 * No lookahead: every indicator value at bar i depends only on bars up to i,
 * and the outcome measured for bar i is strictly after i.
 *
 * A base rate: the same statistics over every bar, signal or not. A signal
 * that was followed by a rise 60% of the time in a market that rose 60% of the
 * time anyway has told you nothing, and the edge column is what shows that.
 */
import { sma, ema, rsi, macd, bollinger, stochastic, roc, williamsR, cci, obv } from "./indicators";
import { classify, noiseFloor, NEUTRAL } from "./signals";

/* Percentage move from each bar to the bar `horizon` later. The last `horizon`
 * bars have no outcome yet, so they are null and never counted. */
export function forwardReturns(closes, horizon) {
  return closes.map((close, index) => {
    const future = closes[index + horizon];
    if (!Number.isFinite(close) || !Number.isFinite(future) || close === 0) return null;
    return ((future - close) / close) * 100;
  });
}

function summarise(samples) {
  if (!samples.length) {
    return { count: 0, upRate: null, meanReturn: null, medianReturn: null };
  }
  const ups = samples.filter((value) => value > 0).length;
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return {
    count: samples.length,
    upRate: (ups / samples.length) * 100,
    meanReturn: samples.reduce((a, b) => a + b, 0) / samples.length,
    medianReturn:
      sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
  };
}

/* Statistics for the bars where `signals` held `wanted`. */
export function evaluate(signals, returns, wanted) {
  const samples = [];
  for (let i = 0; i < signals.length; i++) {
    if (signals[i] === wanted && returns[i] !== null) samples.push(returns[i]);
  }
  return summarise(samples);
}

/* The same statistics over every bar that has an outcome. */
export function baseRate(returns) {
  return summarise(returns.filter((value) => value !== null));
}

/* Builds the per bar signal series for every indicator, using the same
 * classifiers the live readings use. */
export function signalSeries({ closes, candles = [], volumes = [] }) {
  const series = {};
  const noise = noiseFloor(closes[closes.length - 1]);

  [10, 20, 50, 100, 200].forEach((period) => {
    const line = sma(closes, period);
    series[`SMA ${period}`] = closes.map((close, i) => classify.movingAverage(close, line[i]));
    const fast = ema(closes, period);
    series[`EMA ${period}`] = closes.map((close, i) => classify.movingAverage(close, fast[i]));
  });

  const rsiLine = rsi(closes, 14);
  series["RSI (14)"] = rsiLine.map((value) => classify.rsi(value));

  const macdValue = macd(closes);
  series["MACD (12, 26, 9)"] = macdValue.histogram.map((value) =>
    classify.macdHistogram(value, noise)
  );

  const bands = bollinger(closes, 20, 2);
  series["Bollinger (20, 2)"] = closes.map((close, i) =>
    classify.bollinger(close, bands.upper[i], bands.lower[i])
  );

  series["ROC (12)"] = roc(closes, 12).map((value) => classify.roc(value, noise));

  if (candles.length === closes.length) {
    series["Stochastic %K (14)"] = stochastic(candles, 14, 3).k.map((v) => classify.stochastic(v));
    series["Williams %R (14)"] = williamsR(candles, 14).map((v) => classify.williams(v));
    series["CCI (20)"] = cci(candles, 20).map((v) => classify.cci(v));
  }

  if (volumes.length === closes.length && closes.length > 1) {
    const line = obv(closes, volumes);
    series.OBV = line.map((value, i) => (i === 0 ? NEUTRAL : classify.obv(value, line[i - 1])));
  }

  return series;
}

/* One row per indicator: what it says now, and how the same reading fared over
 * this range historically. `edge` is the hit rate against the base rate, so a
 * positive number means the signal did better than the market did anyway. */
export function backtest({ closes, candles = [], volumes = [] }, horizon = 7) {
  // a row needs enough bars for the indicator to warm up and for a decent
  // number of outcomes after it, otherwise there is nothing to report
  if (!closes || closes.length < horizon * 3 || closes.length < 30) {
    return { rows: [], base: summarise([]), horizon, bars: closes ? closes.length : 0 };
  }

  const returns = forwardReturns(closes, horizon);
  const base = baseRate(returns);
  const series = signalSeries({ closes, candles, volumes });

  const rows = Object.keys(series).map((label) => {
    const signals = series[label];
    const now = signals[signals.length - 1];
    const stats = now === NEUTRAL ? summarise([]) : evaluate(signals, returns, now);
    return {
      label,
      now,
      ...stats,
      edge: stats.upRate === null || base.upRate === null ? null : stats.upRate - base.upRate,
    };
  });

  return { rows, base, horizon, bars: closes.length };
}

/* A plain reading of the whole table, weighted by how much each signal beat
 * the base rate, and honest about how little a handful of samples proves. */
export function readout(result, minimumSamples = 12) {
  const usable = result.rows.filter(
    (row) => row.now !== NEUTRAL && row.count >= minimumSamples && row.edge !== null
  );

  if (!usable.length) {
    return {
      verdict: "no read",
      reason:
        result.bars < 60
          ? "there is not enough history on this range to measure anything"
          : "none of the current signals occurred often enough here to say anything",
      bullish: 0,
      bearish: 0,
      samples: 0,
    };
  }

  /* What counts is what price did after the signal, not what the signal is
   * called. A reading labelled bearish that was followed by rises more often
   * than the base rate is evidence for a rise on this coin's own history, and
   * reading it the other way would inverse the whole table whenever an
   * indicator has been contrarian here. An edge within a few points of the
   * base rate is noise and counts for neither side. */
  let score = 0;
  let bullish = 0;
  let bearish = 0;
  usable.forEach((row) => {
    if (Math.abs(row.edge) < 5) return;
    score += row.edge;
    if (row.edge > 0) bullish += 1;
    else bearish += 1;
  });

  const verdict =
    score > 25 ? "leaned higher" : score < -25 ? "leaned lower" : "no clear lean";

  return {
    verdict,
    reason: null,
    bullish,
    bearish,
    samples: usable.reduce((total, row) => total + row.count, 0),
    strongest: [...usable].sort((a, b) => Math.abs(b.edge) - Math.abs(a.edge))[0] || null,
  };
}
