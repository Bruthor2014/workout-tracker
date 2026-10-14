import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import ProgressChart from "../components/ProgressChart";
import AddToTeamModal from "../components/AddToTeamModal";
import { IconBuilding, IconCalendar, IconDumbbell, IconTrendingUp, IconUsers } from "../components/Icons";
import { apiRequest, resolveAssetUrl } from "../api/client";
import { ROLE_COLORS, ROLE_LABELS } from "../utils/roles";
import { weekdayName } from "../utils/schedule";
import { useAuth } from "../context/AuthContext";
import { applyTheme, resetTheme, deriveTheme } from "../utils/theme";

const SERVICE_LABELS = {
  gym_membership: "Inscrição no ginásio",
  personal_training: "Personal training",
  nutrition_plan: "Plano de nutrição",
};
const WORKOUTS_COLOR = "#8b5cf6"; // mesma série/cor dos gráficos do perfil
const fmt = (n, d = 0) => Number(n).toLocaleString("pt-PT", { maximumFractionDigits: d });

function Tile({ icon: Icon, label, value, caption, to }) {
  const content = (
    <GlassCard className="stat-tile profile-stat" strong>
      <div className="stat-tile-header">
        <span className="stat-tile-icon">
          <Icon size={22} />
        </span>
        <span className="stat-tile-label">{label}</span>
      </div>
      <div className="stat-tile-value-row">
        <span className="stat-tile-value">{value}</span>
      </div>
      {caption && <span className="stat-tile-sub">{caption}</span>}
    </GlassCard>
  );
  return to ? (
    <Link to={to} className="management-tile-link">
      {content}
    </Link>
  ) : (
    content
  );
}

const DEFAULT_ACCENT = "#a78bfa";

function GymThemeSection() {
  const { user, updateUser } = useAuth();
  const currentAccent = user?.gym_accent || DEFAULT_ACCENT;
  const [picked, setPicked] = useState(currentAccent);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Preview em tempo real enquanto o CEO ajusta a cor.
  function handleChange(e) {
    const c = e.target.value;
    setPicked(c);
    applyTheme(c);
  }

  async function handleSave() {
    setSaving(true); setSaved(false);
    try {
      await apiRequest("/gym/theme", { method: "PUT", body: { accent_color: picked } });
      updateUser({ gym_accent: picked });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  }

  async function handleReset() {
    setResetting(true);
    try {
      await apiRequest("/gym/theme", { method: "DELETE" });
      updateUser({ gym_accent: null });
      setPicked(DEFAULT_ACCENT);
      resetTheme();
    } finally { setResetting(false); }
  }

  const preview = deriveTheme(picked);
  const isDefault = picked === DEFAULT_ACCENT && !user?.gym_accent;

  return (
    <GlassCard strong style={{ padding: "22px 24px", marginTop: 24 }}>
      <h3 style={{ margin: "0 0 6px", fontSize: "1.05rem" }}>Tema do ginásio</h3>
      <p className="text-secondary" style={{ fontSize: "0.82rem", margin: "0 0 20px" }}>
        A cor principal é aplicada a todos os utilizadores associados a este ginásio.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        {/* Color picker */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: "0.8rem" }} className="text-secondary">Cor principal</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10, background: picked,
              border: "2px solid rgba(255,255,255,0.15)",
              boxShadow: `0 0 18px ${picked}88`,
              flexShrink: 0,
            }} />
            <input
              type="color"
              value={picked}
              onChange={handleChange}
              style={{ width: 42, height: 42, cursor: "pointer", border: "none", background: "none", padding: 0, borderRadius: 8 }}
            />
            <span style={{ fontFamily: "monospace", fontSize: "0.9rem", color: "var(--text-secondary)" }}>{picked}</span>
          </div>
        </div>

        {/* Preview das cores derivadas */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { label: "Accent", color: preview.accent },
            { label: "Strong", color: preview.accentStrong },
            { label: "Fundo", color: preview.bgBase },
          ].map(({ label, color }) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, background: color,
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: `0 0 12px ${color}66`,
              }} />
              <span style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Botões */}
        <div style={{ display: "flex", gap: 8, marginLeft: "auto", flexShrink: 0 }}>
          {!isDefault && (
            <button
              className="glass-button glass-button-secondary"
              style={{ padding: "8px 14px", fontSize: "0.84rem" }}
              onClick={handleReset}
              disabled={resetting}
            >
              {resetting ? "..." : "Repor default"}
            </button>
          )}
          <button
            className="glass-button"
            style={{ padding: "8px 18px", fontSize: "0.84rem" }}
            onClick={handleSave}
            disabled={saving}
          >
            {saved ? "✓ Guardado" : saving ? "A guardar..." : "Guardar tema"}
          </button>
        </div>
      </div>
    </GlassCard>
  );
}

// Painel de gestão do CEO: o ginásio num relance — membros, atividade,
// equipa, subscrições e o que precisa de atenção.
export default function ManagementPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [addingToTeam, setAddingToTeam] = useState(false);
  const [teamError, setTeamError] = useState("");

  function load() {
    apiRequest("/gym/overview").then(setData).catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, []);

  if (error) return <div className="page-container"><p className="error-text">{error}</p></div>;
  if (!data) return <div className="page-container"><p className="text-secondary">A carregar...</p></div>;

  const { members, activity, classes } = data;

  // Tirar da equipa: a pessoa continua no ginásio como membro.
  async function removeFromTeam(person) {
    if (
      !window.confirm(
        `Tirar ${person.name} da equipa? Passa a ser membro do ginásio, os turnos saem do horário e as aulas que dava ficam sem responsável.`
      )
    ) {
      return;
    }
    setTeamError("");
    try {
      await apiRequest(`/members/${person.id}/team`, { method: "DELETE" });
      load();
    } catch (err) {
      setTeamError(err.message);
    }
  }
  const delta =
    activity.last_week_same_days > 0
      ? Math.round(((activity.this_week - activity.last_week_same_days) / activity.last_week_same_days) * 100)
      : null;
  const staffTotal = data.staff.reduce((s, r) => s + r.count, 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="log-header">
          <span className="log-header-icon">
            <IconBuilding size={22} />
          </span>
          <h1>{data.gym_name}</h1>
        </div>
      </div>
      {addingToTeam && (
        <AddToTeamModal
          onClose={() => setAddingToTeam(false)}
          onAdded={() => {
            setAddingToTeam(false);
            load();
          }}
        />
      )}

      <div className="profile-stats">
        <Tile icon={IconUsers} label="Membros" value={fmt(members.total)} caption={`${members.new_this_month} novos este mês`} to="/members" />
        <Tile
          icon={IconTrendingUp}
          label="Ativos (30 dias)"
          value={fmt(members.active_30d)}
          caption={`${members.inactive_30d} sem treinar há +30 dias`}
          to="/members"
        />
        <Tile
          icon={IconDumbbell}
          label="Treinos esta semana"
          value={fmt(activity.this_week)}
          caption={delta == null ? `${activity.this_month} este mês` : `${delta >= 0 ? "+" : ""}${delta}% vs semana passada`}
        />
        <Tile
          icon={IconCalendar}
          label="Aulas de grupo"
          value={fmt(classes.total)}
          caption={classes.vacant + classes.substitute_requests > 0 ? `${classes.vacant + classes.substitute_requests} precisam de responsável` : "Todas com responsável"}
          to="/classes"
        />
      </div>

      <div className="management-grid">
        <GlassCard className="profile-chart-card" strong>
          <h3>Treinos dos membros por semana</h3>
          <p className="text-secondary">Últimas 12 semanas</p>
          <ProgressChart
            kind="bar"
            color={WORKOUTS_COLOR}
            points={data.weekly.map((w) => {
              const d = new Date(`${w.week_start}T00:00:00`);
              return {
                label: `${d.getDate()}/${d.getMonth() + 1}`,
                tooltipLabel: `Semana de ${d.getDate()}/${d.getMonth() + 1}`,
                value: w.workouts,
              };
            })}
            formatValue={(v, axis) => (axis ? fmt(v) : `${fmt(v)} ${v === 1 ? "treino" : "treinos"}`)}
            ariaLabel="Treinos dos membros por semana"
          />
        </GlassCard>

        <GlassCard className="management-card" strong>
          <h3>Precisa de atenção</h3>
          <ul className="management-list">
            {data.attention_classes.map((c) => (
              <li key={c.id}>
                <span className={`management-dot ${c.substitute_requested ? "warning" : "vacant"}`} />
                <span>
                  <strong>{c.title}</strong> — {weekdayName(c.weekday)} {c.start_time}
                  <span className="text-secondary">
                    {c.substitute_requested ? ` · ${c.instructor_name} pediu substituição` : " · sem responsável"}
                  </span>
                </span>
              </li>
            ))}
            {members.inactive_30d > 0 && (
              <li>
                <span className="management-dot warning" />
                <span>
                  <strong>{members.inactive_30d} {members.inactive_30d === 1 ? "membro" : "membros"}</strong> sem treinar há mais de 30 dias
                  <span className="text-secondary"> · contacta-os em Membros → Inativos</span>
                </span>
              </li>
            )}
            {data.attention_classes.length === 0 && members.inactive_30d === 0 && (
              <li className="text-secondary">Está tudo em dia. 👌</li>
            )}
          </ul>
          <div className="management-links">
            <Link to="/classes" className="glass-button glass-button-secondary">Aulas de grupo</Link>
            <Link to="/members" className="glass-button glass-button-secondary">Membros</Link>
          </div>
        </GlassCard>

        <GlassCard className="management-card" strong>
          <h3>Equipa <span className="text-secondary">· {staffTotal}</span></h3>
          <ul className="management-staff">
            {data.staff_load.map((s) => (
              <li key={s.id} style={{ "--role-color": ROLE_COLORS[s.role] }}>
                <Link to={`/members/${s.id}`} className="management-staff-link" title={`Abrir o perfil de ${s.name}`}>
                  <span className="management-staff-name">
                    <strong>{s.name}</strong>
                    <span className="member-tile-role">{ROLE_LABELS[s.role] || s.role}</span>
                  </span>
                  <span className="text-secondary">
                    {fmt(s.shift_hours + s.class_hours, 1)} h/semana
                    {s.clients > 0 && ` · ${s.clients} ${s.clients === 1 ? "cliente" : "clientes"}`}
                  </span>
                </Link>
                <button type="button" className="team-remove" onClick={() => removeFromTeam(s)} title={`Tirar ${s.name} da equipa`}>
                  Remover
                </button>
              </li>
            ))}
            {data.staff_load.length === 0 && <li className="text-secondary">Ainda sem equipa.</li>}
          </ul>
          {teamError && <p className="error-text">{teamError}</p>}
          <div className="management-links">
            <button type="button" className="glass-button" onClick={() => setAddingToTeam(true)}>
              + Adicionar à equipa
            </button>
            <Link to="/team-schedule" className="glass-button glass-button-secondary">Gerir horários</Link>
          </div>
        </GlassCard>

        <GlassCard className="management-card" strong>
          <h3>Mais ativos (30 dias)</h3>
          <ul className="management-top">
            {data.top_members.map((m, i) => (
              <li key={m.id}>
                <Link to={`/members/${m.id}`}>
                  <span className="management-rank">{i + 1}</span>
                  {m.avatar_url ? (
                    <img src={resolveAssetUrl(m.avatar_url)} alt="" className="member-card-avatar" />
                  ) : (
                    <span className="member-card-avatar member-card-avatar-fallback">{m.name.charAt(0)}</span>
                  )}
                  <span>{m.name}</span>
                  <span className="text-secondary">{m.workouts} treinos</span>
                </Link>
              </li>
            ))}
            {data.top_members.length === 0 && <li className="text-secondary">Sem treinos nos últimos 30 dias.</li>}
          </ul>
        </GlassCard>
      </div>

      <GymThemeSection />
    </div>
  );
}
