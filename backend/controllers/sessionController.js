const pool = require("../db/pool");
const { uploadImage } = require("../services/storage");

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

// MET único para todos os treinos (~6, esforço moderado) — não distingue
// força de cardio nem intensidade real; é propositadamente uma estimativa
// simples (gasto calórico por exercício não é ciência exata), nunca
// apresentada como medição. calorias = MET × peso(kg) × duração(h).
const WORKOUT_MET = 6;

// GET /api/sessions/calories-today — calorias queimadas estimadas nos
// treinos de hoje, a partir do peso corporal mais recente e da duração de
// cada sessão cronometrada. Sessões sem cronómetro (started_at/ended_at a
// NULL, registo manual/retroativo) ficam de fora — sem duração não há
// base nenhuma para estimar, mesma regra de "nunca inventar" do resto do
// projeto.
async function getCaloriesBurnedToday(req, res) {
  const weightResult = await pool.query(
    `SELECT weight_kg FROM body_metrics WHERE member_id = $1 ORDER BY recorded_at DESC, created_at DESC LIMIT 1`,
    [req.user.id]
  );
  const weightKg = weightResult.rows[0] ? Number(weightResult.rows[0].weight_kg) : null;

  const sessionsResult = await pool.query(
    `SELECT started_at, ended_at FROM workout_sessions
      WHERE user_id = $1 AND performed_at = CURRENT_DATE
        AND started_at IS NOT NULL AND ended_at IS NOT NULL`,
    [req.user.id]
  );

  if (!weightKg || sessionsResult.rows.length === 0) {
    return res.json({ calories: null, weight_kg: weightKg });
  }

  const totalHours = sessionsResult.rows.reduce(
    (sum, row) => sum + (new Date(row.ended_at) - new Date(row.started_at)) / 3600000,
    0
  );
  res.json({ calories: Math.round(WORKOUT_MET * weightKg * totalHours), weight_kg: weightKg });
}

// GET /api/sessions/exercise/:exerciseId/history — evolução de um exercício
// ao longo do tempo: a série mais pesada de cada treino em que apareceu
// (com peso igual, a de mais reps), por ordem cronológica — para um
// gráfico tipo EvolutionChart.jsx. Cardio fica de fora (reps/carga ali são
// minutos/km, não dá para comparar progressão da mesma forma).
async function listExerciseHistory(req, res) {
  const exerciseId = Number(req.params.exerciseId);
  if (!Number.isInteger(exerciseId)) {
    return res.status(400).json({ message: "Exercício inválido." });
  }
  const result = await pool.query(
    `SELECT performed_at, weight, reps FROM (
       SELECT DISTINCT ON (sl.session_id)
              ws.performed_at::date AS performed_at,
              sl.weight::float AS weight,
              sl.reps
         FROM set_logs sl
         JOIN workout_sessions ws ON ws.id = sl.session_id
        WHERE ws.user_id = $1 AND sl.exercise_id = $2
          AND sl.weight IS NOT NULL AND sl.weight > 0
        ORDER BY sl.session_id, sl.weight DESC, sl.reps DESC
     ) best
     ORDER BY performed_at ASC`,
    [req.user.id, exerciseId]
  );
  res.json(result.rows);
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

// POST /api/sessions/:id/photo — foto opcional do treino (banner), para
// aparecer no feed de amigos. Só o próprio dono do treino, e só depois de
// já o ter registado (ver "Adicionar foto?" em LogWorkoutPage.jsx, logo
// após guardar com sucesso).
async function uploadSessionPhoto(req, res) {
  if (!req.file) return res.status(400).json({ message: "Nenhuma foto enviada." });

  const photoUrl = await uploadImage({
    buffer: req.file.buffer,
    mimetype: req.file.mimetype,
    originalname: req.file.originalname,
    folder: "sessions",
    prefix: "session",
    userId: req.user.id,
  });

  const result = await pool.query(
    `UPDATE workout_sessions SET photo_url = $1 WHERE id = $2 AND user_id = $3 RETURNING id, photo_url`,
    [photoUrl, req.params.id, req.user.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Treino não encontrado." });
  }
  res.json(result.rows[0]);
}

// Dono do treino, ou amigo seu em qualquer direção — mesma regra de acesso
// do feed (ver friendController.js/getFeed): quem vê o treino no feed é
// quem pode reagir/comentar, nunca um desconhecido. Devolve o user_id do
// dono (ou null se o treino não existir, já com o 404 escrito).
async function findInteractableSession(req, res) {
  const sessionId = Number(req.params.id);
  const sessionResult = await pool.query(`SELECT user_id FROM workout_sessions WHERE id = $1`, [sessionId]);
  const session = sessionResult.rows[0];
  if (!session) {
    res.status(404).json({ message: "Treino não encontrado." });
    return null;
  }

  if (session.user_id !== req.user.id) {
    const friendCheck = await pool.query(
      `SELECT 1 FROM friendships WHERE (follower_id = $1 AND followee_id = $2) OR (follower_id = $2 AND followee_id = $1)`,
      [req.user.id, session.user_id]
    );
    if (friendCheck.rows.length === 0) {
      res.status(403).json({ message: "Só podes interagir com treinos de amigos." });
      return null;
    }
  }
  return sessionId;
}

// POST /api/sessions/:id/reaction — alterna (põe/tira) a reação (👏) do
// próprio a um treino.
async function toggleReaction(req, res) {
  const sessionId = await findInteractableSession(req, res);
  if (!sessionId) return;

  const existing = await pool.query(`SELECT id FROM session_reactions WHERE session_id = $1 AND user_id = $2`, [
    sessionId,
    req.user.id,
  ]);
  if (existing.rows.length > 0) {
    await pool.query(`DELETE FROM session_reactions WHERE id = $1`, [existing.rows[0].id]);
  } else {
    await pool.query(`INSERT INTO session_reactions (session_id, user_id) VALUES ($1, $2)`, [sessionId, req.user.id]);
  }

  const countResult = await pool.query(`SELECT COUNT(*)::int AS n FROM session_reactions WHERE session_id = $1`, [
    sessionId,
  ]);
  res.json({ session_id: sessionId, reaction_count: countResult.rows[0].n, reacted: existing.rows.length === 0 });
}

// GET /api/sessions/:id/comments
async function listComments(req, res) {
  const sessionId = await findInteractableSession(req, res);
  if (!sessionId) return;

  const result = await pool.query(
    `SELECT c.id, c.body, c.created_at, u.id AS user_id, u.name AS user_name, u.avatar_url AS user_avatar_url
       FROM session_comments c
       JOIN users u ON u.id = c.user_id
      WHERE c.session_id = $1
      ORDER BY c.created_at ASC`,
    [sessionId]
  );
  res.json(
    result.rows.map((r) => ({
      id: r.id,
      body: r.body,
      created_at: r.created_at,
      user: { id: r.user_id, name: r.user_name, avatar_url: r.user_avatar_url },
    }))
  );
}

// POST /api/sessions/:id/comments { body }
async function addComment(req, res) {
  const sessionId = await findInteractableSession(req, res);
  if (!sessionId) return;

  const body = req.body.body?.trim();
  if (!body) return res.status(400).json({ message: "O comentário não pode estar vazio." });

  const result = await pool.query(
    `INSERT INTO session_comments (session_id, user_id, body)
     VALUES ($1, $2, $3)
     RETURNING id, body, created_at,
       (SELECT name FROM users WHERE id = $2) AS user_name,
       (SELECT avatar_url FROM users WHERE id = $2) AS user_avatar_url`,
    [sessionId, req.user.id, body.slice(0, 1000)]
  );
  const row = result.rows[0];
  res.status(201).json({
    id: row.id,
    body: row.body,
    created_at: row.created_at,
    user: { id: req.user.id, name: row.user_name, avatar_url: row.user_avatar_url },
  });
}

// DELETE /api/sessions/:id/comments/:commentId — só quem o escreveu.
async function deleteComment(req, res) {
  const result = await pool.query(
    `DELETE FROM session_comments WHERE id = $1 AND session_id = $2 AND user_id = $3 RETURNING id`,
    [req.params.commentId, req.params.id, req.user.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ message: "Comentário não encontrado." });
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
  getCaloriesBurnedToday,
  listExerciseHistory,
  listSessionsForMember,
  listRecordsForMember,
  uploadSessionPhoto,
  toggleReaction,
  listComments,
  addComment,
  deleteComment,
};
