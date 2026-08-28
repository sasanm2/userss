import { useState } from "react";
import { formatPrice } from "./format";

const WIDTH = 900;
const HEIGHT = 320;
const PADDING = { top: 20, right: 70, bottom: 30, left: 10 };

// series is the [timestamp, price] shape coingecko returns for market_chart
const PriceChart = ({ series = [], currency = "usd" }) => {
  const [hover, setHover] = useState(null);

  if (series.length < 2) {
    return <p className="text-muted">no chart data</p>;
  }

  const prices = series.map((point) => point[1]);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
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

  const handleMove = (event) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    const wanted = firstTime + ((ratio * WIDTH - PADDING.left) / plotWidth) * timeRange;
    let closest = series[0];
    series.forEach((point) => {
      if (Math.abs(point[0] - wanted) < Math.abs(closest[0] - wanted)) {
        closest = point;
      }
    });
    setHover(closest);
  };

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ width: "100%", height: "auto" }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
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
              stroke="#e9ecef"
              strokeWidth="1"
            />
            <text x={PADDING.left + plotWidth + 8} y={y(tick) + 4} fontSize="12" fill="#6c757d">
              {formatPrice(tick, currency)}
            </text>
          </g>
        ))}

        <path d={area} fill="url(#chartfill)" />
        <path d={line} fill="none" stroke={color} strokeWidth="2" />

        {hover && (
          <g>
            <line
              x1={x(hover[0])}
              y1={PADDING.top}
              x2={x(hover[0])}
              y2={PADDING.top + plotHeight}
              stroke="#adb5bd"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <circle cx={x(hover[0])} cy={y(hover[1])} r="4" fill={color} />
          </g>
        )}

        <text x={PADDING.left} y={HEIGHT - 8} fontSize="12" fill="#6c757d">
          {new Date(firstTime).toLocaleDateString()}
        </text>
        <text x={PADDING.left + plotWidth} y={HEIGHT - 8} fontSize="12" fill="#6c757d" textAnchor="end">
          {new Date(lastTime).toLocaleDateString()}
        </text>
      </svg>

      <div className="text-center text-muted" style={{ minHeight: "24px" }}>
        {hover
          ? `${new Date(hover[0]).toLocaleString()} — ${formatPrice(hover[1], currency)}`
          : "hover the chart to read a price"}
      </div>
    </div>
  );
};

export default PriceChart;
