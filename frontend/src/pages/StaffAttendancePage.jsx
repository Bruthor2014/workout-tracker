import { useEffect, useState } from "react";
import GlassCard from "../components/GlassCard";
import Modal from "../components/Modal";
import { apiRequest, resolveAssetUrl } from "../api/client";
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
  return new Date(`${s}T00:00:00`).toLocaleDateString("pt-PT", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

// ─── Modal de ajuste de presença ───────────────────────────────────────────
function AdjustModal({ shift, date, onClose, onSaved }) {
  const fullMins = toMin(shift.shift_end) - toMin(shift.shift_start);
  const [status, setStatus] = useState(shift.status === "pending" ? "present" : shift.status);
  const [adjustments, setAdjustments] = useState(
    (shift.adjustments || []).filter((a) => a.type === "late" || a.type === "out")
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function addLate() {
    setAdjustments((prev) => [...prev, { type: "late", minutes: 30 }]);
  }
  function addOut() {
    setAdjustments((prev) => [...prev, { type: "out", from: shift.shift_start, to: shift.shift_start }]);
  }
  function removeAdj(i) {
    setAdjustments((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateAdj(i, key, val) {
    setAdjustments((prev) => prev.map((a, idx) => idx === i ? { ...a, [key]: val } : a));
  }

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
  const deductedHours = deductedMins / 60;

  async function handleSave() {
    setSaving(true);
    setError("");
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
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <GlassCard className="preview-card" strong style={{ maxWidth: 440, width: "100%" }}>
        <h3 style={{ marginBottom: 4 }}>
          {shift.staff_name} · {shift.shift_start}–{shift.shift_end}
        </h3>
        <p className="text-secondary" style={{ fontSize: "0.82rem", margin: "0 0 14px" }}>
          {ACTIVITY_LABELS[shift.activity] || shift.activity}
        </p>

        {/* Status buttons */}
        <div className="form-row">
          <label className="field-label">Estado</label>
          <div style={{ display: "flex", gap: 8 }}>
            {["present", "absent"].map((s) => (
              <button key={s} type="button"
                className={`glass-button${status === s ? "" : " glass-button-secondary"}`}
                style={{ fontSize: "0.85rem" }}
                onClick={() => setStatus(s)}>
                {s === "present" ? "Presente" : "Falta total"}
              </button>
            ))}
          </div>
        </div>

        {/* Adjustments — only when present */}
        {status === "present" && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label className="field-label" style={{ margin: 0 }}>Ajustes (opcional)</label>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" className="glass-button glass-button-secondary"
                  style={{ fontSize: "0.78rem", padding: "3px 10px" }}
                  onClick={addLate}>+ Atraso</button>
                <button type="button" className="glass-button glass-button-secondary"
                  style={{ fontSize: "0.78rem", padding: "3px 10px" }}
                  onClick={addOut}>+ Saída parcial</button>
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
                <button type="button" style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: "1rem" }}
                  onClick={() => removeAdj(i)}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* Deduction summary */}
        {deductedMins > 0 && (
          <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8,
            background: "rgba(248,113,113,0.1)", fontSize: "0.85rem", color: "#f87171" }}>
            Total a descontar: {deductedMins >= 60
              ? `${Math.floor(deductedMins / 60)}h ${deductedMins % 60 > 0 ? `${deductedMins % 60}min` : ""}`
              : `${deductedMins} min`}
            {" "}({deductedHours.toFixed(2).replace(".", ",")}h)
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

// ─── Página principal ───────────────────────────────────────────────────────
const TODAY_SV = new Date().toLocaleDateString("sv");

export default function StaffAttendancePage() {
  const [date, setDate] = useState(TODAY_SV);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [adjusting, setAdjusting] = useState(null); // shift row

  function loadShifts(d) {
    setLoading(true);
    setError("");
    apiRequest(`/attendance/daily?date=${d}`)
      .then(setShifts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadShifts(date); }, [date]);

  const isToday = date === TODAY_SV;

  async function markPresent(shift) {
    try {
      await apiRequest("/attendance", {
        method: "POST",
        body: {
          staff_id: shift.staff_id,
          shift_date: date,
          shift_start: shift.shift_start,
          shift_end: shift.shift_end,
          activity: shift.activity,
          status: "present",
          adjustments: [],
        },
      });
      loadShifts(date);
    } catch (err) {
      setError(err.message);
    }
  }

  const statusColor = (s) => ({
    present:  "#4ade80",
    adjusted: "#f59e0b",
    absent:   "#f87171",
    pending:  "var(--text-secondary)",
  }[s] || "var(--text-secondary)");

  const statusLabel = (s) => ({
    present:  "Presente",
    adjusted: "Ajustado",
    absent:   "Falta",
    pending:  "Por confirmar",
  }[s] || s);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Presenças Staff</h1>
      </div>

      {/* Day navigation */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <button className="glass-button glass-button-secondary" style={{ padding: "4px 10px" }}
          onClick={() => setDate(prevDay(date))}>‹</button>
        <span style={{ minWidth: 200, textAlign: "center", fontSize: "0.95rem", textTransform: "capitalize" }}>
          {fmtDayLabel(date)}
          {isToday && <span style={{ marginLeft: 8, fontSize: "0.72rem", color: "#a78bfa" }}>(hoje)</span>}
        </span>
        <button className="glass-button glass-button-secondary" style={{ padding: "4px 10px" }}
          disabled={date >= TODAY_SV}
          onClick={() => setDate(nextDay(date))}>›</button>
      </div>

      {!isToday && (
        <GlassCard style={{ padding: "10px 14px", marginBottom: 16, background: "rgba(245,158,11,0.07)", borderColor: "rgba(245,158,11,0.3)" }}>
          <span style={{ fontSize: "0.85rem", color: "#f59e0b" }}>
            Visualização apenas — só é possível registar presenças no dia de hoje.
          </span>
        </GlassCard>
      )}

      {error && <p className="error-text">{error}</p>}

      {loading && <p className="text-secondary">A carregar...</p>}

      {!loading && shifts.length === 0 && (
        <GlassCard className="empty-state">
          <p>Sem turnos agendados para este dia.</p>
        </GlassCard>
      )}

      {!loading && shifts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {shifts.map((shift, i) => {
            const url = resolveAssetUrl(shift.avatar_url);
            const isPending = shift.status === "pending";
            return (
              <GlassCard key={i} style={{ padding: "14px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  {/* Avatar */}
                  <div style={{ flexShrink: 0 }}>
                    {url
                      ? <img src={url} alt="" className="member-card-avatar" />
                      : <span className="member-card-avatar member-card-avatar-fallback">
                          {shift.staff_name.charAt(0).toUpperCase()}
                        </span>}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <strong>{shift.staff_name}</strong>
                      <span className="role-badge role-badge-static" style={{ fontSize: "0.7rem" }}>
                        {ROLE_LABELS[shift.staff_role] || shift.staff_role}
                      </span>
                    </div>
                    <div className="text-secondary" style={{ fontSize: "0.83rem", marginTop: 2 }}>
                      {shift.shift_start}–{shift.shift_end} · {ACTIVITY_LABELS[shift.activity] || shift.activity}
                      <span style={{ marginLeft: 8 }}>{Number(shift.shift_hours).toFixed(1)}h</span>
                    </div>
                    {shift.status !== "pending" && (
                      <div style={{ fontSize: "0.8rem", marginTop: 4, color: statusColor(shift.status) }}>
                        {statusLabel(shift.status)}
                        {Number(shift.deducted_hours) > 0 && ` · −${Number(shift.deducted_hours).toFixed(1)}h`}
                        {shift.confirmed_by_name && <span className="text-secondary"> · {shift.confirmed_by_name}</span>}
                      </div>
                    )}
                  </div>

                  {/* Actions — only for today */}
                  {isToday && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {isPending ? (
                        <>
                          <button className="glass-button"
                            style={{ fontSize: "0.82rem", padding: "5px 14px", background: "rgba(74,222,128,0.2)", borderColor: "rgba(74,222,128,0.5)" }}
                            onClick={() => markPresent(shift)}>
                            ✓ Presente
                          </button>
                          <button className="glass-button glass-button-secondary"
                            style={{ fontSize: "0.82rem", padding: "5px 14px" }}
                            onClick={() => setAdjusting(shift)}>
                            Ajustar
                          </button>
                        </>
                      ) : (
                        <button className="glass-button glass-button-secondary"
                          style={{ fontSize: "0.82rem", padding: "5px 14px" }}
                          onClick={() => setAdjusting(shift)}>
                          Editar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
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
