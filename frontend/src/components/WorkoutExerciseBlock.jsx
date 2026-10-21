import ExercisePicker from "./ExercisePicker";
import Select from "./Select";
import { IconCheck, IconPlusCircle, IconTrash, IconTrophy } from "./Icons";
import { TECHNIQUE_OPTIONS, setTypeInfo } from "../utils/setTypes";
import { CARDIO_GROUP } from "../utils/muscleGroups";

const MONTH_LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatDate(dateKey) {
  const d = new Date(`${dateKey}T00:00:00`);
  return `${d.getDate()} ${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
}

// Um exercício no registo de treino: seletor, técnica (normal, drop set,
// rest-pause, ... — ver utils/setTypes.js), recorde pessoal e as séries.
// Cada série pode ser marcada como feita (✓): fica bloqueada até se tirar o
// ✓. Componente controlado — `onChange(ex)` recebe o exercício já alterado;
// marcar/desmarcar uma série passa por `onToggleDone(setIndex)` (a página
// verifica se bateu o recorde). `nextExerciseName` é usado no super-set
// (alterna com o exercício seguinte).
export default function WorkoutExerciseBlock({
  ex,
  index,
  exercises,
  record,
  nextExerciseName,
  canRemove,
  onChange,
  onRemove,
  onToggleDone,
  onExerciseCreated,
  onExerciseDeleted,
}) {
  const isCardio = exercises.find((e) => String(e.id) === ex.exercise_id)?.muscle_group === CARDIO_GROUP;
  // Cardio: sempre "normal", e cada linha é um bloco de tempo/distância.
  const type = isCardio ? { ...setTypeInfo("normal"), rowLabel: "Bloco" } : setTypeInfo(ex.type);
  const rowLabel = type.rowLabel.toLowerCase();
  const repsLabel = isCardio ? "Minutos" : "Reps";
  const weightLabel = isCardio ? "Distância (km)" : "Carga (kg)";

  function updateSet(setIndex, field, value) {
    onChange({ ...ex, sets: ex.sets.map((set, j) => (j === setIndex ? { ...set, [field]: value } : set)) });
  }

  // Nova linha com os valores da anterior (o mais comum é repetir), ainda
  // por fazer.
  function addSet() {
    const last = ex.sets[ex.sets.length - 1];
    onChange({ ...ex, sets: [...ex.sets, { ...last, done: false }] });
  }

  function removeSet(setIndex) {
    onChange({ ...ex, sets: ex.sets.filter((_, j) => j !== setIndex) });
  }

  return (
    <div
      className={`log-exercise${type.color ? " typed" : ""}`}
      style={type.color ? { "--type-color": type.color } : undefined}
    >
      <div className="log-exercise-header">
        <span className="log-set-number">{index + 1}</span>
        <ExercisePicker
          exercises={exercises}
          value={ex.exercise_id}
          onChange={(exerciseId) => onChange({ ...ex, exercise_id: exerciseId })}
          onExerciseCreated={onExerciseCreated}
          onExerciseDeleted={onExerciseDeleted}
        />
        <button
          type="button"
          className="log-set-delete"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label="Remover exercício"
        >
          <IconTrash size={18} />
        </button>
      </div>

      {!isCardio && (
        <div className="log-exercise-meta">
          <div className="log-type-select">
            <span>Técnica</span>
            <Select
              value={ex.type}
              onChange={(type) => onChange({ ...ex, type })}
              options={TECHNIQUE_OPTIONS}
              ariaLabel="Técnica do exercício"
            />
          </div>
          {ex.exercise_id && (
            <span className={`log-record${record ? "" : " empty"}`}>
              <IconTrophy size={16} />
              {record ? (
                <>
                  Máximo: <strong>{record.weight.toLocaleString("pt-PT")} kg</strong> × {record.reps}
                  <span className="log-record-date">· {formatDate(record.performed_at)}</span>
                </>
              ) : (
                "Ainda sem registo de peso neste exercício"
              )}
            </span>
          )}
        </div>
      )}

      {isCardio && <p className="log-type-hint">Cardio: regista o tempo em minutos e, se quiseres, a distância em km.</p>}

      {type.hint && (
        <p className="log-type-hint">
          {type.hint}
          {ex.type === "superset" && (
            <strong> {nextExerciseName ? `Em par com: ${nextExerciseName}.` : "Adiciona o exercício seguinte para formar o par."}</strong>
          )}
        </p>
      )}

      <div className="log-exercise-sets">
        <div className="log-exercise-sets-head">
          <span>{type.rowLabel}</span>
          <span>{repsLabel}</span>
          <span>{weightLabel}</span>
          <span />
          <span />
        </div>
        {ex.sets.map((set, setIndex) => {
          const canComplete = Boolean(ex.exercise_id && set.reps);
          return (
            <div className={`log-exercise-set${set.done ? " done" : ""}`} key={setIndex}>
              <span className="log-exercise-set-number">
                {type.rowPrefix}
                {setIndex + 1}
              </span>
              <input
                type="number"
                min="1"
                className="glass-input"
                value={set.reps}
                onChange={(e) => updateSet(setIndex, "reps", e.target.value)}
                placeholder={set.repsHint ? `Alvo: ${set.repsHint}` : isCardio ? "Minutos" : type.repsPlaceholder}
                aria-label={`${isCardio ? "Minutos" : "Repetições"} — ${rowLabel} ${setIndex + 1}`}
                disabled={set.done}
              />
              <input
                type="number"
                min="0"
                step="0.5"
                className="glass-input"
                value={set.weight}
                onChange={(e) => updateSet(setIndex, "weight", e.target.value)}
                placeholder={set.weightHint ? `Alvo: ${set.weightHint} kg` : weightLabel}
                aria-label={`${isCardio ? "Distância em km" : "Carga em kg"} — ${rowLabel} ${setIndex + 1}`}
                disabled={set.done}
              />
              <button
                type="button"
                className={`log-set-check${set.done ? " checked" : ""}`}
                onClick={() => onToggleDone(setIndex)}
                disabled={!set.done && !canComplete}
                aria-label={`${set.done ? "Desmarcar" : "Marcar como feita"} — ${rowLabel} ${setIndex + 1}`}
                aria-pressed={Boolean(set.done)}
              >
                <IconCheck size={16} />
              </button>
              <button
                type="button"
                className="log-exercise-set-remove"
                onClick={() => removeSet(setIndex)}
                disabled={ex.sets.length === 1 || set.done}
                aria-label={`Remover ${rowLabel} ${setIndex + 1}`}
              >
                ×
              </button>
            </div>
          );
        })}
        <button type="button" className="log-add-set-inline" onClick={addSet}>
          <IconPlusCircle size={16} />
          Adicionar {rowLabel}
        </button>
      </div>
    </div>
  );
}
