import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import AvatarUploader from "../components/AvatarUploader";
import BodyMetricsSection from "../components/BodyMetricsSection";
import ProfileProgress from "../components/ProfileProgress";
import SubscriptionsSection from "../components/SubscriptionsSection";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABELS } from "../utils/roles";
import { apiRequest } from "../api/client";

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
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const welcome = searchParams.get("welcome") === "1";
  const isOwner = user.role === "gym_owner";

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>O teu perfil</h1>
      </div>

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
              <h3>{user.name}</h3>
              <p className="text-secondary">{user.email}</p>
              <span className="role-badge role-badge-static">{ROLE_LABELS[user.role] || user.role}</span>
            </div>
          </div>

          {user.role === "member" && <SubscriptionsSection selfView />}
        </div>
      </GlassCard>

      {isOwner ? (
        <GymOwnerProfile />
      ) : (
        <>
          <ProfileProgress />
          <div style={{ marginTop: 28 }}>
            <BodyMetricsSection autoOpen={welcome} />
          </div>
        </>
      )}
    </div>
  );
}
