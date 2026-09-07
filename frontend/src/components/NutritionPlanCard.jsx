import { useState } from "react";
import GlassCard from "./GlassCard";
import Modal from "./Modal";
import NewNutritionPlanForm from "./NewNutritionPlanForm";
import { apiRequest } from "../api/client";

// `editable` + `onChanged` são opcionais: quando omitidos o cartão fica só
// de leitura, como antes.
export default function NutritionPlanCard({ plan, editable, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    if (!window.confirm(`Eliminar o plano "${plan.name}"?`)) return;
    setDeleting(true);
    setError("");
    try {
      await apiRequest(`/nutrition-plans/${plan.id}`, { method: "DELETE" });
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

        {plan.meals.map((meal) => (
          <div key={meal.id} className="plan-day-preview">
            <span className="plan-day-title">{meal.name}</span>
            {meal.options.map((option, i) => (
              <div key={option.id} className="meal-option-preview">
                {meal.options.length > 1 && <span className="meal-option-label">Opção {i + 1}</span>}
                {option.items.length > 0 ? (
                  <ul className="meal-options-list">
                    {option.items.map((item) => (
                      <li key={item.id}>
                        {item.food_name}
                        {item.quantity && <span className="text-secondary"> — {item.quantity}</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  // Planos criados antes de existirem itens individuais só
                  // tinham esta descrição em texto livre.
                  option.description && <p className="text-secondary" style={{ margin: 0 }}>{option.description}</p>
                )}
              </div>
            ))}
          </div>
        ))}
      </GlassCard>

      {editing && (
        <Modal onClose={() => setEditing(false)}>
          <NewNutritionPlanForm
            submitPath={`/nutrition-plans/${plan.id}`}
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
