import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Páginas de treino/planos pessoais: só a conta da receção (PC fixo do
// balcão, não uma pessoa) não as tem. CEO e DONO são pessoas como outra
// qualquer e têm acesso (alternam modo na sidebar).
export default function NotForOwner({ children }) {
  const { user } = useAuth();
  if (user?.role === "reception_station") return <Navigate to="/occupancy" replace />;
  return children;
}
