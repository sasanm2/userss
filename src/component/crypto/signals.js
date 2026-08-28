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

/* A price above its moving average is read as bullish, below it as bearish. */
function maSignal(price, average) {
  if (!Number.isFinite(price) || !Number.isFinite(average)) return NEUTRAL;
  if (price > average) return BUY;
  if (price < average) return SELL;
  return NEUTRAL;
}

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
  const noise = Math.abs(price) * 1e-9 || 1e-12;
  const sign = (value) => (value > noise ? BUY : value < -noise ? SELL : NEUTRAL);

  // overbought above 70, oversold below 30
  const rsiValue = last(rsi(closes, 14));
  rows.push({
    label: "RSI (14)",
    value: rsiValue,
    signal: rsiValue === null ? NEUTRAL : rsiValue > 70 ? SELL : rsiValue < 30 ? BUY : NEUTRAL,
    note: rsiValue === null ? "needs 15 points" : rsiValue > 70 ? "overbought" : rsiValue < 30 ? "oversold" : null,
  });

  // the histogram is the macd line against its signal line
  const macdValue = macd(closes);
  const histogram = last(macdValue.histogram);
  const macdSignal = histogram === null ? NEUTRAL : sign(histogram);
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
    signal:
      upper === null || lower === null ? NEUTRAL : price > upper ? SELL : price < lower ? BUY : NEUTRAL,
    note:
      upper === null ? "needs 20 points" : price > upper ? "above the upper band" : price < lower ? "below the lower band" : "inside the bands",
  });

  const rocValue = last(roc(closes, 12));
  rows.push({
    label: "ROC (12)",
    value: rocValue,
    signal: rocValue === null ? NEUTRAL : sign(rocValue),
    note: rocValue === null ? "needs 13 points" : null,
  });

  if (candles.length) {
    // overbought above 80, oversold below 20
    const stoch = stochastic(candles, 14, 3);
    const k = last(stoch.k);
    rows.push({
      label: "Stochastic %K (14)",
      value: k,
      signal: k === null ? NEUTRAL : k > 80 ? SELL : k < 20 ? BUY : NEUTRAL,
      note: k === null ? "needs 14 candles" : k > 80 ? "overbought" : k < 20 ? "oversold" : null,
    });

    // the mirror of the stochastic, from 0 down to -100
    const wr = last(williamsR(candles, 14));
    rows.push({
      label: "Williams %R (14)",
      value: wr,
      signal: wr === null ? NEUTRAL : wr > -20 ? SELL : wr < -80 ? BUY : NEUTRAL,
      note: wr === null ? "needs 14 candles" : wr > -20 ? "overbought" : wr < -80 ? "oversold" : null,
    });

    const cciValue = last(cci(candles, 20));
    rows.push({
      label: "CCI (20)",
      value: cciValue,
      signal: cciValue === null ? NEUTRAL : cciValue > 100 ? SELL : cciValue < -100 ? BUY : NEUTRAL,
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
      signal:
        !Number.isFinite(current) || !Number.isFinite(previous)
          ? NEUTRAL
          : current > previous
          ? BUY
          : current < previous
          ? SELL
          : NEUTRAL,
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
