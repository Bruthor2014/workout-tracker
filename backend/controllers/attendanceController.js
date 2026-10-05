const pool = require("../db/pool");

// GET /api/attendance/daily?date=YYYY-MM-DD
// Returns all staff shifts for a day with their attendance status.
async function listDaily(req, res) {
  const date = req.query.date || new Date().toLocaleDateString("sv");

  const result = await pool.query(
    `SELECT u.id AS staff_id, u.name AS staff_name, u.role::text AS staff_role, u.avatar_url,
            ss.id AS shift_id,
            to_char(ss.start_time,'HH24:MI') AS shift_start,
            to_char(ss.end_time,'HH24:MI') AS shift_end,
            ss.activity,
            ROUND(EXTRACT(EPOCH FROM (ss.end_time - ss.start_time))/3600.0::numeric, 2) AS shift_hours,
            sa.id AS attendance_id,
            COALESCE(sa.status, 'pending') AS status,
            COALESCE(sa.deducted_hours, 0) AS deducted_hours,
            COALESCE(sa.adjustments, '[]'::jsonb) AS adjustments,
            sa.notes,
            cb.name AS confirmed_by_name,
            sa.confirmed_at
       FROM staff_shifts ss
       JOIN users u ON u.id = ss.staff_id
       LEFT JOIN staff_attendance sa
            ON sa.staff_id = ss.staff_id AND sa.gym_id = ss.gym_id
           AND sa.shift_date = $2::date AND sa.shift_start = ss.start_time
       LEFT JOIN users cb ON cb.id = sa.confirmed_by
      WHERE ss.gym_id = $1
        AND ss.weekday = EXTRACT(ISODOW FROM $2::date)::int
      ORDER BY ss.start_time, u.name`,
    [req.user.gymId, date]
  );
  res.json(result.rows);
}

// POST /api/attendance
// Create or update a staff attendance record (receptionist only, only for today).
async function upsertAttendance(req, res) {
  const { staff_id, shift_date, shift_start, shift_end, activity, status, adjustments, notes } = req.body;
  if (!staff_id || !shift_date || !shift_start || !shift_end)
    return res.status(400).json({ message: "staff_id, shift_date, shift_start, shift_end são obrigatórios." });

  // Compute deducted_hours from adjustments
  let deductedMinutes = 0;
  if (status === "absent") {
    // Full shift is absent — compute full shift duration
    const [sh, sm] = shift_start.split(":").map(Number);
    const [eh, em] = shift_end.split(":").map(Number);
    deductedMinutes = (eh * 60 + em) - (sh * 60 + sm);
  } else if (Array.isArray(adjustments)) {
    for (const adj of adjustments) {
      if (adj.type === "late") {
        deductedMinutes += Number(adj.minutes || 0);
      } else if (adj.type === "out") {
        const [fh, fm] = (adj.from || "0:0").split(":").map(Number);
        const [th, tm] = (adj.to || "0:0").split(":").map(Number);
        deductedMinutes += (th * 60 + tm) - (fh * 60 + fm);
      }
    }
  }
  const deducted_hours = Math.max(0, deductedMinutes / 60);

  const result = await pool.query(
    `INSERT INTO staff_attendance
       (gym_id, staff_id, shift_date, shift_start, shift_end, activity, status, deducted_hours, adjustments, confirmed_by, confirmed_at, notes)
     VALUES ($1,$2,$3::date,$4::time,$5::time,$6,$7,$8,$9,$10,now(),$11)
     ON CONFLICT (staff_id, shift_date, shift_start)
     DO UPDATE SET shift_end=$5::time, activity=$6, status=$7, deducted_hours=$8,
                   adjustments=$9, confirmed_by=$10, confirmed_at=now(), notes=$11
     RETURNING id`,
    [
      req.user.gymId, Number(staff_id), shift_date,
      shift_start, shift_end, activity || "floor",
      status || "present", deducted_hours,
      JSON.stringify(adjustments || []),
      req.user.id, notes || null,
    ]
  );
  res.status(201).json({ id: result.rows[0].id, deducted_hours });
}

// GET /api/attendance/week-summary?staff_id=X&week=YYYY-MM-DD
// Returns per-activity totals for a week, from staff_attendance records.
// Used by AddWeekModal to auto-fill hours.
async function getWeekSummary(req, res) {
  const { staff_id, week } = req.query;
  if (!staff_id || !week) return res.status(400).json({ message: "staff_id e week são obrigatórios." });

  const result = await pool.query(
    `SELECT sa.activity,
            SUM(ROUND(EXTRACT(EPOCH FROM (sa.shift_end - sa.shift_start))/3600.0::numeric, 2)) AS total_hours,
            SUM(sa.deducted_hours) AS deducted_hours,
            COUNT(*) FILTER (WHERE sa.status='absent') AS absent_shifts
       FROM staff_attendance sa
      WHERE sa.gym_id=$1 AND sa.staff_id=$2
        AND sa.shift_date >= $3::date
        AND sa.shift_date < $3::date + INTERVAL '7 days'
      GROUP BY sa.activity`,
    [req.user.gymId, Number(staff_id), week]
  );

  const totalAbsentHours = result.rows.reduce((s, r) => s + Number(r.deducted_hours), 0);
  res.json({ activities: result.rows, total_absent_hours: totalAbsentHours });
}

// GET /api/attendance/monthly?staff_id=X&month=YYYY-MM
// Returns all attendance records for a staff member in a month.
async function getMonthlyAttendance(req, res) {
  const { staff_id, month } = req.query;
  if (!staff_id || !month) return res.status(400).json({ message: "staff_id e month são obrigatórios." });

  const result = await pool.query(
    `SELECT to_char(sa.shift_date,'YYYY-MM-DD') AS shift_date,
            EXTRACT(ISODOW FROM sa.shift_date)::int AS weekday,
            to_char(sa.shift_start,'HH24:MI') AS shift_start,
            to_char(sa.shift_end,'HH24:MI') AS shift_end,
            sa.activity, sa.status, sa.deducted_hours, sa.adjustments, sa.notes,
            cb.name AS confirmed_by_name, sa.confirmed_at
       FROM staff_attendance sa
       LEFT JOIN users cb ON cb.id = sa.confirmed_by
      WHERE sa.gym_id=$1 AND sa.staff_id=$2
        AND sa.shift_date >= ($3 || '-01')::date
        AND sa.shift_date < ($3 || '-01')::date + INTERVAL '1 month'
      ORDER BY sa.shift_date, sa.shift_start`,
    [req.user.gymId, Number(staff_id), month]
  );
  res.json(result.rows);
}

module.exports = { listDaily, upsertAttendance, getWeekSummary, getMonthlyAttendance };
