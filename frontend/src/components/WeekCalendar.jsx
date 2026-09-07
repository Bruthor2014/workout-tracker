import { startOfWeek, toDateKey } from "../utils/date";

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

// Mostra os 7 dias da semana atual (Seg-Dom); os dias em que existe uma
// sessão em `attendedDates` (Set de "YYYY-MM-DD") ficam marcados. Dias sem
// treino ficam simplesmente sem marca — nada de vermelho/negativo.
export default function WeekCalendar({ attendedDates }) {
  const monday = startOfWeek(new Date());
  const todayKey = toDateKey(new Date());

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = toDateKey(d);
    return {
      key,
      label: WEEKDAY_LABELS[i],
      dayNumber: d.getDate(),
      attended: attendedDates.has(key),
      isToday: key === todayKey,
    };
  });

  return (
    <div className="week-calendar">
      {days.map((day) => (
        <div
          key={day.key}
          className={`week-day${day.attended ? " attended" : ""}${day.isToday ? " today" : ""}`}
          title={day.attended ? "Foste ao ginásio" : undefined}
        >
          <span className="week-day-label">{day.label}</span>
          <span className="week-day-number">{day.dayNumber}</span>
          {day.attended && <span className="week-day-check">✓</span>}
        </div>
      ))}
    </div>
  );
}
