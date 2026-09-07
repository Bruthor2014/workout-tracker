import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import WeekCalendar from "../components/WeekCalendar";
import WeeklyComparison from "../components/WeeklyComparison";
import { apiRequest } from "../api/client";

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
        <Link to="/log" className="glass-button">
          + Registar treino
        </Link>
      </div>

      <WeekCalendar attendedDates={attendedDates} />
      <WeeklyComparison />

      <form className="filter-bar glass" onSubmit={handleFilterSubmit}>
        <div>
          <label className="field-label" htmlFor="from">
            De
          </label>
          <input
            id="from"
            type="date"
            className="glass-input"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="to">
            Até
          </label>
          <input
            id="to"
            type="date"
            className="glass-input"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div className="filter-actions">
          <button type="submit" className="glass-button">
            Filtrar
          </button>
          <button type="button" className="glass-button glass-button-secondary" onClick={clearFilter}>
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

      <div className="session-grid">
        {sessions.map((session) => {
          const duration = formatDuration(session.started_at, session.ended_at);
          const totalWeight = Number(session.total_weight_kg);
          return (
            <Link to={`/log/${session.id}`} key={session.id} className="session-card-link">
              <GlassCard className="session-card">
                <span className="date">{session.title || "Treino sem título"}</span>
                <span className="text-secondary">
                  {/* "T00:00:00" força o parsing em hora local, não UTC — evita
                      que a data mude de dia consoante o fuso horário do browser. */}
                  {new Date(`${session.performed_at}T00:00:00`).toLocaleDateString("pt-PT")}
                </span>
                <span className="text-secondary">
                  {session.exercise_count ?? 0} exercícios · {session.set_count ?? 0} séries
                </span>
                {(totalWeight > 0 || duration) && (
                  <span className="text-secondary">
                    {totalWeight > 0 && `${totalWeight} kg levantados`}
                    {totalWeight > 0 && duration && " · "}
                    {duration}
                  </span>
                )}
                {session.notes && <span className="text-secondary">{session.notes}</span>}
                <button
                  type="button"
                  className="glass-button glass-button-secondary session-delete"
                  onClick={(e) => handleDelete(e, session.id)}
                >
                  Eliminar
                </button>
              </GlassCard>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
