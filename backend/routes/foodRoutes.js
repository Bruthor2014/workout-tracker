const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { uploadFoodPhoto } = require("../middleware/upload");
const { searchFoods, uploadFoodPhoto: uploadFoodPhotoHandler } = require("../controllers/foodController");

const router = express.Router();

// Qualquer utilizador autenticado: membros também criam os seus planos.
router.get("/search", requireAuth, searchFoods);
// requireAuth primeiro: o upload usa req.user.id no nome do ficheiro.
router.post("/photo", requireAuth, uploadFoodPhoto.single("photo"), uploadFoodPhotoHandler);

module.exports = router;
