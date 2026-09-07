const jwt = require("jsonwebtoken");

// Lê o header "Authorization: Bearer <token>", valida o JWT e, se for
// válido, guarda o payload em req.user para os controllers usarem
// (req.user.id, req.user.gymId, req.user.role).
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Token em falta." });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Token inválido ou expirado." });
  }
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

module.exports = { requireAuth, requireRole };
