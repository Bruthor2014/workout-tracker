import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import MobileTopBar from "./MobileTopBar";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { BackOverrideProvider } from "../context/BackOverrideContext";

// Layout para todas as páginas depois do login: sidebar + conteúdo.
// Em ecrãs estreitos (ver @media em App.css), a Sidebar passa a gaveta
// (off-canvas) aberta pela MobileTopBar (logótipo + avatar + hambúrguer,
// sempre visível, sticky no topo do conteúdo); o BottomNav continua a dar
// acesso rápido aos atalhos mais usados. Em desktop, `drawerOpen` nunca é
// lido pelo CSS, por isso não afeta nada.
export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Refresca gym_id/role/tema ao abrir a app — o login só os guarda uma
  // vez, por isso uma sessão aberta de antes de uma mudança (ex: o DONO
  // atribuir um ginásio novo, ou o CEO mudar a cor do tema) ficava com
  // dados desatualizados até fazer logout/login outra vez.
  useEffect(() => {
    if (!user) return;
    apiRequest("/auth/me")
      .then(updateUser)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Quem abriu um link de amigo (/invite/:code) sem sessão fica com o
  // código guardado (ver InvitePage.jsx) até entrar/criar conta — assim
  // que há sessão, completa o "seguir" sozinho e manda para a comparação.
  useEffect(() => {
    if (!user) return;
    let code;
    try {
      code = localStorage.getItem("pendingFriendCode");
    } catch {
      return;
    }
    if (!code) return;
    localStorage.removeItem("pendingFriendCode");
    apiRequest("/friends/follow", { method: "POST", body: { code } })
      .then((friend) => navigate(`/friends/${friend.id}`))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!drawerOpen) return;
    function handleKey(e) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [drawerOpen]);

  return (
    <BackOverrideProvider>
      <div className={`app-layout${drawerOpen ? " drawer-open" : ""}`}>
        <div className="sidebar-drawer-overlay" onClick={() => setDrawerOpen(false)} />
        <Sidebar onNavigate={() => setDrawerOpen(false)} />
        <div className="app-main">
          <MobileTopBar onOpenDrawer={() => setDrawerOpen(true)} />
          <Outlet />
        </div>
        <BottomNav />
      </div>
    </BackOverrideProvider>
  );
}
