const pool = require("../db/pool");
const { uploadImage } = require("../services/storage");

// Catálogo partilhado (owner_id NULL — não é específico de nenhum ginásio,
// qualquer utilizador o vê) + os exercícios pessoais de quem pede (owner_id
// = este utilizador) — nunca os pessoais de outra pessoa.
async function listExercises(req, res) {
  const result = await pool.query(
    `SELECT id, name, muscle_group, image_url, (owner_id IS NOT NULL) AS is_custom
       FROM exercises
      WHERE owner_id IS NULL OR owner_id = $1
      ORDER BY name`,
    [req.user.id]
  );
  res.json(result.rows);
}

// POST /api/exercises — cria um exercício pessoal (só visível para quem o
// cria, nunca entra no catálogo partilhado do ginásio).
async function createExercise(req, res) {
  const { name, muscle_group: muscleGroup } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: "O nome é obrigatório." });
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
    `INSERT INTO exercises (gym_id, owner_id, name, muscle_group, image_url)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, muscle_group, image_url, true AS is_custom`,
    [req.user.gymId, req.user.id, name.trim(), muscleGroup || null, imageUrl]
  );
  res.status(201).json(result.rows[0]);
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

module.exports = { listExercises, createExercise, deleteExercise };
