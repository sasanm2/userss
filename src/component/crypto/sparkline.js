import { directionColor } from "./theme";

// tiny 7 day line drawn straight into an svg, one per row of the table
const Sparkline = ({ points: given = [], width = 140, height = 40 }) => {
  // one null in the series would turn the whole path into NaN and draw nothing
  const points = given.filter((price) => Number.isFinite(price));

  if (!points.length) {
    return <span className="text-muted">-</span>;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  // the row shows a signed percentage beside this, so the colour is never
  // carrying the direction on its own
  const color = directionColor(points[points.length - 1] - points[0]);

  const path = points
    .map((price, index) => {
      const x = index * step;
      const y = height - ((price - min) / range) * (height - 4) - 2;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

export default Sparkline;
