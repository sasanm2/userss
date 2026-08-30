/* A small chart for the oscillators under the price chart.
 *
 * lines are { points, color, label }, where points is [timestamp, value].
 * bars draws a histogram from the same shape, coloured by sign, which is what
 * the macd panel needs. bands are horizontal reference levels, like the 30 and
 * 70 on an rsi.
 */
import { COLORS } from "./theme";

const WIDTH = 900;
const HEIGHT = 140;
const PADDING = { top: 12, right: 70, bottom: 16, left: 10 };

const IndicatorPanel = ({ title, lines = [], bars = null, bands = [], domain = null, format }) => {
  const clean = (points) =>
    (points || []).filter(
      (point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1])
    );

  const drawn = lines.map((line) => ({ ...line, points: clean(line.points) }));
  const barPoints = clean(bars && bars.points);
  const all = [...drawn.flatMap((line) => line.points), ...barPoints];

  if (all.length < 2) {
    return (
      <div className="mb-3">
        <small className="text-muted">{title}: not enough history yet</small>
      </div>
    );
  }

  const values = all.map((point) => point[1]);
  // a fixed domain keeps an rsi pinned to 0..100 instead of rescaling itself
  const min = domain ? domain[0] : Math.min(...values, ...bands);
  const max = domain ? domain[1] : Math.max(...values, ...bands);
  const range = max - min || 1;

  const times = all.map((point) => point[0]);
  const firstTime = Math.min(...times);
  const lastTime = Math.max(...times);
  const timeRange = lastTime - firstTime || 1;

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const x = (time) => PADDING.left + ((time - firstTime) / timeRange) * plotWidth;
  const y = (value) => PADDING.top + plotHeight - ((value - min) / range) * plotHeight;

  const barWidth = barPoints.length > 1 ? Math.max(1, (plotWidth / barPoints.length) * 0.7) : 2;
  const zero = y(Math.max(min, Math.min(max, 0)));

  return (
    <div className="chart-frame mt-3">
      <small className="text-muted d-block mb-1">
        {title}
        {drawn.map((line) => (
          <span key={line.label} className="ms-3" style={{ color: line.color }}>
            {line.label}
            {format && Number.isFinite(line.points[line.points.length - 1]?.[1])
              ? ` ${format(line.points[line.points.length - 1][1])}`
              : ""}
          </span>
        ))}
      </small>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: "100%", height: "auto" }}>
        {bands.map((band) => (
          <g key={band}>
            <line
              x1={PADDING.left}
              y1={y(band)}
              x2={PADDING.left + plotWidth}
              y2={y(band)}
              className="crypto-chart-grid"
              stroke={COLORS.grid}
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text
              className="crypto-chart-label"
              x={PADDING.left + plotWidth + 8}
              y={y(band) + 4}
              fontSize="11"
              fill={COLORS.muted}
            >
              {band}
            </text>
          </g>
        ))}

        {barPoints.map((point) => (
          <rect
            key={point[0]}
            x={x(point[0]) - barWidth / 2}
            y={Math.min(y(point[1]), zero)}
            width={barWidth}
            height={Math.max(1, Math.abs(y(point[1]) - zero))}
            fill={point[1] >= 0 ? COLORS.good : COLORS.critical}
            opacity="0.65"
          />
        ))}

        {drawn.map((line) => (
          <path
            key={line.label}
            d={line.points
              .map((point, index) => `${index === 0 ? "M" : "L"}${x(point[0]).toFixed(2)} ${y(point[1]).toFixed(2)}`)
              .join(" ")}
            fill="none"
            stroke={line.color}
            strokeWidth="1.6"
          />
        ))}
      </svg>
    </div>
  );
};

export default IndicatorPanel;
