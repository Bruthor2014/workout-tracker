const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db/pool");

const SALT_ROUNDS = 10;

function signToken(user) {
  return jwt.sign(
    { id: user.id, gymId: user.gym_id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// GET /api/auth/invite/:code — devolve o nome e role do coach dono do código.
// Usado na página de registo para mostrar "Vais ser cliente de Carol (PT)".
async function getInviteInfo(req, res) {
  const { code } = req.params;
  if (!code) return res.status(400).json({ message: "Código em falta." });
  const result = await pool.query(
    "SELECT id, name, role, gym_id FROM users WHERE invite_code = $1",
    [code.toUpperCase()]
  );
  if (!result.rows[0]) return res.status(404).json({ message: "Código inválido." });
  const { id, name, role, gym_id } = result.rows[0];
  res.json({ coach_id: id, coach_name: name, coach_role: role, gym_id });
}

async function register(req, res) {
  const { name, email, password, invite_code } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Nome, email e password são obrigatórios." });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: "A password tem de ter pelo menos 8 caracteres." });
  }

  // Se houver código de convite, validar antes de criar o utilizador.
  let coach = null;
  if (invite_code) {
    const coachResult = await pool.query(
      "SELECT id, gym_id FROM users WHERE invite_code = $1",
      [invite_code.toUpperCase()]
    );
    if (!coachResult.rows[0]) {
      return res.status(400).json({ message: "Código de convite inválido." });
    }
    coach = coachResult.rows[0];
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Novos utilizadores ficam sem gym_id até serem adicionados por um
  // rececionista. Clientes externos (linked via PT) ficam sempre sem ginásio.
  const gymId = null;

  let user;
  try {
    const result = await pool.query(
      `INSERT INTO users (gym_id, name, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, gym_id, name, email, role, avatar_url`,
      [gymId, name, email, passwordHash]
    );
    user = result.rows[0];
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Já existe uma conta com este email." });
    }
    throw err;
  }

  // Ligar o novo utilizador ao coach como cliente externo.
  if (coach) {
    await pool.query(
      "INSERT INTO external_coach_clients (coach_id, client_id, gym_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [coach.id, user.id, coach.gym_id]
    );
  }

  const token = signToken(user);
  res.status(201).json({ token, user });
}

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email e password são obrigatórios." });
  }

  const result = await pool.query(
    `SELECT u.id, u.gym_id, u.name, u.email, u.password_hash, u.role, u.avatar_url, u.invite_code,
            g.accent_color AS gym_accent
       FROM users u
       LEFT JOIN gyms g ON g.id = u.gym_id
      WHERE u.email = $1`,
    [email]
  );
  const user = result.rows[0];

  if (!user) {
    return res.status(401).json({ message: "Credenciais inválidas." });
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    return res.status(401).json({ message: "Credenciais inválidas." });
  }

  const { password_hash, ...safeUser } = user;
  const token = signToken(user);
  res.json({ token, user: safeUser });
}

module.exports = { register, login, getInviteInfo };
