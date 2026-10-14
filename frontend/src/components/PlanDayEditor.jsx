import ExercisePicker from "./ExercisePicker";
import { IconPencil, IconPlusCircle, IconTrash } from "./Icons";
import { CARDIO_GROUP, visualForMuscleGroups } from "../utils/muscleGroups";
import { parseReps } from "../utils/reps";
import { emptyExerciseRow } from "../utils/planDayForm";

// Um dia de um plano de treino (nome + exercícios com séries/reps/carga).
// Usado tanto no formulário do plano inteiro como ao editar só um dia a
// partir do cartão do plano. Componente controlado: `onChange(day)` recebe
// o dia já alterado. `onRemove` é opcional (sem ele não aparece o botão de
// remover o dia).
export default function PlanDayEditor({ day, exercises, onChange, onRemove, canRemove = true }) {
  const muscleGroupById = new Map(exercises.map((ex) => [String(ex.id), ex.muscle_group]));
  // Ícone/cor do dia pela região do corpo dos exercícios escolhidos (pernas,
  // costas, peito...), como no histórico de treinos.
  const { icon: DayIcon, color } = visualForMuscleGroups(day.exercises.map((row) => muscleGroupById.get(row.exercise_id)));

  function setRows(rows) {
    onChange({ ...day, exercises: rows });
  }

  function updateRow(exIndex, field, value) {
    setRows(day.exercises.map((row, j) => (j === exIndex ? { ...row, [field]: value } : row)));
  }

  return (
    <div className="nf-meal" style={{ "--meal-color": color }}>
      <div className="nf-meal-header">
        <span className="nf-meal-icon">
          <DayIcon size={24} />
        </span>
        <div className="nf-meal-name">
          <input
            type="text"
            className="glass-input"
            value={day.name}
            onChange={(e) => onChange({ ...day, name: e.target.value })}
            placeholder="Ex: Segunda - Costas e Bíceps"
            aria-label="Nome do dia"
            required
          />
          <IconPencil size={16} />
        </div>
        {onRemove && (
          <button type="button" className="nf-text-danger" onClick={onRemove} disabled={!canRemove}>
            <IconTrash size={17} />
            Remover dia
          </button>
        )}
      </div>

      <div className="plan-form-exercises">
        <div className="plan-form-head">
          <span>#</span>
          <span>Exercício</span>
          <span>Séries</span>
          <span>Reps</span>
          <span>Carga (kg)</span>
          <span />
        </div>
        {day.exercises.map((row, exIndex) => {
          // Cardio: reps = minutos, carga = km.
          const isCardio = muscleGroupById.get(row.exercise_id) === CARDIO_GROUP;
          return (
            <div className="plan-form-row" key={exIndex}>
              <span className="log-set-number">{exIndex + 1}</span>
              <ExercisePicker
                exercises={exercises}
                value={row.exercise_id}
                onChange={(exerciseId) => updateRow(exIndex, "exercise_id", exerciseId)}
              />
              <input
                type="number"
                min="1"
                className="glass-input"
                value={row.target_sets}
                onChange={(e) => updateRow(exIndex, "target_sets", e.target.value)}
                placeholder="Séries"
                aria-label="Séries"
              />
              <input
                type="text"
                inputMode="numeric"
                className={`glass-input${parseReps(row.target_reps) === undefined ? " input-invalid" : ""}`}
                value={row.target_reps}
                onChange={(e) => updateRow(exIndex, "target_reps", e.target.value)}
                placeholder={isCardio ? "Minutos" : "Ex: 8-12"}
                aria-label="Reps"
                title="Um número (ex: 10) ou um intervalo (ex: 8-12)"
              />
              <input
                type="number"
                min="0"
                step="0.5"
                className="glass-input"
                value={row.target_load}
                onChange={(e) => updateRow(exIndex, "target_load", e.target.value)}
                placeholder={isCardio ? "Km" : "Carga"}
                aria-label="Carga (kg)"
              />
              <button
                type="button"
                className="nf-icon-danger"
                onClick={() => setRows(day.exercises.filter((_, j) => j !== exIndex))}
                disabled={day.exercises.length === 1}
                title="Remover exercício"
                aria-label="Remover exercício"
              >
                <IconTrash size={17} />
              </button>
            </div>
          );
        })}
      </div>

      <button type="button" className="log-add-set" onClick={() => setRows([...day.exercises, emptyExerciseRow()])}>
        <IconPlusCircle size={18} />
        Adicionar exercício
      </button>
    </div>
  );
}
