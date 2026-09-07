// Barras simples para comparar um valor entre semanas (peso levantado,
// tempo de treino). Uma só série -> sem legenda; valor sempre no topo da
// barra (nunca dentro, para não obrigar a medir se cabe).
const WIDTH = 260;
const HEIGHT = 140;
const PADDING = { top: 26, right: 12, bottom: 22, left: 12 };
const BAR_MAX_WIDTH = 24;

export default function WeeklyBarChart({ data, formatValue }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const slot = plotWidth / data.length;
  const barWidth = Math.min(BAR_MAX_WIDTH, slot * 0.5);
  const baseline = HEIGHT - PADDING.bottom;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="weekly-bar-chart" role="img">
      <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={baseline} y2={baseline} className="chart-gridline" />
      {data.map((d, i) => {
        const barHeight = max > 0 ? (d.value / max) * plotHeight : 0;
        const cx = PADDING.left + slot * i + slot / 2;
        const x = cx - barWidth / 2;
        const y = baseline - barHeight;
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={barWidth} height={Math.max(barHeight, 2)} rx={4} className="weekly-bar" />
            {d.value > 0 && (
              <text x={cx} y={y - 6} textAnchor="middle" className="chart-label weekly-bar-value">
                {formatValue(d.value)}
              </text>
            )}
            <text x={cx} y={HEIGHT - 6} textAnchor="middle" className="weekly-bar-label">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
