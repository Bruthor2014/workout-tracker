require("dotenv").config({ quiet: true });
const path = require("path");
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const exerciseRoutes = require("./routes/exerciseRoutes");
const sessionRoutes = require("./routes/sessionRoutes");
const planRoutes = require("./routes/planRoutes");
const bodyMetricRoutes = require("./routes/bodyMetricRoutes");
const memberRoutes = require("./routes/memberRoutes");
const userRoutes = require("./routes/userRoutes");
const nutritionRoutes = require("./routes/nutritionRoutes");
const messageRoutes = require("./routes/messageRoutes");

const app = express();

app.use(cors());
app.use(express.json());
// Serve os avatares carregados (ex: /uploads/avatars/user-2-171....jpg)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/exercises", exerciseRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/body-metrics", bodyMetricRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/users", userRoutes);
app.use("/api/nutrition-plans", nutritionRoutes);
app.use("/api/messages", messageRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Erro interno do servidor." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend a correr em http://localhost:${PORT}`);
});
