import { movingAverageRows, oscillatorRows, summarise, BUY, SELL, NEUTRAL } from "./signals";

const rising = Array.from({ length: 260 }, (v, i) => 100 + i);
const falling = Array.from({ length: 260 }, (v, i) => 400 - i);
const candlesFrom = (closes) => closes.map((c) => ({ open: c, high: c + 1, low: c - 1, close: c }));

const find = (rows, label) => rows.find((row) => row.label === label);

describe("moving average readings", () => {
  test("a price above every average reads bullish across the board", () => {
    const rows = movingAverageRows(rising);
    expect(rows).toHaveLength(10);
    expect(rows.every((row) => row.signal === BUY)).toBe(true);
    expect(rows.every((row) => row.value !== null)).toBe(true);
  });

  test("a price below every average reads bearish across the board", () => {
    expect(movingAverageRows(falling).every((row) => row.signal === SELL)).toBe(true);
  });

  test("an average that has not warmed up has no value and says why", () => {
    const rows = movingAverageRows(rising.slice(0, 30));
    expect(find(rows, "SMA 20").value).not.toBeNull();
    expect(find(rows, "SMA 200").value).toBeNull();
    expect(find(rows, "SMA 200").note).toBe("needs 200 points");
  });
});

describe("oscillator readings", () => {
  test("an unbroken rise is overbought on rsi and reads as a sell", () => {
    const row = find(oscillatorRows({ closes: rising }), "RSI (14)");
    expect(row.value).toBe(100);
    expect(row.signal).toBe(SELL);
    expect(row.note).toBe("overbought");
  });

  test("an unbroken fall is oversold on rsi and reads as a buy", () => {
    const row = find(oscillatorRows({ closes: falling }), "RSI (14)");
    expect(row.value).toBe(0);
    expect(row.signal).toBe(BUY);
    expect(row.note).toBe("oversold");
  });

  test("macd reads from the histogram against its signal line", () => {
    // an accelerating rise puts the macd line above its signal, a decelerating
    // one puts it below
    const accelerating = Array.from({ length: 120 }, (v, i) => 100 + i * i * 0.01);
    const decelerating = Array.from({ length: 120 }, (v, i) => 100 + Math.sqrt(i) * 10);
    expect(find(oscillatorRows({ closes: accelerating }), "MACD (12, 26, 9)").signal).toBe(BUY);
    expect(find(oscillatorRows({ closes: decelerating }), "MACD (12, 26, 9)").signal).toBe(SELL);
  });

  test("a histogram that is only floating point noise reads flat, not directional", () => {
    // a perfectly straight line converges until the histogram is around 1e-15,
    // which is zero for any practical purpose
    const row = find(oscillatorRows({ closes: rising }), "MACD (12, 26, 9)");
    expect(Math.abs(row.value)).toBeLessThan(1e-9);
    expect(row.signal).toBe(NEUTRAL);
    expect(row.note).toBe("on its signal line");
  });

  test("candle based readings only appear when candles are supplied", () => {
    const withoutCandles = oscillatorRows({ closes: rising });
    const withCandles = oscillatorRows({ closes: rising, candles: candlesFrom(rising) });
    expect(find(withoutCandles, "Stochastic %K (14)")).toBeUndefined();
    expect(find(withCandles, "Stochastic %K (14)").signal).toBe(SELL); // pinned at the top
    expect(find(withCandles, "Williams %R (14)").signal).toBe(SELL);
  });

  test("atr is reported but never votes, since it has no direction", () => {
    const row = find(oscillatorRows({ closes: rising, candles: candlesFrom(rising) }), "ATR (14)");
    expect(row.excludeFromSummary).toBe(true);
    expect(row.signal).toBe(NEUTRAL);
  });

  test("obv only appears when the volumes line up with the closes", () => {
    const closes = rising.slice(0, 40);
    expect(find(oscillatorRows({ closes, volumes: [1, 2] }), "OBV")).toBeUndefined();
    const row = find(oscillatorRows({ closes, volumes: closes.map(() => 1000) }), "OBV");
    expect(row.signal).toBe(BUY);
  });
});

describe("the overall summary", () => {
  test("counts only the readings that have a value and are allowed to vote", () => {
    const rows = [
      { label: "a", value: 1, signal: BUY },
      { label: "b", value: 1, signal: SELL },
      { label: "c", value: null, signal: BUY },
      { label: "d", value: 1, signal: NEUTRAL },
      { label: "e", value: 1, signal: BUY, excludeFromSummary: true },
    ];
    expect(summarise(rows)).toEqual({ buy: 1, sell: 1, neutral: 1, total: 3, verdict: "neutral" });
  });

  test("the wording follows the margin between bullish and bearish", () => {
    const make = (buys, sells, neutrals) => [
      ...Array.from({ length: buys }, (v, i) => ({ label: `b${i}`, value: 1, signal: BUY })),
      ...Array.from({ length: sells }, (v, i) => ({ label: `s${i}`, value: 1, signal: SELL })),
      ...Array.from({ length: neutrals }, (v, i) => ({ label: `n${i}`, value: 1, signal: NEUTRAL })),
    ];
    expect(summarise(make(10, 0, 0)).verdict).toBe("strong buy");
    expect(summarise(make(4, 1, 5)).verdict).toBe("buy");
    expect(summarise(make(1, 1, 8)).verdict).toBe("neutral");
    expect(summarise(make(1, 4, 5)).verdict).toBe("sell");
    expect(summarise(make(0, 10, 0)).verdict).toBe("strong sell");
  });

  test("no readings at all is neutral rather than a crash", () => {
    expect(summarise([])).toEqual({ buy: 0, sell: 0, neutral: 0, total: 0, verdict: "neutral" });
  });

  test("a steadily rising market reads bullish overall", () => {
    const rows = [
      ...movingAverageRows(rising),
      ...oscillatorRows({ closes: rising, candles: candlesFrom(rising) }),
    ];
    expect(summarise(rows).verdict).toContain("buy");
  });
});
