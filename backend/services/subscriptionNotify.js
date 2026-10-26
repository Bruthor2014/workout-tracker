const pool = require("../db/pool");

// Lembrete automático de renovação, a partir de paid_until em
// member_subscriptions — mesmo padrão de services/classChecker.js
// (verificação periódica + mensagem automática em nome da gerência), mas
// aqui corre a cada poucas horas em vez de a cada minuto: paid_until é uma
// data, não um horário preciso. Nada disto mexe em acessos/contagens, só
// avisa (ver payment_status em subscriptionController.js para o resto do
// comportamento de "em atraso").

const REMINDER_WINDOW_DAYS = 3;
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

const SERVICE_LABELS = {
  personal_training: "Personal Training",
  nutrition_plan: "plano de nutrição",
  gym_membership: "inscrição no ginásio",
};

// `paid_until` é DATE — o `pg` devolve-a como meia-noite UTC. Formatar com
// toLocaleDateString() usaria o fuso LOCAL do processo Node e podia mostrar
// o dia errado num servidor a oeste de UTC (mesma classe de bug que já
// motivou toDateStr() em subscriptionController.js) — lê-se sempre os
// componentes UTC diretamente, nunca se deixa o fuso local interferir.
function formatDateUTC(date) {
  const d = new Date(date);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

async function ownerId(gymId) {
  const result = await pool.query(
    `SELECT id FROM users WHERE gym_id = $1 AND role = 'gym_owner' ORDER BY id LIMIT 1`,
    [gymId]
  );
  return result.rows[0] ? result.rows[0].id : null;
}

// Subscrições ativas, com preço configurado (ginásio ou preço próprio do
// membro — migration 033), a expirar dentro da janela, para quem ainda não
// foi avisado PARA ESTE paid_until (reminder_sent_for é o valor de
// paid_until da última vez que se avisou — se paid_until mudar numa
// renovação futura, o lembrete volta a poder disparar sozinho).
async function dueReminders() {
  const result = await pool.query(
    `SELECT ms.id, ms.member_id, ms.service_type, ms.paid_until, u.gym_id
       FROM member_subscriptions ms
       JOIN users u ON u.id = ms.member_id
       LEFT JOIN gym_service_prices gp ON gp.gym_id = u.gym_id AND gp.service_type = ms.service_type
       LEFT JOIN subscription_price_overrides ovr ON ovr.member_id = ms.member_id AND ovr.service_type = ms.service_type
      WHERE ms.is_active
        AND ms.paid_until IS NOT NULL
        AND COALESCE(ovr.price_cents, gp.price_cents) IS NOT NULL
        AND ms.paid_until BETWEEN CURRENT_DATE AND CURRENT_DATE + $1::int
        AND (ms.reminder_sent_for IS NULL OR ms.reminder_sent_for <> ms.paid_until)`,
    [REMINDER_WINDOW_DAYS]
  );
  return result.rows;
}

async function checkSubscriptionReminders() {
  const due = await dueReminders();
  let sent = 0;
  for (const row of due) {
    const senderId = await ownerId(row.gym_id);
    if (!senderId) continue;

    const label = SERVICE_LABELS[row.service_type] || row.service_type;
    const dateStr = formatDateUTC(row.paid_until);
    const body = `A tua subscrição de ${label} expira a ${dateStr}. Fala com o balcão para renovar.`;

    // Mesma linha das outras escritas multi-passo do projeto (ver
    // nutritionController.js): a mensagem e o "já avisei para esta data"
    // têm de gravar juntas — sem transação, um crash entre as duas podia
    // mandar o mesmo lembrete outra vez na próxima verificação.
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`INSERT INTO messages (sender_id, recipient_id, body) VALUES ($1, $2, $3)`, [
        senderId,
        row.member_id,
        body,
      ]);
      await client.query(`UPDATE member_subscriptions SET reminder_sent_for = $1 WHERE id = $2`, [
        row.paid_until,
        row.id,
      ]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    sent++;
  }
  return sent;
}

function startSubscriptionReminders() {
  const run = () =>
    checkSubscriptionReminders().catch((err) =>
      console.error("Verificação de lembretes de subscrição falhou:", err)
    );
  run();
  return setInterval(run, CHECK_EVERY_MS);
}

module.exports = { startSubscriptionReminders, checkSubscriptionReminders };
