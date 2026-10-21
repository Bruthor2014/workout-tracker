import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import ProgressChart from "../components/ProgressChart";
import { IconDumbbell, IconFlame } from "../components/Icons";
import { apiRequest, resolveAssetUrl } from "../api/client";
import { ROLE_LABELS } from "../utils/roles";

const PERIODS = [
  { value: 7, label: "7 dias" },
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
];

// Mesmas cores do perfil (ProfileProgress) para a série principal; a do
// amigo é sempre a mesma cor neutra tracejada, para nunca se confundir com
// o tema do ginásio de ninguém.
const HOURS_COLOR = "var(--accent-strong)";
const VOLUME_COLOR = "#0d9488";
const FRIEND_COLOR = "#94a3b8";

const fmt = (n, digits = 0) => Number(n).toLocaleString("pt-PT", { maximumFractionDigits: digits });

function CompareRow({ icon: Icon, label, meValue, friendValue, unit }) {
  const meNum = Number(meValue) || 0;
  const friendNum = Number(friendValue) || 0;
  const total = meNum + friendNum;
  const mePct = total > 0 ? (meNum / total) * 100 : 50;

  return (
    <div className="compare-row">
      <div className="compare-row-label">
        <Icon size={18} />
        <span>{label}</span>
      </div>
      <div className="compare-row-values">
        <span className="compare-value mine">
          {meValue} {unit}
        </span>
        <span className="compare-value theirs">
          {friendValue} {unit}
        </span>
      </div>
      <div className="compare-bar">
        <div className="compare-bar-mine" style={{ width: `${mePct}%` }} />
        <div className="compare-bar-theirs" style={{ width: `${100 - mePct}%` }} />
      </div>
    </div>
  );
}

export default function FriendComparePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [unfollowing, setUnfollowing] = useState(false);

  useEffect(() => {
    setData(null);
    apiRequest(`/friends/${id}/compare?days=${days}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [id, days]);

  async function handleUnfollow() {
    if (!window.confirm("Deixar de seguir esta pessoa? Deixas de ver o resumo dela.")) return;
    setUnfollowing(true);
    try {
      await apiRequest(`/friends/following/${id}`, { method: "DELETE" });
      navigate("/friends");
    } catch (err) {
      setError(err.message);
      setUnfollowing(false);
    }
  }

  if (error) return <div className="page-container"><p className="error-text">{error}</p></div>;
  if (!data) return <div className="page-container"><p className="text-secondary">A carregar...</p></div>;

  const { me, friend } = data;
  const avatarUrl = resolveAssetUrl(friend.user.avatar_url);

  const hoursPoints = me.weekly.map((w) => ({ label: w.label, tooltipLabel: `Semana de ${w.label}`, value: w.hours }));
  const hoursPoints2 = friend.weekly.map((w) => ({ label: w.label, tooltipLabel: `Semana de ${w.label}`, value: w.hours }));
  const volumePoints = me.weekly.map((w) => ({ label: w.label, tooltipLabel: `Semana de ${w.label}`, value: w.volume }));
  const volumePoints2 = friend.weekly.map((w) => ({ label: w.label, tooltipLabel: `Semana de ${w.label}`, value: w.volume }));

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Comparação</h1>
      </div>

      <GlassCard className="friend-compare-header" strong>
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="member-card-avatar" />
        ) : (
          <span className="member-card-avatar member-card-avatar-fallback">{friend.user.name.charAt(0).toUpperCase()}</span>
        )}
        <div>
          <h3 style={{ margin: 0 }}>{friend.user.name}</h3>
          <span className="text-secondary">{ROLE_LABELS[friend.user.role] || friend.user.role}</span>
        </div>
        <button type="button" className="nf-text-danger friend-unfollow-btn" onClick={handleUnfollow} disabled={unfollowing}>
          Deixar de seguir
        </button>
      </GlassCard>

      <div className="compare-period-picker">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            className={`team-chip${days === p.value ? " active" : ""}`}
            onClick={() => setDays(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <GlassCard className="friend-compare-card" strong>
        <div className="compare-legend">
          <span className="compare-legend-item mine">Tu</span>
          <span className="compare-legend-item theirs dashed">{friend.user.name}</span>
        </div>

        <CompareRow icon={IconDumbbell} label="Treinos" meValue={me.stats.sessions_count} friendValue={friend.stats.sessions_count} unit="" />
        <CompareRow icon={IconFlame} label="Streak atual" meValue={me.stats.streak_days} friendValue={friend.stats.streak_days} unit={me.stats.streak_days === 1 ? "dia" : "dias"} />
      </GlassCard>

      {/* Os mesmos gráficos do perfil (ProfileProgress) — a tua série com o
          estilo normal, a do amigo sempre tracejada por cima. */}
      <div className="profile-charts">
        <GlassCard className="profile-chart-card" strong>
          <h3>Horas de treino por semana</h3>
          <p className="text-secondary">Últimas 12 semanas</p>
          <ProgressChart
            kind="bar"
            color={HOURS_COLOR}
            points={hoursPoints}
            color2={FRIEND_COLOR}
            points2={hoursPoints2}
            formatValue={(v, axis) => (axis ? `${fmt(v, 1)}h` : `${fmt(v, 1)} h`)}
            ariaLabel="Horas de treino por semana"
          />
        </GlassCard>
        <GlassCard className="profile-chart-card" strong>
          <h3>Volume levantado por semana</h3>
          <p className="text-secondary">Reps × carga, últimas 12 semanas</p>
          <ProgressChart
            kind="line"
            color={VOLUME_COLOR}
            points={volumePoints}
            color2={FRIEND_COLOR}
            points2={volumePoints2}
            formatValue={(v, axis) => (axis ? (v >= 1000 ? `${fmt(v / 1000, 1)}k` : fmt(v)) : `${fmt(v)} kg`)}
            ariaLabel="Volume levantado por semana"
          />
        </GlassCard>
      </div>
    </div>
  );
}
