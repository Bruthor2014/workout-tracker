import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import { apiRequest, resolveAssetUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABELS } from "../utils/roles";

// Página pública do link de convite (/invite/:code) — funciona com ou sem
// sessão iniciada. Sem sessão, guarda o código e manda para login/registo;
// o AppLayout, assim que detetar sessão + código pendente, segue a pessoa
// automaticamente (ver AppLayout.jsx).
export default function InvitePage() {
  const { code } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [following, setFollowing] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    apiRequest(`/friends/preview/${code}`)
      .then(setPreview)
      .catch((err) => setError(err.message));
  }, [code]);

  async function handleFollow() {
    setFollowing(true);
    setError("");
    try {
      await apiRequest("/friends/follow", { method: "POST", body: { code } });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setFollowing(false);
    }
  }

  function goToAuth(path) {
    try {
      localStorage.setItem("pendingFriendCode", code);
    } catch {}
    navigate(path);
  }

  const avatarUrl = preview ? resolveAssetUrl(preview.avatar_url) : null;
  const isSelf = user && preview && user.id === preview.id;

  return (
    <div className="page-center">
      <GlassCard className="auth-card">
        {error && <p className="error-text">{error}</p>}

        {!preview && !error && <p className="text-secondary">A carregar convite...</p>}

        {preview && (
          <>
            <div className="invite-preview">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="member-card-avatar" />
              ) : (
                <span className="member-card-avatar member-card-avatar-fallback">{preview.name.charAt(0).toUpperCase()}</span>
              )}
              <h1 style={{ margin: "10px 0 2px" }}>{preview.name}</h1>
              <p className="text-secondary" style={{ margin: 0 }}>{ROLE_LABELS[preview.role] || preview.role}</p>
            </div>

            {isSelf ? (
              <p className="text-secondary" style={{ textAlign: "center", marginTop: 20 }}>Este é o teu próprio link de convite.</p>
            ) : done ? (
              <>
                <p className="text-secondary" style={{ textAlign: "center", marginTop: 20 }}>
                  Já segues {preview.name}! 🎉
                </p>
                <button type="button" className="glass-button" style={{ width: "100%", marginTop: 10 }} onClick={() => navigate(`/friends/${preview.id}`)}>
                  Ver comparação
                </button>
              </>
            ) : user ? (
              <button type="button" className="glass-button" style={{ width: "100%", marginTop: 20 }} onClick={handleFollow} disabled={following}>
                {following ? "A seguir..." : `Seguir ${preview.name}`}
              </button>
            ) : (
              <>
                <p className="text-secondary" style={{ textAlign: "center", marginTop: 20 }}>
                  Cria conta ou entra para seguires {preview.name} e veres o progresso de treinos.
                </p>
                <button type="button" className="glass-button" style={{ width: "100%", marginTop: 10 }} onClick={() => goToAuth("/register")}>
                  Criar conta
                </button>
                <button type="button" className="glass-button glass-button-secondary" style={{ width: "100%", marginTop: 10 }} onClick={() => goToAuth("/login")}>
                  Já tenho conta
                </button>
              </>
            )}
          </>
        )}
      </GlassCard>
    </div>
  );
}
