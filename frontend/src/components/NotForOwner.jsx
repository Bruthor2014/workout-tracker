import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Páginas de treino/planos pessoais: o CEO (conta de gestão do ginásio) não
// as tem e é mandado para o painel de gestão.
export default function NotForOwner({ children }) {
  const { user } = useAuth();
  if (user?.role === "gym_owner") return <Navigate to="/management" replace />;
  if (user?.role === "dono") return <Navigate to="/dono" replace />;
  return children;
}
