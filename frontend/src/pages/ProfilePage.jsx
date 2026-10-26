import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import Modal from "../components/Modal";
import AvatarUploader from "../components/AvatarUploader";
import BodyMetricsSection from "../components/BodyMetricsSection";
import ProfileProgress from "../components/ProfileProgress";
import SubscriptionsSection from "../components/SubscriptionsSection";
import NutritionCompletionNote from "../components/NutritionCompletionNote";
import { IconChevronRight, IconPencil, IconUserPlus, IconUsers } from "../components/Icons";
import { useAuth } from "../context/AuthContext";
import { useSidebarMode } from "../hooks/useSidebarMode";
import { ROLE_LABELS } from "../utils/roles";
import { apiRequest } from "../api/client";

// Editar o próprio nome e, opcionalmente, a password (pedida só se quem
// está a editar escolher mudá-la — fica escondida por omissão). Contas só
// com login por Google não têm password própria; o backend recusa com uma
// mensagem clara se tentarem mudá-la por aqui, sem o formulário precisar
// de saber isso de antemão.
function EditProfileModal({ user, onClose, onSaved }) {
  const [name, setName] = useState(user.name);
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const body = { name };
      if (showPassword && newPassword) {
        body.current_password = currentPassword;
        body.new_password = newPassword;
      }
      const updated = await apiRequest("/users/me", { method: "PUT", body });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <GlassCard className="preview-card" strong>
        <h3>Editar perfil</h3>
        <form onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="edit-profile-name">Nome</label>
          <input
            id="edit-profile-name"
            className="glass-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          {!showPassword ? (
            <button
              type="button"
              className="link-button"
              style={{ marginTop: 12 }}
              onClick={() => setShowPassword(true)}
            >
              Mudar password
            </button>
          ) : (
            <>
              <label className="field-label" htmlFor="edit-profile-current-password" style={{ marginTop: 12 }}>
                Password atual
              </label>
              <input
                id="edit-profile-current-password"
                type="password"
                className="glass-input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
              />
              <label className="field-label" htmlFor="edit-profile-new-password">Password nova</label>
              <input
                id="edit-profile-new-password"
                type="password"
                className="glass-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                placeholder="Mínimo 8 caracteres"
              />
            </>
          )}

          {error && <p className="error-text" style={{ marginTop: 10 }}>{error}</p>}

          <div className="form-actions">
            <button type="button" className="glass-button glass-button-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="glass-button" disabled={saving || !name.trim()}>
              {saving ? "A guardar..." : "Guardar"}
            </button>
          </div>
        </form>
      </GlassCard>
    </Modal>
  );
}

// Um bloco de estatística clicável (seguidores/a seguir) — ícone num
// quadrado vermelho, número grande e "Ver lista" com seta. `to` abre a
// página de Amigos já no separador certo (ver FriendsPage.jsx).
function FriendStatBlock({ icon: Icon, label, value, to }) {
  return (
    <Link to={to} className="profile-follow-stat">
      <span className="stat-tile-icon">
        <Icon size={20} />
      </span>
      <span className="profile-follow-stat-body">
        <span className="stat-tile-label">{label}</span>
        <span className="stat-tile-value">{value}</span>
        <span className="profile-follow-stat-cta">
          Ver lista <IconChevronRight size={14} />
        </span>
      </span>
    </Link>
  );
}

// Contagem de seguidores/a seguir, cada um como o seu próprio bloco
// clicável — a mesma relação de "Amigos", só resumida aqui para quem vê o
// perfil.
function FriendsSummary() {
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    apiRequest("/friends/counts").then(setCounts).catch(() => {});
  }, []);

  if (!counts) return null;

  return (
    <div className="profile-follow-stats">
      <FriendStatBlock icon={IconUsers} label="Seguidores" value={counts.followers} to="/friends?tab=followers" />
      <FriendStatBlock icon={IconUserPlus} label="A seguir" value={counts.following} to="/friends?tab=following" />
    </div>
  );
}

// Aviso para quem se registou sem Google e ainda não clicou no link de
// confirmação (ver authController.js). `=== false` de propósito: sessões
// antigas guardadas antes desta funcionalidade não têm este campo
// (undefined) e não devem mostrar o aviso a contas que já eram válidas.
function EmailVerificationBanner({ user }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  if (user.email_verified !== false) return null;

  async function handleResend() {
    setSending(true);
    setError("");
    try {
      await apiRequest("/auth/resend-verification", { method: "POST" });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <GlassCard className="preview-card" strong style={{ marginBottom: 20, borderColor: "#fbbf24" }}>
      <p className="text-secondary" style={{ margin: "0 0 8px" }}>
        Ainda não confirmaste o teu email ({user.email}).
      </p>
      {sent ? (
        <p className="text-secondary" style={{ margin: 0 }}>Email reenviado — verifica a caixa de entrada.</p>
      ) : (
        <button type="button" className="glass-button glass-button-secondary" onClick={handleResend} disabled={sending}>
          {sending ? "A reenviar..." : "Reenviar email de confirmação"}
        </button>
      )}
      {error && <p className="error-text" style={{ margin: "8px 0 0" }}>{error}</p>}
    </GlassCard>
  );
}

// Perfil da conta de gestão (CEO): sem dados pessoais de treino, só o
// ginásio que gere, em números, e atalhos para a gestão.
function GymOwnerProfile() {
  const [gym, setGym] = useState(null);

  useEffect(() => {
    apiRequest("/gym/overview").then(setGym).catch(() => {});
  }, []);

  if (!gym) return null;
  const staffTotal = gym.staff.reduce((sum, s) => sum + s.count, 0);
  const facts = [
    { label: "Membros", value: gym.members.total },
    { label: "Equipa", value: staffTotal },
    { label: "Aulas de grupo por semana", value: gym.classes.total },
    { label: "Treinos este mês", value: gym.activity.this_month },
  ];

  return (
    <section className="profile-progress">
      <div className="profile-section-header">
        <h2>{gym.gym_name}</h2>
      </div>
      <div className="profile-stats">
        {facts.map((f) => (
          <GlassCard key={f.label} className="stat-tile profile-stat" strong>
            <span className="stat-tile-label">{f.label}</span>
            <span className="stat-tile-value">{f.value.toLocaleString("pt-PT")}</span>
          </GlassCard>
        ))}
      </div>
      <div className="page-header-actions">
        <Link to="/management" className="glass-button">Painel de gestão</Link>
        <Link to="/members" className="glass-button glass-button-secondary">Membros</Link>
        <Link to="/team-schedule" className="glass-button glass-button-secondary">Horários da equipa</Link>
        <Link to="/classes" className="glass-button glass-button-secondary">Aulas de grupo</Link>
      </div>
    </section>
  );
}


export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [searchParams] = useSearchParams();
  const welcome = searchParams.get("welcome") === "1";
  const isOwner = user.role === "gym_owner";
  const hasFriends = user.role !== "reception_station";
  const { mode, setMode, hasModeToggle } = useSidebarMode(user);
  const [editingProfile, setEditingProfile] = useState(false);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>O teu perfil</h1>
      </div>

      {/* Visível só em mobile (CSS) — mesmo estado do toggle da Sidebar,
          sem lógica nova. No desktop o toggle continua só na Sidebar. */}
      {hasModeToggle && (
        <div className="profile-mode-switch-mobile" role="group" aria-label="Pessoal ou Profissional">
          <button type="button" className={mode === "individual" ? "active" : ""} onClick={() => setMode("individual")}>
            Pessoal
          </button>
          <button type="button" className={mode === "profissional" ? "active" : ""} onClick={() => setMode("profissional")}>
            Profissional
          </button>
        </div>
      )}

      <EmailVerificationBanner user={user} />

      <NutritionCompletionNote />

      {welcome && !isOwner && (
        <GlassCard className="preview-card" strong style={{ marginBottom: 20, borderColor: "var(--accent)" }}>
          <p className="text-secondary" style={{ margin: 0 }}>
            Bem-vindo! Regista o teu peso atual para já teres um ponto de partida na tua evolução.
          </p>
        </GlassCard>
      )}

      <GlassCard className="profile-summary" strong>
        <div className="profile-summary-top">
          <div className="profile-summary-identity">
            <AvatarUploader />
            <div>
              <h3>
                {user.name}
                <button
                  type="button"
                  className="profile-edit-trigger"
                  onClick={() => setEditingProfile(true)}
                  aria-label="Editar perfil"
                >
                  <IconPencil size={14} />
                </button>
              </h3>
              <p className="text-secondary profile-summary-email">{user.email}</p>
              {hasModeToggle ? (
                <>
                  <span className="role-badge role-badge-static profile-role-badge-desktop">
                    {ROLE_LABELS[user.role] || user.role}
                  </span>
                  <span className="role-badge role-badge-static profile-role-badge-mobile">
                    {mode === "individual" ? "Pessoal" : "Profissional"}
                  </span>
                </>
              ) : (
                <span className="role-badge role-badge-static">{ROLE_LABELS[user.role] || user.role}</span>
              )}
            </div>
          </div>

          {hasFriends && <FriendsSummary />}
        </div>
      </GlassCard>

      {editingProfile && (
        <EditProfileModal
          user={user}
          onClose={() => setEditingProfile(false)}
          onSaved={(updated) => updateUser({ name: updated.name })}
        />
      )}

      {user.role === "member" && (
        <section className="profile-progress">
          <div className="profile-section-header">
            <h2>Subscrições ativas</h2>
          </div>
          <SubscriptionsSection selfView hasGym={Boolean(user.gym_id)} />
        </section>
      )}

      {isOwner ? (
        <GymOwnerProfile />
      ) : (
        <>
          <ProfileProgress />
          <div id="body-metrics-section" style={{ marginTop: 28 }}>
            <BodyMetricsSection autoOpen={welcome} />
          </div>
        </>
      )}
    </div>
  );
}
