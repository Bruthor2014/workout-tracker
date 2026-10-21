const pool = require("../db/pool");

// Gerador automático do horário semanal da equipa (POST /api/shifts/generate).
// Só gera turnos (sala/receção) — as aulas de grupo são sempre criadas e
// geridas à mão pelo CEO, nunca por este gerador.
//
// Regras:
// - O ginásio está aberto das 06:00 às 23:00, em três turnos por dia:
//   manhã (06:00–11:00), tarde (11:00–início da hora de ponta) e ponta
//   (por omissão 17:00–23:00).
// - Sala de musculação: na hora de ponta `peak_floor` PTs (2 por omissão),
//   no resto `base_floor` (1 por omissão) — nunca mais de 2. Se sobrarem
//   horas, entra um 2.º PT fora da ponta.
// - Receção: sempre 1 pessoa em cada turno (preferência: rececionista,
//   estagiário, nutricionista e, só se faltar gente, um PT).
// - As sessões dos PTs/nutricionistas com clientes ficam como estão: nenhum
//   turno lhes toca, e contam para as horas da semana.
// - Cada pessoa: no máximo 1 turno por dia, `max_days` dias por semana e
//   `max_hours` horas por semana. Só faz as funções que o CEO lhe deu
//   (Sala, Receção).
//
// Substitui todos os turnos da equipa; aulas de grupo, palestras e eventos
// ficam todos como estão.

const OPEN = "06:00";
const MORNING_END = "11:00";
const CLOSE = "23:00";
const RECEPTION_TIERS = ["receptionist", "intern", "nutritionist", "personal_trainer"];
const FUNCTIONS = ["floor", "reception"];
const TIME_RE = /^([01]\d|2[0-3]):(00|30)$/;

// Funções por omissão de cada cargo.
const DEFAULT_FUNCTIONS = {
  personal_trainer: ["floor", "reception"],
  nutritionist: ["reception"],
  receptionist: ["reception"],
  intern: ["reception"],
};

const toMinutes = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const fromMinutes = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const overlaps = (a, b) => toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);
const clampInt = (v, min, max, fallback) => {
  const n = Number(v);
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

// Normaliza as opções do pedido (tudo opcional, com valores por omissão).
function normalizeOptions(body = {}, staff) {
  const peakStart = TIME_RE.test(body.peak_start || "") ? body.peak_start : "17:00";
  const peakMinutes = Math.min(Math.max(toMinutes(peakStart), toMinutes("13:00")), toMinutes("20:00"));
  const people = new Map((Array.isArray(body.people) ? body.people : []).map((p) => [Number(p.id), p]));
  return {
    peakStart: fromMinutes(peakMinutes),
    peakFloor: clampInt(body.peak_floor, 1, 2, 2),
    baseFloor: clampInt(body.base_floor, 1, 2, 1),
    staff: staff
      .map((s) => {
        const o = people.get(s.id) || {};
        const functions = Array.isArray(o.functions)
          ? o.functions.filter((f) => FUNCTIONS.includes(f))
          : DEFAULT_FUNCTIONS[s.role] || [];
        return {
          ...s,
          include: o.include !== false,
          maxHours: clampInt(o.max_hours, 0, 60, 40),
          maxDays: clampInt(o.max_days, 1, 7, 6),
          functions,
        };
      })
      .filter((s) => s.include && s.functions.length > 0 && s.maxHours > 0),
  };
}

function buildSchedule(staff, options) {
  const opts = options || normalizeOptions({}, staff);
  const blocks = [
    { start: OPEN, end: MORNING_END },
    { start: MORNING_END, end: opts.peakStart },
    { start: opts.peakStart, end: CLOSE, peak: true },
  ].map((b) => ({ ...b, hours: (toMinutes(b.end) - toMinutes(b.start)) / 60 }));

  const people = opts.staff.map((p) => ({ ...p, hours: 0, days: new Set(), busy: [] }));
  const shifts = [];
  const can = (p, fn) => p.functions.includes(fn);

  // Sessões com clientes (fixas): contam para as horas e ocupam a pessoa.
  for (const s of opts.sessions || []) {
    const p = people.find((x) => x.id === s.staff_id);
    if (!p) continue;
    p.busy.push({ day: s.weekday, start: s.start_time, end: s.end_time });
    p.hours += (toMinutes(s.end_time) - toMinutes(s.start_time)) / 60;
  }

  const canWorkShift = (p, day, block) =>
    !p.days.has(day) &&
    p.days.size < p.maxDays &&
    p.hours + block.hours <= p.maxHours &&
    !p.busy.some((y) => y.day === day && overlaps(y, block));

  // Escolhe quem tem menos horas em proporção ao seu máximo (desempate:
  // menos dias, depois nome).
  const pick = (candidates) =>
    candidates.sort(
      (a, b) => a.hours / a.maxHours - b.hours / b.maxHours || a.days.size - b.days.size || a.name.localeCompare(b.name)
    )[0];

  function assignShift(p, day, block, activity, location) {
    p.hours += block.hours;
    p.days.add(day);
    p.busy.push({ day, start: block.start, end: block.end });
    shifts.push({ staff_id: p.id, weekday: day, start_time: block.start, end_time: block.end, activity, location });
  }

  // Folgas planeadas antes de tudo, espalhadas pela semana, alternando quem
  // faz sala e os restantes — assim nenhum dia fica sem gente.
  const floorPeople = people.filter((p) => can(p, "floor"));
  const others = people.filter((p) => !can(p, "floor"));
  const restOrder = [];
  for (let i = 0; i < Math.max(floorPeople.length, others.length); i++) {
    if (floorPeople[i]) restOrder.push(floorPeople[i]);
    if (others[i]) restOrder.push(others[i]);
  }
  let restIndex = 0;
  for (const p of restOrder) {
    p.restDays = new Set();
    for (let k = 0; k < 7 - p.maxDays; k++) p.restDays.add((restIndex++ % 7) + 1);
  }
  const resting = (p, day) => p.restDays.has(day);

  // Quem faz sala: PTs primeiro, depois quem mais tiver essa função.
  function pickFloor(day, block) {
    const free = floorPeople.filter(
      (x) => canWorkShift(x, day, block) && !x.busy.some((y) => y.day === day && overlaps(y, block))
    );
    for (const restingToo of [false, true]) {
      for (const pts of [true, false]) {
        const p = pick(
          free.filter((x) => (x.role === "personal_trainer") === pts && (restingToo || !resting(x, day)))
        );
        if (p) return p;
      }
    }
    return null;
  }

  // Cada fase percorre a semana toda antes da seguinte, para as horas
  // chegarem a todos os dias (e não acabarem antes de domingo).
  const floorCount = (day, block) =>
    shifts.filter((s) => s.weekday === day && s.activity === "floor" && s.start_time === block.start).length;
  // 1. Sala: 1 pessoa em cada turno; 2. ponta: até `peakFloor`; fora da
  // ponta até `baseFloor`.
  for (const phase of ["min", "peak", "base"]) {
    for (let day = 1; day <= 7; day++) {
      for (const block of [...blocks].reverse()) {
        const wanted = phase === "min" ? 1 : phase === "peak" ? (block.peak ? opts.peakFloor : 0) : block.peak ? 0 : opts.baseFloor;
        while (floorCount(day, block) < wanted) {
          const p = pickFloor(day, block);
          if (!p) break;
          assignShift(p, day, block, "floor", "Sala");
        }
      }
    }
  }

  for (let day = 1; day <= 7; day++) {
    // 2. Receção: 1 pessoa por turno, pela ordem de preferência dos cargos.
    blocks.forEach((block) => {
      let p = null;
      for (const restingToo of [false, true]) {
        for (const role of RECEPTION_TIERS) {
          p = pick(
            people.filter(
              (x) =>
                x.role === role && can(x, "reception") && (restingToo || !resting(x, day)) && canWorkShift(x, day, block)
            )
          );
          if (p) break;
        }
        if (p) break;
      }
      if (p) assignShift(p, day, block, "reception", "Receção");
    });
  }

  // 3. Fora da ponta, um 2.º na sala onde sobrarem horas (tarde, depois manhã).
  if (opts.baseFloor < 2) {
    for (const block of blocks.filter((b) => !b.peak).reverse()) {
      for (let day = 1; day <= 7; day++) {
        const p = pick(
          floorPeople.filter(
            (x) =>
              x.role === "personal_trainer" &&
              !resting(x, day) &&
              canWorkShift(x, day, block) &&
              !x.busy.some((y) => y.day === day && overlaps(y, block))
          )
        );
        if (p) assignShift(p, day, block, "floor", "Sala");
      }
    }
  }

  return { shifts, people, blocks };
}

const DAY_NAMES = ["", "segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];

// Cobertura de meia em meia hora, agrupada em intervalos legíveis
// ("segunda 17:00–23:00: só 1 PT na sala (pedido: 2)").
function coverageReport(shifts, opts = { peakStart: "17:00", peakFloor: 2, baseFloor: 1 }) {
  const problems = [];
  let maxFloor = 0;
  for (let day = 1; day <= 7; day++) {
    const issues = [];
    for (let m = toMinutes(OPEN); m < toMinutes(CLOSE); m += 30) {
      const slot = { start: fromMinutes(m), end: fromMinutes(m + 30) };
      const at = (activity) =>
        shifts.filter((s) => s.weekday === day && s.activity === activity && overlaps({ start: s.start_time, end: s.end_time }, slot))
          .length;
      const floor = at("floor");
      maxFloor = Math.max(maxFloor, floor);
      const wanted = m >= toMinutes(opts.peakStart) ? opts.peakFloor : opts.baseFloor;
      const list = [];
      if (floor === 0) list.push("sem ninguém na sala");
      else if (floor < wanted) list.push(`só ${floor} na sala (pedido: ${wanted})`);
      if (at("reception") === 0) list.push("receção vazia");
      issues.push({ m, text: list.join(" · ") });
    }
    // Junta meias-horas seguidas com o mesmo problema.
    let run = null;
    for (const it of [...issues, { m: toMinutes(CLOSE), text: "" }]) {
      if (run && run.text !== it.text) {
        problems.push(`${DAY_NAMES[day]} ${fromMinutes(run.m)}–${fromMinutes(it.m)}: ${run.text}`);
        run = null;
      }
      if (!run && it.text) run = it;
    }
  }
  return { gaps: problems, maxFloor };
}

// POST /api/shifts/generate — CEO. Body (tudo opcional):
// { peak_start: "17:00", peak_floor: 2, base_floor: 1,
//   people: [{ id, include, max_hours, max_days, functions: ["floor", "reception"] }] }
async function generateSchedule(req, res) {
  const staffResult = await pool.query(
    `SELECT id, name, role FROM users
      WHERE gym_id = $1 AND role IN ('personal_trainer', 'nutritionist', 'receptionist', 'intern')
      ORDER BY name`,
    [req.user.gymId]
  );
  const opts = normalizeOptions(req.body, staffResult.rows);
  opts.sessions = (
    await pool.query(
      `SELECT staff_id, weekday, to_char(start_time, 'HH24:MI') AS start_time, to_char(end_time, 'HH24:MI') AS end_time
         FROM client_sessions WHERE gym_id = $1`,
      [req.user.gymId]
    )
  ).rows;
  if (!opts.staff.some((p) => p.functions.includes("floor"))) {
    return res.status(400).json({ message: "É preciso pelo menos uma pessoa com a função Sala para gerar o horário." });
  }

  const { shifts, people } = buildSchedule(staffResult.rows, opts);
  const coverage = coverageReport(shifts, opts);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM staff_shifts WHERE gym_id = $1`, [req.user.gymId]);
    for (const s of shifts) {
      await client.query(
        `INSERT INTO staff_shifts (gym_id, staff_id, weekday, start_time, end_time, activity, location)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [req.user.gymId, s.staff_id, s.weekday, s.start_time, s.end_time, s.activity, s.location]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // Verificar se algum turno gerado solapa uma sessão com cliente (não devia acontecer
  // mas serve de aviso se o estado da BD estava inconsistente antes de gerar).
  const conflicts = [];
  for (const shift of shifts) {
    const conflicting = opts.sessions.filter(
      (s) =>
        s.staff_id === shift.staff_id &&
        Number(s.weekday) === Number(shift.weekday) &&
        overlaps({ start: s.start_time, end: s.end_time }, { start: shift.start_time, end: shift.end_time })
    );
    if (conflicting.length > 0) {
      const person = people.find((p) => p.id === shift.staff_id);
      conflicts.push({
        staff: person?.name || shift.staff_id,
        weekday: shift.weekday,
        shift: `${shift.start_time}–${shift.end_time}`,
        sessions: conflicting.length,
      });
    }
  }

  res.json({
    shifts: shifts.length,
    gaps: coverage.gaps,
    max_pts_on_floor: coverage.maxFloor,
    conflicts: conflicts.length > 0 ? conflicts : undefined,
    hours: people
      .map((p) => ({ id: p.id, name: p.name, role: p.role, hours: p.hours, max_hours: p.maxHours, days: p.days.size }))
      .sort((a, b) => b.hours - a.hours),
  });
}

module.exports = { generateSchedule, buildSchedule, coverageReport, normalizeOptions, DEFAULT_FUNCTIONS };
