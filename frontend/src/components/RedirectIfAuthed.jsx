import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// O oposto do RequireAuth: usado em /login e /register para que, se já
// tiveres sessão iniciada, sejas mandado para outro sítio em vez de veres
// o formulário de login/registo outra vez. `to` é para onde vai — inclui
// o momento em que o próprio formulário acaba de fazer login()/registar,
// porque isto reage ao estado a mudar; um navigate() manual a seguir a
// login() entraria em corrida com este redirect e perderia.
export default function RedirectIfAuthed({ to = "/dashboard", children }) {
  const { token, user } = useAuth();
  if (token) {
    const dest = user?.role === "dono" ? "/dono"
      : user?.role === "gym_owner" ? "/management"
      : user?.role === "reception_station" ? "/occupancy"
      : to;
    return <Navigate to={dest} replace />;
  }
  return children;
}
