import { useCallback, useEffect, useState } from "react";
import GlassCard from "../components/GlassCard";
import Modal from "../components/Modal";
import Select from "../components/Select";
import WeekTimetable from "../components/WeekTimetable";
import { IconCalendar, IconPlusCircle, IconSave, IconTrash, IconUsers } from "../components/Icons";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { INSTRUCTOR_ROLES, ROLE_LABELS } from "../utils/roles";
import { CLASS_KINDS, TIME_OPTIONS, WEEKDAYS, classKind, durationHours, weekdayName } from "../utils/schedule";

const TODAY_SV = new Date().toLocaleDateString("sv");
const TODAY_ISODOW = (() => { const d = new Date().getDay(); return d === 0 ? 7 : d; })();

const emptyForm = () => ({
  title: "",
  kind: "class",
  weekday: 1,
  start_time: "18:00",
  end_time: "19:00",
  room: "",
  capacity: "",
  instructor_id: "",
  audience: "members",
  description: "",
  min_participants: 3,
  cancel_notice_minutes: 30,
});

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DAY_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
// "2026-10-10" -> "sábado, 10 out"
function formatClassDate(dateKey) {
  const d = new Date(`${dateKey}T00:00:00`);
  return `${DAY_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// Hora limite de inscrição (início - antecedência), ex: "18:30".
function deadline(gymClass) {
  const [h, m] = gymClass.start_time.split(":").map(Number);
  const total = h * 60 + m - gymClass.cancel_notice_minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const CANCEL_REASONS = {
  not_enough: "por falta de participantes",
  no_instructor: "por não haver PT disponível",
  manual: "pela receção",
};

// Quem se pode inscrever (os PTs e nutricionistas só nas aulas que não dão).
const ENROLL_ROLES = ["member", "personal_trainer", "nutritionist"];
const ROLE_SHORT = { personal_trainer: "PT", nutritionist: "Nutricionista", intern: "Estagiário" };

function instructorLabel(c) {
  if (!c.instructor_id) return "Sem responsável";
  return `${c.instructor_name} · ${ROLE_LABELS[c.instructor_role] || c.instructor_role}`;
}

// Janela de criar/editar uma aula (só o CEO).
function ClassFormModal({ initial, instructors, onClose, onSaved }) {
  const [form, setForm] = useState(() =>
    initial
      ? {
          ...emptyForm(),
          ...initial,
          room: initial.room || "",
          capacity: initial.capacity || "",
          instructor_id: initial.instructor_id ? String(initial.instructor_id) : "",
          description: initial.description || "",
        }
      : emptyForm()
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const body = { ...form, instructor_id: form.instructor_id ? Number(form.instructor_id) : null };
      if (initial) await apiRequest(`/classes/${initial.id}`, { method: "PUT", body });
      else await apiRequest("/classes", { method: "POST", body });
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Remover "${initial.title}" do horário?`)) return;
    try {
      await apiRequest(`/classes/${initial.id}`, { method: "DELETE" });
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal onClose={onClose}>
      <GlassCard className="preview-card schedule-form" strong>
        <h3>{initial ? "Editar aula" : "Nova aula de grupo"}</h3>
        <form onSubmit={handleSubmit}>
          <div className="schedule-form-grid">
            <label className="span-2">
              <span className="log-label">Nome</span>
              <input
                className="glass-input"
                value={form.title}
                onChange={(e) => set("title")(e.target.value)}
                placeholder="Ex: Cycling, Pilates, Palestra de nutrição"
                required
              />
            </label>
            <div>
              <span className="log-label">Tipo</span>
              <Select value={form.kind} onChange={set("kind")} options={CLASS_KINDS} ariaLabel="Tipo" />
            </div>
            <div>
              <span className="log-label">Dia da semana</span>
              <Select
                value={form.weekday}
                onChange={(v) => set("weekday")(Number(v))}
                options={WEEKDAYS.map((d) => ({ value: d.value, label: d.long }))}
                ariaLabel="Dia da semana"
              />
            </div>
            <div>
              <span className="log-label">Início</span>
              <Select value={form.start_time} onChange={set("start_time")} options={TIME_OPTIONS} ariaLabel="Início" />
            </div>
            <div>
              <span className="log-label">Fim</span>
              <Select value={form.end_time} onChange={set("end_time")} options={TIME_OPTIONS} ariaLabel="Fim" />
            </div>
            <label>
              <span className="log-label">Sala</span>
              <input className="glass-input" value={form.room} onChange={(e) => set("room")(e.target.value)} placeholder="Ex: Estúdio 1" />
            </label>
            <label>
              <span className="log-label">Lotação</span>
              <input
                className="glass-input"
                type="number"
                min="1"
                value={form.capacity}
                onChange={(e) => set("capacity")(e.target.value)}
                placeholder="Sem limite"
              />
            </label>
            <label>
              <span className="log-label">Mínimo de inscritos</span>
              <input
                className="glass-input"
                type="number"
                min="0"
                value={form.min_participants}
                onChange={(e) => set("min_participants")(e.target.value)}
              />
            </label>
            <label>
              <span className="log-label">Decidir com (minutos de antecedência)</span>
              <input
                className="glass-input"
                type="number"
                min="0"
                max="1440"
                step="5"
                value={form.cancel_notice_minutes}
                onChange={(e) => set("cancel_notice_minutes")(e.target.value)}
              />
            </label>
            <p className="span-2 text-secondary schedule-form-hint">
              Se, {form.cancel_notice_minutes || 0} minutos antes do início, não houver {form.min_participants || 0} inscritos
              (ou não houver responsável), a aula é cancelada e os inscritos recebem uma mensagem automática.
            </p>
            <div className="span-2">
              <span className="log-label">Responsável</span>
              <Select
                value={form.instructor_id}
                onChange={set("instructor_id")}
                options={[
                  { value: "", label: "Sem responsável (vaga — a equipa pode propor-se)" },
                  ...instructors.map((s) => ({
                    value: String(s.id),
                    label: `${s.name} · ${ROLE_LABELS[s.role] || s.role}`,
                  })),
                ]}
                ariaLabel="Responsável"
              />
            </div>
            <div className="span-2">
              <span className="log-label">Público</span>
              <Select
                value={form.audience}
                onChange={set("audience")}
                options={[
                  { value: "members", label: "Membros do ginásio", description: "Aparece no horário de aulas." },
                  {
                    value: "everyone",
                    label: "Todo o ginásio (membros e equipa)",
                    description: "Ex: palestras — ao criar, toda a gente recebe uma mensagem com o aviso.",
                  },
                ]}
                ariaLabel="Público"
              />
            </div>
            <label className="span-2">
              <span className="log-label">Descrição <span>(opcional)</span></span>
              <textarea
                className="glass-input nutrition-description"
                rows={2}
                value={form.description}
                onChange={(e) => set("description")(e.target.value)}
                placeholder="Ex: nível, o que trazer, objetivo da aula"
              />
            </label>
          </div>
          {error && <p className="error-text">{error}</p>}
          <div className="schedule-form-actions">
            {initial && (
              <button type="button" className="nf-text-danger" onClick={handleDelete}>
                <IconTrash size={17} />
                Remover aula
              </button>
            )}
            <button type="button" className="glass-button glass-button-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="glass-button log-save-button" disabled={saving}>
              <IconSave size={18} />
              {saving ? "A guardar..." : "Guardar"}
            </button>
          </div>
        </form>
      </GlassCard>
    </Modal>
  );
}

// Painel de confirmação da ocorrência de hoje (PT + receção).
function OccurrenceConfirm({ gymClass, date, user, onChanged }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isInstructor = gymClass.instructor_id === user.id;
  const isReception  = ["receptionist", "reception_station"].includes(user.role) || user.role === "gym_owner";
  const myConfirmed  = isInstructor ? gymClass.instructor_confirmed : gymClass.reception_confirmed;
  const canConfirm   = (isInstructor || isReception) && !myConfirmed;
  const canUnconfirm = isReception && gymClass.reception_confirmed;

  async function confirm() {
    setSaving(true); setError("");
    try {
      await apiRequest(`/classes/${gymClass.id}/occurrence`, { method: "POST", body: { class_date: date } });
      onChanged();
    } catch (err) { setError(err.message); setSaving(false); }
  }

  async function unconfirm() {
    setSaving(true); setError("");
    try {
      await apiRequest(`/classes/${gymClass.id}/occurrence`, { method: "DELETE", body: { class_date: date } });
      onChanged();
    } catch (err) { setError(err.message); setSaving(false); }
  }

  async function cancelOccurrence() {
    if (!window.confirm("Cancelar esta aula? Os inscritos serão avisados por mensagem.")) return;
    setSaving(true); setError("");
    try {
      await apiRequest(`/classes/${gymClass.id}/cancel-occurrence`, { method: "POST", body: { class_date: date } });
      onChanged();
    } catch (err) { setError(err.message); setSaving(false); }
  }

  return (
    <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 10,
      background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.25)" }}>
      <p className="log-label" style={{ marginBottom: 8 }}>Confirmação de hoje</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem" }}>
          <span style={{ color: gymClass.instructor_confirmed ? "#4ade80" : "var(--text-secondary)" }}>
            {gymClass.instructor_confirmed ? "✓" : "○"}
          </span>
          PT confirmou
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem" }}>
          <span style={{ color: gymClass.reception_confirmed ? "#4ade80" : "var(--text-secondary)" }}>
            {gymClass.reception_confirmed ? "✓" : "○"}
          </span>
          Receção confirmou
        </div>
      </div>
      {gymClass.instructor_confirmed && gymClass.reception_confirmed && (
        <p style={{ fontSize: "0.82rem", color: "#4ade80", margin: "0 0 8px" }}>✓ Aula confirmada — conta para o salário</p>
      )}
      {error && <p className="error-text" style={{ fontSize: "0.8rem" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {isReception && (
          <button type="button" className="nf-text-danger" style={{ fontSize: "0.8rem" }}
            disabled={saving} onClick={cancelOccurrence}>
            Cancelar aula
          </button>
        )}
        {canUnconfirm && (
          <button type="button" className="glass-button glass-button-secondary"
            style={{ fontSize: "0.82rem", padding: "4px 12px" }} disabled={saving} onClick={unconfirm}>
            Retirar confirmação
          </button>
        )}
        {canConfirm && (
          <button type="button" className="glass-button"
            style={{ fontSize: "0.82rem", padding: "4px 12px" }} disabled={saving} onClick={confirm}>
            {saving ? "A confirmar..." : isInstructor ? "Confirmar que dei a aula" : "Confirmar da receção"}
          </button>
        )}
      </div>
    </div>
  );
}

// Detalhe de uma aula (equipa e membros), com as ações possíveis:
// responsável -> pedir/cancelar substituição; outro PT/nutricionista ->
// ficar com uma aula vaga ou com substituição pedida.
function ClassDetailModal({ gymClass, user, onClose, onChanged, onEdit }) {
  const [reason, setReason] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [enrolled, setEnrolled] = useState(null);
  const canSeeEnrolled = user.role === "gym_owner" || gymClass.instructor_id === user.id;
  const full = gymClass.capacity && gymClass.enrolled_count >= gymClass.capacity;

  useEffect(() => {
    if (!canSeeEnrolled) return;
    apiRequest(`/classes/${gymClass.id}/enrollments`)
      .then((r) => setEnrolled(r.members))
      .catch(() => {});
  }, [canSeeEnrolled, gymClass.id, gymClass.enrolled_count]);
  const kind = classKind(gymClass.kind);
  const isMine = gymClass.instructor_id === user.id;
  const canEnroll = ENROLL_ROLES.includes(user.role) && !isMine;
  const canInstruct = INSTRUCTOR_ROLES.includes(user.role);
  const canClaim = canInstruct && (!gymClass.instructor_id || (gymClass.substitute_requested && !isMine));

  async function act(path, method, body) {
    setError("");
    try {
      await apiRequest(path, { method, body });
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal onClose={onClose}>
      <GlassCard className="preview-card class-detail" strong style={{ "--item-color": kind.color }}>
        <span className="class-detail-kind">{kind.label}</span>
        <h3>{gymClass.title}</h3>
        <ul className="class-detail-facts">
          <li>
            <IconCalendar size={16} />
            {weekdayName(gymClass.weekday)}, {gymClass.start_time}–{gymClass.end_time} (
            {durationHours(gymClass.start_time, gymClass.end_time).toLocaleString("pt-PT")} h)
          </li>
          {gymClass.room && <li>📍 {gymClass.room}</li>}
          <li>
            <IconUsers size={16} />
            {instructorLabel(gymClass)}
          </li>
          {gymClass.capacity && <li>Lotação: {gymClass.capacity} pessoas</li>}
          {gymClass.audience === "everyone" && <li>📣 Para todo o ginásio</li>}
        </ul>
        {gymClass.description && <p className="text-secondary">{gymClass.description}</p>}

        <div className="class-occurrence">
          <div>
            <span className="text-secondary">Próxima aula</span>
            <strong>{formatClassDate(gymClass.next_date)}</strong>
          </div>
          <div>
            <span className="text-secondary">Inscritos</span>
            <strong>
              {gymClass.enrolled_count}
              {gymClass.capacity ? ` / ${gymClass.capacity}` : ""}
            </strong>
          </div>
          <div>
            <span className="text-secondary">Mínimo</span>
            <strong>{gymClass.min_participants}</strong>
          </div>
        </div>

        {gymClass.cancelled_reason ? (
          <p className="class-detail-alert cancelled">
            Esta aula foi cancelada {CANCEL_REASONS[gymClass.cancelled_reason]}. Os inscritos foram avisados por mensagem.
          </p>
        ) : (
          <p className="text-secondary class-deadline">
            {gymClass.enrollment_open
              ? `Inscrições até às ${deadline(gymClass)}. Se até lá não houver ${gymClass.min_participants} inscritos, a aula é cancelada e os inscritos são avisados.`
              : "As inscrições para esta aula já fecharam."}
          </p>
        )}

        {/* Confirmation panel for today's occurrence */}
        {gymClass.next_date === TODAY_SV && !gymClass.cancelled_reason && (gymClass.instructor_id === user.id || user.role === "gym_owner" || ["receptionist", "reception_station"].includes(user.role)) && (
          <OccurrenceConfirm gymClass={gymClass} date={TODAY_SV} user={user} onChanged={onChanged} />
        )}

        {canEnroll && !gymClass.cancelled_reason && (
          gymClass.is_enrolled ? (
            <button type="button" className="glass-button glass-button-secondary" onClick={() => act(`/classes/${gymClass.id}/enroll`, "DELETE")}>
              ✓ Inscrito — cancelar inscrição
            </button>
          ) : (
            <button
              type="button"
              className="glass-button log-save-button"
              onClick={() => act(`/classes/${gymClass.id}/enroll`, "POST")}
              disabled={!gymClass.enrollment_open || full}
            >
              {full ? "Aula cheia" : "Inscrever-me"}
            </button>
          )
        )}

        {canSeeEnrolled && enrolled && (
          <div className="class-enrolled">
            <span className="log-label">Inscritos na próxima aula</span>
            {enrolled.length ? (
              <ul>
                {enrolled.map((m) => (
                  <li key={m.id}>{m.name}</li>
                ))}
              </ul>
            ) : (
              <p className="text-secondary">Ainda ninguém se inscreveu.</p>
            )}
          </div>
        )}

        {gymClass.substitute_requested && (
          <p className="class-detail-alert">
            Substituição pedida{gymClass.substitute_reason ? `: “${gymClass.substitute_reason}”` : "."}
          </p>
        )}

        {isMine && !gymClass.substitute_requested && (
          asking ? (
            <div className="class-detail-ask">
              <input
                className="glass-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motivo (opcional) — ex: consulta médica"
                autoFocus
              />
              <button type="button" className="glass-button" onClick={() => act(`/classes/${gymClass.id}/substitute`, "POST", { reason })}>
                Enviar pedido
              </button>
            </div>
          ) : (
            <button type="button" className="glass-button glass-button-secondary" onClick={() => setAsking(true)}>
              Não consigo dar esta aula — pedir substituição
            </button>
          )
        )}
        {isMine && gymClass.substitute_requested && (
          <button type="button" className="glass-button glass-button-secondary" onClick={() => act(`/classes/${gymClass.id}/substitute`, "DELETE")}>
            Afinal consigo — cancelar pedido
          </button>
        )}
        {canClaim && (
          <button type="button" className="glass-button log-save-button" onClick={() => act(`/classes/${gymClass.id}/claim`, "POST")}>
            Ficar com esta aula
          </button>
        )}

        {error && <p className="error-text">{error}</p>}
        <div className="schedule-form-actions">
          {onEdit && (
            <button type="button" className="glass-button glass-button-secondary" onClick={onEdit}>
              Editar aula
            </button>
          )}
          <button type="button" className="glass-button glass-button-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </GlassCard>
    </Modal>
  );
}

// Aulas de grupo: horário semanal do ginásio. O CEO cria, edita e remove;
// a equipa vê, pede substituição e fica com aulas vagas; os membros veem.
export default function GroupClassesPage() {
  const { user } = useAuth();
  const isOwner = user.role === "gym_owner";
  const [classes, setClasses] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // aula a editar, "new", ou null
  const [viewing, setViewing] = useState(null);

  const isReception = ["receptionist", "reception_station"].includes(user.role);

  const load = useCallback(() => {
    apiRequest("/classes")
      .then(setClasses)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    if (isOwner) {
      apiRequest("/shifts/staff")
        .then((rows) => setInstructors(rows.filter((s) => INSTRUCTOR_ROLES.includes(s.role))))
        .catch(() => {});
    }
    // Trigger auto-cancel check for receptionist/owner
    if (isOwner || isReception) {
      apiRequest("/classes/auto-cancel", { method: "POST" }).catch(() => {});
    }
  }, [load, isOwner, isReception]);

  const items = classes.map((c) => {
    const kind = classKind(c.kind);
    return {
      ...c,
      title: c.title,
      subtitle: c.instructor_id
        ? `${ROLE_SHORT[c.instructor_role] ? `${ROLE_SHORT[c.instructor_role]} · ` : ""}${c.instructor_name}`
        : "Sem PT atribuído",
      subtitleClass: "who",
      color: kind.color,
      status: c.cancelled_reason ? "cancelled" : !c.instructor_id ? "vacant" : c.substitute_requested ? "warning" : null,
      badge: c.cancelled_reason
        ? "Cancelada"
        : c.is_enrolled
        ? "✓ Inscrito"
        : !c.instructor_id
        ? "Vaga"
        : c.substitute_requested
        ? "Precisa de substituto"
        : `${c.enrolled_count}${c.capacity ? `/${c.capacity}` : ""} inscritos`,
    };
  });

  const openSlots = classes.filter((c) => !c.instructor_id || c.substitute_requested);
  const canInstruct = INSTRUCTOR_ROLES.includes(user.role);

  function afterChange() {
    setEditing(null);
    setViewing(null);
    load();
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="log-header">
          <span className="log-header-icon">
            <IconUsers size={22} />
          </span>
          <h1>Aulas de grupo</h1>
        </div>
        {isOwner && (
          <button type="button" className="glass-button" onClick={() => setEditing("new")} style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            <IconPlusCircle size={18} />
            Nova aula
          </button>
        )}
      </div>

      <div className="schedule-legend">
        {CLASS_KINDS.map((k) => (
          <span key={k.value} style={{ "--item-color": k.color }}>
            {k.label}
          </span>
        ))}
        <span className="vacant">Vaga</span>
        <span className="warning">Precisa de substituto</span>
        <span className="cancelled">Cancelada</span>
      </div>

      {(isOwner || canInstruct) && openSlots.length > 0 && (
        <GlassCard className="schedule-alert" strong>
          <strong>
            {openSlots.length} {openSlots.length === 1 ? "aula precisa" : "aulas precisam"} de responsável
          </strong>
          <span className="text-secondary">
            {isOwner ? "Atribui alguém ou espera que a equipa se proponha." : "Clica numa aula marcada para ficares com ela."}
          </span>
        </GlassCard>
      )}

      {/* Today's classes — confirmation quick-panel for staff */}
      {!loading && (() => {
        const todayClasses = classes.filter(
          (c) => c.weekday === TODAY_ISODOW && !c.cancelled_reason && c.instructor_id &&
            (isOwner || isReception || c.instructor_id === user.id)
        );
        if (!todayClasses.length) return null;
        return (
          <GlassCard strong style={{ marginBottom: 16 }}>
            <p className="log-label" style={{ marginBottom: 12 }}>Aulas de hoje</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {todayClasses.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 12px", borderRadius: 10,
                  background: "rgba(255,255,255,0.04)", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{c.title}</span>
                    <span className="text-secondary" style={{ fontSize: "0.8rem", marginLeft: 8 }}>
                      {c.start_time}–{c.end_time} · {c.instructor_name?.split(" ")[0]}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: "0.8rem", color: c.instructor_confirmed ? "#4ade80" : "var(--text-secondary)" }}>
                      {c.instructor_confirmed ? "PT✓" : "PT○"}
                    </span>
                    <span style={{ fontSize: "0.8rem", color: c.reception_confirmed ? "#4ade80" : "var(--text-secondary)" }}>
                      {c.reception_confirmed ? "Rec✓" : "Rec○"}
                    </span>
                    {!(c.instructor_id === user.id ? c.instructor_confirmed : (isOwner || isReception) && c.reception_confirmed) && (
                      <button type="button" className="glass-button" style={{ fontSize: "0.78rem", padding: "3px 10px" }}
                        onClick={() => setViewing(c)}>
                        Confirmar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        );
      })()}

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p className="text-secondary">A carregar...</p>
      ) : (
        <GlassCard className="schedule-card" strong>
          <WeekTimetable
            items={items}
            onItemClick={(item) => setViewing(item)}
            emptyText={isOwner ? "Ainda não há aulas — cria a primeira com “Nova aula”." : "O ginásio ainda não tem aulas de grupo."}
          />
        </GlassCard>
      )}

      {editing && (
        <ClassFormModal
          initial={editing === "new" ? null : classes.find((c) => c.id === editing.id)}
          instructors={instructors}
          onClose={() => setEditing(null)}
          onSaved={afterChange}
        />
      )}
      {viewing && (
        <ClassDetailModal
          gymClass={classes.find((c) => c.id === viewing.id)}
          user={user}
          onClose={() => setViewing(null)}
          onChanged={load}
          onEdit={
            isOwner
              ? () => {
                  setEditing(viewing);
                  setViewing(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
