const pool = require("../db/pool");

async function listSessions(req, res) {
  const { from, to } = req.query;

  const result = await pool.query(
    `SELECT s.id, s.title, s.performed_at, s.notes, s.started_at, s.ended_at,
            COUNT(DISTINCT sl.exercise_id) AS exercise_count,
            COUNT(sl.id) AS set_count,
            COALESCE(SUM(sl.reps * sl.weight), 0) AS total_weight_kg
       FROM workout_sessions s
       LEFT JOIN set_logs sl ON sl.session_id = s.id
      WHERE s.user_id = $1
        AND ($2::date IS NULL OR s.performed_at >= $2::date)
        AND ($3::date IS NULL OR s.performed_at <= $3::date)
      GROUP BY s.id
      ORDER BY s.performed_at DESC`,
    [req.user.id, from || null, to || null]
  );
  res.json(result.rows);
}

async function getSession(req, res) {
  const sessionResult = await pool.query(
    `SELECT id, title, performed_at, notes, started_at, ended_at, plan_day_id
       FROM workout_sessions WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user.id]
  );
  const session = sessionResult.rows[0];
  if (!session) {
    return res.status(404).json({ message: "Treino não encontrado." });
  }

  const setsResult = await pool.query(
    `SELECT sl.id, sl.exercise_id, e.name AS exercise_name, sl.set_number, sl.reps, sl.weight
       FROM set_logs sl
       JOIN exercises e ON e.id = sl.exercise_id
      WHERE sl.session_id = $1
      ORDER BY sl.set_number`,
    [session.id]
  );

  res.json({ ...session, sets: setsResult.rows });
}

async function createSession(req, res) {
  const { title, performed_at, notes, sets, started_at, ended_at, plan_day_id } = req.body;

  if (!performed_at || !Array.isArray(sets) || sets.length === 0) {
    return res.status(400).json({ message: "performed_at e pelo menos uma série são obrigatórios." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const sessionResult = await client.query(
      `INSERT INTO workout_sessions (user_id, title, performed_at, notes, started_at, ended_at, plan_day_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, title, performed_at, notes, started_at, ended_at, plan_day_id`,
      [req.user.id, title || null, performed_at, notes || null, started_at || null, ended_at || null, plan_day_id || null]
    );
    const session = sessionResult.rows[0];

    for (let i = 0; i < sets.length; i++) {
      const { exercise_id, reps, weight } = sets[i];
      await client.query(
        `INSERT INTO set_logs (session_id, exercise_id, set_number, reps, weight)
         VALUES ($1, $2, $3, $4, $5)`,
        [session.id, exercise_id, i + 1, reps, weight ?? null]
      );
    }

    await client.query("COMMIT");
    res.status(201).json(session);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function updateSession(req, res) {
  const { title, performed_at, notes, sets, started_at, ended_at } = req.body;

  if (!performed_at || !Array.isArray(sets) || sets.length === 0) {
    return res.status(400).json({ message: "performed_at e pelo menos uma série são obrigatórios." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const sessionResult = await client.query(
      `UPDATE workout_sessions
          SET title = $1, performed_at = $2, notes = $3, started_at = $4, ended_at = $5
        WHERE id = $6 AND user_id = $7
        RETURNING id, title, performed_at, notes, started_at, ended_at`,
      [title || null, performed_at, notes || null, started_at || null, ended_at || null, req.params.id, req.user.id]
    );
    const session = sessionResult.rows[0];
    if (!session) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Treino não encontrado." });
    }

    // Substitui todas as séries: mais simples e seguro do que tentar
    // comparar linha a linha o que mudou/foi removido/foi acrescentado.
    await client.query("DELETE FROM set_logs WHERE session_id = $1", [session.id]);
    for (let i = 0; i < sets.length; i++) {
      const { exercise_id, reps, weight } = sets[i];
      await client.query(
        `INSERT INTO set_logs (session_id, exercise_id, set_number, reps, weight)
         VALUES ($1, $2, $3, $4, $5)`,
        [session.id, exercise_id, i + 1, reps, weight ?? null]
      );
    }

    await client.query("COMMIT");
    res.json(session);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function deleteSession(req, res) {
  // set_logs tem ON DELETE CASCADE para session_id (ver schema.sql), por
  // isso apagar a sessão já apaga as séries associadas automaticamente.
  const result = await pool.query(
    "DELETE FROM workout_sessions WHERE id = $1 AND user_id = $2 RETURNING id",
    [req.params.id, req.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Treino não encontrado." });
  }

  res.status(204).send();
}

module.exports = { listSessions, getSession, createSession, updateSession, deleteSession };
