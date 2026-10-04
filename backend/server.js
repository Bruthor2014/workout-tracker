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
const foodRoutes = require("./routes/foodRoutes");
const classRoutes = require("./routes/classRoutes");
const shiftRoutes = require("./routes/shiftRoutes");
const clientRoutes = require("./routes/clientRoutes");
const gymRoutes = require("./routes/gymRoutes");
const financeRoutes = require("./routes/financeRoutes");
const occupancyRoutes = require("./routes/occupancyRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const { startClassChecker } = require("./services/classChecker");

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
app.use("/api/foods", foodRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/shifts", shiftRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/gym", gymRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/occupancy", occupancyRoutes);
app.use("/api/attendance", attendanceRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Erro interno do servidor." });
});

const PORT = process.env.PORT || 3000;
// Cancela automaticamente as aulas de grupo sem mínimo de inscritos/sem PT.
startClassChecker();
app.listen(PORT, () => {
  console.log(`Backend a correr em http://localhost:${PORT}`);
});
