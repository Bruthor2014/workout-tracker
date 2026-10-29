const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { uploadPlanPhoto } = require("../middleware/upload");
const {
  listPlans,
  createPlan,
  listPlansForMember,
  createPlanForMember,
  updatePlan,
  updatePlanDay,
  addPlanDay,
  updatePlanInfo,
  deletePlan,
  reorderPlans,
} = require("../controllers/planController");

const router = express.Router();

// Ver os planos de um membro: staff que o acompanha (o CEO só consulta).
const STAFF = requireRole("gym_owner", "personal_trainer", "nutritionist");
// Criar planos para um membro: só a especialidade certa.
const CREATORS = requireRole("personal_trainer");
// O CEO é uma conta de gestão do ginásio: não tem planos próprios.
const NOT_OWNER = requireRole("member", "personal_trainer", "nutritionist", "receptionist", "intern", "dono", "gym_owner");

router.get("/", requireAuth, NOT_OWNER, listPlans);
router.post("/", requireAuth, NOT_OWNER, createPlan);
// Antes de "/:id", senão "reorder" seria lido como um id.
router.put("/reorder", requireAuth, NOT_OWNER, reorderPlans);
router.get("/member/:id", requireAuth, STAFF, listPlansForMember);
router.post("/member/:id", requireAuth, CREATORS, createPlanForMember);
router.put("/:id", requireAuth, updatePlan);
router.patch("/:id/info", requireAuth, uploadPlanPhoto.single("photo"), updatePlanInfo);
router.post("/:id/days", requireAuth, addPlanDay);
router.put("/:id/days/:dayId", requireAuth, updatePlanDay);
router.delete("/:id", requireAuth, deletePlan);

module.exports = router;
