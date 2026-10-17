import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import Modal from "../components/Modal";
import BroadcastModal from "../components/BroadcastModal";
import AddPersonModal from "../components/AddPersonModal";
import { apiRequest, resolveAssetUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { IconCalendar, IconSave, IconWeightStack } from "../components/Icons";
import { ROLE_LABELS, ROLE_COLORS } from "../utils/roles";

// Rececionista adiciona um novo sócio com apenas o email.
function AddMemberModal({ onClose, onCreated }) {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setSaving(true);
    try {
      const person = await apiRequest("/members", { method: "POST", body: { email } });
      setResult(person);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <Modal onClose={onClose}>
      <GlassCard className="preview-card schedule-form" strong>
        <h3>Novo sócio</h3>
        {result ? (
          <>
            <p style={{ marginBottom: 4 }}>
              <strong>{result.name}</strong> foi adicionado ao ginásio.
            </p>
            {result.temp_password && (
              <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(255,255,255,0.06)",
                fontSize: "0.88rem", marginTop: 8 }}>
                <p className="text-secondary" style={{ margin: "0 0 4px", fontSize: "0.78rem" }}>Password temporária</p>
                <strong style={{ fontFamily: "monospace", fontSize: "1rem" }}>{result.temp_password}</strong>
                <p className="text-secondary" style={{ margin: "6px 0 0", fontSize: "0.75rem" }}>
                  Dá esta password ao novo sócio para o primeiro login.
                </p>
              </div>
            )}
            <div className="schedule-form-actions" style={{ marginTop: 14 }}>
              <button type="button" className="glass-button glass-button-secondary" onClick={onClose}>Fechar</button>
              <button type="button" className="glass-button" onClick={() => { setResult(null); setEmail(""); }}>Adicionar outro</button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label style={{ display: "block", marginBottom: 16 }}>
              <span className="log-label">Email do sócio</span>
              <input className="glass-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@email.com" required autoFocus />
            </label>
            {error && <p className="error-text">{error}</p>}
            <div className="schedule-form-actions">
              <button type="button" className="glass-button glass-button-secondary" onClick={onClose}>Cancelar</button>
              <button type="submit" className="glass-button log-save-button" disabled={saving || !email}>
                <IconSave size={18} />
                {saving ? "A adicionar..." : "Adicionar"}
              </button>
            </div>
          </form>
        )}
      </GlassCard>
    </Modal>
  );
}

// Só quem pode mesmo enviar mensagens globais (ver STAFF em
// messageRoutes.js) — rececionistas veem a lista de membros mas não este
// botão, já que o backend recusaria o envio.
const BROADCAST_ROLES = ["gym_owner", "personal_trainer", "nutritionist"];

const MONTH_LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const INACTIVE_DAYS = 30; // igual ao filtro "Inativos (+30 dias)" do backend

// "2026-10-03" -> "3 out 2026" ("T00:00:00" força hora local, não UTC).
function formatShortDate(dateKey) {
  const d = new Date(`${dateKey}T00:00:00`);
  return `${d.getDate()} ${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
}

function isInactive(lastWorkoutAt) {
  if (!lastWorkoutAt) return true;
  const days = (Date.now() - new Date(`${lastWorkoutAt}T00:00:00`).getTime()) / 86400000;
  return days > INACTIVE_DAYS;
}

function MemberAvatar({ member }) {
  const avatarUrl = resolveAssetUrl(member.avatar_url);
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className="member-card-avatar" />;
  }
  return (
    <span className="member-card-avatar member-card-avatar-fallback">
      {member.name.charAt(0).toUpperCase()}
    </span>
  );
}

const PAGE_SIZE = 50;

export default function MembersPage() {
  const { user } = useAuth();
  const canBroadcast = BROADCAST_ROLES.includes(user.role);
  const [search, setSearch] = useState("");
  const [onlyInactive, setOnlyInactive] = useState(false);
  const [members, setMembers] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [showBulkForFiltered, setShowBulkForFiltered] = useState(false);

  function loadMembers(query, inactive, off = 0) {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ limit: PAGE_SIZE, offset: off });
    if (query) params.set("search", query);
    if (inactive) params.set("inactive", "true");
    apiRequest(`/members?${params}`)
      .then((data) => {
        // Support both old array format and new paginated format
        if (Array.isArray(data)) { setMembers(data); setTotal(data.length); }
        else { setMembers(data.members); setTotal(data.total); }
        setOffset(off);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadMembers("", false); }, []);

  function handleSearchSubmit(e) {
    e.preventDefault();
    loadMembers(search, onlyInactive, 0);
  }

  function toggleInactive() {
    const next = !onlyInactive;
    setOnlyInactive(next);
    loadMembers(search, next, 0);
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Membros</h1>
        <div className="page-header-actions">
          {user.role === "gym_owner" && (
            <button type="button" className="glass-button" onClick={() => setShowAddPerson(true)} >
              + Adicionar pessoa
            </button>
          )}
          {(user.role === "receptionist" || user.role === "reception_station") && (
            <button type="button" className="glass-button" onClick={() => setShowAddPerson("member")}>
              + Novo sócio
            </button>
          )}
          {canBroadcast && (
            <button type="button" className="glass-button glass-button-secondary" onClick={() => setShowBroadcast(true)}>
              Mensagem para vários
            </button>
          )}
        </div>
      </div>
      {showAddPerson === true && (
        <AddPersonModal
          defaultRole="member"
          onClose={() => setShowAddPerson(false)}
          onCreated={() => {
            setShowAddPerson(false);
            loadMembers(search, onlyInactive);
          }}
        />
      )}
      {showAddPerson === "member" && (
        <AddMemberModal
          onClose={() => setShowAddPerson(false)}
          onCreated={() => loadMembers(search, onlyInactive)}
        />
      )}

      <form className="filter-bar glass" onSubmit={handleSearchSubmit}>
        <div style={{ flex: 1 }}>
          <label className="field-label" htmlFor="member-search">
            Pesquisar por nome ou email
          </label>
          <input
            id="member-search"
            type="text"
            className="glass-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ex: Ruben"
          />
        </div>
        <div className="filter-actions">
          <button
            type="button"
            className={`glass-button${onlyInactive ? "" : " glass-button-secondary"}`}
            onClick={toggleInactive}
          >
            Inativos (+30 dias)
          </button>
          <button type="submit" className="glass-button">
            Pesquisar
          </button>
        </div>
      </form>

      {loading && <p className="text-secondary">A carregar...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && members.length === 0 && (
        <GlassCard className="empty-state">
          <p>Nenhum membro encontrado.</p>
        </GlassCard>
      )}

      {canBroadcast && !loading && !error && members.length > 0 && (onlyInactive || search) && (
        <button type="button" className="glass-button glass-button-secondary" style={{ marginBottom: 14 }} onClick={() => setShowBulkForFiltered(true)}>
          Enviar mensagem a estes {members.length} membros
        </button>
      )}

      {!loading && total > PAGE_SIZE && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, fontSize: "0.88rem" }}>
          <span className="text-secondary">{offset + 1}–{Math.min(offset + members.length, total)} de {total}</span>
          <button className="glass-button glass-button-secondary" style={{ padding: "3px 10px" }}
            disabled={offset === 0} onClick={() => loadMembers(search, onlyInactive, offset - PAGE_SIZE)}>‹</button>
          <button className="glass-button glass-button-secondary" style={{ padding: "3px 10px" }}
            disabled={offset + PAGE_SIZE >= total} onClick={() => loadMembers(search, onlyInactive, offset + PAGE_SIZE)}>›</button>
        </div>
      )}

      {/* Todos os cartões com a mesma altura e a mesma estrutura, tenha a
          pessoa dados ou não (valores em falta aparecem como "—"). */}
      <div className="member-grid">
        {members.map((member) => {
          const roleColor = ROLE_COLORS[member.role] || ROLE_COLORS.member;
          const inactive = isInactive(member.last_workout_at);
          return (
            <Link to={`/members/${member.id}`} key={member.id} className="member-tile-link">
              <GlassCard className="member-tile" style={{ "--role-color": roleColor }}>
                <div className="member-tile-header">
                  <MemberAvatar member={member} />
                  <div className="member-tile-identity">
                    <span className="member-tile-name">{member.name}</span>
                    <span className="member-tile-email">{member.email}</span>
                  </div>
                </div>

                <span className="member-tile-role">{ROLE_LABELS[member.role] || member.role}</span>

                <div className="member-tile-stats">
                  <div className="member-tile-stat">
                    <IconWeightStack size={16} />
                    <span className="member-tile-stat-label">Peso</span>
                    <span className="member-tile-stat-value">
                      {member.last_weight_kg ? `${Number(member.last_weight_kg)} kg` : "—"}
                    </span>
                  </div>
                  <div className={`member-tile-stat${inactive ? " warning" : ""}`}>
                    <IconCalendar size={16} />
                    <span className="member-tile-stat-label">Último treino</span>
                    <span className="member-tile-stat-value">
                      {member.last_workout_at ? formatShortDate(member.last_workout_at) : "Nunca"}
                    </span>
                  </div>
                </div>
              </GlassCard>
            </Link>
          );
        })}
      </div>

      {showBroadcast && <BroadcastModal onClose={() => setShowBroadcast(false)} />}
      {showBulkForFiltered && (
        <BroadcastModal
          onClose={() => setShowBulkForFiltered(false)}
          memberIds={members.map((m) => m.id)}
        />
      )}
    </div>
  );
}
