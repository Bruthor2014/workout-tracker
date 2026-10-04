import { useEffect, useState } from "react";
import GlassCard from "../components/GlassCard";
import Modal from "../components/Modal";
import { apiRequest, resolveAssetUrl } from "../api/client";
import { ROLE_LABELS } from "../utils/roles";

function toMinutes(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }

function prevMonthYM(ym) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function nextMonthYM(ym) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabelFull(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function fmtDate(str) {
  if (!str) return "";
  const d = new Date(`${str}T00:00:00`);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtEuro(n) {
  return Number(n || 0).toFixed(2).replace(".", ",") + " €";
}

function weekLabel(weekStart) {
  const d = new Date(`${weekStart}T00:00:00`);
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]}`;
}

function getMondayOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Retenção aplica-se apenas às receitas de clientes PT (não ao salário base nem
// às taxas horárias de trabalho do ginásio).
function calcEarnings(r) {
  const clients = Number(r.pt_clients_count || r.month_pt_clients || 0);
  const pt_earnings = Number(r.rate_pt_month || 0) * clients;
  const other =
    Number(r.base_salary || 0) +
    Number(r.rate_reception_h || 0) * Number(r.hours_reception || r.month_hours_reception || 0) +
    Number(r.rate_sala_h || 0)      * Number(r.hours_sala      || r.month_hours_sala      || 0) +
    Number(r.rate_class_h || 0)     * Number(r.hours_class     || r.month_hours_class     || 0);
  const gross = other + pt_earnings;

  let cut = 0;
  if (r.gym_cut_pct != null)   cut = pt_earnings * Number(r.gym_cut_pct) / 100;
  else if (r.gym_cut_fixed != null) cut = clients * Number(r.gym_cut_fixed);

  return { gross, cut, net: gross - cut, pt_earnings };
}

// Ganhos semanais (base_salary ÷ 4 para estimar a semana; PT/Mês ÷ 4 igualmente).
function calcWeekEarnings(w) {
  const clients = Number(w.pt_clients_count || 0);
  const pt_earnings = Number(w.rate_pt_month || 0) * clients / 4;
  const other =
    Number(w.base_salary || 0) / 4 +
    Number(w.rate_reception_h || 0) * Number(w.hours_reception || 0) +
    Number(w.rate_sala_h || 0)      * Number(w.hours_sala      || 0) +
    Number(w.rate_class_h || 0)     * Number(w.hours_class     || 0);
  const gross = other + pt_earnings;

  let cut = 0;
  if (w.gym_cut_pct != null)        cut = pt_earnings * Number(w.gym_cut_pct) / 100;
  else if (w.gym_cut_fixed != null) cut = clients * Number(w.gym_cut_fixed) / 4;

  const absent_deduction = Number(w.absent_deduction || 0);
  return { gross, cut, net: gross - cut - absent_deduction, pt_earnings, absent_deduction };
}

// ─── Modal taxas ───────────────────────────────────────────────────────────
function RatesModal({ staff, onClose, onSaved }) {
  const [form, setForm] = useState({
    base_salary:      String(staff.base_salary      || "0"),
    rate_reception_h: String(staff.rate_reception_h || "0"),
    rate_sala_h:      String(staff.rate_sala_h      || "0"),
    rate_class_h:     String(staff.rate_class_h     || "0"),
    rate_pt_month:    String(staff.rate_pt_month    || "0"),
    gym_cut_type:     staff.gym_cut_pct != null ? "pct" : staff.gym_cut_fixed != null ? "fixed" : "none",
    gym_cut_pct:      String(staff.gym_cut_pct   || "0"),
    gym_cut_fixed:    String(staff.gym_cut_fixed  || "0"),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(k, v) { setForm((prev) => ({ ...prev, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const body = {
      base_salary:      Number(form.base_salary),
      rate_reception_h: Number(form.rate_reception_h),
      rate_sala_h:      Number(form.rate_sala_h),
      rate_class_h:     Number(form.rate_class_h),
      rate_pt_month:    Number(form.rate_pt_month),
      gym_cut_pct:   form.gym_cut_type === "pct"   ? Number(form.gym_cut_pct)   : null,
      gym_cut_fixed: form.gym_cut_type === "fixed" ? Number(form.gym_cut_fixed) : null,
    };
    try {
      await apiRequest(`/finance/rates/${staff.id}`, { method: "PUT", body });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const field = (label, key, placeholder = "0") => (
    <div className="form-row" style={{ marginTop: 10 }}>
      <label className="field-label">{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input type="number" min="0" step="0.01" className="glass-input" style={{ flex: 1 }}
          value={form[key]} onChange={(e) => set(key, e.target.value)} placeholder={placeholder} required />
        <span className="text-secondary" style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}>€</span>
      </div>
    </div>
  );

  return (
    <Modal onClose={onClose}>
      <GlassCard className="preview-card" strong style={{ maxWidth: 420, width: "100%" }}>
        <h3>Taxas — {staff.name}</h3>
        <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
          {field("Salário base (€/mês)", "base_salary")}
          {field("Receção (€/h)", "rate_reception_h")}
          {field("Sala (€/h)", "rate_sala_h")}
          {field("Aula de grupo (€/h)", "rate_class_h")}
          {field("PT (€/mês por cliente)", "rate_pt_month")}

          <div className="form-row" style={{ marginTop: 14 }}>
            <label className="field-label">Retenção do ginásio</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              {["none", "pct", "fixed"].map((t) => (
                <button key={t} type="button"
                  className={`glass-button${form.gym_cut_type === t ? "" : " glass-button-secondary"}`}
                  style={{ fontSize: "0.8rem", padding: "4px 12px" }}
                  onClick={() => set("gym_cut_type", t)}>
                  {t === "none" ? "Nenhuma" : t === "pct" ? "Percentagem" : "Fixo"}
                </button>
              ))}
            </div>
            {form.gym_cut_type === "pct" && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="number" min="0" max="100" step="0.1" className="glass-input" style={{ flex: 1 }}
                  value={form.gym_cut_pct} onChange={(e) => set("gym_cut_pct", e.target.value)} required />
                <span className="text-secondary" style={{ fontSize: "0.85rem" }}>%</span>
              </div>
            )}
            {form.gym_cut_type === "fixed" && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="number" min="0" step="0.01" className="glass-input" style={{ flex: 1 }}
                  value={form.gym_cut_fixed} onChange={(e) => set("gym_cut_fixed", e.target.value)} required />
                <span className="text-secondary" style={{ fontSize: "0.85rem" }}>€/mês</span>
              </div>
            )}
          </div>

          {error && <p className="error-text">{error}</p>}
          <div className="form-actions">
            <button type="button" className="glass-button glass-button-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="glass-button" disabled={saving}>{saving ? "A guardar..." : "Guardar"}</button>
          </div>
        </form>
      </GlassCard>
    </Modal>
  );
}

// ─── Modal registo semanal ──────────────────────────────────────────────────
function AddWeekModal({ staffList, onClose, onSaved, editingWeek }) {
  const isEditing = !!editingWeek;
  const [staffId, setStaffId] = useState(isEditing ? String(editingWeek.staff_id) : "");
  const [weekStart, setWeekStart] = useState(isEditing ? editingWeek.week_start : getMondayOfWeek());
  const [form, setForm] = useState(isEditing ? {
    hours_reception: String(editingWeek.hours_reception || "0"),
    hours_sala:      String(editingWeek.hours_sala      || "0"),
    hours_class:     String(editingWeek.hours_class     || "0"),
    pt_clients_count: String(editingWeek.pt_clients_count || "0"),
    absent_hours:    String(editingWeek.absent_hours    || "0"),
    absent_deduction: String(editingWeek.absent_deduction || "0"),
    notes: editingWeek.notes || "",
  } : { hours_reception: "0", hours_sala: "0", hours_class: "0", pt_clients_count: "0", absent_hours: "0", absent_deduction: "0", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [absenceHint, setAbsenceHint] = useState(null);

  function set(k, v) { setForm((p) => ({ ...p, [k]: v })); }

  // Quando muda staff: pré-preencher horas a partir dos turnos semanais (só no modo criação).
  useEffect(() => {
    if (isEditing || !staffId) return;
    apiRequest("/shifts").then((allShifts) => {
      const mine = allShifts.filter((s) => String(s.staff_id) === String(staffId));
      const hSala = mine.filter((s) => s.activity !== "reception" && s.activity !== "class")
        .reduce((a, s) => a + (toMinutes(s.end_time) - toMinutes(s.start_time)) / 60, 0);
      const hRec  = mine.filter((s) => s.activity === "reception")
        .reduce((a, s) => a + (toMinutes(s.end_time) - toMinutes(s.start_time)) / 60, 0);
      const hCls  = mine.filter((s) => s.activity === "class")
        .reduce((a, s) => a + (toMinutes(s.end_time) - toMinutes(s.start_time)) / 60, 0);
      set("hours_sala",      String(Math.round(hSala * 10) / 10));
      set("hours_reception", String(Math.round(hRec  * 10) / 10));
      set("hours_class",     String(Math.round(hCls  * 10) / 10));
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId]);

  // Quando muda staff ou semana, vai buscar as faltas automáticas (só no modo criação).
  useEffect(() => {
    if (isEditing || !staffId || !weekStart) { setAbsenceHint(null); return; }
    apiRequest(`/occupancy/absences?week=${weekStart}`)
      .then((rows) => {
        const mine = rows.filter((r) => String(r.staff_id) === String(staffId) && r.was_absent);
        const totalHours = mine.reduce((s, r) => s + Number(r.shift_hours), 0);
        const totalDeduction = mine.reduce((s, r) => s + Number(r.shift_hours) * Number(r.hourly_rate), 0);
        if (mine.length > 0) {
          setAbsenceHint({ count: mine.length, hours: totalHours.toFixed(1), deduction: totalDeduction.toFixed(2) });
          set("absent_hours", totalHours.toFixed(2));
          set("absent_deduction", totalDeduction.toFixed(2));
        } else {
          setAbsenceHint(null);
          set("absent_hours", "0");
          set("absent_deduction", "0");
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId, weekStart]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!staffId) return setError("Escolhe um membro da equipa.");
    setSaving(true);
    setError("");
    try {
      await apiRequest("/finance/weeks", {
        method: "POST",
        body: {
          staff_id: Number(staffId), week_start: weekStart,
          hours_reception: Number(form.hours_reception), hours_sala: Number(form.hours_sala),
          hours_class: Number(form.hours_class), pt_clients_count: Number(form.pt_clients_count),
          absent_hours: Number(form.absent_hours), absent_deduction: Number(form.absent_deduction),
          notes: form.notes || null,
        },
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const hr = (label, key, step = "0.5") => (
    <div className="form-row" style={{ marginTop: 10 }}>
      <label className="field-label">{label}</label>
      <input type="number" min="0" step={step} className="glass-input"
        value={form[key]} onChange={(e) => set(key, e.target.value)} required />
    </div>
  );

  return (
    <Modal onClose={onClose}>
      <GlassCard className="preview-card" strong style={{ maxWidth: 400, width: "100%" }}>
        <h3>{isEditing ? `Editar semana — ${editingWeek.staff_name}` : "Registar semana"}</h3>
        {isEditing && editingWeek.confirmed && (
          <p style={{ fontSize: "0.82rem", color: "#f87171", margin: "6px 0 0" }}>
            Editar vai remover a confirmação desta semana.
          </p>
        )}
        <form onSubmit={handleSubmit} style={{ marginTop: 14 }}>
          {!isEditing && (
            <div className="form-row">
              <label className="field-label">Membro da equipa</label>
              <select className="glass-input" value={staffId} onChange={(e) => setStaffId(e.target.value)}
                style={{ color: "var(--text-primary)", background: "var(--glass-bg)" }}>
                <option value="">— Escolher —</option>
                {staffList.map((s) => <option key={s.id} value={s.id}>{s.name} ({ROLE_LABELS[s.role] || s.role})</option>)}
              </select>
            </div>
          )}
          {!isEditing && (
            <div className="form-row" style={{ marginTop: 10 }}>
              <label className="field-label">Semana</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button type="button" className="glass-button glass-button-secondary" style={{ padding: "4px 10px" }}
                  onClick={() => {
                    const d = new Date(`${weekStart}T00:00:00`);
                    d.setDate(d.getDate() - 7);
                    setWeekStart(d.toLocaleDateString("sv"));
                  }}>‹</button>
                <span style={{ flex: 1, textAlign: "center", fontSize: "0.9rem" }}>{weekLabel(weekStart)}</span>
                <button type="button" className="glass-button glass-button-secondary" style={{ padding: "4px 10px" }}
                  onClick={() => {
                    const d = new Date(`${weekStart}T00:00:00`);
                    d.setDate(d.getDate() + 7);
                    setWeekStart(d.toLocaleDateString("sv"));
                  }}>›</button>
              </div>
            </div>
          )}
          {isEditing && (
            <div className="form-row">
              <label className="field-label">Semana</label>
              <span className="glass-input" style={{ display: "block", opacity: 0.7, cursor: "default" }}>
                {weekLabel(weekStart)}
              </span>
            </div>
          )}
          {hr("Horas de receção", "hours_reception")}
          {hr("Horas de sala", "hours_sala")}
          {hr("Horas de aulas de grupo", "hours_class")}
          <div className="form-row" style={{ marginTop: 10 }}>
            <label className="field-label">Nº clientes PT activos</label>
            <input type="number" min="0" className="glass-input"
              value={form.pt_clients_count} onChange={(e) => set("pt_clients_count", e.target.value)} required />
          </div>

          <div style={{ marginTop: 14, borderTop: "1px solid var(--glass-border)", paddingTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label className="field-label" style={{ margin: 0 }}>Faltas</label>
              {absenceHint && (
                <span style={{ fontSize: "0.78rem", color: "#f87171" }}>
                  {absenceHint.count} turno(s) em falta · {absenceHint.hours}h · auto
                </span>
              )}
            </div>
            {hr("Horas em falta", "absent_hours")}
            <div className="form-row" style={{ marginTop: 10 }}>
              <label className="field-label">Desconto por faltas (€)</label>
              <input type="number" min="0" step="0.01" className="glass-input"
                value={form.absent_deduction} onChange={(e) => set("absent_deduction", e.target.value)} required />
            </div>
          </div>

          <div className="form-row" style={{ marginTop: 10 }}>
            <label className="field-label">Notas (opcional)</label>
            <input type="text" className="glass-input" value={form.notes}
              onChange={(e) => set("notes", e.target.value)} />
          </div>
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions">
            <button type="button" className="glass-button glass-button-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="glass-button" disabled={saving}>{saving ? "A guardar..." : "Guardar"}</button>
          </div>
        </form>
      </GlassCard>
    </Modal>
  );
}

// ─── Modal confirmação de pagamento mensal ──────────────────────────────────
function PayMonthModal({ staff, weekData, month, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [expandedIds, setExpandedIds] = useState(new Set());

  function toggleExpand(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Agrupa semanas por staff_id e calcula totais do mês
  const totals = staff.map((s) => {
    const sw = weekData.filter((w) => String(w.staff_id) === String(s.id));
    if (!sw.length) return null;
    const hSala = sw.reduce((a, w) => a + Number(w.hours_sala || 0), 0);
    const hRec  = sw.reduce((a, w) => a + Number(w.hours_reception || 0), 0);
    const hCls  = sw.reduce((a, w) => a + Number(w.hours_class || 0), 0);
    const clients = Math.max(...sw.map((w) => Number(w.pt_clients_count || 0)));
    const abH   = sw.reduce((a, w) => a + Number(w.absent_hours || 0), 0);
    const abD   = sw.reduce((a, w) => a + Number(w.absent_deduction || 0), 0);
    const { gross, cut, net } = calcEarnings({
      ...s,
      hours_reception: hRec, hours_sala: hSala, hours_class: hCls, pt_clients_count: clients,
      month_hours_reception: hRec, month_hours_sala: hSala, month_hours_class: hCls, month_pt_clients: clients,
    });
    return { s, hSala, hRec, hCls, clients, abH, abD, gross, cut, net };
  }).filter(Boolean);

  async function handlePay() {
    setSaving(true);
    setError("");
    try {
      for (const t of totals) {
        await apiRequest("/finance/payments", {
          method: "POST",
          body: {
            staff_id: t.s.id, month,
            hours_sala: t.hSala, hours_reception: t.hRec, hours_class: t.hCls,
            pt_clients_count: t.clients, absent_hours: t.abH,
            gross: t.gross, gym_cut: t.cut, absent_deduction: t.abD, net: t.net,
            notes: notes || null,
          },
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const totalNet = totals.reduce((a, t) => a + t.net, 0);

  return (
    <Modal onClose={onClose}>
      <GlassCard className="preview-card" strong style={{ maxWidth: 460, width: "100%" }}>
        <h3>Confirmar pagamento — <span style={{ textTransform: "capitalize" }}>{monthLabelFull(month)}</span></h3>
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 2 }}>
          {totals.map((t) => {
            const staffWeeks = weekData.filter((w) => String(w.staff_id) === String(t.s.id));
            const isExpanded = expandedIds.has(t.s.id);
            return (
              <div key={t.s.id} style={{ borderBottom: "1px solid var(--glass-border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem", padding: "8px 0", cursor: staffWeeks.length > 0 ? "pointer" : "default" }}
                  onClick={() => staffWeeks.length > 0 && toggleExpand(t.s.id)}>
                  <div>
                    <strong style={{ borderBottom: staffWeeks.length > 0 ? "1px dotted var(--text-secondary)" : "none" }}>
                      {t.s.name} {staffWeeks.length > 0 && <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>{isExpanded ? "▲" : "▼"}</span>}
                    </strong>
                    <span className="text-secondary" style={{ marginLeft: 6, fontSize: "0.78rem" }}>{ROLE_LABELS[t.s.role] || t.s.role}</span>
                    {t.abD > 0 && <div style={{ fontSize: "0.75rem", color: "#f87171" }}>Desconto faltas: – {fmtEuro(t.abD)}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="text-secondary" style={{ fontSize: "0.78rem" }}>Bruto: {fmtEuro(t.gross)}</div>
                    <strong>{fmtEuro(t.net)}</strong>
                  </div>
                </div>
                {isExpanded && staffWeeks.length > 0 && (
                  <div style={{ paddingBottom: 8, paddingLeft: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                    {staffWeeks.map((w, wi) => {
                      const we = calcWeekEarnings(w);
                      return (
                        <div key={wi} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", padding: "3px 0" }}>
                          <div>
                            <span className="text-secondary">{weekLabel(w.week_start)}</span>
                            <div className="text-secondary" style={{ fontSize: "0.72rem" }}>
                              {Number(w.hours_sala) > 0 && `Sala ${w.hours_sala}h  `}
                              {Number(w.hours_reception) > 0 && `Rec. ${w.hours_reception}h  `}
                              {Number(w.hours_class) > 0 && `Aulas ${w.hours_class}h  `}
                              {Number(w.pt_clients_count) > 0 && `${w.pt_clients_count} clientes PT`}
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            {we.absent_deduction > 0 && <div style={{ color: "#f87171", fontSize: "0.72rem" }}>– {fmtEuro(we.absent_deduction)}</div>}
                            <span>{fmtEuro(we.net)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontWeight: 700, fontSize: "1rem" }}>
          <span>Total a pagar</span>
          <span>{fmtEuro(totalNet)}</span>
        </div>
        <div className="form-row" style={{ marginTop: 12 }}>
          <label className="field-label">Notas (opcional)</label>
          <input className="glass-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: Transferência bancária em 05/10" />
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="form-actions" style={{ marginTop: 14 }}>
          <button className="glass-button glass-button-secondary" onClick={onClose}>Cancelar</button>
          <button className="glass-button" onClick={handlePay} disabled={saving || !totals.length}>
            {saving ? "A registar..." : "Confirmar pagamento"}
          </button>
        </div>
      </GlassCard>
    </Modal>
  );
}

// ─── Página principal ───────────────────────────────────────────────────────
export default function FinancePage() {
  const [staffList, setStaffList] = useState([]);
  const [weeks, setWeeks] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingRates, setEditingRates] = useState(null);
  const [addingWeek, setAddingWeek] = useState(false);
  const [editingWeek, setEditingWeek] = useState(null);
  const [payingMonth, setPayingMonth] = useState(false);
  const [tab, setTab] = useState("staff");
  const [weekMonth, setWeekMonth] = useState(prevMonthYM(currentYM()));
  const [payMonth, setPayMonth] = useState(prevMonthYM(currentYM()));
  function loadWeeks(month) {
    apiRequest(`/finance/weeks?month=${month}`).then(setWeeks).catch(() => {});
  }
  function loadPayments(month) {
    apiRequest(`/finance/payments?month=${month}`).then(setPayments).catch(() => {});
  }

  function load() {
    setLoading(true);
    Promise.all([apiRequest("/finance/staff"), apiRequest(`/finance/weeks?month=${weekMonth}`)])
      .then(([s, w]) => { setStaffList(s); setWeeks(w); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadWeeks(weekMonth); }, [weekMonth]);
  useEffect(() => { loadPayments(payMonth); }, [payMonth]);

  async function deletePayment(id) {
    if (!window.confirm("Anular este pagamento?")) return;
    try {
      await apiRequest(`/finance/payments/${id}`, { method: "DELETE" });
      loadPayments(payMonth);
    } catch (err) {
      setError(err.message);
    }
  }

  function exportPDF() {
    const month = weekMonth;
    const win = window.open("", "_blank", "width=800,height=700");
    if (!win) return;
    const rows = staffList.map((s) => {
      const sw = weeks.filter((w) => String(w.staff_id) === String(s.id));
      if (!sw.length) return "";
      const hSala = sw.reduce((a, w) => a + Number(w.hours_sala || 0), 0);
      const hRec  = sw.reduce((a, w) => a + Number(w.hours_reception || 0), 0);
      const hCls  = sw.reduce((a, w) => a + Number(w.hours_class || 0), 0);
      const clients = Math.max(...sw.map((w) => Number(w.pt_clients_count || 0)));
      const abD = sw.reduce((a, w) => a + Number(w.absent_deduction || 0), 0);
      const { gross, cut, net } = calcEarnings({
        ...s,
        hours_reception: hRec, hours_sala: hSala, hours_class: hCls, pt_clients_count: clients,
        month_hours_reception: hRec, month_hours_sala: hSala, month_hours_class: hCls, month_pt_clients: clients,
      });
      return `<tr>
        <td>${s.name}<br><small>${ROLE_LABELS[s.role] || s.role}</small></td>
        <td>${hSala}h</td><td>${hRec}h</td><td>${hCls}h</td>
        <td>${clients}</td>
        <td>${fmtEuro(gross)}</td>
        <td style="color:#16a34a">${fmtEuro(cut)}</td>
        <td style="color:#dc2626">${abD > 0 ? fmtEuro(abD) : "–"}</td>
        <td><strong>${fmtEuro(net)}</strong></td>
      </tr>`;
    }).filter(Boolean).join("");
    win.document.write(`<!doctype html><html><head><meta charset="utf-8">
    <title>Relatório Financeiro – ${monthLabelFull(month)}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
      h1 { font-size: 1.3rem; margin-bottom: 4px; }
      p.sub { color: #666; margin: 0 0 20px; font-size: 0.85rem; }
      table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
      th { background: #f3f4f6; text-align: left; padding: 8px 10px; border-bottom: 2px solid #ddd; }
      td { padding: 7px 10px; border-bottom: 1px solid #eee; vertical-align: top; }
      small { color: #666; }
      @media print { button { display: none; } }
    </style></head><body>
    <h1>Relatório Financeiro</h1>
    <p class="sub" style="text-transform:capitalize">${monthLabelFull(month)}</p>
    <table>
      <thead><tr>
        <th>Nome</th><th>Sala (h)</th><th>Rec. (h)</th><th>Aulas (h)</th>
        <th>Clientes PT</th><th>Bruto</th><th>Retenção</th><th>Faltas</th><th>A pagar</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <br><button onclick="window.print()">Imprimir / Guardar PDF</button>
    </body></html>`);
    win.document.close();
    win.focus();
  }

  const gymCutMonth = staffList.reduce((sum, s) => {
    const { cut } = calcEarnings({ ...s, hours_reception: s.month_hours_reception, hours_sala: s.month_hours_sala, hours_class: s.month_hours_class, pt_clients_count: s.month_pt_clients });
    return sum + cut;
  }, 0);

  const grossMonth = staffList.reduce((sum, s) => {
    const { gross } = calcEarnings({ ...s, hours_reception: s.month_hours_reception, hours_sala: s.month_hours_sala, hours_class: s.month_hours_class, pt_clients_count: s.month_pt_clients });
    return sum + gross;
  }, 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Gestão Financeira</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="glass-button glass-button-secondary" onClick={exportPDF}>⬇ Transferir relatório</button>
          <button className="glass-button" onClick={() => setAddingWeek(true)}>+ Registar semana</button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button className={`glass-button${tab === "staff" ? "" : " glass-button-secondary"}`} onClick={() => setTab("staff")}>Equipa</button>
        <button className={`glass-button${tab === "weeks" ? "" : " glass-button-secondary"}`} onClick={() => setTab("weeks")}>Registos semanais</button>
        <button className={`glass-button${tab === "payments" ? "" : " glass-button-secondary"}`} onClick={() => setTab("payments")}>Pagamentos</button>
      </div>

      {loading && <p className="text-secondary">A carregar...</p>}

      {!loading && tab === "staff" && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <GlassCard style={{ flex: 1, minWidth: 180, padding: "12px 18px" }}>
              <div className="text-secondary" style={{ fontSize: "0.82rem" }}>Total bruto este mês</div>
              <strong style={{ fontSize: "1.15rem" }}>{fmtEuro(grossMonth)}</strong>
            </GlassCard>
            <GlassCard style={{ flex: 1, minWidth: 180, padding: "12px 18px" }}>
              <div className="text-secondary" style={{ fontSize: "0.82rem" }}>Retenção ginásio</div>
              <strong style={{ fontSize: "1.15rem", color: "#4ade80" }}>{fmtEuro(gymCutMonth)}</strong>
            </GlassCard>
            <GlassCard style={{ flex: 1, minWidth: 180, padding: "12px 18px" }}>
              <div className="text-secondary" style={{ fontSize: "0.82rem" }}>Custo líquido</div>
              <strong style={{ fontSize: "1.15rem" }}>{fmtEuro(grossMonth - gymCutMonth)}</strong>
            </GlassCard>
          </div>

          <div className="member-grid">
            {staffList.map((s) => {
              const { gross, cut, net } = calcEarnings({ ...s, hours_reception: s.month_hours_reception, hours_sala: s.month_hours_sala, hours_class: s.month_hours_class, pt_clients_count: s.month_pt_clients });
              const url = resolveAssetUrl(s.avatar_url);
              const hasCut = s.gym_cut_pct != null || s.gym_cut_fixed != null;
              return (
                <GlassCard key={s.id} className="member-tile" strong>
                  <div className="member-tile-header">
                    {url
                      ? <img src={url} alt="" className="member-card-avatar" />
                      : <span className="member-card-avatar member-card-avatar-fallback">{s.name.charAt(0).toUpperCase()}</span>}
                    <div className="member-tile-identity">
                      <span className="member-tile-name">{s.name}</span>
                      <span className="text-secondary" style={{ fontSize: "0.8rem" }}>{ROLE_LABELS[s.role] || s.role}</span>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, fontSize: "0.83rem", display: "flex", flexDirection: "column", gap: 3 }}>
                    {[
                      ["Salário base", fmtEuro(s.base_salary) + "/mês"],
                      ["Receção", fmtEuro(s.rate_reception_h) + "/h · " + (s.month_hours_reception || 0) + "h"],
                      ["Sala", fmtEuro(s.rate_sala_h) + "/h · " + (s.month_hours_sala || 0) + "h"],
                      ["Aulas de grupo", fmtEuro(s.rate_class_h) + "/h · " + (s.month_hours_class || 0) + "h"],
                      ["PT clientes", fmtEuro(s.rate_pt_month) + "/mês · " + (s.month_pt_clients || 0) + " clientes"],
                    ].map(([label, val]) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span className="text-secondary">{label}</span>
                        <span>{val}</span>
                      </div>
                    ))}

                    <div style={{ borderTop: "1px solid var(--glass-border)", paddingTop: 4, marginTop: 4, display: "flex", flexDirection: "column", gap: 3 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span className="text-secondary">Total bruto</span>
                        <span>{fmtEuro(gross)}</span>
                      </div>
                      {hasCut && (
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span className="text-secondary">
                            Retenção ginásio {s.gym_cut_pct != null ? `(${s.gym_cut_pct}%)` : `(fixo)`}
                          </span>
                          <span style={{ color: "#4ade80" }}>– {fmtEuro(cut)}</span>
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
                        <span>A pagar</span>
                        <span>{fmtEuro(net)}</span>
                      </div>
                    </div>
                  </div>

                  <button type="button" className="glass-button glass-button-secondary"
                    style={{ marginTop: 12, width: "100%", fontSize: "0.82rem" }}
                    onClick={() => setEditingRates(s)}>
                    Editar taxas
                  </button>
                </GlassCard>
              );
            })}
          </div>
        </>
      )}

      {!loading && tab === "weeks" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <button className="glass-button glass-button-secondary" style={{ padding: "4px 10px" }} onClick={() => setWeekMonth(prevMonthYM(weekMonth))}>‹</button>
            <span style={{ minWidth: 130, textAlign: "center", fontSize: "0.92rem", textTransform: "capitalize" }}>{monthLabelFull(weekMonth)}</span>
            <button className="glass-button glass-button-secondary" style={{ padding: "4px 10px" }} disabled={weekMonth >= currentYM()} onClick={() => setWeekMonth(nextMonthYM(weekMonth))}>›</button>
            {weeks.length > 0 && (
              <button className="glass-button" style={{ marginLeft: "auto", fontSize: "0.82rem" }} onClick={() => setPayingMonth(true)}>
                Confirmar pagamento do mês
              </button>
            )}
          </div>
          {weeks.length === 0 && <p className="text-secondary">Ainda não há registos para este mês.</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {weeks.map((w) => {
              const { gross, cut, net, absent_deduction } = calcWeekEarnings(w);
              return (
                <GlassCard key={w.id} style={{ padding: "14px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <strong>{w.staff_name}</strong>
                      <span className="text-secondary" style={{ marginLeft: 8, fontSize: "0.8rem" }}>{ROLE_LABELS[w.staff_role] || w.staff_role}</span>
                      <div className="text-secondary" style={{ fontSize: "0.82rem", marginTop: 2 }}>{weekLabel(w.week_start)}</div>
                      <div style={{ fontSize: "0.8rem", marginTop: 4, color: "var(--text-secondary)" }}>
                        {w.hours_reception > 0 && `Recep. ${w.hours_reception}h  `}
                        {w.hours_sala > 0 && `Sala ${w.hours_sala}h  `}
                        {w.hours_class > 0 && `Aulas ${w.hours_class}h  `}
                        {w.pt_clients_count > 0 && `PT ${w.pt_clients_count} clientes`}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", fontSize: "0.85rem" }}>
                      <div>Bruto: {fmtEuro(gross)}</div>
                      {cut > 0 && <div style={{ color: "#4ade80" }}>Ginásio: {fmtEuro(cut)}</div>}
                      {absent_deduction > 0 && <div style={{ color: "#f87171" }}>Faltas: – {fmtEuro(absent_deduction)}</div>}
                      <strong>A pagar: {fmtEuro(net)}</strong>
                    </div>
                  </div>
                  {w.notes && <p className="text-secondary" style={{ fontSize: "0.82rem", marginTop: 6 }}>{w.notes}</p>}
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {w.confirmed && (
                      <span className="role-badge role-badge-static" style={{ background: "rgba(34,197,94,0.18)", color: "#4ade80" }}>
                        ✓ Confirmado por {w.confirmed_by_name} · {fmtDate(w.confirmed_at)}
                      </span>
                    )}
                    <button type="button" className="glass-button glass-button-secondary"
                      style={{ fontSize: "0.82rem", padding: "4px 12px" }}
                      onClick={() => setEditingWeek(w)}>
                      Editar
                    </button>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </>
      )}

      {/* ── Pagamentos mensais ── */}
      {tab === "payments" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <button className="glass-button glass-button-secondary" style={{ padding: "4px 10px" }} onClick={() => setPayMonth(prevMonthYM(payMonth))}>‹</button>
            <span style={{ minWidth: 130, textAlign: "center", fontSize: "0.92rem", textTransform: "capitalize" }}>{monthLabelFull(payMonth)}</span>
            <button className="glass-button glass-button-secondary" style={{ padding: "4px 10px" }} disabled={payMonth >= currentYM()} onClick={() => setPayMonth(nextMonthYM(payMonth))}>›</button>
          </div>
          {payments.length === 0 && <p className="text-secondary">Sem pagamentos confirmados para este mês.</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {payments.map((p) => (
              <GlassCard key={p.id} style={{ padding: "14px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <strong>{p.staff_name}</strong>
                    <span className="text-secondary" style={{ marginLeft: 8, fontSize: "0.8rem" }}>{ROLE_LABELS[p.staff_role] || p.staff_role}</span>
                    <div className="text-secondary" style={{ fontSize: "0.78rem", marginTop: 4 }}>
                      {Number(p.hours_sala) > 0 && `Sala ${p.hours_sala}h  `}
                      {Number(p.hours_reception) > 0 && `Rec. ${p.hours_reception}h  `}
                      {Number(p.hours_class) > 0 && `Aulas ${p.hours_class}h  `}
                      {p.pt_clients_count > 0 && `${p.pt_clients_count} clientes PT`}
                    </div>
                    <div className="text-secondary" style={{ fontSize: "0.75rem", marginTop: 2 }}>
                      Pago em {fmtDate(p.paid_at)}{p.confirmed_by_name && ` por ${p.confirmed_by_name}`}
                    </div>
                    {p.notes && <div className="text-secondary" style={{ fontSize: "0.75rem" }}>{p.notes}</div>}
                  </div>
                  <div style={{ textAlign: "right", fontSize: "0.85rem" }}>
                    <div className="text-secondary">Bruto: {fmtEuro(p.gross)}</div>
                    {Number(p.gym_cut) > 0 && <div style={{ color: "#4ade80" }}>Ginásio: – {fmtEuro(p.gym_cut)}</div>}
                    {Number(p.absent_deduction) > 0 && <div style={{ color: "#f87171" }}>Faltas: – {fmtEuro(p.absent_deduction)}</div>}
                    <strong style={{ fontSize: "1rem" }}>{fmtEuro(p.net)}</strong>
                    <div>
                      <button className="nf-text-danger" style={{ fontSize: "0.75rem", marginTop: 6 }}
                        onClick={() => deletePayment(p.id)}>Anular</button>
                    </div>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
          {payments.length > 0 && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12, fontWeight: 700 }}>
              Total pago: {fmtEuro(payments.reduce((a, p) => a + Number(p.net), 0))}
            </div>
          )}
        </>
      )}

      {editingRates && (
        <RatesModal staff={editingRates} onClose={() => setEditingRates(null)} onSaved={load} />
      )}
      {(addingWeek || editingWeek) && (
        <AddWeekModal
          staffList={staffList}
          editingWeek={editingWeek}
          onClose={() => { setAddingWeek(false); setEditingWeek(null); }}
          onSaved={() => loadWeeks(weekMonth)}
        />
      )}
      {payingMonth && (
        <PayMonthModal
          staff={staffList}
          weekData={weeks}
          month={weekMonth}
          onClose={() => setPayingMonth(false)}
          onSaved={() => { loadPayments(payMonth); setPayingMonth(false); setTab("payments"); setPayMonth(weekMonth); }}
        />
      )}
    </div>
  );
}
