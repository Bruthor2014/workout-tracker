const pool = require("../db/pool");

const STAFF_ROLES = ["gym_owner", "personal_trainer", "nutritionist"];

async function attachDaysToPlans(plans) {
  if (plans.length === 0) return [];

  const planIds = plans.map((p) => p.id);

  const daysResult = await pool.query(
    `SELECT id, plan_id, name, order_index
       FROM plan_days
      WHERE plan_id = ANY($1)
      ORDER BY plan_id, order_index`,
    [planIds]
  );
  const days = daysResult.rows;

  const dayIds = days.map((d) => d.id);
  const exercisesResult = dayIds.length
    ? await pool.query(
        `SELECT pe.id, pe.plan_day_id, pe.order_index, pe.target_sets, pe.target_reps, pe.target_load,
                e.id AS exercise_id, e.name AS exercise_name
           FROM plan_exercises pe
           JOIN exercises e ON e.id = pe.exercise_id
          WHERE pe.plan_day_id = ANY($1)
          ORDER BY pe.plan_day_id, pe.order_index`,
        [dayIds]
      )
    : { rows: [] };

  const exercisesByDay = new Map();
  for (const row of exercisesResult.rows) {
    if (!exercisesByDay.has(row.plan_day_id)) exercisesByDay.set(row.plan_day_id, []);
    exercisesByDay.get(row.plan_day_id).push({
      id: row.id,
      exercise_id: row.exercise_id,
      exercise_name: row.exercise_name,
      order_index: row.order_index,
      target_sets: row.target_sets,
      target_reps: row.target_reps,
      target_load: row.target_load,
    });
  }

  const daysByPlan = new Map();
  for (const day of days) {
    if (!daysByPlan.has(day.plan_id)) daysByPlan.set(day.plan_id, []);
    daysByPlan.get(day.plan_id).push({
      id: day.id,
      name: day.name,
      order_index: day.order_index,
      exercises: exercisesByDay.get(day.id) || [],
    });
  }

  return plans.map((plan) => ({
    ...plan,
    days: daysByPlan.get(plan.id) || [],
  }));
}

async function fetchPlansForMember(memberId) {
  const plansResult = await pool.query(
    `SELECT id, name, description, created_at
       FROM workout_plans
      WHERE member_id = $1
      ORDER BY created_at DESC`,
    [memberId]
  );
  return attachDaysToPlans(plansResult.rows);
}

async function fetchPlanById(planId) {
  const planResult = await pool.query(
    `SELECT id, name, description, created_at FROM workout_plans WHERE id = $1`,
    [planId]
  );
  const [plan] = await attachDaysToPlans(planResult.rows);
  return plan || null;
}

async function insertDaysAndExercises(client, planId, days) {
  for (let d = 0; d < days.length; d++) {
    const day = days[d];
    const dayResult = await client.query(
      `INSERT INTO plan_days (plan_id, name, order_index) VALUES ($1, $2, $3) RETURNING id`,
      [planId, day.name, d]
    );
    const dayId = dayResult.rows[0].id;

    for (let i = 0; i < day.exercises.length; i++) {
      const { exercise_id, target_sets, target_reps, target_load } = day.exercises[i];
      await client.query(
        `INSERT INTO plan_exercises (plan_day_id, exercise_id, order_index, target_sets, target_reps, target_load)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [dayId, exercise_id, i, target_sets || null, target_reps || null, target_load || null]
      );
    }
  }
}

async function insertPlan(memberId, createdBy, { name, description, days }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const planResult = await client.query(
      `INSERT INTO workout_plans (member_id, created_by, name, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [memberId, createdBy, name, description || null]
    );
    const planId = planResult.rows[0].id;

    await insertDaysAndExercises(client, planId, days);

    await client.query("COMMIT");
    return planId;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

function validatePlanBody(req, res) {
  const { name, days } = req.body;
  if (!name || !Array.isArray(days) || days.length === 0) {
    res.status(400).json({ message: "Nome e pelo menos um dia são obrigatórios." });
    return false;
  }
  for (const day of days) {
    if (!day.name || !Array.isArray(day.exercises) || day.exercises.length === 0) {
      res.status(400).json({ message: "Cada dia precisa de nome e pelo menos um exercício." });
      return false;
    }
  }
  return true;
}

// Um plano só pode ser editado/eliminado pelo próprio membro a quem
// pertence, ou por staff do mesmo ginásio — não por staff de outro ginásio
// nem por outro membro.
async function findPlanWithAccess(req, res) {
  const result = await pool.query(
    `SELECT wp.id, wp.member_id, u.gym_id
       FROM workout_plans wp
       JOIN users u ON u.id = wp.member_id
      WHERE wp.id = $1`,
    [req.params.id]
  );
  const plan = result.rows[0];
  if (!plan) {
    res.status(404).json({ message: "Plano não encontrado." });
    return null;
  }
  const isOwner = plan.member_id === req.user.id;
  const isStaff = STAFF_ROLES.includes(req.user.role) && plan.gym_id === req.user.gymId;
  if (!isOwner && !isStaff) {
    res.status(403).json({ message: "Sem permissão para este plano." });
    return null;
  }
  return plan;
}

// GET /api/plans — o próprio membro vê os seus planos
async function listPlans(req, res) {
  res.json(await fetchPlansForMember(req.user.id));
}

// POST /api/plans — o próprio membro cria um plano para si
async function createPlan(req, res) {
  if (!validatePlanBody(req, res)) return;
  const planId = await insertPlan(req.user.id, req.user.id, req.body);
  res.status(201).json(await fetchPlanById(planId));
}

// GET /api/plans/member/:id — staff vê os planos de um membro
async function listPlansForMember(req, res) {
  res.json(await fetchPlansForMember(req.params.id));
}

// POST /api/plans/member/:id — staff cria um plano para um membro
async function createPlanForMember(req, res) {
  if (!validatePlanBody(req, res)) return;
  const planId = await insertPlan(req.params.id, req.user.id, req.body);
  res.status(201).json(await fetchPlanById(planId));
}

// PUT /api/plans/:id — editar um plano (dono ou staff do mesmo ginásio).
// Substitui dias/exercícios por inteiro em vez de tentar comparar/atualizar
// linha a linha, mesmo padrão já usado no PUT de sessões.
async function updatePlan(req, res) {
  const plan = await findPlanWithAccess(req, res);
  if (!plan) return;
  if (!validatePlanBody(req, res)) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE workout_plans SET name = $1, description = $2 WHERE id = $3`, [
      req.body.name,
      req.body.description || null,
      plan.id,
    ]);
    await client.query(`DELETE FROM plan_days WHERE plan_id = $1`, [plan.id]);
    await insertDaysAndExercises(client, plan.id, req.body.days);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  res.json(await fetchPlanById(plan.id));
}

// DELETE /api/plans/:id — eliminar um plano (dono ou staff do mesmo ginásio)
async function deletePlan(req, res) {
  const plan = await findPlanWithAccess(req, res);
  if (!plan) return;

  await pool.query(`DELETE FROM workout_plans WHERE id = $1`, [plan.id]);
  res.status(204).send();
}

module.exports = {
  listPlans,
  createPlan,
  listPlansForMember,
  createPlanForMember,
  updatePlan,
  deletePlan,
};
