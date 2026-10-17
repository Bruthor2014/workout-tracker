const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  listClasses,
  createClass,
  updateClass,
  deleteClass,
  requestSubstitute,
  cancelSubstitute,
  claimClass,
  confirmOccurrence,
  unconfirmOccurrence,
  cancelOccurrence,
  autoCancel,
  enroll,
  unenroll,
  listEnrollments,
  INSTRUCTOR_ROLES,
  ENROLL_ROLES,
} = require("../controllers/classController");

const router = express.Router();

const OWNER = requireRole("gym_owner");
const INSTRUCTORS = requireRole(...INSTRUCTOR_ROLES);

router.get("/", requireAuth, listClasses);
router.post("/", requireAuth, OWNER, createClass);
// Fixed-path POST routes must come before /:id to avoid param capture
router.post("/auto-cancel", requireAuth, requireRole("gym_owner", "receptionist", "reception_station"), autoCancel);
router.put("/:id", requireAuth, OWNER, updateClass);
router.delete("/:id", requireAuth, OWNER, deleteClass);
router.post("/:id/substitute", requireAuth, INSTRUCTORS, requestSubstitute);
router.delete("/:id/substitute", requireAuth, cancelSubstitute);
router.post("/:id/claim", requireAuth, INSTRUCTORS, claimClass);
router.post("/:id/enroll", requireAuth, requireRole(...ENROLL_ROLES), enroll);
router.delete("/:id/enroll", requireAuth, requireRole(...ENROLL_ROLES), unenroll);
router.get("/:id/enrollments", requireAuth, listEnrollments);
router.post("/:id/occurrence", requireAuth, confirmOccurrence);
router.delete("/:id/occurrence", requireAuth, unconfirmOccurrence);
router.post("/:id/cancel-occurrence", requireAuth, requireRole("gym_owner", "receptionist", "reception_station"), cancelOccurrence);

module.exports = router;
