import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import { apiRequest } from "../api/client";

const emptySet = () => ({ exercise_id: "", reps: "", weight: "" });

function formatElapsed(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export default function LogWorkoutPage() {
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [exercises, setExercises] = useState([]);
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [selectedDayId, setSelectedDayId] = useState("");

  const [title, setTitle] = useState("");
  const [performedAt, setPerformedAt] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState("");
  const [durationHours, setDurationHours] = useState("");
  const [durationMinutesPart, setDurationMinutesPart] = useState("");
  const [sets, setSets] = useState([emptySet()]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSession, setLoadingSession] = useState(isEditing);
  const navigate = useNavigate();

  const [activeStart, setActiveStart] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    apiRequest("/exercises")
      .then(setExercises)
      .catch((err) => setError(err.message));
    if (!isEditing) {
      apiRequest("/plans").then(setPlans).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isEditing) return;
    apiRequest(`/sessions/${id}`)
      .then((session) => {
        setTitle(session.title || "");
        setPerformedAt(session.performed_at);
        setNotes(session.notes || "");
        if (session.started_at && session.ended_at) {
          const totalMinutes = Math.round((new Date(session.ended_at) - new Date(session.started_at)) / 60000);
          setDurationHours(String(Math.floor(totalMinutes / 60)));
          setDurationMinutesPart(String(totalMinutes % 60));
        }
        setSets(
          session.sets.map((s) => ({
            exercise_id: String(s.exercise_id),
            reps: String(s.reps),
            weight: s.weight != null ? String(Number(s.weight)) : "",
          }))
        );
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingSession(false));
  }, [id, isEditing]);

  useEffect(() => {
    if (!activeStart) return;
    intervalRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - activeStart.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [activeStart]);

  const selectedPlan = plans.find((p) => String(p.id) === selectedPlanId);
  const daysForSelectedPlan = selectedPlan ? selectedPlan.days : [];

  function handleStart() {
    setActiveStart(new Date());
    setElapsedSeconds(0);

    const day = daysForSelectedPlan.find((d) => String(d.id) === selectedDayId);
    if (day) {
      if (!title) setTitle(day.name);
      setSets(
        day.exercises.length
          ? day.exercises.map((ex) => ({
              exercise_id: String(ex.exercise_id),
              reps: ex.target_reps != null ? String(ex.target_reps) : "",
              weight: ex.target_load != null ? String(Number(ex.target_load)) : "",
            }))
          : [emptySet()]
      );
    }
  }

  function updateSet(index, field, value) {
    setSets((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  function addSetRow() {
    setSets((prev) => [...prev, emptySet()]);
  }

  function removeSetRow(index) {
    setSets((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body = {
        title: title || null,
        performed_at: performedAt,
        notes,
        sets: sets
          .filter((s) => s.exercise_id && s.reps)
          .map((s) => ({
            exercise_id: Number(s.exercise_id),
            reps: Number(s.reps),
            weight: s.weight ? Number(s.weight) : null,
          })),
      };

      if (activeStart) {
        body.started_at = activeStart.toISOString();
        body.ended_at = new Date().toISOString();
        if (selectedDayId) body.plan_day_id = Number(selectedDayId);
      } else {
        const totalMinutes = (Number(durationHours) || 0) * 60 + (Number(durationMinutesPart) || 0);
        if (totalMinutes > 0) {
          // Duração editada à mão (sem cronómetro): usa a data do treino às
          // 00:00 como início fictício — só a diferença entre as duas
          // importa para calcular a duração a mostrar.
          const start = new Date(`${performedAt}T00:00:00.000Z`);
          const end = new Date(start.getTime() + totalMinutes * 60000);
          body.started_at = start.toISOString();
          body.ended_at = end.toISOString();
        }
      }

      if (isEditing) {
        await apiRequest(`/sessions/${id}`, { method: "PUT", body });
      } else {
        await apiRequest("/sessions", { method: "POST", body });
      }
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loadingSession) {
    return (
      <div className="page-center">
        <p className="text-secondary">A carregar...</p>
      </div>
    );
  }

  return (
    <div className="page-center">
      <GlassCard className="form-card">
        <h1>{isEditing ? "Editar treino" : "Registar treino"}</h1>

        {!isEditing && !activeStart && (
          <div className="start-workout-box">
            <p className="text-secondary" style={{ marginTop: 0 }}>
              Podes iniciar o treino agora (com cronómetro), a partir de um
              plano ou em branco — ou simplesmente preencher o formulário
              abaixo sem cronómetro.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <select
                className="glass-input"
                style={{ flex: "1 1 200px" }}
                value={selectedPlanId}
                onChange={(e) => {
                  setSelectedPlanId(e.target.value);
                  setSelectedDayId("");
                }}
              >
                <option value="">Treino livre (sem plano)</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
              {selectedPlan && (
                <select
                  className="glass-input"
                  style={{ flex: "1 1 200px" }}
                  value={selectedDayId}
                  onChange={(e) => setSelectedDayId(e.target.value)}
                >
                  <option value="">Escolhe o dia...</option>
                  {daysForSelectedPlan.map((day) => (
                    <option key={day.id} value={day.id}>
                      {day.name}
                    </option>
                  ))}
                </select>
              )}
              <button type="button" className="glass-button" onClick={handleStart}>
                ▶ Iniciar treino
              </button>
            </div>
          </div>
        )}

        {activeStart && (
          <div className="active-workout-timer">
            <span className="active-workout-dot" />
            Treino em curso — {formatElapsed(elapsedSeconds)}
          </div>
        )}

        <p className="text-secondary">Adiciona as séries que fizeste.</p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginTop: 20 }}>
            <label className="field-label" htmlFor="title">
              Título (opcional)
            </label>
            <input
              id="title"
              type="text"
              className="glass-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Peito e tríceps"
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <label className="field-label" htmlFor="date">
              Data
            </label>
            <input
              id="date"
              type="date"
              className="glass-input"
              value={performedAt}
              onChange={(e) => setPerformedAt(e.target.value)}
              required
            />
          </div>

          {!activeStart && (
            <div style={{ marginTop: 14 }}>
              <label className="field-label">Duração (opcional)</label>
              <div style={{ display: "flex", gap: 10, maxWidth: 220 }}>
                <div style={{ flex: 1 }}>
                  <input
                    id="duration-hours"
                    type="number"
                    min="0"
                    className="glass-input"
                    value={durationHours}
                    onChange={(e) => setDurationHours(e.target.value)}
                    placeholder="0"
                    aria-label="Horas"
                  />
                  <span className="field-hint">horas</span>
                </div>
                <div style={{ flex: 1 }}>
                  <input
                    id="duration-minutes"
                    type="number"
                    min="0"
                    max="59"
                    className="glass-input"
                    value={durationMinutesPart}
                    onChange={(e) => setDurationMinutesPart(e.target.value)}
                    placeholder="0"
                    aria-label="Minutos"
                  />
                  <span className="field-hint">min</span>
                </div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 14 }}>
            <div className="set-row-header">
              <span>Exercício</span>
              <span>Reps</span>
              <span>Carga (kg)</span>
              <span></span>
              <span></span>
            </div>
            {sets.map((row, index) => (
              <div className="set-row" key={index}>
                <select
                  className="glass-input"
                  value={row.exercise_id}
                  onChange={(e) => updateSet(index, "exercise_id", e.target.value)}
                  required
                >
                  <option value="">Escolhe...</option>
                  {exercises.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  className="glass-input"
                  value={row.reps}
                  onChange={(e) => updateSet(index, "reps", e.target.value)}
                  required
                />
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className="glass-input"
                  value={row.weight}
                  onChange={(e) => updateSet(index, "weight", e.target.value)}
                />
                <button
                  type="button"
                  className="glass-button glass-button-secondary"
                  onClick={() => removeSetRow(index)}
                  disabled={sets.length === 1}
                >
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="glass-button glass-button-secondary" onClick={addSetRow}>
              + Adicionar série
            </button>
          </div>

          <div style={{ marginTop: 14 }}>
            <label className="field-label" htmlFor="notes">
              Notas (opcional)
            </label>
            <input
              id="notes"
              type="text"
              className="glass-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Como correu o treino?"
            />
          </div>

          {error && <p className="error-text">{error}</p>}

          <div className="form-actions">
            <button type="submit" className="glass-button" disabled={loading}>
              {loading
                ? "A guardar..."
                : activeStart
                ? "Terminar treino"
                : isEditing
                ? "Guardar alterações"
                : "Guardar treino"}
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
