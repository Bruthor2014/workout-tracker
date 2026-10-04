const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const { listDaily, upsertAttendance, getWeekSummary } = require("../controllers/attendanceController");

router.get("/daily", requireAuth, listDaily);
router.post("/", requireAuth, upsertAttendance);
router.get("/week-summary", requireAuth, getWeekSummary);

module.exports = router;
