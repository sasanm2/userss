import { useState } from "react";
import { formatPrice } from "./format";

const WIDTH = 900;
const HEIGHT = 320;
const PADDING = { top: 20, right: 70, bottom: 30, left: 10 };

/* series is the [timestamp, price] shape coingecko returns for market_chart.
 *
 * overlays are drawn over the same axes, each one { points, color, label,
 * dashed }, where points is also [timestamp, value]. They are matched to the
 * price line by timestamp rather than by index, so a dropped price point
 * cannot slide an overlay out of alignment. */
const PriceChart = ({ series: given = [], currency = "usd", overlays = [] }) => {
  const [hover, setHover] = useState(null);

  // a single null price would make every coordinate NaN, so bad points go
  const series = given.filter(
    (point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1])
  );

  if (series.length < 2) {
    return <p className="text-muted">no chart data</p>;
  }

  const clean = (points) =>
    (points || []).filter(
      (point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1])
    );
  const drawn = overlays.map((overlay) => ({ ...overlay, points: clean(overlay.points) }));

  const prices = series.map((point) => point[1]);
  // the bands sit outside the price range, so the scale has to include them or
  // they would be drawn off the top and bottom of the chart
  const spread = drawn.flatMap((overlay) => overlay.points.map((point) => point[1]));
  const min = Math.min(...prices, ...spread);
  const max = Math.max(...prices, ...spread);
  const range = max - min || 1;
  const firstTime = series[0][0];
  const lastTime = series[series.length - 1][0];
  const timeRange = lastTime - firstTime || 1;

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const up = prices[prices.length - 1] >= prices[0];
  const color = up ? "#198754" : "#dc3545";

  const x = (time) => PADDING.left + ((time - firstTime) / timeRange) * plotWidth;
  const y = (price) => PADDING.top + plotHeight - ((price - min) / range) * plotHeight;

  const line = series
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(point[0]).toFixed(2)} ${y(point[1]).toFixed(2)}`)
    .join(" ");
  const area = `${line} L${x(lastTime).toFixed(2)} ${PADDING.top + plotHeight} L${x(firstTime).toFixed(
    2
  )} ${PADDING.top + plotHeight} Z`;

  // five evenly spaced price labels down the right hand side
  const ticks = [0, 1, 2, 3, 4].map((step) => min + (range / 4) * step);

  // works for both a mouse and a finger, since the phone build has no hover
  const readAt = (clientX, target) => {
    const box = target.getBoundingClientRect();
    const ratio = (clientX - box.left) / box.width;
    const wanted = firstTime + ((ratio * WIDTH - PADDING.left) / plotWidth) * timeRange;
    let closest = series[0];
    series.forEach((point) => {
      if (Math.abs(point[0] - wanted) < Math.abs(closest[0] - wanted)) {
        closest = point;
      }
    });
    setHover(closest);
  };

  const handleMove = (event) => readAt(event.clientX, event.currentTarget);
  const handleTouch = (event) => {
    const touch = event.touches[0];
    if (touch) readAt(touch.clientX, event.currentTarget);
  };

  return (
    <div>
      {/* pan-y keeps the page scrolling vertically while a sideways drag
          scrubs the chart */}
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ width: "100%", height: "auto", touchAction: "pan-y" }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
        onTouchEnd={() => setHover(null)}
      >
        <defs>
          <linearGradient id="chartfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PADDING.left}
              y1={y(tick)}
              x2={PADDING.left + plotWidth}
              y2={y(tick)}
              className="crypto-chart-grid"
              stroke="#e9ecef"
              strokeWidth="1"
            />
            <text
              className="crypto-chart-label"
              x={PADDING.left + plotWidth + 8}
              y={y(tick) + 4}
              fontSize="12"
              fill="#6c757d"
            >
              {formatPrice(tick, currency)}
            </text>
          </g>
        ))}

        <path d={area} fill="url(#chartfill)" />
        <path d={line} fill="none" stroke={color} strokeWidth="2" />

        {drawn.map((overlay) => (
          <path
            key={overlay.label}
            d={overlay.points
              .map((point, index) => `${index === 0 ? "M" : "L"}${x(point[0]).toFixed(2)} ${y(point[1]).toFixed(2)}`)
              .join(" ")}
            fill="none"
            stroke={overlay.color}
            strokeWidth="1.4"
            strokeDasharray={overlay.dashed ? "5 4" : undefined}
            opacity="0.9"
          />
        ))}

        {hover && (
          <g>
            <line
              x1={x(hover[0])}
              y1={PADDING.top}
              x2={x(hover[0])}
              y2={PADDING.top + plotHeight}
              className="crypto-chart-cursor"
              stroke="#adb5bd"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <circle cx={x(hover[0])} cy={y(hover[1])} r="4" fill={color} />
          </g>
        )}

        <text className="crypto-chart-label" x={PADDING.left} y={HEIGHT - 8} fontSize="12" fill="#6c757d">
          {new Date(firstTime).toLocaleDateString()}
        </text>
        <text
          className="crypto-chart-label"
          x={PADDING.left + plotWidth}
          y={HEIGHT - 8}
          fontSize="12"
          fill="#6c757d"
          textAnchor="end"
        >
          {new Date(lastTime).toLocaleDateString()}
        </text>
      </svg>

      {drawn.length > 0 && (
        <div className="text-center mb-1">
          {drawn.map((overlay) => (
            <small key={overlay.label} className="me-3" style={{ color: overlay.color }}>
              <span style={{ fontWeight: 600 }}>—</span> {overlay.label}
            </small>
          ))}
        </div>
      )}

      <div className="text-center text-muted" style={{ minHeight: "24px" }}>
        {hover
          ? `${new Date(hover[0]).toLocaleString()} — ${formatPrice(hover[1], currency)}`
          : "drag across the chart to read a price"}
      </div>
    </div>
  );
};

export default PriceChart;
