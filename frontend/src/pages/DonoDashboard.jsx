import { useEffect, useRef, useState } from "react";
import GlassCard from "../components/GlassCard";
import Modal from "../components/Modal";
import Select from "../components/Select";
import { IconBuilding, IconPlusCircle, IconUsers } from "../components/Icons";
import { apiRequest, resolveAssetUrl } from "../api/client";
import { ROLE_LABELS, ROLE_COLORS } from "../utils/roles";

// ─── Modals ────────────────────────────────────────────────────────────────

function CreateGymModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiRequest("/gym/create", { method: "POST", body: { name } });
      onCreated();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <GlassCard className="preview-card" strong style={{ minWidth: 320 }}>
        <h3>Criar ginásio</h3>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label className="field-label" htmlFor="gym-name">Nome</label>
            <input id="gym-name" className="glass-input" value={name}
              onChange={(e) => setName(e.target.value)} placeholder="Ex: FitLab Porto" required />
          </div>
          {error && <p className="error-text">{error}</p>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" className="glass-button glass-button-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="glass-button" disabled={saving}>{saving ? "A criar..." : "Criar"}</button>
          </div>
        </form>
      </GlassCard>
    </Modal>
  );
}

function AssignOwnerModal({ gym, onClose, onSaved }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/gym/${gym.id}/owner`, { method: "POST", body: { email } });
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <GlassCard className="preview-card" strong style={{ minWidth: 340 }}>
        <h3>Atribuir CEO — {gym.name}</h3>
        {gym.owner_name && (
          <p className="text-secondary" style={{ marginTop: 0 }}>
            CEO atual: <strong>{gym.owner_name}</strong> ({gym.owner_email})
          </p>
        )}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label className="field-label" htmlFor="ceo-email">Email do novo CEO</label>
            <input id="ceo-email" type="email" className="glass-input" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="ceo@ginasio.com" required />
          </div>
          {error && <p className="error-text">{error}</p>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" className="glass-button glass-button-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="glass-button" disabled={saving}>{saving ? "A guardar..." : "Atribuir"}</button>
          </div>
        </form>
      </GlassCard>
    </Modal>
  );
}

const ASSIGNABLE_ROLES = [
  { value: "member", label: "Membro" },
  { value: "gym_owner", label: "CEO" },
  { value: "personal_trainer", label: "Personal Trainer" },
  { value: "nutritionist", label: "Nutricionista" },
  { value: "receptionist", label: "Rececionista" },
  { value: "intern", label: "Estagiário" },
];

function EditUserModal({ user, gyms, onClose, onSaved }) {
  const [gymId, setGymId] = useState(user.gym_id ? String(user.gym_id) : "");
  const [role, setRole] = useState(user.role);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const body = {
        gym_id: gymId ? Number(gymId) : null,
        role,
      };
      await apiRequest(`/gym/users/${user.id}`, { method: "PATCH", body });
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const gymOptions = [
    { value: "", label: "Sem ginásio" },
    ...gyms.map((g) => ({ value: String(g.id), label: g.name })),
  ];

  return (
    <Modal onClose={onClose}>
      <GlassCard className="preview-card" strong style={{ minWidth: 340 }}>
        <h3>{user.name}</h3>
        <p className="text-secondary" style={{ marginTop: 0 }}>{user.email}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label className="field-label">Ginásio</label>
            <Select value={gymId} onChange={setGymId} options={gymOptions} ariaLabel="Ginásio" />
          </div>
          <div>
            <label className="field-label">Role</label>
            <Select value={role} onChange={setRole} options={ASSIGNABLE_ROLES} ariaLabel="Role" />
          </div>
          {error && <p className="error-text">{error}</p>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" className="glass-button glass-button-secondary" onClick={onClose}>Cancelar</button>
            <button type="button" className="glass-button" onClick={handleSave} disabled={saving}>
              {saving ? "A guardar..." : "Guardar"}
            </button>
          </div>
        </div>
      </GlassCard>
    </Modal>
  );
}

// ─── User avatar ────────────────────────────────────────────────────────────

function UserAvatar({ user, size = 36 }) {
  const url = resolveAssetUrl(user.avatar_url);
  const style = { width: size, height: size, borderRadius: "50%", flexShrink: 0, fontSize: size * 0.4 };
  if (url) return <img src={url} alt="" style={style} className="member-card-avatar" />;
  return (
    <span className="member-card-avatar member-card-avatar-fallback" style={style}>
      {user.name.charAt(0).toUpperCase()}
    </span>
  );
}

const SERVICE_LABELS = { personal_training: "Personal Training", nutrition_plan: "Nutrição", gym_membership: "Ginásio" };
const ROLE_SHORT = { personal_trainer: "PT", nutritionist: "Nutricionista", receptionist: "Rececionista", intern: "Estagiário", gym_owner: "CEO" };

function GymDetailModal({ gymId, onClose, onDeleted, onChangeOwner }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    apiRequest(`/gym/${gymId}/detail`)
      .then(setDetail)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [gymId]);

  async function handleDelete() {
    if (!window.confirm(`Apagar "${detail?.gym?.name}"? Todos os utilizadores ficam sem ginásio.`)) return;
    setDeleting(true);
    try {
      await apiRequest(`/gym/${gymId}`, { method: "DELETE" });
      onDeleted();
    } catch (err) {
      alert(err.message);
      setDeleting(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <GlassCard className="preview-card" strong style={{ minWidth: 380, maxWidth: 520, width: "90vw" }}>
        {loading ? (
          <p className="text-secondary">A carregar...</p>
        ) : !detail ? (
          <p className="error-text">Erro ao carregar ginásio.</p>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <h3 style={{ margin: 0 }}>{detail.gym.name}</h3>
              <button type="button" className="glass-button glass-button-secondary" onClick={onChangeOwner}>
                Mudar CEO
              </button>
            </div>

            <div className="profile-stats" style={{ marginTop: 16 }}>
              {[
                { label: "Membros", value: detail.members.total },
                { label: "Novos este mês", value: detail.members.new_this_month },
                { label: "Ativos (30 dias)", value: detail.members.active_30d },
                { label: "Treinos esta semana", value: detail.activity.this_week },
              ].map((s) => (
                <GlassCard key={s.label} className="stat-tile profile-stat" strong>
                  <span className="stat-tile-label">{s.label}</span>
                  <span className="stat-tile-value">{s.value}</span>
                </GlassCard>
              ))}
            </div>

            {detail.subscriptions.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <p className="field-label">Subscrições ativas</p>
                {detail.subscriptions.map((s) => (
                  <div key={s.service_type} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                    <span className="text-secondary">{SERVICE_LABELS[s.service_type] || s.service_type}</span>
                    <strong>{s.count}</strong>
                  </div>
                ))}
              </div>
            )}

            {detail.staff.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <p className="field-label">Equipa</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {detail.staff.map((s) => (
                    <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem" }}>
                      <span>{s.name}</span>
                      <span className="text-secondary">{ROLE_SHORT[s.role] || s.role}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detail.top_members.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <p className="field-label">Mais ativos (30 dias)</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {detail.top_members.map((m, i) => (
                    <div key={m.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem" }}>
                      <span>{i + 1}. {m.name}</span>
                      <span className="text-secondary">{m.workouts} treinos</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              className="nf-text-danger"
              style={{ marginTop: 20, fontSize: "0.85rem" }}
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "A apagar..." : "Apagar ginásio"}
            </button>
          </>
        )}
      </GlassCard>
    </Modal>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function DonoDashboard() {
  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState(null);
  const [viewingGym, setViewingGym] = useState(null); // gym object

  // Pesquisa de utilizadores
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const searchTimer = useRef(null);

  function loadGyms() {
    setLoading(true);
    apiRequest("/gym/all")
      .then(setGyms)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(loadGyms, []);

  const [searchTick, setSearchTick] = useState(0);

  // Debounce de pesquisa
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    searchTimer.current = setTimeout(() => {
      apiRequest(`/gym/users?q=${encodeURIComponent(query.trim())}`)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(searchTimer.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, searchTick]);

  const totalMembers = gyms.reduce((sum, g) => sum + g.member_count, 0);
  const totalStaff = gyms.reduce((sum, g) => sum + g.staff_count, 0);

  return (
    <div className="page-container">
      {/* ── Cabeçalho ── */}
      <div className="page-header">
        <div className="log-header">
          <span className="log-header-icon"><IconBuilding size={22} /></span>
          <h1>Plataforma</h1>
        </div>
        <button className="glass-button" onClick={() => setCreating(true)}
          style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <IconPlusCircle size={18} />
          Criar ginásio
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="profile-stats">
        <GlassCard className="stat-tile profile-stat" strong>
          <span className="stat-tile-label">Ginásios</span>
          <span className="stat-tile-value">{gyms.length}</span>
        </GlassCard>
        <GlassCard className="stat-tile profile-stat" strong>
          <span className="stat-tile-label">Membros (total)</span>
          <span className="stat-tile-value">{totalMembers.toLocaleString("pt-PT")}</span>
        </GlassCard>
        <GlassCard className="stat-tile profile-stat" strong>
          <span className="stat-tile-label">Equipa (total)</span>
          <span className="stat-tile-value">{totalStaff.toLocaleString("pt-PT")}</span>
        </GlassCard>
      </div>

      {/* ── Lista de ginásios ── */}
      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p className="text-secondary">A carregar...</p>
      ) : gyms.length === 0 ? (
        <GlassCard className="empty-state"><p>Ainda não há ginásios.</p></GlassCard>
      ) : (
        <div className="member-grid" style={{ marginBottom: 40 }}>
          {gyms.map((g) => (
            <GlassCard key={g.id} className="member-tile" strong
              style={{ cursor: "pointer" }}
              onClick={() => setViewingGym(g)}>
              <div className="member-tile-header">
                <span className="member-card-avatar member-card-avatar-fallback"
                  style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                  {g.name.charAt(0).toUpperCase()}
                </span>
                <div className="member-tile-identity">
                  <span className="member-tile-name">{g.name}</span>
                  <span className="member-tile-email">
                    {g.owner_name ? `CEO: ${g.owner_name}` : "Sem CEO"}
                  </span>
                  {g.owner_email && <span className="text-secondary" style={{ fontSize: "0.78rem" }}>{g.owner_email}</span>}
                </div>
              </div>
              <div className="member-tile-stats">
                <div className="member-tile-stat">
                  <IconUsers size={16} />
                  <span className="member-tile-stat-label">Membros</span>
                  <span className="member-tile-stat-value">{g.member_count}</span>
                </div>
                <div className="member-tile-stat">
                  <IconBuilding size={16} />
                  <span className="member-tile-stat-label">Equipa</span>
                  <span className="member-tile-stat-value">{g.staff_count}</span>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* ── Pesquisa de utilizadores ── */}
      <div className="page-header" style={{ marginTop: 8 }}>
        <div className="log-header">
          <span className="log-header-icon"><IconUsers size={22} /></span>
          <h2 style={{ fontSize: "1.3rem", margin: 0 }}>Utilizadores</h2>
        </div>
      </div>

      <GlassCard strong style={{ marginBottom: 20 }}>
        <input
          className="glass-input"
          placeholder="Pesquisar por nome ou email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: "100%" }}
        />
      </GlassCard>

      {searching && <p className="text-secondary">A pesquisar...</p>}

      {results.length > 0 && (
        <div className="member-grid">
          {results.map((u) => (
            <GlassCard key={u.id} className="member-tile" strong>
              <div className="member-tile-header">
                <UserAvatar user={u} />
                <div className="member-tile-identity">
                  <span className="member-tile-name">{u.name}</span>
                  <span className="member-tile-email">{u.email}</span>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                <span className="role-badge role-badge-static"
                  style={{ color: ROLE_COLORS[u.role] || "#94a3b8", background: `${ROLE_COLORS[u.role]}22` }}>
                  {ROLE_LABELS[u.role] || u.role}
                </span>
                <span className="text-secondary" style={{ fontSize: "0.8rem" }}>
                  {u.gym_name || "Sem ginásio"}
                </span>
              </div>
              <button
                className="glass-button glass-button-secondary"
                style={{ marginTop: 10, width: "100%" }}
                onClick={() => setEditingUser(u)}
              >
                Editar
              </button>
            </GlassCard>
          ))}
        </div>
      )}

      {query.trim().length >= 2 && !searching && results.length === 0 && (
        <p className="text-secondary">Nenhum utilizador encontrado.</p>
      )}

      {/* ── Modals ── */}
      {creating && (
        <CreateGymModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); loadGyms(); }} />
      )}
      {assigning && (
        <AssignOwnerModal gym={assigning} onClose={() => setAssigning(null)} onSaved={() => { setAssigning(null); loadGyms(); }} />
      )}
      {viewingGym && (
        <GymDetailModal
          gymId={viewingGym.id}
          onClose={() => setViewingGym(null)}
          onDeleted={() => { setViewingGym(null); loadGyms(); }}
          onChangeOwner={() => { setViewingGym(null); setAssigning(viewingGym); }}
        />
      )}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          gyms={gyms}
          onClose={() => setEditingUser(null)}
          onSaved={() => {
            setEditingUser(null);
            setSearchTick((t) => t + 1);
            loadGyms();
          }}
        />
      )}
    </div>
  );
}
