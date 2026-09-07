import { useSearchParams } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import AvatarUploader from "../components/AvatarUploader";
import BodyMetricsSection from "../components/BodyMetricsSection";
import SubscriptionsSection from "../components/SubscriptionsSection";
import { useAuth } from "../context/AuthContext";

const ROLE_LABELS = {
  member: "Membro",
  admin: "Admin",
  gym_owner: "CEO",
  personal_trainer: "Personal Trainer",
  nutritionist: "Nutricionista",
  intern: "Estagiário",
  receptionist: "Rececionista",
};

export default function ProfilePage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const welcome = searchParams.get("welcome") === "1";

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>O teu perfil</h1>
      </div>

      {welcome && (
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

      <div style={{ marginTop: 28 }}>
        <BodyMetricsSection autoOpen={welcome} />
      </div>
    </div>
  );
}
