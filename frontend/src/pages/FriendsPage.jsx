import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import InfoTooltip from "../components/InfoTooltip";
import { IconLink, IconShare, IconUsers, IconUser, IconTrophy } from "../components/Icons";
import { apiRequest, resolveAssetUrl } from "../api/client";
import { ROLE_LABELS } from "../utils/roles";

const PERIODS = [
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
  { value: "year", label: "Ano" },
];

function RankAvatar({ person }) {
  const url = resolveAssetUrl(person.avatar_url);
  if (url) return <img src={url} alt="" className="member-card-avatar ranking-row-avatar" />;
  return (
    <span className="member-card-avatar member-card-avatar-fallback ranking-row-avatar">
      {person.name.charAt(0).toUpperCase()}
    </span>
  );
}

// Lista de posições, com a própria linha destacada (is_me). `metric` é o
// texto já formatado à direita (ex: "5 dias" ou "62%") — treino e
// nutrição mostram unidades diferentes, por isso quem chama decide o
// texto em vez deste componente adivinhar.
function RankingList({ rows, metric, emptyText }) {
  if (rows.length === 0) {
    return <p className="text-secondary" style={{ padding: "8px 0" }}>{emptyText}</p>;
  }
  return (
    <ol className="ranking-list">
      {rows.map((row, i) => (
        <li key={row.user.id} className={`ranking-row${row.is_me ? " ranking-row-me" : ""}`}>
          <span className="ranking-row-position">{i + 1}º</span>
          <RankAvatar person={row.user} />
          <span className="ranking-row-name">{row.user.name}{row.is_me && " (tu)"}</span>
          <span className="ranking-row-metric">{metric(row)}</span>
        </li>
      ))}
    </ol>
  );
}

// Aceita tanto um código ("SP5PZHNQ") como um link completo colado pela
// pessoa — extrai sempre só o código.
function extractCode(input) {
  const trimmed = input.trim();
  const match = trimmed.match(/\/invite\/([A-Za-z0-9]+)/);
  return (match ? match[1] : trimmed).toUpperCase();
}

function FriendAvatar({ person }) {
  const url = resolveAssetUrl(person.avatar_url);
  if (url) return <img src={url} alt="" className="member-card-avatar" />;
  return <span className="member-card-avatar member-card-avatar-fallback">{person.name.charAt(0).toUpperCase()}</span>;
}

function FriendRow({ person, action }) {
  return (
    <div className="friend-row">
      <Link to={`/friends/${person.id}`} className="friend-row-identity">
        <FriendAvatar person={person} />
        <div>
          <span className="friend-row-name">{person.name}</span>
          <span className="friend-row-role">{ROLE_LABELS[person.role] || person.role}</span>
        </div>
      </Link>
      {action}
    </div>
  );
}

export default function FriendsPage() {
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState("");
  const [following, setFollowing] = useState(null);
  const [followers, setFollowers] = useState(null);
  // "?tab=followers" (ver ProfilePage.jsx) abre já na lista de seguidores
  // em vez de "a seguir", que é o separador por omissão.
  const [tab, setTab] = useState(searchParams.get("tab") === "followers" ? "followers" : "following");
  const [addValue, setAddValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [period, setPeriod] = useState("month");
  const [ranking, setRanking] = useState(null);

  function load() {
    apiRequest("/friends/me/code").then((d) => setCode(d.code));
    apiRequest("/friends/following").then(setFollowing);
    apiRequest("/friends/followers").then(setFollowers);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (tab !== "ranking") return;
    setRanking(null);
    apiRequest(`/friends/ranking?period=${period}`)
      .then(setRanking)
      .catch((err) => setError(err.message));
  }, [tab, period]);

  const inviteUrl = code ? `${window.location.origin}/invite/${code}` : "";
  const followingIds = new Set((following || []).map((f) => f.id));

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Não foi possível copiar o link.");
    }
  }

  async function shareLink() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Vem treinar comigo!", text: "Segue o meu progresso na app:", url: inviteUrl });
      } catch {
        // cancelado pela pessoa — não é um erro a mostrar
      }
    } else {
      copyLink();
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!addValue.trim()) return;
    setError("");
    setAdding(true);
    try {
      await apiRequest("/friends/follow", { method: "POST", body: { code: extractCode(addValue) } });
      setAddValue("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function followBack(id) {
    try {
      await apiRequest(`/friends/follow-id/${id}`, { method: "POST" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const list = tab === "following" ? following : followers;

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="log-header">
          <span className="log-header-icon">
            <IconUsers size={22} />
          </span>
          <h1>Amigos</h1>
        </div>
      </div>

      <GlassCard className="friends-link-card" strong>
        <h3>O teu link</h3>
        <div className="friends-link-row">
          <button type="button" className="glass-button glass-button-secondary" onClick={copyLink} disabled={!code}>
            {copied ? "Copiado!" : "Copiar"}
          </button>
          <button type="button" className="glass-button" onClick={shareLink} disabled={!code}>
            <IconShare size={16} /> Partilhar
          </button>
        </div>
      </GlassCard>

      <GlassCard className="friends-add-card" strong>
        <h3>
          <IconLink size={18} /> Adicionar por link ou código
        </h3>
        <form className="friends-add-form" onSubmit={handleAdd}>
          <input
            type="text"
            className="glass-input"
            placeholder="Cola aqui o link ou código do teu amigo"
            value={addValue}
            onChange={(e) => setAddValue(e.target.value)}
          />
          <button type="submit" className="glass-button" disabled={adding || !addValue.trim()}>
            {adding ? "A adicionar..." : "Seguir"}
          </button>
        </form>
      </GlassCard>

      {error && <p className="error-text">{error}</p>}

      <div className="friends-tabs">
        <button type="button" className={`friends-tab${tab === "following" ? " active" : ""}`} onClick={() => setTab("following")}>
          A seguir {following ? `(${following.length})` : ""}
        </button>
        <button type="button" className={`friends-tab${tab === "followers" ? " active" : ""}`} onClick={() => setTab("followers")}>
          Seguidores {followers ? `(${followers.length})` : ""}
        </button>
        <button type="button" className={`friends-tab${tab === "ranking" ? " active" : ""}`} onClick={() => setTab("ranking")}>
          <IconTrophy size={14} /> Ranking
        </button>
      </div>

      {tab !== "ranking" && list === null && <p className="text-secondary">A carregar...</p>}
      {tab !== "ranking" && list?.length === 0 && (
        <GlassCard className="empty-state">
          <p>
            {tab === "following"
              ? "Ainda não segues ninguém — usa o código de um amigo acima."
              : "Ainda ninguém te segue — partilha o teu link."}
          </p>
        </GlassCard>
      )}

      {tab !== "ranking" && (
        <div className="friends-list">
          {list?.map((person) => (
            <FriendRow
              key={person.id}
              person={person}
              action={
                tab === "followers" && !followingIds.has(person.id) ? (
                  <button type="button" className="glass-button glass-button-secondary friends-follow-back" onClick={() => followBack(person.id)}>
                    <IconUser size={14} /> Seguir
                  </button>
                ) : null
              }
            />
          ))}
        </div>
      )}

      {tab === "ranking" && (
        <>
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

          {ranking === null && <p className="text-secondary">A carregar...</p>}

          {ranking && (following === null || following.length === 0) && (
            <GlassCard className="empty-state">
              <p>O ranking compara-te com quem segues — segue alguém para teres com quem competir.</p>
            </GlassCard>
          )}

          {ranking && following?.length > 0 && (
            <>
              <GlassCard className="friends-link-card" strong style={{ marginTop: 16 }}>
                <h3>
                  <IconTrophy size={16} /> Treino
                  <InfoTooltip text="1 ponto por dia treinado — não conta peso levantado nem horas, só se treinaste ou não. 'Semana' é desde segunda-feira, reinicia toda semana." />
                </h3>
                <RankingList
                  rows={ranking.training}
                  metric={(row) => `${row.points} ${row.points === 1 ? "dia" : "dias"}`}
                  emptyText="Ninguém treinou ainda neste período."
                />
              </GlassCard>

              <GlassCard className="friends-link-card" strong style={{ marginTop: 16 }}>
                <h3>
                  <IconTrophy size={16} /> Nutrição
                  <InfoTooltip text="% de refeições cumpridas do plano ativo nesse período — só entra quem segue um plano de nutrição; não ter plano não afeta o ranking de treino. 'Semana' é desde segunda-feira." />
                </h3>
                <RankingList
                  rows={ranking.nutrition}
                  metric={(row) => `${row.percentage}% (${row.completed}/${row.total})`}
                  emptyText="Ninguém com plano de nutrição ativo neste grupo."
                />
              </GlassCard>
            </>
          )}
        </>
      )}
    </div>
  );
}
