import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { IconCalendar, IconChevronRight } from "./Icons";
import { useAnchoredPopover } from "../utils/useAnchoredPopover";
import { toDateKey } from "../utils/date";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const WEEKDAYS = ["S", "T", "Q", "Q", "S", "S", "D"]; // a semana começa à segunda

const parseKey = (key) => new Date(`${key}T00:00:00`);

// Escolha de data no estilo do site, no lugar do <input type="date">
// nativo (o calendário do sistema operativo não condiz com o resto).
// `value`/`onChange` usam "YYYY-MM-DD", como o input nativo. `max`
// (opcional, "YYYY-MM-DD") desativa os dias depois dessa data.
export default function DatePicker({ id, value, onChange, max, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = value ? parseKey(value) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const close = useCallback(() => setOpen(false), []);
  const { anchorRef, popoverRef } = useAnchoredPopover(open, close);
  const todayKey = toDateKey(new Date());

  function toggle() {
    if (!open && value) {
      const d = parseKey(value);
      setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
    setOpen((o) => !o);
  }

  function choose(key) {
    onChange(key);
    setOpen(false);
    anchorRef.current?.focus();
  }

  function shiftMonth(delta) {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  // Grelha do mês: espaços vazios até à segunda-feira da 1.ª semana.
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => toDateKey(new Date(year, month, i + 1))),
  ];
  const nextMonthStart = toDateKey(new Date(year, month + 1, 1));
  const canGoNext = !max || nextMonthStart <= max;

  const shown = value ? parseKey(value) : null;
  const label = shown ? `${shown.getDate()} ${MONTH_SHORT[shown.getMonth()]} ${shown.getFullYear()}` : "Escolhe a data";

  return (
    <div className="ui-date">
      <button
        ref={anchorRef}
        id={id}
        type="button"
        className={`ui-select-trigger ui-date-trigger${open ? " open" : ""}`}
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel ? `${ariaLabel}: ${label}` : label}
      >
        <span className="ui-date-icon">
          <IconCalendar size={18} />
        </span>
        <span className={`ui-select-value${shown ? "" : " placeholder"}`}>{label}</span>
      </button>

      {open &&
        createPortal(
          <div ref={popoverRef} className="ui-popover ui-calendar" role="dialog" aria-label={ariaLabel || "Escolher data"}>
            <div className="ui-calendar-header">
              <button type="button" className="ui-calendar-nav prev" onClick={() => shiftMonth(-1)} aria-label="Mês anterior">
                <IconChevronRight size={16} />
              </button>
              <span className="ui-calendar-title">
                {MONTH_NAMES[month]} {year}
              </span>
              <button
                type="button"
                className="ui-calendar-nav"
                onClick={() => shiftMonth(1)}
                disabled={!canGoNext}
                aria-label="Mês seguinte"
              >
                <IconChevronRight size={16} />
              </button>
            </div>

            <div className="ui-calendar-grid">
              {WEEKDAYS.map((w, i) => (
                <span key={i} className="ui-calendar-weekday">
                  {w}
                </span>
              ))}
              {cells.map((key, i) =>
                key ? (
                  <button
                    type="button"
                    key={key}
                    className={`ui-calendar-day${key === value ? " selected" : ""}${key === todayKey ? " today" : ""}`}
                    onClick={() => choose(key)}
                    disabled={Boolean(max && key > max)}
                    aria-pressed={key === value}
                    aria-label={`${Number(key.slice(8))} de ${MONTH_NAMES[month]}`}
                  >
                    {Number(key.slice(8))}
                  </button>
                ) : (
                  <span key={`blank-${i}`} />
                )
              )}
            </div>

            <div className="ui-calendar-footer">
              <button
                type="button"
                className="ui-calendar-today"
                onClick={() => choose(todayKey)}
                disabled={Boolean(max && todayKey > max)}
              >
                Hoje
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
