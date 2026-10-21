const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const pool = require("../db/pool");
const { sendVerificationEmail } = require("../services/email");

const SALT_ROUNDS = 10;
const VERIFICATION_TOKEN_TTL_HOURS = 24;
const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

function signToken(user) {
  return jwt.sign(
    { id: user.id, gymId: user.gym_id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// Cria o token de confirmação, manda o email (ou, sem SMTP configurado, só
// regista o link — ver services/email.js) e devolve o link quando não há
// SMTP a sério, para a rota de registo o poder incluir na resposta em dev
// (testar o fluxo todo sem precisar de conta de email).
async function issueVerificationEmail(user) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_HOURS * 3600 * 1000);
  await pool.query(`UPDATE users SET verification_token = $1, verification_token_expires_at = $2 WHERE id = $3`, [
    token,
    expiresAt,
    user.id,
  ]);
  const { link, sent } = await sendVerificationEmail({ to: user.email, name: user.name, token });
  return { sent, devLink: sent ? undefined : link };
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
      `INSERT INTO users (gym_id, name, email, password_hash, email_verified)
       VALUES ($1, $2, $3, $4, false)
       RETURNING id, gym_id, name, email, role, avatar_url, email_verified`,
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

  // Login/registo com Google (ver googleAuth()) já vem com o email
  // confirmado pela Google — só o registo normal manda a confirmação.
  const { devLink } = await issueVerificationEmail(user);

  const token = signToken(user);
  res.status(201).json({ token, user, dev_verification_link: devLink });
}

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email e password são obrigatórios." });
  }

  const result = await pool.query(
    `SELECT u.id, u.gym_id, u.name, u.email, u.password_hash, u.role, u.avatar_url, u.invite_code, u.email_verified,
            g.accent_color AS gym_accent, g.secondary_color AS gym_secondary
       FROM users u
       LEFT JOIN gyms g ON g.id = u.gym_id
      WHERE u.email = $1`,
    [email]
  );
  const user = result.rows[0];

  if (!user) {
    return res.status(401).json({ message: "Credenciais inválidas." });
  }
  if (!user.password_hash) {
    return res.status(401).json({ message: "Esta conta entra com o Google — usa o botão \"Continuar com Google\"." });
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    return res.status(401).json({ message: "Credenciais inválidas." });
  }

  const { password_hash, ...safeUser } = user;
  const token = signToken(user);
  res.json({ token, user: safeUser });
}

// GET /api/auth/verify-email?token=... — clicado a partir do link do
// email. Sem sessão associada (o link pode ser aberto noutro
// dispositivo/browser) — valida só pelo token, e devolve logo uma sessão
// nova para o frontend poder fazer login automático se quiser.
async function verifyEmail(req, res) {
  const { token } = req.query;
  if (!token) return res.status(400).json({ message: "Token em falta." });

  const result = await pool.query(
    `SELECT id, gym_id, name, email, role, avatar_url, verification_token_expires_at
       FROM users WHERE verification_token = $1`,
    [token]
  );
  const user = result.rows[0];
  if (!user) {
    return res.status(400).json({ message: "Link de confirmação inválido ou já usado." });
  }
  if (new Date(user.verification_token_expires_at) < new Date()) {
    return res.status(400).json({ message: "Este link de confirmação expirou. Pede um novo." });
  }

  await pool.query(
    `UPDATE users SET email_verified = true, verification_token = NULL, verification_token_expires_at = NULL WHERE id = $1`,
    [user.id]
  );

  const { verification_token_expires_at, ...safeUser } = user;
  const verifiedUser = { ...safeUser, email_verified: true };
  res.json({ token: signToken(verifiedUser), user: verifiedUser });
}

// POST /api/auth/resend-verification — autenticado, para o botão
// "Reenviar" do aviso no perfil de quem ainda não confirmou.
async function resendVerification(req, res) {
  const result = await pool.query(`SELECT id, name, email, email_verified FROM users WHERE id = $1`, [req.user.id]);
  const user = result.rows[0];
  if (!user) return res.status(404).json({ message: "Conta não encontrada." });
  if (user.email_verified) {
    return res.status(400).json({ message: "Este email já está confirmado." });
  }
  const { devLink } = await issueVerificationEmail(user);
  res.json({ sent: true, dev_verification_link: devLink });
}

// POST /api/auth/google — login OU registo com Google, consoante o email já
// exista ou não. O frontend manda o ID token que a Google Identity
// Services devolve; aqui verifica-se a assinatura contra o GOOGLE_CLIENT_ID
// (nunca se confia no payload sem verificar — qualquer um podia mandar um
// JSON parecido). A Google já confirma o email, por isso nunca passa pelo
// fluxo de confirmação por email.
async function googleAuth(req, res) {
  if (!googleClient) {
    return res.status(501).json({ message: "Login com Google ainda não está configurado neste servidor." });
  }
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ message: "Credencial da Google em falta." });

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ message: "Credencial da Google inválida." });
  }
  if (!payload?.email) {
    return res.status(401).json({ message: "A Google não devolveu um email válido." });
  }

  const existing = await pool.query(
    `SELECT id, gym_id, name, email, role, avatar_url, google_id FROM users WHERE LOWER(email) = LOWER($1)`,
    [payload.email]
  );
  let user = existing.rows[0];
  let isNew = false;

  if (user) {
    // Conta já existia (ex: registo normal antigo) — liga-a à Google e
    // confirma o email, já que a Google o garante.
    if (!user.google_id) {
      await pool.query(`UPDATE users SET google_id = $1, email_verified = true WHERE id = $2`, [payload.sub, user.id]);
    }
  } else {
    isNew = true;
    const result = await pool.query(
      `INSERT INTO users (gym_id, name, email, google_id, email_verified)
       VALUES (NULL, $1, $2, $3, true)
       RETURNING id, gym_id, name, email, role, avatar_url`,
      [payload.name || payload.email.split("@")[0], payload.email, payload.sub]
    );
    user = result.rows[0];
  }

  const safeUser = { ...user, email_verified: true };
  delete safeUser.google_id;
  // `is_new`: a Google nem sempre devolve um nome (ou devolve algo
  // genérico) — o frontend usa isto para pedir confirmação do nome logo a
  // seguir a uma conta nova, em vez de aceitar sempre o que vier (ou o
  // prefixo do email) sem perguntar.
  res.json({ token: signToken(user), user: safeUser, is_new: isNew });
}

// GET /api/auth/me — dados atuais da conta, incluindo o tema do ginásio.
// O frontend chama isto ao abrir a app para refrescar o que guardou no
// login (gym_id, role, cor do tema) — sem isto, uma sessão aberta antes de
// uma mudança (ex: o DONO atribuir um ginásio novo, ou o CEO mudar a cor)
// ficava com dados desatualizados até a pessoa fazer logout/login outra
// vez, mesmo já corrigido no servidor (ver requireAuth em middleware/auth.js).
async function me(req, res) {
  const result = await pool.query(
    `SELECT u.id, u.gym_id, u.name, u.email, u.role, u.avatar_url, u.invite_code, u.email_verified,
            g.accent_color AS gym_accent, g.secondary_color AS gym_secondary
       FROM users u
       LEFT JOIN gyms g ON g.id = u.gym_id
      WHERE u.id = $1`,
    [req.user.id]
  );
  const user = result.rows[0];
  if (!user) return res.status(404).json({ message: "Conta não encontrada." });
  res.json(user);
}

module.exports = { register, login, getInviteInfo, verifyEmail, resendVerification, googleAuth, me };
