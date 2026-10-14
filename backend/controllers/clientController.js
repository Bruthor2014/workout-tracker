const pool = require("../db/pool");
const { findConflict } = require("../utils/staffBusy");

// Clientes de cada PT / nutricionista: os membros com uma subscrição ativa
// (personal_training / nutrition_plan) atribuída a essa pessoa. O PT marca
// sessões semanais com cada cliente (o nutricionista, consultas) — horas
// que não podem coincidir com turnos, aulas ou outras sessões.

const SERVICE_FOR_ROLE = { personal_trainer: "personal_training", nutritionist: "nutrition_plan" };
const PLANS_TABLE = { personal_trainer: "workout_plans", nutritionist: "nutrition_plans" };
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const SESSION_COLUMNS = `cs.id, cs.staff_id, cs.member_id, cs.weekday,
       to_char(cs.start_time, 'HH24:MI') AS start_time, to_char(cs.end_time, 'HH24:MI') AS end_time,
       cs.notes, m.name AS member_name, s.name AS staff_name, s.role AS staff_role`;

// GET /api/clients — os meus clientes (ginásio + externos).
async function listClients(req, res) {
  const service = SERVICE_FOR_ROLE[req.user.role];
  const plans = PLANS_TABLE[req.user.role];

  // Clientes do ginásio: subscrição ativa atribuída a este coach.
  const gymClients = await pool.query(
    `SELECT u.id, u.name, u.email, u.avatar_url, ms.started_at, 'gym' AS source,
            bm.weight_kg AS last_weight_kg,
            (SELECT COUNT(*)::int FROM workout_sessions
              WHERE user_id = u.id AND performed_at >= CURRENT_DATE - INTERVAL '30 days') AS workouts_30d,
            (SELECT COUNT(*)::int FROM ${plans} p WHERE p.member_id = u.id AND p.created_by = $2) AS my_plans
       FROM member_subscriptions ms
       JOIN users u ON u.id = ms.member_id
       LEFT JOIN LATERAL (
         SELECT weight_kg FROM body_metrics WHERE member_id = u.id ORDER BY recorded_at DESC LIMIT 1
       ) bm ON true
      WHERE ms.is_active AND ms.service_type = $1 AND ms.assigned_staff_id = $2 AND u.gym_id = $3
      ORDER BY u.name`,
    [service, req.user.id, req.user.gymId]
  );

  // Clientes externos: ligados via código de convite.
  const extClients = await pool.query(
    `SELECT u.id, u.name, u.email, u.avatar_url, ecc.created_at AS started_at, 'external' AS source,
            bm.weight_kg AS last_weight_kg,
            (SELECT COUNT(*)::int FROM workout_sessions
              WHERE user_id = u.id AND performed_at >= CURRENT_DATE - INTERVAL '30 days') AS workouts_30d,
            (SELECT COUNT(*)::int FROM ${plans} p WHERE p.member_id = u.id AND p.created_by = $1) AS my_plans
       FROM external_coach_clients ecc
       JOIN users u ON u.id = ecc.client_id
       LEFT JOIN LATERAL (
         SELECT weight_kg FROM body_metrics WHERE member_id = u.id ORDER BY recorded_at DESC LIMIT 1
       ) bm ON true
      WHERE ecc.coach_id = $1
      ORDER BY u.name`,
    [req.user.id]
  );

  // Juntar, sem duplicados (caso alguém seja os dois).
  const gymIds = new Set(gymClients.rows.map((r) => r.id));
  const all = [
    ...gymClients.rows,
    ...extClients.rows.filter((r) => !gymIds.has(r.id)),
  ];
  res.json(all);
}

// GET /api/clients/sessions — as minhas sessões (o CEO vê as do ginásio todo).
async function listSessions(req, res) {
  const isOwner = req.user.role === "gym_owner";
  const result = await pool.query(
    `SELECT ${SESSION_COLUMNS}
       FROM client_sessions cs
       JOIN users m ON m.id = cs.member_id
       JOIN users s ON s.id = cs.staff_id
      WHERE cs.gym_id = $1 AND ($2::int IS NULL OR cs.staff_id = $2)
      ORDER BY cs.weekday, cs.start_time`,
    [req.user.gymId, isOwner ? null : req.user.id]
  );
  res.json(result.rows);
}

async function fetchSession(id, gymId) {
  if (!Number.isInteger(Number(id))) return null;
  const result = await pool.query(
    `SELECT ${SESSION_COLUMNS}
       FROM client_sessions cs JOIN users m ON m.id = cs.member_id JOIN users s ON s.id = cs.staff_id
      WHERE cs.id = $1 AND cs.gym_id = $2`,
    [id, gymId]
  );
  return result.rows[0] || null;
}

// Valida o corpo; devolve a mensagem de erro ou null.
async function validateSession(body, user, sessionId = null) {
  const { member_id, weekday, start_time, end_time } = body;
  const client = await pool.query(
    `SELECT 1 FROM member_subscriptions
      WHERE member_id = $1 AND assigned_staff_id = $2 AND service_type = $3 AND is_active`,
    [member_id, user.id, SERVICE_FOR_ROLE[user.role]]
  );
  if (!client.rows.length) return "Escolhe um dos teus clientes.";
  if (!Number.isInteger(Number(weekday)) || weekday < 1 || weekday > 7) return "Dia da semana inválido.";
  if (!TIME_RE.test(start_time || "") || !TIME_RE.test(end_time || "")) return "Horas inválidas (HH:MM).";
  if (end_time <= start_time) return "A hora de fim tem de ser depois da de início.";
  if (start_time < "06:00" || end_time > "23:00") return "O ginásio só está aberto das 06:00 às 23:00.";

  const conflict = await findConflict(user.id, Number(weekday), start_time, end_time, { ignore: { session: sessionId } });
  if (conflict) return conflict;
  // O cliente também não pode ter duas sessões ao mesmo tempo.
  const memberBusy = await pool.query(
    `SELECT 1 FROM client_sessions
      WHERE member_id = $1 AND weekday = $2 AND start_time < $4::time AND end_time > $3::time
        AND ($5::int IS NULL OR id <> $5)`,
    [member_id, weekday, start_time, end_time, sessionId]
  );
  if (memberBusy.rows.length) return "O cliente já tem outra sessão a essa hora.";
  return null;
}

const sessionValues = (body) => [
  Number(body.member_id),
  Number(body.weekday),
  body.start_time,
  body.end_time,
  body.notes ? String(body.notes).trim().slice(0, 300) : null,
];

// POST /api/clients/sessions — PT / nutricionista marca uma sessão semanal.
async function createSession(req, res) {
  const error = await validateSession(req.body, req.user);
  if (error) return res.status(400).json({ message: error });
  const result = await pool.query(
    `INSERT INTO client_sessions (member_id, weekday, start_time, end_time, notes, staff_id, gym_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [...sessionValues(req.body), req.user.id, req.user.gymId]
  );
  res.status(201).json(await fetchSession(result.rows[0].id, req.user.gymId));
}

async function updateSession(req, res) {
  const existing = await fetchSession(req.params.id, req.user.gymId);
  if (!existing || existing.staff_id !== req.user.id) return res.status(404).json({ message: "Sessão não encontrada." });
  const error = await validateSession(req.body, req.user, existing.id);
  if (error) return res.status(400).json({ message: error });
  await pool.query(
    `UPDATE client_sessions SET member_id = $1, weekday = $2, start_time = $3, end_time = $4, notes = $5
      WHERE id = $6`,
    [...sessionValues(req.body), existing.id]
  );
  res.json(await fetchSession(existing.id, req.user.gymId));
}

async function deleteSession(req, res) {
  const existing = await fetchSession(req.params.id, req.user.gymId);
  if (!existing || existing.staff_id !== req.user.id) return res.status(404).json({ message: "Sessão não encontrada." });
  await pool.query(`DELETE FROM client_sessions WHERE id = $1`, [existing.id]);
  res.status(204).send();
}

// GET /api/clients/of/:staffId — CEO/rececionista vê apenas os clientes do ginásio
// de um PT afiliado. Clientes externos (gym_id=NULL) não são visíveis aqui.
async function listClientsOf(req, res) {
  const staffId = Number(req.params.staffId);
  const staff = await pool.query(
    "SELECT id, role FROM users WHERE id = $1 AND gym_id = $2",
    [staffId, req.user.gymId]
  );
  if (!staff.rows[0]) return res.status(404).json({ message: "Staff não encontrado." });
  const service = SERVICE_FOR_ROLE[staff.rows[0].role];
  if (!service) return res.json([]);

  const result = await pool.query(
    `SELECT u.id, u.name, u.email, u.avatar_url, ms.started_at, 'gym' AS source
       FROM member_subscriptions ms JOIN users u ON u.id = ms.member_id
      WHERE ms.is_active AND ms.service_type = $1 AND ms.assigned_staff_id = $2 AND u.gym_id = $3
      ORDER BY u.name`,
    [service, staffId, req.user.gymId]
  );
  res.json(result.rows);
}

// POST /api/clients/of/:staffId/external — CEO/rececionista adiciona cliente externo a um PT do ginásio.
async function addClientToStaff(req, res) {
  const staffId = Number(req.params.staffId);
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email é obrigatório." });

  const staff = await pool.query("SELECT id, role FROM users WHERE id = $1 AND gym_id = $2", [staffId, req.user.gymId]);
  if (!staff.rows[0]) return res.status(404).json({ message: "Staff não encontrado." });
  if (!SERVICE_FOR_ROLE[staff.rows[0].role]) return res.status(400).json({ message: "Este membro da equipa não é coach." });

  const target = await pool.query("SELECT id, name FROM users WHERE email = $1", [email.trim().toLowerCase()]);
  if (!target.rows[0]) return res.status(404).json({ message: "Não existe nenhuma conta com este email." });
  if (target.rows[0].id === staffId) return res.status(400).json({ message: "Um coach não pode ser seu próprio cliente." });

  const existing = await pool.query(
    "SELECT 1 FROM external_coach_clients WHERE coach_id = $1 AND client_id = $2",
    [staffId, target.rows[0].id]
  );
  if (existing.rows.length) return res.status(409).json({ message: `${target.rows[0].name} já é cliente deste coach.` });

  await pool.query(
    "INSERT INTO external_coach_clients (coach_id, client_id, gym_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
    [staffId, target.rows[0].id, req.user.gymId]
  );
  res.status(201).json({ message: `${target.rows[0].name} adicionado como cliente.`, name: target.rows[0].name });
}

// DELETE /api/clients/of/:staffId/external/:clientId — CEO/rececionista remove cliente externo de um PT.
async function removeClientOfStaff(req, res) {
  const staffId = Number(req.params.staffId);
  const clientId = Number(req.params.clientId);
  const staff = await pool.query("SELECT id FROM users WHERE id = $1 AND gym_id = $2", [staffId, req.user.gymId]);
  if (!staff.rows[0]) return res.status(404).json({ message: "Staff não encontrado." });
  await pool.query(
    "DELETE FROM external_coach_clients WHERE coach_id = $1 AND client_id = $2",
    [staffId, clientId]
  );
  res.status(204).send();
}

// POST /api/clients/external — PT/nutricionista adiciona um utilizador existente como cliente externo.
async function addExternalClient(req, res) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email é obrigatório." });

  const userResult = await pool.query("SELECT id, name, role FROM users WHERE email = $1", [email.trim().toLowerCase()]);
  if (!userResult.rows[0]) return res.status(404).json({ message: "Não existe nenhuma conta com este email." });

  const target = userResult.rows[0];
  if (target.id === req.user.id) return res.status(400).json({ message: "Não te podes adicionar a ti próprio." });

  // Verificar se já é cliente.
  const existing = await pool.query(
    "SELECT 1 FROM external_coach_clients WHERE coach_id = $1 AND client_id = $2",
    [req.user.id, target.id]
  );
  if (existing.rows.length) return res.status(409).json({ message: `${target.name} já é teu cliente.` });

  await pool.query(
    "INSERT INTO external_coach_clients (coach_id, client_id, gym_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
    [req.user.id, target.id, req.user.gymId]
  );
  res.status(201).json({ message: `${target.name} adicionado como cliente.`, name: target.name });
}

// DELETE /api/clients/external/:clientId — remove a ligação de cliente externo.
async function removeExternalClient(req, res) {
  const clientId = Number(req.params.clientId);
  if (!clientId) return res.status(400).json({ message: "ID inválido." });
  await pool.query(
    "DELETE FROM external_coach_clients WHERE coach_id = $1 AND client_id = $2",
    [req.user.id, clientId]
  );
  res.status(204).send();
}

module.exports = { listClients, listSessions, createSession, updateSession, deleteSession, addExternalClient, removeExternalClient, listClientsOf, addClientToStaff, removeClientOfStaff };
