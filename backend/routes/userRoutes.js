const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { uploadAvatar } = require("../middleware/upload");
const { uploadAvatar: uploadAvatarHandler, updateProfile } = require("../controllers/userController");

const router = express.Router();

// requireAuth primeiro: o middleware de upload usa req.user.id no nome do
// ficheiro, por isso precisa que o token já tenha sido validado.
router.post("/me/avatar", requireAuth, uploadAvatar.single("avatar"), uploadAvatarHandler);
router.put("/me", requireAuth, updateProfile);

module.exports = router;
