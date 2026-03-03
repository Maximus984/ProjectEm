import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery } from "@tanstack/react-query";
import { projectTiers } from "@projectm/contracts";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth-store";
export function BookPage() {
    const token = useAuthStore((state) => state.accessToken);
    const [searchParams] = useSearchParams();
    const action = searchParams.get("action");
    const [form, setForm] = useState({
        familyId: "",
        childId: "",
        tier: "PREMIUM_GENIUS",
        timezone: "America/Los_Angeles",
        date: new Date().toISOString().slice(0, 10),
        startTime: "10:00",
        endTime: "11:00",
        mode: "IN_PERSON",
        notes: "",
        requiresHardware: true,
        parentOptOutZoomIntro: false,
        couponCode: ""
    });
    const [statusLookup, setStatusLookup] = useState({ bookingId: "", code: "" });
    const [childDraft, setChildDraft] = useState({
        firstName: "",
        lastName: "",
        dob: "",
        gradeLevel: ""
    });
    const familyQuery = useQuery({
        queryKey: ["family-me", token],
        queryFn: () => api("/families/me", { token: token ?? undefined }),
        enabled: Boolean(token)
    });
    useEffect(() => {
        if (!familyQuery.data) {
            return;
        }
        setForm((prev) => ({
            ...prev,
            familyId: familyQuery.data.familyId,
            childId: prev.childId || familyQuery.data.children[0]?.id || ""
        }));
    }, [familyQuery.data]);
    const availabilityQuery = useQuery({
        queryKey: ["availability", form.date, form.tier, form.timezone],
        queryFn: () => api(`/availability?date=${encodeURIComponent(form.date)}&tier=${encodeURIComponent(form.tier)}&timezone=${encodeURIComponent(form.timezone)}`)
    });
    const addChildMutation = useMutation({
        mutationFn: (payload) => api(`/families/${form.familyId}/add-child`, {
            method: "POST",
            token: token ?? undefined,
            body: JSON.stringify(payload)
        }),
        onSuccess: () => {
            setChildDraft({ firstName: "", lastName: "", dob: "", gradeLevel: "" });
            void familyQuery.refetch();
        }
    });
    const bookingMutation = useMutation({
        mutationFn: (payload) => api("/bookings", {
            method: "POST",
            token: token ?? undefined,
            body: JSON.stringify(payload)
        })
    });
    const statusMutation = useMutation({
        mutationFn: ({ bookingId, code }) => api(`/bookings/${bookingId}/status?code=${encodeURIComponent(code)}`)
    });
    const priceEstimate = useMemo(() => {
        const tierPrice = projectTiers[form.tier].pricePerHour;
        const start = Number.parseInt(form.startTime.slice(0, 2), 10);
        const end = Number.parseInt(form.endTime.slice(0, 2), 10);
        const hours = Math.max(1, end - start);
        return tierPrice * hours;
    }, [form.endTime, form.startTime, form.tier]);
    const actionContext = useMemo(() => {
        switch (action) {
            case "reschedule":
                return {
                    title: "Reschedule Request",
                    message: "Enter the new date/time below, then include your original booking ID in notes."
                };
            case "cancel":
                return {
                    title: "Cancellation Request",
                    message: "Use the status tracker with your booking ID and verification code, then submit cancellation details in notes."
                };
            case "duplicate":
                return {
                    title: "Duplicate Booking Request",
                    message: "Use this form to create a new booking that mirrors a previous session."
                };
            default:
                return null;
        }
    }, [action]);
    const hasChildren = (familyQuery.data?.children.length ?? 0) > 0;
    return (_jsxs("section", { className: "space-y-8", children: [_jsxs("header", { children: [_jsx("h1", { className: "font-display text-3xl text-white md:text-4xl", children: "Family Booking Workspace" }), _jsx("p", { className: "mt-2 text-mist", children: "Your family account is linked automatically. Choose a child profile and submit a mentorship booking request." })] }), actionContext ? (_jsxs("div", { className: "rounded-xl border border-aurora/35 bg-aurora/10 p-4", children: [_jsx("p", { className: "text-sm font-semibold text-aurora", children: actionContext.title }), _jsx("p", { className: "mt-1 text-xs text-mist", children: actionContext.message })] })) : null, _jsxs("div", { className: "grid gap-6 xl:grid-cols-3", children: [_jsxs("article", { className: "panel rounded-2xl p-5 xl:col-span-2", children: [_jsxs("div", { className: "mb-4 flex flex-wrap items-center justify-between gap-3", children: [_jsx("h2", { className: "font-display text-xl text-white", children: "Quick Booking Widget" }), _jsx(Link, { to: "/parent", className: "rounded-full border border-white/20 px-3 py-1.5 text-xs text-mist", children: "Open Parent Workspace" })] }), familyQuery.isLoading ? _jsx("p", { className: "text-sm text-mist", children: "Loading family profile..." }) : null, familyQuery.error ? _jsx("p", { className: "text-sm text-red-300", children: familyQuery.error.message }) : null, !hasChildren && familyQuery.data ? (_jsxs("div", { className: "mb-4 rounded-xl border border-white/10 bg-white/5 p-4", children: [_jsx("p", { className: "text-sm text-white", children: "No child profiles found yet. Add a child to unlock booking." }), _jsxs("form", { className: "mt-3 grid gap-2 md:grid-cols-2", onSubmit: (event) => {
                                            event.preventDefault();
                                            addChildMutation.mutate({
                                                firstName: childDraft.firstName,
                                                lastName: childDraft.lastName,
                                                dob: childDraft.dob || undefined,
                                                gradeLevel: childDraft.gradeLevel || undefined
                                            });
                                        }, children: [_jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", placeholder: "Child first name", value: childDraft.firstName, onChange: (event) => setChildDraft((prev) => ({ ...prev, firstName: event.target.value })), required: true }), _jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", placeholder: "Child last name", value: childDraft.lastName, onChange: (event) => setChildDraft((prev) => ({ ...prev, lastName: event.target.value })), required: true }), _jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", type: "date", value: childDraft.dob, onChange: (event) => setChildDraft((prev) => ({ ...prev, dob: event.target.value })) }), _jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", placeholder: "Grade level", value: childDraft.gradeLevel, onChange: (event) => setChildDraft((prev) => ({ ...prev, gradeLevel: event.target.value })) }), _jsx("button", { type: "submit", className: "rounded-full bg-aurora px-4 py-2 text-sm font-semibold text-ink md:col-span-2", children: addChildMutation.isPending ? "Adding child..." : "Add Child Profile" })] }), addChildMutation.error ? _jsx("p", { className: "mt-2 text-xs text-red-300", children: addChildMutation.error.message }) : null] })) : null, _jsxs("form", { className: "mt-4 grid gap-3 md:grid-cols-2", onSubmit: (event) => {
                                    event.preventDefault();
                                    bookingMutation.mutate({
                                        ...form,
                                        couponCode: form.couponCode || undefined,
                                        notes: form.notes || undefined
                                    });
                                }, children: [_jsx("input", { placeholder: "Family ID", className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", value: form.familyId, onChange: (event) => setForm((prev) => ({ ...prev, familyId: event.target.value })), required: true, readOnly: true }), _jsxs("select", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", value: form.childId, onChange: (event) => setForm((prev) => ({ ...prev, childId: event.target.value })), required: true, disabled: !hasChildren, children: [_jsx("option", { value: "", children: "Select child profile" }), familyQuery.data?.children.map((child) => (_jsxs("option", { value: child.id, children: [child.firstName, " ", child.lastName] }, child.id)))] }), _jsxs("select", { value: form.tier, onChange: (event) => setForm((prev) => ({
                                            ...prev,
                                            tier: event.target.value,
                                            requiresHardware: event.target.value === "PREMIUM_GENIUS"
                                        })), className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", children: [_jsx("option", { value: "PREMIUM_GENIUS", children: "Premium Genius ($45/hr)" }), _jsx("option", { value: "BYOD_MENTORSHIP", children: "BYOD Mentorship ($40/hr)" }), _jsx("option", { value: "STANDARD_CARE", children: "Standard Care ($32/hr)" })] }), _jsxs("select", { value: form.mode, onChange: (event) => setForm((prev) => ({ ...prev, mode: event.target.value })), className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", children: [_jsx("option", { value: "IN_PERSON", children: "In Person" }), _jsx("option", { value: "VIRTUAL", children: "Virtual" })] }), _jsx("input", { type: "date", className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", value: form.date, onChange: (event) => setForm((prev) => ({ ...prev, date: event.target.value })), required: true }), _jsx("input", { placeholder: "Timezone", className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", value: form.timezone, onChange: (event) => setForm((prev) => ({ ...prev, timezone: event.target.value })), required: true }), _jsx("input", { type: "time", className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", value: form.startTime, onChange: (event) => setForm((prev) => ({ ...prev, startTime: event.target.value })), required: true }), _jsx("input", { type: "time", className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", value: form.endTime, onChange: (event) => setForm((prev) => ({ ...prev, endTime: event.target.value })), required: true }), _jsx("input", { placeholder: "Coupon (optional)", className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", value: form.couponCode ?? "", onChange: (event) => setForm((prev) => ({ ...prev, couponCode: event.target.value })) }), _jsx("textarea", { placeholder: "Session goal / notes", className: "md:col-span-2 min-h-24 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", value: form.notes ?? "", onChange: (event) => setForm((prev) => ({ ...prev, notes: event.target.value })) }), _jsxs("label", { className: "flex items-center gap-2 text-xs text-mist", children: [_jsx("input", { type: "checkbox", checked: form.parentOptOutZoomIntro, onChange: (event) => setForm((prev) => ({ ...prev, parentOptOutZoomIntro: event.target.checked })) }), "Opt out of intro Zoom (if policy allows)"] }), _jsxs("div", { className: "md:col-span-2 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm", children: [_jsx("span", { children: "Estimated total" }), _jsxs("strong", { className: "text-flare", children: ["$", priceEstimate.toFixed(2)] })] }), _jsx("button", { type: "submit", className: "rounded-full bg-aurora px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50", disabled: bookingMutation.isPending || !hasChildren, children: bookingMutation.isPending ? "Submitting..." : "Submit Booking" })] }), bookingMutation.isSuccess ? (_jsxs("div", { className: "mt-4 rounded-xl border border-aurora/40 bg-aurora/10 p-4 text-sm", children: [_jsxs("p", { children: ["Booking created: ", _jsx("strong", { children: bookingMutation.data.bookingId })] }), _jsxs("p", { className: "mt-1", children: ["Verification code: ", bookingMutation.data.verificationCode] }), _jsx("img", { src: bookingMutation.data.qr.imageDataUrl, alt: "Check-in QR", className: "mt-3 h-36 w-36 rounded-md border border-white/15 bg-white p-1" })] })) : null, bookingMutation.error ? _jsx("p", { className: "mt-3 text-sm text-red-300", children: bookingMutation.error.message }) : null] }), _jsxs("aside", { className: "space-y-4", children: [_jsxs("article", { className: "panel rounded-2xl p-5", children: [_jsx("h3", { className: "font-display text-lg text-white", children: "Instant Availability" }), _jsxs("div", { className: "mt-3 space-y-2", children: [availabilityQuery.isLoading ? _jsx("p", { className: "text-sm text-mist", children: "Checking slots..." }) : null, availabilityQuery.data?.slots.map((slot) => (_jsxs("div", { className: "flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-xs", children: [_jsxs("span", { children: [slot.startTime, " - ", slot.endTime] }), _jsx("span", { className: slot.available ? "text-aurora" : "text-red-300", children: slot.available ? "Available" : "Booked" })] }, slot.startTime)))] })] }), _jsxs("article", { className: "panel rounded-2xl p-5", children: [_jsx("h3", { className: "font-display text-lg text-white", children: "Booking Status Tracker" }), _jsxs("form", { className: "mt-3 space-y-2", onSubmit: (event) => {
                                            event.preventDefault();
                                            statusMutation.mutate(statusLookup);
                                        }, children: [_jsx("input", { placeholder: "Booking ID", className: "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", value: statusLookup.bookingId, onChange: (event) => setStatusLookup((prev) => ({ ...prev, bookingId: event.target.value })), required: true }), _jsx("input", { placeholder: "6-digit verification code", className: "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", value: statusLookup.code, onChange: (event) => setStatusLookup((prev) => ({ ...prev, code: event.target.value })), required: true }), _jsx("button", { type: "submit", className: "rounded-full border border-white/25 px-4 py-2 text-xs", children: "Check Status" })] }), statusMutation.data ? _jsxs("p", { className: "mt-3 text-sm text-aurora", children: ["Current status: ", statusMutation.data.status] }) : null, statusMutation.error ? _jsx("p", { className: "mt-3 text-sm text-red-300", children: statusMutation.error.message }) : null] })] })] })] }));
}
