import { useEffect, useState } from "react";
import GlassCard from "./GlassCard";
import { IconDumbbell, IconArrowUp, IconFlame, IconWeightStack } from "./Icons";
import { apiRequest } from "../api/client";
import { startOfWeek, addDays, toDateKey } from "../utils/date";

const DAYS_OF_HISTORY = 75; // esta semana/mês + a semana/mês anterior completos + um streak razoável
const MONTH_WEEKS = 5; // esta semana + 4 anteriores, para o "Progresso mensal"

// Variação em % face à semana passada. Sem nada na semana passada não há
// base para uma percentagem real: mostra-se +100% se esta semana já houve
// alguma coisa (convenção habitual) e 0% se as duas estão a zero, para a
// etiqueta nunca desaparecer.
function pctDelta(current, previous) {
  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function DeltaBadge({ value }) {
  const tone = value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
  return (
    <span className={`stat-tile-delta ${tone}`} aria-label="Comparado com o mesmo período da semana passada">
      {value !== 0 && (
        <span style={{ display: "inline-flex", transform: value < 0 ? "rotate(180deg)" : undefined }}>
          <IconArrowUp size={12} />
        </span>
      )}
      {Math.abs(value)}%
    </span>
  );
}

function workoutsCaption(count) {
  if (count === 0) return "Começa hoje!";
  if (count < 3) return "Bom começo!";
  if (count < 5) return "Continua assim!";
  return "Semana em grande!";
}

// Curva suave (Catmull-Rom convertida em Bézier cúbicas) a passar por todos
// os pontos — mais agradável que segmentos retos num gráfico tão pequeno.
// Os pontos de controlo ficam limitados ao intervalo vertical de cada
// segmento, para a curva nunca "ultrapassar" os pontos (ex: descer abaixo
// de 0 entre duas semanas a zero).
function smoothPath(points) {
  return points
    .map((p, i) => {
      if (i === 0) return `M${p.x},${p.y}`;
      const p0 = points[i - 2] || points[i - 1];
      const p1 = points[i - 1];
      const p3 = points[i + 1] || p;
      const c1x = p1.x + (p.x - p0.x) / 6;
      const lo = Math.min(p1.y, p.y);
      const hi = Math.max(p1.y, p.y);
      const clamp = (v) => Math.min(hi, Math.max(lo, v));
      const c1y = clamp(p1.y + (p.y - p0.y) / 6);
      const c2x = p.x - (p3.x - p1.x) / 6;
      const c2y = clamp(p.y - (p3.y - p1.y) / 6);
      return `C${c1x},${c1y} ${c2x},${c2y} ${p.x},${p.y}`;
    })
    .join(" ");
}

// Gráfico de linha com grelha e eixos. viewBox fixo (sem esticar), para o
// texto dos eixos não ficar deformado. Ao passar o rato (ou tocar) numa
// semana mostra uma tooltip com o nº de treinos dessa semana.
function LineChart({ weeks }) {
  const [hovered, setHovered] = useState(null);
  const values = weeks.map((w) => w.count);
  const width = 260;
  const height = 120;
  const plot = { left: 22, right: width - 14, top: 8, bottom: height - 22 };

  const step = Math.max(...values, 1) <= 4 ? 1 : 2;
  const yMax = Math.max(step * 2, Math.ceil(Math.max(...values, 1) / step) * step);
  const ticks = Array.from({ length: yMax / step + 1 }, (_, i) => i * step);

  const xAt = (i) => plot.left + (i * (plot.right - plot.left)) / (values.length - 1);
  const yAt = (v) => plot.bottom - (v / yMax) * (plot.bottom - plot.top);
  const points = values.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
  const line = smoothPath(points);
  const area = `${line} L${plot.right},${plot.bottom} L${plot.left},${plot.bottom} Z`;

  const columnWidth = (plot.right - plot.left) / (values.length - 1);
  const active = hovered !== null ? weeks[hovered] : null;

  // Posição da tooltip: por baixo do ponto se este estiver perto do topo
  // (para não tapar o cabeçalho) e alinhada para dentro nas pontas (para
  // não sair do cartão).
  let tooltipClass = "line-chart-tooltip";
  if (active) {
    const { x, y } = points[hovered];
    if (y < height * 0.4) tooltipClass += " below";
    if (x > width * 0.7) tooltipClass += " align-end";
    else if (x < width * 0.3) tooltipClass += " align-start";
  }

  return (
    <div className="line-chart-wrap" onMouseLeave={() => setHovered(null)}>
      <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Treinos por semana">
        <defs>
          <linearGradient id="lineChartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--accent-strong)" }} stopOpacity="0.45" />
            <stop offset="100%" style={{ stopColor: "var(--accent-strong)" }} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={plot.left} x2={plot.right} y1={yAt(t)} y2={yAt(t)} className="line-chart-grid" />
            <text x={plot.left - 6} y={yAt(t) + 3} textAnchor="end" className="line-chart-label">
              {t}
            </text>
          </g>
        ))}
        <path d={area} fill="url(#lineChartFill)" />
        <path d={line} fill="none" style={{ stroke: "var(--accent)" }} strokeWidth="2.2" strokeLinecap="round" />
        {hovered !== null && (
          <line
            x1={points[hovered].x}
            x2={points[hovered].x}
            y1={plot.top}
            y2={plot.bottom}
            className="line-chart-guide"
          />
        )}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={i === hovered ? 5 : 3.2} className="line-chart-dot" />
        ))}
        {weeks.map((w, i) => (
          <text key={w.label} x={xAt(i)} y={height - 6} textAnchor="middle" className="line-chart-label">
            {w.label}
          </text>
        ))}
        {/* Zonas invisíveis, uma por semana, que apanham o rato/toque. */}
        {points.map((p, i) => (
          <rect
            key={i}
            x={p.x - columnWidth / 2}
            y={0}
            width={columnWidth}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHovered(i)}
            // Em toque não há "sair com o rato" (onMouseLeave, usado no
            // desktop) — sem isto, a tooltip de um toque ficava presa
            // para sempre, sobreposta ao resto do cartão. Tocar outra vez
            // no mesmo ponto fecha-a.
            onClick={() => setHovered((prev) => (prev === i ? null : i))}
          />
        ))}
      </svg>
      {active && (
        <div
          className={tooltipClass}
          style={{
            left: `${(points[hovered].x / width) * 100}%`,
            top: `${(points[hovered].y / height) * 100}%`,
          }}
        >
          <span className="line-chart-tooltip-title">Semana de {active.label}</span>
          <span>
            <strong>{active.count}</strong> {active.count === 1 ? "treino" : "treinos"}
          </span>
        </div>
      )}
    </div>
  );
}

// Lê as sessões dos últimos DAYS_OF_HISTORY dias e deriva tudo localmente:
// dias treinados esta semana vs a semana passada, volume total, streak de
// dias consecutivos, e o volume diário desta semana para o mini-gráfico.
// Tudo calculado a partir de dados reais, nada decorativo.
// `selectedWeekStart` (opcional): a semana que o calendário do Dashboard
// está a mostrar (ver DashboardPage.jsx) — sem isto, os cartões ficavam
// sempre presos à semana real de hoje, mesmo depois de navegar para trás
// no calendário. Sem a prop, usa a semana atual a sério (mesmo
// comportamento de antes). O streak é sempre em relação a HOJE a sério,
// mesmo a ver semanas antigas — "streak atual" não faz sentido recalculado
// no passado.
export default function WeeklyComparison({ weekStart: selectedWeekStart }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const selectedWeekKey = selectedWeekStart ? toDateKey(selectedWeekStart) : null;

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const realThisWeekStart = startOfWeek(today);
    const thisWeekStart = selectedWeekStart ? startOfWeek(selectedWeekStart) : realThisWeekStart;
    const isCurrentWeek = toDateKey(thisWeekStart) === toDateKey(realThisWeekStart);
    // "Visto a partir de": hoje a sério na semana atual; o domingo dessa
    // semana se for uma semana passada (já aconteceu toda).
    const asOf = isCurrentWeek ? today : addDays(thisWeekStart, 6);
    const lastWeekStart = addDays(thisWeekStart, -7);
    // Começa a contar para trás a partir da semana vista (não de hoje), mas
    // acaba sempre em hoje a sério — para o streak ter sempre os dias mais
    // recentes disponíveis, mesmo a ver uma semana antiga.
    const rangeStart = addDays(thisWeekStart, -DAYS_OF_HISTORY);

    apiRequest(`/sessions?from=${toDateKey(rangeStart)}&to=${toDateKey(today)}`)
      .then((sessions) => {
        const volumeByDate = new Map();
        const sessionsByDate = new Map();
        for (const s of sessions) {
          const weight = Number(s.total_weight_kg) || 0;
          volumeByDate.set(s.performed_at, (volumeByDate.get(s.performed_at) || 0) + weight);
          sessionsByDate.set(s.performed_at, (sessionsByDate.get(s.performed_at) || 0) + 1);
        }
        const attendedDates = new Set(volumeByDate.keys());

        // total = volume (kg), count = dias com treino, sessions = nº de treinos
        function sumVolumeInRange(start, days) {
          let total = 0;
          let count = 0;
          let sessionCount = 0;
          for (let i = 0; i < days; i++) {
            const key = toDateKey(addDays(start, i));
            if (volumeByDate.has(key)) {
              total += volumeByDate.get(key);
              count++;
              sessionCount += sessionsByDate.get(key);
            }
          }
          return { total, count, sessions: sessionCount };
        }

        // Esta semana: só até "asOf" (hoje, ou o fim de semana já passado).
        // Semana passada: sempre completa (já aconteceu toda) — comparar
        // "1 treino esta semana" com "3 a semana passada" tem de dar -67%,
        // não 0% por limitar as duas ao mesmo nº de dias.
        const daysThisWeek = Math.round((asOf - thisWeekStart) / 86400000) + 1;
        const thisWeek = sumVolumeInRange(thisWeekStart, daysThisWeek);
        const lastWeek = sumVolumeInRange(lastWeekStart, 7);

        // Mês de referência: o mês onde cai a segunda-feira da semana
        // vista. "Este mês" só até "asOf"; "mês passado" sempre completo.
        const refMonthStart = new Date(thisWeekStart.getFullYear(), thisWeekStart.getMonth(), 1);
        const daysThisMonth = Math.round((asOf - refMonthStart) / 86400000) + 1;
        const thisMonth = sumVolumeInRange(refMonthStart, daysThisMonth);
        const lastMonthStart = new Date(refMonthStart.getFullYear(), refMonthStart.getMonth() - 1, 1);
        const lastMonthDays = new Date(refMonthStart.getFullYear(), refMonthStart.getMonth(), 0).getDate();
        const lastMonth = sumVolumeInRange(lastMonthStart, lastMonthDays);

        // Gráfico "Progresso mensal": nº de treinos em cada uma das últimas
        // MONTH_WEEKS semanas, a terminar na semana vista.
        const monthlyProgress = Array.from({ length: MONTH_WEEKS }, (_, i) => {
          const ws = addDays(thisWeekStart, -7 * (MONTH_WEEKS - 1 - i));
          const { sessions: count } = sumVolumeInRange(ws, 7);
          return { label: `${ws.getDate()}/${ws.getMonth() + 1}`, count };
        });

        // Streak: dias consecutivos com treino, a contar para trás a partir
        // de HOJE a sério (não da semana vista) — se ainda não treinaste
        // hoje, começa a contar de ontem (não zera só porque o dia ainda
        // não acabou).
        let streak = 0;
        let cursor = attendedDates.has(toDateKey(today)) ? today : addDays(today, -1);
        while (attendedDates.has(toDateKey(cursor))) {
          streak++;
          cursor = addDays(cursor, -1);
        }

        setStats({
          workoutsThisWeek: thisWeek.count,
          workoutsDelta: pctDelta(thisWeek.count, lastWeek.count),
          volumeThisWeek: thisWeek.total,
          volumeDelta: pctDelta(thisWeek.total, lastWeek.total),
          monthlyDelta: pctDelta(thisMonth.sessions, lastMonth.sessions),
          streak,
          monthlyProgress,
        });
      })
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeekKey]);

  if (error) return <p className="error-text">{error}</p>;
  if (!stats) return <p className="text-secondary">A carregar...</p>;

  return (
    <div className="stats-row">
      <GlassCard className="stat-tile" strong>
        <div className="stat-tile-header">
          <span className="stat-tile-icon">
            <IconDumbbell size={22} />
          </span>
          <span className="stat-tile-label">Treinos esta semana</span>
        </div>
        <div className="stat-tile-value-row">
          <span className="stat-tile-value">{stats.workoutsThisWeek}</span>
          <span className="stat-tile-unit">/ 7</span>
          <DeltaBadge value={stats.workoutsDelta} />
        </div>
        <span className="stat-tile-sub">{workoutsCaption(stats.workoutsThisWeek)}</span>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${(stats.workoutsThisWeek / 7) * 100}%` }} />
        </div>
      </GlassCard>

      <GlassCard className="stat-tile" strong>
        <div className="stat-tile-header">
          <span className="stat-tile-icon">
            <IconWeightStack size={22} />
          </span>
          <span className="stat-tile-label">Volume esta semana</span>
        </div>
        <div className="stat-tile-value-row">
          <span className="stat-tile-value">{Math.round(stats.volumeThisWeek).toLocaleString("pt-PT")}</span>
          <span className="stat-tile-unit">kg</span>
          <DeltaBadge value={stats.volumeDelta} />
        </div>
        <span className="stat-tile-sub">vs semana passada</span>
      </GlassCard>

      <GlassCard className={`stat-tile streak${stats.streak > 0 ? " active" : ""}`} strong>
        <div className="stat-tile-header">
          <span className="stat-tile-icon">
            <IconFlame size={22} />
          </span>
          <span className="stat-tile-label">Streak atual</span>
        </div>
        <div className="stat-tile-value-row">
          <span className="stat-tile-value">{stats.streak}</span>
          <span className="stat-tile-unit">{stats.streak === 1 ? "dia" : "dias"}</span>
        </div>
        <span className="stat-tile-sub">{stats.streak > 0 ? "Mantém o ritmo!" : "Começa hoje!"}</span>
        <span className="stat-tile-flame" aria-hidden="true">
          <IconFlame size={44} />
        </span>
      </GlassCard>

      <GlassCard className="stat-tile chart" strong>
        <div className="stat-tile-header">
          <span className="stat-tile-title">Progresso mensal</span>
          <DeltaBadge value={stats.monthlyDelta} />
        </div>
        <span className="text-secondary" style={{ fontSize: "0.78rem" }}>Nº de treinos vs mês passado</span>
        <LineChart weeks={stats.monthlyProgress} />
      </GlassCard>
    </div>
  );
}
