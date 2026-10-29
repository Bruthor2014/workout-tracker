import { useEffect, useState } from "react";
import { IconApple, IconFlame } from "./Icons";
import InfoTooltip from "./InfoTooltip";
import { apiRequest } from "../api/client";

// Nota "10/12 refeições cumpridas este mês" (plano ATIVO) + calorias de
// hoje, consumidas (refeições já marcadas hoje, GET .../calories-today) e
// queimadas (estimativa a partir dos treinos de hoje, GET
// /sessions/calories-today) — duas linhas SEPARADAS de propósito, nunca um
// saldo combinado. Texto mínimo: quando falta um pré-requisito (peso
// corporal, ou quantidade em gramas nas refeições), não explica em texto
// — só um InfoTooltip (mesmo padrão do Ranking) com a explicação curta.
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
        consumedIncomplete: consumed && consumed.items_total > 0 && consumed.items_counted < consumed.items_total,
        burned: burned?.calories ?? null,
        hasWeight: burned ? burned.weight_kg != null : null,
      });
    });
  }, []);

  const missingWeight = calories && calories.burned == null && calories.hasWeight === false;
  const showBurned = calories && (calories.burned != null || missingWeight);
  const showConsumed = calories && calories.consumed != null;
  if (!summary && !showBurned && !showConsumed) return null;

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
      {(showBurned || showConsumed) && (
        <div className="nutrition-note">
          <span className="nutrition-note-icon">
            <IconFlame size={18} />
          </span>
          <span>
            {showBurned && (
              <>
                {calories.burned != null ? <strong>{calories.burned} kcal</strong> : "— kcal"} queimadas hoje
                <InfoTooltip text="Tens de registar o teu peso em Composição corporal para calcular as calorias queimadas." />
              </>
            )}
            {showBurned && showConsumed && " · "}
            {showConsumed && (
              <>
                <strong>{calories.consumed} kcal</strong> consumidas hoje
                {calories.consumedIncomplete && (
                  <InfoTooltip text="Só conta alimentos com quantidade em gramas (ex: '150g')." />
                )}
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
