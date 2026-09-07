const pool = require("../db/pool");

const STAFF_ROLES = ["gym_owner", "personal_trainer", "nutritionist"];

async function attachMealsToPlans(plans) {
  if (plans.length === 0) return [];

  const planIds = plans.map((p) => p.id);

  const slotsResult = await pool.query(
    `SELECT id, nutrition_plan_id, name, order_index
       FROM meal_slots
      WHERE nutrition_plan_id = ANY($1)
      ORDER BY nutrition_plan_id, order_index`,
    [planIds]
  );
  const slots = slotsResult.rows;

  const slotIds = slots.map((s) => s.id);
  const optionsResult = slotIds.length
    ? await pool.query(
        `SELECT id, meal_slot_id, description, order_index
           FROM meal_options
          WHERE meal_slot_id = ANY($1)
          ORDER BY meal_slot_id, order_index`,
        [slotIds]
      )
    : { rows: [] };
  const options = optionsResult.rows;

  const optionIds = options.map((o) => o.id);
  const itemsResult = optionIds.length
    ? await pool.query(
        `SELECT id, meal_option_id, food_name, quantity, order_index
           FROM meal_option_items
          WHERE meal_option_id = ANY($1)
          ORDER BY meal_option_id, order_index`,
        [optionIds]
      )
    : { rows: [] };

  const itemsByOption = new Map();
  for (const item of itemsResult.rows) {
    if (!itemsByOption.has(item.meal_option_id)) itemsByOption.set(item.meal_option_id, []);
    itemsByOption.get(item.meal_option_id).push(item);
  }

  const optionsBySlot = new Map();
  for (const opt of options) {
    if (!optionsBySlot.has(opt.meal_slot_id)) optionsBySlot.set(opt.meal_slot_id, []);
    optionsBySlot.get(opt.meal_slot_id).push({
      id: opt.id,
      description: opt.description,
      order_index: opt.order_index,
      items: itemsByOption.get(opt.id) || [],
    });
  }

  const slotsByPlan = new Map();
  for (const slot of slots) {
    if (!slotsByPlan.has(slot.nutrition_plan_id)) slotsByPlan.set(slot.nutrition_plan_id, []);
    slotsByPlan.get(slot.nutrition_plan_id).push({
      id: slot.id,
      name: slot.name,
      order_index: slot.order_index,
      options: optionsBySlot.get(slot.id) || [],
    });
  }

  return plans.map((plan) => ({
    ...plan,
    meals: slotsByPlan.get(plan.id) || [],
  }));
}

async function fetchPlansForMember(memberId) {
  const plansResult = await pool.query(
    `SELECT id, name, description, created_at
       FROM nutrition_plans
      WHERE member_id = $1
      ORDER BY created_at DESC`,
    [memberId]
  );
  return attachMealsToPlans(plansResult.rows);
}

async function fetchPlanById(planId) {
  const planResult = await pool.query(
    `SELECT id, name, description, created_at FROM nutrition_plans WHERE id = $1`,
    [planId]
  );
  const [plan] = await attachMealsToPlans(planResult.rows);
  return plan || null;
}

async function insertMealsAndItems(client, planId, meals) {
  for (let s = 0; s < meals.length; s++) {
    const meal = meals[s];
    const slotResult = await client.query(
      `INSERT INTO meal_slots (nutrition_plan_id, name, order_index) VALUES ($1, $2, $3) RETURNING id`,
      [planId, meal.name, s]
    );
    const slotId = slotResult.rows[0].id;

    for (let i = 0; i < meal.options.length; i++) {
      const option = meal.options[i];
      const optionResult = await client.query(
        `INSERT INTO meal_options (meal_slot_id, description, order_index) VALUES ($1, $2, $3) RETURNING id`,
        [slotId, option.description || null, i]
      );
      const optionId = optionResult.rows[0].id;

      for (let j = 0; j < option.items.length; j++) {
        const item = option.items[j];
        await client.query(
          `INSERT INTO meal_option_items (meal_option_id, food_name, quantity, order_index) VALUES ($1, $2, $3, $4)`,
          [optionId, item.food_name, item.quantity || null, j]
        );
      }
    }
  }
}

async function insertPlan(memberId, createdBy, { name, description, meals }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const planResult = await client.query(
      `INSERT INTO nutrition_plans (member_id, created_by, name, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [memberId, createdBy, name, description || null]
    );
    const planId = planResult.rows[0].id;

    await insertMealsAndItems(client, planId, meals);

    await client.query("COMMIT");
    return planId;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

function validateNutritionBody(req, res) {
  const { name, meals } = req.body;
  if (!name || !Array.isArray(meals) || meals.length === 0) {
    res.status(400).json({ message: "Nome e pelo menos uma refeição são obrigatórios." });
    return false;
  }
  for (const meal of meals) {
    if (!meal.name || !Array.isArray(meal.options) || meal.options.length === 0) {
      res.status(400).json({ message: "Cada refeição precisa de nome e pelo menos uma opção." });
      return false;
    }
    for (const option of meal.options) {
      if (!Array.isArray(option.items) || option.items.length === 0) {
        res.status(400).json({ message: "Cada opção precisa de pelo menos um elemento." });
        return false;
      }
      for (const item of option.items) {
        if (!item.food_name) {
          res.status(400).json({ message: "Cada elemento precisa de um nome." });
          return false;
        }
      }
    }
  }
  return true;
}

// Um plano só pode ser editado/eliminado pelo próprio membro a quem
// pertence, ou por staff do mesmo ginásio.
async function findPlanWithAccess(req, res) {
  const result = await pool.query(
    `SELECT np.id, np.member_id, u.gym_id
       FROM nutrition_plans np
       JOIN users u ON u.id = np.member_id
      WHERE np.id = $1`,
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

// GET /api/nutrition-plans — o próprio membro vê o(s) seu(s) plano(s)
async function listPlans(req, res) {
  res.json(await fetchPlansForMember(req.user.id));
}

// POST /api/nutrition-plans — o próprio membro cria um plano para si
async function createPlan(req, res) {
  if (!validateNutritionBody(req, res)) return;
  const planId = await insertPlan(req.user.id, req.user.id, req.body);
  res.status(201).json(await fetchPlanById(planId));
}

// GET /api/nutrition-plans/member/:id — staff vê os planos de um membro
// (inclui os que o próprio membro criou, não só os do staff)
async function listPlansForMember(req, res) {
  res.json(await fetchPlansForMember(req.params.id));
}

// POST /api/nutrition-plans/member/:id — staff (nutricionista/gym_owner/PT) cria
// um plano de nutrição para um membro
async function createPlanForMember(req, res) {
  if (!validateNutritionBody(req, res)) return;
  const planId = await insertPlan(req.params.id, req.user.id, req.body);
  res.status(201).json(await fetchPlanById(planId));
}

// PUT /api/nutrition-plans/:id — editar um plano (dono ou staff do mesmo
// ginásio). Substitui refeições/opções/itens por inteiro.
async function updatePlan(req, res) {
  const plan = await findPlanWithAccess(req, res);
  if (!plan) return;
  if (!validateNutritionBody(req, res)) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE nutrition_plans SET name = $1, description = $2 WHERE id = $3`, [
      req.body.name,
      req.body.description || null,
      plan.id,
    ]);
    await client.query(`DELETE FROM meal_slots WHERE nutrition_plan_id = $1`, [plan.id]);
    await insertMealsAndItems(client, plan.id, req.body.meals);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  res.json(await fetchPlanById(plan.id));
}

// DELETE /api/nutrition-plans/:id — eliminar um plano (dono ou staff do
// mesmo ginásio)
async function deletePlan(req, res) {
  const plan = await findPlanWithAccess(req, res);
  if (!plan) return;

  await pool.query(`DELETE FROM nutrition_plans WHERE id = $1`, [plan.id]);
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
