import { useState } from "react";
import GlassCard from "./GlassCard";
import PlanDayEditor from "./PlanDayEditor";
import { IconCalendar, IconFileText, IconPlusCircle, IconSave } from "./Icons";
import { apiRequest } from "../api/client";
import { INVALID_REPS_MESSAGE, dayHasInvalidReps, dayToForm, emptyDay, formDayToApi } from "../utils/planDayForm";

// Formulário de criação/edição de plano, com dias (ex: "Segunda - Costas e
// Bíceps"), cada um com os seus próprios exercícios. Mesmo formato do
// formulário de nutrição (cartões "Detalhes do plano" + "Dias de treino").
// Cada dia é um PlanDayEditor (o mesmo usado para editar só um dia a partir
// do cartão do plano). Reutilizado em vários sítios:
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
  const [days, setDays] = useState(initialPlan ? initialPlan.days.map(dayToForm) : [emptyDay()]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateDay(dayIndex, day) {
    setDays((prev) => prev.map((d, i) => (i === dayIndex ? day : d)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (days.some(dayHasInvalidReps)) {
      setError(INVALID_REPS_MESSAGE);
      return;
    }

    setLoading(true);
    try {
      await apiRequest(submitPath, {
        method,
        body: { name, description, days: days.map(formDayToApi) },
      });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="nutrition-form plan-form" onSubmit={handleSubmit}>
      <GlassCard className="log-card">
        <div className="log-card-header">
          <IconFileText size={26} />
          <h2>{initialPlan ? "Editar plano" : "Detalhes do plano"}</h2>
        </div>
        <div className="nutrition-details-grid">
          <div>
            <label className="log-label" htmlFor="plan-name">
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
          <div>
            <label className="log-label" htmlFor="plan-description">
              Descrição <span>(opcional)</span>
            </label>
            <textarea
              id="plan-description"
              className="glass-input nutrition-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Objetivo, frequência, notas para o membro..."
              rows={2}
            />
          </div>
        </div>
      </GlassCard>

      <GlassCard className="log-card">
        <div className="log-card-header">
          <IconCalendar size={26} />
          <h2>Dias de treino</h2>
        </div>

        <div className="nutrition-meals">
          {days.map((day, dayIndex) => (
            <PlanDayEditor
              key={dayIndex}
              day={day}
              exercises={exercises}
              onChange={(updated) => updateDay(dayIndex, updated)}
              onRemove={() => setDays((prev) => prev.filter((_, i) => i !== dayIndex))}
              canRemove={days.length > 1}
            />
          ))}

          <button type="button" className="log-add-set" onClick={() => setDays((prev) => [...prev, emptyDay()])}>
            <IconPlusCircle size={18} />
            Adicionar dia
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
