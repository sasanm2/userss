import { useState } from "react";
import { formatPrice } from "./format";
import { COLORS } from "./theme";
import { useCompact } from "./usecompact";

// a narrower viewBox on a phone, so the chart is not scaled down to a sliver
// with unreadable labels
const WIDE = { width: 900, height: 300, padding: { top: 16, right: 88, bottom: 24, left: 8 } };
const NARROW = { width: 380, height: 260, padding: { top: 14, right: 62, bottom: 20, left: 6 } };

const clean = (points) =>
  (points || []).filter(
    (point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1])
  );

/* The price line, with anything drawn over it.
 *
 * series is the [timestamp, price] shape the api returns.
 *
 * overlays are lines over the same axes: { points, color, label }. bands are
 * filled areas between two lines: { upper, lower, color, label }, which is what
 * a bollinger pair actually is, and reads far better than two loose dashes.
 *
 * Everything is matched to the price line by timestamp rather than by index, so
 * a dropped point cannot slide an overlay out of alignment.
 */
const PriceChart = ({ series: given = [], currency = "usd", overlays = [], bands = [] }) => {
  const [hover, setHover] = useState(null);
  const compact = useCompact();
  const { width: WIDTH, height: HEIGHT, padding: PADDING } = compact ? NARROW : WIDE;

  const points = clean(given);
  if (points.length < 2) {
    return <p className="note">not enough price history to draw this range</p>;
  }

  const lines = overlays
    .map((overlay) => ({ ...overlay, points: clean(overlay.points) }))
    .filter((overlay) => overlay.points.length > 1);
  const areas = bands
    .map((band) => ({ ...band, upper: clean(band.upper), lower: clean(band.lower) }))
    .filter((band) => band.upper.length > 1 && band.lower.length > 1);

  const prices = points.map((point) => point[1]);
  // the overlays and bands sit outside the price range, so the scale has to
  // include them or they would be drawn off the top and bottom
  const spread = [
    ...lines.flatMap((line) => line.points.map((point) => point[1])),
    ...areas.flatMap((band) => [...band.upper, ...band.lower].map((point) => point[1])),
  ];
  const min = Math.min(...prices, ...spread);
  const max = Math.max(...prices, ...spread);
  const range = max - min || 1;

  const firstTime = points[0][0];
  const lastTime = points[points.length - 1][0];
  const timeRange = lastTime - firstTime || 1;

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const x = (time) => PADDING.left + ((time - firstTime) / timeRange) * plotWidth;
  const y = (price) => PADDING.top + plotHeight - ((price - min) / range) * plotHeight;

  const path = (list) =>
    list.map((p, i) => `${i === 0 ? "M" : "L"}${x(p[0]).toFixed(2)} ${y(p[1]).toFixed(2)}`).join(" ");

  const line = path(points);
  const area = `${line} L${x(lastTime).toFixed(2)} ${PADDING.top + plotHeight} L${x(firstTime).toFixed(
    2
  )} ${PADDING.top + plotHeight} Z`;

  const ticks = [0, 1, 2, 3, 4].map((step) => min + (range / 4) * step);

  // works for a mouse and for a finger, since a phone has no hover
  const readAt = (clientX, target) => {
    const box = target.getBoundingClientRect();
    const ratio = (clientX - box.left) / box.width;
    const wanted = firstTime + ((ratio * WIDTH - PADDING.left) / plotWidth) * timeRange;
    let closest = points[0];
    points.forEach((point) => {
      if (Math.abs(point[0] - wanted) < Math.abs(closest[0] - wanted)) closest = point;
    });
    setHover(closest);
  };

  const handleMove = (event) => readAt(event.clientX, event.currentTarget);
  const handleTouch = (event) => {
    const touch = event.touches[0];
    if (touch) readAt(touch.clientX, event.currentTarget);
  };

  // the tooltip flips to the other side near the right edge so it stays on
  const tipAnchor = hover && x(hover[0]) > WIDTH * 0.6 ? "end" : "start";
  const tipOffset = tipAnchor === "end" ? -10 : 10;

  return (
    <div className="chart-frame">
      {/* pan-y keeps the page scrolling while a sideways drag scrubs */}
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ width: "100%", height: "auto", touchAction: "pan-y", display: "block" }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
        onTouchEnd={() => setHover(null)}
        role="img"
        aria-label="price over the selected range"
      >
        <defs>
          <linearGradient id="pricefill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.series[0]} stopOpacity="0.32" />
            <stop offset="100%" stopColor={COLORS.series[0]} stopOpacity="0.02" />
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
              stroke={COLORS.grid}
              strokeWidth="1"
            />
            <text
              className="crypto-chart-label"
              x={PADDING.left + plotWidth + 8}
              y={y(tick) + 4}
              fill={COLORS.muted}
            >
              {formatPrice(tick, currency)}
            </text>
          </g>
        ))}

        {/* a band is one shape, not two stray lines */}
        {areas.map((band) => (
          <path
            key={band.label}
            d={`${path(band.upper)} L${[...band.lower]
              .reverse()
              .map((p, i) => `${i === 0 ? "" : "L"}${x(p[0]).toFixed(2)} ${y(p[1]).toFixed(2)}`)
              .join(" ")} Z`}
            fill={band.color}
            fillOpacity="0.1"
            stroke={band.color}
            strokeOpacity="0.35"
            strokeWidth="1"
          />
        ))}

        <path d={area} fill="url(#pricefill)" />
        <path
          d={line}
          fill="none"
          stroke={COLORS.series[0]}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {lines.map((overlay) => (
          <path
            key={overlay.label}
            d={path(overlay.points)}
            fill="none"
            stroke={overlay.color}
            strokeWidth="1.5"
            strokeLinejoin="round"
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
              stroke="#5b6577"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            {/* a ring in the surface colour keeps the dot readable over any mark */}
            <circle cx={x(hover[0])} cy={y(hover[1])} r="5" fill={COLORS.surface} />
            <circle cx={x(hover[0])} cy={y(hover[1])} r="3.5" fill={COLORS.series[0]} />
            <text
              x={x(hover[0]) + tipOffset}
              y={PADDING.top + 12}
              textAnchor={tipAnchor}
              fill={COLORS.ink}
              fontSize="13"
              fontWeight="600"
            >
              {formatPrice(hover[1], currency)}
            </text>
            <text
              x={x(hover[0]) + tipOffset}
              y={PADDING.top + 28}
              textAnchor={tipAnchor}
              fill={COLORS.muted}
              fontSize="11"
            >
              {new Date(hover[0]).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </text>
          </g>
        )}

        <text className="crypto-chart-label" x={PADDING.left} y={HEIGHT - 6} fill={COLORS.muted}>
          {new Date(firstTime).toLocaleDateString()}
        </text>
        <text
          className="crypto-chart-label"
          x={PADDING.left + plotWidth}
          y={HEIGHT - 6}
          fill={COLORS.muted}
          textAnchor="end"
        >
          {new Date(lastTime).toLocaleDateString()}
        </text>
      </svg>

      {(lines.length > 0 || areas.length > 0) && (
        <div className="chart-legend">
          <span className="legend-key">
            <span className="legend-swatch" style={{ background: COLORS.series[0] }} />
            price
          </span>
          {lines.map((overlay) => (
            <span className="legend-key" key={overlay.label}>
              <span className="legend-swatch" style={{ background: overlay.color }} />
              {overlay.label}
            </span>
          ))}
          {areas.map((band) => (
            <span className="legend-key" key={band.label}>
              <span
                className="legend-swatch"
                style={{ background: band.color, opacity: 0.45, height: "10px", borderRadius: "3px" }}
              />
              {band.label}
            </span>
          ))}
        </div>
      )}

      <div className="chart-readout">
        {hover ? "" : "drag across the chart to read a price"}
      </div>
    </div>
  );
};

export default PriceChart;
