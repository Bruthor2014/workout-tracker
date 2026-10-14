const pool = require("../db/pool");
const { findConflict } = require("../utils/staffBusy");

// Horários da equipa: turnos semanais (sala, aula, receção...) que o CEO
// atribui a cada membro da equipa. Cada um vê o seu em "O meu horário",
// junto com as aulas de grupo de que é responsável.

const ACTIVITIES = ["floor", "class", "reception", "assessments", "admin", "other"];
const STAFF_ROLES = ["personal_trainer", "nutritionist", "receptionist", "intern"];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const SHIFT_COLUMNS = `s.id, s.staff_id, s.weekday,
       to_char(s.start_time, 'HH24:MI') AS start_time, to_char(s.end_time, 'HH24:MI') AS end_time,
       s.activity, s.location, s.notes, u.name AS staff_name, u.role AS staff_role`;

// Valida o corpo; devolve a mensagem de erro ou null. Recusa turnos que se
// sobreponham a outro turno da mesma pessoa (exceto o próprio, ao editar).
async function validateShift(body, gymId, shiftId = null) {
  const { staff_id, weekday, start_time, end_time, activity } = body;
  const staff = await pool.query(`SELECT role FROM users WHERE id = $1 AND gym_id = $2`, [staff_id, gymId]);
  if (!staff.rows[0] || !STAFF_ROLES.includes(staff.rows[0].role)) return "Escolhe um membro da equipa.";
  if (!Number.isInteger(Number(weekday)) || weekday < 1 || weekday > 7) return "Dia da semana inválido.";
  if (!TIME_RE.test(start_time || "") || !TIME_RE.test(end_time || "")) return "Horas inválidas (HH:MM).";
  if (end_time <= start_time) return "A hora de fim tem de ser depois da de início.";
  if (!ACTIVITIES.includes(activity)) return "Atividade inválida.";
  const overlap = await pool.query(
    `SELECT 1 FROM staff_shifts
      WHERE staff_id = $1 AND weekday = $2 AND start_time < $4::time AND end_time > $3::time
        AND ($5::int IS NULL OR id <> $5)`,
    [staff_id, weekday, start_time, end_time, shiftId]
  );
  if (overlap.rows.length) return "Este turno sobrepõe-se a outro turno da mesma pessoa.";
  // Nem com as sessões que a pessoa tem com clientes.
  return findConflict(staff_id, Number(weekday), start_time, end_time, { check: ["sessions"] });
}

function shiftValues(body) {
  return [
    body.staff_id,
    Number(body.weekday),
    body.start_time,
    body.end_time,
    body.activity,
    body.location ? String(body.location).trim().slice(0, 80) : null,
    body.notes ? String(body.notes).trim() : null,
  ];
}

async function fetchShift(id, gymId) {
  const result = await pool.query(
    `SELECT ${SHIFT_COLUMNS} FROM staff_shifts s JOIN users u ON u.id = s.staff_id WHERE s.id = $1 AND s.gym_id = $2`,
    [id, gymId]
  );
  return result.rows[0] || null;
}

// GET /api/shifts/staff — equipa do ginásio (para escolher a quem atribuir)
async function listStaff(req, res) {
  const result = await pool.query(
    `SELECT id, name, role, avatar_url FROM users
      WHERE gym_id = $1 AND role = ANY($2::user_role[])
      ORDER BY name`,
    [req.user.gymId, STAFF_ROLES]
  );
  res.json(result.rows);
}

// GET /api/shifts?staff_id= — CEO: turnos de uma pessoa (ou de toda a equipa)
async function listShifts(req, res) {
  const result = await pool.query(
    `SELECT ${SHIFT_COLUMNS}
       FROM staff_shifts s JOIN users u ON u.id = s.staff_id
      WHERE s.gym_id = $1 AND ($2::int IS NULL OR s.staff_id = $2)
      ORDER BY s.weekday, s.start_time`,
    [req.user.gymId, Number(req.query.staff_id) || null]
  );
  res.json(result.rows);
}

// GET /api/shifts/me — o próprio: os seus turnos
async function listMyShifts(req, res) {
  const result = await pool.query(
    `SELECT ${SHIFT_COLUMNS}
       FROM staff_shifts s JOIN users u ON u.id = s.staff_id
      WHERE s.staff_id = $1
      ORDER BY s.weekday, s.start_time`,
    [req.user.id]
  );
  res.json(result.rows);
}

async function createShift(req, res) {
  const error = await validateShift(req.body, req.user.gymId);
  if (error) return res.status(400).json({ message: error });
  const result = await pool.query(
    `INSERT INTO staff_shifts (staff_id, weekday, start_time, end_time, activity, location, notes, gym_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [...shiftValues(req.body), req.user.gymId]
  );
  res.status(201).json(await fetchShift(result.rows[0].id, req.user.gymId));
}

async function updateShift(req, res) {
  if (!(await fetchShift(req.params.id, req.user.gymId))) return res.status(404).json({ message: "Turno não encontrado." });
  const error = await validateShift(req.body, req.user.gymId, Number(req.params.id));
  if (error) return res.status(400).json({ message: error });
  await pool.query(
    `UPDATE staff_shifts
        SET staff_id = $1, weekday = $2, start_time = $3, end_time = $4, activity = $5, location = $6, notes = $7
      WHERE id = $8 AND gym_id = $9`,
    [...shiftValues(req.body), req.params.id, req.user.gymId]
  );
  res.json(await fetchShift(req.params.id, req.user.gymId));
}

async function deleteShift(req, res) {
  const result = await pool.query(`DELETE FROM staff_shifts WHERE id = $1 AND gym_id = $2 RETURNING id`, [
    req.params.id,
    req.user.gymId,
  ]);
  if (result.rows.length === 0) return res.status(404).json({ message: "Turno não encontrado." });
  res.status(204).send();
}

// DELETE /shifts?staff_id=X  → limpa todos os turnos de uma pessoa
// DELETE /shifts              → limpa todos os turnos do ginásio
async function clearShifts(req, res) {
  const { staff_id } = req.query;
  if (staff_id) {
    const staff = await pool.query("SELECT id FROM users WHERE id = $1 AND gym_id = $2", [Number(staff_id), req.user.gymId]);
    if (!staff.rows[0]) return res.status(404).json({ message: "Staff não encontrado." });
    await pool.query("DELETE FROM staff_shifts WHERE gym_id = $1 AND staff_id = $2", [req.user.gymId, Number(staff_id)]);
  } else {
    await pool.query("DELETE FROM staff_shifts WHERE gym_id = $1", [req.user.gymId]);
  }
  res.json({ message: "Turnos removidos." });
}

module.exports = { listStaff, listShifts, listMyShifts, createShift, updateShift, deleteShift, clearShifts, STAFF_ROLES };
