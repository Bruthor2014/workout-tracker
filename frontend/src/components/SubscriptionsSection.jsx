import { useEffect, useState } from "react";
import GlassCard from "./GlassCard";
import Modal from "./Modal";
import Select from "./Select";
import { IconDumbbell, IconUser, IconUtensils } from "./Icons";
import { apiRequest } from "../api/client";

// `gym_membership` não tem `staffRole`/`staffLabel` de propósito — é só
// ativo/inativo (a inscrição geral no ginásio), sem staff atribuído.
// `cardLabel`/`icon` só são usados pelos cartões do próprio membro
// (selfView) — a vista de staff mantém sempre `label`.
const SERVICES = [
  { type: "gym_membership", label: "Membro do Ginásio", cardLabel: "Ginásio", icon: IconDumbbell },
  {
    type: "personal_training",
    label: "Personal Training",
    cardLabel: "Personal Training",
    icon: IconUser,
    staffRole: "personal_trainer",
    staffLabel: "Personal trainer atribuído",
  },
  {
    type: "nutrition_plan",
    label: "Plano de Nutrição",
    cardLabel: "Plano de Nutrição",
    icon: IconUtensils,
    staffRole: "nutritionist",
    staffLabel: "Nutricionista atribuído",
  },
];

const MONTH_LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const formatLongDate = (dateKey) => {
  const d = new Date(`${dateKey}T00:00:00`);
  return `${d.getDate()} ${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
};
const formatPrice = (cents) => (cents / 100).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Três estados possíveis no perfil do próprio membro: nunca aderiu (ou já
// cancelou), em dia com o pagamento, ou em atraso (paid_until no passado —
// ver payment_status em subscriptionController.js). "Ativo" cobre o caso
// raro de uma subscrição ativa sem preço configurado (ex: coach externo).
const EXPIRING_SOON_DAYS = 3;

function subscriptionStatusInfo(sub) {
  if (!sub.is_active) return { label: "Inativo", dotClass: "" };
  if (sub.payment_status === "late") return { label: "Em atraso", dotClass: "late" };
  if (sub.payment_status === "paid") {
    if (sub.next_renewal_date) {
      const days = Math.ceil((new Date(`${sub.next_renewal_date}T00:00:00`) - new Date()) / (1000 * 60 * 60 * 24));
      if (days <= EXPIRING_SOON_DAYS) {
        return { label: days <= 0 ? "Expira hoje" : `Expira em ${days} dia${days === 1 ? "" : "s"}`, dotClass: "late" };
      }
    }
    return { label: "Em dia", dotClass: "active" };
  }
  return { label: "Ativo", dotClass: "active" };
}

function SubscriptionEditor({ memberId, subscriptions, staffByRole, onSaved, onClose }) {
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(
      SERVICES.map((s) => [
        s.type,
        {
          is_active: subscriptions[s.type].is_active,
          assigned_staff_id: subscriptions[s.type].assigned_staff_id ?? "",
          // Vazio = sem preço próprio, usa o do ginásio. Só pré-preenche se
          // já houver um override (is_custom_price), nunca com o preço do
          // ginásio — isso continua a aparecer só como placeholder.
          priceOverride: subscriptions[s.type].is_custom_price
            ? String(subscriptions[s.type].price_cents / 100).replace(".", ",")
            : "",
        },
      ])
    )
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateDraft(type, patch) {
    setDrafts((prev) => ({ ...prev, [type]: { ...prev[type], ...patch } }));
  }

  async function handleSave() {
    setError("");

    // Valida todos os preços ANTES de gravar seja o que for — sem isto, um
    // preço ilegível (ex: "abc") era só ignorado em silêncio: o editor
    // fechava como se tivesse corrido tudo bem, mas o override não tinha
    // sido aplicado nem limpo.
    for (const service of SERVICES) {
      const priceInput = drafts[service.type].priceOverride.trim();
      if (!priceInput) continue;
      const cents = Math.round(parseFloat(priceInput.replace(",", ".")) * 100);
      if (!Number.isFinite(cents) || cents < 0) {
        setError(`Preço inválido em "${service.label}": "${priceInput}". Usa um número (ex: 35,00) ou deixa vazio.`);
        return;
      }
    }

    setSaving(true);
    try {
      for (const service of SERVICES) {
        const draft = drafts[service.type];
        await apiRequest(`/members/${memberId}/subscriptions/${service.type}`, {
          method: "PUT",
          body: { is_active: draft.is_active, assigned_staff_id: draft.is_active ? draft.assigned_staff_id || null : null },
        });

        const original = subscriptions[service.type];
        const priceInput = draft.priceOverride.trim();
        if (priceInput) {
          const cents = Math.round(parseFloat(priceInput.replace(",", ".")) * 100);
          if (Number.isFinite(cents) && cents >= 0) {
            await apiRequest(`/members/${memberId}/subscriptions/${service.type}/price`, {
              method: "PUT",
              body: { price_cents: cents },
            });
          }
        } else if (original.is_custom_price) {
          await apiRequest(`/members/${memberId}/subscriptions/${service.type}/price`, { method: "DELETE" });
        }
      }
      // Os endpoints acima devolvem o mapa completo em formatos diferentes
      // (um serviço só / todos) — mais simples voltar a pedir tudo de uma
      // vez do que tentar remendar o estado anterior com respostas parciais.
      onSaved(await apiRequest(`/members/${memberId}/subscriptions`));
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
            {service.type === "gym_membership" && !draft.is_active && subscriptions.gym_membership.is_active && (
              <p className="text-secondary" style={{ margin: "6px 0 0", fontSize: "0.78rem" }}>
                Desativar a inscrição no ginásio tira logo esta pessoa do ginásio (fica sem gym_id) — para voltar a
                entrar, usa-se outra vez "Novo sócio".
              </p>
            )}

            {draft.is_active && service.staffRole && (
              <div style={{ marginTop: 8 }}>
                <label className="field-label" htmlFor={`staff-${service.type}`}>
                  {service.staffLabel}
                </label>
                <Select
                  id={`staff-${service.type}`}
                  value={draft.assigned_staff_id}
                  onChange={(staffId) => updateDraft(service.type, { assigned_staff_id: staffId })}
                  options={[
                    { value: "", label: "Por atribuir" },
                    ...staffByRole[service.staffRole].map((s) => ({ value: String(s.id), label: s.name })),
                  ]}
                  ariaLabel={service.staffLabel}
                />
              </div>
            )}

            {draft.is_active && (
              <div style={{ marginTop: 8 }}>
                <label className="field-label" htmlFor={`price-${service.type}`}>
                  Preço próprio (desconto/promoção) — opcional
                </label>
                <input
                  id={`price-${service.type}`}
                  type="text"
                  inputMode="decimal"
                  className="glass-input"
                  placeholder="Vazio = preço do ginásio"
                  value={draft.priceOverride}
                  onChange={(e) => updateDraft(service.type, { priceOverride: e.target.value })}
                />
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

// Painel "Gerir" de uma subscrição ativa (selfView) — só preço e próxima
// renovação, de propósito nada mais (sem mudar de plano, cancelar, nem
// histórico). Uma ligação a coach externo (`is_external`) não é gerida
// pelo ginásio — não faz sentido mandar ninguém ao balcão para algo que o
// ginásio nem sabe que existe, então mostra antes para falar com o coach.
// Só cai no aviso do balcão quando falta mesmo preço configurado no
// ginásio (e a pessoa está nesse ginásio).
function SubscriptionDetailModal({ service, sub, onClose }) {
  return (
    <Modal onClose={onClose}>
      <GlassCard className="preview-card subscription-detail" strong>
        <h3>{service.cardLabel}</h3>
        {sub.is_external ? (
          <p className="text-secondary">
            Acompanhamento direto com <strong>{sub.assigned_staff_name}</strong>, fora da gestão do ginásio — fala
            com a pessoa sobre preços, estatísticas ou para terminar o acompanhamento.
          </p>
        ) : sub.price_cents != null ? (
          <>
            <p className="subscription-detail-price">
              {formatPrice(sub.price_cents)} € / {sub.billing_period === "yearly" ? "ano" : "mês"}
            </p>
            {sub.payment_status === "late" ? (
              <p className="subscription-detail-late">Em atraso desde {formatLongDate(sub.next_renewal_date)}</p>
            ) : (
              <p className="text-secondary">
                {sub.next_renewal_date ? `Próxima renovação: ${formatLongDate(sub.next_renewal_date)}` : "Sem data de renovação definida."}
              </p>
            )}
          </>
        ) : (
          <p className="text-secondary">Dirige-te ao balcão para ver preços.</p>
        )}
        <div className="form-actions">
          <button type="button" className="glass-button" onClick={onClose}>
            Fechar
          </button>
        </div>
      </GlassCard>
    </Modal>
  );
}

// Um cartão de subscrição do próprio membro (selfView): ícone, nome,
// estado com ponto colorido, e "Gerir" (ativa, abre o painel acima) ou só
// o aviso de ir ao balcão (inativa — nunca há fluxo de pagamento na app).
// `hasGym` só importa ao cartão do Ginásio: sem ginásio associado, "vai ao
// balcão" não faz sentido (não há balcão nenhum a que ir).
function SubscriptionCard({ service, sub, hasGym }) {
  const [open, setOpen] = useState(false);
  const Icon = service.icon;
  const status = subscriptionStatusInfo(sub);
  const noGymForMembership = service.type === "gym_membership" && !hasGym;

  return (
    <>
      <GlassCard className="subscription-card" strong>
        <span className="stat-tile-icon">
          <Icon size={22} />
        </span>
        <div className="subscription-card-body">
          <span className="subscription-card-name">{service.cardLabel}</span>
          <span className="subscription-card-status">
            <span className={`subscription-dot${status.dotClass ? ` ${status.dotClass}` : ""}`} />
            {status.label}
            {sub.is_external && (
              <span className="client-source-badge client-source-external">Externo</span>
            )}
          </span>
        </div>
        {sub.is_active ? (
          <button type="button" className="glass-button glass-button-secondary subscription-card-action" onClick={() => setOpen(true)}>
            Gerir
          </button>
        ) : noGymForMembership ? (
          <span className="subscription-card-hint">Ainda não estás associado a nenhum ginásio</span>
        ) : (
          <span className="subscription-card-hint">Dirige-te ao balcão para ver preços</span>
        )}
      </GlassCard>
      {open && <SubscriptionDetailModal service={service} sub={sub} onClose={() => setOpen(false)} />}
    </>
  );
}

// Resumo compacto das subscrições de PT/nutrição, pensado para caber ao
// lado do cabeçalho do perfil (pequeno, alinhado à direita). A edição em si
// (só staff com `editable`, nunca em `selfView`) abre num modal em vez de
// expandir inline, para manter o resumo sempre minimalista.
export default function SubscriptionsSection({ memberId, editable, selfView = false, hasGym }) {
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

  if (selfView) {
    return (
      <div className="subscription-cards">
        {SERVICES.map((service) => (
          <SubscriptionCard key={service.type} service={service} sub={subscriptions[service.type]} hasGym={hasGym} />
        ))}
      </div>
    );
  }

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
                <span className="subscription-compact-staff">
                  {current.assigned_staff_name || "Por atribuir"}
                  {current.is_external && <span className="client-source-badge client-source-external" style={{ marginLeft: 6 }}>Externo</span>}
                </span>
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
