// "quantity" de um item (meal_option_items.quantity) é texto livre — "2
// unidades", "1 fatia", "150g" — por isso só dá para calcular calorias
// reais quando vem claramente em gramas/kg. Nos outros casos devolve null
// e esse item fica fora da soma (nunca se inventa uma conversão, ex:
// tratar "2 unidades" como "2 gramas"). Mesma lógica do backend
// (parseGrams em nutritionController.js) — mantida separada porque aqui
// corre no cliente sem precisar de pedir nada à API.
export function parseGrams(quantity) {
  if (!quantity) return null;
  const match = String(quantity).match(/(\d+(?:[.,]\d+)?)\s*(kg|kilos?|gr|g|gramas?)\b/i);
  if (!match) return null;
  const amount = parseFloat(match[1].replace(",", "."));
  if (!Number.isFinite(amount)) return null;
  return match[2].toLowerCase().startsWith("k") ? amount * 1000 : amount;
}

// Calorias estimadas de uma refeição — usa sempre a 1.ª opção (não há
// registo de qual opção se segue num dado dia quando há mais do que uma).
// Devolve null se nenhum item da opção tiver dados suficientes (sem
// pretender uma estimativa de 0 kcal, que seria enganador).
export function estimateMealCalories(meal) {
  const option = meal.options?.[0];
  if (!option) return null;
  let calories = 0;
  let counted = 0;
  for (const item of option.items) {
    const grams = parseGrams(item.quantity);
    if (grams == null || item.kcal_100g == null) continue;
    calories += (Number(item.kcal_100g) * grams) / 100;
    counted++;
  }
  if (counted === 0) return null;
  return { calories: Math.round(calories), counted, total: option.items.length };
}
