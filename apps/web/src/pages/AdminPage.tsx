import {
  canDeleteAdmin,
  canWriteAdmin,
  isAdminRole,
  type UserRole
} from "@projectm/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { MessagingPanel } from "../components/MessagingPanel";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth-store";

type Coupon = {
  id: string;
  code: string;
  discountType: "PERCENT" | "AMOUNT";
  value: number;
  isActive: boolean;
  isExpired: boolean;
  isCurrentlyValid: boolean;
  expiresAt: string | null;
  createdAt: string;
};

type CouponInput = {
  code: string;
  discountType: "PERCENT" | "AMOUNT";
  value: number;
  isActive: boolean;
  expiresAt?: string;
};

type WorkspacePolicy = {
  id: string;
  timezone: string;
  enabled: boolean;
  qGateEnabled: boolean;
  qGateMessage: string;
  ownerStartHour: number;
  ownerEndHour: number;
  managerStartHour: number;
  managerEndHour: number;
  mediumStartHour: number;
  mediumEndHour: number;
  monitorStartHour: number;
  monitorEndHour: number;
  mentorStartHour: number;
  mentorEndHour: number;
  clientStartHour: number;
  clientEndHour: number;
  familyStartHour: number;
  familyEndHour: number;
};

type IpBan = {
  id: string;
  ipAddress: string;
  reason: string | null;
  expiresAt: string | null;
};

type FamilyChildrenSummary = {
  totals: {
    families: number;
    children: number;
    parents: number;
    childrenWithLogins: number;
  };
  families: Array<{
    familyId: string;
    familyName: string;
    parentCount: number;
    childCount: number;
    parents: Array<{
      userId: string;
      firstName: string;
      lastName: string;
      email: string;
      role: UserRole;
    }>;
    children: Array<{
      id: string;
      firstName: string;
      lastName: string;
      gradeLevel?: string | null;
      childUserId?: string | null;
      hasChildLogin: boolean;
    }>;
  }>;
};

const couponQueryKey = ["admin-coupons"];
const ipBanQueryKey = ["admin-ip-bans"];
const assignableRoles: UserRole[] = [
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
  const [coupon, setCoupon] = useState<CouponInput>({
    code: "",
    discountType: "PERCENT",
    value: 10,
    isActive: true
  });
  const [couponHasExpiration, setCouponHasExpiration] = useState(false);
  const [policyDraft, setPolicyDraft] = useState<WorkspacePolicy | null>(null);
  const [ipBanInput, setIpBanInput] = useState({
    ipAddress: "",
    reason: "",
    expiresAt: ""
  });
  const [roleAssignInput, setRoleAssignInput] = useState<{ userId: string; role: UserRole }>({
    userId: "",
    role: "CLIENT"
  });
  const [diagnosticAssignInput, setDiagnosticAssignInput] = useState({
    childId: "",
    grade: 7,
    label: ""
  });

  const analytics = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => api<Record<string, number>>("/admin/analytics", { token: token ?? undefined }),
    enabled: Boolean(token)
  });

  const coupons = useQuery({
    queryKey: couponQueryKey,
    queryFn: () => api<{ coupons: Coupon[] }>("/admin/coupons", { token: token ?? undefined }),
    enabled: Boolean(token)
  });

  const policyQuery = useQuery({
    queryKey: ["admin-workspace-policy"],
    queryFn: () => api<{ policy: WorkspacePolicy }>("/admin/access/policy", { token: token ?? undefined }),
    enabled: Boolean(token)
  });

  const ipBansQuery = useQuery({
    queryKey: ipBanQueryKey,
    queryFn: () => api<{ bans: IpBan[] }>("/admin/ip-bans", { token: token ?? undefined }),
    enabled: Boolean(token)
  });

  const familyChildrenSummaryQuery = useQuery({
    queryKey: ["admin-family-children-summary"],
    queryFn: () => api<FamilyChildrenSummary>("/admin/families/children-summary", { token: token ?? undefined }),
    enabled: Boolean(token),
    refetchInterval: 4000
  });

  useEffect(() => {
    if (policyQuery.data?.policy && !policyDraft) {
      const { qGateEnabled, qGateMessage, ...rest } = policyQuery.data.policy;
      setPolicyDraft({
        ...rest,
        qGateEnabled: Boolean(qGateEnabled),
        qGateMessage: qGateMessage || "Things will be back again soon."
      });
    }
  }, [policyDraft, policyQuery.data]);

  const hardwareMutation = useMutation({
    mutationFn: () =>
      api("/admin/hardware", {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify(hardware)
      })
  });

  const couponMutation = useMutation({
    mutationFn: () =>
      api<Coupon>("/admin/coupons", {
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
    mutationFn: (item: Coupon) =>
      api<Coupon>(`/admin/coupons/${item.id}`, {
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
    mutationFn: (couponId: string) =>
      api<void>(`/admin/coupons/${couponId}`, {
        method: "DELETE",
        token: token ?? undefined
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: couponQueryKey });
    }
  });

  const policyMutation = useMutation({
    mutationFn: (payload: Partial<WorkspacePolicy>) =>
      api<{ policy: WorkspacePolicy }>("/admin/access/policy", {
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
    mutationFn: () =>
      api<IpBan>("/admin/ip-bans", {
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
    mutationFn: (banId: string) =>
      api<void>(`/admin/ip-bans/${banId}`, {
        method: "DELETE",
        token: token ?? undefined
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ipBanQueryKey });
    }
  });

  const assignRoleMutation = useMutation({
    mutationFn: () =>
      api<{ userId: string; role: UserRole }>(`/admin/users/${roleAssignInput.userId}/role`, {
        method: "PATCH",
        token: token ?? undefined,
        body: JSON.stringify({ role: roleAssignInput.role })
      }),
    onSuccess: () => {
      setRoleAssignInput({ userId: "", role: "CLIENT" });
    }
  });

  const assignDiagnosticMutation = useMutation({
    mutationFn: () =>
      api<{ attemptId: string; status: string }>("/diagnostic/admin/assign-child", {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify({
          childId: diagnosticAssignInput.childId,
          grade: diagnosticAssignInput.grade,
          label: diagnosticAssignInput.label || undefined
        })
      }),
    onSuccess: async () => {
      setDiagnosticAssignInput({ childId: "", grade: 7, label: "" });
      await Promise.all([
        familyChildrenSummaryQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ["diagnostic-assignments"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-diagnostic-assignments"] })
      ]);
    }
  });

  const isAdmin = role ? isAdminRole(role) : false;
  const canWrite = role ? canWriteAdmin(role) : false;
  const canDelete = role ? canDeleteAdmin(role) : false;
  const canManageQGate = role === "OWNER";
  const capabilityBadges = [
    `Current role: ${role ?? "NONE"}`,
    canWrite ? "Write Access Enabled" : "Read Only",
    canDelete ? "Delete Privileges Enabled" : "No Delete Privileges",
    canManageQGate ? "Q Gate Control Enabled" : "Q Gate View Only"
  ];

  return (
    <section className="space-y-6">
      <header className="panel relative overflow-hidden rounded-3xl px-6 py-7">
        <div className="absolute -right-16 -top-24 h-52 w-52 rounded-full bg-aurora/20 blur-3xl" />
        <div className="absolute -bottom-20 left-20 h-48 w-48 rounded-full bg-flare/15 blur-3xl" />
        <p className="section-subtitle">Admin Workspace</p>
        <h1 className="mt-1 font-display text-3xl text-white md:text-4xl">Admin Operations</h1>
        <p className="mt-3 max-w-3xl text-sm text-mist">
          Roles enabled: Owner, Manager, Medium, Monitor, Mentor, Family. Admin tools are isolated under /admin.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {capabilityBadges.map((item) => (
            <span key={item} className="chip">
              {item}
            </span>
          ))}
        </div>
      </header>

      {!isAdmin ? (
        <article className="panel rounded-2xl p-5 text-sm text-red-200">
          Current role <strong>{role ?? "None"}</strong> is not authorized for admin tools.
        </article>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        {analytics.data
          ? Object.entries(analytics.data).map(([key, value]) => (
              <article key={key} className="stat-card">
                <p className="text-xs uppercase tracking-[0.2em] text-mist">{key}</p>
                <p className="mt-2 font-display text-2xl text-white">{value}</p>
              </article>
            ))
          : null}
      </div>

      <article className="panel rounded-2xl p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="section-heading">Family + Child Workspace Overview</h2>
            <p className="section-subtitle">Live roster, child login status, and assignment controls</p>
          </div>
          <button
            className="button-secondary px-3 py-1 text-xs"
            onClick={() => familyChildrenSummaryQuery.refetch()}
            disabled={familyChildrenSummaryQuery.isFetching}
          >
            Refresh
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
            <p className="text-mist">Families</p>
            <p className="mt-1 font-display text-2xl text-white">{familyChildrenSummaryQuery.data?.totals.families ?? 0}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
            <p className="text-mist">Children</p>
            <p className="mt-1 font-display text-2xl text-white">{familyChildrenSummaryQuery.data?.totals.children ?? 0}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
            <p className="text-mist">Parents</p>
            <p className="mt-1 font-display text-2xl text-white">{familyChildrenSummaryQuery.data?.totals.parents ?? 0}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
            <p className="text-mist">Child Logins</p>
            <p className="mt-1 font-display text-2xl text-aurora">{familyChildrenSummaryQuery.data?.totals.childrenWithLogins ?? 0}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-aurora">Assign Diagnostic To Child</p>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              <select
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs"
                value={diagnosticAssignInput.childId}
                onChange={(event) => setDiagnosticAssignInput((prev) => ({ ...prev, childId: event.target.value }))}
              >
                <option value="">Select child</option>
                {familyChildrenSummaryQuery.data?.families.flatMap((family) =>
                  family.children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.firstName} {child.lastName} ({family.familyName})
                    </option>
                  ))
                )}
              </select>
              <select
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs"
                value={diagnosticAssignInput.grade}
                onChange={(event) =>
                  setDiagnosticAssignInput((prev) => ({ ...prev, grade: Number(event.target.value) }))
                }
              >
                {[7, 8, 9, 10, 11, 12].map((grade) => (
                  <option key={grade} value={grade}>
                    Grade {grade}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="rounded-full bg-aurora px-3 py-2 text-xs font-semibold text-ink disabled:opacity-40"
                onClick={() => assignDiagnosticMutation.mutate()}
                disabled={!canWrite || assignDiagnosticMutation.isPending || !diagnosticAssignInput.childId}
              >
                {assignDiagnosticMutation.isPending ? "Assigning..." : "Assign Test"}
              </button>
            </div>
            <input
              className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs"
              placeholder="Optional label (e.g. Week 1 baseline)"
              value={diagnosticAssignInput.label}
              onChange={(event) => setDiagnosticAssignInput((prev) => ({ ...prev, label: event.target.value }))}
            />
            {assignDiagnosticMutation.error ? <p className="mt-2 text-xs text-red-300">{assignDiagnosticMutation.error.message}</p> : null}
          </div>

          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {familyChildrenSummaryQuery.data?.families.map((family) => (
              <div key={family.familyId} className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
                <p className="font-semibold text-white">
                  {family.familyName} • {family.childCount} children
                </p>
                <p className="mt-1 text-mist">
                  Parents: {family.parents.map((parent) => `${parent.firstName} ${parent.lastName}`).join(", ") || "None"}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {family.children.map((child) => (
                    <span key={child.id} className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-mist">
                      {child.firstName} {child.lastName} {child.hasChildLogin ? "• Child Login" : "• Parent Linked"}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </article>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="panel rounded-2xl p-5">
          <h2 className="section-heading">Hardware Inventory</h2>
          <div className="mt-3 space-y-2">
            <input
              className="input-shell w-full px-3 py-2 text-sm"
              placeholder="Name"
              value={hardware.name}
              onChange={(event) => setHardware((prev) => ({ ...prev, name: event.target.value }))}
              disabled={!canWrite}
            />
            <input
              className="input-shell w-full px-3 py-2 text-sm"
              placeholder="Serial number"
              value={hardware.serialNumber}
              onChange={(event) => setHardware((prev) => ({ ...prev, serialNumber: event.target.value }))}
              disabled={!canWrite}
            />
            <button
              className="button-primary px-4 py-2 text-xs disabled:opacity-40"
              onClick={() => hardwareMutation.mutate()}
              disabled={!canWrite || hardwareMutation.isPending}
            >
              Add Hardware
            </button>
            {hardwareMutation.error ? <p className="text-xs text-red-300">{hardwareMutation.error.message}</p> : null}
          </div>
        </article>

        <article className="panel rounded-2xl p-5">
          <h2 className="section-heading">Coupon Manager</h2>
          <div className="mt-3 space-y-2">
            <input
              className="input-shell w-full px-3 py-2 text-sm"
              placeholder="Code (e.g. VIP25)"
              value={coupon.code}
              onChange={(event) => setCoupon((prev) => ({ ...prev, code: event.target.value }))}
              disabled={!canWrite}
            />
            <div className="grid grid-cols-3 gap-2">
              <select
                className="input-shell px-3 py-2 text-sm"
                value={coupon.discountType}
                onChange={(event) =>
                  setCoupon((prev) => ({
                    ...prev,
                    discountType: event.target.value as CouponInput["discountType"]
                  }))
                }
                disabled={!canWrite}
              >
                <option value="PERCENT">Percent</option>
                <option value="AMOUNT">Amount</option>
              </select>
              <input
                className="input-shell px-3 py-2 text-sm"
                type="number"
                value={coupon.value}
                onChange={(event) => setCoupon((prev) => ({ ...prev, value: Number(event.target.value) }))}
                disabled={!canWrite}
              />
              <input
                className="input-shell px-3 py-2 text-sm"
                type="date"
                value={coupon.expiresAt?.slice(0, 10) ?? ""}
                onChange={(event) =>
                  setCoupon((prev) => ({
                    ...prev,
                    expiresAt: event.target.value ? `${event.target.value}T00:00:00.000Z` : ""
                  }))
                }
                disabled={!canWrite || !couponHasExpiration}
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-mist">
              <input
                type="checkbox"
                checked={couponHasExpiration}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setCouponHasExpiration(checked);
                  if (!checked) {
                    setCoupon((prev) => ({ ...prev, expiresAt: "" }));
                  }
                }}
                disabled={!canWrite}
              />
              Set expiration date (leave off for no expiration)
            </label>
            <button
              className="button-primary px-4 py-2 text-xs disabled:opacity-40"
              onClick={() => couponMutation.mutate()}
              disabled={!canWrite || couponMutation.isPending}
            >
              Save Coupon
            </button>
            {couponMutation.error ? <p className="text-xs text-red-300">{couponMutation.error.message}</p> : null}
          </div>
        </article>
      </div>

      <article className="panel rounded-2xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-heading">Coupon System</h2>
          <button
            className="button-secondary px-3 py-1 text-xs"
            onClick={() => coupons.refetch()}
            disabled={coupons.isFetching}
          >
            Refresh
          </button>
        </div>

        <div className="space-y-2">
          {coupons.data?.coupons.map((item) => (
            <div key={item.id} className="grid grid-cols-1 gap-2 rounded-xl border border-white/10 p-3 text-xs md:grid-cols-6">
              <div>
                <p className="text-mist">Code</p>
                <p className="font-semibold text-white">{item.code}</p>
              </div>
              <div>
                <p className="text-mist">Type</p>
                <p className="font-semibold text-white">{item.discountType}</p>
              </div>
              <div>
                <p className="text-mist">Value</p>
                <p className="font-semibold text-white">{item.value}</p>
              </div>
              <div>
                <p className="text-mist">Status</p>
                <p className={item.isCurrentlyValid ? "font-semibold text-aurora" : "font-semibold text-red-300"}>
                  {item.isCurrentlyValid ? "ACTIVE" : item.isExpired ? "EXPIRED" : "INACTIVE"}
                </p>
              </div>
              <div>
                <p className="text-mist">Expires</p>
                <p className="font-semibold text-white">{item.expiresAt ? item.expiresAt.slice(0, 10) : "None"}</p>
              </div>
              <div className="flex items-end justify-start gap-2 md:justify-end">
                <button
                  className="rounded-full border border-white/20 px-3 py-1 disabled:opacity-40"
                  onClick={() => toggleCouponMutation.mutate(item)}
                  disabled={!canWrite || toggleCouponMutation.isPending}
                >
                  {item.isActive ? "Disable" : "Enable"}
                </button>
                <button
                  className="rounded-full border border-red-300/40 px-3 py-1 text-red-200 disabled:opacity-40"
                  onClick={() => deleteCouponMutation.mutate(item.id)}
                  disabled={!canDelete || deleteCouponMutation.isPending}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="panel rounded-2xl p-5">
          <h2 className="section-heading">Role Assignment</h2>
          <p className="mt-1 text-xs text-mist">
            Assign workspace/client/parent roles by user ID.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2">
            <input
              className="input-shell px-3 py-2 text-sm"
              placeholder="User ID"
              value={roleAssignInput.userId}
              onChange={(event) => setRoleAssignInput((prev) => ({ ...prev, userId: event.target.value }))}
              disabled={!canDelete}
            />
            <select
              className="input-shell px-3 py-2 text-sm"
              value={roleAssignInput.role}
              onChange={(event) =>
                setRoleAssignInput((prev) => ({ ...prev, role: event.target.value as UserRole }))
              }
              disabled={!canDelete}
            >
              {assignableRoles.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <button
              className="button-primary px-4 py-2 text-xs disabled:opacity-40"
              onClick={() => assignRoleMutation.mutate()}
              disabled={!canDelete || assignRoleMutation.isPending || !roleAssignInput.userId}
            >
              Assign Role
            </button>
            {assignRoleMutation.error ? (
              <p className="text-xs text-red-300">{assignRoleMutation.error.message}</p>
            ) : null}
          </div>
        </article>

        <article className="panel rounded-2xl p-5">
          <h2 className="section-heading">Workspace Hours Policy</h2>
          <p className="mt-1 text-xs text-mist">
            Tailor role access windows for your workspace. Owner/Admin bypass these restrictions.
          </p>

          {policyDraft ? (
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="input-shell px-3 py-2 text-sm"
                  value={policyDraft.timezone}
                  onChange={(event) =>
                    setPolicyDraft((prev) => (prev ? { ...prev, timezone: event.target.value } : prev))
                  }
                  disabled={!canWrite}
                />
                <label className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-mist">
                  <input
                    type="checkbox"
                    checked={policyDraft.enabled}
                    onChange={(event) =>
                      setPolicyDraft((prev) => (prev ? { ...prev, enabled: event.target.checked } : prev))
                    }
                    disabled={!canWrite}
                  />
                  Enable Hours Enforcement
                </label>
              </div>

              <div className="rounded-2xl border border-cyan-300/25 bg-cyan-300/5 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Q Gate Maintenance Mode</p>
                <p className="mt-1 text-xs text-mist">
                  When enabled, all non-owner users are redirected to a glitch maintenance screen.
                </p>

                <label className="mt-3 flex items-center gap-2 text-xs text-mist">
                  <input
                    type="checkbox"
                    checked={Boolean(policyDraft.qGateEnabled)}
                    onChange={(event) =>
                      setPolicyDraft((prev) =>
                        prev ? { ...prev, qGateEnabled: event.target.checked } : prev
                      )
                    }
                    disabled={!canManageQGate}
                  />
                  Enable Q Gate
                </label>

                <textarea
                  className="input-shell mt-2 min-h-20 w-full px-3 py-2 text-sm"
                  value={policyDraft.qGateMessage ?? ""}
                  onChange={(event) =>
                    setPolicyDraft((prev) =>
                      prev ? { ...prev, qGateMessage: event.target.value } : prev
                    )
                  }
                  disabled={!canManageQGate}
                  maxLength={240}
                />

                {!canManageQGate ? (
                  <p className="mt-2 text-xs text-amber-200">
                    Only OWNER can change Q Gate settings.
                  </p>
                ) : null}
              </div>

              {[
                ["manager", "Manager"],
                ["medium", "Medium"],
                ["monitor", "Monitor"],
                ["mentor", "Mentor"],
                ["client", "Client"],
                ["family", "Family"]
              ].map(([key, label]) => (
                <div key={key} className="grid grid-cols-3 items-center gap-2 text-xs">
                  <span className="text-mist">{label}</span>
                  <input
                    className="input-shell px-2 py-1"
                    type="number"
                    min={0}
                    max={23}
                    value={policyDraft[`${key}StartHour` as keyof WorkspacePolicy] as number}
                    onChange={(event) =>
                      setPolicyDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              [`${key}StartHour`]: Number(event.target.value)
                            }
                          : prev
                      )
                    }
                    disabled={!canWrite}
                  />
                  <input
                    className="input-shell px-2 py-1"
                    type="number"
                    min={1}
                    max={24}
                    value={policyDraft[`${key}EndHour` as keyof WorkspacePolicy] as number}
                    onChange={(event) =>
                      setPolicyDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              [`${key}EndHour`]: Number(event.target.value)
                            }
                          : prev
                      )
                    }
                    disabled={!canWrite}
                  />
                </div>
              ))}

              <button
                className="button-primary px-4 py-2 text-xs disabled:opacity-40"
                disabled={!canWrite || policyMutation.isPending || !policyDraft}
                onClick={() => {
                  if (!policyDraft) {
                    return;
                  }

                  if (canManageQGate) {
                    policyMutation.mutate(policyDraft);
                    return;
                  }

                  const { qGateEnabled: _qGateEnabled, qGateMessage: _qGateMessage, ...rest } = policyDraft;
                  policyMutation.mutate(rest);
                }}
              >
                Save Workspace Policy
              </button>
              {policyMutation.error ? <p className="text-xs text-red-300">{policyMutation.error.message}</p> : null}
            </div>
          ) : (
            <p className="mt-3 text-xs text-mist">Loading policy...</p>
          )}
        </article>

        <article className="panel rounded-2xl p-5">
          <h2 className="section-heading">IP Ban List</h2>
          <p className="mt-1 text-xs text-mist">
            Ban abusive IPs immediately. Optional expiration lets bans auto-lift.
          </p>

          <div className="mt-3 grid grid-cols-1 gap-2">
            <input
              className="input-shell px-3 py-2 text-sm"
              placeholder="IP address (e.g. 203.0.113.10)"
              value={ipBanInput.ipAddress}
              onChange={(event) => setIpBanInput((prev) => ({ ...prev, ipAddress: event.target.value }))}
              disabled={!canDelete}
            />
            <input
              className="input-shell px-3 py-2 text-sm"
              placeholder="Reason (optional)"
              value={ipBanInput.reason}
              onChange={(event) => setIpBanInput((prev) => ({ ...prev, reason: event.target.value }))}
              disabled={!canDelete}
            />
            <input
              className="input-shell px-3 py-2 text-sm"
              type="date"
              value={ipBanInput.expiresAt}
              onChange={(event) => setIpBanInput((prev) => ({ ...prev, expiresAt: event.target.value }))}
              disabled={!canDelete}
            />
            <button
              className="button-primary px-4 py-2 text-xs disabled:opacity-40"
              onClick={() => createIpBanMutation.mutate()}
              disabled={!canDelete || createIpBanMutation.isPending || !ipBanInput.ipAddress.trim()}
            >
              Add IP Ban
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {ipBansQuery.data?.bans.map((ban) => (
              <div key={ban.id} className="flex items-center justify-between rounded-xl border border-white/10 p-2 text-xs">
                <div>
                  <p className="font-semibold text-white">{ban.ipAddress}</p>
                  <p className="text-mist">
                    {ban.reason || "No reason"} | {ban.expiresAt ? `Expires ${ban.expiresAt.slice(0, 10)}` : "No expiration"}
                  </p>
                </div>
                <button
                  className="rounded-full border border-red-300/40 px-3 py-1 text-red-200 disabled:opacity-40"
                  onClick={() => deleteIpBanMutation.mutate(ban.id)}
                  disabled={!canDelete || deleteIpBanMutation.isPending}
                >
                  Unban
                </button>
              </div>
            ))}
          </div>
        </article>
      </div>

      <MessagingPanel
        token={token}
        role={role}
        title="Owner / Staff Direct Messages"
        adminFamilyScopes={
          familyChildrenSummaryQuery.data?.families.map((family) => ({
            familyId: family.familyId,
            familyName: family.familyName,
            children: family.children.map((child) => ({
              id: child.id,
              label: `${child.firstName} ${child.lastName}${child.gradeLevel ? ` (Grade ${child.gradeLevel})` : ""}`
            }))
          })) ?? []
        }
      />
    </section>
  );
}
