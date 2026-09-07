import { useState } from "react";
import GlassCard from "./GlassCard";
import { apiRequest } from "../api/client";

const emptyItem = () => ({ food_name: "", quantity: "" });
const emptyOption = () => ({ items: [emptyItem()] });
const emptyMeal = () => ({ name: "", options: [emptyOption()] });

function planToFormMeals(plan) {
  return plan.meals.map((meal) => ({
    name: meal.name,
    options: meal.options.map((option) => ({
      items:
        option.items.length > 0
          ? option.items.map((item) => ({ food_name: item.food_name, quantity: item.quantity ?? "" }))
          : [emptyItem()],
    })),
  }));
}

// Formulário de criação/edição de um plano de nutrição: várias refeições
// (nome livre — "Pequeno-almoço", "Lanche da manhã", ...), cada uma com uma
// ou mais opções, e cada opção com os seus elementos individuais +
// quantidade (ex: "Ovos" — "2 unidades", "Torrada integral" — "1 fatia").
// Passar `initialPlan` (com `method="PUT"`) pré-preenche tudo a partir de um
// plano existente em vez de começar em branco.
export default function NewNutritionPlanForm({ submitPath, method = "POST", initialPlan, onCreated, onCancel }) {
  const [name, setName] = useState(initialPlan?.name ?? "");
  const [description, setDescription] = useState(initialPlan?.description ?? "");
  const [meals, setMeals] = useState(initialPlan ? planToFormMeals(initialPlan) : [emptyMeal()]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateMealName(mealIndex, value) {
    setMeals((prev) => prev.map((meal, i) => (i === mealIndex ? { ...meal, name: value } : meal)));
  }

  function addMeal() {
    setMeals((prev) => [...prev, emptyMeal()]);
  }

  function removeMeal(mealIndex) {
    setMeals((prev) => prev.filter((_, i) => i !== mealIndex));
  }

  function addOption(mealIndex) {
    setMeals((prev) =>
      prev.map((meal, i) => (i === mealIndex ? { ...meal, options: [...meal.options, emptyOption()] } : meal))
    );
  }

  function removeOption(mealIndex, optIndex) {
    setMeals((prev) =>
      prev.map((meal, i) =>
        i !== mealIndex ? meal : { ...meal, options: meal.options.filter((_, j) => j !== optIndex) }
      )
    );
  }

  function updateItem(mealIndex, optIndex, itemIndex, field, value) {
    setMeals((prev) =>
      prev.map((meal, i) =>
        i !== mealIndex
          ? meal
          : {
              ...meal,
              options: meal.options.map((option, j) =>
                j !== optIndex
                  ? option
                  : {
                      ...option,
                      items: option.items.map((item, k) =>
                        k === itemIndex ? { ...item, [field]: value } : item
                      ),
                    }
              ),
            }
      )
    );
  }

  function addItem(mealIndex, optIndex) {
    setMeals((prev) =>
      prev.map((meal, i) =>
        i !== mealIndex
          ? meal
          : {
              ...meal,
              options: meal.options.map((option, j) =>
                j !== optIndex ? option : { ...option, items: [...option.items, emptyItem()] }
              ),
            }
      )
    );
  }

  function removeItem(mealIndex, optIndex, itemIndex) {
    setMeals((prev) =>
      prev.map((meal, i) =>
        i !== mealIndex
          ? meal
          : {
              ...meal,
              options: meal.options.map((option, j) =>
                j !== optIndex ? option : { ...option, items: option.items.filter((_, k) => k !== itemIndex) }
              ),
            }
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
          meals: meals.map((meal) => ({
            name: meal.name,
            options: meal.options.map((option) => ({
              items: option.items
                .filter((item) => item.food_name.trim())
                .map((item) => ({ food_name: item.food_name.trim(), quantity: item.quantity.trim() || null })),
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
      <h3>{initialPlan ? "Editar plano de nutrição" : "Novo plano de nutrição"}</h3>
      <form onSubmit={handleSubmit}>
        <div style={{ marginTop: 14 }}>
          <label className="field-label" htmlFor="nutrition-name">
            Nome do plano
          </label>
          <input
            id="nutrition-name"
            type="text"
            className="glass-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Plano de manutenção"
            required
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <label className="field-label" htmlFor="nutrition-description">
            Descrição (opcional)
          </label>
          <input
            id="nutrition-description"
            type="text"
            className="glass-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {meals.map((meal, mealIndex) => (
          <div className="plan-day-block" key={mealIndex}>
            <div className="plan-day-header">
              <input
                type="text"
                className="glass-input"
                value={meal.name}
                onChange={(e) => updateMealName(mealIndex, e.target.value)}
                placeholder="Ex: Pequeno-almoço"
                required
              />
              <button
                type="button"
                className="glass-button glass-button-secondary"
                onClick={() => removeMeal(mealIndex)}
                disabled={meals.length === 1}
              >
                Remover refeição
              </button>
            </div>

            {meal.options.map((option, optIndex) => (
              <div className="meal-option-block" key={optIndex}>
                <div className="meal-option-block-header">
                  <span className="field-label" style={{ margin: 0 }}>
                    Opção {optIndex + 1}
                  </span>
                  <button
                    type="button"
                    className="glass-button glass-button-secondary"
                    onClick={() => removeOption(mealIndex, optIndex)}
                    disabled={meal.options.length === 1}
                  >
                    Remover opção
                  </button>
                </div>

                <div className="meal-item-row-header">
                  <span>Elemento</span>
                  <span>Quantidade</span>
                  <span></span>
                </div>
                {option.items.map((item, itemIndex) => (
                  <div className="meal-item-row" key={itemIndex}>
                    <input
                      type="text"
                      className="glass-input"
                      value={item.food_name}
                      onChange={(e) => updateItem(mealIndex, optIndex, itemIndex, "food_name", e.target.value)}
                      placeholder="Ex: Ovos"
                      required
                    />
                    <input
                      type="text"
                      className="glass-input"
                      value={item.quantity}
                      onChange={(e) => updateItem(mealIndex, optIndex, itemIndex, "quantity", e.target.value)}
                      placeholder="Ex: 2 unidades"
                    />
                    <button
                      type="button"
                      className="glass-button glass-button-secondary"
                      onClick={() => removeItem(mealIndex, optIndex, itemIndex)}
                      disabled={option.items.length === 1}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="glass-button glass-button-secondary"
                  onClick={() => addItem(mealIndex, optIndex)}
                >
                  + Adicionar elemento
                </button>
              </div>
            ))}

            <button
              type="button"
              className="glass-button glass-button-secondary"
              onClick={() => addOption(mealIndex)}
              style={{ marginTop: 10 }}
            >
              + Adicionar opção
            </button>
          </div>
        ))}

        <button type="button" className="glass-button glass-button-secondary" onClick={addMeal} style={{ marginTop: 14 }}>
          + Adicionar refeição
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
