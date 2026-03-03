import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation } from "@tanstack/react-query";
import { isFamilyRole, isAdminRole } from "@projectm/contracts";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth-store";
export function LoginPage() {
    const [form, setForm] = useState({ email: "", password: "", totpCode: "" });
    const setSession = useAuthStore((state) => state.setSession);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const nextPath = searchParams.get("next");
    const safeNext = nextPath && nextPath.startsWith("/") ? nextPath : null;
    const mutation = useMutation({
        mutationFn: (payload) => api("/auth/login", {
            method: "POST",
            body: JSON.stringify({
                ...payload,
                totpCode: payload.totpCode || undefined
            })
        }),
        onSuccess: (data) => {
            setSession({
                accessToken: data.tokens.accessToken,
                refreshToken: data.tokens.refreshToken,
                role: data.user.role,
                email: data.user.email
            });
            if (safeNext) {
                navigate(safeNext);
                return;
            }
            if (isAdminRole(data.user.role)) {
                navigate("/workspace");
                return;
            }
            if (data.user.role === "CLIENT") {
                navigate("/client");
                return;
            }
            if (isFamilyRole(data.user.role)) {
                navigate("/parent");
                return;
            }
            navigate("/dashboard");
        }
    });
    return (_jsxs("section", { className: "mx-auto max-w-lg space-y-5", children: [_jsx("h1", { className: "font-display text-3xl text-white", children: "Login" }), _jsx("p", { className: "text-sm text-mist", children: "Passkey-first auth is scaffolded; password fallback is live now." }), safeNext ? (_jsxs("p", { className: "rounded-xl border border-aurora/30 bg-aurora/10 px-3 py-2 text-xs text-aurora", children: ["Sign in first, then you will continue to ", _jsx("strong", { children: safeNext }), "."] })) : null, _jsxs("form", { className: "panel space-y-3 rounded-2xl p-5", onSubmit: (event) => {
                    event.preventDefault();
                    mutation.mutate(form);
                }, children: [_jsx("input", { className: "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", type: "email", placeholder: "Email", value: form.email, onChange: (event) => setForm((prev) => ({ ...prev, email: event.target.value })), required: true }), _jsx("input", { className: "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", type: "password", placeholder: "Password", value: form.password, onChange: (event) => setForm((prev) => ({ ...prev, password: event.target.value })), required: true }), _jsx("input", { className: "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", placeholder: "2FA code (if enabled)", value: form.totpCode ?? "", onChange: (event) => setForm((prev) => ({ ...prev, totpCode: event.target.value })) }), _jsx("button", { type: "submit", className: "rounded-full bg-aurora px-4 py-2 text-sm font-semibold text-ink", children: mutation.isPending ? "Signing in..." : "Sign In" }), mutation.error ? _jsx("p", { className: "text-xs text-red-300", children: mutation.error.message }) : null] }), _jsxs("p", { className: "text-xs text-mist", children: ["New family?", " ", _jsx(Link, { to: safeNext ? `/register?next=${encodeURIComponent(safeNext)}` : "/register", className: "text-aurora", children: "Create your account" })] })] }));
}
