const pool = require("../db/pool");

const STAFF_ROLES = ["gym_owner", "personal_trainer", "nutritionist", "receptionist", "reception_station"];

const CONTACT_COLS = `u.id, u.name, u.email, u.role, u.avatar_url`;

function contactsQuery(baseWhere, params) {
  return pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.avatar_url,
            lm.body AS last_message,
            lm.created_at AS last_message_at,
            lm.sender_id AS last_message_sender_id,
            COALESCE(unread.count, 0) AS unread_count
       FROM (${baseWhere}) u
       LEFT JOIN LATERAL (
         SELECT body, created_at, sender_id
           FROM messages
          WHERE (sender_id = u.id AND recipient_id = $1)
             OR (sender_id = $1 AND recipient_id = u.id)
          ORDER BY created_at DESC
          LIMIT 1
       ) lm ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS count
           FROM messages
          WHERE sender_id = u.id AND recipient_id = $1 AND read_at IS NULL
       ) unread ON true
      ORDER BY lm.created_at DESC NULLS LAST, u.name`,
    params
  );
}

// Quem segue ou é seguido por `me` (ver friendships/friendController.js) —
// qualquer uma das direções chega para poder falar, não precisa de ser
// mútuo. Mesma forma das outras listas de contactos (last_message/
// unread_count), para dar para juntar tudo com mergeAndSort.
async function friendRows(me) {
  const result = await pool.query(
    `SELECT ${CONTACT_COLS},
            lm.body AS last_message, lm.created_at AS last_message_at,
            lm.sender_id AS last_message_sender_id,
            COALESCE(unread.count, 0) AS unread_count
       FROM (
         SELECT followee_id AS other_id FROM friendships WHERE follower_id = $1
         UNION
         SELECT follower_id AS other_id FROM friendships WHERE followee_id = $1
       ) f
       JOIN users u ON u.id = f.other_id
       LEFT JOIN LATERAL (
         SELECT body, created_at, sender_id FROM messages
          WHERE (sender_id = u.id AND recipient_id = $1)
             OR (sender_id = $1 AND recipient_id = u.id)
          ORDER BY created_at DESC LIMIT 1
       ) lm ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS count FROM messages
          WHERE sender_id = u.id AND recipient_id = $1 AND read_at IS NULL
       ) unread ON true`,
    [me]
  );
  return result.rows;
}

// Junta várias listas de contactos (ginásio, clientes externos, amigos),
// sem duplicar quem aparece em mais do que uma (ex: um amigo que também é
// do mesmo ginásio), e ordena por conversa mais recente primeiro.
function mergeAndSort(lists) {
  const seen = new Set();
  const merged = [];
  for (const rows of lists) {
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      merged.push(row);
    }
  }
  merged.sort((a, b) => {
    if (!a.last_message_at && !b.last_message_at) return a.name.localeCompare(b.name);
    if (!a.last_message_at) return 1;
    if (!b.last_message_at) return -1;
    return new Date(b.last_message_at) - new Date(a.last_message_at);
  });
  return merged;
}

// GET /api/messages/contacts — com quem é que este utilizador pode falar:
// - Membro de ginásio: staff do ginásio + quem segue/o segue (amigos)
// - Coach (PT/nutricionista): toda a gente do ginásio + clientes externos + amigos
// - Cliente externo (gym_id = NULL): os seus coaches + amigos
async function listContacts(req, res) {
  const isStaff = STAFF_ROLES.includes(req.user.role);
  const isCoach = req.user.role === "personal_trainer" || req.user.role === "nutritionist";
  const me = req.user.id;
  const friends = await friendRows(me);

  if (!req.user.gymId) {
    // Cliente externo: os seus coaches + amigos.
    const result = await pool.query(
      `SELECT ${CONTACT_COLS},
              lm.body AS last_message, lm.created_at AS last_message_at,
              lm.sender_id AS last_message_sender_id,
              COALESCE(unread.count, 0) AS unread_count
         FROM external_coach_clients ecc
         JOIN users u ON u.id = ecc.coach_id
         LEFT JOIN LATERAL (
           SELECT body, created_at, sender_id FROM messages
            WHERE (sender_id = u.id AND recipient_id = $1)
               OR (sender_id = $1 AND recipient_id = u.id)
            ORDER BY created_at DESC LIMIT 1
         ) lm ON true
         LEFT JOIN LATERAL (
           SELECT COUNT(*) AS count FROM messages
            WHERE sender_id = u.id AND recipient_id = $1 AND read_at IS NULL
         ) unread ON true
        WHERE ecc.client_id = $1`,
      [me]
    );
    return res.json(mergeAndSort([result.rows, friends]));
  }

  // Utilizador de ginásio: contactos do ginásio (filtrados por role se membro).
  const gymRows = await pool.query(
    `SELECT ${CONTACT_COLS},
            lm.body AS last_message, lm.created_at AS last_message_at,
            lm.sender_id AS last_message_sender_id,
            COALESCE(unread.count, 0) AS unread_count
       FROM users u
       LEFT JOIN LATERAL (
         SELECT body, created_at, sender_id FROM messages
          WHERE (sender_id = u.id AND recipient_id = $2)
             OR (sender_id = $2 AND recipient_id = u.id)
          ORDER BY created_at DESC LIMIT 1
       ) lm ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS count FROM messages
          WHERE sender_id = u.id AND recipient_id = $2 AND read_at IS NULL
       ) unread ON true
      WHERE u.gym_id = $1 AND u.id != $2
        AND ($3::boolean IS FALSE OR u.role != 'member')`,
    [req.user.gymId, me, !isStaff]
  );

  if (!isCoach) return res.json(mergeAndSort([gymRows.rows, friends]));

  // Coach: também inclui os clientes externos que não estão no ginásio.
  const extRows = await pool.query(
    `SELECT ${CONTACT_COLS},
            lm.body AS last_message, lm.created_at AS last_message_at,
            lm.sender_id AS last_message_sender_id,
            COALESCE(unread.count, 0) AS unread_count
       FROM external_coach_clients ecc
       JOIN users u ON u.id = ecc.client_id AND (u.gym_id IS NULL OR u.gym_id <> $1)
       LEFT JOIN LATERAL (
         SELECT body, created_at, sender_id FROM messages
          WHERE (sender_id = u.id AND recipient_id = $2)
             OR (sender_id = $2 AND recipient_id = u.id)
          ORDER BY created_at DESC LIMIT 1
       ) lm ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS count FROM messages
          WHERE sender_id = u.id AND recipient_id = $2 AND read_at IS NULL
       ) unread ON true
      WHERE ecc.coach_id = $2`,
    [req.user.gymId, me]
  );

  res.json(mergeAndSort([gymRows.rows, extRows.rows, friends]));
}

// GET /api/messages/:otherUserId — a conversa entre o utilizador autenticado
// e outro; marca como lidas as mensagens recebidas dessa pessoa.
async function getThread(req, res) {
  const otherId = req.params.otherUserId;

  await pool.query(
    `UPDATE messages SET read_at = now()
      WHERE sender_id = $1 AND recipient_id = $2 AND read_at IS NULL`,
    [otherId, req.user.id]
  );

  // plan_share_id ligado (ver planShareController.js/createShare): a
  // conversa mostra um cartão com aceitar/dispensar em vez de só o texto,
  // por isso vem já com o estado atual da partilha, não só o texto fixo que
  // ficou gravado em `body` no momento em que foi enviada.
  const result = await pool.query(
    `SELECT m.id, m.sender_id, m.recipient_id, m.body, m.read_at, m.created_at,
            m.plan_share_id, ps.plan_type AS plan_share_type, ps.plan_name AS plan_share_name,
            ps.status AS plan_share_status
       FROM messages m
       LEFT JOIN plan_shares ps ON ps.id = m.plan_share_id
      WHERE (m.sender_id = $1 AND m.recipient_id = $2)
         OR (m.sender_id = $2 AND m.recipient_id = $1)
      ORDER BY m.created_at ASC`,
    [req.user.id, otherId]
  );
  res.json(result.rows);
}

// POST /api/messages/:otherUserId — enviar uma mensagem; mesmo ginásio,
// ligação de coach↔cliente externo, OU amigos (quem segue/é seguido —
// qualquer direção). Sem nenhuma dessas, um membro só pode escrever a
// staff, nunca a outro membro.
async function sendMessage(req, res) {
  const otherId = req.params.otherUserId;
  const { body } = req.body;

  if (!body || !body.trim()) {
    return res.status(400).json({ message: "A mensagem não pode estar vazia." });
  }

  const recipientResult = await pool.query("SELECT gym_id, role FROM users WHERE id = $1", [otherId]);
  const recipient = recipientResult.rows[0];
  if (!recipient) return res.status(404).json({ message: "Destinatário não encontrado." });

  const isCoach = req.user.role === "personal_trainer" || req.user.role === "nutritionist";
  const isSenderStaff = STAFF_ROLES.includes(req.user.role);
  const sameGym = recipient.gym_id !== null && recipient.gym_id === req.user.gymId;
  const senderExternal = !req.user.gymId;

  // Verificar se existe uma ligação coach↔cliente externo em qualquer direção.
  const extLink = await pool.query(
    `SELECT 1 FROM external_coach_clients
      WHERE (coach_id = $1 AND client_id = $2) OR (coach_id = $2 AND client_id = $1)`,
    [req.user.id, otherId]
  );
  const hasExtLink = extLink.rows.length > 0;

  const friendLink = await pool.query(
    `SELECT 1 FROM friendships
      WHERE (follower_id = $1 AND followee_id = $2) OR (follower_id = $2 AND followee_id = $1)`,
    [req.user.id, otherId]
  );
  const isFriend = friendLink.rows.length > 0;

  if (!sameGym && !hasExtLink && !isFriend) {
    return res.status(404).json({ message: "Destinatário não encontrado." });
  }

  if (!isSenderStaff && !senderExternal && !hasExtLink && !isFriend && recipient.role === "member") {
    return res.status(403).json({ message: "Só podes enviar mensagens a staff do ginásio." });
  }

  const result = await pool.query(
    `INSERT INTO messages (sender_id, recipient_id, body)
     VALUES ($1, $2, $3)
     RETURNING id, sender_id, recipient_id, body, read_at, created_at`,
    [req.user.id, otherId, body.trim()]
  );
  res.status(201).json(result.rows[0]);
}

// Resolve um "público" nomeado para uma lista {id, name} de membros do
// ginásio — o nome vem junto para dar para personalizar cada mensagem
// (ver applyPlaceholders).
async function resolveAudience(gymId, staffId, audience) {
  let sql;
  let params;

  switch (audience) {
    case "nutrition":
      sql = `SELECT DISTINCT u.id, u.name
               FROM users u
               JOIN member_subscriptions ms ON ms.member_id = u.id
              WHERE u.gym_id = $1 AND u.role = 'member'
                AND ms.service_type = 'nutrition_plan' AND ms.is_active`;
      params = [gymId];
      break;
    case "personal_training":
      sql = `SELECT DISTINCT u.id, u.name
               FROM users u
               JOIN member_subscriptions ms ON ms.member_id = u.id
              WHERE u.gym_id = $1 AND u.role = 'member'
                AND ms.service_type = 'personal_training' AND ms.is_active`;
      params = [gymId];
      break;
    case "my_clients":
      sql = `SELECT DISTINCT u.id, u.name
               FROM users u
               JOIN member_subscriptions ms ON ms.member_id = u.id
              WHERE u.gym_id = $1 AND u.role = 'member'
                AND ms.assigned_staff_id = $2 AND ms.is_active`;
      params = [gymId, staffId];
      break;
    case "inactive":
      sql = `SELECT u.id, u.name
               FROM users u
              WHERE u.gym_id = $1 AND u.role = 'member'
                AND NOT EXISTS (
                  SELECT 1 FROM workout_sessions s
                   WHERE s.user_id = u.id AND s.performed_at >= CURRENT_DATE - INTERVAL '30 days'
                )`;
      params = [gymId];
      break;
    case "all":
    default:
      sql = `SELECT id, name FROM users WHERE gym_id = $1 AND role = 'member'`;
      params = [gymId];
  }

  const result = await pool.query(sql, params);
  return result.rows;
}

// Substitui {nome} pelo primeiro nome do destinatário (ex: "Olá {nome}!" →
// "Olá Ruben!"), para cada um receber a mensagem com o seu próprio nome em
// vez do texto literal "{nome}".
function applyPlaceholders(template, recipientName) {
  const firstName = recipientName.trim().split(/\s+/)[0];
  return template.replace(/\{nome\}/gi, firstName);
}

// POST /api/messages/broadcast — staff envia uma mensagem (com {nome} a ser
// substituído pelo primeiro nome de cada um) a vários membros de uma vez:
// ou por `member_ids` explícito (ex: os que ficaram visíveis depois de
// filtrar "inativos" em /members), ou por `audience` nomeado (ex:
// "nutrition", "personal_training", "my_clients", "inactive", "all"). Cada
// destinatário recebe a sua própria linha em `messages`.
async function broadcastMessage(req, res) {
  const { body, audience, member_ids } = req.body;

  if (!body || !body.trim()) {
    return res.status(400).json({ message: "A mensagem não pode estar vazia." });
  }

  let targets;
  if (Array.isArray(member_ids) && member_ids.length > 0) {
    const result = await pool.query(
      // Lista explícita (ex: o resultado filtrado de /members, que inclui
      // staff): qualquer pessoa do ginásio menos o próprio remetente.
      `SELECT id, name FROM users WHERE id = ANY($1::int[]) AND gym_id = $2 AND id <> $3 AND role <> 'admin'`,
      [member_ids, req.user.gymId, req.user.id]
    );
    targets = result.rows;
  } else {
    targets = await resolveAudience(req.user.gymId, req.user.id, audience);
  }

  if (targets.length === 0) {
    return res.status(400).json({ message: "Não há destinatários para este público." });
  }

  // Cada destinatário fica com um texto potencialmente diferente (por
  // causa do {nome}), por isso já não dá para um único INSERT ... SELECT
  // com o mesmo body para todos — insere-se uma linha de cada vez, dentro
  // de uma transação.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const target of targets) {
      await client.query(
        `INSERT INTO messages (sender_id, recipient_id, body) VALUES ($1, $2, $3)`,
        [req.user.id, target.id, applyPlaceholders(body.trim(), target.name)]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  res.status(201).json({ sent: targets.length });
}

module.exports = { listContacts, getThread, sendMessage, broadcastMessage };
