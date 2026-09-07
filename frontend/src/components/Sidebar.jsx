import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { resolveAssetUrl } from "../api/client";
import { IconDumbbell } from "./Icons";

const NAV_LINK_CLASS = ({ isActive }) => `sidebar-link${isActive ? " active" : ""}`;
const STAFF_ROLES = ["gym_owner", "personal_trainer", "nutritionist", "receptionist"];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <aside className="sidebar glass">
      <NavLink to="/dashboard" className="sidebar-brand">
        <IconDumbbell size={20} />
        Workout Tracker
      </NavLink>

      <nav className="sidebar-nav">
        <NavLink to="/plans" className={NAV_LINK_CLASS}>
          Planos de Treino
        </NavLink>
        <NavLink to="/nutrition" className={NAV_LINK_CLASS}>
          Planos de Nutrição
        </NavLink>

        {user && (
          <>
            <div className="sidebar-divider" />
            <NavLink to="/dashboard" className={NAV_LINK_CLASS}>
              Os teus treinos
            </NavLink>
            <NavLink to="/log" className={NAV_LINK_CLASS}>
              Registar treino
            </NavLink>
            <NavLink to="/messages" className={NAV_LINK_CLASS}>
              Mensagens
            </NavLink>
          </>
        )}

        {user && STAFF_ROLES.includes(user.role) && (
          <>
            <div className="sidebar-divider" />
            <NavLink to="/members" className={NAV_LINK_CLASS}>
              Membros
            </NavLink>
          </>
        )}

        <div className="sidebar-divider" />
        <NavLink to="/download" className={NAV_LINK_CLASS}>
          Download
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        {user ? (
          <>
            <NavLink to="/profile" className="sidebar-user" title="Ver perfil">
              {user.avatar_url ? (
                <img src={resolveAssetUrl(user.avatar_url)} alt="" className="sidebar-user-avatar" />
              ) : (
                <span className="sidebar-user-avatar sidebar-user-avatar-fallback">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="sidebar-user-name">{user.name}</span>
            </NavLink>
            <button className="glass-button glass-button-secondary sidebar-logout" onClick={handleLogout}>
              Sair
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login" className="glass-button glass-button-secondary">
              Entrar
            </NavLink>
            <NavLink to="/register" className="glass-button">
              Criar conta
            </NavLink>
          </>
        )}
      </div>
    </aside>
  );
}
