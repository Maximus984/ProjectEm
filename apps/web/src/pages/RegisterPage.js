import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth-store";
export function RegisterPage() {
    const [errorMessage, setErrorMessage] = useState(null);
    const [form, setForm] = useState({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        phone: "",
        createChildNow: true,
        children: [
            {
                firstName: "",
                lastName: "",
                dob: "",
                gradeLevel: ""
            }
        ],
        coParent: {
            enabled: false,
            firstName: "",
            lastName: "",
            email: "",
            password: "",
            phone: "",
            billingRole: "SECONDARY"
        }
    });
    const navigate = useNavigate();
    const setSession = useAuthStore((state) => state.setSession);
    const [searchParams] = useSearchParams();
    const nextPath = searchParams.get("next");
    const safeNext = nextPath && nextPath.startsWith("/") ? nextPath : null;
    const mutation = useMutation({
        mutationFn: (payload) => api("/auth/register", {
            method: "POST",
            body: JSON.stringify(payload)
        }),
        onSuccess: (data) => {
            setSession({
                accessToken: data.tokens.accessToken,
                refreshToken: data.tokens.refreshToken,
                role: data.user.role,
                email: data.user.email
            });
            navigate(safeNext ?? "/parent");
        }
    });
    return (_jsxs("section", { className: "mx-auto max-w-2xl space-y-5", children: [_jsx("h1", { className: "font-display text-3xl text-white", children: "Create Family Account" }), _jsx("p", { className: "text-sm text-mist", children: "Parent and child onboarding is completed together. Add up to 5 children and an optional co-parent." }), safeNext ? (_jsxs("p", { className: "rounded-xl border border-aurora/30 bg-aurora/10 px-3 py-2 text-xs text-aurora", children: ["Finish signup to continue to ", _jsx("strong", { children: safeNext }), "."] })) : null, _jsxs("form", { className: "panel grid gap-3 rounded-2xl p-5 md:grid-cols-2", onSubmit: (event) => {
                    event.preventDefault();
                    setErrorMessage(null);
                    const normalizedChildren = form.children
                        .map((child) => ({
                        firstName: child.firstName.trim(),
                        lastName: child.lastName.trim(),
                        dob: child.dob || undefined,
                        gradeLevel: child.gradeLevel.trim() || undefined
                    }))
                        .filter((child) => child.firstName.length > 0 && child.lastName.length > 0);
                    if (!normalizedChildren.length) {
                        setErrorMessage("Add at least one child with first and last name.");
                        return;
                    }
                    mutation.mutate({
                        firstName: form.firstName,
                        lastName: form.lastName,
                        email: form.email,
                        password: form.password,
                        phone: form.phone,
                        createChildNow: true,
                        children: normalizedChildren,
                        coParent: form.coParent.enabled
                            ? {
                                firstName: form.coParent.firstName.trim(),
                                lastName: form.coParent.lastName.trim(),
                                email: form.coParent.email.trim(),
                                password: form.coParent.password,
                                phone: form.coParent.phone.trim(),
                                billingRole: form.coParent.billingRole
                            }
                            : undefined
                    });
                }, children: [_jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", placeholder: "First name", value: form.firstName, onChange: (event) => setForm((prev) => ({ ...prev, firstName: event.target.value })), required: true }), _jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", placeholder: "Last name", value: form.lastName, onChange: (event) => setForm((prev) => ({ ...prev, lastName: event.target.value })), required: true }), _jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", type: "email", placeholder: "Email", value: form.email, onChange: (event) => setForm((prev) => ({ ...prev, email: event.target.value })), required: true }), _jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", placeholder: "Phone", value: form.phone, onChange: (event) => setForm((prev) => ({ ...prev, phone: event.target.value })), required: true }), _jsx("input", { className: "md:col-span-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", type: "password", placeholder: "Password", value: form.password, onChange: (event) => setForm((prev) => ({ ...prev, password: event.target.value })), required: true }), _jsxs("div", { className: "md:col-span-2 mt-1 rounded-xl border border-white/10 bg-white/5 p-3", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.18em] text-aurora", children: "Children (1-5 required)" }), _jsx("button", { type: "button", className: "rounded-full border border-white/20 px-3 py-1 text-xs disabled:opacity-40", onClick: () => setForm((prev) => ({
                                            ...prev,
                                            children: prev.children.length >= 5
                                                ? prev.children
                                                : [...prev.children, { firstName: "", lastName: "", dob: "", gradeLevel: "" }]
                                        })), disabled: form.children.length >= 5, children: "Add Child" })] }), _jsx("div", { className: "space-y-2", children: form.children.map((child, index) => (_jsxs("div", { className: "grid gap-2 md:grid-cols-4", children: [_jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", placeholder: "Child first name", value: child.firstName, onChange: (event) => setForm((prev) => ({
                                                ...prev,
                                                children: prev.children.map((item, itemIndex) => itemIndex === index ? { ...item, firstName: event.target.value } : item)
                                            })), required: true }), _jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", placeholder: "Child last name", value: child.lastName, onChange: (event) => setForm((prev) => ({
                                                ...prev,
                                                children: prev.children.map((item, itemIndex) => itemIndex === index ? { ...item, lastName: event.target.value } : item)
                                            })), required: true }), _jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", type: "date", value: child.dob, onChange: (event) => setForm((prev) => ({
                                                ...prev,
                                                children: prev.children.map((item, itemIndex) => itemIndex === index ? { ...item, dob: event.target.value } : item)
                                            })) }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { className: "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", placeholder: "Grade level", value: child.gradeLevel, onChange: (event) => setForm((prev) => ({
                                                        ...prev,
                                                        children: prev.children.map((item, itemIndex) => itemIndex === index ? { ...item, gradeLevel: event.target.value } : item)
                                                    })) }), _jsx("button", { type: "button", className: "rounded-xl border border-red-300/40 px-3 py-2 text-xs text-red-200 disabled:opacity-40", onClick: () => setForm((prev) => ({
                                                        ...prev,
                                                        children: prev.children.filter((_, itemIndex) => itemIndex !== index)
                                                    })), disabled: form.children.length <= 1, children: "Remove" })] })] }, `child-${index}`))) })] }), _jsxs("label", { className: "md:col-span-2 mt-2 flex items-center gap-2 text-sm text-mist", children: [_jsx("input", { type: "checkbox", checked: form.coParent.enabled, onChange: (event) => setForm((prev) => ({
                                    ...prev,
                                    coParent: { ...prev.coParent, enabled: event.target.checked }
                                })) }), "Add co-parent account now"] }), form.coParent.enabled ? (_jsxs(_Fragment, { children: [_jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", placeholder: "Co-parent first name", value: form.coParent.firstName, onChange: (event) => setForm((prev) => ({
                                    ...prev,
                                    coParent: { ...prev.coParent, firstName: event.target.value }
                                })), required: true }), _jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", placeholder: "Co-parent last name", value: form.coParent.lastName, onChange: (event) => setForm((prev) => ({
                                    ...prev,
                                    coParent: { ...prev.coParent, lastName: event.target.value }
                                })), required: true }), _jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", type: "email", placeholder: "Co-parent email", value: form.coParent.email, onChange: (event) => setForm((prev) => ({
                                    ...prev,
                                    coParent: { ...prev.coParent, email: event.target.value }
                                })), required: true }), _jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", placeholder: "Co-parent phone", value: form.coParent.phone, onChange: (event) => setForm((prev) => ({
                                    ...prev,
                                    coParent: { ...prev.coParent, phone: event.target.value }
                                })), required: true }), _jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", type: "password", placeholder: "Co-parent password", value: form.coParent.password, onChange: (event) => setForm((prev) => ({
                                    ...prev,
                                    coParent: { ...prev.coParent, password: event.target.value }
                                })), required: true }), _jsxs("select", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", value: form.coParent.billingRole, onChange: (event) => setForm((prev) => ({
                                    ...prev,
                                    coParent: {
                                        ...prev.coParent,
                                        billingRole: event.target.value
                                    }
                                })), children: [_jsx("option", { value: "SECONDARY", children: "Secondary billing role" }), _jsx("option", { value: "PRIMARY", children: "Primary billing role" })] })] })) : null, _jsx("button", { type: "submit", className: "md:col-span-2 rounded-full bg-aurora px-4 py-2 text-sm font-semibold text-ink", children: mutation.isPending ? "Creating account..." : "Create Account" }), errorMessage ? _jsx("p", { className: "md:col-span-2 text-xs text-red-300", children: errorMessage }) : null, mutation.error ? _jsx("p", { className: "md:col-span-2 text-xs text-red-300", children: mutation.error.message }) : null] })] }));
}
