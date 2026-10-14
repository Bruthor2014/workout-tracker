import { useEffect, useState } from "react";
import GlassCard from "../components/GlassCard";
import { IconUsers } from "../components/Icons";
import { apiRequest, resolveAssetUrl } from "../api/client";
import { ROLE_COLORS, ROLE_LABELS } from "../utils/roles";

export default function TeamPage() {
  const [team, setTeam] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest("/members/team-list")
      .then(setTeam)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="log-header">
          <span className="log-header-icon">
            <IconUsers size={22} />
          </span>
          <h1>Equipa</h1>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p className="text-secondary">A carregar...</p>
      ) : team.length === 0 ? (
        <GlassCard className="empty-state">
          <p>Ainda sem equipa.</p>
        </GlassCard>
      ) : (
        <div className="member-grid">
          {team.map((person) => (
            <GlassCard key={person.id} className="member-tile" style={{ "--role-color": ROLE_COLORS[person.role] }}>
              <div className="member-tile-header">
                {person.avatar_url ? (
                  <img src={resolveAssetUrl(person.avatar_url)} alt="" className="member-card-avatar" />
                ) : (
                  <span className="member-card-avatar member-card-avatar-fallback">
                    {person.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="member-tile-identity">
                  <span className="member-tile-name">{person.name}</span>
                  <span className="member-tile-role">{ROLE_LABELS[person.role] || person.role}</span>
                </div>
              </div>
              <div className="member-tile-email">{person.email}</div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
