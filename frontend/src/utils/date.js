// Devolve "YYYY-MM-DD" a partir dos componentes LOCAIS da data (ano/mês/dia
// do browser), não `toISOString()` — essa converte para UTC primeiro, o que
// desloca a data em até um dia sempre que o fuso horário local não é
// UTC+0 (ex: Portugal), fazendo um treino de sexta aparecer marcado em
// sábado no calendário semanal.
export function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = domingo
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Dias de calendário desde `isoString` até hoje, inclusive (criado hoje =
// 1). Normaliza as duas datas para meia-noite LOCAL antes de subtrair —
// nunca dividir milissegundos crus por 86400000, isso subestima sempre que
// menos de 24h reais se passaram mas já é outro dia de calendário (ex:
// criado às 23h de ontem, são 00h05 de hoje: só 5 min reais mas já é o
// 2º dia). Mesmo bug que já aconteceu no backend (getCompletionSummary).
export function daysSince(isoString) {
  if (!isoString) return null;
  const start = new Date(`${toDateKey(new Date(isoString))}T00:00:00`);
  const today = new Date(`${toDateKey(new Date())}T00:00:00`);
  return Math.round((today - start) / 86400000) + 1;
}

// "Ativo hoje" / "Ativo há X dias" a partir de nutrition_plans.active_since
// — usado tanto na linha fechada (NutritionPlanRow) como no cartão aberto
// (NutritionPlanCard) do plano de nutrição.
export function activeSinceLabel(activeSince) {
  const days = daysSince(activeSince);
  if (days == null) return "Plano ativo";
  return days <= 1 ? "Ativo hoje" : `Ativo há ${days} dias`;
}
