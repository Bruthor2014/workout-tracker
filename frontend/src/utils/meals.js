import { IconApple, IconCoffee, IconDumbbell, IconMoon, IconUtensils } from "../components/Icons";

// Ícone + cor de uma refeição a partir do nome livre que o utilizador lhe
// deu ("Pequeno-almoço", "Lanche da tarde", "Jantar"...). Sem acentos e em
// minúsculas para apanhar variações; o que não for reconhecido usa talheres.
const MEAL_VISUALS = [
  { match: ["pequeno", "cafe da manha", "breakfast"], icon: IconCoffee, color: "#f59e0b" },
  { match: ["pre-treino", "pre treino", "pos-treino", "pos treino", "treino"], icon: IconDumbbell, color: "#8b5cf6" },
  { match: ["lanche", "snack", "merenda"], icon: IconApple, color: "#ec4899" },
  { match: ["ceia"], icon: IconMoon, color: "#6366f1" },
  { match: ["jantar"], icon: IconUtensils, color: "#3b82f6" },
  { match: ["almoco"], icon: IconUtensils, color: "#10b981" },
];

const DEFAULT_MEAL_VISUAL = { icon: IconUtensils, color: "#a78bfa" };

function normalize(text) {
  return (text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function mealVisual(mealName) {
  const name = normalize(mealName);
  return MEAL_VISUALS.find((v) => v.match.some((word) => name.includes(word))) || DEFAULT_MEAL_VISUAL;
}
