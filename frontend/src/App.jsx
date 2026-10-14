import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import AuthLayout from "./components/AuthLayout";
import RequireAuth from "./components/RequireAuth";
import RequireStaff from "./components/RequireStaff";
import RedirectIfAuthed from "./components/RedirectIfAuthed";
import RequireRole from "./components/RequireRole";
import NotForOwner from "./components/NotForOwner";
import { TEAM_ROLES } from "./utils/roles";
import "./App.css";

const DownloadPage        = lazy(() => import("./pages/DownloadPage"));
const PlansPage           = lazy(() => import("./pages/PlansPage"));
const NutritionPage       = lazy(() => import("./pages/NutritionPage"));
const PurposePage         = lazy(() => import("./pages/PurposePage"));
const LoginPage           = lazy(() => import("./pages/LoginPage"));
const RegisterPage        = lazy(() => import("./pages/RegisterPage"));
const DashboardPage       = lazy(() => import("./pages/DashboardPage"));
const LogWorkoutPage      = lazy(() => import("./pages/LogWorkoutPage"));
const ProfilePage         = lazy(() => import("./pages/ProfilePage"));
const MembersPage         = lazy(() => import("./pages/MembersPage"));
const MemberDetailPage    = lazy(() => import("./pages/MemberDetailPage"));
const MessagesPage        = lazy(() => import("./pages/MessagesPage"));
const GroupClassesPage    = lazy(() => import("./pages/GroupClassesPage"));
const MySchedulePage      = lazy(() => import("./pages/MySchedulePage"));
const TeamSchedulePage    = lazy(() => import("./pages/TeamSchedulePage"));
const ManagementPage      = lazy(() => import("./pages/ManagementPage"));
const ClientsPage         = lazy(() => import("./pages/ClientsPage"));
const TeamPage            = lazy(() => import("./pages/TeamPage"));
const DonoDashboard       = lazy(() => import("./pages/DonoDashboard"));
const FinancePage         = lazy(() => import("./pages/FinancePage"));
const OccupancyPage       = lazy(() => import("./pages/OccupancyPage"));
const StaffAttendancePage = lazy(() => import("./pages/StaffAttendancePage"));

function PageLoader() {
  return (
    <div style={{ padding: "36px 20px", maxWidth: 1240, width: "100%", margin: "0 auto" }}>
      <div style={{ height: 36, width: 200, borderRadius: 10, marginBottom: 28 }}
        className="skeleton" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14, marginBottom: 24 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 120, borderRadius: 16, animationDelay: `${i * 0.08}s` }} />
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 72, borderRadius: 14, animationDelay: `${i * 0.07}s` }} />
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
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
              <RequireRole roles={["gym_owner", "receptionist"]}>
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
    </Suspense>
  );
}
