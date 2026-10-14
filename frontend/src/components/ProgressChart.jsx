import { useEffect, useRef, useState } from "react";

const HEIGHT = 190;
const PAD = { top: 14, right: 12, bottom: 26, left: 40 };
const MAX_BAR = 24; // barras finas: nunca mais de 24px, o resto do espaço é ar

// Valor máximo "redondo" do eixo e passo entre marcas (1, 2, 2.5, 5 × 10^n),
// para os valores do eixo serem números limpos (0 / 5 / 10 / 15).
function niceScale(max, tickCount = 4) {
  if (max <= 0) return { top: 1, step: 1 };
  const rough = max / tickCount;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough);
  return { top: Math.ceil(max / step) * step, step };
}

// Largura real do elemento — o gráfico é desenhado em píxeis reais (sem
// viewBox a esticar), para o texto dos eixos ter sempre o mesmo tamanho.
function useWidth(ref) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

// Gráfico semanal de UMA série (por isso sem legenda — o título do cartão
// diz o que é). `points`: [{ label, tooltipLabel, value }]. `kind`: "bar"
// (barras) ou "line" (linha com área suave). `formatValue` formata os
// valores no eixo e na tooltip. Passar o rato (ou tocar) numa semana mostra
// a tooltip com o valor exato.
export default function ProgressChart({ points, kind = "bar", color, formatValue, ariaLabel }) {
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  const [hovered, setHovered] = useState(null);

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const { top, step } = niceScale(Math.max(...points.map((p) => p.value), 0));
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const band = points.length ? plotW / points.length : 0;
  const xCenter = (i) => PAD.left + band * i + band / 2;
  const yAt = (v) => PAD.top + plotH - (v / top) * plotH;
  const baseline = PAD.top + plotH;
  // Com bandas estreitas (telemóvel) só se mostra uma etiqueta sim, outra não.
  const labelEvery = band < 34 ? 2 : 1;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${xCenter(i)},${yAt(p.value)}`).join(" ");
  const areaPath = points.length
    ? `${linePath} L${xCenter(points.length - 1)},${baseline} L${xCenter(0)},${baseline} Z`
    : "";

  const active = hovered != null ? points[hovered] : null;

  return (
    <div className="progress-chart-box" ref={wrapRef} onMouseLeave={() => setHovered(null)}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label={ariaLabel} style={{ "--series": color }}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={yAt(t)} y2={yAt(t)} className="pc-grid" />
              <text x={PAD.left - 8} y={yAt(t) + 4} textAnchor="end" className="pc-axis">
                {formatValue(t, true)}
              </text>
            </g>
          ))}

          {kind === "bar" &&
            points.map((p, i) => {
              const h = baseline - yAt(p.value);
              const w = Math.min(MAX_BAR, band - 2);
              const x = xCenter(i) - w / 2;
              const r = Math.min(4, h, w / 2);
              // Cantos arredondados só em cima (a ponta do valor); retos na base.
              const d =
                h > 0
                  ? `M${x},${baseline} V${baseline - h + r} Q${x},${baseline - h} ${x + r},${baseline - h} H${x + w - r} Q${x + w},${baseline - h} ${x + w},${baseline - h + r} V${baseline} Z`
                  : "";
              return d ? (
                <path key={i} d={d} className={`pc-bar${hovered === i ? " active" : ""}`} />
              ) : null;
            })}

          {kind === "line" && (
            <>
              <path d={areaPath} className="pc-area" />
              <path d={linePath} className="pc-line" />
              {hovered != null && (
                <line x1={xCenter(hovered)} x2={xCenter(hovered)} y1={PAD.top} y2={baseline} className="pc-crosshair" />
              )}
              {points.map((p, i) => (
                <circle key={i} cx={xCenter(i)} cy={yAt(p.value)} r={hovered === i ? 6 : 4} className="pc-dot" />
              ))}
            </>
          )}

          {points.map((p, i) =>
            i % labelEvery === (points.length - 1) % labelEvery ? (
              <text key={i} x={xCenter(i)} y={HEIGHT - 8} textAnchor="middle" className="pc-axis">
                {p.label}
              </text>
            ) : null
          )}

          {/* Zonas de hover: a banda inteira de cada semana (maior que a marca). */}
          {points.map((p, i) => (
            <rect
              key={i}
              x={PAD.left + band * i}
              y={PAD.top}
              width={band}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHovered(i)}
              onClick={() => setHovered(i)}
            />
          ))}
        </svg>
      )}

      {active && (
        <div
          className={`pc-tooltip${xCenter(hovered) > width * 0.7 ? " align-end" : xCenter(hovered) < width * 0.3 ? " align-start" : ""}`}
          style={{ left: xCenter(hovered), top: Math.max(0, yAt(active.value) - 10) }}
        >
          <span className="pc-tooltip-label">{active.tooltipLabel}</span>
          <span className="pc-tooltip-value">
            <span className="pc-tooltip-key" style={{ background: color }} />
            {formatValue(active.value, false)}
          </span>
        </div>
      )}
    </div>
  );
}
