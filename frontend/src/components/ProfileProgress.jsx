import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import GlassCard from "./GlassCard";
import ProgressChart from "./ProgressChart";
import EvolutionChart from "./EvolutionChart";
import Modal from "./Modal";
import { IconChevronRight, IconClock, IconDumbbell, IconTrendingUp, IconTrophy, IconWeightStack } from "./Icons";
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

// Evolução de um exercício ao longo do tempo (a série mais pesada de cada
// treino em que apareceu) — reaparece em cima do EvolutionChart já usado
// para o peso corporal, só muda a fonte dos dados e a unidade.
function ExerciseHistoryModal({ exercise, history, loading, error, onClose }) {
  return (
    <Modal onClose={onClose}>
      <GlassCard className="preview-card" strong>
        <h3>{exercise?.name || "Exercício"}</h3>
        {loading && <p className="text-secondary">A carregar...</p>}
        {error && <p className="error-text">{error}</p>}
        {!loading && !error && history.length === 0 && (
          <p className="text-secondary">Ainda não há séries com carga registadas para este exercício.</p>
        )}
        {!loading && !error && history.length > 0 && (
          <EvolutionChart data={history.map((h) => ({ date: h.performed_at, value: h.weight }))} unit="kg" />
        )}
        <div className="form-actions">
          <button type="button" className="glass-button" onClick={onClose}>
            Fechar
          </button>
        </div>
      </GlassCard>
    </Modal>
  );
}

// `onClick` é opcional — só o próprio utilizador a ver o seu progresso tem
// para onde navegar/saltar a partir daqui (ver `own` em ProfileProgress);
// a vista de staff sobre um membro (`memberId`) fica sem seta, só leitura.
function StatTile({ icon: Icon, label, value, unit, caption, onClick }) {
  return (
    <GlassCard
      className={`stat-tile profile-stat${onClick ? " profile-stat-clickable" : ""}`}
      strong
      {...(onClick ? { role: "button", tabIndex: 0, onClick, onKeyDown: (e) => e.key === "Enter" && onClick() } : {})}
    >
      <div className="stat-tile-header">
        <span className="stat-tile-icon">
          <Icon size={22} />
        </span>
        <span className="stat-tile-label">{label}</span>
        {onClick && <IconChevronRight size={16} className="profile-stat-chevron" />}
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
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [showAllRecords, setShowAllRecords] = useState(false);
  const [historyExercise, setHistoryExercise] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  // Staff a ver o progresso de um membro (`memberId`) não tem dashboard
  // nem registo de peso próprios para onde saltar a partir daqui.
  const own = !memberId;

  // Gráfico de evolução por exercício: só na vista própria por agora (o
  // endpoint /sessions/exercise/:id/history só devolve o do próprio
  // utilizador autenticado, não há ainda o equivalente para staff ver o de
  // um membro).
  function openExerciseHistory(exercise) {
    setHistoryExercise(exercise);
    setHistoryData([]);
    setHistoryError("");
    setHistoryLoading(true);
    apiRequest(`/sessions/exercise/${exercise.id}/history`)
      .then(setHistoryData)
      .catch((err) => setHistoryError(err.message))
      .finally(() => setHistoryLoading(false));
  }

  function scrollToId(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
          onClick={own ? () => navigate("/dashboard") : undefined}
        />
        <StatTile
          icon={IconClock}
          label="Horas de treino"
          value={fmt(totalHours, 1)}
          unit="h"
          caption={`Média de ${formatHours(avgWeeklyHours)} por semana`}
          onClick={own && sessions.length > 0 ? () => scrollToId("profile-hours-chart") : undefined}
        />
        <StatTile
          icon={IconWeightStack}
          label="Volume levantado"
          value={fmt(totalVolume)}
          unit="kg"
          caption="Soma de reps × carga"
          onClick={own && sessions.length > 0 ? () => scrollToId("profile-volume-chart") : undefined}
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
          onClick={own ? () => scrollToId("body-metrics-section") : undefined}
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
          <GlassCard className="profile-chart-card" strong id="profile-hours-chart">
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
          <GlassCard className="profile-chart-card" strong id="profile-volume-chart">
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
              const content = (
                <>
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
                </>
              );
              return (
                <li key={r.exercise_id} className="profile-record">
                  {own && exercise ? (
                    <button
                      type="button"
                      className="profile-record-trigger"
                      onClick={() => openExerciseHistory(exercise)}
                      aria-label={`Ver evolução de ${exercise.name}`}
                    >
                      {content}
                    </button>
                  ) : (
                    content
                  )}
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

      {historyExercise && (
        <ExerciseHistoryModal
          exercise={historyExercise}
          history={historyData}
          loading={historyLoading}
          error={historyError}
          onClose={() => setHistoryExercise(null)}
        />
      )}
    </section>
  );
}
