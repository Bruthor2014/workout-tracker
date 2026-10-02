const bcrypt = require("bcrypt");
const pool = require("../db/pool");

const SALT_ROUNDS = 10;

// GET /api/members?search=&inactive=true — staff pesquisa/lista membros do
// seu ginásio, já com a foto, o registo de peso mais recente e a data do
// último treino. `inactive=true` filtra para quem não treina há mais de 30
// dias (ou nunca treinou) — para o staff conseguir contactá-los.
async function listMembers(req, res) {
  const { search, inactive } = req.query;
  const onlyInactive = inactive === "true";

  const result = await pool.query(
    `SELECT u.id, u.name, u.email, u.avatar_url,
            bm.weight_kg AS last_weight_kg,
            bm.recorded_at AS last_weight_at,
            ws.performed_at AS last_workout_at
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
        AND u.role = 'member'
        AND ($2::text IS NULL OR u.name ILIKE '%' || $2 || '%' OR u.email ILIKE '%' || $2 || '%')
        AND ($3::boolean IS FALSE OR ws.performed_at IS NULL OR ws.performed_at < CURRENT_DATE - INTERVAL '30 days')
      ORDER BY u.name`,
    [req.user.gymId, search || null, onlyInactive]
  );
  res.json(result.rows);
}

// GET /api/members/:id — staff vê um membro específico (do mesmo ginásio)
async function getMember(req, res) {
  const result = await pool.query(
    `SELECT id, name, email, avatar_url
       FROM users
      WHERE id = $1 AND gym_id = $2 AND role = 'member'`,
    [req.params.id, req.user.gymId]
  );

  const member = result.rows[0];
  if (!member) {
    return res.status(404).json({ message: "Membro não encontrado." });
  }

  res.json(member);
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

  const memberResult = await pool.query(`SELECT id FROM users WHERE id = $1 AND gym_id = $2 AND role = 'member'`, [
    req.params.id,
    req.user.gymId,
  ]);
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

module.exports = { listMembers, getMember, listStaff, resetMemberPassword, updateMemberRole };
