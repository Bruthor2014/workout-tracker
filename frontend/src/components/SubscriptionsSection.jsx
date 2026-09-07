import { useEffect, useState } from "react";
import GlassCard from "./GlassCard";
import Modal from "./Modal";
import { apiRequest } from "../api/client";

// `gym_membership` não tem `staffRole`/`staffLabel` de propósito — é só
// ativo/inativo (a inscrição geral no ginásio), sem staff atribuído.
const SERVICES = [
  { type: "gym_membership", label: "Membro do Ginásio" },
  { type: "personal_training", label: "Personal Training", staffRole: "personal_trainer", staffLabel: "Personal trainer atribuído" },
  { type: "nutrition_plan", label: "Plano de Nutrição", staffRole: "nutritionist", staffLabel: "Nutricionista atribuído" },
];

function SubscriptionEditor({ memberId, subscriptions, staffByRole, onSaved, onClose }) {
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(
      SERVICES.map((s) => [
        s.type,
        { is_active: subscriptions[s.type].is_active, assigned_staff_id: subscriptions[s.type].assigned_staff_id ?? "" },
      ])
    )
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateDraft(type, patch) {
    setDrafts((prev) => ({ ...prev, [type]: { ...prev[type], ...patch } }));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const results = {};
      for (const service of SERVICES) {
        const draft = drafts[service.type];
        results[service.type] = await apiRequest(`/members/${memberId}/subscriptions/${service.type}`, {
          method: "PUT",
          body: { is_active: draft.is_active, assigned_staff_id: draft.is_active ? draft.assigned_staff_id || null : null },
        });
      }
      onSaved(results);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <GlassCard className="preview-card" strong>
      <h3>Editar subscrições</h3>
      {SERVICES.map((service) => {
        const draft = drafts[service.type];
        return (
          <div key={service.type} style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <strong>{service.label}</strong>
              <div className="subscription-toggle">
                <button
                  type="button"
                  className={`glass-button${draft.is_active ? "" : " glass-button-secondary"}`}
                  onClick={() => updateDraft(service.type, { is_active: true })}
                >
                  Ativo
                </button>
                <button
                  type="button"
                  className={`glass-button${draft.is_active ? " glass-button-secondary" : ""}`}
                  onClick={() => updateDraft(service.type, { is_active: false })}
                >
                  Inativo
                </button>
              </div>
            </div>

            {draft.is_active && service.staffRole && (
              <div style={{ marginTop: 8 }}>
                <label className="field-label" htmlFor={`staff-${service.type}`}>
                  {service.staffLabel}
                </label>
                <select
                  id={`staff-${service.type}`}
                  className="glass-input"
                  value={draft.assigned_staff_id}
                  onChange={(e) => updateDraft(service.type, { assigned_staff_id: e.target.value })}
                >
                  <option value="">Por atribuir</option>
                  {staffByRole[service.staffRole].map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        );
      })}

      {error && <p className="error-text">{error}</p>}

      <div className="form-actions">
        <button type="button" className="glass-button glass-button-secondary" onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className="glass-button" onClick={handleSave} disabled={saving}>
          {saving ? "A guardar..." : "Guardar"}
        </button>
      </div>
    </GlassCard>
  );
}

// Resumo compacto das subscrições de PT/nutrição, pensado para caber ao
// lado do cabeçalho do perfil (pequeno, alinhado à direita). A edição em si
// (só staff com `editable`, nunca em `selfView`) abre num modal em vez de
// expandir inline, para manter o resumo sempre minimalista.
export default function SubscriptionsSection({ memberId, editable, selfView = false }) {
  const [subscriptions, setSubscriptions] = useState(null);
  const [staffByRole, setStaffByRole] = useState({ personal_trainer: [], nutritionist: [] });
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const canEdit = editable && !selfView;

  useEffect(() => {
    const path = selfView ? "/members/me/subscriptions" : `/members/${memberId}/subscriptions`;
    apiRequest(path)
      .then(setSubscriptions)
      .catch((err) => setError(err.message));

    if (canEdit) {
      apiRequest(`/members/staff?role=personal_trainer`)
        .then((rows) => setStaffByRole((prev) => ({ ...prev, personal_trainer: rows })))
        .catch(() => {});
      apiRequest(`/members/staff?role=nutritionist`)
        .then((rows) => setStaffByRole((prev) => ({ ...prev, nutritionist: rows })))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId, selfView, canEdit]);

  if (error) return <p className="error-text">{error}</p>;
  if (!subscriptions) return <p className="text-secondary">A carregar...</p>;

  return (
    <>
      <div className="subscription-compact">
        {SERVICES.map((service) => {
          const current = subscriptions[service.type];
          return (
            <div className="subscription-compact-row" key={service.type}>
              <div>
                <span className="subscription-compact-label">{service.label}</span>
                <span className={`status-pill${current.is_active ? " status-pill-active" : ""}`}>
                  {current.is_active ? "Ativo" : "Inativo"}
                </span>
              </div>
              {current.is_active && service.staffRole && (
                <span className="subscription-compact-staff">{current.assigned_staff_name || "Por atribuir"}</span>
              )}
            </div>
          );
        })}

        {canEdit && (
          <button type="button" className="link-button" onClick={() => setEditing(true)}>
            Editar
          </button>
        )}
      </div>

      {editing && (
        <Modal onClose={() => setEditing(false)}>
          <SubscriptionEditor
            memberId={memberId}
            subscriptions={subscriptions}
            staffByRole={staffByRole}
            onSaved={(results) => setSubscriptions((prev) => ({ ...prev, ...results }))}
            onClose={() => setEditing(false)}
          />
        </Modal>
      )}
    </>
  );
}
