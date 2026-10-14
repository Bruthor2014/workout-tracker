import { WEEKDAYS, todayWeekday, toMinutes } from "../utils/schedule";

const HOUR_HEIGHT = 84; // px por hora na grelha (uma aula de 1h mostra hora, nome, responsável e etiqueta)
const DENSE_HOUR_HEIGHT = 44; // modo compacto: linhas de 30 em 30 min, blocos pequenos
// O ginásio abre às 06:00 e fecha às 23:00.
const DEFAULT_START = 6;
const DEFAULT_END = 23;

// Itens que se sobrepõem ficam lado a lado — só dentro do seu grupo de
// sobreposição, para uma aula sozinha às 07:00 não ficar estreita por haver
// duas ao mesmo tempo às 19:00. `order` (opcional) desempata a ordem das
// colunas (ex: sala à esquerda, receção à direita).
function layoutDay(dayItems) {
  const sorted = [...dayItems].sort(
    (a, b) => toMinutes(a.start_time) - toMinutes(b.start_time) || (a.order ?? 0) - (b.order ?? 0)
  );
  const placed = [];
  let group = [];
  let groupEnd = -1;
  let columnsEnd = [];
  const closeGroup = () => {
    const cols = Math.max(1, columnsEnd.length);
    group.forEach((p) => placed.push({ ...p, cols }));
    group = [];
    columnsEnd = [];
  };
  for (const item of sorted) {
    const start = toMinutes(item.start_time);
    const end = toMinutes(item.end_time);
    if (start >= groupEnd) closeGroup();
    let col = columnsEnd.findIndex((e) => e <= start);
    if (col === -1) col = columnsEnd.length;
    columnsEnd[col] = end;
    groupEnd = Math.max(groupEnd, end);
    group.push({ item, col });
  }
  closeGroup();
  return placed;
}

// Horário semanal (Seg–Dom × horas), estilo tabela de horário. Cada item:
// { id, weekday, start_time, end_time, title, subtitle?, color, badge?,
//   status? ("vacant" | "warning" | "cancelled"), order? }. Em ecrãs
// estreitos passa a uma lista por dia. `onItemClick(item)` é opcional (sem
// ele os itens não são clicáveis). `dense`: grelha de meia em meia hora com
// blocos pequenos e minimalistas (só nome e atividade). `lanes` (opcional):
// faixas fixas em todos os dias (ex: ["Sala", "Sala", "Receção"]) — cada
// item diz a sua em `item.lane`, e as colunas ficam alinhadas na semana toda.
export default function WeekTimetable({
  items,
  onItemClick,
  emptyText = "Ainda não há nada no horário.",
  dense = false,
  lanes = null,
  clip = false,
}) {
  const today = todayWeekday();
  const hourHeight = dense ? DENSE_HOUR_HEIGHT : HOUR_HEIGHT;
  const startHour = clip && items.length
    ? Math.max(0, Math.floor(Math.min(...items.map((i) => toMinutes(i.start_time))) / 60) - 1)
    : Math.min(DEFAULT_START, ...items.map((i) => Math.floor(toMinutes(i.start_time) / 60)));
  const endHour = clip && items.length
    ? Math.min(24, Math.ceil(Math.max(...items.map((i) => toMinutes(i.end_time))) / 60) + 1)
    : Math.max(DEFAULT_END, ...items.map((i) => Math.ceil(toMinutes(i.end_time) / 60)));
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  // `compact`: blocos curtos (< 1h) mostram só a hora, o nome e a etiqueta.
  // `short` (modo compacto): blocos de 1h ou menos escondem a hora.
  function renderItem(item, style, compact = false, narrow = false) {
    const Tag = onItemClick ? "button" : "div";
    const short = dense && toMinutes(item.end_time) - toMinutes(item.start_time) <= 60;
    const classes = ["tt-item", item.status, compact && "compact", dense && "dense", narrow && "narrow", short && "short"]
      .filter(Boolean)
      .join(" ");
    return (
      <Tag
        key={item.id}
        type={onItemClick ? "button" : undefined}
        className={classes}
        style={{ "--item-color": item.color, ...style }}
        onClick={onItemClick ? () => onItemClick(item) : undefined}
        title={dense ? `${item.title} · ${item.subtitle || ""} · ${item.start_time}–${item.end_time}` : undefined}
      >
        {!dense && (
          <span className="tt-item-time">
            {item.start_time}–{item.end_time}
          </span>
        )}
        <span className="tt-item-title">{item.title}</span>
        {!short && item.subtitle && item.subtitle !== item.title && (
          <span className={`tt-item-subtitle${item.subtitleClass ? ` ${item.subtitleClass}` : ""}`}>{item.subtitle}</span>
        )}
        {!short && item.badge && <span className="tt-item-badge">{item.badge}</span>}
        {dense && (
          <span className="tt-item-time">
            {item.start_time}–{item.end_time}
          </span>
        )}
      </Tag>
    );
  }

  return (
    <div className={`timetable${dense ? " dense" : ""}`}>
      {/* Grelha (ecrãs largos) */}
      <div className="tt-grid" style={{ "--hours": hours.length, "--hour-height": `${hourHeight}px` }}>
        <div className="tt-corner" />
        {WEEKDAYS.map((d) => (
          <div key={d.value} className={`tt-day-head${d.value === today ? " today" : ""}${d.value % 2 === 0 ? " alt" : ""}`}>
            <span className="tt-day-name">{d.short}</span>
            {lanes && (
              <span className="tt-lanes">
                {lanes.map((l, i) => (
                  <span key={i}>{l}</span>
                ))}
              </span>
            )}
          </div>
        ))}
        <div className="tt-hours">
          {hours.map((h) => (
            <span key={h} className="tt-hour">
              {String(h).padStart(2, "0")}:00
              {dense && <span className="tt-hour-half">{String(h).padStart(2, "0")}:30</span>}
            </span>
          ))}
        </div>
        {WEEKDAYS.map((d) => (
          <div key={d.value} className={`tt-day${d.value === today ? " today" : ""}${d.value % 2 === 0 ? " alt" : ""}`}>
            {hours.map((h) => (
              <span key={h} className="tt-slot" />
            ))}
            {(lanes
              ? items.filter((i) => Number(i.weekday) === d.value).map((item) => ({ item, col: item.lane, cols: lanes.length }))
              : layoutDay(items.filter((i) => Number(i.weekday) === d.value))
            ).map(({ item, col, cols }) => {
              const top = ((toMinutes(item.start_time) - startHour * 60) / 60) * hourHeight;
              const minutes = toMinutes(item.end_time) - toMinutes(item.start_time);
              const height = (minutes / 60) * hourHeight;
              const gap = dense ? 2 : 3;
              return renderItem(
                item,
                {
                  top: top + 1,
                  height: Math.max(height - gap, 18),
                  // --day-pad: margem de cada lado do dia (separa os dias).
                  left: `calc(var(--day-pad, 0px) + (100% - 2 * var(--day-pad, 0px)) * ${col / cols} + ${gap}px)`,
                  width: `calc((100% - 2 * var(--day-pad, 0px)) / ${cols} - ${gap * 2}px)`,
                },
                !dense && minutes < 60,
                dense && cols >= 3
              );
            })}
          </div>
        ))}
      </div>

      {/* Lista por dia (ecrãs estreitos) */}
      <div className="tt-list">
        {WEEKDAYS.map((d) => {
          const dayItems = items
            .filter((i) => Number(i.weekday) === d.value)
            .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time) || (a.order ?? 0) - (b.order ?? 0));
          return (
            <section key={d.value} className={`tt-list-day${d.value === today ? " today" : ""}`}>
              <h4>
                {d.long}
                {d.value === today && <span className="week-day-today static">Hoje</span>}
              </h4>
              {dayItems.length ? (
                <div className={dense ? "tt-list-chips" : undefined}>{dayItems.map((item) => renderItem(item, {}))}</div>
              ) : (
                <p className="text-secondary">—</p>
              )}
            </section>
          );
        })}
      </div>

      {items.length === 0 && <p className="tt-empty text-secondary">{emptyText}</p>}
    </div>
  );
}
