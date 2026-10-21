import { addDays, toDateKey } from "../utils/date";
import { workoutVisual } from "../utils/muscleGroups";
import { IconChevronRight } from "./Icons";

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTH_LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function shortDate(d) {
  return `${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`;
}

// Os 7 dias (Seg-Dom) da semana que começa em `weekStart`, com setas para
// ir a outras semanas. Cada dia é clicável (`onSelect(dateKey)`) e o
// escolhido (`selectedKey`) fica destacado. `workoutsByDate` é um Map
// "YYYY-MM-DD" -> muscle_groups do treino desse dia: os dias com treino
// mostram a figura/cor desse treino (ver workoutVisual); os restantes um
// haltere apagado — nada de vermelho/negativo.
export default function WeekCalendar({ weekStart, selectedKey, workoutsByDate, onSelect, onPrevWeek, onNextWeek, canGoNext }) {
  const todayKey = toDateKey(new Date());
  const weekEnd = addDays(weekStart, 6);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    const key = toDateKey(d);
    return {
      key,
      label: WEEKDAY_LABELS[i],
      dayNumber: shortDate(d),
      attended: workoutsByDate.has(key),
      visual: workoutsByDate.has(key) ? workoutVisual(workoutsByDate.get(key)) : null,
      isToday: key === todayKey,
      isFuture: key > todayKey,
    };
  });

  return (
    <div className="week-calendar-wrap">
      <div className="week-calendar-nav">
        <button type="button" className="week-nav-button" onClick={onPrevWeek} aria-label="Semana anterior">
          <span className="week-nav-prev">
            <IconChevronRight size={18} />
          </span>
        </button>
        <span className="week-calendar-range">
          {shortDate(weekStart)} – {shortDate(weekEnd)} {weekEnd.getFullYear()}
        </span>
        <button
          type="button"
          className="week-nav-button"
          onClick={onNextWeek}
          disabled={!canGoNext}
          aria-label="Semana seguinte"
        >
          <IconChevronRight size={18} />
        </button>
      </div>

      <div className="week-calendar">
        {days.map((day) => {
          const classes = ["week-day"];
          if (day.attended) classes.push("attended");
          if (day.isToday) classes.push("today");
          if (day.key === selectedKey) classes.push("selected");
          if (day.isFuture) classes.push("future");
          return (
            <button
              type="button"
              key={day.key}
              className={classes.join(" ")}
              style={day.visual ? { "--day-accent": day.visual.color } : undefined}
              onClick={() => onSelect(day.key)}
              aria-pressed={day.key === selectedKey}
              aria-label={`${day.label}, ${day.dayNumber}${day.attended ? " — com treino" : ""}`}
            >
              <span className="week-day-text">
                <span className="week-day-label">
                  {day.label}
                  {day.isToday && <span className="week-day-today">Hoje</span>}
                </span>
                <span className="week-day-number">{day.dayNumber}</span>
                {day.attended && <span className="week-day-check" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
