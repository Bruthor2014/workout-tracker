import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import InfoTooltip from "../components/InfoTooltip";
import {
  IconLink,
  IconShare,
  IconUsers,
  IconUser,
  IconTrophy,
  IconDumbbell,
  IconMessage,
  IconTrash,
  IconChevronRight,
  IconCamera,
} from "../components/Icons";
import SessionCommentsModal from "../components/SessionCommentsModal";
import { apiRequest, resolveAssetUrl } from "../api/client";
import { ROLE_LABELS } from "../utils/roles";
import { workoutVisual, muscleGroupVisual } from "../utils/muscleGroups";

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

const MONTH_LABELS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// "2026-10-03" -> "Hoje" / "Ontem" / "há 3 dias" / "3 out", conforme a
// distância a hoje — mais fácil de ler num feed do que uma data sempre
// fixa. "T00:00:00" força o parsing em hora local, não UTC (mesmo cuidado
// que DashboardPage.jsx).
function formatFeedDate(dateKey) {
  const d = new Date(`${dateKey}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today - d) / 86400000);
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays > 1 && diffDays < 7) return `há ${diffDays} dias`;
  return `${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`;
}

// Minutos entre started_at/ended_at, só quando o treino foi feito com
// cronómetro ou com duração escrita à mão (ver LogWorkoutPage.jsx — mesmo
// num registo manual, started_at/ended_at ficam preenchidos a partir da
// duração escrita). Só fica a null num registo antigo/retroativo sem
// nenhuma das duas coisas.
function feedDuration(session) {
  if (!session.started_at || !session.ended_at) return null;
  const minutes = Math.round((new Date(session.ended_at) - new Date(session.started_at)) / 60000);
  return minutes > 0 ? minutes : null;
}

function formatDuration(minutes) {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}

// Hora a que o treino foi publicado (created_at, não performed_at — essa é
// só a data do treino em si, sem hora).
function formatFeedTime(createdAt) {
  return new Date(createdAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

// Grelha de exercícios feitos, com a mesma foto/pictograma do grupo
// muscular que já se vê ao registar o treino (ver WorkoutExerciseBlock.jsx/
// ExercisePicker.jsx) — pedido explícito: "devia aparecer tal como quando
// fazes o treino", não só uma lista de nomes.
function FeedExerciseGrid({ exercises }) {
  if (!exercises || exercises.length === 0) return null;
  return (
    <div className="feed-item-exercise-grid">
      {exercises.map((ex) => {
        const { icon: Icon, color } = muscleGroupVisual(ex.muscle_group);
        return (
          <div key={ex.exercise_id} className="feed-item-exercise-card" style={{ "--exercise-color": color }}>
            <span className="feed-item-exercise-media">
              {/* As fotos dos exercícios vivem no frontend (public/exercises/), não
                  no backend — nunca passar por resolveAssetUrl (isso é só para
                  ficheiros carregados, ex: fotos de treino). Mesmo padrão que
                  PlanCard.jsx/PlanExercise usa. */}
              {ex.image_url ? <img src={ex.image_url} alt="" loading="lazy" /> : <Icon size={30} />}
            </span>
            <span className="feed-item-exercise-caption">
              {ex.set_count} x {ex.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Adicionar/trocar a foto de um treino PRÓPRIO já registado (não só no
// passo logo a seguir a terminar o treino, em LogWorkoutPage.jsx) — mesmo
// endpoint (POST /sessions/:id/photo), que já aceita substituir uma foto
// existente. `onUploaded` recebe o novo photo_url (string) para o cartão
// atualizar logo, sem esperar o feed recarregar.
function FeedPhotoUpload({ sessionId, variant, onUploaded }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("photo", file);
      const result = await apiRequest(`/sessions/${sessionId}/photo`, { method: "POST", body: form });
      onUploaded(result.photo_url);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`feed-item-photo-upload ${variant}`}
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        <IconCamera size={variant === "add" ? 18 : 15} />
        {variant === "add" && <span>{uploading ? "A enviar..." : "Adicionar foto"}</span>}
      </button>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleFile} />
      {error && <p className="error-text">{error}</p>}
    </>
  );
}

// Quando há foto E exercícios: a foto aparece primeiro, depois desliza-se
// para o lado para ver o treino — pedido explícito ("deve aparecer em 1 a
// imagem e depois... para ver o treino feito"). Scroll nativo com snap
// (por arrasto/toque em qualquer aparelho) + setas e pontos clicáveis —
// num PC não há gesto de arrastar por toque, por isso as setas são a única
// forma de avançar sem um rato com scroll horizontal.
function FeedCarousel({ photoUrl, exercises, sessionId, isMine, onPhotoChanged }) {
  const [active, setActive] = useState(0);
  const trackRef = useRef(null);

  function handleScroll() {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    setActive(Math.round(el.scrollLeft / el.clientWidth));
  }

  function goTo(index) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
    setActive(index);
  }

  return (
    <div className="feed-item-carousel-wrap">
      <div className="feed-item-carousel" ref={trackRef} onScroll={handleScroll}>
        <div className="feed-item-carousel-slide feed-item-photo">
          <img src={photoUrl} alt="" loading="lazy" />
          {isMine && <FeedPhotoUpload sessionId={sessionId} variant="change" onUploaded={onPhotoChanged} />}
        </div>
        <div className="feed-item-carousel-slide feed-item-carousel-exercises">
          <FeedExerciseGrid exercises={exercises} />
        </div>
      </div>

      {active > 0 && (
        <button
          type="button"
          className="feed-item-carousel-arrow prev"
          onClick={() => goTo(active - 1)}
          aria-label="Ver a foto"
        >
          <IconChevronRight size={18} />
        </button>
      )}
      {active < 1 && (
        <button
          type="button"
          className="feed-item-carousel-arrow next"
          onClick={() => goTo(active + 1)}
          aria-label="Ver o treino"
        >
          <IconChevronRight size={18} />
        </button>
      )}

      <div className="feed-item-carousel-dots">
        {[0, 1].map((i) => (
          <button
            key={i}
            type="button"
            className={i === active ? "active" : ""}
            onClick={() => goTo(i)}
            aria-label={i === 0 ? "Ver a foto" : "Ver o treino"}
          />
        ))}
      </div>
    </div>
  );
}

// Fila de ações em baixo do cartão (Gostar / Comentar), tal
// como o resto da app trata o resto do feed. Estado local otimista para a
// reação e o contador de comentários — a verdade volta a vir certa da
// próxima vez que o feed recarregar.
function FeedActions({ session, onDeleted }) {
  const [reacted, setReacted] = useState(session.reacted_by_me);
  const [reactionCount, setReactionCount] = useState(session.reaction_count);
  const [reacting, setReacting] = useState(false);
  const [commentCount, setCommentCount] = useState(session.comment_count);
  const [commenting, setCommenting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function toggleReaction() {
    setReacting(true);
    try {
      const result = await apiRequest(`/sessions/${session.id}/reaction`, { method: "POST" });
      setReacted(result.reacted);
      setReactionCount(result.reaction_count);
    } catch {
      // falha silenciosa — não há nada de crítico a avisar aqui
    } finally {
      setReacting(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Eliminar este treino? Não podes desfazer isto.")) return;
    setDeleting(true);
    try {
      await apiRequest(`/sessions/${session.id}`, { method: "DELETE" });
      onDeleted(session.id);
    } catch {
      setDeleting(false);
    }
  }

  return (
    <>
      {(reactionCount > 0 || commentCount > 0) && (
        <div className="feed-item-social-proof">
          {reactionCount > 0 && (
            <span>
              👏 {reactionCount} {reactionCount === 1 ? "reação" : "reações"}
            </span>
          )}
          {commentCount > 0 && (
            <button type="button" onClick={() => setCommenting(true)}>
              {commentCount} {commentCount === 1 ? "comentário" : "comentários"}
            </button>
          )}
        </div>
      )}

      <div className="feed-item-actions">
        <button
          type="button"
          className={`feed-item-action${reacted ? " active" : ""}`}
          onClick={toggleReaction}
          disabled={reacting}
        >
          <span aria-hidden="true">👏</span> Gostar
        </button>
        <button type="button" className="feed-item-action" onClick={() => setCommenting(true)}>
          <IconMessage size={16} /> Comentar
        </button>
        {session.is_mine && (
          <button
            type="button"
            className="feed-item-action feed-item-action-delete"
            onClick={handleDelete}
            disabled={deleting}
            aria-label="Eliminar treino"
          >
            <IconTrash size={16} />
          </button>
        )}
      </div>

      {commenting && (
        <SessionCommentsModal
          sessionId={session.id}
          onClose={() => setCommenting(false)}
          onCountChange={setCommentCount}
        />
      )}
    </>
  );
}

// Um treino no feed (o próprio ou de um amigo) — cartão tipo rede social:
// identidade + hora de publicação, título, duração/volume lado a lado,
// depois a foto (se houver) e os exercícios feitos tal como aparecem ao
// registar o treino, e por fim gostos/comentários/partilhar. O acento de
// cor (farol lateral do cartão) vem de workoutVisual(), o mesmo utilitário
// que já escolhe cor/ícone de um treino noutros sítios da app (calendário
// semanal, histórico) — garante que o mesmo treino tem sempre a mesma cor
// em toda a parte.
function FeedItem({ session, onDeleted }) {
  const duration = feedDuration(session);
  const visual = workoutVisual(session.muscle_groups);
  // Substituído localmente só depois de um upload bem-sucedido (ver
  // FeedPhotoUpload) — `undefined` = sem substituição, usa o que veio do
  // feed; mesmo padrão de "sobreposição local" já usado em ExercisePicker.jsx
  // (videoOverrides) para não ter de recarregar o feed inteiro só por isto.
  const [photoOverride, setPhotoOverride] = useState(undefined);
  const rawPhoto = photoOverride !== undefined ? photoOverride : session.photo_url;
  const photoUrl = resolveAssetUrl(rawPhoto);
  return (
    <div className="feed-item" style={{ "--exercise-color": visual.color }}>
      <div className="feed-item-top">
        <Link to={`/friends/${session.user.id}`} className="feed-item-identity">
          <FriendAvatar person={session.user} />
          <div>
            <span className="feed-item-name">{session.user.name}</span>
            <span className="feed-item-sub">
              {formatFeedDate(session.performed_at)} às {formatFeedTime(session.created_at)}
            </span>
          </div>
        </Link>
      </div>

      <p className="feed-item-headline">{session.title || session.muscle_groups || "Treino"}</p>

      <div className="feed-item-stat-pair">
        <div className="feed-item-stat-block">
          <span className="feed-item-stat-label">Duração</span>
          <strong>{formatDuration(duration)}</strong>
        </div>
        <div className="feed-item-stat-block">
          <span className="feed-item-stat-label">Volume</span>
          <strong>{session.total_weight_kg}kg</strong>
        </div>
      </div>

      {photoUrl && session.exercises?.length > 0 ? (
        <FeedCarousel
          photoUrl={photoUrl}
          exercises={session.exercises}
          sessionId={session.id}
          isMine={session.is_mine}
          onPhotoChanged={setPhotoOverride}
        />
      ) : photoUrl ? (
        <div className="feed-item-photo">
          <img src={photoUrl} alt="" loading="lazy" />
          {session.is_mine && (
            <FeedPhotoUpload sessionId={session.id} variant="change" onUploaded={setPhotoOverride} />
          )}
        </div>
      ) : (
        <>
          <FeedExerciseGrid exercises={session.exercises} />
          {session.is_mine && (
            <FeedPhotoUpload sessionId={session.id} variant="add" onUploaded={setPhotoOverride} />
          )}
        </>
      )}

      <FeedActions session={session} onDeleted={onDeleted} />
    </div>
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
  // "?tab=followers" (ver ProfilePage.jsx) abre já na lista de seguidores;
  // sem parâmetro, o separador por omissão é o feed.
  const [tab, setTab] = useState(searchParams.get("tab") || "feed");
  const [addValue, setAddValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [period, setPeriod] = useState("month");
  const [ranking, setRanking] = useState(null);
  const [feed, setFeed] = useState(null);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);

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

  useEffect(() => {
    if (tab !== "feed") return;
    setFeed(null);
    apiRequest("/friends/feed")
      .then((d) => {
        setFeed(d.sessions);
        setFeedHasMore(d.has_more);
      })
      .catch((err) => setError(err.message));
  }, [tab]);

  async function loadMoreFeed() {
    if (!feed || feed.length === 0) return;
    setFeedLoadingMore(true);
    try {
      const cursor = feed[feed.length - 1].id;
      const d = await apiRequest(`/friends/feed?before=${cursor}`);
      setFeed((prev) => [...prev, ...d.sessions]);
      setFeedHasMore(d.has_more);
    } catch (err) {
      setError(err.message);
    } finally {
      setFeedLoadingMore(false);
    }
  }

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
        <button type="button" className={`friends-tab${tab === "feed" ? " active" : ""}`} onClick={() => setTab("feed")}>
          <IconDumbbell size={14} /> Feed
        </button>
        <button type="button" className={`friends-tab${tab === "ranking" ? " active" : ""}`} onClick={() => setTab("ranking")}>
          <IconTrophy size={14} /> Ranking
        </button>
        <button type="button" className={`friends-tab${tab === "following" ? " active" : ""}`} onClick={() => setTab("following")}>
          A seguir {following ? `(${following.length})` : ""}
        </button>
        <button type="button" className={`friends-tab${tab === "followers" ? " active" : ""}`} onClick={() => setTab("followers")}>
          Seguidores {followers ? `(${followers.length})` : ""}
        </button>
      </div>

      {tab !== "ranking" && tab !== "feed" && list === null && <p className="text-secondary">A carregar...</p>}
      {tab !== "ranking" && tab !== "feed" && list?.length === 0 && (
        <GlassCard className="empty-state">
          <p>
            {tab === "following"
              ? "Ainda não segues ninguém — usa o código de um amigo acima."
              : "Ainda ninguém te segue — partilha o teu link."}
          </p>
        </GlassCard>
      )}

      {tab !== "ranking" && tab !== "feed" && (
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
                  <InfoTooltip text="1 treino = 1 ponto." />
                </h3>
                <RankingList
                  rows={ranking.training}
                  metric={(row) => `${row.points} ${row.points === 1 ? "ponto" : "pontos"}`}
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

      {tab === "feed" && (
        <>
          {feed === null && <p className="text-secondary">A carregar...</p>}

          {feed && feed.length === 0 && (
            <GlassCard className="empty-state">
              <p>Ainda não há treinos aqui — regista um treino ou segue amigos para veres o feed.</p>
            </GlassCard>
          )}

          {feed && feed.length > 0 && (
            <div className="feed-list">
              {feed.map((session) => (
                <FeedItem
                  key={session.id}
                  session={session}
                  onDeleted={(id) => setFeed((prev) => prev.filter((s) => s.id !== id))}
                />
              ))}
              {feedHasMore && (
                <button type="button" className="glass-button glass-button-secondary" onClick={loadMoreFeed} disabled={feedLoadingMore}>
                  {feedLoadingMore ? "A carregar..." : "Ver mais"}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
