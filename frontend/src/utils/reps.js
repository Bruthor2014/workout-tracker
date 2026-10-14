// Reps alvo dos planos: um número ("10") ou um intervalo ("8-12"). Na API
// são dois campos — target_reps (mínimo, ou o número) e target_reps_max
// (máximo, ou null).

// "8-12" -> { min: 8, max: 12 }; "10" -> { min: 10, max: null };
// "" -> null; formato inválido -> undefined.
export function parseReps(text) {
  const value = String(text ?? "").trim();
  if (!value) return null;
  const match = value.match(/^(\d+)\s*(?:[-–]\s*(\d+))?$/);
  if (!match) return undefined;
  const min = Number(match[1]);
  const max = match[2] ? Number(match[2]) : null;
  if (min < 1 || (max !== null && max < min)) return undefined;
  return { min, max: max === min ? null : max };
}

// Para mostrar: "8–12" ou "10" (string vazia se não houver).
export function formatReps(min, max) {
  if (min == null) return "";
  return max != null && max !== min ? `${min}–${max}` : String(min);
}

// Para editar num campo de texto: "8-12" ou "10".
export function repsToInput(min, max) {
  if (min == null) return "";
  return max != null && max !== min ? `${min}-${max}` : String(min);
}
