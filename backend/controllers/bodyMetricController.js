const pool = require("../db/pool");

const METRIC_COLUMNS = "id, recorded_at, weight_kg, body_fat_pct, lean_mass_kg, muscle_mass_kg, bone_mass_kg, body_water_pct";
const STAFF_ROLES = ["gym_owner", "personal_trainer", "nutritionist"];

async function fetchMetricsForMember(memberId) {
  const result = await pool.query(
    `SELECT ${METRIC_COLUMNS} FROM body_metrics WHERE member_id = $1 ORDER BY recorded_at ASC`,
    [memberId]
  );
  return result.rows;
}

async function insertMetric(memberId, recordedBy, body) {
  const { recorded_at, weight_kg, body_fat_pct, lean_mass_kg, muscle_mass_kg, bone_mass_kg, body_water_pct } = body;

  const result = await pool.query(
    `INSERT INTO body_metrics
       (member_id, recorded_by, recorded_at, weight_kg, body_fat_pct, lean_mass_kg, muscle_mass_kg, bone_mass_kg, body_water_pct)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${METRIC_COLUMNS}`,
    [
      memberId,
      recordedBy,
      recorded_at,
      weight_kg,
      body_fat_pct || null,
      lean_mass_kg || null,
      muscle_mass_kg || null,
      bone_mass_kg || null,
      body_water_pct || null,
    ]
  );
  return result.rows[0];
}

function validateMetricBody(req, res) {
  const { recorded_at, weight_kg } = req.body;
  if (!recorded_at || !weight_kg) {
    res.status(400).json({ message: "recorded_at e weight_kg são obrigatórios." });
    return false;
  }
  return true;
}

// Um registo só pode ser editado/eliminado pelo próprio membro a quem
// pertence, ou por staff (gym_owner/PT/nutricionista) — não por outro membro.
async function findMetricWithAccess(req, res) {
  const result = await pool.query("SELECT member_id FROM body_metrics WHERE id = $1", [req.params.id]);
  const metric = result.rows[0];
  if (!metric) {
    res.status(404).json({ message: "Registo não encontrado." });
    return null;
  }
  const isOwner = metric.member_id === req.user.id;
  const isStaff = STAFF_ROLES.includes(req.user.role);
  if (!isOwner && !isStaff) {
    res.status(403).json({ message: "Sem permissão para este registo." });
    return null;
  }
  return metric;
}

// GET /api/body-metrics — o próprio membro vê os seus registos
async function listMetrics(req, res) {
  res.json(await fetchMetricsForMember(req.user.id));
}

// POST /api/body-metrics — o próprio membro regista os seus dados
async function createMetrics(req, res) {
  if (!validateMetricBody(req, res)) return;
  const metric = await insertMetric(req.user.id, req.user.id, req.body);
  res.status(201).json(metric);
}

// GET /api/body-metrics/member/:id — staff vê os registos de um membro
async function listMetricsForMember(req, res) {
  res.json(await fetchMetricsForMember(req.params.id));
}

// POST /api/body-metrics/member/:id — staff regista uma avaliação para um membro
async function createMetricForMember(req, res) {
  if (!validateMetricBody(req, res)) return;
  const metric = await insertMetric(req.params.id, req.user.id, req.body);
  res.status(201).json(metric);
}

// PUT /api/body-metrics/:id — editar um registo (dono ou staff)
async function updateMetric(req, res) {
  const metric = await findMetricWithAccess(req, res);
  if (!metric) return;
  if (!validateMetricBody(req, res)) return;

  const { recorded_at, weight_kg, body_fat_pct, lean_mass_kg, muscle_mass_kg, bone_mass_kg, body_water_pct } = req.body;
  const result = await pool.query(
    `UPDATE body_metrics
        SET recorded_at = $1, weight_kg = $2, body_fat_pct = $3, lean_mass_kg = $4,
            muscle_mass_kg = $5, bone_mass_kg = $6, body_water_pct = $7
      WHERE id = $8
      RETURNING ${METRIC_COLUMNS}`,
    [
      recorded_at,
      weight_kg,
      body_fat_pct || null,
      lean_mass_kg || null,
      muscle_mass_kg || null,
      bone_mass_kg || null,
      body_water_pct || null,
      req.params.id,
    ]
  );
  res.json(result.rows[0]);
}

// DELETE /api/body-metrics/:id — eliminar um registo (dono ou staff)
async function deleteMetric(req, res) {
  const metric = await findMetricWithAccess(req, res);
  if (!metric) return;

  await pool.query("DELETE FROM body_metrics WHERE id = $1", [req.params.id]);
  res.status(204).send();
}

module.exports = {
  listMetrics,
  createMetrics,
  listMetricsForMember,
  createMetricForMember,
  updateMetric,
  deleteMetric,
};
