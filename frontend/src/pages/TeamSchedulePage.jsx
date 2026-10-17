import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import GlassCard from "../components/GlassCard";
import Modal from "../components/Modal";
import Select from "../components/Select";
import WeekTimetable from "../components/WeekTimetable";
import GenerateScheduleModal from "../components/GenerateScheduleModal";
import { IconCalendar, IconPlusCircle, IconSave, IconTrash } from "../components/Icons";
import { apiRequest } from "../api/client";
import { ROLE_LABELS } from "../utils/roles";
import { SESSION_COLOR, SHIFT_ACTIVITIES, TIME_OPTIONS, WEEKDAYS, durationHours, sessionLabel, shiftActivity, weekdayName } from "../utils/schedule";

const SHORT_ACTIVITY = {
  floor: "Sala",
  class: "Estúdio",
  reception: "Receção",
  assessments: "Avaliações",
  admin: "Admin.",
  other: "Outro",
};
// Ordem das colunas quando há turnos ao mesmo tempo: sala, depois receção...
const ACTIVITY_ORDER = Object.fromEntries(SHIFT_ACTIVITIES.map((a, i) => [a.value, i]));

// Equipa toda: faixas fixas iguais em todos os dias — 2 de Sala, 1 de
// Receção e uma por cada outra atividade que exista — para as colunas
// ficarem alinhadas na semana. Preenche `item.lane` e devolve as etiquetas.
function assignLanes(items) {
  const MIN_LANES = { floor: 2, reception: 1 };
  const labels = [];
  let offset = 0;
  for (const { value } of [...SHIFT_ACTIVITIES, { value: "session" }]) {
    const group = items.filter((i) => i.activity === value);
    let count = MIN_LANES[value] || 0;
    for (const day of WEEKDAYS) {
      const ends = [];
      group
        .filter((i) => Number(i.weekday) === day.value)
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
        .forEach((item) => {
          let lane = ends.findIndex((end) => end <= item.start_time);
          if (lane === -1) lane = ends.length;
          ends[lane] = item.end_time;
          item.lane = offset + lane;
        });
      count = Math.max(count, ends.length);
    }
    for (let n = 0; n < count; n++) labels.push(value === "reception" ? "Rec." : value === "session" ? "Cli." : SHORT_ACTIVITY[value]);
    offset += count;
  }
  return labels;
}

const fmtHours = (h) => `${h.toLocaleString("pt-PT", { maximumFractionDigits: 1 })} h`;

// Modal de leitura de uma sessão com cliente (CEO vê, PT é quem edita).
function SessionDetailModal({ session, onClose }) {
  return (
    <Modal onClose={onClose}>
      <GlassCard className="preview-card schedule-form" strong>
        <h3>{sessionLabel(session.staff_role)}</h3>
        <div className="session-detail-grid">
          <div>
            <span className="log-label">PT / Nutricionista</span>
            <span className="session-detail-value">{session.staff_name}</span>
          </div>
          <div>
            <span className="log-label">Cliente</span>
            <span className="session-detail-value">{session.member_name}</span>
          </div>
          <div>
            <span className="log-label">Dia</span>
            <span className="session-detail-value">{weekdayName(session.weekday)}</span>
          </div>
          <div>
            <span className="log-label">Horário</span>
            <span className="session-detail-value">{session.start_time}–{session.end_time}</span>
          </div>
          {session.notes && (
            <div className="span-2">
              <span className="log-label">Notas</span>
              <span className="session-detail-value">{session.notes}</span>
            </div>
          )}
        </div>
        <div className="schedule-form-actions">
          <button type="button" className="glass-button" onClick={onClose}>
            Fechar
          </button>
        </div>
      </GlassCard>
    </Modal>
  );
}

// Janela de criar/editar um turno.
function ShiftFormModal({ initial, staff, defaultStaffId, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    staff_id: String(initial?.staff_id ?? defaultStaffId ?? staff[0]?.id ?? ""),
    weekday: initial?.weekday ?? 1,
    start_time: initial?.start_time ?? "09:00",
    end_time: initial?.end_time ?? "13:00",
    activity: initial?.activity ?? "floor",
    location: initial?.location ?? "",
    notes: initial?.notes ?? "",
  }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const body = { ...form, staff_id: Number(form.staff_id), weekday: Number(form.weekday) };
      if (initial) await apiRequest(`/shifts/${initial.id}`, { method: "PUT", body });
      else await apiRequest("/shifts", { method: "POST", body });
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Remover este turno?")) return;
    try {
      await apiRequest(`/shifts/${initial.id}`, { method: "DELETE" });
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal onClose={onClose}>
      <GlassCard className="preview-card schedule-form" strong>
        <h3>{initial ? "Editar turno" : "Novo turno"}</h3>
        <form onSubmit={handleSubmit}>
          <div className="schedule-form-grid">
            <div className="span-2">
              <span className="log-label">Pessoa</span>
              <Select
                value={form.staff_id}
                onChange={set("staff_id")}
                options={staff.map((s) => ({ value: String(s.id), label: `${s.name} · ${ROLE_LABELS[s.role] || s.role}` }))}
                ariaLabel="Pessoa"
              />
            </div>
            <div className="span-2">
              <span className="log-label">Atividade</span>
              <Select value={form.activity} onChange={set("activity")} options={SHIFT_ACTIVITIES} ariaLabel="Atividade" />
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
            <label>
              <span className="log-label">Local</span>
              <input className="glass-input" value={form.location} onChange={(e) => set("location")(e.target.value)} placeholder="Ex: Sala principal" />
            </label>
            <div>
              <span className="log-label">Início</span>
              <Select value={form.start_time} onChange={set("start_time")} options={TIME_OPTIONS} ariaLabel="Início" />
            </div>
            <div>
              <span className="log-label">Fim</span>
              <Select value={form.end_time} onChange={set("end_time")} options={TIME_OPTIONS} ariaLabel="Fim" />
            </div>
            <label className="span-2">
              <span className="log-label">Notas <span>(opcional)</span></span>
              <input className="glass-input" value={form.notes} onChange={(e) => set("notes")(e.target.value)} placeholder="Ex: abrir o ginásio às 7h" />
            </label>
          </div>
          {error && <p className="error-text">{error}</p>}
          <div className="schedule-form-actions">
            {initial && (
              <button type="button" className="nf-text-danger" onClick={handleDelete}>
                <IconTrash size={17} />
                Remover turno
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

// Horários da equipa (CEO): escolher uma pessoa (ou toda a equipa), ver o
// horário semanal — turnos + aulas de grupo de que é responsável — e criar,
// editar ou remover turnos.
export default function TeamSchedulePage() {
  const { user } = useAuth();
  // A receção só vê o horário — criar/editar/remover turnos e gerar
  // horário automático é só do CEO.
  const canEdit = user?.role === "gym_owner";
  const [staff, setStaff] = useState([]);
  const [selected, setSelected] = useState("");
  const [shifts, setShifts] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [editing, setEditing] = useState(null);
  const [viewingSession, setViewingSession] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    Promise.all([apiRequest("/shifts"), apiRequest("/classes"), apiRequest("/clients/sessions")])
      .then(([shiftRows, classRows, sessionRows]) => {
        setShifts(shiftRows);
        setClasses(classRows);
        setSessions(sessionRows);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    apiRequest("/shifts/staff").then(setStaff).catch((err) => setError(err.message));
    load();
  }, [load]);

  const person = staff.find((s) => String(s.id) === selected);
  const visibleShifts = selected ? shifts.filter((s) => String(s.staff_id) === selected) : shifts;

  // Só turnos (as aulas de grupo estão no horário das aulas).
  const items = visibleShifts.map((s) => {
    const activity = shiftActivity(s.activity);
    return {
      ...s,
      id: `shift-${s.id}`,
      shiftId: s.id,
      title: selected ? activity.label : s.staff_name.split(" ")[0],
      subtitle: selected ? s.location || s.notes : SHORT_ACTIVITY[s.activity],
      color: activity.color,
      order: ACTIVITY_ORDER[s.activity] ?? 9,
    };
  });
  // Sessões com clientes: só para ver (são os PTs que as marcam).
  const visibleSessions = selected ? sessions.filter((s) => String(s.staff_id) === selected) : sessions;
  items.push(
    ...visibleSessions.map((s) => ({
      ...s,
      id: `session-${s.id}`,
      sessionId: s.id,
      activity: "session",
      title: selected ? sessionLabel(s.staff_role) : s.staff_name.split(" ")[0],
      subtitle: selected ? s.member_name : "Cliente",
      color: SESSION_COLOR,
      order: 99,
    }))
  );
  const lanes = selected ? null : assignLanes(items);

  // Horas semanais por pessoa (turnos + aulas).
  const hoursFor = (id) =>
    shifts.filter((s) => s.staff_id === id).reduce((sum, s) => sum + durationHours(s.start_time, s.end_time), 0) +
    classes.filter((c) => c.instructor_id === id).reduce((sum, c) => sum + durationHours(c.start_time, c.end_time), 0) +
    sessions.filter((s) => s.staff_id === id).reduce((sum, s) => sum + durationHours(s.start_time, s.end_time), 0);

  function afterChange() {
    setEditing(null);
    load();
  }

  async function clearSchedule() {
    const name = person ? person.name : "toda a equipa";
    if (!window.confirm(`Tens a certeza que queres apagar todos os turnos de ${name}? Esta ação não pode ser desfeita.`)) return;
    try {
      const qs = selected ? `?staff_id=${selected}` : "";
      await apiRequest(`/shifts${qs}`, { method: "DELETE" });
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
            <IconCalendar size={22} />
          </span>
          <h1>Horários da equipa</h1>
        </div>
        {canEdit && (
          <div className="page-header-actions">
            <button type="button" className="glass-button" onClick={() => setGenerating(true)} disabled={staff.length === 0}>
              ⚡ Gerar horário automático
            </button>
            <button
              type="button"
              className="glass-button glass-button-secondary"
              onClick={() => setEditing("new")}
              disabled={staff.length === 0}
              style={{ display: "inline-flex", gap: 8, alignItems: "center" }}
            >
              <IconPlusCircle size={18} />
              Novo turno
            </button>
            {visibleShifts.length > 0 && (
              <button
                type="button"
                className="nf-text-danger"
                onClick={clearSchedule}
                aria-label={selected ? `Limpar todos os turnos de ${person?.name}` : "Limpar todos os turnos da equipa"}
              >
                <IconTrash size={16} />
                {selected ? "Limpar turnos" : "Limpar horário"}
              </button>
            )}
          </div>
        )}
      </div>
      {generating && <GenerateScheduleModal staff={staff} onClose={() => setGenerating(false)} onDone={load} />}

      <div className="team-chips">
        <button type="button" className={`team-chip${selected === "" ? " active" : ""}`} onClick={() => setSelected("")}>
          Toda a equipa
        </button>
        {staff.map((s) => (
          <button
            type="button"
            key={s.id}
            className={`team-chip${selected === String(s.id) ? " active" : ""}`}
            onClick={() => setSelected(String(s.id))}
          >
            <strong>{s.name}</strong>
            <span>
              {ROLE_LABELS[s.role] || s.role} · {fmtHours(hoursFor(s.id))}/semana
            </span>
          </button>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}
      {staff.length === 0 && !error && (
        <GlassCard className="empty-state">
          <p>Ainda não há equipa no ginásio. Adiciona alguém em Gestão → “+ Adicionar à equipa”.</p>
        </GlassCard>
      )}

      <div className="schedule-legend">
        {SHIFT_ACTIVITIES.map((a) => (
          <span key={a.value} style={{ "--item-color": a.color }}>
            {a.label}
          </span>
        ))}
        <span style={{ "--item-color": SESSION_COLOR }}>Sessões com clientes</span>
      </div>

      <GlassCard className="schedule-card" strong>
        <WeekTimetable
          dense
          lanes={lanes}
          items={items}
          onItemClick={(item) => {
            if (item.shiftId) { if (canEdit) setEditing(shifts.find((s) => s.id === item.shiftId)); }
            else if (item.activity === "session") setViewingSession(sessions.find((s) => s.id === item.sessionId));
          }}
          emptyText={
            selected
              ? `${person?.name || "Esta pessoa"} ainda não tem turnos atribuídos.`
              : "Ainda não há turnos — gera o horário ou cria o primeiro turno."
          }
        />
      </GlassCard>

      {editing && (
        <ShiftFormModal
          initial={editing === "new" ? null : editing}
          staff={staff}
          defaultStaffId={selected || undefined}
          onClose={() => setEditing(null)}
          onSaved={afterChange}
        />
      )}
      {viewingSession && (
        <SessionDetailModal session={viewingSession} onClose={() => setViewingSession(null)} />
      )}
    </div>
  );
}
