const pool = require("../db/pool");
const { uploadImage } = require("../services/storage");

const EQUIPMENT_VALUES = ["barra", "halteres", "cabo", "maquina", "peso_corporal", "kettlebell", "elastico", "outro"];

// Catálogo partilhado (owner_id NULL — não é específico de nenhum ginásio,
// qualquer utilizador o vê) + os exercícios pessoais de quem pede (owner_id
// = este utilizador) — nunca os pessoais de outra pessoa. `is_favorite`
// vem do marcador do próprio (ver toggleFavorite), nunca dos favoritos de
// outra pessoa.
async function listExercises(req, res) {
  const result = await pool.query(
    `SELECT e.id, e.name, e.muscle_group, e.image_url, e.video_url, e.equipment,
            (e.owner_id IS NOT NULL) AS is_custom,
            (f.id IS NOT NULL) AS is_favorite
       FROM exercises e
       LEFT JOIN exercise_favorites f ON f.exercise_id = e.id AND f.user_id = $1
      WHERE e.owner_id IS NULL OR e.owner_id = $1
      ORDER BY e.name`,
    [req.user.id]
  );
  res.json(result.rows);
}

// Só http(s) — sem isto dava para guardar "javascript:..." e o link
// ficava clicável na app (o vídeo abre numa nova aba, ver
// ExercisePicker.jsx).
function parseVideoUrl(value) {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return undefined; // inválido
  return trimmed;
}

// POST /api/exercises — cria um exercício pessoal (só visível para quem o
// cria, nunca entra no catálogo partilhado do ginásio).
async function createExercise(req, res) {
  const { name, muscle_group: muscleGroup, video_url: videoUrlInput, equipment } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: "O nome é obrigatório." });
  }
  const videoUrl = parseVideoUrl(videoUrlInput);
  if (videoUrl === undefined) {
    return res.status(400).json({ message: "Link de vídeo inválido (tem de começar por http:// ou https://)." });
  }
  if (equipment && !EQUIPMENT_VALUES.includes(equipment)) {
    return res.status(400).json({ message: "Equipamento inválido." });
  }

  let imageUrl = null;
  if (req.file) {
    imageUrl = await uploadImage({
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
      folder: "exercises",
      prefix: "exercise",
      userId: req.user.id,
    });
  }

  const result = await pool.query(
    `INSERT INTO exercises (gym_id, owner_id, name, muscle_group, image_url, video_url, equipment)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, muscle_group, image_url, video_url, equipment, true AS is_custom, false AS is_favorite`,
    [req.user.gymId, req.user.id, name.trim(), muscleGroup || null, imageUrl, videoUrl, equipment || null]
  );
  res.status(201).json(result.rows[0]);
}

// PATCH /api/exercises/:id — só o link de vídeo por agora, e só em
// exercícios pessoais do próprio (o catálogo do ginásio não tem ainda
// nenhum mecanismo de edição, nem para este nem para outros campos).
async function updateExerciseVideo(req, res) {
  const videoUrl = parseVideoUrl(req.body.video_url);
  if (videoUrl === undefined) {
    return res.status(400).json({ message: "Link de vídeo inválido (tem de começar por http:// ou https://)." });
  }
  const result = await pool.query(
    `UPDATE exercises SET video_url = $1 WHERE id = $2 AND owner_id = $3
     RETURNING id, name, muscle_group, image_url, video_url, true AS is_custom`,
    [videoUrl, req.params.id, req.user.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Exercício não encontrado." });
  }
  res.json(result.rows[0]);
}

// DELETE /api/exercises/:id — só o dono pode apagar, e só exercícios
// pessoais (nunca o catálogo do ginásio).
async function deleteExercise(req, res) {
  const result = await pool.query(
    "DELETE FROM exercises WHERE id = $1 AND owner_id = $2 RETURNING id",
    [req.params.id, req.user.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Exercício não encontrado." });
  }
  res.status(204).send();
}

// POST /api/exercises/:id/favorite — alterna (marca/desmarca) o próprio
// favorito. Funciona em qualquer exercício que o próprio veja (catálogo
// partilhado ou pessoal), não só nos que criou — listExercises já garante
// que só se chega aqui com um id visível.
async function toggleFavorite(req, res) {
  const exerciseId = Number(req.params.id);
  const visible = await pool.query(
    `SELECT id FROM exercises WHERE id = $1 AND (owner_id IS NULL OR owner_id = $2)`,
    [exerciseId, req.user.id]
  );
  if (visible.rows.length === 0) {
    return res.status(404).json({ message: "Exercício não encontrado." });
  }

  const existing = await pool.query(`SELECT id FROM exercise_favorites WHERE user_id = $1 AND exercise_id = $2`, [
    req.user.id,
    exerciseId,
  ]);
  if (existing.rows.length > 0) {
    await pool.query(`DELETE FROM exercise_favorites WHERE id = $1`, [existing.rows[0].id]);
  } else {
    await pool.query(`INSERT INTO exercise_favorites (user_id, exercise_id) VALUES ($1, $2)`, [
      req.user.id,
      exerciseId,
    ]);
  }
  res.json({ exercise_id: exerciseId, is_favorite: existing.rows.length === 0 });
}

module.exports = { listExercises, createExercise, updateExerciseVideo, deleteExercise, toggleFavorite };
