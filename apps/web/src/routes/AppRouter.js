import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { isAdminRole, isFamilyRole } from "@projectm/contracts";
import { Navigate, Route, Routes } from "react-router-dom";
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
function RequireAuth({ children }) {
    const token = useAuthStore((state) => state.accessToken);
    return token ? children : _jsx(Navigate, { to: "/login", replace: true });
}
function RequireAdmin({ children }) {
    const role = useAuthStore((state) => state.role);
    return role && isAdminRole(role) ? children : _jsx(Navigate, { to: "/dashboard", replace: true });
}
function RequireClient({ children }) {
    const role = useAuthStore((state) => state.role);
    return role === "CLIENT" ? children : _jsx(Navigate, { to: "/dashboard", replace: true });
}
function RequireParent({ children }) {
    const role = useAuthStore((state) => state.role);
    return role && isFamilyRole(role) ? children : _jsx(Navigate, { to: "/dashboard", replace: true });
}
function RequireBooking({ children }) {
    const token = useAuthStore((state) => state.accessToken);
    const role = useAuthStore((state) => state.role);
    if (!token) {
        return _jsx(Navigate, { to: "/register?next=%2Fbook", replace: true });
    }
    if (role && isFamilyRole(role)) {
        return children;
    }
    return _jsx(Navigate, { to: "/workspaces", replace: true });
}
function RequireClassroom({ children }) {
    const token = useAuthStore((state) => state.accessToken);
    const role = useAuthStore((state) => state.role);
    if (!token) {
        return _jsx(Navigate, { to: "/login?next=%2Fclassroom", replace: true });
    }
    if (!role) {
        return _jsx(Navigate, { to: "/dashboard", replace: true });
    }
    if (role === "CLIENT") {
        return _jsx(Navigate, { to: "/client", replace: true });
    }
    return children;
}
export function AppRouter() {
    return (_jsx(AppShell, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(HomePage, {}) }), _jsx(Route, { path: "/book", element: _jsx(RequireBooking, { children: _jsx(BookPage, {}) }) }), _jsx(Route, { path: "/tiers", element: _jsx(TiersPage, {}) }), _jsx(Route, { path: "/diagnostic", element: _jsx(RequireAuth, { children: _jsx(DiagnosticPage, {}) }) }), _jsx(Route, { path: "/classroom", element: _jsx(RequireClassroom, { children: _jsx(ClassroomPage, {}) }) }), _jsx(Route, { path: "/workspaces", element: _jsx(WorkspacesPage, {}) }), _jsx(Route, { path: "/support", element: _jsx(SupportPage, {}) }), _jsx(Route, { path: "/privacy", element: _jsx(PrivacyPage, {}) }), _jsx(Route, { path: "/community", element: _jsx(CommunityPage, {}) }), _jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsx(Route, { path: "/register", element: _jsx(RegisterPage, {}) }), _jsx(Route, { path: "/dashboard/*", element: _jsx(RequireAuth, { children: _jsx(DashboardPage, {}) }) }), _jsx(Route, { path: "/workspace/*", element: _jsx(RequireAuth, { children: _jsx(RequireAdmin, { children: _jsx(AdminPage, {}) }) }) }), _jsx(Route, { path: "/admin/*", element: _jsx(Navigate, { to: "/workspace", replace: true }) }), _jsx(Route, { path: "/client/*", element: _jsx(RequireAuth, { children: _jsx(RequireClient, { children: _jsx(ClientWorkspacePage, {}) }) }) }), _jsx(Route, { path: "/parent/*", element: _jsx(RequireAuth, { children: _jsx(RequireParent, { children: _jsx(DashboardPage, {}) }) }) }), _jsx(Route, { path: "*", element: _jsx(NotFoundPage, {}) })] }) }));
}
