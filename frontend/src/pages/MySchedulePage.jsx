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
const ACTIVITY_LABELS = { floor: "Sala", class: "Aula", reception: "Receção", assessments: "Avaliações", admin: "Admin", other: "Outro" };

function fmtEuro(v) { return `${Number(v || 0).toFixed(2).replace(".", ",")} €`; }
function fmtDate(s) { if (!s) return ""; const d = new Date(s); return d.toLocaleDateString("pt-PT"); }

function prevMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function nextMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
}

function calcEarnings(rates, week) {
  if (!rates) return { gross: 0, cut: 0, net: 0 };
  const base = Number(rates.base_salary || 0);
  const hSala = Number(rates.rate_sala_h || 0) * Number(week.hours_sala || 0);
  const hRec  = Number(rates.rate_reception_h || 0) * Number(week.hours_reception || 0);
  const hCls  = Number(rates.rate_class_h || 0) * Number(week.hours_class || 0);
  const ptEarnings = Number(rates.rate_pt_month || 0) * Number(week.pt_clients_count || 0);
  const gross = base + hSala + hRec + hCls + ptEarnings;
  let cut = 0;
  if (rates.gym_cut_pct != null)        cut = ptEarnings * Number(rates.gym_cut_pct) / 100;
  else if (rates.gym_cut_fixed != null) cut = Number(week.pt_clients_count || 0) * Number(rates.gym_cut_fixed);
  const absent = Number(week.absent_deduction || 0);
  return { gross, cut, net: gross - cut - absent };
}

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

  // Rendimento
  const [financeMonth, setFinanceMonth] = useState(prevMonth(currentYM()));
  const [financeData, setFinanceData] = useState(null);
  const [payments, setPayments] = useState([]);

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

    apiRequest("/finance/my/payments")
      .then(setPayments)
      .catch(() => {});
  }, [user.role]);

  useEffect(() => {
    apiRequest(`/finance/my?month=${financeMonth}`)
      .then(setFinanceData)
      .catch(() => {});
  }, [financeMonth]);

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

      {/* ── Rendimento ── */}
      <div style={{ marginTop: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Rendimento</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="glass-button glass-button-secondary" style={{ padding: "4px 10px" }}
              onClick={() => setFinanceMonth(prevMonth(financeMonth))}>‹</button>
            <span style={{ minWidth: 120, textAlign: "center", fontSize: "0.92rem", textTransform: "capitalize" }}>
              {monthLabel(financeMonth)}
            </span>
            <button className="glass-button glass-button-secondary" style={{ padding: "4px 10px" }}
              disabled={financeMonth >= currentYM()}
              onClick={() => setFinanceMonth(nextMonth(financeMonth))}>›</button>
          </div>
        </div>

        {financeData && (
          <>
            {/* Resumo semanal do mês */}
            {financeData.weeks.length === 0 ? (
              <p className="text-secondary">Sem registos para este mês.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {financeData.weeks.map((w, i) => {
                  const { gross, cut, net } = calcEarnings(financeData.rates, w);
                  return (
                    <GlassCard key={i} style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                        <div>
                          <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                            Semana de {fmtDate(w.week_start)}
                          </div>
                          <div className="text-secondary" style={{ fontSize: "0.8rem", marginTop: 2 }}>
                            {Number(w.hours_sala) > 0 && `Sala ${w.hours_sala}h  `}
                            {Number(w.hours_reception) > 0 && `Receção ${w.hours_reception}h  `}
                            {Number(w.hours_class) > 0 && `Aulas ${w.hours_class}h  `}
                            {Number(w.pt_clients_count) > 0 && `${w.pt_clients_count} clientes PT`}
                          </div>
                          {Number(w.absent_hours) > 0 && (
                            <div style={{ fontSize: "0.78rem", color: "#f87171", marginTop: 2 }}>
                              Faltou {w.absent_hours}h · desconto {fmtEuro(w.absent_deduction)}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: "right", fontSize: "0.85rem" }}>
                          <div className="text-secondary">Bruto: {fmtEuro(gross)}</div>
                          {cut > 0 && <div style={{ color: "#4ade80" }}>Ginásio: – {fmtEuro(cut)}</div>}
                          <div style={{ fontWeight: 600 }}>A receber: {fmtEuro(net)}</div>
                        </div>
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            )}

            {/* Presenças do mês */}
            {financeData.attendance.length > 0 && (
              <>
                <h3 style={{ fontSize: "0.95rem", margin: "16px 0 8px" }}>Presenças</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {financeData.attendance.map((a, i) => {
                    const statusColor = a.status === "absent" ? "#f87171"
                      : a.status === "adjusted" ? "#f59e0b"
                      : a.status === "present" ? "#4ade80"
                      : "var(--text-secondary)";
                    const statusLabel = a.status === "absent" ? "Falta"
                      : a.status === "adjusted" ? `Ajustado (−${Number(a.deducted_hours).toFixed(1)}h)`
                      : a.status === "present" ? "Presente"
                      : "A aguardar";
                    const bgColor = a.status === "absent" ? "rgba(248,113,113,0.08)"
                      : a.status === "adjusted" ? "rgba(245,158,11,0.07)"
                      : a.status === "present" ? "rgba(74,222,128,0.06)"
                      : "rgba(255,255,255,0.03)";
                    return (
                      <div key={i} style={{ display: "flex", gap: 10, fontSize: "0.82rem", padding: "5px 10px",
                        borderRadius: 8, background: bgColor }}>
                        <span style={{ minWidth: 80, color: "var(--text-secondary)" }}>{fmtDate(a.shift_date)}</span>
                        <span>{a.start_time}–{a.end_time}</span>
                        <span className="text-secondary">{ACTIVITY_LABELS[a.activity] || a.activity}</span>
                        <span style={{ marginLeft: "auto", fontWeight: 600, color: statusColor }}>
                          {statusLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* Histórico de pagamentos confirmados */}
        {payments.length > 0 && (
          <>
            <h3 style={{ fontSize: "0.95rem", margin: "24px 0 8px" }}>Histórico de pagamentos</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {payments.map((p, i) => (
                <GlassCard key={i} style={{ padding: "10px 16px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <span style={{ fontWeight: 600, textTransform: "capitalize" }}>{monthLabel(p.month_year)}</span>
                    <div className="text-secondary" style={{ fontSize: "0.78rem", marginTop: 2 }}>
                      Pago em {fmtDate(p.paid_at)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", fontSize: "0.85rem" }}>
                    <div className="text-secondary">Bruto: {fmtEuro(p.gross)}</div>
                    {Number(p.gym_cut) > 0 && <div style={{ color: "#4ade80" }}>Ginásio: – {fmtEuro(p.gym_cut)}</div>}
                    {Number(p.absent_deduction) > 0 && <div style={{ color: "#f87171" }}>Faltas: – {fmtEuro(p.absent_deduction)}</div>}
                    <div style={{ fontWeight: 700 }}>Recebido: {fmtEuro(p.net)}</div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
