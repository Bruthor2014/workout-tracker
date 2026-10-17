import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Páginas de treino/planos pessoais: contas de gestão/estação (CEO, DONO,
// receção) não as têm e são mandadas para o seu painel próprio.
export default function NotForOwner({ children }) {
  const { user } = useAuth();
  if (user?.role === "gym_owner") return <Navigate to="/management" replace />;
  if (user?.role === "dono") return <Navigate to="/dono" replace />;
  if (user?.role === "reception_station") return <Navigate to="/occupancy" replace />;
  return children;
}
