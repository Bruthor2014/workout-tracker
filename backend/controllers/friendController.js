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

// "YYYY-MM-DD" a partir dos componentes LOCAIS (não toISOString, que
// converte para UTC primeiro e pode deslocar a data — mesmo cuidado que
// toDateKey() no frontend).
function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Início/fim do período atual (semana/mês/ano), para o ranking entre
// amigos e a comparação — sempre calendário, não "últimos N dias", para
// toda a gente reiniciar ao mesmo tempo (ver pedido do utilizador).
function periodBounds(period) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let start;
  if (period === "month") {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (period === "year") {
    start = new Date(today.getFullYear(), 0, 1);
  } else {
    start = startOfWeek(today);
  }
  return { start: toDateStr(start), end: toDateStr(today) };
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Pontos do gráfico de comparação, um "balde" (bucket) de datas por ponto —
// a granularidade muda com o período para o gráfico continuar legível:
// "semana" = um ponto por dia (desde segunda), "mês" = um ponto por semana
// do mês (desde a semana que contém o dia 1), "ano" = um ponto por mês
// (desde janeiro). Sempre calendário, nunca passa de hoje.
function buildBuckets(period) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (period === "week") {
    const start = startOfWeek(today);
    const buckets = [];
    for (let d = start; d <= today; d = addDays(d, 1)) {
      buckets.push({ start: d, end: d, label: DAY_LABELS[d.getDay()] });
    }
    return buckets;
  }

  if (period === "year") {
    const buckets = [];
    for (let m = 0; m < 12; m++) {
      const monthStart = new Date(today.getFullYear(), m, 1);
      if (monthStart > today) break;
      const monthEndNatural = new Date(today.getFullYear(), m + 1, 0);
      const monthEnd = monthEndNatural > today ? today : monthEndNatural;
      buckets.push({ start: monthStart, end: monthEnd, label: MONTH_LABELS[m] });
    }
    return buckets;
  }

  // "month" (omissão): uma semana (seg-dom) por ponto, desde a semana que
  // contém o dia 1 do mês — a primeira semana pode incluir 1-2 dias do mês
  // anterior, tal como um calendário normal mostra.
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const buckets = [];
  for (let cursor = startOfWeek(monthStart); cursor <= today; cursor = addDays(cursor, 7)) {
    const weekEndNatural = addDays(cursor, 6);
    const weekEnd = weekEndNatural > today ? today : weekEndNatural;
    buckets.push({ start: cursor, end: weekEnd, label: `${cursor.getDate()}/${cursor.getMonth() + 1}` });
  }
  return buckets;
}

// Horas/volume/nº de treinos por "balde" de datas (ver buildBuckets) — 1
// query a trazer tudo no intervalo todo, depois agrupado em JS por balde
// (mais simples do que um GROUP BY com baldes de tamanho variável em SQL).
async function computeTrainingBuckets(userId, buckets) {
  if (buckets.length === 0) return [];
  const result = await pool.query(
    `SELECT s.performed_at,
            EXTRACT(EPOCH FROM (s.ended_at - s.started_at)) / 60 AS minutes,
            COALESCE((
              SELECT SUM(sl.reps * sl.weight)
                FROM set_logs sl JOIN exercises ex ON ex.id = sl.exercise_id
               WHERE sl.session_id = s.id AND ex.muscle_group IS DISTINCT FROM 'Cardio'
            ), 0) AS volume
       FROM workout_sessions s
      WHERE s.user_id = $1 AND s.performed_at >= $2::date AND s.performed_at <= $3::date`,
    [userId, toDateStr(buckets[0].start), toDateStr(buckets[buckets.length - 1].end)]
  );

  const totals = buckets.map((b) => ({ label: b.label, startStr: toDateStr(b.start), endStr: toDateStr(b.end), minutes: 0, volume: 0, sessions: 0 }));
  for (const row of result.rows) {
    const bucket = totals.find((b) => row.performed_at >= b.startStr && row.performed_at <= b.endStr);
    if (!bucket) continue;
    bucket.minutes += Number(row.minutes) || 0;
    bucket.volume += Number(row.volume) || 0;
    bucket.sessions += 1;
  }
  return totals.map((b) => ({
    label: b.label,
    hours: Math.round((b.minutes / 60) * 10) / 10,
    volume: Math.round(b.volume),
    sessions: b.sessions,
  }));
}

// % de refeições cumpridas do plano ATIVO, por "balde" de datas — baldes
// antes do plano existir (ou sem nenhum dia possível) ficam a `null`, não
// 0%, para o gráfico mostrar "sem dados" em vez de fingir 0% de adesão a
// um plano que ainda não existia.
async function computeNutritionBuckets(userId, buckets) {
  const planResult = await pool.query(
    `SELECT np.id, np.created_at::date AS created_date, count(ms.id)::int AS meal_count
       FROM nutrition_plans np
       LEFT JOIN meal_slots ms ON ms.nutrition_plan_id = np.id
      WHERE np.member_id = $1 AND np.is_active
      GROUP BY np.id, np.created_at`,
    [userId]
  );
  const plan = planResult.rows[0];
  if (!plan || plan.meal_count === 0) return buckets.map((b) => ({ label: b.label, percentage: null }));

  const createdDate = new Date(`${plan.created_date}T00:00:00`);
  const completionsResult = await pool.query(
    `SELECT mc.completed_at
       FROM meal_completions mc
       JOIN meal_slots ms ON ms.id = mc.meal_slot_id
      WHERE ms.nutrition_plan_id = $1`,
    [plan.id]
  );
  const completedByDate = new Map();
  for (const row of completionsResult.rows) {
    completedByDate.set(row.completed_at, (completedByDate.get(row.completed_at) || 0) + 1);
  }

  return buckets.map((b) => {
    const windowStart = b.start < createdDate ? createdDate : b.start;
    const windowEnd = b.end;
    if (windowEnd < windowStart) return { label: b.label, percentage: null };
    const days = Math.round((windowEnd - windowStart) / 86400000) + 1;
    const total = plan.meal_count * days;
    let completed = 0;
    for (let d = windowStart; d <= windowEnd; d = addDays(d, 1)) {
      completed += completedByDate.get(toDateStr(d)) || 0;
    }
    return { label: b.label, percentage: Math.round((completed / total) * 100) };
  });
}

// Dias de calendário distintos com pelo menos um treino, por utilizador,
// no período — de propósito NÃO é peso levantado nem horas treinadas:
// isso favorece quem é mais forte ou tem mais tempo livre. 1 dia treinado
// = 1 ponto, para toda a gente, independentemente de quanto/quão pesado.
async function computeTrainingPoints(userIds, start, end) {
  const result = await pool.query(
    `SELECT user_id, COUNT(DISTINCT performed_at)::int AS points
       FROM workout_sessions
      WHERE user_id = ANY($1::int[]) AND performed_at >= $2::date AND performed_at <= $3::date
      GROUP BY user_id`,
    [userIds, start, end]
  );
  return new Map(result.rows.map((r) => [r.user_id, r.points]));
}

// Percentagem de refeições cumpridas (plano ATIVO de cada um) no período —
// percentagem, não contagem bruta, para não favorecer quem tem um plano
// com mais refeições por dia. Quem não tem plano ativo (ou o plano não
// tem refeições) fica de fora do mapa devolvido — ver getRanking: isso
// não entra no ranking de nutrição, mas também não afeta o de treino, são
// completamente independentes (pedido explícito do utilizador).
async function computeNutritionAdherence(userIds, start, end) {
  const result = await pool.query(
    `WITH active_plans AS (
       SELECT np.member_id, np.id AS plan_id, np.created_at::date AS created_date,
              count(ms.id)::int AS meal_count
         FROM nutrition_plans np
         LEFT JOIN meal_slots ms ON ms.nutrition_plan_id = np.id
        WHERE np.member_id = ANY($1::int[]) AND np.is_active
        GROUP BY np.id, np.created_at
     ),
     totals AS (
       SELECT member_id, plan_id, meal_count,
              GREATEST(created_date, $2::date) AS window_start,
              $3::date AS window_end
         FROM active_plans
        WHERE meal_count > 0
     )
     SELECT t.member_id,
            t.meal_count * GREATEST((t.window_end - t.window_start)::int + 1, 0) AS total_possible,
            (SELECT count(*)::int
               FROM meal_completions mc
               JOIN meal_slots ms ON ms.id = mc.meal_slot_id
              WHERE ms.nutrition_plan_id = t.plan_id
                AND mc.completed_at >= t.window_start AND mc.completed_at <= t.window_end
            ) AS completed
       FROM totals t
      WHERE t.window_end >= t.window_start AND t.meal_count * ((t.window_end - t.window_start)::int + 1) > 0`,
    [userIds, start, end]
  );
  return new Map(
    result.rows.map((r) => [
      r.member_id,
      { completed: r.completed, total: r.total_possible, percentage: Math.round((r.completed / r.total_possible) * 100) },
    ])
  );
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

// GET /api/friends/:id/compare — os meus números e os dele, lado a lado,
// sempre em gráficos semanais (treinos/horas/volume/nutrição) — nada de
// contagens soltas tipo "dias treinados" vs. "treinos" a repetir a mesma
// informação de formas diferentes.
// GET /api/friends/:id/compare?period=week|month|year — os meus números e
// os dele, lado a lado, sempre em gráficos — a granularidade muda com o
// período (ver buildBuckets): dia a dia numa semana, semana a semana num
// mês, mês a mês num ano. Mesmo período usado no separador "Ranking".
async function getCompare(req, res) {
  const followeeId = Number(req.params.id);
  if (!(await assertFollowing(req.user.id, followeeId))) {
    return res.status(403).json({ message: "Só podes comparar-te com quem segues." });
  }
  const userResult = await pool.query("SELECT id, name, avatar_url, role FROM users WHERE id = $1", [followeeId]);
  if (!userResult.rows[0]) return res.status(404).json({ message: "Utilizador não encontrado." });

  const period = ["week", "month", "year"].includes(req.query.period) ? req.query.period : "month";
  const buckets = buildBuckets(period);

  const [meTraining, friendTraining, meNutrition, friendNutrition] = await Promise.all([
    computeTrainingBuckets(req.user.id, buckets),
    computeTrainingBuckets(followeeId, buckets),
    computeNutritionBuckets(req.user.id, buckets),
    computeNutritionBuckets(followeeId, buckets),
  ]);
  // "me" não traz user info — o frontend já tem o próprio nome/avatar via
  // sessão (AuthContext), não precisa de vir repetido aqui.
  res.json({
    period,
    me: { training: meTraining, nutrition: meNutrition },
    friend: { user: userResult.rows[0], training: friendTraining, nutrition: friendNutrition },
  });
}

// GET /api/friends/ranking?period=week|month|year — dois rankings
// SEPARADOS (treino e nutrição) entre o próprio e quem segue. Separados de
// propósito: quem não segue plano de nutrição não aparece no de nutrição,
// mas isso não lhe tira lugar nenhum no de treino (pedido explícito).
async function getRanking(req, res) {
  const period = ["week", "month", "year"].includes(req.query.period) ? req.query.period : "month";
  const { start, end } = periodBounds(period);

  const followingResult = await pool.query(`SELECT followee_id FROM friendships WHERE follower_id = $1`, [
    req.user.id,
  ]);
  const userIds = [req.user.id, ...followingResult.rows.map((r) => r.followee_id)];

  const [usersResult, trainingPoints, nutritionAdherence] = await Promise.all([
    pool.query(`SELECT id, name, avatar_url, role FROM users WHERE id = ANY($1::int[])`, [userIds]),
    computeTrainingPoints(userIds, start, end),
    computeNutritionAdherence(userIds, start, end),
  ]);
  const userById = new Map(usersResult.rows.map((u) => [u.id, u]));

  const training = userIds
    .filter((id) => userById.has(id))
    .map((id) => ({ user: userById.get(id), points: trainingPoints.get(id) || 0, is_me: id === req.user.id }))
    .sort((a, b) => b.points - a.points);

  const nutrition = userIds
    .map((id) => {
      const adherence = nutritionAdherence.get(id);
      if (!adherence || !userById.has(id)) return null;
      return { user: userById.get(id), ...adherence, is_me: id === req.user.id };
    })
    .filter(Boolean)
    .sort((a, b) => b.percentage - a.percentage);

  res.json({ period, training, nutrition });
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
  getRanking,
};
