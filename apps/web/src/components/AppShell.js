import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { isAdminRole, isFamilyRole, supportContacts } from "@projectm/contracts";
import { Link, NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuthStore } from "../store/auth-store";
const links = [
    ["/", "Home"],
    ["/workspaces", "Workspaces"],
    ["/diagnostic", "Diagnostic"],
    ["/classroom", "Classroom"],
    ["/book", "Book"],
    ["/tiers", "Tiers"],
    ["/support", "Support"],
    ["/community", "Community"]
];
export function AppShell({ children }) {
    const role = useAuthStore((state) => state.role);
    const clearSession = useAuthStore((state) => state.clear);
    const portalHref = role
        ? isAdminRole(role)
            ? "/workspace"
            : role === "CLIENT"
                ? "/client"
                : isFamilyRole(role)
                    ? "/parent"
                    : "/dashboard"
        : null;
    return (_jsxs("div", { className: "relative min-h-screen overflow-hidden", children: [_jsx("video", { className: "bg-video", autoPlay: true, muted: true, loop: true, playsInline: true, preload: "auto", "aria-hidden": "true", children: _jsx("source", { src: "/media/galaxy-loop.mp4", type: "video/mp4" }) }), _jsx("div", { className: "bg-video-overlay" }), _jsx("div", { className: "grid-stars" }), _jsx("div", { className: "twinkle-layer" }), _jsx("header", { className: "sticky top-0 z-30 border-b border-white/10 bg-ink/75 backdrop-blur-xl", children: _jsxs("nav", { className: "mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6", children: [_jsxs(Link, { to: "/", className: "flex items-center gap-2 text-sm font-semibold tracking-wide text-white md:gap-3", children: [_jsx("img", { src: "/branding/maxx-forge-logo.png", alt: "Project Paige by MAXX Forge Studio logo", className: "h-11 w-11 rounded-xl border border-white/20 bg-black/30 object-contain p-1 shadow-glow md:h-12 md:w-12" }), _jsxs("span", { className: "flex flex-col leading-tight", children: [_jsx("span", { className: "font-display text-sm text-white md:text-base", children: "Project Paige" }), _jsx("span", { className: "text-[10px] uppercase tracking-[0.18em] text-aurora/90", children: "Elite Mentorship Childcare \u2022 ProjectM Framework" })] })] }), _jsxs("div", { className: "flex items-center gap-2 md:gap-3", children: [links.map(([to, label]) => (_jsx(NavLink, { to: to, className: ({ isActive }) => `rounded-full px-3 py-1.5 text-xs md:text-sm ${isActive ? "bg-nova text-white" : "text-mist hover:bg-white/10"}`, children: label }, to))), portalHref ? (_jsx(Link, { className: "rounded-full border border-white/20 px-3 py-1.5 text-xs text-white", to: portalHref, children: "Workspace" })) : null, role ? (_jsx("button", { className: "rounded-full border border-aurora/60 px-3 py-1.5 text-xs text-aurora", onClick: clearSession, type: "button", children: "Logout" })) : (_jsx(Link, { className: "rounded-full border border-aurora/60 px-3 py-1.5 text-xs text-aurora", to: "/login", children: "Login" }))] })] }) }), _jsx(motion.main, { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, ease: "easeOut" }, className: "mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-10", children: children }), _jsxs("footer", { className: "mx-auto mt-10 w-full max-w-6xl border-t border-white/10 px-4 py-6 text-xs text-mist md:px-6", children: [_jsxs("p", { children: ["External community channels - ", _jsx("a", { href: supportContacts.discordUrl, children: "Discord" }), " and", " ", _jsx("a", { href: supportContacts.instagramUrl, children: "Instagram" }), ". Use in-app support for account-specific help."] }), _jsxs("p", { className: "mt-2", children: ["Project Paige by MAXX FORGE STUDIO | Support: ", supportContacts.phone, " | @", supportContacts.instagramHandle] })] })] }));
}
