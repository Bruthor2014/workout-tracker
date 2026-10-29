import { useState } from "react";
import { useNavigate } from "react-router-dom";
import GlassCard from "./GlassCard";
import EditPlanInfoForm from "./EditPlanInfoForm";
import PlanDayEditor from "./PlanDayEditor";
import {
  IconChevronRight,
  IconDumbbell,
  IconPencil,
  IconPlay,
  IconPlusCircle,
  IconPrinter,
  IconSave,
  IconShare,
  IconTrash,
} from "./Icons";
import SharePlanModal from "./SharePlanModal";
import { apiRequest, resolveAssetUrl } from "../api/client";
import { muscleGroupVisual, visualForMuscleGroups } from "../utils/muscleGroups";
import { formatReps } from "../utils/reps";
import { setTypeInfo } from "../utils/setTypes";
import PlanCreator from "./PlanCreator";
import { INVALID_REPS_MESSAGE, dayHasInvalidReps, dayToForm, emptyDay, formDayToApi } from "../utils/planDayForm";

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

// Edição de um só dia, no próprio lugar do dia no cartão (PUT
// /plans/:id/days/:dayId) — ou, com `isNew`, criação de um dia a mais
// ("Criar rotina", POST /plans/:id/days) sem mexer nos outros nem reescrever
// o plano inteiro. `day` vem vazio (emptyDay()) quando `isNew`.
function DayEditForm({ plan, day, isNew, exercises, records, onCancel, onSaved, onExerciseCreated, onExerciseDeleted }) {
  const [draft, setDraft] = useState(() => (isNew ? day : dayToForm(day)));
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
      if (isNew) {
        await apiRequest(`/plans/${plan.id}/days`, { method: "POST", body: formDayToApi(draft) });
      } else {
        await apiRequest(`/plans/${plan.id}/days/${day.id}`, { method: "PUT", body: formDayToApi(draft) });
      }
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
          {saving ? "A guardar..." : isNew ? "Criar rotina" : "Guardar dia"}
        </button>
      </div>
    </form>
  );
}

// `editable` + `onChanged` são opcionais: quando omitidos o cartão fica só
// de leitura. `exercises` só é preciso quando `editable` (alimenta o
// seletor dos formulários de edição). "Editar" só mexe no nome/descrição/
// foto do plano (EditPlanInfoForm) — nunca nos dias, esses criam-se
// ("Criar rotina") e editam-se ("Editar dia") um a um. `canStart` mostra
// "Iniciar treino" em cada dia — só faz sentido nos planos do próprio
// utilizador (o treino fica registado em nome de quem o inicia).
// `onCollapse` (opcional): mostra um botão para fechar os detalhes e
// voltar à linha fechada (PlanRow.jsx) — sem isto o cartão não tem como se
// fechar (mesmo padrão de NutritionPlanCard.jsx).
export default function PlanCard({ plan, exercises, records, editable: editableProp, canStart, onChanged, onCollapse, onExerciseCreated, onExerciseDeleted }) {
  const navigate = useNavigate();
  // Só quem criou o plano o pode alterar (o backend também o garante).
  const editable = editableProp && plan.can_edit;
  const [editing, setEditing] = useState(false);
  // Cada dia começa fechado — só mostra nome + nº de exercícios até se
  // clicar; "Iniciar treino"/"Editar dia" só aparecem depois de abrir esse
  // dia (pedido explícito: "abres o plano de segunda e aí sim dá para
  // iniciar"). Só um dia aberto de cada vez.
  const [openDayId, setOpenDayId] = useState(null);
  const [editingDayId, setEditingDayId] = useState(null);
  const [addingDay, setAddingDay] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);

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
      <EditPlanInfoForm
        plan={plan}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          onChanged?.();
        }}
      />
    );
  }

  const exerciseCount = plan.days.reduce((sum, day) => sum + day.exercises.length, 0);

  const photoUrl = resolveAssetUrl(plan.photo_url);

  return (
    <GlassCard className="nplan print-area">
      {onCollapse && (
        <div className="nplan-collapse-row">
          <button type="button" className="nplan-collapse-corner" onClick={onCollapse} aria-label="Fechar plano">
            <IconChevronRight size={18} />
          </button>
        </div>
      )}
      <div className="nplan-header">
        {photoUrl ? (
          <span className="nplan-icon plan-icon plan-cover-photo">
            <img src={photoUrl} alt="" />
          </span>
        ) : (
          <span className="nplan-icon plan-icon">
            <IconDumbbell size={24} />
          </span>
        )}
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
          {canStart && plan.is_personal && (
            <button type="button" className="nplan-action" onClick={() => setSharing(true)}>
              <IconShare size={16} />
              Partilhar
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

      <div className="nplan-meals plan-days-list">
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
          const dayOpen = day.id === openDayId;
          return (
            <section key={day.id} className="nplan-meal" style={{ "--meal-color": color }}>
              <button
                type="button"
                className="nplan-meal-header nplan-meal-header-toggle"
                onClick={() => setOpenDayId(dayOpen ? null : day.id)}
                aria-expanded={dayOpen}
              >
                <span className="nplan-meal-icon">
                  <DayIcon size={15} />
                </span>
                <span className="nplan-meal-header-text">
                  <h4>{day.name}</h4>
                  <span className="nplan-meal-count">
                    {day.exercises.length} {day.exercises.length === 1 ? "exercício" : "exercícios"}
                  </span>
                </span>
                <span className="nplan-meal-chevron" style={{ transform: dayOpen ? "rotate(-90deg)" : "rotate(90deg)" }}>
                  <IconChevronRight size={16} />
                </span>
              </button>
              {dayOpen && (
                <>
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
                </>
              )}
            </section>
          );
        })}

        {editable &&
          (addingDay ? (
            <section className="nplan-meal">
              <DayEditForm
                plan={plan}
                day={emptyDay()}
                isNew
                exercises={exercises}
                records={records}
                onCancel={() => setAddingDay(false)}
                onSaved={() => {
                  setAddingDay(false);
                  onChanged?.();
                }}
                onExerciseCreated={onExerciseCreated}
                onExerciseDeleted={onExerciseDeleted}
              />
            </section>
          ) : (
            <button type="button" className="nplan-meal-add" onClick={() => setAddingDay(true)}>
              <IconPlusCircle size={16} />
              Criar rotina
            </button>
          ))}
      </div>

      {sharing && (
        <SharePlanModal planType="workout" planId={plan.id} planName={plan.name} onClose={() => setSharing(false)} />
      )}
    </GlassCard>
  );
}
