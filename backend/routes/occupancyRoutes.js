const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { getLive, getHistory, checkIn, checkOut, getAbsences } = require("../controllers/occupancyController");

const router = express.Router();
const STAFF = requireRole("gym_owner", "receptionist");

router.get("/live", requireAuth, STAFF, getLive);
router.get("/history", requireAuth, STAFF, getHistory);
router.post("/checkin", requireAuth, STAFF, checkIn);
router.post("/checkout", requireAuth, STAFF, checkOut);
router.get("/absences", requireAuth, STAFF, getAbsences);

module.exports = router;
