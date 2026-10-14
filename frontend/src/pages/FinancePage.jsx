import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import Modal from "../components/Modal";
import { apiRequest, resolveAssetUrl } from "../api/client";
import { ROLE_LABELS } from "../utils/roles";

// ─── Helpers ───────────────────────────────────────────────────────────────
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
function fmtDate(str) {
  if (!str) return "";
  const MONTHS = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  const d = new Date(`${str}T00:00:00`);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtEuro(n) {
  return Number(n || 0).toFixed(2).replace(".", ",") + " €";
}

const DAY_NAMES = ["", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const ACTIVITY_LABELS = { floor: "Sala", class: "Aula", reception: "Receção", assessments: "Avaliações", admin: "Admin", other: "Outro" };

// Gym cut only applies to gym clients, never to external clients (100% to PT).
function calcEarnings(r, gymClientsOverride) {
  const gymClients = gymClientsOverride != null
    ? Number(gymClientsOverride)
    : Number(r.month_gym_clients ?? r.pt_clients_count ?? 0);
  const extIncome = Number(r.month_ext_income || 0);
  const gym_pt_earnings = Number(r.rate_pt_month || 0) * gymClients;
  const other =
    Number(r.base_salary || 0) +
    Number(r.rate_reception_h || 0) * Number(r.hours_reception || r.month_hours_reception || 0) +
    Number(r.rate_sala_h || 0)      * Number(r.hours_sala      || r.month_hours_sala      || 0) +
    Number(r.rate_class_h || 0)     * Number(r.hours_class     || r.month_hours_class     || 0);
  const gross = other + gym_pt_earnings + extIncome;
  let cut = 0;
  if (r.gym_cut_pct != null)        cut = gym_pt_earnings * Number(r.gym_cut_pct) / 100;
  else if (r.gym_cut_fixed != null) cut = gymClients * Number(r.gym_cut_fixed);
  return { gross, cut, net: gross - cut, gym_pt_earnings, extIncome };
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
  function set(k, v) { setForm((p) => ({ ...p, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true); setError("");
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
      onSaved(); onClose();
    } catch (err) { setError(err.message); setSaving(false); }
  }

  const field = (label, key) => (
    <div className="form-row" style={{ marginTop: 10 }}>
      <label className="field-label">{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input type="number" min="0" step="0.01" className="glass-input" style={{ flex: 1 }}
          value={form[key]} onChange={(e) => set(key, e.target.value)} required />
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

// ─── Modal registos mensais de um staff (com link para editar cada dia) ────
function StaffMonthModal({ staffId, staffName, month, onClose }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest(`/attendance/monthly?staff_id=${staffId}&month=${month}`)
      .then(setRows).catch(() => {}).finally(() => setLoading(false));
  }, [staffId, month]);

  const present  = rows.filter((r) => r.status === "present").length;
  const adjusted = rows.filter((r) => r.status === "adjusted").length;
  const absent   = rows.filter((r) => r.status === "absent").length;
  const pending  = rows.filter((r) => r.status === "pending").length;

  const statusColor = (s) => ({ present: "#4ade80", adjusted: "#f59e0b", absent: "#f87171", pending: "var(--text-secondary)" }[s]);
  const statusLabel = (s) => ({ present: "Presente", adjusted: "Ajustado", absent: "Falta", pending: "Por confirmar" }[s] || s);

  return (
    <Modal onClose={onClose}>
      <GlassCard className="preview-card" strong style={{ maxWidth: 520, width: "100%", maxHeight: "82vh", overflowY: "auto" }}>
        <h3>{staffName} — <span style={{ textTransform: "capitalize" }}>{monthLabelFull(month)}</span></h3>

        <div style={{ display: "flex", gap: 8, marginTop: 10, marginBottom: 14, flexWrap: "wrap" }}>
          {[
            present  > 0 && { label: `${present} presente${present !== 1 ? "s" : ""}`,   color: "#4ade80" },
            adjusted > 0 && { label: `${adjusted} ajustado${adjusted !== 1 ? "s" : ""}`, color: "#f59e0b" },
            absent   > 0 && { label: `${absent} falta${absent !== 1 ? "s" : ""}`,         color: "#f87171" },
            pending  > 0 && { label: `${pending} por confirmar`,                           color: "var(--text-secondary)" },
          ].filter(Boolean).map((c, i) => (
            <span key={i} className="role-badge role-badge-static"
              style={{ background: "rgba(255,255,255,0.06)", color: c.color, fontSize: "0.78rem" }}>
              {c.label}
            </span>
          ))}
        </div>

        {loading && <p className="text-secondary">A carregar...</p>}
        {!loading && rows.length === 0 && <p className="text-secondary">Sem registos de presença para este mês.</p>}
        {!loading && rows.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {rows.map((r, i) => (
              <div key={i}
                style={{
                  display: "flex", gap: 10, fontSize: "0.82rem", padding: "7px 10px",
                  borderRadius: 6, cursor: "pointer", alignItems: "center",
                  background: r.status === "absent" ? "rgba(248,113,113,0.07)" :
                               r.status === "adjusted" ? "rgba(245,158,11,0.07)" : "rgba(255,255,255,0.02)",
                  transition: "background 0.15s",
                }}
                onClick={() => { navigate(`/staff-attendance?date=${r.shift_date}`); onClose(); }}
                title="Clicar para ver/editar presenças deste dia">
                <span style={{ minWidth: 54, color: "var(--text-secondary)", fontSize: "0.78rem", flexShrink: 0 }}>
                  {DAY_NAMES[r.weekday]} {r.shift_date.slice(8)}
                </span>
                <span style={{ minWidth: 94, flexShrink: 0 }}>{r.shift_start}–{r.shift_end}</span>
                <span className="text-secondary" style={{ flex: 1, fontSize: "0.78rem" }}>
                  {ACTIVITY_LABELS[r.activity] || r.activity}
                </span>
                <span style={{ fontWeight: 600, color: statusColor(r.status), whiteSpace: "nowrap", fontSize: "0.8rem" }}>
                  {statusLabel(r.status)}
                  {Number(r.deducted_hours) > 0 && ` −${Number(r.deducted_hours).toFixed(1)}h`}
                </span>
                <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem", flexShrink: 0 }}>›</span>
              </div>
            ))}
          </div>
        )}

        {rows.length > 0 && (
          <p className="text-secondary" style={{ fontSize: "0.75rem", marginTop: 10 }}>
            Clica num registo para abrir o horário desse dia e editar presenças.
          </p>
        )}
        <div className="form-actions" style={{ marginTop: 14 }}>
          <button className="glass-button" onClick={onClose}>Fechar</button>
        </div>
      </GlassCard>
    </Modal>
  );
}

// ─── Modal confirmação de pagamento mensal ──────────────────────────────────
function PayMonthModal({ staffList, month, onClose, onSaved }) {
  const [ptClients, setPtClients] = useState(() => {
    const init = {};
    staffList.forEach((s) => { init[s.id] = String(s.month_gym_clients || 0); });
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  // Only include staff that have any attendance or a base salary
  const totals = staffList
    .filter((s) =>
      Number(s.month_hours_sala) > 0 ||
      Number(s.month_hours_reception) > 0 ||
      Number(s.month_hours_class) > 0 ||
      Number(ptClients[s.id]) > 0 ||
      Number(s.base_salary) > 0
    )
    .map((s) => {
      const clients = Number(ptClients[s.id] || 0);
      const { gross, cut, net } = calcEarnings(s, clients);
      return { s, gross, cut, net, clients };
    });

  async function handlePay() {
    setSaving(true); setError("");
    try {
      for (const t of totals) {
        await apiRequest("/finance/payments", {
          method: "POST",
          body: {
            staff_id: t.s.id, month,
            hours_sala:       Number(t.s.month_hours_sala),
            hours_reception:  Number(t.s.month_hours_reception),
            hours_class:      Number(t.s.month_hours_class),
            pt_clients_count: t.clients,
            absent_hours: 0,
            gross: t.gross, gym_cut: t.cut, absent_deduction: 0, net: t.net,
            notes: notes || null,
          },
        });
      }
      onSaved(); onClose();
    } catch (err) { setError(err.message); setSaving(false); }
  }

  const totalNet = totals.reduce((a, t) => a + t.net, 0);

  return (
    <Modal onClose={onClose}>
      <GlassCard className="preview-card" strong style={{ maxWidth: 480, width: "100%", maxHeight: "80vh", overflowY: "auto" }}>
        <h3>Confirmar pagamento — <span style={{ textTransform: "capitalize" }}>{monthLabelFull(month)}</span></h3>
        <p className="text-secondary" style={{ fontSize: "0.82rem", marginTop: 4, marginBottom: 14 }}>
          Horas calculadas automaticamente a partir dos registos de presença.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {totals.map((t) => (
            <div key={t.s.id} style={{ borderBottom: "1px solid var(--glass-border)", padding: "10px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: "0.92rem" }}>{t.s.name}</strong>
                  <span className="text-secondary" style={{ marginLeft: 6, fontSize: "0.78rem" }}>{ROLE_LABELS[t.s.role] || t.s.role}</span>
                  <div className="text-secondary" style={{ fontSize: "0.76rem", marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {Number(t.s.month_hours_sala) > 0       && <span>Sala {t.s.month_hours_sala}h</span>}
                    {Number(t.s.month_hours_reception) > 0  && <span>Rec. {t.s.month_hours_reception}h</span>}
                    {Number(t.s.month_hours_class) > 0      && <span>Aulas {t.s.month_hours_class}h</span>}
                    {Number(t.s.rate_pt_month) > 0 && (
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        PT
                        <input type="number" min="0" className="glass-input"
                          style={{ width: 48, height: 22, padding: "2px 4px", fontSize: "0.76rem", display: "inline" }}
                          value={ptClients[t.s.id]}
                          onChange={(e) => setPtClients((p) => ({ ...p, [t.s.id]: e.target.value }))} />
                        clientes
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div className="text-secondary" style={{ fontSize: "0.76rem" }}>Bruto: {fmtEuro(t.gross)}</div>
                  {t.cut > 0 && <div style={{ color: "#4ade80", fontSize: "0.76rem" }}>–{fmtEuro(t.cut)}</div>}
                  <strong style={{ fontSize: "0.95rem" }}>{fmtEuro(t.net)}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
        {totals.length === 0 && (
          <p className="text-secondary">Nenhum membro com registos neste mês.</p>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontWeight: 700, fontSize: "1rem" }}>
          <span>Total a pagar</span>
          <span>{fmtEuro(totalNet)}</span>
        </div>
        <div className="form-row" style={{ marginTop: 12 }}>
          <label className="field-label">Notas (opcional)</label>
          <input className="glass-input" value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Transferência bancária em 05/10" />
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
  const navigate = useNavigate();
  const [staffList, setStaffList] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingRates, setEditingRates] = useState(null);
  const [payingMonth, setPayingMonth] = useState(false);
  const [viewingStaff, setViewingStaff] = useState(null); // { id, name }
  const [tab, setTab] = useState("staff");
  const [staffMonth, setStaffMonth] = useState(prevMonthYM(currentYM()));
  const [payMonth, setPayMonth] = useState(prevMonthYM(currentYM()));

  function load(month) {
    setLoading(true);
    apiRequest(`/finance/staff?month=${month}`)
      .then(setStaffList)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  function loadPayments(month) {
    apiRequest(`/finance/payments?month=${month}`).then(setPayments).catch(() => {});
  }

  useEffect(() => { load(staffMonth); }, [staffMonth]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadPayments(payMonth); }, [payMonth]);

  const grossMonth   = staffList.reduce((s, st) => s + calcEarnings(st).gross, 0);
  const gymCutMonth  = staffList.reduce((s, st) => s + calcEarnings(st).cut,   0);
  const hasAttendance = staffList.some((s) => Number(s.shifts_present) + Number(s.shifts_adjusted) + Number(s.shifts_absent) > 0);

  function exportPDF() {
    const win = window.open("", "_blank", "width=800,height=700");
    if (!win) return;
    const rows = staffList.map((s) => {
      const { gross, cut, net } = calcEarnings(s);
      return `<tr>
        <td>${s.name}<br><small>${ROLE_LABELS[s.role] || s.role}</small></td>
        <td>${s.month_hours_sala || 0}h</td>
        <td>${s.month_hours_reception || 0}h</td>
        <td>${s.month_hours_class || 0}h</td>
        <td>${fmtEuro(gross)}</td>
        <td style="color:#16a34a">${fmtEuro(cut)}</td>
        <td><strong>${fmtEuro(net)}</strong></td>
      </tr>`;
    }).join("");
    win.document.write(`<!doctype html><html><head><meta charset="utf-8">
    <title>Relatório – ${monthLabelFull(staffMonth)}</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;color:#111}
    h1{font-size:1.3rem;margin-bottom:4px}p.sub{color:#666;margin:0 0 20px;font-size:.85rem}
    table{width:100%;border-collapse:collapse;font-size:.88rem}
    th{background:#f3f4f6;text-align:left;padding:8px 10px;border-bottom:2px solid #ddd}
    td{padding:7px 10px;border-bottom:1px solid #eee;vertical-align:top}
    small{color:#666}@media print{button{display:none}}</style>
    </head><body>
    <h1>Relatório Financeiro</h1>
    <p class="sub" style="text-transform:capitalize">${monthLabelFull(staffMonth)}</p>
    <table><thead><tr>
      <th>Nome</th><th>Sala (h)</th><th>Rec. (h)</th><th>Aulas (h)</th>
      <th>Bruto</th><th>Retenção</th><th>A pagar</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <br><button onclick="window.print()">Imprimir / Guardar PDF</button>
    </body></html>`);
    win.document.close(); win.focus();
  }

  // Shared month nav UI
  const MonthNav = ({ month, setMonth, max }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
      <button className="glass-button glass-button-secondary" style={{ padding: "4px 10px" }}
        onClick={() => setMonth(prevMonthYM(month))}>‹</button>
      <span style={{ minWidth: 140, textAlign: "center", fontSize: "0.92rem", textTransform: "capitalize" }}>
        {monthLabelFull(month)}
      </span>
      <button className="glass-button glass-button-secondary" style={{ padding: "4px 10px" }}
        disabled={max && month >= max} onClick={() => setMonth(nextMonthYM(month))}>›</button>
    </div>
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Gestão Financeira</h1>
        <button className="glass-button glass-button-secondary" onClick={exportPDF}>⬇ Relatório</button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button className={`glass-button${tab === "staff" ? "" : " glass-button-secondary"}`} onClick={() => setTab("staff")}>Equipa</button>
        <button className={`glass-button${tab === "records" ? "" : " glass-button-secondary"}`} onClick={() => setTab("records")}>Registos</button>
        <button className={`glass-button${tab === "payments" ? "" : " glass-button-secondary"}`} onClick={() => setTab("payments")}>Pagamentos</button>
      </div>

      {/* ── Equipa ── */}
      {tab === "staff" && (
        <>
          <MonthNav month={staffMonth} setMonth={setStaffMonth} max={currentYM()} />

          {loading && <p className="text-secondary">A carregar...</p>}

          {!loading && (
            <>
              <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                <GlassCard style={{ flex: 1, minWidth: 160, padding: "12px 18px" }}>
                  <div className="text-secondary" style={{ fontSize: "0.82rem" }}>Total bruto</div>
                  <strong style={{ fontSize: "1.15rem" }}>{fmtEuro(grossMonth)}</strong>
                </GlassCard>
                <GlassCard style={{ flex: 1, minWidth: 160, padding: "12px 18px" }}>
                  <div className="text-secondary" style={{ fontSize: "0.82rem" }}>Ginásio recebe (PT)</div>
                  <strong style={{ fontSize: "1.15rem", color: "#4ade80" }}>{fmtEuro(gymCutMonth)}</strong>
                </GlassCard>
                <GlassCard style={{ flex: 1, minWidth: 160, padding: "12px 18px" }}>
                  <div className="text-secondary" style={{ fontSize: "0.82rem" }}>Custo líquido</div>
                  <strong style={{ fontSize: "1.15rem" }}>{fmtEuro(grossMonth - gymCutMonth)}</strong>
                </GlassCard>
              </div>

              {hasAttendance && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                  <button className="glass-button" style={{ fontSize: "0.85rem" }} onClick={() => setPayingMonth(true)}>
                    Confirmar pagamento do mês
                  </button>
                </div>
              )}

              <div className="member-grid">
                {staffList.map((s) => {
                  const { cut, net } = calcEarnings(s);
                  const url = resolveAssetUrl(s.avatar_url);
                  const totalShifts = Number(s.shifts_present) + Number(s.shifts_adjusted) + Number(s.shifts_absent) + Number(s.shifts_pending);
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

                      {/* Attendance summary chips */}
                      {totalShifts > 0 && (
                        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                          {Number(s.shifts_present) > 0  && <span className="role-badge role-badge-static" style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", fontSize: "0.72rem" }}>✓ {s.shifts_present}</span>}
                          {Number(s.shifts_adjusted) > 0 && <span className="role-badge role-badge-static" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", fontSize: "0.72rem" }}>~ {s.shifts_adjusted}</span>}
                          {Number(s.shifts_absent) > 0   && <span className="role-badge role-badge-static" style={{ background: "rgba(248,113,113,0.12)", color: "#f87171", fontSize: "0.72rem" }}>✗ {s.shifts_absent}</span>}
                          {Number(s.shifts_pending) > 0  && <span className="role-badge role-badge-static" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)", fontSize: "0.72rem" }}>? {s.shifts_pending}</span>}
                        </div>
                      )}

                      <div style={{ marginTop: 12, fontSize: "0.83rem", display: "flex", flexDirection: "column", gap: 3 }}>
                        {[
                          Number(s.base_salary) > 0     && ["Salário base", fmtEuro(s.base_salary) + "/mês"],
                          Number(s.rate_reception_h) > 0 && ["Receção", fmtEuro(s.rate_reception_h) + "/h · " + (s.month_hours_reception || 0) + "h"],
                          Number(s.rate_sala_h) > 0      && ["Sala",    fmtEuro(s.rate_sala_h)      + "/h · " + (s.month_hours_sala      || 0) + "h"],
                          Number(s.rate_class_h) > 0     && ["Aulas",   fmtEuro(s.rate_class_h)     + "/h · " + (s.month_hours_class     || 0) + "h"],
                        ].filter(Boolean).map(([label, val]) => (
                          <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                            <span className="text-secondary">{label}</span>
                            <span>{val}</span>
                          </div>
                        ))}

                        {/* Clientes do ginásio — sujeitos à retenção do ginásio */}
                        {Number(s.rate_pt_month) > 0 && Number(s.month_gym_clients) > 0 && (() => {
                          const gymC = Number(s.month_gym_clients);
                          const ptE  = Number(s.rate_pt_month) * gymC;
                          const cutLabel = s.gym_cut_pct != null
                            ? `${s.gym_cut_pct}% dos clientes do ginásio`
                            : s.gym_cut_fixed != null
                            ? `${fmtEuro(s.gym_cut_fixed)}/cliente ginásio`
                            : null;
                          return (
                            <div style={{ borderTop: "1px solid var(--glass-border)", paddingTop: 6, marginTop: 3, display: "flex", flexDirection: "column", gap: 3 }}>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span className="text-secondary">Clientes ginásio ({gymC})</span>
                                <span>{gymC} × {fmtEuro(s.rate_pt_month)} = {fmtEuro(ptE)}</span>
                              </div>
                              {cutLabel && cut > 0 && (
                                <div style={{ display: "flex", justifyContent: "space-between" }}>
                                  <span style={{ color: "#4ade80", fontSize: "0.78rem" }}>Ginásio fica ({cutLabel})</span>
                                  <span style={{ color: "#4ade80" }}>– {fmtEuro(cut)}</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Clientes externos — 100% para o PT, sem retenção */}
                        {Number(s.month_ext_clients) > 0 && (
                          <div style={{ borderTop: "1px solid var(--glass-border)", paddingTop: 6, marginTop: 3, display: "flex", flexDirection: "column", gap: 3 }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span className="text-secondary">Clientes externos ({s.month_ext_clients}) <span style={{ fontSize: "0.72rem", color: "#4ade80" }}>100% PT</span></span>
                              <span>{fmtEuro(s.month_ext_income)}</span>
                            </div>
                          </div>
                        )}

                        <div style={{ borderTop: "1px solid var(--glass-border)", paddingTop: 4, marginTop: 4, display: "flex", flexDirection: "column", gap: 3 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, fontSize: "1rem" }}>
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
        </>
      )}

      {/* ── Registos de presença ── */}
      {tab === "records" && (
        <>
          <MonthNav month={staffMonth} setMonth={setStaffMonth} max={currentYM()} />

          {loading && <p className="text-secondary">A carregar...</p>}

          {!loading && staffList.length === 0 && (
            <p className="text-secondary">Sem membros de equipa configurados.</p>
          )}

          {!loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {staffList.map((s) => {
                const totalShifts = Number(s.shifts_present) + Number(s.shifts_adjusted) + Number(s.shifts_absent) + Number(s.shifts_pending);
                return (
                  <GlassCard key={s.id} style={{ padding: "14px 18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: "0.95rem" }}>{s.name}</strong>
                        <span className="text-secondary" style={{ marginLeft: 8, fontSize: "0.8rem" }}>{ROLE_LABELS[s.role] || s.role}</span>
                        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                          {Number(s.shifts_present) > 0  && <span className="role-badge role-badge-static" style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", fontSize: "0.75rem" }}>✓ {s.shifts_present} presente{s.shifts_present !== "1" ? "s" : ""}</span>}
                          {Number(s.shifts_adjusted) > 0 && <span className="role-badge role-badge-static" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", fontSize: "0.75rem" }}>~ {s.shifts_adjusted} ajustado{s.shifts_adjusted !== "1" ? "s" : ""}</span>}
                          {Number(s.shifts_absent) > 0   && <span className="role-badge role-badge-static" style={{ background: "rgba(248,113,113,0.12)", color: "#f87171", fontSize: "0.75rem" }}>✗ {s.shifts_absent} falta{s.shifts_absent !== "1" ? "s" : ""}</span>}
                          {Number(s.shifts_pending) > 0  && <span className="role-badge role-badge-static" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)", fontSize: "0.75rem" }}>? {s.shifts_pending} por confirmar</span>}
                          {totalShifts === 0 && <span className="text-secondary" style={{ fontSize: "0.8rem" }}>Sem registos</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button className="glass-button glass-button-secondary"
                          style={{ fontSize: "0.82rem" }}
                          onClick={() => setViewingStaff({ id: s.id, name: s.name })}>
                          Ver registos
                        </button>
                        <button className="glass-button glass-button-secondary"
                          style={{ fontSize: "0.82rem" }}
                          onClick={() => navigate(`/staff-attendance`)}>
                          Hoje
                        </button>
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Pagamentos mensais ── */}
      {tab === "payments" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <button className="glass-button glass-button-secondary" style={{ padding: "4px 10px" }} onClick={() => setPayMonth(prevMonthYM(payMonth))}>‹</button>
            <span style={{ minWidth: 140, textAlign: "center", fontSize: "0.92rem", textTransform: "capitalize" }}>{monthLabelFull(payMonth)}</span>
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
                      {Number(p.hours_sala) > 0       && `Sala ${p.hours_sala}h  `}
                      {Number(p.hours_reception) > 0  && `Rec. ${p.hours_reception}h  `}
                      {Number(p.hours_class) > 0      && `Aulas ${p.hours_class}h  `}
                      {p.pt_clients_count > 0         && `${p.pt_clients_count} clientes PT`}
                    </div>
                    <div className="text-secondary" style={{ fontSize: "0.75rem", marginTop: 2 }}>
                      Pago em {fmtDate(p.paid_at)}{p.confirmed_by_name && ` por ${p.confirmed_by_name}`}
                    </div>
                    {p.notes && <div className="text-secondary" style={{ fontSize: "0.75rem" }}>{p.notes}</div>}
                  </div>
                  <div style={{ textAlign: "right", fontSize: "0.85rem" }}>
                    <div className="text-secondary">Bruto: {fmtEuro(p.gross)}</div>
                    {Number(p.gym_cut) > 0 && <div style={{ color: "#4ade80" }}>Ginásio: – {fmtEuro(p.gym_cut)}</div>}
                    <strong style={{ fontSize: "1rem" }}>{fmtEuro(p.net)}</strong>
                    <div>
                      <button className="nf-text-danger" style={{ fontSize: "0.75rem", marginTop: 6 }}
                        onClick={async () => {
                          if (!window.confirm("Anular este pagamento?")) return;
                          try { await apiRequest(`/finance/payments/${p.id}`, { method: "DELETE" }); loadPayments(payMonth); }
                          catch (err) { setError(err.message); }
                        }}>Anular</button>
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
        <RatesModal staff={editingRates} onClose={() => setEditingRates(null)} onSaved={() => load(staffMonth)} />
      )}
      {viewingStaff && (
        <StaffMonthModal
          staffId={viewingStaff.id}
          staffName={viewingStaff.name}
          month={staffMonth}
          onClose={() => setViewingStaff(null)}
        />
      )}
      {payingMonth && (
        <PayMonthModal
          staffList={staffList}
          month={staffMonth}
          onClose={() => setPayingMonth(false)}
          onSaved={() => {
            loadPayments(staffMonth);
            setPayingMonth(false);
            setTab("payments");
            setPayMonth(staffMonth);
          }}
        />
      )}
    </div>
  );
}
