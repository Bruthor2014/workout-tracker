// Teste do cancelamento automático das aulas de grupo (services/classChecker.js).
// Cria duas aulas de teste para daqui a 10 minutos (dentro do prazo de 30):
//   A) com PT mas só 1 inscrito (mínimo 3)  -> cancelada por falta de alunos
//   B) sem PT, com 2 inscritos (mínimo 1)   -> cancelada por falta de PT
// e uma de controlo:
//   C) com PT e 3 inscritos (mínimo 3)      -> não é cancelada
// Verifica os cancelamentos e as mensagens aos inscritos, e apaga tudo no fim.
// Uso: node scripts/testClassChecker.js
require("dotenv").config();
const pool = require("../db/pool");
const { checkClasses } = require("../services/classChecker");
const { toDateKey, weekdayOf, minutesOf } = require("../utils/classDates");

const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
let failures = 0;
function check(label, ok, detail = "") {
  console.log(`${ok ? "✔" : "✘"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  const now = new Date();
  const startMin = minutesOf(now) + 10;
  if (startMin + 60 >= 24 * 60) {
    console.log("Corre o teste antes das 22:50 (as aulas de teste têm de caber no dia de hoje).");
    return;
  }
  const owner = (await pool.query(`SELECT id, gym_id FROM users WHERE role = 'gym_owner' ORDER BY id LIMIT 1`)).rows[0];
  const pt = (await pool.query(`SELECT id FROM users WHERE gym_id = $1 AND role = 'personal_trainer' ORDER BY id LIMIT 1`, [owner.gym_id])).rows[0];
  const members = (await pool.query(`SELECT id FROM users WHERE gym_id = $1 AND role = 'member' ORDER BY id LIMIT 3`, [owner.gym_id])).rows.map((r) => r.id);
  const today = toDateKey(now);
  const created = [];
  const since = new Date(Date.now() - 1000);

  async function makeClass(title, instructorId, min, enrolled) {
    const r = await pool.query(
      `INSERT INTO group_classes (gym_id, title, kind, weekday, start_time, end_time, instructor_id, min_participants, cancel_notice_minutes, capacity)
       VALUES ($1, $2, 'class', $3, $4, $5, $6, $7, 30, 20) RETURNING id`,
      [owner.gym_id, title, weekdayOf(now), hhmm(startMin), hhmm(startMin + 60), instructorId, min]
    );
    const id = r.rows[0].id;
    created.push(id);
    for (const m of enrolled) {
      await pool.query(`INSERT INTO class_enrollments (class_id, member_id, class_date) VALUES ($1, $2, $3)`, [id, m, today]);
    }
    return id;
  }

  try {
    const a = await makeClass("TESTE falta de alunos", pt.id, 3, members.slice(0, 1));
    const b = await makeClass("TESTE sem PT", null, 1, members.slice(0, 2));
    const c = await makeClass("TESTE controlo", pt.id, 3, members.slice(0, 3));

    await checkClasses(now);

    const reasons = Object.fromEntries(
      (await pool.query(`SELECT class_id, reason FROM class_cancellations WHERE class_id = ANY($1) AND class_date = $2`, [created, today])).rows.map(
        (r) => [r.class_id, r.reason]
      )
    );
    const msgs = async (title) =>
      (await pool.query(`SELECT recipient_id, body FROM messages WHERE created_at >= $1 AND body LIKE $2`, [since, `%${title}%`])).rows;

    check("A) poucos inscritos → cancelada por falta de alunos", reasons[a] === "not_enough", `motivo: ${reasons[a] || "nenhum"}`);
    const msgA = await msgs("TESTE falta de alunos");
    check("A) o inscrito e o PT recebem mensagem", msgA.some((m) => m.recipient_id === members[0]) && msgA.some((m) => m.recipient_id === pt.id), `${msgA.length} mensagens`);
    if (msgA[0]) console.log(`   “${msgA[0].body}”`);

    check("B) sem PT → cancelada por falta de PT", reasons[b] === "no_instructor", `motivo: ${reasons[b] || "nenhum"}`);
    const msgB = await msgs("TESTE sem PT");
    check("B) os 2 inscritos recebem mensagem", members.slice(0, 2).every((id) => msgB.some((m) => m.recipient_id === id)), `${msgB.length} mensagens`);
    if (msgB[0]) console.log(`   “${msgB[0].body}”`);

    check("C) com PT e inscritos suficientes → não é cancelada", !reasons[c]);

    await checkClasses(now);
    const again = await msgs("TESTE");
    check("Correr outra vez não repete as mensagens", again.length === msgA.length + msgB.length);
  } finally {
    await pool.query(`DELETE FROM messages WHERE created_at >= $1 AND body LIKE '%TESTE%'`, [since]);
    await pool.query(`DELETE FROM group_classes WHERE id = ANY($1)`, [created]);
    await pool.end();
  }
  console.log(failures ? `\n${failures} verificação(ões) falharam.` : "\nTudo certo.");
  process.exitCode = failures ? 1 : 0;
}

main();
