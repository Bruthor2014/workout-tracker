const bcrypt = require("bcrypt");
const pool = require("../db/pool");
const { notifyVacantClasses } = require("../services/classNotify");

const SALT_ROUNDS = 10;

// GET /api/members?search=&inactive=true — staff pesquisa/lista TODAS as
// pessoas do seu ginásio (membros e staff, incluindo o gym_owner), já com o
// cargo, a foto, o registo de peso mais recente e a data do último treino.
// `inactive=true` filtra para quem não treina há mais de 30 dias (ou nunca
// treinou) — para o staff conseguir contactá-los. 'admin' fica de fora por
// ser da plataforma, não do ginásio.
async function listMembers(req, res) {
  const { search, inactive } = req.query;
  const onlyInactive = inactive === "true";
  const limit  = Math.min(Number(req.query.limit)  || 100, 200);
  const offset = Math.max(Number(req.query.offset) || 0,   0);

  const result = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.avatar_url,
            bm.weight_kg AS last_weight_kg,
            bm.recorded_at AS last_weight_at,
            ws.performed_at AS last_workout_at,
            COUNT(*) OVER() AS total_count
       FROM users u
       LEFT JOIN LATERAL (
         SELECT weight_kg, recorded_at
           FROM body_metrics
          WHERE member_id = u.id
          ORDER BY recorded_at DESC
          LIMIT 1
       ) bm ON true
       LEFT JOIN LATERAL (
         SELECT performed_at
           FROM workout_sessions
          WHERE user_id = u.id
          ORDER BY performed_at DESC
          LIMIT 1
       ) ws ON true
      WHERE u.gym_id = $1
        AND u.role <> 'admin'
        AND ($2::text IS NULL OR u.name ILIKE '%' || $2 || '%' OR u.email ILIKE '%' || $2 || '%')
        AND ($3::boolean IS FALSE OR ws.performed_at IS NULL OR ws.performed_at < CURRENT_DATE - INTERVAL '30 days')
      ORDER BY u.name
      LIMIT $4 OFFSET $5`,
    [req.user.gymId, search || null, onlyInactive, limit, offset]
  );
  const total = Number(result.rows[0]?.total_count ?? 0);
  res.json({ members: result.rows, total, limit, offset });
}

// GET /api/members/:id — staff vê qualquer pessoa do mesmo ginásio (membro ou
// staff). Coaches também podem abrir o perfil dos seus clientes externos
// (gym_id=NULL mas ligados via external_coach_clients).
async function getMember(req, res) {
  let result = await pool.query(
    `SELECT id, name, email, role, avatar_url
       FROM users
      WHERE id = $1 AND gym_id = $2 AND role <> 'admin'`,
    [req.params.id, req.user.gymId]
  );

  if (!result.rows[0] && (req.user.role === "personal_trainer" || req.user.role === "nutritionist")) {
    result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.avatar_url
         FROM users u
         JOIN external_coach_clients ecc ON ecc.client_id = u.id
        WHERE u.id = $1 AND ecc.coach_id = $2`,
      [req.params.id, req.user.id]
    );
  }

  if (!result.rows[0]) return res.status(404).json({ message: "Membro não encontrado." });
  res.json(result.rows[0]);
}

// GET /api/members/team — lista toda a equipa do ginásio (todas as roles de
// staff), acessível a qualquer membro da equipa.
async function listTeam(req, res) {
  const result = await pool.query(
    `SELECT id, name, role::text, email, avatar_url FROM users
      WHERE gym_id = $1 AND role::text IN ('personal_trainer','nutritionist','receptionist','intern')
      ORDER BY name`,
    [req.user.gymId]
  );
  res.json(result.rows);
}

// GET /api/members/staff?role=personal_trainer — staff do ginásio com esse
// role, para os dropdowns de "atribuir a quem" nas subscrições.
async function listStaff(req, res) {
  const allowed = ["personal_trainer", "nutritionist"];
  if (!allowed.includes(req.query.role)) {
    return res.status(400).json({ message: "Role inválido." });
  }

  const result = await pool.query(`SELECT id, name FROM users WHERE gym_id = $1 AND role = $2 ORDER BY name`, [
    req.user.gymId,
    req.query.role,
  ]);
  res.json(result.rows);
}

// PUT /api/members/:id/password — gym_owner repõe a password de um membro
// do seu ginásio (ex: membro perdeu o acesso à conta). Não passa pela
// password antiga — só quem já é gym_owner do ginásio desse membro chega
// aqui (ver memberRoutes.js).
async function resetMemberPassword(req, res) {
  const { new_password } = req.body;

  if (!new_password || new_password.length < 8) {
    return res.status(400).json({ message: "A password tem de ter pelo menos 8 caracteres." });
  }

  // Qualquer pessoa do ginásio (membro ou staff), exceto outro gym_owner/admin.
  const memberResult = await pool.query(
    `SELECT id FROM users WHERE id = $1 AND gym_id = $2 AND role NOT IN ('gym_owner', 'admin')`,
    [req.params.id, req.user.gymId]
  );
  if (memberResult.rows.length === 0) {
    return res.status(404).json({ message: "Membro não encontrado." });
  }

  const passwordHash = await bcrypt.hash(new_password, SALT_ROUNDS);
  await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, req.params.id]);

  res.json({ message: "Password alterada com sucesso." });
}

// Roles que o gym_owner pode atribuir a alguém do seu ginásio. Exclui de
// propósito 'gym_owner' (criar outro dono é uma ação rara/alto-risco,
// melhor feita diretamente na BD) e 'admin' (reservado à plataforma, nunca
// atribuível por um gym_owner).
const ASSIGNABLE_ROLES = ["member", "personal_trainer", "nutritionist", "receptionist", "intern"];

// PUT /api/members/:id/role — gym_owner muda o role de alguém do seu
// ginásio (ex: promover um membro a nutricionista). Não está restrito a
// role='member' no alvo, para também servir para mudar o role de staff já
// existente (ex: um PT passar a rececionista).
async function updateMemberRole(req, res) {
  const { role } = req.body;

  if (!ASSIGNABLE_ROLES.includes(role)) {
    return res.status(400).json({ message: "Role inválido." });
  }

  const targetResult = await pool.query(`SELECT id FROM users WHERE id = $1 AND gym_id = $2`, [
    req.params.id,
    req.user.gymId,
  ]);
  if (targetResult.rows.length === 0) {
    return res.status(404).json({ message: "Utilizador não encontrado." });
  }

  const result = await pool.query(`UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, role`, [
    role,
    req.params.id,
  ]);
  res.json(result.rows[0]);
}

// POST /api/members — o CEO adiciona alguém ao ginásio (membro ou equipa),
// já com a password inicial (a pessoa pode mudá-la depois).
async function createPerson(req, res) {
  // Receptionist can only create members, not staff roles.
  const { name: rawName, email, password: rawPassword, role: rawRole = "member" } = req.body;
  const role = req.user.role === "receptionist" ? "member" : rawRole;
  if (!email) return res.status(400).json({ message: "Email é obrigatório." });

  // Auto-fill name and password from email when not provided (receptionist quick-add flow)
  const emailSlug = String(email).split("@")[0].replace(/[^a-zA-Z0-9]/g, "") || "socio";
  const name     = rawName     || (emailSlug.charAt(0).toUpperCase() + emailSlug.slice(1));
  const password = rawPassword || (emailSlug + "123");

  if (!String(name).trim()) {
    return res.status(400).json({ message: "Não foi possível deduzir o nome do email. Introduz um nome manualmente." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: "Email inválido." });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ message: "A password tem de ter pelo menos 6 caracteres." });
  }
  if (!ASSIGNABLE_ROLES.includes(role)) {
    return res.status(400).json({ message: "Role inválido." });
  }
  const passwordHash = await bcrypt.hash(String(password), SALT_ROUNDS);
  const result = await pool.query(
    `INSERT INTO users (gym_id, name, email, password_hash, role)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO NOTHING
     RETURNING id, name, email, role, avatar_url`,
    [req.user.gymId, String(name).trim().slice(0, 150), String(email).trim().toLowerCase(), passwordHash, role]
  );
  if (!result.rows[0]) {
    return res.status(409).json({ message: "Já existe uma conta com esse email." });
  }
  // Include temp_password only if it was auto-generated (receptionist quick-add)
  const wasAutoPassword = !rawPassword;
  res.status(201).json({ ...result.rows[0], temp_password: wasAutoPassword ? password : undefined });
}

const TEAM_ROLES = ["personal_trainer", "nutritionist", "receptionist", "intern"];

// POST /api/members/team — o CEO junta à equipa alguém do ginásio, pelo
// email, com o cargo indicado.
async function addToTeam(req, res) {
  const { email, role } = req.body;
  if (!email || !TEAM_ROLES.includes(role)) {
    return res.status(400).json({ message: "Indica o email e um cargo da equipa." });
  }
  const result = await pool.query(
    `SELECT id, name, role FROM users WHERE LOWER(email) = LOWER($1) AND gym_id = $2`,
    [String(email).trim(), req.user.gymId]
  );
  const person = result.rows[0];
  if (!person) return res.status(404).json({ message: "Não há ninguém no ginásio com esse email." });
  if (person.role === "gym_owner" || person.role === "admin") {
    return res.status(400).json({ message: "Esta conta não pode entrar na equipa." });
  }
  const updated = await pool.query(`UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role`, [
    role,
    person.id,
  ]);
  res.json(updated.rows[0]);
}

// DELETE /api/members/:id/team — o CEO tira alguém da equipa: a pessoa
// continua no ginásio como membro; os seus turnos saem do horário e as
// aulas que dava ficam sem responsável (a equipa pode propor-se).
async function removeFromTeam(req, res) {
  if (!Number.isInteger(Number(req.params.id))) {
    return res.status(404).json({ message: "Pessoa não encontrada." });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE users SET role = 'member'
        WHERE id = $1 AND gym_id = $2 AND role = ANY($3::user_role[])
        RETURNING id, name, role`,
      [req.params.id, req.user.gymId, TEAM_ROLES]
    );
    if (!result.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Esta pessoa não faz parte da equipa." });
    }
    await client.query(`DELETE FROM staff_shifts WHERE staff_id = $1`, [req.params.id]);
    await client.query(`DELETE FROM client_sessions WHERE staff_id = $1`, [req.params.id]);
    const vacant = await client.query(
      `UPDATE group_classes SET instructor_id = NULL, substitute_requested = false, substitute_reason = NULL
        WHERE instructor_id = $1
        RETURNING title, weekday, to_char(start_time, 'HH24:MI') AS start_time, to_char(end_time, 'HH24:MI') AS end_time`,
      [req.params.id]
    );
    await client.query(`UPDATE member_subscriptions SET assigned_staff_id = NULL WHERE assigned_staff_id = $1`, [
      req.params.id,
    ]);
    await client.query("COMMIT");
    // As aulas que dava ficaram sem PT: avisa os PTs.
    await notifyVacantClasses(req.user.gymId, vacant.rows);
    res.json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  listMembers,
  getMember,
  listStaff,
  listTeam,
  resetMemberPassword,
  updateMemberRole,
  createPerson,
  addToTeam,
  removeFromTeam,
};
