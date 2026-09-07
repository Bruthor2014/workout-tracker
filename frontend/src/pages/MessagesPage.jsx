import { useEffect, useRef, useState } from "react";
import GlassCard from "../components/GlassCard";
import BroadcastModal from "../components/BroadcastModal";
import { apiRequest, resolveAssetUrl } from "../api/client";
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

const STAFF_ROLES = ["gym_owner", "personal_trainer", "nutritionist"];

function ContactAvatar({ contact }) {
  const avatarUrl = resolveAssetUrl(contact.avatar_url);
  if (avatarUrl) return <img src={avatarUrl} alt="" className="member-card-avatar" />;
  return (
    <span className="member-card-avatar member-card-avatar-fallback">
      {contact.name.charAt(0).toUpperCase()}
    </span>
  );
}

function formatTimestamp(value) {
  const date = new Date(value);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("pt-PT");
}

export default function MessagesPage() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [thread, setThread] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);

  const bottomRef = useRef(null);

  function loadContacts() {
    apiRequest("/messages/contacts")
      .then(setContacts)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingContacts(false));
  }

  useEffect(() => {
    loadContacts();
  }, []);

  function loadThread(id) {
    setLoadingThread(true);
    apiRequest(`/messages/${id}`)
      .then(setThread)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingThread(false));
  }

  function selectContact(id) {
    setSelectedId(id);
    loadThread(id);
  }

  // Reforça a conversa aberta de vez em quando, já que não há websockets —
  // suficiente para uma sensação de "quase em direto" sem complexidade extra.
  useEffect(() => {
    if (!selectedId) return;
    const interval = setInterval(() => {
      loadThread(selectedId);
      loadContacts();
    }, 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [thread]);

  async function handleSend(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    try {
      await apiRequest(`/messages/${selectedId}`, { method: "POST", body: { body: draft.trim() } });
      setDraft("");
      loadThread(selectedId);
      loadContacts();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  const selectedContact = contacts.find((c) => c.id === selectedId);
  const isStaff = STAFF_ROLES.includes(user.role);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Mensagens</h1>
        {isStaff && (
          <button type="button" className="glass-button" onClick={() => setShowBroadcast(true)}>
            Mensagem global
          </button>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="messages-layout">
        <GlassCard className="messages-contacts" strong>
          {loadingContacts && <p className="text-secondary" style={{ padding: 16 }}>A carregar...</p>}
          {!loadingContacts && contacts.length === 0 && (
            <p className="text-secondary" style={{ padding: 16 }}>Ainda não há ninguém para falares.</p>
          )}
          {contacts.map((contact) => (
            <button
              key={contact.id}
              type="button"
              className={`contact-row${selectedId === contact.id ? " selected" : ""}`}
              onClick={() => selectContact(contact.id)}
            >
              <ContactAvatar contact={contact} />
              <div className="contact-row-info">
                <span className="contact-row-name">
                  {contact.name}
                  {contact.role !== "member" && (
                    <span className="contact-row-role"> · {ROLE_LABELS[contact.role] || contact.role}</span>
                  )}
                </span>
                <span className="contact-row-preview">
                  {contact.last_message
                    ? `${contact.last_message_sender_id === user.id ? "Tu: " : ""}${contact.last_message}`
                    : ROLE_LABELS[contact.role] || contact.role}
                </span>
              </div>
              {contact.unread_count > 0 && <span className="contact-unread-badge">{contact.unread_count}</span>}
            </button>
          ))}
        </GlassCard>

        <GlassCard className="messages-thread" strong>
          {!selectedId && (
            <div className="messages-empty">
              <p className="text-secondary">Escolhe alguém à esquerda para começares a conversar.</p>
            </div>
          )}

          {selectedId && (
            <>
              <div className="messages-thread-header">
                <strong>{selectedContact?.name}</strong>
                {selectedContact && (
                  <span className="text-secondary"> · {ROLE_LABELS[selectedContact.role] || selectedContact.role}</span>
                )}
              </div>

              <div className="messages-list">
                {loadingThread && <p className="text-secondary">A carregar...</p>}
                {!loadingThread &&
                  thread.map((msg) => (
                    <div key={msg.id} className={`message-bubble${msg.sender_id === user.id ? " mine" : ""}`}>
                      <p>{msg.body}</p>
                      <span>{formatTimestamp(msg.created_at)}</span>
                    </div>
                  ))}
                <div ref={bottomRef} />
              </div>

              <form className="messages-compose" onSubmit={handleSend}>
                <input
                  type="text"
                  className="glass-input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Escreve uma mensagem..."
                />
                <button type="submit" className="glass-button" disabled={sending || !draft.trim()}>
                  Enviar
                </button>
              </form>
            </>
          )}
        </GlassCard>
      </div>

      {showBroadcast && (
        <BroadcastModal onClose={() => setShowBroadcast(false)} onSent={loadContacts} />
      )}
    </div>
  );
}
