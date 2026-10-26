const express = require("express");
const { requireAuth, notOwner } = require("../middleware/auth");
const {
  getMyCode,
  previewCode,
  follow,
  followById,
  unfollow,
  listFollowing,
  listFollowers,
  getCounts,
  getSummary,
  getCompare,
  getRanking,
} = require("../controllers/friendController");

const router = express.Router();

// Pública (sem login) — a página de convite mostra quem é antes de pedir
// para entrar/criar conta.
router.get("/preview/:code", previewCode);

router.get("/me/code", requireAuth, notOwner, getMyCode);
router.post("/follow", requireAuth, notOwner, follow);
router.post("/follow-id/:id", requireAuth, notOwner, followById);
router.delete("/following/:id", requireAuth, notOwner, unfollow);
router.get("/following", requireAuth, notOwner, listFollowing);
router.get("/followers", requireAuth, notOwner, listFollowers);
router.get("/counts", requireAuth, notOwner, getCounts);
router.get("/ranking", requireAuth, notOwner, getRanking);
router.get("/:id/summary", requireAuth, notOwner, getSummary);
router.get("/:id/compare", requireAuth, notOwner, getCompare);

module.exports = router;
