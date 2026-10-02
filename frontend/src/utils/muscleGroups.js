import {
  IconMuscleChest,
  IconMuscleBack,
  IconMuscleLegs,
  IconMuscleShoulders,
  IconMuscleArm,
  IconMuscleCore,
  IconMuscleGlutes,
  IconDumbbell,
} from "../components/Icons";

// Pictograma + cor por grupo muscular — usado em todo o lado onde se
// escolhe/mostra um exercício (picker, cartões de plano). Grupos que não
// estejam aqui caem no ícone/cor genéricos (`default`).
const MUSCLE_GROUP_VISUALS = {
  Peito: { icon: IconMuscleChest, color: "#f87171" },
  Costas: { icon: IconMuscleBack, color: "#60a5fa" },
  Pernas: { icon: IconMuscleLegs, color: "#34d399" },
  Ombros: { icon: IconMuscleShoulders, color: "#fbbf24" },
  Bíceps: { icon: IconMuscleArm, color: "#a78bfa" },
  Tríceps: { icon: IconMuscleArm, color: "#c084fc" },
  Abdominais: { icon: IconMuscleCore, color: "#fb923c" },
  Glúteos: { icon: IconMuscleGlutes, color: "#f472b6" },
};

const DEFAULT_VISUAL = { icon: IconDumbbell, color: "#a78bfa" };

export function muscleGroupVisual(muscleGroup) {
  return MUSCLE_GROUP_VISUALS[muscleGroup] || DEFAULT_VISUAL;
}

export const KNOWN_MUSCLE_GROUPS = Object.keys(MUSCLE_GROUP_VISUALS);
