import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation } from "@tanstack/react-query";
import { supportContacts } from "@projectm/contracts";
import { useState } from "react";
import { api } from "../lib/api";
export function SupportPage() {
    const [form, setForm] = useState({
        subject: "",
        category: "ACCOUNT",
        message: "",
        contactEmail: ""
    });
    const mutation = useMutation({
        mutationFn: (payload) => api("/support/tickets", {
            method: "POST",
            body: JSON.stringify(payload)
        })
    });
    return (_jsxs("section", { className: "space-y-6", children: [_jsxs("header", { children: [_jsx("h1", { className: "font-display text-3xl text-white md:text-4xl", children: "Support" }), _jsx("p", { className: "mt-2 text-mist", children: "Account-specific help belongs here, not in public channels." })] }), _jsxs("div", { className: "grid gap-6 md:grid-cols-2", children: [_jsxs("article", { className: "panel rounded-2xl p-5", children: [_jsx("h2", { className: "font-display text-xl text-white", children: "Contact Channels" }), _jsxs("ul", { className: "mt-4 space-y-2 text-sm text-mist", children: [_jsxs("li", { children: ["Phone: ", supportContacts.phone] }), _jsxs("li", { children: ["Instagram: ", _jsxs("a", { href: supportContacts.instagramUrl, children: ["@", supportContacts.instagramHandle] })] }), _jsxs("li", { children: ["Discord: ", _jsx("a", { href: supportContacts.discordUrl, children: "Community channel" }), " (external)"] })] }), _jsx("p", { className: "mt-4 text-xs text-mist", children: "External community channels are not for account-specific issues." })] }), _jsxs("article", { className: "panel rounded-2xl p-5", children: [_jsx("h2", { className: "font-display text-xl text-white", children: "Contact Support" }), _jsxs("form", { className: "mt-4 space-y-3", onSubmit: (event) => {
                                    event.preventDefault();
                                    mutation.mutate(form);
                                }, children: [_jsx("input", { className: "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", placeholder: "Subject", value: form.subject, onChange: (event) => setForm((prev) => ({ ...prev, subject: event.target.value })), required: true }), _jsxs("select", { className: "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", value: form.category, onChange: (event) => setForm((prev) => ({
                                            ...prev,
                                            category: event.target.value
                                        })), children: [_jsx("option", { value: "ACCOUNT", children: "Account" }), _jsx("option", { value: "BOOKING", children: "Booking" }), _jsx("option", { value: "BILLING", children: "Billing" }), _jsx("option", { value: "TECHNICAL", children: "Technical" }), _jsx("option", { value: "OTHER", children: "Other" })] }), _jsx("input", { className: "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", placeholder: "Contact email", type: "email", value: form.contactEmail, onChange: (event) => setForm((prev) => ({ ...prev, contactEmail: event.target.value })), required: true }), _jsx("textarea", { className: "min-h-28 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", placeholder: "Describe your issue", value: form.message, onChange: (event) => setForm((prev) => ({ ...prev, message: event.target.value })), required: true }), _jsx("button", { type: "submit", className: "rounded-full bg-aurora px-4 py-2 text-sm font-semibold text-ink", disabled: mutation.isPending, children: mutation.isPending ? "Submitting..." : "Submit Ticket" }), mutation.isSuccess ? _jsx("p", { className: "text-xs text-aurora", children: "Ticket submitted successfully." }) : null, mutation.error ? _jsx("p", { className: "text-xs text-red-300", children: mutation.error.message }) : null] })] })] })] }));
}
