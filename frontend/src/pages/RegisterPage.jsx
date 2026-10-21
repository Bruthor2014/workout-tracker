import { useState } from "react";
import { Link } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import GoogleSignInButton from "../components/GoogleSignInButton";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Registo em duas fases: primeiro só o email (ou "Continuar com Google",
// que salta tudo o resto — a Google já confirma o email e dá o nome).
// Sem Google, depois do email pede-se nome/password e, ao criar a conta,
// fica pendente de confirmação por email — mostra-se um ecrã a dizer para
// ir ao email antes de entrar (ver `step === "sent"`).
export default function RegisterPage() {
  const [step, setStep] = useState("email"); // "email" | "details" | "sent"
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingSession, setPendingSession] = useState(null);
  const [devLink, setDevLink] = useState(null);
  const { login } = useAuth();

  function handleEmailSubmit(e) {
    e.preventDefault();
    setError("");
    if (!EMAIL_PATTERN.test(email)) {
      setError("Introduz um email válido.");
      return;
    }
    setStep("details");
  }

  async function handleDetailsSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiRequest("/auth/register", { method: "POST", body: { name, email, password } });
      setPendingSession(data);
      setDevLink(data.dev_verification_link || null);
      setStep("sent");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // GoogleSignInButton trata do pedido à API e, em conta nova, da
  // confirmação do nome — só avisa quando está tudo pronto para entrar.
  function handleGoogleAuthenticated(data) {
    // Google já confirma o email — entra logo, sem passar pelo ecrã de
    // confirmação (RedirectIfAuthed trata do resto, ver LoginPage.jsx).
    login(data.token, data.user);
  }

  if (step === "sent") {
    return (
      <div className="page-center">
        <GlassCard className="auth-card">
          <h1>Confirma o teu email</h1>
          <p className="text-secondary">
            Mandámos um link de confirmação para <strong>{email}</strong>. Abre-o para ativares a conta.
          </p>
          {devLink && (
            <p className="text-secondary auth-dev-link">
              Modo de desenvolvimento (sem email configurado) — link direto: <a href={devLink}>{devLink}</a>
            </p>
          )}
          <button className="glass-button" type="button" onClick={() => login(pendingSession.token, pendingSession.user)}>
            Continuar para o perfil
          </button>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="page-center">
      <GlassCard className="auth-card">
        <h1>Criar conta</h1>
        <p className="text-secondary">Começa a registar os teus treinos.</p>

        <GoogleSignInButton onAuthenticated={handleGoogleAuthenticated} onError={setError} />
        <div className="auth-divider"><span>ou</span></div>

        {step === "email" ? (
          <form onSubmit={handleEmailSubmit}>
            <div>
              <label className="field-label" htmlFor="email">Email</label>
              <input id="email" type="email" className="glass-input" value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="tu@exemplo.com" required autoFocus />
            </div>
            {error && <p className="error-text">{error}</p>}
            <button className="glass-button" type="submit">Continuar</button>
          </form>
        ) : (
          <form onSubmit={handleDetailsSubmit}>
            <p className="text-secondary auth-step-email">
              {email} · <button type="button" className="link-button" onClick={() => setStep("email")}>mudar</button>
            </p>
            <div>
              <label className="field-label" htmlFor="name">Nome</label>
              <input id="name" type="text" className="glass-input" value={name}
                onChange={(e) => setName(e.target.value)} placeholder="O teu nome" required autoFocus />
            </div>
            <div>
              <label className="field-label" htmlFor="password">Password</label>
              <input id="password" type="password" className="glass-input" value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" minLength={8} required />
            </div>
            {error && <p className="error-text">{error}</p>}
            <button className="glass-button" type="submit" disabled={loading}>
              {loading ? "A criar..." : "Criar conta"}
            </button>
          </form>
        )}

        <p className="auth-switch">
          Já tens conta? <Link to="/login">Entrar</Link>
        </p>
      </GlassCard>
    </div>
  );
}
