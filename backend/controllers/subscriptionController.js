const pool = require("../db/pool");

const SERVICE_TYPES = ["personal_training", "nutrition_plan", "gym_membership"];
// 'gym_membership' não tem entrada aqui de propósito — é só ativo/inativo,
// sem staff atribuído (não faz sentido "quem é o PT" de uma inscrição geral).
const STAFF_ROLE_FOR_SERVICE = {
  personal_training: "personal_trainer",
  nutrition_plan: "nutritionist",
};

async function findMember(memberId, gymId) {
  const result = await pool.query(`SELECT id FROM users WHERE id = $1 AND gym_id = $2 AND role <> 'admin'`, [
    memberId,
    gymId,
  ]);
  return result.rows[0];
}

// "Em dia" (paid_until >= hoje) vs "em atraso" (paid_until < hoje) — só um
// aviso visual no perfil, não mexe em contagens/estatísticas nem em
// acessos (ver PROGRESS.txt). null quando não há pagamento formal a
// acompanhar (ex: ligação a coach externo, sem preço configurado).
function paymentStatus(paidUntil) {
  if (!paidUntil) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(paidUntil) >= today ? "paid" : "late";
}

// `pg` devolve colunas DATE como Date (meia-noite UTC) — sem isto,
// res.json() serializava com hora e "Z", partindo o parsing no frontend
// (new Date(`${dateKey}T00:00:00`)).
function toDateStr(d) {
  return d ? new Date(d).toISOString().slice(0, 10) : null;
}

// Estado mais recente de cada tipo de subscrição de um membro (PT /
// nutrição), mesmo quando nunca houve nenhuma — usado tanto pela vista de
// staff como pela auto-consulta do próprio membro. `gymId` só serve para ir
// buscar o preço do serviço nesse ginásio (sem ginásio, fica sem preço).
async function fetchSubscriptionsForMember(memberId, gymId) {
  const result = await pool.query(
    `SELECT st.service_type,
            COALESCE(sub.is_active, false) AS is_active,
            sub.assigned_staff_id,
            staff.name AS assigned_staff_name,
            staff.role AS assigned_staff_role,
            sub.paid_until,
            price.price_cents,
            price.billing_period
       FROM (VALUES ('personal_training'), ('nutrition_plan'), ('gym_membership')) AS st(service_type)
       LEFT JOIN LATERAL (
         SELECT is_active, assigned_staff_id, paid_until
           FROM member_subscriptions
          WHERE member_id = $1 AND service_type = st.service_type::service_type
          ORDER BY created_at DESC
          LIMIT 1
       ) sub ON true
       LEFT JOIN users staff ON staff.id = sub.assigned_staff_id
       LEFT JOIN gym_service_prices price
         ON price.gym_id = $2 AND price.service_type = st.service_type::service_type`,
    [memberId, gymId]
  );

  const byService = {};
  for (const row of result.rows) {
    byService[row.service_type] = {
      is_active: row.is_active,
      assigned_staff_id: row.assigned_staff_id,
      assigned_staff_name: row.assigned_staff_name,
      assigned_staff_role: row.assigned_staff_role,
      price_cents: row.price_cents,
      billing_period: row.billing_period,
      next_renewal_date: row.is_active && row.price_cents != null ? toDateStr(row.paid_until) : null,
      payment_status: row.is_active && row.price_cents != null ? paymentStatus(row.paid_until) : null,
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
  res.json(await fetchSubscriptionsForMember(req.params.id, req.user.gymId));
}

// GET /api/members/me/subscriptions — o próprio membro vê as suas
// subscrições e quem lhe está atribuído. Se não houver subscrição formal
// mas existir uma ligação de cliente externo, usa-a para preencher o campo.
async function getMySubscriptions(req, res) {
  const subs = await fetchSubscriptionsForMember(req.user.id, req.user.gymId);

  // Enriquecer com coaches externos quando não há subscrição formal.
  if (!subs.personal_training.is_active || !subs.nutrition_plan.is_active) {
    const ext = await pool.query(
      `SELECT ecc.coach_id, u.name AS coach_name, u.role AS coach_role
         FROM external_coach_clients ecc
         JOIN users u ON u.id = ecc.coach_id
        WHERE ecc.client_id = $1`,
      [req.user.id]
    );
    for (const row of ext.rows) {
      const serviceType =
        row.coach_role === "personal_trainer" ? "personal_training"
        : row.coach_role === "nutritionist" ? "nutrition_plan"
        : null;
      if (serviceType && !subs[serviceType].is_active) {
        subs[serviceType] = {
          is_active: true,
          assigned_staff_id: row.coach_id,
          assigned_staff_name: row.coach_name,
          assigned_staff_role: row.coach_role,
          is_external: true,
          // Cliente externo: sem subscrição/preço formal no ginásio.
          price_cents: null,
          billing_period: null,
          next_renewal_date: null,
          payment_status: null,
        };
      }
    }
  }

  res.json(subs);
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
    // Desativar a inscrição no ginásio (ao contrário de PT/nutrição, que só
    // tiram o staff atribuído) tira mesmo a pessoa do ginásio — pedido
    // explícito do utilizador. Para voltar a entrar, usa-se o fluxo de
    // "Novo sócio" (createPerson), que volta a ligar a conta e a ativar a
    // inscrição.
    if (serviceType === "gym_membership") {
      await pool.query(`UPDATE users SET gym_id = NULL WHERE id = $1`, [req.params.id]);
    }
  }

  // As sessões semanais com um PT/nutricionista que deixou de estar
  // atribuído a este membro deixam de existir.
  if (requiredStaffRole) {
    await pool.query(
      `DELETE FROM client_sessions cs USING users s
        WHERE s.id = cs.staff_id AND cs.member_id = $1 AND s.role = $2
          AND ($3::int IS NULL OR cs.staff_id <> $3)`,
      [req.params.id, requiredStaffRole, is_active ? staffId : null]
    );
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
