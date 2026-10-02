import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import WeekCalendar from "../components/WeekCalendar";
import WeeklyComparison from "../components/WeeklyComparison";
import { IconDumbbell, IconChevronRight, IconPlusCircle, IconCalendar, IconFilter, IconRefresh } from "../components/Icons";
import { apiRequest } from "../api/client";

// Cor do traço à esquerda de cada linha do histórico — só decorativo, cicla
// pela lista para dar alguma variedade visual.
const ROW_ACCENTS = ["#a78bfa", "#60a5fa", "#34d399", "#fb923c", "#f472b6"];

function formatDuration(startedAt, endedAt) {
  if (!startedAt || !endedAt) return null;
  const minutes = Math.round((new Date(endedAt) - new Date(startedAt)) / 60000);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function loadSessions() {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const query = params.toString() ? `?${params.toString()}` : "";

    apiRequest(`/sessions${query}`)
      .then(setSessions)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFilterSubmit(e) {
    e.preventDefault();
    loadSessions();
  }

  function clearFilter() {
    setFrom("");
    setTo("");
    setTimeout(loadSessions, 0);
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

  // Sem filtro de datas ativo, `sessions` já cobre a semana atual — usa-se
  // essa lista para marcar os dias em que houve treino.
  const attendedDates = useMemo(() => new Set(sessions.map((s) => s.performed_at)), [sessions]);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Os teus treinos</h1>
        <Link to="/log" className="glass-button" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <IconPlusCircle size={18} />
          Registar treino
        </Link>
      </div>

      <WeekCalendar attendedDates={attendedDates} />
      <WeeklyComparison />

      <form className="filter-bar glass" onSubmit={handleFilterSubmit}>
        <span className="filter-bar-icon">
          <IconCalendar size={18} />
        </span>

        <div className="filter-bar-field">
          <label className="filter-bar-label" htmlFor="from">
            De
          </label>
          <input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>

        <div className="filter-bar-field">
          <label className="filter-bar-label" htmlFor="to">
            Até
          </label>
          <input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>

        <span className="filter-bar-divider" />

        <div className="filter-bar-actions">
          <button type="submit" className="glass-button filter-bar-btn">
            <IconFilter size={16} />
            Filtrar
          </button>
          <button type="button" className="glass-button glass-button-secondary filter-bar-btn" onClick={clearFilter}>
            <IconRefresh size={16} />
            Limpar
          </button>
        </div>
      </form>

      {loading && <p className="text-secondary">A carregar...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && sessions.length === 0 && (
        <GlassCard className="empty-state">
          <p>Não há treinos para mostrar.</p>
          <Link to="/log" className="glass-button" style={{ display: "inline-block", marginTop: 12 }}>
            Registar treino
          </Link>
        </GlassCard>
      )}

      <div className="workout-list">
        {sessions.map((session, i) => {
          const duration = formatDuration(session.started_at, session.ended_at);
          const totalWeight = Number(session.total_weight_kg);
          const accent = ROW_ACCENTS[i % ROW_ACCENTS.length];
          return (
            <Link to={`/log/${session.id}`} key={session.id} className="session-card-link">
              <GlassCard className="workout-row" style={{ "--row-accent": accent }}>
                <span className="workout-row-icon">
                  <IconDumbbell size={20} />
                </span>

                <div className="workout-row-info">
                  <span className="workout-row-title">{session.title || "Treino sem título"}</span>
                  <span className="text-secondary">
                    {session.muscle_groups || `${session.exercise_count ?? 0} exercícios · ${session.set_count ?? 0} séries`}
                  </span>
                </div>

                <div className="workout-row-meta">
                  <span className="workout-row-meta-item">
                    {/* "T00:00:00" força o parsing em hora local, não UTC — evita
                        que a data mude de dia consoante o fuso horário do browser. */}
                    {new Date(`${session.performed_at}T00:00:00`).toLocaleDateString("pt-PT")}
                  </span>
                  {duration && <span className="workout-row-meta-item">{duration}</span>}
                  {totalWeight > 0 && <span className="workout-row-meta-item">{totalWeight} kg</span>}
                  <span className="workout-row-meta-item">{session.exercise_count ?? 0} exercícios</span>
                </div>

                <div className="workout-row-actions">
                  <button
                    type="button"
                    className="glass-button glass-button-secondary session-delete"
                    onClick={(e) => handleDelete(e, session.id)}
                  >
                    Eliminar
                  </button>
                  <span className="glass-button glass-button-secondary workout-row-view">
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
