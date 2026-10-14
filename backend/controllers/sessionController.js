const pool = require("../db/pool");

// Técnicas de série aceites (ver frontend/src/utils/setTypes.js).
const SET_TYPES = ["normal", "drop", "rest_pause", "cluster", "superset", "pyramid", "failure"];

// Grava as séries de uma sessão pela ordem recebida (set_number = posição).
// `set_type`: uma das SET_TYPES ('normal' por omissão).
async function insertSets(client, sessionId, sets) {
  for (let i = 0; i < sets.length; i++) {
    const { exercise_id, reps, weight, set_type } = sets[i];
    await client.query(
      `INSERT INTO set_logs (session_id, exercise_id, set_number, reps, weight, set_type)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [sessionId, exercise_id, i + 1, reps, weight ?? null, set_type || "normal"]
    );
  }
}

function invalidSetType(sets) {
  return sets.some((set) => set.set_type != null && !SET_TYPES.includes(set.set_type));
}

// Treinos de um utilizador (com nº de exercícios/séries, volume e grupos
// musculares), opcionalmente entre duas datas.
async function querySessions(userId, from, to) {
  const result = await pool.query(
    `SELECT s.id, s.title, s.performed_at, s.notes, s.started_at, s.ended_at,
            COUNT(DISTINCT sl.exercise_id) AS exercise_count,
            COUNT(sl.id) AS set_count,
            -- Cardio regista minutos/km em reps/carga: fica fora do volume.
            COALESCE(SUM(sl.reps * sl.weight) FILTER (WHERE ex.muscle_group IS DISTINCT FROM 'Cardio'), 0) AS total_weight_kg,
            mg.muscle_groups
       FROM workout_sessions s
       LEFT JOIN set_logs sl ON sl.session_id = s.id
       LEFT JOIN exercises ex ON ex.id = sl.exercise_id
       LEFT JOIN LATERAL (
         -- Ordenado pelo nº de séries: o primeiro grupo é o dominante do
         -- treino (o dashboard usa-o para o ícone/cor da linha).
         SELECT STRING_AGG(g.muscle_group, ' • ' ORDER BY g.set_count DESC, g.muscle_group) AS muscle_groups
           FROM (
             SELECT e.muscle_group, COUNT(*) AS set_count
               FROM set_logs sl2
               JOIN exercises e ON e.id = sl2.exercise_id
              WHERE sl2.session_id = s.id AND e.muscle_group IS NOT NULL
              GROUP BY e.muscle_group
           ) g
       ) mg ON true
      WHERE s.user_id = $1
        AND ($2::date IS NULL OR s.performed_at >= $2::date)
        AND ($3::date IS NULL OR s.performed_at <= $3::date)
      GROUP BY s.id, mg.muscle_groups
      ORDER BY s.performed_at DESC`,
    [userId, from || null, to || null]
  );
  return result.rows;
}

async function listSessions(req, res) {
  res.json(await querySessions(req.user.id, req.query.from, req.query.to));
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
    `SELECT sl.id, sl.exercise_id, e.name AS exercise_name, sl.set_number, sl.reps, sl.weight, sl.set_type
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
  if (invalidSetType(sets)) {
    return res.status(400).json({ message: "Tipo de série inválido." });
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

    await insertSets(client, session.id, sets);

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
  if (invalidSetType(sets)) {
    return res.status(400).json({ message: "Tipo de série inválido." });
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
    await insertSets(client, session.id, sets);

    await client.query("COMMIT");
    res.json(session);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// GET /api/sessions/records?exclude_session=ID — recorde de cada exercício
// do utilizador: o maior peso já levantado (e com quantas reps, e quando).
// Com peso igual, conta o de mais reps. `exclude_session` deixa de fora o
// treino que está a ser editado (para não se comparar consigo próprio).
// Recorde de cada exercício (maior peso; com peso igual, mais reps) e
// `times_done`: em quantos treinos o exercício aparece — o perfil mostra
// primeiro os exercícios mais feitos.
async function queryRecords(userId, excludeSession) {
  const result = await pool.query(
    `SELECT r.*, c.times_done
       FROM (
         SELECT DISTINCT ON (sl.exercise_id)
                sl.exercise_id, sl.weight::float AS weight, sl.reps, ws.performed_at
           FROM set_logs sl
           JOIN workout_sessions ws ON ws.id = sl.session_id
           JOIN exercises e ON e.id = sl.exercise_id
          WHERE ws.user_id = $1
            AND sl.weight IS NOT NULL AND sl.weight > 0
            AND e.muscle_group IS DISTINCT FROM 'Cardio' -- km não é um recorde de peso
            AND ($2::int IS NULL OR ws.id <> $2)
          ORDER BY sl.exercise_id, sl.weight DESC, sl.reps DESC, ws.performed_at ASC
       ) r
       JOIN (
         SELECT sl.exercise_id, COUNT(DISTINCT sl.session_id)::int AS times_done
           FROM set_logs sl
           JOIN workout_sessions ws ON ws.id = sl.session_id
          WHERE ws.user_id = $1
            AND ($2::int IS NULL OR ws.id <> $2)
          GROUP BY sl.exercise_id
       ) c ON c.exercise_id = r.exercise_id
      ORDER BY c.times_done DESC, r.performed_at DESC`,
    [userId, excludeSession]
  );
  return result.rows;
}

async function listRecords(req, res) {
  res.json(await queryRecords(req.user.id, Number(req.query.exclude_session) || null));
}

// O staff só vê pessoas do seu próprio ginásio.
async function memberInStaffGym(req, res) {
  const result = await pool.query(`SELECT id FROM users WHERE id = $1 AND gym_id = $2 AND role <> 'admin'`, [
    req.params.id,
    req.user.gymId,
  ]);
  if (result.rows.length === 0) {
    res.status(404).json({ message: "Membro não encontrado." });
    return false;
  }
  return true;
}

// GET /api/sessions/member/:id — staff vê os treinos de um membro do seu
// ginásio (ex: progresso no perfil do membro).
async function listSessionsForMember(req, res) {
  if (!(await memberInStaffGym(req, res))) return;
  res.json(await querySessions(req.params.id, req.query.from, req.query.to));
}

// GET /api/sessions/member/:id/records — recordes de um membro do ginásio.
async function listRecordsForMember(req, res) {
  if (!(await memberInStaffGym(req, res))) return;
  res.json(await queryRecords(req.params.id, null));
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

module.exports = {
  listSessions,
  getSession,
  createSession,
  updateSession,
  deleteSession,
  listRecords,
  listSessionsForMember,
  listRecordsForMember,
};
