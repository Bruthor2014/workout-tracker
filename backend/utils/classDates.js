// Datas das aulas de grupo (que se repetem todas as semanas). Tudo em hora
// local do servidor — o ginásio e o servidor estão no mesmo fuso horário.
// weekday: 1 = segunda ... 7 = domingo.

const pad = (n) => String(n).padStart(2, "0");

function toDateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const toMinutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const weekdayOf = (d) => ((d.getDay() + 6) % 7) + 1;
const minutesOf = (d) => d.getHours() * 60 + d.getMinutes();

// Próxima aula: hoje se for o dia e ainda não tiver começado; senão o
// próximo dia da semana certo.
function nextOccurrence(gymClass, now = new Date()) {
  const today = weekdayOf(now);
  let ahead = (gymClass.weekday - today + 7) % 7;
  if (ahead === 0 && minutesOf(now) >= toMinutes(gymClass.start_time)) ahead = 7;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ahead);
  return toDateKey(d);
}

// Já passou o prazo de inscrição (início - cancel_notice_minutes) da aula
// na data `dateKey`?
function cutoffPassed(gymClass, dateKey, now = new Date()) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const start = new Date(y, m - 1, d, ...gymClass.start_time.split(":").map(Number));
  return now.getTime() >= start.getTime() - gymClass.cancel_notice_minutes * 60000;
}

module.exports = { toDateKey, toMinutes, weekdayOf, minutesOf, nextOccurrence, cutoffPassed };
