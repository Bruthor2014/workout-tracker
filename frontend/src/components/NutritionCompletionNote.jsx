import { useEffect, useState } from "react";
import { IconApple, IconFlame } from "./Icons";
import { apiRequest } from "../api/client";

// Nota "10/12 refeições cumpridas este mês" (plano ATIVO) + calorias de
// hoje, consumidas (refeições já marcadas hoje, GET .../calories-today) e
// queimadas (estimativa a partir dos treinos de hoje, GET
// /sessions/calories-today) — duas linhas SEPARADAS de propósito, nunca um
// saldo combinado (pedido explícito: não juntar diretamente).
//
// Quando falta um pré-requisito (peso corporal nunca registado, ou
// nenhuma quantidade em gramas nas refeições cumpridas), mostra uma dica a
// dizer porquê em vez de esconder a linha sem explicação — descobriu-se
// que, sem isto, parecia que "as calorias não estavam a ser registadas"
// quando na realidade faltava só uma coisa de preencher.
export default function NutritionCompletionNote() {
  const [summary, setSummary] = useState(null);
  const [calories, setCalories] = useState(null);

  useEffect(() => {
    apiRequest("/nutrition-plans/completion-summary")
      .then(setSummary)
      .catch(() => {});
    Promise.all([
      apiRequest("/nutrition-plans/calories-today").catch(() => null),
      apiRequest("/sessions/calories-today").catch(() => null),
    ]).then(([consumed, burned]) => {
      setCalories({
        consumed: consumed?.calories ?? null,
        consumedItemsCounted: consumed?.items_counted ?? 0,
        consumedItemsTotal: consumed?.items_total ?? 0,
        burned: burned?.calories ?? null,
        // weight_kg vem sempre no corpo da resposta, mesmo quando
        // calories fica null — é o que distingue "sem treino hoje"
        // (nada a mostrar, normal) de "falta registar o peso" (vale a
        // pena avisar, é o pré-requisito que falta).
        hasWeight: burned ? burned.weight_kg != null : null,
      });
    });
  }, []);

  const consumedAllExcluded =
    calories && calories.consumed === 0 && calories.consumedItemsTotal > 0 && calories.consumedItemsCounted === 0;
  const consumedPartial =
    calories &&
    calories.consumedItemsTotal > 0 &&
    calories.consumedItemsCounted > 0 &&
    calories.consumedItemsCounted < calories.consumedItemsTotal;
  const showMissingWeightHint = calories && calories.burned == null && calories.hasWeight === false;
  const hasCalories = calories && (calories.consumed != null || calories.burned != null || showMissingWeightHint);

  if (!summary && !hasCalories) return null;

  return (
    <div className="nutrition-note-group">
      {summary && (
        <div className="nutrition-note">
          <span className="nutrition-note-icon">
            <IconApple size={18} />
          </span>
          <span>
            <strong>
              {summary.completed}/{summary.total}
            </strong>{" "}
            refeições cumpridas este mês
          </span>
        </div>
      )}
      {hasCalories && (
        <div className="nutrition-note">
          <span className="nutrition-note-icon">
            <IconFlame size={18} />
          </span>
          <span>
            {calories.burned != null && (
              <>
                <strong>{calories.burned}</strong> kcal queimadas hoje (estimativa)
              </>
            )}
            {showMissingWeightHint && "Regista o teu peso em Composição corporal para veres as calorias queimadas"}
            {(calories.burned != null || showMissingWeightHint) && calories.consumed != null && " · "}
            {calories.consumed != null && !consumedAllExcluded && (
              <>
                <strong>{calories.consumed}</strong> kcal consumidas hoje
                {consumedPartial && " (incompleto — só itens com quantidade em gramas)"}
              </>
            )}
            {consumedAllExcluded &&
              "Define a quantidade em gramas (ex: \"150g\") nos alimentos para veres as calorias consumidas"}
          </span>
        </div>
      )}
    </div>
  );
}
