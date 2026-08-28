/* Turns the raw indicator series into the readings shown on the analysis
 * panel: a value, and whether that value is conventionally read as bullish,
 * bearish or neutral.
 *
 * These are the standard mechanical interpretations that charting packages
 * use. They describe what an indicator says, not what anyone should do.
 */
import { sma, ema, rsi, macd, bollinger, stochastic, atr, obv, roc, williamsR, cci, last } from "./indicators";

export const BUY = "buy";
export const SELL = "sell";
export const NEUTRAL = "neutral";

const MA_PERIODS = [10, 20, 50, 100, 200];

/* The conventions, as predicates. The live readings and the historical replay
 * both go through these, so what is measured is always what is shown. */
export const classify = {
  movingAverage: (price, average) => {
    if (!Number.isFinite(price) || !Number.isFinite(average)) return NEUTRAL;
    if (price > average) return BUY;
    if (price < average) return SELL;
    return NEUTRAL;
  },
  rsi: (value) => (value === null ? NEUTRAL : value > 70 ? SELL : value < 30 ? BUY : NEUTRAL),
  macdHistogram: (value, noise = 0) =>
    value === null ? NEUTRAL : value > noise ? BUY : value < -noise ? SELL : NEUTRAL,
  bollinger: (price, upper, lower) =>
    upper === null || lower === null || !Number.isFinite(price)
      ? NEUTRAL
      : price > upper
      ? SELL
      : price < lower
      ? BUY
      : NEUTRAL,
  roc: (value, noise = 0) =>
    value === null ? NEUTRAL : value > noise ? BUY : value < -noise ? SELL : NEUTRAL,
  stochastic: (value) => (value === null ? NEUTRAL : value > 80 ? SELL : value < 20 ? BUY : NEUTRAL),
  williams: (value) => (value === null ? NEUTRAL : value > -20 ? SELL : value < -80 ? BUY : NEUTRAL),
  cci: (value) => (value === null ? NEUTRAL : value > 100 ? SELL : value < -100 ? BUY : NEUTRAL),
  obv: (current, previous) =>
    !Number.isFinite(current) || !Number.isFinite(previous)
      ? NEUTRAL
      : current > previous
      ? BUY
      : current < previous
      ? SELL
      : NEUTRAL,
};

/* The scale below which a value is rounding noise rather than a direction. */
export const noiseFloor = (price) => Math.abs(price) * 1e-9 || 1e-12;

const maSignal = classify.movingAverage;

/* Every reading is { label, value, signal, note }, and value is null when the
 * series has not warmed up over the range on screen. */
export function movingAverageRows(closes) {
  const price = last(closes);
  const rows = [];

  MA_PERIODS.forEach((period) => {
    const value = last(sma(closes, period));
    rows.push({
      label: `SMA ${period}`,
      value,
      signal: maSignal(price, value),
      note: value === null ? `needs ${period} points` : null,
    });
  });

  MA_PERIODS.forEach((period) => {
    const value = last(ema(closes, period));
    rows.push({
      label: `EMA ${period}`,
      value,
      signal: maSignal(price, value),
      note: value === null ? `needs ${period} points` : null,
    });
  });

  return rows;
}

export function oscillatorRows({ closes, candles = [], volumes = [] }) {
  const price = last(closes);
  const rows = [];

  // a histogram of 1e-15 is a rounding artifact, not a direction. anything
  // smaller than this against the price is read as flat rather than as a
  // confident signal either way
  const noise = noiseFloor(price);

  // overbought above 70, oversold below 30
  const rsiValue = last(rsi(closes, 14));
  rows.push({
    label: "RSI (14)",
    value: rsiValue,
    signal: classify.rsi(rsiValue),
    note: rsiValue === null ? "needs 15 points" : rsiValue > 70 ? "overbought" : rsiValue < 30 ? "oversold" : null,
  });

  // the histogram is the macd line against its signal line
  const macdValue = macd(closes);
  const histogram = last(macdValue.histogram);
  const macdSignal = classify.macdHistogram(histogram, noise);
  rows.push({
    label: "MACD (12, 26, 9)",
    value: histogram,
    signal: macdSignal,
    note:
      histogram === null
        ? "needs 34 points"
        : macdSignal === BUY
        ? "above signal"
        : macdSignal === SELL
        ? "below signal"
        : "on its signal line",
  });

  const bands = bollinger(closes, 20, 2);
  const upper = last(bands.upper);
  const lower = last(bands.lower);
  rows.push({
    label: "Bollinger (20, 2)",
    value: price,
    signal: classify.bollinger(price, upper, lower),
    note:
      upper === null ? "needs 20 points" : price > upper ? "above the upper band" : price < lower ? "below the lower band" : "inside the bands",
  });

  const rocValue = last(roc(closes, 12));
  rows.push({
    label: "ROC (12)",
    value: rocValue,
    signal: classify.roc(rocValue, noise),
    note: rocValue === null ? "needs 13 points" : null,
  });

  if (candles.length) {
    // overbought above 80, oversold below 20
    const stoch = stochastic(candles, 14, 3);
    const k = last(stoch.k);
    rows.push({
      label: "Stochastic %K (14)",
      value: k,
      signal: classify.stochastic(k),
      note: k === null ? "needs 14 candles" : k > 80 ? "overbought" : k < 20 ? "oversold" : null,
    });

    // the mirror of the stochastic, from 0 down to -100
    const wr = last(williamsR(candles, 14));
    rows.push({
      label: "Williams %R (14)",
      value: wr,
      signal: classify.williams(wr),
      note: wr === null ? "needs 14 candles" : wr > -20 ? "overbought" : wr < -80 ? "oversold" : null,
    });

    const cciValue = last(cci(candles, 20));
    rows.push({
      label: "CCI (20)",
      value: cciValue,
      signal: classify.cci(cciValue),
      note:
        cciValue === null ? "needs 20 candles" : cciValue > 100 ? "overbought" : cciValue < -100 ? "oversold" : null,
    });

    // volatility, not direction, so it never votes
    const atrValue = last(atr(candles, 14));
    rows.push({
      label: "ATR (14)",
      value: atrValue,
      signal: NEUTRAL,
      note: atrValue === null ? "needs 15 candles" : "volatility, not a direction",
      excludeFromSummary: true,
    });
  }

  if (volumes.length === closes.length && closes.length > 1) {
    const obvSeries = obv(closes, volumes);
    const current = last(obvSeries);
    const previous = obvSeries[obvSeries.length - 2];
    rows.push({
      label: "OBV",
      value: current,
      signal: classify.obv(current, previous),
      note: "volume flow",
    });
  }

  return rows;
}

/* Counts the readings and gives the overall wording, the way a summary widget
 * does: the margin between bullish and bearish decides how strongly it reads. */
export function summarise(rows) {
  const counted = rows.filter((row) => !row.excludeFromSummary && row.value !== null);
  const buy = counted.filter((row) => row.signal === BUY).length;
  const sell = counted.filter((row) => row.signal === SELL).length;
  const neutral = counted.filter((row) => row.signal === NEUTRAL).length;
  const total = counted.length;

  let verdict = "neutral";
  if (total > 0) {
    const margin = (buy - sell) / total;
    if (margin >= 0.5) verdict = "strong buy";
    else if (margin >= 0.15) verdict = "buy";
    else if (margin <= -0.5) verdict = "strong sell";
    else if (margin <= -0.15) verdict = "sell";
  }

  return { buy, sell, neutral, total, verdict };
}
