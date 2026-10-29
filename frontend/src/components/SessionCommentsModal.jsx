import { useEffect, useState } from "react";
import Modal from "./Modal";
import GlassCard from "./GlassCard";
import { IconTrash } from "./Icons";
import { apiRequest, resolveAssetUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";

function CommentAvatar({ person }) {
  const url = resolveAssetUrl(person.avatar_url);
  if (url) return <img src={url} alt="" className="member-card-avatar session-comment-avatar" />;
  return (
    <span className="member-card-avatar member-card-avatar-fallback session-comment-avatar">
      {person.name.charAt(0).toUpperCase()}
    </span>
  );
}

// "há 2 min" / "há 3h" / "26 out" — compacto, para a linha de um comentário
// (mesma ideia de formatFeedDate em FriendsPage.jsx, mas com granularidade
// de minutos/horas já que um comentário é um evento muito mais recente).
function formatCommentTime(value) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days}d`;
  const d = new Date(value);
  return d.toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
}

// Comentários de um treino (ver session_comments em sessionController.js)
// — lista + formulário para acrescentar, abre a partir do botão "Comentar"
// no feed (FeedItem em FriendsPage.jsx). `onCountChange(n)` mantém o
// contador no cartão sincronizado sem o próprio cartão ter de voltar a
// pedir o feed inteiro.
export default function SessionCommentsModal({ sessionId, onClose, onCountChange }) {
  const { user } = useAuth();
  const [comments, setComments] = useState(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest(`/sessions/${sessionId}/comments`)
      .then((rows) => {
        setComments(rows);
        onCountChange?.(rows.length);
      })
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    setError("");
    try {
      const created = await apiRequest(`/sessions/${sessionId}/comments`, {
        method: "POST",
        body: { body: draft.trim() },
      });
      setComments((prev) => {
        const next = [...(prev || []), created];
        onCountChange?.(next.length);
        return next;
      });
      setDraft("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(commentId) {
    try {
      await apiRequest(`/sessions/${sessionId}/comments/${commentId}`, { method: "DELETE" });
      setComments((prev) => {
        const next = prev.filter((c) => c.id !== commentId);
        onCountChange?.(next.length);
        return next;
      });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal onClose={onClose}>
      <GlassCard strong className="session-comments-modal">
        <h3>Comentários</h3>
        {error && <p className="error-text">{error}</p>}
        {comments === null && <p className="text-secondary">A carregar...</p>}
        {comments?.length === 0 && <p className="text-secondary">Ainda não há comentários.</p>}

        {comments?.length > 0 && (
          <div className="session-comments-list">
            {comments.map((c) => (
              <div key={c.id} className="session-comment-row">
                <CommentAvatar person={c.user} />
                <div className="session-comment-body">
                  <span className="session-comment-name">
                    {c.user.name} <span className="text-secondary">· {formatCommentTime(c.created_at)}</span>
                  </span>
                  <p>{c.body}</p>
                </div>
                {c.user.id === user.id && (
                  <button
                    type="button"
                    className="session-comment-delete"
                    onClick={() => handleDelete(c.id)}
                    aria-label="Eliminar comentário"
                  >
                    <IconTrash size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <form className="session-comments-form" onSubmit={handleSubmit}>
          <input
            type="text"
            className="glass-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Escreve um comentário..."
            autoFocus
          />
          <button type="submit" className="glass-button" disabled={sending || !draft.trim()}>
            Enviar
          </button>
        </form>
      </GlassCard>
    </Modal>
  );
}
