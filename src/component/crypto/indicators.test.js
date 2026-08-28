import {
  sma, ema, rsi, macd, bollinger, stochastic, atr, obv, roc, williamsR, cci, last,
} from "./indicators";

const candle = (high, low, close) => ({ open: close, high, low, close });
const flat = (value, count) => new Array(count).fill(value);

describe("moving averages", () => {
  test("sma matches the hand computed average and warms up in the right place", () => {
    // averages of [1,2,3], [2,3,4], [3,4,5]
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });

  test("ema is seeded with the simple average and then weighted by 2/(n+1)", () => {
    // seed (1+2+3)/3 = 2, k = 0.5, then 4*0.5 + 2*0.5 = 3, then 5*0.5 + 3*0.5 = 4
    expect(ema([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });

  test("a series shorter than the period produces no values at all", () => {
    expect(sma([1, 2], 5)).toEqual([null, null]);
    expect(ema([1, 2], 5)).toEqual([null, null]);
  });
});

describe("rsi", () => {
  // the standard 14 period worked example. the first value follows from the
  // first fourteen changes: average gain 0.2385714..., average loss 0.1, so
  // rs = 2.3857142... and rsi = 100 - 100 / (1 + rs) = 70.4641...
  const example = [
    44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61,
    46.28, 46.28, 46.0, 46.03, 46.41, 46.22, 45.64,
  ];

  test("the first value equals the exact wilder computation", () => {
    const result = rsi(example, 14);
    expect(result[13]).toBeNull();
    expect(result[14]).toBeCloseTo(70.4641, 4);
  });

  test("later values use wilder smoothing rather than a plain average", () => {
    const result = rsi(example, 14);
    // the next close falls 0.28, so the smoothed gain is (0.2385714 * 13) / 14
    // = 0.2215306 and the smoothed loss is (0.1 * 13 + 0.28) / 14 = 0.1128571,
    // giving 100 - 100 / (1 + 1.9629...) = 66.2496...
    expect(result[15]).toBeCloseTo(66.2496, 4);
  });

  test("an unbroken rise is 100 and an unbroken fall is 0", () => {
    const rising = Array.from({ length: 30 }, (v, i) => 100 + i);
    const falling = Array.from({ length: 30 }, (v, i) => 100 - i);
    expect(last(rsi(rising, 14))).toBe(100);
    expect(last(rsi(falling, 14))).toBe(0);
  });

  test("a flat series has no gains or losses and reads 100 by convention", () => {
    // both averages are zero; the zero loss branch decides, as it does in the
    // reference implementations
    expect(last(rsi(flat(50, 30), 14))).toBe(100);
  });
});

describe("macd", () => {
  test("a flat series has no divergence at all", () => {
    const { line, signal, histogram } = macd(flat(10, 60));
    expect(last(line)).toBeCloseTo(0, 12);
    expect(last(signal)).toBeCloseTo(0, 12);
    expect(last(histogram)).toBeCloseTo(0, 12);
  });

  test("the line is the gap between the two emas", () => {
    const values = Array.from({ length: 60 }, (v, i) => 100 + Math.sin(i / 5) * 10);
    const fast = ema(values, 12);
    const slow = ema(values, 26);
    const { line } = macd(values);
    expect(line[59]).toBeCloseTo(fast[59] - slow[59], 12);
  });

  test("the signal line starts nine bars after the macd line", () => {
    const values = Array.from({ length: 60 }, (v, i) => 100 + i);
    const { line, signal } = macd(values);
    const lineStart = line.findIndex((v) => v !== null);
    const signalStart = signal.findIndex((v) => v !== null);
    expect(signalStart - lineStart).toBe(8);
  });
});

describe("bollinger bands", () => {
  test("bands sit two population deviations either side of the average", () => {
    // this set has mean 5 and a population standard deviation of exactly 2
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    const { middle, upper, lower } = bollinger(values, 8, 2);
    expect(middle[7]).toBeCloseTo(5, 12);
    expect(upper[7]).toBeCloseTo(9, 12);
    expect(lower[7]).toBeCloseTo(1, 12);
  });

  test("a flat series collapses the bands onto the average", () => {
    const { middle, upper, lower } = bollinger(flat(7, 30), 20, 2);
    expect(last(middle)).toBeCloseTo(7, 12);
    expect(last(upper)).toBeCloseTo(7, 12);
    expect(last(lower)).toBeCloseTo(7, 12);
  });
});

describe("stochastic and williams %r", () => {
  const candles = [
    ...Array.from({ length: 13 }, () => candle(12, 8, 10)),
    candle(12, 8, 12),
  ];

  test("a close at the top of the range is 100, and williams is 0", () => {
    expect(last(stochastic(candles, 14).k)).toBeCloseTo(100, 12);
    expect(last(williamsR(candles, 14))).toBeCloseTo(0, 12);
  });

  test("a close at the bottom of the range is 0, and williams is -100", () => {
    const low = [...candles.slice(0, 13), candle(12, 8, 8)];
    expect(last(stochastic(low, 14).k)).toBeCloseTo(0, 12);
    expect(last(williamsR(low, 14))).toBeCloseTo(-100, 12);
  });

  test("a range with no width reads in the middle instead of dividing by zero", () => {
    const still = Array.from({ length: 20 }, () => candle(10, 10, 10));
    expect(last(stochastic(still, 14).k)).toBe(50);
    expect(last(williamsR(still, 14))).toBe(-50);
  });

  test("%d is a three period average of %k", () => {
    const mixed = Array.from({ length: 30 }, (v, i) => candle(20 + i, 5 + i, 10 + i));
    const { k, d } = stochastic(mixed, 14, 3);
    expect(d[29]).toBeCloseTo((k[29] + k[28] + k[27]) / 3, 12);
  });
});

describe("atr", () => {
  test("true range takes the previous close into account, not just the bar", () => {
    // a gap up: the bar is 2 wide but the move from the previous close is 6
    const candles = [
      ...Array.from({ length: 14 }, () => candle(11, 9, 10)),
      candle(16, 14, 15),
    ];
    const result = atr(candles, 14);
    // the first 14 bars are each 2 wide, so the seed is 2; the gap bar has a
    // true range of 16 - 10 = 6, smoothed as (2 * 13 + 6) / 14
    expect(result[14]).toBeCloseTo((2 * 13 + 6) / 14, 12);
  });

  test("a series shorter than the period gives nothing", () => {
    expect(atr([candle(1, 0, 1)], 14).every((v) => v === null)).toBe(true);
  });
});

describe("obv, roc and cci", () => {
  test("obv adds volume on an up close and subtracts it on a down close", () => {
    const closes = [10, 11, 10, 10, 12];
    const volumes = [100, 200, 300, 400, 500];
    expect(obv(closes, volumes)).toEqual([0, 200, -100, -100, 400]);
  });

  test("roc is the percentage move over the period", () => {
    expect(roc([100, 110], 1)[1]).toBeCloseTo(10, 12);
    expect(roc([100, 50], 1)[1]).toBeCloseTo(-50, 12);
  });

  test("cci is zero when the typical price never moves", () => {
    const still = Array.from({ length: 25 }, () => candle(10, 10, 10));
    expect(last(cci(still, 20))).toBe(0);
  });

  test("cci is positive above the average and negative below it", () => {
    const rising = Array.from({ length: 30 }, (v, i) => candle(10 + i, 10 + i, 10 + i));
    const falling = Array.from({ length: 30 }, (v, i) => candle(40 - i, 40 - i, 40 - i));
    expect(last(cci(rising, 20))).toBeGreaterThan(0);
    expect(last(cci(falling, 20))).toBeLessThan(0);
  });
});

describe("shape of every result", () => {
  const values = Array.from({ length: 40 }, (v, i) => 100 + i);
  const candles = values.map((v) => candle(v + 1, v - 1, v));

  test("every series is the same length as its input", () => {
    expect(sma(values, 5)).toHaveLength(40);
    expect(ema(values, 5)).toHaveLength(40);
    expect(rsi(values, 14)).toHaveLength(40);
    expect(macd(values).line).toHaveLength(40);
    expect(bollinger(values).middle).toHaveLength(40);
    expect(stochastic(candles).k).toHaveLength(40);
    expect(atr(candles)).toHaveLength(40);
    expect(obv(values, values)).toHaveLength(40);
    expect(roc(values)).toHaveLength(40);
    expect(williamsR(candles)).toHaveLength(40);
    expect(cci(candles)).toHaveLength(40);
  });

  test("an empty input never throws", () => {
    expect(() => {
      sma([], 5); ema([], 5); rsi([], 14); macd([]); bollinger([]);
      stochastic([]); atr([]); obv([], []); roc([]); williamsR([]); cci([]);
    }).not.toThrow();
  });

  test("last skips the warmup nulls and finds the newest real value", () => {
    expect(last([null, null, 3, null])).toBe(3);
    expect(last([null, null])).toBeNull();
  });
});
