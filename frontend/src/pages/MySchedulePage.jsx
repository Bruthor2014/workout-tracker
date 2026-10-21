import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import Modal from "../components/Modal";
import WeekTimetable from "../components/WeekTimetable";
import { IconCalendar } from "../components/Icons";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { INSTRUCTOR_ROLES } from "../utils/roles";
import { SESSION_COLOR, classKind, durationHours, sessionLabel, shiftActivity, weekdayName } from "../utils/schedule";

const HAS_CLIENTS = ["personal_trainer", "nutritionist"];

const fmtHours = (h) => `${h.toLocaleString("pt-PT", { maximumFractionDigits: 1 })} h`;

const KIND_LABELS = { shift: "Turno", class: "Aula de grupo", session: "Sessão com cliente" };

function ItemDetailModal({ item, onClose }) {
  const kind = item._kind;
  const raw = item._raw;
  return (
    <Modal onClose={onClose}>
      <GlassCard className="preview-card schedule-form" strong>
        <h3 style={{ color: item.color }}>{item.title}</h3>
        <p className="text-secondary" style={{ marginBottom: 14, marginTop: 2 }}>{KIND_LABELS[kind]}</p>
        <div className="session-detail-grid">
          <div>
            <span className="log-label">Dia</span>
            <span className="session-detail-value">{weekdayName(item.weekday)}</span>
          </div>
          <div>
            <span className="log-label">Horário</span>
            <span className="session-detail-value">{item.start_time}–{item.end_time}</span>
          </div>
          {kind === "shift" && raw.location && (
            <div>
              <span className="log-label">Local</span>
              <span className="session-detail-value">{raw.location}</span>
            </div>
          )}
          {kind === "shift" && raw.notes && (
            <div>
              <span className="log-label">Notas</span>
              <span className="session-detail-value">{raw.notes}</span>
            </div>
          )}
          {kind === "class" && raw.room && (
            <div>
              <span className="log-label">Sala</span>
              <span className="session-detail-value">{raw.room}</span>
            </div>
          )}
          {kind === "class" && (
            <div>
              <span className="log-label">Inscrições</span>
              <span className="session-detail-value">{raw.enrollment_count ?? 0} / {raw.capacity ?? "?"}</span>
            </div>
          )}
          {kind === "class" && raw.substitute_requested && (
            <div className="span-2">
              <span className="log-label">Estado</span>
              <span className="session-detail-value" style={{ color: "#f59e0b" }}>Substituição pedida</span>
            </div>
          )}
          {kind === "session" && (
            <div>
              <span className="log-label">Cliente</span>
              <span className="session-detail-value">{raw.member_name}</span>
            </div>
          )}
          {kind === "session" && raw.notes && (
            <div>
              <span className="log-label">Notas</span>
              <span className="session-detail-value">{raw.notes}</span>
            </div>
          )}
        </div>
        <div className="schedule-form-actions">
          <button type="button" className="glass-button" onClick={onClose}>Fechar</button>
        </div>
      </GlassCard>
    </Modal>
  );
}

export default function MySchedulePage() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiRequest("/shifts/me"),
      apiRequest("/classes"),
      HAS_CLIENTS.includes(user.role) ? apiRequest("/clients/sessions") : Promise.resolve([]),
    ])
      .then(([shiftRows, classRows, sessionRows]) => {
        setShifts(shiftRows);
        setClasses(classRows);
        setSessions(sessionRows);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user.role]);

  const myClasses = classes.filter((c) => c.instructor_id === user.id);
  const openClasses = INSTRUCTOR_ROLES.includes(user.role)
    ? classes.filter((c) => !c.instructor_id || (c.substitute_requested && c.instructor_id !== user.id))
    : [];

  const items = [
    ...shifts.map((s) => {
      const activity = shiftActivity(s.activity);
      return {
        ...s,
        id: `shift-${s.id}`,
        title: activity.label,
        subtitle: s.location || s.notes,
        color: activity.color,
        _kind: "shift",
        _raw: s,
      };
    }),
    ...myClasses.map((c) => ({
      ...c,
      id: `class-${c.id}`,
      title: c.title,
      subtitle: classKind(c.kind).label || "Aula de grupo",
      color: classKind(c.kind).color,
      status: c.substitute_requested ? "warning" : null,
      _kind: "class",
      _raw: c,
    })),
    ...sessions.map((s) => ({
      ...s,
      id: `session-${s.id}`,
      title: sessionLabel(user.role),
      subtitle: s.member_name,
      color: SESSION_COLOR,
      _kind: "session",
      _raw: s,
    })),
  ];

  const shiftHours = shifts.reduce((sum, s) => sum + durationHours(s.start_time, s.end_time), 0);
  const classHours = myClasses.reduce((sum, c) => sum + durationHours(c.start_time, c.end_time), 0);
  const sessionHours = sessions.reduce((sum, s) => sum + durationHours(s.start_time, s.end_time), 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="log-header">
          <span className="log-header-icon">
            <IconCalendar size={22} />
          </span>
          <h1>O meu horário</h1>
        </div>
      </div>

      <div className="profile-stats schedule-stats">
        <GlassCard className="stat-tile profile-stat" strong>
          <span className="stat-tile-label">Horas por semana</span>
          <span className="stat-tile-value">{fmtHours(shiftHours + classHours + sessionHours)}</span>
        </GlassCard>
        <GlassCard className="stat-tile profile-stat" strong>
          <span className="stat-tile-label">Turnos</span>
          <span className="stat-tile-value">{shifts.length}</span>
          <span className="stat-tile-sub">{fmtHours(shiftHours)}</span>
        </GlassCard>
        <GlassCard className="stat-tile profile-stat" strong>
          <span className="stat-tile-label">Aulas de grupo</span>
          <span className="stat-tile-value">{myClasses.length}</span>
          <span className="stat-tile-sub">{fmtHours(classHours)}</span>
        </GlassCard>
        {HAS_CLIENTS.includes(user.role) && (
          <GlassCard className="stat-tile profile-stat" strong>
            <span className="stat-tile-label">Com clientes</span>
            <span className="stat-tile-value">{sessions.length}</span>
            <span className="stat-tile-sub">{fmtHours(sessionHours)}</span>
          </GlassCard>
        )}
      </div>

      {openClasses.length > 0 && (
        <GlassCard className="schedule-alert" strong>
          <strong>
            {openClasses.length} {openClasses.length === 1 ? "aula precisa" : "aulas precisam"} de alguém
          </strong>
          <span className="text-secondary">
            {openClasses
              .slice(0, 3)
              .map((c) => `${c.title} (${weekdayName(c.weekday)} ${c.start_time})`)
              .join(" · ")}
          </span>
          <Link to="/classes" className="glass-button glass-button-secondary">
            Ver aulas de grupo
          </Link>
        </GlassCard>
      )}

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p className="text-secondary">A carregar...</p>
      ) : (
        <GlassCard className="schedule-card" strong>
          <WeekTimetable
            dense
            clip
            items={items}
            onItemClick={setSelected}
            emptyText="Ainda não tens horário atribuído — fala com a gerência do ginásio."
          />
        </GlassCard>
      )}

      {selected && <ItemDetailModal item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
