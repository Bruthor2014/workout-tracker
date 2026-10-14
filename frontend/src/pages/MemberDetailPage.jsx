import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import Modal from "../components/Modal";
import Select from "../components/Select";
import BodyMetricsSection from "../components/BodyMetricsSection";
import ProfileProgress from "../components/ProfileProgress";
import SubscriptionsSection from "../components/SubscriptionsSection";
import NewPlanForm from "../components/NewPlanForm";
import PlanCard from "../components/PlanCard";
import NewNutritionPlanForm from "../components/NewNutritionPlanForm";
import NutritionPlanCard from "../components/NutritionPlanCard";
import { apiRequest, resolveAssetUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABELS } from "../utils/roles";

const SUBSCRIPTION_MANAGER_ROLES = ["gym_owner", "receptionist"];
// Rececionistas veem a área de Membros (para gerir subscrições) mas não têm
// acesso a treino/nutrição/composição corporal — esses continuam só para
// quem já os geria antes.
const CLINICAL_STAFF_ROLES = ["gym_owner", "personal_trainer", "nutritionist"];
// Criar planos: PTs (treino) e nutricionistas (nutrição) — o CEO só consulta.
// Repor password e mudar role são mais sensíveis do que gerir
// subscrições — só gym_owner.
const PASSWORD_MANAGER_ROLES = ["gym_owner"];
const ROLE_MANAGER_ROLES = ["gym_owner"];
const COACH_ROLES = ["personal_trainer", "nutritionist"];

// Espelha ASSIGNABLE_ROLES do backend — nunca inclui gym_owner nem admin
// (ver memberController.js para o porquê).
const ASSIGNABLE_ROLES = [
  { value: "member", label: "Membro" },
  { value: "personal_trainer", label: "Personal Trainer" },
  { value: "nutritionist", label: "Nutricionista" },
  { value: "receptionist", label: "Rececionista" },
  { value: "intern", label: "Estagiário" },
];

function ChangeRoleButton({ memberId }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("member");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function close() {
    setOpen(false);
    setRole("member");
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/members/${memberId}/role`, { method: "PUT", body: { role } });
      // Deixa de ser "membro" (ou muda de role), por isso esta página deixa
      // de se aplicar — volta à lista de membros.
      navigate("/members");
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" className="link-button" onClick={() => setOpen(true)}>
        Mudar role
      </button>

      {open && (
        <Modal onClose={close}>
          <GlassCard className="preview-card" strong>
            <h3>Mudar role</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ marginTop: 14 }}>
                <label className="field-label" htmlFor="new-role">
                  Novo role
                </label>
                <Select id="new-role" value={role} onChange={setRole} options={ASSIGNABLE_ROLES} ariaLabel="Novo role" />
              </div>
              {error && <p className="error-text">{error}</p>}
              <div className="form-actions">
                <button type="button" className="glass-button glass-button-secondary" onClick={close}>
                  Cancelar
                </button>
                <button type="submit" className="glass-button" disabled={saving}>
                  {saving ? "A guardar..." : "Guardar"}
                </button>
              </div>
            </form>
          </GlassCard>
        </Modal>
      )}
    </>
  );
}

function ResetPasswordButton({ memberId }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  function close() {
    setOpen(false);
    setPassword("");
    setError("");
    setDone(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/members/${memberId}/password`, { method: "PUT", body: { new_password: password } });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button type="button" className="link-button" onClick={() => setOpen(true)}>
        Repor password
      </button>

      {open && (
        <Modal onClose={close}>
          <GlassCard className="preview-card" strong>
            <h3>Repor password</h3>
            {done ? (
              <>
                <p className="text-secondary" style={{ marginTop: 14 }}>Password alterada com sucesso.</p>
                <div className="form-actions">
                  <button type="button" className="glass-button" onClick={close}>
                    Fechar
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ marginTop: 14 }}>
                  <label className="field-label" htmlFor="new-password">
                    Nova password
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    className="glass-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
                {error && <p className="error-text">{error}</p>}
                <div className="form-actions">
                  <button type="button" className="glass-button glass-button-secondary" onClick={close}>
                    Cancelar
                  </button>
                  <button type="submit" className="glass-button" disabled={saving}>
                    {saving ? "A guardar..." : "Guardar"}
                  </button>
                </div>
              </form>
            )}
          </GlassCard>
        </Modal>
      )}
    </>
  );
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const fmtDate = (key) => { if (!key) return null; const d = new Date(`${String(key).slice(0,10)}T00:00:00`); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };

// Clientes de um PT/nutricionista (apenas clientes do ginásio) — visível para CEO e rececionista.
// O CEO pode clicar num cliente para ir ao seu perfil e gerir subscrições a partir daí.
function StaffClientsSection({ staffId }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest(`/clients/of/${staffId}`)
      .then(setClients)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [staffId]);

  if (loading) return <p className="text-secondary">A carregar...</p>;
  if (error) return <p className="error-text">{error}</p>;
  if (!clients.length) return <p className="text-secondary">Este coach ainda não tem clientes do ginásio atribuídos.</p>;

  return (
    <div className="member-grid clients-grid" style={{ marginTop: 12 }}>
      {clients.map((c) => {
        const url = resolveAssetUrl(c.avatar_url);
        return (
          <Link key={c.id} to={`/members/${c.id}`} style={{ textDecoration: "none" }}>
            <GlassCard className="member-tile client-tile" strong style={{ cursor: "pointer" }}>
              <div className="member-tile-header client-tile-head">
                {url
                  ? <img src={url} alt="" className="member-card-avatar" />
                  : <span className="member-card-avatar member-card-avatar-fallback">{c.name.charAt(0).toUpperCase()}</span>}
                <div className="member-tile-identity">
                  <span className="member-tile-name">{c.name}</span>
                  <span className="member-tile-email">{c.started_at ? `Desde ${fmtDate(c.started_at)}` : c.email}</span>
                </div>
              </div>
              <span className="text-secondary" style={{ fontSize: "0.78rem", marginTop: 6, display: "block" }}>
                Ver perfil →
              </span>
            </GlassCard>
          </Link>
        );
      })}
    </div>
  );
}

function MemberAvatar({ member }) {
  const avatarUrl = resolveAssetUrl(member.avatar_url);
  return (
    <span className="profile-avatar" style={{ cursor: "default" }}>
      {avatarUrl ? <img src={avatarUrl} alt="" className="profile-avatar-img" /> : member.name.charAt(0).toUpperCase()}
    </span>
  );
}

function PlansSection({ memberId, canCreate }) {
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
      {canCreate && !showForm && (
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

      <div className="plan-list" style={{ marginTop: 12 }}>
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} exercises={exercises} editable onChanged={loadPlans} />
        ))}
      </div>
    </div>
  );
}

function NutritionSection({ memberId, canCreate }) {
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
        Inclui os planos do staff e os que o próprio membro tenha criado.
      </p>
      {canCreate && !showForm && (
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

      <div className="plan-list" style={{ marginTop: 12 }}>
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
        <h1>{member && member.role !== "member" ? "Perfil da equipa" : "Perfil do membro"}</h1>
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
                <span className="role-badge role-badge-static">{ROLE_LABELS[member.role] || "Membro"}</span>
                {(PASSWORD_MANAGER_ROLES.includes(user.role) || ROLE_MANAGER_ROLES.includes(user.role)) && (
                  <div style={{ marginTop: 6, display: "flex", gap: 10 }}>
                    {PASSWORD_MANAGER_ROLES.includes(user.role) && <ResetPasswordButton memberId={id} />}
                    {ROLE_MANAGER_ROLES.includes(user.role) && <ChangeRoleButton memberId={id} />}
                  </div>
                )}
              </div>
            </div>

            <SubscriptionsSection memberId={id} editable={SUBSCRIPTION_MANAGER_ROLES.includes(user.role)} />
          </div>
        </GlassCard>
      )}

      {CLINICAL_STAFF_ROLES.includes(user.role) && member && !COACH_ROLES.includes(member.role) && (
        <>
          <ProfileProgress memberId={id} />

          <div style={{ marginTop: 28 }}>
            <BodyMetricsSection memberId={id} />
          </div>

          <h2 className="section-title" style={{ textAlign: "left", marginTop: 28 }}>
            Planos de treino
          </h2>
          <PlansSection memberId={id} canCreate={user.role === "personal_trainer"} />

          <h2 className="section-title" style={{ textAlign: "left", marginTop: 28 }}>
            Plano de nutrição
          </h2>
          <NutritionSection memberId={id} canCreate={user.role === "nutritionist"} />
        </>
      )}

      {SUBSCRIPTION_MANAGER_ROLES.includes(user.role) && member && COACH_ROLES.includes(member.role) && (
        <>
          <h2 className="section-title" style={{ textAlign: "left", marginTop: 28 }}>
            Clientes
          </h2>
          <StaffClientsSection staffId={id} />
        </>
      )}
    </div>
  );
}
