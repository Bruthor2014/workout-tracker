import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import WeekCalendar from "../components/WeekCalendar";
import WeeklyComparison from "../components/WeeklyComparison";
import {
  IconDumbbell,
  IconChevronRight,
  IconPlusCircle,
  IconCalendar,
  IconClock,
  IconTrash,
  IconWeightStack,
} from "../components/Icons";
import { apiRequest } from "../api/client";
import { workoutVisual } from "../utils/muscleGroups";
import { addDays, startOfWeek, toDateKey } from "../utils/date";

const WEEKDAY_NAMES = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

const MONTH_LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// "2026-10-03" -> "3 out 2026". "T00:00:00" força o parsing em hora local,
// não UTC — evita que a data mude de dia consoante o fuso do browser.
function formatDate(dateKey) {
  const d = new Date(`${dateKey}T00:00:00`);
  return `${d.getDate()} ${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
}

// "2026-10-03" -> "Sábado, 3 out"
function formatDayTitle(dateKey) {
  const d = new Date(`${dateKey}T00:00:00`);
  return `${WEEKDAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`;
}

function formatDuration(startedAt, endedAt) {
  if (!startedAt || !endedAt) return null;
  const minutes = Math.round((new Date(endedAt) - new Date(startedAt)) / 60000);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

// Mostra a semana escolhida no calendário (por omissão a atual) e, por
// baixo, só os treinos do dia escolhido (por omissão hoje). As setas do
// calendário mudam de semana; clicar num dia mostra os treinos desse dia.
export default function DashboardPage() {
  const todayKey = toDateKey(new Date());
  const currentWeekStart = startOfWeek(new Date());
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const [sessions, setSessions] = useState([]); // treinos da semana mostrada
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const weekStartKey = toDateKey(weekStart);
  useEffect(() => {
    let cancelled = false;
    const from = weekStartKey;
    const to = toDateKey(addDays(new Date(`${weekStartKey}T00:00:00`), 6));
    apiRequest(`/sessions?from=${from}&to=${to}`)
      .then((rows) => {
        if (!cancelled) setSessions(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [weekStartKey]);

  // Mudar de semana escolhe a segunda-feira dessa semana (ou hoje, se for a
  // semana atual).
  function changeWeek(offsetWeeks) {
    const next = addDays(weekStart, offsetWeeks * 7);
    setLoading(true);
    setError("");
    setWeekStart(next);
    const nextKey = toDateKey(next);
    setSelectedKey(nextKey === toDateKey(currentWeekStart) ? todayKey : nextKey);
  }

  async function handleDelete(e, sessionId) {
    e.preventDefault(); // não seguir o <Link> do cartão para /log/:id
    e.stopPropagation();

    if (!window.confirm("Eliminar este treino?")) return;

    try {
      await apiRequest(`/sessions/${sessionId}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      setError(err.message);
    }
  }

  // Dias com treino na semana (e com que figura — com dois treinos no mesmo
  // dia, usa-se o primeiro da lista).
  const workoutsByDate = useMemo(() => {
    const map = new Map();
    for (const s of sessions) {
      if (!map.has(s.performed_at)) map.set(s.performed_at, s.muscle_groups);
    }
    return map;
  }, [sessions]);

  const daySessions = sessions.filter((s) => s.performed_at === selectedKey);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Os teus treinos</h1>
        <Link to="/log" className="glass-button" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <IconPlusCircle size={18} />
          Registar treino
        </Link>
      </div>

      <WeekCalendar
        weekStart={weekStart}
        selectedKey={selectedKey}
        workoutsByDate={workoutsByDate}
        onSelect={setSelectedKey}
        onPrevWeek={() => changeWeek(-1)}
        onNextWeek={() => changeWeek(1)}
        canGoNext={weekStart < currentWeekStart}
      />
      <WeeklyComparison />

      <div className="day-header">
        <h2>
          <IconCalendar size={22} />
          {formatDayTitle(selectedKey)}
          {selectedKey === todayKey && <span className="day-header-today">Hoje</span>}
        </h2>
        {!loading && (
          <span className="text-secondary">
            {daySessions.length === 0
              ? "Sem treinos"
              : `${daySessions.length} ${daySessions.length === 1 ? "treino" : "treinos"}`}
          </span>
        )}
      </div>

      {loading && <p className="text-secondary">A carregar...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && daySessions.length === 0 && (
        <GlassCard className="empty-state">
          {selectedKey > todayKey ? (
            <p>Este dia ainda não chegou.</p>
          ) : (
            <>
              <p>Não há treinos neste dia.</p>
              <Link to={`/log?date=${selectedKey}`} className="glass-button" style={{ display: "inline-block", marginTop: 12 }}>
                Registar treino
              </Link>
            </>
          )}
        </GlassCard>
      )}

      <div className="workout-list">
        {daySessions.map((session) => {
          const duration = formatDuration(session.started_at, session.ended_at);
          const totalWeight = Math.round(Number(session.total_weight_kg));
          const { icon: WorkoutIcon, color } = workoutVisual(session.muscle_groups);
          return (
            <Link to={`/log/${session.id}`} key={session.id} className="session-card-link">
              <GlassCard className="workout-row" style={{ "--row-accent": color }}>
                <span className="workout-row-icon">
                  <WorkoutIcon size={40} />
                </span>

                <div className="workout-row-info">
                  <span className="workout-row-title">{session.title || "Treino sem título"}</span>
                  <span className="text-secondary">
                    {session.muscle_groups || `${session.exercise_count ?? 0} exercícios · ${session.set_count ?? 0} séries`}
                  </span>
                </div>

                <div className="workout-row-meta">
                  <span className="workout-row-meta-item">
                    <IconCalendar size={17} />
                    {formatDate(session.performed_at)}
                  </span>
                  <span className="workout-row-meta-item">
                    {duration && (
                      <>
                        <IconClock size={17} />
                        {duration}
                      </>
                    )}
                  </span>
                  <span className="workout-row-meta-item">
                    {totalWeight > 0 && (
                      <>
                        <IconWeightStack size={17} />
                        {totalWeight.toLocaleString("pt-PT")} kg
                      </>
                    )}
                  </span>
                  <span className="workout-row-meta-item">
                    <IconDumbbell size={17} />
                    {session.exercise_count ?? 0} exercícios
                  </span>
                </div>

                <div className="workout-row-actions">
                  <button
                    type="button"
                    className="workout-row-delete"
                    onClick={(e) => handleDelete(e, session.id)}
                    aria-label="Eliminar treino"
                  >
                    <IconTrash size={17} />
                  </button>
                  <span className="workout-row-view">
                    Ver detalhes
                    <IconChevronRight size={14} />
                  </span>
                </div>
              </GlassCard>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
