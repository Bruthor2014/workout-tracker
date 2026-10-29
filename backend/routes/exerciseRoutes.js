const express = require("express");
const { requireAuth, notOwner } = require("../middleware/auth");
const { uploadExercisePhoto } = require("../middleware/upload");
const { listExercises, createExercise, updateExerciseVideo, deleteExercise, toggleFavorite } = require("../controllers/exerciseController");

const router = express.Router();

router.get("/", requireAuth, listExercises);
router.post("/", requireAuth, notOwner, uploadExercisePhoto.single("photo"), createExercise);
router.patch("/:id/video", requireAuth, notOwner, updateExerciseVideo);
router.post("/:id/favorite", requireAuth, notOwner, toggleFavorite);
router.delete("/:id", requireAuth, notOwner, deleteExercise);

module.exports = router;
