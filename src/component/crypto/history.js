import { useState } from "react";
import { backtest, readout } from "./backtest";
import { BUY, SELL, NEUTRAL } from "./signals";
import WalkForwardPanel from "./walkforwardpanel";

/* Shows what happened after each signal, historically, on this coin and this
 * range. Deliberately blunt about sample sizes and about the base rate, since
 * a hit rate on its own is the easiest number in finance to fool yourself
 * with. */
const HORIZONS = [1, 3, 7, 14, 30];
const MIN_SAMPLES = 12;

const signalClass = (signal) =>
  signal === BUY ? "text-success" : signal === SELL ? "text-danger" : "text-muted";

const edgeClass = (edge) => {
  if (edge === null || Math.abs(edge) < 5) return "text-muted";
  return edge > 0 ? "text-success" : "text-danger";
};

const pct = (value, digits = 1) => (value === null ? "-" : `${value.toFixed(digits)}%`);

const SignalHistory = ({ closes = [], candles = [], volumes = [], pointLabel = "points" }) => {
  const [horizon, setHorizon] = useState(7);

  const result = backtest({ closes, candles, volumes }, horizon);
  const read = readout(result, MIN_SAMPLES);
  const firing = result.rows.filter((row) => row.now !== NEUTRAL);

  return (
    <div className="mt-4">
      <div className="d-flex align-items-center justify-content-between flex-wrap mb-2">
        <h4 className="mb-0">what followed these signals before</h4>
        <div className="btn-group btn-group-sm">
          {HORIZONS.map((value) => (
            <button
              key={value}
              onClick={() => setHorizon(value)}
              className={`btn btn-sm ${horizon === value ? "btn-info" : "btn-outline-info"}`}
            >
              +{value}
            </button>
          ))}
        </div>
      </div>

      {result.rows.length === 0 ? (
        <p className="text-muted">
          this range has too little history to measure a {horizon} {pointLabel} outcome. pick a
          longer range.
        </p>
      ) : (
        <>
          <div className="alert alert-secondary">
            <div className="d-flex justify-content-between flex-wrap">
              <span>
                over the {result.bars} {pointLabel} on this range, price was higher{" "}
                <strong>{pct(result.base.upRate)}</strong> of the time {horizon} {pointLabel} later,
                by <strong>{pct(result.base.meanReturn, 2)}</strong> on average.
              </span>
            </div>
            <small className="text-muted">
              that is the base rate, and it is what every row below has to beat to mean anything.
            </small>
          </div>

          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>signal now</th>
                  <th className="text-end">times before</th>
                  <th className="text-end">higher after</th>
                  <th className="text-end">avg move</th>
                  <th className="text-end">median</th>
                  <th className="text-end">vs base rate</th>
                </tr>
              </thead>
              <tbody>
                {firing.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-muted">
                      nothing is signalling either way on this range right now
                    </td>
                  </tr>
                )}
                {firing.map((row) => (
                  <tr key={row.label}>
                    <td>
                      {row.label} <span className={signalClass(row.now)}>{row.now}</span>
                      {row.count > 0 && row.count < MIN_SAMPLES && (
                        <small className="text-muted d-block">
                          too few to read anything into
                        </small>
                      )}
                    </td>
                    <td className="text-end">{row.count}</td>
                    <td className="text-end">{pct(row.upRate)}</td>
                    <td className="text-end">{pct(row.meanReturn, 2)}</td>
                    <td className="text-end">{pct(row.medianReturn, 2)}</td>
                    <td className={`text-end ${edgeClass(row.edge)}`}>
                      {row.edge === null ? "-" : `${row.edge > 0 ? "+" : ""}${row.edge.toFixed(1)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-center my-3">
            <div className="h5 mb-1">{read.verdict}</div>
            <small className="text-muted">
              {read.reason
                ? read.reason
                : `${read.bullish} of the signals firing now were followed by a rise more often ` +
                  `than the base rate, ${read.bearish} less often, over ${read.samples} past occurrences`}
            </small>
          </div>
        </>
      )}

      <WalkForwardPanel
        closes={closes}
        candles={candles}
        volumes={volumes}
        horizon={horizon}
        pointLabel={pointLabel}
      />

      <p className="text-muted">
        <small>
          <strong>This is not a prediction.</strong> It counts what price did after the same
          indicator readings on this one coin over this one range, and nothing more. The samples
          overlap each other, so they are not independent; a range that mostly went up will make
          almost every bullish signal look good, which is exactly why the base rate is shown beside
          them; and none of it accounts for fees, spread or slippage. A pattern that held over a few
          hundred past points is not a reason to expect it to hold on the next one.
        </small>
      </p>
    </div>
  );
};

export default SignalHistory;
