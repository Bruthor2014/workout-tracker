const jwt = require("jsonwebtoken");
const pool = require("../db/pool");

// Lê o header "Authorization: Bearer <token>", valida o JWT e, se for
// válido, guarda o payload em req.user para os controllers usarem
// (req.user.id, req.user.gymId, req.user.role).
//
// gymId/role vêm sempre confirmados na BD, nunca só do payload do token:
// o JWT fica com o valor de quando a sessão começou (dura 7 dias — ver
// signToken em authController.js), mas gym_id/role podem mudar entretanto
// (ex: o DONO atribui alguém como CEO de um ginásio novo). Sem isto, um
// endpoint que confiasse no gymId do token podia escrever no ginásio
// ERRADO para quem tivesse sessão aberta de antes da mudança — foi o que
// aconteceu com o tema do ginásio (updateTheme alterou as cores de outro
// ginásio, não do novo, porque confiava no token desatualizado).
async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Token em falta." });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Token inválido ou expirado." });
  }

  const result = await pool.query("SELECT gym_id, role FROM users WHERE id = $1", [payload.id]);
  const current = result.rows[0];
  if (!current) {
    return res.status(401).json({ message: "Conta não encontrada." });
  }

  req.user = { id: payload.id, gymId: current.gym_id, role: current.role };
  next();
}

// Uso: router.post("/plans", requireAuth, requireRole("gym_owner", "personal_trainer"), handler)
// Bloqueia o acesso a quem não tiver um dos roles indicados. Fica pronto
// para a Fase 2, mesmo que a Fase 1 ainda não tenha rotas que o usem.
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Sem permissão para esta ação." });
    }
    next();
  };
}

// A conta da receção (PC fixo do balcão, não uma pessoa) é a única conta
// puramente de estação: não tem treinos, planos nem dados pessoais
// próprios. O CEO e o DONO da plataforma, apesar de terem contas de
// gestão, são também pessoas e podem ter os seus próprios treinos.
function notOwner(req, res, next) {
  if (req.user.role === "reception_station") {
    return res.status(403).json({ message: "A conta de gestão não tem treinos nem dados pessoais." });
  }
  next();
}

// Garante que a rota só pode ser acedida pelo dono da plataforma.
const requireDono = requireRole("dono");

module.exports = { requireAuth, requireRole, requireDono, notOwner };
