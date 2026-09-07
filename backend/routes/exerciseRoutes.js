const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { listExercises } = require("../controllers/exerciseController");

const router = express.Router();

router.get("/", requireAuth, listExercises);

module.exports = router;
