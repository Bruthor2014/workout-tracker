const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  listPlans,
  createPlan,
  listPlansForMember,
  createPlanForMember,
  updatePlan,
  updateMeal,
  deletePlan,
} = require("../controllers/nutritionController");

const router = express.Router();

// Ver os planos de um membro: staff que o acompanha (o CEO só consulta).
const STAFF = requireRole("gym_owner", "personal_trainer", "nutritionist");
// Criar planos para um membro: só a especialidade certa.
const CREATORS = requireRole("nutritionist");
// O CEO é uma conta de gestão do ginásio: não tem planos próprios.
const NOT_OWNER = requireRole("member", "personal_trainer", "nutritionist", "receptionist", "intern");

router.get("/", requireAuth, NOT_OWNER, listPlans);
router.post("/", requireAuth, NOT_OWNER, createPlan);
router.get("/member/:id", requireAuth, STAFF, listPlansForMember);
router.post("/member/:id", requireAuth, CREATORS, createPlanForMember);
router.put("/:id", requireAuth, updatePlan);
router.put("/:id/meals/:mealId", requireAuth, updateMeal);
router.delete("/:id", requireAuth, deletePlan);

module.exports = router;
