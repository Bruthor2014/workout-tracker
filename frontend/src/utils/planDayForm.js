// Estado de formulário de um dia de plano de treino (PlanDayEditor) e
// conversão de/para a API.
import { parseReps, repsToInput } from "./reps";

export const emptySetTarget = () => ({ target_reps: "", target_load: "" });
export const emptyExerciseRow = () => ({ exercise_id: "", set_type: "normal", sets: [emptySetTarget()] });
export const emptyDay = () => ({ name: "", exercises: [emptyExerciseRow()] });

// Dia da API -> estado do formulário.
export function dayToForm(day) {
  return {
    name: day.name,
    exercises: day.exercises.map((ex) => ({
      exercise_id: String(ex.exercise_id),
      set_type: ex.set_type || "normal",
      sets: ex.sets.length
        ? ex.sets.map((set) => ({
            target_reps: repsToInput(set.target_reps, set.target_reps_max),
            target_load: set.target_load != null ? String(Number(set.target_load)) : "",
          }))
        : [emptySetTarget()],
    })),
  };
}

// true se algum exercício escolhido tiver, nalguma série, reps num formato
// inválido (as reps são "10" ou um intervalo "8-12").
export function dayHasInvalidReps(day) {
  return day.exercises.some(
    (row) => row.exercise_id && row.sets.some((set) => parseReps(set.target_reps) === undefined)
  );
}

export const INVALID_REPS_MESSAGE = "Reps inválidas: usa um número (ex: 10) ou um intervalo (ex: 8-12).";

// Estado do formulário -> corpo para a API (ignora linhas sem exercício).
export function formDayToApi(day) {
  return {
    name: day.name,
    exercises: day.exercises
      .filter((row) => row.exercise_id)
      .map((row) => ({
        exercise_id: Number(row.exercise_id),
        set_type: row.set_type || "normal",
        sets: row.sets.map((set) => {
          const reps = parseReps(set.target_reps);
          return {
            target_reps: reps ? reps.min : null,
            target_reps_max: reps ? reps.max : null,
            target_load: set.target_load ? Number(set.target_load) : null,
          };
        }),
      })),
  };
}
