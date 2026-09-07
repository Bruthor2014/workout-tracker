import { Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import AuthLayout from "./components/AuthLayout";
import RequireAuth from "./components/RequireAuth";
import RequireStaff from "./components/RequireStaff";
import RedirectIfAuthed from "./components/RedirectIfAuthed";
import DownloadPage from "./pages/DownloadPage";
import PlansPage from "./pages/PlansPage";
import NutritionPage from "./pages/NutritionPage";
import PurposePage from "./pages/PurposePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import LogWorkoutPage from "./pages/LogWorkoutPage";
import ProfilePage from "./pages/ProfilePage";
import MembersPage from "./pages/MembersPage";
import MemberDetailPage from "./pages/MemberDetailPage";
import MessagesPage from "./pages/MessagesPage";
import "./App.css";

export default function App() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route
          path="/"
          element={
            <RedirectIfAuthed>
              <PurposePage />
            </RedirectIfAuthed>
          }
        />
        <Route
          path="/login"
          element={
            <RedirectIfAuthed>
              <LoginPage />
            </RedirectIfAuthed>
          }
        />
        <Route
          path="/register"
          element={
            <RedirectIfAuthed to="/profile?welcome=1">
              <RegisterPage />
            </RedirectIfAuthed>
          }
        />
      </Route>

      <Route element={<AppLayout />}>
        <Route path="/download" element={<DownloadPage />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/nutrition" element={<NutritionPage />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/log"
          element={
            <RequireAuth>
              <LogWorkoutPage />
            </RequireAuth>
          }
        />
        <Route
          path="/log/:id"
          element={
            <RequireAuth>
              <LogWorkoutPage />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
        <Route
          path="/messages"
          element={
            <RequireAuth>
              <MessagesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/members"
          element={
            <RequireStaff>
              <MembersPage />
            </RequireStaff>
          }
        />
        <Route
          path="/members/:id"
          element={
            <RequireStaff>
              <MemberDetailPage />
            </RequireStaff>
          }
        />
      </Route>
    </Routes>
  );
}
