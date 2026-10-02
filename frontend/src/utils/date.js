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
