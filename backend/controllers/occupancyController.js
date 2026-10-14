const pool = require("../db/pool");

const STAFF_ROLES = ["personal_trainer", "nutritionist", "receptionist", "intern", "gym_owner"];

// GET /api/occupancy/live — quem está agora no ginásio.
// Staff aparece primeiro, depois membros; todos com role::text para evitar cast error.
async function getLive(req, res) {
  const result = await pool.query(
    `SELECT gc.id, gc.user_id, u.name, u.avatar_url, u.role::text AS role,
            gc.checked_in_at
       FROM gym_checkins gc
       JOIN users u ON u.id = gc.user_id
      WHERE gc.gym_id = $1 AND gc.checked_out_at IS NULL
      ORDER BY CASE WHEN u.role::text = 'member' THEN 1 ELSE 0 END, gc.checked_in_at`,
    [req.user.gymId]
  );
  res.json(result.rows);
}

// GET /api/occupancy/history?date=YYYY-MM-DD — historial do dia (default: hoje).
async function getHistory(req, res) {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const result = await pool.query(
    `SELECT gc.id, gc.user_id, u.name, u.avatar_url, u.role::text AS role,
            gc.checked_in_at, gc.checked_out_at
       FROM gym_checkins gc
       JOIN users u ON u.id = gc.user_id
      WHERE gc.gym_id = $1
        AND gc.checked_in_at::date = $2::date
      ORDER BY CASE WHEN u.role::text = 'member' THEN 1 ELSE 0 END, gc.checked_in_at DESC`,
    [req.user.gymId, date]
  );
  res.json(result.rows);
}

// POST /api/occupancy/checkin — registo manual de entrada.
async function checkIn(req, res) {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ message: "user_id é obrigatório." });

  const user = await pool.query("SELECT id FROM users WHERE id = $1 AND gym_id = $2", [Number(user_id), req.user.gymId]);
  if (!user.rows[0]) return res.status(404).json({ message: "Utilizador não encontrado neste ginásio." });

  await pool.query(
    "UPDATE gym_checkins SET checked_out_at = now() WHERE user_id = $1 AND gym_id = $2 AND checked_out_at IS NULL",
    [Number(user_id), req.user.gymId]
  );

  const result = await pool.query(
    "INSERT INTO gym_checkins (user_id, gym_id) VALUES ($1, $2) RETURNING id, checked_in_at",
    [Number(user_id), req.user.gymId]
  );
  res.status(201).json(result.rows[0]);
}

// POST /api/occupancy/checkout — registo manual de saída.
async function checkOut(req, res) {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ message: "user_id é obrigatório." });

  const result = await pool.query(
    `UPDATE gym_checkins SET checked_out_at = now()
      WHERE user_id = $1 AND gym_id = $2 AND checked_out_at IS NULL
      RETURNING id`,
    [Number(user_id), req.user.gymId]
  );
  if (!result.rows[0]) return res.status(404).json({ message: "Não há check-in activo para este utilizador." });
  res.json({ message: "Check-out registado." });
}

// GET /api/occupancy/absences?week=YYYY-MM-DD (segunda-feira da semana)
// Devolve todos os turnos agendados da semana e se cada membro da equipa esteve presente.
async function getAbsences(req, res) {
  const weekStart = req.query.week || getMondayISO(new Date());

  const result = await pool.query(
    `WITH week_shifts AS (
       SELECT ss.staff_id, ss.gym_id, ss.weekday, ss.activity,
              $1::date + (ss.weekday - 1) AS shift_date,
              ss.start_time, ss.end_time,
              ROUND(EXTRACT(EPOCH FROM (ss.end_time::time - ss.start_time::time))/3600.0, 2) AS shift_hours
         FROM staff_shifts ss
        WHERE ss.gym_id = $2
     ),
     absence_check AS (
       SELECT ws.*, u.name AS staff_name, u.role::text AS staff_role,
              NOT EXISTS (
                SELECT 1 FROM gym_checkins gc
                 WHERE gc.user_id = ws.staff_id AND gc.gym_id = $2
                   AND gc.checked_in_at::date = ws.shift_date
                   AND gc.checked_in_at::time < ws.end_time
                   AND (gc.checked_out_at IS NULL OR gc.checked_out_at::time > ws.start_time)
              ) AS was_absent
         FROM week_shifts ws
         JOIN users u ON u.id = ws.staff_id
     )
     SELECT ac.staff_id, ac.staff_name, ac.staff_role, ac.shift_date, ac.weekday,
            to_char(ac.start_time, 'HH24:MI') AS start_time,
            to_char(ac.end_time, 'HH24:MI') AS end_time,
            ac.activity, ac.shift_hours::numeric AS shift_hours, ac.was_absent,
            CASE ac.activity
              WHEN 'reception' THEN COALESCE(sr.rate_reception_h, 0)
              WHEN 'class'     THEN COALESCE(sr.rate_class_h, 0)
              ELSE                  COALESCE(sr.rate_sala_h, 0)
            END AS hourly_rate
       FROM absence_check ac
       LEFT JOIN staff_rates sr ON sr.staff_id = ac.staff_id AND sr.gym_id = $2
      ORDER BY ac.shift_date, ac.start_time, ac.staff_name`,
    [weekStart, req.user.gymId]
  );
  res.json(result.rows);
}

function getMondayISO(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

module.exports = { getLive, getHistory, checkIn, checkOut, getAbsences };
