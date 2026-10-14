const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  listStaff,
  listShifts,
  listMyShifts,
  createShift,
  updateShift,
  deleteShift,
  clearShifts,
  STAFF_ROLES,
} = require("../controllers/shiftController");
const { generateSchedule } = require("../controllers/scheduleGenerator");

const router = express.Router();

const OWNER = requireRole("gym_owner");

// "/staff" e "/me" antes de "/:id".
router.get("/staff", requireAuth, OWNER, listStaff);
router.get("/me", requireAuth, requireRole(...STAFF_ROLES), listMyShifts);
router.get("/", requireAuth, OWNER, listShifts);
router.post("/generate", requireAuth, OWNER, generateSchedule);
router.post("/", requireAuth, OWNER, createShift);
router.put("/:id", requireAuth, OWNER, updateShift);
router.delete("/", requireAuth, OWNER, clearShifts);
router.delete("/:id", requireAuth, OWNER, deleteShift);

module.exports = router;
