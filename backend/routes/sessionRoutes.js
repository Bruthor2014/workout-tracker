const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  listSessions,
  getSession,
  createSession,
  updateSession,
  deleteSession,
} = require("../controllers/sessionController");

const router = express.Router();

router.get("/", requireAuth, listSessions);
router.get("/:id", requireAuth, getSession);
router.post("/", requireAuth, createSession);
router.put("/:id", requireAuth, updateSession);
router.delete("/:id", requireAuth, deleteSession);

module.exports = router;
