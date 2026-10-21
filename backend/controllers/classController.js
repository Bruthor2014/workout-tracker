const pool = require("../db/pool");
const { nextOccurrence, cutoffPassed, toDateKey, weekdayOf, minutesOf } = require("../utils/classDates");
const { notifyVacantClasses, notifySubstituteRequest, notifyWaitlistPromotion } = require("../services/classNotify");
const { findConflict } = require("../utils/staffBusy");

// Aulas de grupo: horário semanal do ginásio (ver group_classes no
// schema.sql). Toda a gente do ginásio vê; o CEO (gym_owner) gere; quem dá
// a aula pode pedir substituição; outro membro da equipa pode ficar com uma
// aula vaga ou com substituição pedida.

const KINDS = ["class", "talk", "event"];
const AUDIENCES = ["members", "everyone"];
// Quem pode dar aulas/palestras (ser responsável ou ficar com uma vaga).
const INSTRUCTOR_ROLES = ["personal_trainer", "nutritionist", "intern"];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const CLASS_COLUMNS = `gc.id, gc.title, gc.kind, gc.weekday,
       to_char(gc.start_time, 'HH24:MI') AS start_time, to_char(gc.end_time, 'HH24:MI') AS end_time,
       gc.room, gc.capacity, gc.instructor_id, gc.audience, gc.description,
       gc.substitute_requested, gc.substitute_reason, gc.min_participants, gc.cancel_notice_minutes,
       u.name AS instructor_name, u.role AS instructor_role`;

// Acrescenta a cada aula a informação da próxima data: inscritos, se o
// utilizador está inscrito, se foi cancelada e se as inscrições estão
// abertas (fecham no prazo de cancelamento).
async function withNextOccurrence(rows, userId) {
  if (rows.length === 0) return rows;
  const now = new Date();
  const dated = rows.map((c) => ({ ...c, next_date: nextOccurrence(c, now) }));
  const keys = dated.map((c) => [c.id, c.next_date]);
  const stats = await pool.query(
    `SELECT k.class_id, k.class_date::text AS class_date,
            (SELECT COUNT(*)::int FROM class_enrollments e WHERE e.class_id = k.class_id AND e.class_date = k.class_date) AS enrolled_count,
            EXISTS (SELECT 1 FROM class_enrollments e WHERE e.class_id = k.class_id AND e.class_date = k.class_date AND e.member_id = $3) AS is_enrolled,
            (SELECT reason FROM class_cancellations x WHERE x.class_id = k.class_id AND x.class_date = k.class_date) AS cancelled_reason,
            co.instructor_confirmed,
            co.reception_confirmed,
            (SELECT r.rank FROM (
               SELECT e.member_id, ROW_NUMBER() OVER (ORDER BY e.created_at) AS rank
                 FROM class_enrollments e
                WHERE e.class_id = k.class_id AND e.class_date = k.class_date
             ) r WHERE r.member_id = $3) AS my_rank
       FROM unnest($1::int[], $2::date[]) AS k(class_id, class_date)
       LEFT JOIN class_occurrences co ON co.class_id = k.class_id AND co.class_date = k.class_date`,
    [keys.map((k) => k[0]), keys.map((k) => k[1]), userId]
  );
  const byClass = new Map(stats.rows.map((r) => [r.class_id, r]));
  return dated.map((c) => {
    const s = byClass.get(c.id) || {};
    const myRank = s.my_rank != null ? Number(s.my_rank) : null;
    const waitlistPosition = c.capacity && myRank && myRank > c.capacity ? myRank - c.capacity : null;
    return {
      ...c,
      enrolled_count: s.enrolled_count || 0,
      is_enrolled: Boolean(s.is_enrolled),
      cancelled_reason: s.cancelled_reason || null,
      enrollment_open: !s.cancelled_reason && !cutoffPassed(c, c.next_date, now),
      instructor_confirmed: Boolean(s.instructor_confirmed),
      reception_confirmed: Boolean(s.reception_confirmed),
      // Lista de espera: se a aula tem lotação e já está cheia, continuas a
      // poder inscrever-te — fica guardada a tua posição na fila (derivada
      // da ordem de inscrição), e quando alguém sai és promovido.
      waitlist_position: waitlistPosition,
    };
  });
}

async function fetchClass(id, gymId) {
  if (!Number.isInteger(Number(id))) return null;
  const result = await pool.query(
    `SELECT ${CLASS_COLUMNS}
       FROM group_classes gc
       LEFT JOIN users u ON u.id = gc.instructor_id
      WHERE gc.id = $1 AND gc.gym_id = $2`,
    [id, gymId]
  );
  return result.rows[0] || null;
}

// Valida o corpo de criar/editar; devolve a mensagem de erro ou null.
async function validateClassBody(body, gymId) {
  const { title, kind, weekday, start_time, end_time, audience, capacity, instructor_id } = body;
  if (!title || !String(title).trim()) return "O nome da aula é obrigatório.";
  if (kind && !KINDS.includes(kind)) return "Tipo inválido.";
  if (audience && !AUDIENCES.includes(audience)) return "Público inválido.";
  if (!Number.isInteger(Number(weekday)) || weekday < 1 || weekday > 7) return "Dia da semana inválido.";
  if (!TIME_RE.test(start_time || "") || !TIME_RE.test(end_time || "")) return "Horas inválidas (HH:MM).";
  if (end_time <= start_time) return "A hora de fim tem de ser depois da de início.";
  if (capacity != null && capacity !== "" && !(Number(capacity) > 0)) return "Lotação inválida.";
  const { min_participants, cancel_notice_minutes } = body;
  if (min_participants != null && min_participants !== "" && !(Number.isInteger(Number(min_participants)) && Number(min_participants) >= 0)) {
    return "Mínimo de participantes inválido.";
  }
  if (capacity && min_participants && Number(min_participants) > Number(capacity)) {
    return "O mínimo de participantes não pode ser maior que a lotação.";
  }
  if (cancel_notice_minutes != null && cancel_notice_minutes !== "" && !(Number(cancel_notice_minutes) >= 0 && Number(cancel_notice_minutes) <= 1440)) {
    return "Antecedência inválida (0 a 1440 minutos).";
  }
  if (instructor_id) {
    const staff = await pool.query(`SELECT role FROM users WHERE id = $1 AND gym_id = $2`, [instructor_id, gymId]);
    if (!staff.rows[0] || !INSTRUCTOR_ROLES.includes(staff.rows[0].role)) {
      return "O responsável tem de ser um PT, nutricionista ou estagiário do ginásio.";
    }
    // Não pode coincidir com as sessões do responsável com clientes.
    const conflict = await findConflict(instructor_id, Number(weekday), start_time, end_time, { check: ["sessions"] });
    if (conflict) return `O responsável não está livre: ${conflict.charAt(0).toLowerCase()}${conflict.slice(1)}`;
  }
  return null;
}

function classValues(body) {
  return [
    String(body.title).trim().slice(0, 120),
    body.kind || "class",
    Number(body.weekday),
    body.start_time,
    body.end_time,
    body.room ? String(body.room).trim().slice(0, 80) : null,
    body.capacity ? Number(body.capacity) : null,
    body.instructor_id || null,
    body.audience || "members",
    body.description ? String(body.description).trim() : null,
    body.min_participants === "" || body.min_participants == null ? 3 : Number(body.min_participants),
    body.cancel_notice_minutes === "" || body.cancel_notice_minutes == null ? 30 : Number(body.cancel_notice_minutes),
  ];
}

const DAY_NAMES = ["", "segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];

// Aula/palestra para todo o ginásio: avisa toda a gente por mensagem.
async function notifyWholeGym(gymClass, senderId, gymId) {
  const body =
    `📅 Nova ${gymClass.kind === "talk" ? "palestra" : gymClass.kind === "event" ? "atividade" : "aula"} para todo o ginásio: ` +
    `${gymClass.title} — todas as ${DAY_NAMES[gymClass.weekday]}s, ${gymClass.start_time}–${gymClass.end_time}` +
    `${gymClass.room ? ` (${gymClass.room})` : ""}.`;
  await pool.query(
    `INSERT INTO messages (sender_id, recipient_id, body)
     SELECT $1, id, $2 FROM users WHERE gym_id = $3 AND id <> $1 AND role <> 'admin'`,
    [senderId, body, gymId]
  );
}

// GET /api/classes — horário de aulas do ginásio (toda a gente do ginásio)
async function listClasses(req, res) {
  const result = await pool.query(
    `SELECT ${CLASS_COLUMNS}
       FROM group_classes gc
       LEFT JOIN users u ON u.id = gc.instructor_id
      WHERE gc.gym_id = $1
      ORDER BY gc.weekday, gc.start_time`,
    [req.user.gymId]
  );
  res.json(await withNextOccurrence(result.rows, req.user.id));
}

// POST /api/classes — CEO cria uma aula
async function createClass(req, res) {
  const error = await validateClassBody(req.body, req.user.gymId);
  if (error) return res.status(400).json({ message: error });
  const result = await pool.query(
    `INSERT INTO group_classes
       (title, kind, weekday, start_time, end_time, room, capacity, instructor_id, audience, description,
        min_participants, cancel_notice_minutes, gym_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
    [...classValues(req.body), req.user.gymId]
  );
  const created = await fetchClass(result.rows[0].id, req.user.gymId);
  if (created.audience === "everyone") await notifyWholeGym(created, req.user.id, req.user.gymId);
  if (!created.instructor_id) await notifyVacantClasses(req.user.gymId, [created]);
  res.status(201).json(created);
}

// PUT /api/classes/:id — CEO edita (trocar o responsável limpa um pedido de
// substituição pendente)
async function updateClass(req, res) {
  const existing = await fetchClass(req.params.id, req.user.gymId);
  if (!existing) return res.status(404).json({ message: "Aula não encontrada." });
  const error = await validateClassBody(req.body, req.user.gymId);
  if (error) return res.status(400).json({ message: error });
  const instructorChanged = (req.body.instructor_id || null) !== existing.instructor_id;
  await pool.query(
    `UPDATE group_classes
        SET title = $1, kind = $2, weekday = $3, start_time = $4, end_time = $5, room = $6,
            capacity = $7, instructor_id = $8, audience = $9, description = $10,
            min_participants = $11, cancel_notice_minutes = $12,
            substitute_requested = CASE WHEN $13 THEN false ELSE substitute_requested END,
            substitute_reason = CASE WHEN $13 THEN NULL ELSE substitute_reason END
      WHERE id = $14 AND gym_id = $15`,
    [...classValues(req.body), instructorChanged, req.params.id, req.user.gymId]
  );
  const updated = await fetchClass(req.params.id, req.user.gymId);
  // Ficou sem responsável: avisa os PTs.
  if (existing.instructor_id && !updated.instructor_id) await notifyVacantClasses(req.user.gymId, [updated]);
  res.json((await withNextOccurrence([updated], req.user.id))[0]);
}

// DELETE /api/classes/:id — CEO remove
async function deleteClass(req, res) {
  const result = await pool.query(`DELETE FROM group_classes WHERE id = $1 AND gym_id = $2 RETURNING id`, [
    req.params.id,
    req.user.gymId,
  ]);
  if (result.rows.length === 0) return res.status(404).json({ message: "Aula não encontrada." });
  res.status(204).send();
}

// POST /api/classes/:id/substitute — o responsável pede substituição
// (body: { reason }). DELETE no mesmo caminho cancela o pedido.
async function requestSubstitute(req, res) {
  const gymClass = await fetchClass(req.params.id, req.user.gymId);
  if (!gymClass) return res.status(404).json({ message: "Aula não encontrada." });
  if (gymClass.instructor_id !== req.user.id) {
    return res.status(403).json({ message: "Só o responsável pela aula pode pedir substituição." });
  }
  const reason = req.body.reason ? String(req.body.reason).trim().slice(0, 300) : null;
  await pool.query(`UPDATE group_classes SET substitute_requested = true, substitute_reason = $1 WHERE id = $2`, [
    reason,
    gymClass.id,
  ]);
  if (!gymClass.substitute_requested) {
    await notifySubstituteRequest(req.user.gymId, gymClass, gymClass.instructor_name, reason, req.user.id);
  }
  res.json((await withNextOccurrence([await fetchClass(gymClass.id, req.user.gymId)], req.user.id))[0]);
}

async function cancelSubstitute(req, res) {
  const gymClass = await fetchClass(req.params.id, req.user.gymId);
  if (!gymClass) return res.status(404).json({ message: "Aula não encontrada." });
  if (gymClass.instructor_id !== req.user.id && req.user.role !== "gym_owner") {
    return res.status(403).json({ message: "Sem permissão para esta aula." });
  }
  await pool.query(`UPDATE group_classes SET substitute_requested = false, substitute_reason = NULL WHERE id = $1`, [
    gymClass.id,
  ]);
  res.json((await withNextOccurrence([await fetchClass(gymClass.id, req.user.gymId)], req.user.id))[0]);
}

// POST /api/classes/:id/claim — um PT/nutricionista fica com uma aula vaga
// ou com substituição pedida (não a sua).
async function claimClass(req, res) {
  const gymClass = await fetchClass(req.params.id, req.user.gymId);
  if (!gymClass) return res.status(404).json({ message: "Aula não encontrada." });
  const available = !gymClass.instructor_id || (gymClass.substitute_requested && gymClass.instructor_id !== req.user.id);
  if (!available) return res.status(409).json({ message: "Esta aula já tem responsável." });
  const conflict = await findConflict(req.user.id, gymClass.weekday, gymClass.start_time, gymClass.end_time, {
    check: ["sessions"],
  });
  if (conflict) return res.status(409).json({ message: `Não estás livre: ${conflict.charAt(0).toLowerCase()}${conflict.slice(1)}` });
  await pool.query(
    `UPDATE group_classes SET instructor_id = $1, substitute_requested = false, substitute_reason = NULL WHERE id = $2`,
    [req.user.id, gymClass.id]
  );
  // Quem passa a dar a aula deixa de estar inscrito nela.
  await pool.query(`DELETE FROM class_enrollments WHERE class_id = $1 AND member_id = $2 AND class_date >= CURRENT_DATE`, [
    gymClass.id,
    req.user.id,
  ]);
  res.json((await withNextOccurrence([await fetchClass(gymClass.id, req.user.gymId)], req.user.id))[0]);
}

// Quem se pode inscrever nas aulas: membros, PTs e nutricionistas (estes
// só nas aulas que não são eles a dar).
const ENROLL_ROLES = ["member", "personal_trainer", "nutritionist"];

// Promove quem está em 1º na lista de espera para a vaga que acabou de
// abrir (a ordem é sempre a de inscrição — ver withNextOccurrence).
async function promoteFromWaitlist(gymId, gymClass, dateKey) {
  const result = await pool.query(
    `SELECT member_id FROM class_enrollments
      WHERE class_id = $1 AND class_date = $2
      ORDER BY created_at
      LIMIT 1 OFFSET $3`,
    [gymClass.id, dateKey, gymClass.capacity - 1]
  );
  const promoted = result.rows[0];
  if (promoted) await notifyWaitlistPromotion(gymId, gymClass, promoted.member_id);
}

// POST /api/classes/:id/enroll — inscrição na próxima aula.
// DELETE no mesmo caminho cancela a inscrição.
async function enroll(req, res) {
  const gymClass = await fetchClass(req.params.id, req.user.gymId);
  if (!gymClass) return res.status(404).json({ message: "Aula não encontrada." });
  if (gymClass.instructor_id === req.user.id) {
    return res.status(409).json({ message: "Não te podes inscrever numa aula que és tu a dar." });
  }
  const [c] = await withNextOccurrence([gymClass], req.user.id);
  if (c.cancelled_reason) return res.status(409).json({ message: "Esta aula foi cancelada." });
  if (!c.enrollment_open) return res.status(409).json({ message: "As inscrições para esta aula já fecharam." });
  // Lotação cheia já não recusa a inscrição — entra em lista de espera
  // (a posição é derivada da ordem de inscrição, ver withNextOccurrence).
  await pool.query(
    `INSERT INTO class_enrollments (class_id, member_id, class_date) VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [c.id, req.user.id, c.next_date]
  );
  const [updated] = await withNextOccurrence([gymClass], req.user.id);
  res.json(updated);
}

async function unenroll(req, res) {
  const gymClass = await fetchClass(req.params.id, req.user.gymId);
  if (!gymClass) return res.status(404).json({ message: "Aula não encontrada." });
  const [c] = await withNextOccurrence([gymClass], req.user.id);
  const wasConfirmed = c.is_enrolled && !c.waitlist_position;
  await pool.query(`DELETE FROM class_enrollments WHERE class_id = $1 AND member_id = $2 AND class_date = $3`, [
    c.id,
    req.user.id,
    c.next_date,
  ]);
  // Uma vaga confirmada abriu-se — promove quem estava primeiro na fila.
  if (wasConfirmed && gymClass.capacity) await promoteFromWaitlist(req.user.gymId, gymClass, c.next_date);
  const [updated] = await withNextOccurrence([gymClass], req.user.id);
  res.json(updated);
}

// GET /api/classes/:id/enrollments — quem está inscrito na próxima aula
// (CEO e o responsável da aula).
async function listEnrollments(req, res) {
  const gymClass = await fetchClass(req.params.id, req.user.gymId);
  if (!gymClass) return res.status(404).json({ message: "Aula não encontrada." });
  if (req.user.role !== "gym_owner" && gymClass.instructor_id !== req.user.id) {
    return res.status(403).json({ message: "Sem permissão para ver os inscritos." });
  }
  const date = nextOccurrence(gymClass);
  const result = await pool.query(
    `SELECT u.id, u.name, u.avatar_url FROM class_enrollments e JOIN users u ON u.id = e.member_id
      WHERE e.class_id = $1 AND e.class_date = $2 ORDER BY e.created_at`,
    [gymClass.id, date]
  );
  res.json({ class_date: date, members: result.rows });
}

function toMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// POST /api/classes/:id/occurrence — confirm a class occurrence took place.
// The instructor confirms they gave it; receptionist/owner confirms reception-side.
// Once both confirmed, a staff_attendance record is created for the instructor.
async function confirmOccurrence(req, res) {
  const gymClass = await fetchClass(req.params.id, req.user.gymId);
  if (!gymClass) return res.status(404).json({ message: "Aula não encontrada." });

  const { class_date } = req.body;
  if (!class_date || !/^\d{4}-\d{2}-\d{2}$/.test(class_date)) {
    return res.status(400).json({ message: "class_date (YYYY-MM-DD) é obrigatório." });
  }

  const cancelled = await pool.query(
    `SELECT 1 FROM class_cancellations WHERE class_id = $1 AND class_date = $2::date`,
    [gymClass.id, class_date]
  );
  if (cancelled.rows.length) return res.status(409).json({ message: "Esta aula foi cancelada." });

  const isInstructor = gymClass.instructor_id === req.user.id;
  const isReception  = ["receptionist", "reception_station"].includes(req.user.role) || req.user.role === "gym_owner";
  if (!isInstructor && !isReception) {
    return res.status(403).json({ message: "Sem permissão para confirmar esta aula." });
  }

  const setCols = isInstructor
    ? "instructor_confirmed = true, instructor_confirmed_at = NOW()"
    : "reception_confirmed = true, reception_confirmed_at = NOW()";
  const insertCols = isInstructor
    ? "instructor_confirmed, instructor_confirmed_at"
    : "reception_confirmed, reception_confirmed_at";

  const occ = await pool.query(
    `INSERT INTO class_occurrences (class_id, gym_id, class_date, ${insertCols})
     VALUES ($1, $2, $3::date, true, NOW())
     ON CONFLICT (class_id, class_date) DO UPDATE SET ${setCols}
     RETURNING *`,
    [gymClass.id, req.user.gymId, class_date]
  );
  const occurrence = occ.rows[0];

  // Both sides confirmed → create/upsert staff_attendance for instructor
  if (occurrence.instructor_confirmed && occurrence.reception_confirmed && gymClass.instructor_id) {
    await pool.query(
      `INSERT INTO staff_attendance
         (gym_id, staff_id, shift_date, shift_start, shift_end, activity, status, deducted_hours, adjustments, confirmed_by, confirmed_at)
       VALUES ($1, $2, $3::date, $4::time, $5::time, 'class', 'present', 0, '[]', $6, NOW())
       ON CONFLICT (staff_id, shift_date, shift_start) DO UPDATE
         SET status = 'present', deducted_hours = 0, confirmed_by = $6, confirmed_at = NOW()`,
      [req.user.gymId, gymClass.instructor_id, class_date, gymClass.start_time, gymClass.end_time, req.user.id]
    );
  }

  res.json(occurrence);
}

// POST /api/classes/:id/cancel-occurrence — receptionist or owner cancels a
// specific date occurrence (inserts class_cancellations, notifies enrolled + staff,
// removes any existing staff_attendance for that class/date).
async function cancelOccurrence(req, res) {
  const gymClass = await fetchClass(req.params.id, req.user.gymId);
  if (!gymClass) return res.status(404).json({ message: "Aula não encontrada." });

  const { class_date } = req.body;
  if (!class_date || !/^\d{4}-\d{2}-\d{2}$/.test(class_date)) {
    return res.status(400).json({ message: "class_date (YYYY-MM-DD) é obrigatório." });
  }

  const alreadyCancelled = await pool.query(
    `SELECT 1 FROM class_cancellations WHERE class_id = $1 AND class_date = $2::date`,
    [gymClass.id, class_date]
  );
  if (alreadyCancelled.rows.length) return res.status(409).json({ message: "Esta ocorrência já foi cancelada." });

  await pool.query(
    `INSERT INTO class_cancellations (class_id, class_date, reason) VALUES ($1, $2::date, 'manual')`,
    [gymClass.id, class_date]
  );
  // Remove any staff_attendance that was created for this confirmed occurrence
  if (gymClass.instructor_id) {
    await pool.query(
      `DELETE FROM staff_attendance
        WHERE gym_id=$1 AND staff_id=$2 AND shift_date=$3::date
          AND shift_start=$4::time AND activity='class'`,
      [req.user.gymId, gymClass.instructor_id, class_date, gymClass.start_time]
    );
  }
  // Remove occurrence record
  await pool.query(
    `DELETE FROM class_occurrences WHERE class_id=$1 AND class_date=$2::date`,
    [gymClass.id, class_date]
  );

  // Notify enrolled members + staff
  const enrolled = await pool.query(
    `SELECT member_id FROM class_enrollments WHERE class_id=$1 AND class_date=$2::date`,
    [gymClass.id, class_date]
  );
  const staff = await pool.query(
    `SELECT id FROM users WHERE gym_id=$1 AND role::text IN ('gym_owner','receptionist','reception_station')`,
    [req.user.gymId]
  );
  const body = `❌ A aula "${gymClass.title}" de ${class_date} (${gymClass.start_time}–${gymClass.end_time}) foi cancelada.`;
  const recipientIds = [
    ...new Set([
      ...enrolled.rows.map((r) => r.member_id),
      ...staff.rows.map((r) => r.id),
    ]),
  ].filter((id) => id !== req.user.id);
  if (recipientIds.length) {
    await pool.query(
      `INSERT INTO messages (sender_id, recipient_id, body) SELECT $1, unnest($2::int[]), $3`,
      [req.user.id, recipientIds, body]
    );
  }

  res.json({ cancelled: true });
}

// DELETE /api/classes/:id/occurrence — receptionist or owner retracts their
// reception confirmation. Also removes the staff_attendance if it was created.
async function unconfirmOccurrence(req, res) {
  const gymClass = await fetchClass(req.params.id, req.user.gymId);
  if (!gymClass) return res.status(404).json({ message: "Aula não encontrada." });

  const class_date = req.body?.class_date || req.query?.class_date;
  if (!class_date || !/^\d{4}-\d{2}-\d{2}$/.test(class_date)) {
    return res.status(400).json({ message: "class_date (YYYY-MM-DD) é obrigatório." });
  }

  const isInstructor = gymClass.instructor_id === req.user.id;
  const isReception  = ["receptionist", "reception_station"].includes(req.user.role) || req.user.role === "gym_owner";
  if (!isInstructor && !isReception) {
    return res.status(403).json({ message: "Sem permissão." });
  }

  const setCols = isInstructor
    ? "instructor_confirmed = false, instructor_confirmed_at = NULL"
    : "reception_confirmed = false, reception_confirmed_at = NULL";

  await pool.query(
    `UPDATE class_occurrences SET ${setCols}
      WHERE class_id=$1 AND class_date=$2::date`,
    [gymClass.id, class_date]
  );

  // If staff_attendance existed (both had confirmed), remove it
  if (gymClass.instructor_id) {
    await pool.query(
      `DELETE FROM staff_attendance
        WHERE gym_id=$1 AND staff_id=$2 AND shift_date=$3::date
          AND shift_start=$4::time AND activity='class'`,
      [req.user.gymId, gymClass.instructor_id, class_date, gymClass.start_time]
    );
  }

  const updated = await pool.query(
    `SELECT * FROM class_occurrences WHERE class_id=$1 AND class_date=$2::date`,
    [gymClass.id, class_date]
  );
  res.json(updated.rows[0] || { instructor_confirmed: false, reception_confirmed: false });
}

// POST /api/classes/auto-cancel — check if any substitute-requested classes for
// today have passed their sub_cutoff_minutes without a taker; cancel them and
// notify enrolled members + staff.
async function autoCancel(req, res) {
  const gymId = req.user.gymId;
  // Hora/dia de "agora" vêm sempre do relógio local do Node (mesma fonte
  // que nextOccurrence/cutoffPassed), nunca do LOCALTIME do Postgres — a
  // sessão da BD pode estar noutro fuso (ex: UTC no Supabase), o que
  // desalinharia o corte em relação ao calculado aqui.
  const now = new Date();
  const today = toDateKey(now);
  const nowMinutes = minutesOf(now);

  // Candidatas: substituto pedido, hoje é o dia da semana certo, ainda não
  // cancelada. O corte da hora é verificado a seguir, em JS.
  const candidates = await pool.query(
    `SELECT gc.id, gc.title, gc.weekday, gc.sub_cutoff_minutes,
            to_char(gc.start_time,'HH24:MI') AS start_time,
            to_char(gc.end_time,'HH24:MI') AS end_time,
            gc.instructor_id
       FROM group_classes gc
      WHERE gc.gym_id = $1
        AND gc.substitute_requested = true
        AND gc.weekday = $2
        AND NOT EXISTS (
          SELECT 1 FROM class_cancellations cc
          WHERE cc.class_id = gc.id AND cc.class_date = $3::date
        )`,
    [gymId, weekdayOf(now), today]
  );
  const overdue = candidates.rows.filter(
    (gc) => toMinutes(gc.start_time) - gc.sub_cutoff_minutes <= nowMinutes
  );

  const cancelled = [];
  for (const gc of overdue) {
    await pool.query(
      `INSERT INTO class_cancellations (class_id, class_date, reason)
       VALUES ($1, $2::date, 'no_instructor') ON CONFLICT DO NOTHING`,
      [gc.id, today]
    );
    // Clear substitute request
    await pool.query(
      `UPDATE group_classes SET substitute_requested = false, substitute_reason = NULL WHERE id = $1`,
      [gc.id]
    );
    // Notify enrolled members + receptionist + CEO
    const enrolled = await pool.query(
      `SELECT member_id FROM class_enrollments WHERE class_id = $1 AND class_date = $2::date`,
      [gc.id, today]
    );
    const staff = await pool.query(
      `SELECT id FROM users WHERE gym_id = $1 AND role::text IN ('gym_owner','receptionist','reception_station')`,
      [gymId]
    );
    const body = `⚠️ A aula "${gc.title}" de hoje (${gc.start_time}–${gc.end_time}) foi cancelada por não haver substituto a tempo.`;
    const recipientIds = new Set([
      ...enrolled.rows.map((r) => r.member_id),
      ...staff.rows.map((r) => r.id),
    ]);
    const systemUserId = (
      await pool.query(`SELECT id FROM users WHERE gym_id = $1 AND role::text = 'gym_owner' LIMIT 1`, [gymId])
    ).rows[0]?.id;
    if (systemUserId) {
      const toNotify = [...recipientIds].filter((id) => id !== systemUserId);
      if (toNotify.length) {
        await pool.query(
          `INSERT INTO messages (sender_id, recipient_id, body) SELECT $1, unnest($2::int[]), $3`,
          [systemUserId, toNotify, body]
        );
      }
    }
    cancelled.push(gc.id);
  }

  res.json({ cancelled });
}

module.exports = {
  enroll,
  unenroll,
  listEnrollments,
  listClasses,
  createClass,
  updateClass,
  deleteClass,
  requestSubstitute,
  cancelSubstitute,
  claimClass,
  confirmOccurrence,
  unconfirmOccurrence,
  cancelOccurrence,
  autoCancel,
  INSTRUCTOR_ROLES,
  ENROLL_ROLES,
};
