import { folds, walkForward, verdict } from "./walkforward";

const candlesFrom = (closes) => closes.map((c) => ({ open: c, high: c * 1.01, low: c * 0.99, close: c }));

const seeded = (seed) => () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

// pure noise: nothing here should survive out of sample
const random = (() => {
  const rnd = seeded(3);
  const out = [];
  let price = 100;
  for (let i = 0; i < 600; i++) {
    price = price * (1 + (rnd() - 0.5) * 0.05);
    out.push(price);
  }
  return out;
})();

// a rigid repeating cycle: what happens after a given point in the cycle is
// the same in every block, so a rule found in one block must hold in the next
const cyclical = (() => {
  const out = [];
  for (let i = 0; i < 600; i++) {
    const phase = i % 40;
    out.push(100 + (phase < 20 ? phase : 40 - phase) * 3);
  }
  return out;
})();

describe("fold boundaries", () => {
  test("each test block follows its training window, and the blocks do not overlap", () => {
    const windows = folds(500, 4, 7);
    expect(windows).toHaveLength(4);
    windows.forEach((window) => {
      expect(window.train.to).toBeLessThan(window.test.from);
      expect(window.test.from).toBeLessThan(window.test.to);
    });
    for (let i = 1; i < windows.length; i++) {
      expect(windows[i].test.from).toBeGreaterThanOrEqual(windows[i - 1].test.to);
    }
  });

  test("the embargo keeps a training outcome from reaching into its test block", () => {
    const horizon = 7;
    const windows = folds(500, 4, horizon);
    windows.forEach((window) => {
      // the last training bar plus the horizon must still land before the split
      expect(window.train.to - 1 + horizon).toBeLessThan(window.test.from);
    });
  });

  test("the last block runs to the end of the series", () => {
    const windows = folds(500, 4, 7);
    expect(windows[windows.length - 1].test.to).toBe(500);
  });

  test("a horizon too long for the blocks produces no folds at all", () => {
    expect(folds(100, 4, 30)).toHaveLength(0);
  });
});

describe("walking a series forward", () => {
  test("a short series is refused rather than split into meaningless folds", () => {
    const result = walkForward({ closes: random.slice(0, 100) }, { horizon: 7 });
    expect(result.rows).toHaveLength(0);
    expect(result.summary).toBeNull();
    expect(verdict(result.summary).text).toMatch(/not enough history/);
  });

  test("every row compares a training window with the block that came after it", () => {
    const result = walkForward({ closes: random, candles: candlesFrom(random) }, { horizon: 7, count: 4 });
    expect(result.rows.length).toBeGreaterThan(0);
    result.rows.forEach((row) => {
      expect(row.fold).toBeGreaterThanOrEqual(1);
      expect(row.fold).toBeLessThanOrEqual(4);
      expect(row.trainCount).toBeGreaterThanOrEqual(10);
      expect(row.testCount).toBeGreaterThanOrEqual(10);
      expect(Number.isFinite(row.trainEdge)).toBe(true);
      expect(Number.isFinite(row.testEdge)).toBe(true);
    });
  });

  test("a rigidly repeating series keeps its edge out of sample", () => {
    const result = walkForward({ closes: cyclical, candles: candlesFrom(cyclical) }, { horizon: 5, count: 4 });
    expect(result.summary).not.toBeNull();
    // the same cycle repeats in every block, so what held in training holds after
    expect(result.summary.heldRate).toBeGreaterThan(65);
    expect(verdict(result.summary).tone).toBe("good");
  });

  test("noise does not hold up, and the edge measured in sample mostly evaporates", () => {
    const result = walkForward({ closes: random, candles: candlesFrom(random) }, { horizon: 7, count: 4 });
    expect(result.summary).not.toBeNull();
    // whatever edge the training window found, far less of it survives
    expect(result.summary.meanTestEdge).toBeLessThan(result.summary.meanTrainEdge);
    expect(verdict(result.summary).tone).not.toBe("good");
  });

  test("only edges big enough to act on are counted for or against", () => {
    const result = walkForward({ closes: random }, { horizon: 7, count: 4 });
    result.rows.forEach((row) => {
      if (Math.abs(row.trainEdge) < 5) {
        expect(row.decisive).toBe(false);
        expect(row.held).toBe(false);
      }
    });
  });
});

describe("the wording", () => {
  test("calls out a rule that reversed out of sample", () => {
    const summary = { tested: 10, held: 2, heldRate: 20, meanTrainEdge: 15, meanTestEdge: -6 };
    const read = verdict(summary);
    expect(read.tone).toBe("bad");
    expect(read.text).toMatch(/did not survive/);
  });

  test("calls a coin flip a coin flip", () => {
    const summary = { tested: 10, held: 5, heldRate: 50, meanTrainEdge: 12, meanTestEdge: 1 };
    expect(verdict(summary).text).toBe("no better than chance");
  });

  test("only calls it a hold when the edge came with the direction", () => {
    const heldButEmpty = { tested: 10, held: 7, heldRate: 70, meanTrainEdge: 12, meanTestEdge: 0.5 };
    expect(verdict(heldButEmpty).text).toBe("no better than chance");
    const properly = { tested: 10, held: 7, heldRate: 70, meanTrainEdge: 12, meanTestEdge: 6 };
    expect(verdict(properly).tone).toBe("good");
  });
});
