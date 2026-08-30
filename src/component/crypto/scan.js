import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { getTopCoins, getCoinOhlc, isRateLimited, hasKey } from "./cryptoapi";
import { walkForward } from "./walkforward";
import { aggregate, scanVerdict } from "./aggregate";
import { permutationTest } from "./permutation";
import "./crypto.css";

/* Runs the walk forward test over many coins at once.
 *
 * The point is to separate an indicator that works from one that happened to
 * fit a single chart. If a rule is real it should hold across a market; if it
 * only holds on the coin you happened to open, it was the fit talking.
 *
 * Each coin costs one call for its candles, so this runs on demand rather than
 * on load, one coin at a time, and can be stopped.
 */
const SIZES = [10, 25, 50, 100];
const HORIZONS = [3, 7, 14];
const REPLICATES = [20, 50, 100];
// the free allowance is a few dozen calls a minute, so without a key the run
// has to be paced or it starts coming back throttled halfway through
const PACE_MS = hasKey ? 120 : 2200;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const Scan = () => {
  const [size, setSize] = useState(25);
  const [horizon, setHorizon] = useState(7);
  const [days, setDays] = useState(180);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [current, setCurrent] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [throttled, setThrottled] = useState(0);
  const stop = useRef(false);

  // the shuffled history test, run on demand over the candles already fetched
  const [replicates, setReplicates] = useState(50);
  const [shuffling, setShuffling] = useState(false);
  const [shuffleDone, setShuffleDone] = useState(0);
  const [permutation, setPermutation] = useState(null);
  const stopShuffle = useRef(false);

  useEffect(() => () => {
    stop.current = true;
    stopShuffle.current = true;
  }, []);

  const run = async () => {
    stop.current = false;
    setRunning(true);
    setError(null);
    setResults([]);
    setDone(0);
    setThrottled(0);
    setPermutation(null);

    try {
      const markets = await getTopCoins("usd", size, 1);
      const collected = [];

      for (let i = 0; i < markets.length; i++) {
        if (stop.current) break;
        const coin = markets[i];
        setCurrent(coin.name);

        try {
          const raw = await getCoinOhlc(coin.id, "usd", days);
          const candles = (raw || [])
            .filter((row) => Array.isArray(row) && row.length >= 5)
            .map((row) => ({ time: row[0], open: row[1], high: row[2], low: row[3], close: row[4] }))
            .filter((c) => Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close));

          if (candles.length >= 120) {
            const closes = candles.map((c) => c.close);
            collected.push({
              id: coin.id,
              name: coin.name,
              symbol: coin.symbol,
              candles,
              walk: walkForward({ closes, candles }, { horizon, count: 4 }),
            });
          } else {
            // not enough candles to split into blocks, so it is skipped rather
            // than counted with a thin result
            collected.push({ id: coin.id, name: coin.name, symbol: coin.symbol, walk: null });
          }
        } catch (err) {
          if (isRateLimited(err)) setThrottled((count) => count + 1);
          collected.push({ id: coin.id, name: coin.name, symbol: coin.symbol, walk: null });
        }

        setDone(i + 1);
        setResults([...collected]);
        if (i < markets.length - 1) await sleep(PACE_MS);
      }
    } catch (err) {
      setError("could not load the coin list");
    }

    setRunning(false);
    setCurrent("");
  };

  const runShuffled = async () => {
    stopShuffle.current = false;
    setShuffling(true);
    setShuffleDone(0);
    const coins = results.filter((r) => r.candles && r.candles.length >= 120);
    const outcome = await permutationTest(coins, {
      horizon,
      count: 4,
      replicates,
      onProgress: (done) => setShuffleDone(done),
      shouldStop: () => stopShuffle.current,
    });
    setPermutation(outcome);
    setShuffling(false);
  };

  const summary = aggregate(results);
  const read = scanVerdict(summary);
  const measured = results.filter((r) => r.walk && r.walk.rows.length);

  return (
    <div className="container-fluid p-4 crypto-dark">
      <div className="d-flex align-items-center justify-content-between flex-wrap mb-2">
        <h2 className="mb-0">does anything work across the market</h2>
        <Link className="btn btn-sm btn-outline-info" to="/crypto">
          back to the list
        </Link>
      </div>

      <p className="text-muted">
        <small>
          The coin page tests an indicator against one chart, where a rule can hold by luck. This
          runs the same walk forward test over the top coins and pools the answers, so an indicator
          has to hold across a market rather than on the one chart you happened to open. Every p
          value is corrected for how many indicators were tried at once, since the luckiest of a
          dozen always looks good on its own.
        </small>
      </p>

      <div className="row align-items-end mb-3">
        <div className="col-auto">
          <small className="text-muted d-block">coins</small>
          <div className="btn-group btn-group-sm">
            {SIZES.map((value) => (
              <button
                key={value}
                disabled={running}
                onClick={() => setSize(value)}
                className={`btn btn-sm ${size === value ? "btn-info" : "btn-outline-info"}`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        <div className="col-auto">
          <small className="text-muted d-block">horizon</small>
          <div className="btn-group btn-group-sm">
            {HORIZONS.map((value) => (
              <button
                key={value}
                disabled={running}
                onClick={() => setHorizon(value)}
                className={`btn btn-sm ${horizon === value ? "btn-info" : "btn-outline-info"}`}
              >
                +{value}
              </button>
            ))}
          </div>
        </div>
        <div className="col-auto">
          <small className="text-muted d-block">history</small>
          <div className="btn-group btn-group-sm">
            {[90, 180, 365].map((value) => (
              <button
                key={value}
                disabled={running}
                onClick={() => setDays(value)}
                className={`btn btn-sm ${days === value ? "btn-info" : "btn-outline-info"}`}
              >
                {value}d
              </button>
            ))}
          </div>
        </div>
        <div className="col-auto">
          {running ? (
            <button onClick={() => (stop.current = true)} className="btn btn-sm btn-danger">
              stop
            </button>
          ) : (
            <button onClick={run} className="btn btn-sm btn-info">
              run the test
            </button>
          )}
        </div>
      </div>

      {!running && !results.length && (
        <p className="text-muted">
          <small>
            {size} coins means {size} calls to the api, one for each coin's candles.
            {hasKey
              ? " with a key configured that takes a few seconds."
              : ` on the free allowance they have to be spaced out, so this will take about ${Math.ceil(
                  (size * PACE_MS) / 60000
                )} minute${size * PACE_MS > 60000 ? "s" : ""}.`}
          </small>
        </p>
      )}

      {running && (
        <div className="mb-3">
          <div className="progress" style={{ height: "6px", backgroundColor: "#232935" }}>
            <div
              className="progress-bar bg-info"
              style={{ width: `${(done / size) * 100}%` }}
              role="progressbar"
              aria-valuenow={done}
              aria-valuemin="0"
              aria-valuemax={size}
            />
          </div>
          <small className="text-muted">
            {done} of {size} {current && `· ${current}`}
          </small>
        </div>
      )}

      {error && <div className="alert alert-danger">{error}</div>}
      {throttled > 0 && (
        <div className="alert alert-warning">
          the api throttled {throttled} of the requests, so those coins are missing from the totals.
          a slower run or an api key would cover the whole list.
        </div>
      )}

      {measured.length > 0 && (
        <>
          <div className="text-center my-3">
            <div className="h4 mb-1">{read.text}</div>
            <small className="text-muted">{read.detail}</small>
          </div>

          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>indicator</th>
                  <th className="text-end">coins</th>
                  <th className="text-end">coins it held on</th>
                  <th className="text-end">blocks held</th>
                  <th className="text-end">avg edge out</th>
                  <th className="text-end">p</th>
                  <th className="text-end">corrected</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td className="text-end">{row.coins}</td>
                    <td className="text-end">
                      {row.wins} / {row.votes}
                      <small className="text-muted d-block">
                        {row.winRate === null ? "-" : `${row.winRate.toFixed(0)}%`}
                      </small>
                    </td>
                    <td className="text-end">
                      {row.heldRate === null ? "-" : `${row.heldRate.toFixed(0)}%`}
                      <small className="text-muted d-block">of {row.tested}</small>
                    </td>
                    <td className="text-end">
                      {row.meanTestEdge === null
                        ? "-"
                        : `${row.meanTestEdge > 0 ? "+" : ""}${row.meanTestEdge.toFixed(1)}`}
                    </td>
                    <td className="text-end">{row.p < 0.001 ? "< 0.001" : row.p.toFixed(3)}</td>
                    <td
                      className={`text-end ${
                        row.beatsChance ? "text-success" : row.reverses ? "text-danger" : "text-muted"
                      }`}
                    >
                      {row.adjustedP < 0.001 ? "< 0.001" : row.adjustedP.toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <h4>against shuffled history</h4>
            <p className="text-muted mb-2">
              <small>
                The p values above assume each coin is an independent coin flip. Coins move
                together, so they are not, and that test is generous by an unknown amount. This
                measures the answer instead of assuming it: the same pipeline is run against
                histories shuffled in time, which keeps each coin's returns, its volatility and the
                way coins move together, and destroys only the order that could make anything
                predictable. Whatever the indicators score on that is the bar a real result has to
                clear.
              </small>
            </p>

            <div className="row align-items-end mb-3">
              <div className="col-auto">
                <small className="text-muted d-block">shuffled runs</small>
                <div className="btn-group btn-group-sm">
                  {REPLICATES.map((value) => (
                    <button
                      key={value}
                      disabled={shuffling}
                      onClick={() => setReplicates(value)}
                      className={`btn btn-sm ${replicates === value ? "btn-info" : "btn-outline-info"}`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              <div className="col-auto">
                {shuffling ? (
                  <button onClick={() => (stopShuffle.current = true)} className="btn btn-sm btn-danger">
                    stop
                  </button>
                ) : (
                  <button onClick={runShuffled} disabled={running} className="btn btn-sm btn-info">
                    run against shuffled history
                  </button>
                )}
              </div>
              {shuffling && (
                <div className="col">
                  <small className="text-muted">
                    {shuffleDone} of {replicates} shuffled markets
                  </small>
                </div>
              )}
            </div>

            {permutation && permutation.tooFew && (
              <p className="text-muted">too few coins with enough history to shuffle against.</p>
            )}

            {permutation && !permutation.tooFew && (
              <>
                {permutation.nullBest && (
                  <div className="alert alert-secondary">
                    across {permutation.replicates} shuffled markets, the best any indicator managed
                    was <strong>{permutation.nullBest.median.toFixed(0)}%</strong> of coins
                    typically, and <strong>{permutation.nullBest.max.toFixed(0)}%</strong> at its
                    luckiest. that is the bar, and it is well above 50% precisely because a dozen
                    indicators are being tried at once.
                  </div>
                )}

                <div className="table-responsive">
                  <table className="table table-sm align-middle">
                    <thead>
                      <tr>
                        <th>indicator</th>
                        <th className="text-end">coins it held on</th>
                        <th className="text-end">p vs shuffled</th>
                        <th className="text-end">p allowing for all of them</th>
                        <th className="text-end">verdict</th>
                      </tr>
                    </thead>
                    <tbody>
                      {permutation.rows.map((row) => (
                        <tr key={row.label}>
                          <td>{row.label}</td>
                          <td className="text-end">
                            {row.wins} / {row.votes}
                            <small className="text-muted d-block">{row.rate.toFixed(0)}%</small>
                          </td>
                          <td className="text-end">{row.p.toFixed(3)}</td>
                          <td className="text-end">{row.pFamilywise.toFixed(3)}</td>
                          <td className={`text-end ${row.pFamilywise < 0.05 ? "text-success" : "text-muted"}`}>
                            {row.pFamilywise < 0.05 ? "beats shuffled" : "no"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-muted">
                  <small>
                    A p value here is the share of shuffled markets that did at least as well as the
                    real one, so it can never be zero from a finite run: with{" "}
                    {permutation.replicates} runs the smallest possible is{" "}
                    {(1 / (permutation.replicates + 1)).toFixed(3)}. The last column compares each
                    indicator with the best any indicator managed on shuffled data, which allows for
                    having tried them all without assuming they are unrelated to each other, the way
                    multiplying the p values does.
                  </small>
                </p>
              </>
            )}
          </div>

          <p className="text-muted">
            <small>
              {measured.length} of {results.length} coins had enough history to test. The blocks
              inside one coin share a price history, so they are not four independent trials: each
              coin casts a single vote, which is whether its blocks held more often than not, and
              the test is on those votes. The corrected column is the p value multiplied by the{" "}
              {summary.comparisons} indicators tried. Green there means an indicator held on more
              coins than a coin flip would; red means it reliably did the opposite, which is not an
              edge to trade the other way either, only a sign that the fit was noise. Coins still
              move together, so even these votes are not fully independent, and none of this
              includes fees, spread or slippage.
            </small>
          </p>
        </>
      )}
    </div>
  );
};

export default Scan;
