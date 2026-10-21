import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { TEAM_ROLES } from "../utils/roles";

// Rotas "pessoais" (treino do próprio) — aterrar nelas força o modo a
// "individual", mesmo que a preferência guardada fosse "profissional",
// para a sidebar/bottom-nav nunca mostrarem uma lista de atalhos que não
// inclui a página onde o utilizador está.
const PERSONAL_ROUTES = ["/dashboard", "/plans", "/nutrition", "/log"];

function routeMode(pathname) {
  if (PERSONAL_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return "individual";
  return null;
}

const EVENT = "sidebarmode:change";

// Estado do toggle Pessoal/Profissional, partilhado entre a Sidebar, o
// BottomNav e qualquer outro sítio que precise dele (ex.: cabeçalho mobile
// da página de Perfil) — uma só fonte de verdade (localStorage + um evento
// customizado para sincronizar instâncias já montadas), em vez de cada
// componente guardar a sua própria cópia de estado.
export function useSidebarMode(user) {
  const location = useLocation();
  const isOwner = user?.role === "gym_owner";
  const isDono = user?.role === "dono";
  const isStaffPerson = !!user && TEAM_ROLES.includes(user.role);
  const hasModeToggle = isStaffPerson || isDono || isOwner;

  const [mode, setModeState] = useState("profissional");

  useEffect(() => {
    if (!user || !hasModeToggle) return;
    function readSaved() {
      try {
        const saved = localStorage.getItem(`sidebarMode:${user.id}`);
        if (saved === "individual" || saved === "profissional") setModeState(saved);
      } catch {}
    }
    readSaved();
    window.addEventListener(EVENT, readSaved);
    return () => window.removeEventListener(EVENT, readSaved);
  }, [user?.id, hasModeToggle]);

  // Aterrar numa rota pessoal força o modo a seguir, para a navegação
  // nunca ficar dessincronizada da página atual.
  useEffect(() => {
    if (!user || !hasModeToggle) return;
    const forced = routeMode(location.pathname);
    if (forced && forced !== mode) {
      setModeState(forced);
      try {
        localStorage.setItem(`sidebarMode:${user.id}`, forced);
        window.dispatchEvent(new Event(EVENT));
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, user?.id, hasModeToggle]);

  const setMode = useCallback(
    (next) => {
      setModeState(next);
      try {
        if (user) {
          localStorage.setItem(`sidebarMode:${user.id}`, next);
          window.dispatchEvent(new Event(EVENT));
        }
      } catch {}
    },
    [user]
  );

  return { mode, setMode, hasModeToggle, isOwner, isDono, isStaffPerson };
}
