// tiny 7 day line drawn straight into an svg, one per row of the table
const Sparkline = ({ points = [], width = 140, height = 40 }) => {
  if (!points.length) {
    return <span className="text-muted">-</span>;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const color = points[points.length - 1] >= points[0] ? "#198754" : "#dc3545";

  const path = points
    .map((price, index) => {
      const x = index * step;
      const y = height - ((price - min) / range) * (height - 4) - 2;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
};

export default Sparkline;
