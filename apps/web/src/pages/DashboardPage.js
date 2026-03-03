import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
const steps = [
    "Dashboard overview",
    "Booking flow",
    "Child page builder",
    "Messaging",
    "Attendance and gradebook"
];
export function DashboardPage() {
    const [tourOpen, setTourOpen] = useState(false);
    const [index, setIndex] = useState(0);
    useEffect(() => {
        const completed = window.localStorage.getItem("projectm_has_completed_tour");
        if (!completed) {
            setTourOpen(true);
        }
    }, []);
    const finishTour = () => {
        window.localStorage.setItem("projectm_has_completed_tour", "true");
        setTourOpen(false);
    };
    return (_jsxs("section", { className: "space-y-6", children: [_jsxs("header", { className: "space-y-2", children: [_jsx("h1", { className: "font-display text-3xl text-white md:text-4xl", children: "Family Dashboard" }), _jsx("p", { className: "text-sm text-mist", children: "Track bookings, progress, attendance, and live mentor activity." })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("article", { className: "panel rounded-2xl p-5", children: [_jsx("h2", { className: "font-display text-xl text-white", children: "Quick Actions" }), _jsxs("div", { className: "mt-4 flex flex-wrap gap-2 text-xs", children: [_jsx(Link, { to: "/book", className: "rounded-full border border-white/20 px-3 py-2", children: "New Booking" }), _jsx(Link, { to: "/classroom", className: "rounded-full border border-aurora/30 px-3 py-2 text-aurora", children: "Classroom" }), _jsx(Link, { to: "/diagnostic", className: "rounded-full border border-aurora/30 px-3 py-2 text-aurora", children: "Diagnostic" }), _jsx(Link, { to: "/book?action=reschedule", className: "rounded-full border border-white/20 px-3 py-2", children: "Reschedule" }), _jsx(Link, { to: "/book?action=cancel", className: "rounded-full border border-white/20 px-3 py-2", children: "Cancel Session" }), _jsx(Link, { to: "/book?action=duplicate", className: "rounded-full border border-white/20 px-3 py-2", children: "Duplicate Booking" })] })] }), _jsxs("article", { className: "panel rounded-2xl p-5", children: [_jsx("h2", { className: "font-display text-xl text-white", children: "Mentor Live Card" }), _jsx("p", { className: "mt-3 text-sm text-mist", children: "ETA, status timeline, and mentor profile card are connected to live status endpoints." }), _jsx("div", { className: "mt-3 rounded-xl border border-aurora/30 bg-aurora/10 p-3 text-xs", children: "Status: EN_ROUTE | ETA: 14 minutes | Session: 10:00-11:00" })] })] }), tourOpen ? (_jsx(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, className: "fixed inset-0 z-40 grid place-items-center bg-ink/80 px-4", children: _jsxs("div", { className: "panel w-full max-w-md rounded-2xl p-5 shadow-glow", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.24em] text-aurora", children: "In-app Tour" }), _jsx("h3", { className: "mt-2 font-display text-xl text-white", children: steps[index] }), _jsx("p", { className: "mt-3 text-sm text-mist", children: "This first-time guide highlights your key workflow areas. You can skip and reopen it later." }), _jsxs("div", { className: "mt-4 flex items-center justify-between", children: [_jsx("button", { className: "text-xs text-mist", onClick: finishTour, children: "Skip" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { className: "rounded-full border border-white/20 px-3 py-1.5 text-xs", onClick: () => setIndex((value) => Math.max(0, value - 1)), disabled: index === 0, children: "Back" }), index === steps.length - 1 ? (_jsx("button", { className: "rounded-full bg-aurora px-3 py-1.5 text-xs font-semibold text-ink", onClick: finishTour, children: "Finish" })) : (_jsx("button", { className: "rounded-full bg-aurora px-3 py-1.5 text-xs font-semibold text-ink", onClick: () => setIndex((value) => Math.min(steps.length - 1, value + 1)), children: "Next" }))] })] })] }) })) : null] }));
}
