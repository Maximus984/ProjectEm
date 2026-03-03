import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { isAdminRole, isFamilyRole, supportContacts } from "@projectm/contracts";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/auth-store";
const benefits = [
    "Mentor-first learning: One-on-one mentorship focused on tech, logic, and leadership, not babysitting.",
    "Project-based progression: Structured modules plus portfolio building show measurable growth.",
    "Secure family accounts: Multi-parent support, passkeys, and strict privacy safeguards.",
    "Flexible modes: Studio hardware sessions, BYOD mentorship, or virtual Zoom learning.",
    "Transparent tracking: Attendance, grades, and progress charts stay visible to parents.",
    "Trust and safety: Verified mentors, background checks, waivers, and secure messaging."
];
const workModes = [
    {
        key: "studio",
        title: "Premium Genius",
        summary: "Hardware-ready, in-person studio mentorship with guided outcomes.",
        points: ["$45/hr", "Hardware reservation", "Best for deep build sessions"]
    },
    {
        key: "byod",
        title: "BYOD Mentorship",
        summary: "Bring-your-own-device path for project continuity and focused coaching.",
        points: ["$40/hr", "No hardware checkout", "Flexible and efficient"]
    },
    {
        key: "virtual",
        title: "Virtual Learning",
        summary: "Remote sessions with optional intro Zoom and progress tracking.",
        points: ["$32/hr", "Parent-friendly scheduling", "Anywhere access"]
    }
];
const onboardingSteps = [
    {
        title: "Create Family Account",
        detail: "Parent signs up first and creates family identity with secure credentials."
    },
    {
        title: "Add Children",
        detail: "Create child profiles during onboarding so booking data is tied to real family records."
    },
    {
        title: "Book Session",
        detail: "Choose mentorship tier, date/time, and submit a tracked booking request."
    },
    {
        title: "Track Progress",
        detail: "Use parent workspace for attendance, outcomes, and communication."
    }
];
const surfaceCards = [
    {
        label: "Parent Surface",
        description: "Children, bookings, attendance, and progress view in one place."
    },
    {
        label: "Owner Surface",
        description: "Coupons, role controls, workspace-hours policy, and IP ban management."
    },
    {
        label: "Client Surface",
        description: "Shared project visibility and support channels for partner stakeholders."
    }
];
const trustSignals = [
    "Paige founded by a mentor from The Hidden Genius Project.",
    "Verified mentor badges and background-check workflow.",
    "Insurance-backed operations and secure parent communication."
];
const featureHighlights = [
    "Quick booking widget with instant availability.",
    "One-click attendance and gradebook (PowerSchool-style).",
    "Child portfolio and mini-site builder.",
    "Mentor live tracking (DoorDash-inspired timeline).",
    "Secure messaging and in-app support tickets."
];
const faqs = [
    {
        question: "Why does booking require signup first?",
        answer: "Booking now requires a parent family account so each request is linked to verified family and child records."
    },
    {
        question: "Where do I open my workspace?",
        answer: "Use /workspaces or the top navigation. Then pick Owner, Client, or Parent workspace access."
    },
    {
        question: "Can I add more than one child?",
        answer: "Yes. Family onboarding supports up to 5 children and optional co-parent creation."
    }
];
export function HomePage() {
    const role = useAuthStore((state) => state.role);
    const [selectedMode, setSelectedMode] = useState("studio");
    const [activeStep, setActiveStep] = useState(0);
    const [openFaq, setOpenFaq] = useState(0);
    const selectedModeCard = useMemo(() => workModes.find((mode) => mode.key === selectedMode) ?? workModes[0], [selectedMode]);
    const createFamilyHref = "/register?next=%2Fbook";
    const primaryActionHref = role && isFamilyRole(role) ? "/book" : createFamilyHref;
    const primaryActionLabel = "Book a Free Intro Session";
    const workspaceHref = role
        ? isAdminRole(role)
            ? "/workspace"
            : role === "CLIENT"
                ? "/client"
                : isFamilyRole(role)
                    ? "/parent"
                    : "/dashboard"
        : "/workspaces";
    return (_jsxs("div", { className: "space-y-12", children: [_jsxs("section", { className: "relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-cosmic/80 to-ink p-8 shadow-glow md:p-12", children: [_jsx("div", { className: "absolute -right-20 -top-24 h-72 w-72 rounded-full bg-aurora/20 blur-3xl" }), _jsx("div", { className: "absolute -bottom-28 left-24 h-72 w-72 rounded-full bg-flare/15 blur-3xl" }), _jsx(motion.div, { className: "pointer-events-none absolute -top-24 right-10 h-64 w-64 rounded-full border border-aurora/25", animate: { rotate: 360 }, transition: { duration: 20, repeat: Infinity, ease: "linear" } }), _jsx(motion.div, { className: "pointer-events-none absolute -bottom-28 left-12 h-72 w-72 rounded-full border border-flare/20", animate: { rotate: -360 }, transition: { duration: 28, repeat: Infinity, ease: "linear" } }), _jsxs(motion.div, { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45 }, children: [_jsx("img", { src: "/branding/maxx-forge-logo.png", alt: "MAXX Forge Studio", className: "w-40 drop-shadow-[0_0_26px_rgba(106,245,255,0.35)] md:w-52" }), _jsx("p", { className: "mt-3 text-xs uppercase tracking-[0.28em] text-aurora", children: "Project Paige \u2022 Elite Mentorship Childcare \u2022 ProjectM Framework" }), _jsx("h1", { className: "mt-4 max-w-3xl font-display text-4xl leading-tight text-white md:text-6xl", children: "Forge Geniuses - Elite Mentorship-Based Childcare" }), _jsx("p", { className: "mt-5 max-w-2xl text-base leading-relaxed text-mist md:text-lg", children: "Hands-on technology, business logic, and legal mentorship woven into childcare. Project-based learning, measurable progress, and trusted in-person and virtual sessions." }), _jsxs("div", { className: "mt-8 flex flex-wrap gap-3", children: [_jsx(Link, { to: primaryActionHref, className: "rounded-full bg-aurora px-5 py-2.5 text-sm font-semibold text-ink transition hover:scale-[1.02] hover:brightness-110", children: primaryActionLabel }), _jsx(Link, { to: "/tiers", className: "rounded-full border border-aurora/50 px-5 py-2.5 text-sm font-semibold text-aurora transition hover:bg-aurora/10", children: "View ProjectM Tiers" }), _jsx(Link, { to: createFamilyHref, className: "rounded-full border border-flare/40 px-5 py-2.5 text-sm text-flare transition hover:bg-flare/10", children: "Create Family Account" }), _jsx(Link, { to: workspaceHref, className: "rounded-full border border-white/25 px-5 py-2.5 text-sm text-white transition hover:bg-white/10", children: "Open Workspace" })] })] })] }), _jsx("section", { className: "grid gap-4 md:grid-cols-2 lg:grid-cols-3", children: benefits.map((item, index) => (_jsx(motion.article, { initial: { opacity: 0, y: 18 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-30px" }, transition: { delay: index * 0.03, duration: 0.3 }, whileHover: { y: -4, scale: 1.01 }, className: "panel rounded-2xl p-5", children: _jsx("p", { className: "text-sm leading-relaxed text-mist", children: item }) }, item))) }), _jsxs("section", { className: "grid gap-6 lg:grid-cols-2", children: [_jsxs("article", { className: "panel rounded-2xl p-6", children: [_jsx("h2", { className: "font-display text-2xl text-white", children: "Trust and Social Proof" }), _jsx("div", { className: "mt-4 space-y-2", children: trustSignals.map((signal) => (_jsx("div", { className: "rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-mist", children: signal }, signal))) }), _jsxs("p", { className: "mt-4 text-xs text-mist", children: ["Contact and support: ", supportContacts.phone, " \u2022 @", supportContacts.instagramHandle, " \u2022", " ", _jsx("a", { href: supportContacts.discordUrl, children: "Discord (external)" })] })] }), _jsxs("article", { className: "panel rounded-2xl p-6", children: [_jsx("h2", { className: "font-display text-2xl text-white", children: "Feature Highlights" }), _jsx("div", { className: "mt-4 space-y-2", children: featureHighlights.map((feature, index) => (_jsx(motion.div, { initial: { opacity: 0, x: 12 }, whileInView: { opacity: 1, x: 0 }, viewport: { once: true }, transition: { delay: index * 0.04, duration: 0.25 }, className: "rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-mist", children: feature }, feature))) })] })] }), _jsxs("section", { className: "grid gap-6 lg:grid-cols-3", children: [_jsxs("article", { className: "panel rounded-2xl p-6 lg:col-span-2", children: [_jsx("h2", { className: "font-display text-2xl text-white", children: "Interactive Tier Preview" }), _jsx("p", { className: "mt-2 text-sm text-mist", children: "Switch tracks to preview your mentorship mode and pacing." }), _jsx("div", { className: "mt-4 flex flex-wrap gap-2", children: workModes.map((mode) => (_jsx("button", { type: "button", className: `rounded-full px-4 py-2 text-xs transition ${mode.key === selectedMode ? "bg-aurora text-ink" : "border border-white/20 text-mist hover:bg-white/10"}`, onClick: () => setSelectedMode(mode.key), children: mode.title }, mode.key))) }), _jsxs(motion.div, { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.25 }, className: "mt-4 rounded-2xl border border-white/10 bg-white/5 p-4", children: [_jsx("p", { className: "font-display text-lg text-white", children: selectedModeCard.title }), _jsx("p", { className: "mt-2 text-sm text-mist", children: selectedModeCard.summary }), _jsx("ul", { className: "mt-3 space-y-1 text-xs text-mist", children: selectedModeCard.points.map((point) => (_jsxs("li", { children: ["\u2022 ", point] }, point))) }), _jsx(Link, { to: primaryActionHref, className: "mt-4 inline-flex rounded-full bg-aurora px-4 py-2 text-xs font-semibold text-ink", children: "Continue" })] }, selectedModeCard.key)] }), _jsxs("article", { className: "panel rounded-2xl p-6", children: [_jsx("h3", { className: "font-display text-xl text-white", children: "Workspace Surfaces" }), _jsx("div", { className: "mt-3 space-y-2", children: surfaceCards.map((card, index) => (_jsxs(motion.div, { initial: { opacity: 0, x: 14 }, whileInView: { opacity: 1, x: 0 }, viewport: { once: true }, transition: { delay: index * 0.05, duration: 0.25 }, className: "rounded-xl border border-white/10 bg-white/5 px-3 py-2", children: [_jsx("p", { className: "text-xs font-semibold text-white", children: card.label }), _jsx("p", { className: "mt-1 text-xs text-mist", children: card.description })] }, card.label))) }), _jsx(Link, { to: "/workspaces", className: "mt-4 inline-flex rounded-full border border-aurora/45 px-4 py-2 text-xs font-semibold text-aurora", children: "View Workspace Guide" })] })] }), _jsxs("section", { className: "grid gap-6 lg:grid-cols-2", children: [_jsxs("article", { className: "panel rounded-2xl p-6", children: [_jsx("h2", { className: "font-display text-2xl text-white", children: "Family Onboarding Timeline" }), _jsx("p", { className: "mt-2 text-sm text-mist", children: "Click each phase to preview what happens." }), _jsx("div", { className: "mt-4 grid gap-2 sm:grid-cols-2", children: onboardingSteps.map((step, index) => (_jsxs("button", { type: "button", className: `rounded-xl border px-3 py-3 text-left text-xs transition ${activeStep === index
                                        ? "border-aurora/60 bg-aurora/10 text-white"
                                        : "border-white/10 bg-white/5 text-mist hover:bg-white/10"}`, onClick: () => setActiveStep(index), children: [_jsx("p", { className: "font-semibold", children: step.title }), _jsx("p", { className: "mt-1 text-[11px] leading-relaxed", children: step.detail })] }, step.title))) })] }), _jsxs("article", { className: "panel rounded-2xl p-6", children: [_jsx("h2", { className: "font-display text-2xl text-white", children: "Questions" }), _jsx("div", { className: "mt-4 space-y-2", children: faqs.map((item, index) => (_jsxs("div", { className: "rounded-xl border border-white/10 bg-white/5", children: [_jsxs("button", { type: "button", className: "flex w-full items-center justify-between px-4 py-3 text-left text-sm text-white", onClick: () => setOpenFaq((current) => (current === index ? -1 : index)), children: [item.question, _jsx("span", { className: "text-aurora", children: openFaq === index ? "−" : "+" })] }), openFaq === index ? _jsx("p", { className: "px-4 pb-4 text-xs text-mist", children: item.answer }) : null] }, item.question))) })] })] })] }));
}
