/* Technical indicators.
 *
 * Every function takes an array of numbers (oldest first) and returns an array
 * of the same length, with null in the positions where the indicator has not
 * warmed up yet. Keeping the lengths aligned means a result can be charted
 * against the same x axis as the prices without any index juggling.
 *
 * The formulas follow the standard definitions: Wilder's smoothing for RSI and
 * ATR (not a plain moving average, which is the usual way these come out
 * wrong), a population standard deviation for Bollinger Bands, and an EMA
 * seeded with the simple average of its first period.
 */

const isNum = (value) => Number.isFinite(value);

function filled(length) {
  return new Array(length).fill(null);
}

/* Simple moving average. */
export function sma(values, period) {
  const out = filled(values.length);
  if (period < 1) return out;

  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    if (!isNum(values[i])) return out;
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/* Exponential moving average, seeded with the simple average of the first
 * `period` values, which is what charting packages do. */
export function ema(values, period) {
  const out = filled(values.length);
  if (period < 1 || values.length < period) return out;

  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i++) {
    if (!isNum(values[i])) return out;
    seed += values[i];
  }

  let prev = seed / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/* Relative strength index, with Wilder's smoothing.
 *
 * The first average gain and loss are the plain means of the first `period`
 * changes; after that each one is (previous * (period - 1) + current) / period.
 * An all-gains window gives 100 and an all-losses window gives 0. */
export function rsi(values, period = 14) {
  const out = filled(values.length);
  if (values.length <= period) return out;

  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];
    if (change >= 0) gain += change;
    else loss -= change;
  }
  gain /= period;
  loss /= period;

  const value = (g, l) => (l === 0 ? 100 : g === 0 ? 0 : 100 - 100 / (1 + g / l));
  out[period] = value(gain, loss);

  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    gain = (gain * (period - 1) + (change > 0 ? change : 0)) / period;
    loss = (loss * (period - 1) + (change < 0 ? -change : 0)) / period;
    out[i] = value(gain, loss);
  }
  return out;
}

/* Moving average convergence divergence: the gap between two emas, a signal
 * line over that gap, and the histogram between the two. */
export function macd(values, fast = 12, slow = 26, signalPeriod = 9) {
  const fastLine = ema(values, fast);
  const slowLine = ema(values, slow);

  const line = values.map((v, i) =>
    isNum(fastLine[i]) && isNum(slowLine[i]) ? fastLine[i] - slowLine[i] : null
  );

  // the signal is an ema of the macd line, so it starts where that line does
  const start = line.findIndex(isNum);
  const signal = filled(values.length);
  const histogram = filled(values.length);

  if (start !== -1) {
    const compact = line.slice(start).filter(isNum);
    const signalCompact = ema(compact, signalPeriod);
    for (let i = 0; i < signalCompact.length; i++) {
      if (isNum(signalCompact[i])) {
        signal[start + i] = signalCompact[i];
        histogram[start + i] = line[start + i] - signalCompact[i];
      }
    }
  }

  return { line, signal, histogram };
}

/* Population standard deviation over a trailing window. */
function rollingStdev(values, period) {
  const out = filled(values.length);
  for (let i = period - 1; i < values.length; i++) {
    const window = values.slice(i - period + 1, i + 1);
    const mean = window.reduce((a, b) => a + b, 0) / period;
    const variance = window.reduce((a, b) => a + (b - mean) * (b - mean), 0) / period;
    out[i] = Math.sqrt(variance);
  }
  return out;
}

/* Bollinger bands: a simple moving average with bands a number of standard
 * deviations either side. */
export function bollinger(values, period = 20, multiplier = 2) {
  const middle = sma(values, period);
  const deviation = rollingStdev(values, period);
  const upper = filled(values.length);
  const lower = filled(values.length);

  for (let i = 0; i < values.length; i++) {
    if (isNum(middle[i]) && isNum(deviation[i])) {
      upper[i] = middle[i] + multiplier * deviation[i];
      lower[i] = middle[i] - multiplier * deviation[i];
    }
  }
  return { middle, upper, lower };
}

/* Stochastic oscillator. %K is where the close sits inside the period's range,
 * %D is a short average of %K. A flat range gives 50 rather than a division by
 * zero. */
export function stochastic(candles, period = 14, smoothing = 3) {
  const length = candles.length;
  const k = filled(length);

  for (let i = period - 1; i < length; i++) {
    const window = candles.slice(i - period + 1, i + 1);
    const high = Math.max(...window.map((c) => c.high));
    const low = Math.min(...window.map((c) => c.low));
    k[i] = high === low ? 50 : ((candles[i].close - low) / (high - low)) * 100;
  }

  const compactStart = k.findIndex(isNum);
  const d = filled(length);
  if (compactStart !== -1) {
    const smoothed = sma(k.slice(compactStart), smoothing);
    for (let i = 0; i < smoothed.length; i++) {
      if (isNum(smoothed[i])) d[compactStart + i] = smoothed[i];
    }
  }
  return { k, d };
}

/* True range for one candle against the previous close. */
function trueRange(candle, previous) {
  if (!previous) return candle.high - candle.low;
  return Math.max(
    candle.high - candle.low,
    Math.abs(candle.high - previous.close),
    Math.abs(candle.low - previous.close)
  );
}

/* Average true range, smoothed the way Wilder defined it. */
export function atr(candles, period = 14) {
  const out = filled(candles.length);
  if (candles.length <= period) return out;

  const ranges = candles.map((candle, i) => trueRange(candle, candles[i - 1]));

  let sum = 0;
  for (let i = 1; i <= period; i++) sum += ranges[i];
  let prev = sum / period;
  out[period] = prev;

  for (let i = period + 1; i < candles.length; i++) {
    prev = (prev * (period - 1) + ranges[i]) / period;
    out[i] = prev;
  }
  return out;
}

/* On balance volume: volume added on an up close, taken away on a down close,
 * left alone when the close is unchanged. */
export function obv(closes, volumes) {
  const out = filled(closes.length);
  if (!closes.length) return out;

  let total = 0;
  out[0] = 0;
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) total += volumes[i];
    else if (closes[i] < closes[i - 1]) total -= volumes[i];
    out[i] = total;
  }
  return out;
}

/* Rate of change, as a percentage of the price `period` bars ago. */
export function roc(values, period = 12) {
  const out = filled(values.length);
  for (let i = period; i < values.length; i++) {
    const past = values[i - period];
    if (past !== 0) out[i] = ((values[i] - past) / past) * 100;
  }
  return out;
}

/* Williams %R: the mirror of the stochastic, running from 0 down to -100. */
export function williamsR(candles, period = 14) {
  const out = filled(candles.length);
  for (let i = period - 1; i < candles.length; i++) {
    const window = candles.slice(i - period + 1, i + 1);
    const high = Math.max(...window.map((c) => c.high));
    const low = Math.min(...window.map((c) => c.low));
    out[i] = high === low ? -50 : ((high - candles[i].close) / (high - low)) * -100;
  }
  return out;
}

/* Commodity channel index, over the typical price, with the usual 0.015
 * constant and a mean absolute deviation. */
export function cci(candles, period = 20) {
  const typical = candles.map((c) => (c.high + c.low + c.close) / 3);
  const average = sma(typical, period);
  const out = filled(candles.length);

  for (let i = period - 1; i < candles.length; i++) {
    const window = typical.slice(i - period + 1, i + 1);
    const meanDeviation =
      window.reduce((total, value) => total + Math.abs(value - average[i]), 0) / period;
    out[i] = meanDeviation === 0 ? 0 : (typical[i] - average[i]) / (0.015 * meanDeviation);
  }
  return out;
}

export const last = (series) => {
  for (let i = series.length - 1; i >= 0; i--) {
    if (isNum(series[i])) return series[i];
  }
  return null;
};
