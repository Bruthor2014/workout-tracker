const pool = require("../db/pool");

// Campos opcionais de cada alimento (foto, marca, código e valores
// nutricionais do Open Food Facts) — ver foodController.js.
const ITEM_DETAIL_COLUMNS = ["brand", "image_url", "off_code", "kcal_100g", "protein_100g", "carbs_100g", "fat_100g"];
const NUMERIC_DETAILS = ["kcal_100g", "protein_100g", "carbs_100g", "fat_100g"];

// Em produção (SUPABASE_URL configurado — ver services/storage.js), uma
// foto carregada na app devolve um URL público completo do Supabase
// Storage, não "/uploads/foods/...". Sem este prefixo na lista de
// permitidos, cleanImageUrl rejeitava (punha a null) toda e qualquer foto
// de alimento carregada em produção — ficavam todas sem imagem.
const SUPABASE_FOODS_PREFIX = process.env.SUPABASE_URL
  ? `${process.env.SUPABASE_URL}/storage/v1/object/public/${process.env.SUPABASE_STORAGE_BUCKET || "uploads"}/foods/`
  : null;

function cleanText(value, maxLength) {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim().slice(0, maxLength);
}

// Só fotos carregadas na app (disco local ou Supabase Storage) ou imagens
// do Open Food Facts — nada de URLs arbitrários vindos do cliente.
function cleanImageUrl(value) {
  if (typeof value !== "string") return null;
  if (/^\/uploads\/foods\/[\w.-]+$/.test(value)) return value;
  if (/^https:\/\/images\.openfoodfacts\.org\//.test(value)) return value.slice(0, 500);
  if (SUPABASE_FOODS_PREFIX && value.startsWith(SUPABASE_FOODS_PREFIX) && /^[\w.-]+$/.test(value.slice(SUPABASE_FOODS_PREFIX.length))) {
    return value;
  }
  return null;
}

function itemDetails(item) {
  const details = {
    brand: cleanText(item.brand, 150),
    image_url: cleanImageUrl(item.image_url),
    off_code: cleanText(item.off_code, 32),
  };
  for (const field of NUMERIC_DETAILS) {
    const n = Number(item[field]);
    details[field] = item[field] !== null && item[field] !== "" && Number.isFinite(n) && n >= 0 ? n : null;
  }
  return ITEM_DETAIL_COLUMNS.map((column) => details[column]);
}

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
        `SELECT id, meal_option_id, food_name, quantity, order_index,
                brand, image_url, off_code,
                -- ::float para virem como número no JSON (NUMERIC vem como texto)
                kcal_100g::float AS kcal_100g, protein_100g::float AS protein_100g,
                carbs_100g::float AS carbs_100g, fat_100g::float AS fat_100g
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

// `viewer` (req.user) é quem está a ver: decide o `can_edit` de cada plano.
async function fetchPlansForMember(memberId, viewer) {
  const plansResult = await pool.query(
    `SELECT np.id, np.name, np.description, np.created_at, np.created_by, np.is_active, np.order_index,
            np.active_since,
            cu.name AS created_by_name, cu.role AS created_by_role,
            -- Pessoal = criado pelo próprio membro. created_by NULL = criado por
            -- alguém que já saiu do ginásio (continua a ser um plano do staff).
            COALESCE(np.created_by = np.member_id, false) AS is_personal,
            -- Quem pode editar/eliminar (mesma regra que findPlanWithAccess).
            COALESCE(np.created_by = $2
              OR ($3 = 'nutritionist'
                  AND ((cu.role = 'nutritionist' AND cu.gym_id = $4) OR np.created_by IS NULL)
                  AND np.created_by IS DISTINCT FROM np.member_id), false) AS can_edit
       FROM nutrition_plans np
       LEFT JOIN users cu ON cu.id = np.created_by
      WHERE np.member_id = $1
      ORDER BY np.order_index, np.created_at DESC`,
    [memberId, viewer.id, viewer.role, viewer.gymId]
  );
  return attachMealsToPlans(plansResult.rows);
}

async function fetchPlanById(planId, viewer) {
  const planResult = await pool.query(
    `SELECT np.id, np.name, np.description, np.created_at, np.created_by, np.is_active, np.order_index,
            np.active_since,
            cu.name AS created_by_name, cu.role AS created_by_role,
            -- Pessoal = criado pelo próprio membro. created_by NULL = criado por
            -- alguém que já saiu do ginásio (continua a ser um plano do staff).
            COALESCE(np.created_by = np.member_id, false) AS is_personal,
            -- Quem pode editar/eliminar (mesma regra que findPlanWithAccess).
            COALESCE(np.created_by = $2
              OR ($3 = 'nutritionist'
                  AND ((cu.role = 'nutritionist' AND cu.gym_id = $4) OR np.created_by IS NULL)
                  AND np.created_by IS DISTINCT FROM np.member_id), false) AS can_edit
       FROM nutrition_plans np
       LEFT JOIN users cu ON cu.id = np.created_by
      WHERE np.id = $1`,
    [planId, viewer.id, viewer.role, viewer.gymId]
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
    await insertMealOptions(client, slotResult.rows[0].id, meal.options);
  }
}

async function insertMealOptions(client, slotId, options) {
  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    const optionResult = await client.query(
      `INSERT INTO meal_options (meal_slot_id, description, order_index) VALUES ($1, $2, $3) RETURNING id`,
      [slotId, option.description || null, i]
    );
    const optionId = optionResult.rows[0].id;

    for (let j = 0; j < option.items.length; j++) {
      const item = option.items[j];
      await client.query(
        `INSERT INTO meal_option_items
           (meal_option_id, food_name, quantity, order_index, ${ITEM_DETAIL_COLUMNS.join(", ")})
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [optionId, item.food_name, item.quantity || null, j, ...itemDetails(item)]
      );
    }
  }
}

async function insertPlan(memberId, createdBy, { name, description, meals }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // O primeiro plano de alguém fica logo ativo (não faz sentido pedir
    // para escolher quando só há um); a partir do segundo, fica inativo
    // até a pessoa escolher — não se substitui silenciosamente a escolha
    // que já tinha feito. order_index: vai sempre para o fim da lista.
    const planResult = await client.query(
      `INSERT INTO nutrition_plans (member_id, created_by, name, description, is_active, active_since, order_index)
       VALUES (
         $1, $2, $3, $4,
         NOT EXISTS (SELECT 1 FROM nutrition_plans WHERE member_id = $1),
         CASE WHEN NOT EXISTS (SELECT 1 FROM nutrition_plans WHERE member_id = $1) THEN now() END,
         COALESCE((SELECT max(order_index) + 1 FROM nutrition_plans WHERE member_id = $1), 0)
       )
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

// Devolve a mensagem de erro de uma refeição inválida, ou null se estiver ok.
function mealError(meal) {
  if (!meal || !meal.name || !Array.isArray(meal.options) || meal.options.length === 0) {
    return "Cada refeição precisa de nome e pelo menos uma opção.";
  }
  for (const option of meal.options) {
    if (!Array.isArray(option.items) || option.items.length === 0) {
      return "Cada opção precisa de pelo menos um elemento.";
    }
    if (option.items.some((item) => !item.food_name)) {
      return "Cada elemento precisa de um nome.";
    }
  }
  return null;
}

function validateNutritionBody(req, res) {
  const { name, meals } = req.body;
  if (!name || !Array.isArray(meals) || meals.length === 0) {
    res.status(400).json({ message: "Nome e pelo menos uma refeição são obrigatórios." });
    return false;
  }
  for (const meal of meals) {
    const message = mealError(meal);
    if (message) {
      res.status(400).json({ message });
      return false;
    }
  }
  return true;
}

// GET /api/nutrition-plans/completion-summary — "10/12 refeições cumpridas
// este mês" do plano ATIVO do próprio (com mais do que um plano, só esse
// conta — ver PUT /nutrition-plans/:id/active). Pensado para ser leve (sem
// opções/itens) — usado no Dashboard e no Perfil, que carregam sempre, ao
// contrário do cartão do plano em si.
// Dias de calendário desde o início da janela (criação do plano, ou há 30
// dias, o que for mais recente) até hoje, inclusive — tudo calculado como
// DATE no Postgres (CURRENT_DATE), nunca em milissegundos decorridos no
// Node. Milissegundos/24h subestima quando o plano foi criado ontem à
// noite: passam-se menos de 24h reais mas já são 2 dias de calendário
// diferentes, e o total ficava preso a "1 dia" mesmo já tendo refeições
// cumpridas em 2 dias (completed > total, visivelmente errado).
// completed_at também é DATE, por isso faz sentido comparar datas com
// datas em vez de misturar com Date.now().
async function getCompletionSummary(req, res) {
  const result = await pool.query(
    `WITH plan AS (
       SELECT np.id, np.created_at::date AS created_date, count(ms.id)::int AS meal_count
         FROM nutrition_plans np
         LEFT JOIN meal_slots ms ON ms.nutrition_plan_id = np.id
        WHERE np.member_id = $1 AND np.is_active
        GROUP BY np.id, np.created_at
     )
     SELECT plan.meal_count,
            (CURRENT_DATE - GREATEST(plan.created_date, CURRENT_DATE - 29))::int + 1 AS days,
            (SELECT count(*)::int
               FROM meal_completions mc
               JOIN meal_slots ms ON ms.id = mc.meal_slot_id
              WHERE ms.nutrition_plan_id = plan.id AND mc.member_id = $1
                AND mc.completed_at >= GREATEST(plan.created_date, CURRENT_DATE - 29)) AS completed
       FROM plan`,
    [req.user.id]
  );
  const row = result.rows[0];
  if (!row || row.meal_count === 0) return res.json(null);

  res.json({ completed: row.completed, total: row.meal_count * row.days });
}

// "quantity" é texto livre (ex: "2 unidades", "1 fatia", "150g") — só dá
// para converter em calorias quando vem claramente em gramas/kg. Nesses
// casos devolve os gramas; nos outros (unidades, fatias, vazio, só um
// número sem unidade) devolve null — esse item fica fora do total, nunca
// se inventa uma conversão (ex: tratar "2 unidades" como "2 gramas").
function parseGrams(quantity) {
  if (!quantity) return null;
  const match = String(quantity).match(/(\d+(?:[.,]\d+)?)\s*(kg|kilos?|gr|g|gramas?)\b/i);
  if (!match) return null;
  const amount = parseFloat(match[1].replace(",", "."));
  if (!Number.isFinite(amount)) return null;
  return match[2].toLowerCase().startsWith("k") ? amount * 1000 : amount;
}

// GET /api/nutrition-plans/calories-today — calorias dos itens das
// refeições já marcadas como cumpridas HOJE, do plano ativo. Usa sempre a
// 1.ª opção de cada refeição (não há registo de qual opção foi realmente
// seguida quando há mais do que uma) — é uma estimativa, não um diário
// alimentar exato. `items_counted`/`items_total` dizem quantos itens
// entraram de facto na conta, para o frontend poder avisar se ficou
// incompleto (ver parseGrams).
async function getCaloriesConsumedToday(req, res) {
  const plan = await pool.query(`SELECT id FROM nutrition_plans WHERE member_id = $1 AND is_active`, [
    req.user.id,
  ]);
  if (!plan.rows[0]) return res.json({ calories: null, items_counted: 0, items_total: 0 });

  const completed = await pool.query(
    `SELECT mc.meal_slot_id
       FROM meal_completions mc
       JOIN meal_slots ms ON ms.id = mc.meal_slot_id
      WHERE mc.member_id = $1 AND mc.completed_at = CURRENT_DATE AND ms.nutrition_plan_id = $2`,
    [req.user.id, plan.rows[0].id]
  );
  if (completed.rows.length === 0) return res.json({ calories: 0, items_counted: 0, items_total: 0 });

  const slotIds = completed.rows.map((r) => r.meal_slot_id);
  const items = await pool.query(
    `SELECT moi.quantity, moi.kcal_100g
       FROM meal_option_items moi
       JOIN meal_options mo ON mo.id = moi.meal_option_id
      WHERE mo.meal_slot_id = ANY($1::int[])
        AND mo.order_index = (SELECT MIN(order_index) FROM meal_options WHERE meal_slot_id = mo.meal_slot_id)`,
    [slotIds]
  );

  let calories = 0;
  let counted = 0;
  for (const item of items.rows) {
    const grams = parseGrams(item.quantity);
    if (grams == null || item.kcal_100g == null) continue;
    calories += (Number(item.kcal_100g) * grams) / 100;
    counted++;
  }
  res.json({ calories: Math.round(calories), items_counted: counted, items_total: items.rows.length });
}

// Quem pode editar/eliminar um plano:
// - quem o criou (o nutricionista que o fez para o membro, ou o próprio membro
//   num plano pessoal);
// - outro nutricionista do mesmo ginásio, se o plano foi feito por um nutricionista
//   (colegas podem pegar no trabalho uns dos outros).
// O membro vê os planos do staff mas não os altera, e o staff não altera os
// planos pessoais do membro.
async function findPlanWithAccess(req, res) {
  const result = await pool.query(
    `SELECT np.id, np.member_id, np.created_by, cu.role AS creator_role, cu.gym_id AS creator_gym_id,
            m.gym_id AS member_gym_id
       FROM nutrition_plans np
       JOIN users m ON m.id = np.member_id
       LEFT JOIN users cu ON cu.id = np.created_by
      WHERE np.id = $1`,
    [req.params.id]
  );
  const plan = result.rows[0];
  if (!plan) {
    res.status(404).json({ message: "Plano não encontrado." });
    return null;
  }
  const isCreator = plan.created_by === req.user.id;
  // Colega da mesma especialidade: plano de outro nutricionista do ginásio, ou de
  // alguém que já saiu (created_by NULL).
  const madeBySameRole = plan.creator_role === "nutritionist" && plan.creator_gym_id === req.user.gymId;
  const madeByFormerStaff = plan.created_by === null && plan.member_gym_id === req.user.gymId;
  const isPeer = req.user.role === "nutritionist" && (madeBySameRole || madeByFormerStaff);
  if (!isCreator && !isPeer) {
    res.status(403).json({ message: "Só quem criou este plano o pode alterar ou eliminar." });
    return null;
  }
  return plan;
}

// GET /api/nutrition-plans — o próprio membro vê o(s) seu(s) plano(s)
async function listPlans(req, res) {
  res.json(await fetchPlansForMember(req.user.id, req.user));
}

// POST /api/nutrition-plans — o próprio membro cria um plano para si
async function createPlan(req, res) {
  if (!validateNutritionBody(req, res)) return;
  const planId = await insertPlan(req.user.id, req.user.id, req.body);
  res.status(201).json(await fetchPlanById(planId, req.user));
}

// GET /api/nutrition-plans/member/:id — staff vê os planos de um membro
// (inclui os que o próprio membro criou, não só os do staff)
async function listPlansForMember(req, res) {
  res.json(await fetchPlansForMember(req.params.id, req.user));
}

// POST /api/nutrition-plans/member/:id — staff (nutricionista/gym_owner/PT) cria
// um plano de nutrição para um membro
async function createPlanForMember(req, res) {
  if (!validateNutritionBody(req, res)) return;
  const planId = await insertPlan(req.params.id, req.user.id, req.body);
  res.status(201).json(await fetchPlanById(planId, req.user));
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

  res.json(await fetchPlanById(plan.id, req.user));
}

// PUT /api/nutrition-plans/:id/meals/:mealId — editar só uma refeição do
// plano (nome, opções e elementos), sem mexer nas outras. Mesmas permissões
// que editar o plano inteiro.
async function updateMeal(req, res) {
  const plan = await findPlanWithAccess(req, res);
  if (!plan) return;
  const message = mealError(req.body);
  if (message) return res.status(400).json({ message });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const slotResult = await client.query(
      `UPDATE meal_slots SET name = $1 WHERE id = $2 AND nutrition_plan_id = $3 RETURNING id`,
      [req.body.name, req.params.mealId, plan.id]
    );
    if (slotResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Refeição não encontrada neste plano." });
    }
    await client.query(`DELETE FROM meal_options WHERE meal_slot_id = $1`, [req.params.mealId]);
    await insertMealOptions(client, req.params.mealId, req.body.options);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  res.json(await fetchPlanById(plan.id, req.user));
}

// DELETE /api/nutrition-plans/:id — eliminar um plano (dono ou staff do
// mesmo ginásio)
async function deletePlan(req, res) {
  const plan = await findPlanWithAccess(req, res);
  if (!plan) return;

  await pool.query(`DELETE FROM nutrition_plans WHERE id = $1`, [plan.id]);
  res.status(204).send();
}

// Marcar refeições como concluídas é uma coisa pessoal (o registo de quem
// realmente comeu, não de quem fez o plano) — só o próprio dono do plano
// mexe nisto, mesmo que tenha sido um nutricionista a criá-lo.
async function findOwnPlan(req, res) {
  const result = await pool.query(`SELECT id, member_id FROM nutrition_plans WHERE id = $1`, [req.params.id]);
  const plan = result.rows[0];
  if (!plan) {
    res.status(404).json({ message: "Plano não encontrado." });
    return null;
  }
  if (plan.member_id !== req.user.id) {
    res.status(403).json({ message: "Só o dono do plano pode fazer isto." });
    return null;
  }
  return plan;
}

// PUT /api/nutrition-plans/:id/active — escolher qual plano está ativo
// (com mais do que um, só o ativo conta para a estatística de refeições
// cumpridas). Desativa qualquer outro do mesmo membro antes — o índice
// único parcial em nutrition_plans(member_id) WHERE is_active garante que
// nunca fica mais do que um ativo ao mesmo tempo.
async function setActivePlan(req, res) {
  const plan = await findOwnPlan(req, res);
  if (!plan) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE nutrition_plans SET is_active = false, active_since = NULL WHERE member_id = $1 AND id != $2`,
      [plan.member_id, plan.id]
    );
    await client.query(`UPDATE nutrition_plans SET is_active = true, active_since = now() WHERE id = $1`, [plan.id]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  res.json(await fetchPlanById(plan.id, req.user));
}

// PUT /api/nutrition-plans/reorder — body: { order: [planId, ...] }, a
// nova ordem completa dos planos do próprio (arrastar na lista — ver
// NutritionPage.jsx). Tem de incluir exatamente os planos que já tinha,
// nem mais nem menos — sem isto dava para "roubar" um plano de outra
// pessoa só por lhe saber o id.
async function reorderPlans(req, res) {
  const order = req.body.order;
  if (!Array.isArray(order) || order.some((id) => !Number.isInteger(id))) {
    return res.status(400).json({ message: "order tem de ser uma lista de ids." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Verificação de posse dentro da MESMA transação que a escrita — lida
    // com a mesma ligação, por isso não há janela entre ler "que planos
    // tenho" e gravar a ordem onde outro pedido concorrente (ex: criar/
    // eliminar um plano noutro separador) pudesse dessincronizar os dois.
    const ownResult = await client.query(`SELECT id FROM nutrition_plans WHERE member_id = $1`, [req.user.id]);
    const ownIds = new Set(ownResult.rows.map((r) => r.id));
    const orderIds = new Set(order);
    const sameSet =
      orderIds.size === order.length && orderIds.size === ownIds.size && order.every((id) => ownIds.has(id));
    if (!sameSet) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "A lista tem de incluir exatamente os teus planos atuais." });
    }

    for (let i = 0; i < order.length; i++) {
      await client.query(`UPDATE nutrition_plans SET order_index = $1 WHERE id = $2 AND member_id = $3`, [
        i,
        order[i],
        req.user.id,
      ]);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  res.json(await fetchPlansForMember(req.user.id, req.user));
}

function parseDateParam(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// GET /api/nutrition-plans/:id/completions?date=YYYY-MM-DD — refeições já
// marcadas nesse dia (por omissão hoje).
async function listCompletions(req, res) {
  const plan = await findOwnPlan(req, res);
  if (!plan) return;
  const date = parseDateParam(req.query.date) || today();

  const result = await pool.query(
    `SELECT mc.meal_slot_id
       FROM meal_completions mc
       JOIN meal_slots ms ON ms.id = mc.meal_slot_id
      WHERE ms.nutrition_plan_id = $1 AND mc.member_id = $2 AND mc.completed_at = $3`,
    [plan.id, req.user.id, date]
  );
  res.json({ date, completed_meal_slot_ids: result.rows.map((r) => r.meal_slot_id) });
}

// PUT /api/nutrition-plans/:id/meals/:mealId/completion — body: { date?, completed }
async function setCompletion(req, res) {
  const plan = await findOwnPlan(req, res);
  if (!plan) return;
  const date = parseDateParam(req.body.date) || today();

  const slotCheck = await pool.query(`SELECT id FROM meal_slots WHERE id = $1 AND nutrition_plan_id = $2`, [
    req.params.mealId,
    plan.id,
  ]);
  if (slotCheck.rows.length === 0) {
    return res.status(404).json({ message: "Refeição não encontrada neste plano." });
  }

  if (req.body.completed) {
    await pool.query(
      `INSERT INTO meal_completions (meal_slot_id, member_id, completed_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (meal_slot_id, member_id, completed_at) DO NOTHING`,
      [req.params.mealId, req.user.id, date]
    );
  } else {
    await pool.query(`DELETE FROM meal_completions WHERE meal_slot_id = $1 AND member_id = $2 AND completed_at = $3`, [
      req.params.mealId,
      req.user.id,
      date,
    ]);
  }
  res.json({ date, meal_slot_id: Number(req.params.mealId), completed: Boolean(req.body.completed) });
}

module.exports = {
  listPlans,
  createPlan,
  listPlansForMember,
  createPlanForMember,
  updatePlan,
  updateMeal,
  deletePlan,
  listCompletions,
  getCompletionSummary,
  getCaloriesConsumedToday,
  setCompletion,
  setActivePlan,
  reorderPlans,
};
