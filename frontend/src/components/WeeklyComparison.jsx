import { useEffect, useState } from "react";
import GlassCard from "./GlassCard";
import { IconDumbbell, IconTrendingUp, IconFlame, IconBarChart } from "./Icons";
import { apiRequest } from "../api/client";
import { startOfWeek, addDays, toDateKey } from "../utils/date";

const DAYS_OF_HISTORY = 60; // suficiente para esta semana + a anterior + um streak razoável
const MONTH_WEEKS = 5; // esta semana + 4 anteriores, para o "Progresso mensal"

function formatKg(value) {
  return `${Math.round(value).toLocaleString("pt-PT")} kg`;
}

function pctDelta(current, previous) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function DeltaBadge({ value }) {
  if (value === null) return null;
  const positive = value >= 0;
  return (
    <span className={`stat-tile-delta ${positive ? "positive" : "negative"}`}>
      <span style={{ display: "inline-flex", transform: positive ? undefined : "scaleY(-1)" }}>
        <IconTrendingUp size={12} />
      </span>
      {positive ? "+" : ""}
      {value}%
    </span>
  );
}

function MiniLineChart({ values }) {
  const max = Math.max(...values, 1);
  const width = 280;
  const height = 70;
  const stepX = width / (values.length - 1);

  const points = values.map((v, i) => ({
    x: i * stepX,
    y: height - (v / max) * (height - 10) - 5,
  }));

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${path} L${width},${height} L0,${height} Z`;

  return (
    <svg className="mini-line-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="weeklyProgressFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#weeklyProgressFill)" stroke="none" />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="var(--accent)" />
      ))}
    </svg>
  );
}

// Lê as sessões dos últimos DAYS_OF_HISTORY dias e deriva tudo localmente:
// dias treinados esta semana vs a semana passada, volume total, streak de
// dias consecutivos, e o volume diário desta semana para o mini-gráfico.
// Tudo calculado a partir de dados reais, nada decorativo.
export default function WeeklyComparison() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisWeekStart = startOfWeek(today);
    const lastWeekStart = addDays(thisWeekStart, -7);
    const rangeStart = addDays(today, -DAYS_OF_HISTORY);

    apiRequest(`/sessions?from=${toDateKey(rangeStart)}&to=${toDateKey(today)}`)
      .then((sessions) => {
        const volumeByDate = new Map();
        for (const s of sessions) {
          const weight = Number(s.total_weight_kg) || 0;
          volumeByDate.set(s.performed_at, (volumeByDate.get(s.performed_at) || 0) + weight);
        }
        const attendedDates = new Set(volumeByDate.keys());

        function sumVolumeInRange(start, days) {
          let total = 0;
          let count = 0;
          for (let i = 0; i < days; i++) {
            const key = toDateKey(addDays(start, i));
            if (volumeByDate.has(key)) {
              total += volumeByDate.get(key);
              count++;
            }
          }
          return { total, count };
        }

        const thisWeek = sumVolumeInRange(thisWeekStart, 7);
        const lastWeek = sumVolumeInRange(lastWeekStart, 7);

        // Progresso mensal: quantos dias treinou em cada uma das últimas
        // MONTH_WEEKS semanas (esta incluída) — não é volume, é frequência.
        const monthlyProgress = Array.from({ length: MONTH_WEEKS }, (_, i) => {
          const weekStart = addDays(thisWeekStart, -7 * (MONTH_WEEKS - 1 - i));
          const { count } = sumVolumeInRange(weekStart, 7);
          return { label: `${weekStart.getDate()}/${weekStart.getMonth() + 1}`, count };
        });

        // Streak: dias consecutivos com treino, a contar para trás a partir
        // de hoje — se ainda não treinaste hoje, começa a contar de ontem
        // (não zera o streak só porque o dia ainda não acabou).
        let streak = 0;
        let cursor = attendedDates.has(toDateKey(today)) ? today : addDays(today, -1);
        while (attendedDates.has(toDateKey(cursor))) {
          streak++;
          cursor = addDays(cursor, -1);
        }

        setStats({
          workoutsThisWeek: thisWeek.count,
          workoutsLastWeek: lastWeek.count,
          volumeThisWeek: thisWeek.total,
          volumeLastWeek: lastWeek.total,
          streak,
          monthlyProgress,
        });
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="error-text">{error}</p>;
  if (!stats) return <p className="text-secondary">A carregar...</p>;

  const workoutsDelta = pctDelta(stats.workoutsThisWeek, stats.workoutsLastWeek);
  const volumeDelta = pctDelta(stats.volumeThisWeek, stats.volumeLastWeek);

  return (
    <div className="stats-row">
      <GlassCard className="stat-tile" strong>
        <div className="stat-tile-header">
          <span className="stat-tile-label">
            <span className="stat-tile-icon">
              <IconDumbbell size={16} />
            </span>
            Treinos esta semana
          </span>
          <DeltaBadge value={workoutsDelta} />
        </div>
        <div className="stat-tile-value-row">
          <span className="stat-tile-value">{stats.workoutsThisWeek}</span>
          <span className="stat-tile-sub">/ 7</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${(stats.workoutsThisWeek / 7) * 100}%` }} />
        </div>
      </GlassCard>

      <GlassCard className="stat-tile" strong>
        <div className="stat-tile-header">
          <span className="stat-tile-label">
            <span className="stat-tile-icon amber">
              <IconTrendingUp size={16} />
            </span>
            Volume total
          </span>
          <DeltaBadge value={volumeDelta} />
        </div>
        <div className="stat-tile-value-row">
          <span className="stat-tile-value">{formatKg(stats.volumeThisWeek)}</span>
        </div>
        <span className="stat-tile-sub">vs semana passada</span>
      </GlassCard>

      <GlassCard className="stat-tile" strong>
        <div className="stat-tile-header">
          <span className="stat-tile-label">
            <span className={`stat-tile-icon flame${stats.streak > 0 ? " active" : ""}`}>
              <IconFlame size={16} />
            </span>
            Streak atual
          </span>
        </div>
        <div className="stat-tile-value-row">
          <span className="stat-tile-value">{stats.streak}</span>
          <span className="stat-tile-sub">dias</span>
        </div>
        <span className="stat-tile-sub">{stats.streak > 0 ? "Continua assim!" : "Começa hoje"}</span>
      </GlassCard>

      <GlassCard className="stat-tile wide" strong>
        <div className="stat-tile-header">
          <span className="stat-tile-label">
            <span className="stat-tile-icon blue">
              <IconBarChart size={16} />
            </span>
            Progresso mensal
          </span>
          <DeltaBadge value={workoutsDelta} />
        </div>
        <MiniLineChart values={stats.monthlyProgress.map((w) => w.count)} />
        <div className="stat-tile-header">
          {stats.monthlyProgress.map((w) => (
            <span key={w.label} className="stat-tile-sub">
              {w.label}
            </span>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
