import { Outlet } from "react-router-dom";
import { IconLogoMark } from "./Icons";

// Layout para "/", "/login" e "/register" — sem sidebar, só a marca em
// cima e a página (login/registo) por baixo.
export default function AuthLayout() {
  return (
    <div className="auth-layout">
      <div className="auth-layout-brand">
        <IconLogoMark size={26} />
        <span>Workout Tracker</span>
      </div>
      <Outlet />
    </div>
  );
}
