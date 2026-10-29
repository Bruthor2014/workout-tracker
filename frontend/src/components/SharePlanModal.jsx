import { useEffect, useState } from "react";
import Modal from "./Modal";
import GlassCard from "./GlassCard";
import { IconCheck, IconShare, IconUsers } from "./Icons";
import { apiRequest, resolveAssetUrl } from "../api/client";
import { ROLE_LABELS } from "../utils/roles";

function ContactAvatar({ person }) {
  const url = resolveAssetUrl(person.avatar_url);
  if (url) return <img src={url} alt="" className="member-card-avatar share-contact-avatar" />;
  return (
    <span className="member-card-avatar member-card-avatar-fallback share-contact-avatar">
      {person.name.charAt(0).toUpperCase()}
    </span>
  );
}

// Partilha dirigida: escolhe-se UM amigo de cada vez (nunca "todos os
// seguidores dão para copiar") — ver POST /api/plan-shares. O amigo decide
// depois, na caixa de entrada do feed, se quer copiar para a sua conta.
export default function SharePlanModal({ planType, planId, planName, onClose }) {
  const [contacts, setContacts] = useState(null);
  const [error, setError] = useState("");
  const [sendingId, setSendingId] = useState(null);
  const [sentIds, setSentIds] = useState(() => new Set());

  useEffect(() => {
    apiRequest("/plan-shares/contacts")
      .then(setContacts)
      .catch((err) => setError(err.message));
  }, []);

  async function handleShare(friend) {
    setSendingId(friend.id);
    setError("");
    try {
      await apiRequest("/plan-shares", {
        method: "POST",
        body: { plan_type: planType, plan_id: planId, to_user_id: friend.id },
      });
      setSentIds((prev) => new Set(prev).add(friend.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingId(null);
    }
  }

  return (
    <Modal onClose={onClose}>
      <GlassCard strong className="share-plan-modal">
        <div className="share-plan-header">
          <span className="share-plan-icon">
            <IconShare size={20} />
          </span>
          <div>
            <span className="share-plan-eyebrow">Partilhar plano</span>
            <h3>{planName}</h3>
          </div>
        </div>
        <p className="text-secondary share-plan-hint">
          Escolhe um amigo — ele decide se quer copiar o plano para a conta dele.
        </p>

        {error && <p className="error-text">{error}</p>}
        {contacts === null && <p className="text-secondary">A carregar...</p>}
        {contacts?.length === 0 && (
          <div className="empty-state share-plan-empty">
            <IconUsers size={28} />
            <p>Ainda não tens amigos — segue alguém primeiro em "Amigos".</p>
          </div>
        )}

        {contacts?.length > 0 && (
          <div className="share-contact-list">
            {contacts.map((friend) => {
              const sent = sentIds.has(friend.id);
              return (
                <div key={friend.id} className="share-contact-row">
                  <ContactAvatar person={friend} />
                  <div className="share-contact-identity">
                    <span className="share-contact-name">{friend.name}</span>
                    <span className="share-contact-role">{ROLE_LABELS[friend.role] || friend.role}</span>
                  </div>
                  <button
                    type="button"
                    className={`glass-button glass-button-secondary share-contact-button${sent ? " sent" : ""}`}
                    disabled={sendingId === friend.id || sent}
                    onClick={() => handleShare(friend)}
                  >
                    {sent ? (
                      <>
                        <IconCheck size={13} /> Enviado
                      </>
                    ) : sendingId === friend.id ? (
                      "A enviar..."
                    ) : (
                      "Partilhar"
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="glass-button glass-button-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </GlassCard>
    </Modal>
  );
}
