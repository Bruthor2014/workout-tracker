const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const { listDaily, upsertAttendance, getWeekSummary, getMonthlyAttendance } = require("../controllers/attendanceController");

router.get("/daily", requireAuth, listDaily);
router.post("/", requireAuth, upsertAttendance);
router.get("/week-summary", requireAuth, getWeekSummary);
router.get("/monthly", requireAuth, getMonthlyAttendance);

module.exports = router;
