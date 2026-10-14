const express = require("express");
const { requireAuth, requireRole, notOwner } = require("../middleware/auth");
const {
  listSessions,
  getSession,
  createSession,
  updateSession,
  deleteSession,
  listRecords,
  listSessionsForMember,
  listRecordsForMember,
} = require("../controllers/sessionController");

const router = express.Router();

// Quem pode abrir o perfil de um membro (ver memberRoutes.js).
const STAFF = requireRole("gym_owner", "personal_trainer", "nutritionist", "receptionist");

router.get("/", requireAuth, notOwner, listSessions);
// Antes de "/:id", senão "records" seria lido como um id.
router.get("/records", requireAuth, notOwner, listRecords);
router.get("/member/:id", requireAuth, STAFF, listSessionsForMember);
router.get("/member/:id/records", requireAuth, STAFF, listRecordsForMember);
router.get("/:id", requireAuth, getSession);
router.post("/", requireAuth, notOwner, createSession);
router.put("/:id", requireAuth, updateSession);
router.delete("/:id", requireAuth, deleteSession);

module.exports = router;
