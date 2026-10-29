const pool = require("../db/pool");
const { fetchPlanById: fetchWorkoutPlanById, insertPlan: insertWorkoutPlan } = require("./planController");
const { fetchPlanById: fetchNutritionPlanById, insertPlan: insertNutritionPlan } = require("./nutritionController");

// "workout_plans"/"nutrition_plans" só a partir de um valor já validado
// contra esta lista (ver createShare) — nunca a partir do body em bruto, por
// isso é seguro interpolar na query.
const TABLE_BY_TYPE = { workout: "workout_plans", nutrition: "nutrition_plans" };

async function isFriend(userA, userB) {
  const result = await pool.query(
    `SELECT 1 FROM friendships
      WHERE (follower_id = $1 AND followee_id = $2) OR (follower_id = $2 AND followee_id = $1)`,
    [userA, userB]
  );
  return result.rows.length > 0;
}

// GET /api/plan-shares/contacts — amigos (seguidos ou seguidores, qualquer
// direção) com quem dá para partilhar um plano, para o seletor do modal de
// partilha (ver SharePlanModal.jsx).
async function listShareableContacts(req, res) {
  const result = await pool.query(
    `SELECT DISTINCT u.id, u.name, u.avatar_url, u.role
       FROM friendships f
       JOIN users u ON u.id = (CASE WHEN f.follower_id = $1 THEN f.followee_id ELSE f.follower_id END)
      WHERE f.follower_id = $1 OR f.followee_id = $1
      ORDER BY u.name`,
    [req.user.id]
  );
  res.json(result.rows);
}

const PLAN_LABEL = { workout: "plano de treino", nutrition: "plano de nutrição" };

// POST /api/plan-shares { plan_type, plan_id, to_user_id } — só planos
// pessoais (criados pelo próprio, não os do PT/nutricionista — ver
// is_personal em planController.js/nutritionController.js) e só com amigos.
// A partilha aparece na conversa normal com esse amigo (ver
// messageController.js/MessagesPage.jsx), não numa caixa de entrada à
// parte — por isso cria sempre uma `messages` ligada via `plan_share_id`,
// na mesma transação, para nunca existir uma partilha sem a mensagem que a
// torna visível (ou vice-versa).
async function createShare(req, res) {
  const { plan_type, plan_id, to_user_id } = req.body;
  const table = TABLE_BY_TYPE[plan_type];
  if (!table || !Number.isInteger(plan_id) || !Number.isInteger(to_user_id)) {
    return res.status(400).json({ message: "Dados inválidos." });
  }
  if (to_user_id === req.user.id) {
    return res.status(400).json({ message: "Não podes partilhar contigo próprio." });
  }
  if (!(await isFriend(req.user.id, to_user_id))) {
    return res.status(403).json({ message: "Só podes partilhar com amigos." });
  }

  const planResult = await pool.query(
    `SELECT id, name FROM ${table} WHERE id = $1 AND member_id = $2 AND created_by = $2`,
    [plan_id, req.user.id]
  );
  if (!planResult.rows[0]) {
    return res.status(404).json({ message: "Plano pessoal não encontrado." });
  }
  const planName = planResult.rows[0].name;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const shareResult = await client.query(
      `INSERT INTO plan_shares (plan_type, plan_id, plan_name, from_user_id, to_user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, plan_type, plan_name, status, created_at`,
      [plan_type, plan_id, planName, req.user.id, to_user_id]
    );
    const share = shareResult.rows[0];
    await client.query(
      `INSERT INTO messages (sender_id, recipient_id, body, plan_share_id) VALUES ($1, $2, $3, $4)`,
      [req.user.id, to_user_id, `📋 Partilhou o ${PLAN_LABEL[plan_type]} "${planName}"`, share.id]
    );
    await client.query("COMMIT");
    res.status(201).json(share);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function findOwnShare(req, res) {
  const result = await pool.query(
    `SELECT ps.id, ps.plan_type, ps.plan_id, ps.to_user_id, ps.status,
            u.id AS from_user_id, u.name AS from_user_name, u.avatar_url AS from_user_avatar_url
       FROM plan_shares ps
       JOIN users u ON u.id = ps.from_user_id
      WHERE ps.id = $1`,
    [req.params.id]
  );
  const share = result.rows[0];
  if (!share || share.to_user_id !== req.user.id) {
    res.status(404).json({ message: "Partilha não encontrada." });
    return null;
  }
  return share;
}

async function findOwnPendingShare(req, res) {
  const share = await findOwnShare(req, res);
  if (!share) return null;
  if (share.status !== "pending") {
    res.status(400).json({ message: "Esta partilha já foi respondida." });
    return null;
  }
  return share;
}

// GET /api/plan-shares/:id/view — o plano completo, só de leitura — quem
// recebeu decide SE quer copiar (ver acceptShare) depois de o ver; nunca
// copia às cegas só por ter chegado a mensagem ("ver o plano e usar se
// quiser", não "aceitar"). Funciona em qualquer estado (pendente, já
// copiado ou dispensado) — rever um plano já respondido é inofensivo.
async function viewShare(req, res) {
  const share = await findOwnShare(req, res);
  if (!share) return;

  const plan =
    share.plan_type === "workout"
      ? await fetchWorkoutPlanById(share.plan_id, req.user)
      : await fetchNutritionPlanById(share.plan_id, req.user);
  if (!plan) return res.status(404).json({ message: "O plano original já não existe." });

  res.json({
    plan_type: share.plan_type,
    status: share.status,
    plan,
    from_user: { id: share.from_user_id, name: share.from_user_name, avatar_url: share.from_user_avatar_url },
  });
}

// POST /api/plan-shares/:id/copy — copia o plano original para a conta de
// quem recebeu (fica totalmente independente do original a partir daqui,
// tal como um plano próprio criado do zero). Reaproveita fetchPlanById +
// insertPlan dos controllers de treino/nutrição — já fazem exatamente a
// leitura/gravação completa (dias+exercícios+séries, ou refeições+opções+
// itens) que um "duplicar" precisa.
async function acceptShare(req, res) {
  const share = await findOwnPendingShare(req, res);
  if (!share) return;

  let newPlanId;
  if (share.plan_type === "workout") {
    const plan = await fetchWorkoutPlanById(share.plan_id, req.user);
    if (!plan) return res.status(404).json({ message: "O plano original já não existe." });
    newPlanId = await insertWorkoutPlan(req.user.id, req.user.id, {
      name: plan.name,
      description: plan.description,
      days: plan.days,
    });
  } else {
    const plan = await fetchNutritionPlanById(share.plan_id, req.user);
    if (!plan) return res.status(404).json({ message: "O plano original já não existe." });
    newPlanId = await insertNutritionPlan(req.user.id, req.user.id, {
      name: plan.name,
      description: plan.description,
      meals: plan.meals,
    });
  }

  await pool.query(`UPDATE plan_shares SET status = 'copied', responded_at = now() WHERE id = $1`, [share.id]);
  res.json({ plan_type: share.plan_type, plan_id: newPlanId });
}

// POST /api/plan-shares/:id/dismiss — recusar sem copiar.
async function dismissShare(req, res) {
  const share = await findOwnPendingShare(req, res);
  if (!share) return;

  await pool.query(`UPDATE plan_shares SET status = 'dismissed', responded_at = now() WHERE id = $1`, [share.id]);
  res.status(204).send();
}

module.exports = {
  listShareableContacts,
  createShare,
  viewShare,
  acceptShare,
  dismissShare,
};
