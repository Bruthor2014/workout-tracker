import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import ProgressChart from "../components/ProgressChart";
import { apiRequest, resolveAssetUrl } from "../api/client";
import { ROLE_LABELS } from "../utils/roles";

// Cor fixa por PESSOA (não por métrica) — o verde do tema é sempre "tu", o
// azul é sempre a outra pessoa, em todos os gráficos da comparação.
const MINE_COLOR = "var(--accent)";
const FRIEND_COLOR = "#3b82f6";

// Mesmos períodos do separador "Ranking" em FriendsPage.jsx — a
// granularidade dos gráficos muda com o período (ver buildBuckets no
// backend): um ponto por dia na semana, por semana no mês, por mês no ano.
const PERIODS = [
  { value: "week", label: "Semana", caption: "Esta semana, por dia" },
  { value: "month", label: "Mês", caption: "Este mês, por semana" },
  { value: "year", label: "Ano", caption: "Este ano, por mês" },
];

const fmt = (n, digits = 0) => Number(n).toLocaleString("pt-PT", { maximumFractionDigits: digits });

function WeeklyChart({ title, caption, points, points2, formatValue }) {
  return (
    <GlassCard className="profile-chart-card" strong>
      <h3>{title}</h3>
      <p className="text-secondary">{caption}</p>
      <ProgressChart
        kind="line"
        color={MINE_COLOR}
        points={points}
        color2={FRIEND_COLOR}
        points2={points2}
        formatValue={formatValue}
        ariaLabel={title}
      />
    </GlassCard>
  );
}

export default function FriendComparePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [unfollowing, setUnfollowing] = useState(false);

  useEffect(() => {
    setData(null);
    apiRequest(`/friends/${id}/compare?period=${period}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [id, period]);

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
  const caption = PERIODS.find((p) => p.value === period)?.caption ?? "";

  const seriesPoints = (series, key) =>
    series.map((pt) => ({ label: pt.label, tooltipLabel: pt.label, value: pt[key] }));
  const nutritionPoints = (series) =>
    series.map((pt) => ({ label: pt.label, tooltipLabel: pt.label, value: pt.percentage ?? 0 }));

  const hasNutrition = me.nutrition.some((w) => w.percentage != null) || friend.nutrition.some((w) => w.percentage != null);

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
            className={`team-chip${period === p.value ? " active" : ""}`}
            onClick={() => setPeriod(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Nomes diretos, cor igual à linha do gráfico — para nunca haver
          dúvida de qual é qual, sem depender de ler um quadradinho pequeno. */}
      <div className="compare-legend">
        <span className="compare-legend-item mine">Tu</span>
        <span className="compare-legend-item theirs">{friend.user.name}</span>
      </div>

      <div className="profile-charts">
        <WeeklyChart
          title="Treinos"
          caption={caption}
          points={seriesPoints(me.training, "sessions")}
          points2={seriesPoints(friend.training, "sessions")}
          formatValue={(v, axis) => (axis ? fmt(v) : `${fmt(v)} ${v === 1 ? "treino" : "treinos"}`)}
        />
        <WeeklyChart
          title="Horas"
          caption={caption}
          points={seriesPoints(me.training, "hours")}
          points2={seriesPoints(friend.training, "hours")}
          formatValue={(v, axis) => (axis ? `${fmt(v, 1)}h` : `${fmt(v, 1)} h`)}
        />
        <WeeklyChart
          title="Volume"
          caption={caption}
          points={seriesPoints(me.training, "volume")}
          points2={seriesPoints(friend.training, "volume")}
          formatValue={(v, axis) => (axis ? (v >= 1000 ? `${fmt(v / 1000, 1)}k` : fmt(v)) : `${fmt(v)} kg`)}
        />
        {hasNutrition && (
          <WeeklyChart
            title="Nutrição"
            caption={caption}
            points={nutritionPoints(me.nutrition)}
            points2={nutritionPoints(friend.nutrition)}
            formatValue={(v) => `${fmt(v)}%`}
          />
        )}
      </div>
    </div>
  );
}
