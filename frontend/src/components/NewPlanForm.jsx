import { useState } from "react";
import GlassCard from "./GlassCard";
import { apiRequest } from "../api/client";

const emptyExerciseRow = () => ({ exercise_id: "", target_sets: "", target_reps: "", target_load: "" });
const emptyDay = () => ({ name: "", exercises: [emptyExerciseRow()] });

function planToFormDays(plan) {
  return plan.days.map((day) => ({
    name: day.name,
    exercises: day.exercises.map((ex) => ({
      exercise_id: String(ex.exercise_id),
      target_sets: ex.target_sets ?? "",
      target_reps: ex.target_reps ?? "",
      target_load: ex.target_load ?? "",
    })),
  }));
}

// Formulário de criação/edição de plano, com dias (ex: "Segunda - Costas e
// Bíceps"), cada um com os seus próprios exercícios. Reutilizado em vários
// sítios:
// - PlansPage.jsx: o membro cria/edita um plano para si mesmo
//   (submitPath="/plans" ou "/plans/:id")
// - MemberDetailPage.jsx: staff cria um plano para um membro específico
//   (submitPath={`/plans/member/${memberId}`}) ou edita um já existente
//   (submitPath={`/plans/${plan.id}`})
// Passar `initialPlan` (com `method="PUT"`) pré-preenche tudo a partir de um
// plano existente em vez de começar em branco.
export default function NewPlanForm({ exercises, submitPath, method = "POST", initialPlan, onCreated, onCancel }) {
  const [name, setName] = useState(initialPlan?.name ?? "");
  const [description, setDescription] = useState(initialPlan?.description ?? "");
  const [days, setDays] = useState(initialPlan ? planToFormDays(initialPlan) : [emptyDay()]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateDayName(dayIndex, value) {
    setDays((prev) => prev.map((day, i) => (i === dayIndex ? { ...day, name: value } : day)));
  }

  function addDay() {
    setDays((prev) => [...prev, emptyDay()]);
  }

  function removeDay(dayIndex) {
    setDays((prev) => prev.filter((_, i) => i !== dayIndex));
  }

  function updateExercise(dayIndex, exIndex, field, value) {
    setDays((prev) =>
      prev.map((day, i) =>
        i !== dayIndex
          ? day
          : {
              ...day,
              exercises: day.exercises.map((row, j) => (j === exIndex ? { ...row, [field]: value } : row)),
            }
      )
    );
  }

  function addExerciseRow(dayIndex) {
    setDays((prev) =>
      prev.map((day, i) => (i === dayIndex ? { ...day, exercises: [...day.exercises, emptyExerciseRow()] } : day))
    );
  }

  function removeExerciseRow(dayIndex, exIndex) {
    setDays((prev) =>
      prev.map((day, i) =>
        i !== dayIndex ? day : { ...day, exercises: day.exercises.filter((_, j) => j !== exIndex) }
      )
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiRequest(submitPath, {
        method,
        body: {
          name,
          description,
          days: days.map((day) => ({
            name: day.name,
            exercises: day.exercises
              .filter((r) => r.exercise_id)
              .map((r) => ({
                exercise_id: Number(r.exercise_id),
                target_sets: r.target_sets ? Number(r.target_sets) : null,
                target_reps: r.target_reps ? Number(r.target_reps) : null,
                target_load: r.target_load ? Number(r.target_load) : null,
              })),
          })),
        },
      });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <GlassCard className="form-card" strong>
      <h3>{initialPlan ? "Editar plano" : "Novo plano"}</h3>
      <form onSubmit={handleSubmit}>
        <div style={{ marginTop: 14 }}>
          <label className="field-label" htmlFor="plan-name">
            Nome do plano
          </label>
          <input
            id="plan-name"
            type="text"
            className="glass-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Treino de força — 4 dias"
            required
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <label className="field-label" htmlFor="plan-description">
            Descrição (opcional)
          </label>
          <input
            id="plan-description"
            type="text"
            className="glass-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {days.map((day, dayIndex) => (
          <div className="plan-day-block" key={dayIndex}>
            <div className="plan-day-header">
              <input
                type="text"
                className="glass-input"
                value={day.name}
                onChange={(e) => updateDayName(dayIndex, e.target.value)}
                placeholder="Ex: Segunda - Costas e Bíceps"
                required
              />
              <button
                type="button"
                className="glass-button glass-button-secondary"
                onClick={() => removeDay(dayIndex)}
                disabled={days.length === 1}
              >
                Remover dia
              </button>
            </div>

            <div className="set-row-header">
              <span>Exercício</span>
              <span>Séries</span>
              <span>Reps</span>
              <span>Carga (kg)</span>
              <span></span>
            </div>
            {day.exercises.map((row, exIndex) => (
              <div className="set-row" key={exIndex}>
                <select
                  className="glass-input"
                  value={row.exercise_id}
                  onChange={(e) => updateExercise(dayIndex, exIndex, "exercise_id", e.target.value)}
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
                  value={row.target_sets}
                  onChange={(e) => updateExercise(dayIndex, exIndex, "target_sets", e.target.value)}
                />
                <input
                  type="number"
                  min="1"
                  className="glass-input"
                  value={row.target_reps}
                  onChange={(e) => updateExercise(dayIndex, exIndex, "target_reps", e.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className="glass-input"
                  value={row.target_load}
                  onChange={(e) => updateExercise(dayIndex, exIndex, "target_load", e.target.value)}
                />
                <button
                  type="button"
                  className="glass-button glass-button-secondary"
                  onClick={() => removeExerciseRow(dayIndex, exIndex)}
                  disabled={day.exercises.length === 1}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className="glass-button glass-button-secondary"
              onClick={() => addExerciseRow(dayIndex)}
            >
              + Adicionar exercício
            </button>
          </div>
        ))}

        <button type="button" className="glass-button glass-button-secondary" onClick={addDay} style={{ marginTop: 14 }}>
          + Adicionar dia
        </button>

        {error && <p className="error-text">{error}</p>}

        <div className="form-actions">
          <button type="button" className="glass-button glass-button-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="glass-button" disabled={loading}>
            {loading ? "A guardar..." : "Guardar plano"}
          </button>
        </div>
      </form>
    </GlassCard>
  );
}
