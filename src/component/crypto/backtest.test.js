import { forwardReturns, evaluate, baseRate, signalSeries, backtest, readout } from "./backtest";
import { sma, ema, rsi, macd, bollinger, stochastic, williamsR, cci, roc } from "./indicators";
import { BUY, SELL, NEUTRAL } from "./signals";

const candlesFrom = (closes) => closes.map((c) => ({ open: c, high: c * 1.01, low: c * 0.99, close: c }));

// a deterministic series with trend, waves and noise
const wobbly = (() => {
  let seed = 11;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const out = [];
  let price = 100;
  for (let i = 0; i < 300; i++) {
    price = price * (1 + (rnd() - 0.5) * 0.05) + Math.sin(i / 8) * 1.5;
    out.push(price);
  }
  return out;
})();

describe("forward returns", () => {
  test("measures the move to the bar the horizon later", () => {
    const returns = forwardReturns([100, 110, 90, 100], 1);
    expect(returns[0]).toBeCloseTo(10, 10);
    expect(returns[1]).toBeCloseTo(-18.1818, 4);
    expect(returns[2]).toBeCloseTo(11.1111, 4);
    // the last bar has no future yet
    expect(returns[3]).toBeNull();
  });

  test("the last horizon bars are never counted, since their outcome is unknown", () => {
    const returns = forwardReturns([1, 2, 3, 4, 5], 3);
    expect(returns.filter((v) => v !== null)).toHaveLength(2);
    expect(returns.slice(2).every((v) => v === null)).toBe(true);
  });
});

/* The property that makes or breaks a backtest: the value an indicator shows at
 * bar i must not change when later bars are added, or the replay would be
 * scoring signals that could not have been seen at the time. */
describe("no lookahead", () => {
  const cut = 200;
  const truncated = wobbly.slice(0, cut);

  const check = (name, full, partial) => {
    test(`${name} at bar ${cut - 1} is the same with and without the later bars`, () => {
      expect(partial[cut - 1]).toBeCloseTo(full[cut - 1], 10);
    });
  };

  check("sma 20", sma(wobbly, 20), sma(truncated, 20));
  check("ema 12", ema(wobbly, 12), ema(truncated, 12));
  check("rsi 14", rsi(wobbly, 14), rsi(truncated, 14));
  check("macd histogram", macd(wobbly).histogram, macd(truncated).histogram);
  check("bollinger upper", bollinger(wobbly).upper, bollinger(truncated).upper);
  check("roc 12", roc(wobbly, 12), roc(truncated, 12));
  check("stochastic %k", stochastic(candlesFrom(wobbly)).k, stochastic(candlesFrom(truncated)).k);
  check("williams %r", williamsR(candlesFrom(wobbly)), williamsR(candlesFrom(truncated)));
  check("cci 20", cci(candlesFrom(wobbly)), cci(candlesFrom(truncated)));

  test("the whole signal table at a past bar does not change when later bars arrive", () => {
    const full = signalSeries({ closes: wobbly, candles: candlesFrom(wobbly) });
    const partial = signalSeries({ closes: truncated, candles: candlesFrom(truncated) });
    Object.keys(partial).forEach((label) => {
      expect(partial[label][cut - 1]).toBe(full[label][cut - 1]);
    });
  });
});

describe("evaluating a signal", () => {
  test("counts only the bars where the signal held and an outcome exists", () => {
    const signals = [BUY, SELL, BUY, BUY];
    const returns = [10, -5, -2, null];
    const stats = evaluate(signals, returns, BUY);
    expect(stats.count).toBe(2);
    expect(stats.upRate).toBe(50);
    expect(stats.meanReturn).toBeCloseTo(4, 10);
  });

  test("a signal that never occurred reports nothing rather than zero", () => {
    const stats = evaluate([NEUTRAL, NEUTRAL], [1, 2], BUY);
    expect(stats).toEqual({ count: 0, upRate: null, meanReturn: null, medianReturn: null });
  });

  test("the base rate covers every bar with an outcome", () => {
    const base = baseRate([10, -5, null, 3]);
    expect(base.count).toBe(3);
    expect(base.upRate).toBeCloseTo(66.6667, 4);
  });

  test("the median is the middle sample, not the mean", () => {
    const stats = evaluate([BUY, BUY, BUY], [1, 2, 100], BUY);
    expect(stats.medianReturn).toBe(2);
    expect(stats.meanReturn).toBeCloseTo(34.3333, 4);
  });
});

describe("the edge against the base rate", () => {
  test("a signal that fires on every bar has no edge at all", () => {
    // SMA 10 on a series that only rises is bullish everywhere, so its hit
    // rate must equal the base rate exactly
    const rising = Array.from({ length: 120 }, (v, i) => 100 + i);
    const result = backtest({ closes: rising }, 5);
    const row = result.rows.find((r) => r.label === "SMA 10");
    expect(row.now).toBe(BUY);
    expect(row.edge).toBeCloseTo(0, 10);
  });

  test("a signal that only fires before rises shows a positive edge", () => {
    // a sawtooth: every dip below the lower band is followed by a bounce
    const closes = [];
    for (let i = 0; i < 300; i++) closes.push(100 + (i % 20 < 10 ? i % 20 : 20 - (i % 20)) * 2);
    const result = backtest({ closes }, 3);
    const bollingerRow = result.rows.find((r) => r.label === "Bollinger (20, 2)");
    if (bollingerRow.now === BUY && bollingerRow.count > 5) {
      expect(bollingerRow.upRate).toBeGreaterThan(result.base.upRate);
    }
    expect(result.base.count).toBeGreaterThan(0);
  });
});

describe("the readout", () => {
  test("says so plainly when there is not enough history", () => {
    const result = backtest({ closes: [1, 2, 3, 4, 5] }, 3);
    // no rows are invented from five bars
    expect(result.rows).toHaveLength(0);
    const read = readout(result);
    expect(read.verdict).toBe("no read");
    expect(read.reason).toMatch(/not enough history/);
  });

  test("a range too short for the horizon reports nothing rather than a thin row", () => {
    // 40 bars against a 20 bar horizon leaves too few outcomes to mean anything
    const result = backtest({ closes: wobbly.slice(0, 40) }, 20);
    expect(result.rows).toHaveLength(0);
    expect(readout(result).verdict).toBe("no read");
  });

  test("refuses to read anything from a handful of samples", () => {
    const result = backtest({ closes: wobbly.slice(0, 80) }, 7);
    const read = readout(result, 1000);
    expect(read.verdict).toBe("no read");
    expect(read.reason).toMatch(/often enough/);
  });

  test("gives a lean only when signals beat the base rate by a margin", () => {
    const result = backtest({ closes: wobbly, candles: candlesFrom(wobbly) }, 7);
    const read = readout(result);
    expect(["leaned higher", "leaned lower", "no clear lean", "no read"]).toContain(read.verdict);
    if (read.verdict !== "no read") {
      expect(read.samples).toBeGreaterThan(0);
    }
  });

  test("a signal that was historically wrong is read by its outcome, not its name", () => {
    // a contrarian case: the rows that are signalling now were followed by
    // rises far more often than the base rate. whatever those signals are
    // called, the history leaned higher, and the readout must say so
    const result = {
      bars: 300,
      horizon: 7,
      base: { count: 280, upRate: 50, meanReturn: 0.1, medianReturn: 0.1 },
      rows: [
        { label: "SMA 200", now: SELL, count: 90, upRate: 72, meanReturn: 4, medianReturn: 4, edge: 22 },
        { label: "EMA 200", now: SELL, count: 76, upRate: 77, meanReturn: 5, medianReturn: 5, edge: 27 },
        { label: "SMA 100", now: SELL, count: 116, upRate: 57, meanReturn: 2, medianReturn: 2, edge: 7 },
      ],
    };
    const read = readout(result);
    expect(read.verdict).toBe("leaned higher");
    expect(read.bullish).toBe(3);
    expect(read.bearish).toBe(0);
  });

  test("signals followed by falls read as leaning lower", () => {
    const result = {
      bars: 300,
      horizon: 7,
      base: { count: 280, upRate: 50, meanReturn: 0.1, medianReturn: 0.1 },
      rows: [
        { label: "RSI (14)", now: BUY, count: 60, upRate: 30, meanReturn: -3, medianReturn: -3, edge: -20 },
        { label: "CCI (20)", now: BUY, count: 55, upRate: 32, meanReturn: -2, medianReturn: -2, edge: -18 },
      ],
    };
    const read = readout(result);
    expect(read.verdict).toBe("leaned lower");
    expect(read.bearish).toBe(2);
  });

  test("every row reports its own sample count so a thin one is visible", () => {
    const result = backtest({ closes: wobbly, candles: candlesFrom(wobbly) }, 7);
    result.rows.forEach((row) => {
      expect(typeof row.count).toBe("number");
      if (row.now === NEUTRAL) expect(row.count).toBe(0);
    });
  });
});
