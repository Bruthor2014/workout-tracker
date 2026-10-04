const pool = require("../db/pool");

// GET /api/finance/staff — lista todo o staff com as suas taxas e totais do mês atual.
async function listStaffFinance(req, res) {
  const result = await pool.query(
    `SELECT u.id, u.name, u.role::text, u.avatar_url,
            COALESCE(sr.base_salary, 0)      AS base_salary,
            COALESCE(sr.rate_reception_h, 0) AS rate_reception_h,
            COALESCE(sr.rate_sala_h, 0)      AS rate_sala_h,
            COALESCE(sr.rate_class_h, 0)     AS rate_class_h,
            COALESCE(sr.rate_pt_month, 0)    AS rate_pt_month,
            sr.gym_cut_pct,
            sr.gym_cut_fixed,
            COALESCE(m.hours_reception, 0) AS month_hours_reception,
            COALESCE(m.hours_sala,      0) AS month_hours_sala,
            COALESCE(m.hours_class,     0) AS month_hours_class,
            COALESCE(m.pt_clients,      0) AS month_pt_clients
       FROM users u
       LEFT JOIN staff_rates sr ON sr.staff_id = u.id AND sr.gym_id = $1
       LEFT JOIN LATERAL (
         SELECT SUM(pw.hours_reception)::numeric  AS hours_reception,
                SUM(pw.hours_sala)::numeric        AS hours_sala,
                SUM(pw.hours_class)::numeric       AS hours_class,
                MAX(pw.pt_clients_count)           AS pt_clients
           FROM payroll_weeks pw
          WHERE pw.staff_id = u.id AND pw.gym_id = $1
            AND pw.week_start >= date_trunc('month', CURRENT_DATE)
       ) m ON true
      WHERE u.gym_id = $1 AND u.role::text IN ('personal_trainer','nutritionist','receptionist','intern')
      ORDER BY u.name`,
    [req.user.gymId]
  );
  res.json(result.rows);
}

// GET /api/finance/weeks — semanas do mês corrente (ou ?month=YYYY-MM) com registos.
async function listWeeks(req, res) {
  const monthParam = req.query.month;
  const monthStart = monthParam ? `${monthParam}-01` : null;

  const result = await pool.query(
    `SELECT pw.id, pw.staff_id, u.name AS staff_name, u.role::text AS staff_role,
            pw.week_start, pw.hours_reception, pw.hours_sala, pw.hours_class, pw.pt_clients_count,
            pw.absent_hours, pw.absent_deduction,
            pw.notes, pw.confirmed, pw.confirmed_at,
            cb.name AS confirmed_by_name,
            COALESCE(sr.base_salary, 0)      AS base_salary,
            COALESCE(sr.rate_reception_h, 0) AS rate_reception_h,
            COALESCE(sr.rate_sala_h, 0)      AS rate_sala_h,
            COALESCE(sr.rate_class_h, 0)     AS rate_class_h,
            COALESCE(sr.rate_pt_month, 0)    AS rate_pt_month,
            sr.gym_cut_pct,
            sr.gym_cut_fixed
       FROM payroll_weeks pw
       JOIN users u ON u.id = pw.staff_id
       LEFT JOIN users cb ON cb.id = pw.confirmed_by
       LEFT JOIN staff_rates sr ON sr.staff_id = pw.staff_id AND sr.gym_id = pw.gym_id
      WHERE pw.gym_id = $1
        AND pw.week_start >= COALESCE($2::date, date_trunc('month', CURRENT_DATE))
        AND pw.week_start <  COALESCE($2::date, date_trunc('month', CURRENT_DATE)) + INTERVAL '1 month'
      ORDER BY pw.week_start DESC, u.name`,
    [req.user.gymId, monthStart]
  );
  res.json(result.rows);
}

// PUT /api/finance/rates/:staffId — CEO define ou actualiza as taxas de um membro da equipa.
async function upsertRates(req, res) {
  const staffId = Number(req.params.staffId);
  const { base_salary, rate_reception_h, rate_sala_h, rate_class_h, rate_pt_month, gym_cut_pct, gym_cut_fixed } = req.body;

  const staff = await pool.query(
    "SELECT id FROM users WHERE id = $1 AND gym_id = $2",
    [staffId, req.user.gymId]
  );
  if (!staff.rows[0]) return res.status(404).json({ message: "Staff não encontrado." });

  await pool.query(
    `INSERT INTO staff_rates (staff_id, gym_id, base_salary, rate_reception_h, rate_sala_h, rate_class_h, rate_pt_month, gym_cut_pct, gym_cut_fixed, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
     ON CONFLICT (staff_id, gym_id)
     DO UPDATE SET base_salary = $3, rate_reception_h = $4, rate_sala_h = $5, rate_class_h = $6,
                   rate_pt_month = $7, gym_cut_pct = $8, gym_cut_fixed = $9, updated_at = now()`,
    [staffId, req.user.gymId,
     base_salary ?? 0, rate_reception_h ?? 0, rate_sala_h ?? 0,
     rate_class_h ?? 0, rate_pt_month ?? 0,
     gym_cut_pct ?? null, gym_cut_fixed ?? null]
  );
  res.json({ message: "Taxas actualizadas." });
}

// POST /api/finance/weeks — cria ou actualiza um registo semanal.
async function upsertWeek(req, res) {
  const { staff_id, week_start, hours_reception, hours_sala, hours_class, pt_clients_count, absent_hours, absent_deduction, notes } = req.body;
  if (!staff_id || !week_start) return res.status(400).json({ message: "staff_id e week_start são obrigatórios." });

  const staff = await pool.query(
    "SELECT id FROM users WHERE id = $1 AND gym_id = $2",
    [Number(staff_id), req.user.gymId]
  );
  if (!staff.rows[0]) return res.status(404).json({ message: "Staff não encontrado." });

  const result = await pool.query(
    `INSERT INTO payroll_weeks (staff_id, gym_id, week_start, hours_reception, hours_sala, hours_class, pt_clients_count, absent_hours, absent_deduction, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (staff_id, week_start)
     DO UPDATE SET hours_reception = $4, hours_sala = $5, hours_class = $6, pt_clients_count = $7,
                   absent_hours = $8, absent_deduction = $9,
                   notes = $10, confirmed = false, confirmed_by = null, confirmed_at = null
     RETURNING id`,
    [Number(staff_id), req.user.gymId, week_start,
     hours_reception ?? 0, hours_sala ?? 0, hours_class ?? 0,
     pt_clients_count ?? 0, absent_hours ?? 0, absent_deduction ?? 0, notes || null]
  );
  res.status(201).json({ id: result.rows[0].id });
}

// POST /api/finance/weeks/:id/confirm — CEO confirma um registo semanal.
async function confirmWeek(req, res) {
  const weekId = Number(req.params.id);
  const row = await pool.query("SELECT id, gym_id FROM payroll_weeks WHERE id = $1", [weekId]);
  if (!row.rows[0] || row.rows[0].gym_id !== req.user.gymId) return res.status(404).json({ message: "Registo não encontrado." });

  await pool.query(
    "UPDATE payroll_weeks SET confirmed = true, confirmed_by = $1, confirmed_at = now() WHERE id = $2",
    [req.user.id, weekId]
  );
  res.json({ message: "Confirmado." });
}

// GET /api/finance/my?month=YYYY-MM — PT vê o seu próprio resumo mensal.
async function getMyFinance(req, res) {
  const monthParam = req.query.month;
  const monthStart = monthParam ? `${monthParam}-01` : null;

  const [ratesRow, weeksRow, absRow] = await Promise.all([
    pool.query(
      `SELECT COALESCE(base_salary,0) AS base_salary,
              COALESCE(rate_reception_h,0) AS rate_reception_h,
              COALESCE(rate_sala_h,0) AS rate_sala_h,
              COALESCE(rate_class_h,0) AS rate_class_h,
              COALESCE(rate_pt_month,0) AS rate_pt_month,
              gym_cut_pct, gym_cut_fixed
         FROM staff_rates WHERE staff_id=$1 AND gym_id=$2`,
      [req.user.id, req.user.gymId]
    ),
    pool.query(
      `SELECT week_start, hours_sala, hours_reception, hours_class, pt_clients_count,
              absent_hours, absent_deduction
         FROM payroll_weeks
        WHERE staff_id=$1 AND gym_id=$2
          AND week_start >= COALESCE($3::date, date_trunc('month', CURRENT_DATE))
          AND week_start <  COALESCE($3::date, date_trunc('month', CURRENT_DATE)) + INTERVAL '1 month'
        ORDER BY week_start`,
      [req.user.id, req.user.gymId, monthStart]
    ),
    // Presenças: todos os turnos do mês até hoje, com status da receção
    pool.query(
      `WITH month_bounds AS (
         SELECT COALESCE($3::date, date_trunc('month', CURRENT_DATE)::date) AS ms
       ),
       week_shifts AS (
         SELECT ss.weekday, ss.start_time, ss.end_time, ss.activity,
                (SELECT ms FROM month_bounds)
                  + ((ss.weekday - EXTRACT(ISODOW FROM (SELECT ms FROM month_bounds))::int + 7) % 7)
                  + generate_series(0,4)*7 AS shift_date
           FROM staff_shifts ss
          WHERE ss.staff_id=$1 AND ss.gym_id=$2
       ),
       dated AS (
         SELECT ws.shift_date, ws.weekday, ws.start_time, ws.end_time, ws.activity,
                EXTRACT(EPOCH FROM (ws.end_time::time - ws.start_time::time))/3600.0 AS hours
           FROM week_shifts ws
          WHERE ws.shift_date >= (SELECT ms FROM month_bounds)
            AND ws.shift_date < (SELECT ms FROM month_bounds) + INTERVAL '1 month'
            AND ws.shift_date <= CURRENT_DATE
       )
       SELECT to_char(d.shift_date,'YYYY-MM-DD') AS shift_date, d.weekday,
              to_char(d.start_time,'HH24:MI') AS start_time,
              to_char(d.end_time,'HH24:MI') AS end_time,
              d.activity,
              ROUND(d.hours::numeric,2) AS shift_hours,
              COALESCE(sa.status, 'pending') AS status,
              COALESCE(sa.deducted_hours, 0) AS deducted_hours
         FROM dated d
         LEFT JOIN staff_attendance sa
              ON sa.staff_id=$1 AND sa.gym_id=$2
             AND sa.shift_date=d.shift_date AND sa.shift_start=d.start_time
        ORDER BY d.shift_date, d.start_time`,
      [req.user.id, req.user.gymId, monthStart]
    ),
  ]);

  res.json({
    rates: ratesRow.rows[0] || null,
    weeks: weeksRow.rows,
    attendance: absRow.rows,
  });
}

// GET /api/finance/payments?month=YYYY-MM — lista pagamentos mensais (CEO).
async function listPayments(req, res) {
  const monthParam = req.query.month;
  const monthStart = monthParam ? `${monthParam}-01` : null;

  const result = await pool.query(
    `SELECT mp.id, mp.staff_id, u.name AS staff_name, u.role::text AS staff_role,
            to_char(mp.month_year,'YYYY-MM') AS month_year,
            mp.hours_sala, mp.hours_reception, mp.hours_class, mp.pt_clients_count,
            mp.absent_hours, mp.gross, mp.gym_cut, mp.absent_deduction, mp.net,
            mp.paid_at, mp.notes, cb.name AS confirmed_by_name
       FROM monthly_payments mp
       JOIN users u ON u.id = mp.staff_id
       LEFT JOIN users cb ON cb.id = mp.confirmed_by
      WHERE mp.gym_id=$1
        AND mp.month_year = COALESCE($2::date, date_trunc('month', CURRENT_DATE))
      ORDER BY u.name`,
    [req.user.gymId, monthStart]
  );
  res.json(result.rows);
}

// POST /api/finance/payments — CEO cria registo de pagamento para um membro (mês inteiro).
async function createPayment(req, res) {
  const { staff_id, month, hours_sala, hours_reception, hours_class, pt_clients_count,
          absent_hours, gross, gym_cut, absent_deduction, net, notes } = req.body;
  if (!staff_id || !month) return res.status(400).json({ message: "staff_id e month são obrigatórios." });

  const staff = await pool.query(
    "SELECT id FROM users WHERE id=$1 AND gym_id=$2",
    [Number(staff_id), req.user.gymId]
  );
  if (!staff.rows[0]) return res.status(404).json({ message: "Staff não encontrado." });

  const result = await pool.query(
    `INSERT INTO monthly_payments
       (staff_id, gym_id, month_year, hours_sala, hours_reception, hours_class, pt_clients_count,
        absent_hours, gross, gym_cut, absent_deduction, net, confirmed_by, notes)
     VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (staff_id, month_year)
     DO UPDATE SET hours_sala=$4, hours_reception=$5, hours_class=$6, pt_clients_count=$7,
                   absent_hours=$8, gross=$9, gym_cut=$10, absent_deduction=$11, net=$12,
                   confirmed_by=$13, notes=$14, paid_at=now()
     RETURNING id`,
    [Number(staff_id), req.user.gymId, `${month}-01`,
     hours_sala??0, hours_reception??0, hours_class??0, pt_clients_count??0,
     absent_hours??0, gross??0, gym_cut??0, absent_deduction??0, net??0,
     req.user.id, notes||null]
  );
  res.status(201).json({ id: result.rows[0].id });
}

// DELETE /api/finance/payments/:id — CEO anula um pagamento.
async function deletePayment(req, res) {
  const row = await pool.query(
    "SELECT id FROM monthly_payments WHERE id=$1 AND gym_id=$2",
    [Number(req.params.id), req.user.gymId]
  );
  if (!row.rows[0]) return res.status(404).json({ message: "Pagamento não encontrado." });
  await pool.query("DELETE FROM monthly_payments WHERE id=$1", [Number(req.params.id)]);
  res.status(204).send();
}

// GET /api/finance/my/payments — PT vê o historial de pagamentos recebidos.
async function getMyPayments(req, res) {
  const result = await pool.query(
    `SELECT to_char(mp.month_year,'YYYY-MM') AS month_year, mp.hours_sala, mp.hours_reception,
            mp.hours_class, mp.pt_clients_count, mp.absent_hours, mp.gross, mp.gym_cut,
            mp.absent_deduction, mp.net, mp.paid_at
       FROM monthly_payments mp
      WHERE mp.staff_id=$1 AND mp.gym_id=$2
      ORDER BY mp.month_year DESC`,
    [req.user.id, req.user.gymId]
  );
  res.json(result.rows);
}

module.exports = {
  listStaffFinance, listWeeks, upsertRates, upsertWeek, confirmWeek,
  getMyFinance, listPayments, createPayment, deletePayment, getMyPayments,
};
