const pool = require("../db/pool");

// Mensagens automaticas sobre aulas de grupo para todos os PTs do ginasio:
// quando uma aula fica sem responsavel ou quando o responsavel pede troca.
// Saem em nome da gerencia (o gym_owner).

// Evitar enviar o mesmo aviso mais do que uma vez em 30 minutos.
const COOLDOWN_MS = 30 * 60 * 1000;
const sentAt = new Map();
function canSend(key) {
  const last = sentAt.get(key) || 0;
  if (Date.now() - last < COOLDOWN_MS) return false;
  sentAt.set(key, Date.now());
  return true;
}

const DAY_NAMES = ["", "segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];

const describe = (c) => c.title + " (" + DAY_NAMES[c.weekday] + ", " + c.start_time + "-" + c.end_time + ")";

async function ownerId(gymId) {
  const result = await pool.query(
    "SELECT id FROM users WHERE gym_id = $1 AND role = 'gym_owner' ORDER BY id LIMIT 1",
    [gymId]
  );
  return result.rows[0] ? result.rows[0].id : null;
}

// Envia `body` a todos os PTs do ginasio (exceto `excludeId`).
async function messageAllPTs(gymId, body, excludeId) {
  if (excludeId === undefined) excludeId = null;
  const senderId = await ownerId(gymId);
  if (!senderId) return 0;
  const result = await pool.query(
    "INSERT INTO messages (sender_id, recipient_id, body) " +
    "SELECT $1, id, $2 FROM users " +
    "WHERE gym_id = $3 AND role = 'personal_trainer' AND id <> $1 AND ($4::int IS NULL OR id <> $4) " +
    "RETURNING id",
    [senderId, body, gymId, excludeId]
  );
  return result.rowCount;
}

// Uma ou mais aulas ficaram sem PT.
async function notifyVacantClasses(gymId, classes) {
  if (!classes.length) return 0;
  const toNotify = classes.filter(function(c) { return canSend(gymId + ":vacant:" + c.id); });
  if (!toNotify.length) return 0;
  var body;
  if (toNotify.length === 1) {
    body = "A aula de " + describe(toNotify[0]) + " esta sem PT. Se a puderes dar, vai a Aulas de grupo e carrega em \"Ficar com esta aula\".";
  } else {
    var lista = toNotify.map(function(c) { return "- " + describe(c); }).join("\n");
    body = "Ha " + toNotify.length + " aulas sem PT:\n" + lista + "\nSe puderes dar alguma, vai a Aulas de grupo e carrega em \"Ficar com esta aula\".";
  }
  return messageAllPTs(gymId, body);
}

// O responsavel pediu troca.
async function notifySubstituteRequest(gymId, gymClass, requesterName, reason, requesterId) {
  if (!canSend(gymId + ":sub:" + gymClass.id)) return 0;
  var body = requesterName + " precisa de troca na aula de " + describe(gymClass);
  if (reason) body += " - motivo: \"" + reason + "\"";
  body += ". Se a puderes dar, vai a Aulas de grupo e carrega em \"Ficar com esta aula\".";
  return messageAllPTs(gymId, body, requesterId);
}

module.exports = { notifyVacantClasses, notifySubstituteRequest, messageAllPTs };
