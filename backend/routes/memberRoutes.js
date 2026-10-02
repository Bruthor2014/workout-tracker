const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  listMembers,
  getMember,
  listStaff,
  resetMemberPassword,
  updateMemberRole,
} = require("../controllers/memberController");
const {
  getMemberSubscriptions,
  getMySubscriptions,
  updateMemberSubscription,
} = require("../controllers/subscriptionController");

const router = express.Router();

const STAFF = requireRole("gym_owner", "personal_trainer", "nutritionist", "receptionist");
const SUBSCRIPTION_MANAGERS = requireRole("gym_owner", "receptionist");
// Repor password e mudar roles são mais sensíveis do que gerir
// subscrições — só gym_owner, não rececionista.
const PASSWORD_MANAGERS = requireRole("gym_owner");
const ROLE_MANAGERS = requireRole("gym_owner");

// "/staff" e "/me/subscriptions" antes de "/:id" para não serem
// interpretados como um id de membro.
router.get("/staff", requireAuth, STAFF, listStaff);
router.get("/me/subscriptions", requireAuth, getMySubscriptions);
router.get("/", requireAuth, STAFF, listMembers);
router.get("/:id", requireAuth, STAFF, getMember);
router.get("/:id/subscriptions", requireAuth, STAFF, getMemberSubscriptions);
router.put("/:id/subscriptions/:serviceType", requireAuth, SUBSCRIPTION_MANAGERS, updateMemberSubscription);
router.put("/:id/password", requireAuth, PASSWORD_MANAGERS, resetMemberPassword);
router.put("/:id/role", requireAuth, ROLE_MANAGERS, updateMemberRole);

module.exports = router;
