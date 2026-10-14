// Estado de formulário de uma refeição (MealEditor) e conversão de/para a
// API dos planos de nutrição.

// Detalhes opcionais de cada elemento: foto (carregada ou do Open Food
// Facts), marca, código do produto e valores nutricionais por 100 g.
const ITEM_DETAILS = ["brand", "image_url", "off_code", "kcal_100g", "protein_100g", "carbs_100g", "fat_100g"];
const emptyDetails = () => Object.fromEntries(ITEM_DETAILS.map((field) => [field, null]));

export const emptyItem = () => ({ food_name: "", quantity: "", ...emptyDetails() });
export const emptyOption = () => ({ items: [emptyItem()] });
export const emptyMeal = () => ({ name: "", options: [emptyOption()] });

// Refeição da API -> estado do formulário.
export function mealToForm(meal) {
  return {
    name: meal.name,
    options: meal.options.map((option) => ({
      items:
        option.items.length > 0
          ? option.items.map((item) => ({
              food_name: item.food_name,
              quantity: item.quantity ?? "",
              ...Object.fromEntries(ITEM_DETAILS.map((field) => [field, item[field] ?? null])),
            }))
          : [emptyItem()],
    })),
  };
}

// Estado do formulário -> corpo para a API (ignora elementos sem nome).
export function formMealToApi(meal) {
  return {
    name: meal.name,
    options: meal.options.map((option) => ({
      items: option.items
        .filter((item) => item.food_name.trim())
        .map((item) => ({
          ...item,
          food_name: item.food_name.trim(),
          quantity: item.quantity.trim() || null,
        })),
    })),
  };
}
