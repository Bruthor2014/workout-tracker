import ExercisePicker from "./ExercisePicker";
import Select from "./Select";
import { IconPencil, IconPlusCircle, IconTrash, IconTrophy } from "./Icons";
import { CARDIO_GROUP, visualForMuscleGroups } from "../utils/muscleGroups";
import { parseReps } from "../utils/reps";
import { emptyExerciseRow, emptySetTarget } from "../utils/planDayForm";
import { TECHNIQUE_OPTIONS, setTypeInfo } from "../utils/setTypes";

// Um dia de um plano de treino (nome + exercícios com séries/reps/carga).
// Usado tanto no formulário do plano inteiro como ao editar só um dia a
// partir do cartão do plano. Componente controlado: `onChange(day)` recebe
// o dia já alterado. `onRemove` é opcional (sem ele não aparece o botão de
// remover o dia). `records` (opcional): Map exercise_id -> recorde (ver
// GET /sessions/records), para mostrar o máximo já levantado junto de cada
// exercício, tal como no registo de treino.
export default function PlanDayEditor({ day, exercises, records, onChange, onRemove, canRemove = true, onExerciseCreated, onExerciseDeleted }) {
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

  function updateSet(exIndex, setIndex, field, value) {
    setRows(
      day.exercises.map((row, j) =>
        j === exIndex
          ? { ...row, sets: row.sets.map((set, k) => (k === setIndex ? { ...set, [field]: value } : set)) }
          : row
      )
    );
  }

  function addSet(exIndex) {
    setRows(day.exercises.map((row, j) => (j === exIndex ? { ...row, sets: [...row.sets, emptySetTarget()] } : row)));
  }

  function removeSet(exIndex, setIndex) {
    setRows(
      day.exercises.map((row, j) =>
        j === exIndex ? { ...row, sets: row.sets.filter((_, k) => k !== setIndex) } : row
      )
    );
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
        {day.exercises.map((row, exIndex) => {
          // Cardio: reps = minutos, carga = km; e não faz sentido ter
          // "técnica" (drop set, etc.) num bloco de tempo/distância.
          const isCardio = muscleGroupById.get(row.exercise_id) === CARDIO_GROUP;
          const type = isCardio ? setTypeInfo("normal") : setTypeInfo(row.set_type);
          const record = row.exercise_id ? records?.get(String(row.exercise_id)) : null;
          return (
            <div
              className={`log-exercise${type.color ? " typed" : ""}`}
              style={type.color ? { "--type-color": type.color } : undefined}
              key={exIndex}
            >
              <div className="log-exercise-header">
                <span className="log-set-number">{exIndex + 1}</span>
                <ExercisePicker
                  exercises={exercises}
                  value={row.exercise_id}
                  onChange={(exerciseId) => updateRow(exIndex, "exercise_id", exerciseId)}
                  onExerciseCreated={onExerciseCreated}
                  onExerciseDeleted={onExerciseDeleted}
                />
                <button
                  type="button"
                  className="nf-icon-danger"
                  onClick={() => setRows(day.exercises.filter((_, j) => j !== exIndex))}
                  disabled={day.exercises.length === 1}
                  aria-label="Remover exercício"
                >
                  <IconTrash size={17} />
                </button>
              </div>

              {!isCardio && (
                <div className="log-exercise-meta">
                  <Select
                    value={row.set_type || "normal"}
                    onChange={(set_type) => updateRow(exIndex, "set_type", set_type)}
                    options={TECHNIQUE_OPTIONS}
                    ariaLabel="Técnica do exercício"
                    className="log-type-select-inline"
                  />
                  {row.exercise_id && (
                    <span className={`log-record${record ? "" : " empty"}`}>
                      <IconTrophy size={16} />
                      {record ? (
                        <>
                          Máximo: <strong>{record.weight.toLocaleString("pt-PT")} kg</strong> × {record.reps}
                        </>
                      ) : (
                        "Ainda sem registo de peso neste exercício"
                      )}
                    </span>
                  )}
                </div>
              )}

              <div className="plan-exercise-sets">
                <div className="plan-exercise-sets-head">
                  <span>Série</span>
                  <span>{isCardio ? "Minutos" : "Reps"}</span>
                  <span>{isCardio ? "Km" : "Carga (kg)"}</span>
                  <span />
                </div>
                {row.sets.map((set, setIndex) => (
                  <div className="plan-exercise-set" key={setIndex}>
                    <span className="log-exercise-set-number">{setIndex + 1}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      className={`glass-input${parseReps(set.target_reps) === undefined ? " input-invalid" : ""}`}
                      value={set.target_reps}
                      onChange={(e) => updateSet(exIndex, setIndex, "target_reps", e.target.value)}
                      placeholder={isCardio ? "Minutos" : "Ex: 8-12"}
                      aria-label={`${isCardio ? "Minutos" : "Reps"} — série ${setIndex + 1}`}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      className="glass-input"
                      value={set.target_load}
                      onChange={(e) => updateSet(exIndex, setIndex, "target_load", e.target.value)}
                      placeholder={isCardio ? "Km" : "Carga"}
                      aria-label={`${isCardio ? "Km" : "Carga"} — série ${setIndex + 1}`}
                    />
                    <button
                      type="button"
                      className="log-exercise-set-remove"
                      onClick={() => removeSet(exIndex, setIndex)}
                      disabled={row.sets.length === 1}
                      aria-label={`Remover série ${setIndex + 1}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button type="button" className="log-add-set-inline" onClick={() => addSet(exIndex)}>
                  <IconPlusCircle size={16} />
                  Adicionar série
                </button>
              </div>
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
