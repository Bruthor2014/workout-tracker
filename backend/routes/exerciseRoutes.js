const express = require("express");
const { requireAuth, notOwner } = require("../middleware/auth");
const { uploadExercisePhoto } = require("../middleware/upload");
const { listExercises, createExercise, deleteExercise } = require("../controllers/exerciseController");

const router = express.Router();

router.get("/", requireAuth, listExercises);
router.post("/", requireAuth, notOwner, uploadExercisePhoto.single("photo"), createExercise);
router.delete("/:id", requireAuth, notOwner, deleteExercise);

module.exports = router;
