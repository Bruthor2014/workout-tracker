import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import Modal from "../components/Modal";
import Select from "../components/Select";
import { IconCalendar, IconClipboard, IconPlusCircle, IconSave, IconTrash, IconUsers, IconWeightStack } from "../components/Icons";
import { apiRequest, resolveAssetUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  SESSION_COLOR,
  TIME_OPTIONS,
  WEEKDAYS,
  durationHours,
  sessionLabel,
  toMinutes,
} from "../utils/schedule";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const fmtDate = (key) => {
  if (!key) return null;
  const d = new Date(`${String(key).slice(0, 10)}T00:00:00`);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
const lowerFirst = (text) => text.charAt(0).toLowerCase() + text.slice(1);
const fmtHours = (h) => `${h.toLocaleString("pt-PT", { maximumFractionDigits: 1 })} h`;
const DAY_SHORT = Object.fromEntries(WEEKDAYS.map((d) => [d.value, d.short]));
const BUSY_COLOR = "#64748b"; // turnos e aulas: só para mostrar quando não estou livre

function Avatar({ person }) {
  const url = resolveAssetUrl(person.avatar_url);
  if (url) return <img src={url} alt="" className="member-card-avatar" />;
  return <span className="member-card-avatar member-card-avatar-fallback">{person.name.charAt(0).toUpperCase()}</span>;
}

// Marcar / editar uma sessão semanal com um cliente.
function SessionFormModal({ initial, clients, label, defaultClientId, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    member_id: String(initial?.member_id ?? defaultClientId ?? clients[0]?.id ?? ""),
    weekday: initial?.weekday ?? 1,
    start_time: initial?.start_time ?? "18:00",
    end_time: initial?.end_time ?? "19:00",
    notes: initial?.notes ?? "",
  }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  // Ao mudar o início, o fim acompanha (mantém a duração).
  function setStart(value) {
    const duration = toMinutes(form.end_time) - toMinutes(form.start_time);
    const end = toMinutes(value) + (duration > 0 ? duration : 60);
    const endValue = `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
    setForm((f) => ({ ...f, start_time: value, end_time: TIME_OPTIONS.some((t) => t.value === endValue) ? endValue : f.end_time }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const body = { ...form, member_id: Number(form.member_id), weekday: Number(form.weekday) };
      if (initial) await apiRequest(`/clients/sessions/${initial.id}`, { method: "PUT", body });
      else await apiRequest("/clients/sessions", { method: "POST", body });
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Desmarcar esta ${lowerFirst(label)}?`)) return;
    try {
      await apiRequest(`/clients/sessions/${initial.id}`, { method: "DELETE" });
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal onClose={onClose}>
      <GlassCard className="preview-card schedule-form" strong>
        <h3>{initial ? `Editar ${lowerFirst(label)}` : `Marcar ${lowerFirst(label)}`}</h3>
        <form onSubmit={handleSubmit}>
          <div className="schedule-form-grid">
            <div className="span-2">
              <span className="log-label">Cliente</span>
              <Select
                value={form.member_id}
                onChange={set("member_id")}
                options={clients.map((c) => ({ value: String(c.id), label: c.name }))}
                ariaLabel="Cliente"
              />
            </div>
            <div className="span-2">
              <span className="log-label">Dia da semana</span>
              <Select
                value={form.weekday}
                onChange={(v) => set("weekday")(Number(v))}
                options={WEEKDAYS.map((d) => ({ value: d.value, label: `Todas as ${d.long.toLowerCase()}s` }))}
                ariaLabel="Dia da semana"
              />
            </div>
            <div>
              <span className="log-label">Início</span>
              <Select value={form.start_time} onChange={setStart} options={TIME_OPTIONS} ariaLabel="Início" />
            </div>
            <div>
              <span className="log-label">Fim</span>
              <Select value={form.end_time} onChange={set("end_time")} options={TIME_OPTIONS} ariaLabel="Fim" />
            </div>
            <label className="span-2">
              <span className="log-label">Notas <span>(opcional)</span></span>
              <input className="glass-input" value={form.notes} onChange={(e) => set("notes")(e.target.value)} placeholder="Ex: foco em pernas" />
            </label>
          </div>
          <p className="text-secondary schedule-form-hint clients-form-hint">
            Não pode coincidir com os teus turnos (Sala, Receção…), as aulas que dás ou outras sessões.
          </p>
          {error && <p className="error-text">{error}</p>}
          <div className="schedule-form-actions">
            {initial && (
              <button type="button" className="nf-text-danger" onClick={handleDelete}>
                <IconTrash size={17} />
                Desmarcar
              </button>
            )}
            <button type="button" className="glass-button glass-button-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="glass-button log-save-button" disabled={saving || clients.length === 0}>
              <IconSave size={18} />
              {saving ? "A guardar..." : "Guardar"}
            </button>
          </div>
        </form>
      </GlassCard>
    </Modal>
  );
}

// Modal para adicionar um utilizador existente como cliente externo por email.
function AddClientModal({ onClose, onAdded }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await apiRequest("/clients/external", { method: "POST", body: { email } });
      onAdded();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <GlassCard className="preview-card schedule-form" strong>
        <h3>Adicionar cliente</h3>
        <p className="text-secondary" style={{ marginTop: 0 }}>
          A pessoa tem de ter uma conta na app. Introduz o email dela.
        </p>
        <form onSubmit={handleSubmit}>
          <div>
            <span className="log-label">Email</span>
            <input className="glass-input" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="cliente@email.com" required />
          </div>
          {error && <p className="error-text">{error}</p>}
          <div className="schedule-form-actions" style={{ marginTop: 16 }}>
            <button type="button" className="glass-button glass-button-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="glass-button log-save-button" disabled={saving}>
              {saving ? "A adicionar..." : "Adicionar"}
            </button>
          </div>
        </form>
      </GlassCard>
    </Modal>
  );
}

// Clientes (PT / nutricionista): os membros que lhe estão atribuídos e as
// sessões semanais com cada um, num horário que mostra também os turnos e as
// aulas — para se ver logo as horas livres.
export default function ClientsPage() {
  const { user } = useAuth();
  const isPT = user.role === "personal_trainer";
  const label = sessionLabel(user.role);
  const [clients, setClients] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // sessão, { new: clientId }, ou null
  const [addingClient, setAddingClient] = useState(false);

  const load = useCallback(() => {
    Promise.all([apiRequest("/clients"), apiRequest("/clients/sessions")])
      .then(([c, s]) => {
        setClients(c);
        setSessions(s);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sessionsOf = (clientId) => sessions.filter((s) => s.member_id === clientId);
  const sessionHours = sessions.reduce((sum, s) => sum + durationHours(s.start_time, s.end_time), 0);

  function afterSave() {
    setEditing(null);
    load();
  }

  async function removeClient(client) {
    if (!window.confirm(`Remover ${client.name} da tua lista de clientes?`)) return;
    try {
      await apiRequest(`/clients/external/${client.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="log-header">
          <span className="log-header-icon">
            <IconUsers size={22} />
          </span>
          <h1>Clientes</h1>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="glass-button glass-button-secondary"
            onClick={() => setAddingClient(true)}
            style={{ display: "inline-flex", gap: 8, alignItems: "center" }}
          >
            <IconPlusCircle size={18} />
            Adicionar cliente
          </button>
          <button
            type="button"
            className="glass-button"
            onClick={() => setEditing({ new: null })}
            disabled={clients.length === 0}
            style={{ display: "inline-flex", gap: 8, alignItems: "center" }}
          >
            <IconPlusCircle size={18} />
            Marcar {lowerFirst(label)}
          </button>
        </div>
      </div>

      <div className="profile-stats schedule-stats">
        <GlassCard className="stat-tile profile-stat" strong>
          <span className="stat-tile-label">Clientes</span>
          <span className="stat-tile-value">{clients.length}</span>
        </GlassCard>
        <GlassCard className="stat-tile profile-stat" strong>
          <span className="stat-tile-label">{isPT ? "Sessões por semana" : "Consultas por semana"}</span>
          <span className="stat-tile-value">{sessions.length}</span>
          <span className="stat-tile-sub">{fmtHours(sessionHours)}</span>
        </GlassCard>
        <GlassCard className="stat-tile profile-stat" strong>
          <span className="stat-tile-label">Sem {isPT ? "sessão" : "consulta"} marcada</span>
          <span className="stat-tile-value">{clients.filter((c) => sessionsOf(c.id).length === 0).length}</span>
        </GlassCard>
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p className="text-secondary">A carregar...</p>
      ) : clients.length === 0 ? (
        <GlassCard className="empty-state">
          <p>Ainda não tens clientes. Usa "Adicionar cliente" para ligar uma conta existente, ou pede à receção que atribua membros do ginásio.</p>
        </GlassCard>
      ) : (
        <div className="member-grid clients-grid">
          {clients.map((c) => {
            const mine = sessionsOf(c.id);
            return (
              <GlassCard key={c.id} className="member-tile client-tile">
                <Link to={`/members/${c.id}`} className="member-tile-header client-tile-head">
                  <Avatar person={c} />
                  <div className="member-tile-identity">
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="member-tile-name">{c.name}</span>
                      <span className={`role-badge role-badge-static client-source-badge client-source-${c.source}`}>
                        {c.source === "external" ? "Externo" : "Ginásio"}
                      </span>
                    </div>
                    <span className="member-tile-email">{c.started_at ? `Cliente desde ${fmtDate(c.started_at)}` : c.email}</span>
                  </div>
                </Link>
                <div className="client-sessions">
                  {mine.length ? (
                    mine.map((s) => (
                      <button type="button" key={s.id} className="client-session-chip" onClick={() => setEditing(s)}>
                        {DAY_SHORT[s.weekday]} {s.start_time}
                      </button>
                    ))
                  ) : (
                    <span className="text-secondary client-no-session">Sem {lowerFirst(label)} marcada</span>
                  )}
                  <button type="button" className="client-session-add" onClick={() => setEditing({ new: c.id })} aria-label={`Marcar ${lowerFirst(label)} com ${c.name}`}>
                    +
                  </button>
                </div>
                <div className="member-tile-stats">
                  <div className="member-tile-stat">
                    <IconWeightStack size={16} />
                    <span className="member-tile-stat-label">Peso</span>
                    <span className="member-tile-stat-value">{c.last_weight_kg ? `${Number(c.last_weight_kg)} kg` : "—"}</span>
                  </div>
                  <div className="member-tile-stat">
                    <IconCalendar size={16} />
                    <span className="member-tile-stat-label">Treinos (30 dias)</span>
                    <span className="member-tile-stat-value">{c.workouts_30d}</span>
                  </div>
                  <div className="member-tile-stat">
                    <IconClipboard size={16} />
                    <span className="member-tile-stat-label">{isPT ? "Planos de treino" : "Planos de nutrição"}</span>
                    <span className="member-tile-stat-value">{c.my_plans}</span>
                  </div>
                </div>
                {c.source === "external" && (
                  <button
                    type="button"
                    className="nf-text-danger"
                    style={{ marginTop: 8, fontSize: "0.82rem" }}
                    onClick={() => removeClient(c)}
                  >
                    <IconTrash size={14} /> Remover cliente
                  </button>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      {editing && (
        <SessionFormModal
          initial={editing.id ? editing : null}
          defaultClientId={editing.new}
          clients={clients}
          label={label}
          onClose={() => setEditing(null)}
          onSaved={afterSave}
        />
      )}
      {addingClient && (
        <AddClientModal
          onClose={() => setAddingClient(false)}
          onAdded={() => { setAddingClient(false); load(); }}
        />
      )}
    </div>
  );
}
