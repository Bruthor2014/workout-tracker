// Estado de formulário de um dia de plano de treino (PlanDayEditor) e
// conversão de/para a API.
import { parseReps, repsToInput } from "./reps";

export const emptyExerciseRow = () => ({ exercise_id: "", target_sets: "", target_reps: "", target_load: "" });
export const emptyDay = () => ({ name: "", exercises: [emptyExerciseRow()] });

// Dia da API -> estado do formulário.
export function dayToForm(day) {
  return {
    name: day.name,
    exercises: day.exercises.map((ex) => ({
      exercise_id: String(ex.exercise_id),
      target_sets: ex.target_sets ?? "",
      target_reps: repsToInput(ex.target_reps, ex.target_reps_max),
      target_load: ex.target_load != null ? String(Number(ex.target_load)) : "",
    })),
  };
}

// true se algum exercício escolhido tiver reps num formato inválido (as reps
// são "10" ou um intervalo "8-12").
export function dayHasInvalidReps(day) {
  return day.exercises.some((row) => row.exercise_id && parseReps(row.target_reps) === undefined);
}

export const INVALID_REPS_MESSAGE = "Reps inválidas: usa um número (ex: 10) ou um intervalo (ex: 8-12).";

// Estado do formulário -> corpo para a API (ignora linhas sem exercício).
export function formDayToApi(day) {
  return {
    name: day.name,
    exercises: day.exercises
      .filter((row) => row.exercise_id)
      .map((row) => {
        const reps = parseReps(row.target_reps);
        return {
          exercise_id: Number(row.exercise_id),
          target_sets: row.target_sets ? Number(row.target_sets) : null,
          target_reps: reps ? reps.min : null,
          target_reps_max: reps ? reps.max : null,
          target_load: row.target_load ? Number(row.target_load) : null,
        };
      }),
  };
}
