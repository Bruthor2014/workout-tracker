const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  listPlans,
  createPlan,
  listPlansForMember,
  createPlanForMember,
  updatePlan,
  deletePlan,
} = require("../controllers/planController");

const router = express.Router();

const STAFF = requireRole("gym_owner", "personal_trainer", "nutritionist");

router.get("/", requireAuth, listPlans);
router.post("/", requireAuth, createPlan);
router.get("/member/:id", requireAuth, STAFF, listPlansForMember);
router.post("/member/:id", requireAuth, STAFF, createPlanForMember);
router.put("/:id", requireAuth, updatePlan);
router.delete("/:id", requireAuth, deletePlan);

module.exports = router;
