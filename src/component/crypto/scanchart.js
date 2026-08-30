import { COLORS } from "./theme";

/* How often each indicator held its direction, against the two lines that
 * matter: the 50% a coin flip gives, and the bar the shuffled markets actually
 * set.
 *
 * The table underneath carries the same numbers for anyone who wants to read
 * them exactly, or with a screen reader; this is here because a column of
 * percentages does not show at a glance which ones clear a threshold, and that
 * is the entire question the page is asking.
 */
const ROW = 30;
// the right gutter holds the value and its sample size, so it has to be
// wide enough that a dot at 100% never sits under its own label
const PADDING = { top: 40, right: 132, bottom: 8, left: 168 };
const WIDTH = 900;

const ScanChart = ({ rows = [], shuffledBar = null }) => {
  if (!rows.length) return null;

  const height = PADDING.top + rows.length * ROW + PADDING.bottom;
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const x = (percent) => PADDING.left + (Math.max(0, Math.min(100, percent)) / 100) * plotWidth;
  const y = (index) => PADDING.top + index * ROW + ROW / 2;

  const ticks = [0, 25, 50, 75, 100];

  return (
    <div className="chart-frame">
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label="how often each indicator held its direction, against chance and against shuffled data"
      >
        {/* the band the shuffled markets produced: anything inside it is what
            shuffling alone manages, so it is the bar to clear */}
        {shuffledBar && (
          <>
            <rect
              x={x(shuffledBar.median)}
              y={PADDING.top - 20}
              width={Math.max(1, x(shuffledBar.max) - x(shuffledBar.median))}
              height={rows.length * ROW + 20}
              fill={COLORS.muted}
              fillOpacity="0.13"
            />
            <text x={x(shuffledBar.median) + 6} y={PADDING.top - 6} fontSize="11" fill={COLORS.muted}>
              shuffled data reaches here
            </text>
          </>
        )}

        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={x(tick)}
              y1={PADDING.top - 20}
              x2={x(tick)}
              y2={PADDING.top + rows.length * ROW}
              stroke={tick === 50 ? COLORS.axis : COLORS.grid}
              strokeWidth="1"
              strokeDasharray={tick === 50 ? "4 4" : undefined}
            />
            <text x={x(tick)} y={PADDING.top - 26} fontSize="11" fill={COLORS.muted} textAnchor="middle">
              {tick === 50 ? "50% chance" : `${tick}%`}
            </text>
          </g>
        ))}

        {rows.map((row, index) => {
          const rate = row.rate;
          const tone = row.beats ? COLORS.good : row.reverses ? COLORS.critical : COLORS.series[0];
          // a hundred percent of two coins is not the same claim as sixty of
          // fifty, so a thin row recedes rather than shouting the same size
          const thin = row.votes !== undefined && row.votes < 10;
          return (
            <g key={row.label} opacity={thin ? 0.45 : 1}>
              <text
                x={PADDING.left - 12}
                y={y(index) + 4}
                fontSize="12.5"
                fill={COLORS.inkSecondary}
                textAnchor="end"
              >
                {row.label}
              </text>
              {/* a stalk from the chance line to the value, so the direction
                  and the size of the gap are both visible */}
              <line
                x1={x(50)}
                y1={y(index)}
                x2={x(rate)}
                y2={y(index)}
                stroke={tone}
                strokeWidth="2"
                strokeOpacity="0.5"
              />
              <circle cx={x(rate)} cy={y(index)} r="5.5" fill={COLORS.surface} />
              <circle cx={x(rate)} cy={y(index)} r="4" fill={tone} />
              <text
                x={WIDTH - 72}
                y={y(index) + 4}
                fontSize="12"
                fill={COLORS.inkSecondary}
                textAnchor="end"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {rate.toFixed(0)}%
              </text>
              {row.votes !== undefined && (
                <text
                  x={WIDTH - 6}
                  y={y(index) + 4}
                  fontSize="11"
                  fill={COLORS.muted}
                  textAnchor="end"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {row.votes} {row.votes === 1 ? "coin" : "coins"}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="chart-legend">
        <span className="legend-key">
          <span className="legend-swatch" style={{ background: COLORS.series[0] }} /> no better than chance
        </span>
        <span className="legend-key">
          <span className="legend-swatch" style={{ background: COLORS.good }} /> beats the bar
        </span>
        <span className="legend-key">
          <span className="legend-swatch" style={{ background: COLORS.critical }} /> reliably reverses
        </span>
        <span className="legend-key" style={{ opacity: 0.45 }}>
          <span className="legend-swatch" style={{ background: COLORS.series[0] }} /> faded: too few
          coins to read
        </span>
      </div>
    </div>
  );
};

export default ScanChart;
