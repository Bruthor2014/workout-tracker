import { useEffect, useState } from "react";
import { IconApple } from "./Icons";
import { apiRequest } from "../api/client";

// Nota "10/12 refeições cumpridas este mês" — só do plano ATIVO do próprio
// (GET /nutrition-plans/completion-summary, leve: só conta refeições/dias,
// não carrega opções/itens). Não mostra nada sem plano ativo com refeições
// (summary null).
export default function NutritionCompletionNote() {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    apiRequest("/nutrition-plans/completion-summary")
      .then(setSummary)
      .catch(() => {});
  }, []);

  if (!summary) return null;

  return (
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
  );
}
