import { binomialPmf, binomialTest, aggregate, scanVerdict } from "./aggregate";

const walkRow = (label, fold, held, trainEdge = 12, testEdge = 6) => ({
  label, fold, signal: "buy", trainCount: 40, testCount: 30,
  trainEdge, testEdge, held, decisive: Math.abs(trainEdge) >= 5,
});
const coin = (id, rows) => ({ id, name: id, walk: { rows, summary: {}, horizon: 7, count: 4 } });

describe("the binomial maths", () => {
  test("the mass function matches values computable by hand", () => {
    // C(10,5) / 2^10 = 252 / 1024
    expect(binomialPmf(5, 10, 0.5)).toBeCloseTo(252 / 1024, 12);
    // both tails are a single outcome: 1 / 1024
    expect(binomialPmf(0, 10, 0.5)).toBeCloseTo(1 / 1024, 12);
    expect(binomialPmf(10, 10, 0.5)).toBeCloseTo(1 / 1024, 12);
  });

  test("the whole distribution sums to one", () => {
    let total = 0;
    for (let k = 0; k <= 30; k++) total += binomialPmf(k, 30, 0.5);
    expect(total).toBeCloseTo(1, 10);
  });

  test("the two sided test matches values computable by hand", () => {
    // 8 of 10: both tails are (1 + 10 + 45) / 1024 each, so 112 / 1024
    expect(binomialTest(8, 10, 0.5)).toBeCloseTo(112 / 1024, 12);
    // 15 of 20: 2 * (15504 + 4845 + 1140 + 190 + 20 + 1) / 2^20
    expect(binomialTest(15, 20, 0.5)).toBeCloseTo((2 * 21700) / 1048576, 12);
    // dead on the expectation is as unsurprising as it gets
    expect(binomialTest(5, 10, 0.5)).toBeCloseTo(1, 12);
  });

  test("a lopsided result is properly unlikely, a balanced one is not", () => {
    expect(binomialTest(90, 100, 0.5)).toBeLessThan(1e-15);
    expect(binomialTest(55, 100, 0.5)).toBeGreaterThan(0.2);
  });

  test("no trials means nothing to say", () => {
    expect(binomialTest(0, 0, 0.5)).toBe(1);
  });
});

describe("pooling coins", () => {
  test("counts one vote per coin per indicator, however many blocks it had", () => {
    const results = [
      coin("a", [walkRow("RSI (14)", 1, true), walkRow("RSI (14)", 2, true)]),
      coin("b", [walkRow("RSI (14)", 1, false)]),
    ];
    const row = aggregate(results).rows.find((r) => r.label === "RSI (14)");
    expect(row.coins).toBe(2);
    expect(row.tested).toBe(3);
    expect(row.held).toBe(2);
  });

  test("rules whose training edge was too small never enter the pool", () => {
    const results = [coin("a", [walkRow("RSI (14)", 1, false, 1, 1)])];
    expect(aggregate(results).rows).toHaveLength(0);
  });

  test("an indicator that held everywhere is flagged, one at chance is not", () => {
    const everywhere = Array.from({ length: 40 }, (v, i) =>
      coin(`c${i}`, [walkRow("RSI (14)", 1, true)])
    );
    const coinflip = Array.from({ length: 40 }, (v, i) =>
      coin(`c${i}`, [walkRow("RSI (14)", 1, i % 2 === 0)])
    );
    expect(aggregate(everywhere).rows[0].significant).toBe(true);
    expect(aggregate(coinflip).rows[0].significant).toBe(false);
  });

  test("p values are corrected for how many indicators were tried", () => {
    // the same 30 of 40 result, once alone and once among five indicators
    const alone = Array.from({ length: 40 }, (v, i) => coin(`c${i}`, [walkRow("RSI (14)", 1, i < 30)]));
    const crowded = Array.from({ length: 40 }, (v, i) =>
      coin(`c${i}`, [
        walkRow("RSI (14)", 1, i < 30),
        walkRow("CCI (20)", 1, i % 2 === 0),
        walkRow("MACD", 1, i % 3 === 0),
        walkRow("OBV", 1, i % 4 === 0),
        walkRow("ROC (12)", 1, i % 5 === 0),
      ])
    );
    const one = aggregate(alone).rows[0];
    const many = aggregate(crowded).rows.find((r) => r.label === "RSI (14)");
    expect(many.p).toBeCloseTo(one.p, 12);
    expect(many.adjustedP).toBeCloseTo(Math.min(1, one.p * 5), 12);
    expect(many.adjustedP).toBeGreaterThan(one.adjustedP);
  });

  test("a borderline result can survive alone and fail once corrected", () => {
    // 28 of 40 is p = 0.017 on its own, which does not survive being one of ten
    const rows = (i) => [walkRow("RSI (14)", 1, i < 28), ...Array.from({ length: 9 }, (v, j) =>
      walkRow(`filler ${j}`, 1, (i + j) % 2 === 0))];
    const results = Array.from({ length: 40 }, (v, i) => coin(`c${i}`, rows(i)));
    const row = aggregate(results).rows.find((r) => r.label === "RSI (14)");
    expect(row.p).toBeLessThan(0.05);
    expect(row.adjustedP).toBeGreaterThan(0.05);
    expect(row.significant).toBe(false);
  });
});

describe("independence and direction", () => {
  test("blocks within a coin count as one vote, not four", () => {
    // one coin, four blocks, all held. that is one coin agreeing, not four
    // independent trials, and the p value must reflect that
    const results = [coin("a", [
      walkRow("RSI (14)", 1, true), walkRow("RSI (14)", 2, true),
      walkRow("RSI (14)", 3, true), walkRow("RSI (14)", 4, true),
    ])];
    const row = aggregate(results).rows[0];
    expect(row.tested).toBe(4);
    expect(row.votes).toBe(1);
    expect(row.p).toBe(1); // a single vote can never be surprising
    expect(row.significant).toBe(false);
  });

  test("a coin whose blocks disagree does not vote for the indicator", () => {
    const results = [
      coin("a", [walkRow("RSI (14)", 1, true), walkRow("RSI (14)", 2, false)]),
      coin("b", [walkRow("RSI (14)", 1, true), walkRow("RSI (14)", 2, true)]),
    ];
    const row = aggregate(results).rows[0];
    expect(row.votes).toBe(2);
    expect(row.wins).toBe(1); // the split coin is not a win
  });

  test("a rule that reliably reverses is not reported as beating chance", () => {
    // held on only 4 of 40 coins: unlike a coin flip, but in the wrong
    // direction. calling that an edge would be exactly backwards
    const results = Array.from({ length: 40 }, (v, i) => coin(`c${i}`, [walkRow("RSI (14)", 1, i < 4)]));
    const summary = aggregate(results);
    const row = summary.rows[0];
    expect(row.significant).toBe(true);
    expect(row.beatsChance).toBe(false);
    expect(row.reverses).toBe(true);
    expect(summary.survivors).toBe(0);
    const read = scanVerdict(summary);
    expect(read.text).toMatch(/nothing beat chance/);
    expect(read.detail).toMatch(/opposite/);
  });

  test("only a result on the right side of the flip counts as a survivor", () => {
    const results = Array.from({ length: 40 }, (v, i) => coin(`c${i}`, [walkRow("RSI (14)", 1, i < 36)]));
    const summary = aggregate(results);
    expect(summary.rows[0].beatsChance).toBe(true);
    expect(summary.survivors).toBe(1);
    expect(scanVerdict(summary).detail).toMatch(/36 of 40 coins/);
  });
});

describe("the wording", () => {
  test("says plainly when nothing beat chance", () => {
    const results = Array.from({ length: 30 }, (v, i) => coin(`c${i}`, [walkRow("RSI (14)", 1, i % 2 === 0)]));
    const read = scanVerdict(aggregate(results));
    expect(read.text).toMatch(/nothing beat chance/);
  });

  test("says so when there was nothing to measure at all", () => {
    expect(scanVerdict(aggregate([])).text).toBe("nothing measurable");
  });

  test("names the strongest indicator when something does survive", () => {
    const results = Array.from({ length: 40 }, (v, i) => coin(`c${i}`, [walkRow("RSI (14)", 1, true)]));
    const read = scanVerdict(aggregate(results));
    expect(read.text).toMatch(/beat chance/);
    expect(read.detail).toMatch(/RSI \(14\)/);
  });
});
