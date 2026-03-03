import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { isFamilyRole } from "@projectm/contracts";
import { MessagingPanel } from "../components/MessagingPanel";
import { useUiSound } from "../hooks/use-ui-sound";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth-store";

const steps = [
  "Platform overview",
  "Family account requirement",
  "Payment policy",
  "Booking and diagnostics",
  "Messaging and classroom"
];

const stepDetails = [
  "Project Paige combines booking, diagnostics, assignments, attendance, messaging, and parent visibility in one workspace.",
  "Create a family account first. This is required before parents can book sessions, launch diagnostics, or manage children.",
  "Payments are processed after services are provided so families can review completed session details before billing.",
  "Use Book and Diagnostic actions to schedule and run structured assessments tied to each child profile.",
  "Use direct messages and classroom tools to manage assignments, attendance, and progress in real time."
];
const quickActionLinks = [
  { to: "/book", label: "New Booking" },
  { to: "/classroom", label: "Classroom" },
  { to: "/diagnostic", label: "Diagnostic Center" },
  { to: "/book?action=reschedule", label: "Reschedule" },
  { to: "/support", label: "Contact Support" }
];

type FamilyProfileResponse = {
  familyId: string;
  name: string;
  childCount: number;
  children: Array<{
    id: string;
    firstName: string;
    lastName: string;
    gradeLevel?: string | null;
  }>;
};

type DiagnosticAssignment = {
  assignmentId: string;
  attemptId: string;
  grade: number;
  label: string;
  status: string;
  child: {
    id: string;
    firstName: string;
    lastName: string;
    gradeLevel?: string | null;
    familyId: string;
  } | null;
  assignedAt: string;
  submittedAt: string | null;
  isStartable: boolean;
};

function useNotificationPermission() {
  const supported = typeof window !== "undefined" && "Notification" in window;
  const [permission, setPermission] = useState<NotificationPermission>(
    supported ? Notification.permission : "denied"
  );

  return {
    supported,
    permission,
    request: async () => {
      if (!supported) {
        return;
      }
      const next = await Notification.requestPermission();
      setPermission(next);
    }
  };
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function assignmentStatusClass(status: string) {
  if (status === "SUBMITTED" || status === "COMPLETED") {
    return "text-flare border-flare/40 bg-flare/10";
  }
  if (status === "IN_PROGRESS") {
    return "text-aurora border-aurora/40 bg-aurora/10";
  }
  return "text-mist border-white/20 bg-white/5";
}

export function DashboardPage() {
  const token = useAuthStore((state) => state.accessToken);
  const role = useAuthStore((state) => state.role);
  const { playTap, playSuccess } = useUiSound();
  const [tourOpen, setTourOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [newFamilyName, setNewFamilyName] = useState("My Family Account");
  const [familyActionError, setFamilyActionError] = useState<string | null>(null);
  const notification = useNotificationPermission();
  const seenAssignmentIdsRef = useRef<Set<string>>(new Set());

  const familyQuery = useQuery({
    queryKey: ["dashboard-family", token],
    queryFn: () => api<FamilyProfileResponse>("/families/me", { token: token ?? undefined }),
    enabled: Boolean(token && role && isFamilyRole(role))
  });

  const assignmentsQuery = useQuery({
    queryKey: ["dashboard-diagnostic-assignments", token, role],
    queryFn: () => api<{ assignments: DiagnosticAssignment[] }>("/diagnostic/assignments", { token: token ?? undefined }),
    enabled: Boolean(token),
    refetchInterval: 3000
  });

  const createFamilyMutation = useMutation({
    mutationFn: (payload: { name: string }) =>
      api<{ familyId: string }>("/families", {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      playSuccess();
      setFamilyActionError(null);
      await familyQuery.refetch();
    },
    onError: (error) => {
      setFamilyActionError(error instanceof Error ? error.message : "Unable to create family account.");
    }
  });

  useEffect(() => {
    const completed = window.localStorage.getItem("projectm_has_completed_tour");
    if (!completed) {
      setTourOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!assignmentsQuery.data?.assignments?.length) {
      return;
    }

    for (const item of assignmentsQuery.data.assignments) {
      if (seenAssignmentIdsRef.current.has(item.assignmentId)) {
        continue;
      }
      if (seenAssignmentIdsRef.current.size > 0 && notification.supported && notification.permission === "granted") {
        const childLabel = item.child ? `${item.child.firstName} ${item.child.lastName}` : "your account";
        new Notification("New diagnostic assigned", {
          body: `${item.label} is ready for ${childLabel}.`
        });
      }
      seenAssignmentIdsRef.current.add(item.assignmentId);
    }
  }, [assignmentsQuery.data, notification.permission, notification.supported]);

  const finishTour = () => {
    window.localStorage.setItem("projectm_has_completed_tour", "true");
    setTourOpen(false);
    playSuccess();
  };

  const familyErrorMessage =
    familyQuery.error instanceof Error ? familyQuery.error.message : "";
  const familyMissing =
    Boolean(role && isFamilyRole(role)) &&
    !familyQuery.isLoading &&
    /no family membership/i.test(familyErrorMessage);

  const assignmentTotals = useMemo(() => {
    const items = assignmentsQuery.data?.assignments ?? [];
    return {
      total: items.length,
      pending: items.filter((item) => item.status === "ASSIGNED" || item.status === "IN_PROGRESS").length,
      submitted: items.filter((item) => item.status === "SUBMITTED").length
    };
  }, [assignmentsQuery.data]);

  const childCount = familyQuery.data?.childCount ?? familyQuery.data?.children?.length ?? 0;
  const childOptions =
    familyQuery.data?.children.map((child) => ({
      id: child.id,
      label: `${child.firstName} ${child.lastName}${child.gradeLevel ? ` (Grade ${child.gradeLevel})` : ""}`
    })) ?? [];
  const highlightedAssignments = (assignmentsQuery.data?.assignments ?? []).slice(0, 6);

  return (
    <section className="space-y-6">
      <header className="panel relative overflow-hidden rounded-3xl px-6 py-7">
        <div className="absolute -top-20 right-6 h-48 w-48 rounded-full bg-aurora/20 blur-3xl" />
        <div className="absolute -bottom-24 left-16 h-48 w-48 rounded-full bg-flare/15 blur-3xl" />
        <p className="section-subtitle">Family Workspace</p>
        <h1 className="mt-1 font-display text-3xl text-white md:text-4xl">Family Dashboard</h1>
        <p className="mt-3 max-w-3xl text-sm text-mist">
          Live family workspace with child counts, assigned diagnostics, attendance and gradebook links, and direct messaging.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(childOptions.length ? childOptions : [{ id: "none", label: "No children linked yet" }]).map((child) => (
            <span key={child.id} className="chip">
              {child.label}
            </span>
          ))}
        </div>
      </header>

      {familyMissing ? (
        <motion.article
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel rounded-2xl border border-aurora/35 bg-aurora/10 p-5"
        >
          <h2 className="font-display text-xl text-white">Family Account Required</h2>
          <p className="mt-2 text-sm text-mist">
            A family account is required before booking, diagnostics, classroom access, or messaging actions.
          </p>
          <p className="mt-2 text-sm text-mist">
            Payment policy: payments are completed after services are provided.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              className="input-shell min-w-[220px] px-3 py-2 text-sm"
              value={newFamilyName}
              onChange={(event) => setNewFamilyName(event.target.value)}
              placeholder="Family account name"
            />
            <button
              type="button"
              className="button-primary px-4 py-2 text-xs"
              disabled={createFamilyMutation.isPending || !newFamilyName.trim()}
              onClick={() => {
                playTap();
                createFamilyMutation.mutate({ name: newFamilyName.trim() });
              }}
            >
              {createFamilyMutation.isPending ? "Creating..." : "Create Family Account"}
            </button>
          </div>
          {familyActionError ? <p className="mt-2 text-xs text-red-300">{familyActionError}</p> : null}
        </motion.article>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <motion.article whileHover={{ y: -3 }} className="stat-card">
          <p className="text-xs uppercase tracking-[0.18em] text-mist">Children</p>
          <p className="mt-2 font-display text-3xl text-white">{childCount}</p>
        </motion.article>
        <motion.article whileHover={{ y: -3 }} className="stat-card">
          <p className="text-xs uppercase tracking-[0.18em] text-mist">Assigned Tests</p>
          <p className="mt-2 font-display text-3xl text-white">{assignmentTotals.total}</p>
        </motion.article>
        <motion.article whileHover={{ y: -3 }} className="stat-card">
          <p className="text-xs uppercase tracking-[0.18em] text-mist">Pending</p>
          <p className="mt-2 font-display text-3xl text-aurora">{assignmentTotals.pending}</p>
        </motion.article>
        <motion.article whileHover={{ y: -3 }} className="stat-card">
          <p className="text-xs uppercase tracking-[0.18em] text-mist">Submitted</p>
          <p className="mt-2 font-display text-3xl text-flare">{assignmentTotals.submitted}</p>
        </motion.article>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="panel rounded-2xl p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="section-heading">Quick Actions</h2>
              <p className="section-subtitle">Bookings, support, and classroom shortcuts</p>
            </div>
            <button
              type="button"
              className="button-secondary px-3 py-1 text-xs text-mist disabled:opacity-50"
              onClick={() => void notification.request()}
              disabled={!notification.supported || notification.permission === "granted"}
            >
              {notification.permission === "granted" ? "Notifications On" : "Enable Browser Alerts"}
            </button>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 text-xs">
            {quickActionLinks.map((item, idx) => (
              <Link
                key={item.to}
                to={familyMissing ? "#" : item.to}
                className={`rounded-xl border px-3 py-2.5 ${
                  idx < 2
                    ? "border-aurora/40 bg-aurora/10 text-aurora"
                    : "border-white/20 bg-white/5 text-white"
                } ${familyMissing ? "pointer-events-none opacity-45" : ""}`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </article>

        <article className="panel rounded-2xl p-5">
          <h2 className="section-heading">Assigned Diagnostics</h2>
          <p className="section-subtitle">Real-time assignments from owner/staff</p>
          <div className="panel-scroll mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
            {highlightedAssignments.map((assignment) => (
              <div key={assignment.assignmentId} className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-white">{assignment.label}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] ${assignmentStatusClass(assignment.status)}`}>
                    {assignment.status.replaceAll("_", " ")}
                  </span>
                </div>
                <p className="mt-1 text-mist">
                  {assignment.child
                    ? `${assignment.child.firstName} ${assignment.child.lastName}`
                    : "Account-linked assignment"}{" "}
                  • Grade {assignment.grade}
                </p>
                <p className="mt-1 text-[11px] text-mist">Assigned {formatShortDate(assignment.assignedAt)}</p>
                <div className="mt-2">
                  <Link
                    to={`/diagnostic?attempt=${encodeURIComponent(assignment.attemptId)}&grade=${assignment.grade}`}
                    className="button-secondary inline-flex px-3 py-1 text-[11px] text-aurora"
                  >
                    Open Assignment
                  </Link>
                </div>
              </div>
            ))}
            {!highlightedAssignments.length ? (
              <p className="text-xs text-mist">No assignments yet. Owner/staff can assign diagnostics to children.</p>
            ) : null}
          </div>
        </article>
      </div>

      <MessagingPanel
        token={token}
        role={role}
        title="Family Direct Messages"
        initialFamilyId={familyQuery.data?.familyId ?? null}
        childOptions={childOptions}
      />

      {tourOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-40 grid place-items-center bg-ink/80 px-4"
        >
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="panel w-full max-w-md rounded-2xl p-5 shadow-glow"
          >
            <p className="text-xs uppercase tracking-[0.24em] text-aurora">In-app Tour</p>
            <h3 className="mt-2 font-display text-xl text-white">{steps[index]}</h3>
            <p className="mt-3 text-sm text-mist">{stepDetails[index]}</p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full bg-aurora"
                initial={{ width: 0 }}
                animate={{ width: `${((index + 1) / steps.length) * 100}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <button className="text-xs text-mist" onClick={finishTour}>
                Skip
              </button>
              <div className="flex gap-2">
                <button
                  className="rounded-full border border-white/20 px-3 py-1.5 text-xs"
                  onClick={() => {
                    playTap();
                    setIndex((value) => Math.max(0, value - 1));
                  }}
                  disabled={index === 0}
                >
                  Back
                </button>
                {index === steps.length - 1 ? (
                  <button className="rounded-full bg-aurora px-3 py-1.5 text-xs font-semibold text-ink" onClick={finishTour}>
                    Finish
                  </button>
                ) : (
                  <button
                    className="rounded-full bg-aurora px-3 py-1.5 text-xs font-semibold text-ink"
                    onClick={() => {
                      playTap();
                      setIndex((value) => Math.min(steps.length - 1, value + 1));
                    }}
                  >
                    Next
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </section>
  );
}
