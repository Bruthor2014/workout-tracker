const pool = require("../db/pool");

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
        `SELECT pe.id, pe.plan_day_id, pe.order_index, pe.set_type,
                e.id AS exercise_id, e.name AS exercise_name, e.muscle_group, e.image_url
           FROM plan_exercises pe
           JOIN exercises e ON e.id = pe.exercise_id
          WHERE pe.plan_day_id = ANY($1)
          ORDER BY pe.plan_day_id, pe.order_index`,
        [dayIds]
      )
    : { rows: [] };

  const exerciseIds = exercisesResult.rows.map((row) => row.id);
  const setsResult = exerciseIds.length
    ? await pool.query(
        `SELECT plan_exercise_id, set_number, target_reps, target_reps_max, target_load
           FROM plan_exercise_sets
          WHERE plan_exercise_id = ANY($1)
          ORDER BY plan_exercise_id, set_number`,
        [exerciseIds]
      )
    : { rows: [] };
  const setsByExercise = new Map();
  for (const row of setsResult.rows) {
    if (!setsByExercise.has(row.plan_exercise_id)) setsByExercise.set(row.plan_exercise_id, []);
    setsByExercise.get(row.plan_exercise_id).push({
      target_reps: row.target_reps,
      target_reps_max: row.target_reps_max,
      target_load: row.target_load,
    });
  }

  const exercisesByDay = new Map();
  for (const row of exercisesResult.rows) {
    if (!exercisesByDay.has(row.plan_day_id)) exercisesByDay.set(row.plan_day_id, []);
    exercisesByDay.get(row.plan_day_id).push({
      id: row.id,
      exercise_id: row.exercise_id,
      exercise_name: row.exercise_name,
      muscle_group: row.muscle_group,
      image_url: row.image_url,
      order_index: row.order_index,
      set_type: row.set_type,
      sets: setsByExercise.get(row.id) || [],
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

// `viewer` (req.user) é quem está a ver: decide o `can_edit` de cada plano.
async function fetchPlansForMember(memberId, viewer) {
  const plansResult = await pool.query(
    `SELECT wp.id, wp.name, wp.description, wp.created_at, wp.created_by,
            cu.name AS created_by_name, cu.role AS created_by_role,
            -- Pessoal = criado pelo próprio membro. created_by NULL = criado por
            -- alguém que já saiu do ginásio (continua a ser um plano do staff).
            COALESCE(wp.created_by = wp.member_id, false) AS is_personal,
            -- Quem pode editar/eliminar (mesma regra que findPlanWithAccess).
            COALESCE(wp.created_by = $2
              OR ($3 = 'personal_trainer'
                  AND ((cu.role = 'personal_trainer' AND cu.gym_id = $4) OR wp.created_by IS NULL)
                  AND wp.created_by IS DISTINCT FROM wp.member_id), false) AS can_edit
       FROM workout_plans wp
       LEFT JOIN users cu ON cu.id = wp.created_by
      WHERE wp.member_id = $1
      ORDER BY wp.created_at DESC`,
    [memberId, viewer.id, viewer.role, viewer.gymId]
  );
  return attachDaysToPlans(plansResult.rows);
}

async function fetchPlanById(planId, viewer) {
  const planResult = await pool.query(
    `SELECT wp.id, wp.name, wp.description, wp.created_at, wp.created_by,
            cu.name AS created_by_name, cu.role AS created_by_role,
            -- Pessoal = criado pelo próprio membro. created_by NULL = criado por
            -- alguém que já saiu do ginásio (continua a ser um plano do staff).
            COALESCE(wp.created_by = wp.member_id, false) AS is_personal,
            -- Quem pode editar/eliminar (mesma regra que findPlanWithAccess).
            COALESCE(wp.created_by = $2
              OR ($3 = 'personal_trainer'
                  AND ((cu.role = 'personal_trainer' AND cu.gym_id = $4) OR wp.created_by IS NULL)
                  AND wp.created_by IS DISTINCT FROM wp.member_id), false) AS can_edit
       FROM workout_plans wp
       LEFT JOIN users cu ON cu.id = wp.created_by
      WHERE wp.id = $1`,
    [planId, viewer.id, viewer.role, viewer.gymId]
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
    await insertDayExercises(client, dayResult.rows[0].id, day.exercises);
  }
}

// Mesmas técnicas de set_logs.set_type (ver utils/setTypes.js no frontend).
const SET_TYPES = ["normal", "drop", "rest_pause", "cluster", "superset", "pyramid", "failure"];

async function insertDayExercises(client, dayId, exercises) {
  for (let i = 0; i < exercises.length; i++) {
    const { exercise_id, set_type, sets } = exercises[i];
    const peResult = await client.query(
      `INSERT INTO plan_exercises (plan_day_id, exercise_id, order_index, set_type)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [dayId, exercise_id, i, SET_TYPES.includes(set_type) ? set_type : "normal"]
    );
    const planExerciseId = peResult.rows[0].id;

    for (let s = 0; s < sets.length; s++) {
      const { target_reps, target_reps_max, target_load } = sets[s];
      // Um "intervalo" com mínimo = máximo (ex: 10-10) é só um número.
      const repsMax = target_reps_max && target_reps_max !== target_reps ? target_reps_max : null;
      await client.query(
        `INSERT INTO plan_exercise_sets (plan_exercise_id, set_number, target_reps, target_reps_max, target_load)
         VALUES ($1, $2, $3, $4, $5)`,
        [planExerciseId, s + 1, target_reps || null, repsMax, target_load || null]
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

// Devolve a mensagem de erro de um dia inválido, ou null se estiver ok.
function dayError(day) {
  if (!day || !day.name || !Array.isArray(day.exercises) || day.exercises.length === 0) {
    return "Cada dia precisa de nome e pelo menos um exercício.";
  }
  for (const ex of day.exercises) {
    if (!Array.isArray(ex.sets) || ex.sets.length === 0) {
      return "Cada exercício precisa de pelo menos uma série.";
    }
    // Reps alvo como intervalo (ex: 8-12): target_reps é o mínimo e
    // target_reps_max o máximo — o máximo só faz sentido com mínimo, e não
    // pode ser menor que ele.
    for (const set of ex.sets) {
      if (set.target_reps_max == null) continue;
      const min = Number(set.target_reps);
      const max = Number(set.target_reps_max);
      if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min) {
        return "Intervalo de reps inválido (ex: 8-12, com o máximo maior que o mínimo).";
      }
    }
  }
  return null;
}

function validatePlanBody(req, res) {
  const { name, days } = req.body;
  if (!name || !Array.isArray(days) || days.length === 0) {
    res.status(400).json({ message: "Nome e pelo menos um dia são obrigatórios." });
    return false;
  }
  for (const day of days) {
    const message = dayError(day);
    if (message) {
      res.status(400).json({ message });
      return false;
    }
  }
  return true;
}

// Quem pode editar/eliminar um plano:
// - quem o criou (o PT que o fez para o membro, ou o próprio membro
//   num plano pessoal);
// - outro PT do mesmo ginásio, se o plano foi feito por um PT
//   (colegas podem pegar no trabalho uns dos outros).
// O membro vê os planos do staff mas não os altera, e o staff não altera os
// planos pessoais do membro.
async function findPlanWithAccess(req, res) {
  const result = await pool.query(
    `SELECT wp.id, wp.member_id, wp.created_by, cu.role AS creator_role, cu.gym_id AS creator_gym_id,
            m.gym_id AS member_gym_id
       FROM workout_plans wp
       JOIN users m ON m.id = wp.member_id
       LEFT JOIN users cu ON cu.id = wp.created_by
      WHERE wp.id = $1`,
    [req.params.id]
  );
  const plan = result.rows[0];
  if (!plan) {
    res.status(404).json({ message: "Plano não encontrado." });
    return null;
  }
  const isCreator = plan.created_by === req.user.id;
  // Colega da mesma especialidade: plano de outro PT do ginásio, ou de
  // alguém que já saiu (created_by NULL).
  const madeBySameRole = plan.creator_role === "personal_trainer" && plan.creator_gym_id === req.user.gymId;
  const madeByFormerStaff = plan.created_by === null && plan.member_gym_id === req.user.gymId;
  const isPeer = req.user.role === "personal_trainer" && (madeBySameRole || madeByFormerStaff);
  if (!isCreator && !isPeer) {
    res.status(403).json({ message: "Só quem criou este plano o pode alterar ou eliminar." });
    return null;
  }
  return plan;
}

// GET /api/plans — o próprio membro vê os seus planos
async function listPlans(req, res) {
  res.json(await fetchPlansForMember(req.user.id, req.user));
}

// POST /api/plans — o próprio membro cria um plano para si
async function createPlan(req, res) {
  if (!validatePlanBody(req, res)) return;
  const planId = await insertPlan(req.user.id, req.user.id, req.body);
  res.status(201).json(await fetchPlanById(planId, req.user));
}

// GET /api/plans/member/:id — staff vê os planos de um membro
async function listPlansForMember(req, res) {
  res.json(await fetchPlansForMember(req.params.id, req.user));
}

// POST /api/plans/member/:id — staff cria um plano para um membro
async function createPlanForMember(req, res) {
  if (!validatePlanBody(req, res)) return;
  const planId = await insertPlan(req.params.id, req.user.id, req.body);
  res.status(201).json(await fetchPlanById(planId, req.user));
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

  res.json(await fetchPlanById(plan.id, req.user));
}

// PUT /api/plans/:id/days/:dayId — editar só um dia do plano (nome e
// exercícios), sem mexer nos outros dias. Mesmas permissões que editar o
// plano inteiro.
async function updatePlanDay(req, res) {
  const plan = await findPlanWithAccess(req, res);
  if (!plan) return;
  const message = dayError(req.body);
  if (message) return res.status(400).json({ message });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const dayResult = await client.query(`UPDATE plan_days SET name = $1 WHERE id = $2 AND plan_id = $3 RETURNING id`, [
      req.body.name,
      req.params.dayId,
      plan.id,
    ]);
    if (dayResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Dia não encontrado neste plano." });
    }
    await client.query(`DELETE FROM plan_exercises WHERE plan_day_id = $1`, [req.params.dayId]);
    await insertDayExercises(client, req.params.dayId, req.body.exercises);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  res.json(await fetchPlanById(plan.id, req.user));
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
  updatePlanDay,
  deletePlan,
};
