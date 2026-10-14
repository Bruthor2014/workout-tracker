const pool = require("../db/pool");

// Verifica se um membro da equipa já tem algo marcado numa hora da semana.
// As sessões com clientes (PT / consultas) não podem coincidir com nada:
// turnos (sala, receção...), aulas de grupo que dá, ou outras sessões.
// Devolve uma frase a explicar o conflito, ou null se estiver livre.
//
// `check`: o que comparar — "sessions" (sessões com clientes), "shifts"
// (turnos) e "classes" (aulas que dá). `ignore`: { session, shift, class }
// com o id do próprio registo ao editar.

const DAY_SHORT = ["", "seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const ACTIVITY_LABELS = {
  floor: "Sala",
  class: "Aulas / estúdio",
  reception: "Receção",
  assessments: "Avaliações",
  admin: "Administrativo",
  other: "Outro",
};

async function findConflict(staffId, weekday, start, end, { check = ["sessions", "shifts", "classes"], ignore = {} } = {}) {
  const args = [staffId, weekday, start, end];
  const when = (r) => `${DAY_SHORT[weekday]} ${r.start_time}–${r.end_time}`;

  if (check.includes("sessions")) {
    const r = await pool.query(
      `SELECT u.name, to_char(cs.start_time, 'HH24:MI') AS start_time, to_char(cs.end_time, 'HH24:MI') AS end_time
         FROM client_sessions cs JOIN users u ON u.id = cs.member_id
        WHERE cs.staff_id = $1 AND cs.weekday = $2 AND cs.start_time < $4::time AND cs.end_time > $3::time
          AND ($5::int IS NULL OR cs.id <> $5)
        LIMIT 1`,
      [...args, ignore.session || null]
    );
    if (r.rows[0]) return `Coincide com a sessão com ${r.rows[0].name} (${when(r.rows[0])}).`;
  }
  if (check.includes("shifts")) {
    const r = await pool.query(
      `SELECT activity, to_char(start_time, 'HH24:MI') AS start_time, to_char(end_time, 'HH24:MI') AS end_time
         FROM staff_shifts
        WHERE staff_id = $1 AND weekday = $2 AND start_time < $4::time AND end_time > $3::time
          AND ($5::int IS NULL OR id <> $5)
        LIMIT 1`,
      [...args, ignore.shift || null]
    );
    if (r.rows[0]) return `Coincide com o turno de ${ACTIVITY_LABELS[r.rows[0].activity] || "trabalho"} (${when(r.rows[0])}).`;
  }
  if (check.includes("classes")) {
    const r = await pool.query(
      `SELECT title, to_char(start_time, 'HH24:MI') AS start_time, to_char(end_time, 'HH24:MI') AS end_time
         FROM group_classes
        WHERE instructor_id = $1 AND weekday = $2 AND start_time < $4::time AND end_time > $3::time
          AND ($5::int IS NULL OR id <> $5)
        LIMIT 1`,
      [...args, ignore.class || null]
    );
    if (r.rows[0]) return `Coincide com a aula de ${r.rows[0].title} (${when(r.rows[0])}).`;
  }
  return null;
}

module.exports = { findConflict };
