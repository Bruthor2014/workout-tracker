const express = require("express");
const { register, login, getInviteInfo, verifyEmail, resendVerification, googleAuth, me } = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/invite/:code", getInviteInfo);
router.get("/verify-email", verifyEmail);
router.post("/resend-verification", requireAuth, resendVerification);
router.post("/google", googleAuth);
router.get("/me", requireAuth, me);

module.exports = router;
