import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useBackOverride } from "../context/BackOverrideContext";
import { resolveAssetUrl } from "../api/client";
import { IconChevronRight, IconLogoMark, IconMenu } from "./Icons";

// Barra fixa no topo, só visível em mobile (ver @media em App.css) — fica
// sempre no mesmo sítio em todas as páginas (não é fixed, é sticky dentro
// do fluxo normal, por isso não precisa de nenhum padding-top "adivinhado"
// no resto da página). Dá sempre acesso a 4 coisas, em qualquer ecrã:
// voltar -> página anterior, logótipo -> página principal do role,
// avatar -> perfil, hambúrguer -> gaveta com a navegação completa da
// Sidebar.
export default function MobileTopBar({ onOpenDrawer }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { runBack } = useBackOverride();
  if (!user) return null;

  const isDono = user.role === "dono";
  const isOwner = user.role === "gym_owner";
  const isReceptionStation = user.role === "reception_station";
  const homeTo = isDono ? "/dono" : isOwner ? "/management" : isReceptionStation ? "/occupancy" : "/dashboard";

  // navigate(-1) sem mais nada sai da app quando não há histórico dentro
  // dela (ex: primeira página depois do login, ou o WebView Android — aí
  // "voltar" sem histórico aciona o gesto nativo de sair da app). window.
  // history.state.idx (React Router guarda isto) só é > 0 se já navegámos
  // para algum lado nesta sessão do browser; sem isso, vai para o início.
  function goBack() {
    const idx = window.history.state?.idx;
    if (typeof idx === "number" && idx > 0) {
      navigate(-1);
    } else {
      navigate(homeTo);
    }
  }

  return (
    <header className="mobile-top-bar">
      <button
        type="button"
        className="mobile-top-bar-back"
        onClick={() => runBack(goBack)}
        aria-label="Voltar à página anterior"
      >
        <span className="mobile-top-bar-back-icon">
          <IconChevronRight size={20} />
        </span>
      </button>
      <NavLink to={homeTo} className="mobile-top-bar-logo" aria-label="Ir para o início">
        <IconLogoMark size={22} />
      </NavLink>
      <div className="mobile-top-bar-actions">
        <NavLink to="/profile" className="mobile-top-bar-avatar" aria-label="O teu perfil">
          {user.avatar_url ? (
            <img src={resolveAssetUrl(user.avatar_url)} alt="" />
          ) : (
            <span>{user.name.charAt(0).toUpperCase()}</span>
          )}
        </NavLink>
        <button type="button" className="mobile-top-bar-hamburger" onClick={onOpenDrawer} aria-label="Abrir menu">
          <IconMenu size={20} />
        </button>
      </div>
    </header>
  );
}
