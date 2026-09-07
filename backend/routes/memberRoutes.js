const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { listMembers, getMember, listStaff } = require("../controllers/memberController");
const {
  getMemberSubscriptions,
  getMySubscriptions,
  updateMemberSubscription,
} = require("../controllers/subscriptionController");

const router = express.Router();

const STAFF = requireRole("gym_owner", "personal_trainer", "nutritionist", "receptionist");
const SUBSCRIPTION_MANAGERS = requireRole("gym_owner", "receptionist");

// "/staff" e "/me/subscriptions" antes de "/:id" para não serem
// interpretados como um id de membro.
router.get("/staff", requireAuth, STAFF, listStaff);
router.get("/me/subscriptions", requireAuth, getMySubscriptions);
router.get("/", requireAuth, STAFF, listMembers);
router.get("/:id", requireAuth, STAFF, getMember);
router.get("/:id/subscriptions", requireAuth, STAFF, getMemberSubscriptions);
router.put("/:id/subscriptions/:serviceType", requireAuth, SUBSCRIPTION_MANAGERS, updateMemberSubscription);

module.exports = router;
