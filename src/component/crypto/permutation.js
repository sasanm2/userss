/* A shuffled history null.
 *
 * The binomial test in aggregate.js assumes each coin's vote is an independent
 * coin flip. Coins are not independent: they move together, so a hundred coins
 * are worth far fewer than a hundred independent observations, and that test
 * is optimistic by an unknown amount.
 *
 * This replaces the assumption with a measurement. The same pipeline is run
 * against histories that have been shuffled in time, so whatever structure the
 * indicators are finding cannot be predictive any more, and the observed
 * result is compared with what that shuffling produces.
 *
 * The shuffle is built to destroy one thing and keep everything else:
 *
 * - the order of the returns goes, so nothing in the past can predict the
 *   future any more
 * - the distribution of returns stays, since the same returns are reused, so
 *   volatility and fat tails are unchanged
 * - each bar keeps its own high and low as ratios to its close, so the candle
 *   based indicators still see realistic ranges
 * - and crucially the SAME permutation is applied to every coin in a
 *   replicate, so coins that moved together still move together. Shuffling
 *   each coin separately would quietly destroy the market wide correlation
 *   that is the whole reason the binomial test was too generous.
 */
import { walkForward } from "./walkforward";
import { votesByIndicator } from "./aggregate";

/* A small deterministic generator, so a run can be repeated exactly. */
export function makeRng(seed) {
  let state = (seed >>> 0) || 1;
  return () => {
    // xorshift32
    state ^= state << 13;
    state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

/* A permutation of 0..n-1, by Fisher and Yates. */
export function permutation(n, rng) {
  const order = Array.from({ length: n }, (v, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const swap = order[i];
    order[i] = order[j];
    order[j] = swap;
  }
  return order;
}

/* Rebuilds a candle series by replaying its returns in the given order.
 *
 * Bar i of the result uses the return that originally belonged to bar
 * order[i], and that same bar's high and low, kept as ratios to its close so
 * the range travels with the return it came from. */
export function reshape(candles, order) {
  if (candles.length < 2) return candles;

  const returns = [];
  const ratios = [];
  for (let i = 1; i < candles.length; i++) {
    const previous = candles[i - 1].close;
    returns.push(previous === 0 ? 0 : candles[i].close / previous - 1);
    ratios.push({
      high: candles[i].close === 0 ? 1 : candles[i].high / candles[i].close,
      low: candles[i].close === 0 ? 1 : candles[i].low / candles[i].close,
    });
  }

  const out = [candles[0]];
  let close = candles[0].close;
  for (let i = 0; i < order.length && i < returns.length; i++) {
    const pick = order[i];
    close = close * (1 + returns[pick]);
    out.push({
      time: candles[i + 1].time,
      open: out[out.length - 1].close,
      high: close * ratios[pick].high,
      low: close * ratios[pick].low,
      close,
    });
  }
  return out;
}

const yieldToBrowser = () => new Promise((resolve) => setTimeout(resolve, 0));

/* Runs the whole scan against `replicates` shuffled versions of the same
 * coins, and reports where the real result sits in that distribution.
 *
 * coins is [{ id, candles }]. Returns a p value per indicator, plus one that
 * accounts for having tried them all at once: rather than multiplying by the
 * number of indicators, which assumes they are unrelated, each observed rate
 * is compared with the best rate any indicator managed on the shuffled data.
 * That handles the correlation between indicators instead of ignoring it.
 */
export async function permutationTest(
  coins,
  { horizon = 7, count = 4, replicates = 50, seed = 12345, minimumVotes = 8, onProgress, shouldStop } = {}
) {
  const usable = coins.filter((coin) => coin.candles && coin.candles.length >= 120);
  if (usable.length < 5) {
    return { rows: [], replicates: 0, coins: usable.length, tooFew: true };
  }

  const measure = (list) =>
    votesByIndicator(
      list.map((coin) => ({
        id: coin.id,
        walk: walkForward(
          { closes: coin.candles.map((c) => c.close), candles: coin.candles },
          { horizon, count }
        ),
      }))
    );

  const observed = measure(usable);
  const labels = [...observed.keys()].filter((label) => observed.get(label).votes >= minimumVotes);
  if (!labels.length) {
    return { rows: [], replicates: 0, coins: usable.length, tooFew: true };
  }

  // how often a shuffled run beat the real one, per indicator, and how often
  // the best indicator on shuffled data beat each real one
  const atLeast = new Map(labels.map((label) => [label, 0]));
  const atMost = new Map(labels.map((label) => [label, 0]));
  const familywise = new Map(labels.map((label) => [label, 0]));
  const nullRates = [];

  const rng = makeRng(seed);
  let done = 0;

  for (let r = 0; r < replicates; r++) {
    if (shouldStop && shouldStop()) break;

    // one permutation for the whole market, so coins keep moving together
    const length = Math.max(...usable.map((coin) => coin.candles.length));
    const order = permutation(length - 1, rng);

    const shuffled = usable.map((coin) => ({
      id: coin.id,
      candles: reshape(coin.candles, order.filter((index) => index < coin.candles.length - 1)),
    }));

    const result = measure(shuffled);

    let best = -Infinity;
    labels.forEach((label) => {
      const entry = result.get(label);
      if (!entry || entry.votes < minimumVotes) return;
      const rate = (entry.wins / entry.votes) * 100;
      if (rate > best) best = rate;
    });

    labels.forEach((label) => {
      const entry = result.get(label);
      const observedRate = (observed.get(label).wins / observed.get(label).votes) * 100;
      if (entry && entry.votes >= minimumVotes) {
        const rate = (entry.wins / entry.votes) * 100;
        if (rate >= observedRate) atLeast.set(label, atLeast.get(label) + 1);
        if (rate <= observedRate) atMost.set(label, atMost.get(label) + 1);
      }
      if (best !== -Infinity && best >= observedRate) {
        familywise.set(label, familywise.get(label) + 1);
      }
    });

    if (best !== -Infinity) nullRates.push(best);
    done = r + 1;
    if (onProgress) onProgress(done, replicates);
    await yieldToBrowser();
  }

  const rows = labels.map((label) => {
    const entry = observed.get(label);
    const rate = (entry.wins / entry.votes) * 100;
    return {
      label,
      wins: entry.wins,
      votes: entry.votes,
      rate,
      // the plus one is the usual convention: the real result counts as one of
      // the outcomes, so a p value can never be zero from a finite run
      p: (1 + atLeast.get(label)) / (done + 1),
      pReversed: (1 + atMost.get(label)) / (done + 1),
      pFamilywise: (1 + familywise.get(label)) / (done + 1),
    };
  });

  rows.sort((a, b) => a.pFamilywise - b.pFamilywise || b.rate - a.rate);

  return {
    rows,
    replicates: done,
    coins: usable.length,
    tooFew: false,
    // what the best of the indicators managed on shuffled data, which is the
    // bar a real result has to clear
    nullBest: nullRates.length
      ? {
          median: [...nullRates].sort((a, b) => a - b)[Math.floor(nullRates.length / 2)],
          max: Math.max(...nullRates),
        }
      : null,
  };
}
