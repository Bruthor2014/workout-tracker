import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiRequest, resolveAssetUrl } from "../api/client";
import {
  IconLogoMark,
  IconDumbbell,
  IconCalendar,
  IconUtensils,
  IconPlusCircle,
  IconMessage,
  IconUsers,
  IconDownload,
  IconBuilding,
  IconClock,
  IconClipboard,
  IconBarChart,
  IconCheck,
} from "./Icons";
import { TEAM_ROLES } from "../utils/roles";

const NAV_LINK_CLASS = ({ isActive }) => `sidebar-link${isActive ? " active" : ""}`;

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const isOwner = user?.role === "gym_owner";
  const isDono = user?.role === "dono";
  const isReceptionStation = user?.role === "reception_station";
  // Staff "pessoa" (PT, nutricionista, rececionista, estagiário): treina
  // como um membro normal E tem tarefas profissionais no ginásio — por
  // isso pode alternar entre os dois modos na sidebar.
  const isStaffPerson = !!user && TEAM_ROLES.includes(user.role);

  const [mode, setModeState] = useState("profissional");
  useEffect(() => {
    if (!user || !isStaffPerson) return;
    try {
      const saved = localStorage.getItem(`sidebarMode:${user.id}`);
      if (saved === "individual" || saved === "profissional") setModeState(saved);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  function setMode(next) {
    setModeState(next);
    try { if (user) localStorage.setItem(`sidebarMode:${user.id}`, next); } catch {}
  }

  useEffect(() => {
    if (!user) return;
    apiRequest("/messages/contacts")
      // unread_count vem como texto (COUNT do Postgres é bigint) — sem o
      // Number() a soma concatenava ("0" + "1" + "0" = "010").
      .then((contacts) => setUnreadCount(contacts.reduce((sum, c) => sum + (Number(c.unread_count) || 0), 0)))
      .catch(() => {});
  }, [user]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <aside className="sidebar glass">
      <NavLink to={isDono ? "/dono" : isOwner ? "/management" : isReceptionStation ? "/occupancy" : "/dashboard"} className="sidebar-brand">
        <IconLogoMark size={24} />
        Workout Tracker
      </NavLink>

      <nav className="sidebar-nav">
        {isDono ? (
          // DONO da plataforma: só vê os ginásios.
          <>
            <NavLink to="/dono" className={NAV_LINK_CLASS}>
              <span className="sidebar-link-icon"><IconBuilding size={24} /></span>
              Ginásios
            </NavLink>
          </>
        ) : isOwner ? (
          // CEO: conta de gestão do ginásio — sem treinos nem planos próprios.
          <>
            <NavLink to="/management" className={NAV_LINK_CLASS}>
              <span className="sidebar-link-icon">
                <IconBuilding size={24} />
              </span>
              Gestão
            </NavLink>
            <NavLink to="/members" className={NAV_LINK_CLASS}>
              <span className="sidebar-link-icon">
                <IconUsers size={24} />
              </span>
              Membros
            </NavLink>
            <NavLink to="/classes" className={NAV_LINK_CLASS}>
              <span className="sidebar-link-icon">
                <IconCalendar size={24} />
              </span>
              Aulas de grupo
            </NavLink>
            <NavLink to="/team-schedule" className={NAV_LINK_CLASS}>
              <span className="sidebar-link-icon">
                <IconClock size={24} />
              </span>
              Horários da equipa
            </NavLink>
            <NavLink to="/occupancy" className={NAV_LINK_CLASS}>
              <span className="sidebar-link-icon">
                <IconClipboard size={24} />
              </span>
              Ocupação
            </NavLink>
            <NavLink to="/finance" className={NAV_LINK_CLASS}>
              <span className="sidebar-link-icon">
                <IconBarChart size={24} />
              </span>
              Financeiro
            </NavLink>
            <div className="sidebar-divider" />
            <NavLink to="/messages" className={NAV_LINK_CLASS}>
              <span className="sidebar-link-icon">
                <IconMessage size={24} />
              </span>
              Mensagens
              {unreadCount > 0 && <span className="sidebar-badge">{unreadCount}</span>}
            </NavLink>
          </>
        ) : isReceptionStation ? (
          // RECEÇÃO: conta do PC fixo do balcão (não é uma pessoa) — tarefas
          // operacionais do dia a dia (membros, subscrições, aulas,
          // ocupação), sem treinos/planos próprios, horários da equipa nem
          // financeiro (isso é só para a "rececionista" pessoa).
          <>
            <NavLink to="/classes" className={NAV_LINK_CLASS}>
              <span className="sidebar-link-icon"><IconCalendar size={24} /></span>
              Aulas de grupo
            </NavLink>
            <NavLink to="/team-schedule" className={NAV_LINK_CLASS}>
              <span className="sidebar-link-icon"><IconClock size={24} /></span>
              Horário da equipa
            </NavLink>
            <NavLink to="/occupancy" className={NAV_LINK_CLASS}>
              <span className="sidebar-link-icon"><IconClipboard size={24} /></span>
              Ocupação
            </NavLink>
            <NavLink to="/members" className={NAV_LINK_CLASS}>
              <span className="sidebar-link-icon"><IconUsers size={24} /></span>
              Membros
            </NavLink>
            <div className="sidebar-divider" />
            <NavLink to="/messages" className={NAV_LINK_CLASS}>
              <span className="sidebar-link-icon"><IconMessage size={24} /></span>
              Mensagens
              {unreadCount > 0 && <span className="sidebar-badge">{unreadCount}</span>}
            </NavLink>
          </>
        ) : isStaffPerson ? (
          // PT, nutricionista, rececionista, estagiário: pessoa normal da
          // equipa — treina como um membro E tem tarefas profissionais no
          // ginásio. Alterna entre os dois conjuntos de navegação.
          <>
            <button type="button" className="sidebar-mode-switch"
              onClick={() => setMode(mode === "individual" ? "profissional" : "individual")}
              aria-pressed={mode === "profissional"}>
              <span className={`sidebar-mode-switch-label${mode === "individual" ? " active" : ""}`}>Pessoal</span>
              <span className="sidebar-mode-switch-track">
                <span className="sidebar-mode-switch-knob" />
              </span>
              <span className={`sidebar-mode-switch-label${mode === "profissional" ? " active" : ""}`}>Profissional</span>
            </button>

            {mode === "individual" ? (
              <>
                <NavLink to="/plans" className={NAV_LINK_CLASS}>
                  <span className="sidebar-link-icon"><IconCalendar size={24} /></span>
                  Planos de Treino
                </NavLink>
                <NavLink to="/nutrition" className={NAV_LINK_CLASS}>
                  <span className="sidebar-link-icon"><IconUtensils size={24} /></span>
                  Planos de Nutrição
                </NavLink>
                <div className="sidebar-divider" />
                <NavLink to="/dashboard" className={NAV_LINK_CLASS}>
                  <span className="sidebar-link-icon"><IconDumbbell size={24} /></span>
                  Os teus treinos
                </NavLink>
                <NavLink to="/log" className={NAV_LINK_CLASS}>
                  <span className="sidebar-link-icon"><IconPlusCircle size={24} /></span>
                  Registar treino
                </NavLink>
                {user.gym_id && (
                  <NavLink to="/classes" className={NAV_LINK_CLASS}>
                    <span className="sidebar-link-icon"><IconUsers size={24} /></span>
                    Aulas de grupo
                  </NavLink>
                )}
              </>
            ) : (
              <>
                {(user.role === "personal_trainer" || user.role === "nutritionist") && (
                  <NavLink to="/clients" className={NAV_LINK_CLASS}>
                    <span className="sidebar-link-icon"><IconClipboard size={24} /></span>
                    Clientes
                  </NavLink>
                )}
                <NavLink to="/classes" className={NAV_LINK_CLASS}>
                  <span className="sidebar-link-icon"><IconCalendar size={24} /></span>
                  Aulas de grupo
                </NavLink>
                <NavLink to="/schedule" className={NAV_LINK_CLASS}>
                  <span className="sidebar-link-icon"><IconClock size={24} /></span>
                  O meu horário
                </NavLink>
                {user.role === "receptionist" && (
                  <>
                    <NavLink to="/occupancy" className={NAV_LINK_CLASS}>
                      <span className="sidebar-link-icon"><IconClipboard size={24} /></span>
                      Ocupação
                    </NavLink>
                    <NavLink to="/staff-attendance" className={NAV_LINK_CLASS}>
                      <span className="sidebar-link-icon"><IconCheck size={24} /></span>
                      Presenças Staff
                    </NavLink>
                  </>
                )}
                <NavLink to="/members" className={NAV_LINK_CLASS}>
                  <span className="sidebar-link-icon"><IconUsers size={24} /></span>
                  Membros
                </NavLink>
                <NavLink to="/team" className={NAV_LINK_CLASS}>
                  <span className="sidebar-link-icon"><IconBuilding size={24} /></span>
                  Equipa
                </NavLink>
              </>
            )}

            <div className="sidebar-divider" />
            <NavLink to="/messages" className={NAV_LINK_CLASS}>
              <span className="sidebar-link-icon"><IconMessage size={24} /></span>
              Mensagens
              {unreadCount > 0 && <span className="sidebar-badge">{unreadCount}</span>}
            </NavLink>
          </>
        ) : (
          <>
            <NavLink to="/plans" className={NAV_LINK_CLASS}>
              <span className="sidebar-link-icon">
                <IconCalendar size={24} />
              </span>
              Planos de Treino
            </NavLink>
            <NavLink to="/nutrition" className={NAV_LINK_CLASS}>
              <span className="sidebar-link-icon">
                <IconUtensils size={24} />
              </span>
              Planos de Nutrição
            </NavLink>

            {user && (
              <>
                <div className="sidebar-divider" />
                <NavLink to="/dashboard" className={NAV_LINK_CLASS}>
                  <span className="sidebar-link-icon">
                    <IconDumbbell size={24} />
                  </span>
                  Os teus treinos
                </NavLink>
                <NavLink to="/log" className={NAV_LINK_CLASS}>
                  <span className="sidebar-link-icon">
                    <IconPlusCircle size={24} />
                  </span>
                  Registar treino
                </NavLink>
                {user.gym_id && (
                  <NavLink to="/classes" className={NAV_LINK_CLASS}>
                    <span className="sidebar-link-icon">
                      <IconUsers size={24} />
                    </span>
                    Aulas de grupo
                  </NavLink>
                )}
                <NavLink to="/messages" className={NAV_LINK_CLASS}>
                  <span className="sidebar-link-icon">
                    <IconMessage size={24} />
                  </span>
                  Mensagens
                  {unreadCount > 0 && <span className="sidebar-badge">{unreadCount}</span>}
                </NavLink>
              </>
            )}
          </>
        )}

        <div className="sidebar-divider" />
        <NavLink to="/download" className={NAV_LINK_CLASS}>
          <span className="sidebar-link-icon">
            <IconDownload size={24} />
          </span>
          Download
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        {user ? (
          <>
            <NavLink to="/profile" className="sidebar-user" aria-label="Ver perfil">
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
