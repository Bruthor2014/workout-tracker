import { useRef, useState } from "react";
import GlassCard from "./GlassCard";
import Modal from "./Modal";
import { apiRequest } from "../api/client";

const AUDIENCE_OPTIONS = [
  { value: "all", label: "Todos os membros" },
  { value: "nutrition", label: "Membros com plano de nutrição" },
  { value: "personal_training", label: "Membros com personal trainer" },
  { value: "my_clients", label: "Só os meus clientes (PT/nutrição)" },
  { value: "inactive", label: "Inativos (+30 dias sem treinar)" },
];

// Modal de envio em massa. Duas formas de uso:
// - com `memberIds`: manda só a essa lista fixa (ex: os que ficaram
//   visíveis depois de filtrar "inativos" em /members).
// - sem `memberIds`: mostra um seletor de público (nutrição, PT, etc.) e
//   deixa o servidor calcular quem são os destinatários.
// Em qualquer dos casos, "{nome}" no texto é trocado pelo primeiro nome de
// cada destinatário (feito no backend, mensagem a mensagem).
export default function BroadcastModal({ onClose, onSent, memberIds }) {
  const [audience, setAudience] = useState("all");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const textareaRef = useRef(null);

  function insertNamePlaceholder() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart ?? body.length;
    const end = textarea.selectionEnd ?? body.length;
    const next = `${body.slice(0, start)}{nome}${body.slice(end)}`;
    setBody(next);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + "{nome}".length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setError("");
    setSending(true);
    try {
      const data = await apiRequest("/messages/broadcast", {
        method: "POST",
        body: memberIds ? { body, member_ids: memberIds } : { body, audience },
      });
      setResult(data.sent);
      onSent?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <GlassCard className="preview-card" strong>
        <h3>Mensagem para vários membros</h3>

        {result != null ? (
          <>
            <p className="text-secondary" style={{ marginTop: 14 }}>
              Mensagem enviada a {result} {result === 1 ? "membro" : "membros"}.
            </p>
            <div className="form-actions">
              <button type="button" className="glass-button" onClick={onClose}>
                Fechar
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            {memberIds ? (
              <p className="text-secondary" style={{ marginTop: 14 }}>
                Vai ser enviada a {memberIds.length} {memberIds.length === 1 ? "membro" : "membros"} (os que estão
                visíveis com o filtro atual).
              </p>
            ) : (
              <div style={{ marginTop: 14 }}>
                <label className="field-label" htmlFor="audience">
                  Público
                </label>
                <select
                  id="audience"
                  className="glass-input"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                >
                  {AUDIENCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <label className="field-label" htmlFor="broadcast-body" style={{ margin: 0 }}>
                  Mensagem
                </label>
                <button
                  type="button"
                  className="glass-button glass-button-secondary"
                  style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                  onClick={insertNamePlaceholder}
                >
                  + Inserir {"{nome}"}
                </button>
              </div>
              <textarea
                id="broadcast-body"
                ref={textareaRef}
                className="glass-input"
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder='Ex: Olá {nome}, notámos que já não treinas há algum tempo...'
                style={{ marginTop: 6 }}
                required
              />
              <span className="field-hint" style={{ textAlign: "left" }}>
                {"{nome}"} é substituído pelo primeiro nome de cada pessoa ao enviar.
              </span>
            </div>

            {error && <p className="error-text">{error}</p>}
            <div className="form-actions">
              <button type="button" className="glass-button glass-button-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="glass-button" disabled={sending}>
                {sending ? "A enviar..." : "Enviar"}
              </button>
            </div>
          </form>
        )}
      </GlassCard>
    </Modal>
  );
}
