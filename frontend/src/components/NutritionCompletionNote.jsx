import { useEffect, useState } from "react";
import { IconApple, IconFlame } from "./Icons";
import { apiRequest } from "../api/client";

// Nota "10/12 refeições cumpridas este mês" (plano ATIVO) + calorias de
// hoje, consumidas (refeições já marcadas hoje, GET .../calories-today) e
// queimadas (estimativa a partir dos treinos de hoje, GET
// /sessions/calories-today) — duas linhas SEPARADAS de propósito, nunca um
// saldo combinado (pedido explícito: não juntar diretamente). Cada uma só
// aparece se houver dados; sem nada dos três, o componente não mostra nada.
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
        consumedPartial: consumed && consumed.items_total > 0 && consumed.items_counted < consumed.items_total,
        burned: burned?.calories ?? null,
      });
    });
  }, []);

  const hasCalories = calories && (calories.consumed != null || calories.burned != null);
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
            {calories.burned != null && calories.consumed != null && " · "}
            {calories.consumed != null && (
              <>
                <strong>{calories.consumed}</strong> kcal consumidas hoje
                {calories.consumedPartial && " (incompleto)"}
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
