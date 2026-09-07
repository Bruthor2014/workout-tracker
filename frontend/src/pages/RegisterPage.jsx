import { useState } from "react";
import { Link } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function RegisterPage() {
  const [name, setName] = useState("");
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
      // Espera { token, user } vindo de POST /api/auth/register no backend.
      // Fase 1: gym_id fica fixo no backend (um só ginásio de teste) até
      // existir fluxo de escolha/registo de ginásio.
      const data = await apiRequest("/auth/register", {
        method: "POST",
        body: { name, email, password },
      });
      // Não há navigate() aqui de propósito: o RedirectIfAuthed que envolve
      // esta rota já reage à mudança de estado do login e redireciona
      // sozinho (ver App.jsx) — chamar navigate() aqui entraria em corrida
      // com esse redirect e podia perder.
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
        <h1>Criar conta</h1>
        <p className="text-secondary">Começa a registar os teus treinos.</p>
        <form onSubmit={handleSubmit}>
          <div>
            <label className="field-label" htmlFor="name">
              Nome
            </label>
            <input
              id="name"
              type="text"
              className="glass-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="O teu nome"
              required
            />
          </div>
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
              placeholder="Mínimo 8 caracteres"
              minLength={8}
              required
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="glass-button" type="submit" disabled={loading}>
            {loading ? "A criar..." : "Criar conta"}
          </button>
        </form>
        <p className="auth-switch">
          Já tens conta? <Link to="/login">Entrar</Link>
        </p>
      </GlassCard>
    </div>
  );
}
