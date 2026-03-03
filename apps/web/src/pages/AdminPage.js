import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { canDeleteAdmin, canWriteAdmin, isAdminRole } from "@projectm/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth-store";
const couponQueryKey = ["admin-coupons"];
const ipBanQueryKey = ["admin-ip-bans"];
const assignableRoles = [
    "CLIENT",
    "FAMILY",
    "PARENT",
    "MENTOR",
    "CHILD",
    "MONITOR",
    "MEDIUM",
    "MANAGER",
    "ADMIN",
    "OWNER"
];
export function AdminPage() {
    const token = useAuthStore((state) => state.accessToken);
    const role = useAuthStore((state) => state.role);
    const queryClient = useQueryClient();
    const [hardware, setHardware] = useState({
        name: "",
        serialNumber: "",
        status: "AVAILABLE",
        notes: ""
    });
    const [coupon, setCoupon] = useState({
        code: "",
        discountType: "PERCENT",
        value: 10,
        isActive: true
    });
    const [couponHasExpiration, setCouponHasExpiration] = useState(false);
    const [policyDraft, setPolicyDraft] = useState(null);
    const [ipBanInput, setIpBanInput] = useState({
        ipAddress: "",
        reason: "",
        expiresAt: ""
    });
    const [roleAssignInput, setRoleAssignInput] = useState({
        userId: "",
        role: "CLIENT"
    });
    const analytics = useQuery({
        queryKey: ["admin-analytics"],
        queryFn: () => api("/admin/analytics", { token: token ?? undefined }),
        enabled: Boolean(token)
    });
    const coupons = useQuery({
        queryKey: couponQueryKey,
        queryFn: () => api("/admin/coupons", { token: token ?? undefined }),
        enabled: Boolean(token)
    });
    const policyQuery = useQuery({
        queryKey: ["admin-workspace-policy"],
        queryFn: () => api("/admin/access/policy", { token: token ?? undefined }),
        enabled: Boolean(token)
    });
    const ipBansQuery = useQuery({
        queryKey: ipBanQueryKey,
        queryFn: () => api("/admin/ip-bans", { token: token ?? undefined }),
        enabled: Boolean(token)
    });
    useEffect(() => {
        if (policyQuery.data?.policy && !policyDraft) {
            setPolicyDraft(policyQuery.data.policy);
        }
    }, [policyDraft, policyQuery.data]);
    const hardwareMutation = useMutation({
        mutationFn: () => api("/admin/hardware", {
            method: "POST",
            token: token ?? undefined,
            body: JSON.stringify(hardware)
        })
    });
    const couponMutation = useMutation({
        mutationFn: () => api("/admin/coupons", {
            method: "POST",
            token: token ?? undefined,
            body: JSON.stringify({
                ...coupon,
                code: coupon.code.trim().toUpperCase(),
                expiresAt: couponHasExpiration ? coupon.expiresAt || undefined : undefined
            })
        }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: couponQueryKey });
            setCoupon({ code: "", discountType: "PERCENT", value: 10, isActive: true, expiresAt: "" });
            setCouponHasExpiration(false);
        }
    });
    const toggleCouponMutation = useMutation({
        mutationFn: (item) => api(`/admin/coupons/${item.id}`, {
            method: "PATCH",
            token: token ?? undefined,
            body: JSON.stringify({
                isActive: !item.isActive
            })
        }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: couponQueryKey });
        }
    });
    const deleteCouponMutation = useMutation({
        mutationFn: (couponId) => api(`/admin/coupons/${couponId}`, {
            method: "DELETE",
            token: token ?? undefined
        }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: couponQueryKey });
        }
    });
    const policyMutation = useMutation({
        mutationFn: (payload) => api("/admin/access/policy", {
            method: "PATCH",
            token: token ?? undefined,
            body: JSON.stringify(payload)
        }),
        onSuccess: async (payload) => {
            setPolicyDraft(payload.policy);
            await queryClient.invalidateQueries({ queryKey: ["admin-workspace-policy"] });
        }
    });
    const createIpBanMutation = useMutation({
        mutationFn: () => api("/admin/ip-bans", {
            method: "POST",
            token: token ?? undefined,
            body: JSON.stringify({
                ipAddress: ipBanInput.ipAddress.trim(),
                reason: ipBanInput.reason || undefined,
                expiresAt: ipBanInput.expiresAt ? `${ipBanInput.expiresAt}T00:00:00.000Z` : undefined
            })
        }),
        onSuccess: async () => {
            setIpBanInput({ ipAddress: "", reason: "", expiresAt: "" });
            await queryClient.invalidateQueries({ queryKey: ipBanQueryKey });
        }
    });
    const deleteIpBanMutation = useMutation({
        mutationFn: (banId) => api(`/admin/ip-bans/${banId}`, {
            method: "DELETE",
            token: token ?? undefined
        }),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ipBanQueryKey });
        }
    });
    const assignRoleMutation = useMutation({
        mutationFn: () => api(`/admin/users/${roleAssignInput.userId}/role`, {
            method: "PATCH",
            token: token ?? undefined,
            body: JSON.stringify({ role: roleAssignInput.role })
        }),
        onSuccess: () => {
            setRoleAssignInput({ userId: "", role: "CLIENT" });
        }
    });
    const isAdmin = role ? isAdminRole(role) : false;
    const canWrite = role ? canWriteAdmin(role) : false;
    const canDelete = role ? canDeleteAdmin(role) : false;
    return (_jsxs("section", { className: "space-y-6", children: [_jsx("h1", { className: "font-display text-3xl text-white md:text-4xl", children: "Admin Operations" }), _jsx("p", { className: "text-sm text-mist", children: "Roles enabled: Owner, Manager, Medium, Monitor, Mentor, Family. Admin tools are isolated under /admin." }), !isAdmin ? (_jsxs("article", { className: "panel rounded-2xl p-5 text-sm text-red-200", children: ["Current role ", _jsx("strong", { children: role ?? "None" }), " is not authorized for admin tools."] })) : null, _jsx("div", { className: "grid gap-4 md:grid-cols-4", children: analytics.data
                    ? Object.entries(analytics.data).map(([key, value]) => (_jsxs("article", { className: "panel rounded-xl p-4", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.2em] text-mist", children: key }), _jsx("p", { className: "mt-2 font-display text-2xl text-white", children: value })] }, key)))
                    : null }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("article", { className: "panel rounded-2xl p-5", children: [_jsx("h2", { className: "font-display text-lg text-white", children: "Hardware Inventory" }), _jsxs("div", { className: "mt-3 space-y-2", children: [_jsx("input", { className: "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", placeholder: "Name", value: hardware.name, onChange: (event) => setHardware((prev) => ({ ...prev, name: event.target.value })), disabled: !canWrite }), _jsx("input", { className: "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", placeholder: "Serial number", value: hardware.serialNumber, onChange: (event) => setHardware((prev) => ({ ...prev, serialNumber: event.target.value })), disabled: !canWrite }), _jsx("button", { className: "rounded-full bg-aurora px-4 py-2 text-xs font-semibold text-ink disabled:opacity-40", onClick: () => hardwareMutation.mutate(), disabled: !canWrite || hardwareMutation.isPending, children: "Add Hardware" }), hardwareMutation.error ? _jsx("p", { className: "text-xs text-red-300", children: hardwareMutation.error.message }) : null] })] }), _jsxs("article", { className: "panel rounded-2xl p-5", children: [_jsx("h2", { className: "font-display text-lg text-white", children: "Coupon Manager" }), _jsxs("div", { className: "mt-3 space-y-2", children: [_jsx("input", { className: "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", placeholder: "Code (e.g. VIP25)", value: coupon.code, onChange: (event) => setCoupon((prev) => ({ ...prev, code: event.target.value })), disabled: !canWrite }), _jsxs("div", { className: "grid grid-cols-3 gap-2", children: [_jsxs("select", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", value: coupon.discountType, onChange: (event) => setCoupon((prev) => ({
                                                    ...prev,
                                                    discountType: event.target.value
                                                })), disabled: !canWrite, children: [_jsx("option", { value: "PERCENT", children: "Percent" }), _jsx("option", { value: "AMOUNT", children: "Amount" })] }), _jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", type: "number", value: coupon.value, onChange: (event) => setCoupon((prev) => ({ ...prev, value: Number(event.target.value) })), disabled: !canWrite }), _jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", type: "date", value: coupon.expiresAt?.slice(0, 10) ?? "", onChange: (event) => setCoupon((prev) => ({
                                                    ...prev,
                                                    expiresAt: event.target.value ? `${event.target.value}T00:00:00.000Z` : ""
                                                })), disabled: !canWrite || !couponHasExpiration })] }), _jsxs("label", { className: "flex items-center gap-2 text-xs text-mist", children: [_jsx("input", { type: "checkbox", checked: couponHasExpiration, onChange: (event) => {
                                                    const checked = event.target.checked;
                                                    setCouponHasExpiration(checked);
                                                    if (!checked) {
                                                        setCoupon((prev) => ({ ...prev, expiresAt: "" }));
                                                    }
                                                }, disabled: !canWrite }), "Set expiration date (leave off for no expiration)"] }), _jsx("button", { className: "rounded-full bg-aurora px-4 py-2 text-xs font-semibold text-ink disabled:opacity-40", onClick: () => couponMutation.mutate(), disabled: !canWrite || couponMutation.isPending, children: "Save Coupon" }), couponMutation.error ? _jsx("p", { className: "text-xs text-red-300", children: couponMutation.error.message }) : null] })] })] }), _jsxs("article", { className: "panel rounded-2xl p-5", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsx("h2", { className: "font-display text-lg text-white", children: "Coupon System" }), _jsx("button", { className: "rounded-full border border-white/20 px-3 py-1 text-xs", onClick: () => coupons.refetch(), disabled: coupons.isFetching, children: "Refresh" })] }), _jsx("div", { className: "space-y-2", children: coupons.data?.coupons.map((item) => (_jsxs("div", { className: "grid grid-cols-1 gap-2 rounded-xl border border-white/10 p-3 text-xs md:grid-cols-6", children: [_jsxs("div", { children: [_jsx("p", { className: "text-mist", children: "Code" }), _jsx("p", { className: "font-semibold text-white", children: item.code })] }), _jsxs("div", { children: [_jsx("p", { className: "text-mist", children: "Type" }), _jsx("p", { className: "font-semibold text-white", children: item.discountType })] }), _jsxs("div", { children: [_jsx("p", { className: "text-mist", children: "Value" }), _jsx("p", { className: "font-semibold text-white", children: item.value })] }), _jsxs("div", { children: [_jsx("p", { className: "text-mist", children: "Status" }), _jsx("p", { className: item.isCurrentlyValid ? "font-semibold text-aurora" : "font-semibold text-red-300", children: item.isCurrentlyValid ? "ACTIVE" : item.isExpired ? "EXPIRED" : "INACTIVE" })] }), _jsxs("div", { children: [_jsx("p", { className: "text-mist", children: "Expires" }), _jsx("p", { className: "font-semibold text-white", children: item.expiresAt ? item.expiresAt.slice(0, 10) : "None" })] }), _jsxs("div", { className: "flex items-end justify-start gap-2 md:justify-end", children: [_jsx("button", { className: "rounded-full border border-white/20 px-3 py-1 disabled:opacity-40", onClick: () => toggleCouponMutation.mutate(item), disabled: !canWrite || toggleCouponMutation.isPending, children: item.isActive ? "Disable" : "Enable" }), _jsx("button", { className: "rounded-full border border-red-300/40 px-3 py-1 text-red-200 disabled:opacity-40", onClick: () => deleteCouponMutation.mutate(item.id), disabled: !canDelete || deleteCouponMutation.isPending, children: "Delete" })] })] }, item.id))) })] }), _jsxs("div", { className: "grid gap-4 lg:grid-cols-2", children: [_jsxs("article", { className: "panel rounded-2xl p-5", children: [_jsx("h2", { className: "font-display text-lg text-white", children: "Role Assignment" }), _jsx("p", { className: "mt-1 text-xs text-mist", children: "Assign workspace/client/parent roles by user ID." }), _jsxs("div", { className: "mt-3 grid grid-cols-1 gap-2", children: [_jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", placeholder: "User ID", value: roleAssignInput.userId, onChange: (event) => setRoleAssignInput((prev) => ({ ...prev, userId: event.target.value })), disabled: !canDelete }), _jsx("select", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", value: roleAssignInput.role, onChange: (event) => setRoleAssignInput((prev) => ({ ...prev, role: event.target.value })), disabled: !canDelete, children: assignableRoles.map((item) => (_jsx("option", { value: item, children: item }, item))) }), _jsx("button", { className: "rounded-full bg-aurora px-4 py-2 text-xs font-semibold text-ink disabled:opacity-40", onClick: () => assignRoleMutation.mutate(), disabled: !canDelete || assignRoleMutation.isPending || !roleAssignInput.userId, children: "Assign Role" }), assignRoleMutation.error ? (_jsx("p", { className: "text-xs text-red-300", children: assignRoleMutation.error.message })) : null] })] }), _jsxs("article", { className: "panel rounded-2xl p-5", children: [_jsx("h2", { className: "font-display text-lg text-white", children: "Workspace Hours Policy" }), _jsx("p", { className: "mt-1 text-xs text-mist", children: "Tailor role access windows for your workspace. Owner/Admin bypass these restrictions." }), policyDraft ? (_jsxs("div", { className: "mt-3 space-y-2", children: [_jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", value: policyDraft.timezone, onChange: (event) => setPolicyDraft((prev) => (prev ? { ...prev, timezone: event.target.value } : prev)), disabled: !canWrite }), _jsxs("label", { className: "flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-mist", children: [_jsx("input", { type: "checkbox", checked: policyDraft.enabled, onChange: (event) => setPolicyDraft((prev) => (prev ? { ...prev, enabled: event.target.checked } : prev)), disabled: !canWrite }), "Enable Hours Enforcement"] })] }), [
                                        ["manager", "Manager"],
                                        ["medium", "Medium"],
                                        ["monitor", "Monitor"],
                                        ["mentor", "Mentor"],
                                        ["client", "Client"],
                                        ["family", "Family"]
                                    ].map(([key, label]) => (_jsxs("div", { className: "grid grid-cols-3 items-center gap-2 text-xs", children: [_jsx("span", { className: "text-mist", children: label }), _jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-2 py-1", type: "number", min: 0, max: 23, value: policyDraft[`${key}StartHour`], onChange: (event) => setPolicyDraft((prev) => prev
                                                    ? {
                                                        ...prev,
                                                        [`${key}StartHour`]: Number(event.target.value)
                                                    }
                                                    : prev), disabled: !canWrite }), _jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-2 py-1", type: "number", min: 1, max: 24, value: policyDraft[`${key}EndHour`], onChange: (event) => setPolicyDraft((prev) => prev
                                                    ? {
                                                        ...prev,
                                                        [`${key}EndHour`]: Number(event.target.value)
                                                    }
                                                    : prev), disabled: !canWrite })] }, key))), _jsx("button", { className: "rounded-full bg-aurora px-4 py-2 text-xs font-semibold text-ink disabled:opacity-40", disabled: !canWrite || policyMutation.isPending || !policyDraft, onClick: () => policyDraft && policyMutation.mutate(policyDraft), children: "Save Workspace Policy" }), policyMutation.error ? _jsx("p", { className: "text-xs text-red-300", children: policyMutation.error.message }) : null] })) : (_jsx("p", { className: "mt-3 text-xs text-mist", children: "Loading policy..." }))] }), _jsxs("article", { className: "panel rounded-2xl p-5", children: [_jsx("h2", { className: "font-display text-lg text-white", children: "IP Ban List" }), _jsx("p", { className: "mt-1 text-xs text-mist", children: "Ban abusive IPs immediately. Optional expiration lets bans auto-lift." }), _jsxs("div", { className: "mt-3 grid grid-cols-1 gap-2", children: [_jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", placeholder: "IP address (e.g. 203.0.113.10)", value: ipBanInput.ipAddress, onChange: (event) => setIpBanInput((prev) => ({ ...prev, ipAddress: event.target.value })), disabled: !canDelete }), _jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", placeholder: "Reason (optional)", value: ipBanInput.reason, onChange: (event) => setIpBanInput((prev) => ({ ...prev, reason: event.target.value })), disabled: !canDelete }), _jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", type: "date", value: ipBanInput.expiresAt, onChange: (event) => setIpBanInput((prev) => ({ ...prev, expiresAt: event.target.value })), disabled: !canDelete }), _jsx("button", { className: "rounded-full bg-aurora px-4 py-2 text-xs font-semibold text-ink disabled:opacity-40", onClick: () => createIpBanMutation.mutate(), disabled: !canDelete || createIpBanMutation.isPending || !ipBanInput.ipAddress.trim(), children: "Add IP Ban" })] }), _jsx("div", { className: "mt-4 space-y-2", children: ipBansQuery.data?.bans.map((ban) => (_jsxs("div", { className: "flex items-center justify-between rounded-xl border border-white/10 p-2 text-xs", children: [_jsxs("div", { children: [_jsx("p", { className: "font-semibold text-white", children: ban.ipAddress }), _jsxs("p", { className: "text-mist", children: [ban.reason || "No reason", " | ", ban.expiresAt ? `Expires ${ban.expiresAt.slice(0, 10)}` : "No expiration"] })] }), _jsx("button", { className: "rounded-full border border-red-300/40 px-3 py-1 text-red-200 disabled:opacity-40", onClick: () => deleteIpBanMutation.mutate(ban.id), disabled: !canDelete || deleteIpBanMutation.isPending, children: "Unban" })] }, ban.id))) })] })] })] }));
}
