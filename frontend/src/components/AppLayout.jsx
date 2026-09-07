import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

// Layout para todas as páginas depois do login: sidebar + conteúdo.
export default function AppLayout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-main">
        <Outlet />
      </div>
    </div>
  );
}
