import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Só deixa entrar quem tiver sessão e um dos `roles`; os outros vão para a
// página inicial da sua conta (o CEO para a gestão, os restantes para os
// treinos).
export default function RequireRole({ roles, children }) {
  const { token, user } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (!roles.includes(user?.role)) {
    if (user?.role === "dono") return <Navigate to="/dono" replace />;
    return <Navigate to={user?.role === "gym_owner" ? "/management" : "/dashboard"} replace />;
  }
  return children;
}
