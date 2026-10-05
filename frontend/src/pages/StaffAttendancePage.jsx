import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import Modal from "../components/Modal";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABELS } from "../utils/roles";

const ACTIVITY_LABELS = {
  floor: "Sala", class: "Aula", reception: "Receção",
  assessments: "Avaliações", admin: "Admin", other: "Outro",
};

function toMin(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function prevDay(s) {
  const d = new Date(`${s}T00:00:00`); d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("sv");
}
function nextDay(s) {
  const d = new Date(`${s}T00:00:00`); d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("sv");
}
function fmtDayLabel(s) {
  return new Date(`${s}T00:00:00`).toLocaleDateString("pt-PT", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}
function fmtHour(min) {
  const h = Math.floor(min / 60); const m = min % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

// ─── Modal de ajuste de presença ───────────────────────────────────────────
function AdjustModal({ shift, date, onClose, onSaved }) {
  const fullMins = toMin(shift.shift_end) - toMin(shift.shift_start);
  const [status, setStatus] = useState(shift.status === "pending" ? "present" : shift.status);
  const [adjustments, setAdjustments] = useState(
    Array.isArray(shift.adjustments) ? shift.adjustments.filter((a) => a.type === "late" || a.type === "out") : []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function addLate() { setAdjustments((p) => [...p, { type: "late", minutes: 30 }]); }
  function addOut()  { setAdjustments((p) => [...p, { type: "out", from: shift.shift_start, to: shift.shift_start }]); }
  function removeAdj(i) { setAdjustments((p) => p.filter((_, idx) => idx !== i)); }
  function updateAdj(i, key, val) { setAdjustments((p) => p.map((a, idx) => idx === i ? { ...a, [key]: val } : a)); }

  function calcDeductedMins() {
    if (status === "absent") return fullMins;
    return adjustments.reduce((sum, a) => {
      if (a.type === "late") return sum + Number(a.minutes || 0);
      if (a.type === "out") {
        const diff = toMin(a.to || shift.shift_start) - toMin(a.from || shift.shift_start);
        return sum + Math.max(0, diff);
      }
      return sum;
    }, 0);
  }

  const deductedMins = calcDeductedMins();

  async function handleSave() {
    setSaving(true); setError("");
    try {
      await apiRequest("/attendance", {
        method: "POST",
        body: {
          staff_id: shift.staff_id,
          shift_date: date,
          shift_start: shift.shift_start,
          shift_end: shift.shift_end,
          activity: shift.activity,
          status: status === "present" && adjustments.length > 0 ? "adjusted" : status,
          adjustments: status === "absent" ? [] : adjustments,
        },
      });
      onSaved(); onClose();
    } catch (err) { setError(err.message); setSaving(false); }
  }

  return (
    <Modal onClose={onClose}>
      <GlassCard className="preview-card" strong style={{ maxWidth: 440, width: "100%" }}>
        <h3 style={{ marginBottom: 4 }}>{shift.staff_name}</h3>
        <p className="text-secondary" style={{ fontSize: "0.83rem", margin: "0 0 14px" }}>
          {shift.shift_start}–{shift.shift_end} · {ACTIVITY_LABELS[shift.activity] || shift.activity}
        </p>

        <div className="form-row">
          <label className="field-label">Estado</label>
          <div style={{ display: "flex", gap: 8 }}>
            {["present", "absent"].map((s) => (
              <button key={s} type="button"
                className={`glass-button${status === s ? "" : " glass-button-secondary"}`}
                style={{ fontSize: "0.85rem" }} onClick={() => setStatus(s)}>
                {s === "present" ? "✓ Presente" : "✗ Falta total"}
              </button>
            ))}
          </div>
        </div>

        {status === "present" && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label className="field-label" style={{ margin: 0 }}>Ajustes</label>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" className="glass-button glass-button-secondary"
                  style={{ fontSize: "0.78rem", padding: "3px 10px" }} onClick={addLate}>+ Atraso</button>
                <button type="button" className="glass-button glass-button-secondary"
                  style={{ fontSize: "0.78rem", padding: "3px 10px" }} onClick={addOut}>+ Saída parcial</button>
              </div>
            </div>
            {adjustments.map((adj, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
                padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.04)" }}>
                {adj.type === "late" ? (
                  <>
                    <span style={{ fontSize: "0.82rem", flex: 1 }}>Atraso</span>
                    <input type="number" min="5" max="240" step="5" className="glass-input"
                      style={{ width: 72 }} value={adj.minutes}
                      onChange={(e) => updateAdj(i, "minutes", Number(e.target.value))} />
                    <span className="text-secondary" style={{ fontSize: "0.82rem" }}>min</span>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: "0.82rem" }}>Saiu</span>
                    <input type="time" className="glass-input" style={{ width: 88 }}
                      value={adj.from} onChange={(e) => updateAdj(i, "from", e.target.value)} />
                    <span className="text-secondary">–</span>
                    <input type="time" className="glass-input" style={{ width: 88 }}
                      value={adj.to} onChange={(e) => updateAdj(i, "to", e.target.value)} />
                  </>
                )}
                <button type="button"
                  style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: "1.1rem", lineHeight: 1 }}
                  onClick={() => removeAdj(i)}>×</button>
              </div>
            ))}
          </div>
        )}

        {deductedMins > 0 && (
          <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8,
            background: "rgba(248,113,113,0.1)", fontSize: "0.85rem", color: "#f87171" }}>
            Total a descontar: {deductedMins >= 60
              ? `${Math.floor(deductedMins / 60)}h${deductedMins % 60 > 0 ? ` ${deductedMins % 60}min` : ""}`
              : `${deductedMins} min`}
          </div>
        )}

        {error && <p className="error-text">{error}</p>}
        <div className="form-actions" style={{ marginTop: 16 }}>
          <button type="button" className="glass-button glass-button-secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="glass-button" disabled={saving} onClick={handleSave}>
            {saving ? "A guardar..." : "Guardar"}
          </button>
        </div>
      </GlassCard>
    </Modal>
  );
}

// ─── Timetable visual do dia ────────────────────────────────────────────────
function DayTimetable({ shifts, isToday, onShiftClick }) {
  if (!shifts.length) return (
    <GlassCard className="empty-state"><p>Sem turnos para este dia.</p></GlassCard>
  );

  // Time range: earliest start to latest end, rounded to whole hours
  const allStarts = shifts.map((s) => toMin(s.shift_start));
  const allEnds   = shifts.map((s) => toMin(s.shift_end));
  const rangeStart = Math.floor(Math.min(...allStarts) / 60) * 60;
  const rangeEnd   = Math.ceil(Math.max(...allEnds)   / 60) * 60;
  const totalMins  = rangeEnd - rangeStart;

  const hours = [];
  for (let m = rangeStart; m <= rangeEnd; m += 60) hours.push(m);

  const statusBg = (s) => ({
    present:  "rgba(74,222,128,0.25)",
    adjusted: "rgba(245,158,11,0.25)",
    absent:   "rgba(248,113,113,0.20)",
    pending:  "rgba(255,255,255,0.08)",
  }[s] || "rgba(255,255,255,0.08)");

  const statusBorder = (s) => ({
    present:  "rgba(74,222,128,0.6)",
    adjusted: "rgba(245,158,11,0.6)",
    absent:   "rgba(248,113,113,0.6)",
    pending:  "rgba(255,255,255,0.2)",
  }[s] || "rgba(255,255,255,0.2)");

  const statusIcon = (s) => ({ present: "✓", adjusted: "~", absent: "✗", pending: "?" }[s] || "");
  const statusColor = (s) => ({
    present: "#4ade80", adjusted: "#f59e0b", absent: "#f87171", pending: "var(--text-secondary)"
  }[s]);

  const pct = (m) => `${((m - rangeStart) / totalMins) * 100}%`;

  return (
    <GlassCard style={{ padding: "14px 16px" }}>
      {/* Hour markers */}
      <div style={{ display: "flex", marginBottom: 6 }}>
        <div style={{ width: 110, flexShrink: 0 }} />
        <div style={{ flex: 1, position: "relative", height: 20 }}>
          {hours.map((m) => (
            <div key={m} style={{
              position: "absolute",
              left: pct(m),
              fontSize: "0.72rem", color: "var(--text-secondary)",
              transform: "translateX(-50%)",
            }}>
              {fmtHour(m)}
            </div>
          ))}
        </div>
      </div>

      {/* Staff rows — grid lines live inside each timeline div */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {shifts.map((shift, i) => {
          const startPct = pct(toMin(shift.shift_start));
          const widthPct = `${((toMin(shift.shift_end) - toMin(shift.shift_start)) / totalMins) * 100}%`;

          return (
            <div key={i} style={{ display: "flex", alignItems: "center", minHeight: 46 }}>
              {/* Name */}
              <div style={{ width: 110, flexShrink: 0, paddingRight: 10 }}>
                <div style={{ fontSize: "0.83rem", fontWeight: 600, lineHeight: 1.2 }}>
                  {shift.staff_name.split(" ")[0]}
                </div>
                <div className="text-secondary" style={{ fontSize: "0.7rem" }}>
                  {ROLE_LABELS[shift.staff_role] || shift.staff_role}
                </div>
              </div>

              {/* Timeline */}
              <div style={{ flex: 1, position: "relative", height: 44, minWidth: 0 }}>
                {/* Grid lines constrained to this div — no overflow */}
                {hours.map((m) => (
                  <div key={m} style={{
                    position: "absolute", left: pct(m),
                    top: 0, bottom: 0, width: 1,
                    background: "rgba(255,255,255,0.07)", pointerEvents: "none",
                  }} />
                ))}
                {/* Shift bar */}
                <div
                  style={{
                    position: "absolute",
                    left: startPct, width: widthPct,
                    top: 2, bottom: 2,
                    background: statusBg(shift.status),
                    border: `1.5px solid ${statusBorder(shift.status)}`,
                    borderRadius: 8,
                    cursor: isToday ? "pointer" : "default",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    gap: 6, padding: "0 8px", overflow: "hidden",
                  }}
                  onClick={() => isToday && onShiftClick(shift)}
                  title={`${shift.shift_start}–${shift.shift_end} · ${ACTIVITY_LABELS[shift.activity] || shift.activity}`}
                >
                  <span style={{ fontSize: "0.78rem", fontWeight: 600, color: statusColor(shift.status), flexShrink: 0 }}>
                    {statusIcon(shift.status)}
                  </span>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {shift.shift_start}–{shift.shift_end}
                  </span>
                  <span className="text-secondary" style={{ fontSize: "0.72rem", flexShrink: 0 }}>
                    {ACTIVITY_LABELS[shift.activity]?.slice(0,3) || shift.activity.slice(0,3)}
                  </span>
                  {Number(shift.deducted_hours) > 0 && (
                    <span style={{ fontSize: "0.7rem", color: "#f87171", flexShrink: 0 }}>
                      −{Number(shift.deducted_hours).toFixed(1)}h
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {isToday && (
        <p className="text-secondary" style={{ fontSize: "0.75rem", marginTop: 12, textAlign: "right" }}>
          Clica num turno para confirmar presença ou ajustar
        </p>
      )}
    </GlassCard>
  );
}

// ─── Página principal ───────────────────────────────────────────────────────
const TODAY_SV = new Date().toLocaleDateString("sv");

export default function StaffAttendancePage() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isOwner = user?.role === "gym_owner";

  const [date, setDate] = useState(searchParams.get("date") || TODAY_SV);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [adjusting, setAdjusting] = useState(null);

  function loadShifts(d) {
    setLoading(true); setError("");
    apiRequest(`/attendance/daily?date=${d}`)
      .then(setShifts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadShifts(date); }, [date]);

  const isToday = date === TODAY_SV;
  const isEditable = isOwner || isToday;

  // Summary counts
  const counts = shifts.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1; return acc;
  }, {});

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Presenças Staff</h1>
      </div>

      {/* Day navigation */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <button className="glass-button glass-button-secondary" style={{ padding: "4px 10px" }}
          onClick={() => setDate(prevDay(date))}>‹</button>
        <span style={{ minWidth: 220, textAlign: "center", fontSize: "0.95rem", textTransform: "capitalize" }}>
          {fmtDayLabel(date)}
          {isToday && <span style={{ marginLeft: 8, fontSize: "0.72rem", color: "#a78bfa" }}>(hoje)</span>}
        </span>
        <button className="glass-button glass-button-secondary" style={{ padding: "4px 10px" }}
          disabled={!isOwner && date >= TODAY_SV} onClick={() => setDate(nextDay(date))}>›</button>
      </div>

      {/* Status summary chips */}
      {shifts.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {counts.present  > 0 && <span className="role-badge role-badge-static" style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80" }}>✓ {counts.present} presente{counts.present !== 1 ? "s" : ""}</span>}
          {counts.adjusted > 0 && <span className="role-badge role-badge-static" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>~ {counts.adjusted} ajustado{counts.adjusted !== 1 ? "s" : ""}</span>}
          {counts.absent   > 0 && <span className="role-badge role-badge-static" style={{ background: "rgba(248,113,113,0.15)", color: "#f87171" }}>✗ {counts.absent} falta{counts.absent !== 1 ? "s" : ""}</span>}
          {counts.pending  > 0 && <span className="role-badge role-badge-static" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}>? {counts.pending} por confirmar</span>}
        </div>
      )}

      {!isEditable && (
        <div style={{ padding: "8px 12px", marginBottom: 12, borderRadius: 8,
          background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.3)" }}>
          <span style={{ fontSize: "0.83rem", color: "#f59e0b" }}>
            Visualização — só é possível editar presenças no dia de hoje.
          </span>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="text-secondary">A carregar...</p>}

      {!loading && (
        <DayTimetable
          shifts={shifts}
          isToday={isEditable}
          onShiftClick={setAdjusting}
        />
      )}

      {adjusting && (
        <AdjustModal
          shift={adjusting}
          date={date}
          onClose={() => setAdjusting(null)}
          onSaved={() => loadShifts(date)}
        />
      )}
    </div>
  );
}
