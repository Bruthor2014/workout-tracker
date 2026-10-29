const express = require("express");
const { requireAuth, requireRole, notOwner } = require("../middleware/auth");
const { uploadSessionPhoto: uploadSessionPhotoMiddleware } = require("../middleware/upload");
const {
  listSessions,
  getSession,
  createSession,
  updateSession,
  deleteSession,
  listRecords,
  getCaloriesBurnedToday,
  listExerciseHistory,
  listSessionsForMember,
  listRecordsForMember,
  uploadSessionPhoto,
  toggleReaction,
  listComments,
  addComment,
  deleteComment,
} = require("../controllers/sessionController");

const router = express.Router();

// Quem pode abrir o perfil de um membro (ver memberRoutes.js).
const STAFF = requireRole("gym_owner", "personal_trainer", "nutritionist", "receptionist");

router.get("/", requireAuth, notOwner, listSessions);
// Antes de "/:id", senão "records" seria lido como um id.
router.get("/records", requireAuth, notOwner, listRecords);
router.get("/calories-today", requireAuth, notOwner, getCaloriesBurnedToday);
router.get("/exercise/:exerciseId/history", requireAuth, notOwner, listExerciseHistory);
router.get("/member/:id", requireAuth, STAFF, listSessionsForMember);
router.get("/member/:id/records", requireAuth, STAFF, listRecordsForMember);
router.get("/:id", requireAuth, getSession);
router.post("/", requireAuth, notOwner, createSession);
router.put("/:id", requireAuth, updateSession);
router.post("/:id/photo", requireAuth, notOwner, uploadSessionPhotoMiddleware.single("photo"), uploadSessionPhoto);
router.post("/:id/reaction", requireAuth, notOwner, toggleReaction);
router.get("/:id/comments", requireAuth, notOwner, listComments);
router.post("/:id/comments", requireAuth, notOwner, addComment);
router.delete("/:id/comments/:commentId", requireAuth, notOwner, deleteComment);
router.delete("/:id", requireAuth, deleteSession);

module.exports = router;
