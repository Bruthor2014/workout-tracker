const pool = require("../db/pool");

const SERVICE_TYPES = ["personal_training", "nutrition_plan", "gym_membership"];
// 'gym_membership' não tem entrada aqui de propósito — é só ativo/inativo,
// sem staff atribuído (não faz sentido "quem é o PT" de uma inscrição geral).
const STAFF_ROLE_FOR_SERVICE = {
  personal_training: "personal_trainer",
  nutrition_plan: "nutritionist",
};

async function findMember(memberId, gymId) {
  const result = await pool.query(`SELECT id FROM users WHERE id = $1 AND gym_id = $2 AND role = 'member'`, [
    memberId,
    gymId,
  ]);
  return result.rows[0];
}

// Estado mais recente de cada tipo de subscrição de um membro (PT /
// nutrição), mesmo quando nunca houve nenhuma — usado tanto pela vista de
// staff como pela auto-consulta do próprio membro.
async function fetchSubscriptionsForMember(memberId) {
  const result = await pool.query(
    `SELECT st.service_type,
            COALESCE(sub.is_active, false) AS is_active,
            sub.assigned_staff_id,
            staff.name AS assigned_staff_name,
            staff.role AS assigned_staff_role
       FROM (VALUES ('personal_training'), ('nutrition_plan'), ('gym_membership')) AS st(service_type)
       LEFT JOIN LATERAL (
         SELECT is_active, assigned_staff_id
           FROM member_subscriptions
          WHERE member_id = $1 AND service_type = st.service_type::service_type
          ORDER BY created_at DESC
          LIMIT 1
       ) sub ON true
       LEFT JOIN users staff ON staff.id = sub.assigned_staff_id`,
    [memberId]
  );

  const byService = {};
  for (const row of result.rows) {
    byService[row.service_type] = {
      is_active: row.is_active,
      assigned_staff_id: row.assigned_staff_id,
      assigned_staff_name: row.assigned_staff_name,
      assigned_staff_role: row.assigned_staff_role,
    };
  }
  return byService;
}

// GET /api/members/:id/subscriptions — vista de staff sobre um membro.
async function getMemberSubscriptions(req, res) {
  const member = await findMember(req.params.id, req.user.gymId);
  if (!member) {
    return res.status(404).json({ message: "Membro não encontrado." });
  }
  res.json(await fetchSubscriptionsForMember(req.params.id));
}

// GET /api/members/me/subscriptions — o próprio membro vê as suas
// subscrições e quem lhe está atribuído (só leitura, sem edição própria).
async function getMySubscriptions(req, res) {
  res.json(await fetchSubscriptionsForMember(req.user.id));
}

// PUT /api/members/:id/subscriptions/:serviceType — ativa/desativa uma
// subscrição e define o staff atribuído. A rota já restringe quem chega
// aqui (gym_owner/rececionista); a atribuição também é validada contra o role
// certo (PT para personal_training, nutricionista para nutrition_plan).
async function updateMemberSubscription(req, res) {
  const { serviceType } = req.params;
  const { is_active, assigned_staff_id } = req.body;

  if (!SERVICE_TYPES.includes(serviceType)) {
    return res.status(400).json({ message: "Tipo de subscrição inválido." });
  }

  const member = await findMember(req.params.id, req.user.gymId);
  if (!member) {
    return res.status(404).json({ message: "Membro não encontrado." });
  }

  // Tipos sem staff associado (ex: gym_membership) ignoram sempre
  // assigned_staff_id, mesmo que venha no pedido.
  const requiredStaffRole = STAFF_ROLE_FOR_SERVICE[serviceType];
  const staffId = requiredStaffRole ? assigned_staff_id || null : null;
  if (is_active && staffId) {
    const staffResult = await pool.query(`SELECT id FROM users WHERE id = $1 AND gym_id = $2 AND role = $3`, [
      staffId,
      req.user.gymId,
      requiredStaffRole,
    ]);
    if (staffResult.rows.length === 0) {
      return res.status(400).json({ message: "Staff atribuído inválido para este tipo de subscrição." });
    }
  }

  const activeResult = await pool.query(
    `SELECT id FROM member_subscriptions WHERE member_id = $1 AND service_type = $2 AND is_active`,
    [req.params.id, serviceType]
  );
  const activeRow = activeResult.rows[0];

  if (is_active) {
    if (activeRow) {
      await pool.query(`UPDATE member_subscriptions SET assigned_staff_id = $1 WHERE id = $2`, [
        staffId,
        activeRow.id,
      ]);
    } else {
      await pool.query(
        `INSERT INTO member_subscriptions (member_id, service_type, assigned_staff_id) VALUES ($1, $2, $3)`,
        [req.params.id, serviceType, staffId]
      );
    }
  } else if (activeRow) {
    await pool.query(`UPDATE member_subscriptions SET is_active = false, ended_at = CURRENT_DATE WHERE id = $1`, [
      activeRow.id,
    ]);
  }

  let assignedStaffName = null;
  if (is_active && staffId) {
    const nameResult = await pool.query(`SELECT name FROM users WHERE id = $1`, [staffId]);
    assignedStaffName = nameResult.rows[0]?.name || null;
  }

  res.json({
    service_type: serviceType,
    is_active: Boolean(is_active),
    assigned_staff_id: is_active ? staffId : null,
    assigned_staff_name: is_active ? assignedStaffName : null,
  });
}

module.exports = { getMemberSubscriptions, getMySubscriptions, updateMemberSubscription };
