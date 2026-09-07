import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import BroadcastModal from "../components/BroadcastModal";
import { apiRequest, resolveAssetUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";

// Só quem pode mesmo enviar mensagens globais (ver STAFF em
// messageRoutes.js) — rececionistas veem a lista de membros mas não este
// botão, já que o backend recusaria o envio.
const BROADCAST_ROLES = ["gym_owner", "personal_trainer", "nutritionist"];

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

export default function MembersPage() {
  const { user } = useAuth();
  const canBroadcast = BROADCAST_ROLES.includes(user.role);
  const [search, setSearch] = useState("");
  const [onlyInactive, setOnlyInactive] = useState(false);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [showBulkForFiltered, setShowBulkForFiltered] = useState(false);

  function loadMembers(query, inactive) {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (query) params.set("search", query);
    if (inactive) params.set("inactive", "true");
    const qs = params.toString() ? `?${params.toString()}` : "";
    apiRequest(`/members${qs}`)
      .then(setMembers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadMembers("", false);
  }, []);

  function handleSearchSubmit(e) {
    e.preventDefault();
    loadMembers(search, onlyInactive);
  }

  function toggleInactive() {
    const next = !onlyInactive;
    setOnlyInactive(next);
    loadMembers(search, next);
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Membros</h1>
        {canBroadcast && (
          <button type="button" className="glass-button" onClick={() => setShowBroadcast(true)}>
            Mensagem para vários
          </button>
        )}
      </div>

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

      <div className="session-grid">
        {members.map((member) => (
          <Link to={`/members/${member.id}`} key={member.id} className="session-card-link">
            <GlassCard className="session-card member-card">
              <div className="member-card-header">
                <MemberAvatar member={member} />
                <div>
                  <span className="date">{member.name}</span>
                  <span className="text-secondary">{member.email}</span>
                </div>
              </div>
              <span className="text-secondary member-card-history">
                {member.last_weight_kg
                  ? `Último registo: ${Number(member.last_weight_kg)} kg (${new Date(
                      `${member.last_weight_at}T00:00:00`
                    ).toLocaleDateString("pt-PT")})`
                  : "Ainda sem registos de composição corporal"}
              </span>
              <span className="text-secondary member-card-history">
                {member.last_workout_at
                  ? `Último treino: ${new Date(`${member.last_workout_at}T00:00:00`).toLocaleDateString("pt-PT")}`
                  : "Ainda sem treinos registados"}
              </span>
            </GlassCard>
          </Link>
        ))}
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
