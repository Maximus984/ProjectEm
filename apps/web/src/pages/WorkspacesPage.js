import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
const workspaceCards = [
    {
        title: "Owner Workspace",
        description: "Pricing, coupons, IP bans, workspace-hours policy, and full admin operations.",
        href: "/login?next=%2Fworkspace",
        cta: "Open Owner Workspace"
    },
    {
        title: "Client Workspace",
        description: "Client-side status visibility, support pathways, and shared project outcomes.",
        href: "/login?next=%2Fclient",
        cta: "Open Client Workspace"
    },
    {
        title: "Parent Workspace",
        description: "Family dashboard for children, bookings, progress, attendance, and messaging.",
        href: "/login?next=%2Fparent",
        cta: "Open Parent Workspace"
    }
];
export function WorkspacesPage() {
    return (_jsxs("section", { className: "space-y-6", children: [_jsxs("header", { className: "space-y-2", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.25em] text-aurora", children: "Workspace Access" }), _jsx("h1", { className: "font-display text-3xl text-white md:text-4xl", children: "Choose Your Workspace" }), _jsx("p", { className: "max-w-2xl text-sm text-mist", children: "Each role has dedicated permissions and a separate workflow surface. Sign in with the account type that matches your role." })] }), _jsx("div", { className: "grid gap-4 lg:grid-cols-3", children: workspaceCards.map((card, index) => (_jsxs(motion.article, { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.35, delay: index * 0.05 }, className: "panel rounded-2xl p-5", children: [_jsx("h2", { className: "font-display text-xl text-white", children: card.title }), _jsx("p", { className: "mt-2 text-sm leading-relaxed text-mist", children: card.description }), _jsx(Link, { to: card.href, className: "mt-4 inline-flex rounded-full border border-aurora/50 px-4 py-2 text-xs font-semibold text-aurora hover:bg-aurora/10", children: card.cta })] }, card.title))) }), _jsxs("article", { className: "panel rounded-2xl p-5", children: [_jsx("h3", { className: "font-display text-lg text-white", children: "Need a new family account first?" }), _jsx("p", { className: "mt-2 text-sm text-mist", children: "Create a family account with your child profiles in one flow, then proceed directly to booking." }), _jsx(Link, { to: "/register?next=%2Fbook", className: "mt-4 inline-flex rounded-full bg-aurora px-4 py-2 text-xs font-semibold text-ink hover:brightness-110", children: "Create Family & Book" })] })] }));
}
