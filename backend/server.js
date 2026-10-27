require("dotenv").config({ quiet: true });
const path = require("path");
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const multer = require("multer");

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
const friendRoutes = require("./routes/friendRoutes");
const { startClassChecker } = require("./services/classChecker");
const { startSubscriptionReminders } = require("./services/subscriptionNotify");

const app = express();

// Atrás de um proxy (Cloud Run, Render, etc.) só há 1 hop até à app —
// sem isto, express-rate-limit rejeita os pedidos por desconfiar do
// X-Forwarded-For (vê um IP que não é o do cliente real). Em dev local não
// há proxy nenhum, mas "trust proxy" aqui não faz mal nesse caso.
app.set("trust proxy", 1);

// Gzip all responses (cuts bandwidth ~70% for JSON APIs)
app.use(compression());
// Em produção, só os domínios em ALLOWED_ORIGINS (separados por vírgula —
// ver .env.example) podem chamar a API; sem essa variável definida (dev
// local), fica aberto a qualquer origem, como sempre foi.
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim());
app.use(cors(allowedOrigins ? { origin: allowedOrigins } : undefined));
app.use(express.json());

// Rate limiting: 500 req/15 min per IP globally; tighter on auth endpoints
const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false });
const authLimiter   = rateLimit({ windowMs: 15 * 60 * 1000, max: 30,  standardHeaders: true, legacyHeaders: false });
app.use("/api/", globalLimiter);
app.use("/api/auth/login",    authLimiter);
app.use("/api/auth/register", authLimiter);
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
app.use("/api/friends", friendRoutes);

// Mensagens de ficheiro (avatar, fotos de alimentos/exercícios — ver
// middleware/upload.js) nunca chegavam ao utilizador: tanto o limite de
// tamanho do multer como a mensagem já escrita no fileFilter para formato
// inválido caíam sempre no "Erro interno do servidor" genérico abaixo.
const MULTER_ERROR_MESSAGES = {
  LIMIT_FILE_SIZE: "A foto é demasiado grande (máximo 8MB).",
  LIMIT_UNEXPECTED_FILE: "Campo de ficheiro inesperado.",
};

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: MULTER_ERROR_MESSAGES[err.code] || "Não foi possível enviar o ficheiro." });
  }
  if (err.statusCode) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  console.error(err);
  res.status(500).json({ message: "Erro interno do servidor." });
});

const PORT = process.env.PORT || 3000;
// Cancela automaticamente as aulas de grupo sem mínimo de inscritos/sem PT.
startClassChecker();
// Avisa membros com subscrição a expirar nos próximos dias.
startSubscriptionReminders();
app.listen(PORT, () => {
  console.log(`Backend a correr em http://localhost:${PORT}`);
});
