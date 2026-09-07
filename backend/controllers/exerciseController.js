const pool = require("../db/pool");

async function listExercises(req, res) {
  const result = await pool.query(
    "SELECT id, name, muscle_group FROM exercises WHERE gym_id = $1 ORDER BY name",
    [req.user.gymId]
  );
  res.json(result.rows);
}

module.exports = { listExercises };
