import { useState } from "react";
import GlassCard from "./GlassCard";
import MealEditor from "./MealEditor";
import { IconFileText, IconPlusCircle, IconSave, IconUtensils } from "./Icons";
import { apiRequest } from "../api/client";
import { emptyMeal, formMealToApi, mealToForm } from "../utils/mealForm";

// Formulário de criação/edição de um plano de nutrição: várias refeições
// (nome livre — "Pequeno-almoço", "Lanche da manhã", ...), cada uma com uma
// ou mais opções, e cada opção com os seus elementos individuais +
// quantidade (ex: "Ovos" — "2 unidades", "Torrada integral" — "1 fatia").
// Cada refeição é um MealEditor (o mesmo usado para editar só uma refeição
// a partir do cartão do plano).
// Passar `initialPlan` (com `method="PUT"`) pré-preenche tudo a partir de um
// plano existente em vez de começar em branco.
export default function NewNutritionPlanForm({ submitPath, method = "POST", initialPlan, onCreated, onCancel }) {
  const [name, setName] = useState(initialPlan?.name ?? "");
  const [description, setDescription] = useState(initialPlan?.description ?? "");
  const [meals, setMeals] = useState(initialPlan ? initialPlan.meals.map(mealToForm) : [emptyMeal()]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateMeal(mealIndex, meal) {
    setMeals((prev) => prev.map((m, i) => (i === mealIndex ? meal : m)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiRequest(submitPath, {
        method,
        body: { name, description, meals: meals.map(formMealToApi) },
      });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="nutrition-form" onSubmit={handleSubmit}>
      <GlassCard className="log-card">
        <div className="log-card-header">
          <IconFileText size={26} />
          <h2>{initialPlan ? "Editar plano" : "Detalhes do plano"}</h2>
        </div>
        <div className="nutrition-details-grid">
          <div>
            <label className="log-label" htmlFor="nutrition-name">
              Nome do plano
            </label>
            <input
              id="nutrition-name"
              type="text"
              className="glass-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="log-label" htmlFor="nutrition-description">
              Descrição <span>(opcional)</span>
            </label>
            <textarea
              id="nutrition-description"
              className="glass-input nutrition-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>
      </GlassCard>

      <GlassCard className="log-card">
        <div className="log-card-header">
          <IconUtensils size={26} />
          <h2>Refeições</h2>
        </div>

        <div className="nutrition-meals">
          {meals.map((meal, mealIndex) => (
            <MealEditor
              key={mealIndex}
              meal={meal}
              onChange={(updated) => updateMeal(mealIndex, updated)}
              onRemove={() => setMeals((prev) => prev.filter((_, i) => i !== mealIndex))}
              canRemove={meals.length > 1}
              onError={setError}
            />
          ))}

          <button type="button" className="log-add-set" onClick={() => setMeals((prev) => [...prev, emptyMeal()])}>
            <IconPlusCircle size={18} />
            Adicionar refeição
          </button>
        </div>
      </GlassCard>

      {error && <p className="error-text">{error}</p>}

      <div className="log-actions">
        <button type="button" className="glass-button glass-button-secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="glass-button log-save-button" disabled={loading}>
          <IconSave size={18} />
          {loading ? "A guardar..." : "Guardar plano"}
        </button>
      </div>
    </form>
  );
}
