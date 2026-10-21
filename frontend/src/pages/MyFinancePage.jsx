import { useEffect, useState } from "react";
import GlassCard from "../components/GlassCard";
import { IconBarChart } from "../components/Icons";
import { apiRequest } from "../api/client";

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

// Segunda-feira da semana de uma data "YYYY-MM-DD" — chave para agrupar
// as presenças por semana.
function mondayKey(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toLocaleDateString("sv");
}
function fmtDayShort(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("pt-PT", { day: "numeric", month: "short" });
}
function weekRangeLabel(mondayStr) {
  const start = new Date(`${mondayStr}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const endKey = end.toLocaleDateString("sv");
  return `${fmtDayShort(mondayStr)} – ${fmtDayShort(endKey)}`;
}

// Uma semana de presenças, fechada por omissão — abre ao clicar.
function AttendanceWeek({ monday, rows }) {
  const [open, setOpen] = useState(false);
  const counts = { present: 0, adjusted: 0, absent: 0 };
  rows.forEach((a) => { counts[a.status] = (counts[a.status] || 0) + 1; });

  return (
    <GlassCard style={{ padding: 0, overflow: "hidden" }}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 10, padding: "10px 14px", background: "none", border: "none", cursor: "pointer",
          color: "var(--text-primary)", font: "inherit", textAlign: "left",
        }}>
        <span style={{ fontWeight: 600, fontSize: "0.86rem" }}>{weekRangeLabel(monday)}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="text-secondary" style={{ fontSize: "0.78rem" }}>
            {counts.present > 0 && `✓ ${counts.present} `}
            {counts.adjusted > 0 && `~ ${counts.adjusted} `}
            {counts.absent > 0 && `✗ ${counts.absent}`}
          </span>
          <span style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>›</span>
        </span>
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "0 10px 10px" }}>
          {rows.map((a, i) => {
            const statusColor = a.status === "absent" ? "#f87171" : a.status === "adjusted" ? "#f59e0b" : "#4ade80";
            const statusLabel = a.status === "absent" ? "Falta"
              : a.status === "adjusted" ? `Ajustado (−${Number(a.deducted_hours).toFixed(1)}h)`
              : "Presente";
            const bgColor = a.status === "absent" ? "rgba(248,113,113,0.08)"
              : a.status === "adjusted" ? "rgba(245,158,11,0.07)"
              : "rgba(74,222,128,0.06)";
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
      )}
    </GlassCard>
  );
}

function ExtClientFeeRow({ ec, onSaved }) {
  const [fee, setFee] = useState(String(ec.monthly_fee || "0"));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true); setSaved(false);
    try {
      await apiRequest(`/finance/my/ext-client/${ec.id}/fee`, { method: "PUT", body: { monthly_fee: Number(fee) } });
      onSaved(ec.id, Number(fee));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  }

  return (
    <GlassCard style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: "0.9rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ec.client_name}</div>
        <div className="text-secondary" style={{ fontSize: "0.75rem" }}>{ec.client_email}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <input type="number" min="0" step="0.01" className="glass-input"
          style={{ width: 80, textAlign: "right", fontSize: "0.85rem" }}
          value={fee} onChange={(e) => setFee(e.target.value)} />
        <span className="text-secondary" style={{ fontSize: "0.8rem" }}>€/mês</span>
        <button className="glass-button" style={{ padding: "4px 10px", fontSize: "0.78rem" }}
          onClick={handleSave} disabled={saving}>
          {saved ? "✓" : saving ? "..." : "Guardar"}
        </button>
      </div>
    </GlassCard>
  );
}

// Financeiro pessoal do staff: horas/presenças do mês, se já foi pago ou
// não, clientes externos, e o histórico de pagamentos anteriores. Vivia
// misturado dentro de "O meu horário" — ficava confuso, por isso tem
// agora a sua própria aba.
export default function MyFinancePage() {
  const [financeMonth, setFinanceMonth] = useState(currentYM());
  const [financeData, setFinanceData] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest("/finance/my/payments")
      .then(setPayments)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    apiRequest(`/finance/my?month=${financeMonth}`)
      .then(setFinanceData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [financeMonth]);

  const paymentThisMonth = payments.find((p) => p.month_year === financeMonth);

  // Atualiza o valor de um cliente externo no estado (a linha já gravou no
  // servidor) — sem isto, o total ficava preso ao valor antigo.
  function updateExtClientFee(eccId, fee) {
    setFinanceData((prev) => ({
      ...prev,
      external_clients: prev.external_clients.map((ec) => (ec.id === eccId ? { ...ec, monthly_fee: fee } : ec)),
    }));
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="log-header">
          <span className="log-header-icon">
            <IconBarChart size={22} />
          </span>
          <h1>O meu financeiro</h1>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <button className="glass-button glass-button-secondary" style={{ padding: "4px 10px" }}
          onClick={() => setFinanceMonth(prevMonth(financeMonth))}>‹</button>
        <span style={{ minWidth: 140, textAlign: "center", fontSize: "0.95rem", textTransform: "capitalize" }}>
          {monthLabel(financeMonth)}
        </span>
        <button className="glass-button glass-button-secondary" style={{ padding: "4px 10px" }}
          disabled={financeMonth >= currentYM()}
          onClick={() => setFinanceMonth(nextMonth(financeMonth))}>›</button>
      </div>

      {loading && <p className="text-secondary">A carregar...</p>}

      {!loading && (
        <>
          {/* Estado do pagamento deste mês — a primeira coisa a mostrar. */}
          <GlassCard strong style={{
            padding: "16px 20px", marginBottom: 20, display: "flex", justifyContent: "space-between",
            alignItems: "center", flexWrap: "wrap", gap: 10,
            borderColor: paymentThisMonth ? "rgba(74,222,128,0.4)" : undefined,
          }}>
            {paymentThisMonth ? (
              <>
                <div>
                  <strong style={{ color: "#4ade80" }}>✓ Pago</strong>
                  <div className="text-secondary" style={{ fontSize: "0.8rem", marginTop: 2 }}>
                    Pago em {fmtDate(paymentThisMonth.paid_at)}
                  </div>
                </div>
                <strong style={{ fontSize: "1.1rem" }}>{fmtEuro(paymentThisMonth.net)}</strong>
              </>
            ) : (
              <strong className="text-secondary">Ainda não foi confirmado o pagamento deste mês.</strong>
            )}
          </GlassCard>

          {/* Presenças do mês — resumo em contagens; só a lista os dias que já
              aconteceram (presente/ajustado/falta), não os turnos futuros
              ainda "a aguardar", que só enchiam a aba sem dizer nada. */}
          {financeData?.attendance?.length > 0 && (() => {
            const counts = { present: 0, adjusted: 0, absent: 0, pending: 0 };
            financeData.attendance.forEach((a) => { counts[a.status] = (counts[a.status] || 0) + 1; });
            const notable = financeData.attendance.filter((a) => a.status !== "pending").slice().reverse();
            return (
              <>
                <h3 style={{ fontSize: "0.95rem", margin: "16px 0 8px" }}>Presenças</h3>
                <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                  {counts.present > 0 && (
                    <span className="role-badge role-badge-static" style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", fontSize: "0.78rem" }}>
                      ✓ {counts.present} presente{counts.present !== 1 ? "s" : ""}
                    </span>
                  )}
                  {counts.adjusted > 0 && (
                    <span className="role-badge role-badge-static" style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", fontSize: "0.78rem" }}>
                      ~ {counts.adjusted} ajustado{counts.adjusted !== 1 ? "s" : ""}
                    </span>
                  )}
                  {counts.absent > 0 && (
                    <span className="role-badge role-badge-static" style={{ background: "rgba(248,113,113,0.12)", color: "#f87171", fontSize: "0.78rem" }}>
                      ✗ {counts.absent} falta{counts.absent !== 1 ? "s" : ""}
                    </span>
                  )}
                  {counts.pending > 0 && (
                    <span className="role-badge role-badge-static" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)", fontSize: "0.78rem" }}>
                      {counts.pending} por confirmar
                    </span>
                  )}
                </div>
                {notable.length === 0 ? (
                  <p className="text-secondary" style={{ fontSize: "0.82rem" }}>Ainda não há presenças confirmadas este mês.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {Object.entries(
                      notable.reduce((byWeek, a) => {
                        const key = mondayKey(a.shift_date);
                        (byWeek[key] ||= []).push(a);
                        return byWeek;
                      }, {})
                    )
                      .sort(([a], [b]) => b.localeCompare(a))
                      .map(([monday, rows]) => (
                        <AttendanceWeek key={monday} monday={monday} rows={rows} />
                      ))}
                  </div>
                )}
              </>
            );
          })()}

          {/* Clientes externos — clientes do PT/nutricionista de FORA do
              ginásio (convidados pelo código de convite pessoal, não são
              sócios), onde 100% do valor fica para o próprio. */}
          {financeData?.external_clients?.length > 0 && (
            <>
              <h3 style={{ fontSize: "0.95rem", margin: "20px 0 8px" }}>Clientes externos (fora do ginásio)</h3>
              <p className="text-secondary" style={{ fontSize: "0.78rem", marginBottom: 10 }}>
                Pessoas que treinas por fora, convidadas pelo teu código de convite pessoal (não são sócios do ginásio). 100% do valor fica para ti — define aqui quanto cobras a cada uma por mês.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {financeData.external_clients.map((ec) => (
                  <ExtClientFeeRow key={ec.id} ec={ec} onSaved={updateExtClientFee} />
                ))}
              </div>
              <div style={{ textAlign: "right", marginTop: 8, fontSize: "0.88rem", fontWeight: 600 }}>
                Total externos: {fmtEuro(financeData.external_clients.reduce((a, c) => a + Number(c.monthly_fee || 0), 0))}
              </div>
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
        </>
      )}
    </div>
  );
}
