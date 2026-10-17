import { useEffect, useState } from "react";
import GlassCard from "./GlassCard";
import ProgressChart from "./ProgressChart";
import { IconClock, IconDumbbell, IconTrendingUp, IconTrophy, IconWeightStack } from "./Icons";
import { apiRequest } from "../api/client";
import { addDays, startOfWeek, toDateKey } from "../utils/date";
import { muscleGroupVisual } from "../utils/muscleGroups";

const WEEKS = 12; // janela dos gráficos semanais
const RECORDS_SHOWN = 6;
const MONTH_LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Cores das duas séries (cada gráfico tem uma só). HOURS_COLOR segue o
// tema do ginásio (destaque); VOLUME_COLOR fica fixa a propósito — são
// dois gráficos diferentes e precisam de se distinguir visualmente mesmo
// quando o tema deixa as duas cores do ginásio parecidas.
const HOURS_COLOR = "var(--accent-strong)";
const VOLUME_COLOR = "#0d9488";

const parseKey = (key) => new Date(`${key}T00:00:00`);
const shortDate = (d) => `${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`;
const fmt = (n, digits = 0) => n.toLocaleString("pt-PT", { maximumFractionDigits: digits });

function sessionMinutes(s) {
  if (!s.started_at || !s.ended_at) return 0;
  return Math.max(0, (new Date(s.ended_at) - new Date(s.started_at)) / 60000);
}

function formatHours(hours) {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return `${fmt(hours, 1)} h`;
}

// Agrega os treinos nas últimas WEEKS semanas (segunda a domingo).
function weeklySeries(sessions) {
  const thisWeek = startOfWeek(new Date());
  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const start = addDays(thisWeek, -7 * (WEEKS - 1 - i));
    return { start, minutes: 0, volume: 0, count: 0 };
  });
  const firstStart = weeks[0].start;
  for (const s of sessions) {
    const index = Math.floor((parseKey(s.performed_at) - firstStart) / (7 * 86400000));
    if (index < 0 || index >= WEEKS) continue;
    weeks[index].minutes += sessionMinutes(s);
    weeks[index].volume += Number(s.total_weight_kg) || 0;
    weeks[index].count += 1;
  }
  return weeks.map((w) => ({
    label: `${w.start.getDate()}/${w.start.getMonth() + 1}`,
    tooltipLabel: `Semana de ${shortDate(w.start)} · ${w.count} ${w.count === 1 ? "treino" : "treinos"}`,
    hours: w.minutes / 60,
    volume: w.volume,
  }));
}

function StatTile({ icon: Icon, label, value, unit, caption }) {
  return (
    <GlassCard className="stat-tile profile-stat" strong>
      <div className="stat-tile-header">
        <span className="stat-tile-icon">
          <Icon size={22} />
        </span>
        <span className="stat-tile-label">{label}</span>
      </div>
      <div className="stat-tile-value-row">
        <span className="stat-tile-value">{value}</span>
        {unit && <span className="stat-tile-unit">{unit}</span>}
      </div>
      {caption && <span className="stat-tile-sub">{caption}</span>}
    </GlassCard>
  );
}

// Secção "O teu progresso" do perfil: resumo (treinos, horas, volume, peso
// corporal), horas de treino e volume por semana, e recordes pessoais.
// Com `memberId` mostra o progresso desse membro (perfil do membro visto
// pelo staff); sem ele, o do próprio utilizador.
export default function ProfileProgress({ memberId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [showAllRecords, setShowAllRecords] = useState(false);

  useEffect(() => {
    const base = memberId ? `/member/${memberId}` : "";
    Promise.all([
      apiRequest(`/sessions${base}`),
      apiRequest(memberId ? `/sessions/member/${memberId}/records` : "/sessions/records"),
      apiRequest("/exercises"),
      apiRequest(`/body-metrics${base}`),
    ])
      .then(([sessions, records, exercises, metrics]) => setData({ sessions, records, exercises, metrics }))
      .catch((err) => setError(err.message));
  }, [memberId]);

  if (error) return <p className="error-text">{error}</p>;
  if (!data) return <p className="text-secondary">A carregar o teu progresso...</p>;

  const { sessions, records, exercises, metrics } = data;
  const todayKey = toDateKey(new Date());
  const monthPrefix = todayKey.slice(0, 7);

  const totalHours = sessions.reduce((sum, s) => sum + sessionMinutes(s), 0) / 60;
  const totalVolume = sessions.reduce((sum, s) => sum + (Number(s.total_weight_kg) || 0), 0);
  const workoutsThisMonth = sessions.filter((s) => s.performed_at.startsWith(monthPrefix)).length;
  const weeks = weeklySeries(sessions);
  const avgWeeklyHours = weeks.reduce((sum, w) => sum + w.hours, 0) / WEEKS;

  // Peso corporal: último registo e variação desde o primeiro.
  const weights = metrics
    .filter((m) => m.weight_kg != null)
    .map((m) => ({ date: m.recorded_at, kg: Number(m.weight_kg) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const latestWeight = weights[weights.length - 1];
  const weightChange = weights.length > 1 ? latestWeight.kg - weights[0].kg : null;

  const exerciseById = new Map(exercises.map((e) => [e.id, e]));
  // Os exercícios feitos mais vezes primeiro; com o mesmo nº, o recorde
  // mais recente primeiro.
  const sortedRecords = [...records].sort(
    (a, b) => (b.times_done || 0) - (a.times_done || 0) || b.performed_at.localeCompare(a.performed_at)
  );
  const visibleRecords = showAllRecords ? sortedRecords : sortedRecords.slice(0, RECORDS_SHOWN);

  return (
    <section className="profile-progress">
      <div className="profile-section-header">
        <h2>{memberId ? "Progresso" : "O teu progresso"}</h2>
      </div>

      <div className="profile-stats">
        <StatTile
          icon={IconDumbbell}
          label="Treinos"
          value={fmt(sessions.length)}
          caption={`${workoutsThisMonth} este mês`}
        />
        <StatTile
          icon={IconClock}
          label="Horas de treino"
          value={fmt(totalHours, 1)}
          unit="h"
          caption={`Média de ${formatHours(avgWeeklyHours)} por semana`}
        />
        <StatTile
          icon={IconWeightStack}
          label="Volume levantado"
          value={fmt(totalVolume)}
          unit="kg"
          caption="Soma de reps × carga"
        />
        <StatTile
          icon={IconTrendingUp}
          label="Peso corporal"
          value={latestWeight ? fmt(latestWeight.kg, 1) : "—"}
          unit={latestWeight ? "kg" : null}
          caption={
            weightChange == null
              ? latestWeight
                ? "Primeiro registo"
                : "Ainda sem registos"
              : `${weightChange > 0 ? "+" : weightChange < 0 ? "−" : "±"}${fmt(Math.abs(weightChange), 1)} kg desde ${shortDate(parseKey(weights[0].date))}`
          }
        />
      </div>

      {sessions.length === 0 ? (
        <GlassCard className="empty-state">
          <p>
            {memberId
              ? "Este membro ainda não tem treinos registados."
              : "Ainda sem treinos registados — os teus gráficos de progresso aparecem aqui."}
          </p>
        </GlassCard>
      ) : (
        <div className="profile-charts">
          <GlassCard className="profile-chart-card" strong>
            <h3>Horas de treino por semana</h3>
            <p className="text-secondary">Últimas {WEEKS} semanas</p>
            <ProgressChart
              kind="bar"
              color={HOURS_COLOR}
              points={weeks.map((w) => ({ label: w.label, tooltipLabel: w.tooltipLabel, value: w.hours }))}
              formatValue={(v, axis) => (axis ? `${fmt(v, 1)}h` : formatHours(v))}
              ariaLabel="Horas de treino por semana"
            />
          </GlassCard>
          <GlassCard className="profile-chart-card" strong>
            <h3>Volume levantado por semana</h3>
            <p className="text-secondary">Reps × carga, últimas {WEEKS} semanas</p>
            <ProgressChart
              kind="line"
              color={VOLUME_COLOR}
              points={weeks.map((w) => ({ label: w.label, tooltipLabel: w.tooltipLabel, value: w.volume }))}
              formatValue={(v, axis) => (axis ? (v >= 1000 ? `${fmt(v / 1000, 1)}k` : fmt(v)) : `${fmt(v)} kg`)}
              ariaLabel="Volume levantado por semana"
            />
          </GlassCard>
        </div>
      )}

      {sortedRecords.length > 0 && (
        <GlassCard className="profile-records" strong>
          <div className="profile-records-header">
            <h3>
              <IconTrophy size={20} />
              Recordes pessoais
            </h3>
            <span className="text-secondary">Maior peso em cada exercício · os mais feitos primeiro</span>
          </div>
          <ul className="profile-records-list">
            {visibleRecords.map((r) => {
              const exercise = exerciseById.get(r.exercise_id);
              const { icon: Icon, color } = muscleGroupVisual(exercise?.muscle_group);
              return (
                <li key={r.exercise_id} className="profile-record">
                  <span className="profile-record-image" style={{ color }}>
                    {exercise?.image_url ? <img src={exercise.image_url} alt="" loading="lazy" /> : <Icon size={22} />}
                  </span>
                  <span className="profile-record-text">
                    <span className="profile-record-name">{exercise?.name || "Exercício"}</span>
                    <span className="profile-record-meta">
                      Feito em {r.times_done} {r.times_done === 1 ? "treino" : "treinos"} · recorde a{" "}
                      {shortDate(parseKey(r.performed_at))} {parseKey(r.performed_at).getFullYear()}
                    </span>
                  </span>
                  <span className="profile-record-value">
                    <strong>{fmt(r.weight, 1)} kg</strong>
                    <span>× {r.reps}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          {sortedRecords.length > RECORDS_SHOWN && (
            <button type="button" className="log-add-set-inline" onClick={() => setShowAllRecords((v) => !v)}>
              {showAllRecords ? "Mostrar menos" : `Ver todos (${sortedRecords.length})`}
            </button>
          )}
        </GlassCard>
      )}
    </section>
  );
}
