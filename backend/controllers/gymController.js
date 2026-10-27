const pool = require("../db/pool");

// GET /api/gym/overview — painel de gestão do CEO: números do ginásio,
// equipa, subscrições, atividade dos membros e o que precisa de atenção
// (aulas sem responsável, pedidos de substituição, membros inativos).
async function getOverview(req, res) {
  const gymId = req.user.gymId;

  const [gym, members, staff, subscriptions, activity, weekly, topMembers, classes, attention, staffLoad] =
    await Promise.all([
      pool.query(`SELECT name FROM gyms WHERE id = $1`, [gymId]),

      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE u.created_at >= date_trunc('month', now()))::int AS new_this_month,
                COUNT(*) FILTER (WHERE last.performed_at >= CURRENT_DATE - 30)::int AS active_30d,
                COUNT(*) FILTER (WHERE last.performed_at IS NULL OR last.performed_at < CURRENT_DATE - 30)::int AS inactive_30d
           FROM users u
           LEFT JOIN LATERAL (
             SELECT MAX(performed_at) AS performed_at FROM workout_sessions WHERE user_id = u.id
           ) last ON true
          WHERE u.gym_id = $1 AND u.role = 'member'`,
        [gymId]
      ),

      pool.query(
        `SELECT role, COUNT(*)::int AS count FROM users
          WHERE gym_id = $1 AND role NOT IN ('member', 'gym_owner', 'admin')
          GROUP BY role ORDER BY count DESC`,
        [gymId]
      ),

      pool.query(
        `SELECT ms.service_type, COUNT(*)::int AS count
           FROM member_subscriptions ms JOIN users u ON u.id = ms.member_id
          WHERE u.gym_id = $1 AND ms.is_active
          GROUP BY ms.service_type`,
        [gymId]
      ),

      // Treinos de todo o ginásio: esta semana vs a semana passada (até ao
      // mesmo dia), e no mês.
      pool.query(
        `SELECT COUNT(*) FILTER (WHERE ws.performed_at >= date_trunc('week', CURRENT_DATE))::int AS this_week,
                COUNT(*) FILTER (WHERE ws.performed_at >= date_trunc('week', CURRENT_DATE) - INTERVAL '7 days'
                                   AND ws.performed_at <= CURRENT_DATE - 7)::int AS last_week_same_days,
                COUNT(*) FILTER (WHERE ws.performed_at >= date_trunc('month', CURRENT_DATE))::int AS this_month
           FROM workout_sessions ws JOIN users u ON u.id = ws.user_id
          WHERE u.gym_id = $1 AND u.role = 'member'`,
        [gymId]
      ),

      // Treinos por semana nas últimas 12 semanas (para o gráfico).
      pool.query(
        `SELECT to_char(w.week_start, 'YYYY-MM-DD') AS week_start, COUNT(ws.id)::int AS workouts
           FROM generate_series(date_trunc('week', CURRENT_DATE) - INTERVAL '11 weeks',
                                date_trunc('week', CURRENT_DATE), INTERVAL '1 week') AS w(week_start)
           LEFT JOIN (
             SELECT ws.id, ws.performed_at FROM workout_sessions ws
               JOIN users u ON u.id = ws.user_id WHERE u.gym_id = $1 AND u.role = 'member'
           ) ws ON ws.performed_at >= w.week_start AND ws.performed_at < w.week_start + INTERVAL '7 days'
          GROUP BY w.week_start ORDER BY w.week_start`,
        [gymId]
      ),

      pool.query(
        `SELECT u.id, u.name, u.avatar_url, COUNT(ws.id)::int AS workouts
           FROM users u JOIN workout_sessions ws ON ws.user_id = u.id
          WHERE u.gym_id = $1 AND u.role = 'member' AND ws.performed_at >= CURRENT_DATE - 30
          GROUP BY u.id ORDER BY workouts DESC, u.name LIMIT 5`,
        [gymId]
      ),

      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE instructor_id IS NULL)::int AS vacant,
                COUNT(*) FILTER (WHERE substitute_requested)::int AS substitute_requests
           FROM group_classes WHERE gym_id = $1`,
        [gymId]
      ),

      // Aulas que precisam de atenção (sem responsável ou com substituição pedida).
      pool.query(
        `SELECT gc.id, gc.title, gc.weekday, to_char(gc.start_time, 'HH24:MI') AS start_time,
                to_char(gc.end_time, 'HH24:MI') AS end_time, gc.substitute_requested, gc.substitute_reason,
                u.name AS instructor_name
           FROM group_classes gc LEFT JOIN users u ON u.id = gc.instructor_id
          WHERE gc.gym_id = $1 AND (gc.instructor_id IS NULL OR gc.substitute_requested)
          ORDER BY gc.weekday, gc.start_time`,
        [gymId]
      ),

      // Horas semanais atribuídas a cada pessoa da equipa (turnos + aulas).
      pool.query(
        `SELECT u.id, u.name, u.role,
                COALESCE((SELECT SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time))) FROM staff_shifts s WHERE s.staff_id = u.id), 0) / 3600.0 AS shift_hours,
                COALESCE((SELECT SUM(EXTRACT(EPOCH FROM (c.end_time - c.start_time))) FROM group_classes c WHERE c.instructor_id = u.id), 0) / 3600.0 AS class_hours,
                (SELECT COUNT(*)::int FROM member_subscriptions ms WHERE ms.assigned_staff_id = u.id AND ms.is_active) AS clients
           FROM users u
          WHERE u.gym_id = $1 AND u.role NOT IN ('member', 'gym_owner', 'admin')
          ORDER BY u.name`,
        [gymId]
      ),
    ]);

  res.json({
    gym_name: gym.rows[0]?.name || "Ginásio",
    members: members.rows[0],
    staff: staff.rows,
    subscriptions: subscriptions.rows,
    activity: activity.rows[0],
    weekly: weekly.rows,
    top_members: topMembers.rows,
    classes: classes.rows[0],
    attention_classes: attention.rows,
    staff_load: staffLoad.rows.map((s) => ({
      ...s,
      shift_hours: Number(s.shift_hours),
      class_hours: Number(s.class_hours),
    })),
  });
}

// ─── Endpoints DONO (dono da plataforma) ────────────────────────────────────

// GET /api/gym/all — lista todos os ginásios com stats básicas.
async function listGyms(req, res) {
  const result = await pool.query(
    `SELECT g.id, g.name, g.created_at,
            (SELECT name FROM users WHERE gym_id = g.id AND role = 'gym_owner' LIMIT 1) AS owner_name,
            (SELECT email FROM users WHERE gym_id = g.id AND role = 'gym_owner' LIMIT 1) AS owner_email,
            (SELECT COUNT(*)::int FROM users WHERE gym_id = g.id AND role = 'member') AS member_count,
            (SELECT COUNT(*)::int FROM users WHERE gym_id = g.id AND role NOT IN ('member','gym_owner','admin','dono')) AS staff_count
       FROM gyms g
      ORDER BY g.id`
  );
  res.json(result.rows);
}

// POST /api/gym/create — cria um novo ginásio.
async function createGym(req, res) {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ message: "Nome do ginásio é obrigatório." });
  const result = await pool.query(
    "INSERT INTO gyms (name) VALUES ($1) RETURNING id, name, created_at",
    [name.trim()]
  );
  res.status(201).json(result.rows[0]);
}

// POST /api/gym/:id/owner — atribui um CEO a um ginásio por email.
async function assignOwner(req, res) {
  const gymId = Number(req.params.id);
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email é obrigatório." });

  const gym = await pool.query("SELECT id FROM gyms WHERE id = $1", [gymId]);
  if (!gym.rows[0]) return res.status(404).json({ message: "Ginásio não encontrado." });

  const user = await pool.query("SELECT id, role FROM users WHERE email = $1", [email]);
  if (!user.rows[0]) return res.status(404).json({ message: "Utilizador não encontrado." });

  // Tirar o role de owner ao CEO anterior deste ginásio
  await pool.query(
    "UPDATE users SET role = 'member' WHERE gym_id = $1 AND role = 'gym_owner'",
    [gymId]
  );
  // Atribuir o novo CEO
  await pool.query(
    "UPDATE users SET role = 'gym_owner', gym_id = $1 WHERE id = $2",
    [gymId, user.rows[0].id]
  );
  res.json({ message: "CEO atribuído." });
}

// GET /api/gym/:id/detail — DONO vê detalhes completos de um ginásio.
async function getGymDetail(req, res) {
  const gymId = Number(req.params.id);
  const [gym, members, staff, subs, activity, topMembers] = await Promise.all([
    pool.query("SELECT id, name, created_at FROM gyms WHERE id = $1", [gymId]),
    pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now()))::int AS new_this_month,
              COUNT(*) FILTER (WHERE last.performed_at >= CURRENT_DATE - 30)::int AS active_30d
         FROM users u
         LEFT JOIN LATERAL (SELECT MAX(performed_at) AS performed_at FROM workout_sessions WHERE user_id = u.id) last ON true
        WHERE u.gym_id = $1 AND u.role = 'member'`,
      [gymId]
    ),
    pool.query(
      `SELECT id, name, email, role, avatar_url FROM users
        WHERE gym_id = $1 AND role NOT IN ('member','admin','dono')
        ORDER BY role, name`,
      [gymId]
    ),
    pool.query(
      `SELECT ms.service_type, COUNT(*)::int AS count
         FROM member_subscriptions ms JOIN users u ON u.id = ms.member_id
        WHERE u.gym_id = $1 AND ms.is_active GROUP BY ms.service_type`,
      [gymId]
    ),
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE ws.performed_at >= date_trunc('month', CURRENT_DATE))::int AS this_month,
              COUNT(*) FILTER (WHERE ws.performed_at >= date_trunc('week', CURRENT_DATE))::int AS this_week
         FROM workout_sessions ws JOIN users u ON u.id = ws.user_id
        WHERE u.gym_id = $1 AND u.role = 'member'`,
      [gymId]
    ),
    pool.query(
      `SELECT u.id, u.name, COUNT(ws.id)::int AS workouts
         FROM users u JOIN workout_sessions ws ON ws.user_id = u.id
        WHERE u.gym_id = $1 AND u.role = 'member' AND ws.performed_at >= CURRENT_DATE - 30
        GROUP BY u.id ORDER BY workouts DESC LIMIT 5`,
      [gymId]
    ),
  ]);
  if (!gym.rows[0]) return res.status(404).json({ message: "Ginásio não encontrado." });
  res.json({
    gym: gym.rows[0],
    members: members.rows[0],
    staff: staff.rows,
    subscriptions: subs.rows,
    activity: activity.rows[0],
    top_members: topMembers.rows,
  });
}

// DELETE /api/gym/:id — DONO remove um ginásio (liberta utilizadores, não os apaga).
async function deleteGym(req, res) {
  const gymId = Number(req.params.id);
  const gym = await pool.query("SELECT id FROM gyms WHERE id = $1", [gymId]);
  if (!gym.rows[0]) return res.status(404).json({ message: "Ginásio não encontrado." });
  // Libertar utilizadores em vez de os apagar com cascade.
  await pool.query("UPDATE users SET gym_id = NULL WHERE gym_id = $1 AND role = 'member'", [gymId]);
  await pool.query("UPDATE users SET gym_id = NULL, role = 'member' WHERE gym_id = $1", [gymId]);
  await pool.query("DELETE FROM gyms WHERE id = $1", [gymId]);
  res.status(204).send();
}

// GET /api/gym/users?q= — DONO pesquisa qualquer utilizador da plataforma.
// GET /api/gym/registrations/stats — quantos utilizadores se registaram
// esta semana/mês/ano/sempre, para o painel do DONO. Só a contagem — a
// lista em si só se vai buscar ao clicar (ver listRegistrations), para não
// carregar sempre todos os utilizadores à toa.
async function getRegistrationStats(req, res) {
  const result = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE created_at >= date_trunc('week', CURRENT_DATE))::int AS week,
       COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE))::int AS month,
       COUNT(*) FILTER (WHERE created_at >= date_trunc('year', CURRENT_DATE))::int AS year,
       COUNT(*)::int AS all
     FROM users
    WHERE role <> 'dono'`
  );
  res.json(result.rows[0]);
}

// GET /api/gym/registrations?period=week|month|year|all — a lista em si,
// mais recentes primeiro. `period` é validado contra uma lista fixa (nunca
// vai para a query como texto do pedido) antes de escolher o fragmento SQL
// correspondente, por isso não há risco de injeção apesar da concatenação.
const REGISTRATION_PERIOD_SQL = {
  week: "date_trunc('week', CURRENT_DATE)",
  month: "date_trunc('month', CURRENT_DATE)",
  year: "date_trunc('year', CURRENT_DATE)",
  all: null,
};

async function listRegistrations(req, res) {
  const period = req.query.period;
  if (!Object.prototype.hasOwnProperty.call(REGISTRATION_PERIOD_SQL, period)) {
    return res.status(400).json({ message: "period tem de ser week, month, year ou all." });
  }
  const sinceSql = REGISTRATION_PERIOD_SQL[period];
  const result = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.gym_id, u.avatar_url, g.name AS gym_name, u.created_at
       FROM users u
       LEFT JOIN gyms g ON g.id = u.gym_id
      WHERE u.role <> 'dono'
        ${sinceSql ? `AND u.created_at >= ${sinceSql}` : ""}
      ORDER BY u.created_at DESC
      LIMIT 500`
  );
  res.json(result.rows);
}

async function searchUsers(req, res) {
  const q = (req.query.q || "").trim();
  if (q.length < 2) return res.json([]);
  const result = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.gym_id, g.name AS gym_name
       FROM users u
       LEFT JOIN gyms g ON g.id = u.gym_id
      WHERE u.role <> 'dono'
        AND (u.name ILIKE $1 OR u.email ILIKE $1)
      ORDER BY u.name
      LIMIT 30`,
    [`%${q}%`]
  );
  res.json(result.rows);
}

// PATCH /api/gym/users/:id — DONO altera o nome, gym_id e/ou role de um
// utilizador. Nunca mexe na password de ninguém (isso só a própria pessoa
// pode mudar, em /api/users/me — ver userController.js).
async function patchUser(req, res) {
  const userId = Number(req.params.id);
  const { name, gym_id, role } = req.body;

  const user = await pool.query("SELECT id, role FROM users WHERE id = $1", [userId]);
  if (!user.rows[0]) return res.status(404).json({ message: "Utilizador não encontrado." });

  const updates = [];
  const params = [];

  if (name !== undefined) {
    if (!name.trim()) return res.status(400).json({ message: "O nome não pode ficar vazio." });
    params.push(name.trim().slice(0, 150));
    updates.push(`name = $${params.length}`);
  }
  if (gym_id !== undefined) {
    params.push(gym_id === null ? null : Number(gym_id));
    updates.push(`gym_id = $${params.length}`);
  }
  if (role !== undefined) {
    const VALID_ROLES = ["member", "gym_owner", "personal_trainer", "nutritionist", "receptionist", "intern", "reception_station"];
    if (!VALID_ROLES.includes(role)) return res.status(400).json({ message: "Role inválido." });
    // Se estiver a atribuir gym_owner, tirar o anterior primeiro.
    if (role === "gym_owner" && gym_id) {
      await pool.query("UPDATE users SET role = 'member' WHERE gym_id = $1 AND role = 'gym_owner' AND id <> $2", [gym_id || params[0], userId]);
    }
    params.push(role);
    updates.push(`role = $${params.length}`);
  }

  if (!updates.length) return res.status(400).json({ message: "Nada para atualizar." });
  params.push(userId);
  await pool.query(`UPDATE users SET ${updates.join(", ")} WHERE id = $${params.length}`, params);

  const updated = await pool.query(
    "SELECT u.id, u.name, u.email, u.role, u.gym_id, g.name AS gym_name FROM users u LEFT JOIN gyms g ON g.id = u.gym_id WHERE u.id = $1",
    [userId]
  );
  res.json(updated.rows[0]);
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// PUT /api/gym/theme — CEO define a cor principal e secundária do ginásio.
// Aplicam-se a todos os utilizadores desse ginásio (fundo, sidebar, cartões).
async function updateTheme(req, res) {
  const gymId = req.user.gymId;
  const { accent_color, secondary_color } = req.body;
  if (!accent_color || !HEX_RE.test(accent_color)) {
    return res.status(400).json({ message: "Cor principal inválida. Use o formato #rrggbb." });
  }
  if (!secondary_color || !HEX_RE.test(secondary_color)) {
    return res.status(400).json({ message: "Cor secundária inválida. Use o formato #rrggbb." });
  }
  await pool.query("UPDATE gyms SET accent_color = $1, secondary_color = $2 WHERE id = $3", [
    accent_color,
    secondary_color,
    gymId,
  ]);
  res.json({ accent_color, secondary_color });
}

// DELETE /api/gym/theme — CEO repõe o tema default.
async function resetTheme(req, res) {
  const gymId = req.user.gymId;
  await pool.query("UPDATE gyms SET accent_color = NULL, secondary_color = NULL WHERE id = $1", [gymId]);
  res.json({ accent_color: null, secondary_color: null });
}

module.exports = {
  getOverview,
  listGyms,
  createGym,
  assignOwner,
  searchUsers,
  patchUser,
  getGymDetail,
  deleteGym,
  updateTheme,
  resetTheme,
  getRegistrationStats,
  listRegistrations,
};
