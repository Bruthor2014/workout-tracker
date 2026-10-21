import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";

// Aberta a partir do link do email (ver authController.js verifyEmail()) —
// funciona com ou sem sessão ativa (o link pode ser aberto noutro
// dispositivo/browser), por isso valida só pelo token do URL, nunca pelo
// utilizador com sessão.
export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState("loading"); // "loading" | "done" | "error"
  const [error, setError] = useState("");
  const [session, setSession] = useState(null);
  const { login } = useAuth();

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("Link de confirmação em falta.");
      return;
    }
    apiRequest(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((data) => {
        setSession(data);
        setStatus("done");
      })
      .catch((err) => {
        setError(err.message);
        setStatus("error");
      });
  }, [token]);

  return (
    <div className="page-center">
      <GlassCard className="auth-card">
        {status === "loading" && (
          <>
            <h1>A confirmar...</h1>
            <p className="text-secondary">Um momento.</p>
          </>
        )}
        {status === "done" && (
          <>
            <h1>Email confirmado</h1>
            <p className="text-secondary">A tua conta está ativa.</p>
            <button className="glass-button" type="button" onClick={() => login(session.token, session.user)}>
              Continuar para o perfil
            </button>
          </>
        )}
        {status === "error" && (
          <>
            <h1>Não foi possível confirmar</h1>
            <p className="error-text">{error}</p>
            <p className="auth-switch">
              <Link to="/login">Voltar ao login</Link>
            </p>
          </>
        )}
      </GlassCard>
    </div>
  );
}
