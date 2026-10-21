const bcrypt = require("bcrypt");
const pool = require("../db/pool");
const { uploadImage } = require("../services/storage");

const SALT_ROUNDS = 10;

// POST /api/users/me/avatar — recebe o ficheiro em memória (req.file, ver
// middleware/upload.js) e guarda-o (Supabase Storage ou disco local,
// consoante a configuração — ver services/storage.js).
async function uploadAvatar(req, res) {
  if (!req.file) {
    return res.status(400).json({ message: "Nenhum ficheiro enviado." });
  }

  const avatarUrl = await uploadImage({
    buffer: req.file.buffer,
    mimetype: req.file.mimetype,
    originalname: req.file.originalname,
    folder: "avatars",
    prefix: "user",
    userId: req.user.id,
  });

  await pool.query("UPDATE users SET avatar_url = $1 WHERE id = $2", [avatarUrl, req.user.id]);

  res.json({ avatar_url: avatarUrl });
}

// PUT /api/users/me — o próprio edita o nome e, opcionalmente, a password.
// Serve dois fluxos: alguém a editar o seu perfil mais tarde (pede a
// password atual para a mudar) e a confirmação de nome logo a seguir a um
// registo com Google (só manda `name`, sem campos de password — ver
// RegisterPage.jsx/LoginPage.jsx, GoogleNameStep). Contas só-Google (sem
// password_hash) só podem mudar o nome por aqui, nunca a password.
async function updateProfile(req, res) {
  const { name, current_password, new_password } = req.body;
  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ message: "O nome não pode ficar vazio." });
  }

  const result = await pool.query("SELECT password_hash FROM users WHERE id = $1", [req.user.id]);
  const user = result.rows[0];
  if (!user) return res.status(404).json({ message: "Conta não encontrada." });

  const updates = [];
  const params = [];
  if (name !== undefined) {
    params.push(name.trim().slice(0, 150));
    updates.push(`name = $${params.length}`);
  }
  if (new_password) {
    if (!user.password_hash) {
      return res.status(400).json({ message: "Esta conta entra com o Google — não tem password para mudar." });
    }
    if (!current_password) {
      return res.status(400).json({ message: "Introduz a password atual." });
    }
    const matches = await bcrypt.compare(current_password, user.password_hash);
    if (!matches) {
      return res.status(401).json({ message: "Password atual incorreta." });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ message: "A password nova tem de ter pelo menos 8 caracteres." });
    }
    const hash = await bcrypt.hash(new_password, SALT_ROUNDS);
    params.push(hash);
    updates.push(`password_hash = $${params.length}`);
  }

  if (!updates.length) {
    return res.status(400).json({ message: "Nada para atualizar." });
  }
  params.push(req.user.id);
  const updated = await pool.query(
    `UPDATE users SET ${updates.join(", ")} WHERE id = $${params.length} RETURNING id, name, email, role, avatar_url`,
    params
  );
  res.json(updated.rows[0]);
}

module.exports = { uploadAvatar, updateProfile };
