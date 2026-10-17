const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  listClients,
  listSessions,
  createSession,
  updateSession,
  deleteSession,
  addExternalClient,
  removeExternalClient,
  listClientsOf,
  addClientToStaff,
  removeClientOfStaff,
} = require("../controllers/clientController");

const router = express.Router();

const COACHES = requireRole("personal_trainer", "nutritionist");

router.get("/", requireAuth, COACHES, listClients);
router.get("/sessions", requireAuth, requireRole("personal_trainer", "nutritionist", "gym_owner", "reception_station"), listSessions);
router.post("/sessions", requireAuth, COACHES, createSession);
router.put("/sessions/:id", requireAuth, COACHES, updateSession);
router.delete("/sessions/:id", requireAuth, COACHES, deleteSession);
router.post("/external", requireAuth, COACHES, addExternalClient);
router.delete("/external/:clientId", requireAuth, COACHES, removeExternalClient);

const MANAGERS = requireRole("gym_owner", "receptionist");
router.get("/of/:staffId", requireAuth, MANAGERS, listClientsOf);
router.post("/of/:staffId/external", requireAuth, MANAGERS, addClientToStaff);
router.delete("/of/:staffId/external/:clientId", requireAuth, MANAGERS, removeClientOfStaff);

module.exports = router;
