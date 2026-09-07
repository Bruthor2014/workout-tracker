import { useState } from "react";

// Gráfico de evolução com dados reais (ex: peso corporal ao longo do
// tempo): linha 2px, área a ~10% opacidade, sem legenda por ser uma só
// série, com os pontos a virem da API.
const WIDTH = 560;
const HEIGHT = 200;
const PADDING = { top: 30, right: 24, bottom: 24, left: 24 };

export default function EvolutionChart({ data, unit }) {
  const [hovered, setHovered] = useState(null);

  const min = Math.min(...data.map((d) => d.value));
  const max = Math.max(...data.map((d) => d.value));
  const range = max - min || 1;

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  // Com um único ponto não há "linha do tempo" para percorrer — centra-se
  // horizontalmente, em vez de ficar encostado à margem esquerda (o que
  // cortava a etiqueta do valor, alinhada a partir daí).
  const points = data.map((d, i) => ({
    x: PADDING.left + (data.length === 1 ? plotWidth / 2 : (i / (data.length - 1)) * plotWidth),
    y: PADDING.top + plotHeight - ((d.value - min) / range) * plotHeight,
    value: d.value,
    date: d.date,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const baseline = HEIGHT - PADDING.bottom;
  const areaPath =
    points.length > 1
      ? `${linePath} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`
      : "";
  const last = points[points.length - 1];
  const hoveredPoint = hovered != null ? points[hovered] : null;

  return (
    <div className="progress-chart-wrap">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="progress-chart"
        role="img"
        aria-label={`Evolução ao longo do tempo, valor mais recente ${last.value} ${unit}`}
      >
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={PADDING.top + plotHeight * f}
            y2={PADDING.top + plotHeight * f}
            className="chart-gridline"
          />
        ))}

        {areaPath && <path d={areaPath} className="chart-area" />}
        {points.length > 1 && <path d={linePath} className="chart-line" />}

        {hoveredPoint && (
          <line
            x1={hoveredPoint.x}
            x2={hoveredPoint.x}
            y1={PADDING.top}
            y2={baseline}
            className="chart-crosshair"
          />
        )}

        {points.slice(0, -1).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} className="chart-dot" />
        ))}
        <circle cx={last.x} cy={last.y} r={5} className="chart-dot-end" />

        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={10}
            className="chart-hit"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
          />
        ))}

        <text
          x={last.x}
          y={last.y - 12}
          textAnchor={points.length === 1 ? "middle" : "end"}
          className="chart-label"
        >
          {last.value} {unit}
        </text>
      </svg>

      {hoveredPoint && (
        <div
          className="chart-tooltip"
          style={{
            left: `${(hoveredPoint.x / WIDTH) * 100}%`,
            top: `${(hoveredPoint.y / HEIGHT) * 100}%`,
          }}
        >
          <strong>
            {hoveredPoint.value} {unit}
          </strong>
          <span>{new Date(`${hoveredPoint.date}T00:00:00`).toLocaleDateString("pt-PT")}</span>
        </div>
      )}
    </div>
  );
}
