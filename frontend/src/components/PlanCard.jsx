import { useState } from "react";
import GlassCard from "./GlassCard";
import Modal from "./Modal";
import NewPlanForm from "./NewPlanForm";
import { apiRequest } from "../api/client";

// `editable` + `onChanged` são opcionais: quando omitidos o cartão fica só
// de leitura (ex: pré-visualização), como antes. `exercises` só é preciso
// quando `editable` (alimenta o dropdown do formulário de edição).
export default function PlanCard({ plan, exercises, editable, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    if (!window.confirm(`Eliminar o plano "${plan.name}"?`)) return;
    setDeleting(true);
    setError("");
    try {
      await apiRequest(`/plans/${plan.id}`, { method: "DELETE" });
      onChanged?.();
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  return (
    <>
      <GlassCard className="session-card plan-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <span className="date">{plan.name}</span>
          {editable && (
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button
                type="button"
                className="glass-button glass-button-secondary"
                style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                onClick={() => setEditing(true)}
              >
                Editar
              </button>
              <button
                type="button"
                className="glass-button glass-button-secondary"
                style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "..." : "Eliminar"}
              </button>
            </div>
          )}
        </div>

        {plan.description && <span className="text-secondary">{plan.description}</span>}
        {error && <p className="error-text">{error}</p>}

        {plan.days.map((day) => (
          <div key={day.id} className="plan-day-preview">
            <span className="plan-day-title">{day.name}</span>
            <div className="plan-preview">
              {day.exercises.map((ex) => (
                <div className="plan-row" key={ex.id}>
                  <span>{ex.exercise_name}</span>
                  <span>{ex.target_sets ?? "-"}x</span>
                  <span>{ex.target_reps ?? "-"} reps</span>
                  <span>{ex.target_load ? `${Number(ex.target_load)} kg` : "-"}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </GlassCard>

      {editing && (
        <Modal onClose={() => setEditing(false)}>
          <NewPlanForm
            exercises={exercises}
            submitPath={`/plans/${plan.id}`}
            method="PUT"
            initialPlan={plan}
            onCancel={() => setEditing(false)}
            onCreated={() => {
              setEditing(false);
              onChanged?.();
            }}
          />
        </Modal>
      )}
    </>
  );
}
