import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { resolveAssetUrl } from "../api/client";
import { IconLogoMark, IconMenu } from "./Icons";

// Barra fixa no topo, só visível em mobile (ver @media em App.css) — fica
// sempre no mesmo sítio em todas as páginas (não é fixed, é sticky dentro
// do fluxo normal, por isso não precisa de nenhum padding-top "adivinhado"
// no resto da página). Dá sempre acesso a 3 coisas, em qualquer ecrã:
// logótipo -> página principal do role, avatar -> perfil, hambúrguer ->
// gaveta com a navegação completa da Sidebar.
export default function MobileTopBar({ onOpenDrawer }) {
  const { user } = useAuth();
  if (!user) return null;

  const isDono = user.role === "dono";
  const isOwner = user.role === "gym_owner";
  const isReceptionStation = user.role === "reception_station";
  const homeTo = isDono ? "/dono" : isOwner ? "/management" : isReceptionStation ? "/occupancy" : "/dashboard";

  return (
    <header className="mobile-top-bar">
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
