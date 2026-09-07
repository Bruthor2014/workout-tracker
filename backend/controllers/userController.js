const pool = require("../db/pool");

// POST /api/users/me/avatar — recebe o ficheiro já gravado pelo multer
// (req.file, ver middleware/upload.js) e guarda o caminho na BD.
async function uploadAvatar(req, res) {
  if (!req.file) {
    return res.status(400).json({ message: "Nenhum ficheiro enviado." });
  }

  const avatarUrl = `/uploads/avatars/${req.file.filename}`;

  await pool.query("UPDATE users SET avatar_url = $1 WHERE id = $2", [avatarUrl, req.user.id]);

  res.json({ avatar_url: avatarUrl });
}

module.exports = { uploadAvatar };
