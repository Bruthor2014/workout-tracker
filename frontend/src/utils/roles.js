// Nome legível e cor de cada role (cargo) — usados no perfil, nas
// mensagens e na lista de membros.
export const ROLE_LABELS = {
  dono: "Dono",
  member: "Membro",
  admin: "Admin",
  gym_owner: "CEO",
  personal_trainer: "Personal Trainer",
  nutritionist: "Nutricionista",
  intern: "Estagiário",
  receptionist: "Rececionista",
  reception_station: "Receção",
};

export const ROLE_COLORS = {
  member: "#94a3b8",
  admin: "#f43f5e",
  gym_owner: "#f59e0b",
  personal_trainer: "#8b5cf6",
  nutritionist: "#10b981",
  intern: "#06b6d4",
  receptionist: "#3b82f6",
  reception_station: "#0ea5e9",
};

// Grupos de roles usados para decidir o que cada conta vê.
// O CEO (gym_owner) é uma conta de gestão: não treina nem tem planos.
export const TEAM_ROLES = ["personal_trainer", "nutritionist", "receptionist", "intern"];
// Quem pode dar aulas de grupo/palestras (ver classController.js).
export const INSTRUCTOR_ROLES = ["personal_trainer", "nutritionist", "intern"];
