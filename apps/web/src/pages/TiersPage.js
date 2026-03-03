import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { projectTiers } from "@projectm/contracts";
const tierNotes = {
    PREMIUM_GENIUS: "Studio hardware reserved for your child. Advanced projects and premium 1:1 mentorship.",
    BYOD_MENTORSHIP: "Bring-your-own-device sessions with focused technical and business logic coaching.",
    STANDARD_CARE: "Structured childcare with mentorship touchpoints and foundational learning support."
};
export function TiersPage() {
    return (_jsxs("section", { className: "space-y-6", children: [_jsxs("header", { children: [_jsx("h1", { className: "font-display text-3xl text-white md:text-4xl", children: "ProjectM Tiers" }), _jsx("p", { className: "mt-2 text-mist", children: "Flexible mentorship modes for every family rhythm." })] }), _jsx("div", { className: "grid gap-4 md:grid-cols-3", children: Object.entries(projectTiers).map(([key, tier]) => (_jsxs("article", { className: "panel rounded-2xl p-5 shadow-glow", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.22em] text-aurora", children: key.replaceAll("_", " ") }), _jsx("h2", { className: "mt-2 font-display text-xl text-white", children: tier.label }), _jsxs("p", { className: "mt-1 text-2xl font-semibold text-flare", children: ["$", tier.pricePerHour, "/hr"] }), _jsx("p", { className: "mt-3 text-sm leading-relaxed text-mist", children: tierNotes[key] })] }, key))) })] }));
}
