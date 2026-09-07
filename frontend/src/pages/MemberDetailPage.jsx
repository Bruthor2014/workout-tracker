import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import BodyMetricsSection from "../components/BodyMetricsSection";
import SubscriptionsSection from "../components/SubscriptionsSection";
import NewPlanForm from "../components/NewPlanForm";
import PlanCard from "../components/PlanCard";
import NewNutritionPlanForm from "../components/NewNutritionPlanForm";
import NutritionPlanCard from "../components/NutritionPlanCard";
import { apiRequest, resolveAssetUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";

const SUBSCRIPTION_MANAGER_ROLES = ["gym_owner", "receptionist"];
// Rececionistas veem a área de Membros (para gerir subscrições) mas não têm
// acesso a treino/nutrição/composição corporal — esses continuam só para
// quem já os geria antes.
const CLINICAL_STAFF_ROLES = ["gym_owner", "personal_trainer", "nutritionist"];

function MemberAvatar({ member }) {
  const avatarUrl = resolveAssetUrl(member.avatar_url);
  return (
    <span className="profile-avatar" style={{ cursor: "default" }}>
      {avatarUrl ? <img src={avatarUrl} alt="" className="profile-avatar-img" /> : member.name.charAt(0).toUpperCase()}
    </span>
  );
}

function PlansSection({ memberId }) {
  const [plans, setPlans] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  function loadPlans() {
    setLoading(true);
    apiRequest(`/plans/member/${memberId}`)
      .then(setPlans)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadPlans();
    apiRequest("/exercises").then(setExercises).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  return (
    <div style={{ marginTop: 12 }}>
      {!showForm && (
        <button className="glass-button" onClick={() => setShowForm(true)}>
          + Novo plano para este membro
        </button>
      )}

      {showForm && (
        <div style={{ marginTop: 14 }}>
          <NewPlanForm
            exercises={exercises}
            submitPath={`/plans/member/${memberId}`}
            onCancel={() => setShowForm(false)}
            onCreated={() => {
              setShowForm(false);
              loadPlans();
            }}
          />
        </div>
      )}

      {loading && <p className="text-secondary" style={{ marginTop: 12 }}>A carregar...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && plans.length === 0 && !showForm && (
        <GlassCard className="empty-state" style={{ marginTop: 12 }}>
          <p>Este membro ainda não tem planos de treino.</p>
        </GlassCard>
      )}

      <div className="session-grid" style={{ marginTop: 12 }}>
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} exercises={exercises} editable onChanged={loadPlans} />
        ))}
      </div>
    </div>
  );
}

function NutritionSection({ memberId }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  function loadPlans() {
    setLoading(true);
    apiRequest(`/nutrition-plans/member/${memberId}`)
      .then(setPlans)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  return (
    <div style={{ marginTop: 12 }}>
      <p className="text-secondary" style={{ marginBottom: 10 }}>
        Inclui planos criados por ti e planos que o próprio membro tenha criado.
      </p>
      {!showForm && (
        <button className="glass-button" onClick={() => setShowForm(true)}>
          + Novo plano de nutrição
        </button>
      )}

      {showForm && (
        <div style={{ marginTop: 14 }}>
          <NewNutritionPlanForm
            submitPath={`/nutrition-plans/member/${memberId}`}
            onCancel={() => setShowForm(false)}
            onCreated={() => {
              setShowForm(false);
              loadPlans();
            }}
          />
        </div>
      )}

      {loading && <p className="text-secondary" style={{ marginTop: 12 }}>A carregar...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && plans.length === 0 && !showForm && (
        <GlassCard className="empty-state" style={{ marginTop: 12 }}>
          <p>Este membro ainda não tem plano de nutrição.</p>
        </GlassCard>
      )}

      <div className="session-grid" style={{ marginTop: 12 }}>
        {plans.map((plan) => (
          <NutritionPlanCard key={plan.id} plan={plan} editable onChanged={loadPlans} />
        ))}
      </div>
    </div>
  );
}

export default function MemberDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [member, setMember] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest(`/members/${id}`)
      .then(setMember)
      .catch((err) => setError(err.message));
  }, [id]);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Perfil do membro</h1>
      </div>
      {error && <p className="error-text">{error}</p>}

      {member && (
        <GlassCard className="profile-summary" strong>
          <div className="profile-summary-top">
            <div className="profile-summary-identity">
              <MemberAvatar member={member} />
              <div>
                <h3>{member.name}</h3>
                <p className="text-secondary">{member.email}</p>
                <span className="role-badge role-badge-static">Membro</span>
              </div>
            </div>

            <SubscriptionsSection memberId={id} editable={SUBSCRIPTION_MANAGER_ROLES.includes(user.role)} />
          </div>
        </GlassCard>
      )}

      {CLINICAL_STAFF_ROLES.includes(user.role) && (
        <>
          <div style={{ marginTop: 28 }}>
            <BodyMetricsSection memberId={id} />
          </div>

          <h2 className="section-title" style={{ textAlign: "left", marginTop: 28 }}>
            Planos de treino
          </h2>
          <PlansSection memberId={id} />

          <h2 className="section-title" style={{ textAlign: "left", marginTop: 28 }}>
            Plano de nutrição
          </h2>
          <NutritionSection memberId={id} />
        </>
      )}
    </div>
  );
}
