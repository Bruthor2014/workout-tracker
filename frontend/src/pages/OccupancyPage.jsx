import { useEffect, useState } from "react";
import GlassCard from "../components/GlassCard";
import Modal from "../components/Modal";
import { apiRequest, resolveAssetUrl } from "../api/client";
import { ROLE_LABELS } from "../utils/roles";

const STAFF_ROLES = ["personal_trainer", "nutritionist", "receptionist", "intern", "gym_owner"];
const DAY_NAMES = ["", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const ACTIVITY_LABELS = { floor: "Sala", class: "Aula", reception: "Receção", assessments: "Avaliações", admin: "Admin", other: "Outro" };

function fmtTime(str) {
  if (!str) return "";
  return new Date(str).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

function fmtDuration(checkedIn, checkedOut) {
  const end = checkedOut ? new Date(checkedOut) : new Date();
  const mins = Math.round((end - new Date(checkedIn)) / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}min`;
}

function getMondayOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toLocaleDateString("sv");
}

function prevDay(s) {
  const d = new Date(`${s}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("sv");
}
function nextDay(s) {
  const d = new Date(`${s}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("sv");
}
function fmtDayLabel(s) {
  return new Date(`${s}T00:00:00`).toLocaleDateString("pt-PT", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
function prevWeek(s) {
  const d = new Date(`${s}T00:00:00`);
  d.setDate(d.getDate() - 7);
  return d.toLocaleDateString("sv");
}
function nextWeek(s) {
  const d = new Date(`${s}T00:00:00`);
  d.setDate(d.getDate() + 7);
  return d.toLocaleDateString("sv");
}
function fmtWeekLabel(mondayStr) {
  const d = new Date(`${mondayStr}T00:00:00`);
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const endStr = `${end.getDate()} ${months[end.getMonth()]} ${end.getFullYear()}`;
  if (d.getMonth() === end.getMonth())
    return `${d.getDate()}–${endStr}`;
  return `${d.getDate()} ${months[d.getMonth()]} – ${endStr}`;
}
const TODAY_SV = new Date().toLocaleDateString("sv");

function CheckInModal({ members, onClose, onDone }) {
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Ordenar: staff primeiro.
  const sorted = [...members].sort((a, b) => {
    const aStaff = STAFF_ROLES.includes(a.role) ? 0 : 1;
    const bStaff = STAFF_ROLES.includes(b.role) ? 0 : 1;
    return aStaff - bStaff || a.name.localeCompare(b.name);
  });

  async function handleSubmit(e) {
    e.preventDefault();
    if (!userId) return setError("Escolhe um membro.");
    setSaving(true);
    setError("");
    try {
      await apiRequest("/occupancy/checkin", { method: "POST", body: { user_id: Number(userId) } });
      onDone();
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <GlassCard className="preview-card" strong>
        <h3>Registar entrada</h3>
        <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
          <div className="form-row">
            <label className="field-label">Pessoa</label>
            <select className="glass-input" value={userId} onChange={(e) => setUserId(e.target.value)}
              style={{ color: "var(--text-primary)", background: "var(--glass-bg)" }}>
              <option value="">— Escolher —</option>
              {sorted.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}{STAFF_ROLES.includes(m.role) ? ` (${ROLE_LABELS[m.role] || m.role})` : ""}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions">
            <button type="button" className="glass-button glass-button-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="glass-button" disabled={saving}>{saving ? "..." : "Registar entrada"}</button>
          </div>
        </form>
      </GlassCard>
    </Modal>
  );
}

export default function OccupancyPage() {
  const [live, setLive] = useState([]);
  const [history, setHistory] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkingIn, setCheckingIn] = useState(false);
  const [tab, setTab] = useState("live");
  const [absenceWeek, setAbsenceWeek] = useState(getMondayOfWeek());
  const [historyDate, setHistoryDate] = useState(new Date().toLocaleDateString('sv'));

  function loadLive() {
    apiRequest("/occupancy/live").then(setLive).catch(() => {});
  }

  function loadHistory(date) {
    apiRequest(`/occupancy/history?date=${date}`).then(setHistory).catch(() => {});
  }

  function load() {
    Promise.all([
      apiRequest("/occupancy/live"),
      apiRequest(`/occupancy/history?date=${historyDate}`),
      apiRequest("/members"),
    ])
      .then(([l, h, m]) => { setLive(l); setHistory(h); setMembers(m); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  function loadAbsences(week) {
    apiRequest(`/occupancy/absences?week=${week}`)
      .then(setAbsences)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
    const interval = setInterval(loadLive, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (tab === "absences") loadAbsences(absenceWeek);
    if (tab === "history") loadHistory(historyDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, absenceWeek, historyDate]);

  async function checkout(userId, name) {
    if (!window.confirm(`Registar saída de ${name}?`)) return;
    try {
      await apiRequest("/occupancy/checkout", { method: "POST", body: { user_id: userId } });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const staffCount = live.filter((e) => STAFF_ROLES.includes(e.role)).length;
  const memberCount = live.length - staffCount;

  // Agrupar faltas por staff member
  const absentByStaff = absences.reduce((acc, row) => {
    if (!row.was_absent) return acc;
    if (!acc[row.staff_id]) acc[row.staff_id] = { name: row.staff_name, role: row.staff_role, shifts: [] };
    acc[row.staff_id].shifts.push(row);
    return acc;
  }, {});

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Ocupação</h1>
        <button className="glass-button" onClick={() => setCheckingIn(true)}>+ Registar entrada</button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {/* Contador em destaque */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <GlassCard style={{ flex: 1, minWidth: 140, padding: "12px 18px", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1 }}>{live.length}</div>
          <div className="text-secondary" style={{ fontSize: "0.82rem", marginTop: 4 }}>No ginásio agora</div>
        </GlassCard>
        {staffCount > 0 && (
          <GlassCard style={{ flex: 1, minWidth: 140, padding: "12px 18px", textAlign: "center", background: "rgba(139,92,246,0.12)" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1, color: "#c4b5fd" }}>{staffCount}</div>
            <div className="text-secondary" style={{ fontSize: "0.82rem", marginTop: 4 }}>Staff presente</div>
          </GlassCard>
        )}
        {memberCount > 0 && (
          <GlassCard style={{ flex: 1, minWidth: 140, padding: "12px 18px", textAlign: "center" }}>
            <div style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1 }}>{memberCount}</div>
            <div className="text-secondary" style={{ fontSize: "0.82rem", marginTop: 4 }}>Membros</div>
          </GlassCard>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button className={`glass-button${tab === "live" ? "" : " glass-button-secondary"}`} onClick={() => setTab("live")}>
          Agora {live.length > 0 && <span className="sidebar-badge" style={{ marginLeft: 6 }}>{live.length}</span>}
        </button>
        <button className={`glass-button${tab === "history" ? "" : " glass-button-secondary"}`} onClick={() => setTab("history")}>Hoje</button>
        <button className={`glass-button${tab === "absences" ? "" : " glass-button-secondary"}`} onClick={() => setTab("absences")}>Faltas</button>
      </div>

      {loading && <p className="text-secondary">A carregar...</p>}

      {/* ── Agora ── */}
      {!loading && tab === "live" && (
        <>
          {live.length === 0 && (
            <GlassCard className="empty-state">
              <p>Nenhuma pessoa no ginásio agora.</p>
            </GlassCard>
          )}
          <div className="member-grid">
            {live.map((entry) => {
              const isStaff = STAFF_ROLES.includes(entry.role);
              const url = resolveAssetUrl(entry.avatar_url);
              return (
                <GlassCard key={entry.id} className="member-tile" strong
                  style={isStaff ? { background: "rgba(139,92,246,0.12)", borderColor: "rgba(139,92,246,0.3)" } : {}}>
                  <div className="member-tile-header">
                    {url
                      ? <img src={url} alt="" className="member-card-avatar" />
                      : <span className="member-card-avatar member-card-avatar-fallback">{entry.name.charAt(0).toUpperCase()}</span>}
                    <div className="member-tile-identity">
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="member-tile-name">{entry.name}</span>
                        {isStaff && (
                          <span className="role-badge role-badge-static" style={{ fontSize: "0.7rem" }}>
                            {ROLE_LABELS[entry.role] || entry.role}
                          </span>
                        )}
                      </div>
                      <span className="text-secondary" style={{ fontSize: "0.82rem" }}>
                        Entrou às {fmtTime(entry.checked_in_at)} · {fmtDuration(entry.checked_in_at, null)}
                      </span>
                    </div>
                  </div>
                  <button type="button"
                    className="glass-button glass-button-secondary"
                    style={{ marginTop: 10, width: "100%", fontSize: "0.82rem" }}
                    onClick={() => checkout(entry.user_id, entry.name)}>
                    Registar saída
                  </button>
                </GlassCard>
              );
            })}
          </div>
        </>
      )}

      {/* ── Hoje ── */}
      {!loading && tab === "history" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <button className="glass-button glass-button-secondary" style={{ padding: "4px 10px" }}
              onClick={() => setHistoryDate(prevDay(historyDate))}>‹</button>
            <span style={{ minWidth: 160, textAlign: "center", fontSize: "0.92rem", textTransform: "capitalize" }}>
              {fmtDayLabel(historyDate)}
            </span>
            <button className="glass-button glass-button-secondary" style={{ padding: "4px 10px" }}
              disabled={historyDate >= TODAY_SV}
              onClick={() => setHistoryDate(nextDay(historyDate))}>›</button>
          </div>
          {history.length === 0 && <p className="text-secondary">Sem registos neste dia.</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {history.map((entry) => {
              const isStaff = STAFF_ROLES.includes(entry.role);
              const url = resolveAssetUrl(entry.avatar_url);
              return (
                <GlassCard key={entry.id} style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
                  ...(isStaff ? { background: "rgba(139,92,246,0.08)", borderColor: "rgba(139,92,246,0.25)" } : {}) }}>
                  {url
                    ? <img src={url} alt="" className="member-card-avatar" style={{ flexShrink: 0 }} />
                    : <span className="member-card-avatar member-card-avatar-fallback" style={{ flexShrink: 0 }}>{entry.name.charAt(0).toUpperCase()}</span>}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong>{entry.name}</strong>
                      {isStaff && <span className="role-badge role-badge-static" style={{ fontSize: "0.7rem" }}>{ROLE_LABELS[entry.role] || entry.role}</span>}
                    </div>
                    <div className="text-secondary" style={{ fontSize: "0.82rem" }}>
                      {fmtTime(entry.checked_in_at)}
                      {entry.checked_out_at
                        ? ` – ${fmtTime(entry.checked_out_at)} (${fmtDuration(entry.checked_in_at, entry.checked_out_at)})`
                        : " · ainda no ginásio"}
                    </div>
                  </div>
                  {!entry.checked_out_at && (
                    <button type="button" className="glass-button glass-button-secondary"
                      style={{ fontSize: "0.78rem", padding: "4px 10px" }}
                      onClick={() => checkout(entry.user_id, entry.name)}>
                      Saída
                    </button>
                  )}
                </GlassCard>
              );
            })}
          </div>
        </>
      )}

      {/* ── Faltas ── */}
      {tab === "absences" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <button className="glass-button glass-button-secondary" style={{ padding: "4px 10px" }}
              onClick={() => setAbsenceWeek(prevWeek(absenceWeek))}>‹</button>
            <span style={{ minWidth: 180, textAlign: "center", fontSize: "0.92rem" }}>
              {fmtWeekLabel(absenceWeek)}
            </span>
            <button className="glass-button glass-button-secondary" style={{ padding: "4px 10px" }}
              disabled={absenceWeek >= getMondayOfWeek()}
              onClick={() => setAbsenceWeek(nextWeek(absenceWeek))}>›</button>
          </div>

          {Object.keys(absentByStaff).length === 0 && (
            <GlassCard className="empty-state">
              <p>Nenhuma falta registada esta semana. 🎉</p>
            </GlassCard>
          )}

          {Object.values(absentByStaff).map((staff) => {
            const totalHours = staff.shifts.reduce((s, r) => s + Number(r.shift_hours), 0);
            const totalDeduction = staff.shifts.reduce((s, r) => s + Number(r.shift_hours) * Number(r.hourly_rate), 0);
            return (
              <GlassCard key={staff.shifts[0].staff_id} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <strong>{staff.name}</strong>
                    <span className="text-secondary" style={{ marginLeft: 8, fontSize: "0.82rem" }}>{ROLE_LABELS[staff.role] || staff.role}</span>
                  </div>
                  <div style={{ textAlign: "right", fontSize: "0.85rem" }}>
                    <span style={{ color: "#f87171" }}>{totalHours.toFixed(1)}h em falta · desconto {Number(totalDeduction).toFixed(2).replace(".", ",")} €</span>
                  </div>
                </div>
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                  {staff.shifts.map((s, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, fontSize: "0.82rem", padding: "4px 0", borderBottom: "1px solid var(--glass-border)" }}>
                      <span className="text-secondary" style={{ minWidth: 30 }}>{DAY_NAMES[s.weekday]}</span>
                      <span>{s.start_time} – {s.end_time}</span>
                      <span className="text-secondary">{ACTIVITY_LABELS[s.activity] || s.activity}</span>
                      <span style={{ marginLeft: "auto", color: "#f87171" }}>– {Number(Number(s.shift_hours) * Number(s.hourly_rate)).toFixed(2).replace(".", ",")} €</span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            );
          })}
        </>
      )}

      {checkingIn && (
        <CheckInModal members={members} onClose={() => setCheckingIn(false)} onDone={load} />
      )}
    </div>
  );
}
