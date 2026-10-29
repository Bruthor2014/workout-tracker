const express = require("express");
const { requireAuth, notOwner } = require("../middleware/auth");
const { listShareableContacts, createShare, viewShare, acceptShare, dismissShare } = require("../controllers/planShareController");

const router = express.Router();

router.get("/contacts", requireAuth, notOwner, listShareableContacts);
router.post("/", requireAuth, notOwner, createShare);
router.get("/:id/view", requireAuth, notOwner, viewShare);
router.post("/:id/copy", requireAuth, notOwner, acceptShare);
router.post("/:id/dismiss", requireAuth, notOwner, dismissShare);

module.exports = router;
