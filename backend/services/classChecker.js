const pool = require("../db/pool");
const { toDateKey, toMinutes, weekdayOf, minutesOf } = require("../utils/classDates");

// Verificação automática das aulas de grupo de hoje. Corre a cada minuto:
// quando chega o prazo de uma aula (início - cancel_notice_minutes, 30 min
// por omissão), se não houver responsável ou não houver o mínimo de
// inscritos, a aula dessa data é cancelada e os inscritos (e o responsável)
// recebem uma mensagem automática. Cada aula/data só é cancelada uma vez
// (UNIQUE em class_cancellations).

const CHECK_EVERY_MS = 60 * 1000;
const DAY_NAMES = ["", "segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];

async function checkClasses(now = new Date()) {
  const today = toDateKey(now);
  const nowMinutes = minutesOf(now);
  const result = await pool.query(
    `SELECT gc.id, gc.gym_id, gc.title, gc.weekday, gc.instructor_id, gc.min_participants,
            gc.cancel_notice_minutes, gc.substitute_requested,
            COALESCE(gc.sub_cutoff_minutes, 30) AS sub_cutoff_minutes,
            to_char(gc.start_time, 'HH24:MI') AS start_time,
            (SELECT COUNT(*)::int FROM class_enrollments e WHERE e.class_id = gc.id AND e.class_date = $2) AS enrolled
       FROM group_classes gc
      WHERE gc.weekday = $1
        AND NOT EXISTS (SELECT 1 FROM class_cancellations c WHERE c.class_id = gc.id AND c.class_date = $2)`,
    [weekdayOf(now), today]
  );

  for (const c of result.rows) {
    const start = toMinutes(c.start_time);

    // Auto-cancel: sub requested past sub_cutoff_minutes
    if (c.substitute_requested && nowMinutes >= start - c.sub_cutoff_minutes && nowMinutes < start) {
      const ins = await pool.query(
        `INSERT INTO class_cancellations (class_id, class_date, reason)
         VALUES ($1, $2, 'no_instructor') ON CONFLICT DO NOTHING RETURNING id`,
        [c.id, today]
      );
      if (ins.rows.length) {
        await pool.query(
          `UPDATE group_classes SET substitute_requested = false, substitute_reason = NULL WHERE id = $1`,
          [c.id]
        );
        await notifyCancellation(c, today, "no_instructor");
      }
      continue;
    }

    // Só na janela entre o prazo e o início da aula.
    if (nowMinutes < start - c.cancel_notice_minutes || nowMinutes >= start) continue;

    let reason = null;
    if (!c.instructor_id) reason = "no_instructor";
    else if (c.enrolled < c.min_participants) reason = "not_enough";
    if (!reason) continue;

    const inserted = await pool.query(
      `INSERT INTO class_cancellations (class_id, class_date, reason) VALUES ($1, $2, $3)
       ON CONFLICT (class_id, class_date) DO NOTHING RETURNING id`,
      [c.id, today, reason]
    );
    if (!inserted.rows.length) continue;
    await notifyCancellation(c, today, reason);
  }
}

async function notifyCancellation(c, dateKey, reason) {
  // As mensagens automáticas saem em nome da gerência do ginásio.
  const owner = await pool.query(
    `SELECT id FROM users WHERE gym_id = $1 AND role = 'gym_owner' ORDER BY id LIMIT 1`,
    [c.gym_id]
  );
  const senderId = owner.rows[0]?.id ?? c.instructor_id;
  if (!senderId) return;

  const why =
    reason === "no_instructor"
      ? "por não haver um PT disponível para a dar"
      : `por falta de participantes (mínimo de ${c.min_participants} inscritos)`;
  const body =
    `❌ A aula de ${c.title} de hoje (${DAY_NAMES[c.weekday]}, ${c.start_time}) foi cancelada ${why}. ` +
    `Pedimos desculpa — esperamos ver-te numa próxima aula!`;

  const recipients = await pool.query(
    `SELECT member_id AS id FROM class_enrollments WHERE class_id = $1 AND class_date = $2`,
    [c.id, dateKey]
  );
  const ids = new Set(recipients.rows.map((r) => r.id));
  if (c.instructor_id) ids.add(c.instructor_id);
  ids.delete(senderId);
  const recipientList = [...ids];
  if (recipientList.length) {
    await pool.query(
      `INSERT INTO messages (sender_id, recipient_id, body)
       SELECT $1, unnest($2::int[]), $3`,
      [senderId, recipientList, body]
    );
  }
}

function startClassChecker() {
  const run = () => checkClasses().catch((err) => console.error("Verificação das aulas falhou:", err));
  run();
  return setInterval(run, CHECK_EVERY_MS);
}

module.exports = { startClassChecker, checkClasses };
