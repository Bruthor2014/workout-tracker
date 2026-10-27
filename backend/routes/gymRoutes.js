const express = require("express");
const { requireAuth, requireRole, requireDono } = require("../middleware/auth");
const {
  getOverview,
  listGyms,
  createGym,
  assignOwner,
  searchUsers,
  patchUser,
  getGymDetail,
  deleteGym,
  updateTheme,
  resetTheme,
  getRegistrationStats,
  listRegistrations,
} = require("../controllers/gymController");

const router = express.Router();

router.get("/overview", requireAuth, requireRole("gym_owner"), getOverview);
router.put("/theme", requireAuth, requireRole("gym_owner"), updateTheme);
router.delete("/theme", requireAuth, requireRole("gym_owner"), resetTheme);

// Rotas exclusivas do DONO da plataforma
router.get("/all", requireAuth, requireDono, listGyms);
router.post("/create", requireAuth, requireDono, createGym);
router.post("/:id/owner", requireAuth, requireDono, assignOwner);
router.get("/users", requireAuth, requireDono, searchUsers);
router.get("/registrations/stats", requireAuth, requireDono, getRegistrationStats);
router.get("/registrations", requireAuth, requireDono, listRegistrations);
router.patch("/users/:id", requireAuth, requireDono, patchUser);
router.get("/:id/detail", requireAuth, requireDono, getGymDetail);
router.delete("/:id", requireAuth, requireDono, deleteGym);

module.exports = router;
