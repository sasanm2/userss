import { makeRng, permutation, reshape, permutationTest } from "./permutation";

const seededWalk = (seed, n = 200, drift = 0) => {
  const rng = makeRng(seed);
  const out = [];
  let price = 100;
  for (let i = 0; i < n; i++) {
    price = price * (1 + (rng() - 0.5) * 0.05 + drift);
    out.push({ time: i, open: price, high: price * 1.02, low: price * 0.98, close: price });
  }
  return out;
};

const returnsOf = (candles) =>
  candles.slice(1).map((c, i) => c.close / candles[i].close - 1);

const correlation = (a, b) => {
  const n = Math.min(a.length, b.length);
  const meanA = a.slice(0, n).reduce((x, y) => x + y, 0) / n;
  const meanB = b.slice(0, n).reduce((x, y) => x + y, 0) / n;
  let top = 0, leftSq = 0, rightSq = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    top += da * db;
    leftSq += da * da;
    rightSq += db * db;
  }
  return top / Math.sqrt(leftSq * rightSq);
};

describe("the generator and the permutation", () => {
  test("the same seed gives the same sequence, a different seed does not", () => {
    const a = Array.from({ length: 5 }, makeRng(42));
    const b = Array.from({ length: 5 }, makeRng(42));
    const c = Array.from({ length: 5 }, makeRng(43));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  test("a permutation is a rearrangement, using every index exactly once", () => {
    const order = permutation(50, makeRng(7));
    expect(order).toHaveLength(50);
    expect([...order].sort((x, y) => x - y)).toEqual(Array.from({ length: 50 }, (v, i) => i));
  });
});

describe("what the shuffle keeps and what it destroys", () => {
  const candles = seededWalk(11);
  const order = permutation(candles.length - 1, makeRng(3));
  const shuffled = reshape(candles, order);

  test("the same returns are reused, only in a different order", () => {
    const before = returnsOf(candles).map((r) => r.toFixed(10)).sort();
    const after = returnsOf(shuffled).map((r) => r.toFixed(10)).sort();
    expect(after).toEqual(before);
  });

  test("the order really does change", () => {
    expect(returnsOf(shuffled)).not.toEqual(returnsOf(candles));
  });

  test("each bar keeps its own range, as a ratio to its close", () => {
    shuffled.slice(1).forEach((candle) => {
      expect(candle.high / candle.close).toBeCloseTo(1.02, 10);
      expect(candle.low / candle.close).toBeCloseTo(0.98, 10);
    });
  });

  test("the series still starts where it started", () => {
    expect(shuffled[0].close).toBe(candles[0].close);
    expect(shuffled).toHaveLength(candles.length);
  });
});

/* The reason the same permutation is used for every coin: coins move together,
 * and a null that quietly removed that would be answering a different and much
 * easier question. */
describe("correlation between coins", () => {
  const base = seededWalk(21);
  // a second coin that follows the first closely, as coins in one market do
  const partner = base.map((candle, i) => {
    const noise = makeRng(99 + i)() * 0.004 - 0.002;
    const close = candle.close * (1 + noise);
    return { time: i, open: close, high: close * 1.02, low: close * 0.98, close };
  });

  test("the two coins are strongly correlated to begin with", () => {
    expect(correlation(returnsOf(base), returnsOf(partner))).toBeGreaterThan(0.9);
  });

  test("one shared permutation keeps them moving together", () => {
    const order = permutation(base.length - 1, makeRng(5));
    const before = correlation(returnsOf(base), returnsOf(partner));
    const after = correlation(returnsOf(reshape(base, order)), returnsOf(reshape(partner, order)));
    expect(after).toBeCloseTo(before, 6);
  });

  test("shuffling each coin separately would destroy it, which is the trap", () => {
    const a = reshape(base, permutation(base.length - 1, makeRng(5)));
    const b = reshape(partner, permutation(partner.length - 1, makeRng(6)));
    expect(Math.abs(correlation(returnsOf(a), returnsOf(b)))).toBeLessThan(0.3);
  });
});

describe("the test itself", () => {
  const market = Array.from({ length: 12 }, (v, i) => ({ id: `coin${i}`, candles: seededWalk(100 + i, 240) }));

  test("a p value can never be zero, and never exceeds one", async () => {
    const result = await permutationTest(market, { replicates: 5, horizon: 7, seed: 1 });
    expect(result.rows.length).toBeGreaterThan(0);
    result.rows.forEach((row) => {
      expect(row.p).toBeGreaterThanOrEqual(1 / (result.replicates + 1));
      expect(row.p).toBeLessThanOrEqual(1);
      expect(row.pFamilywise).toBeGreaterThanOrEqual(row.p - 1e-12);
    });
  });

  test("the family wise value is never easier to pass than the plain one", async () => {
    const result = await permutationTest(market, { replicates: 8, horizon: 7, seed: 2 });
    result.rows.forEach((row) => {
      expect(row.pFamilywise).toBeGreaterThanOrEqual(row.p - 1e-12);
    });
  });

  test("noise does not come out significant against its own shuffles", async () => {
    const result = await permutationTest(market, { replicates: 30, horizon: 7, seed: 3 });
    const best = result.rows[0];
    // these coins are random walks, so nothing should clear the bar the
    // shuffled data sets
    expect(best.pFamilywise).toBeGreaterThan(0.05);
  });

  test("it stops when asked and reports how far it got", async () => {
    let calls = 0;
    const result = await permutationTest(market, {
      replicates: 50,
      horizon: 7,
      seed: 4,
      shouldStop: () => ++calls > 3,
    });
    expect(result.replicates).toBeLessThan(50);
    expect(result.replicates).toBeGreaterThan(0);
  });

  test("too few coins is refused rather than answered badly", async () => {
    const result = await permutationTest(market.slice(0, 2), { replicates: 5 });
    expect(result.tooFew).toBe(true);
    expect(result.rows).toHaveLength(0);
  });

  test("the same seed reproduces the run exactly", async () => {
    const a = await permutationTest(market, { replicates: 6, horizon: 7, seed: 77 });
    const b = await permutationTest(market, { replicates: 6, horizon: 7, seed: 77 });
    expect(a.rows.map((r) => [r.label, r.p, r.pFamilywise])).toEqual(
      b.rows.map((r) => [r.label, r.p, r.pFamilywise])
    );
  });
}, 60000);
