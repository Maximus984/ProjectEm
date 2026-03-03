import { isAdminRole, isFamilyRole } from "@projectm/contracts";
import { AnimatePresence, motion } from "framer-motion";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { AdminPage } from "../pages/AdminPage";
import { BookPage } from "../pages/BookPage";
import { ClassroomPage } from "../pages/ClassroomPage";
import { ClientWorkspacePage } from "../pages/ClientWorkspacePage";
import { CommunityPage } from "../pages/CommunityPage";
import { DashboardPage } from "../pages/DashboardPage";
import { DiagnosticPage } from "../pages/DiagnosticPage";
import { HomePage } from "../pages/HomePage";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { PrivacyPage } from "../pages/PrivacyPage";
import { RegisterPage } from "../pages/RegisterPage";
import { SupportPage } from "../pages/SupportPage";
import { TiersPage } from "../pages/TiersPage";
import { WorkspacesPage } from "../pages/WorkspacesPage";
import { useAuthStore } from "../store/auth-store";

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = useAuthStore((state) => state.accessToken);
  return token ? children : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }: { children: JSX.Element }) {
  const role = useAuthStore((state) => state.role);
  return role && isAdminRole(role) ? children : <Navigate to="/dashboard" replace />;
}

function RequireClient({ children }: { children: JSX.Element }) {
  const role = useAuthStore((state) => state.role);
  return role === "CLIENT" ? children : <Navigate to="/dashboard" replace />;
}

function RequireParent({ children }: { children: JSX.Element }) {
  const role = useAuthStore((state) => state.role);
  return role && isFamilyRole(role) ? children : <Navigate to="/dashboard" replace />;
}

function RequireBooking({ children }: { children: JSX.Element }) {
  const token = useAuthStore((state) => state.accessToken);
  const role = useAuthStore((state) => state.role);

  if (!token) {
    return <Navigate to="/register?next=%2Fbook" replace />;
  }

  if (role && isFamilyRole(role)) {
    return children;
  }

  return <Navigate to="/workspaces" replace />;
}

function RequireClassroom({ children }: { children: JSX.Element }) {
  const token = useAuthStore((state) => state.accessToken);
  const role = useAuthStore((state) => state.role);

  if (!token) {
    return <Navigate to="/login?next=%2Fclassroom" replace />;
  }

  if (!role) {
    return <Navigate to="/dashboard" replace />;
  }

  if (role === "CLIENT") {
    return <Navigate to="/client" replace />;
  }

  return children;
}

export function AppRouter() {
  const location = useLocation();

  return (
    <AppShell>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${location.pathname}${location.search}`}
          initial={{ opacity: 0, y: 18, scale: 0.995 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.995 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <Routes location={location}>
            <Route path="/" element={<HomePage />} />
            <Route
              path="/book"
              element={
                <RequireBooking>
                  <BookPage />
                </RequireBooking>
              }
            />
            <Route path="/tiers" element={<TiersPage />} />
            <Route
              path="/diagnostic"
              element={
                <RequireAuth>
                  <DiagnosticPage />
                </RequireAuth>
              }
            />
            <Route
              path="/classroom"
              element={
                <RequireClassroom>
                  <ClassroomPage />
                </RequireClassroom>
              }
            />
            <Route path="/workspaces" element={<WorkspacesPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/community" element={<CommunityPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/dashboard/*"
              element={
                <RequireAuth>
                  <DashboardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/workspace/*"
              element={
                <RequireAuth>
                  <RequireAdmin>
                    <AdminPage />
                  </RequireAdmin>
                </RequireAuth>
              }
            />
            <Route path="/admin/*" element={<Navigate to="/workspace" replace />} />
            <Route
              path="/client/*"
              element={
                <RequireAuth>
                  <RequireClient>
                    <ClientWorkspacePage />
                  </RequireClient>
                </RequireAuth>
              }
            />
            <Route
              path="/parent/*"
              element={
                <RequireAuth>
                  <RequireParent>
                    <DashboardPage />
                  </RequireParent>
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}
