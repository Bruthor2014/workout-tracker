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

// Gráfico semanal de uma ou duas séries. `points`: [{ label, tooltipLabel,
// value }]. `kind`: "bar" (barras) ou "line" (linha com área suave). Sem
// `points2` fica igual ao perfil (uma série só, sem legenda — o título do
// cartão diz o que é). Com `points2` (ex: comparação com um amigo), a
// segunda série usa SEMPRE o mesmo `kind` que a primeira (duas barras lado
// a lado, ou duas linhas) — só a cor (`color2`) as distingue, de propósito:
// formas diferentes por série parecia dois gráficos diferentes em cima um
// do outro, não uma comparação.
// `formatValue` formata os valores no eixo e na tooltip. Passar o rato (ou
// tocar) numa semana mostra a tooltip com os valores dessa semana.
export default function ProgressChart({ points, kind = "bar", color, points2, color2, formatValue, ariaLabel }) {
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  const [hovered, setHovered] = useState(null);

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const maxValue = Math.max(...points.map((p) => p.value), ...(points2 ? points2.map((p) => p.value) : []), 0);
  const { top, step } = niceScale(maxValue);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const band = points.length ? plotW / points.length : 0;
  const xCenter = (i) => PAD.left + band * i + band / 2;
  const yAt = (v) => PAD.top + plotH - (v / top) * plotH;
  const baseline = PAD.top + plotH;
  // Com bandas estreitas (telemóvel) só se mostra uma etiqueta sim, outra não.
  const labelEvery = band < 18 ? 4 : band < 34 ? 2 : 1;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${xCenter(i)},${yAt(p.value)}`).join(" ");
  const areaPath = points.length
    ? `${linePath} L${xCenter(points.length - 1)},${baseline} L${xCenter(0)},${baseline} Z`
    : "";
  const line2Path = points2 ? points2.map((p, i) => `${i === 0 ? "M" : "L"}${xCenter(i)},${yAt(p.value)}`).join(" ") : "";
  const area2Path =
    points2 && points2.length
      ? `${line2Path} L${xCenter(points2.length - 1)},${baseline} L${xCenter(0)},${baseline} Z`
      : "";

  // Caminho de uma barra (retângulo com cantos arredondados só em cima).
  function barPath(x, w, value) {
    const h = baseline - yAt(value);
    if (h <= 0) return "";
    const r = Math.min(4, h, w / 2);
    return `M${x},${baseline} V${baseline - h + r} Q${x},${baseline - h} ${x + r},${baseline - h} H${x + w - r} Q${x + w},${baseline - h} ${x + w},${baseline - h + r} V${baseline} Z`;
  }

  const active = hovered != null ? points[hovered] : null;
  const active2 = hovered != null && points2 ? points2[hovered] : null;

  return (
    <div className="progress-chart-box" ref={wrapRef} onMouseLeave={() => setHovered(null)}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label={ariaLabel} style={{ "--series": color, "--series2": color2 }}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={yAt(t)} y2={yAt(t)} className="pc-grid" />
              <text x={PAD.left - 8} y={yAt(t) + 4} textAnchor="end" className="pc-axis">
                {formatValue(t, true)}
              </text>
            </g>
          ))}

          {kind === "bar" &&
            !points2 &&
            points.map((p, i) => {
              const w = Math.min(MAX_BAR, band - 2);
              const x = xCenter(i) - w / 2;
              const d = barPath(x, w, p.value);
              return d ? (
                <path key={i} d={d} className={`pc-bar${hovered === i ? " active" : ""}`} />
              ) : null;
            })}

          {/* Duas séries em barras: lado a lado dentro da mesma banda, mais
              estreitas, em vez de uma barra + uma linha tracejada por cima —
              para as duas se lerem como a mesma coisa, só de cor diferente. */}
          {kind === "bar" &&
            points2 &&
            points.map((p, i) => {
              const gw = Math.min(MAX_BAR / 2, (band - 6) / 2);
              const gap = 2;
              const x1 = xCenter(i) - gw - gap / 2;
              const x2 = xCenter(i) + gap / 2;
              const d1 = barPath(x1, gw, p.value);
              const d2 = barPath(x2, gw, points2[i]?.value ?? 0);
              return (
                <g key={i}>
                  {d1 && <path d={d1} className={`pc-bar${hovered === i ? " active" : ""}`} />}
                  {d2 && <path d={d2} className={`pc-bar2${hovered === i ? " active" : ""}`} />}
                </g>
              );
            })}

          {kind === "line" && (
            <>
              <path d={areaPath} className="pc-area" />
              <path d={linePath} className="pc-line" />
              {points.map((p, i) => (
                <circle key={i} cx={xCenter(i)} cy={yAt(p.value)} r={hovered === i ? 6 : 4} className="pc-dot" />
              ))}
            </>
          )}

          {kind === "line" && points2 && (
            <>
              <path d={area2Path} className="pc-area2" />
              <path d={line2Path} className="pc-line2" />
              {points2.map((p, i) => (
                <circle key={i} cx={xCenter(i)} cy={yAt(p.value)} r={hovered === i ? 5 : 3.2} className="pc-dot2" />
              ))}
            </>
          )}

          {hovered != null && (kind === "line" || points2) && (
            <line x1={xCenter(hovered)} x2={xCenter(hovered)} y1={PAD.top} y2={baseline} className="pc-crosshair" />
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
          style={{ left: xCenter(hovered), top: Math.max(0, yAt(Math.max(active.value, active2?.value ?? 0)) - 10) }}
        >
          <span className="pc-tooltip-label">{active.tooltipLabel}</span>
          <span className="pc-tooltip-value">
            <span className="pc-tooltip-key" style={{ background: color }} />
            {formatValue(active.value, false)}
          </span>
          {active2 && (
            <span className="pc-tooltip-value">
              <span className="pc-tooltip-key" style={{ background: color2 }} />
              {formatValue(active2.value, false)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
