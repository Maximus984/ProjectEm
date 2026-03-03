import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from "react-router-dom";
export function NotFoundPage() {
    return (_jsxs("section", { className: "space-y-4 text-center", children: [_jsx("h1", { className: "font-display text-4xl text-white", children: "404" }), _jsx("p", { className: "text-sm text-mist", children: "Route not found." }), _jsx(Link, { to: "/", className: "rounded-full border border-white/30 px-4 py-2 text-sm", children: "Go Home" })] }));
}
