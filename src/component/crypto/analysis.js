import { useState } from "react";
import PriceChart from "./pricechart";
import IndicatorPanel from "./indicatorpanel";
import SignalHistory from "./history";
import { sma, rsi, macd, bollinger } from "./indicators";
import { movingAverageRows, oscillatorRows, summarise, BUY, SELL } from "./signals";
import { formatPrice, formatNumber } from "./format";
import { COLORS } from "./theme";

/* Pairs an indicator series with the timestamps of the prices it came from, so
 * the charts can line the two up by time rather than by index. */
const withTimes = (times, values) =>
  values.map((value, index) => [times[index], value]).filter((point) => Number.isFinite(point[1]));

const signalClass = (signal) =>
  signal === BUY ? "text-success" : signal === SELL ? "text-danger" : "text-muted";

const verdictClass = (verdict) =>
  verdict.includes("buy") ? "text-success" : verdict.includes("sell") ? "text-danger" : "text-muted";

/* series is the [timestamp, price] market chart, candles are the ohlc bars and
 * volumes the [timestamp, volume] pairs. Everything is optional: the readings
 * that need candles simply do not appear without them. */
const Analysis = ({ series = [], candles = [], volumes = [], currency = "usd" }) => {
  const [showBands, setShowBands] = useState(true);

  const points = series.filter(
    (point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1])
  );

  if (points.length < 2) {
    return <p className="text-muted">not enough history to analyse this range</p>;
  }

  const times = points.map((point) => point[0]);
  const closes = points.map((point) => point[1]);
  const volumeValues = volumes
    .filter((point) => Array.isArray(point) && Number.isFinite(point[1]))
    .map((point) => point[1]);

  const maRows = movingAverageRows(closes);
  const oscRows = oscillatorRows({
    closes,
    candles,
    volumes: volumeValues.length === closes.length ? volumeValues : [],
  });
  const summary = summarise([...maRows, ...oscRows]);

  const bands = bollinger(closes, 20, 2);
  const macdValue = macd(closes);

  /* The price line is categorical slot 1, so the averages take slots 2 and 3.
   *
   * Only two of them. A fourth line here would put slot 4 yellow beside slot 2
   * orange, and that pair measures a normal vision difference of 10.6, under
   * the floor of 15: they are genuinely hard to tell apart, colour blind or
   * not. The palette rule is to cut a series rather than invent a new hue, so
   * the third average is dropped and the two that carry the most meaning stay.
   */
  const overlays = [
    { label: "SMA 20", color: COLORS.series[1], points: withTimes(times, sma(closes, 20)) },
    { label: "SMA 50", color: COLORS.series[2], points: withTimes(times, sma(closes, 50)) },
  ].filter((overlay) => overlay.points.length > 1);

  // a range, not an identity, so it is drawn as one neutral band
  const drawnBands = showBands
    ? [
        {
          label: "Bollinger (20, 2)",
          color: COLORS.muted,
          upper: withTimes(times, bands.upper),
          lower: withTimes(times, bands.lower),
        },
      ]
    : [];

  const table = (title, rows) => (
    <div className="col-md-6">
      <h5 className="mt-3">{title}</h5>
      <table className="table table-sm align-middle">
        <thead>
          <tr>
            <th>indicator</th>
            <th className="text-end">value</th>
            <th className="text-end">reading</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td>
                {row.label}
                {row.note && <small className="text-muted d-block">{row.note}</small>}
              </td>
              <td className="text-end">
                {row.value === null
                  ? "-"
                  : Math.abs(row.value) >= 1000
                  ? formatNumber(row.value)
                  : row.value.toFixed(2)}
              </td>
              <td className={`text-end ${signalClass(row.signal)}`}>
                {row.value === null ? "-" : row.signal}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between flex-wrap mb-2 gap-2">
        <h4 className="mb-0">technical analysis</h4>
        <div className="segmented">
          <button aria-pressed={showBands} onClick={() => setShowBands(true)}>
            with bands
          </button>
          <button aria-pressed={!showBands} onClick={() => setShowBands(false)}>
            price only
          </button>
        </div>
      </div>

      <PriceChart series={points} currency={currency} overlays={overlays} bands={drawnBands} />

      <IndicatorPanel
        title="RSI (14)"
        domain={[0, 100]}
        bands={[30, 70]}
        format={(value) => value.toFixed(1)}
        lines={[{ label: "rsi", color: COLORS.series[0], points: withTimes(times, rsi(closes, 14)) }]}
      />

      <IndicatorPanel
        title="MACD (12, 26, 9)"
        format={(value) => value.toFixed(4)}
        bars={{ points: withTimes(times, macdValue.histogram) }}
        lines={[
          { label: "macd", color: COLORS.series[0], points: withTimes(times, macdValue.line) },
          { label: "signal", color: COLORS.series[1], points: withTimes(times, macdValue.signal) },
        ]}
      />

      <div className="text-center my-3">
        <div className={`h4 mb-1 ${verdictClass(summary.verdict)}`}>{summary.verdict}</div>
        <small className="text-muted">
          {summary.buy} bullish · {summary.neutral} neutral · {summary.sell} bearish, out of{" "}
          {summary.total} readings on this range
        </small>
      </div>

      <div className="row">
        {table("moving averages", maRows)}
        {table("oscillators", oscRows)}
      </div>

      {/* the replay runs on one grid, never a mix of two. the candles carry a
          close as well as a high and a low, so when there are enough of them
          they are the better source: every indicator is then measured on the
          same bars. otherwise it falls back to the price points, without the
          readings that need a high and a low. */}
      {candles.length >= 60 ? (
        <SignalHistory
          closes={candles.map((c) => c.close)}
          candles={candles}
          pointLabel="candles"
        />
      ) : (
        <SignalHistory
          closes={closes}
          volumes={volumeValues.length === closes.length ? volumeValues : []}
          pointLabel="points"
        />
      )}

      <p className="text-muted">
        <small>
          These are the standard mechanical readings of each indicator over the range shown, computed
          from the price history above. They describe what the indicators say, nothing more, and are
          not advice or a forecast. Change the range to compute them over a different window; the
          longer averages need enough history to appear at all. The last point on this chart is{" "}
          {formatPrice(closes[closes.length - 1], currency)}.
          {candles.length > 0 && (
            <>
              {" "}
              A period means one point of whichever series an indicator reads, and the two series are
              not on the same clock: the moving averages, RSI, MACD, Bollinger bands and ROC run over
              the {closes.length} price points above, while the stochastic, Williams %R, CCI and ATR
              need a high and a low, so they run over the {candles.length} candles the api returns for
              this range.
            </>
          )}
        </small>
      </p>
    </div>
  );
};

export default Analysis;
