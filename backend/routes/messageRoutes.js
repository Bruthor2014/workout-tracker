const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { listContacts, getThread, sendMessage, broadcastMessage } = require("../controllers/messageController");

const router = express.Router();

const STAFF = requireRole("gym_owner", "personal_trainer", "nutritionist");

router.get("/contacts", requireAuth, listContacts);
router.post("/broadcast", requireAuth, STAFF, broadcastMessage);
router.get("/:otherUserId", requireAuth, getThread);
router.post("/:otherUserId", requireAuth, sendMessage);

module.exports = router;
