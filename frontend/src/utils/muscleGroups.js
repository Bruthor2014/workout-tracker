import { IconDumbbell, IconRun } from "../components/Icons";
import {
  IconMuscleChest,
  IconMuscleBack,
  IconMuscleLegs,
  IconMuscleGlutes,
  IconMuscleShoulders,
  IconMuscleArm,
  IconMuscleCore,
  IconFullBody,
} from "../components/MuscleIcons";

// Figura + cor por grupo muscular — usado em todo o lado onde se
// escolhe/mostra um exercício ou treino (seletor, calendário semanal, linhas
// do histórico), para o mesmo grupo ter sempre a mesma cor. Grupos que não
// estejam aqui caem no ícone/cor genéricos (`default`).
const MUSCLE_GROUP_VISUALS = {
  Peito: { icon: IconMuscleChest, color: "#8b5cf6" },
  Costas: { icon: IconMuscleBack, color: "#10b981" },
  Pernas: { icon: IconMuscleLegs, color: "#3b82f6" },
  Glúteos: { icon: IconMuscleGlutes, color: "#ec4899" },
  Ombros: { icon: IconMuscleShoulders, color: "#f97316" },
  Bíceps: { icon: IconMuscleArm, color: "#f59e0b" },
  Tríceps: { icon: IconMuscleArm, color: "#f43f5e" },
  Abdominais: { icon: IconMuscleCore, color: "#06b6d4" },
  Cardio: { icon: IconRun, color: "#22c55e" },
};

// Cardio: as séries registam minutos (campo reps) e km (campo carga), não
// repetições e peso — ficam fora do volume e dos recordes.
export const CARDIO_GROUP = "Cardio";

// Lista fixa de grupos musculares — usada no formulário de criar exercício
// pessoal (ver ExercisePicker.jsx), para ficar consistente com os filtros e
// ícones já existentes em vez de aceitar texto livre.
export const MUSCLE_GROUP_NAMES = Object.keys(MUSCLE_GROUP_VISUALS);

const DEFAULT_VISUAL = { icon: IconDumbbell, color: "#8a8d91" };
const FULL_BODY_VISUAL = { icon: IconFullBody, color: "#d946ef" };

const LOWER_BODY = ["Pernas", "Glúteos"];
const UPPER_BODY = ["Peito", "Costas", "Ombros", "Bíceps", "Tríceps"];

export function muscleGroupVisual(muscleGroup) {
  return MUSCLE_GROUP_VISUALS[muscleGroup] || DEFAULT_VISUAL;
}

// Visual de um treino inteiro a partir de `muscle_groups` ("Peito • Ombros
// • Tríceps", ordenado pelo backend do grupo com mais séries para o com
// menos), escolhido pela REGIÃO do corpo trabalhada:
//   - superiores + pernas no mesmo treino -> corpo inteiro
//   - só pernas/glúteos -> pernas (core, se os abdominais dominarem)
//   - só superiores -> peito (empurrar) > costas (puxar) > ombros > braços
//   - só abdominais -> core
export function workoutVisual(muscleGroups) {
  const groups = (muscleGroups || "").split(" • ").filter(Boolean);
  if (groups.length === 0) return DEFAULT_VISUAL;

  const has = (g) => groups.includes(g);
  const hasLower = LOWER_BODY.some(has);
  const hasUpper = UPPER_BODY.some(has);

  if (hasLower && hasUpper) return FULL_BODY_VISUAL;

  if (hasLower) {
    if (groups[0] === "Abdominais") return MUSCLE_GROUP_VISUALS.Abdominais;
    return has("Pernas") ? MUSCLE_GROUP_VISUALS.Pernas : MUSCLE_GROUP_VISUALS.Glúteos;
  }

  if (hasUpper) {
    for (const g of ["Peito", "Costas", "Ombros", "Bíceps", "Tríceps"]) {
      if (has(g)) return MUSCLE_GROUP_VISUALS[g];
    }
  }

  return muscleGroupVisual(groups[0]);
}

// O mesmo que workoutVisual, mas a partir da lista de grupos musculares de
// cada exercício (com repetições, ex: um dia de plano) — ordena-os do mais
// frequente para o menos, como o backend faz com as séries de um treino.
export function visualForMuscleGroups(muscleGroups) {
  const counts = new Map();
  for (const group of muscleGroups.filter(Boolean)) counts.set(group, (counts.get(group) || 0) + 1);
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([group]) => group);
  return workoutVisual(ordered.join(" • "));
}
