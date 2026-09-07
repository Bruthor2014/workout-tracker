export function toDateKey(date) {
  return date.toISOString().slice(0, 10);
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
