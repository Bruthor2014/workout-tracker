import { useState } from "react";
import { Link } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Espera { token, user } vindo de POST /api/auth/login no backend.
      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      // Sem navigate() aqui de propósito — o RedirectIfAuthed que envolve
      // esta rota reage à mudança de estado e redireciona sozinho (ver
      // App.jsx e o comentário em RegisterPage.jsx).
      login(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-center">
      <GlassCard className="auth-card">
        <h1>Entrar</h1>
        <p className="text-secondary">Acede à tua conta para veres os teus treinos.</p>
        <form onSubmit={handleSubmit}>
          <div>
            <label className="field-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="glass-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@exemplo.com"
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="glass-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="glass-button" type="submit" disabled={loading}>
            {loading ? "A entrar..." : "Entrar"}
          </button>
        </form>
        <p className="auth-switch">
          Ainda não tens conta? <Link to="/">Criar conta</Link>
        </p>
      </GlassCard>
    </div>
  );
}
