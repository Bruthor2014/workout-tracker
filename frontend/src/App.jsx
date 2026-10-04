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
import GroupClassesPage from "./pages/GroupClassesPage";
import MySchedulePage from "./pages/MySchedulePage";
import TeamSchedulePage from "./pages/TeamSchedulePage";
import ManagementPage from "./pages/ManagementPage";
import ClientsPage from "./pages/ClientsPage";
import TeamPage from "./pages/TeamPage";
import DonoDashboard from "./pages/DonoDashboard";
import FinancePage from "./pages/FinancePage";
import OccupancyPage from "./pages/OccupancyPage";
import StaffAttendancePage from "./pages/StaffAttendancePage";
import RequireRole from "./components/RequireRole";
import NotForOwner from "./components/NotForOwner";
import { TEAM_ROLES } from "./utils/roles";
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
        <Route
          path="/plans"
          element={
            <NotForOwner>
              <PlansPage />
            </NotForOwner>
          }
        />
        <Route
          path="/nutrition"
          element={
            <NotForOwner>
              <NutritionPage />
            </NotForOwner>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <NotForOwner>
                <DashboardPage />
              </NotForOwner>
            </RequireAuth>
          }
        />
        <Route
          path="/log"
          element={
            <RequireAuth>
              <NotForOwner>
                <LogWorkoutPage />
              </NotForOwner>
            </RequireAuth>
          }
        />
        <Route
          path="/log/:id"
          element={
            <RequireAuth>
              <NotForOwner>
                <LogWorkoutPage />
              </NotForOwner>
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
        <Route
          path="/classes"
          element={
            <RequireAuth>
              <GroupClassesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/schedule"
          element={
            <RequireRole roles={TEAM_ROLES}>
              <MySchedulePage />
            </RequireRole>
          }
        />
        <Route
          path="/clients"
          element={
            <RequireRole roles={["personal_trainer", "nutritionist"]}>
              <ClientsPage />
            </RequireRole>
          }
        />
        <Route
          path="/team"
          element={
            <RequireRole roles={TEAM_ROLES}>
              <TeamPage />
            </RequireRole>
          }
        />
        <Route
          path="/team-schedule"
          element={
            <RequireRole roles={["gym_owner"]}>
              <TeamSchedulePage />
            </RequireRole>
          }
        />
        <Route
          path="/management"
          element={
            <RequireRole roles={["gym_owner"]}>
              <ManagementPage />
            </RequireRole>
          }
        />
        <Route
          path="/dono"
          element={
            <RequireRole roles={["dono"]}>
              <DonoDashboard />
            </RequireRole>
          }
        />
        <Route
          path="/finance"
          element={
            <RequireRole roles={["gym_owner"]}>
              <FinancePage />
            </RequireRole>
          }
        />
        <Route
          path="/occupancy"
          element={
            <RequireRole roles={["gym_owner", "receptionist"]}>
              <OccupancyPage />
            </RequireRole>
          }
        />
        <Route
          path="/staff-attendance"
          element={
            <RequireRole roles={["gym_owner", "receptionist"]}>
              <StaffAttendancePage />
            </RequireRole>
          }
        />
      </Route>
    </Routes>
  );
}
