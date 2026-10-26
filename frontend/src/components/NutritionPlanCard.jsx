import { useEffect, useState } from "react";
import GlassCard from "./GlassCard";
import NewNutritionPlanForm from "./NewNutritionPlanForm";
import MealEditor from "./MealEditor";
import PlanCreator from "./PlanCreator";
import { IconApple, IconCheck, IconChevronRight, IconPencil, IconPrinter, IconSave, IconTrash, IconUtensils } from "./Icons";
import { apiRequest, resolveAssetUrl } from "../api/client";
import { mealVisual } from "../utils/meals";
import { formMealToApi, mealToForm } from "../utils/mealForm";
import { activeSinceLabel, toDateKey } from "../utils/date";

function FoodItem({ item }) {
  const meta = [item.brand, item.kcal_100g != null && `${Number(item.kcal_100g)} kcal/100 g`].filter(Boolean);
  return (
    <li className="nplan-food">
      <span className="nplan-food-image">
        {item.image_url ? (
          <img src={resolveAssetUrl(item.image_url)} alt="" loading="lazy" />
        ) : (
          <IconUtensils size={16} />
        )}
      </span>
      <span className="nplan-food-text">
        <span className="nplan-food-name">{item.food_name}</span>
        {meta.length > 0 && <span className="nplan-food-meta">{meta.join(" · ")}</span>}
      </span>
      {item.quantity && <span className="nplan-food-quantity">{item.quantity}</span>}
    </li>
  );
}

// Edição de uma só refeição, no próprio lugar da refeição no cartão —
// guarda só essa refeição (PUT /nutrition-plans/:id/meals/:mealId).
function MealEditForm({ plan, meal, onCancel, onSaved }) {
  const [draft, setDraft] = useState(() => mealToForm(meal));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await apiRequest(`/nutrition-plans/${plan.id}/meals/${meal.id}`, { method: "PUT", body: formMealToApi(draft) });
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form className="nutrition-form nplan-day-edit" onSubmit={handleSubmit}>
      <MealEditor meal={draft} onChange={setDraft} onError={setError} />
      {error && <p className="error-text">{error}</p>}
      <div className="log-actions">
        <button type="button" className="glass-button glass-button-secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="glass-button log-save-button" disabled={saving}>
          <IconSave size={18} />
          {saving ? "A guardar..." : "Guardar refeição"}
        </button>
      </div>
    </form>
  );
}

// `editable` + `onChanged` são opcionais: quando omitidos o cartão fica só
// de leitura. "Editar" (plano inteiro) abre o formulário completo no lugar
// do cartão; "Editar refeição" só essa refeição. `trackCompletion`: mostra
// o botão "Concluída hoje" em cada refeição — só faz sentido para o
// próprio dono do plano (ver NutritionPage.jsx vs. a vista do staff em
// MemberDetailPage.jsx, que não passa esta prop). `onCollapse` (opcional):
// mostra um botão para fechar os detalhes e voltar à linha fechada
// (NutritionPlanRow.jsx) — sem isto o cartão não tem como se fechar.
export default function NutritionPlanCard({ plan, editable: editableProp, onChanged, trackCompletion, onCollapse }) {
  // Só quem criou o plano o pode alterar (o backend também o garante).
  const editable = editableProp && plan.can_edit;
  const [editing, setEditing] = useState(false);
  const [editingMealId, setEditingMealId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [completedIds, setCompletedIds] = useState(() => new Set());
  const todayKey = toDateKey(new Date());

  useEffect(() => {
    if (!trackCompletion) return;
    apiRequest(`/nutrition-plans/${plan.id}/completions?date=${todayKey}`)
      .then((data) => setCompletedIds(new Set(data.completed_meal_slot_ids)))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id, trackCompletion]);

  async function toggleCompletion(mealId) {
    const wasCompleted = completedIds.has(mealId);
    // Otimista: a caixa responde logo, corrige-se sozinha se o pedido falhar.
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (wasCompleted) next.delete(mealId);
      else next.add(mealId);
      return next;
    });
    try {
      await apiRequest(`/nutrition-plans/${plan.id}/meals/${mealId}/completion`, {
        method: "PUT",
        body: { date: todayKey, completed: !wasCompleted },
      });
    } catch (err) {
      setError(err.message);
      setCompletedIds((prev) => {
        const next = new Set(prev);
        if (wasCompleted) next.add(mealId);
        else next.delete(mealId);
        return next;
      });
    }
  }

  async function handleSetActive() {
    setError("");
    try {
      await apiRequest(`/nutrition-plans/${plan.id}/active`, { method: "PUT" });
      onChanged?.();
    } catch (err) {
      setError(err.message);
    }
  }

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

  if (editing) {
    return (
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
    );
  }

  const foodCount = plan.meals.reduce(
    (sum, meal) => sum + meal.options.reduce((s, option) => s + option.items.length, 0),
    0
  );

  return (
    <GlassCard className="nplan print-area">
      <div className="nplan-header">
        <span className="nplan-icon">
          <IconApple size={24} />
        </span>
        <div className="nplan-title">
          <h3>{plan.name}</h3>
          {plan.description && <p>{plan.description}</p>}
          <PlanCreator plan={plan} />
          <div className="nplan-stats">
            <span>
              {plan.meals.length} {plan.meals.length === 1 ? "refeição" : "refeições"}
            </span>
            <span>
              {foodCount} {foodCount === 1 ? "alimento" : "alimentos"}
            </span>
            {trackCompletion &&
              (plan.is_active ? (
                <span className="nplan-stat-active">
                  <IconCheck size={12} />
                  {activeSinceLabel(plan.active_since)}
                </span>
              ) : (
                <button type="button" className="nplan-stat-set-active" onClick={handleSetActive}>
                  Definir como ativo
                </button>
              ))}
          </div>
        </div>
        <div className="nplan-actions">
          <button type="button" className="nplan-action" onClick={() => window.print()}>
            <IconPrinter size={16} />
            Imprimir
          </button>
          {onCollapse && (
            <button type="button" className="nplan-action" onClick={onCollapse}>
              <span style={{ display: "inline-flex", transform: "rotate(-90deg)" }}>
                <IconChevronRight size={16} />
              </span>
              Fechar
            </button>
          )}
          {editable && (
            <>
              <button type="button" className="nplan-action" onClick={() => setEditing(true)}>
                <IconPencil size={16} />
                Editar
              </button>
              <button
                type="button"
                className="nplan-action danger"
                onClick={handleDelete}
                disabled={deleting}
                aria-label="Eliminar plano"
              >
                <IconTrash size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="nplan-meals">
        {plan.meals.map((meal) => {
          if (meal.id === editingMealId) {
            return (
              <MealEditForm
                key={meal.id}
                plan={plan}
                meal={meal}
                onCancel={() => setEditingMealId(null)}
                onSaved={() => {
                  setEditingMealId(null);
                  onChanged?.();
                }}
              />
            );
          }
          const { icon: MealIcon, color } = mealVisual(meal.name);
          const isCompleted = trackCompletion && completedIds.has(meal.id);
          return (
            <section
              key={meal.id}
              className={`nplan-meal${isCompleted ? " completed" : ""}`}
              style={{ "--meal-color": color }}
            >
              <div className="nplan-meal-header">
                <span className="nplan-meal-icon">
                  <MealIcon size={18} />
                </span>
                <h4>{meal.name}</h4>
                {meal.options.length > 1 && <span className="nplan-meal-count">{meal.options.length} opções</span>}
              </div>

              <div className="nplan-options">
                {meal.options.map((option, i) => (
                  <div key={option.id} className="nplan-option">
                    {meal.options.length > 1 && <span className="nf-option-pill">Opção {i + 1}</span>}
                    {option.items.length > 0 ? (
                      <ul className="nplan-foods">
                        {option.items.map((item) => (
                          <FoodItem key={item.id} item={item} />
                        ))}
                      </ul>
                    ) : (
                      // Planos criados antes de existirem itens individuais só
                      // tinham esta descrição em texto livre.
                      option.description && <p className="text-secondary nplan-legacy">{option.description}</p>
                    )}
                  </div>
                ))}
              </div>
              {(editable || trackCompletion) && (
                <div className="nplan-day-actions">
                  {trackCompletion && (
                    <button
                      type="button"
                      className={`nplan-action${isCompleted ? " done" : ""}`}
                      onClick={() => toggleCompletion(meal.id)}
                    >
                      <IconCheck size={14} />
                      {isCompleted ? "Concluída hoje" : "Marcar como feita"}
                    </button>
                  )}
                  {editable && (
                    <button type="button" className="nplan-action" onClick={() => setEditingMealId(meal.id)}>
                      <IconPencil size={14} />
                      Editar refeição
                    </button>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </GlassCard>
  );
}
