/* Pools the walk forward results from many coins.
 *
 * One coin proves nothing: with four blocks and a dozen indicators there are
 * enough combinations that some will hold by luck. Running the same test over
 * the whole top 100 asks the better question, which is whether an indicator
 * holds its direction more often than chance across a market rather than on
 * one chart.
 *
 * Three things that would otherwise make the answer meaningless are handled
 * here.
 *
 * The blocks within one coin are not independent of each other: they share a
 * price history and overlap through the indicator's own warmup. Counting all
 * of them as separate trials would inflate the confidence badly, so each coin
 * casts a single vote, which is whether its blocks held more often than not.
 *
 * Each indicator then gets an exact binomial test of those votes against the
 * 50% a coin flip would give, rather than an eyeballed hit rate.
 *
 * And because testing a dozen indicators at once means the luckiest looks good
 * on its own, every p value is multiplied by how many were tried.
 */

const logFactorialCache = [0, 0];

function logFactorial(n) {
  if (logFactorialCache[n] !== undefined) return logFactorialCache[n];
  let value = logFactorialCache[logFactorialCache.length - 1];
  for (let i = logFactorialCache.length; i <= n; i++) {
    value += Math.log(i);
    logFactorialCache[i] = value;
  }
  return logFactorialCache[n];
}

/* Probability of exactly k successes in n trials. */
export function binomialPmf(k, n, p = 0.5) {
  if (k < 0 || k > n) return 0;
  const logP =
    logFactorial(n) -
    logFactorial(k) -
    logFactorial(n - k) +
    (p === 0 ? (k === 0 ? 0 : -Infinity) : k * Math.log(p)) +
    (p === 1 ? (k === n ? 0 : -Infinity) : (n - k) * Math.log(1 - p));
  return Math.exp(logP);
}

/* Exact two sided binomial test, by the method of small p values: add up every
 * outcome at least as unlikely as the one observed. */
export function binomialTest(k, n, p = 0.5) {
  if (n <= 0) return 1;
  const observed = binomialPmf(k, n, p);
  // a hair of tolerance, so the mirror outcome is not excluded by rounding
  const threshold = observed * (1 + 1e-9);
  let total = 0;
  for (let i = 0; i <= n; i++) {
    const probability = binomialPmf(i, n, p);
    if (probability <= threshold) total += probability;
  }
  return Math.min(1, total);
}

/* results is one entry per coin: { id, name, walk } where walk is what
 * walkForward returned. Rows come back one per indicator, pooled over coins. */
/* Per indicator: how many coins were testable, and on how many the direction
 * held more often than not. Shared with the shuffled history test so both
 * count votes exactly the same way. */
export function votesByIndicator(results) {
  const byIndicator = new Map();

  results.forEach((result) => {
    if (!result || !result.walk) return;
    const decisive = result.walk.rows.filter((row) => row.decisive);
    if (!decisive.length) return;

    // one vote per coin per indicator, so a coin with more blocks does not
    // count more heavily than one with fewer
    const perLabel = new Map();
    decisive.forEach((row) => {
      const entry = perLabel.get(row.label) || { held: 0, tested: 0, edge: 0 };
      entry.held += row.held ? 1 : 0;
      entry.tested += 1;
      entry.edge += Math.sign(row.trainEdge) * row.testEdge;
      perLabel.set(row.label, entry);
    });

    perLabel.forEach((entry, label) => {
      const pooled = byIndicator.get(label) || { coins: 0, held: 0, tested: 0, edge: 0, wins: 0, votes: 0 };
      pooled.coins += 1;
      pooled.held += entry.held;
      pooled.tested += entry.tested;
      pooled.edge += entry.edge / entry.tested;
      // a coin counts as a win when the direction held more often than not
      if (entry.held / entry.tested > 0.5) pooled.wins += 1;
      pooled.votes = pooled.coins;
      byIndicator.set(label, pooled);
    });
  });

  return byIndicator;
}

export function aggregate(results, { alpha = 0.05 } = {}) {
  const byIndicator = votesByIndicator(results);

  const rows = [...byIndicator.entries()].map(([label, pooled]) => ({
    label,
    coins: pooled.coins,
    tested: pooled.tested,
    held: pooled.held,
    heldRate: pooled.tested ? (pooled.held / pooled.tested) * 100 : null,
    meanTestEdge: pooled.coins ? pooled.edge / pooled.coins : null,
    // one vote per coin, since blocks inside a coin share their history
    votes: pooled.coins,
    wins: pooled.wins,
    winRate: pooled.coins ? (pooled.wins / pooled.coins) * 100 : null,
    p: binomialTest(pooled.wins, pooled.coins, 0.5),
  }));

  // testing a dozen indicators at once means the luckiest looks good on its
  // own, so every p value is multiplied by how many were tried
  const comparisons = rows.length || 1;
  rows.forEach((row) => {
    row.adjustedP = Math.min(1, row.p * comparisons);
    // significant only says the result is unlike a coin flip. which side of
    // the flip it landed on is a separate question, and one that matters: a
    // rule that reliably reverses is not an edge, it is a warning
    row.significant = row.adjustedP < alpha && row.votes > 0;
    row.beatsChance = row.significant && row.winRate > 50;
    row.reverses = row.significant && row.winRate < 50;
  });

  rows.sort((a, b) => a.adjustedP - b.adjustedP);

  return {
    rows,
    comparisons,
    coinsTested: results.filter((r) => r && r.walk && r.walk.rows.length).length,
    survivors: rows.filter((row) => row.beatsChance).length,
    reversers: rows.filter((row) => row.reverses).length,
    alpha,
  };
}

/* What the pooled table adds up to, in plain words. */
export function scanVerdict(summary) {
  if (!summary || !summary.rows.length) {
    return {
      text: "nothing measurable",
      detail: "no coin had enough history for a rule to be tested forward",
    };
  }
  const show = (value) => (value < 0.001 ? "< 0.001" : value.toFixed(3));

  if (!summary.survivors) {
    const reversed = summary.rows.filter((row) => row.reverses);
    const detail = reversed.length
      ? `none held up, and ${reversed.length} did the opposite reliably enough to be worth noting: ` +
        `${reversed[0].label} kept its direction on only ${reversed[0].winRate.toFixed(0)}% of ` +
        `${reversed[0].votes} coins (corrected p ${show(reversed[0].adjustedP)}). a rule that ` +
        `reverses is not an edge to trade the other way either, it is a sign the fit was noise`
      : `none of the ${summary.comparisons} indicators held its direction on more coins than a ` +
        `coin flip would, once the p values are corrected for testing ${summary.comparisons} at once`;
    return { text: "nothing beat chance across the market", detail };
  }

  const best = summary.rows.filter((row) => row.beatsChance)[0];
  return {
    text: `${summary.survivors} of ${summary.comparisons} beat chance`,
    detail:
      `strongest is ${best.label}, which held its direction on ${best.wins} of ${best.votes} coins ` +
      `(corrected p ${show(best.adjustedP)})`,
  };
}
