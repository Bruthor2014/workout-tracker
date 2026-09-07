const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  listMetrics,
  createMetrics,
  listMetricsForMember,
  createMetricForMember,
  updateMetric,
  deleteMetric,
} = require("../controllers/bodyMetricController");

const router = express.Router();

const STAFF = requireRole("gym_owner", "personal_trainer", "nutritionist");

router.get("/", requireAuth, listMetrics);
router.post("/", requireAuth, createMetrics);
router.get("/member/:id", requireAuth, STAFF, listMetricsForMember);
router.post("/member/:id", requireAuth, STAFF, createMetricForMember);
router.put("/:id", requireAuth, updateMetric);
router.delete("/:id", requireAuth, deleteMetric);

module.exports = router;
