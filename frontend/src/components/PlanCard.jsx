import { useState } from "react";
import { useNavigate } from "react-router-dom";
import GlassCard from "./GlassCard";
import NewPlanForm from "./NewPlanForm";
import PlanDayEditor from "./PlanDayEditor";
import { IconDumbbell, IconPencil, IconPlay, IconPrinter, IconSave, IconTrash } from "./Icons";
import { apiRequest } from "../api/client";
import { muscleGroupVisual, visualForMuscleGroups } from "../utils/muscleGroups";
import { formatReps } from "../utils/reps";
import { setTypeInfo } from "../utils/setTypes";
import PlanCreator from "./PlanCreator";
import { INVALID_REPS_MESSAGE, dayHasInvalidReps, dayToForm, formDayToApi } from "../utils/planDayForm";

// "4 × 8–12" / "4 séries" / "8–12 reps" quando todas as séries têm o mesmo
// alvo (o mais comum); senão lista cada série ("12×40kg · 10×50kg · 8×60kg"
// — ex: pirâmide), já que aí não há um valor único que as resuma.
function formatTarget(sets) {
  if (!sets || sets.length === 0) return { badge: null, load: null };

  const repsList = sets.map((s) => formatReps(s.target_reps, s.target_reps_max));
  const loadList = sets.map((s) => (s.target_load != null ? Number(s.target_load) : null));
  const uniform = repsList.every((r) => r === repsList[0]) && loadList.every((l) => l === loadList[0]);

  if (uniform) {
    const reps = repsList[0];
    if (reps) return { badge: `${sets.length} × ${reps}`, load: loadList[0] };
    if (sets.length > 1 || loadList[0] != null) return { badge: `${sets.length} séries`, load: loadList[0] };
    return { badge: null, load: null };
  }

  const perSet = sets.map((_, i) => {
    const r = repsList[i];
    const l = loadList[i];
    if (r && l != null) return `${r}×${l}kg`;
    if (r) return r;
    if (l != null) return `${l}kg`;
    return `série ${i + 1}`;
  });
  return { badge: perSet.join(" · "), load: null };
}

function PlanExercise({ ex }) {
  const { icon: Icon, color } = muscleGroupVisual(ex.muscle_group);
  const target = formatTarget(ex.sets);
  const type = setTypeInfo(ex.set_type);
  return (
    <li className="nplan-food">
      <span className="nplan-food-image plan-exercise-image" style={{ color }}>
        {/* As fotos dos exercícios vivem no frontend (public/exercises/), não
            no backend — por isso o caminho é usado tal como vem. */}
        {ex.image_url ? <img src={ex.image_url} alt="" loading="lazy" /> : <Icon size={22} />}
      </span>
      <span className="nplan-food-text">
        <span className="nplan-food-name">
          {ex.exercise_name}
          {type.color && (
            <span className="plan-exercise-type-badge" style={{ "--type-color": type.color }}>
              {type.label}
            </span>
          )}
        </span>
        {ex.muscle_group && <span className="nplan-food-meta">{ex.muscle_group}</span>}
      </span>
      <span className="plan-exercise-targets">
        {target.badge && <span className="nplan-food-quantity">{target.badge}</span>}
        {target.load != null && <span className="plan-exercise-load">{target.load} kg</span>}
      </span>
    </li>
  );
}

// Edição de um só dia, no próprio lugar do dia no cartão — guarda só esse
// dia (PUT /plans/:id/days/:dayId), sem mexer nos outros.
function DayEditForm({ plan, day, exercises, records, onCancel, onSaved, onExerciseCreated, onExerciseDeleted }) {
  const [draft, setDraft] = useState(() => dayToForm(day));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (dayHasInvalidReps(draft)) {
      setError(INVALID_REPS_MESSAGE);
      return;
    }
    setSaving(true);
    try {
      await apiRequest(`/plans/${plan.id}/days/${day.id}`, { method: "PUT", body: formDayToApi(draft) });
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form className="plan-form nplan-day-edit" onSubmit={handleSubmit}>
      <PlanDayEditor
        day={draft}
        exercises={exercises}
        records={records}
        onChange={setDraft}
        onExerciseCreated={onExerciseCreated}
        onExerciseDeleted={onExerciseDeleted}
      />
      {error && <p className="error-text">{error}</p>}
      <div className="log-actions">
        <button type="button" className="glass-button glass-button-secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="glass-button log-save-button" disabled={saving}>
          <IconSave size={18} />
          {saving ? "A guardar..." : "Guardar dia"}
        </button>
      </div>
    </form>
  );
}

// `editable` + `onChanged` são opcionais: quando omitidos o cartão fica só
// de leitura. `exercises` só é preciso quando `editable` (alimenta o
// seletor dos formulários de edição). "Editar" (plano inteiro) abre o
// formulário completo no lugar do cartão; "Editar dia" só esse dia.
// `canStart` mostra "Iniciar treino" em cada dia — só faz sentido nos
// planos do próprio utilizador (o treino fica registado em nome de quem o
// inicia).
export default function PlanCard({ plan, exercises, records, editable: editableProp, canStart, onChanged, onExerciseCreated, onExerciseDeleted }) {
  const navigate = useNavigate();
  // Só quem criou o plano o pode alterar (o backend também o garante).
  const editable = editableProp && plan.can_edit;
  const [editing, setEditing] = useState(false);
  const [editingDayId, setEditingDayId] = useState(null);
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

  if (editing) {
    return (
      <NewPlanForm
        exercises={exercises}
        records={records}
        submitPath={`/plans/${plan.id}`}
        method="PUT"
        initialPlan={plan}
        onCancel={() => setEditing(false)}
        onCreated={() => {
          setEditing(false);
          onChanged?.();
        }}
        onExerciseCreated={onExerciseCreated}
        onExerciseDeleted={onExerciseDeleted}
      />
    );
  }

  const exerciseCount = plan.days.reduce((sum, day) => sum + day.exercises.length, 0);

  return (
    <GlassCard className="nplan print-area">
      <div className="nplan-header">
        <span className="nplan-icon plan-icon">
          <IconDumbbell size={24} />
        </span>
        <div className="nplan-title">
          <h3>{plan.name}</h3>
          {plan.description && <p>{plan.description}</p>}
          <PlanCreator plan={plan} />
          <div className="nplan-stats">
            <span>
              {plan.days.length} {plan.days.length === 1 ? "dia" : "dias"}
            </span>
            <span>
              {exerciseCount} {exerciseCount === 1 ? "exercício" : "exercícios"}
            </span>
          </div>
        </div>
        <div className="nplan-actions">
          <button type="button" className="nplan-action" onClick={() => window.print()}>
            <IconPrinter size={16} />
            Imprimir
          </button>
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
        {plan.days.map((day) => {
          if (day.id === editingDayId) {
            return (
              <DayEditForm
                key={day.id}
                plan={plan}
                day={day}
                exercises={exercises}
                records={records}
                onCancel={() => setEditingDayId(null)}
                onSaved={() => {
                  setEditingDayId(null);
                  onChanged?.();
                }}
                onExerciseCreated={onExerciseCreated}
                onExerciseDeleted={onExerciseDeleted}
              />
            );
          }
          const { icon: DayIcon, color } = visualForMuscleGroups(day.exercises.map((ex) => ex.muscle_group));
          return (
            <section key={day.id} className="nplan-meal" style={{ "--meal-color": color }}>
              <div className="nplan-meal-header">
                <span className="nplan-meal-icon">
                  <DayIcon size={22} />
                </span>
                <h4>{day.name}</h4>
                <span className="nplan-meal-count">
                  {day.exercises.length} {day.exercises.length === 1 ? "exercício" : "exercícios"}
                </span>
              </div>
              <ul className="nplan-foods">
                {day.exercises.map((ex) => (
                  <PlanExercise key={ex.id} ex={ex} />
                ))}
              </ul>
              {(canStart || editable) && (
                <div className="nplan-day-actions">
                  {canStart && (
                    <button
                      type="button"
                      className="nplan-start"
                      onClick={() => navigate(`/log?plan=${plan.id}&day=${day.id}`)}
                    >
                      <IconPlay size={14} />
                      Iniciar treino
                    </button>
                  )}
                  {editable && (
                    <button type="button" className="nplan-action" onClick={() => setEditingDayId(day.id)}>
                      <IconPencil size={14} />
                      Editar dia
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
