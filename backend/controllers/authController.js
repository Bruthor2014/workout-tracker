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

async function register(req, res) {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Nome, email e password são obrigatórios." });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: "A password tem de ter pelo menos 8 caracteres." });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  let user;
  try {
    const result = await pool.query(
      `INSERT INTO users (gym_id, name, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, gym_id, name, email, role, avatar_url`,
      [process.env.DEFAULT_GYM_ID, name, email, passwordHash]
    );
    user = result.rows[0];
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ message: "Já existe uma conta com este email." });
    }
    throw err;
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
    "SELECT id, gym_id, name, email, password_hash, role, avatar_url FROM users WHERE email = $1",
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

module.exports = { register, login };
