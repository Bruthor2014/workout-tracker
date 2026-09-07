import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// O oposto do RequireAuth: usado em /login e /register para que, se já
// tiveres sessão iniciada, sejas mandado para outro sítio em vez de veres
// o formulário de login/registo outra vez. `to` é para onde vai — inclui
// o momento em que o próprio formulário acaba de fazer login()/registar,
// porque isto reage ao estado a mudar; um navigate() manual a seguir a
// login() entraria em corrida com este redirect e perderia.
export default function RedirectIfAuthed({ to = "/dashboard", children }) {
  const { token } = useAuth();
  if (token) {
    return <Navigate to={to} replace />;
  }
  return children;
}
