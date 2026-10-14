const express = require("express");
const { register, login, getInviteInfo } = require("../controllers/authController");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/invite/:code", getInviteInfo);

module.exports = router;
