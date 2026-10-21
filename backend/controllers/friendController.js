const pool = require("../db/pool");

// Sem caracteres ambíguos (0/O, 1/I/l) — o código vai para um link partilhado.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

function genCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

// GET /api/friends/me/code — devolve o código do utilizador, gerando-o na
// primeira vez que é pedido (evita ter de preencher todos os utilizadores
// já existentes numa migração).
async function getMyCode(req, res) {
  const existing = await pool.query("SELECT friend_code FROM users WHERE id = $1", [req.user.id]);
  if (existing.rows[0]?.friend_code) {
    return res.json({ code: existing.rows[0].friend_code });
  }

  // Poucas colisões possíveis (32^8), mas tenta outra vez se acontecer.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genCode();
    try {
      await pool.query("UPDATE users SET friend_code = $1 WHERE id = $2", [code, req.user.id]);
      return res.json({ code });
    } catch (err) {
      if (err.code !== "23505") throw err; // unique_violation: tenta outro código
    }
  }
  res.status(500).json({ message: "Não foi possível gerar um código. Tenta outra vez." });
}

// GET /api/friends/preview/:code — info pública mínima para a página de
// convite mostrar quem é antes (ou sem) login. Sem dados pessoais.
async function previewCode(req, res) {
  const result = await pool.query(
    "SELECT id, name, avatar_url, role FROM users WHERE friend_code = $1",
    [req.params.code.toUpperCase()]
  );
  if (!result.rows[0]) return res.status(404).json({ message: "Link de convite inválido." });
  res.json(result.rows[0]);
}

async function insertFollow(followerId, followeeId) {
  await pool.query(
    `INSERT INTO friendships (follower_id, followee_id) VALUES ($1, $2)
     ON CONFLICT (follower_id, followee_id) DO NOTHING`,
    [followerId, followeeId]
  );
}

// POST /api/friends/follow { code } — segue diretamente, sem aprovação.
async function follow(req, res) {
  const { code } = req.body;
  if (!code) return res.status(400).json({ message: "Código em falta." });

  const target = await pool.query(
    "SELECT id, name, avatar_url, role FROM users WHERE friend_code = $1",
    [code.toUpperCase()]
  );
  if (!target.rows[0]) return res.status(404).json({ message: "Link de convite inválido." });
  if (target.rows[0].id === req.user.id) {
    return res.status(400).json({ message: "Não podes seguir-te a ti próprio." });
  }

  await insertFollow(req.user.id, target.rows[0].id);
  res.status(201).json(target.rows[0]);
}

// POST /api/friends/follow-id/:id — seguir de volta alguém que já se
// conhece por id (ex: já está na lista de seguidores).
async function followById(req, res) {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) {
    return res.status(400).json({ message: "Não podes seguir-te a ti próprio." });
  }
  const target = await pool.query("SELECT id, name, avatar_url, role FROM users WHERE id = $1", [targetId]);
  if (!target.rows[0]) return res.status(404).json({ message: "Utilizador não encontrado." });

  await insertFollow(req.user.id, targetId);
  res.status(201).json(target.rows[0]);
}

// DELETE /api/friends/following/:id — deixar de seguir.
async function unfollow(req, res) {
  await pool.query("DELETE FROM friendships WHERE follower_id = $1 AND followee_id = $2", [
    req.user.id,
    req.params.id,
  ]);
  res.status(204).send();
}

async function listFollowing(req, res) {
  const result = await pool.query(
    `SELECT u.id, u.name, u.avatar_url, u.role
       FROM friendships f JOIN users u ON u.id = f.followee_id
      WHERE f.follower_id = $1
      ORDER BY f.created_at DESC`,
    [req.user.id]
  );
  res.json(result.rows);
}

async function listFollowers(req, res) {
  const result = await pool.query(
    `SELECT u.id, u.name, u.avatar_url, u.role
       FROM friendships f JOIN users u ON u.id = f.follower_id
      WHERE f.followee_id = $1
      ORDER BY f.created_at DESC`,
    [req.user.id]
  );
  res.json(result.rows);
}

// Treinos, horas e volume de um utilizador nos últimos `days` dias, e o
// streak de dias consecutivos (sobre uma janela maior, independente de
// `days`, para não cortar um streak em curso a meio).
async function computeStats(userId, days) {
  const totalsResult = await pool.query(
    `SELECT COUNT(DISTINCT s.id)::int AS sessions_count,
            COALESCE(SUM(EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 3600)
                       FILTER (WHERE s.started_at IS NOT NULL AND s.ended_at IS NOT NULL), 0) AS total_hours,
            COALESCE(SUM(sl.reps * sl.weight) FILTER (WHERE ex.muscle_group IS DISTINCT FROM 'Cardio'), 0) AS total_volume_kg
       FROM workout_sessions s
       LEFT JOIN set_logs sl ON sl.session_id = s.id
       LEFT JOIN exercises ex ON ex.id = sl.exercise_id
      WHERE s.user_id = $1 AND s.performed_at >= CURRENT_DATE - $2::int`,
    [userId, days]
  );

  const streakWindowDays = 90;
  const datesResult = await pool.query(
    `SELECT DISTINCT performed_at FROM workout_sessions
      WHERE user_id = $1 AND performed_at >= CURRENT_DATE - $2::int`,
    [userId, streakWindowDays]
  );
  const attended = new Set(datesResult.rows.map((r) => r.performed_at));
  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  const todayKey = cursor.toISOString().slice(0, 10);
  if (!attended.has(todayKey)) cursor.setDate(cursor.getDate() - 1);
  while (attended.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const totals = totalsResult.rows[0];
  return {
    period_days: days,
    sessions_count: totals.sessions_count,
    total_hours: Math.round(Number(totals.total_hours) * 10) / 10,
    total_volume_kg: Math.round(Number(totals.total_volume_kg)),
    streak_days: streak,
  };
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = domingo
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

const WEEKLY_WEEKS = 12;

// Mesma lógica do weeklySeries do frontend (ProfileProgress), mas em SQL/JS
// no servidor — para se poder devolver a série de um amigo sem expor as
// sessões em bruto (só o agregado por semana).
async function computeWeeklySeries(userId, weeksCount = WEEKLY_WEEKS) {
  const thisWeekStart = startOfWeek(new Date());
  const firstStart = new Date(thisWeekStart);
  firstStart.setDate(firstStart.getDate() - 7 * (weeksCount - 1));

  const sessionsResult = await pool.query(
    `SELECT s.performed_at,
            EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 60 AS minutes,
            COALESCE((
              SELECT SUM(sl.reps * sl.weight)
                FROM set_logs sl JOIN exercises ex ON ex.id = sl.exercise_id
               WHERE sl.session_id = s.id AND ex.muscle_group IS DISTINCT FROM 'Cardio'
            ), 0) AS volume
       FROM workout_sessions s
      WHERE s.user_id = $1 AND s.performed_at >= $2::date`,
    [userId, firstStart.toISOString().slice(0, 10)]
  );

  const weeks = Array.from({ length: weeksCount }, (_, i) => {
    const start = new Date(firstStart);
    start.setDate(start.getDate() + 7 * i);
    return { start, minutes: 0, volume: 0 };
  });

  for (const row of sessionsResult.rows) {
    const performed = new Date(`${row.performed_at}T00:00:00`);
    const index = Math.floor((performed - firstStart) / (7 * 86400000));
    if (index < 0 || index >= weeksCount) continue;
    weeks[index].minutes += Number(row.minutes) || 0;
    weeks[index].volume += Number(row.volume) || 0;
  }

  return weeks.map((w) => ({
    label: `${w.start.getDate()}/${w.start.getMonth() + 1}`,
    hours: Math.round((w.minutes / 60) * 10) / 10,
    volume: Math.round(w.volume),
  }));
}

async function countFollowers(userId) {
  const result = await pool.query("SELECT COUNT(*)::int AS n FROM friendships WHERE followee_id = $1", [userId]);
  return result.rows[0].n;
}

async function countFollowing(userId) {
  const result = await pool.query("SELECT COUNT(*)::int AS n FROM friendships WHERE follower_id = $1", [userId]);
  return result.rows[0].n;
}

// GET /api/friends/counts — para o perfil mostrar "N seguidores · N a seguir".
async function getCounts(req, res) {
  const [followers, following] = await Promise.all([countFollowers(req.user.id), countFollowing(req.user.id)]);
  res.json({ followers, following });
}

// Confirma que `req.user` segue `followeeId` — é essa a única porta de
// entrada para ver dados de outra pessoa (ver respostas da pergunta sobre
// o modelo: seguir dá acesso imediato ao resumo, sem pedido à parte).
async function assertFollowing(followerId, followeeId) {
  const result = await pool.query(
    "SELECT 1 FROM friendships WHERE follower_id = $1 AND followee_id = $2",
    [followerId, followeeId]
  );
  return result.rows.length > 0;
}

// GET /api/friends/:id/summary?days=30
async function getSummary(req, res) {
  const followeeId = Number(req.params.id);
  if (!(await assertFollowing(req.user.id, followeeId))) {
    return res.status(403).json({ message: "Só podes ver o resumo de quem segues." });
  }
  const userResult = await pool.query("SELECT id, name, avatar_url, role FROM users WHERE id = $1", [followeeId]);
  if (!userResult.rows[0]) return res.status(404).json({ message: "Utilizador não encontrado." });

  const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
  const stats = await computeStats(followeeId, days);
  res.json({ user: userResult.rows[0], stats });
}

// GET /api/friends/:id/compare?days=30 — os meus números e os dele, lado a
// lado, para a página de comparação.
async function getCompare(req, res) {
  const followeeId = Number(req.params.id);
  if (!(await assertFollowing(req.user.id, followeeId))) {
    return res.status(403).json({ message: "Só podes comparar-te com quem segues." });
  }
  const userResult = await pool.query("SELECT id, name, avatar_url, role FROM users WHERE id = $1", [followeeId]);
  if (!userResult.rows[0]) return res.status(404).json({ message: "Utilizador não encontrado." });

  const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
  const [meStats, friendStats, meWeekly, friendWeekly] = await Promise.all([
    computeStats(req.user.id, days),
    computeStats(followeeId, days),
    computeWeeklySeries(req.user.id),
    computeWeeklySeries(followeeId),
  ]);
  // "me" não traz user info — o frontend já tem o próprio nome/avatar via
  // sessão (AuthContext), não precisa de vir repetido aqui.
  res.json({
    me: { stats: meStats, weekly: meWeekly },
    friend: { user: userResult.rows[0], stats: friendStats, weekly: friendWeekly },
  });
}

module.exports = {
  getMyCode,
  previewCode,
  follow,
  followById,
  unfollow,
  listFollowing,
  listFollowers,
  getCounts,
  getSummary,
  getCompare,
};
