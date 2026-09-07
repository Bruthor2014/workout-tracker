import { Outlet } from "react-router-dom";
import { IconDumbbell } from "./Icons";

// Layout para "/", "/login" e "/register" — sem sidebar, só a marca em
// cima e a página (login/registo) por baixo.
export default function AuthLayout() {
  return (
    <div className="auth-layout">
      <div className="auth-layout-brand">
        <IconDumbbell size={26} />
        <span>Workout Tracker</span>
      </div>
      <Outlet />
    </div>
  );
}
