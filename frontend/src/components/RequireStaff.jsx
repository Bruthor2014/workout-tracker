import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const STAFF_ROLES = ["gym_owner", "personal_trainer", "nutritionist", "receptionist"];

// Como o RequireAuth, mas também exige um role de staff — usado nas páginas
// de gestão de membros, que um membro comum não deve conseguir abrir.
export default function RequireStaff({ children }) {
  const { token, user } = useAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (!STAFF_ROLES.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
